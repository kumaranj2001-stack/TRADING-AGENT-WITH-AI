'use client';

import React, { useState, useEffect } from 'react';
import { History, Play, ArrowLeft, Layers } from 'lucide-react';
import { CurrencyPair, TimeFrame } from '@/lib/types';
import { BASE_PRICES } from '@/lib/marketData';

interface BacktestSummary {
  totalScenarios: number;
  executedTrades: number;
  vetoedTrades: number;
  winCount: number;
  lossCount: number;
  winRatePercent: number;
  totalPnlUsd: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  replaySource?: 'HISTORICAL_CANDLE_REPLAY';
  timeframe?: TimeFrame;
  candleCount?: number;
}

interface BacktestScenarioItem {
  scenarioName: string;
  pair: CurrencyPair;
  action: 'BUY' | 'SELL' | 'NO_TRADE';
  riskVerdict: 'APPROVED' | 'MODIFIED' | 'VETOED';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  outcome: 'WIN' | 'LOSS' | 'SCRATCH';
  rationale: string;
}

interface EquityCurvePoint {
  step: number;
  equity: number;
  drawdownPct: number;
  barTime: string;
}

export interface BacktestViewProps {
  defaultPair?: CurrencyPair;
  onBackToTerminal?: () => void;
}

const BACKTEST_PAIRS = Object.keys(BASE_PRICES) as CurrencyPair[];
const TIMEFRAMES: TimeFrame[] = ['15m', '1h', '4h', '1d'];

