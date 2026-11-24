/**
 * Layer 2: AgentPersonaSpecs
 * Definitions and fine-tuned model training specifications for the 8-Agent Autonomous Chamber.
 * Replaces static prompt templates with model architectures fine-tuned via SFT, RLAIF, and DPO.
 */

import { SignalDirection } from '../types';

export type AgentRoleType = 
  | 'TECHNICAL_MARKET_STRUCTURE'
  | 'SMART_MONEY_CONCEPTS'
  | 'MACROECONOMICS'
  | 'REAL_TIME_WIRE_NEWS'
  | 'CROSS_ASSET_FOREX_CORRELATIONS'
  | 'ORDER_FLOW_LIQUIDITY'
  | 'CANDLESTICK_PRICE_ACTION'
  | 'CHIEF_RISK_MANAGER';

export interface FineTunedModelSpecification {
  role: AgentRoleType;
  modelIdentifier: string;
  baseArchitecture: string; // e.g., 'Gemini-1.5-Pro-Finance-FT' or 'Llama-3.3-70B-Quant-Instruct'
  fineTuningMethodology: {
    sftDatasetSize: string; // e.g., '62,000 Curated Institutional Order Flow & Macro Transcripts'
    rlaifObjective: string; // e.g., 'Reward Model calibrated to Brier Score < 0.04 and Risk-Adjusted Sharpe > 2.8'
    dpoPairs: string; // e.g., '18,500 Win vs Premature Invalidation Pairwise Preferences'
    calibrationECE: number; // Expected Calibration Error < 0.035
  };
  primaryCompetency: string;
  invalidationTriggerLogic: string;
}

export interface AgentDebateThesis {
  role: AgentRoleType;
  agentName: string;
  bias: SignalDirection;
  confidenceScore: number; // 0.00 to 1.00
  calibratedProbabilities: {
    win: number;
    scratch: number;
    loss: number;
  };
  thesisArgument: string;
  counterThesisRisks: string[];
  invalidationPriceAnchor: number;
  citedAnalogId?: string;
  latencyMs: number;
  modelMetadata: {
    modelId: string;
    temperature: number;
    tokensGenerated: number;
  };
}

