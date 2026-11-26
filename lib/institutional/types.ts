import type { CurrencyPair, TimeFrame } from '../types';

export type InstitutionalSuiteSection =
  | 'execution'
  | 'microstructure'
  | 'macro'
  | 'screener'
  | 'options'
  | 'crypto'
  | 'alt-data'
  | 'quant'
  | 'risk';

export interface Level2BookLevel {
  level: number;
  bidPrice: number;
  bidSize: number;
  bidCumulative: number;
  bidVenue: string;
  askPrice: number;
  askSize: number;
  askCumulative: number;
  askVenue: string;
  imbalanceRatio: number;
}

export interface SlippageEstimate {
  orderUnits: number;
  side: 'BUY' | 'SELL';
  midPrice: number;
  expectedFillPrice: number;
  spreadWalkBps: number;
  marketImpactBps: number;
  latencySlippageBps: number;
  adverseSelectionBps: number;
  totalSlippageBps: number;
  estimatedCostUsd: number;
}

export interface DomOrderTicket {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'STOP' | 'MARKET';
  price: number;
  quantityLots: number;
  venue: string;
  status: 'RESTING' | 'FILLED' | 'CANCELLED';
  fixMsgSeqNum: number;
  timestamp: number;
}

export interface GeneticChromosomeResult {
  generation: number;
  rank: number;
  lookback: number;
  atrMultiplier: number;
  takeProfitRR: number;
  sessionFilter: 'ALL' | 'LONDON_NY' | 'NY_OPEN' | 'ASIA_RANGE';
  sharpeRatio: number;
  profitFactor: number;
  recoveryFactor: number;
  winRatePct: number;
  netProfitPct: number;
  maxDrawdownPct: number;
}

export interface SmartRouterVenueSplit {
  venue: string;
  protocol: 'FIX 4.4' | 'FIX 5.0SP2' | 'MT5 BRIDGE' | 'OUCH' | 'ITCH';
  allocationPct: number;
  displayedLiquidityUsd: number;
  rebateOrFeeBps: number;
  fillProbabilityPct: number;
  latencyMs: number;
}

export interface VwapSliceBucket {
  bucketLabel: string;
  historicalVolPct: number;
  targetUnits: number;
  executedUnits: number;
  predictedVwap: number;
  impactBps: number;
}

export interface ExecutionBridgeSnapshot {
  symbol: string;
  timeframe: TimeFrame;
  spotPrice: number;
  tickStep: number;
  decimals: number;
  mt5BridgePreserved: boolean;
  mt5Endpoint: string;
  fixSession: {
    beginString: 'FIX.4.4' | 'FIX.5.0SP2';
    senderCompId: string;
    targetCompId: string;
    seqNum: number;
    heartbeatMs: number;
    status: 'CONNECTED_LOW_LATENCY';
    recentRawMessages: string[];
  };
  level2Book: Level2BookLevel[];
  slippageEstimate: SlippageEstimate;
  domOrders: DomOrderTicket[];
  geneticOptimization: {
    generationsCompleted: number;
    populationSize: number;
    bestCandidate: GeneticChromosomeResult;
    topCandidates: GeneticChromosomeResult[];
  };
  smartRouting: SmartRouterVenueSplit[];
  vwapExecution: {
    algorithm: 'VWAP' | 'TWAP' | 'IMPLEMENTATION_SHORTFALL' | 'POV';
    participationRatePct: number;
    totalUnits: number;
    estimatedArrivalSlippageBps: number;
    slices: VwapSliceBucket[];
  };
  cBotIde: {
    defaultCode: string;
    compileResult: {
      success: boolean;
      diagnostics: string[];
      estimatedTickLatencyUs: number;
      simulatedSharpe: number;
    };
  };
}

export interface VolumetricFootprintRow {
  price: number;
  bidVol: number;
  askVol: number;
  totalVol: number;
  delta: number;
  deltaPct: number;
  imbalance: 'ASK_IMBALANCE' | 'BID_IMBALANCE' | 'NONE';
  isPoc: boolean;
  inValueArea: boolean;
}

export interface TpoMarketProfileRow {
  price: number;
  letters: string;
  tpoCount: number;
  isPoc: boolean;
  isVah: boolean;
  isVal: boolean;
  inInitialBalance: boolean;
  singlePrint: boolean;
}

export interface RestingLiquidityHeatCell {
  price: number;
  intensities: number[];
  restingSize: number;
  pulledDelta: number;
}

