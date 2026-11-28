/**
 * LiveMarketAnchorConstraintEngine
 * Universal SSOT Architectural Anchor for End-to-End Market Feed Parity.
 * 
 * Enforces that every data point, analytical score, and proposed order component
 * across the entire platform workflow (Terminal, Vision Atlas, Multi-Agent Debates,
 * Scalping Strategies, and Research Engine) is strictly anchored to live tick data
 * within tight, realistic variances, eliminating large pip deviations.
 */

import { CurrencyPair } from './types';
import { BASE_PRICES, PIP_VALUES } from './marketData';
import { LiveMarketFeedManager } from './liveMarketFeed';

export interface TightVarianceSpec {
  decimals: number;
  pipMultiplier: number;
  maxEntryVariancePoints: number;      // Max allowed distance of entry from live spot
  maxEntryVariancePips: number;
  minStopLossPips: number;             // Minimum stop distance to avoid spread noise
  maxStopLossPips: number;             // Maximum stop distance (strictly prevents large deviations)
  target1MinRRPips: number;            // TP1 target distance
  target1MaxRRPips: number;
  target2MinRRPips: number;            // TP2 runner distance
  target2MaxRRPips: number;
  maxPermissibleDeviationFromSpot: number; // Hard ceiling deviation threshold
}

export interface ConstrainedTradePlan {
  symbol: CurrencyPair | string;
  direction: 'BUY' | 'SELL';
  liveSpotPrice: number;
  entryPrice: number;
  entryZoneMin: number;
  entryZoneMax: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  stopLossDistancePoints: number;
  stopLossDistancePips: number;
  takeProfit1DistancePoints: number;
  takeProfit1DistancePips: number;
  riskRewardRatio: number;
  isClamped: boolean;
  varianceFromSpotPips: number;
  validationStatus: 'LIVE_SYNCHRONIZED' | 'CLAMPED_TO_TIGHT_VARIANCE' | 'RECALIBRATED_TO_SPOT';
  telemetryNote: string;
}

export class LiveMarketAnchorConstraintEngine {
  private static instance: LiveMarketAnchorConstraintEngine;

  private constructor() {}

  public static getInstance(): LiveMarketAnchorConstraintEngine {
    if (!LiveMarketAnchorConstraintEngine.instance) {
      LiveMarketAnchorConstraintEngine.instance = new LiveMarketAnchorConstraintEngine();
    }
    return LiveMarketAnchorConstraintEngine.instance;
  }

  /**
   * Retrieves the authoritative live spot price directly from the live feed SSOT.
   * Eliminates all conflicting hardcoded fallbacks across the platform.
   */
  public getAuthoritativeSpotPrice(pair: CurrencyPair | string): number {
    const cleanPair = (pair || 'EUR/USD').trim() as CurrencyPair;
    
    // 1. Try LiveMarketFeedManager authoritative price
    try {
      const liveCanonical = LiveMarketFeedManager.getCanonicalPrice(cleanPair);
      if (liveCanonical && liveCanonical > 0 && !Number.isNaN(liveCanonical)) {
        return liveCanonical;
      }
    } catch {
      // Fall through to canonical base prices
    }

    // 2. Canonical base prices (SSOT single fallback)
    if (cleanPair in BASE_PRICES) {
      return BASE_PRICES[cleanPair];
    }

    // 3. Normalized upper-case check
    const upper = cleanPair.toUpperCase();
    if (upper === 'GOLD' || upper === 'XAUUSD') return BASE_PRICES['XAU/USD'];
    if (upper === 'SILVER' || upper === 'XAGUSD') return BASE_PRICES['XAG/USD'];
    if (upper === 'EURUSD') return BASE_PRICES['EUR/USD'];
    if (upper === 'GBPUSD') return BASE_PRICES['GBP/USD'];
    if (upper === 'USDJPY') return BASE_PRICES['USD/JPY'];
    if (upper === 'NIFTY') return BASE_PRICES['NIFTY 50'];

    return 100.0;
  }

