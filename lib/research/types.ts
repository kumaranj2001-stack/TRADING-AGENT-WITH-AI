/**
 * Multi-Agent Trading Research Engine Types
 * Universal Market Grounding across Forex, Metals, Indian Markets, and Global Equities.
 */

export type AssetClass = 'EQUITY' | 'FOREX' | 'METALS' | 'INDIAN_MARKET';

export type DefinitiveGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export type DefinitiveSignal = 
  | 'STRONG_BUY' 
  | 'BUY' 
  | 'HOLD_ACCUMULATE' 
  | 'NEUTRAL_CAUTION' 
  | 'CAUTION' 
  | 'AVOID';

export interface LocalizedPricing {
  currentPrice: number;
  currency: string; // USD, INR, EUR, GBP, JPY
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  prevClose: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  spreadPipsOrTicks: number;
}

export interface VolumeBenchmarks {
  currentVolume: number;
  avgVolume20Day: number;
  avgVolume50Day: number;
  volumeSurgeRatio: number; // currentVolume / avgVolume20Day
  volumeTrend: 'ABOVE_AVERAGE' | 'NORMAL' | 'DRYING_UP';
}

export interface VolatilityBenchmarks {
  atr14: number;
  atrPercent: number;
  betaVsBenchmark: number; // e.g. vs SPY for US, vs NIFTY for Indian, vs DXY for FX
  historicalVol30d: number; // Annualized %
  optionsImpliedVol?: number; // IV %
  optionsIVRank?: number; // 0-100
}

export interface MacroeconomicBenchmarks {
  centralBankStance: 'HAWKISH' | 'NEUTRAL' | 'DOVISH';
  policyInterestRate: number; // e.g. Fed 5.25%, RBI 6.50%, ECB 3.75%, BOJ 0.25%
  realYield10Y: number; // %
  cpiInflationYoY: number; // %
  dxyIndex: number; // US Dollar Index
  fiiDiiNetFlows?: {
    fiiNetCr: number; // ₹ Crores
    diiNetCr: number; // ₹ Crores
  };
  indiaVix?: number;
  putCallRatio?: number;
}

// -------------------------------------------------------------
// COMMUNITY LIVE CHAT DATA MODEL (Sole Input Payload)
// -------------------------------------------------------------
export interface CommunityChatMessage {
  id: string;
  username: string;
  userAvatar?: string;
  badge: 'PRO TRADER' | 'MACRO ANALYST' | 'ALGO SCALPER' | 'CHARTIST' | 'RETAIL' | 'COMMUNITY';
  ticker: string; // e.g. 'NVDA', 'XAU/USD', 'EUR/USD'
  tickerTag: string; // e.g. '$NVDA', '$XAUUSD'
  text: string;
  timestamp: number;
  formattedTime: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  likes: number;
  technicalCitations?: string[];
  fundamentalCitations?: string[];
  riskCitations?: string[];
}

export interface CommunityChatTranscript {
  symbol: string;
  tickerTag: string;
  messages: CommunityChatMessage[];
  totalMessages: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  consensusSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  consensusStrengthPercent: number;
  chatVelocityScore: number; // 0-100
  dominantThemes: string[];
  extractedPriceLevels?: {
    supports: number[];
    resistances: number[];
    entryZone?: { min: number; max: number };
    stopLoss?: number;
    targets?: number[];
  };
  timestamp: number;
}

export interface ChartIndicatorReadings {
  rsi14?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  macdLine?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  atr14?: number;
  stochK?: number;
  stochD?: number;
}

