/**
 * Layer 2: MetaControllerCredibility
 * Dynamic Meta-Controller that adjusts each fine-tuned agent's voting weight at runtime
 * based on its rolling empirical credibility, historical Brier calibration,
 * and current session/volatility regime.
 */

import { AgentRoleType } from './AgentPersonaSpecs';
import { MarketRegimeMetadata } from '../perception/MarketVectorGraphStore';

export interface AgentCredibilityProfile {
  role: AgentRoleType;
  baseWeight: number;
  rollingSampleCount: number;
  rollingAccuracyRate: number; // 0.0 to 1.0
  brierScore: number; // 0.0 to 1.0 (lower is better calibrated)
  sharpeContribution: number;
  regimePerformance: Record<string, { samples: number; winRate: number }>;
}

export class MetaControllerCredibilityEngine {
  private static instance: MetaControllerCredibilityEngine;

  private credibilityProfiles: Map<AgentRoleType, AgentCredibilityProfile> = new Map();

  private constructor() {
    this.initializeProfiles();
  }

  public static getInstance(): MetaControllerCredibilityEngine {
    if (!MetaControllerCredibilityEngine.instance) {
      MetaControllerCredibilityEngine.instance = new MetaControllerCredibilityEngine();
    }
    return MetaControllerCredibilityEngine.instance;
  }

  private initializeProfiles(): void {
    const roles: AgentRoleType[] = [
      'TECHNICAL_MARKET_STRUCTURE',
      'SMART_MONEY_CONCEPTS',
      'MACROECONOMICS',
      'REAL_TIME_WIRE_NEWS',
      'CROSS_ASSET_FOREX_CORRELATIONS',
      'ORDER_FLOW_LIQUIDITY',
      'CANDLESTICK_PRICE_ACTION',
      'CHIEF_RISK_MANAGER',
    ];

    for (const role of roles) {
      this.credibilityProfiles.set(role, {
        role,
        baseWeight: 1.0,
        rollingSampleCount: 150,
        rollingAccuracyRate: role === 'CHIEF_RISK_MANAGER' ? 0.88 : 0.72 + Math.random() * 0.08,
        brierScore: 0.12,
        sharpeContribution: 2.4,
        regimePerformance: {
          'LOW_ATR_COMPRESSION': { samples: 40, winRate: role === 'SMART_MONEY_CONCEPTS' ? 0.79 : 0.65 },
          'HIGH_VOLATILITY_EXPANSION': { samples: 50, winRate: role === 'REAL_TIME_WIRE_NEWS' || role === 'MACROECONOMICS' ? 0.84 : 0.61 },
          'CRISIS_SPIKE': { samples: 20, winRate: role === 'REAL_TIME_WIRE_NEWS' ? 0.91 : 0.52 },
          'LONDON_OPEN_BREAKOUT': { samples: 40, winRate: role === 'TECHNICAL_MARKET_STRUCTURE' ? 0.82 : 0.70 },
        }
      });
    }
  }

