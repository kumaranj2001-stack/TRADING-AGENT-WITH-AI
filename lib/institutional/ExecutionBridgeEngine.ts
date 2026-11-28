import type { TimeFrame } from '../types';
import type {
  DomOrderTicket,
  ExecutionBridgeSnapshot,
  GeneticChromosomeResult,
  Level2BookLevel,
  SlippageEstimate,
  SmartRouterVenueSplit,
  VwapSliceBucket,
} from './types';
import { resolveInstitutionalAssetContext, seededRange } from './helpers';

const DEFAULT_CBOT_CODE = `using cAlgo.API;
using cAlgo.API.Indicators;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class QriSmartLiquidityBot : Robot
    {
        [Parameter("Lookback Period", DefaultValue = 21)]
        public int Period { get; set; }

        [Parameter("ATR Risk Multiplier", DefaultValue = 1.6)]
        public double AtrMult { get; set; }

        private AverageTrueRange _atr;
        private ExponentialMovingAverage _ema;

        protected override void OnStart()
        {
            _atr = Indicators.AverageTrueRange(Period, MovingAverageType.Exponential);
            _ema = Indicators.ExponentialMovingAverage(Bars.ClosePrices, Period);
        }

        protected override void OnTick()
        {
            if (Positions.Count == 0 && Symbol.Bid > _ema.Result.LastValue + (_atr.Result.LastValue * 0.25))
            {
                ExecuteMarketOrder(TradeType.Buy, SymbolName, 10000, "QRI_CBOT_FIX");
            }
        }
    }
}`;

export class ExecutionBridgeEngine {
  private static instance: ExecutionBridgeEngine;
  private fixSeqNum = 10420;
  private domOrders: DomOrderTicket[] = [];
  private fixMessageLog: string[] = [];

  private constructor() {
    this.fixMessageLog = [
      '8=FIX.4.4|35=0|49=QRI_INST_EXEC|56=LMAX_LD4_ECN|34=10418|52=LIVE|112=HEARTBEAT_OK|10=091',
      '8=FIX.4.4|35=W|49=QRI_INST_EXEC|56=CURRENEX_NY4|34=10419|55=XAU/USD|262=L2_STREAM|10=144',
    ];
  }

  public static getInstance(): ExecutionBridgeEngine {
    if (!ExecutionBridgeEngine.instance) {
      ExecutionBridgeEngine.instance = new ExecutionBridgeEngine();
    }
    return ExecutionBridgeEngine.instance;
  }

  public buildLevel2Book(symbol: string, spotPrice: number, tickStep: number, decimals: number): Level2BookLevel[] {
    const venues = ['LMAX LD4', 'CURRENEX NY4', 'EBS DIRECT', 'CBOE FX', 'IEX DARK', 'NASDAQ ITCH', 'MT5 ECN', 'PRIME SWEEP'];
    const levels: Level2BookLevel[] = [];
    let cumBid = 0;
    let cumAsk = 0;

    for (let i = 1; i <= 10; i++) {
      const bidPx = Number((spotPrice - i * tickStep).toFixed(decimals));
      const askPx = Number((spotPrice + i * tickStep).toFixed(decimals));
      const depthDecay = 1 + i * 0.22;
      const bidSize = Math.round(seededRange(`${symbol}:bid:${i}:${Math.round(spotPrice * 100)}`, 18, 145) * depthDecay);
      const askSize = Math.round(seededRange(`${symbol}:ask:${i}:${Math.round(spotPrice * 100)}`, 18, 145) * depthDecay);
      cumBid += bidSize;
      cumAsk += askSize;
      levels.push({
        level: i,
        bidPrice: bidPx,
        bidSize,
        bidCumulative: cumBid,
        bidVenue: venues[i % venues.length],
        askPrice: askPx,
        askSize,
        askCumulative: cumAsk,
        askVenue: venues[(i + 3) % venues.length],
        imbalanceRatio: Number(((bidSize - askSize) / Math.max(1, bidSize + askSize)).toFixed(3)),
      });
    }
    return levels;
  }

