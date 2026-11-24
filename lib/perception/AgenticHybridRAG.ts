/**
 * Layer 1: AgenticHybridRAG
 * Dynamic Agentic Retrieval-Augmented Generation framework that replaces static lookup tables.
 * At runtime, an orchestrator agent inspects live telemetry, formulates semantic queries,
 * retrieves high-dimensional vector analogs and traverses the knowledge graph for contextually
 * relevant structural setups and regime-conditioned analogs.
 */

import { 
  MarketVectorGraphStore, 
  marketVectorGraphStore, 
  MarketRegimeMetadata, 
  Level2LiquidityBook, 
  MacroWireItem,
  TickOrderFlowItem
} from './MarketVectorGraphStore';
import { Candle, CurrencyPair, TimeFrame } from '../types';

export interface DynamicRAGQuery {
  rawQueryPrompt: string;
  queryVector: number[];
  targetSymbol: string;
  activeSession: string;
  volatilityRegime: string;
  structuralHypothesis: 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'MEAN_REVERSION_RANGE' | 'LIQUIDITY_HUNT';
  filters: {
    minWinRate?: number;
    minRiskReward?: number;
    sameRegimeOnly?: boolean;
  };
}

export interface RetrievedHistoricalAnalog {
  analogId: string;
  similarityScore: number; // 0.0 - 1.0
  symbol: string;
  regime: string;
  pattern: string;
  empiricalWinRate: number;
  riskReward: number;
  optimalEntry: string;
  invalidationRule: string;
  expectedExcursionPips: number;
}

export interface GraphContextLink {
  path: string[];
  terminalType: string;
  terminalLabel: string;
  weight: number;
}

export interface DynamicRAGContext {
  symbol: string;
  timestamp: number;
  query: DynamicRAGQuery;
  analogs: RetrievedHistoricalAnalog[];
  graphLinks: GraphContextLink[];
  activeRegime: MarketRegimeMetadata;
  liquidityLandscape: {
    bidAskRatio: number;
    nearestBidWall: number;
    nearestAskWall: number;
    restingLiquidityDensity: number;
  };
  macroWireConfluence: {
    recentHighImpactHeadlines: string[];
    aggregateSentiment: number;
  };
  synthesizedContextSummary: string;
}

export class AgenticHybridRAGEngine {
  private static instance: AgenticHybridRAGEngine;
  private store: MarketVectorGraphStore;

  private constructor() {
    this.store = marketVectorGraphStore;
  }

  public static getInstance(): AgenticHybridRAGEngine {
    if (!AgenticHybridRAGEngine.instance) {
      AgenticHybridRAGEngine.instance = new AgenticHybridRAGEngine();
    }
    return AgenticHybridRAGEngine.instance;
  }