export interface ChartOHLCVBar {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartLiveContext {
  symbol: string;
  tvSymbol: string;
  name?: string;
  timeframe: string;
  livePrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose?: number;
  volume: number;
  changePercent: number;
  currency?: string;
  activeIndicators: string[];
  indicatorReadings: ChartIndicatorReadings;
  recentCandles?: ChartOHLCVBar[];
  source: 'CHART_WIDGET_EVENT' | 'TRADINGVIEW_SCANNER' | 'YAHOO_FINANCE' | 'SYNTHETIC_FALLBACK';
  timestamp: number;
}

export interface DiscoveryBrief {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  benchmarkIndex: string; // 'S&P 500' | 'DXY' | 'NIFTY 50' | 'GOLD_INDEX'
  timestamp: number;
  pricing: LocalizedPricing;
  volume: VolumeBenchmarks;
  volatility: VolatilityBenchmarks;
  macro: MacroeconomicBenchmarks;
  summary: string;
  chatTranscript?: CommunityChatTranscript;
  chartContext?: ChartLiveContext;
}

// -------------------------------------------------------------
// AGENT 1: TECHNICAL ANALYSIS AGENT (25% Weight)
// -------------------------------------------------------------
export interface PriceLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  confluenceFactors: string[];
  strength: 'MAJOR' | 'INTERMEDIATE' | 'MINOR';
}

export interface RealisticTradePlan {
  entryZone: {
    min: number;
    max: number;
    note: string;
  };
  stopLoss: {
    price: number;
    distancePoints: number;
    riskPercent: number;
    rationale: string;
  };
  target1: {
    price: number;
    distancePoints: number;
    rewardPercent: number;
    riskRewardRatio: number;
    rationale: string;
  };
  target2: {
    price: number;
    distancePoints: number;
    rewardPercent: number;
    riskRewardRatio: number;
    rationale: string;
  };
}

export interface TechnicalAgentResult {
  agentName: 'Technical Analysis Agent';
  weight: number; // Default 0.25
  status: 'SUCCESS' | 'FAILED';
  trendDirection: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_RANGE' | 'BEARISH' | 'STRONG_BEARISH';
  emaAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'COMPRESSED' | 'GOLDEN_CROSS_PENDING' | 'DEATH_CROSS_PENDING';
  ema20: number;
  ema50: number;
  ema200: number;
  marketStructure: 'HIGHER_HIGHS_HIGHER_LOWS' | 'LOWER_HIGHS_LOWER_LOWS' | 'RANGE_EXPANSION' | 'CHOP_CONSOLIDATION';
  supportLevels: PriceLevel[]; // At least 3
  resistanceLevels: PriceLevel[]; // At least 3
  rsi14: number;
  rsiCondition: 'OVERSOLD' | 'BULLISH_MOMENTUM' | 'NEUTRAL' | 'BEARISH_MOMENTUM' | 'OVERBOUGHT';
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
  };
  stochastic: {
    k: number;
    d: number;
    state: 'OVERSOLD' | 'BULLISH_CROSS' | 'NEUTRAL' | 'OVERBOUGHT';
  };
  obvTrend: 'ACCUMULATION' | 'DISTRIBUTION' | 'FLAT';
  activeChartPatterns: Array<{
    name: string;
    completionPercent: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }>;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    isSqueeze: boolean;
  };
  goldenDeathCrossStatus: 'GOLDEN_CROSS_ACTIVE' | 'DEATH_CROSS_ACTIVE' | 'APPROACHING_GOLDEN_CROSS' | 'NEUTRAL';
  relativeStrengthVsBenchmark: {
    benchmark: string;
    rsScore1m: number;
    performanceDifferencePercent: number;
  };
  fibonacciRetracements: {
    fib0: number;
    fib236: number;
    fib382: number;
    fib500: number;
    fib618: number;
    fib786: number;
    fib100: number;
  };
  tradePlan: RealisticTradePlan;
  
  // 5 Sub-Scores (0-20 each, sum = 0-100)
  subScores: {
    trend: number; // 0-20
    momentum: number; // 0-20
    volume: number; // 0-20
    patternQuality: number; // 0-20
    relativeStrength: number; // 0-20
  };
  totalScore: number; // 0-100
  keyInsights: string[];
}