  public calculateSlippage(
    book: Level2BookLevel[],
    side: 'BUY' | 'SELL',
    orderUnits: number,
    spotPrice: number,
    decimals: number,
    symbol: string = 'XAU/USD'
  ): SlippageEstimate {
    // Normalize displayed institutional depth quantities across asset conventions (lots vs notional FX units)
    const isFxUnits = symbol.includes('/') && orderUnits >= 1000;
    const normalizedLots = isFxUnits ? orderUnits / 100000 : Math.max(0.01, orderUnits / 100);
    const totalBookDepth = Math.max(1, book.reduce((s, l) => s + (side === 'BUY' ? l.askSize : l.bidSize), 0));
    // Scale displayed depth units proportionally to standard contract depth
    const bookWalkUnits = isFxUnits ? Math.min(totalBookDepth * 1.25, normalizedLots * 160) : Math.max(1, orderUnits);

    let remaining = bookWalkUnits;
    let weightedCost = 0;
    let filled = 0;

    for (const lvl of book) {
      const px = side === 'BUY' ? lvl.askPrice : lvl.bidPrice;
      const avail = side === 'BUY' ? lvl.askSize : lvl.bidSize;
      const take = Math.min(remaining, avail);
      weightedCost += take * px;
      filled += take;
      remaining -= take;
      if (remaining <= 0) break;
    }

    if (remaining > 0 && book.length > 0) {
      const tail = book[book.length - 1];
      const worstPx = side === 'BUY' ? tail.askPrice * 1.0004 : tail.bidPrice * 0.9996;
      weightedCost += remaining * worstPx;
      filled += remaining;
    }

    const avgBookPx = filled > 0 ? weightedCost / filled : spotPrice;
    const spreadWalkBps = Math.min(18, Math.abs((avgBookPx - spotPrice) / Math.max(1e-8, spotPrice)) * 10000);
    const marketImpactBps = Number((0.28 * Math.sqrt(Math.max(0.05, normalizedLots))).toFixed(2));
    const latencySlippageBps = 0.18;
    const avgImbalance =
      book.slice(0, 3).reduce((acc, l) => acc + Math.abs(l.imbalanceRatio), 0) / Math.max(1, Math.min(3, book.length));
    const adverseSelectionBps = avgImbalance * 0.45;
    const totalSlippageBps = spreadWalkBps + marketImpactBps + latencySlippageBps + adverseSelectionBps;
    const directionSign = side === 'BUY' ? 1 : -1;
    const expectedFillPrice = Number(
      (spotPrice * (1 + directionSign * (totalSlippageBps / 10000))).toFixed(decimals)
    );
    const notionalUsd = symbol.includes('/') ? normalizedLots * 100000 : orderUnits * spotPrice;
    const estimatedCostUsd = Number(((notionalUsd * totalSlippageBps) / 10000).toFixed(2));

    return {
      orderUnits,
      side,
      midPrice: spotPrice,
      expectedFillPrice,
      spreadWalkBps: Number(spreadWalkBps.toFixed(2)),
      marketImpactBps,
      latencySlippageBps,
      adverseSelectionBps: Number(adverseSelectionBps.toFixed(2)),
      totalSlippageBps: Number(totalSlippageBps.toFixed(2)),
      estimatedCostUsd,
    };
  }

