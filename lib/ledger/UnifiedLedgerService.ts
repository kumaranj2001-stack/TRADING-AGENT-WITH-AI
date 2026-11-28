import { PIP_VALUES } from '../marketData';
import type { CurrencyPair, Position, TradeHistoryItem } from '../types';
import type { PortfolioState } from '../store';

export interface RiskEnforcementEvent {
  positionId: string;
  symbol: CurrencyPair;
  side: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: 'STOP_LOSS_HIT' | 'TAKE_PROFIT_HIT' | 'MAX_DRAWDOWN_FLATTEN';
  realizedPnlUsd: number;
  timestamp: number;
}

export interface UnifiedBacktestRecord {
  pair: CurrencyPair;
  timeframe: string;
  executedTrades: number;
  vetoedTrades: number;
  winCount: number;
  lossCount: number;
  winRatePercent: number;
  totalPnlUsd: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  replaySource: 'HISTORICAL_CANDLE_REPLAY';
  timestamp: number;
}

export interface UnifiedLedgerState {
  accountBalance: number;
  equity: number;
  dailyStartingBalance: number;
  marginUsed: number;
  freeMargin: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  currentDrawdownPercent: number;
  maxAllowedDrawdownPercent: number;
  circuitBreakerTripped: boolean;
  closedTrades: TradeHistoryItem[];
  lastBacktestRun: UnifiedBacktestRecord | null;
  enforcementEvents: RiskEnforcementEvent[];
  lastUpdated: number;
}

/**
 * Single Unified Financial & Risk Ledger linking Terminal Portfolio, Journal Storage,
 * Real Historical Candle Backtester, Quantitative Audit, and Server-Side Risk Enforcement.
 */
export class UnifiedLedgerService {
  private static instance: UnifiedLedgerService;

  private state: UnifiedLedgerState = {
    accountBalance: 25000,
    equity: 25000,
    dailyStartingBalance: 25000,
    marginUsed: 0,
    freeMargin: 25000,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    currentDrawdownPercent: 0,
    maxAllowedDrawdownPercent: 4.0,
    circuitBreakerTripped: false,
    closedTrades: [],
    lastBacktestRun: null,
    enforcementEvents: [],
    lastUpdated: Date.now(),
  };

  private constructor() {}

  public static getInstance(): UnifiedLedgerService {
    if (!UnifiedLedgerService.instance) {
      UnifiedLedgerService.instance = new UnifiedLedgerService();
    }
    return UnifiedLedgerService.instance;
  }

  public computePositionPnlUsd(symbol: CurrencyPair, side: 'BUY' | 'SELL', lots: number, entryPrice: number, exitOrCurrentPrice: number): number {
    const pipVal = PIP_VALUES[symbol] || (symbol === 'XAU/USD' ? 0.1 : symbol.includes('JPY') ? 0.01 : 0.0001);
    const pipDiff = side === 'BUY' ? (exitOrCurrentPrice - entryPrice) / pipVal : (entryPrice - exitOrCurrentPrice) / pipVal;
    const pipDollarPerStdLot = symbol.includes('NIFTY') ? 2.5 : symbol.includes('/INR') ? 1.2 : 10;
    return Number((pipDiff * pipDollarPerStdLot * lots).toFixed(2));
  }

