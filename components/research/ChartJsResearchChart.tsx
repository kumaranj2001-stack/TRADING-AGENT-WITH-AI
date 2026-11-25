/**
 * components/research/ChartJsResearchChart.tsx
 * Completely Unrestricted Open-Source Chart.js Research Chart powered by HighFrequencyStreamClient
 * (Native WebSocket + High-Frequency Open SSE Stream) and QuriTrader's Modular Vision Atlas Plugin Suite.
 *
 * Replaces all TradingView iframe/widget dependencies while preserving 100% bidirectional
 * state synchronization with the Multi-Agent Trading Research Engine.
 */

'use client';

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import {
  BarChart3,
  Maximize2,
  Minimize2,
  Search,
  SlidersHorizontal,
  X,
  Check,
  Radio,
  CandlestickChart,
  RefreshCw,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { QriChartJsCanvas } from '@/components/chartjs/QriChartJsCanvas';
import { HighFrequencyStreamClient } from '@/lib/chartjs/HighFrequencyStreamClient';
import { computeVisionAtlasOverlays } from '@/lib/chartjs/computeVisionAtlasOverlays';
import {
  ChartJsCandleBar,
  ChartJsExecutionLevels,
  StreamConnectionTelemetry,
} from '@/lib/chartjs/types';
import { ChartLiveContext } from '@/lib/research/types';
import {
  formatAssetPrice,
  getAssetDecimals,
  liveChartTelemetryService,
} from '@/lib/research/LiveChartTelemetryService';

export interface ChartJsResearchChartProps {
  symbol: string;
  timeframe?: string;
  theme?: 'dark' | 'light';
  height?: number;
  executionLevels?: ChartJsExecutionLevels;
  allowIndicatorsCustomization?: boolean;
  onSymbolChange?: (newSymbol: string, telemetry?: ChartLiveContext) => void;
  onTimeframeChange?: (newTimeframe: string, telemetry?: ChartLiveContext) => void;
  onChartTelemetryUpdate?: (telemetry: ChartLiveContext) => void;
}

const MODULAR_PLUGINS = [
  { id: 'ema20', label: 'EMA 20', category: 'TREND' },
  { id: 'ema50', label: 'EMA 50', category: 'TREND' },
  { id: 'ema200', label: 'EMA 200', category: 'TREND' },
  { id: 'bb', label: 'Bollinger Bands (20, 2)', category: 'VOLATILITY' },
  { id: 'vwap', label: 'VWAP Session Anchor', category: 'TREND' },
  { id: 'rsi_osc', label: 'RSI (14) Oscillator Pane', category: 'MOMENTUM' },
  { id: 'vision_atlas_smc', label: 'Vision Atlas: SMC (OB/FVG/BOS)', category: 'VISION_ATLAS' },
  { id: 'vision_atlas_lab', label: 'Vision Atlas: Lab Zones', category: 'VISION_ATLAS' },
  { id: 'market_dna', label: 'Vision Atlas: Fib Golden Pocket', category: 'VISION_ATLAS' },
  { id: 'quantum_vision', label: 'Vision Atlas: Quantum Forecast Cone', category: 'VISION_ATLAS' },
  { id: 'liquidity_heatmap', label: 'Vision Atlas: Liquidity Depth Walls', category: 'VISION_ATLAS' },
  { id: 'execution_blueprint', label: 'AI Entry / SL / TP Execution Lines', category: 'EXECUTION' },
  { id: 'volume_histogram', label: 'Volume Histogram', category: 'CORE' },
];

const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1d', label: '1D' },
  { id: '1w', label: '1W' },
];

interface SearchMatch {
  symbol: string;
  exchangeSymbol: string;
  description: string;
  exchange: string;
  type: string;
  currency: string;
}