export interface ReconstructedTapePrint {
  id: string;
  time: string;
  price: number;
  parentOrderSize: number;
  childFillsMerged: number;
  aggressor: 'BUY_SWEEP' | 'SELL_SWEEP' | 'ICEBERG_ABSORPTION';
  venue: string;
  isPowerTrade: boolean;
  isIceberg: boolean;
}

export interface OiDeltaDivergencePoint {
  barTime: string;
  priceClose: number;
  cumulativeDelta: number;
  openInterestDelta: number;
  regime: 'LONG_BUILDUP' | 'SHORT_COVERING' | 'SHORT_BUILDUP' | 'LONG_LIQUIDATION';
}

export interface LiquidationHeatCluster {
  priceLevel: number;
  distancePct: number;
  side: 'LONG_LIQ' | 'SHORT_LIQ';
  estimatedUsdMillions: number;
  dominantVenues: string[];
  intensity: number;
}

export interface MicrostructureSnapshot {
  symbol: string;
  spotPrice: number;
  decimals: number;
  footprintRows: VolumetricFootprintRow[];
  atmBracket: {
    strategyName: string;
    stopLossTicks: number;
    autoBreakevenTriggerTicks: number;
    autoBreakevenOffsetTicks: number;
    target1Ticks: number;
    target2Ticks: number;
    trailingStepTicks: number;
    status: 'ARMED' | 'BREAKEVEN_LOCKED' | 'TRAILING';
  };
  tpoProfile: {
    session: string;
    initialBalanceHigh: number;
    initialBalanceLow: number;
    poc: number;
    vah: number;
    val: number;
    poorHighDetected: boolean;
    poorLowDetected: boolean;
    singlePrintsCount: number;
    rows: TpoMarketProfileRow[];
  };
  cppAcsilStudy: {
    sourceCode: string;
    compiledFunctions: string[];
    subgraphOutputs: Array<{ bar: string; studyValue: number; deltaSignal: number }>;
    compileSuccess: boolean;
  };
  restingOrderHeatmap: RestingLiquidityHeatCell[];
  icebergDetections: Array<{
    price: number;
    side: 'BID_ICEBERG' | 'ASK_ICEBERG';
    visibleSize: number;
    refilledVolume: number;
    refillCount: number;
    confidencePct: number;
  }>;
  powerTrades: Array<{
    time: string;
    price: number;
    volumeBurst: number;
    windowMs: number;
    deltaDirection: 'BUY' | 'SELL';
    velocityScore: number;
  }>;
  reconstructedTape: ReconstructedTapePrint[];
  smartTapeMinFilter: number;
  auctionVistaTracker: Array<{
    time: string;
    bidLiquidityStacked: number;
    askLiquidityPulled: number;
    netBookPressure: number;
  }>;
  clusterSearchHits: Array<{
    barTime: string;
    price: number;
    clusterVolume: number;
    deltaPct: number;
    zScore: number;
  }>;
  oiDivergenceProfile: OiDeltaDivergencePoint[];
  liquidationHeatmap: LiquidationHeatCluster[];
}