  public syncPortfolioState(portfolio: PortfolioState, maxAllowedDrawdownPercent = 4.0): void {
    const unrealized = (portfolio.positions || []).reduce((sum, p) => sum + (p.pnl || 0), 0);
    const realized = (portfolio.tradeHistory || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const equity = Number((portfolio.balance + unrealized).toFixed(2));
    const startBal = portfolio.dailyStartingBalance || portfolio.balance || 25000;
    const ddPct = Number(Math.max(0, ((startBal - equity) / Math.max(1, startBal)) * 100).toFixed(2));

    this.state = {
      ...this.state,
      accountBalance: Number(portfolio.balance.toFixed(2)),
      equity,
      dailyStartingBalance: startBal,
      marginUsed: Number(portfolio.marginUsed.toFixed(2)),
      freeMargin: Number(Math.max(0, equity - portfolio.marginUsed).toFixed(2)),
      realizedPnlUsd: Number(realized.toFixed(2)),
      unrealizedPnlUsd: Number(unrealized.toFixed(2)),
      currentDrawdownPercent: ddPct,
      maxAllowedDrawdownPercent,
      circuitBreakerTripped: ddPct >= maxAllowedDrawdownPercent,
      closedTrades: portfolio.tradeHistory || this.state.closedTrades,
      lastUpdated: Date.now(),
    };
  }

  public recordBacktestRun(record: UnifiedBacktestRecord): void {
    this.state.lastBacktestRun = record;
    this.state.lastUpdated = Date.now();
  }

  /**
   * Authoritative Risk Enforcement Check:
   * Immediately closes any live position breaching Stop Loss, Take Profit, or
   * Account Max Daily Drawdown across ALL execution modes.
   */
  public evaluateAndEnforcePositions(params: {
    positions: Position[];
    balance: number;
    dailyStartingBalance: number;
    maxDailyDrawdownPercent: number;
    resolvePrice: (symbol: CurrencyPair) => number;
  }): {
    remainingPositions: Position[];
    closedEvents: RiskEnforcementEvent[];
    updatedBalance: number;
    updatedEquity: number;
    drawdownPercent: number;
    drawdownBreached: boolean;
  } {
    const { positions, balance, dailyStartingBalance, maxDailyDrawdownPercent, resolvePrice } = params;
    const closedEvents: RiskEnforcementEvent[] = [];
    const surviving: Position[] = [];
    let runningBalance = balance;

    for (const pos of positions) {
      const livePx = resolvePrice(pos.symbol) || pos.currentPrice;
      const slHit =
        pos.stopLoss > 0 &&
        ((pos.type === 'BUY' && livePx <= pos.stopLoss) ||
          (pos.type === 'SELL' && livePx >= pos.stopLoss));
      const tpHit =
        pos.takeProfit > 0 &&
        ((pos.type === 'BUY' && livePx >= pos.takeProfit) ||
          (pos.type === 'SELL' && livePx <= pos.takeProfit));

      if (slHit || tpHit) {
        const execExit = slHit ? pos.stopLoss : pos.takeProfit;
        const realized = this.computePositionPnlUsd(pos.symbol, pos.type, pos.lots, pos.entryPrice, execExit);
        runningBalance = Number((runningBalance + realized).toFixed(2));
        const ev: RiskEnforcementEvent = {
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.type,
          lots: pos.lots,
          entryPrice: pos.entryPrice,
          exitPrice: execExit,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          reason: slHit ? 'STOP_LOSS_HIT' : 'TAKE_PROFIT_HIT',
          realizedPnlUsd: realized,
          timestamp: Date.now(),
        };
        closedEvents.push(ev);
        this.state.enforcementEvents = [ev, ...this.state.enforcementEvents].slice(0, 50);
      } else {
        const openPnl = this.computePositionPnlUsd(pos.symbol, pos.type, pos.lots, pos.entryPrice, livePx);
        surviving.push({
          ...pos,
          currentPrice: livePx,
          pnl: openPnl,
          pnlPercent: Number(((openPnl / Math.max(1, pos.lots * 1000)) * 100).toFixed(2)),
        });
      }
    }

    const survivingOpenPnl = surviving.reduce((sum, p) => sum + p.pnl, 0);
    let updatedEquity = Number((runningBalance + survivingOpenPnl).toFixed(2));
    const startBal = dailyStartingBalance || balance || 25000;
    const drawdownPercent = Number(Math.max(0, ((startBal - updatedEquity) / Math.max(1, startBal)) * 100).toFixed(2));
    const drawdownBreached = drawdownPercent >= maxDailyDrawdownPercent;

    let remainingPositions = surviving;
    if (drawdownBreached && surviving.length > 0) {
      for (const pos of surviving) {
        const livePx = resolvePrice(pos.symbol) || pos.currentPrice;
        const realized = this.computePositionPnlUsd(pos.symbol, pos.type, pos.lots, pos.entryPrice, livePx);
        runningBalance = Number((runningBalance + realized).toFixed(2));
        const ev: RiskEnforcementEvent = {
          positionId: pos.id,
          symbol: pos.symbol,
          side: pos.type,
          lots: pos.lots,
          entryPrice: pos.entryPrice,
          exitPrice: livePx,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          reason: 'MAX_DRAWDOWN_FLATTEN',
          realizedPnlUsd: realized,
          timestamp: Date.now(),
        };
        closedEvents.push(ev);
        this.state.enforcementEvents = [ev, ...this.state.enforcementEvents].slice(0, 50);
      }
      remainingPositions = [];
      updatedEquity = runningBalance;
    }

    this.state.accountBalance = runningBalance;
    this.state.equity = updatedEquity;
    this.state.currentDrawdownPercent = drawdownPercent;
    this.state.maxAllowedDrawdownPercent = maxDailyDrawdownPercent;
    this.state.circuitBreakerTripped = drawdownBreached;
    this.state.lastUpdated = Date.now();

    return {
      remainingPositions,
      closedEvents,
      updatedBalance: runningBalance,
      updatedEquity,
      drawdownPercent,
      drawdownBreached,
    };
  }

  public getSnapshot(): UnifiedLedgerState {
    return {
      ...this.state,
      closedTrades: [...this.state.closedTrades],
      enforcementEvents: [...this.state.enforcementEvents],
    };
  }
}

export const unifiedLedgerService = UnifiedLedgerService.getInstance();