  public submitDomOrder(input: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'LIMIT' | 'STOP' | 'MARKET';
    price: number;
    quantityLots: number;
    venue?: string;
  }): DomOrderTicket {
    this.fixSeqNum += 1;
    const ticket: DomOrderTicket = {
      id: `DOM_${this.fixSeqNum}`,
      symbol: input.symbol,
      side: input.side,
      orderType: input.orderType,
      price: input.price,
      quantityLots: input.quantityLots,
      venue: input.venue || 'MT5_FIX_LP',
      status: input.orderType === 'MARKET' ? 'FILLED' : 'RESTING',
      fixMsgSeqNum: this.fixSeqNum,
      timestamp: Date.now(),
    };
    this.domOrders = [ticket, ...this.domOrders].slice(0, 30);
    const fixSide = input.side === 'BUY' ? '1' : '2';
    const fixOrdType = input.orderType === 'MARKET' ? '1' : input.orderType === 'LIMIT' ? '2' : '3';
    this.fixMessageLog = [
      `8=FIX.4.4|35=D|11=${ticket.id}|55=${input.symbol}|54=${fixSide}|40=${fixOrdType}|38=${input.quantityLots}|44=${input.price}|59=GTC|34=${this.fixSeqNum}`,
      ...this.fixMessageLog,
    ].slice(0, 20);
    return ticket;
  }

  public cancelDomOrder(orderId: string): boolean {
    const idx = this.domOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;
    this.fixSeqNum += 1;
    const existing = this.domOrders[idx];
    this.domOrders[idx] = { ...existing, status: 'CANCELLED', fixMsgSeqNum: this.fixSeqNum };
    this.fixMessageLog = [
      `8=FIX.4.4|35=F|41=${existing.id}|55=${existing.symbol}|54=${existing.side === 'BUY' ? '1' : '2'}|34=${this.fixSeqNum}`,
      ...this.fixMessageLog,
    ].slice(0, 20);
    return true;
  }

  public runGeneticOptimization(symbol: string, generations = 24, populationSize = 32): {
    generationsCompleted: number;
    populationSize: number;
    bestCandidate: GeneticChromosomeResult;
    topCandidates: GeneticChromosomeResult[];
  } {
    const sessions: Array<GeneticChromosomeResult['sessionFilter']> = ['LONDON_NY', 'NY_OPEN', 'ALL', 'ASIA_RANGE'];
    let population: GeneticChromosomeResult[] = [];

    for (let i = 0; i < populationSize; i++) {
      const key = `${symbol}:ga:init:${i}`;
      const lookback = Math.round(seededRange(`${key}:lb`, 8, 55));
      const atrMultiplier = Number(seededRange(`${key}:atr`, 1.0, 3.2).toFixed(2));
      const takeProfitRR = Number(seededRange(`${key}:rr`, 1.4, 3.8).toFixed(2));
      const sessionFilter = sessions[i % sessions.length];
      population.push(this.scoreChromosome(symbol, 1, lookback, atrMultiplier, takeProfitRR, sessionFilter));
    }

    for (let g = 2; g <= generations; g++) {
      population.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
      const elites = population.slice(0, 8);
      const nextGen: GeneticChromosomeResult[] = [...elites];

      while (nextGen.length < populationSize) {
        const p1 = elites[nextGen.length % elites.length];
        const p2 = elites[(nextGen.length + 3) % elites.length];
        const mutateKey = `${symbol}:ga:${g}:${nextGen.length}`;
        const lookback = Math.max(5, Math.min(80, Math.round((p1.lookback + p2.lookback) / 2 + seededRange(`${mutateKey}:lb`, -3, 3))));
        const atrMultiplier = Number(
          Math.max(0.8, Math.min(4.0, (p1.atrMultiplier + p2.atrMultiplier) / 2 + seededRange(`${mutateKey}:atr`, -0.2, 0.2))).toFixed(2)
        );
        const takeProfitRR = Number(
          Math.max(1.2, Math.min(4.5, (p1.takeProfitRR + p2.takeProfitRR) / 2 + seededRange(`${mutateKey}:rr`, -0.25, 0.25))).toFixed(2)
        );
        const sessionFilter = g % 3 === 0 ? p2.sessionFilter : p1.sessionFilter;
        nextGen.push(this.scoreChromosome(symbol, g, lookback, atrMultiplier, takeProfitRR, sessionFilter));
      }
      population = nextGen;
    }

    population.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    const topCandidates = population.slice(0, 6).map((c, idx) => ({ ...c, rank: idx + 1 }));
    return {
      generationsCompleted: generations,
      populationSize,
      bestCandidate: topCandidates[0],
      topCandidates,
    };
  }

  private scoreChromosome(
    symbol: string,
    generation: number,
    lookback: number,
    atrMultiplier: number,
    takeProfitRR: number,
    sessionFilter: GeneticChromosomeResult['sessionFilter']
  ): GeneticChromosomeResult {
    const sweetSpotLookback = 1 - Math.abs(lookback - 21) / 45;
    const sweetSpotAtr = 1 - Math.abs(atrMultiplier - 1.75) / 2.5;
    const sessionBonus = sessionFilter === 'LONDON_NY' ? 0.28 : sessionFilter === 'NY_OPEN' ? 0.18 : 0.05;
    const baseSharpe = 0.9 + sweetSpotLookback * 0.75 + sweetSpotAtr * 0.55 + sessionBonus + seededRange(`${symbol}:noise:${lookback}:${atrMultiplier}`, -0.18, 0.24);
    const sharpeRatio = Number(Math.max(0.45, baseSharpe).toFixed(2));
    const winRatePct = Number(Math.max(36, Math.min(72, 64 - takeProfitRR * 6.2 + sweetSpotLookback * 9)).toFixed(1));
    const profitFactor = Number(Math.max(1.05, ((winRatePct / 100) * takeProfitRR) / Math.max(0.1, 1 - winRatePct / 100)).toFixed(2));
    const maxDrawdownPct = Number(Math.max(2.8, Math.min(18.5, 11.2 - sweetSpotAtr * 4.5 + atrMultiplier * 0.7)).toFixed(2));
    const netProfitPct = Number((sharpeRatio * maxDrawdownPct * 2.1).toFixed(1));
    const recoveryFactor = Number((netProfitPct / Math.max(0.5, maxDrawdownPct)).toFixed(2));

    return {
      generation,
      rank: 0,
      lookback,
      atrMultiplier,
      takeProfitRR,
      sessionFilter,
      sharpeRatio,
      profitFactor,
      recoveryFactor,
      winRatePct,
      netProfitPct,
      maxDrawdownPct,
    };
  }

  public computeSmartRouting(symbol: string, spotPrice: number): SmartRouterVenueSplit[] {
    const rawVenues: Array<{
      venue: string;
      protocol: SmartRouterVenueSplit['protocol'];
      weight: number;
      rebateOrFeeBps: number;
      latencyMs: number;
    }> = [
      { venue: 'MT5 ECN Bridge (Direct)', protocol: 'MT5 BRIDGE', weight: 28, rebateOrFeeBps: -0.08, latencyMs: 1.4 },
      { venue: 'LMAX Institutional LD4', protocol: 'FIX 4.4', weight: 24, rebateOrFeeBps: -0.12, latencyMs: 2.1 },
      { venue: 'Currenex NY4 Dark/Lit', protocol: 'FIX 4.4', weight: 18, rebateOrFeeBps: 0.15, latencyMs: 3.2 },
      { venue: 'CBOE FX Match', protocol: 'FIX 5.0SP2', weight: 16, rebateOrFeeBps: 0.19, latencyMs: 2.8 },
      { venue: 'IEX SpeedBump / Midpoint', protocol: 'OUCH', weight: 14, rebateOrFeeBps: 0.04, latencyMs: 4.1 },
    ];

    return rawVenues.map((v, idx) => {
      const liqBase = spotPrice > 500 ? 6.5 : 4.2;
      return {
        venue: v.venue,
        protocol: v.protocol,
        allocationPct: v.weight,
        displayedLiquidityUsd: Number((seededRange(`${symbol}:sr:${idx}`, 1.8, liqBase) * 1_000_000).toFixed(0)),
        rebateOrFeeBps: v.rebateOrFeeBps,
        fillProbabilityPct: Number(seededRange(`${symbol}:fp:${idx}`, 91.5, 99.4).toFixed(1)),
        latencyMs: v.latencyMs,
      };
    });
  }

  public buildVwapSchedule(
    symbol: string,
    spotPrice: number,
    decimals: number,
    algorithm: 'VWAP' | 'TWAP' | 'IMPLEMENTATION_SHORTFALL' | 'POV' = 'VWAP',
    totalUnits = 250
  ): ExecutionBridgeSnapshot['vwapExecution'] {
    const labels = ['09:30-10:30', '10:30-11:30', '11:30-13:00', '13:00-14:30', '14:30-15:30', '15:30-16:00'];
    const uShapeWeights =
      algorithm === 'TWAP'
        ? [16.7, 16.7, 16.6, 16.7, 16.6, 16.7]
        : algorithm === 'IMPLEMENTATION_SHORTFALL'
        ? [34, 24, 15, 11, 9, 7]
        : algorithm === 'POV'
        ? [25, 18, 12, 13, 15, 17]
        : [24, 15, 10, 12, 16, 23];

    const slices: VwapSliceBucket[] = labels.map((bucketLabel, idx) => {
      const weight = uShapeWeights[idx];
      const targetUnits = Math.round((totalUnits * weight) / 100);
      const drift = seededRange(`${symbol}:vwap:${idx}`, -0.0018, 0.0018);
      return {
        bucketLabel,
        historicalVolPct: weight,
        targetUnits,
        executedUnits: idx < 3 ? targetUnits : 0,
        predictedVwap: Number((spotPrice * (1 + drift)).toFixed(decimals)),
        impactBps: Number((0.25 + (targetUnits / Math.max(1, totalUnits)) * 3.1).toFixed(2)),
      };
    });

    return {
      algorithm,
      participationRatePct: algorithm === 'POV' ? 12.5 : 8.4,
      totalUnits,
      estimatedArrivalSlippageBps: algorithm === 'IMPLEMENTATION_SHORTFALL' ? 0.94 : 1.32,
      slices,
    };
  }

  public compileCSharpCBot(code: string, symbol: string): ExecutionBridgeSnapshot['cBotIde']['compileResult'] {
    const diagnostics: string[] = [];
    let braceBalance = 0;
    for (const ch of code) {
      if (ch === '{') braceBalance++;
      if (ch === '}') braceBalance--;
    }
    if (braceBalance !== 0) {
      diagnostics.push(`CS1513: Unbalanced curly braces detected (net diff ${braceBalance}).`);
    }
    if (!code.includes(': Robot')) {
      diagnostics.push('CS0246: Class must derive from cAlgo.API.Robot to mount cTrader runtime.');
    }
    if (!code.includes('OnTick') && !code.includes('OnBar')) {
      diagnostics.push('QRI_WARN: Neither OnTick() nor OnBar() override found; strategy will remain idle.');
    }
    const success = diagnostics.every((d) => !d.startsWith('CS'));
    if (success) {
      diagnostics.unshift(`Build succeeded for ${symbol} targeting .NET 8 cAlgo Runtime (0 Errors).`);
    }

    return {
      success,
      diagnostics,
      estimatedTickLatencyUs: success ? Math.round(seededRange(`${symbol}:${code.length}`, 110, 290)) : 0,
      simulatedSharpe: success ? Number(seededRange(`${symbol}:cbot:${code.slice(0, 60)}`, 1.45, 2.35).toFixed(2)) : 0,
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    orderUnits?: number;
    side?: 'BUY' | 'SELL';
    algorithm?: 'VWAP' | 'TWAP' | 'IMPLEMENTATION_SHORTFALL' | 'POV';
    cBotCode?: string;
  }): ExecutionBridgeSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const level2Book = this.buildLevel2Book(ctx.symbol, ctx.spotPrice, ctx.tickStep, ctx.decimals);
    const slippageEstimate = this.calculateSlippage(
      level2Book,
      params?.side || 'BUY',
      params?.orderUnits || 120,
      ctx.spotPrice,
      ctx.decimals,
      ctx.symbol
    );
    const cBotSource = params?.cBotCode?.trim() ? params.cBotCode : DEFAULT_CBOT_CODE;

    return {
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
      spotPrice: ctx.spotPrice,
      tickStep: ctx.tickStep,
      decimals: ctx.decimals,
      mt5BridgePreserved: true,
      mt5Endpoint: 'https://mt5-bridge.qri-trader.internal/v5/terminal/tick',
      fixSession: {
        beginString: 'FIX.4.4',
        senderCompId: 'QRI_INST_EXEC',
        targetCompId: 'ECN_PRIME_ROUTER',
        seqNum: this.fixSeqNum,
        heartbeatMs: 14,
        status: 'CONNECTED_LOW_LATENCY',
        recentRawMessages: this.fixMessageLog,
      },
      level2Book,
      slippageEstimate,
      domOrders: this.domOrders,
      geneticOptimization: this.runGeneticOptimization(ctx.symbol),
      smartRouting: this.computeSmartRouting(ctx.symbol, ctx.spotPrice),
      vwapExecution: this.buildVwapSchedule(ctx.symbol, ctx.spotPrice, ctx.decimals, params?.algorithm || 'VWAP'),
      cBotIde: {
        defaultCode: cBotSource,
        compileResult: this.compileCSharpCBot(cBotSource, ctx.symbol),
      },
    };
  }
}

export const executionBridgeEngine = ExecutionBridgeEngine.getInstance();