export const BacktestView: React.FC<BacktestViewProps> = ({ defaultPair = 'EUR/USD', onBackToTerminal }) => {
  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(defaultPair);
  const [selectedTf, setSelectedTf] = useState<TimeFrame>('1h');
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [scenarios, setScenarios] = useState<BacktestScenarioItem[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);

  useEffect(() => {
    setSelectedPair(defaultPair);
  }, [defaultPair]);

  const runBacktest = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: selectedPair, timeframe: selectedTf, count: 140 }),
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.data.summary);
        setScenarios(data.data.scenarios);
        setEquityCurve(data.data.equityCurve || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-terminal-900 border border-terminal-border rounded-xl p-5 shadow-lg space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-terminal-border pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>03 // HISTORICAL OHLCV CANDLE REPLAY BACKTESTER</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Causal bar-by-bar OHLCV candle replay with spread deductions, intra-bar SL/TP execution, RiskManager vetoes & Unified Ledger sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value as CurrencyPair)}
            className="bg-terminal-950 border border-terminal-border rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            aria-label="Backtest Pair"
          >
            {BACKTEST_PAIRS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={selectedTf}
            onChange={(e) => setSelectedTf(e.target.value as TimeFrame)}
            className="bg-terminal-950 border border-terminal-border rounded-lg px-2 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            aria-label="Backtest Timeframe"
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>

          <button
            onClick={runBacktest}
            disabled={isRunning}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-mono text-xs font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'REPLAYING CANDLES...' : 'EXECUTE HISTORICAL REPLAY'}</span>
          </button>

          {onBackToTerminal && (
            <button
              onClick={onBackToTerminal}
              className="px-3 py-2 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white border border-terminal-border font-mono text-xs transition-colors flex items-center gap-1.5 font-semibold"
              title="Return to Terminal"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>RETURN TO TERMINAL</span>
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="bg-terminal-950 p-3 rounded-lg border border-terminal-border">
            <span className="text-slate-400 block text-[10px] uppercase">Win Rate</span>
            <span className="text-emerald-400 font-bold text-lg">{summary.winRatePercent}%</span>
            <span className="text-[10px] text-slate-400 block">
              {summary.winCount} Wins / {summary.lossCount} Losses
            </span>
          </div>

          <div className="bg-terminal-950 p-3 rounded-lg border border-terminal-border">
            <span className="text-slate-400 block text-[10px] uppercase">Total Backtest P&L</span>
            <span className={`font-bold text-lg ${summary.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summary.totalPnlUsd >= 0 ? '+' : ''}${summary.totalPnlUsd.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block">Spread-Adjusted Net Equity</span>
          </div>

          <div className="bg-terminal-950 p-3 rounded-lg border border-terminal-border">
            <span className="text-slate-400 block text-[10px] uppercase">Profit Factor</span>
            <span className="text-cyan-400 font-bold text-lg">{summary.profitFactor}</span>
            <span className="text-[10px] text-slate-400 block">Realized Gross Win / Loss</span>
          </div>

          <div className="bg-terminal-950 p-3 rounded-lg border border-terminal-border">
            <span className="text-slate-400 block text-[10px] uppercase">Max Drawdown</span>
            <span className="text-rose-400 font-bold text-lg">{summary.maxDrawdownPercent}%</span>
            <span className="text-[10px] text-slate-400 block">{summary.candleCount || 140} Historical Bars</span>
          </div>

          <div className="bg-terminal-950 p-3 rounded-lg border border-terminal-border">
            <span className="text-slate-400 block text-[10px] uppercase">Risk Manager Vetoes</span>
            <span className="text-amber-400 font-bold text-lg">{summary.vetoedTrades} Blocked</span>
            <span className="text-[10px] text-emerald-400 block flex items-center gap-1">
              <Layers className="w-3 h-3" /> {summary.replaySource || 'HISTORICAL_CANDLE_REPLAY'}
            </span>
          </div>
        </div>
      )}

      {equityCurve.length > 1 && (
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span>CAUSAL REPLAY EQUITY CURVE ($25,000 START)</span>
            <span className="text-cyan-300 font-bold">Final Equity: ${equityCurve[equityCurve.length - 1].equity.toLocaleString()}</span>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {(() => {
              const minEq = Math.min(...equityCurve.map((p) => p.equity));
              const maxEq = Math.max(...equityCurve.map((p) => p.equity));
              const span = Math.max(10, maxEq - minEq);
              return equityCurve.map((pt) => {
                const h = Math.max(15, Math.round(((pt.equity - minEq) / span) * 100));
                return (
                  <div
                    key={pt.step}
                    title={`Step ${pt.step} (${pt.barTime}): $${pt.equity} (DD: ${pt.drawdownPct}%)`}
                    className={`flex-1 rounded-t transition-all ${pt.equity >= 25000 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
                    style={{ height: `${h}%` }}
                  />
                );
              });
            })()}
          </div>
        </div>
      )}

      {scenarios.length > 0 ? (
        <div className="overflow-x-auto border border-terminal-border rounded-lg">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-terminal-950 text-slate-400 border-b border-terminal-border text-[11px]">
              <tr>
                <th className="p-3">Historical Bar Window</th>
                <th className="p-3">Pair</th>
                <th className="p-3">Action</th>
                <th className="p-3">Verdict</th>
                <th className="p-3">Entry / Exit</th>
                <th className="p-3">Lots</th>
                <th className="p-3">Outcome</th>
                <th className="p-3">P&L ($)</th>
                <th className="p-3">Risk Manager Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border/60 bg-terminal-900/60">
              {scenarios.map((sc, idx) => (
                <tr key={idx} className="hover:bg-terminal-800/40">
                  <td className="p-3 font-semibold text-white">{sc.scenarioName}</td>
                  <td className="p-3 text-cyan-400">{sc.pair}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sc.action === 'BUY'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : sc.action === 'SELL'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {sc.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sc.riskVerdict === 'APPROVED'
                        ? 'text-emerald-400'
                        : sc.riskVerdict === 'MODIFIED'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}>
                      {sc.riskVerdict}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">
                    {sc.entryPrice} → {sc.exitPrice}
                  </td>
                  <td className="p-3 text-slate-300">{sc.lots}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sc.outcome === 'WIN'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : sc.outcome === 'LOSS'
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {sc.outcome}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-bold ${sc.pnlUsd > 0 ? 'text-emerald-400' : sc.pnlUsd < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {sc.pnlUsd > 0 ? '+' : ''}${sc.pnlUsd.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3 text-[11px] text-slate-300 max-w-xs truncate" title={sc.rationale}>
                    {sc.rationale}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center bg-terminal-950/60 border border-terminal-border rounded-xl text-slate-400 font-mono text-xs">
          Select an instrument and timeframe, then click &quot;EXECUTE HISTORICAL REPLAY&quot; to run bar-by-bar OHLCV candle backtesting with authentic Risk Manager vetoes and ledger synchronization.
        </div>
      )}
    </div>
  );
};
