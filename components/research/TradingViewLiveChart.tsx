/**
 * components/research/TradingViewLiveChart.tsx (Chart.js Migration)
 * Unrestricted Open-Source Chart.js v4 Live Chart with High-Frequency Streaming
 * and Modular Plugin Architecture (Vision Atlas + Technical Indicators + Trade Plan Overlays).
 *
 * Strictly scoped to the AI Multi-Agent Trading Research Engine.
 */

'use client';

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import {
  BarChart3,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
  Search,
  SlidersHorizontal,
  X,
  Check,
  Radio,
  CandlestickChart,
  Compass,
  Crosshair,
  RotateCcw,
} from 'lucide-react';
import { ChartLiveContext } from '@/lib/research/types';
import { formatAssetPrice, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';
import { calculateBollingerBands, calculateEMA } from '@/lib/indicators';
import { ensureDefaultChartPluginsRegistered } from '@/lib/chartjs/registerDefaultPlugins';
import { chartPluginRegistry } from '@/lib/chartjs/ChartPluginRegistry';
import { QriChartJsPluginData, TradePlanOverlayState } from '@/lib/chartjs/types';
import {
  HighFrequencyStreamClient,
  HighFrequencyTickPacket,
  StreamStatus,
} from '@/lib/streaming/HighFrequencyStreamEngine';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler
);
ensureDefaultChartPluginsRegistered();

export interface TradingViewLiveChartProps {
  symbol: string;
  timeframe?: string;
  theme?: 'dark' | 'light';
  height?: number;
  containerIdPrefix?: string;
  allowIndicatorsCustomization?: boolean;
  tradePlanOverlay?: TradePlanOverlayState;
  onSymbolChange?: (newSymbol: string, telemetry?: ChartLiveContext) => void;
  onTimeframeChange?: (newTimeframe: string, telemetry?: ChartLiveContext) => void;
  onChartTelemetryUpdate?: (telemetry: ChartLiveContext) => void;
}

export function mapToTradingViewSymbol(symbol: string): string {
  return liveChartTelemetryService.resolveSymbol(symbol).tvSymbol;
}

const AVAILABLE_INDICATORS = [
  { id: 'RSI', label: 'RSI (14)' },
  { id: 'EMA20', label: 'EMA 20' },
  { id: 'EMA50', label: 'EMA 50' },
  { id: 'EMA200', label: 'EMA 200' },
  { id: 'MACD', label: 'MACD (12, 26, 9)' },
  { id: 'BB', label: 'Bollinger Bands (20, 2)' },
  { id: 'STOCH', label: 'Stochastic (14, 3)' },
  { id: 'ATR', label: 'ATR (14)' },
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
  tvSymbol: string;
  description: string;
  exchange: string;
  type: string;
  currency: string;
}

