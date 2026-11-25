'use client';

import React, { useMemo, useState } from 'react';
import { Candle, CurrencyPair, SignalDirection, TechnicalIndicators, TimeFrame } from '@/lib/types';
import { BarChart2, CandlestickChart, Eye, EyeOff, Layers, Radio } from 'lucide-react';
import { QriChartJsCanvas } from '@/components/chartjs/QriChartJsCanvas';
import { ChartJsCandleBar, ChartJsExecutionLevels } from '@/lib/chartjs/types';
import { getAssetDecimals, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

interface ChartViewProps {
  candles: Candle[];
  pair: CurrencyPair;
  timeframe: TimeFrame;
  indicators?: TechnicalIndicators;
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  signalBias?: SignalDirection;
  theme?: 'dark' | 'light';
}

export const ChartView: React.FC<ChartViewProps> = ({
  candles = [],
  pair,
  timeframe,
  indicators,
  stopLoss,
  takeProfit,
  entryPrice,
  signalBias,
  theme = 'dark',
}) => {
  const [chartType, setChartType] = useState<'Candles' | 'Line'>('Candles');
  const [showEma, setShowEma] = useState(true);
  const [showVisionAtlas, setShowVisionAtlas] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [showExecution, setShowExecution] = useState(true);

  const resolved = liveChartTelemetryService.resolveSymbol(pair);
  const decimals = getAssetDecimals(resolved.assetClass, resolved.symbol);

  const chartCandles: ChartJsCandleBar[] = useMemo(() => {
    return (candles || []).map((c, idx) => ({
      timestamp: typeof c.timestamp === 'number' ? c.timestamp : Date.now() - (candles.length - idx) * 60000,
      time: c.time || new Date(c.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 1000,
    }));
  }, [candles]);

  const executionLevels: ChartJsExecutionLevels | undefined = useMemo(() => {
    if (!showExecution) return undefined;
    const bias = signalBias?.includes('BUY') ? 'BUY' : signalBias?.includes('SELL') ? 'SELL' : 'NEUTRAL';
    return {
      entryMin: entryPrice ? Number((entryPrice * 0.9995).toFixed(decimals)) : undefined,
      entryMax: entryPrice ? Number((entryPrice * 1.0005).toFixed(decimals)) : undefined,
      stopLoss,
      takeProfit1: takeProfit,
      bias,
    };
  }, [entryPrice, stopLoss, takeProfit, signalBias, showExecution, decimals]);

  const enabledPlugins = useMemo(
    () => ({
      qriCandlestick: true,
      volume_histogram: true,
      ema20: showEma,
      ema50: showEma,
      ema200: false,
      trend_ema: showEma,
      bb: false,
      vwap: false,
      rsi_osc: showRsi,
      vision_atlas_smc: showVisionAtlas,
      vision_atlas_lab: false,
      market_dna: showVisionAtlas,
      quantum_vision: false,
      liquidity_heatmap: showVisionAtlas,
      execution_blueprint: showExecution,
    }),
    [showEma, showVisionAtlas, showRsi, showExecution]
  );

  const latestBar = chartCandles[chartCandles.length - 1];

  return (
    <div className="bg-terminal-900 border border-terminal-border rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-lg">
      {/* Chart Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-terminal-border/60 pb-3 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-white tracking-wide">{pair}</span>
            <span className="px-2 py-0.5 rounded bg-terminal-800 text-cyan-300 text-[10px] sm:text-[11px] border border-terminal-border">
              {timeframe.toUpperCase()}
            </span>
          </div>

          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>CHART.JS OPEN CANVAS</span>
          </span>

          {latestBar && (
            <span className="text-slate-200 font-bold">
              {latestBar.close.toFixed(decimals)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {signalBias && (
            <span
              className={`px-2 py-0.5 rounded font-bold text-[10px] sm:text-[11px] border ${
                signalBias.includes('BUY')
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : signalBias.includes('SELL')
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              BIAS: {signalBias.replace('_', ' ')}
            </span>
          )}

          <button
            onClick={() => setChartType(chartType === 'Candles' ? 'Line' : 'Candles')}
            className="px-2 py-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 text-[10px] flex items-center gap-1 border border-terminal-border transition-colors"
          >
            <CandlestickChart className="w-3 h-3 text-emerald-400" />
            <span>{chartType}</span>
          </button>

          <button
            onClick={() => setShowVisionAtlas(!showVisionAtlas)}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              showVisionAtlas
                ? 'bg-indigo-600/30 text-cyan-300 border-cyan-500/40 font-bold'
                : 'bg-terminal-800 text-slate-400 border-terminal-border'
            }`}
            title="Toggle Proprietary Vision Atlas Plugin (OB, FVG, BOS, Golden Pocket, Liquidity Walls)"
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Vision Atlas</span>
          </button>

          <button
            onClick={() => setShowEma(!showEma)}
            className="px-2 py-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 text-[10px] flex items-center gap-1 border border-terminal-border transition-colors"
          >
            {showEma ? <Eye className="w-3 h-3 text-cyan-400" /> : <EyeOff className="w-3 h-3" />}
            <span>EMA</span>
          </button>

          <button
            onClick={() => setShowExecution(!showExecution)}
            className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              showExecution
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                : 'bg-terminal-800 text-slate-400 border-terminal-border'
            }`}
          >
            <span>SL/TP</span>
          </button>

          <button
            onClick={() => setShowRsi(!showRsi)}
            className="px-2 py-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 text-[10px] flex items-center gap-1 border border-terminal-border transition-colors"
          >
            <BarChart2 className="w-3 h-3 text-purple-400" />
            <span>RSI{indicators?.rsi ? ` (${indicators.rsi.toFixed(1)})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Synchronized High-Frequency Chart.js Canvas */}
      <div className="w-full h-[460px] rounded-lg overflow-hidden border border-terminal-border/60 bg-terminal-950 flex flex-col">
        <QriChartJsCanvas
          candles={chartCandles}
          symbol={pair}
          timeframe={timeframe}
          theme={theme}
          chartType={chartType}
          decimals={decimals}
          enabledPlugins={enabledPlugins}
          executionLevels={executionLevels}
          showDrawingToolbar={true}
          showOscillatorPane={showRsi}
          oscillatorType="RSI"
        />
      </div>
    </div>
  );
};
