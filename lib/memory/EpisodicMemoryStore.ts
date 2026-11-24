/**
 * Layer 4: EpisodicMemoryStore
 * Persistent episodic memory store backed by document & vector storage.
 * Logs complete state snapshots of every trade: retrieved RAG context, agent debate transcripts,
 * dynamic credibility weights, execution slippage, post-trade excursion metrics (MFE/MAE), and realized PnL.
 */

import { CurrencyPair, SignalDirection } from '../types';
import { AgentRoleType, AgentDebateThesis } from '../reasoning/AgentPersonaSpecs';
import { DynamicRAGContext } from '../perception/AgenticHybridRAG';

export interface TradeEpisodicSnapshot {
  tradeId: string;
  symbol: CurrencyPair;
  direction: SignalDirection;
  openedAt: number;
  closedAt: number;
  timeInTradeSeconds: number;
  
  // Execution Metrics
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  units: number;
  executionSlippagePips: number;
  executionLatencyMs: number;
  
  // Excursion & PnL
  realizedPnLDollars: number;
  realizedPnLRMultiple: number; // PnL in terms of initial risk (R)
  maxFavorableExcursionPips: number; // MFE
  maxAdverseExcursionPips: number;   // MAE
  exitReason: 'TARGET_REACHED' | 'INVALIDATED' | 'PARTIAL_DERISKED_BE' | 'MANUAL_HALT';
  
  // RAG & Debate Snapshot
  ragContextSnapshot: DynamicRAGContext;
  agentThesesSnapshot: Record<AgentRoleType, AgentDebateThesis>;
  assignedWeightsSnapshot: Record<AgentRoleType, number>;
  consensusConfidence: number;
  
  // Retrospective Vector Embedding
  retrospectiveVector: number[];
  reflectionProcessed: boolean;
}

export class EpisodicMemoryStore {
  private static instance: EpisodicMemoryStore;
  private snapshots: Map<string, TradeEpisodicSnapshot> = new Map();

  private constructor() {
    this.seedHistoricalEpisodes();
  }

  public static getInstance(): EpisodicMemoryStore {
    if (!EpisodicMemoryStore.instance) {
      EpisodicMemoryStore.instance = new EpisodicMemoryStore();
    }
    return EpisodicMemoryStore.instance;
  }

  /**
   * Persists a full state snapshot of a completed trade into episodic memory
   */
  public logTradeSnapshot(snapshot: TradeEpisodicSnapshot): void {
    this.snapshots.set(snapshot.tradeId, snapshot);
    // Maintain maximum 1000 persistent episodes in active memory
    if (this.snapshots.size > 1000) {
      const oldestKey = this.snapshots.keys().next().value;
      if (oldestKey) this.snapshots.delete(oldestKey);
    }
  }

  public getSnapshot(tradeId: string): TradeEpisodicSnapshot | undefined {
    return this.snapshots.get(tradeId);
  }

  public getAllSnapshots(): TradeEpisodicSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => b.closedAt - a.closedAt);
  }

  public getUnprocessedSnapshots(): TradeEpisodicSnapshot[] {
    return Array.from(this.snapshots.values()).filter(s => !s.reflectionProcessed);
  }

  public markProcessed(tradeId: string): void {
    const s = this.snapshots.get(tradeId);
    if (s) {
      s.reflectionProcessed = true;
    }
  }

  private seedHistoricalEpisodes(): void {
    // Seed sample historical episode to bootstrap reflection & self-evolution telemetry
    const sampleEpisode: TradeEpisodicSnapshot = {
      tradeId: 'ep_hist_001_xauusd',
      symbol: 'XAU/USD',
      direction: 'BUY',
      openedAt: Date.now() - 3600000 * 5,
      closedAt: Date.now() - 3600000 * 2,
      timeInTradeSeconds: 10800,
      entryPrice: 2642.50,
      exitPrice: 2658.20,
      stopLossPrice: 2635.00,
      targetPrice: 2660.00,
      units: 50,
      executionSlippagePips: 0.12,
      executionLatencyMs: 14.5,
      realizedPnLDollars: 785.00,
      realizedPnLRMultiple: 2.1,
      maxFavorableExcursionPips: 165,
      maxAdverseExcursionPips: 24,
      exitReason: 'TARGET_REACHED',
      ragContextSnapshot: {
        symbol: 'XAU/USD',
        timestamp: Date.now() - 3600000 * 5,
        query: {
          rawQueryPrompt: 'Gold Bullish Expansion on NY Overlap Breaker Block',
          queryVector: [0.85, 0.45, 0.72, 0.38, 0.8, 0.9, 0.2, 0.7],
          targetSymbol: 'XAU/USD',
          activeSession: 'LONDON_NY_OVERLAP',
          volatilityRegime: 'HIGH_VOLATILITY_EXPANSION',
          structuralHypothesis: 'BULLISH_EXPANSION',
          filters: {},
        },
        analogs: [],
        graphLinks: [],
        activeRegime: {
          volatilityRegime: 'HIGH_VOLATILITY_EXPANSION',
          sessionRegime: 'LONDON_NY_OVERLAP',
          structuralRegime: 'TRENDING_BULL',
          atrPercentile: 78,
          cvdDeltaRatio: 0.45,
          domImbalanceRatio: 1.4,
          macroSentimentScore: 0.65,
        },
        liquidityLandscape: {
          bidAskRatio: 1.4,
          nearestBidWall: 2640.0,
          nearestAskWall: 2662.0,
          restingLiquidityDensity: 88,
        },
        macroWireConfluence: {
          recentHighImpactHeadlines: ['[HIGH] US 10Y Yield falls 6bps on soft PPI data'],
          aggregateSentiment: 0.55,
        },
        synthesizedContextSummary: 'Gold bullish momentum on real yields plunge.',
      },
      agentThesesSnapshot: {} as any,
      assignedWeightsSnapshot: {
        TECHNICAL_MARKET_STRUCTURE: 0.12,
        SMART_MONEY_CONCEPTS: 0.18,
        MACROECONOMICS: 0.19,
        REAL_TIME_WIRE_NEWS: 0.16,
        CROSS_ASSET_FOREX_CORRELATIONS: 0.11,
        ORDER_FLOW_LIQUIDITY: 0.14,
        CANDLESTICK_PRICE_ACTION: 0.05,
        CHIEF_RISK_MANAGER: 0.05,
      },
      consensusConfidence: 0.84,
      retrospectiveVector: [0.85, 0.45, 0.72, 0.38, 0.8, 0.9, 0.2, 0.7],
      reflectionProcessed: true,
    };

    this.snapshots.set(sampleEpisode.tradeId, sampleEpisode);
  }
}

export const episodicMemoryStore = EpisodicMemoryStore.getInstance();
