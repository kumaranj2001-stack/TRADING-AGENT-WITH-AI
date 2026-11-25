'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dna, Search, Clock } from 'lucide-react';
import { CurrencyPair } from '@/lib/types';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { ResearchReportSnapshot } from '@/lib/research/types';
import {
  computeLivePredictiveAnalytics,
  PredictiveCandleInput,
} from '@/lib/research/PredictiveAnalyticsEngine';

export interface MarketDnaSidebarProps {
  pair: CurrencyPair | string;
  timeframe: string;
  theme?: 'light' | 'dark';
  onTogglePatternOnChart?: (on: boolean) => void;
  onToggleChartMode?: (mode: 'Candles' | 'Line') => void;
  livePrice?: number;
  candles?: PredictiveCandleInput[];
  researchReport?: ResearchReportSnapshot | null;
}

export const MarketDnaSidebar: React.FC<MarketDnaSidebarProps> = ({
  pair,
  timeframe,
  theme = 'light',
  onTogglePatternOnChart,
  onToggleChartMode,
  livePrice: propLivePrice,
  candles = [],
  researchReport,
}) => {
  const isLight = theme === 'light';
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'twins' | 'entry' | 'stats' | 'confirmation' | 'replay'>('overview');
  const [patternLength, setPatternLength] = useState<number>(20);
  const [outcomeLength, setOutcomeLength] = useState<number>(10);
  const [sortMethod, setSortMethod] = useState<'Similarity' | 'Forward Return' | 'MFE'>('Similarity');
  const [rrFilter, setRrFilter] = useState<string>('1:1 - 1:2 - 1:3');
  const [updateOnClose, setUpdateOnClose] = useState<boolean>(true);
  const [patternOnChart, setPatternOnChart] = useState<boolean>(true);
  const [chartMode, setChartMode] = useState<'Candles' | 'Line'>('Candles');
  const [searchSeed, setSearchSeed] = useState<number>(1);
  const [countdownClock, setCountdownClock] = useState<number>(0);

  // Interactive Bar-by-Bar Replay State
  const [replayIndex, setReplayIndex] = useState<number>(() => Math.max(0, candles.length - 12));
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const activePrice =
    propLivePrice ||
    researchReport?.brief.pricing.currentPrice ||
    LiveMarketFeedManager.getCanonicalPrice(pair as CurrencyPair) ||
    liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair as CurrencyPair) ||
    100;

  // Tick real-time countdown every second
  useEffect(() => {
    const id = setInterval(() => {
      setCountdownClock((c) => c + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-advance Bar-by-Bar Replay when active
  useEffect(() => {
    if (!isReplaying || candles.length === 0) return;
    const timer = setInterval(() => {
      setReplayIndex((idx) => {
        if (idx >= candles.length - 1) {
          setIsReplaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, [isReplaying, candles.length]);

  useEffect(() => {
    setReplayIndex(Math.max(0, candles.length - 12));
    setIsReplaying(false);
  }, [pair, timeframe, candles.length]);

  const snapshot = useMemo(
    () =>
      computeLivePredictiveAnalytics({
        symbol: pair,
        timeframe,
        candles,
        livePrice: activePrice,
        horizonCandles: outcomeLength,
        simulationNonce: searchSeed,
        researchReport,
      }),
    [pair, timeframe, candles, activePrice, outcomeLength, searchSeed, researchReport, countdownClock]
  );

  const { visionAtlasLab: lab, marketDna: dna, decimals } = snapshot;
  const isIndian =
    pair.includes('NIFTY') || pair.includes('RELIANCE') || pair.includes('HDFC') || pair.includes('TCS') || pair.includes('INFY');
  const isFx = pair.includes('/') && !pair.includes('XAU') && !pair.includes('XAG') && !pair.includes('BTC');
  const pricePrefix = isIndian ? '₹' : isFx ? '' : '$';
  const fmt = (n: number) => `${pricePrefix}${n.toFixed(decimals)}`;

  const sortedTwins = useMemo(() => {
    const copy = [...dna.twins];
    if (sortMethod === 'Forward Return') {
      copy.sort((a, b) => Math.abs(b.forwardReturnPercent) - Math.abs(a.forwardReturnPercent));
    } else if (sortMethod === 'MFE') {
      copy.sort((a, b) => b.maxFavorableExcursionPct - a.maxFavorableExcursionPct);
    } else {
      copy.sort((a, b) => b.similarityPercent - a.similarityPercent);
    }
    return copy;
  }, [dna.twins, sortMethod]);

  const handlePatternToggle = () => {
    const nextVal = !patternOnChart;
    setPatternOnChart(nextVal);
    if (onTogglePatternOnChart) onTogglePatternOnChart(nextVal);
  };

  const handleChartModeChange = (mode: 'Candles' | 'Line') => {
    setChartMode(mode);
    if (onToggleChartMode) onToggleChartMode(mode);
  };

  const currentReplayBar = candles[Math.min(replayIndex, Math.max(0, candles.length - 1))];

  return (
    <div
      className={`w-full h-full flex flex-col select-none overflow-y-auto custom-scrollbar font-sans text-xs ${
        isLight ? 'text-slate-800' : 'text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border">
        <div className="flex items-center gap-1.5">
          <Dna className="w-4 h-4 text-amber-500" />
          <h2 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">
            MARKET DNA FRACTAL ENGINE
          </h2>
        </div>
        <p className="text-[10px] text-slate-500 italic mt-0.5">
          Live OHLCV Correlation &amp; Empirical Walk-Forward Edge
        </p>
      </div>

      {/* Filter Parameters Bar */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border bg-slate-50 dark:bg-terminal-900/40 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Pattern window</label>
            <select
              value={patternLength}
              onChange={(e) => setPatternLength(Number(e.target.value))}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-terminal-border bg-white dark:bg-terminal-900 text-xs font-semibold focus:outline-none"
            >
              <option value={12}>12 candles</option>
              <option value={20}>20 candles</option>
              <option value={40}>40 candles</option>
              <option value={60}>60 candles</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Outcome horizon</label>
            <select
              value={outcomeLength}
              onChange={(e) => setOutcomeLength(Number(e.target.value))}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-terminal-border bg-white dark:bg-terminal-900 text-xs font-semibold focus:outline-none"
            >
              <option value={5}>5 candles</option>
              <option value={10}>10 candles</option>
              <option value={20}>20 candles</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">Sort fractals by</label>
            <select
              value={sortMethod}
              onChange={(e) => setSortMethod(e.target.value as any)}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-terminal-border bg-white dark:bg-terminal-900 text-xs font-semibold focus:outline-none"
            >
              <option value="Similarity">Similarity</option>
              <option value="Forward Return">Forward Return</option>
              <option value="MFE">MFE Excursion</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">R:R Band</label>
            <select
              value={rrFilter}
              onChange={(e) => setRrFilter(e.target.value)}
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-terminal-border bg-white dark:bg-terminal-900 text-xs font-semibold focus:outline-none"
            >
              <option value="1:1 - 1:2 - 1:3">1:1 - 1:2 - 1:3</option>
              <option value="1:2+ Only">1:2+ Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={updateOnClose}
              onChange={(e) => setUpdateOnClose(e.target.checked)}
              className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            <span>Sync on bar tick</span>
          </label>

          <button
            onClick={() => setSearchSeed((s) => s + 1)}
            className="px-3 py-1 rounded bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <Search className="w-3 h-3" />
            <span>Scan Fractals</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-terminal-border text-[11px] font-bold">
        {[
          { id: 'overview', label: 'DNA Overview' },
          { id: 'twins', label: 'Historical Twins' },
          { id: 'entry', label: 'Entry Checklist' },
          { id: 'stats', label: 'Empirical Stats' },
          { id: 'confirmation', label: 'Flow Log' },
          { id: 'replay', label: 'Replay' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`py-2 px-2.5 whitespace-nowrap transition-colors border-b-2 ${
              activeSubTab === tab.id
                ? 'border-slate-900 dark:border-amber-400 text-slate-900 dark:text-white bg-slate-50 dark:bg-terminal-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3.5 space-y-3.5 flex-1">
        {activeSubTab === 'overview' && (
          <>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Liquidity &amp; Structure
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                  LIVE TELEMETRY
                </span>
              </div>

              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">Liquidity sweep:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{lab.liquiditySweepText}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-sans">Structure:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{lab.structureText}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Confidence:</span>
                  <span className="font-bold text-cyan-600">{lab.confidenceText}</span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] font-bold font-mono">
                  <span className="text-emerald-600">Bullish {lab.bullishPct}%</span>
                  <span className="text-rose-600">Bearish {lab.bearishPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-terminal-800 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: `${lab.bullishPct}%` }} />
                  <div className="bg-rose-500 h-full" style={{ width: `${lab.bearishPct}%` }} />
                </div>
              </div>

              {/* Reaction Zones */}
              <div className="pt-2 border-t border-slate-200 dark:border-terminal-border space-y-1 text-[11px] font-mono">
                {lab.sellZones.slice(0, 2).map((z) => (
                  <div key={z.id} className="flex items-center justify-between">
                    <span className="text-rose-600 dark:text-rose-400">{z.strengthLabel}</span>
                    <span className="font-bold">
                      {fmt(z.low)} - {fmt(z.high)}
                    </span>
                  </div>
                ))}
                {lab.buyZones.slice(0, 2).map((z) => (
                  <div key={z.id} className="flex items-center justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400">{z.strengthLabel}</span>
                    <span className="font-bold">
                      {fmt(z.low)} - {fmt(z.high)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Candle Clock */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{timeframe.toUpperCase()} Bar Closing Countdown</span>
                </span>
                <span className="font-mono text-amber-600">{dna.nextCandleCountdown}</span>
              </div>
            </div>

            {/* Market DNA Live Status Card */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2">
              <span className="text-xs font-bold block text-slate-900 dark:text-white">
                Market DNA Regime — {dna.historicalBias}
              </span>
              <div className="space-y-1.5 text-[11px] font-mono pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Market regime:</span>
                  <span className="font-medium">{dna.regime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Volatility:</span>
                  <span className="font-medium">{dna.volatilityLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Candle body strength:</span>
                  <span className="font-medium">{dna.candleBodyStrengthPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Fractal similarity:</span>
                  <span className="font-bold text-amber-600">{dna.similarityScore}%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeSubTab === 'twins' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
              Matched Pearson Fractals ({candles.length} live bars scanned)
            </span>
            {sortedTwins.length === 0 ? (
              <div className="p-3 rounded border border-slate-200 dark:border-terminal-border text-slate-500">
                Waiting for sufficient OHLCV bar depth ({candles.length} bars loaded)...
              </div>
            ) : (
              sortedTwins.map((twin, idx) => (
                <div
                  key={twin.id}
                  className={`p-2.5 rounded border space-y-1 ${
                    idx === 0
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-slate-200 dark:border-terminal-border'
                  }`}
                >
                  <div className="flex justify-between font-mono text-[11px]">
                    <strong className={idx === 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}>
                      Match #{idx + 1} ({twin.similarityPercent}%)
                    </strong>
                    <span className="text-slate-500">{twin.timestampLabel}</span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    Fwd Return:{' '}
                    <strong className={twin.forwardReturnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {twin.forwardReturnPercent >= 0 ? '+' : ''}
                      {twin.forwardReturnPercent}%
                    </strong>{' '}
                    | MFE: +{twin.maxFavorableExcursionPct}% | MAE: {twin.maxAdverseExcursionPct}%
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'entry' && (
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
              High-Confluence Checklist (Live Sync)
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <span>Liquidity Sweep Probe</span>
                <span className="font-bold text-emerald-600">{fmt(lab.sweepPrice)}</span>
              </div>
              <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                <span>EMA20 / EMA50 Trend</span>
                <span className="font-bold text-cyan-600">
                  {snapshot.ema20 >= snapshot.ema50 ? 'BULLISH STACK' : 'BEARISH STACK'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-100 dark:bg-terminal-900 border border-slate-200 dark:border-terminal-border flex items-center justify-between">
                <span>RSI-14 Equilibrium</span>
                <span className="font-bold">{snapshot.rsi14}</span>
              </div>
              {researchReport && (
                <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between">
                  <span>Multi-Agent Grade</span>
                  <span className="font-bold text-indigo-500">
                    {researchReport.grade} ({researchReport.compositeScore}/100) • R:R 1:
                    {researchReport.technical.tradePlan.target1.riskRewardRatio}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'stats' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
              Walk-Forward Backtest ({dna.backtest.totalSetups} empirical setups)
            </span>
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2 rounded border border-slate-200 dark:border-terminal-border">
                <span className="text-[10px] text-slate-500 block">Win Rate</span>
                <strong className="text-emerald-600 text-sm">{dna.backtest.winRatePct}%</strong>
              </div>
              <div className="p-2 rounded border border-slate-200 dark:border-terminal-border">
                <span className="text-[10px] text-slate-500 block">Avg R-Multiple</span>
                <strong className="text-cyan-600 text-sm">
                  {dna.backtest.avgRMultiple >= 0 ? '+' : ''}
                  {dna.backtest.avgRMultiple}R
                </strong>
              </div>
              <div className="p-2 rounded border border-slate-200 dark:border-terminal-border">
                <span className="text-[10px] text-slate-500 block">ATR-14 Unit</span>
                <strong className="text-amber-600 text-sm">{fmt(snapshot.atr)}</strong>
              </div>
              <div className="p-2 rounded border border-slate-200 dark:border-terminal-border">
                <span className="text-[10px] text-slate-500 block">Profit Factor</span>
                <strong className="text-slate-900 dark:text-white text-sm">{dna.backtest.profitFactor}</strong>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'confirmation' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
              Live Structure Confirmation Log
            </span>
            <div className="space-y-1.5 font-mono text-[11px]">
              {dna.confirmationLog.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded border border-slate-200 dark:border-terminal-border flex flex-col gap-0.5"
                >
                  <span className="text-[9px] text-slate-400">{item.time}</span>
                  <span
                    className={`font-bold ${
                      item.bias === 'BULL'
                        ? 'text-emerald-600'
                        : item.bias === 'BEAR'
                        ? 'text-rose-600'
                        : 'text-cyan-600'
                    }`}
                  >
                    {item.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'replay' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2.5 text-center">
            <span className="font-bold text-xs uppercase block text-slate-700 dark:text-slate-300">
              Bar-by-Bar Replay Simulator
            </span>
            {currentReplayBar ? (
              <div className="p-2 rounded bg-slate-50 dark:bg-terminal-900 font-mono text-[11px] space-y-1 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bar Index:</span>
                  <strong>
                    #{replayIndex + 1} / {candles.length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">OHLC:</span>
                  <strong>
                    {fmt(currentReplayBar.open)} / {fmt(currentReplayBar.high)} / {fmt(currentReplayBar.low)} /{' '}
                    {fmt(currentReplayBar.close)}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Awaiting live candles...</p>
            )}
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setIsReplaying((v) => !v)}
                className="px-3 py-1 rounded bg-slate-900 dark:bg-cyan-600 text-white font-bold text-xs cursor-pointer"
              >
                {isReplaying ? '⏸ Pause' : '▶ Start Replay'}
              </button>
              <button
                onClick={() => setReplayIndex((i) => Math.min(Math.max(0, candles.length - 1), i + 1))}
                className="px-2 py-1 rounded border border-slate-300 dark:border-terminal-border text-xs cursor-pointer"
              >
                Next ⏩
              </button>
              <button
                onClick={() => {
                  setIsReplaying(false);
                  setReplayIndex(Math.max(0, candles.length - 12));
                }}
                className="px-2 py-1 rounded border border-slate-300 dark:border-terminal-border text-xs cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Bottom Toggle: Pattern on chart & Candles/Line */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-terminal-900 border border-slate-200 dark:border-terminal-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Pattern on chart</span>
            <button
              onClick={handlePatternToggle}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                patternOnChart ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-terminal-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  patternOnChart ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center p-0.5 rounded border border-slate-200 dark:border-terminal-border text-[10px] font-bold">
            {(['Candles', 'Line'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleChartModeChange(m)}
                className={`px-2 py-0.5 rounded ${
                  chartMode === m ? 'bg-white dark:bg-terminal-800 text-slate-900 dark:text-white' : 'text-slate-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
