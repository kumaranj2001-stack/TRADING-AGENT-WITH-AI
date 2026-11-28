/**
 * End-to-End Verification of QriTrader Architectural Unification, Hard Risk Governance & Ledger Sync
 * Run via: npx tsx scripts/test_system_unification.ts
 */

import { LiveMarketFeedManager } from '../lib/liveMarketFeed';
import { unifiedMarketAuthority } from '../lib/unifiedMarketAuthority';
import { IsolatedOrderFlowWebSocketClient } from '../lib/orderFlowWebSocket';
import { chiefReviewerAgent, ChiefReviewerAgent } from '../lib/agents/ChiefReviewer';
import { unifiedLedgerService } from '../lib/ledger/UnifiedLedgerService';
import { runHistoricalCandleReplay } from '../lib/backtest/historicalReplayEngine';
import { scalpingEngine } from '../lib/scalpingEngine';
import { technicalScreenerEngine } from '../lib/institutional/TechnicalScreenerEngine';
import { fundamentalMacroEngine } from '../lib/institutional/FundamentalMacroEngine';
import { executionBridgeEngine } from '../lib/institutional/ExecutionBridgeEngine';
import { journalRiskAuditEngine } from '../lib/institutional/JournalRiskAuditEngine';
import { timezoneDstEngine } from '../lib/timezoneDstEngine';
import type { Candle, Position } from '../lib/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function buildBullishTrendCandles(startPrice: number, count: number, step: number): Candle[] {
  const baseTs = Date.UTC(2026, 10, 27, 10, 0, 0);
  const out: Candle[] = [];
  let px = startPrice;
  for (let i = 0; i < count; i++) {
    const open = Number(px.toFixed(4));
    const close = Number((px + step).toFixed(4));
    const high = Number((close + step * 0.35).toFixed(4));
    const low = Number((open - step * 0.15).toFixed(4));
    out.push({
      time: new Date(baseTs + i * 3600_000).toISOString(),
      timestamp: baseTs + i * 3600_000,
      open,
      high,
      low,
      close,
      volume: 2000 + i * 120,
    });
    px = close;
  }
  return out;
}

