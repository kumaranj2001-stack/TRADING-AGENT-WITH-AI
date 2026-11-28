import { BASE_PRICES, PIP_VALUES, generateCandles } from './marketData';
import { calculateBollingerBands, calculateEMA, calculateMACD, calculateRSI, calculateATR } from './indicators';
import { LiveMarketFeedManager } from './liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from './liveMarketAnchorConstraintEngine';
import type { Candle, CurrencyPair, TimeFrame } from './types';

export interface UnifiedMarketIndicatorSnapshot {
  pair: CurrencyPair;
  timeframe: TimeFrame;
  spotPrice: number;
  bid: number;
  ask: number;
  spreadPips: number;
  rsi14: number;
  ema20: number;
  ema50: number;
  ema200: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  atr14: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  candles: Candle[];
  timestamp: number;
  authoritySource: 'UNIFIED_WS_SSOT';
}

/**
 * Single Authoritative Market Stream & Indicator Hub.
 * Eliminates conflicting micro-tickers and divergent RSI/EMA computations by
 * computing all indicators from the single canonical OHLCV candle buffer.
 */
export class UnifiedMarketAuthority {
  private static instance: UnifiedMarketAuthority;

  private constructor() {}

  public static getInstance(): UnifiedMarketAuthority {
    if (!UnifiedMarketAuthority.instance) {
      UnifiedMarketAuthority.instance = new UnifiedMarketAuthority();
    }
    return UnifiedMarketAuthority.instance;
  }

  public getAuthoritativeCandles(pair: CurrencyPair, timeframe: TimeFrame = '1h'): Candle[] {
    let candles = LiveMarketFeedManager.getCanonicalCandles(pair, timeframe);
    if (!candles || candles.length === 0) {
      candles = generateCandles(pair, timeframe, 60);
      LiveMarketFeedManager.setCanonicalFeed(pair, timeframe, candles);
    }
    return candles;
  }

  public getAuthoritativeSpot(pair: CurrencyPair, timeframe: TimeFrame = '1h'): number {
    const canonical = LiveMarketFeedManager.getCanonicalPrice(pair);
    if (canonical && Number.isFinite(canonical) && canonical > 0) {
      return canonical;
    }
    const candles = this.getAuthoritativeCandles(pair, timeframe);
    if (candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    return liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair) || BASE_PRICES[pair] || 1.0;
  }

  public getUnifiedSnapshot(pair: CurrencyPair, timeframe: TimeFrame = '1h'): UnifiedMarketIndicatorSnapshot {
    const candles = this.getAuthoritativeCandles(pair, timeframe);
    const closes = candles.map((c) => c.close);
    const spotPrice = closes[closes.length - 1] ?? this.getAuthoritativeSpot(pair, timeframe);
    const bidAsk = LiveMarketFeedManager.getCanonicalBidAsk(pair);

    const rsiArr = calculateRSI(closes, 14);
    const ema20Arr = calculateEMA(closes, 20);
    const ema50Arr = calculateEMA(closes, 50);
    const ema200Arr = calculateEMA(closes, 200);
    const macd = calculateMACD(closes);
    const atrArr = calculateATR(candles, 14);
    const bb = calculateBollingerBands(closes, 20, 2);

    const lastIdx = Math.max(0, closes.length - 1);
    const pip = PIP_VALUES[pair] || 0.0001;

    return {
      pair,
      timeframe,
      spotPrice,
      bid: bidAsk.bid,
      ask: bidAsk.ask,
      spreadPips: bidAsk.spreadPips,
      rsi14: rsiArr[lastIdx] ?? 50,
      ema20: ema20Arr[lastIdx] ?? spotPrice,
      ema50: ema50Arr[lastIdx] ?? spotPrice,
      ema200: ema200Arr[lastIdx] ?? spotPrice,
      macdLine: macd.macdLine[lastIdx] ?? 0,
      macdSignal: macd.signalLine[lastIdx] ?? 0,
      macdHistogram: macd.histogram[lastIdx] ?? 0,
      atr14: atrArr[lastIdx] || pip * 14,
      bbUpper: bb.upper[lastIdx] ?? spotPrice + pip * 20,
      bbMiddle: bb.middle[lastIdx] ?? spotPrice,
      bbLower: bb.lower[lastIdx] ?? spotPrice - pip * 20,
      candles,
      timestamp: LiveMarketFeedManager.getLastTickTimestamp(),
      authoritySource: 'UNIFIED_WS_SSOT',
    };
  }
}

export const unifiedMarketAuthority = UnifiedMarketAuthority.getInstance();