export const AGENT_PERSONA_SPECS: Record<AgentRoleType, FineTunedModelSpecification> = {
  TECHNICAL_MARKET_STRUCTURE: {
    role: 'TECHNICAL_MARKET_STRUCTURE',
    modelIdentifier: 'qri-ft-techstruct-v4',
    baseArchitecture: 'Gemini-Flash-Finance-8B-LoRA',
    fineTuningMethodology: {
      sftDatasetSize: '84,000 Multi-Timeframe High-Low Fractals & Structural Breakouts',
      rlaifObjective: 'Maximize Structural Alignment & Minimize Late-Trend False Breakouts',
      dpoPairs: '24,000 Pairwise comparisons favoring confirmed BOS over single-wick penetrations',
      calibrationECE: 0.031,
    },
    primaryCompetency: 'Multi-timeframe market structure, Break of Structure (BOS), Change of Character (CHOCH), and dynamic trend alignment.',
    invalidationTriggerLogic: 'Opposing 1H structural swing high/low close breach.',
  },

  SMART_MONEY_CONCEPTS: {
    role: 'SMART_MONEY_CONCEPTS',
    modelIdentifier: 'qri-ft-smc-v4',
    baseArchitecture: 'Gemini-Pro-Institutional-12B-LoRA',
    fineTuningMethodology: {
      sftDatasetSize: '92,000 Institutional Order Blocks, Fair Value Gaps (FVG) and Liquidity Sweeps',
      rlaifObjective: 'Reward High-Volume Sweep Identification with Immediate Rejection Confirmation',
      dpoPairs: '31,000 SMC Liquidity Trap vs Genuine Displacement Pairwise Preferences',
      calibrationECE: 0.028,
    },
    primaryCompetency: 'Institutional liquidity pools, Order Blocks, 3-bar Fair Value Gaps, Breaker Blocks, and Premium/Discount equilibrium pricing.',
    invalidationTriggerLogic: 'Displacement candle body close beyond origin Order Block boundary.',
  },

  MACROECONOMICS: {
    role: 'MACROECONOMICS',
    modelIdentifier: 'qri-ft-macro-v4',
    baseArchitecture: 'Gemini-Pro-MacroSurprise-32B-Full',
    fineTuningMethodology: {
      sftDatasetSize: '55,000 Central Bank Rate Decisions, CPI/PCE Surprises & Sovereign Balance of Payments',
      rlaifObjective: 'Calibrate Probability of Macro Real Yield Repricing within 4 Hours of Wire Release',
      dpoPairs: '16,000 Real Yield Divergence vs Nominal Noise Preferences',
      calibrationECE: 0.034,
    },
    primaryCompetency: 'Central bank policy differentials (Fed, ECB, BOJ, RBI), 2Y/10Y sovereign yield curves, real interest rate differentials, inflation surprises.',
    invalidationTriggerLogic: 'Divergent central bank speaker guidance or surprise opposite macro release print.',
  },

  REAL_TIME_WIRE_NEWS: {
    role: 'REAL_TIME_WIRE_NEWS',
    modelIdentifier: 'qri-ft-wirenews-v4',
    baseArchitecture: 'Gemini-Flash-FastWire-8B',
    fineTuningMethodology: {
      sftDatasetSize: '120,000 Financial News Wire Flashes (Reuters, Bloomberg, Dow Jones, RBI, SEBI)',
      rlaifObjective: 'Ultra-low Latency Sentiment Vectorization (<15ms) with Crisis Alert Sensitivity',
      dpoPairs: '42,000 Noise Filtering vs Actionable Market-Moving Geopolitical Alerts',
      calibrationECE: 0.038,
    },
    primaryCompetency: 'Sub-second NLP sentiment parsing of 38+ institutional wire feeds, emergency central bank interventions, and geopolitical shock detection.',
    invalidationTriggerLogic: 'Flash reversal headline or emergency sovereign capital controls announcement.',
  },

  CROSS_ASSET_FOREX_CORRELATIONS: {
    role: 'CROSS_ASSET_FOREX_CORRELATIONS',
    modelIdentifier: 'qri-ft-crossasset-v4',
    baseArchitecture: 'Gemini-Flash-CrossAsset-8B-LoRA',
    fineTuningMethodology: {
      sftDatasetSize: '48,000 Cross-Asset Matrices (DXY, Gold, Crude Oil, US10Y, Nikkei, GIFT Nifty)',
      rlaifObjective: 'Detect Intermarket Decoupling and Predictive Divergence Leads',
      dpoPairs: '14,000 Spurious Short-Term Correlation vs True Macro Regime Shift Preferences',
      calibrationECE: 0.032,
    },
    primaryCompetency: 'Currency Strength Index (CSX), DXY momentum transmission, sovereign debt spreads, carry trade regime stability, commodity-currency linkages.',
    invalidationTriggerLogic: 'DXY / US10Y decoupling exceeding 2.5 standard deviations from 30-day mean.',
  },

  ORDER_FLOW_LIQUIDITY: {
    role: 'ORDER_FLOW_LIQUIDITY',
    modelIdentifier: 'qri-ft-orderflow-v4',
    baseArchitecture: 'Gemini-Flash-OrderFlow-8B-Quantized',
    fineTuningMethodology: {
      sftDatasetSize: '110,000 Level 2 Depth-of-Book Snapshots, Footprint CVD & Diagonal Imbalances',
      rlaifObjective: 'Reward Detection of Passive Limit Iceberg Absorptions Prior to Price Pivots',
      dpoPairs: '38,000 Exhaustion Delta vs Absorption Delta Preference Rankings',
      calibrationECE: 0.026,
    },
    primaryCompetency: 'Level 2 DOM wall analysis, 3:1 footprint diagonal imbalances, Cumulative Volume Delta (CVD) divergences, resting liquidity pool clusters.',
    invalidationTriggerLogic: 'Exhaustion delta followed by aggressive DOM wall pulling/cancellation.',
  },

  CANDLESTICK_PRICE_ACTION: {
    role: 'CANDLESTICK_PRICE_ACTION',
    modelIdentifier: 'qri-ft-candlestick-v4',
    baseArchitecture: 'Gemini-Flash-Candle-8B-LoRA',
    fineTuningMethodology: {
      sftDatasetSize: '65,000 Multi-Timeframe Candlestick Formations with Tick Volume Validation',
      rlaifObjective: 'Precise Rejection Wick-to-Body Ratio (>2.5x) and Stopping Volume Confirmation',
      dpoPairs: '20,000 Indecision Doji vs True Institutional Pin-bar Absorption Comparisons',
      calibrationECE: 0.030,
    },
    primaryCompetency: 'Exact wick-to-body ratios, volume spread analysis (VSA) stopping volume, two-bar railway tracks, morning/evening star exhaustion.',
    invalidationTriggerLogic: 'Closing print violating the high/low wick extreme of the anchor signal candle.',
  },

  CHIEF_RISK_MANAGER: {
    role: 'CHIEF_RISK_MANAGER',
    modelIdentifier: 'qri-ft-chief-risk-v4',
    baseArchitecture: 'Gemini-Pro-RiskSynthesis-32B-Full',
    fineTuningMethodology: {
      sftDatasetSize: '75,000 Swarm Consensus Transcripts, Black Swan Stress Tests & Kelly Optimization Histories',
      rlaifObjective: 'Zero-Tolerance Tail Risk Gatekeeping, Absolute VETO Power & Kelly Sizing Discipline',
      dpoPairs: '28,000 Prudent VETO vs Forced Premature Entry Pairwise Preferences',
      calibrationECE: 0.021,
    },
    primaryCompetency: 'Synthesis of dialectical Buy/Sell debates, portfolio Value-at-Risk (VaR) budgeting, Kelly criterion enforcement, and irrevocable VETO power.',
    invalidationTriggerLogic: 'Breach of portfolio daily drawdown cap or statistical risk-to-reward below 1:1.8.',
  },
};
