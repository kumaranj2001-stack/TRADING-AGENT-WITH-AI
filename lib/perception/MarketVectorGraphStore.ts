/**
 * Layer 1: MarketVectorGraphStore
 * Hybrid Vector and Knowledge Graph Database engine for real-time market data ingestion,
 * high-dimensional embedding indexing, and structural graph relationship traversal.
 */

export interface VectorEmbedding {
  id: string;
  vector: number[]; // High-dimensional normalized embedding (e.g. 128-dim or 64-dim)
  metadata: Record<string, any>;
  timestamp: number;
}

export type GraphNodeType = 
  | 'MARKET_SNAPSHOT' 
  | 'ORDER_FLOW' 
  | 'LIQUIDITY_POOL' 
  | 'MACRO_WIRE' 
  | 'REGIME' 
  | 'HISTORICAL_ANALOG';

export type GraphEdgeType = 
  | 'CORRELATED_WITH' 
  | 'TRIGGERED_BY' 
  | 'SUPPORTS_STRUCTURE' 
  | 'EXHIBITS_REGIME' 
  | 'PRECEDED_BY'
  | 'INVALIDATES';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  properties: Record<string, any>;
  embeddingId?: string;
  timestamp: number;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: GraphEdgeType;
  weight: number; // 0.0 - 1.0 confidence/strength
  properties?: Record<string, any>;
}

export interface MarketRegimeMetadata {
  volatilityRegime: 'LOW_ATR_COMPRESSION' | 'NORMAL_VOLATILITY' | 'HIGH_VOLATILITY_EXPANSION' | 'CRISIS_SPIKE';
  sessionRegime: 'ASIAN_RANGE' | 'LONDON_OPEN_BREAKOUT' | 'LONDON_NY_OVERLAP' | 'NY_AFTERNOON_ROLLOVER';
  structuralRegime: 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGE_POC_CHOP' | 'LIQUIDITY_SWEEP_REVERSAL';
  atrPercentile: number;
  cvdDeltaRatio: number; // CVD / Total Volume
  domImbalanceRatio: number; // Bid Liquidity / Ask Liquidity
  macroSentimentScore: number; // -1.0 to +1.0
}

export interface TickOrderFlowItem {
  timestamp: number;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  isAggressor: boolean;
  cvd: number;
  delta: number;
}

export interface Level2LiquidityBook {
  bids: Array<{ price: number; size: number; depth: number }>;
  asks: Array<{ price: number; size: number; depth: number }>;
  bidAskRatio: number;
  majorBidWallPrice: number;
  majorAskWallPrice: number;
  restingLiquidityDensity: number;
}

export interface MacroWireItem {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sentimentScore: number; // -1.0 to 1.0
  relevantSymbols: string[];
}

export class MarketVectorGraphStore {
  private static instance: MarketVectorGraphStore;
  
  private vectors: Map<string, VectorEmbedding> = new Map();
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private nodeAdjacency: Map<string, Set<string>> = new Map(); // nodeId -> Set of edgeIds

  // Continuous real-time ingestion streams
  private tickStreamBuffer: TickOrderFlowItem[] = [];
  private l2BookCache: Map<string, Level2LiquidityBook> = new Map();
  private macroWireCache: MacroWireItem[] = [];
  private activeRegimeCache: Map<string, MarketRegimeMetadata> = new Map();

  private constructor() {
    this.seedHistoricalAnalogs();
  }

  public static getInstance(): MarketVectorGraphStore {
    if (!MarketVectorGraphStore.instance) {
      MarketVectorGraphStore.instance = new MarketVectorGraphStore();
    }
    return MarketVectorGraphStore.instance;
  }

  // -------------------------------------------------------------
  // Vector Space Operations (Cosine Similarity & Dense Embedding)
  // -------------------------------------------------------------

