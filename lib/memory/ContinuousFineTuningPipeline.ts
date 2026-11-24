/**
 * Layer 4: ContinuousFineTuningPipeline
 * Automated continuous fine-tuning dataset pipeline.
 * Formats high-value failure and success trajectories into SFT, DPO, and RLAIF training datasets
 * for periodic model weight updates without human intervention.
 */

import { TradeEpisodicSnapshot } from './EpisodicMemoryStore';

export interface SFTTrainingPair {
  id: string;
  timestamp: number;
  prompt: string;
  completion: string;
  sourceTradeId: string;
}

export interface DPOTrainingPair {
  id: string;
  timestamp: number;
  prompt: string;
  chosen: string;
  rejected: string;
  marginReward: number;
  sourceTradeId: string;
}

export interface PipelineTelemetry {
  queuedSFTSamples: number;
  queuedDPOSamples: number;
  exportedBatchesCount: number;
  lastExportTimestamp: number | null;
  autoExportThreshold: number;
}

export class ContinuousFineTuningPipeline {
  private static instance: ContinuousFineTuningPipeline;
  
  private sftQueue: SFTTrainingPair[] = [];
  private dpoQueue: DPOTrainingPair[] = [];
  private exportedBatchesCount: number = 0;
  private lastExportTimestamp: number | null = null;
  private readonly AUTO_EXPORT_THRESHOLD = 50;

  private constructor() {
    this.seedInitialPairs();
  }

  public static getInstance(): ContinuousFineTuningPipeline {
    if (!ContinuousFineTuningPipeline.instance) {
      ContinuousFineTuningPipeline.instance = new ContinuousFineTuningPipeline();
    }
    return ContinuousFineTuningPipeline.instance;
  }

  /**
   * Automatically queues an episodic trade trajectory into SFT and DPO pipelines
   */
  public queueEpisode(snapshot: TradeEpisodicSnapshot, attribution: string, isWin: boolean): void {
    const promptContext = `[MARKET TELEMETRY & REGIME]\nSymbol: ${snapshot.symbol}\nSession: ${snapshot.ragContextSnapshot?.activeRegime?.sessionRegime}\nVolatility: ${snapshot.ragContextSnapshot?.activeRegime?.volatilityRegime}\nCVD Ratio: ${snapshot.ragContextSnapshot?.activeRegime?.cvdDeltaRatio}\nDOM Imbalance: ${snapshot.ragContextSnapshot?.liquidityLandscape?.bidAskRatio}x\n\nTask: Synthesize calibrated trading consensus with structural invalidation anchor.`;

    if (isWin) {
      // 1. Generate SFT Pair for Supervised Fine-Tuning
      const sftEntry: SFTTrainingPair = {
        id: `sft_${Date.now()}_${snapshot.tradeId}`,
        timestamp: Date.now(),
        prompt: promptContext,
        completion: `[CHOSEN CONSENSUS ACTION]\nDirection: ${snapshot.direction}\nOptimal Entry: ${snapshot.entryPrice.toFixed(4)}\nTarget Price: ${snapshot.targetPrice.toFixed(4)}\nStructural Invalidation: ${snapshot.stopLossPrice.toFixed(4)}\nRationale: Verified institutional liquidity absorption with positive CVD divergence and structural alignment. Realized: ${snapshot.realizedPnLRMultiple.toFixed(2)}R.`,
        sourceTradeId: snapshot.tradeId,
      };
      this.sftQueue.push(sftEntry);

      // 2. Generate DPO Pair (Chosen vs Synthetic Suboptimal Heuristic)
      const dpoEntry: DPOTrainingPair = {
        id: `dpo_${Date.now()}_${snapshot.tradeId}`,
        timestamp: Date.now(),
        prompt: promptContext,
        chosen: `[DECISION: ${snapshot.direction}] Clear institutional confluence, tight structural stop at ${snapshot.stopLossPrice.toFixed(4)}, high R:R ratio (>2.0).`,
        rejected: `[DECISION: NEUTRAL / DELAYED] Wait for additional lagging indicator cross, resulting in missed displacement and late chasing entry.`,
        marginReward: Math.min(2.5, Math.max(0.5, snapshot.realizedPnLRMultiple)),
        sourceTradeId: snapshot.tradeId,
      };
      this.dpoQueue.push(dpoEntry);
    } else {
      // For high-value loss trajectories, generate DPO Pair teaching avoidance of premature invalidation
      const dpoEntry: DPOTrainingPair = {
        id: `dpo_loss_${Date.now()}_${snapshot.tradeId}`,
        timestamp: Date.now(),
        prompt: promptContext,
        chosen: `[DECISION: CAUTION / VETO] Recognize high probability of structural sweep failure due to ${attribution}. VETO premature entry or widen invalidation buffer.`,
        rejected: `[DECISION: ${snapshot.direction}] Forcing entry despite opposing liquidity wall and adverse news drift.`,
        marginReward: 1.8,
        sourceTradeId: snapshot.tradeId,
      };
      this.dpoQueue.push(dpoEntry);
    }

    // Check if auto-export threshold reached
    if (this.sftQueue.length + this.dpoQueue.length >= this.AUTO_EXPORT_THRESHOLD) {
      this.triggerBatchExport();
    }
  }

