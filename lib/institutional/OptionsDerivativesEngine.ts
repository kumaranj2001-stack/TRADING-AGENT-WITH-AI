import type { TimeFrame } from '../types';
import type { OptionsDerivativesSnapshot } from './types';
import { normalCdf, normalPdf, resolveInstitutionalAssetContext, seededRange } from './helpers';

export class OptionsDerivativesEngine {
  private static instance: OptionsDerivativesEngine;

  private constructor() {}

  public static getInstance(): OptionsDerivativesEngine {
    if (!OptionsDerivativesEngine.instance) {
      OptionsDerivativesEngine.instance = new OptionsDerivativesEngine();
    }
    return OptionsDerivativesEngine.instance;
  }

  public computeBlackScholesCall(spot: number, strike: number, tYears: number, iv: number, r = 0.043): {
    callPrice: number;
    delta: number;
    gamma: number;
    vega: number;
    vanna: number;
  } {
    const safeT = Math.max(1 / 365, tYears);
    const safeIv = Math.max(0.05, iv);
    const sqrtT = Math.sqrt(safeT);
    const d1 = (Math.log(spot / strike) + (r + 0.5 * safeIv * safeIv) * safeT) / (safeIv * sqrtT);
    const d2 = d1 - safeIv * sqrtT;
    const callPrice = spot * normalCdf(d1) - strike * Math.exp(-r * safeT) * normalCdf(d2);
    const pdfD1 = normalPdf(d1);
    const delta = normalCdf(d1);
    const gamma = pdfD1 / (spot * safeIv * sqrtT);
    const vega = (spot * pdfD1 * sqrtT) / 100;
    const vanna = (-pdfD1 * d2) / safeIv;

    return {
      callPrice: Number(callPrice.toFixed(4)),
      delta: Number(delta.toFixed(3)),
      gamma: Number(gamma.toFixed(5)),
      vega: Number(vega.toFixed(3)),
      vanna: Number(vanna.toFixed(4)),
    };
  }

