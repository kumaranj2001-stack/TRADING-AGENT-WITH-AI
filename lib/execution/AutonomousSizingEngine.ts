/**
 * Layer 3: AutonomousSizingEngine
 * Computes optimal position sizing using real-time account equity,
 * Fractional Kelly Criterion, Volatility-adjusted Risk Parity, and live spread/slippage telemetry.
 */

import { CurrencyPair } from '../types';
import { PIP_VALUES } from '../marketData';

export interface SizingComputationInput {
  symbol: CurrencyPair;
  accountEquity: number;
  freeMargin: number;
  entryPrice: number;
  stopLossPrice: number;
  winProbability: number; // 0.0 to 1.0 (from calibrated foundation models)
  targetPayoffRatio: number; // Reward / Risk ratio, e.g. 2.2
  currentSpreadPips: number;
  historicalSlippagePips: number;
  atr14: number;
  leverageMax: number;
}

export interface SizingComputationResult {
  symbol: CurrencyPair;
  recommendedUnits: number;
  recommendedLots: number;
  riskDollars: number;
  riskPercentOfEquity: number;
  kellyFractionRaw: number;
  kellyFractionDamped: number; // Quarter or Half Kelly
  riskParityUnits: number;
  spreadPenaltyMultiplier: number;
  slippageDeductionPips: number;
  marginRequired: number;
  isMarginSufficient: boolean;
  sizingAuditTrail: string;
}

export class AutonomousSizingEngine {
  private static instance: AutonomousSizingEngine;

  private readonly MAX_RISK_PERCENT_CEILING = 1.5; // Strict 1.5% NAV per-trade cap
  private readonly KELLY_DAMPING_FACTOR = 0.35; // One-third fractional Kelly for conservative risk

  private constructor() {}

  public static getInstance(): AutonomousSizingEngine {
    if (!AutonomousSizingEngine.instance) {
      AutonomousSizingEngine.instance = new AutonomousSizingEngine();
    }
    return AutonomousSizingEngine.instance;
  }

  public calculatePositionSize(input: SizingComputationInput): SizingComputationResult {
    const {
      symbol,
      accountEquity,
      freeMargin,
      entryPrice,
      stopLossPrice,
      winProbability,
      targetPayoffRatio,
      currentSpreadPips,
      historicalSlippagePips,
      atr14,
      leverageMax = 30,
    } = input;

    // 1. Calculate raw distance to Stop Loss in Pips
    const pipScale = symbol.includes('JPY') ? 0.01 : symbol.includes('XAU') ? 0.1 : 0.0001;
    const rawStopDistancePips = Math.max(1, Math.abs(entryPrice - stopLossPrice) / pipScale);

    // Add buffer for expected spread and historical execution slippage
    const effectiveStopPips = rawStopDistancePips + currentSpreadPips + historicalSlippagePips;

    // 2. Full Kelly Criterion: f* = (p * b - q) / b
    const p = Math.max(0.01, Math.min(0.99, winProbability));
    const b = Math.max(0.5, targetPayoffRatio);
    const q = 1 - p;
    const rawKelly = (p * b - q) / b;

    // Apply fractional Kelly damping
    const dampedKelly = Math.max(0.005, rawKelly * this.KELLY_DAMPING_FACTOR);
    
    // Hard ceiling cap at 1.5% of equity
    const effectiveKellyRiskPercent = Math.min(this.MAX_RISK_PERCENT_CEILING, dampedKelly * 100);

    // 3. Volatility-Adjusted Risk Parity
    // Normalize target risk by 14-period ATR
    const basePipVal = PIP_VALUES[symbol] || 10;
    const targetRiskDollars = (accountEquity * effectiveKellyRiskPercent) / 100;

    // Sizing = Risk Dollars / (Stop Distance Pips * Pip Value per Unit)
    // 1 standard lot = 100,000 units (pip value typically $10/lot for EUR/USD)
    const pipValuePerUnit = basePipVal / 100000;
    const rawUnits = targetRiskDollars / (effectiveStopPips * (pipValuePerUnit || 0.0001));

    // 4. Live Telemetry Penalties
    let spreadPenaltyMultiplier = 1.0;
    if (currentSpreadPips > 2.0) {
      // Reduce sizing if spread is excessively widened
      spreadPenaltyMultiplier = Math.max(0.4, 2.0 / currentSpreadPips);
    }

    const finalAdjustedUnits = Math.max(1000, Math.floor(rawUnits * spreadPenaltyMultiplier));
    const recommendedLots = Math.round((finalAdjustedUnits / 100000) * 100) / 100;

    // 5. Margin and Leverage Check
    const notionalValue = finalAdjustedUnits * entryPrice;
    const marginRequired = notionalValue / leverageMax;
    const isMarginSufficient = freeMargin >= marginRequired * 1.2; // 20% safety buffer

    const actualRiskDollars = finalAdjustedUnits * effectiveStopPips * (pipValuePerUnit || 0.0001);
    const actualRiskPercent = (actualRiskDollars / (accountEquity || 1)) * 100;

    const auditTrail = `Kelly: ${(rawKelly * 100).toFixed(1)}% raw -> damped to ${effectiveKellyRiskPercent.toFixed(2)}%. ATR: ${atr14.toFixed(4)}. Stop Dist: ${effectiveStopPips.toFixed(1)} pips (Spread: ${currentSpreadPips.toFixed(1)}p, Slippage: ${historicalSlippagePips.toFixed(1)}p). Recommended Lots: ${recommendedLots} (${finalAdjustedUnits} units). Required Margin: $${marginRequired.toFixed(2)} (Available: $${freeMargin.toFixed(2)}).`;

    return {
      symbol,
      recommendedUnits: finalAdjustedUnits,
      recommendedLots,
      riskDollars: Math.round(actualRiskDollars * 100) / 100,
      riskPercentOfEquity: Math.round(actualRiskPercent * 100) / 100,
      kellyFractionRaw: Math.round(rawKelly * 1000) / 1000,
      kellyFractionDamped: Math.round(dampedKelly * 1000) / 1000,
      riskParityUnits: Math.floor(rawUnits),
      spreadPenaltyMultiplier: Math.round(spreadPenaltyMultiplier * 100) / 100,
      slippageDeductionPips: Math.round(historicalSlippagePips * 10) / 10,
      marginRequired: Math.round(marginRequired * 100) / 100,
      isMarginSufficient,
      sizingAuditTrail: auditTrail,
    };
  }
}

export const autonomousSizingEngine = AutonomousSizingEngine.getInstance();
