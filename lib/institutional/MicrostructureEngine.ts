import type { TimeFrame } from '../types';
import type {
  MicrostructureSnapshot,
  OiDeltaDivergencePoint,
  ReconstructedTapePrint,
  RestingLiquidityHeatCell,
  TpoMarketProfileRow,
  VolumetricFootprintRow,
} from './types';
import { resolveInstitutionalAssetContext, seededRange } from './helpers';

const DEFAULT_CPP_ACSIL = `#include "sierrachart.h"
SCDLLName("QriInstAdaptiveDeltaStudy")

SCSFExport scsf_AdaptiveDeltaAbsorption(SCStudyInterfaceRef sc)
{
    SCSubgraphRef Subgraph_Absorption = sc.Subgraph[0];
    SCSubgraphRef Subgraph_ImbalanceZ = sc.Subgraph[1];

    if (sc.SetDefaults)
    {
        sc.GraphName = "QRI Adaptive Delta Absorption";
        sc.AutoLoop = 1;
        Subgraph_Absorption.Name = "Absorption Signal";
        return;
    }

    float askVol = sc.AskVolume[sc.Index];
    float bidVol = sc.BidVolume[sc.Index];
    float delta = askVol - bidVol;
    Subgraph_Absorption[sc.Index] = delta;
    Subgraph_ImbalanceZ[sc.Index] = (askVol + bidVol) > 0 ? delta / (askVol + bidVol) : 0.0f;
}`;

export class MicrostructureEngine {
  private static instance: MicrostructureEngine;

  private constructor() {}

  public static getInstance(): MicrostructureEngine {
    if (!MicrostructureEngine.instance) {
      MicrostructureEngine.instance = new MicrostructureEngine();
    }
    return MicrostructureEngine.instance;
  }

