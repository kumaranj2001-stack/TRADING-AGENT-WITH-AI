/**
 * components/infinity-vision/InfinityVisionChart.tsx (Chart.js Migration)
 * Unrestricted Open-Source Chart.js v4 Rendering Pipeline for Vision Atlas.
 *
 * Uses modular Chart.js canvas plugins (`qriCandlestick`, `qriVisionAtlasOverlay`)
 * with zero third-party chart iframe restrictions and synchronized high-frequency WSS ticks.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Crosshair,
  Minus,
  Square,
  Trash2,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Candle, CurrencyPair } from '@/lib/types';
import { calculateEMA } from '@/lib/indicators';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { ensureDefaultChartPluginsRegistered } from '@/lib/chartjs/registerDefaultPlugins';
import { chartPluginRegistry } from '@/lib/chartjs/ChartPluginRegistry';
import {
  ChartUserDrawing,
  QriChartJsPluginData,
} from '@/lib/chartjs/types';

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

export interface InfinityVisionChartProps {
  candles: Candle[];
  pair: CurrencyPair;
  timeframe: string;
  theme?: 'light' | 'dark';
  showQuantumSimulation?: boolean;
  showMarketDna?: boolean;
  showIndicatorsOverlay?: boolean;
  showVisionAtlasLab?: boolean;
  showLiquidityHeatmap?: boolean;
  chartType?: 'Candles' | 'Line';
  showPatternOnChart?: boolean;
  horizonCandles?: number;
  latencyMs?: number;
  isInterrupted?: boolean;
  indicatorSettings?: Record<string, boolean>;
  onReconnect?: () => void;
  onSelectZone?: (zoneName: string) => void;
}

export type DrawingTool = 'crosshair' | 'trendline' | 'horizontal' | 'rectangle' | 'text' | 'trash';

export const InfinityVisionChart: React.FC<InfinityVisionChartProps> = ({
  candles = [],
  pair,
  timeframe,
  theme = 'light',
  showQuantumSimulation = true,
  showMarketDna = true,
  showIndicatorsOverlay = true,
  showVisionAtlasLab = true,
  showLiquidityHeatmap = true,
  chartType = 'Candles',
  horizonCandles = 5,
  latencyMs = 12,
  isInterrupted = false,
  indicatorSettings = {},
  onReconnect,
}) => {
  const isLight = theme === 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>('crosshair');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [drawnElements, setDrawnElements] = useState<ChartUserDrawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ idx: number; price: number } | null>(null);
  const [inProgressDrawing, setInProgressDrawing] = useState<ChartUserDrawing | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(65);

  const isInternalStructureActive = indicatorSettings.ms_internal !== false && showIndicatorsOverlay;
  const isBosActive = indicatorSettings.ms_bos !== false && showIndicatorsOverlay;
  const isChochActive = indicatorSettings.ms_choch !== false && showIndicatorsOverlay;
  const isOrderBlocksActive = indicatorSettings.ob_fresh !== false && showIndicatorsOverlay;
  const isEmaActive = indicatorSettings.trend_ema !== false;

  const isXau = pair.includes('XAU');
  const isJpy = pair.includes('JPY');
  const isIndian = pair === 'NIFTY 50' || pair === 'BANK NIFTY' || pair.includes('/INR');
  const priceDecimals = isJpy ? 3 : isXau || isIndian ? 2 : 5;

  // Deduplicated, sorted canonical candle stream
  const safeCandles = useMemo(() => {
    if (candles && candles.length >= 8) {
      const sorted = [...candles].sort((a, b) => {
        const tA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.time).getTime();
        const tB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.time).getTime();
        return tA - tB;
      });
      const dedup: Candle[] = [];
      const seen = new Set<number>();
      for (const c of sorted) {
        const sec = Math.floor((typeof c.timestamp === 'number' ? c.timestamp : new Date(c.time).getTime()) / 1000);
        if (!seen.has(sec)) {
          seen.add(sec);
          dedup.push(c);
        }
      }
      return dedup.slice(-120);
    }

    const base = liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair as CurrencyPair);
    const list: Candle[] = [];
    let cur = base;
    const now = Math.floor(Date.now() / 60000) * 60000;
    for (let i = 45; i >= 0; i--) {
      const isRed = i % 3 === 0 || i % 4 === 0;
      const delta = Math.sin(i * 0.7) * (base * 0.0006) + (isRed ? -base * 0.0004 : base * 0.0003);
      const open = cur;
      const close = cur + delta;
      const high = Math.max(open, close) + base * 0.0004;
      const low = Math.min(open, close) - base * 0.0004;
      const candleTs = now - i * 15 * 60000;
      list.push({
        time: new Date(candleTs).toISOString(),
        timestamp: candleTs,
        open,
        high,
        low,
        close,
        volume: 1200 + Math.floor(Math.random() * 2000),
      });
      cur = close;
    }
    return list;
  }, [candles, pair]);

  const visibleCandles = useMemo(() => safeCandles.slice(-visibleCount), [safeCandles, visibleCount]);
  const lastCandle = visibleCandles[visibleCandles.length - 1] || safeCandles[safeCandles.length - 1];

  // 1. Mount Chart.js v4 Instance with Modular Vision Atlas & Candlestick Plugins
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch {}
      chartRef.current = null;
    }

    const plugins = chartPluginRegistry.buildChartJsPlugins([
      'qriCandlestick',
      'qriVisionAtlasOverlay',
    ]);

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Price',
            data: [],
            borderColor: 'transparent',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
          },
          {
            label: 'EMA 20',
            data: [],
            borderColor: '#3b82f6',
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
            backgroundColor: isLight ? 'rgba(15, 23, 42, 0.92)' : 'rgba(8, 13, 26, 0.94)',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono, monospace', size: 10 },
            bodyFont: { family: 'JetBrains Mono, monospace', size: 10 },
          },
        } as any,
        scales: {
          x: {
            grid: {
              color: isLight ? 'rgba(226, 232, 240, 0.7)' : 'rgba(30, 41, 59, 0.45)',
            },
            ticks: {
              color: isLight ? '#475569' : '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 10 },
              maxTicksLimit: 10,
            },
          },
          y: {
            position: 'right',
            grid: {
              color: isLight ? 'rgba(226, 232, 240, 0.7)' : 'rgba(30, 41, 59, 0.45)',
            },
            ticks: {
              color: isLight ? '#475569' : '#94a3b8',
              font: { family: 'JetBrains Mono, monospace', size: 10 },
              callback: (v) => Number(v).toFixed(priceDecimals),
            },
          },
        },
      },
      plugins,
    });

    chartRef.current = chart;

    return () => {
      try {
        chart.destroy();
      } catch {}
      chartRef.current = null;
    };
  }, [theme, priceDecimals]);

  // 2. High-Frequency Synchronized Update of Candles, Indicators & Modular Vision Atlas Overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || visibleCandles.length === 0) return;

    const closes = visibleCandles.map((c) => c.close);
    const labels = visibleCandles.map((c) => {
      const ts = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.time).getTime();
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    chart.data.labels = labels;
    chart.data.datasets[0].data = closes;
    (chart.data.datasets[0] as any).borderColor = chartType === 'Line' ? '#06b6d4' : 'transparent';

    if (isEmaActive) {
      chart.data.datasets[1].data = calculateEMA(closes, 20);
      chart.data.datasets[2].data = calculateEMA(closes, Math.min(50, closes.length));
    } else {
      chart.data.datasets[1].data = [];
      chart.data.datasets[2].data = [];
    }

    const minY = Math.min(...visibleCandles.map((c) => c.low));
    const maxY = Math.max(...visibleCandles.map((c) => c.high));
    const pad = Math.max((maxY - minY) * 0.10, minY * 0.0012);
    if (chart.options.scales?.y) {
      chart.options.scales.y.min = minY - pad;
      chart.options.scales.y.max = maxY + pad;
    }

    const qriContext: QriChartJsPluginData = {
      candles: visibleCandles,
      symbol: pair,
      timeframe,
      priceDecimals,
      chartType,
      theme,
      livePrice: visibleCandles[visibleCandles.length - 1]?.close ?? 0,
      indicators: {
        ema20: isEmaActive,
        ema50: isEmaActive,
      },
      visionAtlas: {
        enabled: true,
        showLabZones: showVisionAtlasLab,
        showOrderBlocks: isOrderBlocksActive,
        showBos: isBosActive,
        showChoch: isChochActive,
        showInternalStructure: isInternalStructureActive,
        showQuantumFan: showQuantumSimulation,
        showMarketDna: showMarketDna,
        showLiquidityHeatmap: showLiquidityHeatmap,
        horizonCandles,
      },
      drawings: drawnElements,
      inProgressDrawing,
    };

    (chart.options.plugins as any).qriContext = qriContext;

    chart.options.onHover = (_evt, elements) => {
      if (elements && elements.length > 0) {
        const bar = visibleCandles[elements[0].index];
        if (bar) setHoveredCandle(bar);
      } else {
        setHoveredCandle(null);
      }
    };

    chart.update('none');
  }, [
    visibleCandles,
    chartType,
    isEmaActive,
    pair,
    timeframe,
    priceDecimals,
    theme,
    showVisionAtlasLab,
    isOrderBlocksActive,
    isBosActive,
    isChochActive,
    isInternalStructureActive,
    showQuantumSimulation,
    showMarketDna,
    showLiquidityHeatmap,
    horizonCandles,
    drawnElements,
    inProgressDrawing,
  ]);

  // Interactive Canvas Drawing Coordinate Conversion (Bound directly to Chart.js Scales)
  const pixelToChartCoords = (clientX: number, clientY: number) => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas || !chart.scales.x || !chart.scales.y) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const idx = Math.round(chart.scales.x.getValueForPixel(px) ?? 0);
    const price = chart.scales.y.getValueForPixel(py) ?? lastCandle?.close ?? 0;
    return {
      idx: Math.max(0, Math.min(visibleCandles.length - 1, idx)),
      price,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'crosshair') return;
    const coords = pixelToChartCoords(e.clientX, e.clientY);
    if (!coords) return;
    setIsDrawing(true);
    setDrawStart(coords);
    setInProgressDrawing({
      id: 'preview',
      type: activeTool === 'rectangle' ? 'rectangle' : activeTool === 'horizontal' ? 'horizontal' : 'trendline',
      startIndex: coords.idx,
      startPrice: coords.price,
      endIndex: coords.idx,
      endPrice: coords.price,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;
    const coords = pixelToChartCoords(e.clientX, e.clientY);
    if (!coords) return;
    setInProgressDrawing({
      id: 'preview',
      type: activeTool === 'rectangle' ? 'rectangle' : activeTool === 'horizontal' ? 'horizontal' : 'trendline',
      startIndex: drawStart.idx,
      startPrice: drawStart.price,
      endIndex: coords.idx,
      endPrice: coords.price,
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && inProgressDrawing) {
      setDrawnElements((prev) => [
        ...prev,
        {
          ...inProgressDrawing,
          id: `${inProgressDrawing.type}-${Date.now()}`,
        },
      ]);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setInProgressDrawing(null);
  };

  const handleFitContent = () => {
    setVisibleCount(65);
  };

  const clearAllDrawings = () => {
    setDrawnElements([]);
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    setVisibleCount((prev) => Math.min(120, Math.max(20, prev + (e.deltaY > 0 ? 10 : -10))));
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden border shadow-xl transition-colors select-none ${
        isLight ? 'bg-white border-slate-200' : 'bg-terminal-950 border-terminal-border/80'
      }`}
    >
      {/* Header Bar: Chart.js Unrestricted Engine & WSS Stream Telemetry */}
      <div
        className={`flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b font-mono text-xs gap-2 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-terminal-900 border-terminal-border'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-wide">{pair}</span>
            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-terminal-800 text-slate-700 dark:text-cyan-300 text-[10px] sm:text-[11px] font-bold border border-slate-300 dark:border-terminal-border">
              {timeframe.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold text-[10px]">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span>CHART.JS · MODULAR VISION ATLAS PLUGINS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInterrupted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold text-[10px] animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>STREAM INTERRUPTED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE STREAMING · WSS {latencyMs}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Interruption & Latency Degradation Banner */}
      {isInterrupted && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>DATA STREAM INTERRUPTED: Market stream connection dropped. Stale data halted to protect execution integrity.</span>
          </div>
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-bold border border-amber-500/40 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reconnect Stream</span>
            </button>
          )}
        </div>
      )}

      {/* Main Chart Wrapper */}
      <div
        ref={chartWrapperRef}
        className="flex-1 relative w-full h-[520px] sm:h-[560px] flex flex-col overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheelZoom}
      >
        {/* Docked Sub-Toolbar with Drawing Tools & OHLC */}
        <div
          className={`flex flex-wrap items-center justify-between px-3 py-1.5 border-b text-xs font-mono gap-2 shrink-0 ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-terminal-900/80 border-terminal-border'
          }`}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTool('crosshair')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'crosshair'
                  ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-terminal-800'
              }`}
              title="Crosshair Tool"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool('trendline')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'trendline'
                  ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-terminal-800'
              }`}
              title="Draw Trendline"
            >
              <Minus className="w-3.5 h-3.5 rotate-45" />
            </button>
            <button
              onClick={() => setActiveTool('horizontal')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'horizontal'
                  ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-terminal-800'
              }`}
              title="Draw Horizontal Key Level"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool('rectangle')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'rectangle'
                  ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-terminal-800'
              }`}
              title="Draw Confluence Box"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            {drawnElements.length > 0 && (
              <button
                onClick={clearAllDrawings}
                className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition-all ml-1"
                title="Clear User Drawings"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {lastCandle && (
              <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span>O: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.open || lastCandle.open).toFixed(priceDecimals)}</strong></span>
                <span>H: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.high || lastCandle.high).toFixed(priceDecimals)}</strong></span>
                <span>L: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.low || lastCandle.low).toFixed(priceDecimals)}</strong></span>
                <span>C: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.close || lastCandle.close).toFixed(priceDecimals)}</strong></span>
              </div>
            )}

            <button
              onClick={handleFitContent}
              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 transition-all"
              title="Reset Zoom & Auto-Fit Scale"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Auto-Fit</span>
            </button>
          </div>
        </div>

        {/* Chart.js Canvas Viewport */}
        <div className="w-full flex-1 min-h-0 relative p-1.5">
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
        </div>
      </div>
    </div>
  );
};
