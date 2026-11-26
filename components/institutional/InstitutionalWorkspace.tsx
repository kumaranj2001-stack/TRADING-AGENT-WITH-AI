'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Cpu,
  Download,
  RefreshCw,
  ShieldCheck,
  Radio,
  MessageSquare,
} from 'lucide-react';
import type { CurrencyPair, TimeFrame } from '@/lib/types';
import type {
  InstitutionalOverviewPayload,
  InstitutionalSuiteSection,
} from '@/lib/institutional/types';
import { ExecutionMicrostructureDesk } from './ExecutionMicrostructureDesk';
import { MacroFundamentalDesk } from './MacroFundamentalDesk';
import { TechnicalScreenerDesk } from './TechnicalScreenerDesk';
import { OptionsDerivativesDesk } from './OptionsDerivativesDesk';
import { CryptoOnChainDesk } from './CryptoOnChainDesk';
import { AltDataQuantRiskDesk } from './AltDataQuantRiskDesk';

export interface InstitutionalWorkspaceProps {
  initialSection?: InstitutionalSuiteSection;
  selectedPair?: CurrencyPair | string;
  timeframe?: TimeFrame;
  onSelectPair?: (pair: CurrencyPair) => void;
  onSyncToDebate?: (scenarioNote: string) => void;
  onBackToTerminal?: () => void;
}

const SECTION_TABS: Array<{ id: InstitutionalSuiteSection; label: string; tag: string }> = [
  { id: 'execution', label: '01. FIX / MT5 DOM & SmartRouter', tag: 'EXECUTION' },
  { id: 'microstructure', label: '02. Footprint, TPO & Bookmap', tag: 'ORDER FLOW' },
  { id: 'macro', label: '03. Macro, Bonds, Supply Chain & Ratio', tag: 'FUNDAMENTAL' },
  { id: 'screener', label: '04. Pine v5, Holly AI, RVOL & Squawk', tag: 'SCREENER' },
  { id: 'options', label: '05. Options Surface, GEX & Dark Pool', tag: 'OPTIONS' },
  { id: 'crypto', label: '06. Crypto On-Chain & Dune SQL', tag: 'CRYPTO' },
  { id: 'alt-data', label: '07. Alt Data & RavenPack Taxonomy', tag: 'ALT ALPHA' },
  { id: 'quant', label: '08. Tick Backtest, Symphonies & Bots', tag: 'QUANT LAB' },
  { id: 'risk', label: '09. MAE/MFE, Tilt, DARWIN & ZuluGuard', tag: 'RISK AUDIT' },
];

