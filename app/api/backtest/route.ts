import { NextRequest, NextResponse } from 'next/server';
import { CurrencyPair, TimeFrame } from '@/lib/types';
import { SwarmCoordinator } from '@/lib/agents/SwarmCoordinator';
import { RiskManager, DEFAULT_RISK_CONFIG } from '@/lib/agents/RiskManager';
import { BASE_PRICES } from '@/lib/marketData';
import { RealMarketDataService } from '@/lib/realMarketDataService';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { unifiedLedgerService } from '@/lib/ledger/UnifiedLedgerService';
import { runHistoricalCandleReplay } from '@/lib/backtest/historicalReplayEngine';

export const runtime = 'nodejs';

const VALID_TIMEFRAMES: TimeFrame[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Optional body defaults to EUR/USD 1h historical replay
    }

    const rawPair = typeof body?.pair === 'string' ? body.pair : 'EUR/USD';
    const pair: CurrencyPair = rawPair in BASE_PRICES ? (rawPair as CurrencyPair) : 'EUR/USD';
    const rawTf = typeof body?.timeframe === 'string' ? body.timeframe : '1h';
    const timeframe: TimeFrame = VALID_TIMEFRAMES.includes(rawTf as TimeFrame) ? (rawTf as TimeFrame) : '1h';
    const count = Math.min(240, Math.max(80, Number(body?.count) || 140));

    const { candles } = await RealMarketDataService.fetchRealLiveCandles(pair, timeframe, count);
    const coordinator = new SwarmCoordinator();
    const riskManager = new RiskManager(DEFAULT_RISK_CONFIG);

    const replay = runHistoricalCandleReplay(
      pair,
      timeframe,
      candles,
      25000,
      ({ historySlice, currentEquity, currentDrawdownPct, spreadPips }) => {
        const consensus = coordinator.runConsensus(pair, timeframe, historySlice);
        const barClose = historySlice[historySlice.length - 1].close;
        const rawOrderType = consensus.executionSignal.orderType;
        const sideChoice: 'BUY' | 'SELL' | 'HOLD' =
          rawOrderType === 'BUY_MARKET' ? 'BUY' : rawOrderType === 'SELL_MARKET' ? 'SELL' : 'HOLD';

        const risk = riskManager.evaluateTrade(
          sideChoice,
          consensus.overallConfidence,
          barClose,
          consensus.agents.risk.parameters.stopLoss,
          consensus.agents.risk.parameters.takeProfit1,
          currentDrawdownPct,
          pair,
          currentEquity,
          spreadPips
        );

        return {
          side: risk.action === 'BUY' ? 'BUY' : risk.action === 'SELL' ? 'SELL' : 'HOLD',
          confidence: consensus.overallConfidence,
          riskVerdict: risk.verdict,
          authorized: consensus.executionSignal.authorized && risk.verdict !== 'VETOED' && sideChoice !== 'HOLD',
          lots: risk.parameters.positionSizeLots,
          stopLoss: risk.parameters.stopLoss,
          takeProfit: risk.parameters.takeProfit1,
          rationale: risk.reasoning,
        };
      }
    );

    unifiedLedgerService.recordBacktestRun({
      pair,
      timeframe,
      executedTrades: replay.summary.executedTrades,
      vetoedTrades: replay.summary.vetoedTrades,
      winCount: replay.summary.winCount,
      lossCount: replay.summary.lossCount,
      winRatePercent: replay.summary.winRatePercent,
      totalPnlUsd: replay.summary.totalPnlUsd,
      profitFactor: replay.summary.profitFactor,
      maxDrawdownPercent: replay.summary.maxDrawdownPercent,
      replaySource: 'HISTORICAL_CANDLE_REPLAY',
      timestamp: Date.now(),
    });

    // Restore full candle array in canonical cache after historical replay
    LiveMarketFeedManager.setCanonicalFeed(pair, timeframe, candles);

    return NextResponse.json({
      success: true,
      data: {
        targetPair: pair,
        timeframe,
        summary: replay.summary,
        scenarios: replay.scenarios,
        equityCurve: replay.equityCurve,
        ledger: unifiedLedgerService.getSnapshot(),
      },
    });
  } catch (error: any) {
    console.error('[API /backtest POST] error:', error);
    return NextResponse.json(
      { success: false, error: 'Backtest execution failed' },
      { status: 500 }
    );
  }
}