export interface MacroFundamentalSnapshot {
  symbol: string;
  spotPrice: number;
  otcBonds: Array<{
    ticker: string;
    issuer: string;
    tenor: string;
    yieldPct: number;
    cleanPrice: number;
    oasBps: number;
    dv01PerMillion: number;
    dailyChangeBps: number;
  }>;
  supplyChainGraph: Array<{
    tier: 'UPSTREAM_SUPPLIER' | 'MIDSTREAM_FOUNDRY' | 'DOWNSTREAM_CUSTOMER';
    entity: string;
    country: string;
    revenueDependencyPct: number;
    fragilityScore: number;
    chokepointRisk: string;
  }>;
  correlationMatrix: {
    assets: string[];
    values: number[][];
    lookbackDays: number;
  };
  starMineAnalystScores: Array<{
    firm: string;
    analyst: string;
    accuracyPercentile: number;
    smartEstimate: number;
    consensusEstimate: number;
    predictedSurprisePct: number;
    rating: string;
  }>;
  shippingTracker: {
    balticDryIndex: number;
    bdiChangePct: number;
    wciContainerUsd: number;
    redSeaTransitDropPct: number;
    chokepoints: Array<{ name: string; status: 'NORMAL' | 'CONGESTED' | 'DISRUPTED'; avgDelayHours: number; activeVessels: number }>;
  };
  pitFundamentalRevisions: Array<{
    period: string;
    metric: string;
    asReportedValue: number;
    restatedValue: number;
    revisionDeltaPct: number;
    filingDate: string;
  }>;
  institutionalOwnership: Array<{
    institution: string;
    ownershipPct: number;
    sharesMillions: number;
    qoqChangePct: number;
    filingQuarter: string;
  }>;
  cdsSpreads: Array<{
    referenceEntity: string;
    tenor: '5Y';
    spreadBps: number;
    dailyChangeBps: number;
    implied5YDefaultProbPct: number;
  }>;
  privateMaMultiples: Array<{
    target: string;
    acquirer: string;
    sector: string;
    dealValueBillions: number;
    evToEbitda: number;
    evToRevenue: number;
    announcedDate: string;
  }>;
  yieldCurveHistory: Array<{
    snapshotLabel: 'TODAY' | '1M_AGO' | '6M_AGO' | '1Y_AGO';
    points: Array<{ tenor: '3M' | '2Y' | '5Y' | '10Y' | '30Y'; yieldPct: number }>;
    spread2s10sBps: number;
  }>;
  customRatioEvaluation: {
    formula: string;
    valid: boolean;
    error?: string;
    results: Array<{ symbol: string; value: number; variablesUsed: Record<string, number> }>;
  };
  economicScatterPlot: {
    xIndicator: string;
    yIndicator: string;
    slope: number;
    rSquared: number;
    points: Array<{ label: string; x: number; y: number }>;
  };
  dynamicTaxAdjustment: Array<{
    company: string;
    statutoryRatePct: number;
    effectiveRatePct: number;
    normalizedRatePct: number;
    reportedEbitMillions: number;
    taxAdjustedNopatMillions: number;
    nopatVariancePct: number;
  }>;
}

export interface TechnicalScreenerSnapshot {
  symbol: string;
  timeframe: TimeFrame;
  spotPrice: number;
  pineCompiler: {
    title: string;
    version: 5;
    sourceCode: string;
    compiledOk: boolean;
    errors: string[];
    plots: Array<{ name: string; latestValue: number; series: number[] }>;
    signals: Array<{ index: number; type: 'BUY' | 'SELL'; price: number }>;
  };
  barReplay: {
    totalBars: number;
    currentBarIndex: number;
    visibleBars: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }>;
    simulatedPnl: number;
  };
  communityScripts: Array<{
    id: string;
    title: string;
    author: string;
    language: 'Pine Script v5' | 'MQL5' | 'C# cBot' | 'C++ ACSIL' | 'AFL';
    stars: number;
    category: string;
    code: string;
  }>;
  mtfTrendlines: Array<{
    timeframe: string;
    type: 'ASCENDING_SUPPORT' | 'DESCENDING_RESISTANCE';
    slopePerBar: number;
    touchCount: number;
    currentLinePrice: number;
    distancePct: number;
    breakoutStatus: 'HOLDING' | 'TESTING' | 'BROKEN';
  }>;
  raindropCandles: Array<{
    time: string;
    leftHalfVwap: number;
    rightHalfVwap: number;
    leftVolumePct: number;
    rightVolumePct: number;
    bias: 'ACCUMULATION' | 'DISTRIBUTION' | 'BALANCED';
  }>;
  hollyAiStrategies: Array<{
    strategyName: string;
    direction: 'LONG' | 'SHORT';
    signalSymbol: string;
    winRatePct: number;
    profitFactor: number;
    expectedValueR: number;
    riskOffTargetExit: number;
  }>;
  rvolSurges: Array<{
    symbol: string;
    price: number;
    rvolMultiplier: number;
    changePct: number;
    floatTurnoverPct: number;
    alertTag: 'EXTREME_SURGE' | 'INSTITUTIONAL_OPEN';
  }>;
  sp500SectorHeatmap: Array<{
    sector: string;
    weightPct: number;
    changePct: number;
    leader: string;
    leaderChangePct: number;
  }>;
  insiderTrades: Array<{
    filingDate: string;
    symbol: string;
    insiderName: string;
    role: string;
    transactionType: 'OPEN_MARKET_BUY' | 'OPEN_MARKET_SELL';
    shares: number;
    valueUsd: number;
    isClusterBuy: boolean;
  }>;
  audioSquawkFeed: Array<{
    id: string;
    time: string;
    priority: 'FLASH' | 'URGENT' | 'NORMAL';
    headline: string;
    voiceScript: string;
    sentimentTag: 'HAWKISH' | 'DOVISH' | 'RISK_ON' | 'RISK_OFF';
  }>;
  unstructuredNewsSentiment: Array<{
    id: string;
    source: string;
    headline: string;
    nlpScore: number;
    confidence: number;
    entities: string[];
    debateImpactNote: string;
  }>;
}