  /**
   * Analytical Barrier / One-Touch probability over [0, T] under geometric Brownian motion.
   */
  public computeProbabilityOfTouch(spot: number, targetPrice: number, dte: number, ivPct: number): OptionsDerivativesSnapshot['probabilityOfTouch'] {
    const tYears = Math.max(1 / 365, dte / 365);
    const sigma = Math.max(0.04, ivPct / 100);
    const denom = sigma * Math.sqrt(tYears);
    const logMoneyness = Math.log(targetPrice / Math.max(1e-8, spot));
    const probTouch = Math.min(0.999, Math.max(0.01, 2 * normalCdf(-Math.abs(logMoneyness) / denom)));
    const d2 = (Math.log(spot / targetPrice) - 0.5 * sigma * sigma * tYears) / denom;
    const probItm = targetPrice >= spot ? normalCdf(d2) : normalCdf(-d2);

    return {
      targetPrice: Number(targetPrice.toFixed(4)),
      dte,
      ivPct: Number(ivPct.toFixed(1)),
      probTouchPct: Number((probTouch * 100).toFixed(1)),
      probItmPct: Number((probItm * 100).toFixed(1)),
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    ivShiftPct?: number;
    potTargetPrice?: number;
    potDte?: number;
    minIvRankFilter?: number;
  }): OptionsDerivativesSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'NVDA', params?.timeframe || '1h');
    const spot = ctx.spotPrice;
    const ivShiftPct = params?.potDte ? (params?.ivShiftPct ?? 0) : params?.ivShiftPct ?? 0;
    const atmIv = Number((seededRange(`${ctx.symbol}:atmiv`, 18, 48)).toFixed(1));
    const hv30 = Number((atmIv * seededRange(`${ctx.symbol}:hvratio`, 0.78, 0.96)).toFixed(1));
    const ivRank = Math.round(seededRange(`${ctx.symbol}:ivr`, 28, 86));
    const ivPercentile = Math.min(99, ivRank + 6);

    const strikeStep = spot >= 1000 ? Math.round((spot * 0.01) / 5) * 5 || 10 : spot >= 50 ? 2.5 : spot >= 10 ? 0.5 : 0.005;
    const volSurface = Array.from({ length: 9 }, (_, i) => {
      const idx = i - 4;
      const strike = Number((Math.round(spot / strikeStep) * strikeStep + idx * strikeStep).toFixed(ctx.decimals));
      const moneyness = (strike - spot) / Math.max(1e-8, spot);
      const skew = -moneyness * 65 + moneyness * moneyness * 210;
      const sviSmoothedIv = Number(Math.max(7.5, atmIv + skew).toFixed(2));
      const dte7Iv = Number((sviSmoothedIv * 1.09).toFixed(2));
      const dte30Iv = sviSmoothedIv;
      const dte90Iv = Number((sviSmoothedIv * 0.93).toFixed(2));
      const bs = this.computeBlackScholesCall(spot, strike, 30 / 365, (sviSmoothedIv + ivShiftPct) / 100);
      return { strike, dte7Iv, dte30Iv, dte90Iv, sviSmoothedIv, deltaCall: bs.delta, gamma: bs.gamma, vega: bs.vega, vanna: bs.vanna };
    });

    const expectedMoveCones = [
      { horizon: 'Weekly (7 DTE)', dte: 7 },
      { horizon: 'Earnings Event', dte: 14 },
      { horizon: 'Monthly (30 DTE)', dte: 30 },
      { horizon: 'Institutional (45 DTE)', dte: 45 },
    ].map((h) => {
      const moveRatio = (atmIv / 100) * Math.sqrt(h.dte / 365);
      return {
        horizon: h.horizon,
        dte: h.dte,
        impliedMovePct: Number((moveRatio * 100).toFixed(2)),
        upper1Sigma: Number((spot * (1 + moveRatio)).toFixed(ctx.decimals)),
        lower1Sigma: Number((spot * (1 - moveRatio)).toFixed(ctx.decimals)),
        upper2Sigma: Number((spot * (1 + 2 * moveRatio)).toFixed(ctx.decimals)),
        lower2Sigma: Number((spot * (1 - 2 * moveRatio)).toFixed(ctx.decimals)),
      };
    });

    // Intraday GEX Profile and exact interpolated Zero Gamma Flip calculation
    const intradayGexProfile = volSurface.map((row, idx) => {
      const m = (row.strike - spot) / spot;
      const callGex = Number((Math.max(0.4, 24 * Math.exp(-((m - 0.015) ** 2) / 0.002) + (idx > 3 ? 6 : 0))).toFixed(2));
      const putGex = Number((-Math.max(0.4, 26 * Math.exp(-((m + 0.018) ** 2) / 0.002) + (idx <= 3 ? 8 : 0))).toFixed(2));
      return {
        strike: row.strike,
        callGexMillions: callGex,
        putGexMillions: -putGex,
        netGexMillions: Number((callGex + putGex).toFixed(2)),
      };
    });

    let zeroGammaFlipLevel = Number((spot * 0.993).toFixed(ctx.decimals));
    for (let i = 1; i < intradayGexProfile.length; i++) {
      const prev = intradayGexProfile[i - 1];
      const curr = intradayGexProfile[i];
      if ((prev.netGexMillions < 0 && curr.netGexMillions >= 0) || (prev.netGexMillions > 0 && curr.netGexMillions <= 0)) {
        const w = Math.abs(prev.netGexMillions) / Math.max(0.01, Math.abs(prev.netGexMillions) + Math.abs(curr.netGexMillions));
        zeroGammaFlipLevel = Number((prev.strike + w * (curr.strike - prev.strike)).toFixed(ctx.decimals));
        break;
      }
    }

    const totalNetGex = intradayGexProfile.reduce((a, b) => a + b.netGexMillions, 0);
    const dealerGammaPer1PctBillions = Number((totalNetGex / 18).toFixed(3));
    const gammaRegime = spot >= zeroGammaFlipLevel ? 'POSITIVE_GAMMA_DAMPENING' : 'NEGATIVE_GAMMA_ACCELERATING';

    // OptionStrat-style interactive Time x Price P&L heatmap (Long Call Spread / Iron Condor Strangle)
    const priceLevels = [-4, -2, 0, 2, 4].map((pct) => Number((spot * (1 + pct / 100)).toFixed(ctx.decimals)));
    const dateColumns = ['Now', '+7d', '+14d', '+21d', 'Expiry'];
    const baseDebit = spot * 0.025;
    const pnlMatrix = priceLevels.map((px) =>
      dateColumns.map((_, colIdx) => {
        const remT = Math.max(1 / 365, (30 - colIdx * 7.2) / 365);
        const effIv = Math.max(0.05, (atmIv + ivShiftPct) / 100);
        const bs = this.computeBlackScholesCall(px, spot, remT, effIv);
        const pnl = (bs.callPrice - baseDebit) * (spot < 20 ? 1000 : 100);
        return Number(pnl.toFixed(0));
      })
    );

    const potTarget = params?.potTargetPrice && params.potTargetPrice > 0 ? params.potTargetPrice : Number((spot * 1.035).toFixed(ctx.decimals));
    const potDte = params?.potDte ?? 21;

    return {
      symbol: ctx.symbol,
      spotPrice: spot,
      ivRank,
      ivPercentile,
      hv30,
      atmIv,
      zeroGammaFlipLevel,
      dealerGammaPer1PctBillions,
      gammaRegime,
      preMarketStats: {
        preMarketVwap: Number((spot * 0.9985).toFixed(ctx.decimals)),
        gapPct: Number(seededRange(`${ctx.symbol}:gap`, -1.4, 2.2).toFixed(2)),
        preMarketRvol: Number(seededRange(`${ctx.symbol}:pmrv`, 1.15, 2.95).toFixed(2)),
        vwapReclaimRatePct: 68.4,
      },
      volSurface,
      expectedMoveCones,
      probabilityOfTouch: this.computeProbabilityOfTouch(spot, potTarget, potDte, atmIv + ivShiftPct),
      pnlHeatmap: { ivShiftPct, priceLevels, dateColumns, pnlMatrix },
      unusualOptionsFlow: [
        { time: '14:49:18', contract: `${ctx.symbol} ${volSurface[6]?.strike ?? spot}C 21DTE`, side: 'GOLDEN_SWEEP', premiumUsd: 1420000, volToOiRatio: 6.8, sentiment: 'BULLISH' },
        { time: '14:38:52', contract: `${ctx.symbol} ${volSurface[2]?.strike ?? spot}P 14DTE`, side: 'BID_BLOCK', premiumUsd: 685000, volToOiRatio: 3.4, sentiment: 'BULLISH' },
        { time: '14:21:05', contract: `${ctx.symbol} ${volSurface[3]?.strike ?? spot}P 30DTE`, side: 'ASK_SWEEP', premiumUsd: 910000, volToOiRatio: 4.1, sentiment: 'BEARISH' },
      ],
      darkPoolPrints: [
        { time: '14:51:03', venue: 'FINRA/TRF NY4', price: Number((spot * 0.9992).toFixed(ctx.decimals)), shares: 485000, notionalMillions: 68.9, printPosition: 'AT_MID' },
        { time: '14:29:44', venue: 'EDGX DARK POOL', price: Number((spot * 1.0006).toFixed(ctx.decimals)), shares: 312000, notionalMillions: 44.3, printPosition: 'ABOVE_ASK' },
      ],
      intradayGexProfile,
      historicalEarningsMoves: [
        { quarter: 'Q4-Last', date: 'Recent Report', impliedMovePct: 8.4, realizedMovePct: 6.2, ivCrushPct: -38.4 },
        { quarter: 'Q3-Prev', date: '-1Q', impliedMovePct: 7.9, realizedMovePct: 9.8, ivCrushPct: -34.1 },
        { quarter: 'Q2-Prev', date: '-2Q', impliedMovePct: 8.1, realizedMovePct: -5.4, ivCrushPct: -41.0 },
        { quarter: 'Q1-Prev', date: '-3Q', impliedMovePct: 9.2, realizedMovePct: 11.4, ivCrushPct: -36.5 },
      ],
      thinkBackReplay: volSurface.slice(2, 7).map((v) => ({
        strike: v.strike,
        callBid: Number((Math.max(0.05, spot - v.strike + spot * 0.024) * 0.98).toFixed(2)),
        callAsk: Number((Math.max(0.08, spot - v.strike + spot * 0.024) * 1.02).toFixed(2)),
        putBid: Number((Math.max(0.05, v.strike - spot + spot * 0.021) * 0.98).toFixed(2)),
        putAsk: Number((Math.max(0.08, v.strike - spot + spot * 0.021) * 1.02).toFixed(2)),
        replayDelta: v.deltaCall,
        historicalDate: '30-Session Walkback Anchor',
      })),
      strategyOptimizer: [
        { strategy: '20-Delta Jade Lizard (High IVR Credit)', dteTarget: 35, winRatePct: 74.2, expectedReturnPct: 16.8, sharpeRatio: 2.14, maxLossPct: 12.4 },
        { strategy: '30-Delta Diagonal PMCC', dteTarget: 45, winRatePct: 66.5, expectedReturnPct: 22.4, sharpeRatio: 1.88, maxLossPct: 18.2 },
        { strategy: 'ATM Calendar Earnings Play', dteTarget: 14, winRatePct: 61.0, expectedReturnPct: 14.1, sharpeRatio: 1.56, maxLossPct: 15.0 },
      ].filter(() => (params?.minIvRankFilter ?? 0) <= ivRank + 20),
    };
  }
}

export const optionsDerivativesEngine = OptionsDerivativesEngine.getInstance();