async function main() {
  console.log('=== QRI SYSTEM UNIFICATION & RISK GOVERNANCE TEST ===');

  // 1. Authoritative Market Feed & Shared Indicator Parity
  const goldCandles = buildBullishTrendCandles(3500.0, 60, 0.8);
  LiveMarketFeedManager.setCanonicalFeed('XAU/USD', '1h', goldCandles);
  const snap = unifiedMarketAuthority.getUnifiedSnapshot('XAU/USD', '1h');
  const expectedClose = goldCandles[goldCandles.length - 1].close;
  assert(Math.abs(snap.spotPrice - expectedClose) < 0.05, `Authoritative spot (${snap.spotPrice}) matches canonical close (${expectedClose})`);

  const wsClient = new IsolatedOrderFlowWebSocketClient('XAU/USD');
  const wsTick = wsClient.generateUnifiedTick();
  const wsMid = (wsTick.bid + wsTick.ask) / 2;
  assert(Math.abs(wsMid - snap.spotPrice) <= 0.6, `OrderFlow WebSocket mid (${wsMid}) matches canonical spot (${snap.spotPrice})`);

  const scr = technicalScreenerEngine.getSnapshot({ symbol: 'XAU/USD', timeframe: '1h', replayBarIndex: 60 });
  const scrLast = scr.barReplay.visibleBars[scr.barReplay.visibleBars.length - 1];
  assert(Math.abs(scrLast.close - expectedClose) < 0.05, `TechnicalScreener uses identical canonical candle (${scrLast.close} vs ${expectedClose})`);
  console.log(`✅ Test 1 (Single Authoritative Feed & Screener Parity): Spot=${snap.spotPrice}, RSI14=${snap.rsi14}`);

  // 2. ChiefReviewerAgent Hard Gatekeeper Veto Enforcement (< 68% confidence & VETOED risk)
  const baseAuditParams: Parameters<ChiefReviewerAgent['auditDesks']>[0] = {
    pair: 'XAU/USD',
    timeframe: '1h',
    currentPrice: snap.spotPrice,
    technical: {
      role: 'technical_analyst',
      agentName: 'Technical',
      bias: 'BUY',
      confidenceScore: 52,
      keySupport: snap.spotPrice - 8,
      keyResistance: snap.spotPrice + 8,
      trend: 'UPTREND',
      candlestickPattern: 'CONSOLIDATION_DOJI',
      indicatorSummary: {
        rsiStatus: 'NEUTRAL (52)',
        maTrend: 'EMA20_ABOVE_EMA50',
        macdStatus: 'POSITIVE_CROSS',
        volatilityState: 'NORMAL',
      },
      indicators: {
        rsi: snap.rsi14,
        ema20: snap.ema20,
        ema50: snap.ema50,
        ema200: snap.ema200,
        macd: { macdLine: snap.macdLine, signalLine: snap.macdSignal, histogram: snap.macdHistogram },
        atr: snap.atr14,
        bollingerBands: { upper: snap.bbUpper, middle: snap.bbMiddle, lower: snap.bbLower, bandwidth: Number((snap.bbUpper - snap.bbLower).toFixed(4)) },
        supportLevels: [snap.spotPrice - 8],
        resistanceLevels: [snap.spotPrice + 8],
      },
      matchedRulesCount: 0,
      topMatchedRules: [],
      thesis: 'Sub-threshold test setup',
      suggestedEntry: snap.spotPrice,
      suggestedStopLoss: snap.spotPrice - 10,
      suggestedTakeProfit: snap.spotPrice + 20,
      timestamp: new Date().toISOString(),
    },
    fundamental: {
      role: 'fundamental_analyst',
      agentName: 'Fundamental',
      bias: 'SELL',
      confidenceScore: 50,
      macroRegime: 'MIXED_YIELD',
      yieldSpread2Y10Y: 0.14,
      realInterestRateSpread: 1.82,
      baseCurrencyOutlook: { currency: 'XAU', centralBankStance: 'NEUTRAL', interestRate: 0, inflationRate: 2.5, sentiment: 'NEUTRAL' },
      quoteCurrencyOutlook: { currency: 'USD', centralBankStance: 'NEUTRAL', interestRate: 4.5, inflationRate: 2.8, sentiment: 'NEUTRAL' },
      highImpactEvents: [],
      matchedRulesCount: 0,
      topMatchedRules: [],
      thesis: 'Conflicting macro test',
      geopoliticalRiskLevel: 'MODERATE',
      timestamp: new Date().toISOString(),
    },
    forex: {
      role: 'forex_analyst',
      agentName: 'Forex',
      bias: 'NEUTRAL',
      confidenceScore: 50,
      dxyTrend: 'RANGING',
      relativeStrengthComparison: { baseStrength: 51, quoteStrength: 49, advantage: 'NEUTRAL' },
      carryTradeYieldSpread: 0,
      intermarketCorrelation: [],
      activeTradingSession: { session: 'LONDON', liquidityRating: 'OPTIMAL', volatilityExpected: 'NORMAL' },
      thesis: 'Mixed DXY flow',
      timestamp: new Date().toISOString(),
    },
    news: {
      role: 'news_analyst',
      agentName: 'News',
      bias: 'NEUTRAL',
      confidenceScore: 50,
      sentimentScore: 0,
      sourcesMonitoredCount: 10,
      recentHeadlines: [],
      topCatalysts: [],
      marketMood: 'NEUTRAL',
      thesis: 'Neutral news catalyst',
      timestamp: new Date().toISOString(),
    },
    risk: {
      role: 'risk_manager',
      agentName: 'Risk Manager',
      verdict: 'VETOED',
      action: 'NO_TRADE',
      reasoning: 'Daily drawdown or confidence threshold veto',
      vetoReasons: ['Sub-68% confidence veto'],
      parameters: {
        entryPrice: snap.spotPrice,
        stopLoss: snap.spotPrice - 10,
        takeProfit1: snap.spotPrice + 20,
        takeProfit2: snap.spotPrice + 35,
        riskRewardRatio: 2.0,
        positionSizeLots: 0,
        positionUnits: 0,
        maxLossUsd: 0,
        projectedGainUsd: 0,
        accountRiskPercent: 0,
        leverageUsed: 0,
      },
      accountHealth: {
        startingBalance: 25000,
        currentBalance: 25000,
        equity: 25000,
        freeMargin: 25000,
        marginUsed: 0,
        dailyDrawdownPercent: 0,
        maxAllowedDrawdown: 4.0,
      },
      timestamp: new Date().toISOString(),
    },
    proposedDirection: 'BUY',
    confluenceGrade: 'E',
    confidenceScore: 52,
    topConfluenceRules: [],
  };

  const vetoAudit = chiefReviewerAgent.auditDesks(baseAuditParams);
  assert(vetoAudit.status === 'VETOED', `Expected ChiefReviewer VETOED below 68%, got ${vetoAudit.status}`);
  assert(vetoAudit.consensusDirective === 'AVOID_TRADE', `Expected AVOID_TRADE directive, got ${vetoAudit.consensusDirective}`);
  assert(vetoAudit.contradictionResolution.resolutionAction === 'FORCE_VETO', 'Expected FORCE_VETO resolution');
  console.log(`✅ Test 2 (ChiefReviewer Hard Risk & Confidence Gate): Status=${vetoAudit.status}, Directive=${vetoAudit.consensusDirective}`);

  // 3. Unified Ledger Auto-Enforcement (SL Hit + Max Drawdown Flattening) & Journal Risk Audit Sync
  const openPositions: Position[] = [
    {
      id: 'pos-sl-test',
      symbol: 'EUR/USD',
      type: 'BUY',
      lots: 0.5,
      entryPrice: 1.096,
      currentPrice: 1.092,
      stopLoss: 1.0925, // Breached: 1.0920 <= 1.0925
      takeProfit: 1.104,
      openTime: '09:00',
      pnl: -200,
      pnlPercent: -4,
      riskReward: 2.0,
    },
    {
      id: 'pos-surv-test',
      symbol: 'GBP/USD',
      type: 'SELL',
      lots: 1.0,
      entryPrice: 1.28,
      currentPrice: 1.295, // Heavy unrealized loss pushing drawdown past 4%
      stopLoss: 1.31,
      takeProfit: 1.25,
      openTime: '09:15',
      pnl: -1500,
      pnlPercent: -10,
      riskReward: 1.5,
    },
  ];
  const enforced = unifiedLedgerService.evaluateAndEnforcePositions({
    positions: openPositions,
    balance: 25000,
    dailyStartingBalance: 25000,
    maxDailyDrawdownPercent: 4.0,
    resolvePrice: (sym) => (sym === 'EUR/USD' ? 1.092 : sym === 'GBP/USD' ? 1.295 : 1.0),
  });
  assert(enforced.closedEvents.some((e) => e.positionId === 'pos-sl-test' && e.reason === 'STOP_LOSS_HIT'), 'EUR/USD breaching stopLoss triggers STOP_LOSS_HIT');
  assert(enforced.drawdownBreached && enforced.remainingPositions.length === 0, 'Drawdown breach triggers MAX_DRAWDOWN_FLATTEN leaving 0 open positions');
  assert(enforced.closedEvents.some((e) => e.positionId === 'pos-surv-test' && e.reason === 'MAX_DRAWDOWN_FLATTEN'), 'Remaining position flattened on drawdown breach');

  const auditSnap = journalRiskAuditEngine.getSnapshot({ symbol: 'EUR/USD' });
  assert(auditSnap.zuluGuardProtection.currentDrawdownPct === enforced.drawdownPercent, 'JournalRiskAuditEngine mirrors UnifiedLedger drawdown %');
  console.log(`✅ Test 3 (Automated SL & Max Drawdown Flattening + Ledger Audit Sync): Closed=${enforced.closedEvents.length}, DD=${enforced.drawdownPercent}%`);

  // 4. Historical OHLCV Candle Replay Backtester Determinism (No Synthetic Math.random)
  const replayCandles: Candle[] = [];
  let pxReplay = 1.09;
  const baseTsReplay = Date.UTC(2026, 10, 20, 0, 0, 0);
  for (let i = 0; i < 120; i++) {
    // Upward bias with realistic periodic retracement candles so RSI reflects trend + pullback structure
    const delta = i % 5 === 3 ? -0.00045 : i % 7 === 0 ? -0.00025 : 0.00055;
    const open = Number(pxReplay.toFixed(5));
    const close = Number((pxReplay + delta).toFixed(5));
    const high = Number((Math.max(open, close) + 0.0003).toFixed(5));
    const low = Number((Math.min(open, close) - 0.00025).toFixed(5));
    replayCandles.push({
      time: new Date(baseTsReplay + i * 3600_000).toISOString(),
      timestamp: baseTsReplay + i * 3600_000,
      open,
      high,
      low,
      close,
      volume: 2200 + (i % 6) * 200,
    });
    pxReplay = close;
  }
  const replay1 = runHistoricalCandleReplay('EUR/USD', '1h', replayCandles, 25000);
  const replay2 = runHistoricalCandleReplay('EUR/USD', '1h', replayCandles, 25000);
  assert(replay1.summary.replaySource === 'HISTORICAL_CANDLE_REPLAY', 'Replay tag matches HISTORICAL_CANDLE_REPLAY');
  assert(replay1.summary.totalPnlUsd === replay2.summary.totalPnlUsd, 'Replay PnL 100% deterministic across repeated historical runs');
  assert(replay1.summary.executedTrades > 0 && replay1.equityCurve.length >= 2, 'Replay executed trades on bullish trend & generated equity curve');

  const scalpBt1 = scalpingEngine.runReplayBacktest({
    pair: 'EUR/USD',
    tpPips: 5,
    slPips: 3,
    maxSpread: 1.2,
    trailingTriggerPips: 2,
    deltaThreshold: 400,
  });
  const scalpBt2 = scalpingEngine.runReplayBacktest({
    pair: 'EUR/USD',
    tpPips: 5,
    slPips: 3,
    maxSpread: 1.2,
    trailingTriggerPips: 2,
    deltaThreshold: 400,
  });
  assert(scalpBt1.netPnlUsd === scalpBt2.netPnlUsd, 'Scalping replay backtest 100% deterministic (zero Math.random)');
  console.log(`✅ Test 4 (Deterministic Historical Replay Backtesting): Trades=${replay1.summary.executedTrades}, PnL=$${replay1.summary.totalPnlUsd}`);

  // 5. Institutional Non-Corporate XAU/USD Taxonomy & Contract-Normalized Slippage
  const goldMacro = fundamentalMacroEngine.getSnapshot({ symbol: 'XAU/USD' });
  const goldText = JSON.stringify(goldMacro);
  assert(!goldText.includes('XAU Senior Unsecured') && !goldText.includes('Vanguard Group (13F)'), 'XAU/USD uses bullion/sovereign data');
  const goldBook = executionBridgeEngine.buildLevel2Book('XAU/USD', snap.spotPrice, 0.1, 2);
  const fxBook = executionBridgeEngine.buildLevel2Book('EUR/USD', 1.0968, 0.0001, 5);
  const fxSlip = executionBridgeEngine.calculateSlippage(fxBook, 'BUY', 100000, 1.0968, 5, 'EUR/USD');
  assert(goldBook.length === 10 && fxSlip.totalSlippageBps < 20, 'L2 slippage normalized cleanly for 1.0 std FX lot');
  console.log(`✅ Test 5 (Institutional Asset Taxonomy & L2 Slippage): FX 1-Lot Slippage=${fxSlip.totalSlippageBps}bps`);

  // 6. DST Clock Synchronization
  const summerDate = new Date('2026-07-15T14:00:00Z');
  const winterDate = new Date('2026-01-15T14:00:00Z');
  assert(timezoneDstEngine.isUsDst(summerDate) && timezoneDstEngine.isEuDst(summerDate), 'July US & EU DST active');
  assert(!timezoneDstEngine.isUsDst(winterDate) && !timezoneDstEngine.isEuDst(winterDate), 'January Standard Time active');
  console.log('✅ Test 6 (DST Clock Transitions): Passed.');

  console.log('\n🎉 ALL SYSTEM UNIFICATION & RISK GOVERNANCE CHECKS PASSED!');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
