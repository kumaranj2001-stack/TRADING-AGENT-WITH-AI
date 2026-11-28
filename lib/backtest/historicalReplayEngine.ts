import { Candle, CurrencyPair, RiskVerdict, TimeFrame } from '../types';
import { PIP_VALUES } from '../marketData';
import { computeTechnicalIndicators } from '../indicators';
import { LiveMarketFeedManager } from '../liveMarketFeed';
import { unifiedLedgerService } from '../ledger/UnifiedLedgerService';

export interface HistoricalReplayTradeResult {
  scenarioName: string;
  pair: CurrencyPair;
  timeframe: TimeFrame;
  barIndex: number;
  barTime: string;
  action: 'BUY' | 'SELL' | 'NO_TRADE';
  riskVerdict: RiskVerdict;
  lots: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnlUsd: number;
  outcome: 'WIN' | 'LOSS' | 'SCRATCH';
  rationale: string;
}

export interface ReplayBarSignal {
  side: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  riskVerdict: RiskVerdict;
  authorized: boolean;
  lots: number;
  stopLoss: number;
  takeProfit: number;
  rationale: string;
}

export type ReplaySignalEvaluator = (params: {
  pair: CurrencyPair;
  timeframe: TimeFrame;
  historySlice: Candle[];
  currentEquity: number;
  currentDrawdownPct: number;
  spreadPips: number;
}) => ReplayBarSignal;

function defaultIndicatorReplayEvaluator(params: {
  pair: CurrencyPair;
  historySlice: Candle[];
  currentEquity: number;
  currentDrawdownPct: number;
}): ReplayBarSignal {
  const { pair, historySlice, currentEquity, currentDrawdownPct } = params;
  const ind = computeTechnicalIndicators(historySlice);
  const price = historySlice[historySlice.length - 1].close;
  const pipVal = PIP_VALUES[pair] || (pair === 'XAU/USD' ? 0.1 : pair.includes('JPY') ? 0.01 : 0.0001);
  const atr = Math.max(pipVal * 8, ind.atr || pipVal * 15);

  const bullAligned = price > ind.ema20 && ind.ema20 >= ind.ema50 && ind.rsi >= 53 && ind.rsi <= 78;
  const bearAligned = price < ind.ema20 && ind.ema20 <= ind.ema50 && ind.rsi <= 47 && ind.rsi >= 22;
  const emaSeparationBonus = Math.min(8, Math.round((Math.abs(ind.ema20 - ind.ema50) / atr) * 4));

  let side: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 48;
  if (bullAligned) {
    side = 'BUY';
    confidence = Math.min(88, Math.round(64 + emaSeparationBonus + (ind.rsi - 50) * 0.6));
  } else if (bearAligned) {
    side = 'SELL';
    confidence = Math.min(88, Math.round(64 + emaSeparationBonus + (50 - ind.rsi) * 0.6));
  }

  const slDist = atr * 1.5;
  const tpDist = slDist * 2.1;
  const stopLoss = side === 'SELL' ? price + slDist : price - slDist;
  const takeProfit = side === 'SELL' ? price - tpDist : price + tpDist;

  if (side === 'HOLD' || confidence < 68 || currentDrawdownPct >= 4.0) {
    return {
      side: 'HOLD',
      confidence,
      riskVerdict: 'VETOED',
      authorized: false,
      lots: 0,
      stopLoss,
      takeProfit,
      rationale:
        currentDrawdownPct >= 4.0
          ? `VETOED: Drawdown ${currentDrawdownPct.toFixed(2)}% >= 4.0%`
          : `VETOED: Sub-threshold setup confidence (${confidence}% < 68%)`,
    };
  }

  const riskUsd = Math.max(25, currentEquity * 0.01);
  const slPips = Math.max(4, slDist / pipVal);
  const lots = Math.max(0.05, Math.min(1.5, Number((riskUsd / (slPips * 10)).toFixed(2))));

  return {
    side,
    confidence,
    riskVerdict: 'APPROVED',
    authorized: true,
    lots,
    stopLoss,
    takeProfit,
    rationale: `Historical bar EMA/RSI confluence (${confidence}%), R:R 2.1:1 within drawdown cap`,
  };
}

/**
 * Pure causal historical OHLCV candle replay backtester.
 * Evaluates each bar strictly from past slices, simulates spread & intra-bar high/low SL/TP exits,
 * and computes running equity & peak-to-trough drawdown.
 */