  /**
   * Returns the exact tight variance specifications by asset class.
   */
  public getTightVarianceSpec(pair: CurrencyPair | string): TightVarianceSpec {
    const sym = (pair || 'EUR/USD').toUpperCase();
    const isGold = sym.includes('XAU') || sym.includes('GOLD');
    const isSilver = sym.includes('XAG') || sym.includes('SILVER');
    const isPlatinum = sym.includes('XPT');
    const isCopper = sym.includes('COPPER');
    const isOil = sym.includes('CRUDE') || sym.includes('OIL');
    const isIndianIndex = sym.includes('NIFTY') || sym.includes('BANK NIFTY');
    const isIndianStock = ['RELIANCE', 'TCS', 'HDFC BANK', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].some(s => sym.includes(s));
    const isJpy = sym.includes('JPY');
    const isRupee = sym.includes('INR');

    // 1. Gold (XAU/USD ~3538)
    if (isGold) {
      const pipMult = 0.10; // $0.10 per pip
      return {
        decimals: 2,
        pipMultiplier: pipMult,
        maxEntryVariancePoints: 1.50, // Entry within $1.50 of spot
        maxEntryVariancePips: 15.0,
        minStopLossPips: 30.0,        // $3.00 stop
        maxStopLossPips: 70.0,        // $7.00 stop (strictly prevents $20-$100 deviations)
        target1MinRRPips: 55.0,       // $5.50 TP1
        target1MaxRRPips: 130.0,      // $13.00 TP1
        target2MinRRPips: 120.0,      // $12.00 TP2
        target2MaxRRPips: 240.0,      // $24.00 TP2
        maxPermissibleDeviationFromSpot: 3.50,
      };
    }

    // 2. Silver (XAG/USD ~41)
    if (isSilver) {
      const pipMult = 0.01;
      return {
        decimals: 3,
        pipMultiplier: pipMult,
        maxEntryVariancePoints: 0.08,
        maxEntryVariancePips: 8.0,
        minStopLossPips: 25.0,        // $0.25 stop
        maxStopLossPips: 60.0,        // $0.60 stop
        target1MinRRPips: 45.0,
        target1MaxRRPips: 110.0,
        target2MinRRPips: 100.0,
        target2MaxRRPips: 200.0,
        maxPermissibleDeviationFromSpot: 0.15,
      };
    }

    // 3. Indian Index (NIFTY 50 ~25800, BANK NIFTY ~64600)
    if (isIndianIndex) {
      const isBankNifty = sym.includes('BANK');
      const mult = isBankNifty ? 2.5 : 1.0;
      return {
        decimals: 2,
        pipMultiplier: 1.0,
        maxEntryVariancePoints: 20.0 * mult,
        maxEntryVariancePips: 20.0 * mult,
        minStopLossPips: 35.0 * mult,
        maxStopLossPips: 75.0 * mult,
        target1MinRRPips: 65.0 * mult,
        target1MaxRRPips: 140.0 * mult,
        target2MinRRPips: 130.0 * mult,
        target2MaxRRPips: 260.0 * mult,
        maxPermissibleDeviationFromSpot: 35.0 * mult,
      };
    }

    // 4. Indian Equities (~1200 - 4200 INR)
    if (isIndianStock) {
      return {
        decimals: 2,
        pipMultiplier: 0.05,
        maxEntryVariancePoints: 3.50,
        maxEntryVariancePips: 70.0,
        minStopLossPips: 150.0,
        maxStopLossPips: 350.0,
        target1MinRRPips: 280.0,
        target1MaxRRPips: 650.0,
        target2MinRRPips: 600.0,
        target2MaxRRPips: 1200.0,
        maxPermissibleDeviationFromSpot: 6.00,
      };
    }

    // 5. Forex JPY Pairs (USD/JPY ~158.5)
    if (isJpy) {
      const pipMult = 0.01;
      return {
        decimals: 3,
        pipMultiplier: pipMult,
        maxEntryVariancePoints: 0.035, // 3.5 pips
        maxEntryVariancePips: 3.5,
        minStopLossPips: 8.0,
        maxStopLossPips: 20.0,         // Max 20 pips stop
        target1MinRRPips: 15.0,
        target1MaxRRPips: 38.0,
        target2MinRRPips: 35.0,
        target2MaxRRPips: 70.0,
        maxPermissibleDeviationFromSpot: 0.10,
      };
    }

    // 6. Metals / Oil (WTI / BRENT ~83 - 92)
    if (isOil || isPlatinum || isCopper) {
      const pipMult = 0.01;
      return {
        decimals: isCopper ? 4 : 2,
        pipMultiplier: pipMult,
        maxEntryVariancePoints: 0.15,
        maxEntryVariancePips: 15.0,
        minStopLossPips: 40.0,
        maxStopLossPips: 90.0,
        target1MinRRPips: 75.0,
        target1MaxRRPips: 160.0,
        target2MinRRPips: 150.0,
        target2MaxRRPips: 300.0,
        maxPermissibleDeviationFromSpot: 0.35,
      };
    }

    // 6b. Crypto (BTC/USD, ETH/USD)
    if (sym.includes('BTC') || sym.includes('ETH')) {
      const isBtc = sym.includes('BTC');
      return {
        decimals: 2,
        pipMultiplier: isBtc ? 1.0 : 0.1,
        maxEntryVariancePoints: isBtc ? 120.0 : 4.5,
        maxEntryVariancePips: 12.0,
        minStopLossPips: isBtc ? 320.0 : 120.0,
        maxStopLossPips: isBtc ? 750.0 : 280.0,
        target1MinRRPips: isBtc ? 600.0 : 220.0,
        target1MaxRRPips: isBtc ? 1400.0 : 520.0,
        target2MinRRPips: isBtc ? 1200.0 : 450.0,
        target2MaxRRPips: isBtc ? 2600.0 : 950.0,
        maxPermissibleDeviationFromSpot: isBtc ? 250.0 : 10.0,
      };
    }

    // 6c. US Equities (NVDA, AAPL, MSFT, TSLA)
    if (sym === 'NVDA' || sym === 'AAPL' || sym === 'MSFT' || sym === 'TSLA') {
      return {
        decimals: 2,
        pipMultiplier: 0.01,
        maxEntryVariancePoints: 0.35,
        maxEntryVariancePips: 35.0,
        minStopLossPips: 80.0,
        maxStopLossPips: 220.0,
        target1MinRRPips: 160.0,
        target1MaxRRPips: 420.0,
        target2MinRRPips: 320.0,
        target2MaxRRPips: 780.0,
        maxPermissibleDeviationFromSpot: 1.0,
      };
    }

    // 7. Forex Majors Standard (EUR/USD, GBP/USD ~1.09 - 1.30)
    const pipMultiplier = 0.0001;
    return {
      decimals: 5,
      pipMultiplier,
      maxEntryVariancePoints: 0.00035, // 3.5 pips
      maxEntryVariancePips: 3.5,
      minStopLossPips: 8.0,
      maxStopLossPips: 18.0,           // Max 18 pips stop (strictly prevents 50-100 pip stops)
      target1MinRRPips: 14.0,          // 14-32 pips TP1 (1:1.75 R:R)
      target1MaxRRPips: 32.0,
      target2MinRRPips: 28.0,          // 28-55 pips TP2 (1:3.0 R:R)
      target2MaxRRPips: 55.0,
      maxPermissibleDeviationFromSpot: 0.0015, // Hard 15-pip deviation ceiling
    };
  }

