'use client';

import React, { useMemo } from 'react';
import { X, Droplets } from 'lucide-react';
import { CurrencyPair } from '@/lib/types';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { ResearchReportSnapshot } from '@/lib/research/types';
import {
  computeLivePredictiveAnalytics,
  PredictiveCandleInput,
} from '@/lib/research/PredictiveAnalyticsEngine';

export interface LiquidityHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  pair?: CurrencyPair | string;
  timeframe?: string;
  theme?: 'light' | 'dark';
  livePrice?: number;
  candles?: PredictiveCandleInput[];
  researchReport?: ResearchReportSnapshot | null;
}

export const LiquidityHeatmapModal: React.FC<LiquidityHeatmapModalProps> = ({
  isOpen,
  onClose,
  pair = 'XAU/USD',
  timeframe = '15m',
  theme = 'light',
  livePrice: propLivePrice,
  candles = [],
  researchReport,
}) => {
  const isLight = theme === 'light';
  const cleanPair = pair.replace('/', '');

  const activePrice =
    propLivePrice ||
    researchReport?.brief.pricing.currentPrice ||
    LiveMarketFeedManager.getCanonicalPrice(pair as CurrencyPair) ||
    liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(pair as CurrencyPair) ||
    100;

  const snapshot = useMemo(
    () =>
      computeLivePredictiveAnalytics({
        symbol: pair,
        timeframe,
        candles,
        livePrice: activePrice,
        researchReport,
      }),
    [pair, timeframe, candles, activePrice, researchReport]
  );

  if (!isOpen) return null;

  const { liquidity, visionAtlasLab, decimals, livePrice } = snapshot;
  const isIndian =
    pair.includes('NIFTY') || pair.includes('RELIANCE') || pair.includes('HDFC') || pair.includes('TCS') || pair.includes('INFY');
  const isFx = pair.includes('/') && !pair.includes('XAU') && !pair.includes('XAG') && !pair.includes('BTC');
  const pricePrefix = isIndian ? '₹' : isFx ? '' : '$';
  const fmt = (n: number) => `${pricePrefix}${n.toFixed(decimals)}`;

  return (
    <div
      className={`absolute top-12 left-1/2 -translate-x-1/2 z-40 w-[94vw] sm:w-[440px] max-w-[450px] max-h-[85vh] overflow-y-auto rounded-xl border shadow-2xl backdrop-blur-md select-none transition-all ${
        isLight
          ? 'bg-white/98 border-slate-300 text-slate-800'
          : 'bg-terminal-950/98 border-terminal-border text-slate-100'
      }`}
    >
      {/* Modal Header */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-blue-500" />
          <div>
            <h3 className="text-xs font-black tracking-wider uppercase">LIQUIDITY HEATMAP</h3>
            <span className="text-[10px] text-slate-500 font-mono block">
              {cleanPair} - {timeframe.toUpperCase()} Live OHLCV Liquidity Pools
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5 space-y-3 font-sans text-xs">
        {/* Live Bid / Ask / Spread */}
        <div className="p-2.5 rounded bg-slate-50 dark:bg-terminal-900 border border-slate-200 dark:border-terminal-border flex items-center justify-between text-xs font-mono">
          <span>
            Bid: <strong className="font-bold text-slate-900 dark:text-white">{fmt(liquidity.bid)}</strong>
          </span>
          <span>
            Ask: <strong className="font-bold text-slate-900 dark:text-white">{fmt(liquidity.ask)}</strong>
          </span>
          <span className="text-slate-500">
            Spread: <strong className="text-cyan-600 dark:text-cyan-400">{liquidity.spreadLabel}</strong>
          </span>
        </div>

        {/* Table of Live Liquidity Levels */}
        <div className="space-y-1.5 font-mono text-[11px]">
          {liquidity.levels.map((lvl, i) => {
            const distPct = (((lvl.price - livePrice) / Math.max(1e-8, livePrice)) * 100).toFixed(2);
            const isSell = lvl.type === 'SELL_LIQUIDITY';
            return (
              <div
                key={i}
                className="p-1.5 rounded border border-slate-200 dark:border-terminal-border/80 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-terminal-900 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${isSell ? 'bg-rose-500' : 'bg-blue-500'}`} />
                  <span className="truncate text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                    {lvl.label}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-bold text-slate-900 dark:text-white">{fmt(lvl.price)}</span>

                  <div className="w-16 h-2 bg-slate-100 dark:bg-terminal-800 rounded-full overflow-hidden flex items-center">
                    <div
                      className={`h-full ${isSell ? 'bg-rose-500' : 'bg-blue-500'}`}
                      style={{ width: `${lvl.weight}%` }}
                    />
                  </div>

                  <div className="text-[10px] text-slate-500 flex items-center gap-1 w-16 justify-end">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{lvl.weight}</span>
                    <span className={Number(distPct) >= 0 ? 'text-rose-500' : 'text-emerald-600'}>
                      ({Number(distPct) >= 0 ? '+' : ''}
                      {distPct}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Methodology Footnote */}
        <div className="p-2 rounded bg-slate-50 dark:bg-terminal-900/50 border border-slate-200 dark:border-terminal-border text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Cluster intensity (0-100) derives directly from live Chart.js swing pivots, order blocks, ATR dispersion, and synchronized Research Engine S/R levels around spot {fmt(livePrice)}.
        </div>

        {/* Liquidity Analysis Box */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Liquidity analysis
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
              LIVE SYNCHRONIZED
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-sans">Liquidity sweep:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
                {liquidity.sweepSummary}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-sans">Structure:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
                {visionAtlasLab.structureText}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Analysis confidence:</span>
              <span className="font-bold text-cyan-600">{visionAtlasLab.confidenceText}</span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-emerald-600">Bullish {visionAtlasLab.bullishPct}%</span>
              <span className="text-rose-600">Bearish {visionAtlasLab.bearishPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-terminal-800 overflow-hidden flex">
              <div className="bg-emerald-500 h-full" style={{ width: `${visionAtlasLab.bullishPct}%` }} />
              <div className="bg-rose-500 h-full" style={{ width: `${visionAtlasLab.bearishPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
