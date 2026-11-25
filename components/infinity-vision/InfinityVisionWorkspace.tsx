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
import { computeLiveVisionAtlasSnapshot } from '@/lib/research/VisionAtlasLiveAnalytics';

export interface InfinityVisionWorkspaceProps {
  pair: CurrencyPair;
  timeframe: TimeFrame;
  candles?: Candle[];
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
  const [horizonCandles, setHorizonCandles] = useState<number>(5);
  const [syncedReport, setSyncedReport] = useState<ResearchReportSnapshot | null>(null);

  // 🔄 Architecturally synchronize Vision Atlas with AI Multi-Agent Research Engine outputs
  useEffect(() => {
    let cancelled = false;
    const syncResearchReport = async () => {
      try {
        const res = await fetch('/api/research/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: selectedPair,
            timeframe: selectedTf,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data?.report) {
            setSyncedReport(data.report);
          }
        }
      } catch {
        // Keep last valid snapshot silently on network hiccup
      }
    };
    syncResearchReport();
    return () => {
      cancelled = true;
    };
  }, [selectedPair, selectedTf]);

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
    
    // Dynamic live Vision Atlas analytics (replaces static 47/53 & 67.3 defaults)
    const liveVa = computeLiveVisionAtlasSnapshot({
      pair: selectedPair,
      timeframe: selectedTf,
      livePrice,
      candles: liveCandles,
      horizonCandles,
      report: syncedReport,
    });
    const safeZone = { min: liveVa.zones[3].min, max: liveVa.zones[3].max };
    const entryZone = { min: liveVa.zones[2].min, max: liveVa.zones[2].max };
    const cautionZone = { min: liveVa.zones[1].min, max: liveVa.zones[1].max };
    const dangerZone = { min: liveVa.zones[0].min, max: liveVa.zones[0].max };

    visionSystemLogger.logSnapshot({
      pair: selectedPair,
      timeframe: selectedTf,
      livePrice,
      quantumVisionBias: liveVa.bullishPct >= 50 ? 'BULLISH' : 'BEARISH',
      bullishProbability: liveVa.bullishPct,
      bearishProbability: liveVa.bearishPct,
      marketDnaSimilarity: liveVa.marketDna.similarityScore,
      liquiditySweepEvent: liveVa.sweepSummary,
      structureShift: liveVa.structureSummary,
      marketRegime: liveVa.marketDna.matchedRegime,
      language: 'en',
      voiceActive: true,
      safeZone,
      entryZone,
      cautionZone,
      dangerZone,
    });
  }, [selectedPair, selectedTf, Math.floor(livePrice * 10), activeRightSidebarMode, horizonCandles, liveCandles.length]);

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

      {/* 🤖 SYNCHRONIZED AI RESEARCH ENGINE SCORE STRIP */}
      {syncedReport && (
        <div className={`px-3.5 py-1.5 border-b flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono ${
          theme === 'light'
            ? 'bg-cyan-50 border-slate-200 text-slate-800'
            : 'bg-terminal-900/90 border-terminal-border text-slate-200'
        }`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold">
              AI RESEARCH SYNC • {syncedReport.symbol} ({selectedTf.toUpperCase()})
            </span>
            <span className="font-bold">
              Composite Score: <strong className="text-emerald-400">{syncedReport.compositeScore}/100</strong>
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
              GRADE {syncedReport.grade} • {syncedReport.signal.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span>25 Sub-Scores Active ({syncedReport.all25SubScores.length}/25)</span>
            <span>Tech:{syncedReport.technical.totalScore} • Fund:{syncedReport.fundamental.totalScore} • Sent:{syncedReport.sentiment.totalScore} • Risk:{syncedReport.risk.totalScore} • Thesis:{syncedReport.thesis.totalScore}</span>
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
          theme={theme}
          pair={selectedPair}
          timeframe={selectedTf}
          livePrice={livePrice}
          candles={liveCandles}
          report={syncedReport}
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
          report={syncedReport}
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
              report={syncedReport}
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
              report={syncedReport}
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
              report={syncedReport}
              onSimulate={() => setIsQuantumVisionOpen(true)}
            />
          )}
        </div>
      </div>

      {/* 📋 BOTTOM PANEL: Structure Timeline & Sessions & Vision Telemetry Logs */}
      <StructureTimelineBottom
        pair={selectedPair}
        timeframe={selectedTf}
        theme={theme}
        livePrice={livePrice}
        candles={liveCandles}
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