// -------------------------------------------------------------
// AGENT 2: FUNDAMENTAL ANALYSIS AGENT (25% Weight)
// -------------------------------------------------------------
export interface FundamentalAgentResult {
  agentName: 'Fundamental Analysis Agent';
  weight: number; // Default 0.25
  status: 'SUCCESS' | 'FAILED';
  assetSpecificMetrics: {
    trailingPE?: number;
    forwardPE?: number;
    psRatio?: number;
    pbRatio?: number;
    pegRatio?: number;
    evToEbitda?: number;
    revenueGrowthQoQ?: number;
    revenueGrowthYoY?: number;
    revenueCAGR3Yr?: number;
    earningsGrowthYoY?: number;
    forwardGuidanceSentiment?: 'RAISED' | 'MAINTAINED' | 'LOWERED' | 'MIXED';
    tamPenetrationPercent?: number;
    grossMarginPercent?: number;
    operatingMarginPercent?: number;
    netMarginPercent?: number;
    roe?: number;
    roic?: number;
    debtToEquity?: number;
    currentRatio?: number;
    quickRatio?: number;
    fcfYieldPercent?: number;
    cashBurnRunwayMonths?: number;
    interestCoverageRatio?: number;
    moatRating: 'WIDE_MOAT' | 'NARROW_MOAT' | 'NO_MOAT';
    managementAlignment: 'HIGH_INSIDER_OWNERSHIP' | 'MODERATE' | 'LOW';
    // Macro metrics for Forex/Metals/Commodities
    realYieldDifferential?: number;
    termsOfTradeImpact?: string;
    purchasingPowerParityDeviationPercent?: number;
    cotPositioningBias?: 'HEAVY_COMMERCIAL_LONG' | 'COMMERCIAL_NEUTRAL' | 'COMMERCIAL_SHORT';
  };
  
  // 5 Sub-Scores (0-20 each, sum = 0-100)
  subScores: {
    valuation: number; // 0-20
    growth: number; // 0-20
    profitability: number; // 0-20
    financialHealth: number; // 0-20
    moatStrength: number; // 0-20
  };
  totalScore: number; // 0-100
  keyInsights: string[];
}

// -------------------------------------------------------------
// AGENT 3: SENTIMENT & MOMENTUM AGENT (20% Weight)
// -------------------------------------------------------------
export interface SentimentAgentResult {
  agentName: 'Sentiment & Momentum Agent';
  weight: number; // Default 0.20
  status: 'SUCCESS' | 'FAILED';
  newsToneScore: number; // -1.0 to +1.0
  socialBuzzScore: number; // -1.0 to +1.0 (Reddit, X, StockTwits)
  wallStreetConsensus: {
    totalAnalysts: number;
    buyCount: number;
    holdCount: number;
    sellCount: number;
    consensusRating: 'STRONG_BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL';
    averagePriceTarget: number;
    upsidePercent: number;
    recentUpgrades30d: number;
    recentDowngrades30d: number;
  };
  relativeStrengthVsSector: {
    sectorName: string;
    outperformancePercent30d: number;
  };
  institutionalActivity: {
    smartMoneyFlow: 'NET_ACCUMULATION' | 'MODERATE_INFLOW' | 'NEUTRAL' | 'OUTFLOW';
    institutionsHoldingPercent?: number;
    fiiDiiNetBias?: string;
  };
  insiderActivity: {
    insiderBuysLast6M: number;
    insiderSellsLast6M: number;
    netInsiderSignal: 'NET_BUYING' | 'NEUTRAL' | 'NET_SELLING';
  };
  shortInterest: {
    shortPercentOfFloat: number;
    daysToCover: number;
    shortSqueezeScore: number; // 0-100
    squeezeRisk: 'EXTREME' | 'ELEVATED' | 'MODERATE' | 'LOW';
  };

  // 5 Sub-Scores (0-20 each, sum = 0-100)
  subScores: {
    news: number; // 0-20
    social: number; // 0-20
    analysts: number; // 0-20
    institutional: number; // 0-20
    insiderShort: number; // 0-20
  };
  totalScore: number; // 0-100
  keyInsights: string[];
}

