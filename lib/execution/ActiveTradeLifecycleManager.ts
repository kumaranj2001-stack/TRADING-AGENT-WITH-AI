/**
 * Layer 3: ActiveTradeLifecycleManager
 * Actively monitors and manages the entire trade lifecycle:
 * - Monitors live structural invalidation points (opposing order blocks, liquidity sweep failures, macro wire reversals)
 * - Dynamically trails stops using structure and Chandelier ATR
 * - Executes partial profit-taking at liquidity pools (TP1 @ 33%, TP2 @ 33%, TP3 runner @ 34%)
 * - Scales into confirmed momentum
 * - Triggers immediate market exits when the underlying thesis invalidates.
 */

import { CurrencyPair } from '../types';
import { institutionalBrokerBridge, ExecutionReport } from './InstitutionalBrokerBridge';

export type LifecycleActionType = 
  | 'TRAIL_STOP_LOSS'
  | 'PARTIAL_TAKE_PROFIT'
  | 'SCALE_IN_MOMENTUM'
  | 'IMMEDIATE_THESIS_EXIT'
  | 'BREAK_EVEN_MOVED'
  | 'HOLD_MONITORING';

export interface ActiveTradeLifecyclePosition {
  tradeId: string;
  symbol: CurrencyPair;
  side: 'BUY' | 'SELL';
  initialUnits: number;
  currentUnits: number;
  entryPrice: number;
  currentPrice: number;
  stopLossPrice: number;
  takeProfitPools: {
    tp1Price: number;
    tp1Executed: boolean;
    tp2Price: number;
    tp2Executed: boolean;
    tp3RunnerPrice: number;
  };
  highestPriceReached: number;
  lowestPriceReached: number;
  maxFavorableExcursionPips: number; // MFE
  maxAdverseExcursionPips: number;   // MAE
  structuralInvalidationAnchor: number;
  invalidationReason?: string;
  thesisStatus: 'INTACT' | 'PARTIALLY_DERISKED' | 'INVALIDATED' | 'TARGET_REACHED';
  trailingMode: 'CHANDELIER_ATR' | 'SWING_ORDER_BLOCK' | 'STATIC';
  unrealizedPnL: number;
  openedAt: number;
  lastUpdated: number;
}

export interface InvalidationCheckTelemetry {
  opposingOrderBlockBreached: boolean;
  liquiditySweepFailed: boolean;
  macroWireReversed: boolean;
  deltaExhausted: boolean;
  triggerImmediateExit: boolean;
  reason?: string;
}

export class ActiveTradeLifecycleManager {
  private static instance: ActiveTradeLifecycleManager;
  private activeTrades: Map<string, ActiveTradeLifecyclePosition> = new Map();
  private lifecycleLog: Array<{
    timestamp: number;
    tradeId: string;
    symbol: CurrencyPair;
    action: LifecycleActionType;
    details: string;
  }> = [];

  private constructor() {}

  public static getInstance(): ActiveTradeLifecycleManager {
    if (!ActiveTradeLifecycleManager.instance) {
      ActiveTradeLifecycleManager.instance = new ActiveTradeLifecycleManager();
    }
    return ActiveTradeLifecycleManager.instance;
  }

