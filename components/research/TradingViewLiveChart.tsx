/**
 * components/research/TradingViewLiveChart.tsx
 * Synchronized TradingView Advanced Live Chart with bidirectional state & listener sync.
 *
 * Features:
 *  - Interactive TradingView-style Symbol Search Bar (supports Forex, Metals, Indian Markets, US/Global Equities, Crypto)
 *  - Dynamic Timeframe Switcher (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W)
 *  - Editable Indicators Library (Add/Remove RSI-14, EMA 20/50/200, MACD, Bollinger Bands, Stochastic, ATR)
 *  - Live OHLCV + Indicator Telemetry Strip synchronized via /api/research/chart-telemetry
 *  - Window postMessage listener + Event callbacks (onSymbolChange, onTimeframeChange, onChartTelemetryUpdate)
 *  - Optional Native Interactive Candlestick Mode (lightweight-charts v5) & Automatic Offline Fallback
 */

'use client';

import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
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
} from 'lucide-react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  UTCTimestamp,
} from 'lightweight-charts';
import { ChartLiveContext } from '@/lib/research/types';
import { formatAssetPrice, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export interface TradingViewLiveChartProps {
  symbol: string;
  timeframe?: string;
  theme?: 'dark' | 'light';
  height?: number;
  containerIdPrefix?: string;
  allowIndicatorsCustomization?: boolean;
  onSymbolChange?: (newSymbol: string, telemetry?: ChartLiveContext) => void;
  onTimeframeChange?: (newTimeframe: string, telemetry?: ChartLiveContext) => void;
  onChartTelemetryUpdate?: (telemetry: ChartLiveContext) => void;
}

export function mapToTradingViewSymbol(symbol: string): string {
  return liveChartTelemetryService.resolveSymbol(symbol).tvSymbol;
}

const getTimeframeInterval = (tf?: string): string => {
  if (!tf) return '60';
  const lower = tf.toLowerCase();
  if (lower === '1m') return '1';
  if (lower === '5m') return '5';
  if (lower === '15m') return '15';
  if (lower === '30m') return '30';
  if (lower === '1h') return '60';
  if (lower === '4h') return '240';
  if (lower === '1d') return 'D';
  if (lower === '1w') return 'W';
  return '60';
};

const AVAILABLE_INDICATORS = [
  { id: 'RSI', label: 'RSI (14)', tvStudy: 'RSI@tv-basicstudies' },
  { id: 'EMA20', label: 'EMA 20', tvStudy: 'MASimple@tv-basicstudies' },
  { id: 'EMA50', label: 'EMA 50', tvStudy: 'MAExp@tv-basicstudies' },
  { id: 'EMA200', label: 'EMA 200', tvStudy: null },
  { id: 'MACD', label: 'MACD (12, 26, 9)', tvStudy: 'MACD@tv-basicstudies' },
  { id: 'BB', label: 'Bollinger Bands (20, 2)', tvStudy: 'BollingerBands@tv-basicstudies' },
  { id: 'STOCH', label: 'Stochastic (14, 3)', tvStudy: 'StochasticRSI@tv-basicstudies' },
  { id: 'ATR', label: 'ATR (14)', tvStudy: 'ATR@tv-basicstudies' },
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

export const TradingViewLiveChart: React.FC<TradingViewLiveChartProps> = memo(({
  symbol,
  timeframe = '1h',
  theme = 'dark',
  height = 520,
  containerIdPrefix = 'tv_research_chart',
  allowIndicatorsCustomization = true,
  onSymbolChange,
  onTimeframeChange,
  onChartTelemetryUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeChartRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [loadError, setLoadError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [chartEngineMode, setChartEngineMode] = useState<'TRADINGVIEW' | 'NATIVE_OHLCV'>('TRADINGVIEW');

  // Synchronized chart controls state
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

  // Real-time captured telemetry from the active chart
  const [telemetry, setTelemetry] = useState<ChartLiveContext | null>(null);

  const resolved = liveChartTelemetryService.resolveSymbol(symbol);
  const canonicalSymbol = resolved.symbol;
  const tvSymbol = resolved.tvSymbol;
  const interval = getTimeframeInterval(timeframe);
  const containerId = `${containerIdPrefix}_${canonicalSymbol.replace(/[^A-Za-z0-9]/g, '_')}`;

  // Fetch & propagate live chart telemetry whenever symbol, timeframe, or indicators change
  const syncLiveTelemetry = useCallback(
    async (
      targetSym: string,
      targetTf: string,
      inds: string[],
      notifyReason?: 'SYMBOL' | 'TIMEFRAME' | 'POLL'
    ): Promise<ChartLiveContext | undefined> => {
      try {
        const res = await fetch(
          `/api/research/chart-telemetry?symbol=${encodeURIComponent(targetSym)}&timeframe=${encodeURIComponent(targetTf)}&indicators=${encodeURIComponent(inds.join(','))}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return undefined;
        const json = await res.json();
        if (json?.success && json.telemetry) {
          const t: ChartLiveContext = json.telemetry;
          setTelemetry(t);
          onChartTelemetryUpdate?.(t);
          if (notifyReason === 'SYMBOL') {
            onSymbolChange?.(t.symbol, t);
          } else if (notifyReason === 'TIMEFRAME') {
            onTimeframeChange?.(targetTf, t);
          }
          return t;
        }
      } catch {
        // Ignore transient poll failure
      }
      return undefined;
    },
    [onChartTelemetryUpdate, onSymbolChange, onTimeframeChange]
  );

  // Sync telemetry immediately on symbol/timeframe/indicators change + periodic 15s live refresh
  useEffect(() => {
    syncLiveTelemetry(canonicalSymbol, timeframe, activeIndicators, 'POLL');
    const timer = setInterval(() => {
      syncLiveTelemetry(canonicalSymbol, timeframe, activeIndicators, 'POLL');
    }, 15000);
    return () => clearInterval(timer);
  }, [canonicalSymbol, timeframe, activeIndicators, syncLiveTelemetry]);

  // Listen for any postMessage events from TradingView iframe if emitted
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (!event.origin || !event.origin.includes('tradingview.com')) return;
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const msgName = payload?.name || payload?.event || '';
        const candidateSymbol =
          payload?.data?.symbol ||
          payload?.symbol ||
          (msgName === 'tv-widget-symbol-change' ? payload?.value : undefined);

        if (typeof candidateSymbol === 'string' && candidateSymbol.trim().length > 0) {
          const nextSym = liveChartTelemetryService.resolveSymbol(candidateSymbol).symbol;
          if (nextSym && nextSym !== canonicalSymbol) {
            syncLiveTelemetry(nextSym, timeframe, activeIndicators, 'SYMBOL');
          }
        }
      } catch {
        // Non-JSON or unrelated message from iframe
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [canonicalSymbol, timeframe, activeIndicators, syncLiveTelemetry]);

  // Symbol Search API query when search modal is open
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
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, showSymbolSearch]);

  useEffect(() => {
    if (showSymbolSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSymbolSearch]);

  // Initialize / Re-initialize Official TradingView Advanced Widget whenever tvSymbol, interval, studies, or mode changes
  const activeStudiesKey = activeIndicators
    .map((id) => AVAILABLE_INDICATORS.find((i) => i.id === id)?.tvStudy)
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (chartEngineMode !== 'TRADINGVIEW') return;
    let isMounted = true;
    setIsLoading(true);
    setLoadError(false);

    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const studies = Array.from(
      new Set(
        activeIndicators
          .map((id) => AVAILABLE_INDICATORS.find((i) => i.id === id)?.tvStudy)
          .filter((s): s is string => Boolean(s))
      )
    );

    const initWidget = () => {
      if (!isMounted || !containerRef.current) return;
      try {
        if (typeof (window as any).TradingView !== 'undefined') {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval,
            timezone: 'Etc/UTC',
            theme: theme === 'light' ? 'light' : 'dark',
            style: '1',
            locale: 'en',
            toolbar_bg: theme === 'light' ? '#f8fafc' : '#090d16',
            enable_publishing: false,
            // Controlled via our synchronized Symbol Search & Timeframe bar directly above the canvas
            // so the TradingView chart and Research Engine never drift out of sync
            allow_symbol_change: false,
            hide_top_toolbar: true,
            container_id: containerRef.current.id,
            hide_side_toolbar: false,
            withdateranges: true,
            save_image: true,
            studies,
            show_popup_button: false,
          });
          setIsLoading(false);
        } else {
          setLoadError(true);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoadError(true);
          setIsLoading(false);
        }
      }
    };

    const existingScript = document.getElementById('tradingview-widget-script');
    if (existingScript && typeof (window as any).TradingView !== 'undefined') {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        if (isMounted) initWidget();
      };
      script.onerror = () => {
        if (isMounted) {
          setLoadError(true);
          setIsLoading(false);
        }
      };
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [tvSymbol, interval, theme, activeStudiesKey, chartEngineMode]);

  // Render Native Interactive Candlestick Chart (lightweight-charts v5) when in NATIVE_OHLCV mode or on TV load error
  useEffect(() => {
    if (chartEngineMode !== 'NATIVE_OHLCV' && !loadError) return;
    const container = nativeChartRef.current;
    if (!container || !telemetry?.recentCandles || telemetry.recentCandles.length === 0) return;

    container.innerHTML = '';
    const chart = createChart(container, {
      width: container.clientWidth || 640,
      height: container.clientHeight || 380,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    const deduped = new Map<number, (typeof telemetry.recentCandles)[0]>();
    for (const bar of telemetry.recentCandles) {
      const sec = Math.floor(bar.timestamp / 1000);
      deduped.set(sec, bar);
    }
    const sortedBars = Array.from(deduped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([sec, b]) => ({
        time: sec as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));

    candleSeries.setData(sortedBars);

    if (activeIndicators.includes('EMA20') && sortedBars.length >= 5) {
      const emaLine = chart.addSeries(LineSeries, { color: '#06b6d4', lineWidth: 2, title: 'EMA 20' });
      const k = 2 / 21;
      let prev = sortedBars[0].close;
      emaLine.setData(
        sortedBars.map((b) => {
          prev = (b.close - prev) * k + prev;
          return { time: b.time, value: prev };
        })
      );
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (container) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartEngineMode, loadError, telemetry?.recentCandles, activeIndicators]);

  const handleSelectInstrument = async (nextSymbolOrQuery: string) => {
    const clean = nextSymbolOrQuery.trim();
    if (!clean) return;
    const nextResolved = liveChartTelemetryService.resolveSymbol(clean);
    setShowSymbolSearch(false);
    setSearchQuery('');

    // Immediately inform parent with canonical symbol, then push live telemetry snapshot
    onSymbolChange?.(nextResolved.symbol);
    await syncLiveTelemetry(nextResolved.symbol, timeframe, activeIndicators, 'SYMBOL');
  };

  const handleSelectTimeframe = async (nextTf: string) => {
    onTimeframeChange?.(nextTf);
    await syncLiveTelemetry(canonicalSymbol, nextTf, activeIndicators, 'TIMEFRAME');
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

  return (
    <div
      className={`relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-terminal-border bg-terminal-950 transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''
      }`}
    >
      {/* 1. Synchronized TradingView-Style Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-terminal-900 border-b border-terminal-border text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Interactive Symbol Search Trigger */}
          <button
            type="button"
            onClick={() => setShowSymbolSearch(!showSymbolSearch)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-terminal-950 hover:bg-terminal-800 border border-cyan-500/40 text-white font-bold transition-colors shadow-sm"
            title="Search and switch chart instrument (automatically syncs Research Engine & Chat Room)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>{canonicalSymbol}</span>
            <span className="text-[10px] text-cyan-300 font-normal">({tvSymbol})</span>
          </button>

          {/* Timeframe Selector Pills */}
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

          {/* Editable Indicators Button */}
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
                title="Add or remove technical indicators synced with analysis"
              >
                <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
                <span>fx Indicators ({activeIndicators.length})</span>
              </button>

              {showIndicatorsMenu && (
                <div className="absolute left-0 top-full mt-1.5 z-40 w-60 bg-terminal-900 border border-terminal-border rounded-xl shadow-2xl p-2 space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-terminal-border/70 text-[10px] text-slate-400">
                    <span>EDITABLE INDICATORS</span>
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
        </div>

        <div className="flex items-center gap-1.5">
          {/* Chart Engine Mode Toggle */}
          <button
            type="button"
            onClick={() =>
              setChartEngineMode(chartEngineMode === 'TRADINGVIEW' ? 'NATIVE_OHLCV' : 'TRADINGVIEW')
            }
            className="px-2 py-1 rounded bg-terminal-950 hover:bg-terminal-800 border border-terminal-border text-[10px] text-slate-300 flex items-center gap-1"
            title="Switch between TradingView Widget and Native Interactive OHLCV"
          >
            {chartEngineMode === 'TRADINGVIEW' ? (
              <>
                <BarChart3 className="w-3 h-3 text-cyan-400" />
                <span>TV Live</span>
              </>
            ) : (
              <>
                <CandlestickChart className="w-3 h-3 text-emerald-400" />
                <span>OHLCV</span>
              </>
            )}
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

      {/* 2. Live Captured OHLCV & Active Indicator Telemetry Strip */}
      <div className="px-3 py-1 bg-terminal-950/95 border-b border-terminal-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{telemetry ? formatVal(telemetry.livePrice) : '...'}</span>
          </span>
          {telemetry && (
            <>
              <span className={`font-bold ${telemetry.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({telemetry.changePercent >= 0 ? '+' : ''}{telemetry.changePercent}%)
              </span>
              <span className="text-slate-500">O:<span className="text-slate-300">{formatVal(telemetry.open)}</span></span>
              <span className="text-slate-500">H:<span className="text-emerald-300">{formatVal(telemetry.high)}</span></span>
              <span className="text-slate-500">L:<span className="text-rose-300">{formatVal(telemetry.low)}</span></span>
              <span className="text-slate-500">C:<span className="text-white">{formatVal(telemetry.close)}</span></span>
            </>
          )}
        </div>

        {telemetry && (
          <div className="flex items-center gap-2 flex-wrap text-slate-400">
            {telemetry.indicatorReadings.rsi14 !== undefined && (
              <span>
                RSI: <strong className="text-cyan-300">{telemetry.indicatorReadings.rsi14}</strong>
              </span>
            )}
            {telemetry.indicatorReadings.ema20 !== undefined && (
              <span>
                EMA20: <strong className="text-slate-200">{formatVal(telemetry.indicatorReadings.ema20)}</strong>
              </span>
            )}
            {telemetry.indicatorReadings.atr14 !== undefined && (
              <span>
                ATR: <strong className="text-amber-300">{formatVal(telemetry.indicatorReadings.atr14)}</strong>
              </span>
            )}
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              SYNCED
            </span>
          </div>
        )}
      </div>

      {/* 3. TradingView-Style Symbol Search Modal Dropdown */}
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
              placeholder="Search ticker or name (e.g. NVDA, NVIDIA, XAU/USD, EURUSD)..."
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

      {/* 4. Main Chart Viewport */}
      <div className="relative flex-1 min-h-0 w-full bg-terminal-950">
        {chartEngineMode === 'TRADINGVIEW' && isLoading && !loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-terminal-950/90 backdrop-blur-sm text-cyan-400 font-mono text-xs gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>SYNCING TRADINGVIEW ENGINE ({tvSymbol} • {timeframe.toUpperCase()})...</span>
          </div>
        )}

        {chartEngineMode === 'TRADINGVIEW' && !loadError ? (
          <div
            id={containerId}
            ref={containerRef}
            className="w-full h-full bg-terminal-950"
          />
        ) : (
          <div className="relative w-full h-full">
            {loadError && chartEngineMode === 'TRADINGVIEW' && (
              <div className="absolute top-2 right-2 z-20 px-2 py-1 rounded bg-amber-950/80 border border-amber-600/40 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>TradingView CDN unavailable — Native Live OHLCV Active</span>
              </div>
            )}
            <div ref={nativeChartRef} className="w-full h-full" />
          </div>
        )}
      </div>
    </div>
  );
});

TradingViewLiveChart.displayName = 'TradingViewLiveChart';
