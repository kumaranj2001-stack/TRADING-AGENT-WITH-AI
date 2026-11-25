/**
 * lib/chartjs/computeVisionAtlasOverlays.ts
 * Synchronous indicator & proprietary Vision Atlas Smart Money calculation engine
 * derived strictly from the active Chart.js live candles array.
 */

import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateVWAP,
} from '../indicators';
import { Candle } from '../types';
import {
  ChartJsCandleBar,
  VisionAtlasFvgGap,
  VisionAtlasOrderBlock,
  VisionAtlasOverlaySnapshot,
  VisionAtlasQuantumPoint,
  VisionAtlasStructureLevel,
  VisionAtlasSwingPoint,
} from './types';

export function computeVisionAtlasOverlays(
  candles: ChartJsCandleBar[],
  decimals: number = 2,
  horizonCandles: number = 6
): VisionAtlasOverlaySnapshot {
  const safeCandles = candles && candles.length > 0 ? candles : [];
  if (safeCandles.length === 0) {
    return {
      computedAt: Date.now(),
      anchorPrice: 0,
      candleCount: 0,
      ema20: [],
      ema50: [],
      ema200: [],
      vwap: [],
      bbUpper: [],
      bbMiddle: [],
      bbLower: [],
      rsi14: [],
      macdLine: [],
      macdSignal: [],
      macdHistogram: [],
      atr14: 0,
      latestRsi: 50,
      latestMacd: 0,
      latestMacdSignal: 0,
      swings: [],
      structures: [],
      orderBlocks: [],
      fairValueGaps: [],
      labZones: [],
      goldenPocket: { minPrice: 0, maxPrice: 0 },
      liquidityWalls: [],
      quantumFan: [],
    };
  }

  const closes = safeCandles.map((c) => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, Math.min(50, closes.length));
  const ema200 = calculateEMA(closes, Math.min(200, closes.length));
  const vwap = calculateVWAP(safeCandles as Candle[]);
  const bb = calculateBollingerBands(closes, 20, 2);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atrArr = calculateATR(safeCandles as Candle[], 14);

  const lastIdx = safeCandles.length - 1;
  const lastCandle = safeCandles[lastIdx];
  const anchorPrice = lastCandle.close;
  const atr14 = Math.max(atrArr[lastIdx] || anchorPrice * 0.004, anchorPrice * 0.0005);

  const roundP = (v: number) => Number(v.toFixed(decimals));

  const minC = Math.min(...safeCandles.map((c) => c.low));
  const maxC = Math.max(...safeCandles.map((c) => c.high));
  const span = Math.max(maxC - minC, atr14 * 2, anchorPrice * 0.002);

  // 1. Fractal Swings, BOS & CHoCH synced cleanly to candle indices
  const swings: VisionAtlasSwingPoint[] = [];
  const structures: VisionAtlasStructureLevel[] = [];

  for (let i = 2; i < safeCandles.length - 2; i++) {
    const cur = safeCandles[i];
    const isHigh =
      safeCandles[i - 1].high <= cur.high &&
      safeCandles[i - 2].high < cur.high &&
      safeCandles[i + 1].high <= cur.high &&
      safeCandles[i + 2].high < cur.high;
    const isLow =
      safeCandles[i - 1].low >= cur.low &&
      safeCandles[i - 2].low > cur.low &&
      safeCandles[i + 1].low >= cur.low &&
      safeCandles[i + 2].low > cur.low;

    if (isHigh) {
      swings.push({
        index: i,
        price: roundP(cur.high),
        type: 'HIGH',
        label: i > safeCandles.length - 15 ? 'SH' : 'iH',
      });
    }
    if (isLow) {
      swings.push({
        index: i,
        price: roundP(cur.low),
        type: 'LOW',
        label: i > safeCandles.length - 15 ? 'SL' : 'iL',
      });
    }
  }

  const highSwings = swings.filter((s) => s.type === 'HIGH');
  const lowSwings = swings.filter((s) => s.type === 'LOW');

  if (highSwings.length > 0) {
    const recentH = highSwings[highSwings.length - 1];
    structures.push({
      startIndex: recentH.index,
      price: recentH.price,
      direction: 'BULLISH',
      kind: anchorPrice > recentH.price ? 'BOS' : 'CHOCH',
      label: anchorPrice > recentH.price ? `BOS + ${recentH.price}` : `CHoCH ${recentH.price}`,
    });
  }
  if (lowSwings.length > 0) {
    const recentL = lowSwings[lowSwings.length - 1];
    structures.push({
      startIndex: recentL.index,
      price: recentL.price,
      direction: 'BEARISH',
      kind: anchorPrice < recentL.price ? 'BOS' : 'CHOCH',
      label: anchorPrice < recentL.price ? `BOS - ${recentL.price}` : `CHoCH ${recentL.price}`,
    });
  }

  // 2. Fair Value Gaps (FVG) directly from real 3-candle price imbalances
  const fairValueGaps: VisionAtlasFvgGap[] = [];
  for (let i = 2; i < safeCandles.length; i++) {
    const c1 = safeCandles[i - 2];
    const c3 = safeCandles[i];
    if (c3.low > c1.high + atr14 * 0.12) {
      fairValueGaps.push({
        startIndex: i - 2,
        lowPrice: roundP(c1.high),
        highPrice: roundP(c3.low),
        type: 'BULLISH_FVG',
        label: 'FVG +',
      });
    } else if (c3.high < c1.low - atr14 * 0.12) {
      fairValueGaps.push({
        startIndex: i - 2,
        lowPrice: roundP(c3.high),
        highPrice: roundP(c1.low),
        type: 'BEARISH_FVG',
        label: 'FVG -',
      });
    }
  }

  // 3. Institutional Order Blocks (last bearish candle before impulsive up-move, and vice versa)
  const orderBlocks: VisionAtlasOrderBlock[] = [];
  for (let i = safeCandles.length - 4; i >= 3; i--) {
    const ob = safeCandles[i];
    const nextMove = safeCandles[i + 1].close - ob.close;
    if (ob.close < ob.open && nextMove > atr14 * 0.9 && orderBlocks.filter((o) => o.type === 'DEMAND').length === 0) {
      orderBlocks.push({
        startIndex: i,
        endIndex: lastIdx,
        lowPrice: roundP(ob.low),
        highPrice: roundP(ob.high),
        type: 'DEMAND',
        label: `OB Demand [${roundP(ob.low)} - ${roundP(ob.high)}]`,
      });
    }
    if (ob.close > ob.open && -nextMove > atr14 * 0.9 && orderBlocks.filter((o) => o.type === 'SUPPLY').length === 0) {
      orderBlocks.push({
        startIndex: i,
        endIndex: lastIdx,
        lowPrice: roundP(ob.low),
        highPrice: roundP(ob.high),
        type: 'SUPPLY',
        label: `OB Supply [${roundP(ob.low)} - ${roundP(ob.high)}]`,
      });
    }
  }
  if (orderBlocks.length === 0) {
    orderBlocks.push(
      {
        startIndex: Math.max(0, lastIdx - 25),
        endIndex: lastIdx,
        lowPrice: roundP(minC + span * 0.08),
        highPrice: roundP(minC + span * 0.16),
        type: 'DEMAND',
        label: `OB Demand [${roundP(minC + span * 0.08)}]`,
      },
      {
        startIndex: Math.max(0, lastIdx - 25),
        endIndex: lastIdx,
        lowPrice: roundP(maxC - span * 0.16),
        highPrice: roundP(maxC - span * 0.08),
        type: 'SUPPLY',
        label: `OB Supply [${roundP(maxC - span * 0.08)}]`,
      }
    );
  }

  // 4. Vision Atlas Lab Zones anchored around live spot & swing span
  const labZones = [
    {
      name: 'DANGER ZONE (DISTRIBUTION)',
      minPrice: roundP(maxC - span * 0.10),
      maxPrice: roundP(maxC + span * 0.04),
      fillColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.40)',
      textColor: '#f87171',
    },
    {
      name: 'CONFLUENCE ENTRY ZONE',
      minPrice: roundP(anchorPrice - atr14 * 0.45),
      maxPrice: roundP(anchorPrice + atr14 * 0.25),
      fillColor: 'rgba(6, 182, 212, 0.10)',
      borderColor: 'rgba(6, 182, 212, 0.45)',
      textColor: '#22d3ee',
    },
    {
      name: 'SAFE ACCUMULATION FLOOR',
      minPrice: roundP(minC - span * 0.03),
      maxPrice: roundP(minC + span * 0.12),
      fillColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: 'rgba(16, 185, 129, 0.40)',
      textColor: '#34d399',
    },
  ];

  // 5. Golden Pocket Fib (0.618 - 0.786)
  const goldenPocket = {
    minPrice: roundP(minC + span * 0.618),
    maxPrice: roundP(minC + span * 0.786),
  };

  // 6. Right-Edge Liquidity Heatmaps anchored strictly to live spot & ATR
  const liquidityWalls = [
    { label: `ASK WALL ${roundP(anchorPrice + atr14 * 0.8)}`, price: roundP(anchorPrice + atr14 * 0.8), widthRatio: 0.78, isAsk: true },
    { label: `SELL POOL ${roundP(anchorPrice + atr14 * 1.6)}`, price: roundP(anchorPrice + atr14 * 1.6), widthRatio: 0.56, isAsk: true },
    { label: `BID WALL ${roundP(anchorPrice - atr14 * 0.8)}`, price: roundP(anchorPrice - atr14 * 0.8), widthRatio: 0.86, isAsk: false },
    { label: `BUY POOL ${roundP(anchorPrice - atr14 * 1.6)}`, price: roundP(anchorPrice - atr14 * 1.6), widthRatio: 0.62, isAsk: false },
  ];

  // 7. Quantum Vision Volatility Prediction Fan extending forward from live anchorPrice
  const emaSlope = closes.length >= 20 ? (ema20[lastIdx] - ema20[Math.max(0, lastIdx - 5)]) / 5 : 0;
  const quantumFan: VisionAtlasQuantumPoint[] = [];
  for (let step = 0; step <= horizonCandles; step++) {
    const volCone = atr14 * Math.sqrt(step) * 0.55;
    const drift = emaSlope * step * 0.6;
    quantumFan.push({
      offsetBars: step,
      upperPrice: roundP(anchorPrice + drift + volCone),
      medianPrice: roundP(anchorPrice + drift),
      lowerPrice: roundP(anchorPrice + drift - volCone),
    });
  }

  return {
    computedAt: Date.now(),
    anchorPrice,
    candleCount: safeCandles.length,
    ema20,
    ema50,
    ema200,
    vwap,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    rsi14,
    macdLine: macd.macdLine,
    macdSignal: macd.signalLine,
    macdHistogram: macd.histogram,
    atr14: roundP(atr14),
    latestRsi: Number((rsi14[lastIdx] ?? 50).toFixed(2)),
    latestMacd: Number((macd.macdLine[lastIdx] ?? 0).toFixed(5)),
    latestMacdSignal: Number((macd.signalLine[lastIdx] ?? 0).toFixed(5)),
    swings: swings.slice(-14),
    structures,
    orderBlocks,
    fairValueGaps: fairValueGaps.slice(-4),
    labZones,
    goldenPocket,
    liquidityWalls,
    quantumFan,
  };
}