  /**
   * Enforces strict, tight variance constraint on proposed trade parameters against live spot price.
   * If any proposed order leg deviates beyond realistic boundaries, it is dynamically clamped.
   */
  public enforceTightVarianceConstraint(params: {
    symbol: CurrencyPair | string;
    direction: 'BUY' | 'SELL';
    proposedEntry?: number;
    proposedStopLoss?: number;
    proposedTakeProfit1?: number;
    proposedTakeProfit2?: number;
    customSpotPrice?: number;
  }): ConstrainedTradePlan {
    const { symbol, direction } = params;
    const spec = this.getTightVarianceSpec(symbol);
    const liveSpot = params.customSpotPrice && params.customSpotPrice > 0
      ? params.customSpotPrice
      : this.getAuthoritativeSpotPrice(symbol);

    const isSell = direction === 'SELL';
    const isBuy = !isSell;
    let isClamped = false;

    // 1. Constrain Entry to Immediate Market Proximity (within maxEntryVariancePoints)
    let candidateEntry = params.proposedEntry && params.proposedEntry > 0
      ? params.proposedEntry
      : liveSpot;

    const entryDeviation = Math.abs(candidateEntry - liveSpot);
    if (entryDeviation > spec.maxEntryVariancePoints) {
      isClamped = true;
      candidateEntry = isBuy
        ? liveSpot + (spec.maxEntryVariancePoints * 0.4)
        : liveSpot - (spec.maxEntryVariancePoints * 0.4);
    }

    const entryPrice = Number(candidateEntry.toFixed(spec.decimals));
    const entryVariancePips = Number((Math.abs(entryPrice - liveSpot) / spec.pipMultiplier).toFixed(2));

    // Entry Zone boundaries strictly within maxEntryVariance
    const entryZoneMin = Number((entryPrice - spec.maxEntryVariancePoints * 0.5).toFixed(spec.decimals));
    const entryZoneMax = Number((entryPrice + spec.maxEntryVariancePoints * 0.5).toFixed(spec.decimals));

    // 2. Constrain Stop Loss to tight realistic variance (minStopLossPips to maxStopLossPips)
    let candidateSLDistPips = params.proposedStopLoss && params.proposedStopLoss > 0
      ? Math.abs(entryPrice - params.proposedStopLoss) / spec.pipMultiplier
      : (spec.minStopLossPips + spec.maxStopLossPips) / 2;

    if (candidateSLDistPips < spec.minStopLossPips || candidateSLDistPips > spec.maxStopLossPips) {
      isClamped = true;
      candidateSLDistPips = Math.min(spec.maxStopLossPips, Math.max(spec.minStopLossPips, candidateSLDistPips));
    }

    const effectiveStopLossDist = candidateSLDistPips * spec.pipMultiplier;
    const stopLoss = isBuy
      ? Number((entryPrice - effectiveStopLossDist).toFixed(spec.decimals))
      : Number((entryPrice + effectiveStopLossDist).toFixed(spec.decimals));

    // 3. Constrain Take Profit 1 (Target 1: 1.5 - 2.0x SL distance)
    const effectiveTP1DistPips = candidateSLDistPips * 1.8;
    const effectiveTP1Dist = effectiveTP1DistPips * spec.pipMultiplier;
    const takeProfit1 = isBuy
      ? Number((entryPrice + effectiveTP1Dist).toFixed(spec.decimals))
      : Number((entryPrice - effectiveTP1Dist).toFixed(spec.decimals));

    // 4. Constrain Take Profit 2 (Runner Target 2: 2.8 - 3.2x SL distance)
    const effectiveTP2DistPips = candidateSLDistPips * 3.2;
    const effectiveTP2Dist = effectiveTP2DistPips * spec.pipMultiplier;
    const takeProfit2 = isBuy
      ? Number((entryPrice + effectiveTP2Dist).toFixed(spec.decimals))
      : Number((entryPrice - effectiveTP2Dist).toFixed(spec.decimals));

    const riskRewardRatio = Number((effectiveTP1Dist / effectiveStopLossDist).toFixed(2));

    const status: ConstrainedTradePlan['validationStatus'] = isClamped
      ? 'CLAMPED_TO_TIGHT_VARIANCE'
      : 'LIVE_SYNCHRONIZED';

    const telemetryNote = isClamped
      ? `Parameters clamped to live spot ${liveSpot.toFixed(spec.decimals)}. Entry variance: ${entryVariancePips} pips (Cap: ${spec.maxEntryVariancePips} pips). SL: ${candidateSLDistPips.toFixed(1)} pips.`
      : `Synchronized to authoritative live spot ${liveSpot.toFixed(spec.decimals)} within ${entryVariancePips} pips variance. Authentic R:R ${riskRewardRatio}:1.`;

    return {
      symbol,
      direction,
      liveSpotPrice: liveSpot,
      entryPrice,
      entryZoneMin,
      entryZoneMax,
      stopLoss,
      takeProfit1,
      takeProfit2,
      stopLossDistancePoints: Number(effectiveStopLossDist.toFixed(spec.decimals)),
      stopLossDistancePips: Number(candidateSLDistPips.toFixed(1)),
      takeProfit1DistancePoints: Number(effectiveTP1Dist.toFixed(spec.decimals)),
      takeProfit1DistancePips: Number(effectiveTP1DistPips.toFixed(1)),
      riskRewardRatio,
      isClamped,
      varianceFromSpotPips: entryVariancePips,
      validationStatus: status,
      telemetryNote,
    };
  }