export interface OptionsDerivativesSnapshot {
  symbol: string;
  spotPrice: number;
  ivRank: number;
  ivPercentile: number;
  hv30: number;
  atmIv: number;
  zeroGammaFlipLevel: number;
  dealerGammaPer1PctBillions: number;
  gammaRegime: 'POSITIVE_GAMMA_DAMPENING' | 'NEGATIVE_GAMMA_ACCELERATING';
  preMarketStats: {
    preMarketVwap: number;
    gapPct: number;
    preMarketRvol: number;
    vwapReclaimRatePct: number;
  };
  volSurface: Array<{
    strike: number;
    dte7Iv: number;
    dte30Iv: number;
    dte90Iv: number;
    sviSmoothedIv: number;
    deltaCall: number;
    gamma: number;
    vega: number;
    vanna: number;
  }>;
  expectedMoveCones: Array<{
    horizon: string;
    dte: number;
    impliedMovePct: number;
    upper1Sigma: number;
    lower1Sigma: number;
    upper2Sigma: number;
    lower2Sigma: number;
  }>;
  probabilityOfTouch: {
    targetPrice: number;
    dte: number;
    ivPct: number;
    probTouchPct: number;
    probItmPct: number;
  };
  pnlHeatmap: {
    ivShiftPct: number;
    priceLevels: number[];
    dateColumns: string[];
    pnlMatrix: number[][];
  };
  unusualOptionsFlow: Array<{
    time: string;
    contract: string;
    side: 'ASK_SWEEP' | 'BID_BLOCK' | 'GOLDEN_SWEEP';
    premiumUsd: number;
    volToOiRatio: number;
    sentiment: 'BULLISH' | 'BEARISH';
  }>;
  darkPoolPrints: Array<{
    time: string;
    venue: string;
    price: number;
    shares: number;
    notionalMillions: number;
    printPosition: 'ABOVE_ASK' | 'AT_MID' | 'BELOW_BID';
  }>;
  intradayGexProfile: Array<{
    strike: number;
    callGexMillions: number;
    putGexMillions: number;
    netGexMillions: number;
  }>;
  historicalEarningsMoves: Array<{
    quarter: string;
    date: string;
    impliedMovePct: number;
    realizedMovePct: number;
    ivCrushPct: number;
  }>;
  thinkBackReplay: Array<{
    strike: number;
    callBid: number;
    callAsk: number;
    putBid: number;
    putAsk: number;
    replayDelta: number;
    historicalDate: string;
  }>;
  strategyOptimizer: Array<{
    strategy: string;
    dteTarget: number;
    winRatePct: number;
    expectedReturnPct: number;
    sharpeRatio: number;
    maxLossPct: number;
  }>;
}