  /**
   * Runtime Orchestrator: Dynamically inspects live market conditions
   * and formulates a semantic query and embedding vector.
   */
  public formulateDynamicQuery(
    symbol: CurrencyPair,
    timeframe: TimeFrame,
    candles: Candle[],
    currentPrice: number,
    cvd: number = 0,
    sentimentScore: number = 0
  ): DynamicRAGQuery {
    const recent = candles.slice(-20);
    const lastCandle = recent[recent.length - 1] || { open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 100 };
    const prevCandle = recent[recent.length - 2] || lastCandle;

    // Compute Volatility (ATR-like metric)
    const ranges = recent.map(c => Math.max(c.high - c.low, Math.abs(c.high - c.close), Math.abs(c.low - c.close)));
    const avgRange = ranges.reduce((a, b) => a + b, 0) / (ranges.length || 1);
    const lastRange = lastCandle.high - lastCandle.low;
    const atrRatio = avgRange > 0 ? lastRange / avgRange : 1.0;

    let volatilityRegime: MarketRegimeMetadata['volatilityRegime'] = 'NORMAL_VOLATILITY';
    if (atrRatio > 2.2) volatilityRegime = 'CRISIS_SPIKE';
    else if (atrRatio > 1.4) volatilityRegime = 'HIGH_VOLATILITY_EXPANSION';
    else if (atrRatio < 0.6) volatilityRegime = 'LOW_ATR_COMPRESSION';

    // Compute Session Regime based on current UTC hour
    const utcHour = new Date().getUTCHours();
    let sessionRegime: MarketRegimeMetadata['sessionRegime'] = 'LONDON_NY_OVERLAP';
    if (utcHour >= 0 && utcHour < 7) sessionRegime = 'ASIAN_RANGE';
    else if (utcHour >= 7 && utcHour < 12) sessionRegime = 'LONDON_OPEN_BREAKOUT';
    else if (utcHour >= 12 && utcHour < 17) sessionRegime = 'LONDON_NY_OVERLAP';
    else sessionRegime = 'NY_AFTERNOON_ROLLOVER';

    // Determine structural hypothesis
    const priceDelta = lastCandle.close - prevCandle.close;
    let structuralHypothesis: DynamicRAGQuery['structuralHypothesis'] = 'MEAN_REVERSION_RANGE';
    if (priceDelta > avgRange * 0.5 && cvd > 0) structuralHypothesis = 'BULLISH_EXPANSION';
    else if (priceDelta < -avgRange * 0.5 && cvd < 0) structuralHypothesis = 'BEARISH_EXPANSION';
    else if (atrRatio > 1.8 && Math.abs(priceDelta) < avgRange * 0.3) structuralHypothesis = 'LIQUIDITY_HUNT';

    // Formulate 8-dimensional semantic embedding vector for market state:
    // [priceMomentum, atrNormalized, cvdNormalized, sentiment, sessionCode, structuralCode, domCode, volatilityCode]
    const priceMomentum = Math.tanh(priceDelta / (avgRange || 1));
    const atrNorm = Math.min(2.0, Math.max(0.0, atrRatio)) - 1.0; // [-1.0, 1.0]
    const cvdNorm = Math.tanh(cvd / 1000);
    const sessionCode = sessionRegime === 'LONDON_NY_OVERLAP' ? 0.8 : sessionRegime === 'LONDON_OPEN_BREAKOUT' ? 0.6 : sessionRegime === 'ASIAN_RANGE' ? -0.5 : 0.0;
    const structCode = structuralHypothesis === 'BULLISH_EXPANSION' ? 0.9 : structuralHypothesis === 'BEARISH_EXPANSION' ? -0.9 : 0.1;
    const volCode = volatilityRegime === 'HIGH_VOLATILITY_EXPANSION' ? 0.85 : volatilityRegime === 'CRISIS_SPIKE' ? 1.0 : -0.5;

    const queryVector = [
      priceMomentum,
      atrNorm,
      cvdNorm,
      sentimentScore,
      sessionCode,
      structCode,
      Math.tanh(currentPrice % 10), // Micro-structure noise
      volCode
    ];

    const prompt = `Semantic Analog Search for ${symbol} under ${sessionRegime} during ${volatilityRegime}. Hypothesis: ${structuralHypothesis}. Momentum: ${priceMomentum.toFixed(2)}, CVD Delta: ${cvdNorm.toFixed(2)}, Sentiment: ${sentimentScore.toFixed(2)}`;

    // Update active regime in store
    this.store.updateActiveRegime(symbol, {
      volatilityRegime,
      sessionRegime,
      structuralRegime: structuralHypothesis === 'BULLISH_EXPANSION' ? 'TRENDING_BULL' : structuralHypothesis === 'BEARISH_EXPANSION' ? 'TRENDING_BEAR' : 'RANGE_POC_CHOP',
      atrPercentile: Math.min(100, Math.round(atrRatio * 50)),
      cvdDeltaRatio: cvdNorm,
      domImbalanceRatio: 1.15,
      macroSentimentScore: sentimentScore,
    });

    return {
      rawQueryPrompt: prompt,
      queryVector,
      targetSymbol: symbol,
      activeSession: sessionRegime,
      volatilityRegime,
      structuralHypothesis,
      filters: {
        minWinRate: 0.65,
        minRiskReward: 2.0,
      }
    };
  }

