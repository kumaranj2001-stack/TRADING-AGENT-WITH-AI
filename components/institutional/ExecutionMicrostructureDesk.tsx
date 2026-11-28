'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Layers,
  ShieldCheck,
  Terminal,
  Zap,
  Flame,
  Filter,
} from 'lucide-react';
import type { ExecutionBridgeSnapshot, MicrostructureSnapshot } from '@/lib/institutional/types';

interface Props {
  mode: 'execution' | 'microstructure';
  symbol: string;
  execution: ExecutionBridgeSnapshot;
  microstructure: MicrostructureSnapshot;
  onRefreshExecution: (payload: Record<string, any>) => Promise<void>;
  onRefreshMicrostructure: (payload: Record<string, any>) => Promise<void>;
}

export const ExecutionMicrostructureDesk: React.FC<Props> = ({
  mode,
  symbol,
  execution,
  microstructure,
  onRefreshExecution,
  onRefreshMicrostructure,
}) => {
  const [domLots, setDomLots] = useState<number>(1.5);
  const [algoType, setAlgoType] = useState<'VWAP' | 'TWAP' | 'IMPLEMENTATION_SHORTFALL' | 'POV'>(
    execution.vwapExecution.algorithm
  );
  const [cBotCode, setCBotCode] = useState<string>(execution.cBotIde.defaultCode);
  const [cBotCompile, setCBotCompile] = useState(execution.cBotIde.compileResult);
  const [cppCode, setCppCode] = useState<string>(microstructure.cppAcsilStudy.sourceCode);
  const [smartTapeMin, setSmartTapeMin] = useState<number>(microstructure.smartTapeMinFilter);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);

  useEffect(() => {
    setAlgoType(execution.vwapExecution.algorithm);
    setCBotCode(execution.cBotIde.defaultCode);
    setCBotCompile(execution.cBotIde.compileResult);
    setCppCode(microstructure.cppAcsilStudy.sourceCode);
    setSmartTapeMin(microstructure.smartTapeMinFilter);
    setBusyMsg(null);
  }, [symbol, execution, microstructure]);

  const handleDomOrder = async (side: 'BUY' | 'SELL', price: number, orderType: 'LIMIT' | 'MARKET' = 'LIMIT') => {
    setBusyMsg(`Routing ${side} ${orderType} @ ${price} via FIX 4.4 / MT5 Bridge...`);
    await onRefreshExecution({
      action: 'DOM_SUBMIT',
      symbol,
      side,
      orderType,
      price,
      quantityLots: domLots,
    });
    setBusyMsg(`FIX Order Accepted (${side} ${domLots} lots @ ${price})`);
  };

  const handleCancelOrder = async (orderId: string) => {
    await onRefreshExecution({ action: 'DOM_CANCEL', symbol, orderId });
  };

  const handleCompileCBot = async () => {
    const res = await fetch('/api/institutional/execution-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'COMPILE_CBOT', symbol, code: cBotCode }),
    });
    const json = await res.json();
    if (json?.compileResult) setCBotCompile(json.compileResult);
  };

  if (mode === 'execution') {
    return (
      <div className="space-y-4">
        {/* Top Bridge Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-terminal-950 border border-emerald-500/30 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400">MT5 + FIX 4.4 BRIDGE</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{execution.fixSession.status}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-300 mt-1">
              Seq #{execution.fixSession.seqNum} • {execution.fixSession.heartbeatMs}ms HB
            </div>
          </div>
          <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400">L2 MODELED SLIPPAGE ({execution.slippageEstimate.orderUnits}u)</div>
            <div className="text-sm font-bold text-cyan-400 mt-1 font-mono">
              {execution.slippageEstimate.totalSlippageBps} bps (${execution.slippageEstimate.estimatedCostUsd})
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Spread Walk {execution.slippageEstimate.spreadWalkBps} + Impact {execution.slippageEstimate.marketImpactBps} bps
            </div>
          </div>
          <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400">MT5 GA STRATEGY BEST SHARPE</div>
            <div className="text-sm font-bold text-amber-400 mt-1 font-mono">
              {execution.geneticOptimization.bestCandidate.sharpeRatio} Sharpe ({execution.geneticOptimization.bestCandidate.winRatePct}% WR)
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Gen {execution.geneticOptimization.generationsCompleted} × Pop {execution.geneticOptimization.populationSize}
            </div>
          </div>
          <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400">ALGO ARRIVAL COST ({execution.vwapExecution.algorithm})</div>
            <div className="text-sm font-bold text-indigo-400 mt-1 font-mono">
              {execution.vwapExecution.estimatedArrivalSlippageBps} bps • {execution.vwapExecution.participationRatePct}% POV
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              6 Intraday Institutional Slices
            </div>
          </div>
        </div>

        {busyMsg && (
          <div className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 flex items-center justify-between">
            <span>{busyMsg}</span>
            <button onClick={() => setBusyMsg(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* DOM Ladder + IBKR SmartRouter */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Depth of Market (DOM) Clickable Execution Ladder */}
          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border pb-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Level II Depth of Market (DOM) Execution Ladder</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">Click Bid/Ask cells to stage FIX LIMIT orders • Spot {execution.spotPrice}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">Lots:</span>
                {[0.5, 1.5, 5.0].map((l) => (
                  <button
                    key={l}
                    onClick={() => setDomLots(l)}
                    className={`px-2 py-0.5 rounded text-xs font-mono border ${
                      domLots === l ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-terminal-900 text-slate-400 border-terminal-border'
                    }`}
                  >
                    {l}
                  </button>
                ))}
                <button
                  onClick={() => handleDomOrder('BUY', execution.spotPrice, 'MARKET')}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  MKT BUY
                </button>
                <button
                  onClick={() => handleDomOrder('SELL', execution.spotPrice, 'MARKET')}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  MKT SELL
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-400 border-b border-terminal-border">
                    <th className="py-1 text-left">Bid Venue</th>
                    <th className="py-1 text-right">Bid Sz</th>
                    <th className="py-1 text-center text-emerald-400">Bid Px (LMT BUY)</th>
                    <th className="py-1 text-center text-rose-400">Ask Px (LMT SELL)</th>
                    <th className="py-1 text-left">Ask Sz</th>
                    <th className="py-1 text-right">Ask Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {execution.level2Book.slice(0, 8).map((row) => (
                    <tr key={row.level} className="border-b border-terminal-border/40 hover:bg-terminal-900/60">
                      <td className="py-1 text-slate-400 text-[10px]">{row.bidVenue}</td>
                      <td className="py-1 text-right text-emerald-300">{row.bidSize}</td>
                      <td className="py-1 text-center">
                        <button
                          onClick={() => handleDomOrder('BUY', row.bidPrice, 'LIMIT')}
                          className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                        >
                          {row.bidPrice}
                        </button>
                      </td>
                      <td className="py-1 text-center">
                        <button
                          onClick={() => handleDomOrder('SELL', row.askPrice, 'LIMIT')}
                          className="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                        >
                          {row.askPrice}
                        </button>
                      </td>
                      <td className="py-1 text-left text-rose-300">{row.askSize}</td>
                      <td className="py-1 text-right text-slate-400 text-[10px]">{row.askVenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {execution.domOrders.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-terminal-border">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Active & Recent FIX Orders</div>
                {execution.domOrders.slice(0, 4).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[11px] font-mono bg-terminal-900 px-2.5 py-1 rounded border border-terminal-border">
                    <span className={o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                      {o.id} • {o.side} {o.quantityLots} {o.orderType} @ {o.price} ({o.status})
                    </span>
                    {o.status === 'RESTING' && (
                      <button onClick={() => handleCancelOrder(o.id)} className="text-amber-400 hover:text-amber-300 underline">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IBKR SmartRouting & VWAP Algorithm Slicer */}
          <div className="xl:col-span-6 space-y-4">
            <div className="bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>IBKR SmartRouting-Style Multi-Venue Liquidity Allocation</span>
              </h3>
              <div className="space-y-2">
                {execution.smartRouting.map((v) => (
                  <div key={v.venue} className="bg-terminal-900/70 p-2 rounded border border-terminal-border/60 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">{v.venue} <span className="text-cyan-400 text-[10px]">[{v.protocol}]</span></span>
                      <span className="text-emerald-400 font-bold">{v.allocationPct}% Split • {v.latencyMs}ms</span>
                    </div>
                    <div className="w-full h-1.5 bg-terminal-800 rounded mt-1 overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${v.allocationPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Fill Prob: {v.fillProbabilityPct}%</span>
                      <span>Rebate/Fee: {v.rebateOrFeeBps} bps</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Institutional VWAP / TWAP / IS Algo Slicer</h3>
                <select
                  value={algoType}
                  onChange={async (e) => {
                    const next = e.target.value as any;
                    setAlgoType(next);
                    await onRefreshExecution({ symbol, algorithm: next });
                  }}
                  className="bg-terminal-900 border border-terminal-border text-xs font-mono text-cyan-300 rounded px-2 py-1"
                >
                  <option value="VWAP">VWAP (U-Shape)</option>
                  <option value="TWAP">TWAP (Uniform)</option>
                  <option value="IMPLEMENTATION_SHORTFALL">Implementation Shortfall</option>
                  <option value="POV">Percentage of Volume</option>
                </select>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {execution.vwapExecution.slices.map((s) => (
                  <div key={s.bucketLabel} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                    <div className="text-slate-400">{s.bucketLabel}</div>
                    <div className="text-white font-bold mt-0.5">{s.historicalVolPct}% Vol</div>
                    <div className="text-cyan-400">{s.executedUnits}/{s.targetUnits}u</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MT5 Genetic Algorithm Optimizer & cTrader Automate C# Native IDE */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>MT5 Strategy Tester Genetic Algorithm Optimizer</span>
              </h3>
              <button
                onClick={() => onRefreshExecution({ action: 'RUN_GA', symbol })}
                className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold"
              >
                Re-Evolve GA
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-400 border-b border-terminal-border text-left">
                    <th className="py-1">Rank</th>
                    <th className="py-1">Lookback</th>
                    <th className="py-1">ATR x</th>
                    <th className="py-1">R:R</th>
                    <th className="py-1">Session</th>
                    <th className="py-1 text-right">Sharpe</th>
                    <th className="py-1 text-right">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {execution.geneticOptimization.topCandidates.map((c) => (
                    <tr key={`${c.rank}-${c.lookback}`} className="border-b border-terminal-border/40">
                      <td className="py-1 text-amber-400 font-bold">#{c.rank}</td>
                      <td className="py-1 text-white">{c.lookback}</td>
                      <td className="py-1 text-slate-300">{c.atrMultiplier}x</td>
                      <td className="py-1 text-slate-300">1:{c.takeProfitRR}</td>
                      <td className="py-1 text-cyan-300 text-[10px]">{c.sessionFilter}</td>
                      <td className="py-1 text-right text-emerald-400 font-bold">{c.sharpeRatio}</td>
                      <td className="py-1 text-right text-slate-200">{c.profitFactor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-terminal-900/90 p-2 rounded border border-terminal-border text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto">
              {execution.fixSession.recentRawMessages.map((m, i) => (
                <div key={i} className="truncate">{m}</div>
              ))}
            </div>
          </div>

          <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>cTrader Automate C# Native cBot IDE</span>
              </h3>
              <button
                onClick={handleCompileCBot}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold"
              >
                Compile C# Bot
              </button>
            </div>
            <textarea
              value={cBotCode}
              onChange={(e) => setCBotCode(e.target.value)}
              rows={8}
              className="w-full bg-terminal-900 border border-terminal-border rounded-lg p-2.5 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-cyan-500"
            />
            <div className={`p-2 rounded text-[11px] font-mono border ${
              cBotCompile.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {cBotCompile.diagnostics.join(' | ')} • Tick Latency: {cBotCompile.estimatedTickLatencyUs}µs • Sharpe {cBotCompile.simulatedSharpe}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MICROSTRUCTURE MODE (Bookmap, TPO, Footprint, C++ ACSIL, Iceberg, Power Trades, Reconstructed Tape, Liquidation Heatmap)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Volumetric Footprint + Cluster Search */}
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>ATAS / ExoCharts Volumetric Footprint & Diagonal Imbalances</span>
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
              ATM {microstructure.atmBracket.status} (+{microstructure.atmBracket.autoBreakevenTriggerTicks}t)
            </span>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-terminal-border">
                  <th className="py-1 text-left">Price</th>
                  <th className="py-1 text-right">Bid × Ask</th>
                  <th className="py-1 text-right">Delta</th>
                  <th className="py-1 text-right">Signal</th>
                </tr>
              </thead>
              <tbody>
                {microstructure.footprintRows.map((r) => (
                  <tr key={r.price} className={`border-b border-terminal-border/30 ${r.isPoc ? 'bg-amber-500/10' : ''}`}>
                    <td className="py-1 font-bold text-white">{r.price} {r.isPoc ? '★POC' : ''}</td>
                    <td className="py-1 text-right">
                      <span className="text-rose-300">{r.bidVol}</span> × <span className="text-emerald-300">{r.askVol}</span>
                    </td>
                    <td className={`py-1 text-right font-bold ${r.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {r.delta >= 0 ? '+' : ''}{r.delta} ({r.deltaPct}%)
                    </td>
                    <td className="py-1 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        r.imbalance === 'ASK_IMBALANCE' ? 'bg-emerald-500/20 text-emerald-300' :
                        r.imbalance === 'BID_IMBALANCE' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-500'
                      }`}>
                        {r.imbalance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TPO Market Profile Letters */}
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">TPO Market Profile ({microstructure.tpoProfile.session})</h3>
            <span className="text-[11px] font-mono text-cyan-300">
              IB [{microstructure.tpoProfile.initialBalanceLow} – {microstructure.tpoProfile.initialBalanceHigh}] • POC {microstructure.tpoProfile.poc}
            </span>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto font-mono text-[11px]">
            {microstructure.tpoProfile.rows.map((r) => (
              <div key={r.price} className={`flex items-center gap-2 px-2 py-0.5 rounded ${r.isPoc ? 'bg-amber-500/20 border border-amber-500/40' : r.inInitialBalance ? 'bg-terminal-900' : ''}`}>
                <span className="w-20 text-slate-300">{r.price}</span>
                <span className="text-cyan-300 tracking-widest font-bold flex-1">{r.letters}</span>
                <span className="text-[10px] text-slate-400">
                  {r.isPoc ? 'POC' : r.isVah ? 'VAH' : r.isVal ? 'VAL' : r.singlePrint ? '1-PRINT' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bookmap Resting Order Heatmap + Live Liquidation Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span>Bookmap / Auction Vista Historical Resting Order Liquidity Heatmap</span>
          </h3>
          <div className="space-y-1">
            {microstructure.restingOrderHeatmap.map((row) => (
              <div key={row.price} className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-20 text-slate-300 shrink-0">{row.price}</span>
                <div className="flex-1 grid grid-cols-10 gap-0.5">
                  {row.intensities.map((v, i) => (
                    <div
                      key={i}
                      className="h-4 rounded-sm"
                      style={{
                        backgroundColor: v > 78 ? 'rgba(249,115,22,0.85)' : v > 52 ? 'rgba(234,179,8,0.6)' : 'rgba(6,182,212,0.22)',
                      }}
                      title={`Resting Intensity ${v}%`}
                    />
                  ))}
                </div>
                <span className="w-24 text-right text-cyan-300">{row.restingSize} ({row.pulledDelta >= 0 ? '+' : ''}{row.pulledDelta})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-5 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white">Multi-Venue Liquidation Heatmap & Iceberg Scanner</h3>
          <div className="space-y-1.5">
            {microstructure.liquidationHeatmap.map((l) => (
              <div key={l.priceLevel} className="flex items-center justify-between text-xs font-mono bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border/60">
                <span className={l.side === 'SHORT_LIQ' ? 'text-emerald-400' : 'text-rose-400'}>
                  {l.side} @ {l.priceLevel} ({l.distancePct > 0 ? '+' : ''}{l.distancePct}%)
                </span>
                <span className="text-amber-300 font-bold">${l.estimatedUsdMillions}M</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-terminal-border space-y-1">
            {microstructure.icebergDetections.map((ic, idx) => (
              <div key={idx} className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
                {ic.side} @ {ic.price} • Visible {ic.visibleSize} → Refilled {ic.refilledVolume} ({ic.refillCount}×, {ic.confidencePct}%)
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reconstructed Smart Tape + OI Delta Divergence + C++ ACSIL Compiler */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" />
              <span>Reconstructed Smart Tape & Power Trades</span>
            </h3>
            <select
              value={smartTapeMin}
              onChange={async (e) => {
                const v = Number(e.target.value);
                setSmartTapeMin(v);
                await onRefreshMicrostructure({ symbol, smartTapeMinFilter: v });
              }}
              className="bg-terminal-900 border border-terminal-border text-xs font-mono text-slate-200 rounded px-2 py-1"
            >
              <option value={10}>Min Size: 10+</option>
              <option value={50}>Min Size: 50+ (Smart)</option>
              <option value={200}>Min Size: 200+ (Blocks)</option>
            </select>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono">
            {microstructure.reconstructedTape.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-terminal-900 px-2.5 py-1 rounded border border-terminal-border/50">
                <span className="text-slate-400">{p.time}</span>
                <span className="text-white font-bold">{p.price}</span>
                <span className={p.aggressor === 'BUY_SWEEP' ? 'text-emerald-400' : p.aggressor === 'SELL_SWEEP' ? 'text-rose-400' : 'text-amber-300'}>
                  {p.parentOrderSize}u ({p.childFillsMerged} child fills)
                </span>
                <span className="text-[10px] text-cyan-400">{p.venue}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-terminal-border">
            <div className="text-[10px] font-mono text-slate-400 mb-1">OPEN INTEREST DELTA DIVERGENCE PROFILES</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {microstructure.oiDivergenceProfile.slice(0, 4).map((o) => (
                <div key={o.barTime} className="bg-terminal-900 p-1.5 rounded border border-terminal-border text-[10px] font-mono">
                  <div className="text-slate-400">{o.barTime}</div>
                  <div className="text-cyan-300 font-bold truncate">{o.regime}</div>
                  <div className="text-slate-300">OI {o.openInterestDelta >= 0 ? '+' : ''}{o.openInterestDelta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Sierra Chart C++ ACSIL Study Compiler</h3>
            <button
              onClick={() => onRefreshMicrostructure({ symbol, cppSourceCode: cppCode })}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold"
            >
              Compile C++ Study
            </button>
          </div>
          <textarea
            value={cppCode}
            onChange={(e) => setCppCode(e.target.value)}
            rows={6}
            className="w-full bg-terminal-900 border border-terminal-border rounded-lg p-2 text-[11px] font-mono text-emerald-200 focus:outline-none"
          />
          <div className="text-[11px] font-mono text-cyan-300">
            Status: {microstructure.cppAcsilStudy.compileSuccess ? 'ACSIL DLL COMPILED' : 'SYNTAX ERROR'} • Exported: {microstructure.cppAcsilStudy.compiledFunctions.join(', ')}
          </div>
        </div>
      </div>
    </div>
  );
};