export const ChartJsResearchChart: React.FC<TradingViewLiveChartProps> = memo(({
  symbol,
  timeframe = '1h',
  theme = 'dark',
  height = 520,
  allowIndicatorsCustomization = true,
  tradePlanOverlay,
  onSymbolChange,
  onTimeframeChange,
  onChartTelemetryUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'Candles' | 'Line'>('Candles');
  const [enableVisionAtlasPlugin, setEnableVisionAtlasPlugin] = useState<boolean>(true);
  const [enableTradePlanPlugin, setEnableTradePlanPlugin] = useState<boolean>(true);

  const [activeIndicators, setActiveIndicators] = useState<string[]>([
    'RSI',
    'EMA20',
    'EMA50',
    'EMA200',
    'MACD',
    'BB',
    'ATR',
  ]);
  const [showIndicatorsMenu, setShowIndicatorsMenu] = useState<boolean>(false);
  const [showSymbolSearch, setShowSymbolSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // High-Frequency Stream Telemetry State
  const [telemetry, setTelemetry] = useState<ChartLiveContext | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('CONNECTING');
  const [streamLatencyMs, setStreamLatencyMs] = useState<number>(8);
  const [visibleCount, setVisibleCount] = useState<number>(65);
  const [hoveredOhlc, setHoveredOhlc] = useState<{ o: number; h: number; l: number; c: number } | null>(null);

  const resolved = liveChartTelemetryService.resolveSymbol(symbol);
  const canonicalSymbol = resolved.symbol;
  const tvSymbol = resolved.tvSymbol;
  const priceDecimals = resolved.assetClass === 'FOREX' && !canonicalSymbol.includes('JPY')
    ? 5
    : canonicalSymbol.includes('JPY') || canonicalSymbol.includes('XAG')
    ? 3
    : 2;

  const lastPropagatedTsRef = useRef<number>(0);

  const convertPacketToContext = useCallback(
    (pkt: HighFrequencyTickPacket): ChartLiveContext => ({
      symbol: pkt.symbol,
      tvSymbol: pkt.tvSymbol,
      name: resolved.name,
      timeframe: pkt.timeframe,
      livePrice: pkt.livePrice,
      open: pkt.open,
      high: pkt.high,
      low: pkt.low,
      close: pkt.close,
      prevClose: pkt.prevClose,
      volume: pkt.volume,
      changePercent: pkt.changePercent,
      currency: pkt.currency,
      activeIndicators,
      indicatorReadings: pkt.indicatorReadings,
      recentCandles: pkt.candles,
      source: 'CHART_WIDGET_EVENT',
      timestamp: pkt.timestamp,
    }),
    [activeIndicators, resolved.name]
  );

  // 1. Subscribe to HighFrequencyStreamClient (WebSocket / High-Freq SSE)
  useEffect(() => {
    const client = HighFrequencyStreamClient.getInstance(canonicalSymbol, timeframe);

    const unsubStatus = client.subscribeStatus((st, _transport, lat) => {
      setStreamStatus(st);
      setStreamLatencyMs(lat);
    });

    const unsubTicks = client.subscribeTicks((pkt) => {
      setStreamLatencyMs(pkt.latencyMs);
      const ctx = convertPacketToContext(pkt);
      setTelemetry(ctx);

      // Propagate snapshot to Research Engine immediately on snapshot or every 2.5s cleanly
      const now = Date.now();
      if (pkt.type === 'SNAPSHOT' || now - lastPropagatedTsRef.current > 2500) {
        lastPropagatedTsRef.current = now;
        onChartTelemetryUpdate?.(ctx);
      }
    });

    return () => {
      unsubStatus();
      unsubTicks();
    };
  }, [canonicalSymbol, timeframe, convertPacketToContext, onChartTelemetryUpdate]);

  // 2. Symbol Search API query when search dropdown is open
  useEffect(() => {
    if (!showSymbolSearch) return;
    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
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
      clearTimeout(timeoutId);
    };
  }, [searchQuery, showSymbolSearch]);

  useEffect(() => {
    if (showSymbolSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [showSymbolSearch]);

  // 3. Initialize Unrestricted Chart.js Canvas with Modular Plugins
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
      } catch {}
      chartInstanceRef.current = null;
    }

    const isLight = theme === 'light';
    const modularPlugins = chartPluginRegistry.buildChartJsPlugins([
      'qriCandlestick',
      'qriVisionAtlasOverlay',
      'qriTradePlanOverlay',
    ]);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Price',
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
            fill: false,
          },
          {
            label: 'EMA 20',
            data: [],
            borderColor: '#38bdf8',
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'EMA 50',
            data: [],
            borderColor: '#f59e0b',
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'EMA 200',
            data: [],
            borderColor: '#a855f7',
            borderWidth: 1.2,
            borderDash: [4, 2],
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: 'BB Upper',
            data: [],
            borderColor: 'rgba(148, 163, 184, 0.45)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
          },
          {
            label: 'BB Lower',
            data: [],
            borderColor: 'rgba(148, 163, 184, 0.45)',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            fill: '-1',
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(9, 13, 22, 0.92)',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono, monospace', size: 10 },
            bodyFont: { family: 'JetBrains Mono, monospace', size: 10 },
          },
        } as any,
        scales: {
          x: {
            grid: { color: isLight ? 'rgba(203,213,225,0.4)' : 'rgba(30,41,59,0.5)' },
            ticks: {
              color: isLight ? '#475569' : '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 9 },
              maxTicksLimit: 9,
            },
          },
          y: {
            position: 'right',
            grid: { color: isLight ? 'rgba(203,213,225,0.4)' : 'rgba(30,41,59,0.5)' },
            ticks: {
              color: isLight ? '#334155' : '#94a3b8',
              font: { family: 'JetBrains Mono, monospace', size: 10 },
              callback: (value) => Number(value).toFixed(priceDecimals),
            },
          },
        },
      },
      plugins: modularPlugins,
    });

    chartInstanceRef.current = chart;

    return () => {
      try {
        chart.destroy();
      } catch {}
      chartInstanceRef.current = null;
    };
  }, [theme, priceDecimals]);

  // 4. Synchronize Streaming Data + Modular Plugins into Chart.js without Canvas Recreate
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !telemetry?.recentCandles || telemetry.recentCandles.length === 0) return;

    const sliced = telemetry.recentCandles.slice(-visibleCount);
    const closes = sliced.map((c) => c.close);
    const labels = sliced.map((c) => c.time || new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    const ema20Arr = activeIndicators.includes('EMA20') ? calculateEMA(closes, 20) : [];
    const ema50Arr = activeIndicators.includes('EMA50') ? calculateEMA(closes, Math.min(50, closes.length)) : [];
    const ema200Arr = activeIndicators.includes('EMA200') ? calculateEMA(closes, Math.min(200, closes.length)) : [];
    const bbObj = activeIndicators.includes('BB') ? calculateBollingerBands(closes, 20, 2) : null;

    chart.data.labels = labels;
    // Price line dataset visible only in Line mode; in Candles mode, CandlestickCanvasPlugin draws OHLC cleanly
    chart.data.datasets[0].data = closes;
    (chart.data.datasets[0] as any).borderColor = chartType === 'Line' ? '#06b6d4' : 'transparent';
    (chart.data.datasets[0] as any).fill = chartType === 'Line';

    chart.data.datasets[1].data = ema20Arr;
    chart.data.datasets[2].data = ema50Arr;
    chart.data.datasets[3].data = ema200Arr;
    chart.data.datasets[4].data = bbObj ? bbObj.upper : [];
    chart.data.datasets[5].data = bbObj ? bbObj.lower : [];

    // Compute clean y-bounds encompassing candles + active trade plan so nothing clips
    const allLows = sliced.map((c) => c.low);
    const allHighs = sliced.map((c) => c.high);
    if (enableTradePlanPlugin && tradePlanOverlay?.enabled) {
      if (tradePlanOverlay.stopLoss) allLows.push(tradePlanOverlay.stopLoss);
      if (tradePlanOverlay.target1) allHighs.push(tradePlanOverlay.target1);
    }
    const minY = Math.min(...allLows);
    const maxY = Math.max(...allHighs);
    const pad = Math.max((maxY - minY) * 0.08, minY * 0.001);
    if (chart.options.scales?.y) {
      chart.options.scales.y.min = minY - pad;
      chart.options.scales.y.max = maxY + pad;
    }

    const qriContext: QriChartJsPluginData = {
      candles: sliced.map((c) => ({
        time: c.time,
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      symbol: canonicalSymbol,
      timeframe,
      priceDecimals,
      chartType,
      theme,
      livePrice: telemetry.livePrice,
      indicators: {
        ema20: activeIndicators.includes('EMA20'),
        ema50: activeIndicators.includes('EMA50'),
        ema200: activeIndicators.includes('EMA200'),
        bollingerBands: activeIndicators.includes('BB'),
        rsi14: telemetry.indicatorReadings.rsi14,
        macdHistogram: telemetry.indicatorReadings.macdHistogram,
        atr14: telemetry.indicatorReadings.atr14,
        stochK: telemetry.indicatorReadings.stochK,
        stochD: telemetry.indicatorReadings.stochD,
      },
      visionAtlas: {
        enabled: enableVisionAtlasPlugin,
        showLabZones: true,
        showOrderBlocks: true,
        showBos: true,
        showChoch: true,
        showInternalStructure: true,
        showQuantumFan: true,
        showMarketDna: true,
        showLiquidityHeatmap: true,
      },
      tradePlan: enableTradePlanPlugin ? tradePlanOverlay : { enabled: false },
    };

    (chart.options.plugins as any).qriContext = qriContext;

    chart.options.onHover = (_evt, elements) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const bar = sliced[idx];
        if (bar) {
          setHoveredOhlc({ o: bar.open, h: bar.high, l: bar.low, c: bar.close });
        }
      } else {
        setHoveredOhlc(null);
      }
    };

    chart.update('none');
  }, [
    telemetry,
    visibleCount,
    chartType,
    activeIndicators,
    enableVisionAtlasPlugin,
    enableTradePlanPlugin,
    tradePlanOverlay,
    canonicalSymbol,
    timeframe,
    priceDecimals,
    theme,
  ]);

  const handleSelectInstrument = async (nextSymbolOrQuery: string) => {
    const clean = nextSymbolOrQuery.trim();
    if (!clean) return;
    const nextResolved = liveChartTelemetryService.resolveSymbol(clean);
    setShowSymbolSearch(false);
    setSearchQuery('');

    onSymbolChange?.(nextResolved.symbol);

    try {
      const res = await fetch(
        `/api/research/chart-telemetry?symbol=${encodeURIComponent(nextResolved.symbol)}&timeframe=${encodeURIComponent(timeframe)}&indicators=${encodeURIComponent(activeIndicators.join(','))}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.telemetry) {
          setTelemetry(data.telemetry);
          onChartTelemetryUpdate?.(data.telemetry);
          onSymbolChange?.(nextResolved.symbol, data.telemetry);
        }
      }
    } catch {}
  };

  const handleSelectTimeframe = async (nextTf: string) => {
    onTimeframeChange?.(nextTf);
    try {
      const res = await fetch(
        `/api/research/chart-telemetry?symbol=${encodeURIComponent(canonicalSymbol)}&timeframe=${encodeURIComponent(nextTf)}&indicators=${encodeURIComponent(activeIndicators.join(','))}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.telemetry) {
          setTelemetry(data.telemetry);
          onChartTelemetryUpdate?.(data.telemetry);
          onTimeframeChange?.(nextTf, data.telemetry);
        }
      }
    } catch {}
  };

  const toggleIndicator = (id: string) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const formatVal = (v?: number) => {
    if (v === undefined || !Number.isFinite(v)) return '--';
    return formatAssetPrice(v, resolved.assetClass, canonicalSymbol);
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    setVisibleCount((prev) => {
      const delta = e.deltaY > 0 ? 10 : -10;
      return Math.min(120, Math.max(20, prev + delta));
    });
  };

  return (
    <div
      style={{ height: isFullscreen ? undefined : height }}
      className={`relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-terminal-border bg-terminal-950 transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''
      }`}
    >
      {/* 1. Unrestricted Chart.js Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-terminal-900 border-b border-terminal-border text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interactive Symbol Search */}
          <button
            type="button"
            onClick={() => setShowSymbolSearch(!showSymbolSearch)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-terminal-950 hover:bg-terminal-800 border border-cyan-500/40 text-white font-bold transition-colors shadow-sm"
            title="Search any instrument (automatically syncs Chart.js stream, Research Engine & Chat Room)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>{canonicalSymbol}</span>
            <span className="text-[10px] text-cyan-300 font-normal">({tvSymbol})</span>
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

          {/* Editable Indicators Library */}
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
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                <span>fx Indicators ({activeIndicators.length})</span>
              </button>

              {showIndicatorsMenu && (
                <div className="absolute left-0 top-full mt-1.5 z-40 w-60 bg-terminal-900 border border-terminal-border rounded-xl shadow-2xl p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-terminal-border/70 text-[10px] text-slate-400">
                    <span>CHART.JS INDICATORS</span>
                    <button
                      type="button"
                      onClick={() => setShowIndicatorsMenu(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {AVAILABLE_INDICATORS.map((ind) => {
                    const isOn = activeIndicators.includes(ind.id);
                    return (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => toggleIndicator(ind.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] transition-colors ${
                          isOn
                            ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                            : 'text-slate-400 hover:bg-terminal-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{ind.label}</span>
                        {isOn && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Vision Atlas Proprietary Plugin Toggle */}
          <button
            type="button"
            onClick={() => setEnableVisionAtlasPlugin(!enableVisionAtlasPlugin)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
              enableVisionAtlasPlugin
                ? 'bg-purple-600/25 border-purple-500/50 text-purple-300'
                : 'bg-terminal-950 border-terminal-border text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle proprietary Vision Atlas SMC + Quantum Chart.js Plugin"
          >
            <Compass className="w-3 h-3" />
            <span>Vision Atlas</span>
          </button>

          {/* AI Trade Plan Overlay Plugin Toggle */}
          <button
            type="button"
            onClick={() => setEnableTradePlanPlugin(!enableTradePlanPlugin)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
              enableTradePlanPlugin
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-terminal-950 border-terminal-border text-slate-400 hover:text-slate-200'
            }`}
            title="Overlay AI Entry Zone, Stop Loss & Targets on Chart.js"
          >
            <Crosshair className="w-3 h-3" />
            <span>Levels</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Candles / Line Switch */}
          <button
            type="button"
            onClick={() => setChartType(chartType === 'Candles' ? 'Line' : 'Candles')}
            className="px-2 py-1 rounded bg-terminal-950 hover:bg-terminal-800 border border-terminal-border text-[10px] text-slate-300 flex items-center gap-1"
            title="Toggle Candles / Line rendering"
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

          <button
            type="button"
            onClick={() => setVisibleCount(65)}
            className="p-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
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

      {/* 2. High-Frequency WebSocket Stream & Live OHLCV Strip */}
      <div className="px-3 py-1 bg-terminal-950/95 border-b border-terminal-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{telemetry ? formatVal(hoveredOhlc?.c ?? telemetry.livePrice) : '...'}</span>
          </span>
          {telemetry && (
            <>
              <span className={`font-bold ${telemetry.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({telemetry.changePercent >= 0 ? '+' : ''}{telemetry.changePercent}%)
              </span>
              <span className="text-slate-500">O:<span className="text-slate-300">{formatVal(hoveredOhlc?.o ?? telemetry.open)}</span></span>
              <span className="text-slate-500">H:<span className="text-emerald-300">{formatVal(hoveredOhlc?.h ?? telemetry.high)}</span></span>
              <span className="text-slate-500">L:<span className="text-rose-300">{formatVal(hoveredOhlc?.l ?? telemetry.low)}</span></span>
              <span className="text-slate-500">C:<span className="text-white">{formatVal(hoveredOhlc?.c ?? telemetry.close)}</span></span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-slate-400">
          {telemetry?.indicatorReadings.rsi14 !== undefined && (
            <span>RSI: <strong className="text-cyan-300">{telemetry.indicatorReadings.rsi14}</strong></span>
          )}
          {telemetry?.indicatorReadings.ema20 !== undefined && (
            <span>EMA20: <strong className="text-slate-200">{formatVal(telemetry.indicatorReadings.ema20)}</strong></span>
          )}
          {telemetry?.indicatorReadings.atr14 !== undefined && (
            <span>ATR: <strong className="text-amber-300">{formatVal(telemetry.indicatorReadings.atr14)}</strong></span>
          )}
          <span className={`px-1.5 py-0.2 rounded border ${
            streamStatus === 'RECONNECTING' || streamStatus === 'DEGRADED'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          }`}>
            CHART.JS • {streamStatus === 'LIVE_WS' ? 'WS' : 'STREAM'} {streamLatencyMs}ms
          </span>
        </div>
      </div>

      {/* 3. Symbol Search Dropdown */}
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
              placeholder="Search ticker or name (e.g. NVDA, XAU/USD, EUR/USD)..."
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
                key={item.tvSymbol}
                type="button"
                onClick={() => handleSelectInstrument(item.symbol)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-terminal-800 text-left transition-colors"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{item.symbol}</span>
                    <span className="text-[10px] text-cyan-400 font-normal">{item.tvSymbol}</span>
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

      {/* 4. Unrestricted Open-Source Chart.js Canvas Viewport */}
      <div
        onWheel={handleWheelZoom}
        className="relative flex-1 min-h-0 w-full bg-terminal-950 p-1.5"
      >
        {!telemetry && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-terminal-950/90 text-cyan-400 font-mono text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>INITIALIZING CHART.JS STREAMING FEED ({canonicalSymbol})...</span>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
});

ChartJsResearchChart.displayName = 'ChartJsResearchChart';

// Export backwards-compatible symbol alias for existing Research Engine imports
export const TradingViewLiveChart = ChartJsResearchChart;
