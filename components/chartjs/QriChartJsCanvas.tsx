/**
 * components/chartjs/QriChartJsCanvas.tsx
 * Core Unrestricted Open-Source Chart.js Financial Canvas Engine.
 *
 * Renders high-DPI OHLC Candlesticks / Line, synchronized Chart.js Modular Plugins
 * (Vision Atlas SMC/OB/FVG, Lab Zones, Golden Pocket, Quantum Fan, Liquidity Walls,
 * EMA Ribbon, Bollinger Bands, VWAP, Execution Blueprint, Coordinate-Locked User Drawings),
 * interactive Zoom/Pan, Crosshair HUD, and optional synchronized RSI/MACD Oscillator sub-canvas.
 *
 * Uses requestAnimationFrame coalescing + chart.update('none') for zero-lag high-frequency streaming.
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import {
  Crosshair,
  Minus,
  Square,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { ensureDefaultChartJsPluginsRegistered } from '@/lib/chartjs/plugins';
import { computeVisionAtlasOverlays } from '@/lib/chartjs/computeVisionAtlasOverlays';
import {
  ChartJsCandleBar,
  ChartJsExecutionLevels,
  ChartJsPluginRenderState,
  DrawnChartShape,
} from '@/lib/chartjs/types';

export type ChartDrawingTool = 'crosshair' | 'trendline' | 'horizontal' | 'rectangle';

export interface QriChartJsCanvasProps {
  candles: ChartJsCandleBar[];
  symbol: string;
  timeframe: string;
  theme?: 'dark' | 'light';
  chartType?: 'Candles' | 'Line';
  decimals?: number;
  enabledPlugins: Record<string, boolean>;
  executionLevels?: ChartJsExecutionLevels;
  horizonCandles?: number;
  showDrawingToolbar?: boolean;
  showOscillatorPane?: boolean;
  oscillatorType?: 'RSI' | 'MACD';
  onCrosshairCandle?: (candle: ChartJsCandleBar | null) => void;
}

export const QriChartJsCanvas: React.FC<QriChartJsCanvasProps> = ({
  candles = [],
  symbol,
  timeframe,
  theme = 'dark',
  chartType = 'Candles',
  decimals = 2,
  enabledPlugins,
  executionLevels,
  horizonCandles = 6,
  showDrawingToolbar = false,
  showOscillatorPane = true,
  oscillatorType = 'RSI',
  onCrosshairCandle,
}) => {
  const isLight = theme === 'light';
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const oscCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainChartRef = useRef<Chart<any> | null>(null);
  const oscChartRef = useRef<Chart<any> | null>(null);
  const rafPendingRef = useRef<number | null>(null);

  const [viewWindow, setViewWindow] = useState<{ start: number; end: number } | null>(null);
  const [activeTool, setActiveTool] = useState<ChartDrawingTool>('crosshair');
  const [drawnShapes, setDrawnShapes] = useState<DrawnChartShape[]>([]);
  const [inProgressShape, setInProgressShape] = useState<DrawnChartShape | null>(null);
  const [hoveredBar, setHoveredBar] = useState<ChartJsCandleBar | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ xPixel: number; yPixel: number; barIndex: number; price: number; windowStart: number; windowEnd: number } | null>(null);

  // Compute synchronous overlays anchored strictly to current live candles
  const overlays = useMemo(() => {
    return computeVisionAtlasOverlays(candles, decimals, horizonCandles);
  }, [candles, decimals, horizonCandles]);

  const showQuantumSpace = enabledPlugins?.quantum_vision === true;
  const futurePad = showQuantumSpace ? horizonCandles + 2 : 2;
  const totalCount = candles.length;
  const defaultStart = Math.max(0, totalCount - 65);
  const defaultEnd = Math.max(10, totalCount - 1 + futurePad);

  const activeStart = viewWindow ? Math.max(0, Math.min(viewWindow.start, Math.max(0, totalCount - 8))) : defaultStart;
  const activeEnd = viewWindow ? Math.max(activeStart + 8, viewWindow.end) : defaultEnd;

  // Reset pan/zoom window smoothly on symbol or timeframe switch
  useEffect(() => {
    setViewWindow(null);
    setDrawnShapes([]);
  }, [symbol, timeframe]);

  // Compute tightly fitted Y bounds across visible candles + active indicators + execution levels
  const yBounds = useMemo(() => {
    const startIdx = Math.max(0, Math.floor(activeStart));
    const endIdx = Math.min(candles.length - 1, Math.ceil(activeEnd));
    const visible = candles.slice(startIdx, endIdx + 1);
    if (visible.length === 0) return { min: 0, max: 100 };

    let minY = Math.min(...visible.map((c) => c.low));
    let maxY = Math.max(...visible.map((c) => c.high));

    if (enabledPlugins?.bb && overlays.bbLower.length === candles.length) {
      for (let i = startIdx; i <= endIdx; i++) {
        if (overlays.bbLower[i] < minY) minY = overlays.bbLower[i];
        if (overlays.bbUpper[i] > maxY) maxY = overlays.bbUpper[i];
      }
    }
    if (enabledPlugins?.quantum_vision && overlays.quantumFan.length > 0) {
      for (const q of overlays.quantumFan) {
        if (q.lowerPrice < minY) minY = q.lowerPrice;
        if (q.upperPrice > maxY) maxY = q.upperPrice;
      }
    }
    if (enabledPlugins?.execution_blueprint !== false && executionLevels) {
      if (executionLevels.stopLoss && Math.abs(executionLevels.stopLoss - overlays.anchorPrice) / Math.max(overlays.anchorPrice, 1) < 0.25) {
        minY = Math.min(minY, executionLevels.stopLoss);
        maxY = Math.max(maxY, executionLevels.stopLoss);
      }
      if (executionLevels.takeProfit1 && Math.abs(executionLevels.takeProfit1 - overlays.anchorPrice) / Math.max(overlays.anchorPrice, 1) < 0.25) {
        minY = Math.min(minY, executionLevels.takeProfit1);
        maxY = Math.max(maxY, executionLevels.takeProfit1);
      }
      if (executionLevels.takeProfit2 && Math.abs(executionLevels.takeProfit2 - overlays.anchorPrice) / Math.max(overlays.anchorPrice, 1) < 0.25) {
        minY = Math.min(minY, executionLevels.takeProfit2);
        maxY = Math.max(maxY, executionLevels.takeProfit2);
      }
    }

    const span = Math.max(maxY - minY, overlays.anchorPrice * 0.002, 0.0001);
    return {
      min: minY - span * 0.14,
      max: maxY + span * 0.14,
    };
  }, [candles, activeStart, activeEnd, enabledPlugins, overlays, executionLevels]);

  const latestPluginStateRef = useRef<ChartJsPluginRenderState | null>(null);
  latestPluginStateRef.current = {
    candles,
    overlays,
    enabledPlugins,
    chartType,
    theme,
    decimals,
    symbol,
    executionLevels,
    drawnShapes,
    inProgressShape,
    crosshair: null,
  };

  // Mount & Re-bind Main Chart.js Instance (runs once per mount/theme)
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const registry = ensureDefaultChartJsPluginsRegistered();

    if (mainChartRef.current) {
      mainChartRef.current.destroy();
      mainChartRef.current = null;
    }

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: symbol,
            data: [],
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.1,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        layout: {
          padding: { top: 8, bottom: 4, left: 4, right: 64 },
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          qriState: latestPluginStateRef.current,
        } as any,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 60,
            grid: {
              color: isLight ? 'rgba(203, 213, 225, 0.55)' : 'rgba(30, 41, 59, 0.45)',
            },
            ticks: {
              color: isLight ? '#475569' : '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 9.5 },
              maxTicksLimit: 9,
              callback: (val: any) => {
                const idx = Math.round(Number(val));
                const bar = latestPluginStateRef.current?.candles?.[idx];
                if (bar) return bar.time;
                if (idx >= (latestPluginStateRef.current?.candles?.length || 0)) {
                  const diff = idx - ((latestPluginStateRef.current?.candles?.length || 1) - 1);
                  return `+${diff}`;
                }
                return '';
              },
            },
          },
          y: {
            type: 'linear',
            position: 'right',
            grid: {
              color: isLight ? 'rgba(203, 213, 225, 0.55)' : 'rgba(30, 41, 59, 0.45)',
            },
            ticks: {
              color: isLight ? '#334155' : '#94a3b8',
              font: { family: 'JetBrains Mono, monospace', size: 10 },
              callback: (val: any) => Number(val).toFixed(decimals),
            },
          },
        },
      },
      plugins: registry.getOrderedPlugins(),
    });

    mainChartRef.current = chart;

    return () => {
      if (rafPendingRef.current !== null) {
        cancelAnimationFrame(rafPendingRef.current);
      }
      chart.destroy();
      mainChartRef.current = null;
    };
  }, [theme, decimals, symbol]);

  // Mount & Re-bind Synchronized Oscillator Sub-Canvas (RSI-14 / MACD)
  const isOscEnabled =
    showOscillatorPane &&
    (enabledPlugins?.rsi_osc !== false || enabledPlugins?.macd_osc === true);

  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas || !isOscEnabled) {
      if (oscChartRef.current) {
        oscChartRef.current.destroy();
        oscChartRef.current = null;
      }
      return;
    }

    if (oscChartRef.current) {
      oscChartRef.current.destroy();
      oscChartRef.current = null;
    }

    const oscChart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: oscillatorType,
            data: [],
            borderColor: '#a855f7',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
          },
          {
            label: 'UpperRef',
            data: [],
            borderColor: 'rgba(239, 68, 68, 0.45)',
            borderDash: [3, 3],
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: 'LowerRef',
            data: [],
            borderColor: 'rgba(16, 185, 129, 0.45)',
            borderDash: [3, 3],
            borderWidth: 1,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        layout: { padding: { top: 4, bottom: 2, left: 4, right: 64 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 60,
            display: false,
          },
          y: {
            type: 'linear',
            position: 'right',
            min: oscillatorType === 'RSI' ? 10 : undefined,
            max: oscillatorType === 'RSI' ? 90 : undefined,
            grid: { color: isLight ? 'rgba(203, 213, 225, 0.4)' : 'rgba(30, 41, 59, 0.35)' },
            ticks: {
              color: isLight ? '#475569' : '#94a3b8',
              font: { family: 'JetBrains Mono, monospace', size: 9 },
              maxTicksLimit: 3,
            },
          },
        },
      },
    });

    oscChartRef.current = oscChart;

    return () => {
      oscChart.destroy();
      oscChartRef.current = null;
    };
  }, [theme, isOscEnabled, oscillatorType]);

  // High-Frequency Synchronous Frame Flush via requestAnimationFrame (`update('none')`)
  useEffect(() => {
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
    }

    rafPendingRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = null;
      const chart = mainChartRef.current;
      if (chart) {
        const lineData =
          chartType === 'Line'
            ? candles.map((c, idx) => ({ x: idx, y: c.close }))
            : []; // Hidden baseline anchor in Candle mode (qriCandlestickPlugin renders actual OHLC bodies cleanly)

        chart.data.datasets[0].data = lineData as any;
        chart.data.datasets[0].label = symbol;
        if (chart.options.scales?.x) {
          chart.options.scales.x.min = activeStart;
          chart.options.scales.x.max = activeEnd;
        }
        if (chart.options.scales?.y) {
          chart.options.scales.y.min = yBounds.min;
          chart.options.scales.y.max = yBounds.max;
        }

        const existingCrosshair = (chart.options.plugins as any)?.qriState?.crosshair || null;
        (chart.options.plugins as any).qriState = {
          ...latestPluginStateRef.current,
          crosshair: existingCrosshair,
        };
        chart.update('none');
      }

      const osc = oscChartRef.current;
      if (osc && isOscEnabled && candles.length > 0) {
        const seriesArr =
          oscillatorType === 'MACD' ? overlays.macdHistogram : overlays.rsi14;
        const pts = seriesArr.map((v, idx) => ({ x: idx, y: v }));
        osc.data.datasets[0].data = pts as any;
        osc.data.datasets[0].borderColor = oscillatorType === 'MACD' ? '#06b6d4' : '#a855f7';

        if (oscillatorType === 'RSI') {
          osc.data.datasets[1].data = [
            { x: activeStart, y: 70 },
            { x: activeEnd, y: 70 },
          ] as any;
          osc.data.datasets[2].data = [
            { x: activeStart, y: 30 },
            { x: activeEnd, y: 30 },
          ] as any;
        } else {
          osc.data.datasets[1].data = [
            { x: activeStart, y: 0 },
            { x: activeEnd, y: 0 },
          ] as any;
          osc.data.datasets[2].data = [];
        }

        if (osc.options.scales?.x) {
          osc.options.scales.x.min = activeStart;
          osc.options.scales.x.max = activeEnd;
        }
        osc.update('none');
      }
    });
  }, [
    candles,
    overlays,
    enabledPlugins,
    chartType,
    activeStart,
    activeEnd,
    yBounds,
    executionLevels,
    drawnShapes,
    inProgressShape,
    isOscEnabled,
    oscillatorType,
    symbol,
  ]);

  // Coordinate Conversion & Pointer Event Handlers (Pan, Zoom, Crosshair, Data-Pinned Drawing)
  const getCoordsFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const chart = mainChartRef.current;
    const canvas = mainCanvasRef.current;
    if (!chart || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const xPixel = e.clientX - rect.left;
    const yPixel = e.clientY - rect.top;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return null;

    const rawBar = xScale.getValueForPixel(xPixel) ?? 0;
    const barIndex = Math.round(rawBar);
    const price = yScale.getValueForPixel(yPixel) ?? overlays.anchorPrice;
    return { xPixel, yPixel, rawBar, barIndex, price };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = getCoordsFromEvent(e);
    if (!c) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      xPixel: c.xPixel,
      yPixel: c.yPixel,
      barIndex: c.barIndex,
      price: c.price,
      windowStart: activeStart,
      windowEnd: activeEnd,
    };

    if (activeTool === 'horizontal') {
      setDrawnShapes((prev) => [
        ...prev,
        {
          id: `h_${Date.now()}`,
          type: 'horizontal',
          startIndex: 0,
          startPrice: c.price,
          endIndex: candles.length,
          endPrice: c.price,
          color: '#06b6d4',
        },
      ]);
      isDraggingRef.current = false;
    } else if (activeTool === 'trendline' || activeTool === 'rectangle') {
      setInProgressShape({
        id: 'draft',
        type: activeTool,
        startIndex: c.barIndex,
        startPrice: c.price,
        endIndex: c.barIndex,
        endPrice: c.price,
        color: activeTool === 'trendline' ? '#10b981' : '#06b6d4',
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = getCoordsFromEvent(e);
    const chart = mainChartRef.current;
    if (!c || !chart) return;

    const clampedIdx = Math.max(0, Math.min(candles.length - 1, c.barIndex));
    const matchedBar = candles[clampedIdx] || null;
    setHoveredBar(matchedBar);
    onCrosshairCandle?.(matchedBar);

    if ((chart.options.plugins as any)?.qriState) {
      (chart.options.plugins as any).qriState.crosshair = {
        xPixel: c.xPixel,
        yPixel: c.yPixel,
        barIndex: clampedIdx,
        price: c.price,
      };
      chart.update('none');
    }

    if (isDraggingRef.current && dragStartRef.current) {
      if (activeTool === 'crosshair') {
        const dxPx = c.xPixel - dragStartRef.current.xPixel;
        const chartWidth = Math.max(100, chart.chartArea.right - chart.chartArea.left);
        const span = dragStartRef.current.windowEnd - dragStartRef.current.windowStart;
        const shiftBars = (dxPx / chartWidth) * span;
        const nextStart = Math.max(0, Math.min(Math.max(0, totalCount - 8), dragStartRef.current.windowStart - shiftBars));
        const nextEnd = nextStart + span;
        setViewWindow({ start: nextStart, end: nextEnd });
      } else if (inProgressShape) {
        setInProgressShape({
          ...inProgressShape,
          endIndex: c.barIndex,
          endPrice: c.price,
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (inProgressShape) {
      setDrawnShapes((prev) => [
        ...prev,
        { ...inProgressShape, id: `shape_${Date.now()}` },
      ]);
      setInProgressShape(null);
    }
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  const handleMouseLeave = () => {
    setHoveredBar(null);
    onCrosshairCandle?.(null);
    const chart = mainChartRef.current;
    if (chart && (chart.options.plugins as any)?.qriState) {
      (chart.options.plugins as any).qriState.crosshair = null;
      chart.update('none');
    }
    if (isDraggingRef.current && activeTool === 'crosshair') {
      isDraggingRef.current = false;
      dragStartRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (candles.length < 10) return;
    const span = activeEnd - activeStart;
    const zoomFactor = e.deltaY > 0 ? 1.12 : 0.88;
    const nextSpan = Math.max(12, Math.min(candles.length + 20, span * zoomFactor));
    const nextStart = Math.max(0, activeEnd - nextSpan);
    setViewWindow({ start: nextStart, end: activeEnd });
  };

  const displayBar = hoveredBar || candles[candles.length - 1];

  return (
    <div className="w-full h-full flex flex-col min-h-0 select-none">
      {showDrawingToolbar && (
        <div
          className={`flex flex-wrap items-center justify-between px-3 py-1.5 border-b text-xs font-mono gap-2 shrink-0 ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-terminal-900/80 border-terminal-border'
          }`}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTool('crosshair')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'crosshair'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-terminal-800'
              }`}
              title="Crosshair & Drag-Pan Tool"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('trendline')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'trendline'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-terminal-800'
              }`}
              title="Draw Data-Locked Trendline"
            >
              <Minus className="w-3.5 h-3.5 rotate-45" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('horizontal')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'horizontal'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-terminal-800'
              }`}
              title="Place Horizontal Level"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('rectangle')}
              className={`p-1.5 rounded transition-all ${
                activeTool === 'rectangle'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-terminal-800'
              }`}
              title="Draw Confluence Rectangle"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            {drawnShapes.length > 0 && (
              <button
                type="button"
                onClick={() => setDrawnShapes([])}
                className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition-all ml-1"
                title="Clear Drawings"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            {displayBar && (
              <div className="hidden md:flex items-center gap-2 text-slate-400">
                <span>O:<strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>{displayBar.open.toFixed(decimals)}</strong></span>
                <span>H:<strong className="text-emerald-400">{displayBar.high.toFixed(decimals)}</strong></span>
                <span>L:<strong className="text-rose-400">{displayBar.low.toFixed(decimals)}</strong></span>
                <span>C:<strong className={isLight ? 'text-slate-900' : 'text-white'}>{displayBar.close.toFixed(decimals)}</strong></span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setViewWindow(null)}
              className="px-2 py-0.5 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 font-bold flex items-center gap-1"
              title="Reset Zoom & Auto-Fit Candles"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Auto-Fit</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Chart.js Main Price Canvas */}
      <div className={`relative flex-1 min-h-0 w-full ${isLight ? 'bg-white' : 'bg-[#080d1a]'}`}>
        <canvas
          ref={mainCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      {/* Synchronized Oscillator Sub-Canvas (RSI-14 / MACD) */}
      {isOscEnabled && (
        <div
          className={`h-20 shrink-0 border-t relative ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070b14] border-terminal-border'
          }`}
        >
          <div className="absolute top-1 left-2 z-10 text-[9.5px] font-mono pointer-events-none flex items-center gap-2">
            <span className="text-purple-400 font-bold">
              {oscillatorType === 'MACD'
                ? `MACD HIST: ${overlays.latestMacd}`
                : `RSI (14): ${overlays.latestRsi}`}
            </span>
            <span className="text-slate-500">• Chart.js Oscillator Sync</span>
          </div>
          <canvas ref={oscCanvasRef} className="w-full h-full block" />
        </div>
      )}
    </div>
  );
};
