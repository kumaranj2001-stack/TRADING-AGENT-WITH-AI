'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Bot, Satellite, Activity, Lock } from 'lucide-react';
import { isIndianSymbol } from '@/lib/marketData';
import type {
  AlternativeDataSnapshot,
  JournalRiskAuditSnapshot,
  QuantBacktestSnapshot,
} from '@/lib/institutional/types';

interface Props {
  mode: 'alt-data' | 'quant' | 'risk';
  symbol: string;
  altData: AlternativeDataSnapshot;
  quant: QuantBacktestSnapshot;
  riskAudit: JournalRiskAuditSnapshot;
  onRefreshQuant: (payload: Record<string, any>) => Promise<void>;
  onRefreshRisk: (payload: Record<string, any>) => Promise<void>;
}

export const AltDataQuantRiskDesk: React.FC<Props> = ({
  mode,
  symbol,
  altData,
  quant,
  riskAudit,
  onRefreshQuant,
  onRefreshRisk,
}) => {
  const [formulaScript, setFormulaScript] = useState<string>(quant.formulaBacktester.script);
  const [formulaLanguage, setFormulaLanguage] = useState<'POWER_LANGUAGE' | 'CSHARP_QC'>(quant.formulaBacktester.language);
  const [webhookStatus, setWebhookStatus] = useState<string>(quant.cloudWebhookScanner.lastMt5BridgeStatus);
  const [webhookCount, setWebhookCount] = useState<number>(quant.cloudWebhookScanner.dispatchedCount);
  const [includeDelisted, setIncludeDelisted] = useState<boolean>(
    quant.eventDrivenTickBacktest.universeMode === 'SURVIVORSHIP_FREE_WITH_DELISTED'
  );
  const [topNRotation, setTopNRotation] = useState<number>(quant.aflArrayBacktest.topNRotation || 4);
  const [lookbackMonths, setLookbackMonths] = useState<number>(12);
  const [isRunningBacktest, setIsRunningBacktest] = useState<boolean>(false);
  const [isRunningFormula, setIsRunningFormula] = useState<boolean>(false);
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState<boolean>(false);
  const [mcResult, setMcResult] = useState(riskAudit.monteCarloEquity);

  useEffect(() => {
    setFormulaScript(quant.formulaBacktester.script);
    setFormulaLanguage(quant.formulaBacktester.language);
    setWebhookStatus(quant.cloudWebhookScanner.lastMt5BridgeStatus);
    setWebhookCount(quant.cloudWebhookScanner.dispatchedCount);
    setIncludeDelisted(quant.eventDrivenTickBacktest.universeMode === 'SURVIVORSHIP_FREE_WITH_DELISTED');
    setTopNRotation(quant.aflArrayBacktest.topNRotation || 4);
    setMcResult(riskAudit.monteCarloEquity);
  }, [symbol, quant, riskAudit]);

  const handleRunTickBacktest = async () => {
    setIsRunningBacktest(true);
    try {
      await onRefreshQuant({
        action: 'RUN_TICK_BACKTEST',
        symbol,
        includeDelisted,
        topNRotation,
        lookbackMonths,
      });
    } finally {
      setIsRunningBacktest(false);
    }
  };

  const handleRunFormula = async () => {
    setIsRunningFormula(true);
    try {
      await onRefreshQuant({
        action: 'RUN_FORMULA',
        symbol,
        script: formulaScript,
        language: formulaLanguage,
      });
    } finally {
      setIsRunningFormula(false);
    }
  };

  const handleTriggerWebhook = async () => {
    setIsDispatchingWebhook(true);
    try {
      await onRefreshQuant({
        action: 'DISPATCH_WEBHOOK',
        symbol,
        side: 'BUY',
        lots: 0.5,
        previousCount: webhookCount,
      });
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  const handleRunMonteCarlo = async () => {
    const res = await fetch('/api/institutional/risk-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MONTE_CARLO', initialEquity: 100000, horizonTrades: 50, winRatePct: 60, avgWinR: 1.9, riskPerTradePct: 1.0, simulations: 2000 }),
    });
    const json = await res.json();
    if (json?.monteCarloEquity) setMcResult(json.monteCarloEquity);
  };

  if (mode === 'alt-data') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
          <div className="bg-terminal-950 border border-cyan-500/30 rounded-lg p-3">
            <div className="text-[10px] text-slate-400">COMPOSITE ALT-ALPHA SCORE</div>
            <div className="text-lg font-bold text-cyan-300 mt-1">{altData.compositeAltAlphaScore}/100</div>
            <div className="text-[10px] text-emerald-400">Wired into 8-Agent Debate & Scanner</div>
          </div>
          {altData.esgGeopoliticalNlp.slice(0, 3).map((e) => (
            <div key={e.pillar} className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
              <div className="text-[10px] text-slate-400">{e.pillar} NLP SCORE</div>
              <div className="text-lg font-bold text-white mt-1">{e.score}/100</div>
              <div className="text-[10px] text-slate-400 truncate">{e.keyDriver}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Satellite className="w-4 h-4 text-cyan-400" />
              <span>Satellite Retail Parking, Card Spend & Job Velocity (Thinknum/Quandl)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {altData.satelliteParkingData.map((s) => (
                <div key={s.ticker} className="bg-terminal-900 p-2.5 rounded border border-terminal-border text-xs font-mono">
                  <div className="text-white font-bold">{s.retailer} ({s.ticker})</div>
                  <div className="text-cyan-300">Lot Fill: {s.fillRatePct}% ({s.yoyTrafficDeltaPct >= 0 ? '+' : ''}{s.yoyTrafficDeltaPct}% YoY)</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {altData.corporateJobVelocity.map((j) => (
                <div key={j.company} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                  <div className="text-white font-bold truncate">{j.company}</div>
                  <div className="text-emerald-400">AI Jobs {j.aiEngineeringDelta30dPct >= 0 ? '+' : ''}{j.aiEngineeringDelta30dPct}%</div>
                  <div className="text-slate-400">{j.signal}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
            <h3 className="text-sm font-bold text-white">RavenPack News Novelty (ENS), Macro Taxonomy & E-Commerce Pricing</h3>
            {altData.newsNoveltyScores.map((n, i) => (
              <div key={i} className="bg-terminal-900 p-2 rounded border border-terminal-border text-xs font-mono">
                <div className="flex justify-between text-[10px] text-amber-300">
                  <span>{n.taxonomyCode}</span>
                  <span>ENS Novelty: {n.ensNoveltyScore}/100 • ESS {n.essSentimentScore}</span>
                </div>
                <div className="text-white mt-0.5">{n.headline}</div>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {altData.ecommercePricingTracker.map((ec) => (
                <div key={ec.brand} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                  <div className="text-white font-bold truncate">{ec.brand}</div>
                  <div className="text-cyan-300">Px Index {ec.priceIndexVs30d} • Disc {ec.avgDiscountPct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'quant') {
    return (
      <div className="space-y-4">
        {/* Tick Backtest (Survivorship-Free), AFL Array Rotation, Composer Symphonies */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Survivorship-Free Event-Driven Tick Backtester & AFL Array Rotation</span>
              </h3>
              <button
                type="button"
                onClick={handleRunTickBacktest}
                disabled={isRunningBacktest}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-mono font-bold"
              >
                {isRunningBacktest ? 'Running Tick Sim...' : 'Run Tick Backtest'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setIncludeDelisted((v) => !v)}
                className={`px-2 py-0.5 rounded border ${
                  includeDelisted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                Delisted Universe: {includeDelisted ? 'INCLUDED' : 'ACTIVE ONLY'}
              </button>
              <label className="flex items-center gap-1 text-slate-300 bg-terminal-900 px-2 py-0.5 rounded border border-terminal-border">
                <span>Top-N:</span>
                <select
                  value={topNRotation}
                  onChange={(e) => setTopNRotation(Number(e.target.value))}
                  className="bg-transparent text-cyan-300 font-bold focus:outline-none"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n} className="bg-terminal-900">
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-slate-300 bg-terminal-900 px-2 py-0.5 rounded border border-terminal-border">
                <span>Horizon:</span>
                <select
                  value={lookbackMonths}
                  onChange={(e) => setLookbackMonths(Number(e.target.value))}
                  className="bg-transparent text-cyan-300 font-bold focus:outline-none"
                >
                  {[6, 12, 24].map((m) => (
                    <option key={m} value={m} className="bg-terminal-900">
                      {m}M
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
                <div className="text-[10px] text-slate-400">DELISTED INCL.</div>
                <div className="text-white font-bold">{quant.eventDrivenTickBacktest.delistedConstituentsIncluded} Tickers</div>
              </div>
              <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
                <div className="text-[10px] text-slate-400">CAGR / SHARPE</div>
                <div className="text-emerald-400 font-bold">{quant.eventDrivenTickBacktest.cagrPct}% / {quant.eventDrivenTickBacktest.sharpeRatio}</div>
              </div>
              <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
                <div className="text-[10px] text-slate-400">AFL ARRAY SPEED</div>
                <div className="text-cyan-300 font-bold">{quant.aflArrayBacktest.computeTimeMs}ms</div>
              </div>
              <div className="bg-terminal-900 p-2 rounded border border-terminal-border">
                <div className="text-[10px] text-slate-400">WALK-FWD EFF</div>
                <div className="text-amber-300 font-bold">{quant.symphonyWalkForward.walkForwardEfficiencyPct}%</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quant.aflArrayBacktest.rotationalHoldings.map((h) => (
                <div key={h.symbol} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[11px] font-mono">
                  <div className="text-white font-bold">#{h.rank} {h.symbol}</div>
                  <div className="text-emerald-300">Score {h.positionScore} ({h.weightPct}%)</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 text-[11px] font-mono text-slate-300 bg-terminal-900 p-2.5 rounded border border-terminal-border">
              <div className="text-cyan-400 font-bold">{quant.symphonyWalkForward.symphonyName} (IS {quant.symphonyWalkForward.inSampleSharpe} vs OOS {quant.symphonyWalkForward.outOfSampleSharpe})</div>
              {quant.symphonyWalkForward.rulesSummary.map((r, i) => <div key={i}>• {r}</div>)}
            </div>
          </div>

          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>PowerLanguage/C# Backtester & Cloud Webhook → MT5 Bridge</span>
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRunFormula}
                  disabled={isRunningFormula}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-mono font-bold"
                >
                  {isRunningFormula ? 'Compiling...' : 'Run Formula'}
                </button>
                <button
                  type="button"
                  onClick={handleTriggerWebhook}
                  disabled={isDispatchingWebhook}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-mono font-bold"
                >
                  {isDispatchingWebhook ? 'Dispatching...' : 'Dispatch Webhook → MT5'}
                </button>
              </div>
            </div>
            <textarea
              value={formulaScript}
              onChange={(e) => setFormulaScript(e.target.value)}
              rows={5}
              className="w-full bg-terminal-900 border border-terminal-border rounded p-2 text-[11px] font-mono text-cyan-200"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border">
              <span className={quant.formulaBacktester.compiledValid ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                Formula: {quant.formulaBacktester.compiledValid ? 'VALID' : 'CHECK SYNTAX'} ({quant.formulaBacktester.totalSignals} signals)
              </span>
              <span className="text-cyan-300">
                PF {quant.formulaBacktester.profitFactor} • Net +{quant.formulaBacktester.netReturnPct}%
              </span>
            </div>
            <div className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 p-2 rounded break-words">
              Webhook Bridge: {webhookStatus} (Dispatched #{webhookCount}) • Trailing Stop ({quant.trailingStopEngine.mode}): {quant.trailingStopEngine.currentStopPrice} (+{quant.trailingStopEngine.lockedProfitR}R Locked)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quant.dcaGridBots.map((bot) => {
                const isInrBot = isIndianSymbol(bot.pair);
                const pnlPrefix = isInrBot ? '₹' : '$';
                const formattedPnl = isInrBot
                  ? bot.realizedPnlUsd.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : bot.realizedPnlUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div key={bot.botName} className="bg-terminal-900 p-2.5 rounded border border-terminal-border text-[11px] font-mono">
                    <div className="text-white font-bold">{bot.botName}</div>
                    <div className="text-emerald-400">PnL +{pnlPrefix}{formattedPnl} • Est {bot.estimatedAprPct}% APR</div>
                    <div className="text-slate-400">Range {bot.rangeLow}–{bot.rangeHigh} ({bot.gridLevelsOrSafetyOrders} lvls)</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // INSTITUTIONAL JOURNAL, BEHAVIORAL TILT METER, MONTE CARLO, C2 AUDIT, DARWIN VAR & ZULUGUARD
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="bg-terminal-950 border border-emerald-500/30 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">MAE / MFE EDGE RATIO</div>
          <div className="text-base font-bold text-emerald-400 mt-1">{riskAudit.maeMfeAnalytics.edgeRatio}x Edge ({riskAudit.maeMfeAnalytics.captureEfficiencyPct}% Capture)</div>
          <div className="text-[10px] text-slate-400">Avg MAE {riskAudit.maeMfeAnalytics.avgMaeR}R • Avg MFE {riskAudit.maeMfeAnalytics.avgMfeR}R</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
          <div className="text-[10px] text-slate-400">EDGEWONK TILT METER</div>
          <div className="text-base font-bold text-cyan-300 mt-1">{riskAudit.tiltMeter.disciplineScore}/100 ({riskAudit.tiltMeter.emotionalState})</div>
          <div className="text-[10px] text-slate-400">Revenge Flagged: {riskAudit.tiltMeter.revengeTradesFlagged}</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
          <div className="text-[10px] text-slate-400">DARWIN 10% VaR SCORE</div>
          <div className="text-base font-bold text-indigo-300 mt-1">{riskAudit.darwinVaREngine.darwinScore}/100 ({riskAudit.darwinVaREngine.normalizationMultiplier}x)</div>
          <div className="text-[10px] text-slate-400">Raw VaR {riskAudit.darwinVaREngine.rawStrategyVaRPct}% → Target 10%</div>
        </div>
        <div className="bg-terminal-950 border border-amber-500/30 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">ZULUGUARD DD PROTECTION</div>
          <div className="text-base font-bold text-amber-300 mt-1">-{riskAudit.zuluGuardProtection.currentDrawdownPct}% / -{riskAudit.zuluGuardProtection.hardStopLimitPct}% Cap</div>
          <div className="text-[10px] text-emerald-400">{riskAudit.zuluGuardProtection.protectionState}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>MAE/MFE Broker Sync Journal & Behavioral Mistake Cost Attribution</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-terminal-border text-left">
                  <th className="py-1">Trade</th>
                  <th className="py-1">MAE</th>
                  <th className="py-1">MFE</th>
                  <th className="py-1">Realized</th>
                  <th className="py-1 text-right">Mistake Tag</th>
                </tr>
              </thead>
              <tbody>
                {riskAudit.maeMfeAnalytics.trades.map((t) => (
                  <tr key={t.id} className="border-b border-terminal-border/40">
                    <td className="py-1 text-white font-bold">{t.id} {t.symbol}</td>
                    <td className="py-1 text-rose-400">{t.maeR}R</td>
                    <td className="py-1 text-emerald-400">+{t.mfeR}R</td>
                    <td className={`py-1 font-bold ${t.realizedR >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{t.realizedR}R</td>
                    <td className="py-1 text-right text-amber-300">{t.mistakeTag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
            {riskAudit.tiltMeter.mistakeBreakdown.map((m) => (
              <div key={m.tag} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-white font-bold truncate">{m.tag}</div>
                <div className={m.netCostUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${m.netCostUsd} ({m.occurrences}x)</div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Monte Carlo Equity Fan ({mcResult.simulations} Runs) & C2 Cryptographic Track Record</span>
            </h3>
            <button onClick={handleRunMonteCarlo} className="px-2.5 py-1 rounded bg-cyan-600 text-white text-xs font-mono font-bold">
              Simulate 2,000 Paths
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[10px] font-mono">
            {mcResult.percentiles.map((p) => (
              <div key={p.step} className="bg-terminal-900 p-1.5 rounded border border-terminal-border">
                <div className="text-slate-400">Tr #{p.step}</div>
                <div className="text-emerald-300">P95 ${(p.p95 / 1000).toFixed(0)}k</div>
                <div className="text-white font-bold">P50 ${(p.p50 / 1000).toFixed(0)}k</div>
                <div className="text-rose-300">P5 ${(p.p5 / 1000).toFixed(0)}k</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] font-mono text-cyan-300">
            Risk of Ruin: {mcResult.riskOfRuinPct}% • Certified ID: {riskAudit.verifiedTrackRecord.certificateId} (TWRR +{riskAudit.verifiedTrackRecord.twrrPct}%)
          </div>
          <div className="space-y-1">
            {riskAudit.darwinVaREngine.stressTests.map((st) => (
              <div key={st.scenario} className="bg-terminal-900 px-2.5 py-1 rounded border border-terminal-border/60 flex justify-between text-[10px] font-mono">
                <span className="text-slate-200 truncate">{st.scenario}</span>
                <span className="text-emerald-400 shrink-0">{st.portfolioImpactPct}% • SURVIVED</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-terminal-950 border border-terminal-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <span className="text-slate-300">
          SHA-256 Audit Chain Head: <strong className="text-cyan-300">{riskAudit.verifiedTrackRecord.hashChainHead}</strong>
        </span>
        <button
          onClick={() => onRefreshRisk({ symbol, drawdownHardLimitPct: 5.0 })}
          className="px-2.5 py-1 rounded bg-amber-600/20 text-amber-300 border border-amber-500/40 font-bold"
        >
          Tighten ZuluGuard Stop to -5.0%
        </button>
      </div>
    </div>
  );
};
