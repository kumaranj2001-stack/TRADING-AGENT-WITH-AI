'use client';

import React, { useState, useEffect } from 'react';
import { Database, Wallet, Cpu, Layers } from 'lucide-react';
import type { CryptoOnChainSnapshot } from '@/lib/institutional/types';

interface Props {
  symbol: string;
  crypto: CryptoOnChainSnapshot;
  onRefreshCrypto: (payload: Record<string, any>) => Promise<void>;
}

export const CryptoOnChainDesk: React.FC<Props> = ({ symbol, crypto, onRefreshCrypto }) => {
  const [sqlInput, setSqlInput] = useState<string>(crypto.sqlQueryResult.query);
  const [sqlResult, setSqlResult] = useState(crypto.sqlQueryResult);
  const [isRunningSql, setIsRunningSql] = useState<boolean>(false);

  useEffect(() => {
    setSqlInput(crypto.sqlQueryResult.query);
    setSqlResult(crypto.sqlQueryResult);
  }, [symbol, crypto]);

  const runSql = async (overrideQuery?: string) => {
    const queryToRun = overrideQuery ?? sqlInput;
    setIsRunningSql(true);
    try {
      await onRefreshCrypto({ action: 'RUN_SQL', asset: symbol, sqlQuery: queryToRun });
    } finally {
      setIsRunningSql(false);
    }
  };

  return (
    <div className="space-y-4">
      {crypto.isCryptoNative === false && crypto.contextBanner && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs font-mono text-amber-200 flex items-center justify-between gap-2">
          <span>
            <strong className="text-amber-300">CROSS-ASSET CRYPTO LIQUIDITY PROXY:</strong> {crypto.contextBanner}
          </span>
          <span className="shrink-0 px-2 py-0.5 rounded bg-terminal-900 border border-amber-500/40 text-amber-300 font-bold">
            Active: {crypto.asset}
          </span>
        </div>
      )}

      {/* On-Chain SOPR, Miner Reserves & Stablecoin Ratio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="bg-terminal-950 border border-cyan-500/30 rounded-lg p-3">
          <div className="text-[10px] text-slate-400">ENTITY-ADJUSTED SOPR</div>
          <div className="text-base font-bold text-cyan-300 mt-1">{crypto.soprMetrics.entityAdjustedSopr} aSOPR</div>
          <div className="text-[10px] text-slate-400">STH {crypto.soprMetrics.sthSopr} • LTH {crypto.soprMetrics.lthSopr} • MVRV-Z {crypto.soprMetrics.mvrvZScore}</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
          <div className="text-[10px] text-slate-400">TOKEN GOD MODE HOLDERS</div>
          <div className="text-base font-bold text-white mt-1">Top 10: {crypto.tokenHolderDistribution.top10HoldersPct}%</div>
          <div className="text-[10px] text-slate-400">CEX {crypto.tokenHolderDistribution.cexCustodyPct}% • Gini {crypto.tokenHolderDistribution.giniCoefficient}</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
          <div className="text-[10px] text-slate-400">MINER RESERVES & PUELL</div>
          <div className="text-base font-bold text-amber-300 mt-1">{crypto.minerReserves.reserveUnits.toLocaleString('en-US')} BTC</div>
          <div className="text-[10px] text-slate-400">Puell {crypto.minerReserves.puellMultiple} • Hash {crypto.minerReserves.hashrateExahash} EH/s</div>
        </div>
        <div className="bg-terminal-950 border border-terminal-border rounded-lg p-3">
          <div className="text-[10px] text-slate-400">STABLECOIN RESERVE RATIO (SSR)</div>
          <div className="text-base font-bold text-emerald-400 mt-1">{crypto.stablecoinReserves.stablecoinSupplyRatio}x SSR</div>
          <div className="text-[10px] text-slate-400">${crypto.stablecoinReserves.exchangeStablecoinUsdBillions}B Dry Powder (+${crypto.stablecoinReserves.netMint24hMillions}M)</div>
        </div>
      </div>

      {/* Exchange Netflow Clustering, Smart Money Labels & Cross-Exchange Funding Arb */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>CryptoQuant Netflows & Nansen Smart Money Wallet Labels</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {crypto.exchangeNetflows.map((nf) => (
              <div key={nf.venue} className="bg-terminal-900 p-2 rounded border border-terminal-border text-xs font-mono">
                <div className="text-white font-bold">{nf.venue}</div>
                <div className={nf.netflow24hUsdMillions <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {nf.netflow24hUsdMillions >= 0 ? '+' : ''}${nf.netflow24hUsdMillions}M Netflow
                </div>
                <div className="text-[10px] text-slate-400">{nf.clusterStatus}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            {crypto.smartMoneyLabels.map((sm) => (
              <div key={sm.walletTag} className="bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border/60 flex justify-between text-[11px] font-mono">
                <span className="text-cyan-300 font-semibold truncate">{sm.walletTag}</span>
                <span className="text-slate-300 shrink-0">{sm.cohort} • {sm.action} (${(sm.netChange24hUsd / 1e6).toFixed(2)}M)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Coinglass Funding Rate Arbitrage, OI Heatmap & Kaiko L3 Book</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-terminal-border text-left">
                  <th className="py-1">Venue</th>
                  <th className="py-1 text-right">8h Fund</th>
                  <th className="py-1 text-right">APR %</th>
                  <th className="py-1 text-right">Carry Arb</th>
                </tr>
              </thead>
              <tbody>
                {crypto.fundingArbitrageMatrix.map((f) => (
                  <tr key={f.venue} className="border-b border-terminal-border/40">
                    <td className="py-1 text-white font-bold">{f.venue}</td>
                    <td className="py-1 text-right text-cyan-300">{f.funding8hPct}%</td>
                    <td className="py-1 text-right text-emerald-400 font-bold">{f.annualizedFundingPct}%</td>
                    <td className="py-1 text-right text-amber-300">+{f.carryArbSpreadPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {crypto.crossExchangeLiquidityDepth.map((d) => (
              <div key={d.exchange} className="bg-terminal-900 p-2 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-white font-bold truncate">{d.exchange}</div>
                <div className="text-emerald-300">±1% ${d.plus1PctDepthUsdM}M</div>
                <div className="text-slate-400">Spread {d.spreadBps}bps</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Token Unlocks, Protocol Balance Sheet & Dune-Style SQL Over Decoded Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-amber-400 uppercase font-mono flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span>Messari Token Unlocks & Protocol Balance Sheets</span>
          </h4>
          {crypto.tokenUnlocks.map((u) => (
            <div key={u.token} className="bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border flex justify-between text-[11px] font-mono">
              <span className="text-white font-bold">{u.token} ({u.unlockDate})</span>
              <span className="text-rose-300">${u.unlockUsdMillions}M ({u.circulatingSupplyPct}% float)</span>
            </div>
          ))}
          {crypto.protocolBalanceSheets.map((p) => (
            <div key={p.protocol} className="bg-terminal-900 p-2 rounded border border-terminal-border/70 text-[10px] font-mono">
              <div className="text-cyan-300 font-bold">{p.protocol}</div>
              <div className="text-slate-300">30d Fees ${p.fees30dUsdM}M • Net Rev ${p.protocolRevenue30dUsdM}M • Treasury ${p.treasuryUsdM}M</div>
            </div>
          ))}
        </div>

        <div className="xl:col-span-7 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-cyan-400 uppercase font-mono flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>Dune-Style SQL Query Over Raw Decoded Smart Contract Logs</span>
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-terminal-900 border border-terminal-border text-slate-300">
                {sqlResult.rows.length} rows
              </span>
              <button
                type="button"
                onClick={() => runSql()}
                disabled={isRunningSql}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-mono font-bold"
              >
                {isRunningSql ? 'Running...' : `Execute SQL (${sqlResult.executionTimeMs}ms)`}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            {[
              { label: 'All Logs', q: 'SELECT block_time, protocol, event_name, from_label, token, amount_usd FROM decoded_logs ORDER BY amount_usd DESC LIMIT 6' },
              { label: '>= $10M Whales', q: 'SELECT block_time, protocol, token, amount_usd FROM decoded_logs WHERE amount_usd >= 10000000 ORDER BY amount_usd DESC' },
              { label: 'ETH / WBTC Inflows', q: "SELECT block_time, protocol, from_label, token, amount_usd FROM decoded_logs WHERE token IN ('ETH', 'WBTC') AND amount_usd >= 6000000 ORDER BY block_number DESC" },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSqlInput(preset.q);
                  runSql(preset.q);
                }}
                className="px-2 py-0.5 rounded bg-terminal-900 hover:bg-terminal-800 border border-terminal-border text-cyan-300"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            value={sqlInput}
            onChange={(e) => setSqlInput(e.target.value)}
            rows={2}
            className="w-full bg-terminal-900 border border-terminal-border rounded p-2 text-xs font-mono text-emerald-200 focus:outline-none"
          />
          {sqlResult.error ? (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/40 text-xs font-mono text-rose-300">
              {sqlResult.error}
            </div>
          ) : sqlResult.rows.length === 0 ? (
            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/40 text-xs font-mono text-amber-300">
              Query returned 0 matching rows in decoded_logs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-slate-400 border-b border-terminal-border text-left">
                    {sqlResult.columns.map((col) => <th key={col} className="py-1 pr-2">{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sqlResult.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-terminal-border/30">
                      {sqlResult.columns.map((col) => (
                        <td key={col} className="py-1 pr-2 text-slate-200">{String(row[col])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
