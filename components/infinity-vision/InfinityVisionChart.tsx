/**
 * components/infinity-vision/InfinityVisionChart.tsx (Chart.js Migration)
 * Unrestricted Open-Source Chart.js v4 Rendering Pipeline for Vision Atlas.
 *
 * Uses modular Chart.js canvas plugins (`qriCandlestick`, `qriVisionAtlasOverlay`)
 * with zero third-party chart iframe restrictions and synchronized high-frequency WSS ticks.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
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

  const viewportDivRef = useRef<HTMLDivElement>(null);
  const [yAxisMode, setYAxisMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualYBounds, setManualYBounds] = useState<{ min: number; max: number } | null>(null);
  const manualYBoundsRef = useRef<{ min: number; max: number } | null>(null);
  const lastAutoYBoundsRef = useRef<{ min: number; max: number }>({ min: 0, max: 100 });
  const [isHoveringYAxis, setIsHoveringYAxis] = useState<boolean>(false);
  const [interactionKind, setInteractionKind] = useState<'NONE' | 'PAN_2D' | 'SCALE_Y'>('NONE');
  const interactionRef = useRef<{
    kind: 'PAN_2D' | 'SCALE_Y';
    startX: number;
    startY: number;
    initialPanOffset: number;
    initialYMin: number;
    initialYMax: number;
  } | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>('crosshair');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [drawnElements, setDrawnElements] = useState<ChartUserDrawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ idx: number; price: number } | null>(null);
  const [inProgressDrawing, setInProgressDrawing] = useState<ChartUserDrawing | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(60);
  const [panOffset, setPanOffset] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    setPanOffset(0);
    manualYBoundsRef.current = null;
    setManualYBounds(null);
    setYAxisMode('AUTO');
  }, [pair, timeframe]);

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

  const maxPanOffset = Math.max(0, safeCandles.length - 16);
  const clampedPanOffset = Math.min(panOffset, maxPanOffset);
  const visibleCandles = useMemo(() => {
    const endIdx = Math.max(16, safeCandles.length - clampedPanOffset);
    const startIdx = Math.max(0, endIdx - visibleCount);
    return safeCandles.slice(startIdx, endIdx);
  }, [safeCandles, visibleCount, clampedPanOffset]);
  const lastCandle = visibleCandles[visibleCandles.length - 1] || safeCandles[safeCandles.length - 1];

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow || '';
    };
  }, [isFullscreen]);

  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      try {
        chartRef.current?.resize();
      } catch {}
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  const syncChartToInstance = useCallback(
    (chart: Chart) => {
      if (visibleCandles.length === 0) return;

      const closes = visibleCandles.map((c) => c.close);
      const timeLabels = visibleCandles.map((c) => {
        const ts = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.time).getTime();
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });
      const futurePadding = clampedPanOffset === 0 ? Math.min(8, Math.max(4, horizonCandles || 5)) : 0;
      const labels = [...timeLabels, ...Array(futurePadding).fill('')];

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
      const pad = Math.max((maxY - minY) * 0.15, minY * 0.0018);
      const autoMinY = minY - pad;
      const autoMaxY = maxY + pad;
      lastAutoYBoundsRef.current = { min: autoMinY, max: autoMaxY };

      const activeBounds = manualYBoundsRef.current;
      if (chart.options.scales?.y) {
        chart.options.scales.y.min = activeBounds ? activeBounds.min : autoMinY;
        chart.options.scales.y.max = activeBounds ? activeBounds.max : autoMaxY;
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
    },
    [
      visibleCandles,
      clampedPanOffset,
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
    ]
  );

  const syncChartRef = useRef(syncChartToInstance);
  syncChartRef.current = syncChartToInstance;

  // 1. Mount / Re-mount Chart.js v4 Instance across theme, decimals, & fullscreen transitions without blank canvas
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
        layout: {
          padding: {
            top: 20,
            right: 8,
            bottom: 14,
            left: 10,
          },
        },
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
            afterFit: (axis) => {
              axis.width = Math.max(axis.width, 68);
            },
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
    syncChartRef.current(chart);
    const rafId = requestAnimationFrame(() => {
      try {
        chart.resize();
        syncChartRef.current(chart);
      } catch {}
    });

    return () => {
      cancelAnimationFrame(rafId);
      try {
        chart.destroy();
      } catch {}
      chartRef.current = null;
    };
  }, [theme, priceDecimals, isFullscreen]);

  // 2. High-Frequency Synchronized Update of Candles, Indicators, MT5 Bounds & Overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    syncChartToInstance(chart);
  }, [syncChartToInstance, manualYBounds]);

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

  const handleZoomIn = () => setVisibleCount((prev) => Math.max(16, prev - 10));
  const handleZoomOut = () => setVisibleCount((prev) => Math.min(Math.max(safeCandles.length, 180), prev + 10));
  const handlePanLeft = () => setPanOffset((prev) => Math.min(maxPanOffset, prev + 8));
  const handlePanRight = () => setPanOffset((prev) => Math.max(0, prev - 8));

  const scaleVerticalSpan = useCallback((factor: number) => {
    const base = manualYBoundsRef.current || lastAutoYBoundsRef.current;
    const mid = (base.min + base.max) / 2;
    const curSpan = Math.max(base.max - base.min, mid * 0.0002);
    const nextHalf = Math.max(mid * 0.0001, Math.min(mid * 2.5, (curSpan * factor) / 2));
    const nextBounds = { min: mid - nextHalf, max: mid + nextHalf };
    manualYBoundsRef.current = nextBounds;
    setManualYBounds(nextBounds);
    setYAxisMode('MANUAL');
    if (chartRef.current) {
      syncChartRef.current(chartRef.current);
    }
  }, []);

  const handleResetYAxis = useCallback(() => {
    manualYBoundsRef.current = null;
    setManualYBounds(null);
    setYAxisMode('AUTO');
    if (chartRef.current) {
      syncChartRef.current(chartRef.current);
    }
  }, []);

  const handleFitContent = () => {
    setVisibleCount(60);
    setPanOffset(0);
    handleResetYAxis();
  };

  const clearAllDrawings = () => {
    setDrawnElements([]);
  };

  useEffect(() => {
    const el = viewportDivRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const chart = chartRef.current;
      const rect = canvas?.getBoundingClientRect();
      const px = rect ? e.clientX - rect.left : 0;
      const isOverYAxis = Boolean(chart?.chartArea && px >= chart.chartArea.right);

      if (isOverYAxis || e.shiftKey) {
        scaleVerticalSpan(e.deltaY > 0 ? 1.15 : 0.87);
      } else {
        setVisibleCount((prev) =>
          Math.min(Math.max(safeCandles.length, 180), Math.max(16, prev + (e.deltaY > 0 ? 10 : -10)))
        );
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isFullscreen, safeCandles.length, scaleVerticalSpan]);

  useEffect(() => {
    if (interactionKind === 'NONE') return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const drag = interactionRef.current;
      const chart = chartRef.current;
      if (!drag || !chart) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const baseSpan = Math.max(drag.initialYMax - drag.initialYMin, Math.abs(drag.initialYMax) * 0.0002);

      if (drag.kind === 'SCALE_Y') {
        const factor = Math.max(0.15, Math.min(8.0, Math.exp(dy * 0.007)));
        const mid = (drag.initialYMin + drag.initialYMax) / 2;
        const nextHalf = (baseSpan * factor) / 2;
        const nextBounds = { min: mid - nextHalf, max: mid + nextHalf };
        manualYBoundsRef.current = nextBounds;
        setManualYBounds(nextBounds);
        setYAxisMode('MANUAL');
        if (chart.options.scales?.y) {
          chart.options.scales.y.min = nextBounds.min;
          chart.options.scales.y.max = nextBounds.max;
          chart.update('none');
        }
        return;
      }

      const plotW = Math.max(80, (chart.chartArea?.right ?? 400) - (chart.chartArea?.left ?? 0));
      const stepPx = Math.max(4, plotW / Math.max(10, visibleCount));
      const barShift = Math.round(dx / stepPx);
      setPanOffset(Math.max(0, Math.min(maxPanOffset, drag.initialPanOffset + barShift)));

      if (Math.abs(dy) >= 2 || manualYBoundsRef.current !== null) {
        const plotH = Math.max(40, (chart.chartArea?.bottom ?? 300) - (chart.chartArea?.top ?? 0));
        const deltaPrice = (dy / plotH) * baseSpan;
        const nextBounds = {
          min: drag.initialYMin + deltaPrice,
          max: drag.initialYMax + deltaPrice,
        };
        manualYBoundsRef.current = nextBounds;
        setManualYBounds(nextBounds);
        setYAxisMode('MANUAL');
        if (chart.options.scales?.y) {
          chart.options.scales.y.min = nextBounds.min;
          chart.options.scales.y.max = nextBounds.max;
          chart.update('none');
        }
      }
    };

    const handleWindowPointerUp = () => {
      interactionRef.current = null;
      setInteractionKind('NONE');
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [interactionKind, visibleCount, maxPanOffset]);

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const isOnYAxis = Boolean(chart.chartArea && px >= chart.chartArea.right);

    if (isOnYAxis || activeTool === 'crosshair') {
      const activeBounds = manualYBoundsRef.current || lastAutoYBoundsRef.current;
      const kind: 'SCALE_Y' | 'PAN_2D' = isOnYAxis ? 'SCALE_Y' : 'PAN_2D';
      interactionRef.current = {
        kind,
        startX: e.clientX,
        startY: e.clientY,
        initialPanOffset: clampedPanOffset,
        initialYMin: activeBounds.min,
        initialYMax: activeBounds.max,
      };
      setInteractionKind(kind);
    }
  };

  const handleViewportHoverMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart?.chartArea) return;
    const rect = canvas.getBoundingClientRect();
    setIsHoveringYAxis(e.clientX - rect.left >= chart.chartArea.right);
  };

  const handleViewportDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart?.chartArea) return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX - rect.left >= chart.chartArea.right) {
      handleResetYAxis();
    } else {
      handleFitContent();
    }
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

  const chartNode = (
    <div
      ref={containerRef}
      style={isFullscreen ? { width: '100vw', height: '100dvh' } : undefined}
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] p-1.5 sm:p-4 overflow-hidden'
          : 'w-full h-full'
      } flex flex-col select-none transition-colors ${
        isFullscreen ? (isLight ? 'bg-slate-100' : 'bg-terminal-950') : ''
      }`}
    >
      <div
        className={`w-full h-full flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden border shadow-xl transition-colors ${
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
        className="flex-1 min-h-0 relative w-full h-[460px] sm:h-[540px] flex flex-col overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
              title="Crosshair & 2D Panning Tool"
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

          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            {lastCandle && (
              <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <span>O: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.open || lastCandle.open).toFixed(priceDecimals)}</strong></span>
                <span>H: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.high || lastCandle.high).toFixed(priceDecimals)}</strong></span>
                <span>L: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.low || lastCandle.low).toFixed(priceDecimals)}</strong></span>
                <span>C: <strong className="text-slate-800 dark:text-slate-200">{(hoveredCandle?.close || lastCandle.close).toFixed(priceDecimals)}</strong></span>
              </div>
            )}

            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={handlePanLeft}
                className="p-1 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300"
                title="Pan Left"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePanRight}
                disabled={clampedPanOffset === 0}
                className="p-1 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300 disabled:opacity-40"
                title="Pan Right"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scaleVerticalSpan(0.8)}
                className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-cyan-600 dark:text-cyan-300 text-[10px] font-bold"
                title="Expand Price Scale (Y+)"
              >
                Y+
              </button>
              <button
                type="button"
                onClick={() => scaleVerticalSpan(1.25)}
                className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-cyan-600 dark:text-cyan-300 text-[10px] font-bold"
                title="Compress Price Scale (Y-)"
              >
                Y-
              </button>
              <button
                type="button"
                onClick={handleResetYAxis}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                  yAxisMode === 'MANUAL'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                    : 'bg-slate-200 dark:bg-terminal-800 border-transparent text-slate-600 dark:text-slate-400'
                }`}
                title="Reset Auto Vertical Y-Scale"
              >
                {yAxisMode === 'MANUAL' ? 'Y:FREE ↺' : 'Y:AUTO'}
              </button>
              <button
                type="button"
                onClick={handleFitContent}
                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-terminal-800 hover:bg-slate-300 dark:hover:bg-terminal-700 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 transition-all"
                title="Reset Zoom & Auto-Fit Scale"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Auto-Fit</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 text-[10px] ${
                  isFullscreen
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-500'
                    : 'bg-slate-200 dark:bg-terminal-800 border-transparent text-slate-700 dark:text-slate-300'
                }`}
                title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Chart'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Exit' : 'Full'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chart.js Canvas Viewport with comfortable margins & MT5 Price Scale Drag */}
        <div
          ref={viewportDivRef}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportHoverMove}
          onPointerLeave={() => setIsHoveringYAxis(false)}
          onDoubleClick={handleViewportDoubleClick}
          className={`w-full flex-1 min-h-0 relative px-2 sm:px-3 py-2 touch-none ${
            interactionKind === 'SCALE_Y' || isHoveringYAxis
              ? 'cursor-ns-resize'
              : activeTool === 'crosshair'
              ? interactionKind === 'PAN_2D'
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-crosshair'
          }`}
        >
          <div
            className={`pointer-events-none absolute top-2 bottom-2 right-2 w-[64px] rounded-r border-l transition-colors ${
              interactionKind === 'SCALE_Y' || isHoveringYAxis
                ? 'border-cyan-400/60 bg-cyan-500/10'
                : 'border-transparent bg-transparent'
            }`}
          />
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(chartNode, document.body);
  }
  return chartNode;
};
