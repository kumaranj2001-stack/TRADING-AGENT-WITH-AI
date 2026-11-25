'use client';

import React, { useMemo, useState } from 'react';
import {
  X,
  RotateCcw,
  Download,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { CurrencyPair } from '@/lib/types';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { ResearchReportSnapshot } from '@/lib/research/types';
import {
  computeLivePredictiveAnalytics,
  PredictiveCandleInput,
} from '@/lib/research/PredictiveAnalyticsEngine';

export interface QuantumVisionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  horizonCandles?: number;
  onChangeHorizon?: (h: number) => void;
  onViewChartMode?: (mode: 'Candles' | 'Line') => void;
  theme?: 'light' | 'dark';
  pair?: CurrencyPair | string;
  timeframe?: string;
  livePrice?: number;
  candles?: PredictiveCandleInput[];
  researchReport?: ResearchReportSnapshot | null;
}

export const QuantumVisionDrawer: React.FC<QuantumVisionDrawerProps> = ({
  isOpen,
  onClose,
  horizonCandles = 10,
  onChangeHorizon,
  onViewChartMode,
  theme = 'light',
  pair = 'XAU/USD',
  timeframe = '15m',
  livePrice: propLivePrice,
  candles = [],
  researchReport,
}) => {
  const isLight = theme === 'light';
  const [activeViewMode, setActiveViewMode] = useState<'Candles' | 'Line'>('Candles');
  const [simulationNonce, setSimulationNonce] = useState<number>(1);
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState<boolean>(false);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    comparison: false,
    mtf: false,
    sessions: false,
    distribution: false,
  });

  const activePrice =
    propLivePrice ||
    researchReport?.brief.pricing.currentPrice ||
    LiveMarketFeedManager.getCanonicalPrice(pair as CurrencyPair) ||
    liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair as CurrencyPair) ||
    100;

  const snapshot = useMemo(
    () =>
      computeLivePredictiveAnalytics({
        symbol: pair,
        timeframe,
        candles,
        livePrice: activePrice,
        horizonCandles,
        simulationNonce,
        researchReport,
      }),
    [pair, timeframe, candles, activePrice, horizonCandles, simulationNonce, researchReport]
  );

  if (!isOpen) return null;

  const { quantum, decimals, atr, atrPercent, rsi14 } = snapshot;
  const pricePrefix = pair.includes('NIFTY') || pair.includes('RELIANCE') || pair.includes('HDFC') || pair.includes('TCS') || pair.includes('INFY')
    ? '₹'
    : pair.includes('/') && !pair.includes('XAU') && !pair.includes('XAG') && !pair.includes('BTC')
    ? ''
    : '$';
  const fmt = (n: number) => `${pricePrefix}${n.toFixed(decimals)}`;

  const scenarioOptions = [
    {
      label: `Bullish breakout above ${fmt(quantum.keyResistance)} - ${quantum.touchOddsR1}% touch odds`,
      summary: `Paths closing or touching above ${fmt(quantum.keyResistance)} within ${horizonCandles} bars.`,
    },
    {
      label: `Support test at ${fmt(quantum.keySupport)} - ${quantum.touchOddsS1}% touch odds`,
      summary: `Paths probing liquidity below ${fmt(quantum.keySupport)} within ${horizonCandles} bars.`,
    },
    {
      label: `Equilibrium rotation (${fmt(quantum.rangeMin)} - ${fmt(quantum.rangeMax)})`,
      summary: `80% empirical path density band across ${horizonCandles} candles.`,
    },
  ];

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunAgain = () => {
    setSimulationNonce((prev) => prev + 1);
  };

  const handleReset = () => {
    setSimulationNonce(1);
    setSelectedScenarioIdx(0);
    if (onChangeHorizon) onChangeHorizon(10);
  };

  const handleExportCsv = () => {
    const now = Date.now();
    const stepMs =
      timeframe === '1m'
        ? 60_000
        : timeframe === '5m'
        ? 300_000
        : timeframe === '15m'
        ? 900_000
        : timeframe === '4h'
        ? 14_400_000
        : timeframe === '1d'
        ? 86_400_000
        : 3_600_000;
    let csvContent = 'data:text/csv;charset=utf-8,Step,Timestamp,Upper90Path,MedianPath,Lower10Path,BullishProbPct\n';
    for (let step = 1; step <= horizonCandles; step++) {
      const stepTime = new Date(now + step * stepMs).toISOString();
      const upper = (quantum.upperPath[step] ?? activePrice).toFixed(decimals);
      const median = (quantum.medianPath[step] ?? activePrice).toFixed(decimals);
      const lower = (quantum.lowerPath[step] ?? activePrice).toFixed(decimals);
      csvContent += `${step},${stepTime},${upper},${median},${lower},${quantum.bullishProb}\n`;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quantum_vision_${pair.replace('/', '_')}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Build SVG Monte Carlo fan coordinates
  const allBandValues = [...quantum.upperPath, ...quantum.lowerPath];
  const svgMin = Math.min(...allBandValues);
  const svgMax = Math.max(...allBandValues);
  const svgSpan = Math.max(1e-8, svgMax - svgMin);
  const mapX = (step: number) => (step / Math.max(1, horizonCandles)) * 280 + 8;
  const mapY = (price: number) => 66 - ((price - svgMin) / svgSpan) * 56;
  const toPolyline = (arr: number[]) => arr.map((v, idx) => `${mapX(idx).toFixed(1)},${mapY(v).toFixed(1)}`).join(' ');

  const accordionBody = (key: string): string => {
    if (key === 'comparison') {
      return `${scenarioOptions[selectedScenarioIdx]?.summary} Current Research Consensus: ${
        researchReport ? `${researchReport.grade} (${researchReport.compositeScore}/100)` : 'Live Candle Derived'
      }.`;
    }
    if (key === 'mtf') {
      return `Active TF ${timeframe.toUpperCase()} | EMA20=${fmt(snapshot.ema20)} vs EMA50=${fmt(snapshot.ema50)} | RSI-14=${rsi14}.`;
    }
    if (key === 'sessions') {
      return `Horizon spans ${horizonCandles} × ${timeframe} candles. Empirical ATR-14 is ${fmt(atr)} (${atrPercent}% per bar).`;
    }
    return `120 bootstrapped Monte Carlo paths around ${fmt(snapshot.livePrice)}. Touch odds: S1 (${fmt(quantum.keySupport)}) = ${quantum.touchOddsS1}% | R1 (${fmt(quantum.keyResistance)}) = ${quantum.touchOddsR1}%.`;
  };

  return (
    <div
      className={`absolute top-2 left-2 z-30 w-[94vw] sm:w-[335px] max-w-[345px] max-h-[calc(100%-20px)] overflow-y-auto rounded-xl border shadow-2xl backdrop-blur-md select-none transition-all ${
        isLight
          ? 'bg-white/95 border-slate-300 text-slate-800'
          : 'bg-terminal-950/95 border-terminal-border text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black tracking-wider uppercase">QUANTUM VISION</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              LIVE {pair} • {timeframe.toUpperCase()}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2.5 text-xs font-sans">
        {/* Top Control Buttons */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRunAgain}
              className="px-2.5 py-1 rounded bg-slate-900 text-white dark:bg-cyan-600 font-bold text-[11px] flex items-center gap-1 hover:opacity-90 shadow-sm cursor-pointer"
            >
              <span>Run again</span>
            </button>
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded border border-slate-300 dark:border-terminal-border text-slate-600 dark:text-slate-300 font-medium text-[11px] flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-terminal-900 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Line / Candles Toggle */}
          <div className="flex items-center p-0.5 rounded border border-slate-200 dark:border-terminal-border text-[10px] font-bold">
            {(['Line', 'Candles'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setActiveViewMode(mode);
                  if (onViewChartMode) onViewChartMode(mode);
                }}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeViewMode === mode
                    ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-white'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Live Monte Carlo Cone Sparkline */}
        <div className="p-2 rounded-lg border border-slate-200 dark:border-terminal-border bg-slate-50 dark:bg-terminal-900/50">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-slate-500">MC CONE (Run #{simulationNonce})</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400">
              {fmt(quantum.rangeMin)} – {fmt(quantum.rangeMax)}
            </span>
          </div>
          <svg viewBox="0 0 296 74" className="w-full h-[68px]">
            {quantum.paths.slice(0, 12).map((p, i) => (
              <polyline
                key={i}
                fill="none"
                stroke="rgba(56,189,248,0.22)"
                strokeWidth="1"
                points={toPolyline(p)}
              />
            ))}
            <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" points={toPolyline(quantum.upperPath)} />
            <polyline fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 2" points={toPolyline(quantum.lowerPath)} />
            <polyline fill="none" stroke="#0284c7" strokeWidth="2" points={toPolyline(quantum.medianPath)} />
          </svg>
        </div>

        {/* Horizon Selector & Export CSV */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">Horizon:</span>
            <select
              value={horizonCandles}
              onChange={(e) => onChangeHorizon && onChangeHorizon(Number(e.target.value))}
              className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-terminal-border font-bold bg-transparent focus:outline-none"
            >
              <option value={5} className="dark:bg-terminal-900">5 candles</option>
              <option value={10} className="dark:bg-terminal-900">10 candles</option>
              <option value={15} className="dark:bg-terminal-900">15 candles</option>
              <option value={20} className="dark:bg-terminal-900">20 candles</option>
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* How to use Accordion */}
        <div className="border border-slate-200 dark:border-terminal-border rounded-lg overflow-hidden">
          <button
            onClick={() => setIsHowToUseOpen(!isHowToUseOpen)}
            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-terminal-900/50 flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300"
          >
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-400" />
              How to use
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isHowToUseOpen ? 'rotate-180' : ''}`} />
          </button>
          {isHowToUseOpen && (
            <div className="p-2.5 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-terminal-border">
              Quantum Vision bootstraps empirical returns and ATR drift directly from live Chart.js candles and synchronizes S1/R1 levels with the Multi-Agent Research Engine.
            </div>
          )}
        </div>

        {/* Core Live Metrics Table */}
        <div className="space-y-1.5 pt-1 text-[11px] font-mono border-t border-slate-200 dark:border-terminal-border">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Market Bias:</span>
            <span
              className={`font-bold ${
                quantum.edgeType === 'BULLISH_EDGE'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : quantum.edgeType === 'BEARISH_EDGE'
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {quantum.biasLabel}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bullish Probability:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{quantum.bullishProb}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bearish Probability:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">{quantum.bearishProb}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Key Support (S1):</span>
            <span className="font-bold text-slate-900 dark:text-white">{fmt(quantum.keySupport)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Key Resistance (R1):</span>
            <span className="font-bold text-slate-900 dark:text-white">{fmt(quantum.keyResistance)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Breakout Trigger:</span>
            <span className="font-bold text-slate-900 dark:text-white">above {fmt(quantum.breakoutThreshold)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Rejection Zone:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {fmt(quantum.rejectionLow)} – {fmt(quantum.rejectionHigh)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500">Prediction Horizon:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {horizonCandles} × {timeframe}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Scenario Confidence:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400">{quantum.confidenceLabel}</span>
          </div>
        </div>

        {/* Scenario Selection Dropdown */}
        <div className="pt-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Scenario Focus</label>
          <select
            value={selectedScenarioIdx}
            onChange={(e) => setSelectedScenarioIdx(Number(e.target.value))}
            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-terminal-border text-xs font-bold bg-white dark:bg-terminal-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          >
            {scenarioOptions.map((opt, idx) => (
              <option key={idx} value={idx}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Collapsible Accordions */}
        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-terminal-border">
          {[
            { key: 'comparison', label: 'Scenario comparison' },
            { key: 'mtf', label: 'Multi-timeframe confluence' },
            { key: 'sessions', label: 'Volatility & horizon' },
            { key: 'distribution', label: 'Simulated distribution & touch odds' },
          ].map((acc) => (
            <div key={acc.key} className="border border-slate-200 dark:border-terminal-border rounded">
              <button
                onClick={() => toggleAccordion(acc.key)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-terminal-900"
              >
                <span>▶ {acc.label}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${openAccordions[acc.key] ? 'rotate-180' : ''}`}
                />
              </button>
              {openAccordions[acc.key] && (
                <div className="p-2 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-terminal-900/40 border-t border-slate-200 dark:border-terminal-border">
                  {accordionBody(acc.key)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