export interface CryptoOnChainSnapshot {
  asset: string;
  spotPrice: number;
  soprMetrics: {
    entityAdjustedSopr: number;
    sthSopr: number;
    lthSopr: number;
    realizedPriceUsd: number;
    mvrvZScore: number;
  };
  exchangeNetflows: Array<{
    venue: string;
    netflow24hUsdMillions: number;
    reserveUnits: number;
    clusterStatus: 'ACCUMULATION_OUTFLOW' | 'DISTRIBUTION_INFLOW' | 'NEUTRAL';
  }>;
  smartMoneyLabels: Array<{
    walletTag: string;
    cohort: 'SMART_MONEY_FUND' | 'MARKET_MAKER' | 'WHALE_ACCUMULATOR' | 'EARLY_VC';
    netChange24hUsd: number;
    balanceUsdMillions: number;
    action: 'ACCUMULATING' | 'ROTATING' | 'REDUCING';
  }>;
  tokenHolderDistribution: {
    top10HoldersPct: number;
    cexCustodyPct: number;
    stakingLockedPct: number;
    giniCoefficient: number;
    uniqueActiveAddresses24h: number;
  };
  minerReserves: {
    reserveUnits: number;
    puellMultiple: number;
    mpiIndex: number;
    hashrateExahash: number;
  };
  stablecoinReserves: {
    stablecoinSupplyRatio: number;
    exchangeStablecoinUsdBillions: number;
    netMint24hMillions: number;
  };
  l3OrderBookSnapshots: Array<{
    exchange: string;
    orderId: string;
    side: 'BID' | 'ASK';
    price: number;
    size: number;
    queuePosition: number;
    nanosecondTs: string;
  }>;
  crossExchangeLiquidityDepth: Array<{
    exchange: string;
    plus1PctDepthUsdM: number;
    minus1PctDepthUsdM: number;
    spreadBps: number;
    slippage1MSlipBps: number;
  }>;
  fundingArbitrageMatrix: Array<{
    venue: string;
    funding8hPct: number;
    annualizedFundingPct: number;
    spotPerpBasisBps: number;
    carryArbSpreadPct: number;
  }>;
  openInterestHeatmap: Array<{
    priceBucket: number;
    binanceOiM: number;
    bybitOiM: number;
    okxOiM: number;
    deribitOiM: number;
    totalOiM: number;
  }>;
  tokenUnlocks: Array<{
    token: string;
    unlockDate: string;
    unlockUsdMillions: number;
    circulatingSupplyPct: number;
    allocationType: 'INVESTORS' | 'TEAM' | 'ECOSYSTEM';
  }>;
  protocolBalanceSheets: Array<{
    protocol: string;
    fees30dUsdM: number;
    protocolRevenue30dUsdM: number;
    supplySideFees30dUsdM: number;
    treasuryUsdM: number;
    psRatio: number;
  }>;
  sqlQueryResult: {
    query: string;
    columns: string[];
    rows: Array<Record<string, string | number>>;
    executionTimeMs: number;
  };
}

export interface AlternativeDataSnapshot {
  symbol: string;
  compositeAltAlphaScore: number;
  esgGeopoliticalNlp: Array<{
    pillar: 'ENVIRONMENTAL' | 'SOCIAL' | 'GOVERNANCE' | 'GEOPOLITICAL';
    score: number;
    controversyVelocity: number;
    keyDriver: string;
  }>;
  newsNoveltyScores: Array<{
    timestamp: string;
    headline: string;
    ensNoveltyScore: number;
    essSentimentScore: number;
    taxonomyCode: string;
  }>;
  macroImpactTaxonomy: Array<{
    group: string;
    category: string;
    eventType: string;
    historicalBetaWeight: number;
    activeRegimeSignal: string;
  }>;
  satelliteParkingData: Array<{
    retailer: string;
    ticker: string;
    fillRatePct: number;
    yoyTrafficDeltaPct: number;
    regionsSampled: number;
  }>;
  consumerTransactionPanels: Array<{
    merchantCategory: string;
    spendYoYPct: number;
    avgTicketChangePct: number;
    cardPanelUsersMillions: number;
  }>;
  corporateJobVelocity: Array<{
    company: string;
    openRoles: number;
    aiEngineeringDelta30dPct: number;
    salesHiringDelta30dPct: number;
    signal: 'EXPANSIONARY' | 'STEADY' | 'HIRING_FREEZE';
  }>;
  ecommercePricingTracker: Array<{
    brand: string;
    avgDiscountPct: number;
    priceIndexVs30d: number;
    outOfStockRatePct: number;
  }>;
}

export interface QuantBacktestSnapshot {
  symbol: string;
  eventDrivenTickBacktest: {
    universeMode: 'SURVIVORSHIP_FREE_WITH_DELISTED';
    activeConstituents: number;
    delistedConstituentsIncluded: number;
    totalTrades: number;
    cagrPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdownPct: number;
    equityCurve: Array<{ date: string; portfolioEquity: number; benchmarkEquity: number }>;
  };
  formulaBacktester: {
    language: 'POWER_LANGUAGE' | 'CSHARP_QC';
    script: string;
    compiledValid: boolean;
    totalSignals: number;
    profitFactor: number;
    netReturnPct: number;
  };
  aflArrayBacktest: {
    computeTimeMs: number;
    topNRotation: number;
    cagrPct: number;
    rotationalHoldings: Array<{ rank: number; symbol: string; positionScore: number; weightPct: number }>;
  };
  symphonyWalkForward: {
    symphonyName: string;
    rulesSummary: string[];
    inSampleSharpe: number;
    outOfSampleSharpe: number;
    walkForwardEfficiencyPct: number;
    folds: Array<{ fold: string; isReturnPct: number; oosReturnPct: number }>;
  };
  cloudWebhookScanner: {
    webhookUrl: string;
    conditionExpression: string;
    payloadJson: string;
    dispatchedCount: number;
    lastMt5BridgeStatus: string;
  };
  dcaGridBots: Array<{
    botName: string;
    type: 'GRID' | 'MULTI_PAIR_DCA';
    pair: string;
    rangeLow: number;
    rangeHigh: number;
    gridLevelsOrSafetyOrders: number;
    realizedPnlUsd: number;
    estimatedAprPct: number;
    status: 'RUNNING';
  }>;
  trailingStopEngine: {
    mode: 'ATR_CHANDELIER' | 'STEP_LOCK' | 'PARABOLIC_SAR';
    currentStopPrice: number;
    lockedProfitR: number;
    distanceBps: number;
  };
}

