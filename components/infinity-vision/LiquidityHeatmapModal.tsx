'use client';

import React, { useState, useMemo } from 'react';
import { X, Minimize2, Maximize2, Droplets, Info } from 'lucide-react';
import { Candle, CurrencyPair } from '@/lib/types';
import { ResearchReportSnapshot } from '@/lib/research/types';
import { computeLiveVisionAtlasSnapshot } from '@/lib/research/VisionAtlasLiveAnalytics';

export interface LiquidityHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair?: CurrencyPair;
  timeframe?: string;
  theme?: 'light' | 'dark';
  livePrice?: number;
  candles?: Candle[];
  report?: ResearchReportSnapshot | null;
}

export const LiquidityHeatmapModal: React.FC<LiquidityHeatmapModalProps> = ({
  isOpen,
  onClose,
  pair = 'XAU/USD',
  timeframe = '15m',
  theme = 'light',
  livePrice: propLivePrice,
  candles = [],
  report = null,
}) => {
  const isLight = theme === 'light';
  const cleanPair = pair.replace('/', '');

  const vaSnapshot = useMemo(
    () =>
      computeLiveVisionAtlasSnapshot({
        pair,
        timeframe,
        livePrice: propLivePrice,
        candles,
        report,
      }),
    [pair, timeframe, propLivePrice, candles, report]
  );

  const decimals = vaSnapshot.priceDecimals;
  const activePrice = vaSnapshot.livePrice;
  const isGold = pair.includes('XAU');
  const isJpy = pair.includes('JPY');
  const isIndian = pair === 'NIFTY 50' || pair === 'BANK NIFTY' || pair.includes('/INR');
  const spreadPts = isGold ? 0.17 : isIndian ? 1.5 : isJpy ? 0.015 : 0.00015;
  const bidVal = (activePrice - spreadPts / 2).toFixed(decimals);
  const askVal = (activePrice + spreadPts / 2).toFixed(decimals);

  const liquidityLevels = useMemo(() => {
    const colorMap: Record<string, string> = {
      BSL: 'bg-rose-500',
      OB_SUPPLY: 'bg-amber-500',
      EQ_PIVOT: 'bg-cyan-500',
      OB_DEMAND: 'bg-emerald-500',
      SSL: 'bg-blue-600',
    };
    return vaSnapshot.liquidityWalls.map((wall, idx) => ({
      type: wall.label,
      price: wall.price,
      strength: wall.strengthPct,
      delta: `${wall.distancePct >= 0 ? '+' : ''}${wall.distancePct}%`,
      color: colorMap[wall.kind] || 'bg-cyan-500',
      barWidth: `${Math.min(95, Math.max(20, wall.strengthPct - idx * 4))}%`,
    }));
  }, [vaSnapshot]);

  if (!isOpen) return null;

  return (
    <div className={`absolute top-12 left-1/2 -translate-x-1/2 z-40 w-[94vw] sm:w-[420px] max-w-[430px] max-h-[85vh] overflow-y-auto rounded-xl border shadow-2xl backdrop-blur-md select-none transition-all ${
      isLight 
        ? 'bg-white/98 border-slate-300 text-slate-800' 
        : 'bg-terminal-950/98 border-terminal-border text-slate-100'
    }`}>
      {/* Modal Header */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-blue-500" />
          <div>
            <h3 className="text-xs font-black tracking-wider uppercase">LIQUIDITY HEATMAP</h3>
            <span className="text-[10px] text-slate-500 font-mono block">
              {cleanPair} - {timeframe} Quantum liquidity engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3 font-sans text-xs">
        {/* OTC Disclaimer Notice */}
        <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-[10px] text-amber-800 dark:text-amber-300">
          <strong>ESTIMATED:</strong> No online book for this OTC instrument - orders are estimated from price behaviour.
        </div>

        {/* Live Bid / Ask / Spread */}
        <div className="p-2 rounded bg-slate-50 dark:bg-terminal-900 border border-slate-200 dark:border-terminal-border flex items-center justify-between text-xs font-mono">
          <span>Bid: <strong className="font-bold text-slate-900 dark:text-white">{bidVal}</strong></span>
          <span>Ask: <strong className="font-bold text-slate-900 dark:text-white">{askVal}</strong></span>
          <span className="text-slate-500">Spread: <strong className="text-slate-800 dark:text-slate-200">{spreadPts}</strong></span>
        </div>

        {/* Table of Liquidity Levels */}
        <div className="space-y-1.5 font-mono text-[11px]">
          {liquidityLevels.map((lvl, i) => (
            <div 
              key={i} 
              className="p-1.5 rounded border border-slate-200 dark:border-terminal-border/80 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-terminal-900 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${lvl.color}`} />
                <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                  {lvl.type}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-slate-900 dark:text-white">
                  {lvl.price.toFixed(decimals)}
                </span>

                {/* Depth visual bar */}
                <div className="w-16 h-2 bg-slate-100 dark:bg-terminal-800 rounded-full overflow-hidden flex items-center">
                  <div 
                    className={`h-full ${lvl.color}`} 
                    style={{ width: lvl.barWidth }}
                  />
                </div>

                <div className="text-[10px] text-slate-500 flex items-center gap-1 w-14 justify-end">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{lvl.strength}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{lvl.delta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Methodology Footnote */}
        <div className="p-2.5 rounded bg-slate-50 dark:bg-terminal-900/50 border border-slate-200 dark:border-terminal-border text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Real-time depth strength synthesized from swing liquidity pools, Order Blocks, Fair Value Gaps, ATR ({vaSnapshot.atr14.toFixed(decimals)}), and tick accumulation around {activePrice.toFixed(decimals)}.
        </div>

        {/* Liquidity Analysis (Market DNA) Box */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Liquidity analysis</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold">
              LIVE STREAMED
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Liquidity sweep:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{vaSnapshot.sweepSummary}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Structure:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{vaSnapshot.structureSummary}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Analysis confidence:</span>
              <span className={`font-bold ${vaSnapshot.confidenceLabel === 'High' ? 'text-emerald-500' : vaSnapshot.confidenceLabel === 'Medium' ? 'text-cyan-500' : 'text-amber-600'}`}>
                {vaSnapshot.confidenceLabel}
              </span>
            </div>
          </div>

          {/* Dynamic Split Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-emerald-600">Bullish {vaSnapshot.bullishPct}%</span>
              <span className="text-rose-600">Bearish {vaSnapshot.bearishPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-terminal-800 overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${vaSnapshot.bullishPct}%` }} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${vaSnapshot.bearishPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-400 leading-tight">
              Calculated from live {cleanPair} ({timeframe}) RSI {vaSnapshot.rsi14}, EMA-20 {vaSnapshot.ema20.toFixed(decimals)}, and active liquidity sweeps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
