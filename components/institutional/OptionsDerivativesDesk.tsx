'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Layers, Flame } from 'lucide-react';
import type { OptionsDerivativesSnapshot } from '@/lib/institutional/types';

interface Props {
  symbol: string;
  options: OptionsDerivativesSnapshot;
  onRefreshOptions: (payload: Record<string, any>) => Promise<void>;
}

export const OptionsDerivativesDesk: React.FC<Props> = ({
  symbol,
  options,
  onRefreshOptions,
}) => {
  const [ivShift, setIvShift] = useState<number>(options.pnlHeatmap.ivShiftPct);
  const [potTarget, setPotTarget] = useState<string>(String(options.probabilityOfTouch.targetPrice));
  const [potDte, setPotDte] = useState<number>(options.probabilityOfTouch.dte);

  useEffect(() => {
    setIvShift(options.pnlHeatmap.ivShiftPct);
    setPotTarget(String(options.probabilityOfTouch.targetPrice));
    setPotDte(options.probabilityOfTouch.dte);
  }, [symbol, options]);

  return (
    <div className="space-y-4">
      {/* Top Gamma Regime & Volatility KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-terminal-950 border border-cyan-500/30 rounded-lg p-3 font-mono">
          <div className="text-[10px] text-slate-400">ZERO GAMMA FLIP LEVEL</div>
          <div className="text-base font-bold text-cyan-300 mt-1">{options.zeroGammaFlipLevel}</div>
          <div className="text-[10px] text-emerald-400">{options.gammaRegime}</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3 font-mono">
          <div className="text-[10px] text-slate-400">DEALER GAMMA / 1% MOVE</div>
          <div className="text-base font-bold text-white mt-1">${options.dealerGammaPer1PctBillions}B</div>
          <div className="text-[10px] text-slate-400">Hedging Flow Impact</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3 font-mono">
          <div className="text-[10px] text-slate-400">IV RANK / IV PERCENTILE</div>
          <div className="text-base font-bold text-amber-300 mt-1">{options.ivRank} / {options.ivPercentile}%</div>
          <div className="text-[10px] text-slate-400">ATM IV {options.atmIv}% • HV30 {options.hv30}%</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3 font-mono">
          <div className="text-[10px] text-slate-400">PROBABILITY OF TOUCH</div>
          <div className="text-base font-bold text-emerald-400 mt-1">{options.probabilityOfTouch.probTouchPct}%</div>
          <div className="text-[10px] text-slate-400">Target {options.probabilityOfTouch.targetPrice} ({options.probabilityOfTouch.dte}d)</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3 font-mono">
          <div className="text-[10px] text-slate-400">PRE-MARKET VWAP STATS</div>
          <div className="text-base font-bold text-indigo-300 mt-1">{options.preMarketStats.preMarketVwap}</div>
          <div className="text-[10px] text-slate-400">Gap {options.preMarketStats.gapPct}% • {options.preMarketStats.preMarketRvol}x RVOL</div>
        </div>
      </div>

      {/* Smoothed SVI Volatility Surface + Time x IV P&L Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Smoothed SVI Implied Volatility Surface & Net Dealer GEX Profile</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-terminal-border">
                  <th className="py-1 text-left">Strike</th>
                  <th className="py-1 text-right">7D IV</th>
                  <th className="py-1 text-right">30D IV</th>
                  <th className="py-1 text-right">ORATS SVI</th>
                  <th className="py-1 text-right">Delta</th>
                  <th className="py-1 text-right">Vanna</th>
                  <th className="py-1 text-right">Net GEX</th>
                </tr>
              </thead>
              <tbody>
                {options.volSurface.map((v, idx) => {
                  const gex = options.intradayGexProfile[idx];
                  return (
                    <tr key={v.strike} className="border-b border-terminal-border/40">
                      <td className="py-1 text-white font-bold">{v.strike}</td>
                      <td className="py-1 text-right text-slate-300">{v.dte7Iv}%</td>
                      <td className="py-1 text-right text-cyan-300">{v.dte30Iv}%</td>
                      <td className="py-1 text-right text-indigo-300 font-bold">{v.sviSmoothedIv}%</td>
                      <td className="py-1 text-right text-slate-200">{v.deltaCall}</td>
                      <td className="py-1 text-right text-slate-400">{v.vanna}</td>
                      <td className={`py-1 text-right font-bold ${(gex?.netGexMillions ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gex ? `${gex.netGexMillions}M` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Interactive Time × IV P&L Heatmap</h3>
            <span className="text-xs font-mono text-amber-300">IV Shift: {ivShift >= 0 ? '+' : ''}{ivShift}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Vega Stress:</span>
            <input
              type="range"
              min={-15}
              max={20}
              value={ivShift}
              onChange={(e) => setIvShift(Number(e.target.value))}
              className="flex-1"
            />
            <button
              onClick={() => onRefreshOptions({ symbol, ivShiftPct: ivShift, potTargetPrice: Number(potTarget), potDte })}
              className="px-2.5 py-1 rounded bg-cyan-600 text-white font-bold"
            >
              Recalc Grid
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono text-center">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-1 text-left">Spot Level</th>
                  {options.pnlHeatmap.dateColumns.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {options.pnlHeatmap.priceLevels.map((px, i) => (
                  <tr key={px}>
                    <td className="text-left py-1 text-white font-bold">{px}</td>
                    {options.pnlHeatmap.pnlMatrix[i].map((pnl, j) => (
                      <td
                        key={j}
                        className={`py-1 px-1 rounded ${
                          pnl >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {pnl >= 0 ? `+$${pnl}` : `-$${Math.abs(pnl)}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 pt-1 text-xs font-mono">
            <input
              type="number"
              step="0.5"
              value={potTarget}
              onChange={(e) => setPotTarget(e.target.value)}
              className="w-28 bg-terminal-900 border border-terminal-border rounded px-2 py-1 text-white"
              placeholder="PoT Target"
            />
            <input
              type="number"
              value={potDte}
              onChange={(e) => setPotDte(Number(e.target.value))}
              className="w-20 bg-terminal-900 border border-terminal-border rounded px-2 py-1 text-white"
              placeholder="DTE"
            />
            <button
              onClick={() => onRefreshOptions({ symbol, potTargetPrice: Number(potTarget), potDte, ivShiftPct: ivShift })}
              className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold"
            >
              Calc PoT
            </button>
          </div>
        </div>
      </div>

      {/* Expected Move Cones, Unusual Options Flow, Dark Pool Prints, thinkBack, Earnings & Optimizer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-amber-400 uppercase font-mono flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" />
            <span>Unusual Sweeps & Dark Pool Prints</span>
          </h4>
          {options.unusualOptionsFlow.map((u, i) => (
            <div key={i} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-white font-bold">{u.contract}</span>
                <span className={u.sentiment === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}>${(u.premiumUsd / 1e6).toFixed(2)}M</span>
              </div>
              <div className="text-[10px] text-cyan-300">{u.side} • Vol/OI {u.volToOiRatio}x • {u.time}</div>
            </div>
          ))}
          {options.darkPoolPrints.map((dp, i) => (
            <div key={i} className="bg-indigo-500/10 border border-indigo-500/30 p-2 rounded text-[10px] font-mono">
              <span className="text-white font-bold">DARK POOL {dp.venue}</span>: {dp.shares.toLocaleString()} shs @ {dp.price} (${dp.notionalMillions}M • {dp.printPosition})
            </div>
          ))}
        </div>

        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-cyan-400 uppercase font-mono">Expected Move Cones & Earnings Moves</h4>
          {options.expectedMoveCones.map((em) => (
            <div key={em.horizon} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[11px] font-mono">
              <div className="text-white font-bold">{em.horizon}: ±{em.impliedMovePct}%</div>
              <div className="text-[10px] text-cyan-300">1σ [{em.lower1Sigma} – {em.upper1Sigma}] • 2σ [{em.lower2Sigma} – {em.upper2Sigma}]</div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {options.historicalEarningsMoves.map((e) => (
              <div key={e.quarter} className="bg-terminal-900 p-1.5 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-slate-400">{e.quarter} ({e.ivCrushPct}% IV Crush)</div>
                <div className="text-white">Imp ±{e.impliedMovePct}% vs Real {e.realizedMovePct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-emerald-400 uppercase font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>thinkBack Chain & Strategy Optimizer</span>
          </h4>
          {options.thinkBackReplay.map((tb) => (
            <div key={tb.strike} className="bg-terminal-900 px-2 py-1 rounded border border-terminal-border/60 flex justify-between text-[10px] font-mono">
              <span className="text-white font-bold">K={tb.strike} (Δ {tb.replayDelta})</span>
              <span className="text-emerald-300">C {tb.callBid}/{tb.callAsk}</span>
              <span className="text-rose-300">P {tb.putBid}/{tb.putAsk}</span>
            </div>
          ))}
          <div className="pt-1 space-y-1">
            {options.strategyOptimizer.map((st) => (
              <div key={st.strategy} className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded text-[10px] font-mono">
                <div className="text-white font-bold">{st.strategy} ({st.dteTarget} DTE)</div>
                <div className="text-emerald-300">Win {st.winRatePct}% • EV +{st.expectedReturnPct}% • Sharpe {st.sharpeRatio}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