  public insertEmbedding(id: string, vector: number[], metadata: Record<string, any>): VectorEmbedding {
    const normalized = this.normalizeVector(vector);
    const entry: VectorEmbedding = {
      id,
      vector: normalized,
      metadata,
      timestamp: Date.now(),
    };
    this.vectors.set(id, entry);
    return entry;
  }

  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  public searchVectorAnalogs(
    queryVector: number[], 
    topK: number = 5, 
    filterPredicate?: (meta: Record<string, any>) => boolean
  ): Array<{ id: string; score: number; metadata: Record<string, any> }> {
    const queryNorm = this.normalizeVector(queryVector);
    const results: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

    for (const [id, entry] of this.vectors.entries()) {
      if (filterPredicate && !filterPredicate(entry.metadata)) {
        continue;
      }
      const score = this.cosineSimilarity(queryNorm, entry.vector);
      results.push({ id, score, metadata: entry.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private normalizeVector(v: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < v.length; i++) {
      sumSq += v[i] * v[i];
    }
    const mag = Math.sqrt(sumSq) || 1e-9;
    return v.map(x => x / mag);
  }

  // -------------------------------------------------------------
  // Knowledge Graph Operations (Nodes, Edges, Traversal)
  // -------------------------------------------------------------

  public addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.nodeAdjacency.has(node.id)) {
      this.nodeAdjacency.set(node.id, new Set());
    }
  }

  public addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    if (!this.nodeAdjacency.has(edge.sourceId)) {
      this.nodeAdjacency.set(edge.sourceId, new Set());
    }
    if (!this.nodeAdjacency.has(edge.targetId)) {
      this.nodeAdjacency.set(edge.targetId, new Set());
    }
    this.nodeAdjacency.get(edge.sourceId)!.add(edge.id);
    this.nodeAdjacency.get(edge.targetId)!.add(edge.id);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getConnectedNodes(nodeId: string, edgeType?: GraphEdgeType): Array<{ node: GraphNode; edge: GraphEdge }> {
    const edgeIds = this.nodeAdjacency.get(nodeId);
    if (!edgeIds) return [];

    const result: Array<{ node: GraphNode; edge: GraphEdge }> = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;
      if (edgeType && edge.type !== edgeType) continue;

      const neighborId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      const neighbor = this.nodes.get(neighborId);
      if (neighbor) {
        result.push({ node: neighbor, edge });
      }
    }
    return result;
  }

  // Multi-hop graph query traversal
  public traverseGraphPath(startNodeId: string, maxDepth: number = 2): Array<{
    path: string[];
    terminalNode: GraphNode;
    aggregateWeight: number;
  }> {
    const results: Array<{ path: string[]; terminalNode: GraphNode; aggregateWeight: number }> = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, currentPath: string[], currentWeight: number, depth: number) => {
      if (depth > maxDepth) return;
      visited.add(currentId);

      const connections = this.getConnectedNodes(currentId);
      for (const { node, edge } of connections) {
        if (!visited.has(node.id)) {
          const nextWeight = currentWeight * edge.weight;
          const nextPath = [...currentPath, `${edge.type}->${node.id}`];
          results.push({
            path: nextPath,
            terminalNode: node,
            aggregateWeight: nextWeight,
          });
          dfs(node.id, nextPath, nextWeight, depth + 1);
        }
      }
      visited.delete(currentId);
    };

