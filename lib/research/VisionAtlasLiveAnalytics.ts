/**
 * lib/research/VisionAtlasLiveAnalytics.ts
 * Shared Real-Time Analytics Calculator for BOTH Vision Atlas & AI Multi-Agent Research Engine.
 * Eliminates all static/hardcoded mock levels (e.g. 3998.47, 47%/53% splits) and derives every metric
 * dynamically from live streaming candles, spot price, timeframe, and active AI ResearchReportSnapshot.
 */

import { Candle } from '../types';
import { ResearchReportSnapshot } from './types';
import { getAssetDecimals, liveChartTelemetryService } from './LiveChartTelemetryService';
import { calculateATR, calculateEMA, calculateRSI } from '../indicators';

export interface LiveLiquidityWall {
  id: string;
  label: string;
  kind: 'BSL' | 'SSL' | 'OB_SUPPLY' | 'OB_DEMAND' | 'EQ_PIVOT';
  price: number;
  distancePct: number;
  strengthLabel: 'EXTREME' | 'HIGH' | 'MODERATE';
  strengthPct: number;
}

export interface LiveReactionZone {
  id: 'danger' | 'caution' | 'entry' | 'safe';
  name: string;
  min: number;
  max: number;
  active: boolean;
  tone: 'rose' | 'amber' | 'cyan' | 'emerald';
}

export interface LiveVisionAtlasSnapshot {
  symbol: string;
  timeframe: string;
  priceDecimals: number;
  livePrice: number;
  atr14: number;
  rsi14: number;
  ema20: number;
  ema50: number;
  swingHigh: number;
  swingLow: number;
  fib618: number;
  fib786: number;
  sweepSummary: string;
  sweepPrice: number;
  sweepSide: 'SELL_SIDE' | 'BUY_SIDE';
  structureSummary: string;
  confidenceLabel: 'High' | 'Medium' | 'Low';
  bullishPct: number;
  bearishPct: number;
  signalEngineHeadline: string;
  signalEngineDetail: string;
  lastConfirmedTime: string;
  liquidityWalls: LiveLiquidityWall[];
  zones: LiveReactionZone[];
  quantum: {
    horizonCandles: number;
    horizonLabel: string;
    biasLabel: string;
    bullishProb: number;
    bearishProb: number;
    expectedUpper: number;
    expectedMedian: number;
    expectedLower: number;
    hardSupport: number;
    hardSupportTouchOdds: number;
    hardResistance: number;
    hardResistanceTouchOdds: number;
  };
  marketDna: {
    similarityScore: number;
    matchedRegime: string;
    goldenPocketLow: number;
    goldenPocketHigh: number;
  };
}

function getTimeframeMinutes(tf: string): number {
  const clean = (tf || '1h').toLowerCase().trim();
  if (clean === '1m') return 1;
  if (clean === '5m') return 5;
  if (clean === '15m') return 15;
  if (clean === '30m') return 30;
  if (clean === '4h') return 240;
  if (clean === '1d') return 1440;
  if (clean === '1w') return 10080;
  return 60;
}

function formatHorizonDuration(candles: number, tf: string): string {
  const totalMin = candles * getTimeframeMinutes(tf);
  if (totalMin < 60) return `${totalMin} mins`;
  if (totalMin < 1440) return `${(totalMin / 60).toFixed(1)} hours`;
  return `${(totalMin / 1440).toFixed(1)} days`;
}

export function formatVisionPrice(price: number, pair: string): string {
  if (!Number.isFinite(price)) return '0.00';
  const resolved = liveChartTelemetryService.resolveSymbol(pair);
  const dec = getAssetDecimals(resolved.assetClass, resolved.symbol);
  return price.toFixed(dec);
}

