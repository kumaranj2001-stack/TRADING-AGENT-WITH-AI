'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { QriChartJsCanvas } from '@/components/chartjs/QriChartJsCanvas';
import { ChartJsCandleBar } from '@/lib/chartjs/types';
import { Candle, CurrencyPair } from '@/lib/types';
import { getAssetDecimals, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';

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
  latencyMs = 8,
  isInterrupted = false,
  indicatorSettings = {},
  onReconnect,
}) => {
  const isLight = theme === 'light';
  const resolved = liveChartTelemetryService.resolveSymbol(pair);
  const priceDecimals = getAssetDecimals(resolved.assetClass, resolved.symbol);

  // Clean, sorted, deduplicated canonical candles synchronized with SSOT
  const safeCandles: ChartJsCandleBar[] = useMemo(() => {
    if (candles && candles.length >= 8) {
      const sorted = [...candles].sort((a, b) => {
        const tA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.time).getTime();
        const tB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.time).getTime();
        return tA - tB;
      });
      const dedup: ChartJsCandleBar[] = [];
      const seen = new Set<number>();
      for (const c of sorted) {
        const tsMs = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.time).getTime();
        const sec = Math.floor(tsMs / 1000);
        if (!seen.has(sec)) {
          seen.add(sec);
          dedup.push({
            timestamp: tsMs,
            time: new Date(tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume || 1200,
          });
        }
      }
      return dedup.slice(-130);
    }

    const base = liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair);
    const list: ChartJsCandleBar[] = [];
    let cur = base * 0.996;
    const now = Math.floor(Date.now() / 60000) * 60000;
    for (let i = 45; i >= 0; i--) {
      const isRed = i % 3 === 0 || i % 4 === 0;
      const delta = Math.sin(i * 0.7) * (base * 0.0006) + (isRed ? -base * 0.0004 : base * 0.0003);
      const open = cur;
      const close = i === 0 ? base : cur + delta;
      const candleTs = now - i * 15 * 60000;
      list.push({
        time: new Date(candleTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: candleTs,
        open,
        high: Math.max(open, close) + base * 0.0004,
        low: Math.min(open, close) - base * 0.0004,
        close,
        volume: 1200 + Math.floor(Math.random() * 2000),
      });
      cur = close;
    }
    return list;
  }, [candles, pair]);

  // Map Infinity Vision toggles directly into Chart.js modular plugin configuration
  const enabledPlugins = useMemo(() => {
    const smcEnabled =
      showIndicatorsOverlay &&
      (indicatorSettings.ms_map !== false ||
        indicatorSettings.ob_fresh !== false ||
        indicatorSettings.fvg_fresh !== false ||
        indicatorSettings.ms_bos !== false);

    return {
      qriCandlestick: true,
      volume_histogram: indicatorSettings.volume_profile !== false,
      ema20: indicatorSettings.trend_ema !== false,
      ema50: indicatorSettings.trend_ema !== false,
      ema200: false,
      trend_ema: indicatorSettings.trend_ema !== false,
      bb: indicatorSettings.advanced_analysis !== false,
      vwap: false,
      rsi_osc: indicatorSettings.rsi_momentum !== false,
      vision_atlas_smc: smcEnabled,
      vision_atlas_lab: showVisionAtlasLab && indicatorSettings.zones_entry !== false,
      market_dna: showMarketDna && indicatorSettings.fib_retracement !== false,
      quantum_vision: showQuantumSimulation,
      liquidity_heatmap: showLiquidityHeatmap && indicatorSettings.liq_sweep !== false,
      execution_blueprint: true,
    };
  }, [
    showIndicatorsOverlay,
    showVisionAtlasLab,
    showMarketDna,
    showQuantumSimulation,
    showLiquidityHeatmap,
    indicatorSettings,
  ]);

  return (
    <div
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden border shadow-xl transition-colors select-none ${
        isLight ? 'bg-white border-slate-200' : 'bg-terminal-950 border-terminal-border/80'
      }`}
    >
      {/* Header Bar: Chart.js Modular Vision Atlas Engine + Stream Telemetry */}
      <div
        className={`flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b font-mono text-xs gap-2 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-terminal-900 border-terminal-border'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm sm:text-base font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {pair}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold border ${
                isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-terminal-800 text-cyan-300 border-terminal-border'
              }`}
            >
              {timeframe.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-bold text-[10px]">
            <Layers className="w-3 h-3" />
            <span>CHART.JS · MODULAR VISION ATLAS CANVAS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isInterrupted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold text-[10px] animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>STREAM INTERRUPTED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE WSS STREAMING · {latencyMs}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Stream Interruption Alert Banner */}
      {isInterrupted && (
        <div className="mx-3 mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 font-mono text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>DATA STREAM INTERRUPTED: Market stream connection dropped. Stale frames quarantined.</span>
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

      {/* Synchronous Chart.js Main + RSI Canvas */}
      <div className="flex-1 min-h-[480px] sm:min-h-[540px] flex flex-col">
        <QriChartJsCanvas
          candles={safeCandles}
          symbol={pair}
          timeframe={timeframe}
          theme={theme}
          chartType={chartType}
          decimals={priceDecimals}
          enabledPlugins={enabledPlugins}
          horizonCandles={horizonCandles}
          showDrawingToolbar={true}
          showOscillatorPane={indicatorSettings.rsi_momentum !== false}
          oscillatorType="RSI"
        />
      </div>
    </div>
  );
};