    dfs(startNodeId, [startNodeId], 1.0, 1);
    return results.sort((a, b) => b.aggregateWeight - a.aggregateWeight);
  }

  // -------------------------------------------------------------
  // Real-Time Streaming Ingestion
  // -------------------------------------------------------------

  public ingestOrderFlowTicks(ticks: TickOrderFlowItem[]): void {
    this.tickStreamBuffer.push(...ticks);
    if (this.tickStreamBuffer.length > 5000) {
      this.tickStreamBuffer = this.tickStreamBuffer.slice(-3000);
    }
  }

  public updateLevel2Book(symbol: string, book: Level2LiquidityBook): void {
    this.l2BookCache.set(symbol, book);

    // Create / Update Liquidity Graph Node
    const nodeId = `liquidity_${symbol}_${Date.now()}`;
    const liquidityNode: GraphNode = {
      id: nodeId,
      type: 'LIQUIDITY_POOL',
      label: `L2 DOM Pools for ${symbol}`,
      properties: {
        symbol,
        bidAskRatio: book.bidAskRatio,
        majorBidWallPrice: book.majorBidWallPrice,
        majorAskWallPrice: book.majorAskWallPrice,
        density: book.restingLiquidityDensity,
      },
      timestamp: Date.now(),
    };
    this.addNode(liquidityNode);
  }

  public ingestMacroWire(item: MacroWireItem): void {
    this.macroWireCache.unshift(item);
    if (this.macroWireCache.length > 200) {
      this.macroWireCache = this.macroWireCache.slice(0, 200);
    }

    // Index macro item in graph
    const wireNodeId = `macro_wire_${item.id}`;
    const wireNode: GraphNode = {
      id: wireNodeId,
      type: 'MACRO_WIRE',
      label: item.headline.slice(0, 48),
      properties: {
        headline: item.headline,
        source: item.source,
        impact: item.impact,
        sentimentScore: item.sentimentScore,
        symbols: item.relevantSymbols,
      },
      timestamp: item.timestamp,
    };
    this.addNode(wireNode);

    // Link to relevant symbol nodes
    for (const sym of item.relevantSymbols) {
      const edgeId = `edge_macro_${item.id}_${sym}`;
      this.addEdge({
        id: edgeId,
        sourceId: wireNodeId,
        targetId: `symbol_${sym}`,
        type: 'TRIGGERED_BY',
        weight: item.impact === 'CRITICAL' ? 0.95 : item.impact === 'HIGH' ? 0.8 : 0.5,
      });
    }
  }

  public updateActiveRegime(symbol: string, regime: MarketRegimeMetadata): void {
    this.activeRegimeCache.set(symbol, regime);

    const regimeNodeId = `regime_${symbol}_${Date.now()}`;
    const regimeNode: GraphNode = {
      id: regimeNodeId,
      type: 'REGIME',
      label: `${symbol} [${regime.volatilityRegime} | ${regime.sessionRegime}]`,
      properties: regime,
      timestamp: Date.now(),
    };
    this.addNode(regimeNode);

    // Edge connecting current snapshot to regime
    this.addEdge({
      id: `edge_regime_${symbol}_${Date.now()}`,
      sourceId: `symbol_${symbol}`,
      targetId: regimeNodeId,
      type: 'EXHIBITS_REGIME',
      weight: 1.0,
    });
  }

  public getActiveRegime(symbol: string): MarketRegimeMetadata | undefined {
    return this.activeRegimeCache.get(symbol);
  }

  public getRecentTicks(limit: number = 100): TickOrderFlowItem[] {
    return this.tickStreamBuffer.slice(-limit);
  }

  public getLevel2Book(symbol: string): Level2LiquidityBook | undefined {
    return this.l2BookCache.get(symbol);
  }

  public getRecentMacroWires(limit: number = 20): MacroWireItem[] {
    return this.macroWireCache.slice(0, limit);
  }

  // -------------------------------------------------------------
  // Seed Institutional Historical Analogs for RAG Matching
  // -------------------------------------------------------------
  private seedHistoricalAnalogs(): void {
    const historicalSetups = [
      {
        id: 'analog_london_liquidity_sweep_eurusd',
        symbol: 'EUR/USD',
        regime: 'LONDON_OPEN_BREAKOUT',
        pattern: 'Asian Range High Sweep followed by bearish MSS and 15M FVG retest',
        winRate: 0.78,
        riskReward: 3.2,
        vector: [0.85, -0.42, 0.71, 0.65, -0.33, 0.92, 0.12, 0.44],
        properties: {
          session: 'LONDON_OPEN_BREAKOUT',
          setupType: 'LIQUIDITY_SWEEP_REVERSAL',
          optimalEntry: '15M FVG Retest',
          invalidationRule: 'Asian High Candle Body Close breach',
          expectedExcursionPips: 48,
        }
      },
      {
        id: 'analog_ny_cpi_volatility_expansion_xauusd',
        symbol: 'XAU/USD',
        regime: 'HIGH_VOLATILITY_EXPANSION',
        pattern: 'US CPI downside surprise triggering real yields plunge & Gold aggressive breaker block expansion',
        winRate: 0.83,
        riskReward: 4.1,
        vector: [0.94, 0.88, 0.62, -0.21, 0.87, 0.45, 0.91, 0.73],
        properties: {
          session: 'LONDON_NY_OVERLAP',
          setupType: 'MACRO_SURPRISE_EXPANSION',
          optimalEntry: 'Immediate Breaker Mitigation',
          invalidationRule: 'Pre-news 1H Swing Low Invalidation',
          expectedExcursionPips: 210,
        }
      },
      {
        id: 'analog_order_flow_absorption_gbpusd',
        symbol: 'GBP/USD',
        regime: 'NORMAL_VOLATILITY',
        pattern: 'Massive aggressive delta at support with zero price progression, confirming institutional passive iceberg absorption',
        winRate: 0.74,
        riskReward: 2.8,
        vector: [-0.65, 0.77, 0.83, 0.41, -0.52, 0.69, -0.18, 0.81],
        properties: {
          session: 'LONDON_OPEN_BREAKOUT',
          setupType: 'ORDER_FLOW_ABSORPTION',
          optimalEntry: 'First 1M Footprint diagonal imbalance continuation',
          invalidationRule: 'Absorption Low breach with delta expansion',
          expectedExcursionPips: 36,
        }
      },
      {
        id: 'analog_nifty_orb_vwap_confluence',
        symbol: 'NIFTY 50',
        regime: 'LONDON_OPEN_BREAKOUT',
        pattern: '15-min Opening Range Breakout above Central Pivot Range with heavy FII index futures buy delta',
        winRate: 0.81,
        riskReward: 2.9,
        vector: [0.78, 0.65, -0.31, 0.84, 0.72, 0.38, 0.64, 0.59],
        properties: {
          session: 'ASIAN_RANGE',
          setupType: 'ORB_CPR_CONFLUENCE',
          optimalEntry: 'VWAP pullback retest with rising PCR',
          invalidationRule: 'CPR bottom central pivot breach',
          expectedExcursionPips: 95,
        }
      },
      {
        id: 'analog_usdjpy_boj_intervention_cascade',
        symbol: 'USD/JPY',
        regime: 'CRISIS_SPIKE',
        pattern: 'Extreme Level 2 DOM bid withdrawal, cascade liquidations through psychological round number',
        winRate: 0.88,
        riskReward: 5.4,
        vector: [-0.91, -0.85, 0.43, -0.92, -0.74, 0.82, -0.66, 0.95],
        properties: {
          session: 'ASIAN_RANGE',
          setupType: 'LIQUIDITY_CASCADE_INTERVENTION',
          optimalEntry: 'Break of structural support pool',
          invalidationRule: 'Immediate 5M candle engulfing reversal',
          expectedExcursionPips: 180,
        }
      }
    ];

    for (const setup of historicalSetups) {
      // Store vector embedding
      this.insertEmbedding(setup.id, setup.vector, {
        id: setup.id,
        symbol: setup.symbol,
        regime: setup.regime,
        pattern: setup.pattern,
        winRate: setup.winRate,
        riskReward: setup.riskReward,
        ...setup.properties,
      });

      // Store in Graph
      const analogNode: GraphNode = {
        id: setup.id,
        type: 'HISTORICAL_ANALOG',
        label: `${setup.symbol}: ${setup.pattern.slice(0, 40)}...`,
        properties: {
          symbol: setup.symbol,
          regime: setup.regime,
          pattern: setup.pattern,
          winRate: setup.winRate,
          riskReward: setup.riskReward,
          ...setup.properties,
        },
        embeddingId: setup.id,
        timestamp: Date.now() - 86400000 * 14,
      };
      this.addNode(analogNode);

      // Connect to symbol
      this.addEdge({
        id: `edge_analog_${setup.id}`,
        sourceId: `symbol_${setup.symbol}`,
        targetId: setup.id,
        type: 'SUPPORTS_STRUCTURE',
        weight: setup.winRate,
      });
    }
  }

  public getStats() {
    return {
      vectorCount: this.vectors.size,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      tickBufferSize: this.tickStreamBuffer.length,
      l2BookCachedSymbols: Array.from(this.l2BookCache.keys()),
      macroWireCount: this.macroWireCache.length,
    };
  }
}

export const marketVectorGraphStore = MarketVectorGraphStore.getInstance();
