'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Calculator, Play, Pause, FileSpreadsheet, Ship, GitBranch } from 'lucide-react';
import type { MacroFundamentalSnapshot } from '@/lib/institutional/types';

interface Props {
  symbol: string;
  macro: MacroFundamentalSnapshot;
  onRefreshMacro: (payload: Record<string, any>) => Promise<void>;
  onDownloadTearSheet: () => void;
}

export const MacroFundamentalDesk: React.FC<Props> = ({
  symbol,
  macro,
  onDownloadTearSheet,
}) => {
  const [formulaInput, setFormulaInput] = useState<string>(macro.customRatioEvaluation.formula);
  const [ratioResult, setRatioResult] = useState(macro.customRatioEvaluation);
  const [curveIdx, setCurveIdx] = useState<number>(0);
  const [isAnimatingCurve, setIsAnimatingCurve] = useState<boolean>(false);

  useEffect(() => {
    if (!isAnimatingCurve) return;
    const id = setInterval(() => {
      setCurveIdx((prev) => (prev + 1) % macro.yieldCurveHistory.length);
    }, 1100);
    return () => clearInterval(id);
  }, [isAnimatingCurve, macro.yieldCurveHistory.length]);

  const handleEvaluateFormula = async () => {
    const res = await fetch('/api/institutional/macro-fundamental', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'EVALUATE_RATIO', symbol, formula: formulaInput }),
    });
    const json = await res.json();
    if (json?.customRatioEvaluation) setRatioResult(json.customRatioEvaluation);
  };

  const activeCurve = macro.yieldCurveHistory[curveIdx] || macro.yieldCurveHistory[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-terminal-950 border border-terminal-border rounded-xl px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Bloomberg / FactSet / Refinitiv / Koyfin Institutional Macro & Corporate Intelligence</span>
          </h3>
          <p className="text-[11px] font-mono text-slate-400">
            OTC Sovereign Curves, Supply Chain Graphs, 13F Crowding, StarMine Scores, PIT Revisions, CDS & AIS Shipping
          </p>
        </div>
        <button
          onClick={onDownloadTearSheet}
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Generate Client Tear Sheet</span>
        </button>
      </div>

      {/* OTC Bonds + Animated Yield Curve Shifts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-cyan-400 uppercase font-mono">Real-Time OTC Sovereign Bond Pricing & 5Y CDS Spreads</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-terminal-border text-left">
                  <th className="py-1">Benchmark</th>
                  <th className="py-1">Issuer</th>
                  <th className="py-1 text-right">Yield %</th>
                  <th className="py-1 text-right">Clean Px</th>
                  <th className="py-1 text-right">DV01/$1M</th>
                  <th className="py-1 text-right">Chg bps</th>
                </tr>
              </thead>
              <tbody>
                {macro.otcBonds.map((b) => (
                  <tr key={b.ticker} className="border-b border-terminal-border/40">
                    <td className="py-1 text-white font-bold">{b.ticker}</td>
                    <td className="py-1 text-slate-300 text-[11px]">{b.issuer}</td>
                    <td className="py-1 text-right text-cyan-300 font-bold">{b.yieldPct.toFixed(2)}%</td>
                    <td className="py-1 text-right text-slate-200">{b.cleanPrice.toFixed(2)}</td>
                    <td className="py-1 text-right text-slate-400">${b.dv01PerMillion}</td>
                    <td className={`py-1 text-right ${b.dailyChangeBps >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {b.dailyChangeBps >= 0 ? '+' : ''}{b.dailyChangeBps}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {macro.cdsSpreads.map((c) => (
              <div key={c.referenceEntity} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-slate-400 truncate">{c.referenceEntity}</div>
                <div className="text-amber-300 font-bold mt-0.5">{c.spreadBps} bps (5Y CDS)</div>
                <div className="text-slate-400">PD: {c.implied5YDefaultProbPct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Yield Curve Historical Shift Animation */}
        <div className="xl:col-span-5 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-400 uppercase font-mono">
              Yield Curve Historical Shift ({activeCurve.snapshotLabel})
            </h4>
            <button
              onClick={() => setIsAnimatingCurve((v) => !v)}
              className="px-2.5 py-1 rounded bg-terminal-800 hover:bg-terminal-700 border border-terminal-border text-xs font-mono text-cyan-300 flex items-center gap-1"
            >
              {isAnimatingCurve ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isAnimatingCurve ? 'Pause' : 'Animate Shifts'}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {macro.yieldCurveHistory.map((snap, idx) => (
              <button
                key={snap.snapshotLabel}
                onClick={() => {
                  setIsAnimatingCurve(false);
                  setCurveIdx(idx);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  idx === curveIdx ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'bg-terminal-900 text-slate-400 border-terminal-border'
                }`}
              >
                {snap.snapshotLabel} ({snap.spread2s10sBps >= 0 ? '+' : ''}{snap.spread2s10sBps}bps)
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 pt-2 items-end h-36 bg-terminal-900/60 p-3 rounded border border-terminal-border">
            {activeCurve.points.map((pt) => {
              const heightPct = Math.max(20, Math.min(100, ((pt.yieldPct - 3.2) / 2.5) * 100));
              return (
                <div key={pt.tenor} className="flex flex-col items-center justify-end h-full gap-1 font-mono">
                  <span className="text-[10px] text-cyan-300 font-bold">{pt.yieldPct.toFixed(2)}%</span>
                  <div className="w-full max-w-[32px] bg-gradient-to-t from-cyan-600 to-indigo-500 rounded-t transition-all duration-500" style={{ height: `${heightPct}%` }} />
                  <span className="text-[10px] text-slate-400">{pt.tenor}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Supply Chain Mapping + StarMine Analyst Accuracy + 13F + PIT Revisions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>Global Supply Chain Dependency & Fragility Mapping</span>
          </h4>
          <div className="space-y-1.5">
            {macro.supplyChainGraph.map((node) => (
              <div key={node.entity} className="bg-terminal-900 p-2 rounded border border-terminal-border/60 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-white font-semibold">{node.entity} ({node.country})</span>
                  <span className="text-amber-300">Fragility {node.fragilityScore}/100</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>{node.tier} • Dep {node.revenueDependencyPct}%</span>
                  <span className="text-rose-300">{node.chokepointRisk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
            <Ship className="w-4 h-4 text-cyan-400" />
            <span>AIS Global Maritime Shipping, 13F Ownership & StarMine Accuracy</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
              <div className="text-slate-400">Baltic Dry Index</div>
              <div className="text-emerald-400 font-bold">{macro.shippingTracker.balticDryIndex} (+{macro.shippingTracker.bdiChangePct}%)</div>
            </div>
            <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
              <div className="text-slate-400">WCI Container</div>
              <div className="text-cyan-300 font-bold">${macro.shippingTracker.wciContainerUsd}/FEU</div>
            </div>
            <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
              <div className="text-slate-400">StarMine SmartEst</div>
              <div className="text-white font-bold">{macro.starMineAnalystScores[0].smartEstimate} vs {macro.starMineAnalystScores[0].consensusEstimate}</div>
            </div>
            <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
              <div className="text-slate-400">PIT Revisions</div>
              <div className="text-amber-300 font-bold">{macro.pitFundamentalRevisions.length} Restated Windows</div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            {macro.institutionalOwnership.map((inst) => (
              <div key={inst.institution} className="bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border/60 flex justify-between">
                <span className="text-slate-200 truncate">{inst.institution}</span>
                <span className="text-emerald-400 shrink-0">{inst.ownershipPct}% (+{inst.qoqChangePct}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Ratio Formula Builder + Cross-Asset Correlation Matrix + Tax Engine + Scatter */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span>Custom Financial Ratio Formula Builder</span>
            </h4>
            <button onClick={handleEvaluateFormula} className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold">
              Evaluate Ratio
            </button>
          </div>
          <input
            type="text"
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            placeholder="Variables: MarketCap, FCF, ROIC, EBITDA, EV, Debt, Revenue, EPS"
            className="w-full bg-terminal-900 border border-terminal-border rounded px-3 py-1.5 text-xs font-mono text-cyan-200"
          />
          {!ratioResult.valid ? (
            <div className="text-xs font-mono text-rose-400">{ratioResult.error}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ratioResult.results.map((r) => (
                <div key={r.symbol} className="bg-terminal-900 p-2 rounded border border-terminal-border text-xs font-mono">
                  <div className="text-slate-400">{r.symbol}</div>
                  <div className="text-emerald-400 font-bold">{r.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] font-mono text-slate-400 pt-1">
            Econ Scatter ({macro.economicScatterPlot.xIndicator} vs {macro.economicScatterPlot.yIndicator}): Slope <strong className="text-white">{macro.economicScatterPlot.slope}</strong> • R²=<strong className="text-cyan-300">{macro.economicScatterPlot.rSquared}</strong>
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-white uppercase font-mono">90D Cross-Asset Correlation Matrix & Dynamic Tax Normalization</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono text-center">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left py-1">Asset</th>
                  {macro.correlationMatrix.assets.map((a) => <th key={a} className="py-1">{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {macro.correlationMatrix.assets.map((rowAsset, i) => (
                  <tr key={rowAsset} className="border-t border-terminal-border/30">
                    <td className="text-left py-1 text-white font-bold">{rowAsset}</td>
                    {macro.correlationMatrix.values[i].map((val, j) => (
                      <td
                        key={j}
                        className={`py-1 ${val > 0.5 ? 'text-emerald-300 font-bold' : val < -0.4 ? 'text-rose-300 font-bold' : 'text-slate-300'}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {macro.dynamicTaxAdjustment.map((t) => (
              <div key={t.company} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-white font-bold">{t.company}</div>
                <div className="text-cyan-300">Eff {t.effectiveRatePct}% → Norm {t.normalizedRatePct}%</div>
                <div className="text-slate-400">Adj NOPAT ${t.taxAdjustedNopatMillions}M</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
