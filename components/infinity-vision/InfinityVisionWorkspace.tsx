'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CurrencyPair, TimeFrame, Candle } from '@/lib/types';
import { InfinityVisionToolbar, ChartViewMode } from './InfinityVisionToolbar';
import { InfinityVisionOhlcBar } from './InfinityVisionOhlcBar';
import { InfinityVisionChart } from './InfinityVisionChart';
import { QuantumVisionDrawer } from './QuantumVisionDrawer';
import { LiquidityHeatmapModal } from './LiquidityHeatmapModal';
import { IndicatorsModal } from './IndicatorsModal';
import { ScenariosAndZonesSidebar } from './ScenariosAndZonesSidebar';
import { MarketDnaSidebar } from './MarketDnaSidebar';
import { VisionAtlasLabSidebar } from './VisionAtlasLabSidebar';
import { StructureTimelineBottom } from './StructureTimelineBottom';
import { BASE_PRICES } from '@/lib/marketData';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { MarketSessionManager } from '@/lib/marketSessionManager';
import { visionSystemLogger } from '@/lib/visionSystemLogger';
import { VisionAtlasWebSocketClient } from '@/lib/visionAtlasWebSocket';
import { ResearchReportSnapshot } from '@/lib/research/types';
import { formatAssetPrice, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export interface InfinityVisionWorkspaceProps {
  pair: CurrencyPair;
  timeframe: TimeFrame;
  candles?: Candle[];
  sharedReport?: ResearchReportSnapshot | null;
  onReportGenerated?: (report: ResearchReportSnapshot) => void;
  onSelectPair?: (p: CurrencyPair) => void;
  onSelectTimeframe?: (tf: TimeFrame) => void;
  onClose?: () => void;
  onSyncToTerminal?: (params: {
    symbol: CurrencyPair;
    direction: 'BUY' | 'SELL';
    entry: number;
    stopLoss: number;
    takeProfit: number;
  }) => void;
  onOpenJournal?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const InfinityVisionWorkspace: React.FC<InfinityVisionWorkspaceProps> = ({
  pair: initialPair = 'XAU/USD',
  timeframe: initialTf = '15m',
  candles: initialCandles = [],
  sharedReport,
  onReportGenerated,
  onSelectPair,
  onSelectTimeframe,
  onClose,
  onSyncToTerminal,
  onOpenJournal,
  theme: propTheme,
  onToggleTheme,
}) => {
  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(initialPair);
  const [selectedTf, setSelectedTf] = useState<TimeFrame>(initialTf);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (propTheme) return propTheme;
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem('qri_theme') || localStorage.getItem('apex_theme')) as 'dark' | 'light' | null;
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    if (propTheme && (propTheme === 'light' || propTheme === 'dark')) {
      setTheme(propTheme);
    }
  }, [propTheme]);
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('Advanced');
  const [chartType, setChartType] = useState<'Candles' | 'Line'>('Candles');
  const [showPatternOnChart, setShowPatternOnChart] = useState<boolean>(true);
  const [isMobileRightSidebarOpen, setIsMobileRightSidebarOpen] = useState<boolean>(false);

  // 🌐 Live WebSocket Feed State (Directly synced with Terminal Engine)
  const [liveCandles, setLiveCandles] = useState<Candle[]>(() => {
    if (initialCandles && initialCandles.length > 0) return initialCandles;
    return LiveMarketFeedManager.getCanonicalCandles(initialPair, initialTf);
  });
  const [livePrice, setLivePrice] = useState<number>(() => {
    return LiveMarketFeedManager.getCanonicalPrice(initialPair) || liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(initialPair);
  });
  const [liveChangePercent, setLiveChangePercent] = useState<number>(-0.06);
  const [liveTimestamp, setLiveTimestamp] = useState<number>(Date.now());
  const [liveLatencyMs, setLiveLatencyMs] = useState<number>(12);
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);

  // Interactive panels visibility states
  const [isQuantumVisionOpen, setIsQuantumVisionOpen] = useState<boolean>(false);
  const [isMarketDnaOpen, setIsMarketDnaOpen] = useState<boolean>(false);
  const [isVisionAtlasLabOpen, setIsVisionAtlasLabOpen] = useState<boolean>(false);
  const [isLiquidityOpen, setIsLiquidityOpen] = useState<boolean>(false);
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState<boolean>(false);
  const [activeRightSidebarMode, setActiveRightSidebarMode] = useState<'scenarios' | 'market_dna' | 'vision_atlas'>('scenarios');
  const [horizonCandles, setHorizonCandles] = useState<number>(10);

  // Unified AI Multi-Agent Research Engine State (100% synchronized with Chart.js Vision Atlas)
  const [researchReport, setResearchReport] = useState<ResearchReportSnapshot | null>(sharedReport || null);
  const [isRunningResearch, setIsRunningResearch] = useState<boolean>(false);
  const [isSubScoresOpen, setIsSubScoresOpen] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfHtml, setPdfHtml] = useState<string>('');

  // 🧭 Bi-directional Control Panel Indicator Overlays State
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, boolean>>({
    ms_map: true,
    ms_internal: true,
    ms_bos: true,
    ms_choch: true,
    ms_mss: true,
    ms_wick_breaks: true,
    labels: true,
    supply_demand: true,
    ob_fresh: true,
    ob_mitigated: true,
    ob_breaker: true,
    ob_rejection: true,
    fvg_fresh: true,
    fvg_inversion: true,
    fvg_mitigated: true,
    liq_sweep: true,
    liq_pools: true,
    liq_equal: true,
    fib_retracement: true,
    fib_extensions: true,
    trend_ema: true,
    rsi_momentum: true,
    volume_profile: false,
    zones_danger: true,
    zones_caution: true,
    zones_entry: true,
    zones_safe: true,
    session_london: true,
    session_ny: true,
    session_asian: true,
    strength_panel: true,
    advanced_analysis: true,
  });

  // Sync pair changes from external props
  useEffect(() => {
    setSelectedPair(initialPair);
    const cp = LiveMarketFeedManager.getCanonicalPrice(initialPair);
    if (cp && Number.isFinite(cp)) setLivePrice(cp);
  }, [initialPair]);

  // Sync timeframe changes from external props
  useEffect(() => {
    setSelectedTf(initialTf);
  }, [initialTf]);

  // Sync candles from external props (Terminal parent state)
  useEffect(() => {
    if (initialCandles && initialCandles.length > 0) {
      setLiveCandles(initialCandles);
      const latest = initialCandles[initialCandles.length - 1];
      if (latest && Number.isFinite(latest.close)) {
        setLivePrice(latest.close);
      }
    }
  }, [initialCandles]);

  // 🌐 Dedicated Continuous Low-Latency WebSocket & Canonical Streaming Pipeline
  useEffect(() => {
    // 1. Dedicated VisionAtlasWebSocketClient (with multi-provider failover: OANDA v20, Twelve Data, TraderMade, MT5)
    const wsClient = VisionAtlasWebSocketClient.getInstance(selectedPair, selectedTf);

    const unsubTicks = wsClient.subscribeTicks((packet) => {
      if (packet.candles && packet.candles.length > 0) {
        setLiveCandles(packet.candles);
      }
      if (Number.isFinite(packet.price) && packet.price > 0) {
        setLivePrice(packet.price);
      }
      setLiveChangePercent(packet.change24h);
      setLiveTimestamp(packet.timestamp);
      setLiveLatencyMs(packet.latencyMs);
      setIsInterrupted(false);
    });

    const unsubStatus = wsClient.subscribeStatus((status, provider, latencyMs) => {
      setLiveLatencyMs(latencyMs);
      setIsInterrupted(status === 'OFFLINE' || status === 'RECONNECTING');
    });

    // 2. Authoritative LiveMarketFeedManager subscription for instant SSOT Terminal parity
    const unsubscribe = LiveMarketFeedManager.subscribe((event) => {
      if (event.pair === selectedPair) {
        setLiveCandles(event.candles);
        setLivePrice(event.livePrice);
        setLiveChangePercent(event.change24h);
        setLiveTimestamp(event.timestamp);
        if (event.latencyMs) {
          setLiveLatencyMs(event.latencyMs);
        }
      }
    });

    // 3. Telemetry heartbeat to prevent stale data
    const unsubTel = LiveMarketFeedManager.subscribeWebSocketTelemetry((tel) => {
      const session = MarketSessionManager.getMarketSessionInfo(selectedPair);
      const isStale = !session.isFrozen && ((Date.now() - tel.lastTickTimestamp) > 20000);
      setIsInterrupted(!tel.isConnected || isStale);
      if (tel.latencyMs) setLiveLatencyMs(tel.latencyMs);
    });

    return () => {
      unsubTicks();
      unsubStatus();
      unsubscribe();
      unsubTel();
    };
  }, [selectedPair, selectedTf]);

  const handleReconnect = () => {
    const wsClient = VisionAtlasWebSocketClient.getInstance(selectedPair, selectedTf);
    wsClient.reconnect();
    LiveMarketFeedManager.startLiveFeed(selectedPair, selectedTf, 1000);
    setIsInterrupted(false);
  };

  // Run Synchronized 5-Agent Research Engine Analysis for active Vision Atlas pair & timeframe
  const runSynchronizedResearch = async (sym: string = selectedPair, tf: string = selectedTf) => {
    setIsRunningResearch(true);
    try {
      const resolved = liveChartTelemetryService.resolveSymbol(sym);
      const recent = (liveCandles || []).slice(-60);
      const latestBar = recent[recent.length - 1];
      const spot = livePrice || latestBar?.close || 100;
      const prev = recent[0]?.open || spot;
      const chartContext =
        recent.length > 0
          ? {
              symbol: resolved.symbol,
              tvSymbol: resolved.tvSymbol,
              name: resolved.name,
              timeframe: tf,
              livePrice: spot,
              open: latestBar?.open || spot,
              high: Math.max(...recent.map((b) => b.high)),
              low: Math.min(...recent.map((b) => b.low)),
              close: spot,
              prevClose: prev,
              volume: latestBar?.volume || 100000,
              changePercent: prev > 0 ? Number((((spot - prev) / prev) * 100).toFixed(2)) : 0,
              currency: resolved.currency,
              activeIndicators: ['EMA20', 'EMA50', 'RSI14', 'MACD', 'BB', 'ATR', 'VisionAtlas'],
              indicatorReadings: {},
              recentCandles: recent.map((c) => ({
                timestamp: typeof c.timestamp === 'number' ? c.timestamp : new Date(c.time).getTime(),
                time: typeof c.time === 'string' ? c.time : new Date(c.time * 1000).toISOString(),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume ?? 0,
              })),
              source: 'CHART_WIDGET_EVENT' as const,
              timestamp: Date.now(),
            }
          : undefined;

      const res = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: resolved.symbol,
          timeframe: tf,
          chartContext,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.report) {
          setResearchReport(data.report);
          onReportGenerated?.(data.report);
        }
      }
    } catch (err) {
      console.error('Vision Atlas Research sync failed:', err);
    } finally {
      setIsRunningResearch(false);
    }
  };

  const handleOpenVisionPdf = async () => {
    try {
      const targetSym = liveChartTelemetryService.resolveSymbol(selectedPair).symbol;
      const res = await fetch('/api/research/report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSym,
          timeframe: selectedTf,
          chartContext: researchReport?.brief?.chartContext,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPdfHtml(data.html);
        setShowPdfModal(true);
      }
    } catch (err) {
      console.error('Vision Atlas PDF generation failed:', err);
    }
  };

  useEffect(() => {
    const canonical = liveChartTelemetryService.resolveSymbol(selectedPair).symbol;
    if (sharedReport && sharedReport.symbol === canonical && (!researchReport || sharedReport.timestamp >= researchReport.timestamp)) {
      setResearchReport(sharedReport);
      return;
    }
    runSynchronizedResearch(selectedPair, selectedTf);
  }, [selectedPair, selectedTf, sharedReport]);

  // Derived price metrics & spreads calculated with exact decimal parity
  const isIndianIndex = selectedPair === 'NIFTY 50' || selectedPair === 'BANK NIFTY';
  const isIndianStock = selectedPair === 'RELIANCE' || selectedPair === 'TCS' || selectedPair === 'HDFC BANK' || selectedPair === 'INFY';
  const isGold = selectedPair === 'XAU/USD';
  const isSilver = selectedPair === 'XAG/USD';
  const isPlatinum = selectedPair === 'XPT/USD';
  const isCopper = selectedPair === 'COPPER';
  const isOil = selectedPair === 'WTI_CRUDE' || selectedPair === 'BRENT_CRUDE';
  const isJpy = selectedPair.includes('JPY');
  const isRupee = selectedPair.includes('/INR');

  let decimalCount = 5;
  if (isIndianIndex || isIndianStock || isGold || isPlatinum || isOil) decimalCount = 2;
  else if (isSilver || isJpy || isRupee) decimalCount = 3;
  else if (isCopper) decimalCount = 4;

  const spreadPts = isGold ? 17 : isIndianIndex ? 5 : isJpy ? 8 : isSilver ? 3 : 2;
  const spreadValue = spreadPts * (isGold ? 0.05 : isIndianIndex ? 0.05 : isJpy ? 0.001 : 0.0001);
  const bidPrice = Number((livePrice - spreadValue).toFixed(decimalCount));
  const askPrice = Number((livePrice + spreadValue).toFixed(decimalCount));

  const lastCandle = useMemo(() => {
    if (liveCandles && liveCandles.length > 0) {
      return liveCandles[liveCandles.length - 1];
    }
    return {
      open: livePrice,
      high: livePrice,
      low: livePrice,
      close: livePrice,
      time: new Date().toISOString(),
      timestamp: Date.now(),
      volume: 1000,
    };
  }, [liveCandles, livePrice]);

  // 🛰️ Systematized Snapshot Logging: Log active Quantum Vision bias, Market DNA prints, and Vision Atlas configurations
  useEffect(() => {
    if (!liveCandles || liveCandles.length === 0) return;
    const atr = Math.max(...liveCandles.slice(-14).map(c => c.high - c.low)) || (livePrice * 0.003);
    
    // Dynamic zones calculated from live price
    const isSellBias = activeRightSidebarMode === 'scenarios';
    const safeZone = {
      min: Number((isSellBias ? livePrice - atr * 0.4 : livePrice + atr * 0.2).toFixed(4)),
      max: Number((isSellBias ? livePrice + atr * 0.2 : livePrice + atr * 0.6).toFixed(4)),
    };
    const entryZone = {
      min: Number((isSellBias ? livePrice + atr * 0.5 : livePrice - atr * 0.8).toFixed(4)),
      max: Number((isSellBias ? livePrice + atr * 0.8 : livePrice - atr * 0.5).toFixed(4)),
    };
    const cautionZone = {
      min: Number((isSellBias ? livePrice + atr * 0.8 : livePrice - atr * 1.5).toFixed(4)),
      max: Number((isSellBias ? livePrice + atr * 1.5 : livePrice - atr * 0.8).toFixed(4)),
    };
    const dangerZone = {
      min: Number((isSellBias ? livePrice + atr * 1.5 : livePrice - atr * 2.2).toFixed(4)),
      max: Number((isSellBias ? livePrice + atr * 2.2 : livePrice - atr * 1.5).toFixed(4)),
    };

    visionSystemLogger.logSnapshot({
      pair: selectedPair,
      timeframe: selectedTf,
      livePrice,
      quantumVisionBias: isSellBias ? 'BEARISH' : 'BULLISH',
      bullishProbability: isSellBias ? 47 : 53,
      bearishProbability: isSellBias ? 53 : 47,
      marketDnaSimilarity: 67.3,
      liquiditySweepEvent: `Sell-side swept at ${(livePrice - atr * 0.5).toFixed(2)} - 3 candles ago`,
      structureShift: 'MSS (CHoCH) developing',
      marketRegime: 'Structural transition - quiet volatility',
      language: 'en',
      voiceActive: true,
      safeZone,
      entryZone,
      cautionZone,
      dangerZone,
    });
  }, [selectedPair, selectedTf, Math.floor(livePrice * 10), activeRightSidebarMode]);

  // Switching Pair & Timeframe handlers that trigger global sync
  const handleSelectPair = (p: CurrencyPair) => {
    setSelectedPair(p);
    LiveMarketFeedManager.startLiveFeed(p, selectedTf, 1500);
    const pCandles = LiveMarketFeedManager.getCanonicalCandles(p, selectedTf);
    if (pCandles && pCandles.length > 0) setLiveCandles(pCandles);
    const pPrice = LiveMarketFeedManager.getCanonicalPrice(p) || liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(p);
    if (pPrice) setLivePrice(pPrice);

    if (onSelectPair) onSelectPair(p);
  };

  const handleSelectTimeframe = (tf: any) => {
    const validTf = tf as TimeFrame;
    setSelectedTf(validTf);
    LiveMarketFeedManager.startLiveFeed(selectedPair, validTf, 1500);
    const tfCandles = LiveMarketFeedManager.getCanonicalCandles(selectedPair, validTf);
    if (tfCandles && tfCandles.length > 0) setLiveCandles(tfCandles);

    if (onSelectTimeframe) onSelectTimeframe(validTf);
  };

  // Toggle handlers for mutually exclusive or combinable panels
  const handleToggleQuantumVision = () => {
    setIsQuantumVisionOpen(prev => !prev);
  };

  const handleToggleMarketDna = () => {
    if (activeRightSidebarMode === 'market_dna' && isMarketDnaOpen) {
      setIsMarketDnaOpen(false);
      setActiveRightSidebarMode('scenarios');
    } else {
      setIsMarketDnaOpen(true);
      setIsVisionAtlasLabOpen(false);
      setActiveRightSidebarMode('market_dna');
      setIsMobileRightSidebarOpen(true);
    }
  };

  const handleToggleVisionAtlasLab = () => {
    if (activeRightSidebarMode === 'vision_atlas' && isVisionAtlasLabOpen) {
      setIsVisionAtlasLabOpen(false);
      setActiveRightSidebarMode('scenarios');
    } else {
      setIsVisionAtlasLabOpen(true);
      setIsMarketDnaOpen(false);
      setActiveRightSidebarMode('vision_atlas');
      setIsMobileRightSidebarOpen(true);
    }
  };

  const handleToggleLiquidity = () => {
    setIsLiquidityOpen(prev => !prev);
  };

  const handleToggleIndicators = () => {
    setIsIndicatorsOpen(prev => !prev);
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qri_theme', nextTheme);
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(nextTheme);
    }
    if (onToggleTheme) {
      onToggleTheme();
    }
  };

  return (
    <div className={`w-full flex flex-col font-sans select-none overflow-hidden ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-terminal-950 text-slate-100'
    }`}>
      {/* 🚀 PRIMARY CONTROL ROW (Begins directly with VISION pair selector & timeframe chips) */}
      <InfinityVisionToolbar
        selectedPair={selectedPair}
        onSelectPair={handleSelectPair}
        selectedTimeframe={selectedTf}
        onSelectTimeframe={handleSelectTimeframe}
        chartViewMode={chartViewMode}
        onChangeChartViewMode={setChartViewMode}
        isQuantumVisionOpen={isQuantumVisionOpen}
        onToggleQuantumVision={handleToggleQuantumVision}
        isMarketDnaOpen={isMarketDnaOpen}
        onToggleMarketDna={handleToggleMarketDna}
        isVisionAtlasLabOpen={isVisionAtlasLabOpen}
        onToggleVisionAtlasLab={handleToggleVisionAtlasLab}
        isLiquidityOpen={isLiquidityOpen}
        onToggleLiquidity={handleToggleLiquidity}
        isIndicatorsOpen={isIndicatorsOpen}
        onToggleIndicators={handleToggleIndicators}
        isMobileSidebarOpen={isMobileRightSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileRightSidebarOpen(!isMobileRightSidebarOpen)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 📊 REAL-TIME LIVE OHLC & LIQUIDITY TICKER STRIP */}
      <InfinityVisionOhlcBar
        pair={selectedPair}
        timeframe={selectedTf}
        open={lastCandle.open}
        high={Math.max(lastCandle.high, livePrice)}
        low={Math.min(lastCandle.low, livePrice)}
        close={livePrice}
        changePercent={liveChangePercent}
        bidPrice={bidPrice}
        askPrice={askPrice}
        spreadPts={spreadPts}
        dateStr={new Date(liveTimestamp).toLocaleString('en-US', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' UTC'}
        isLive={!isInterrupted}
        latencyMs={liveLatencyMs}
        isInterrupted={isInterrupted}
        theme={theme}
      />

      {/* 🤖 SYNCHRONIZED AI MULTI-AGENT RESEARCH ENGINE BAR (25 Sub-Scores & 6-Page PDF Inside Vision Atlas) */}
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-terminal-border bg-white/80 dark:bg-terminal-900/90 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30">
            AI RESEARCH SYNC: {researchReport ? `${researchReport.compositeScore}/100 • GRADE ${researchReport.grade}` : isRunningResearch ? 'COMPUTING...' : 'STANDBY'}
          </span>
          {researchReport && (
            <>
              <span className="text-slate-600 dark:text-slate-300">
                Tech <strong>{researchReport.technical.totalScore}</strong> • Fund <strong>{researchReport.fundamental.totalScore}</strong> • Sent <strong>{researchReport.sentiment.totalScore}</strong> • Risk <strong>{researchReport.risk.totalScore}</strong> • Thesis <strong>{researchReport.thesis.totalScore}</strong>
              </span>
              <span className="hidden xl:inline text-emerald-600 dark:text-emerald-400">
                | Entry {formatAssetPrice(researchReport.technical.tradePlan.entryZone.min, researchReport.assetClass, researchReport.symbol)} • SL {formatAssetPrice(researchReport.technical.tradePlan.stopLoss.price, researchReport.assetClass, researchReport.symbol)} • TP1 {formatAssetPrice(researchReport.technical.tradePlan.target1.price, researchReport.assetClass, researchReport.symbol)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsSubScoresOpen((v) => !v)}
            className="px-2.5 py-1 rounded border border-slate-300 dark:border-terminal-border hover:bg-slate-100 dark:hover:bg-terminal-800 text-[10px] font-bold cursor-pointer"
          >
            {isSubScoresOpen ? 'Hide 25 Sub-Scores' : '25 Sub-Scores & Thesis'}
          </button>
          <button
            onClick={() => runSynchronizedResearch(selectedPair, selectedTf)}
            disabled={isRunningResearch}
            className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold disabled:opacity-50 cursor-pointer"
          >
            {isRunningResearch ? 'Running...' : 'Run AI Audit'}
          </button>
          <button
            onClick={handleOpenVisionPdf}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
          >
            6-Page PDF
          </button>
        </div>
      </div>

      {/* Expandable 25 Sub-Scores & Executive Thesis Panel inside Vision Atlas */}
      {isSubScoresOpen && researchReport && (
        <div className="p-3 border-b border-slate-200 dark:border-terminal-border bg-slate-50 dark:bg-terminal-950/95 space-y-2 text-[11px] font-mono">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <strong className="text-cyan-700 dark:text-cyan-300">
              {researchReport.symbol} ({researchReport.assetClass}) Executive Thesis:
            </strong>
            <span className="text-slate-600 dark:text-slate-300">
              {researchReport.gradeDescription}
            </span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 font-sans text-[11px] leading-snug">
            {researchReport.thesis.executiveThesis}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-1.5 pt-1">
            {researchReport.all25SubScores.map((sub, i) => (
              <div key={i} className="px-2 py-1 rounded border border-slate-200 dark:border-terminal-border bg-white dark:bg-terminal-900 flex items-center justify-between text-[10px]">
                <span className="truncate text-slate-600 dark:text-slate-300" title={`${sub.agent}: ${sub.label}`}>
                  {sub.category}
                </span>
                <strong className="text-cyan-600 dark:text-cyan-400 shrink-0 ml-1">{sub.score}/20</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🧭 MAIN BODY: Real-Time Streaming Chart + Fluid Dynamic Drawers */}
      <div className="flex-1 flex min-h-[500px] relative overflow-hidden">
        {/* Left Floating Quantum Vision Drawer */}
        <QuantumVisionDrawer
          isOpen={isQuantumVisionOpen}
          onClose={() => setIsQuantumVisionOpen(false)}
          horizonCandles={horizonCandles}
          onChangeHorizon={setHorizonCandles}
          onViewChartMode={setChartType}
          theme={theme}
          pair={selectedPair}
          timeframe={selectedTf}
          livePrice={livePrice}
          candles={liveCandles}
          researchReport={researchReport}
        />

        {/* Center Floating Liquidity Heatmap Window */}
        <LiquidityHeatmapModal
          isOpen={isLiquidityOpen}
          onClose={() => setIsLiquidityOpen(false)}
          pair={selectedPair}
          timeframe={selectedTf}
          theme={theme}
          livePrice={livePrice}
          candles={liveCandles}
          researchReport={researchReport}
        />

        {/* 📈 Central High-Frequency Chart.js Streaming Container (Modular Vision Atlas Plugins) */}
        <div className="flex-1 p-2 sm:p-3 relative flex flex-col min-w-0 min-h-0 bg-slate-100 dark:bg-terminal-950/60 overflow-hidden">
          <InfinityVisionChart
            candles={liveCandles}
            pair={selectedPair}
            timeframe={selectedTf}
            theme={theme}
            showIndicatorsOverlay={chartViewMode === 'Advanced' || chartViewMode === 'Standard' || isIndicatorsOpen}
            showQuantumSimulation={isQuantumVisionOpen}
            showMarketDna={isMarketDnaOpen}
            showVisionAtlasLab={isVisionAtlasLabOpen}
            showLiquidityHeatmap={isLiquidityOpen}
            chartType={chartType}
            showPatternOnChart={showPatternOnChart}
            horizonCandles={horizonCandles}
            latencyMs={liveLatencyMs}
            isInterrupted={isInterrupted}
            indicatorSettings={indicatorSettings}
            tradePlanOverlay={
              researchReport
                ? {
                    enabled: true,
                    currency: researchReport.brief.pricing.currency,
                    entryMin: researchReport.technical.tradePlan.entryZone.min,
                    entryMax: researchReport.technical.tradePlan.entryZone.max,
                    stopLoss: researchReport.technical.tradePlan.stopLoss.price,
                    target1: researchReport.technical.tradePlan.target1.price,
                    target2: researchReport.technical.tradePlan.target2.price,
                    invalidationLevel: researchReport.thesis.invalidationTrigger.priceLevel,
                  }
                : undefined
            }
            onReconnect={handleReconnect}
          />
        </div>

        {/* Right Sidebar: Dynamic Mode (Scenarios & Zones vs Market DNA vs Vision Atlas Lab) */}
        <div className={`
          ${isMobileRightSidebarOpen ? 'fixed inset-y-0 right-0 z-50 w-[320px] sm:w-[350px] shadow-2xl flex' : 'hidden lg:flex'}
          lg:static w-[320px] lg:w-[350px] shrink-0 border-l flex flex-col transition-all ${
          theme === 'light' 
            ? 'bg-white border-slate-200 shadow-sm' 
            : 'bg-terminal-950 border-terminal-border'
        }`}>
          {/* Mobile Close Button */}
          <div className="lg:hidden p-2 flex justify-between items-center bg-slate-50 dark:bg-terminal-900 border-b border-slate-200 dark:border-terminal-border">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Analytical Desk
            </span>
            <button
              onClick={() => setIsMobileRightSidebarOpen(false)}
              className="px-2.5 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-terminal-800 text-slate-800 dark:text-white"
            >
              ✕ Close
            </button>
          </div>

          {activeRightSidebarMode === 'scenarios' && (
            <ScenariosAndZonesSidebar
              pair={selectedPair}
              timeframe={selectedTf}
              theme={theme}
              currentPrice={livePrice}
              candles={liveCandles}
              onSyncToTerminal={onSyncToTerminal}
            />
          )}

          {activeRightSidebarMode === 'market_dna' && (
            <MarketDnaSidebar
              pair={selectedPair}
              timeframe={selectedTf}
              theme={theme}
              livePrice={livePrice}
              candles={liveCandles}
              researchReport={researchReport}
              onTogglePatternOnChart={setShowPatternOnChart}
              onToggleChartMode={setChartType}
            />
          )}

          {activeRightSidebarMode === 'vision_atlas' && (
            <VisionAtlasLabSidebar
              pair={selectedPair}
              timeframe={selectedTf}
              theme={theme}
              livePrice={livePrice}
              candles={liveCandles}
              researchReport={researchReport}
              onSimulate={() => setIsQuantumVisionOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Vision Atlas Integrated 6-Page PDF Report Preview Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-terminal-900 border border-terminal-border rounded-xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl">
            <div className="p-3 border-b border-terminal-border flex items-center justify-between bg-terminal-950 text-white font-mono text-xs">
              <span>Vision Atlas Synchronized 6-Page PDF Report // {selectedPair} ({selectedTf.toUpperCase()})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const win = window.open('', '_blank');
                    if (win) {
                      win.document.write(pdfHtml);
                      win.document.close();
                      win.focus();
                      setTimeout(() => win.print(), 400);
                    }
                  }}
                  className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="px-2 py-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-white">
              <iframe srcDoc={pdfHtml} title="Vision Atlas 6-Page Research PDF" className="w-full h-full border-none" />
            </div>
          </div>
        </div>
      )}

      {/* 📋 BOTTOM PANEL: Structure Timeline & Sessions & Vision Telemetry Logs */}
      <StructureTimelineBottom
        pair={selectedPair}
        timeframe={selectedTf}
        theme={theme}
      />

      {/* ⚙️ Comprehensive Indicators Drawer */}
      <IndicatorsModal
        isOpen={isIndicatorsOpen}
        onClose={() => setIsIndicatorsOpen(false)}
        theme={theme}
        settings={indicatorSettings}
        onUpdateSettings={setIndicatorSettings}
      />
    </div>
  );
};
