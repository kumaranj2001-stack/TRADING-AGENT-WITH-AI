'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ListOrdered,
  Calendar,
  Clock,
  Eye,
  SlidersHorizontal,
  Bookmark,
  Shuffle,
  MessageSquare,
  Radio
} from 'lucide-react';
import { 
  ResearchReportSnapshot, 
  DefinitiveGrade, 
  DefinitiveSignal, 
  ResearchEngineWorkflow,
  AssetClass,
  ChartLiveContext
} from '@/lib/research/types';
import { workflowEngine, SectorRotationItem, OptionsStrategySetup, PreEarningsAnalysis, StockScreenerResultItem } from '@/lib/research/WorkflowEngine';
import { formatAssetPrice, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';
import { ChartJsResearchChart } from './research/ChartJsResearchChart';
import { CommunityLiveChatFeed } from './research/CommunityLiveChatFeed';

export interface TradingResearchEngineDashboardProps {
  initialSymbol?: string;
  onBackToTerminal?: () => void;
  onSymbolChange?: (symbol: string) => void;
}

export type DashboardTab = 
  | 'overview' 
  | 'technical' 
  | 'fundamental' 
  | 'sentiment' 
  | 'risk' 
  | 'catalyst' 
  | 'bull-bear' 
  | 'strategy' 
  | 'workflows';

export const TradingResearchEngineDashboard: React.FC<TradingResearchEngineDashboardProps> = ({
  initialSymbol = 'NVDA',
  onBackToTerminal,
  onSymbolChange,
}) => {
  const initialCanonical = liveChartTelemetryService.resolveSymbol(initialSymbol).symbol;
  const [activeSymbol, setActiveSymbol] = useState<string>(initialCanonical);
  const [symbolInput, setSymbolInput] = useState<string>(initialCanonical);
  const [activeTimeframe, setActiveTimeframe] = useState<string>('1h');
  const [activeChartTelemetry, setActiveChartTelemetry] = useState<ChartLiveContext | null>(null);
  const activeChartTelemetryRef = useRef<ChartLiveContext | null>(null);
  const [autoSyncAnalyze, setAutoSyncAnalyze] = useState<boolean>(true);
  const lastAutoTriggeredKeyRef = useRef<string>('');

  const [activeWorkflow, setActiveWorkflow] = useState<ResearchEngineWorkflow>('ANALYZE_FULL');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  
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
  const [sectorData, setSectorData] = useState<SectorRotationItem[]>([]);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareSymbolA, setCompareSymbolA] = useState<string>('NVDA');
  const [compareSymbolB, setCompareSymbolB] = useState<string>('AMD');
  const [optionsData, setOptionsData] = useState<any>(null);
  const [earningsData, setEarningsData] = useState<PreEarningsAnalysis | null>(null);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [screenerData, setScreenerData] = useState<StockScreenerResultItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<any[]>([]);
  const [standaloneAgentData, setStandaloneAgentData] = useState<any>(null);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfHtml, setPdfHtml] = useState<string>('');

  // Run initial analysis on mount
  useEffect(() => {
    executeWorkflow('ANALYZE_FULL', initialCanonical);
  }, []);

  // Bidirectional sync if parent prop initialSymbol changes (e.g. from global Header pair switcher)
  useEffect(() => {
    const nextCanonical = liveChartTelemetryService.resolveSymbol(initialSymbol).symbol;
    if (nextCanonical && nextCanonical !== activeSymbol) {
      setActiveSymbol(nextCanonical);
      setSymbolInput(nextCanonical);
      executeWorkflow('ANALYZE_FULL', nextCanonical);
    }
  }, [initialSymbol]);

  const syncCommandInputWithSymbol = (nextSym: string) => {
    const trimmed = symbolInput.trim();
    if (trimmed.startsWith('/')) {
      const parsed = workflowEngine.parseSlashCommand(trimmed);
      const parts = trimmed.split(/\s+/);
      if (parts[0].toLowerCase() === '/trade' && parts.length >= 2) {
        setSymbolInput(`/trade ${parts[1]} ${nextSym}`);
        return;
      }
      setSymbolInput(`/${parsed.parsedWorkflow.toLowerCase()} ${nextSym}`);
    } else {
      setSymbolInput(nextSym);
    }
  };

  const handleChartTelemetryUpdate = useCallback((telemetry: ChartLiveContext) => {
    setActiveChartTelemetry(telemetry);
    activeChartTelemetryRef.current = telemetry;
  }, []);

  const handleChartSymbolChange = useCallback(
    (newSym: string, telemetry?: ChartLiveContext) => {
      const nextCanonical = liveChartTelemetryService.resolveSymbol(newSym).symbol;
      setActiveSymbol(nextCanonical);
      syncCommandInputWithSymbol(nextCanonical);
      if (telemetry) {
        setActiveChartTelemetry(telemetry);
        activeChartTelemetryRef.current = telemetry;
      }
      onSymbolChange?.(nextCanonical);

      // Deduplicate between immediate click notification and telemetry-arrival notification
      const triggerKey = `${nextCanonical}_${activeTimeframe}`;
      if (autoSyncAnalyze && (telemetry || lastAutoTriggeredKeyRef.current !== triggerKey)) {
        lastAutoTriggeredKeyRef.current = triggerKey;
        const targetWorkflow =
          activeWorkflow === 'REPORT_PDF' || activeWorkflow === 'COMPARE_ASSETS'
            ? 'ANALYZE_FULL'
            : activeWorkflow;
        executeWorkflow(targetWorkflow, nextCanonical, compareSymbolB, telemetry, activeTimeframe);
      }
    },
    [activeTimeframe, activeWorkflow, autoSyncAnalyze, compareSymbolB, onSymbolChange, symbolInput]
  );

  const handleChartTimeframeChange = useCallback(
    (newTf: string, telemetry?: ChartLiveContext) => {
      setActiveTimeframe(newTf);
      if (telemetry) {
        setActiveChartTelemetry(telemetry);
        activeChartTelemetryRef.current = telemetry;
        if (autoSyncAnalyze) {
          const targetWorkflow =
            activeWorkflow === 'REPORT_PDF' ? 'ANALYZE_FULL' : activeWorkflow;
          executeWorkflow(targetWorkflow, activeSymbol, compareSymbolB, telemetry, newTf);
        }
      }
    },
    [activeSymbol, activeWorkflow, autoSyncAnalyze, compareSymbolB]
  );

  const handleCommandSubmit = (cmdText: string) => {
    const effectiveInput = cmdText.trim() || activeSymbol;
    const parsed = workflowEngine.parseSlashCommand(effectiveInput);
    const resolvedTarget = liveChartTelemetryService.resolveSymbol(
      parsed.primarySymbol || activeSymbol
    ).symbol;
    setActiveSymbol(resolvedTarget);
    setSymbolInput(effectiveInput.startsWith('/') ? effectiveInput : resolvedTarget);
    if (parsed.secondarySymbol) {
      setCompareSymbolB(parsed.secondarySymbol);
    }
    onSymbolChange?.(resolvedTarget);
    executeWorkflow(parsed.parsedWorkflow, resolvedTarget, parsed.secondarySymbol);
  };

  const executeWorkflow = async (
    workflow: ResearchEngineWorkflow, 
    sym: string = activeSymbol, 
    symB: string = compareSymbolB,
    explicitTelemetry?: ChartLiveContext,
    tfOverride?: string
  ) => {
    const cleanSym = liveChartTelemetryService.resolveSymbol(sym || activeSymbol).symbol;
    const targetTf = tfOverride || activeTimeframe;
    setActiveSymbol(cleanSym);
    setActiveWorkflow(workflow);
    setIsExecuting(true);

    // Match explicit telemetry or currently captured active chart telemetry if symbols match
    const candidateTelemetry = explicitTelemetry || activeChartTelemetryRef.current;
    const matchingTelemetry =
      candidateTelemetry &&
      liveChartTelemetryService.resolveSymbol(candidateTelemetry.symbol).symbol === cleanSym
        ? candidateTelemetry
        : undefined;

    try {
      if (workflow === 'ANALYZE_FULL') {
        setExecutionPhase('PHASE_1_DISCOVERY');
        setParallelAgentsRunning({ technical: false, fundamental: false, sentiment: false, risk: false, thesis: false });
        
        setTimeout(() => {
          setExecutionPhase('PHASE_2_PARALLEL');
          setParallelAgentsRunning(p => ({ ...p, technical: true }));
        }, 150);
        setTimeout(() => {
          setParallelAgentsRunning(p => ({ ...p, fundamental: true }));
        }, 300);
        setTimeout(() => {
          setParallelAgentsRunning(p => ({ ...p, sentiment: true }));
        }, 450);
        setTimeout(() => {
          setParallelAgentsRunning(p => ({ ...p, risk: true }));
        }, 600);
        setTimeout(() => {
          setParallelAgentsRunning(p => ({ ...p, thesis: true }));
        }, 750);

        const res = await fetch('/api/research/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: cleanSym,
            timeframe: targetTf,
            chartContext: matchingTelemetry,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setTimeout(() => {
            setExecutionPhase('PHASE_3_SYNTHESIS');
            setParallelAgentsRunning({ technical: false, fundamental: false, sentiment: false, risk: false, thesis: false });
            setTimeout(() => {
              setReport(data.report);
              if (data.report?.brief?.chartContext) {
                setActiveChartTelemetry(data.report.brief.chartContext);
                activeChartTelemetryRef.current = data.report.brief.chartContext;
              }
              setExecutionPhase('COMPLETED');
              setIsExecuting(false);
            }, 250);
          }, 800);
        } else {
          setIsExecuting(false);
        }
      } else if (workflow === 'QUICK_SNAPSHOT') {
        setExecutionPhase('PHASE_1_DISCOVERY');
        const res = await fetch('/api/research/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: cleanSym,
            timeframe: targetTf,
            chartContext: matchingTelemetry,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setQuickSnapshot(data);
          setExecutionPhase('COMPLETED');
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'SECTOR_ROTATION') {
        const res = await fetch('/api/research/workflows?action=SECTOR_ROTATION');
        if (res.ok) {
          const data = await res.json();
          setSectorData(data.sectors);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'COMPARE_ASSETS') {
        setCompareSymbolA(cleanSym);
        setCompareSymbolB(symB);
        const res = await fetch(`/api/research/workflows?action=COMPARE&symbolA=${encodeURIComponent(cleanSym)}&symbolB=${encodeURIComponent(symB)}`);
        if (res.ok) {
          const data = await res.json();
          setCompareData(data.comparison);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'OPTIONS_STRATEGIES') {
        const res = await fetch('/api/research/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'OPTIONS', symbol: cleanSym, timeframe: targetTf, chartContext: matchingTelemetry }),
        });
        if (res.ok) {
          const data = await res.json();
          setOptionsData(data.options);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'PRE_EARNINGS') {
        const res = await fetch(`/api/research/workflows?action=EARNINGS&symbol=${encodeURIComponent(cleanSym)}`);
        if (res.ok) {
          const data = await res.json();
          setEarningsData(data.earnings);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'PORTFOLIO_REBALANCE') {
        const res = await fetch('/api/research/workflows?action=PORTFOLIO');
        if (res.ok) {
          const data = await res.json();
          setPortfolioData(data.portfolio);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'STOCK_SCREENER') {
        const res = await fetch('/api/research/workflows?action=SCREENER');
        if (res.ok) {
          const data = await res.json();
          setScreenerData(data.results);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'SCORED_WATCHLIST') {
        const res = await fetch('/api/research/workflows?action=WATCHLIST');
        if (res.ok) {
          const data = await res.json();
          setWatchlistData(data.watchlist);
          setActiveTab('workflows');
        }
        setIsExecuting(false);
      } else if (workflow === 'REPORT_PDF') {
        await handleDownloadPdf(cleanSym);
        setIsExecuting(false);
      } else if (
        workflow === 'STANDALONE_TECH' ||
        workflow === 'STANDALONE_FUND' ||
        workflow === 'STANDALONE_SENT' ||
        workflow === 'STANDALONE_RISK' ||
        workflow === 'STANDALONE_THESIS'
      ) {
        const tabMap: Record<string, DashboardTab> = {
          STANDALONE_TECH: 'technical',
          STANDALONE_FUND: 'fundamental',
          STANDALONE_SENT: 'sentiment',
          STANDALONE_RISK: 'risk',
          STANDALONE_THESIS: 'catalyst',
        };
        const res = await fetch('/api/research/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: workflow,
            symbol: cleanSym,
            timeframe: targetTf,
            chartContext: matchingTelemetry,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setStandaloneAgentData(data);
          setActiveTab(tabMap[workflow]);
        }
        setIsExecuting(false);
      } else {
        const res = await fetch('/api/research/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: cleanSym,
            timeframe: targetTf,
            chartContext: matchingTelemetry,
          }),
        });
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

  const handleDownloadPdf = async (sym: string = activeSymbol) => {
    try {
      const targetSym = sym.trim().startsWith('/')
        ? workflowEngine.parseSlashCommand(sym).primarySymbol
        : liveChartTelemetryService.resolveSymbol(sym || activeSymbol).symbol;
      const candidate = activeChartTelemetryRef.current;
      const matchingTelemetry =
        candidate &&
        liveChartTelemetryService.resolveSymbol(candidate.symbol).symbol === targetSym
          ? candidate
          : undefined;

      const res = await fetch('/api/research/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSym,
          timeframe: activeTimeframe,
          chartContext: matchingTelemetry,
        }),
      });
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

  // SVG Speedometer Gauge Angle Calculation
  // 0 -> -90 deg, 100 -> +90 deg
  const scoreAngle = report ? (report.compositeScore / 100) * 180 - 90 : 0;
  const gradeGaugeColor = 
    report?.grade === 'A+' ? '#10b981' :
    report?.grade === 'A' ? '#059669' :
    report?.grade === 'B' ? '#3b82f6' :
    report?.grade === 'C' ? '#f59e0b' :
    report?.grade === 'D' ? '#f97316' : '#ef4444';

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
                Chart.js Open Streaming Engine • High-Frequency WS + Modular Vision Atlas Plugins • 5 Sequential Subagents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleDownloadPdf(activeSymbol)}
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
                if (e.key === 'Enter') handleCommandSubmit(symbolInput);
              }}
              placeholder="Enter symbol or slash command (e.g. /trade analyze NVDA, /trade compare NVDA AMD, /trade quick XAU/USD, /trade sector)"
              className="w-full pl-9 pr-4 py-2 bg-terminal-950 border border-terminal-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setAutoSyncAnalyze(!autoSyncAnalyze)}
            className={`px-3 py-2 rounded-lg border font-mono text-[11px] font-semibold transition-colors whitespace-nowrap ${
              autoSyncAnalyze
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-terminal-950 border-terminal-border text-slate-400 hover:text-slate-200'
            }`}
            title="Automatically run 5-stage analysis whenever the chart symbol or timeframe changes"
          >
            {autoSyncAnalyze ? 'AUTO-SYNC: ON' : 'AUTO-SYNC: OFF'}
          </button>
          <button
            onClick={() => handleCommandSubmit(symbolInput)}
            disabled={isExecuting}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'EXECUTING...' : 'RUN COMMAND / WORKFLOW'}</span>
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
            { label: 'WTI_CRUDE (Oil)', sym: 'WTI_CRUDE' },
            { label: 'NIFTY 50 (NSE)', sym: 'NIFTY 50' },
            { label: 'BANK NIFTY (NSE)', sym: 'BANK NIFTY' },
            { label: 'RELIANCE (NSE)', sym: 'RELIANCE' },
            { label: 'HDFC BANK (NSE)', sym: 'HDFC BANK' },
            { label: 'EUR/USD (Forex)', sym: 'EUR/USD' },
            { label: 'GBP/USD (Forex)', sym: 'GBP/USD' },
            { label: 'USD/JPY (Forex)', sym: 'USD/JPY' },
          ].map((item) => {
            const isActivePreset = activeSymbol.toUpperCase() === item.sym.toUpperCase();
            return (
              <button
                key={item.sym}
                onClick={() => {
                  setActiveSymbol(item.sym);
                  setSymbolInput(item.sym);
                  onSymbolChange?.(item.sym);
                  executeWorkflow('ANALYZE_FULL', item.sym);
                }}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  isActivePreset
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-terminal-950 hover:bg-terminal-800 text-slate-300 hover:text-cyan-300 border-terminal-border'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================= */}
      {/* 2. REAL-TIME CHART.JS OPEN STREAMING CHART & COMMUNITY CHAT FEED */}
      {/* ============================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left: Unrestricted Chart.js Financial Canvas with Vision Atlas Plugin Overlay */}
        <div className="xl:col-span-7 h-[520px] bg-terminal-950 border border-terminal-border rounded-xl overflow-hidden shadow-lg">
          <ChartJsResearchChart
            symbol={activeSymbol}
            timeframe={activeTimeframe}
            theme="dark"
            height={520}
            executionLevels={
              report && report.symbol === activeSymbol
                ? {
                    entryMin: report.technical.tradePlan.entryZone.min,
                    entryMax: report.technical.tradePlan.entryZone.max,
                    stopLoss: report.technical.tradePlan.stopLoss.price,
                    takeProfit1: report.technical.tradePlan.target1.price,
                    takeProfit2: report.technical.tradePlan.target2.price,
                    bias:
                      report.technical.trendDirection.includes('BULLISH')
                        ? 'BUY'
                        : report.technical.trendDirection.includes('BEARISH')
                        ? 'SELL'
                        : 'NEUTRAL',
                  }
                : undefined
            }
            allowIndicatorsCustomization={true}
            onSymbolChange={handleChartSymbolChange}
            onTimeframeChange={handleChartTimeframeChange}
            onChartTelemetryUpdate={handleChartTelemetryUpdate}
          />
        </div>

        {/* Right: Real-Time QuriTrader Community Live Chat Feed */}
        <div className="xl:col-span-5 h-[520px]">
          <CommunityLiveChatFeed
            activeSymbol={activeSymbol}
            onSelectSymbol={(sym) => {
              setActiveSymbol(sym);
              setSymbolInput(sym);
              onSymbolChange?.(sym);
              executeWorkflow('ANALYZE_FULL', sym);
            }}
            onTriggerAnalysis={(sym) => {
              executeWorkflow('ANALYZE_FULL', sym);
            }}
            isAnalyzing={isExecuting}
          />
        </div>
      </div>

      {/* ============================================================= */}
      {/* 3. REAL-TIME STREAMING STATUS INDICATORS */}
      {/* ============================================================= */}
      <div className="p-3.5 rounded-xl bg-terminal-950 border border-cyan-900/40 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold text-white">Community Live Chat Ingestion & Sequential 5-Stage Subagents Pipeline</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            {executionPhase === 'IDLE' ? 'READY' : executionPhase.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-[11px]">
          {/* Phase 1 */}
          <div className={`p-2 rounded border transition-all ${
            executionPhase === 'PHASE_1_DISCOVERY' ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 animate-pulse' :
            executionPhase === 'COMPLETED' || executionPhase === 'PHASE_2_PARALLEL' || executionPhase === 'PHASE_3_SYNTHESIS' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>Phase 1: Chat Ingest</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Transcript Buffering</div>
          </div>

          {/* Technical Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.technical ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>1. Technical (25%)</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Chat Patterns • S/R</div>
          </div>

          {/* Fundamental Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.fundamental ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>2. Fundamental (25%)</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Multiples • Moat Discourse</div>
          </div>

          {/* Sentiment Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.sentiment ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>3. Sentiment (20%)</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Crowd Buzz • Squeeze</div>
          </div>

          {/* Risk Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.risk ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>4. Risk (15%)</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Drawdown & Warnings</div>
          </div>

          {/* Thesis Worker */}
          <div className={`p-2 rounded border transition-all ${
            parallelAgentsRunning.thesis ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 animate-pulse' :
            executionPhase === 'COMPLETED' ? 'bg-terminal-900 border-emerald-500/40 text-emerald-400' :
            'bg-terminal-900 border-terminal-border/60 text-slate-400'
          }`}>
            <div className="font-bold flex items-center justify-between">
              <span>5. Thesis (15%)</span>
              {executionPhase === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
            <div className="text-[10px] text-slate-400">Chat Thesis & Invalidation</div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 4. TRADE SCORE DASHBOARD & HERO CARD */}
      {/* ============================================================= */}
      {report && (
        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-terminal-950 via-terminal-900 to-terminal-950 border border-terminal-border space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Left: Asset Details */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-mono flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                  {report.assetClass}
                </span>
                <span className="text-xs text-slate-400">
                  Synced Chart ({report.brief.chartContext?.timeframe?.toUpperCase() || activeTimeframe.toUpperCase()}) + Community Live Chat
                </span>
                <span className="text-xs text-slate-400">• Consensus: {report.brief.chatTranscript?.consensusStrengthPercent ?? 82}% {report.brief.chatTranscript?.consensusSentiment ?? 'BULLISH'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-mono">
                {report.symbol} <span className="text-sm font-normal text-slate-400">({report.name})</span>
              </h2>
              <div className="text-sm font-mono text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Live Chart Price: <strong className="text-white">{report.brief.pricing.currency} {formatAssetPrice(report.brief.pricing.currentPrice, report.assetClass, report.symbol)}</strong></span>
                <span className={`font-bold ${report.brief.pricing.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ({report.brief.pricing.change >= 0 ? '+' : ''}{report.brief.pricing.changePercent}%)
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-cyan-400">RSI-14: {report.technical.rsi14} • ATR: {formatAssetPrice(report.brief.volatility.atr14, report.assetClass, report.symbol)}</span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-emerald-400">Chat Room: {report.brief.chatTranscript?.tickerTag || `$${report.symbol}`} ({report.brief.chatTranscript?.totalMessages ?? 5} msgs)</span>
              </div>
            </div>

            {/* Right: SVG Semi-Circular Score Gauge */}
            <div className="flex items-center gap-4 bg-terminal-950/90 p-3 rounded-xl border border-terminal-border shrink-0">
              <div className="relative w-32 h-20 flex flex-col items-center justify-end">
                {/* SVG Semi-Circle Speedometer */}
                <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
                  {/* Background Arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Colored Progress Arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke={gradeGaugeColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="126"
                    strokeDashoffset={`${126 - (report.compositeScore / 100) * 126}`}
                  />
                  {/* Needle */}
                  <g transform={`translate(50, 50) rotate(${scoreAngle})`}>
                    <line x1="0" y1="0" x2="0" y2="-36" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
                  </g>
                </svg>
                <div className="absolute bottom-0 text-center font-mono">
                  <div className="text-lg font-black text-white leading-none">{report.compositeScore}</div>
                  <div className="text-[9px] text-slate-400 uppercase leading-none mt-0.5">SCORE / 100</div>
                </div>
              </div>

              <div className="space-y-1">
                {getGradeBadge(report.grade, report.signal)}
                <div className="text-[11px] text-slate-400 font-mono max-w-xs leading-snug">
                  {report.gradeDescription}
                </div>
              </div>
            </div>
          </div>

          {/* 5-Dimension Weighted Table */}
          <div className="overflow-x-auto pt-2">
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
      <div className="border-b border-terminal-border flex items-center gap-1 overflow-x-auto text-xs font-mono pb-1">
        {[
          { id: 'overview', label: '01. Overview & 25 Sub-Scores' },
          { id: 'technical', label: '02. Technical Levels (3S / 3R)' },
          { id: 'fundamental', label: '03. Fundamentals & Moat' },
          { id: 'sentiment', label: '04. Sentiment & Smart Money' },
          { id: 'risk', label: '05. Risk Matrix & Position Sizing' },
          { id: 'catalyst', label: '06. Catalyst Timeline' },
          { id: 'bull-bear', label: '07. Bull vs. Bear Cards' },
          { id: 'strategy', label: '08. Entry/Exit Strategy Table' },
          { id: 'workflows', label: '09. All 16 Workflows Hub' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-300 font-bold bg-terminal-950/50'
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
              <span>Full 25 Sub-Score Matrix Breakdown (5 Sub-Scores per AI Subagent)</span>
            </h3>
            <p className="text-slate-400 text-[11px]">
              Every specialized agent returns five strict 0–20 sub-scores within operational boundaries. Risk Assessment sub-scores are inverted where higher score equals lower risk / superior capital protection.
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
                    <span>S{idx + 1}: {report.brief.pricing.currency} {formatAssetPrice(lvl.price, report.assetClass, report.symbol)}</span>
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
                    <span>R{idx + 1}: {report.brief.pricing.currency} {formatAssetPrice(lvl.price, report.assetClass, report.symbol)}</span>
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
              <span className="text-[10px] text-cyan-400">20: {report.technical.ema20} • 50: {report.technical.ema50} • 200: {report.technical.ema200}</span>
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
              <span className="text-slate-400 text-[11px]">Bollinger Bands & Squeeze</span>
              <div className="font-bold text-white text-sm">%B: {report.technical.bollingerBands.percentB}</div>
              <span className="text-[10px] text-slate-400">{report.technical.bollingerBands.isSqueeze ? 'Squeeze Detected' : 'Normal Volatility'}</span>
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
              <div className="text-slate-400 text-[10px]">Max Capital Risk: {report.brief.pricing.currency} {report.risk.positionSizingKelly.maxRiskExposureDollars}</div>
            </div>

            <div className="p-3 rounded-lg bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-slate-400 text-[11px]">Stress-Tested Bear-Case Drawdowns</span>
              <div className="text-base font-bold text-rose-400">Mild (-7%): {report.brief.pricing.currency} {report.risk.bearCaseDrawdownScenario.mildCorrectionPrice}</div>
              <div className="text-slate-400 text-[10px]">Deep (-15%): {report.brief.pricing.currency} {report.risk.bearCaseDrawdownScenario.deepCorrectionPrice}</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CATALYST TIMELINE */}
      {activeTab === 'catalyst' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Upcoming Catalyst Timeline & Milestone Windows</span>
            </h4>
            <div className="space-y-3 pt-1">
              {report.thesis.catalystCalendar.map((cat, i) => (
                <div key={cat.id || i} className="p-3 rounded-lg bg-terminal-900 border border-terminal-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-white text-xs sm:text-sm">{cat.title}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          {cat.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Execution Window: <strong className="text-slate-200">{cat.dateOrWindow}</strong></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      cat.expectedImpact === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {cat.expectedImpact} IMPACT
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      {cat.directionalBias}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: BULL VS. BEAR CARDS */}
      {activeTab === 'bull-bear' && report && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
            <h4 className="text-sm font-bold text-white">Executive Core Investment Thesis:</h4>
            <p className="text-slate-300 leading-relaxed text-xs">{report.thesis.executiveThesis}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-emerald-900/40 space-y-3">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Top Bullish Catalysts & Upside Targets</span>
              </h4>
              <div className="space-y-2">
                {report.thesis.bullCatalysts.map((c, i) => (
                  <div key={i} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                    <strong className="text-white">{c.title}</strong>
                    <div className="text-[11px] text-slate-400 mt-1">{c.catalystExplanation}</div>
                    <div className="text-emerald-400 font-bold mt-1.5">Target: {report.brief.pricing.currency} {c.upsideTargetPrice} (+{c.upsidePotentialPercent}%)</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-rose-900/40 space-y-3">
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                <span>Top Bearish Risks & Downside Price Floors</span>
              </h4>
              <div className="space-y-2">
                {report.thesis.bearRisks.map((r, i) => (
                  <div key={i} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                    <strong className="text-white">{r.title}</strong>
                    <div className="text-[11px] text-slate-400 mt-1">{r.riskExplanation}</div>
                    <div className="text-rose-400 font-bold mt-1.5">Floor: {report.brief.pricing.currency} {r.downsideTargetPrice} (-{r.downsideRiskPercent}%)</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: REALISTIC TRADE PLAN TABLE */}
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
                      {report.brief.pricing.currency} {formatAssetPrice(report.technical.tradePlan.entryZone.min, report.assetClass, report.symbol)} - {formatAssetPrice(report.technical.tradePlan.entryZone.max, report.assetClass, report.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">Immediate Proximity</td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.entryZone.note}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-rose-400">STOP LOSS</td>
                    <td className="py-2.5 px-3 font-bold text-rose-400">
                      {report.brief.pricing.currency} {formatAssetPrice(report.technical.tradePlan.stopLoss.price, report.assetClass, report.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      -{report.technical.tradePlan.stopLoss.riskPercent}% ({formatAssetPrice(report.technical.tradePlan.stopLoss.distancePoints, report.assetClass, report.symbol)} pts)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.stopLoss.rationale}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">TARGET 1</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {report.brief.pricing.currency} {formatAssetPrice(report.technical.tradePlan.target1.price, report.assetClass, report.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      +{report.technical.tradePlan.target1.rewardPercent}% (1:{report.technical.tradePlan.target1.riskRewardRatio} R:R)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.target1.rationale}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">TARGET 2 (RUNNER)</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {report.brief.pricing.currency} {formatAssetPrice(report.technical.tradePlan.target2.price, report.assetClass, report.symbol)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      +{report.technical.tradePlan.target2.rewardPercent}% (1:{report.technical.tradePlan.target2.riskRewardRatio} R:R)
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{report.technical.tradePlan.target2.rationale}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-terminal-900 border border-terminal-border/70 space-y-1">
                <span className="text-slate-400 text-[11px] font-bold">Staged Scaling Plan:</span>
                <ul className="list-disc pl-4 text-slate-300 space-y-0.5 text-[11px]">
                  {report.thesis.scalingPlan.scalingTriggers.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-terminal-900 border border-terminal-border/70 space-y-1">
                <span className="text-rose-400 text-[11px] font-bold">Hard Invalidation Trigger:</span>
                <div className="text-white font-bold text-xs">{report.brief.pricing.currency} {formatAssetPrice(report.thesis.invalidationTrigger.priceLevel, report.assetClass, report.symbol)}</div>
                <div className="text-slate-300 text-[11px]">{report.thesis.invalidationTrigger.macroOrEventCondition}</div>
                <div className="text-amber-400 text-[10px]">{report.thesis.invalidationTrigger.exitAction}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: ALL 16 WORKFLOWS HUB */}
      {activeTab === 'workflows' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'ANALYZE_FULL', cmd: '/trade analyze', label: '01. Flagship Full Analysis' },
              { id: 'QUICK_SNAPSHOT', cmd: '/trade quick', label: '02. 60-Sec Snapshot' },
              { id: 'STANDALONE_TECH', cmd: '/trade technical', label: '03. Standalone Technical' },
              { id: 'STANDALONE_FUND', cmd: '/trade fundamental', label: '04. Standalone Fundamental' },
              { id: 'STANDALONE_SENT', cmd: '/trade sentiment', label: '05. Standalone Sentiment' },
              { id: 'STANDALONE_RISK', cmd: '/trade risk', label: '06. Standalone Risk' },
              { id: 'STANDALONE_THESIS', cmd: '/trade thesis', label: '07. Standalone Thesis' },
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
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>60-Second Rapid Pulse Snapshot:</span>
              </h4>
              <p className="text-cyan-300">{quickSnapshot.summary}</p>
              <div className="flex items-center gap-2 pt-1">
                {getGradeBadge(quickSnapshot.quickGrade, quickSnapshot.quickSignal)}
                <span className="text-slate-400 text-xs font-bold">Pulse Score: {quickSnapshot.quickScore}/100</span>
              </div>
            </div>
          )}

          {/* Sector Rotation Output */}
          {sectorData.length > 0 && activeWorkflow === 'SECTOR_ROTATION' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-cyan-400" />
                <span>Sector Rotation & Relative Momentum Heatmap:</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sectorData.map((sec, i) => (
                  <div key={i} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60 flex justify-between items-center">
                    <div>
                      <strong className="text-white">#{sec.momentumRank} {sec.sector}</strong>
                      <div className="text-[10px] text-slate-400">Leader: <span className="text-cyan-300 font-bold">{sec.leadingAsset}</span> • Status: {sec.flowStatus}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${sec.oneMonthPerformance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sec.oneMonthPerformance >= 0 ? '+' : ''}{sec.oneMonthPerformance}% (1M)
                      </div>
                      <div className="text-[10px] text-slate-400">+{sec.threeMonthPerformance}% (3M)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Asset Comparison Output */}
          {compareData && activeWorkflow === 'COMPARE_ASSETS' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-terminal-border/60 pb-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  <span>Head-to-Head Comparison: {compareData.assetA.symbol} vs {compareData.assetB.symbol}</span>
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Winner:</span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {compareData.headToHeadWinner} (+{compareData.scoreDifference} pts)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-terminal-900 border border-cyan-500/40 space-y-1">
                  <div className="font-bold text-base sm:text-lg text-white">{compareData.assetA.symbol}</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">{compareData.assetA.compositeScore}/100</div>
                  <div className="text-xs text-slate-400">{getGradeBadge(compareData.assetA.grade, compareData.assetA.signal)}</div>
                  <div className="text-[11px] text-slate-300 pt-2 space-y-0.5 text-left">
                    <div>Technical: <strong>{compareData.assetA.technicalScore}/100</strong></div>
                    <div>Fundamental: <strong>{compareData.assetA.fundamentalScore}/100</strong></div>
                    <div>Sentiment: <strong>{compareData.assetA.sentimentScore}/100</strong></div>
                    <div>Risk Safety: <strong>{compareData.assetA.riskScore}/100</strong></div>
                    <div>Thesis: <strong>{compareData.assetA.thesisScore}/100</strong></div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-terminal-900 border border-indigo-500/40 space-y-1">
                  <div className="font-bold text-base sm:text-lg text-white">{compareData.assetB.symbol}</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">{compareData.assetB.compositeScore}/100</div>
                  <div className="text-xs text-slate-400">{getGradeBadge(compareData.assetB.grade, compareData.assetB.signal)}</div>
                  <div className="text-[11px] text-slate-300 pt-2 space-y-0.5 text-left">
                    <div>Technical: <strong>{compareData.assetB.technicalScore}/100</strong></div>
                    <div>Fundamental: <strong>{compareData.assetB.fundamentalScore}/100</strong></div>
                    <div>Sentiment: <strong>{compareData.assetB.sentimentScore}/100</strong></div>
                    <div>Risk Safety: <strong>{compareData.assetB.riskScore}/100</strong></div>
                    <div>Thesis: <strong>{compareData.assetB.thesisScore}/100</strong></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Options Strategies Output */}
          {optionsData && activeWorkflow === 'OPTIONS_STRATEGIES' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Options Strategies for {optionsData.symbol} (IV: {optionsData.impliedVolPercent}%, IV Rank: {optionsData.ivRank})</span>
              </h4>
              <div className="space-y-2">
                {optionsData.recommendedStrategies.map((opt: any, i: number) => (
                  <div key={i} className="p-3 rounded bg-terminal-900 border border-terminal-border/60 space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>{opt.strategyName}</span>
                      <span className="text-cyan-400 text-[10px]">{opt.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{opt.description}</p>
                    <div className="text-[10px] text-slate-300 pt-0.5">{opt.strikeSetup} • Max Profit: {opt.maxProfit} • Breakeven: {opt.breakeven} • Expiry: {opt.recommendedExpiry}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-Earnings Output */}
          {earningsData && activeWorkflow === 'PRE_EARNINGS' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Pre-Earnings Strategic Deep-Dive: {earningsData.symbol}</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="text-slate-400 text-[10px]">Expected Date</div>
                  <div className="font-bold text-white mt-0.5">{earningsData.expectedDate}</div>
                </div>
                <div className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="text-slate-400 text-[10px]">Implied Volatility Move</div>
                  <div className="font-bold text-cyan-400 mt-0.5">±{earningsData.impliedMovePercent}%</div>
                </div>
                <div className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="text-slate-400 text-[10px]">EPS & Revenue Estimate</div>
                  <div className="font-bold text-emerald-400 mt-0.5">${earningsData.epsEstimate} ({earningsData.revenueEstimate})</div>
                </div>
                <div className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60">
                  <div className="text-slate-400 text-[10px]">Guidance Risk</div>
                  <div className="font-bold text-amber-400 mt-0.5">{earningsData.guidanceRisk}</div>
                </div>
              </div>
              <div className="p-2.5 rounded bg-terminal-900 border border-cyan-800/40 text-slate-300 text-[11px]">
                <strong className="text-cyan-300">Options Play Recommendation:</strong> {earningsData.recommendedStraddleOrSpread}
              </div>
            </div>
          )}

          {/* Portfolio Rebalancing Output */}
          {portfolioData && activeWorkflow === 'PORTFOLIO_REBALANCE' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                <span>Cross-Asset Portfolio Correlation & Risk Parity Rebalancing</span>
              </h4>
              <div className="flex items-center gap-3 text-xs">
                <span>Diversification Score: <strong className="text-emerald-400">{portfolioData.crossAssetDiversificationScore}/100</strong></span>
                <span>•</span>
                <span>Projected Sharpe: <strong className="text-cyan-400">{portfolioData.portfolioSharpeProjected}</strong></span>
                <span>•</span>
                <span>Max Expected Drawdown: <strong className="text-rose-400">{portfolioData.expectedMaxDrawdown}</strong></span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {portfolioData.riskParityAllocation.map((item: any, i: number) => (
                  <div key={i} className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60 flex justify-between items-center">
                    <div>
                      <strong className="text-white">{item.symbol}</strong>
                      <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-terminal-950 text-slate-400 border border-terminal-border">{item.assetClass}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.rationale}</div>
                    </div>
                    <div className="text-base font-bold text-cyan-400">{item.recommendedWeight}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stock Screener Output */}
          {screenerData.length > 0 && activeWorkflow === 'STOCK_SCREENER' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Multi-Asset Criteria Stock Screener:</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-terminal-border/80 text-slate-400">
                      <th className="py-1.5 px-2">SYMBOL</th>
                      <th className="py-1.5 px-2">ASSET CLASS</th>
                      <th className="py-1.5 px-2">PRICE</th>
                      <th className="py-1.5 px-2">CHANGE</th>
                      <th className="py-1.5 px-2">SCORE</th>
                      <th className="py-1.5 px-2">GRADE</th>
                      <th className="py-1.5 px-2 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-terminal-border/40">
                    {screenerData.map((row, i) => (
                      <tr key={i} className="hover:bg-terminal-900/50">
                        <td className="py-2 px-2 font-bold text-white">{row.symbol}</td>
                        <td className="py-2 px-2 text-slate-400">{row.assetClass}</td>
                        <td className="py-2 px-2">${row.price.toFixed(2)}</td>
                        <td className={`py-2 px-2 font-bold ${row.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {row.changePercent >= 0 ? '+' : ''}{row.changePercent}%
                        </td>
                        <td className="py-2 px-2 font-bold text-cyan-400">{row.compositeScore}/100</td>
                        <td className="py-2 px-2">{getGradeBadge(row.grade, row.signal)}</td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => executeWorkflow('ANALYZE_FULL', row.symbol)}
                            className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold"
                          >
                            Analyze
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scored Watchlist Output */}
          {watchlistData.length > 0 && activeWorkflow === 'SCORED_WATCHLIST' && (
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-cyan-400" />
                <span>Scored Watchlist (Live Continuous Grounding):</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {watchlistData.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg bg-terminal-900 border border-terminal-border/60 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-sm">{w.symbol}</strong>
                        <span className="text-[10px] text-slate-400">({w.name})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">${w.price.toFixed(2)} ({w.changePercent >= 0 ? '+' : ''}{w.changePercent}%)</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-cyan-400 font-bold">{w.compositeScore}/100</div>
                      <button
                        onClick={() => executeWorkflow('ANALYZE_FULL', w.symbol)}
                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold"
                      >
                        Deep Audit
                      </button>
                    </div>
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
          <strong className="text-slate-300">LEGAL & RESEARCH COMPLIANCE DISCLAIMER:</strong> This platform is an automated multi-agent algorithmic research engine designed solely for institutional research, backtesting, and market observation. All analytical outputs, scores, grades, entries, and synthetic theses are synthesized strictly from the live Chart.js WebSocket/open-feed price stream and real-time community chat transcripts, strictly prohibiting hallucinated pricing. No output constitutes financial advice, recommendation, or solicitation.
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
                  6-Page Investment Research Report Preview // {activeSymbol} ({activeTimeframe.toUpperCase()})
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