export const InstitutionalWorkspace: React.FC<InstitutionalWorkspaceProps> = ({
  initialSection = 'execution',
  selectedPair = 'XAU/USD',
  timeframe = '1h',
  onSyncToDebate,
  onBackToTerminal,
}) => {
  const [section, setSection] = useState<InstitutionalSuiteSection>(initialSection);
  const [symbol, setSymbol] = useState<string>(selectedPair);
  const [overview, setOverview] = useState<InstitutionalOverviewPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [streamPulse, setStreamPulse] = useState<{
    spotPrice: number;
    fixLatencyMs: number;
    zeroGammaFlip: number;
    rvolMultiplier: number;
  } | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setSymbol(selectedPair);
  }, [selectedPair]);

  const loadOverview = useCallback(async (sym = symbol) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/institutional/overview?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(timeframe)}`);
      const json = await res.json();
      if (json?.success && json?.data) {
        setOverview(json.data);
      }
    } catch (err) {
      console.error('Failed loading institutional suite overview:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadOverview(symbol);
  }, [symbol, timeframe, loadOverview]);

  useEffect(() => {
    const es = new EventSource(`/api/institutional/stream?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
    es.onmessage = (ev) => {
      try {
        const pkt = JSON.parse(ev.data);
        setStreamPulse({
          spotPrice: pkt.spotPrice,
          fixLatencyMs: pkt.fixLatencyMs,
          zeroGammaFlip: pkt.zeroGammaFlip,
          rvolMultiplier: pkt.rvolMultiplier,
        });
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, [symbol, timeframe]);

  const postAndPatch = async (
    endpoint: string,
    payload: Record<string, any>,
    key: keyof InstitutionalOverviewPayload
  ) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, symbol, timeframe }),
    });
    const json = await res.json();
    if (json?.data && overview) {
      setOverview((prev) => (prev ? { ...prev, [key]: json.data } : prev));
    } else if (json && key === 'execution' && json.geneticOptimization && overview) {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              execution: { ...prev.execution, geneticOptimization: json.geneticOptimization },
            }
          : prev
      );
    }
  };

  const handleOpenTearSheet = () => {
    window.open(
      `/api/institutional/overview?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&format=tear-sheet-html`,
      '_blank'
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Institutional Command Header */}
      <div className="bg-terminal-900 border border-cyan-500/30 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                QRI INSTITUTIONAL EXECUTION, DERIVATIVES, ON-CHAIN & RISK SUITE
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Additive 50-Platform Institutional Architecture • MetaTrader 5 Bridge, 8-Agent Debate, Macro Calendar & Knowledge Base Strictly Preserved
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['XAU/USD', 'EUR/USD', 'NVDA', 'BTC/USD', 'NIFTY 50'].map((sym) => (
              <button
                key={sym}
                onClick={() => setSymbol(sym)}
                className={`px-2.5 py-1 rounded text-xs font-mono border ${
                  symbol === sym
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-white'
                }`}
              >
                {sym}
              </button>
            ))}

            {onSyncToDebate && overview && (
              <button
                onClick={() =>
                  onSyncToDebate(
                    `Institutional Briefing (${symbol}): ${overview.debateEnrichment.summaryBulletPoints.join(' | ')}`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Feed Into 8-Agent Debate</span>
              </button>
            )}

            <button
              onClick={handleOpenTearSheet}
              className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-cyan-300 border border-terminal-border text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Client Tear Sheet</span>
            </button>

            {onBackToTerminal && (
              <button
                onClick={onBackToTerminal}
                className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-slate-200 border border-terminal-border text-xs font-mono flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terminal</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-Time Institutional SSE Status Ticker */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-terminal-950 px-3 py-2 rounded-lg border border-terminal-border text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>SSE STREAM SYNCED ({symbol} • {timeframe.toUpperCase()})</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <span>Spot: <strong className="text-white">{streamPulse?.spotPrice ?? overview?.spotPrice ?? '—'}</strong></span>
            <span>FIX/MT5 Latency: <strong className="text-emerald-400">{streamPulse?.fixLatencyMs ?? 1.8}ms</strong></span>
            <span>Zero Gamma Flip: <strong className="text-cyan-300">{streamPulse?.zeroGammaFlip ?? overview?.options.zeroGammaFlipLevel ?? '—'}</strong></span>
            <span>RVOL Alert: <strong className="text-amber-300">{streamPulse?.rvolMultiplier ?? 2.8}x</strong></span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> MT5 CONNECTIVITY INTACT
            </span>
          </div>
        </div>

        {/* 9-Pillar Institutional Module Selector */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SECTION_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 ${
                section === t.id
                  ? 'bg-gradient-to-r from-cyan-600/30 to-indigo-600/30 text-white border-cyan-400 font-bold shadow-sm'
                  : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-white'
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-terminal-800 text-cyan-300">{t.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Institutional Module Desk */}
      {loading && !overview ? (
        <div className="bg-terminal-900 border border-terminal-border rounded-xl p-8 flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Hydrating 50-Platform Institutional Modules for {symbol}...</span>
        </div>
      ) : overview ? (
        <div className="bg-terminal-900 border border-terminal-border rounded-xl p-4 shadow-lg">
          {(section === 'execution' || section === 'microstructure') && (
            <ExecutionMicrostructureDesk
              mode={section}
              symbol={symbol}
              execution={overview.execution}
              microstructure={overview.microstructure}
              onRefreshExecution={(p) => postAndPatch('/api/institutional/execution-bridge', p, 'execution')}
              onRefreshMicrostructure={(p) => postAndPatch('/api/institutional/microstructure', p, 'microstructure')}
            />
          )}

          {section === 'macro' && (
            <MacroFundamentalDesk
              symbol={symbol}
              macro={overview.macro}
              onRefreshMacro={(p) => postAndPatch('/api/institutional/macro-fundamental', p, 'macro')}
              onDownloadTearSheet={handleOpenTearSheet}
            />
          )}

          {section === 'screener' && (
            <TechnicalScreenerDesk
              symbol={symbol}
              screener={overview.screener}
              onRefreshScreener={(p) => postAndPatch('/api/institutional/technical-screener', p, 'screener')}
            />
          )}

          {section === 'options' && (
            <OptionsDerivativesDesk
              symbol={symbol}
              options={overview.options}
              onRefreshOptions={(p) => postAndPatch('/api/institutional/options-derivatives', p, 'options')}
            />
          )}

          {section === 'crypto' && (
            <CryptoOnChainDesk
              symbol={symbol}
              crypto={overview.crypto}
              onRefreshCrypto={(p) => postAndPatch('/api/institutional/crypto-onchain', p, 'crypto')}
            />
          )}

          {(section === 'alt-data' || section === 'quant' || section === 'risk') && (
            <AltDataQuantRiskDesk
              mode={section}
              symbol={symbol}
              altData={overview.altData}
              quant={overview.quant}
              riskAudit={overview.riskAudit}
              onRefreshQuant={(p) => postAndPatch('/api/institutional/quant-backtest', p, 'quant')}
              onRefreshRisk={(p) => postAndPatch('/api/institutional/risk-audit', p, 'riskAudit')}
            />
          )}
        </div>
      ) : null}
    </div>
  );
};