export function runHistoricalCandleReplay(
  pair: CurrencyPair,
  timeframe: TimeFrame,
  candles: Candle[],
  accountBalance = 25000,
  evaluateSignal: ReplaySignalEvaluator = defaultIndicatorReplayEvaluator
): {
  summary: {
    totalScenarios: number;
    executedTrades: number;
    vetoedTrades: number;
    winCount: number;
    lossCount: number;
    winRatePercent: number;
    totalPnlUsd: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    replaySource: 'HISTORICAL_CANDLE_REPLAY';
    timeframe: TimeFrame;
    candleCount: number;
  };
  scenarios: HistoricalReplayTradeResult[];
  equityCurve: Array<{ step: number; equity: number; drawdownPct: number; barTime: string }>;
} {
  const results: HistoricalReplayTradeResult[] = [];
  const pipVal = PIP_VALUES[pair] || (pair === 'XAU/USD' ? 0.1 : pair.includes('JPY') ? 0.01 : 0.0001);
  const spreadPips = Math.max(0.4, LiveMarketFeedManager.getCanonicalBidAsk(pair).spreadPips);
  const spreadCostPrice = spreadPips * pipVal;

  let currentEquity = accountBalance;
  let peakEquity = accountBalance;
  let maxDrawdownPercent = 0;
  let totalPnl = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let vetoedCount = 0;

  const equityCurve: Array<{ step: number; equity: number; drawdownPct: number; barTime: string }> = [
    { step: 0, equity: currentEquity, drawdownPct: 0, barTime: candles[0]?.time || 'START' },
  ];

  const startBar = Math.min(35, Math.max(15, Math.floor(candles.length * 0.3)));
  const maxEnd = candles.length - 4;
  let i = startBar;
  let stepCounter = 0;

  while (i < maxEnd && stepCounter < 18) {
    stepCounter++;
    const historySlice = candles.slice(0, i + 1);
    const bar = historySlice[historySlice.length - 1];
    LiveMarketFeedManager.setCanonicalFeed(pair, timeframe, historySlice);

    const currentDdPct = peakEquity > 0 ? Math.max(0, ((peakEquity - currentEquity) / peakEquity) * 100) : 0;
    const signal = evaluateSignal({
      pair,
      timeframe,
      historySlice,
      currentEquity,
      currentDrawdownPct: currentDdPct,
      spreadPips,
    });

    if (
      signal.riskVerdict === 'VETOED' ||
      !signal.authorized ||
      signal.side === 'HOLD' ||
      signal.lots <= 0
    ) {
      vetoedCount++;
      results.push({
        scenarioName: `Bar #${i} (${bar.time}) [${signal.confidence}% conf]`,
        pair,
        timeframe,
        barIndex: i,
        barTime: bar.time,
        action: 'NO_TRADE',
        riskVerdict: 'VETOED',
        lots: 0,
        entryPrice: bar.close,
        exitPrice: bar.close,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        pnlUsd: 0,
        outcome: 'SCRATCH',
        rationale: signal.rationale,
      });
      i += 6;
      continue;
    }

    const side = signal.side;
    const rawEntry = bar.close;
    const sl = signal.stopLoss;
    const tp = signal.takeProfit;
    const lots = Math.max(0.01, signal.lots);

    let exitPrice = bar.close;
    let outcome: HistoricalReplayTradeResult['outcome'] = 'SCRATCH';
    let exitBar = Math.min(candles.length - 1, i + 12);

    // Walk forward bar-by-bar using real candle highs & lows (SL evaluated first on same bar)
    for (let j = i + 1; j <= Math.min(candles.length - 1, i + 18); j++) {
      const future = candles[j];
      const slTouched = side === 'BUY' ? future.low <= sl : future.high >= sl;
      const tpTouched = side === 'BUY' ? future.high >= tp : future.low <= tp;

      if (slTouched) {
        exitPrice = sl;
        outcome = 'LOSS';
        exitBar = j;
        break;
      }
      if (tpTouched) {
        exitPrice = tp;
        outcome = 'WIN';
        exitBar = j;
        break;
      }
      exitPrice = future.close;
      exitBar = j;
    }

    const effectiveEntry = side === 'BUY' ? rawEntry + spreadCostPrice * 0.5 : rawEntry - spreadCostPrice * 0.5;
    const pnl = unifiedLedgerService.computePositionPnlUsd(pair, side, lots, effectiveEntry, exitPrice);

    if (pnl > 0) {
      outcome = 'WIN';
      winCount++;
      grossWin += pnl;
    } else if (pnl < 0) {
      outcome = 'LOSS';
      lossCount++;
      grossLoss += Math.abs(pnl);
    }

    totalPnl += pnl;
    currentEquity = Number((currentEquity + pnl).toFixed(2));
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const ddPct = peakEquity > 0 ? Number((((peakEquity - currentEquity) / peakEquity) * 100).toFixed(2)) : 0;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    equityCurve.push({
      step: equityCurve.length,
      equity: currentEquity,
      drawdownPct: ddPct,
      barTime: candles[exitBar]?.time || bar.time,
    });

    const decimals = pair.includes('JPY') ? 3 : pair === 'XAU/USD' ? 2 : 5;
    results.push({
      scenarioName: `Bar #${i}->#${exitBar} (${bar.time}) [${signal.confidence}% conf]`,
      pair,
      timeframe,
      barIndex: i,
      barTime: bar.time,
      action: side,
      riskVerdict: signal.riskVerdict,
      lots,
      entryPrice: Number(effectiveEntry.toFixed(decimals)),
      exitPrice: Number(exitPrice.toFixed(decimals)),
      stopLoss: sl,
      takeProfit: tp,
      pnlUsd: pnl,
      outcome,
      rationale: signal.rationale,
    });

    i = Math.max(i + 4, exitBar + 1);
  }

  const executedCount = winCount + lossCount;
  const winRate = executedCount > 0 ? Number(((winCount / executedCount) * 100).toFixed(1)) : 0;
  const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? 3.5 : 0;

  return {
    summary: {
      totalScenarios: results.length,
      executedTrades: executedCount,
      vetoedTrades: vetoedCount,
      winCount,
      lossCount,
      winRatePercent: winRate,
      totalPnlUsd: Number(totalPnl.toFixed(2)),
      profitFactor,
      maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
      replaySource: 'HISTORICAL_CANDLE_REPLAY',
      timeframe,
      candleCount: candles.length,
    },
    scenarios: results,
    equityCurve,
  };
}