  public triggerBatchExport(): { sftCount: number; dpoCount: number; batchId: string } {
    const batchId = `ft_batch_${Date.now()}`;
    const sftCount = this.sftQueue.length;
    const dpoCount = this.dpoQueue.length;

    this.exportedBatchesCount++;
    this.lastExportTimestamp = Date.now();

    // In a live environment, this would write to dataset storage / S3 / HuggingFace dataset
    // For local memory, we retain recent samples and reset buffer
    if (this.sftQueue.length > 200) this.sftQueue = this.sftQueue.slice(-100);
    if (this.dpoQueue.length > 200) this.dpoQueue = this.dpoQueue.slice(-100);

    return { sftCount, dpoCount, batchId };
  }

  public getTelemetry(): PipelineTelemetry {
    return {
      queuedSFTSamples: this.sftQueue.length,
      queuedDPOSamples: this.dpoQueue.length,
      exportedBatchesCount: this.exportedBatchesCount,
      lastExportTimestamp: this.lastExportTimestamp,
      autoExportThreshold: this.AUTO_EXPORT_THRESHOLD,
    };
  }

  public getRecentSFTSamples(limit: number = 5): SFTTrainingPair[] {
    return this.sftQueue.slice(-limit);
  }

  public getRecentDPOSamples(limit: number = 5): DPOTrainingPair[] {
    return this.dpoQueue.slice(-limit);
  }

  private seedInitialPairs(): void {
    this.sftQueue.push({
      id: 'sft_init_001',
      timestamp: Date.now() - 86400000,
      prompt: '[MARKET TELEMETRY & REGIME]\nSymbol: EUR/USD\nSession: LONDON_OPEN_BREAKOUT\nVolatility: NORMAL_VOLATILITY\nCVD Ratio: 0.35\nDOM Imbalance: 1.32x',
      completion: '[CHOSEN CONSENSUS ACTION]\nDirection: BUY\nOptimal Entry: 1.0845\nTarget Price: 1.0890\nStructural Invalidation: 1.0820\nRationale: Asian range high sweep followed by 15M FVG retest displacement.',
      sourceTradeId: 'ep_seed_001',
    });

    this.dpoQueue.push({
      id: 'dpo_init_001',
      timestamp: Date.now() - 86400000,
      prompt: '[MARKET TELEMETRY & REGIME]\nSymbol: EUR/USD\nSession: LONDON_OPEN_BREAKOUT',
      chosen: '[DECISION: BUY] High-probability FVG mitigation with DOM bid wall support.',
      rejected: '[DECISION: SELL] Chasing false breakdown wick below Asian range.',
      marginReward: 1.9,
      sourceTradeId: 'ep_seed_001',
    });
  }
}

export const continuousFineTuningPipeline = ContinuousFineTuningPipeline.getInstance();