// -------------------------------------------------------------
// AGENT 4: RISK ASSESSMENT AGENT (15% Weight)
// -------------------------------------------------------------
export interface RiskFactor {
  rank: number;
  category: 'MARKET' | 'MACRO' | 'LIQUIDITY' | 'REGULATORY' | 'VALUATION' | 'GEOPOLITICAL';
  title: string;
  severity: 1 | 2 | 3 | 4 | 5; // 5 = Highest
  likelihood: 1 | 2 | 3 | 4 | 5; // 5 = Highest
  description: string;
  mitigationStrategy: string;
}

export interface RiskAgentResult {
  agentName: 'Risk Assessment Agent';
  weight: number; // Default 0.15
  status: 'SUCCESS' | 'FAILED';
  volatilityMetrics: {
    historicalVolAnnualized: number;
    atr14Points: number;
    atrPercent: number;
    beta: number;
    optionsIVPercentile?: number;
  };
  bearCaseDrawdownScenario: {
    mildCorrectionPrice: number; // -5% to -10%
    deepCorrectionPrice: number; // -15% to -20%
    tailRiskCrashPrice: number;   // -30%
    maxHistoricDrawdownPercent: number;
  };
  correlations: {
    macroRatesCorrelation: number; // -1.0 to 1.0
    currencyCorrelation: number;
    broaderMarketCorrelation: number;
    regulatoryRiskScore: 'LOW' | 'MODERATE' | 'HIGH';
  };
  liquidityAssessment: {
    dailyVolumeDollar: number;
    bidAskSlippagePercent: number;
    executionRisk: 'MINIMAL_SLIPPAGE' | 'ACCEPTABLE' | 'WIDE_SPREAD_RISK';
  };
  positionSizingKelly: {
    recommendedPositionPercentNAV: number; // e.g. 2.5%
    halfKellyPercent: number;
    maxRiskExposureDollars: number;
    recommendedLotsOrUnits: number;
  };
  top5RiskMatrix: RiskFactor[];

  // 5 Inverted Sub-Scores (where Higher = Lower Risk / Safer)
  subScores: {
    volatilitySafety: number; // 0-20 (20 = Low Volatility / Safer)
    downsideProtection: number; // 0-20 (20 = Strong buffers / Low Drawdown Risk)
    macroResilience: number; // 0-20 (20 = High Immunity to rate/inflation shocks)
    liquidity: number; // 0-20 (20 = Deep Liquidity / Tight Spreads)
    riskRewardRatio: number; // 0-20 (20 = Highly Asymmetric Risk/Reward)
  };
  totalScore: number; // 0-100
  keyInsights: string[];
}

// -------------------------------------------------------------
// AGENT 5: THESIS SYNTHESIS AGENT (15% Weight)
// -------------------------------------------------------------
export interface CatalystItem {
  id: string;
  dateOrWindow: string;
  title: string;
  type: 'EARNINGS' | 'CENTRAL_BANK' | 'PRODUCT_RELEASE' | 'REGULATORY' | 'MACRO_DATA';
  expectedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  directionalBias: 'BULLISH' | 'BEARISH' | 'VOLATILITY';
}

export interface ThesisAgentResult {
  agentName: 'Thesis Synthesis Agent';
  weight: number; // Default 0.15
  status: 'SUCCESS' | 'FAILED';
  executiveThesis: string;
  primaryTimeframe: 'DAY_TRADE' | 'SWING_TRADE' | 'MULTI_WEEK' | 'POSITION_TRADE';
  bullCatalysts: Array<{
    title: string;
    catalystExplanation: string;
    upsideTargetPrice: number;
    upsidePotentialPercent: number;
  }>;
  bearRisks: Array<{
    title: string;
    riskExplanation: string;
    downsideTargetPrice: number;
    downsideRiskPercent: number;
  }>;
  catalystCalendar: CatalystItem[];
  scalingPlan: {
    initialTranchePercent: number; // e.g. 50%
    scalingTriggers: string[];
    profitTakingSchedule: string[];
  };
  invalidationTrigger: {
    priceLevel: number;
    macroOrEventCondition: string;
    exitAction: string;
  };