  public compileCppAcsilStudy(sourceCode: string, symbol: string, spotPrice: number): MicrostructureSnapshot['cppAcsilStudy'] {
    const fnMatches = Array.from(sourceCode.matchAll(/SCSFExport\s+([A-Za-z0-9_]+)\s*\(/g)).map((m) => m[1]);
    let braceDiff = 0;
    for (const ch of sourceCode) {
      if (ch === '{') braceDiff++;
      if (ch === '}') braceDiff--;
    }
    const compileSuccess = braceDiff === 0 && sourceCode.includes('SCSFExport') && sourceCode.includes('scsf_');
    const subgraphOutputs = Array.from({ length: 12 }, (_, idx) => {
      const hour = `${String(9 + Math.floor(idx / 2)).padStart(2, '0')}:${idx % 2 === 0 ? '00' : '30'}`;
      const studyValue = Number((seededRange(`${symbol}:cpp:${idx}:${Math.round(spotPrice * 10)}`, -180, 240)).toFixed(2));
      return {
        bar: hour,
        studyValue,
        deltaSignal: Number((studyValue / 250).toFixed(3)),
      };
    });

    return {
      sourceCode,
      compiledFunctions: fnMatches.length > 0 ? fnMatches : ['scsf_AdaptiveDeltaAbsorption'],
      subgraphOutputs,
      compileSuccess,
    };
  }

  public buildFootprintRows(symbol: string, spotPrice: number, tickStep: number, decimals: number): VolumetricFootprintRow[] {
    const raw: Array<{ price: number; bidVol: number; askVol: number }> = [];
    for (let i = 6; i >= -6; i--) {
      const price = Number((spotPrice + i * tickStep).toFixed(decimals));
      const gauss = Math.exp(-0.18 * i * i);
      const bidVol = Math.round(seededRange(`${symbol}:fpb:${i}:${Math.round(spotPrice * 10)}`, 65, 420) * (0.5 + gauss));
      const askVol = Math.round(seededRange(`${symbol}:fpa:${i}:${Math.round(spotPrice * 10)}`, 65, 420) * (0.5 + gauss));
      raw.push({ price, bidVol, askVol });
    }

    const maxTotal = Math.max(...raw.map((r) => r.bidVol + r.askVol), 1);
    const totalAll = raw.reduce((a, r) => a + r.bidVol + r.askVol, 0);

    return raw.map((r) => {
      const totalVol = r.bidVol + r.askVol;
      const delta = r.askVol - r.bidVol;
      const deltaPct = Number(((delta / Math.max(1, totalVol)) * 100).toFixed(1));
      const imbalance: VolumetricFootprintRow['imbalance'] =
        r.askVol >= r.bidVol * 1.85 ? 'ASK_IMBALANCE' : r.bidVol >= r.askVol * 1.85 ? 'BID_IMBALANCE' : 'NONE';
      return {
        price: r.price,
        bidVol: r.bidVol,
        askVol: r.askVol,
        totalVol,
        delta,
        deltaPct,
        imbalance,
        isPoc: totalVol === maxTotal,
        inValueArea: totalVol >= (totalAll / raw.length) * 0.85,
      };
    });
  }

  public buildTpoMarketProfile(symbol: string, spotPrice: number, tickStep: number, decimals: number): MicrostructureSnapshot['tpoProfile'] {
    const alphabet = 'ABCDEFGHIJKLMNOP';
    const rows: TpoMarketProfileRow[] = [];
    let pocRow: { idx: number; count: number } = { idx: 6, count: 0 };

    for (let i = 6; i >= -6; i--) {
      const price = Number((spotPrice + i * tickStep * 2).toFixed(decimals));
      const length = Math.max(1, Math.min(14, Math.round(13 * Math.exp(-0.16 * i * i) + seededRange(`${symbol}:tpo:${i}`, -2, 2))));
      let letters = '';
      for (let k = 0; k < length; k++) {
        letters += alphabet[(k + Math.abs(i)) % alphabet.length];
      }
      const rowIdx = rows.length;
      if (length > pocRow.count) {
        pocRow = { idx: rowIdx, count: length };
      }
      rows.push({
        price,
        letters,
        tpoCount: length,
        isPoc: false,
        isVah: false,
        isVal: false,
        inInitialBalance: letters.includes('A') || letters.includes('B'),
        singlePrint: length === 1,
      });
    }

    rows[pocRow.idx].isPoc = true;
    const vahIdx = Math.max(0, pocRow.idx - 3);
    const valIdx = Math.min(rows.length - 1, pocRow.idx + 3);
    rows[vahIdx].isVah = true;
    rows[valIdx].isVal = true;

    const ibPrices = rows.filter((r) => r.inInitialBalance).map((r) => r.price);
    return {
      session: 'NY_ETH_COMPOSITE',
      initialBalanceHigh: ibPrices.length > 0 ? Math.max(...ibPrices) : Number((spotPrice + tickStep * 4).toFixed(decimals)),
      initialBalanceLow: ibPrices.length > 0 ? Math.min(...ibPrices) : Number((spotPrice - tickStep * 4).toFixed(decimals)),
      poc: rows[pocRow.idx].price,
      vah: rows[vahIdx].price,
      val: rows[valIdx].price,
      poorHighDetected: rows[0].tpoCount >= 3,
      poorLowDetected: rows[rows.length - 1].tpoCount >= 3,
      singlePrintsCount: rows.filter((r) => r.singlePrint).length,
      rows,
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    smartTapeMinFilter?: number;
    cppSourceCode?: string;
    atmPreset?: string;
  }): MicrostructureSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const smartMin = params?.smartTapeMinFilter ?? 25;
    const footprintRows = this.buildFootprintRows(ctx.symbol, ctx.spotPrice, ctx.tickStep, ctx.decimals);
    const tpoProfile = this.buildTpoMarketProfile(ctx.symbol, ctx.spotPrice, ctx.tickStep, ctx.decimals);

    const restingOrderHeatmap: RestingLiquidityHeatCell[] = Array.from({ length: 11 }, (_, idx) => {
      const offset = 5 - idx;
      const price = Number((ctx.spotPrice + offset * ctx.tickStep * 2).toFixed(ctx.decimals));
      const intensities = Array.from({ length: 10 }, (__, t) =>
        Math.round(seededRange(`${ctx.symbol}:hm:${idx}:${t}:${Math.round(ctx.spotPrice)}`, 12, 98))
      );
      return {
        price,
        intensities,
        restingSize: Math.round(seededRange(`${ctx.symbol}:hm:sz:${idx}`, 120, 1450)),
        pulledDelta: Math.round(seededRange(`${ctx.symbol}:hm:pd:${idx}`, -280, 340)),
      };
    });

    const icebergDetections = [
      {
        price: Number((ctx.spotPrice - ctx.tickStep * 2).toFixed(ctx.decimals)),
        side: 'BID_ICEBERG' as const,
        visibleSize: 25,
        refilledVolume: 640,
        refillCount: 19,
        confidencePct: 92.4,
      },
      {
        price: Number((ctx.spotPrice + ctx.tickStep * 4).toFixed(ctx.decimals)),
        side: 'ASK_ICEBERG' as const,
        visibleSize: 30,
        refilledVolume: 485,
        refillCount: 14,
        confidencePct: 87.1,
      },
    ];

    const powerTrades = Array.from({ length: 5 }, (_, idx) => ({
      time: `14:${String(12 + idx * 7).padStart(2, '0')}:0${idx + 1}`,
      price: Number((ctx.spotPrice + (idx - 2) * ctx.tickStep).toFixed(ctx.decimals)),
      volumeBurst: Math.round(seededRange(`${ctx.symbol}:pwr:${idx}`, 210, 890)),
      windowMs: Math.round(seededRange(`${ctx.symbol}:pwrw:${idx}`, 45, 310)),
      deltaDirection: (idx % 2 === 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
      velocityScore: Math.round(seededRange(`${ctx.symbol}:pwrv:${idx}`, 78, 99)),
    }));

    const fullTape: ReconstructedTapePrint[] = Array.from({ length: 12 }, (_, idx) => {
      const size = Math.round(seededRange(`${ctx.symbol}:tape:${idx}`, 10, 420));
      return {
        id: `RT_${idx + 101}`,
        time: `14:${String(48 - idx).padStart(2, '0')}:22.${100 + idx * 71}`,
        price: Number((ctx.spotPrice + (idx % 5 - 2) * ctx.tickStep).toFixed(ctx.decimals)),
        parentOrderSize: size,
        childFillsMerged: Math.max(1, Math.round(size / 22)),
        aggressor: idx % 5 === 0 ? 'ICEBERG_ABSORPTION' : idx % 2 === 0 ? 'BUY_SWEEP' : 'SELL_SWEEP',
        venue: idx % 2 === 0 ? 'LMAX_LD4' : 'CME_GLOBEX',
        isPowerTrade: size >= 240,
        isIceberg: idx % 5 === 0,
      };
    });

    const reconstructedTape = fullTape.filter((t) => t.parentOrderSize >= smartMin);

    const auctionVistaTracker = Array.from({ length: 8 }, (_, idx) => {
      const bidLiquidityStacked = Math.round(seededRange(`${ctx.symbol}:avb:${idx}`, 180, 960));
      const askLiquidityPulled = Math.round(seededRange(`${ctx.symbol}:ava:${idx}`, -420, 310));
      return {
        time: `14:${String(15 + idx * 5).padStart(2, '0')}`,
        bidLiquidityStacked,
        askLiquidityPulled,
        netBookPressure: Number(((bidLiquidityStacked - Math.abs(askLiquidityPulled)) / 1000).toFixed(2)),
      };
    });

    const clusterSearchHits = footprintRows
      .filter((r) => Math.abs(r.deltaPct) >= 12 || r.isPoc)
      .slice(0, 5)
      .map((r, idx) => ({
        barTime: `14:${String(10 + idx * 8).padStart(2, '0')}`,
        price: r.price,
        clusterVolume: r.totalVol,
        deltaPct: r.deltaPct,
        zScore: Number((1.65 + idx * 0.42).toFixed(2)),
      }));

    const oiDivergenceProfile: OiDeltaDivergencePoint[] = Array.from({ length: 8 }, (_, idx) => {
      const cumDelta = Math.round(seededRange(`${ctx.symbol}:oi_d:${idx}`, -1800, 2400));
      const oiDelta = Math.round(seededRange(`${ctx.symbol}:oi_chg:${idx}`, -950, 1450));
      const regime: OiDeltaDivergencePoint['regime'] =
        cumDelta >= 0 && oiDelta >= 0
          ? 'LONG_BUILDUP'
          : cumDelta >= 0 && oiDelta < 0
          ? 'SHORT_COVERING'
          : cumDelta < 0 && oiDelta >= 0
          ? 'SHORT_BUILDUP'
          : 'LONG_LIQUIDATION';
      return {
        barTime: `${String(10 + idx).padStart(2, '0')}:00`,
        priceClose: Number((ctx.spotPrice * (1 + (idx - 4) * 0.0014)).toFixed(ctx.decimals)),
        cumulativeDelta: cumDelta,
        openInterestDelta: oiDelta,
        regime,
      };
    });

    const liquidationHeatmap = [-3.2, -1.8, -0.9, 0.9, 1.9, 3.4].map((pct, idx) => ({
      priceLevel: Number((ctx.spotPrice * (1 + pct / 100)).toFixed(ctx.decimals)),
      distancePct: pct,
      side: pct < 0 ? ('LONG_LIQ' as const) : ('SHORT_LIQ' as const),
      estimatedUsdMillions: Number(seededRange(`${ctx.symbol}:liq:${idx}`, 14.5, 118.0).toFixed(1)),
      dominantVenues: ['Binance Futures', 'Bybit', 'OKX', 'CME Micro'].slice(0, 3),
      intensity: Math.round(seededRange(`${ctx.symbol}:liqi:${idx}`, 42, 99)),
    }));

    return {
      symbol: ctx.symbol,
      spotPrice: ctx.spotPrice,
      decimals: ctx.decimals,
      footprintRows,
      atmBracket: {
        strategyName: params?.atmPreset || 'QRI Institutional Auto-Breakeven 2-Target',
        stopLossTicks: 18,
        autoBreakevenTriggerTicks: 12,
        autoBreakevenOffsetTicks: 2,
        target1Ticks: 24,
        target2Ticks: 48,
        trailingStepTicks: 6,
        status: 'BREAKEVEN_LOCKED',
      },
      tpoProfile,
      cppAcsilStudy: this.compileCppAcsilStudy(params?.cppSourceCode || DEFAULT_CPP_ACSIL, ctx.symbol, ctx.spotPrice),
      restingOrderHeatmap,
      icebergDetections,
      powerTrades,
      reconstructedTape,
      smartTapeMinFilter: smartMin,
      auctionVistaTracker,
      clusterSearchHits,
      oiDivergenceProfile,
      liquidationHeatmap,
    };
  }
}

export const microstructureEngine = MicrostructureEngine.getInstance();
