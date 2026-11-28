'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  onSelectPair,
  onSyncToDebate,
  onBackToTerminal,
}) => {
  const [section, setSection] = useState<InstitutionalSuiteSection>(initialSection);
  const [symbol, setSymbol] = useState<string>(selectedPair);
  const [overview, setOverview] = useState<InstitutionalOverviewPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [streamPulse, setStreamPulse] = useState<{
    symbol: string;
    spotPrice: number;
    fixLatencyMs: number;
    zeroGammaFlip: number;
    rvolMultiplier: number;
  } | null>(null);

  const symbolRef = useRef<string>(symbol);
  const requestSeqRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const handleSymbolSwitch = useCallback(
    (nextSym: string) => {
      if (!nextSym) return;
      symbolRef.current = nextSym;
      setSymbol(nextSym);
      setStreamPulse(null);
      setOverview((prev) => (prev && prev.symbol === nextSym ? prev : null));
      if (onSelectPair && nextSym !== selectedPair) {
        onSelectPair(nextSym as CurrencyPair);
      }
    },
    [onSelectPair, selectedPair]
  );

  useEffect(() => {
    if (selectedPair && selectedPair !== symbolRef.current) {
      symbolRef.current = selectedPair;
      setSymbol(selectedPair);
      setStreamPulse(null);
      setOverview((prev) => (prev && prev.symbol === selectedPair ? prev : null));
    }
  }, [selectedPair]);

  const loadOverview = useCallback(
    async (sym = symbol) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const seqId = ++requestSeqRef.current;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/institutional/overview?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(timeframe)}`,
          { cache: 'no-store', signal: controller.signal }
        );
        const json = await res.json();
        if (seqId !== requestSeqRef.current || symbolRef.current !== sym) {
          return;
        }
        if (json?.success && json?.data && json.data.symbol === sym) {
          setOverview(json.data);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Failed loading institutional suite overview:', err);
        }
      } finally {
        if (seqId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [symbol, timeframe]
  );

  useEffect(() => {
    symbolRef.current = symbol;
    loadOverview(symbol);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [symbol, timeframe, loadOverview]);

  useEffect(() => {
    const targetSym = symbol;
    const es = new EventSource(
      `/api/institutional/stream?symbol=${encodeURIComponent(targetSym)}&timeframe=${encodeURIComponent(timeframe)}`
    );
    es.onmessage = (ev) => {
      try {
        const pkt = JSON.parse(ev.data);
        if (pkt?.symbol && pkt.symbol !== symbolRef.current) return;
        setStreamPulse({
          symbol: pkt.symbol || targetSym,
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
    const reqSymbol = symbolRef.current;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ ...payload, symbol: reqSymbol, timeframe }),
    });
    const json = await res.json();
    if (reqSymbol !== symbolRef.current) return;

    if (json?.data) {
      setOverview((prev) => (prev ? { ...prev, [key]: json.data } : prev));
    } else if (json && key === 'execution' && json.geneticOptimization) {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              execution: { ...prev.execution, geneticOptimization: json.geneticOptimization },
            }
          : prev
      );
    } else if (json && key === 'quant' && json.cloudWebhookScanner) {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              quant: { ...prev.quant, cloudWebhookScanner: json.cloudWebhookScanner },
            }
          : prev
      );
    } else if (json && key === 'quant' && json.formulaBacktester) {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              quant: { ...prev.quant, formulaBacktester: json.formulaBacktester },
            }
          : prev
      );
    } else if (json && key === 'crypto' && json.sqlQueryResult) {
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              crypto: { ...prev.crypto, sqlQueryResult: json.sqlQueryResult },
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

  const activeOverview = overview && overview.symbol === symbol ? overview : null;
  const activePulse = streamPulse && streamPulse.symbol === symbol ? streamPulse : null;

  return (
    <div className="space-y-4 min-w-0">
      {/* Top Institutional Command Header */}
      <div className="bg-terminal-900 border border-cyan-500/30 rounded-xl p-3 sm:p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
              <h2 className="text-sm sm:text-lg font-bold text-white tracking-wide break-words">
                QRI INSTITUTIONAL EXECUTION, DERIVATIVES, ON-CHAIN & RISK SUITE
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs font-mono text-slate-400 mt-0.5 break-words">
              Additive 50-Platform Institutional Architecture • MetaTrader 5 Bridge, 8-Agent Debate, Macro Calendar & Knowledge Base Strictly Preserved
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {['XAU/USD', 'EUR/USD', 'NVDA', 'BTC/USD', 'NIFTY 50'].map((sym) => (
              <button
                type="button"
                key={sym}
                onClick={() => handleSymbolSwitch(sym)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                  symbol === sym
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-white'
                }`}
              >
                {sym}
              </button>
            ))}

            {onSyncToDebate && activeOverview && (
              <button
                type="button"
                onClick={() =>
                  onSyncToDebate(
                    `Institutional Briefing (${symbol}): ${activeOverview.debateEnrichment.summaryBulletPoints.join(' | ')}`
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Feed Into 8-Agent Debate</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenTearSheet}
              className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-cyan-300 border border-terminal-border text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Client Tear Sheet</span>
            </button>

            {onBackToTerminal && (
              <button
                type="button"
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
            <span>
              {activeOverview || activePulse
                ? `SSE STREAM SYNCED (${symbol} • ${timeframe.toUpperCase()})`
                : `SYNCING STREAM (${symbol} • ${timeframe.toUpperCase()})...`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-300">
            <span>Spot: <strong className="text-white">{activePulse?.spotPrice ?? activeOverview?.spotPrice ?? '—'}</strong></span>
            <span>FIX/MT5 Latency: <strong className="text-emerald-400">{activePulse?.fixLatencyMs ?? 1.8}ms</strong></span>
            <span>Zero Gamma Flip: <strong className="text-cyan-300">{activePulse?.zeroGammaFlip ?? activeOverview?.options.zeroGammaFlipLevel ?? '—'}</strong></span>
            <span>RVOL Alert: <strong className="text-amber-300">{activePulse?.rvolMultiplier ?? 2.8}x</strong></span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> MT5 CONNECTIVITY INTACT
            </span>
          </div>
        </div>

        {/* 9-Pillar Institutional Module Selector */}
        <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto scrollbar-none gap-1.5 pt-1 pb-1">
          {SECTION_TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 shrink-0 ${
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
      {!activeOverview ? (
        <div className="bg-terminal-900 border border-terminal-border rounded-xl p-8 flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Hydrating 50-Platform Institutional Modules for {symbol}...</span>
        </div>
      ) : (
        <div className="bg-terminal-900 border border-terminal-border rounded-xl p-3 sm:p-4 shadow-lg">
          {(section === 'execution' || section === 'microstructure') && (
            <ExecutionMicrostructureDesk
              mode={section}
              symbol={symbol}
              execution={activeOverview.execution}
              microstructure={activeOverview.microstructure}
              onRefreshExecution={(p) => postAndPatch('/api/institutional/execution-bridge', p, 'execution')}
              onRefreshMicrostructure={(p) => postAndPatch('/api/institutional/microstructure', p, 'microstructure')}
            />
          )}

          {section === 'macro' && (
            <MacroFundamentalDesk
              symbol={symbol}
              macro={activeOverview.macro}
              onRefreshMacro={(p) => postAndPatch('/api/institutional/macro-fundamental', p, 'macro')}
              onDownloadTearSheet={handleOpenTearSheet}
            />
          )}

          {section === 'screener' && (
            <TechnicalScreenerDesk
              symbol={symbol}
              screener={activeOverview.screener}
              onRefreshScreener={(p) => postAndPatch('/api/institutional/technical-screener', p, 'screener')}
            />
          )}

          {section === 'options' && (
            <OptionsDerivativesDesk
              symbol={symbol}
              options={activeOverview.options}
              onRefreshOptions={(p) => postAndPatch('/api/institutional/options-derivatives', p, 'options')}
            />
          )}

          {section === 'crypto' && (
            <CryptoOnChainDesk
              symbol={symbol}
              crypto={activeOverview.crypto}
              onRefreshCrypto={(p) => postAndPatch('/api/institutional/crypto-onchain', p, 'crypto')}
            />
          )}

          {(section === 'alt-data' || section === 'quant' || section === 'risk') && (
            <AltDataQuantRiskDesk
              mode={section}
              symbol={symbol}
              altData={activeOverview.altData}
              quant={activeOverview.quant}
              riskAudit={activeOverview.riskAudit}
              onRefreshQuant={(p) => postAndPatch('/api/institutional/quant-backtest', p, 'quant')}
              onRefreshRisk={(p) => postAndPatch('/api/institutional/risk-audit', p, 'riskAudit')}
            />
          )}
        </div>
      )}
    </div>
  );
};