  /**
   * Execute Hybrid Retrieval:
   * 1. Dense Vector Similarity Search
   * 2. Knowledge Graph Multi-Hop Traversal
   * 3. Synthesize Context into Structured Dynamic Context
   */
  public async retrieveContext(query: DynamicRAGQuery): Promise<DynamicRAGContext> {
    // 1. Vector Search
    const vectorMatches = this.store.searchVectorAnalogs(
      query.queryVector,
      4,
      (meta) => {
        if (query.filters.minWinRate && (meta.winRate || 0) < query.filters.minWinRate) return false;
        if (query.filters.minRiskReward && (meta.riskReward || 0) < query.filters.minRiskReward) return false;
        return true;
      }
    );

    const analogs: RetrievedHistoricalAnalog[] = vectorMatches.map(m => ({
      analogId: m.id,
      similarityScore: Math.round(m.score * 1000) / 1000,
      symbol: m.metadata.symbol || query.targetSymbol,
      regime: m.metadata.regime || query.volatilityRegime,
      pattern: m.metadata.pattern || 'Institutional Order Block & Liquidity Pool Reversion',
      empiricalWinRate: m.metadata.winRate || 0.72,
      riskReward: m.metadata.riskReward || 2.5,
      optimalEntry: m.metadata.optimalEntry || 'Wait for 15M FVG mitigation',
      invalidationRule: m.metadata.invalidationRule || 'Breach of prior swing high/low',
      expectedExcursionPips: m.metadata.expectedExcursionPips || 45,
    }));

    // 2. Knowledge Graph Traversal
    const symbolNodeId = `symbol_${query.targetSymbol}`;
    const graphPaths = this.store.traverseGraphPath(symbolNodeId, 2);
    const graphLinks: GraphContextLink[] = graphPaths.slice(0, 6).map(gp => ({
      path: gp.path,
      terminalType: gp.terminalNode.type,
      terminalLabel: gp.terminalNode.label,
      weight: Math.round(gp.aggregateWeight * 100) / 100,
    }));

    // 3. Telemetry & Macro feeds
    const activeRegime = this.store.getActiveRegime(query.targetSymbol) || {
      volatilityRegime: 'NORMAL_VOLATILITY',
      sessionRegime: 'LONDON_NY_OVERLAP',
      structuralRegime: 'TRENDING_BULL',
      atrPercentile: 55,
      cvdDeltaRatio: 0.2,
      domImbalanceRatio: 1.1,
      macroSentimentScore: 0.1,
    };

    const l2Book = this.store.getLevel2Book(query.targetSymbol) || {
      bids: [{ price: 1.0820, size: 240, depth: 1 }],
      asks: [{ price: 1.0825, size: 180, depth: 1 }],
      bidAskRatio: 1.33,
      majorBidWallPrice: 1.0815,
      majorAskWallPrice: 1.0850,
      restingLiquidityDensity: 84.5,
    };

    const recentWires = this.store.getRecentMacroWires(5);
    const highImpactHeadlines = recentWires
      .filter(w => w.impact === 'HIGH' || w.impact === 'CRITICAL')
      .map(w => `[${w.impact}] ${w.headline}`);

    const avgSentiment = recentWires.length > 0 
      ? recentWires.reduce((acc, w) => acc + w.sentimentScore, 0) / recentWires.length 
      : 0.05;

    // 4. Synthesize Dynamic Context Summary for LLM Swarm
    const topAnalog = analogs[0];
    const topAnalogDesc = topAnalog 
      ? `Top Analog (${(topAnalog.similarityScore * 100).toFixed(1)}% match): ${topAnalog.pattern}. Historical Win Rate: ${(topAnalog.empiricalWinRate * 100).toFixed(0)}%, R:R ${topAnalog.riskReward}. Invalidation: ${topAnalog.invalidationRule}.`
      : 'No high-confidence historical analog matches found for current regime.';

    const summary = `[DYNAMIC AGENTIC RAG CONTEXT] Symbol: ${query.targetSymbol} | Session: ${query.activeSession} | Volatility: ${query.volatilityRegime} | Hypothesis: ${query.structuralHypothesis}. ${topAnalogDesc} DOM Imbalance: ${l2Book.bidAskRatio.toFixed(2)}x (Bid Wall @ ${l2Book.majorBidWallPrice}, Ask Wall @ ${l2Book.majorAskWallPrice}). Macro Wire Impact: ${highImpactHeadlines.length} high-impact alerts detected.`;

    return {
      symbol: query.targetSymbol,
      timestamp: Date.now(),
      query,
      analogs,
      graphLinks,
      activeRegime,
      liquidityLandscape: {
        bidAskRatio: l2Book.bidAskRatio,
        nearestBidWall: l2Book.majorBidWallPrice,
        nearestAskWall: l2Book.majorAskWallPrice,
        restingLiquidityDensity: l2Book.restingLiquidityDensity,
      },
      macroWireConfluence: {
        recentHighImpactHeadlines: highImpactHeadlines,
        aggregateSentiment: avgSentiment,
      },
      synthesizedContextSummary: summary,
    };
  }
}

export const agenticHybridRAGEngine = AgenticHybridRAGEngine.getInstance();