  // 5 Sub-Scores (0-20 each, sum = 0-100)
  subScores: {
    catalystClarity: number; // 0-20
    timing: number; // 0-20
    asymmetry: number; // 0-20
    edge: number; // 0-20
    conviction: number; // 0-20
  };
  totalScore: number; // 0-100
  keyInsights: string[];
}

// -------------------------------------------------------------
// PHASE 3: SYNTHESIS & REPORTING
// -------------------------------------------------------------
export interface AgentWeightBreakdown {
  agentRole: string;
  baseWeight: number;
  effectiveWeight: number;
  scoreRaw: number;
  scoreWeighted: number;
  status: 'SUCCESS' | 'FAILED';
}

export interface ResearchReportSnapshot {
  reportId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  timestamp: number;
  formattedDate: string;
  
  // Phase 1 Brief
  brief: DiscoveryBrief;
  
  // Phase 2 Agent Outputs
  technical: TechnicalAgentResult;
  fundamental: FundamentalAgentResult;
  sentiment: SentimentAgentResult;
  risk: RiskAgentResult;
  thesis: ThesisAgentResult;
  
  // Phase 3 Synthesis
  weightsBreakdown: AgentWeightBreakdown[];
  compositeScore: number; // 0-100
  grade: DefinitiveGrade;
  signal: DefinitiveSignal;
  gradeDescription: string;
  
  // 25 Sub-Score Breakdown Matrix
  all25SubScores: Array<{
    agent: string;
    category: string;
    score: number; // 0-20
    maxScore: 20;
    label: string;
    interpretation: string;
  }>;
  
  // Disclaimer
  researchDisclaimer: string;
}

// -------------------------------------------------------------
// THE 16 WORKFLOWS SUPPORTED
// -------------------------------------------------------------
export type ResearchEngineWorkflow = 
  | 'ANALYZE_FULL'        // 01. /trade analyze (Flagship Full 5-Agent Analysis)
  | 'QUICK_SNAPSHOT'      // 02. /trade quick (60-Second Snapshot without subagents)
  | 'STANDALONE_TECH'     // 03. Standalone Technical view
  | 'STANDALONE_FUND'     // 04. Standalone Fundamental view
  | 'STANDALONE_SENT'     // 05. Standalone Sentiment view
  | 'STANDALONE_RISK'     // 06. Standalone Risk view
  | 'STANDALONE_THESIS'   // 07. Standalone Thesis view
  | 'SECTOR_ROTATION'     // 08. /trade sector (Sector Rotation Heatmap)
  | 'COMPARE_ASSETS'      // 09. /trade compare [symA] [symB] (Head-to-Head Comparison)
  | 'OPTIONS_STRATEGIES'  // 10. /trade options (Options Strategies & IV)
  | 'PRE_EARNINGS'        // 11. /trade earnings (Pre-Earnings Analysis)
  | 'PORTFOLIO_REBALANCE' // 12. /trade portfolio (Correlation & Rebalance)
  | 'STOCK_SCREENER'      // 13. /trade screen (Criteria Screener)
  | 'SCORED_WATCHLIST'    // 14. /trade watchlist (Scored Watchlist)
  | 'REPORT_PDF'          // 15. /trade report-pdf (6-Page PDF Investment Report)
  | 'COMMAND_BAR';        // 16. Slash Command Runner Bar

export interface SlashCommandPayload {
  command: string; // e.g. "/trade analyze AAPL" or "/trade compare NVDA AMD"
  parsedWorkflow: ResearchEngineWorkflow;
  primarySymbol: string;
  secondarySymbol?: string;
  additionalFlags?: Record<string, string | boolean>;
}