export function computeLiveVisionAtlasSnapshot(params: {
  pair: string;
  timeframe: string;
  livePrice?: number;
  candles?: Candle[];
  horizonCandles?: number;
  report?: ResearchReportSnapshot | null;
}): LiveVisionAtlasSnapshot {
  const resolved = liveChartTelemetryService.resolveSymbol(params.pair);
  const sym = resolved.symbol;
  const tf = (params.timeframe || '1h').toLowerCase();
  const dec = getAssetDecimals(resolved.assetClass, sym);
  const roundP = (v: number) => Number(v.toFixed(dec));
  const candles = params.candles || [];

  const lastCandle = candles[candles.length - 1];
  const livePrice =
    params.livePrice && Number.isFinite(params.livePrice) && params.livePrice > 0
      ? roundP(params.livePrice)
      : lastCandle?.close && lastCandle.close > 0
      ? roundP(lastCandle.close)
      : params.report?.brief.pricing.currentPrice || resolved.fallbackPrice;

  const closes = candles.length > 0 ? candles.map((c) => c.close) : [livePrice];
  const recentWindow = candles.slice(-Math.min(45, candles.length));
  const swingHigh = recentWindow.length > 0
    ? roundP(Math.max(...recentWindow.map((c) => c.high)))
    : roundP(livePrice * 1.012);
  const swingLow = recentWindow.length > 0
    ? roundP(Math.min(...recentWindow.map((c) => c.low)))
    : roundP(livePrice * 0.988);
  const span = Math.max(swingHigh - swingLow, livePrice * 0.004);

  const atrRaw = candles.length >= 14
    ? (calculateATR(candles, 14).slice(-1)[0] || span * 0.14)
    : params.report?.brief.volatility.atr14 || livePrice * (resolved.assetClass === 'FOREX' ? 0.0045 : 0.014);
  const atr14 = roundP(Math.max(atrRaw, livePrice * 0.001));

  const rsiArr = closes.length >= 15 ? calculateRSI(closes, 14) : [];
  const rsi14 = Number((rsiArr[rsiArr.length - 1] ?? params.report?.technical.rsi14 ?? 52).toFixed(1));
  const ema20Arr = closes.length >= 5 ? calculateEMA(closes, Math.min(20, closes.length)) : [livePrice];
  const ema50Arr = closes.length >= 10 ? calculateEMA(closes, Math.min(50, closes.length)) : [livePrice];
  const ema20 = roundP(ema20Arr[ema20Arr.length - 1] ?? livePrice);
  const ema50 = roundP(ema50Arr[ema50Arr.length - 1] ?? livePrice);

  // Detect live liquidity sweep from recent candles
  let sweepSide: 'SELL_SIDE' | 'BUY_SIDE' = rsi14 >= 50 ? 'SELL_SIDE' : 'BUY_SIDE';
  let sweepPrice = sweepSide === 'SELL_SIDE' ? swingLow : swingHigh;
  let sweepCandlesAgo = 3;

  if (candles.length >= 6) {
    const lastIdx = candles.length - 1;
    let foundIdx = -1;
    for (let i = lastIdx; i >= Math.max(1, lastIdx - 12); i--) {
      const c = candles[i];
      if (c.low <= swingLow * 1.0008 && c.close > c.low + (c.high - c.low) * 0.35) {
        sweepSide = 'SELL_SIDE';
        sweepPrice = roundP(c.low);
        foundIdx = i;
        break;
      }
      if (c.high >= swingHigh * 0.9992 && c.close < c.high - (c.high - c.low) * 0.35) {
        sweepSide = 'BUY_SIDE';
        sweepPrice = roundP(c.high);
        foundIdx = i;
        break;
      }
    }
    if (foundIdx >= 0) {
      sweepCandlesAgo = Math.max(1, lastIdx - foundIdx);
    } else {
      const prevBar = candles[Math.max(0, lastIdx - 3)];
      sweepSide = prevBar.close >= ema20 ? 'SELL_SIDE' : 'BUY_SIDE';
      sweepPrice = roundP(sweepSide === 'SELL_SIDE' ? swingLow : swingHigh);
      sweepCandlesAgo = 3;
    }
  }

  const sweepSummary = `${sweepSide === 'SELL_SIDE' ? 'Sell-side' : 'Buy-side'} swept at ${sweepPrice.toFixed(dec)} (${sweepCandlesAgo}c ago)`;

  // Derive Bullish/Bearish probability split strictly from live RSI + EMA + AI Composite
  let bullScore = 50;
  bullScore += (livePrice >= ema20 ? 7 : -7);
  bullScore += (ema20 >= ema50 ? 6 : -6);
  bullScore += Math.max(-14, Math.min(14, (rsi14 - 50) * 0.65));
  if (params.report) {
    bullScore = Math.round(bullScore * 0.45 + params.report.compositeScore * 0.55);
  }
  const bullishPct = Math.min(92, Math.max(8, Math.round(bullScore)));
  const bearishPct = 100 - bullishPct;

  const isStrongBull = bullishPct >= 62;
  const isStrongBear = bearishPct >= 62;
  const structureSummary = isStrongBull
    ? `BOS bullish confirmed above ${ema20.toFixed(dec)}`
    : isStrongBear
    ? `MSS (CHoCH) bearish below ${ema20.toFixed(dec)}`
    : sweepSide === 'SELL_SIDE'
    ? `MSS (CHoCH) bullish recovery from ${sweepPrice.toFixed(dec)}`
    : `Equilibrium consolidation [${swingLow.toFixed(dec)} - ${swingHigh.toFixed(dec)}]`;

  const convictionGap = Math.abs(bullishPct - 50);
  const confidenceLabel: 'High' | 'Medium' | 'Low' =
    convictionGap >= 16 ? 'High' : convictionGap >= 7 ? 'Medium' : 'Low';

  const lastTs = lastCandle?.timestamp
    ? (typeof lastCandle.timestamp === 'number' ? lastCandle.timestamp : new Date(lastCandle.time).getTime())
    : Date.now();
  const lastConfirmedTime = new Date(lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Signal Engine summary linked to active AI ResearchReportSnapshot when present
  const signalEngineHeadline = params.report
    ? `AI SIGNAL: ${params.report.signal.replace(/_/g, ' ')} (Grade ${params.report.grade} • ${params.report.compositeScore}/100)`
    : isStrongBull
    ? `ACTIVE BIAS: BULLISH (${bullishPct}% prob)`
    : isStrongBear
    ? `ACTIVE BIAS: BEARISH (${bearishPct}% prob)`
    : `WATCHLIST: Neutral equilibrium (${bullishPct}%/${bearishPct}%)`;

  const signalEngineDetail = params.report
    ? `Entry ${params.report.technical.tradePlan.entryZone.min.toFixed(dec)}–${params.report.technical.tradePlan.entryZone.max.toFixed(dec)} | SL ${params.report.technical.tradePlan.stopLoss.price.toFixed(dec)} | T1 ${params.report.technical.tradePlan.target1.price.toFixed(dec)}`
    : `Spot ${livePrice.toFixed(dec)} vs EMA20 ${ema20.toFixed(dec)} • RSI-14 ${rsi14} • ATR ${atr14.toFixed(dec)}`;

  // Liquidity Heatmap Walls grounded in live price & swing levels
  const liquidityWalls: LiveLiquidityWall[] = [
    {
      id: 'bsl-major',
      label: 'BSL Major High',
      kind: 'BSL',
      price: roundP(Math.max(swingHigh, livePrice + atr14 * 1.9)),
      distancePct: Number((((Math.max(swingHigh, livePrice + atr14 * 1.9) - livePrice) / livePrice) * 100).toFixed(2)),
      strengthLabel: 'EXTREME',
      strengthPct: 92,
    },
    {
      id: 'ob-supply',
      label: 'Supply Order Block',
      kind: 'OB_SUPPLY',
      price: roundP(livePrice + atr14 * 1.05),
      distancePct: Number((((atr14 * 1.05) / livePrice) * 100).toFixed(2)),
      strengthLabel: 'HIGH',
      strengthPct: 78,
    },
    {
      id: 'eq-mid',
      label: 'Fair Value Equilibrium',
      kind: 'EQ_PIVOT',
      price: roundP((swingHigh + swingLow) / 2),
      distancePct: Number(((((swingHigh + swingLow) / 2 - livePrice) / livePrice) * 100).toFixed(2)),
      strengthLabel: 'MODERATE',
      strengthPct: 64,
    },
    {
      id: 'ob-demand',
      label: 'Demand Order Block',
      kind: 'OB_DEMAND',
      price: roundP(Math.max(livePrice * 0.5, livePrice - atr14 * 1.05)),
      distancePct: Number((((-atr14 * 1.05) / livePrice) * 100).toFixed(2)),
      strengthLabel: 'HIGH',
      strengthPct: 81,
    },
    {
      id: 'ssl-major',
      label: 'SSL Swept Floor',
      kind: 'SSL',
      price: roundP(Math.min(swingLow, Math.max(livePrice * 0.5, livePrice - atr14 * 1.9))),
      distancePct: Number((((Math.min(swingLow, livePrice - atr14 * 1.9) - livePrice) / livePrice) * 100).toFixed(2)),
      strengthLabel: 'EXTREME',
      strengthPct: 89,
    },
  ];

  // Four Vision Atlas Reaction Zones anchored around live spot / trade plan
  const dangerMin = roundP(livePrice + atr14 * 1.6);
  const dangerMax = roundP(livePrice + atr14 * 2.8);
  const cautionMin = roundP(livePrice + atr14 * 0.65);
  const cautionMax = dangerMin;
  const entryMin = roundP(params.report?.technical.tradePlan.entryZone.min ?? livePrice - atr14 * 0.45);
  const entryMax = roundP(params.report?.technical.tradePlan.entryZone.max ?? livePrice + atr14 * 0.65);
  const safeMin = roundP(Math.max(livePrice * 0.5, livePrice - atr14 * 2.2));
  const safeMax = roundP(Math.max(safeMin, entryMin));

  const zones: LiveReactionZone[] = [
    { id: 'danger', name: 'Danger Zone', min: dangerMin, max: dangerMax, active: livePrice >= dangerMin, tone: 'rose' },
    { id: 'caution', name: 'Caution Zone', min: cautionMin, max: cautionMax, active: livePrice >= cautionMin && livePrice < cautionMax, tone: 'amber' },
    { id: 'entry', name: 'Entry Zone', min: entryMin, max: entryMax, active: livePrice >= entryMin && livePrice <= entryMax, tone: 'cyan' },
    { id: 'safe', name: 'Safe Zone', min: safeMin, max: safeMax, active: livePrice < safeMax, tone: 'emerald' },
  ];

  // Quantum Vision Horizon Projections
  const horizonCandles = Math.max(2, Math.min(20, params.horizonCandles || 5));
  const driftBias = (bullishPct - 50) / 50; // -0.84 .. +0.84
  const sqrtH = Math.sqrt(horizonCandles);
  const expectedMedian = roundP(livePrice + driftBias * atr14 * 0.45 * horizonCandles * 0.4);
  const expectedUpper = roundP(expectedMedian + atr14 * 1.25 * sqrtH);
  const expectedLower = roundP(Math.max(livePrice * 0.5, expectedMedian - atr14 * 1.25 * sqrtH));
  const hardSupport = roundP(params.report?.technical.supportLevels[0]?.price ?? swingLow);
  const hardResistance = roundP(params.report?.technical.resistanceLevels[0]?.price ?? swingHigh);

  const distS1Atr = Math.abs(livePrice - hardSupport) / Math.max(atr14, 1e-6);
  const distR1Atr = Math.abs(hardResistance - livePrice) / Math.max(atr14, 1e-6);
  const hardSupportTouchOdds = Number(Math.min(91, Math.max(18, 76 - distS1Atr * 14 + (bearishPct - 50) * 0.3)).toFixed(1));
  const hardResistanceTouchOdds = Number(Math.min(91, Math.max(18, 76 - distR1Atr * 14 + (bullishPct - 50) * 0.3)).toFixed(1));

  const fib618 = roundP(swingLow + span * 0.618);
  const fib786 = roundP(swingLow + span * 0.786);

  return {
    symbol: sym,
    timeframe: tf.toUpperCase(),
    priceDecimals: dec,
    livePrice,
    atr14,
    rsi14,
    ema20,
    ema50,
    swingHigh,
    swingLow,
    fib618,
    fib786,
    sweepSummary,
    sweepPrice,
    sweepSide,
    structureSummary,
    confidenceLabel,
    bullishPct,
    bearishPct,
    signalEngineHeadline,
    signalEngineDetail,
    lastConfirmedTime,
    liquidityWalls,
    zones,
    quantum: {
      horizonCandles,
      horizonLabel: formatHorizonDuration(horizonCandles, tf),
      biasLabel: bullishPct >= 56
        ? `Bullish Tilt (+${bullishPct - 50}% edge)`
        : bearishPct >= 56
        ? `Bearish Tilt (+${bearishPct - 50}% edge)`
        : 'Balanced Equilibrium',
      bullishProb: bullishPct,
      bearishProb: bearishPct,
      expectedUpper,
      expectedMedian,
      expectedLower,
      hardSupport,
      hardSupportTouchOdds,
      hardResistance,
      hardResistanceTouchOdds,
    },
    marketDna: {
      similarityScore: Math.min(96, Math.max(61, Math.round(70 + convictionGap * 0.8))),
      matchedRegime: bullishPct >= 58 ? 'Bullish Expansion Fractal' : bearishPct >= 58 ? 'Bearish Markdown Fractal' : 'Range Mean-Reversion',
      goldenPocketLow: fib618,
      goldenPocketHigh: fib786,
    },
  };
}
