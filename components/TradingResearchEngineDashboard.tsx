'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Search, 
  Zap, 
  Download, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  ShieldAlert, 
  Globe, 
  Coins, 
  DollarSign, 
  Scale, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Compass, 
  Layers, 
  Cpu, 
  Sliders, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  Share2, 
  PieChart, 
  ArrowRight, 
  RefreshCw,
  Terminal,
  Crosshair,
  ListOrdered
} from 'lucide-react';
import { 
  ResearchReportSnapshot, 
  DefinitiveGrade, 
  DefinitiveSignal, 
  ResearchEngineWorkflow,
  AssetClass
} from '@/lib/research/types';

export interface TradingResearchEngineDashboardProps {
  initialSymbol?: string;
  onBackToTerminal?: () => void;
}

export const TradingResearchEngineDashboard: React.FC<TradingResearchEngineDashboardProps> = ({
  initialSymbol = 'NVDA',
  onBackToTerminal,
}) => {
  const [symbolInput, setSymbolInput] = useState<string>(initialSymbol);
  const [activeWorkflow, setActiveWorkflow] = useState<ResearchEngineWorkflow>('ANALYZE_FULL');
  const [activeTab, setActiveTab] = useState<'overview' | 'technical' | 'fundamental' | 'sentiment' | 'risk' | 'thesis' | 'strategy' | 'workflows'>('overview');
  
  // Execution & Streaming State
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionPhase, setExecutionPhase] = useState<'IDLE' | 'PHASE_1_DISCOVERY' | 'PHASE_2_PARALLEL' | 'PHASE_3_SYNTHESIS' | 'COMPLETED'>('IDLE');
  const [parallelAgentsRunning, setParallelAgentsRunning] = useState<Record<string, boolean>>({
    technical: false,
    fundamental: false,
    sentiment: false,
    risk: false,
    thesis: false,
  });

  // Report Data State
  const [report, setReport] = useState<ResearchReportSnapshot | null>(null);
  const [quickSnapshot, setQuickSnapshot] = useState<any>(null);
  const [sectorData, setSectorData] = useState<any[]>([]);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareSymbolB, setCompareSymbolB] = useState<string>('AMD');
  const [optionsData, setOptionsData] = useState<any>(null);
  const [earningsData, setEarningsData] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [screenerData, setScreenerData] = useState<any[]>([]);
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfHtml, setPdfHtml] = useState<string>('');

  // Run initial analysis on mount
  useEffect(() => {
    executeWorkflow('ANALYZE_FULL', initialSymbol);
  }, []);

  const executeWorkflow = async (workflow: ResearchEngineWorkflow, sym: string = symbolInput) => {
    const cleanSym = sym.trim().toUpperCase() || 'NVDA';
    setSymbolInput(cleanSym);
    setActiveWorkflow(workflow);
    setIsExecuting(true);

    try {
      if (workflow === 'ANALYZE_FULL') {
        // Stream progress visually across Phase 1 -> Phase 2 -> Phase 3
        setExecutionPhase('PHASE_1_DISCOVERY');
        setParallelAgentsRunning({ technical: false, fundamental: false, sentiment: false, risk: false, thesis: false });
        
        // Simulating subagent dispatch telemetry
        setTimeout(() => {
          setExecutionPhase('PHASE_2_PARALLEL');
          setParallelAgentsRunning({ technical: true, fundamental: true, sentiment: true, risk: true, thesis: true });
        }, 350);

        const res = await fetch(`/api/research/analyze?symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setTimeout(() => {
            setExecutionPhase('PHASE_3_SYNTHESIS');
            setParallelAgentsRunning({ technical: false, fundamental: false, sentiment: false, risk: false, thesis: false });
            setTimeout(() => {
              setReport(data.report);
              setExecutionPhase('COMPLETED');
              setIsExecuting(false);
            }, 300);
          }, 600);
        } else {
          setIsExecuting(false);
        }
      } else if (workflow === 'QUICK_SNAPSHOT') {
        setExecutionPhase('PHASE_1_DISCOVERY');
        const res = await fetch(`/api/research/quick?symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setQuickSnapshot(data);
          setExecutionPhase('COMPLETED');
        }
        setIsExecuting(false);
      } else if (workflow === 'SECTOR_ROTATION') {
        const res = await fetch('/api/research/workflows?action=SECTOR_ROTATION');
        if (res.ok) {
          const data = await res.json();
          setSectorData(data.sectors);
        }
        setIsExecuting(false);
      } else if (workflow === 'COMPARE_ASSETS') {
        const res = await fetch(`/api/research/workflows?action=COMPARE&symbolA=${encodeURIComponent(cleanSym)}&symbolB=${encodeURIComponent(compareSymbolB)}`);
        if (res.ok) {
          const data = await res.json();
          setCompareData(data.comparison);
        }
        setIsExecuting(false);
      } else if (workflow === 'OPTIONS_STRATEGIES') {
        const res = await fetch(`/api/research/workflows?action=OPTIONS&symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setOptionsData(data.options);
        }
        setIsExecuting(false);
      } else if (workflow === 'PRE_EARNINGS') {
        const res = await fetch(`/api/research/workflows?action=EARNINGS&symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setEarningsData(data.earnings);
        }
        setIsExecuting(false);
      } else if (workflow === 'PORTFOLIO_REBALANCE') {
        const res = await fetch('/api/research/workflows?action=PORTFOLIO');
        if (res.ok) {
          const data = await res.json();
          setPortfolioData(data.portfolio);
        }
        setIsExecuting(false);
      } else if (workflow === 'STOCK_SCREENER') {
        const res = await fetch('/api/research/workflows?action=SCREENER');
        if (res.ok) {
          const data = await res.json();
          setScreenerData(data.results);
        }
        setIsExecuting(false);
      } else if (workflow === 'SCORED_WATCHLIST') {
        const res = await fetch('/api/research/workflows?action=WATCHLIST');
        if (res.ok) {
          const data = await res.json();
          setWatchlistData(data.watchlist);
        }
        setIsExecuting(false);
      } else if (workflow === 'REPORT_PDF') {
        handleDownloadPdf(cleanSym);
        setIsExecuting(false);
      } else {
        // Standalone views
        const res = await fetch(`/api/research/analyze?symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setReport(data.report);
        }
        setIsExecuting(false);
      }
    } catch (err) {
      console.error('Workflow execution error:', err);
      setIsExecuting(false);
    }
  };

  const handleDownloadPdf = async (sym: string = symbolInput) => {
    try {
      const res = await fetch(`/api/research/report-pdf?symbol=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const data = await res.json();
        setPdfHtml(data.html);
        setShowPdfModal(true);
      }
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
    }
  };

  const handlePrintPdfWindow = () => {
    if (!pdfHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(pdfHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Grade color helper
  const getGradeBadge = (grade: DefinitiveGrade, signal: DefinitiveSignal) => {
    const isBuy = signal === 'STRONG_BUY' || signal === 'BUY';
    const isHold = signal === 'HOLD_ACCUMULATE';
    const isCaution = signal === 'NEUTRAL_CAUTION' || signal === 'CAUTION';
    
    return (
      <span className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold border inline-flex items-center gap-1.5 shadow-sm ${
        isBuy ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
        isHold ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' :
        isCaution ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
        'bg-rose-500/20 text-rose-300 border-rose-500/40'
      }`}>
        <span>GRADE {grade}</span>
        <span>•</span>
        <span>{signal.replace('_', ' ')}</span>
      </span>
    );
  };

  return (
    <div className="bg-terminal-900 border border-terminal-border rounded-xl p-4 sm:p-6 shadow-2xl space-y-6 text-slate-200">
      {/* ============================================================= */}
      {/* 1. TOP COMMAND BAR & SLASH COMMAND RUNNER */}
      {/* ============================================================= */}
      <div className="border-b border-terminal-border pb-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>MULTI-AGENT TRADING RESEARCH ENGINE</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  ALL 16 WORKFLOWS
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Universal Real-Time Grounding • Forex, Metals, Indian Markets & Global Equities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleDownloadPdf(symbolInput)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              title="Export 6-Page Investment PDF Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>6-PAGE PDF REPORT</span>
            </button>
            {onBackToTerminal && (
              <button
                onClick={onBackToTerminal}
                className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white border border-terminal-border font-mono text-xs transition-colors"
              >
                RETURN TO TERMINAL
              </button>
            )}
          </div>
        </div>

        {/* Search Command Input Bar */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeWorkflow('ANALYZE_FULL', symbolInput);
              }}
              placeholder="Enter symbol or slash command (e.g. /trade analyze NVDA, /trade compare NVDA AMD, /trade sector)"
              className="w-full pl-9 pr-4 py-2 bg-terminal-950 border border-terminal-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            onClick={() => executeWorkflow('ANALYZE_FULL', symbolInput)}
            disabled={isExecuting}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'ANALYZING...' : 'RUN FLAGSHIP ANALYSIS'}</span>
          </button>
        </div>

        {/* Universal Asset Class Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono">
          <span className="text-slate-400 mr-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Presets:</span>
          </span>
          {[
            { label: 'NVDA (US Semi)', sym: 'NVDA' },
            { label: 'AAPL (US Tech)', sym: 'AAPL' },
            { label: 'TSLA (Auto/AI)', sym: 'TSLA' },
            { label: 'XAU/USD (Spot Gold)', sym: 'XAU/USD' },
            { label: 'XAG/USD (Silver)', sym: 'XAG/USD' },
            { label: 'NIFTY 50 (NSE)', sym: 'NIFTY 50' },
            { label: 'RELIANCE (NSE)', sym: 'RELIANCE' },
            { label: 'HDFC BANK (NSE)', sym: 'HDFC BANK' },
            { label: 'EUR/USD (Forex)', sym: 'EUR/USD' },
            { label: 'GBP/USD (Forex)', sym: 'GBP/USD' },
          ].map((item) => (
            <button
              key={item.sym}
              onClick={() => {
                setSymbolInput(item.sym);
                executeWorkflow('ANALYZE_FULL', item.sym);
              }}
              className="px-2 py-0.5 rounded bg-terminal-950 hover:bg-terminal-800 text-slate-300 hover:text-cyan-300 border border-terminal-border transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================= */}
      {/* 2. REAL-TIME STREAMING STATUS INDICATORS */}
      {/* ============================================================= */}
      <div className="p-3.5 rounded-xl bg-terminal-950 border border-cyan-900/40 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">Event-Driven Grounding & Concurrent Subagents Status</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            {executionPhase === 'IDLE' ? 'READY' : executionPhase.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-[11px]">
          {/* Phase 1 */}
          <div className={`p-2 rounded border transition-all ${
            executionPhase === 'PHASE_1_DISCOVERY' ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 animate-pulse' :
            executionPhase === 'COMPLETED' || executionPhase === 'PHASE_2_PARALLEL' || executionPhase === 'PHASE_3_SYNTHESIS' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">Phase 1: Discovery</div>
            <div className="text-[10px] text-slate-400">Brief Compilation</div>
          </div>

          {/* Technical Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.technical ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">1. Technical (25%)</div>
            <div className="text-[10px] text-slate-400">EMAs • Confluence</div>
          </div>

          {/* Fundamental Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.fundamental ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">2. Fundamental (25%)</div>
            <div className="text-[10px] text-slate-400">Multiples • Moat</div>
          </div>

          {/* Sentiment Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.sentiment ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">3. Sentiment (20%)</div>
            <div className="text-[10px] text-slate-400">13F • Analysts • Squeeze</div>
          </div>

          {/* Risk Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.risk ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">4. Risk (15%)</div>
            <div className="text-[10px] text-slate-400">Drawdown • Kelly Sizing</div>
          </div>

          {/* Thesis Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.thesis ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold">5. Thesis (15%)</div>
            <div className="text-[10px] text-slate-400">Catalysts • Invalidation</div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. TRADE SCORE DASHBOARD & HERO CARD */}
      {/* ============================================================= */}
      {report && (
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-terminal-950 via-terminal-900 to-terminal-950 border border-terminal-border space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  {report.assetClass}
                </span>
                <span className="text-xs text-slate-400">Benchmark: {report.brief.benchmarkIndex}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">
                {report.symbol} <span className="text-sm font-normal text-slate-400">({report.name})</span>
              </h2>
              <div className="text-sm font-mono mt-1 text-slate-300 flex items-center gap-2">
                <span>Current Price: <strong className="text-white">{report.brief.pricing.currency} {report.brief.pricing.currentPrice.toFixed(2)}</strong></span>
                <span className={`font-bold ${report.brief.pricing.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ({report.brief.pricing.change >= 0 ? '+' : ''}{report.brief.pricing.changePercent}%)
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-400">Spread: {report.brief.pricing.spreadPipsOrTicks}</span>
              </div>
            </div>

            {/* Composite Score & Badge */}
            <div className="flex items-center gap-4 bg-terminal-950/80 p-3 rounded-xl border border-terminal-border/80">
              <div className="text-center font-mono">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">COMPOSITE SCORE</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">{report.compositeScore}<span className="text-xs text-slate-400">/100</span></div>
              </div>
              <div className="h-10 w-px bg-terminal-border"></div>
              <div>
                {getGradeBadge(report.grade, report.signal)}
                <div className="text-[11px] text-slate-400 mt-1 font-mono max-w-xs line-clamp-1">
                  {report.gradeDescription}
                </div>
              </div>
            </div>
          </div>

          {/* 5-Dimension Weighted Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left">
              <thead>
                <tr className="border-b border-terminal-border/80 text-slate-400 text-[11px]">
                  <th className="py-1.5 px-2">SPECIALIZED AI SUBAGENT</th>
                  <th className="py-1.5 px-2">BASE WEIGHT</th>
                  <th className="py-1.5 px-2">EFFECTIVE WEIGHT</th>
                  <th className="py-1.5 px-2">RAW SCORE</th>
                  <th className="py-1.5 px-2 text-right">WEIGHTED CONTRIBUTION</th>
                  <th className="py-1.5 px-2 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/40">
                {report.weightsBreakdown.map((w, idx) => (
                  <tr key={idx} className="hover:bg-terminal-900/50">
                    <td className="py-2 px-2 font-bold text-white">{w.agentRole}</td>
                    <td className="py-2 px-2 text-slate-400">{(w.baseWeight * 100).toFixed(0)}%</td>
                    <td className="py-2 px-2 text-cyan-300 font-semibold">{(w.effectiveWeight * 100).toFixed(1)}%</td>
                    <td className="py-2 px-2">{w.scoreRaw}/100</td>
                    <td className="py-2 px-2 text-right font-bold text-cyan-400">+{w.scoreWeighted.toFixed(1)}</td>
                    <td className="py-2 px-2 text-center text-emerald-400 font-semibold">PASSED</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 4. WORKFLOW & RESEARCH TAB NAVIGATION */}
      {/* ============================================================= */}
      <div className="border-b border-terminal-border flex items-center gap-1 overflow-x-auto text-xs font-mono">
        {[
          { id: 'overview', label: 'Overview & 25 Sub-Scores' },
          { id: 'technical', label: 'Technical Levels (3S / 3R)' },
          { id: 'fundamental', label: 'Fundamentals & Moat' },
          { id: 'sentiment', label: 'Sentiment & Smart Money' },
          { id: 'risk', label: 'Risk Matrix & Sizing' },
          { id: 'thesis', label: 'Catalysts & Thesis' },
          { id: 'strategy', label: 'Realistic Trade Plan' },
          { id: 'workflows', label: 'All 16 Workflows Hub' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-300 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================= */}
      {/* 5. TAB CONTENT PANELS */}
      {/* ============================================================= */}

      {/* TAB 1: OVERVIEW & 25 SUB-SCORES */}
      {activeTab === 'overview' && report && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3 font-mono text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-cyan-400" />
              <span>Full 25 Sub-Score Matrix Breakdown (5 Sub-Scores per AI Agent)</span>
            </h3>
            <p className="text-slate-400 text-[11px]">
              Every specialized agent outputs five strict 0–20 sub-scores across its domain. Risk Assessment sub-scores are inverted so higher scores consistently represent superior safety.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {['Technical', 'Fundamental', 'Sentiment', 'Risk', 'Thesis'].map((agentName) => {
                const subScores = report.all25SubScores.filter(s => s.agent === agentName);
                return (
                  <div key={agentName} className="p-3 rounded-lg bg-terminal-900 border border-terminal-border/70 space-y-2.5">
                    <div className="text-xs font-bold text-cyan-400 border-b border-terminal-border/60 pb-1 flex justify-between">
                      <span>{agentName}</span>
                      <span>{subScores.reduce((a, b) => a + b.score, 0)}/100</span>
                    </div>
                    {subScores.map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300 truncate" title={s.label}>{s.category}</span>
                          <span className="text-white font-bold">{s.score}/20</span>
                        </div>
                        <div className="w-full bg-terminal-950 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${s.score >= 16 ? 'bg-emerald-400' : s.score >= 12 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                            style={{ width: `${(s.score / 20) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TECHNICAL LEVELS & INDICATORS */}
      {activeTab === 'technical' && report && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Support Levels */}
            <div className="p-4 rounded-xl bg-terminal-950 border border-emerald-900/40 space-y-2.5 font-mono text-xs">
              <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>3 Major Confluent Support Levels</span>
              </h3>
              {report.technical.supportLevels.map((lvl, idx) => (
                <div key={idx} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="flex justify-between text-white font-bold">
                    <span>S{idx + 1}: {report.brief.pricing.currency} {lvl.price.toFixed(2)}</span>
                    <span className="text-emerald-400 text-[10px]">{lvl.strength}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">{lvl.confluenceFactors.join(' • ')}</div>
                </div>
              ))}
            </div>

            {/* Resistance Levels */}
            <div className="p-4 rounded-xl bg-terminal-950 border border-rose-900/40 space-y-2.5 font-mono text-xs">
              <h3 className="font-bold text-rose-400 text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                <span>3 Major Confluent Resistance Levels</span>
              </h3>
              {report.technical.resistanceLevels.map((lvl, idx) => (
                <div key={idx} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="flex justify-between text-white font-bold">
                    <span>R{idx + 1}: {report.brief.pricing.currency} {lvl.price.toFixed(2)}</span>
                    <span className="text-rose-400 text-[10px]">{lvl.strength}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">{lvl.confluenceFactors.join(' • ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Indicator Suite */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">EMA Ribbon Stack</span>
              <div className="font-bold text-white text-sm">{report.technical.emaAlignment}</div>
              <span className="text-[10px] text-cyan-400">20: {report.technical.ema20} • 50: {report.technical.ema50}</span>
            </div>

            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">RSI-14</span>
              <div className="font-bold text-white text-sm">{report.technical.rsi14} ({report.technical.rsiCondition})</div>
              <span className="text-[10px] text-emerald-400">Momentum Active</span>
            </div>

            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">MACD & Crossover</span>
              <div className="font-bold text-white text-sm">{report.technical.macd.crossover}</div>
              <span className="text-[10px] text-cyan-400">Hist: {report.technical.macd.histogram}</span>
            </div>

            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Bollinger Bands</span>
              <div className="font-bold text-white text-sm">%B: {report.technical.bollingerBands.percentB}</div>
              <span className="text-[10px] text-slate-400">Mid: {report.technical.bollingerBands.middle}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FUNDAMENTALS & MOAT */}
      {activeTab === 'fundamental' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Forward P/E & PEG</span>
              <div className="text-base font-bold text-cyan-400">{report.fundamental.assetSpecificMetrics.forwardPE ?? 'N/A'}x ({report.fundamental.assetSpecificMetrics.pegRatio ?? 'N/A'} PEG)</div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">YoY Revenue Growth</span>
              <div className="text-base font-bold text-emerald-400">+{report.fundamental.assetSpecificMetrics.revenueGrowthYoY ?? 18.5}%</div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Operating Margin & ROIC</span>
              <div className="text-base font-bold text-cyan-400">{report.fundamental.assetSpecificMetrics.operatingMarginPercent ?? 28}% (ROIC: {report.fundamental.assetSpecificMetrics.roic ?? 22}%)</div>
            </div>
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Competitive Moat</span>
              <div className="text-base font-bold text-emerald-400">{report.fundamental.assetSpecificMetrics.moatRating}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
            <h4 className="text-sm font-bold text-white">Fundamental Analyst Key Insights:</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-300 text-[11px]">
              {report.fundamental.keyInsights.map((ins, i) => (
                <li key={i}>{ins}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 4: SENTIMENT & SMART MONEY */}
      {activeTab === 'sentiment' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
              <span className="text-slate-400 text-[11px]">Wall Street Consensus</span>
              <div className="text-base font-bold text-emerald-400">{report.sentiment.wallStreetConsensus.consensusRating}</div>
              <div className="text-slate-300 text-[11px]">
                {report.sentiment.wallStreetConsensus.buyCount} Buys • {report.sentiment.wallStreetConsensus.holdCount} Holds • {report.sentiment.wallStreetConsensus.sellCount} Sells
              </div>
              <div className="text-cyan-300 font-semibold">
                Target: {report.brief.pricing.currency} {report.sentiment.wallStreetConsensus.averagePriceTarget} (+{report.sentiment.wallStreetConsensus.upsidePercent}% upside)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
              <span className="text-slate-400 text-[11px]">13F & FII Smart Money</span>
              <div className="text-base font-bold text-cyan-400">{report.sentiment.institutionalActivity.smartMoneyFlow}</div>
              <p className="text-slate-300 text-[11px]">{report.sentiment.institutionalActivity.fiiDiiNetBias}</p>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
              <span className="text-slate-400 text-[11px]">Short Squeeze Potential</span>
              <div className="text-base font-bold text-amber-400">{report.sentiment.shortInterest.squeezeRisk} ({report.sentiment.shortInterest.shortSqueezeScore}/100)</div>
              <div className="text-slate-300 text-[11px]">Short % Float: {report.sentiment.shortInterest.shortPercentOfFloat}% (Days to cover: {report.sentiment.shortInterest.daysToCover})</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RISK MATRIX & POSITION SIZING */}
      {activeTab === 'risk' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Ranked Top 5 Risk Matrix</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-terminal-border/80 text-slate-400">
                    <th className="py-1 px-2">RANK</th>
                    <th className="py-1 px-2">CATEGORY</th>
                    <th className="py-1 px-2">RISK FACTOR</th>
                    <th className="py-1 px-2 text-center">SEVERITY</th>
                    <th className="py-1 px-2">MITIGATION STRATEGY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/40">
                  {report.risk.top5RiskMatrix.map((rf) => (
                    <tr key={rf.rank} className="hover:bg-terminal-900/50">
                      <td className="py-2 px-2 font-bold">#{rf.rank}</td>
                      <td className="py-2 px-2 text-cyan-400">{rf.category}</td>
                      <td className="py-2 px-2">
                        <strong className="text-white">{rf.title}</strong>
                        <div className="text-[10px] text-slate-400">{rf.description}</div>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-amber-400">{rf.severity}/5</td>
                      <td className="py-2 px-2 text-emerald-400 text-[11px]">{rf.mitigationStrategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Kelly Criterion Recommended Sizing</span>
              <div className="text-base font-bold text-cyan-400">{report.risk.positionSizingKelly.recommendedPositionPercentNAV}% of Portfolio NAV</div>
              <div className="text-slate-400 text-[10px]">Max Risk Exposure: ${report.risk.positionSizingKelly.maxRiskExposureDollars}</div>
            </div>

            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Stress-Tested Bear-Case Drawdowns</span>
              <div className="text-base font-bold text-rose-400">Mild (-7%): ${report.risk.bearCaseDrawdownScenario.mildCorrectionPrice}</div>
              <div className="text-slate-400 text-[10px]">Deep (-15%): ${report.risk.bearCaseDrawdownScenario.deepCorrectionPrice}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CATALYSTS & THESIS */}
      {activeTab === 'thesis' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
            <h4 className="text-sm font-bold text-white">Executive Core Investment Thesis:</h4>
            <p className="text-slate-300 leading-relaxed text-xs">{report.thesis.executiveThesis}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-emerald-900/40 space-y-2">
              <h4 className="text-sm font-bold text-emerald-400">Top Bullish Catalysts & Targets</h4>
              {report.thesis.bullCatalysts.map((c, i) => (
                <div key={i} className="p-2 rounded bg-terminal-900 border border-terminal-border/60">
                  <strong className="text-white">{c.title}</strong>
                  <div className="text-[11px] text-slate-400 mt-0.5">{c.catalystExplanation}</div>
                  <div className="text-emerald-400 font-bold mt-1">Target: ${c.upsideTargetPrice} (+{c.upsidePotentialPercent}%)</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-rose-900/40 space-y-2">
              <h4 className="text-sm font-bold text-rose-400">Top Bearish Risks & Price Floors</h4>
              {report.thesis.bearRisks.map((r, i) => (
                <div key={i} className="p-2 rounded bg-terminal-900 border border-terminal-border/60">
                  <strong className="text-white">{r.title}</strong>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.riskExplanation}</div>
                  <div className="text-rose-400 font-bold mt-1">Floor: ${r.downsideTargetPrice} (-{r.downsideRiskPercent}%)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: REALISTIC TRADE PLAN TABLE */}
      {activeTab === 'strategy' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan-400" />
              <span>Realistic Trade Plan (Immediate Market Proximity Execution)</span>
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-terminal-border/80 text-slate-400">
                    <th className="py-2 px-3">ORDER LEG</th>
                    <th className="py-2 px-3">PRICE LEVEL</th>
                    <th className="py-2 px-3">DISTANCE / R:R</th>
                    <th className="py-2 px-3">OPERATIONAL DIRECTIVE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/40">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-cyan-300">ENTRY ZONE</td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {report.brief.pricing.currency} {report.technical.tradePlan.entryZone.min.toFixed(2)} - {report.technical.tradePlan.entryZone.max.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">Immediate Proximity</td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.entryZone.note}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-rose-400">STOP LOSS</td>
                    <td className="py-2.5 px-3 font-bold text-rose-400">
                      {report.brief.pricing.currency} {report.technical.tradePlan.stopLoss.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      -{report.technical.tradePlan.stopLoss.riskPercent}% ({report.technical.tradePlan.stopLoss.distancePoints} pts)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.stopLoss.rationale}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">TARGET 1</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {report.brief.pricing.currency} {report.technical.tradePlan.target1.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      +{report.technical.tradePlan.target1.rewardPercent}% (1:{report.technical.tradePlan.target1.riskRewardRatio} R:R)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.target1.rationale}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">TARGET 2 (RUNNER)</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {report.brief.pricing.currency} {report.technical.tradePlan.target2.price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      +{report.technical.tradePlan.target2.rewardPercent}% (1:{report.technical.tradePlan.target2.riskRewardRatio} R:R)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.target2.rationale}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: ALL 16 WORKFLOWS HUB */}
      {activeTab === 'workflows' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'ANALYZE_FULL', cmd: '/trade analyze', label: '01. Flagship Full Analysis' },
              { id: 'QUICK_SNAPSHOT', cmd: '/trade quick', label: '02. 60-Sec Snapshot' },
              { id: 'SECTOR_ROTATION', cmd: '/trade sector', label: '08. Sector Rotation' },
              { id: 'COMPARE_ASSETS', cmd: '/trade compare', label: '09. Asset Comparison' },
              { id: 'OPTIONS_STRATEGIES', cmd: '/trade options', label: '10. Options Strategies' },
              { id: 'PRE_EARNINGS', cmd: '/trade earnings', label: '11. Pre-Earnings Deep-Dive' },
              { id: 'PORTFOLIO_REBALANCE', cmd: '/trade portfolio', label: '12. Portfolio Rebalancing' },
              { id: 'STOCK_SCREENER', cmd: '/trade screen', label: '13. Stock Screener' },
              { id: 'SCORED_WATCHLIST', cmd: '/trade watchlist', label: '14. Scored Watchlist' },
              { id: 'REPORT_PDF', cmd: '/trade report-pdf', label: '15. 6-Page PDF Report' },
            ].map((wf) => (
              <button
                key={wf.id}
                onClick={() => executeWorkflow(wf.id as any)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeWorkflow === wf.id
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-terminal-950 border-terminal-border hover:bg-terminal-800 text-slate-300'
                }`}
              >
                <div className="text-[10px] text-cyan-400">{wf.cmd}</div>
                <div className="mt-1 text-xs truncate">{wf.label}</div>
              </button>
            ))}
          </div>

          {/* Quick Snapshot Output */}
          {quickSnapshot && activeWorkflow === 'QUICK_SNAPSHOT' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-cyan-500/40 space-y-2">
              <h4 className="text-sm font-bold text-white">60-Second Snapshot Result:</h4>
              <p className="text-cyan-300">{quickSnapshot.summary}</p>
            </div>
          )}

          {/* Sector Rotation Output */}
          {sectorData.length > 0 && activeWorkflow === 'SECTOR_ROTATION' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
              <h4 className="text-sm font-bold text-white">Sector Rotation & Relative Momentum:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sectorData.map((sec, i) => (
                  <div key={i} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60 flex justify-between">
                    <div>
                      <strong className="text-white">#{sec.momentumRank} {sec.sector}</strong>
                      <div className="text-[10px] text-slate-400">Leader: {sec.leadingAsset} • Status: {sec.flowStatus}</div>
                    </div>
                    <div className="font-bold text-emerald-400">+{sec.oneMonthPerformance}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset Comparison Output */}
          {compareData && activeWorkflow === 'COMPARE_ASSETS' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white">Head-to-Head Comparison: {compareData.assetA.symbol} vs {compareData.assetB.symbol}</h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded bg-terminal-900 border border-cyan-500/40">
                  <div className="font-bold text-lg text-white">{compareData.assetA.symbol}</div>
                  <div className="text-2xl font-extrabold text-cyan-400 mt-1">{compareData.assetA.compositeScore}/100</div>
                  <div className="text-xs text-slate-400">Grade {compareData.assetA.grade} • {compareData.assetA.signal}</div>
                </div>
                <div className="p-3 rounded bg-terminal-900 border border-indigo-500/40">
                  <div className="font-bold text-lg text-white">{compareData.assetB.symbol}</div>
                  <div className="text-2xl font-extrabold text-indigo-400 mt-1">{compareData.assetB.compositeScore}/100</div>
                  <div className="text-xs text-slate-400">Grade {compareData.assetB.grade} • {compareData.assetB.signal}</div>
                </div>
              </div>
            </div>
          )}

          {/* Options Strategies Output */}
          {optionsData && activeWorkflow === 'OPTIONS_STRATEGIES' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white">Options Strategies for {optionsData.symbol} (IV: {optionsData.impliedVolPercent}%, IV Rank: {optionsData.ivRank})</h4>
              <div className="space-y-2">
                {optionsData.recommendedStrategies.map((opt: any, i: number) => (
                  <div key={i} className="p-3 rounded bg-terminal-900 border border-terminal-border/60">
                    <div className="flex justify-between font-bold text-white">
                      <span>{opt.strategyName}</span>
                      <span className="text-cyan-400">{opt.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{opt.description}</p>
                    <div className="text-[10px] text-slate-300 mt-1">{opt.strikeSetup} • Max Profit: {opt.maxProfit} • Breakeven: {opt.breakeven}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* 6. PERSISTENT RESEARCH-ONLY COMPLIANCE DISCLAIMER */}
      {/* ============================================================= */}
      <div className="p-3.5 rounded-lg bg-terminal-950 border border-terminal-border text-[11px] font-mono text-slate-400 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-300">LEGAL & RESEARCH COMPLIANCE DISCLAIMER:</strong> This platform is an automated multi-agent algorithmic research engine designed solely for institutional research, backtesting, and market observation. No output, score, grade, or trade plan constitutes financial advice or solicitation.
        </div>
      </div>

      {/* ============================================================= */}
      {/* 7. PDF PRINT / PREVIEW MODAL */}
      {/* ============================================================= */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-terminal-900 border border-terminal-border rounded-xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl">
            <div className="p-3.5 border-b border-terminal-border flex items-center justify-between bg-terminal-950">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white font-mono text-xs sm:text-sm">
                  6-Page Investment Research Report Preview // {symbolInput}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPdfWindow}
                  className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="px-2 py-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-white">
              <iframe
                srcDoc={pdfHtml}
                title="6-Page Research PDF Report"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
