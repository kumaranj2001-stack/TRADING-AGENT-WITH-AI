'use client';

import React, { useState, useEffect } from 'react';
import { Code2, Play, RotateCcw, Volume2, Radio, TrendingUp, Flame } from 'lucide-react';
import type { TechnicalScreenerSnapshot } from '@/lib/institutional/types';

interface Props {
  symbol: string;
  screener: TechnicalScreenerSnapshot;
  onRefreshScreener: (payload: Record<string, any>) => Promise<void>;
}

export const TechnicalScreenerDesk: React.FC<Props> = ({
  symbol,
  screener,
  onRefreshScreener,
}) => {
  const [pineCode, setPineCode] = useState<string>(screener.pineCompiler.sourceCode);
  const [replayIdx, setReplayIdx] = useState<number>(screener.barReplay.currentBarIndex);
  const [headlineInput, setHeadlineInput] = useState<string>('');
  const [scoredHeadline, setScoredHeadline] = useState(screener.unstructuredNewsSentiment[0]);
  const [voiceActive, setVoiceActive] = useState<boolean>(false);

  useEffect(() => {
    setPineCode(screener.pineCompiler.sourceCode);
    setReplayIdx(screener.barReplay.currentBarIndex);
    setHeadlineInput('');
    setScoredHeadline(screener.unstructuredNewsSentiment[0]);
  }, [symbol, screener]);

  const handleSpeakSquawk = (voiceScript: string) => {
    setVoiceActive(true);
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(voiceScript);
        utter.rate = 1.08;
        utter.onend = () => setVoiceActive(false);
        window.speechSynthesis.speak(utter);
        return;
      }
    } catch {
      // Fallback visual flash only
    }
    setTimeout(() => setVoiceActive(false), 1200);
  };

  const handleScoreNews = async () => {
    if (!headlineInput.trim()) return;
    const res = await fetch('/api/institutional/technical-screener', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SCORE_NEWS', symbol, headline: headlineInput }),
    });
    const json = await res.json();
    if (json?.scored) setScoredHeadline(json.scored);
  };

  return (
    <div className="space-y-4">
      {/* Pine Script v5 Compiler + Community Script Repo */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>Pine Script v5 Custom Indicator Compiler ({screener.pineCompiler.title})</span>
            </h3>
            <button
              onClick={() => onRefreshScreener({ symbol, pineCode })}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold"
            >
              Compile & Execute Pine v5
            </button>
          </div>
          <textarea
            value={pineCode}
            onChange={(e) => setPineCode(e.target.value)}
            rows={7}
            className="w-full bg-terminal-900 border border-terminal-border rounded-lg p-2.5 text-[11px] font-mono text-cyan-200 focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {screener.pineCompiler.plots.map((p) => (
              <div key={p.name} className="bg-terminal-900 p-2 rounded border border-terminal-border text-xs font-mono">
                <div className="text-slate-400">{p.name}</div>
                <div className="text-emerald-400 font-bold">{p.latestValue}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            Status: {screener.pineCompiler.compiledOk ? 'COMPILED OK' : 'CHECK ERRORS'} • Crossover Signals Triggered: {screener.pineCompiler.signals.length}
            {screener.pineCompiler.errors.length > 0 && (
              <div className="text-amber-300 mt-1">{screener.pineCompiler.errors.join(' | ')}</div>
            )}
          </div>
        </div>

        <div className="xl:col-span-5 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">Community Script Repository & Bar-by-Bar Replay</h3>
          <div className="space-y-1.5">
            {screener.communityScripts.map((s) => (
              <div key={s.id} className="bg-terminal-900 p-2 rounded border border-terminal-border/70 flex items-center justify-between gap-2 text-xs font-mono">
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">{s.title}</div>
                  <div className="text-[10px] text-slate-400">{s.language} • ★ {s.stars} • {s.author}</div>
                </div>
                {s.language === 'Pine Script v5' && (
                  <button
                    onClick={() => {
                      setPineCode(s.code);
                      onRefreshScreener({ symbol, pineCode: s.code });
                    }}
                    className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] shrink-0"
                  >
                    Load
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-terminal-900 p-3 rounded-lg border border-terminal-border space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-bold">Visual Bar Replay ({replayIdx}/{screener.barReplay.totalBars} bars)</span>
              <span className={screener.barReplay.simulatedPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                Replay PnL: ${screener.barReplay.simulatedPnl}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={15}
                max={screener.barReplay.totalBars}
                value={replayIdx}
                onChange={(e) => setReplayIdx(Number(e.target.value))}
                className="flex-1"
              />
              <button
                onClick={() => onRefreshScreener({ symbol, replayBarIndex: Math.min(screener.barReplay.totalBars, replayIdx + 1) })}
                className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-mono flex items-center gap-1"
              >
                <Play className="w-3 h-3" /> Step +1
              </button>
              <button
                onClick={() => {
                  setReplayIdx(20);
                  onRefreshScreener({ symbol, replayBarIndex: 20 });
                }}
                className="px-2 py-1 rounded bg-terminal-800 text-slate-300 text-xs font-mono flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MTF Trendlines + Raindrop Candles + Holly AI + RVOL Surges */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-cyan-400 uppercase font-mono">Auto MTF Trendlines & Raindrop Volume Split</h4>
          <div className="space-y-1.5">
            {screener.mtfTrendlines.map((tl) => (
              <div key={tl.timeframe} className="bg-terminal-900 px-2.5 py-1.5 rounded border border-terminal-border/60 flex justify-between text-[11px] font-mono">
                <span className="text-white font-bold">{tl.timeframe.toUpperCase()} {tl.type === 'ASCENDING_SUPPORT' ? 'SUP' : 'RES'}</span>
                <span className="text-cyan-300">@ {tl.currentLinePrice} ({tl.distancePct}%)</span>
                <span className="text-amber-300">{tl.breakoutStatus}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-mono text-slate-400 pt-1">RAINDROP CANDLES (LEFT vs RIGHT VWAP SPLIT)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {screener.raindropCandles.slice(-4).map((r) => (
              <div key={r.time} className="bg-terminal-900 p-1.5 rounded border border-terminal-border text-[10px] font-mono">
                <div className="text-slate-400">{r.time} • {r.bias}</div>
                <div className="text-cyan-300">L {r.leftVolumePct}% / R {r.rightVolumePct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-emerald-400 uppercase font-mono flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Holly AI Statistical Strategies & RVOL Alerts</span>
          </h4>
          {screener.hollyAiStrategies.map((h) => (
            <div key={h.strategyName} className="bg-terminal-900 p-2 rounded border border-terminal-border/60 text-xs font-mono">
              <div className="text-white font-bold">{h.strategyName}</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                {h.direction} {h.signalSymbol} • {h.winRatePct}% WR • PF {h.profitFactor} • +{h.expectedValueR}R
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {screener.rvolSurges.map((rv) => (
              <div key={rv.symbol} className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-[10px] font-mono">
                <div className="text-white font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" /> {rv.symbol} {rv.rvolMultiplier}x RVOL
                </div>
                <div className="text-emerald-300">Px {rv.price} (+{rv.changePct}%)</div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-white uppercase font-mono">Intraday S&P 500 Sector Heatmap & Insider Form 4</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {screener.sp500SectorHeatmap.map((sec) => (
              <div
                key={sec.sector}
                className={`p-2 rounded border text-[10px] font-mono ${
                  sec.changePct >= 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'
                }`}
              >
                <div className="text-white font-bold truncate">{sec.sector}</div>
                <div className={sec.changePct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {sec.changePct >= 0 ? '+' : ''}{sec.changePct}% ({sec.leader})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audio Squawk Box + Insider Feed + Unstructured News Sentiment API */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-rose-400 uppercase font-mono flex items-center gap-1.5">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Benzinga Pro Style Live Audio Squawk Box & Form 4 Feed</span>
          </h4>
          {screener.audioSquawkFeed.map((sq) => (
            <div key={sq.id} className="bg-terminal-900 p-2.5 rounded border border-terminal-border flex items-start justify-between gap-2 text-xs font-mono">
              <div>
                <div className="text-[10px] text-amber-300 font-bold">[{sq.priority}] {sq.time} • {sq.sentimentTag}</div>
                <div className="text-white mt-0.5">{sq.headline}</div>
              </div>
              <button
                onClick={() => handleSpeakSquawk(sq.voiceScript)}
                className={`px-2 py-1 rounded border text-[10px] shrink-0 flex items-center gap-1 ${
                  voiceActive ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-terminal-800 text-cyan-300 border-terminal-border'
                }`}
              >
                <Volume2 className="w-3 h-3" /> Squawk
              </button>
            </div>
          ))}
          <div className="space-y-1 pt-1">
            {screener.insiderTrades.map((it, i) => (
              <div key={i} className="text-[10px] font-mono text-slate-300 flex justify-between bg-terminal-900/50 px-2 py-1 rounded">
                <span>{it.symbol} • {it.insiderName} ({it.transactionType})</span>
                <span className={it.transactionType === 'OPEN_MARKET_BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  ${(it.valueUsd / 1e6).toFixed(2)}M {it.isClusterBuy ? '★CLUSTER' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-6 bg-terminal-950 border border-terminal-border rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-bold text-cyan-400 uppercase font-mono">Unstructured News Sentiment Scoring API (Feeds Debate & Scanner)</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={headlineInput}
              onChange={(e) => setHeadlineInput(e.target.value)}
              placeholder="Paste breaking headline to score NLP impact into Seven-Agent Debate..."
              className="flex-1 bg-terminal-900 border border-terminal-border rounded px-3 py-1.5 text-xs font-mono text-white"
            />
            <button onClick={handleScoreNews} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold">
              Score NLP
            </button>
          </div>
          {scoredHeadline && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-white font-bold">{scoredHeadline.source}</span>
                <span className={scoredHeadline.nlpScore >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  NLP Score: {scoredHeadline.nlpScore} (Conf {scoredHeadline.confidence})
                </span>
              </div>
              <div className="text-slate-200">{scoredHeadline.headline}</div>
              <div className="text-[10px] text-cyan-300">{scoredHeadline.debateImpactNote}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