export interface JournalRiskAuditSnapshot {
  symbol: string;
  maeMfeAnalytics: {
    brokerSyncSource: string;
    avgMaeR: number;
    avgMfeR: number;
    edgeRatio: number;
    captureEfficiencyPct: number;
    trades: Array<{
      id: string;
      symbol: string;
      side: 'LONG' | 'SHORT';
      maeR: number;
      mfeR: number;
      realizedR: number;
      mistakeTag: string;
    }>;
  };
  tiltMeter: {
    disciplineScore: number;
    emotionalState: 'OPTIMAL_FLOW' | 'ELEVATED_AROUSAL' | 'TILT_WARNING';
    revengeTradesFlagged: number;
    overtradePenaltyUsd: number;
    mistakeBreakdown: Array<{ tag: string; occurrences: number; netCostUsd: number }>;
  };
  monteCarloEquity: {
    simulations: number;
    riskOfRuinPct: number;
    expectedMaxDd95Pct: number;
    horizonTrades: number;
    percentiles: Array<{ step: number; p5: number; p25: number; p50: number; p75: number; p95: number }>;
  };
  verifiedTrackRecord: {
    auditProvider: string;
    certificateId: string;
    twrrPct: number;
    verifiedSince: string;
    hashChainHead: string;
    ledgerEntries: Array<{ month: string; returnPct: number; sha256Digest: string }>;
  };
  darwinVaREngine: {
    targetAnnualizedVaRPct: number;
    rawStrategyVaRPct: number;
    normalizationMultiplier: number;
    darwinScore: number;
    stressTests: Array<{ scenario: string; portfolioImpactPct: number; maxDailyLossPct: number; survived: boolean }>;
  };
  zuluGuardProtection: {
    highWaterMarkUsd: number;
    currentEquityUsd: number;
    currentDrawdownPct: number;
    hardStopLimitPct: number;
    protectionState: 'ARMED_MONITORING' | 'CAPITAL_SHIELD_ACTIVE' | 'AUTO_HEDGE_TRIGGERED';
    rulesActive: string[];
  };
}

export interface InstitutionalDebateEnrichment {
  symbol: string;
  spotPrice: number;
  institutionalCompositeBias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  confidenceBoost: number;
  zeroGammaFlipLevel: number;
  dealerGammaRegime: string;
  slippageBps: number;
  altDataAlphaScore: number;
  newsNoveltyEns: number;
  soprSignal: string;
  summaryBulletPoints: string[];
}

export type AnyInstitutionalTab =
  | 'institutional-suite'
  | 'institutional-execution'
  | 'institutional-microstructure'
  | 'institutional-macro'
  | 'institutional-pine-screener'
  | 'institutional-options'
  | 'institutional-crypto'
  | 'institutional-alt-data'
  | 'institutional-quant-bots'
  | 'institutional-risk-audit';

export interface InstitutionalOverviewPayload {
  symbol: string;
  timeframe: TimeFrame;
  spotPrice: number;
  mt5BridgeStatus: 'PRESERVED_AND_ACTIVE';
  debateEnrichment: InstitutionalDebateEnrichment;
  execution: ExecutionBridgeSnapshot;
  microstructure: MicrostructureSnapshot;
  macro: MacroFundamentalSnapshot;
  screener: TechnicalScreenerSnapshot;
  options: OptionsDerivativesSnapshot;
  crypto: CryptoOnChainSnapshot;
  altData: AlternativeDataSnapshot;
  quant: QuantBacktestSnapshot;
  riskAudit: JournalRiskAuditSnapshot;
}

export const INST_SUITE_TABS: CurrencyPair[] = [];