  /**
   * Specifically calibrates scalping setups to strict micro-variances (0.5 - 2.5 pips).
   */
  public calibrateScalpSetup(params: {
    symbol: CurrencyPair | string;
    direction: 'BUY' | 'SELL';
    liveSpotPrice?: number;
    subIndex?: number;
  }) {
    const { symbol, direction, subIndex = 0 } = params;
    const spec = this.getTightVarianceSpec(symbol);
    const spot = params.liveSpotPrice && params.liveSpotPrice > 0
      ? params.liveSpotPrice
      : this.getAuthoritativeSpotPrice(symbol);

    const isBuy = direction === 'BUY';
    const isGold = (symbol as string).includes('XAU');

    // Strict scalping micro-variance: 0.5 to 2.2 pips
    const scalpDistancePips = Number((0.5 + (subIndex * 0.3) % 1.7).toFixed(1));
    const scalpSLPips = isGold ? 15.0 : 2.5; // $1.50 in gold, 2.5 pips in FX
    const scalpTPPips = isGold ? 35.0 : 5.5; // $3.50 in gold, 5.5 pips in FX

    const entryPrice = isBuy
      ? Number((spot + (scalpDistancePips * 0.1) * spec.pipMultiplier).toFixed(spec.decimals))
      : Number((spot - (scalpDistancePips * 0.1) * spec.pipMultiplier).toFixed(spec.decimals));

    const stopLoss = isBuy
      ? Number((entryPrice - scalpSLPips * spec.pipMultiplier).toFixed(spec.decimals))
      : Number((entryPrice + scalpSLPips * spec.pipMultiplier).toFixed(spec.decimals));

    const takeProfit = isBuy
      ? Number((entryPrice + scalpTPPips * spec.pipMultiplier).toFixed(spec.decimals))
      : Number((entryPrice - scalpTPPips * spec.pipMultiplier).toFixed(spec.decimals));

    return {
      pair: symbol,
      liveSpotPrice: spot,
      entryPrice,
      stopLoss,
      takeProfit,
      distancePips: scalpDistancePips,
      slPips: scalpSLPips,
      tpPips: scalpTPPips,
      riskRewardRatio: Number((scalpTPPips / scalpSLPips).toFixed(2)),
    };
  }
}

export const liveMarketAnchorConstraintEngine = LiveMarketAnchorConstraintEngine.getInstance();