  /**
   * Dynamically calculate normalized runtime voting weights for all 8 agents
   * conditioned on current volatility regime, session regime, and rolling credibility.
   */
  public calculateDynamicWeights(regime: MarketRegimeMetadata): Record<AgentRoleType, number> {
    const rawMultipliers: Record<AgentRoleType, number> = {
      TECHNICAL_MARKET_STRUCTURE: 1.0,
      SMART_MONEY_CONCEPTS: 1.0,
      MACROECONOMICS: 1.0,
      REAL_TIME_WIRE_NEWS: 1.0,
      CROSS_ASSET_FOREX_CORRELATIONS: 1.0,
      ORDER_FLOW_LIQUIDITY: 1.0,
      CANDLESTICK_PRICE_ACTION: 1.0,
      CHIEF_RISK_MANAGER: 1.35, // Risk manager always retains higher synthesis baseline
    };

    // 1. Volatility Regime Sensitivity
    switch (regime.volatilityRegime) {
      case 'CRISIS_SPIKE':
        rawMultipliers.REAL_TIME_WIRE_NEWS *= 2.4;
        rawMultipliers.MACROECONOMICS *= 2.1;
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.8;
        rawMultipliers.CANDLESTICK_PRICE_ACTION *= 0.35; // Micro candlestick patterns fail during panic
        rawMultipliers.TECHNICAL_MARKET_STRUCTURE *= 0.5;
        rawMultipliers.CHIEF_RISK_MANAGER *= 2.0; // Boost risk scrutiny
        break;

      case 'HIGH_VOLATILITY_EXPANSION':
        rawMultipliers.REAL_TIME_WIRE_NEWS *= 1.8;
        rawMultipliers.MACROECONOMICS *= 1.7;
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.5;
        rawMultipliers.SMART_MONEY_CONCEPTS *= 1.3; // Liquidity sweeps dominate
        rawMultipliers.CANDLESTICK_PRICE_ACTION *= 0.6;
        break;

      case 'LOW_ATR_COMPRESSION':
        rawMultipliers.SMART_MONEY_CONCEPTS *= 1.9; // Range accumulation & equilibrium
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.8; // Passive absorption in range
        rawMultipliers.CANDLESTICK_PRICE_ACTION *= 1.4; // Clean reversal pins
        rawMultipliers.MACROECONOMICS *= 0.6; // No macro drivers
        rawMultipliers.REAL_TIME_WIRE_NEWS *= 0.5;
        break;

      case 'NORMAL_VOLATILITY':
      default:
        rawMultipliers.TECHNICAL_MARKET_STRUCTURE *= 1.3;
        rawMultipliers.SMART_MONEY_CONCEPTS *= 1.3;
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.2;
        break;
    }

    // 2. Session Regime Sensitivity
    switch (regime.sessionRegime) {
      case 'LONDON_OPEN_BREAKOUT':
        rawMultipliers.TECHNICAL_MARKET_STRUCTURE *= 1.4;
        rawMultipliers.SMART_MONEY_CONCEPTS *= 1.5; // Judas swings / liquidity sweeps
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.3;
        break;

      case 'LONDON_NY_OVERLAP':
        rawMultipliers.CROSS_ASSET_FOREX_CORRELATIONS *= 1.5; // High institutional cross-flows
        rawMultipliers.MACROECONOMICS *= 1.4;
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.4;
        break;

      case 'ASIAN_RANGE':
        rawMultipliers.CANDLESTICK_PRICE_ACTION *= 1.3;
        rawMultipliers.SMART_MONEY_CONCEPTS *= 1.4; // Asian range high/low targets
        rawMultipliers.MACROECONOMICS *= 0.6;
        break;

      case 'NY_AFTERNOON_ROLLOVER':
        rawMultipliers.ORDER_FLOW_LIQUIDITY *= 1.4; // Fixing flows & position squaring
        rawMultipliers.CROSS_ASSET_FOREX_CORRELATIONS *= 1.2;
        break;
    }

    // 3. Empirical Credibility Calibration Adjustment
    const dynamicWeights: Record<AgentRoleType, number> = {} as any;
    let sumWeights = 0;

    for (const [roleStr, profile] of this.credibilityProfiles.entries()) {
      const role = roleStr as AgentRoleType;
      const mult = rawMultipliers[role] || 1.0;
      
      // Hit rate scaling: 70% is baseline 1.0; 85% is 1.21; 55% is 0.78
      const hitRateScale = Math.max(0.5, profile.rollingAccuracyRate / 0.70);
      
      // Brier score bonus: lower brier (< 0.15) increases weight
      const brierScale = 1.0 + (0.15 - Math.min(0.25, profile.brierScore));

      const rawWeight = profile.baseWeight * mult * hitRateScale * brierScale;
      dynamicWeights[role] = rawWeight;
      sumWeights += rawWeight;
    }

    // Normalize so all 8 weights sum to 1.00
    for (const role of Object.keys(dynamicWeights) as AgentRoleType[]) {
      dynamicWeights[role] = Math.round((dynamicWeights[role] / sumWeights) * 1000) / 1000;
    }

    return dynamicWeights;
  }

  /**
   * Update credibility profile after a trade closes (called by Reflection Agent)
   */
  public updateAgentCredibility(
    role: AgentRoleType,
    wasCorrect: boolean,
    confidencePredicted: number,
    regimeKey: string,
    realizedReturnR: number
  ): void {
    const profile = this.credibilityProfiles.get(role);
    if (!profile) return;

    // Rolling exponential update (alpha = 0.08)
    const alpha = 0.08;
    const currentOutcome = wasCorrect ? 1.0 : 0.0;
    profile.rollingAccuracyRate = (1 - alpha) * profile.rollingAccuracyRate + alpha * currentOutcome;

    // Brier score: (predicted_p - actual)^2
    const brierInstant = Math.pow(confidencePredicted - currentOutcome, 2);
    profile.brierScore = (1 - alpha) * profile.brierScore + alpha * brierInstant;

    // Sharpe contribution
    profile.sharpeContribution = Math.max(0.5, profile.sharpeContribution + (wasCorrect ? 0.05 : -0.08) * Math.max(1, realizedReturnR));
    profile.rollingSampleCount++;

    // Update regime-specific stats
    if (!profile.regimePerformance[regimeKey]) {
      profile.regimePerformance[regimeKey] = { samples: 0, winRate: 0.7 };
    }
    const rp = profile.regimePerformance[regimeKey];
    rp.samples++;
    rp.winRate = (rp.winRate * (rp.samples - 1) + currentOutcome) / rp.samples;
  }

  public getAllProfiles(): AgentCredibilityProfile[] {
    return Array.from(this.credibilityProfiles.values());
  }
}

export const metaControllerCredibilityEngine = MetaControllerCredibilityEngine.getInstance();