export const ChartJsResearchChart: React.FC<ChartJsResearchChartProps> = memo(({
  symbol,
  timeframe = '1h',
  theme = 'dark',
  height = 520,
  executionLevels,
  allowIndicatorsCustomization = true,
  onSymbolChange,
  onTimeframeChange,
  onChartTelemetryUpdate,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const streamClientRef = useRef<HighFrequencyStreamClient | null>(null);
  const lastParentPushRef = useRef<number>(0);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'Candles' | 'Line'>('Candles');
  const [candles, setCandles] = useState<ChartJsCandleBar[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<ChartJsCandleBar | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamConnectionTelemetry>({
    isConnected: false,
    status: 'CONNECTING',
    protocol: 'Initializing WS/SSE Stream',
    latencyMs: 0,
    ticksPerSec: 0,
    totalTicks: 0,
    droppedTicks: 0,
    seqId: 0,
    lastTickTimestamp: Date.now(),
  });

  // Modular Plugin States (Vision Atlas + Standard Indicators)
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({
    ema20: true,
    ema50: true,
    ema200: false,
    bb: true,
    vwap: false,
    rsi_osc: true,
    vision_atlas_smc: true,
    vision_atlas_lab: false,
    market_dna: true,
    quantum_vision: true,
    liquidity_heatmap: true,
    execution_blueprint: true,
    volume_histogram: true,
  });

  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState<boolean>(false);
  const [showSymbolSearch, setShowSymbolSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [liveContext, setLiveContext] = useState<ChartLiveContext | null>(null);

  const resolved = liveChartTelemetryService.resolveSymbol(symbol);
  const canonicalSymbol = resolved.symbol;
  const exchangeSymbol = resolved.exchangeSymbol;
  const decimals = getAssetDecimals(resolved.assetClass, canonicalSymbol);

  const activeIndicatorKeys = Object.entries(enabledPlugins)
    .filter(([, on]) => on)
    .map(([id]) => id.toUpperCase());

  const buildLiveContextFromCandles = useCallback(
    (bars: ChartJsCandleBar[], seqId?: number, changePct?: number): ChartLiveContext | null => {
      if (!bars || bars.length === 0) return null;
      const last = bars[bars.length - 1];
      const ov = computeVisionAtlasOverlays(bars, decimals);
      const firstOpen = bars[0]?.open || last.open || last.close;
      const computedChange =
        typeof changePct === 'number'
          ? changePct
          : firstOpen > 0
          ? Number((((last.close - firstOpen) / firstOpen) * 100).toFixed(2))
          : 0;

      return {
        symbol: canonicalSymbol,
        exchangeSymbol,
        name: resolved.name,
        timeframe: timeframe.toLowerCase(),
        livePrice: last.close,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        prevClose: bars[Math.max(0, bars.length - 2)]?.close || last.open,
        volume: last.volume,
        changePercent: computedChange,
        currency: resolved.currency,
        activeIndicators: activeIndicatorKeys,
        indicatorReadings: {
          rsi14: ov.latestRsi,
          ema20: ov.ema20[ov.ema20.length - 1],
          ema50: ov.ema50[ov.ema50.length - 1],
          ema200: ov.ema200[ov.ema200.length - 1],
          macdLine: ov.latestMacd,
          macdSignal: ov.latestMacdSignal,
          macdHistogram: Number((ov.latestMacd - ov.latestMacdSignal).toFixed(5)),
          bbUpper: ov.bbUpper[ov.bbUpper.length - 1],
          bbMiddle: ov.bbMiddle[ov.bbMiddle.length - 1],
          bbLower: ov.bbLower[ov.bbLower.length - 1],
          atr14: ov.atr14,
        },
        recentCandles: bars.slice(-100),
        sequenceId: seqId,
        source: 'CHARTJS_WS_STREAM',
        timestamp: Date.now(),
      };
    },
    [canonicalSymbol, exchangeSymbol, resolved.name, resolved.currency, timeframe, decimals, activeIndicatorKeys]
  );

  // Connect & bind HighFrequencyStreamClient directly into Chart.js canvas
  useEffect(() => {
    const client = new HighFrequencyStreamClient(canonicalSymbol, timeframe);
    streamClientRef.current = client;

    const unsubFrames = client.subscribeFrames((frame, nextCandles) => {
      setCandles(nextCandles);
      const ctx = buildLiveContextFromCandles(nextCandles, frame.seq, frame.changePercent);
      if (ctx) {
        setLiveContext(ctx);
        const now = Date.now();
        // Propagate SNAPSHOT immediately or throttled TICK context every 2.5s so Research Engine holds fresh pricing without thrashing
        if (frame.type === 'SNAPSHOT' || now - lastParentPushRef.current > 2500) {
          lastParentPushRef.current = now;
          onChartTelemetryUpdate?.(ctx);
        }
      }
    });

    const unsubStatus = client.subscribeStatus((status) => {
      setStreamStatus(status);
    });

    client.connect();

    return () => {
      unsubFrames();
      unsubStatus();
      client.destroy();
      streamClientRef.current = null;
    };
  }, [canonicalSymbol, timeframe]);

  // Propagate indicator toggle changes cleanly into parent telemetry
  useEffect(() => {
    if (candles.length > 0) {
      const ctx = buildLiveContextFromCandles(candles, streamStatus.seqId, liveContext?.changePercent);
      if (ctx) {
        setLiveContext(ctx);
        onChartTelemetryUpdate?.(ctx);
      }
    }
  }, [enabledPlugins]);

  // Open symbol search query (unrestricted Yahoo Finance Search + curated catalog)
  useEffect(() => {
    if (!showSymbolSearch) return;
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/research/chart-telemetry?action=search&q=${encodeURIComponent(searchQuery)}`,
          { cache: 'no-store' }
        );
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSearchResults(data?.results || []);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showSymbolSearch]);

  useEffect(() => {
    if (showSymbolSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSymbolSearch]);

  const handleSelectInstrument = async (nextSymbolOrQuery: string) => {
    const clean = nextSymbolOrQuery.trim();
    if (!clean) return;
    const nextRes = liveChartTelemetryService.resolveSymbol(clean);
    setShowSymbolSearch(false);
    setSearchQuery('');

    try {
      const res = await fetch(
        `/api/research/chart-telemetry?symbol=${encodeURIComponent(nextRes.symbol)}&timeframe=${encodeURIComponent(timeframe)}&indicators=${encodeURIComponent(activeIndicatorKeys.join(','))}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.telemetry) {
          const t: ChartLiveContext = { ...json.telemetry, source: 'CHARTJS_WS_STREAM' };
          setLiveContext(t);
          onSymbolChange?.(nextRes.symbol, t);
          return;
        }
      }
    } catch {}
    onSymbolChange?.(nextRes.symbol);
  };

  const handleSelectTimeframe = async (nextTf: string) => {
    try {
      const res = await fetch(
        `/api/research/chart-telemetry?symbol=${encodeURIComponent(canonicalSymbol)}&timeframe=${encodeURIComponent(nextTf)}&indicators=${encodeURIComponent(activeIndicatorKeys.join(','))}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.telemetry) {
          const t: ChartLiveContext = { ...json.telemetry, source: 'CHARTJS_WS_STREAM' };
          setLiveContext(t);
          onTimeframeChange?.(nextTf, t);
          return;
        }
      }
    } catch {}
    onTimeframeChange?.(nextTf);
  };

  const togglePlugin = (id: string) => {
    setEnabledPlugins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const displayCandle = hoveredCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  const formatVal = (v?: number) => {
    if (v === undefined || !Number.isFinite(v)) return '--';
    return formatAssetPrice(v, resolved.assetClass, canonicalSymbol);
  };
  const enabledCount = Object.values(enabledPlugins).filter(Boolean).length;

  return (
    <div
      className={`relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-terminal-border bg-terminal-950 transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''
      }`}
      style={!isFullscreen ? { minHeight: height } : undefined}
    >
      {/* 1. Unrestricted Chart.js Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-terminal-900 border-b border-terminal-border text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Symbol Search Trigger */}
          <button
            type="button"
            onClick={() => setShowSymbolSearch(!showSymbolSearch)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-terminal-950 hover:bg-terminal-800 border border-cyan-500/40 text-white font-bold transition-colors shadow-sm"
            title="Search and switch chart instrument (instant Chart.js + Research Engine sync)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>{canonicalSymbol}</span>
            <span className="text-[10px] text-cyan-300 font-normal">({exchangeSymbol})</span>
          </button>

          {/* Timeframe Pills */}
          <div className="flex items-center bg-terminal-950 rounded-lg border border-terminal-border p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => handleSelectTimeframe(tf.id)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  timeframe.toLowerCase() === tf.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Modular Indicators & Vision Atlas Plugin Drawer Trigger */}
          {allowIndicatorsCustomization && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIndicatorsMenu(!showIndicatorsMenu)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                  showIndicatorsMenu
                    ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                    : 'bg-terminal-950 hover:bg-terminal-800 border-terminal-border text-slate-300'
                }`}
                title="Add/Remove Chart.js Technical Indicators & Vision Atlas Plugins"
              >
                <Layers className="w-3 h-3 text-cyan-400" />
                <span>Plugins & Vision Atlas ({enabledCount})</span>
              </button>

              {showIndicatorsMenu && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-terminal-900 border border-terminal-border rounded-xl shadow-2xl p-2 space-y-1 max-h-80 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-terminal-border/70 text-[10px] text-slate-400">
                    <span>CHART.JS MODULAR PLUGINS</span>
                    <button
                      type="button"
                      onClick={() => setShowIndicatorsMenu(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {MODULAR_PLUGINS.map((plg) => {
                    const isOn = !!enabledPlugins[plg.id];
                    return (
                      <button
                        key={plg.id}
                        type="button"
                        onClick={() => togglePlugin(plg.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] transition-colors ${
                          isOn
                            ? plg.category === 'VISION_ATLAS'
                              ? 'bg-indigo-950/70 text-cyan-300 border border-cyan-500/30'
                              : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                            : 'text-slate-400 hover:bg-terminal-800 hover:text-slate-200'
                        }`}
                      >
                        <div className="text-left">
                          <div>{plg.label}</div>
                          <div className="text-[9px] text-slate-500">{plg.category}</div>
                        </div>
                        {isOn && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Candles / Line Switcher */}
          <button
            type="button"
            onClick={() => setChartType(chartType === 'Candles' ? 'Line' : 'Candles')}
            className="px-2 py-1 rounded bg-terminal-950 hover:bg-terminal-800 border border-terminal-border text-[10px] text-slate-300 flex items-center gap-1"
            title="Toggle Candles / Line Series"
          >
            {chartType === 'Candles' ? (
              <>
                <CandlestickChart className="w-3 h-3 text-emerald-400" />
                <span>Candles</span>
              </>
            ) : (
              <>
                <BarChart3 className="w-3 h-3 text-cyan-400" />
                <span>Line</span>
              </>
            )}
          </button>

          {/* Reconnect Stream Trigger */}
          <button
            type="button"
            onClick={() => streamClientRef.current?.reconnect()}
            className="p-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white transition-colors"
            title="Reconnect WebSocket / SSE Stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${streamStatus.status === 'RECONNECTING' ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. High-Frequency WebSocket / SSE OHLCV & Active Indicator Telemetry Strip */}
      <div className="px-3 py-1 bg-terminal-950/95 border-b border-terminal-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{displayCandle ? formatVal(displayCandle.close) : '...'}</span>
          </span>
          {liveContext && (
            <span className={`font-bold ${liveContext.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({liveContext.changePercent >= 0 ? '+' : ''}{liveContext.changePercent}%)
            </span>
          )}
          {displayCandle && (
            <>
              <span className="text-slate-500">O:<span className="text-slate-300">{formatVal(displayCandle.open)}</span></span>
              <span className="text-slate-500">H:<span className="text-emerald-300">{formatVal(displayCandle.high)}</span></span>
              <span className="text-slate-500">L:<span className="text-rose-300">{formatVal(displayCandle.low)}</span></span>
              <span className="text-slate-500">C:<span className="text-white">{formatVal(displayCandle.close)}</span></span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-slate-400">
          {liveContext?.indicatorReadings?.rsi14 !== undefined && (
            <span>RSI:<strong className="text-cyan-300">{liveContext.indicatorReadings.rsi14}</strong></span>
          )}
          {liveContext?.indicatorReadings?.ema20 !== undefined && (
            <span>EMA20:<strong className="text-slate-200">{formatVal(liveContext.indicatorReadings.ema20)}</strong></span>
          )}
          {liveContext?.indicatorReadings?.atr14 !== undefined && (
            <span>ATR:<strong className="text-amber-300">{formatVal(liveContext.indicatorReadings.atr14)}</strong></span>
          )}
          <span
            className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${
              streamStatus.isConnected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
            title={streamStatus.protocol}
          >
            {streamStatus.status === 'LIVE_WS'
              ? `CHART.JS • WSS ${streamStatus.latencyMs}ms • #${streamStatus.seqId}`
              : streamStatus.status === 'LIVE_SSE'
              ? `CHART.JS • HF-STREAM ${streamStatus.latencyMs}ms • #${streamStatus.seqId}`
              : streamStatus.status}
          </span>
        </div>
      </div>

      {/* Circuit Breaker Alert Strip */}
      {streamStatus.lastError && (
        <div className="px-3 py-1 bg-amber-950/60 border-b border-amber-600/40 text-amber-300 text-[10px] font-mono flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>{streamStatus.lastError}</span>
          </span>
          <span className="text-slate-400">Filtered Ticks: {streamStatus.droppedTicks}</span>
        </div>
      )}

      {/* 3. Open Symbol Search Modal Dropdown */}
      {showSymbolSearch && (
        <div className="absolute top-11 left-3 z-50 w-80 sm:w-96 bg-terminal-900 border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
          <div className="p-2.5 border-b border-terminal-border flex items-center gap-2 bg-terminal-950">
            <Search className="w-4 h-4 text-cyan-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchResults.length > 0 && searchQuery.trim()) {
                    handleSelectInstrument(searchResults[0].symbol);
                  } else if (searchQuery.trim()) {
                    handleSelectInstrument(searchQuery);
                  }
                } else if (e.key === 'Escape') {
                  setShowSymbolSearch(false);
                }
              }}
              placeholder="Search any symbol (NVDA, XAU/USD, EUR/USD, BTC/USD, RELIANCE)..."
              className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder:text-slate-500"
            />
            {isSearching && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
            <button
              type="button"
              onClick={() => setShowSymbolSearch(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-terminal-border/40 custom-scrollbar">
            {searchResults.map((item) => (
              <button
                key={`${item.symbol}_${item.exchangeSymbol}`}
                type="button"
                onClick={() => handleSelectInstrument(item.symbol)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-terminal-800 text-left transition-colors"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{item.symbol}</span>
                    <span className="text-[10px] text-cyan-400 font-normal">{item.exchangeSymbol}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[210px]">{item.description}</div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-terminal-950 border border-terminal-border text-[9px] text-slate-300 uppercase">
                  {item.exchange}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Unrestricted Open-Source Chart.js Canvas Container */}
      <div className="relative flex-1 min-h-0 w-full bg-terminal-950">
        {candles.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 font-mono text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>CONNECTING HIGH-FREQUENCY STREAM TO CHART.JS CANVAS ({canonicalSymbol})...</span>
          </div>
        ) : (
          <QriChartJsCanvas
            candles={candles}
            symbol={canonicalSymbol}
            timeframe={timeframe}
            theme={theme}
            chartType={chartType}
            decimals={decimals}
            enabledPlugins={enabledPlugins}
            executionLevels={executionLevels}
            horizonCandles={6}
            showDrawingToolbar={true}
            showOscillatorPane={enabledPlugins.rsi_osc !== false}
            oscillatorType="RSI"
            onCrosshairCandle={setHoveredCandle}
          />
        )}
      </div>
    </div>
  );
});

ChartJsResearchChart.displayName = 'ChartJsResearchChart';