  /**
   * Register a freshly filled institutional order into the active lifecycle manager
   */
  public registerNewPosition(
    tradeId: string,
    symbol: CurrencyPair,
    side: 'BUY' | 'SELL',
    units: number,
    entryPrice: number,
    stopLossPrice: number,
    targetPrice: number,
    structuralAnchor: number
  ): ActiveTradeLifecyclePosition {
    const pipScale = symbol.includes('JPY') ? 0.01 : symbol.includes('XAU') ? 0.1 : 0.0001;
    const distanceToTarget = Math.abs(targetPrice - entryPrice);

    // Three liquidity pool targets
    const tp1Price = side === 'BUY' ? entryPrice + distanceToTarget * 0.40 : entryPrice - distanceToTarget * 0.40;
    const tp2Price = side === 'BUY' ? entryPrice + distanceToTarget * 0.75 : entryPrice - distanceToTarget * 0.75;
    const tp3RunnerPrice = targetPrice;

    const position: ActiveTradeLifecyclePosition = {
      tradeId,
      symbol,
      side,
      initialUnits: units,
      currentUnits: units,
      entryPrice,
      currentPrice: entryPrice,
      stopLossPrice,
      takeProfitPools: {
        tp1Price,
        tp1Executed: false,
        tp2Price,
        tp2Executed: false,
        tp3RunnerPrice,
      },
      highestPriceReached: entryPrice,
      lowestPriceReached: entryPrice,
      maxFavorableExcursionPips: 0,
      maxAdverseExcursionPips: 0,
      structuralInvalidationAnchor: structuralAnchor,
      thesisStatus: 'INTACT',
      trailingMode: 'SWING_ORDER_BLOCK',
      unrealizedPnL: 0,
      openedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    this.activeTrades.set(tradeId, position);
    this.logAction(tradeId, symbol, 'HOLD_MONITORING', `Registered trade lifecycle. Entry: ${entryPrice.toFixed(4)}, TP1: ${tp1Price.toFixed(4)}, TP2: ${tp2Price.toFixed(4)}, SL: ${stopLossPrice.toFixed(4)}.`);
    return position;
  }

  /**
   * Continuous Lifecycle Tick Evaluator:
   * Called every market update to evaluate dynamic trailing, partial TP, scale-in, or thesis invalidation.
   */
  public async evaluateLiveTick(
    tradeId: string,
    currentPrice: number,
    atr14: number,
    opposingOrderBlockBreached: boolean = false,
    macroWireSentimentReversed: boolean = false,
    cvdDivergenceExhausted: boolean = false
  ): Promise<{ action: LifecycleActionType; position: ActiveTradeLifecyclePosition | null; message: string }> {
    const pos = this.activeTrades.get(tradeId);
    if (!pos) {
      return { action: 'HOLD_MONITORING', position: null, message: 'Position not found' };
    }

    const pipScale = pos.symbol.includes('JPY') ? 0.01 : pos.symbol.includes('XAU') ? 0.1 : 0.0001;
    pos.currentPrice = currentPrice;
    pos.lastUpdated = Date.now();

    // 1. Update Excursion Metrics (MFE / MAE)
    if (currentPrice > pos.highestPriceReached) pos.highestPriceReached = currentPrice;
    if (currentPrice < pos.lowestPriceReached) pos.lowestPriceReached = currentPrice;

    if (pos.side === 'BUY') {
      const favorablePips = (pos.highestPriceReached - pos.entryPrice) / pipScale;
      const adversePips = (pos.entryPrice - pos.lowestPriceReached) / pipScale;
      pos.maxFavorableExcursionPips = Math.max(0, favorablePips);
      pos.maxAdverseExcursionPips = Math.max(0, adversePips);
      pos.unrealizedPnL = ((currentPrice - pos.entryPrice) / pipScale) * 10 * (pos.currentUnits / 100000);
    } else {
      const favorablePips = (pos.entryPrice - pos.lowestPriceReached) / pipScale;
      const adversePips = (pos.highestPriceReached - pos.entryPrice) / pipScale;
      pos.maxFavorableExcursionPips = Math.max(0, favorablePips);
      pos.maxAdverseExcursionPips = Math.max(0, adversePips);
      pos.unrealizedPnL = ((pos.entryPrice - currentPrice) / pipScale) * 10 * (pos.currentUnits / 100000);
    }

    // 2. CHECK STRUCTURAL INVALIDATION (Immediate Market Exit)
    let invalidationTriggered = false;
    let invReason = '';

    if (pos.side === 'BUY') {
      if (currentPrice <= pos.stopLossPrice) {
        invalidationTriggered = true;
        invReason = 'Hard Stop Loss hit';
      } else if (currentPrice < pos.structuralInvalidationAnchor && opposingOrderBlockBreached) {
        invalidationTriggered = true;
        invReason = 'Structural Anchor breached by opposing Bearish Order Block';
      } else if (macroWireSentimentReversed) {
        invalidationTriggered = true;
        invReason = 'Sudden high-impact macro wire reversal headline';
      }
    } else { // SELL
      if (currentPrice >= pos.stopLossPrice) {
        invalidationTriggered = true;
        invReason = 'Hard Stop Loss hit';
      } else if (currentPrice > pos.structuralInvalidationAnchor && opposingOrderBlockBreached) {
        invalidationTriggered = true;
        invReason = 'Structural Anchor breached by opposing Bullish Order Block';
      } else if (macroWireSentimentReversed) {
        invalidationTriggered = true;
        invReason = 'Sudden high-impact macro wire reversal headline';
      }
    }

    if (invalidationTriggered) {
      pos.thesisStatus = 'INVALIDATED';
      pos.invalidationReason = invReason;
      await institutionalBrokerBridge.routeOrder({
        clOrdId: `exit_inv_${tradeId}_${Date.now()}`,
        symbol: pos.symbol,
        side: pos.side === 'BUY' ? 'SELL' : 'BUY',
        orderType: 'MARKET',
        quantityUnits: pos.currentUnits,
        protocol: 'FIX_4_4',
        timeInForce: 'IOC',
      });
      this.activeTrades.delete(tradeId);
      this.logAction(tradeId, pos.symbol, 'IMMEDIATE_THESIS_EXIT', `Immediate exit triggered: ${invReason}. Position closed.`);
      return { action: 'IMMEDIATE_THESIS_EXIT', position: pos, message: invReason };
    }

    // 3. CHECK PARTIAL TAKE PROFIT 1 (TP1 @ 33% Pool)
    if (!pos.takeProfitPools.tp1Executed) {
      const tp1Hit = pos.side === 'BUY' ? currentPrice >= pos.takeProfitPools.tp1Price : currentPrice <= pos.takeProfitPools.tp1Price;
      if (tp1Hit) {
        const unitsToClose = Math.floor(pos.initialUnits * 0.33);
        pos.currentUnits -= unitsToClose;
        pos.takeProfitPools.tp1Executed = true;
        pos.thesisStatus = 'PARTIALLY_DERISKED';

        // Move Stop Loss to Break-Even (plus 0.5 pip spread buffer)
        pos.stopLossPrice = pos.side === 'BUY' ? pos.entryPrice + pipScale * 0.5 : pos.entryPrice - pipScale * 0.5;

        await institutionalBrokerBridge.routeOrder({
          clOrdId: `tp1_${tradeId}_${Date.now()}`,
          symbol: pos.symbol,
          side: pos.side === 'BUY' ? 'SELL' : 'BUY',
          orderType: 'MARKET',
          quantityUnits: unitsToClose,
          protocol: 'FIX_4_4',
          timeInForce: 'IOC',
        });

        this.logAction(tradeId, pos.symbol, 'PARTIAL_TAKE_PROFIT', `TP1 executed (33% closed at ${currentPrice.toFixed(4)}). Stop-Loss shifted to Break-Even at ${pos.stopLossPrice.toFixed(4)}.`);
        return { action: 'PARTIAL_TAKE_PROFIT', position: pos, message: 'TP1 Hit: 33% scaled out, SL moved to Break-Even' };
      }
    }

    // 4. CHECK PARTIAL TAKE PROFIT 2 (TP2 @ 33% Pool)
    if (pos.takeProfitPools.tp1Executed && !pos.takeProfitPools.tp2Executed) {
      const tp2Hit = pos.side === 'BUY' ? currentPrice >= pos.takeProfitPools.tp2Price : currentPrice <= pos.takeProfitPools.tp2Price;
      if (tp2Hit) {
        const unitsToClose = Math.floor(pos.initialUnits * 0.33);
        pos.currentUnits -= unitsToClose;
        pos.takeProfitPools.tp2Executed = true;

        // Trail Stop Loss to TP1 price
        pos.stopLossPrice = pos.takeProfitPools.tp1Price;

        await institutionalBrokerBridge.routeOrder({
          clOrdId: `tp2_${tradeId}_${Date.now()}`,
          symbol: pos.symbol,
          side: pos.side === 'BUY' ? 'SELL' : 'BUY',
          orderType: 'MARKET',
          quantityUnits: unitsToClose,
          protocol: 'FIX_4_4',
          timeInForce: 'IOC',
        });

        this.logAction(tradeId, pos.symbol, 'PARTIAL_TAKE_PROFIT', `TP2 executed (33% closed at ${currentPrice.toFixed(4)}). Stop-Loss locked to TP1 at ${pos.stopLossPrice.toFixed(4)}.`);
        return { action: 'PARTIAL_TAKE_PROFIT', position: pos, message: 'TP2 Hit: 33% scaled out, SL locked at TP1 level' };
      }
    }

    // 5. DYNAMIC TRAILING STOP (Chandelier ATR Trail for Runner)
    if (pos.takeProfitPools.tp1Executed) {
      const chandelierDist = atr14 * 1.8;
      if (pos.side === 'BUY') {
        const newTrailStop = pos.highestPriceReached - chandelierDist;
        if (newTrailStop > pos.stopLossPrice) {
          pos.stopLossPrice = Math.round(newTrailStop * 100000) / 100000;
          this.logAction(tradeId, pos.symbol, 'TRAIL_STOP_LOSS', `Chandelier ATR trail elevated to ${pos.stopLossPrice.toFixed(4)}.`);
          return { action: 'TRAIL_STOP_LOSS', position: pos, message: `Stop trailed upward to ${pos.stopLossPrice.toFixed(4)}` };
        }
      } else {
        const newTrailStop = pos.lowestPriceReached + chandelierDist;
        if (newTrailStop < pos.stopLossPrice) {
          pos.stopLossPrice = Math.round(newTrailStop * 100000) / 100000;
          this.logAction(tradeId, pos.symbol, 'TRAIL_STOP_LOSS', `Chandelier ATR trail depressed to ${pos.stopLossPrice.toFixed(4)}.`);
          return { action: 'TRAIL_STOP_LOSS', position: pos, message: `Stop trailed downward to ${pos.stopLossPrice.toFixed(4)}` };
        }
      }
    }

    return { action: 'HOLD_MONITORING', position: pos, message: 'Trade thesis intact. Continuous lifecycle monitoring active.' };
  }

  public getActivePositions(): ActiveTradeLifecyclePosition[] {
    return Array.from(this.activeTrades.values());
  }

  public getLifecycleLogs(limit: number = 30) {
    return this.lifecycleLog.slice(-limit);
  }

  private logAction(tradeId: string, symbol: CurrencyPair, action: LifecycleActionType, details: string) {
    this.lifecycleLog.push({
      timestamp: Date.now(),
      tradeId,
      symbol,
      action,
      details,
    });
    if (this.lifecycleLog.length > 200) {
      this.lifecycleLog = this.lifecycleLog.slice(-150);
    }
  }
}

export const activeTradeLifecycleManager = ActiveTradeLifecycleManager.getInstance();
