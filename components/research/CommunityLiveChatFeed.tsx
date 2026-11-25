/**
 * components/research/CommunityLiveChatFeed.tsx
 * Real-Time TradingView-Style Community Live Chat Interface.
 * 
 * Embedded directly into the research engine panel alongside or directly beneath
 * the active ticker selector and preset chips.
 * 
 * Includes:
 *  - User message bubbles with avatars, badges, and sentiment indicators
 *  - Timestamps and like reactions
 *  - Ticker-tag filtering ($NVDA, $XAUUSD, $EURUSD, $NIFTY, ALL)
 *  - Real-time message dispatch (input field + sentiment selector)
 *  - Simulated continuous community streaming ticks
 *  - "Synthesize 5-Stage Research from Chat" execution trigger
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sparkles, 
  Filter, 
  Users, 
  Radio, 
  Play, 
  Pause, 
  CheckCircle2, 
  Flame, 
  Compass, 
  Clock,
  Tag
} from 'lucide-react';
import {
  ChartLiveContext,
  CommunityChatMessage,
  CommunityChatTranscript,
  ResearchReportSnapshot,
} from '@/lib/research/types';
import { formatAssetPrice, liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export interface CommunityLiveChatFeedProps {
  activeSymbol: string;
  activeTimeframe?: string;
  chartTelemetry?: ChartLiveContext | null;
  report?: ResearchReportSnapshot | null;
  onSelectSymbol?: (symbol: string) => void;
  onTriggerAnalysis?: (symbol: string) => void;
  onMessageDispatched?: (msg: CommunityChatMessage, transcript?: CommunityChatTranscript) => void;
  isAnalyzing?: boolean;
  singleAssetMode?: boolean;
}

const PRESET_TAG_FILTERS = [
  { label: 'ALL CHAT', tag: 'ALL' },
  { label: '$NVDA', tag: '$NVDA', sym: 'NVDA' },
  { label: '$XAUUSD', tag: '$XAUUSD', sym: 'XAU/USD' },
  { label: '$EURUSD', tag: '$EURUSD', sym: 'EUR/USD' },
  { label: '$NIFTY', tag: '$NIFTY', sym: 'NIFTY 50' },
  { label: '$TSLA', tag: '$TSLA', sym: 'TSLA' },
  { label: '$AAPL', tag: '$AAPL', sym: 'AAPL' },
];

export const CommunityLiveChatFeed: React.FC<CommunityLiveChatFeedProps> = ({
  activeSymbol,
  activeTimeframe = '1h',
  chartTelemetry = null,
  report = null,
  onSelectSymbol,
  onTriggerAnalysis,
  onMessageDispatched,
  isAnalyzing = false,
  singleAssetMode = false,
}) => {
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string>('ALL');
  const [inputText, setInputText] = useState<string>('');
  const [inputSentiment, setInputSentiment] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('BULLISH');
  const [isStreamingActive, setIsStreamingActive] = useState<boolean>(true);
  const [onlineCount, setOnlineCount] = useState<number>(1428);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastSyncKeyRef = useRef<string>('');
  const chartTelemetryRef = useRef<ChartLiveContext | null>(chartTelemetry);
  chartTelemetryRef.current = chartTelemetry;

  const resolvedSym = liveChartTelemetryService.resolveSymbol(activeSymbol);
  const cleanCanonical = resolvedSym.symbol;
  const activeTag = `$${cleanCanonical.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;

  // Fetch & synchronize server chat transcript directly with active Chart.js symbol, timeframe & live price/indicators
  const fetchSyncedChatRoom = async (sym: string, tf: string, ctx: ChartLiveContext | null) => {
    try {
      const qs = new URLSearchParams({ symbol: sym, timeframe: tf });
      if (ctx && liveChartTelemetryService.resolveSymbol(ctx.symbol).symbol === sym && ctx.livePrice > 0) {
        qs.set('livePrice', String(ctx.livePrice));
        qs.set('changePercent', String(ctx.changePercent ?? 0));
        if (ctx.indicatorReadings?.rsi14 !== undefined) qs.set('rsi14', String(ctx.indicatorReadings.rsi14));
        if (ctx.indicatorReadings?.ema20 !== undefined) qs.set('ema20', String(ctx.indicatorReadings.ema20));
        if (ctx.indicatorReadings?.macdHistogram !== undefined) qs.set('macdHistogram', String(ctx.indicatorReadings.macdHistogram));
      }
      const res = await fetch(`/api/research/chat?${qs.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.messages)) {
          setMessages(data.messages);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const priceBucket = chartTelemetry?.livePrice ? Math.round(chartTelemetry.livePrice * 200) : 0;
    const tfKey = chartTelemetry?.timeframe || activeTimeframe;
    const syncKey = `${cleanCanonical}_${tfKey}_${priceBucket > 0 ? Math.floor(priceBucket / 4) : 'init'}`;
    if (lastSyncKeyRef.current !== syncKey) {
      lastSyncKeyRef.current = syncKey;
      setActiveTagFilter('ALL');
      fetchSyncedChatRoom(cleanCanonical, tfKey, chartTelemetry);
    }
  }, [cleanCanonical, activeTimeframe, chartTelemetry?.livePrice, chartTelemetry?.timeframe]);

  // Auto-scroll to bottom of chat on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Correlated live community commentary aligned strictly to active chart indicators & price action
  useEffect(() => {
    if (!isStreamingActive) return;

    const interval = setInterval(async () => {
      const ctx = chartTelemetryRef.current;
      const spot = ctx?.livePrice || report?.brief.pricing.currentPrice || resolvedSym.fallbackPrice;
      const ema20 = ctx?.indicatorReadings?.ema20 ?? spot;
      const rsi = ctx?.indicatorReadings?.rsi14 ?? report?.technical.rsi14 ?? 50;
      const atr = ctx?.indicatorReadings?.atr14 ?? Math.max(spot * 0.012, spot * 0.002);
      const tfLabel = (ctx?.timeframe || activeTimeframe).toUpperCase();
      const fmtSpot = formatAssetPrice(spot, resolvedSym.assetClass, cleanCanonical);
      const fmtEma = formatAssetPrice(ema20, resolvedSym.assetClass, cleanCanonical);
      const isBull = spot >= ema20 && rsi >= 51;
      const isBear = spot < ema20 && rsi <= 49;
      const sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = isBull ? 'BULLISH' : isBear ? 'BEARISH' : 'NEUTRAL';

      const pool = isBull
        ? [
            { name: 'AlphaSeeker_99', badge: 'PRO TRADER', text: `${activeTag} (${tfLabel}) holding above EMA-20 (${fmtEma}) at ${fmtSpot}. RSI-14 at ${rsi}; continuation setups favored.` },
            { name: 'DeltaNeutral_Quant', badge: 'ALGO SCALPER', text: `Order flow bid absorption near ${formatAssetPrice(spot - atr * 0.5, resolvedSym.assetClass, cleanCanonical)} on ${tfLabel}. Buyers maintaining control.` },
          ]
        : isBear
        ? [
            { name: 'BearishDesk_FX', badge: 'CHARTIST', text: `${activeTag} (${tfLabel}) pressured below EMA-20 (${fmtEma}) at ${fmtSpot}. RSI-14 softening (${rsi}); watching support test.` },
            { name: 'RiskHedge_Quant', badge: 'MACRO ANALYST', text: `Sellers defending overhead supply above ${formatAssetPrice(spot + atr * 0.6, resolvedSym.assetClass, cleanCanonical)}. Disciplined risk management priority.` },
          ]
        : [
            { name: 'EquilibriumDesk', badge: 'CHARTIST', text: `${activeTag} (${tfLabel}) balanced around ${fmtSpot} (RSI-14: ${rsi}, EMA-20: ${fmtEma}). Awaiting decisive range break.` },
          ];

      const pick = pool[Math.floor(Math.random() * pool.length)];
      try {
        const res = await fetch('/api/research/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: cleanCanonical,
            username: pick.name,
            message: pick.text,
            sentiment,
            badges: [pick.badge],
            chartContext: ctx,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.message) {
            setMessages((prev) => [...prev.slice(-24), data.message]);
            onMessageDispatched?.(data.message, data.transcript);
          }
        }
      } catch {}

      setOnlineCount((prev) => Math.max(850, prev + Math.floor(Math.random() * 7 - 3)));
    }, 22000);

    return () => clearInterval(interval);
  }, [isStreamingActive, cleanCanonical, activeTimeframe, activeTag, resolvedSym.assetClass, resolvedSym.fallbackPrice, report?.technical.rsi14, report?.brief.pricing.currentPrice]);

  // Handle user dispatch directly to server buffer so all 5 subagents receive the live comment
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const txt = inputText.trim();
    if (!txt) return;
    setInputText('');

    try {
      const res = await fetch('/api/research/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanCanonical,
          username: 'You (Trader)',
          message: txt,
          sentiment: inputSentiment,
          badges: ['PRO TRADER'],
          chartContext: chartTelemetryRef.current,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.message) {
          setMessages((prev) => [...prev, data.message]);
          onMessageDispatched?.(data.message, data.transcript);
        }
      }
    } catch {}
  };

  // Like message toggle
  const handleLikeMessage = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, likes: m.likes + 1 } : m)));
  };

  // Filter messages based on activeTagFilter
  const filteredMessages = messages.filter((m) => {
    if (activeTagFilter === 'ALL') return true;
    return m.tickerTag.toUpperCase() === activeTagFilter.toUpperCase() || m.ticker.toUpperCase() === activeTagFilter.replace('$', '').toUpperCase();
  });

  // Calculate sentiment percentages for room header
  const total = filteredMessages.length || 1;
  const bullCount = filteredMessages.filter((m) => m.sentiment === 'BULLISH').length;
  const bearCount = filteredMessages.filter((m) => m.sentiment === 'BEARISH').length;
  const bullPct = Math.round((bullCount / total) * 100);
  const bearPct = Math.round((bearCount / total) * 100);

  return (
    <div className="bg-terminal-950 border border-terminal-border rounded-xl flex flex-col h-full shadow-xl overflow-hidden font-mono text-xs">
      {/* 1. Community Header Bar */}
      <div className="px-3 py-2.5 bg-terminal-900 border-b border-terminal-border flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-white text-xs tracking-wider truncate">COMMUNITY LIVE CHAT</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>SYNCED</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-500" />
                <span>{onlineCount.toLocaleString()}</span>
              </span>
              <span className="text-cyan-300 font-bold">{activeTag} ({(chartTelemetry?.timeframe || activeTimeframe).toUpperCase()})</span>
              {chartTelemetry?.livePrice && (
                <span className="text-slate-300">
                  @ {formatAssetPrice(chartTelemetry.livePrice, resolvedSym.assetClass, cleanCanonical)}
                </span>
              )}
              {chartTelemetry?.indicatorReadings?.rsi14 !== undefined && (
                <span className="text-cyan-400">RSI {chartTelemetry.indicatorReadings.rsi14}</span>
              )}
            </div>
          </div>
        </div>

        {/* Room Sentiment Ratio & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sentiment Meter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-terminal-950 border border-terminal-border text-[11px]">
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>{bullPct}% Bull</span>
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400 font-bold flex items-center gap-0.5">
              <TrendingDown className="w-3 h-3" />
              <span>{bearPct}% Bear</span>
            </span>
          </div>

          {/* Pause / Resume Auto-Stream */}
          <button
            onClick={() => setIsStreamingActive(!isStreamingActive)}
            className={`p-1.5 rounded border transition-colors ${
              isStreamingActive 
                ? 'bg-terminal-800 hover:bg-terminal-700 text-slate-300 border-terminal-border' 
                : 'bg-amber-950/60 text-amber-300 border-amber-700'
            }`}
            title={isStreamingActive ? 'Pause community simulated stream' : 'Resume live community stream'}
          >
            {isStreamingActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          {/* Trigger 5-Stage Sequential Discovery Pipeline (hidden in streamlined singleAssetMode) */}
          {!singleAssetMode && onTriggerAnalysis && (
            <button
              onClick={() => onTriggerAnalysis(activeSymbol)}
              disabled={isAnalyzing}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'ROUTING THROUGH 5 SUBAGENTS...' : 'SYNTHESIZE FROM CHAT'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Ticker-Tag Filtering Bar */}
      <div className="px-3 py-1.5 bg-terminal-950/90 border-b border-terminal-border flex items-center gap-1.5 overflow-x-auto text-[11px] custom-scrollbar">
        <span className="text-slate-500 flex items-center gap-1 mr-1 shrink-0">
          <Filter className="w-3 h-3 text-cyan-400" />
          <span>{singleAssetMode ? 'Active Stream:' : 'Filter Tag:'}</span>
        </span>
        {(() => {
          if (singleAssetMode) {
            return [{ label: `${activeTag} ROOM`, tag: 'ALL', sym: activeSymbol }];
          }
          const hasActivePreset = PRESET_TAG_FILTERS.some(
            (p) => p.tag === activeTag || (p.sym && p.sym.toUpperCase() === activeSymbol.toUpperCase())
          );
          const dynamicFilters = hasActivePreset
            ? PRESET_TAG_FILTERS
            : [
                PRESET_TAG_FILTERS[0],
                { label: activeTag, tag: activeTag, sym: activeSymbol },
                ...PRESET_TAG_FILTERS.slice(1),
              ];
          return dynamicFilters;
        })().map((item) => {
          const isSelected = activeTagFilter === item.tag;
          return (
            <button
              key={item.tag}
              onClick={() => {
                setActiveTagFilter(item.tag);
                if (!singleAssetMode && item.sym && onSelectSymbol && item.sym !== activeSymbol) {
                  onSelectSymbol(item.sym);
                }
              }}
              className={`px-2 py-0.5 rounded transition-all shrink-0 font-mono ${
                isSelected 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm' 
                  : 'bg-terminal-900 hover:bg-terminal-800 text-slate-400 hover:text-slate-200 border border-terminal-border/60'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 3. Interactive Messages Scroll Container */}
      <div 
        ref={chatScrollRef}
        className="flex-1 min-h-0 p-3 space-y-3 overflow-y-auto bg-gradient-to-b from-terminal-950 via-terminal-900/60 to-terminal-950 custom-scrollbar"
      >
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-1">
            <MessageSquare className="w-6 h-6 text-slate-600 mb-1" />
            <p>No messages for tag {activeTagFilter}. Dispatch the first message below!</p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isBull = msg.sentiment === 'BULLISH';
            const isBear = msg.sentiment === 'BEARISH';
            const isYou = msg.username.startsWith('You');

            // Badge color
            const badgeBg = 
              msg.badge === 'PRO TRADER' ? 'bg-indigo-950 text-indigo-300 border-indigo-700' :
              msg.badge === 'MACRO ANALYST' ? 'bg-purple-950 text-purple-300 border-purple-700' :
              msg.badge === 'ALGO SCALPER' ? 'bg-amber-950 text-amber-300 border-amber-700' :
              msg.badge === 'CHARTIST' ? 'bg-cyan-950 text-cyan-300 border-cyan-700' :
              'bg-slate-800 text-slate-300 border-slate-700';

            return (
              <div 
                key={msg.id}
                className={`p-2.5 rounded-xl border transition-all ${
                  isYou 
                    ? 'bg-cyan-950/30 border-cyan-800/60 ml-4 sm:ml-8' 
                    : isBull 
                    ? 'bg-terminal-900/90 border-terminal-border hover:border-emerald-700/50' 
                    : isBear 
                    ? 'bg-terminal-900/90 border-terminal-border hover:border-rose-700/50' 
                    : 'bg-terminal-900/90 border-terminal-border'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {/* User Avatar Circle */}
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {msg.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-white text-xs">{msg.username}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] border font-mono ${badgeBg}`}>
                      {msg.badge}
                    </span>
                    <span 
                      onClick={() => {
                        setActiveTagFilter(msg.tickerTag);
                        if (onSelectSymbol && msg.ticker !== activeSymbol) {
                          onSelectSymbol(msg.ticker);
                        }
                      }}
                      className="cursor-pointer text-cyan-400 hover:text-cyan-300 hover:underline font-bold text-[11px]"
                    >
                      {msg.tickerTag}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Sentiment Badge */}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-0.5 ${
                      isBull ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      isBear ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                      'bg-slate-700/30 text-slate-300 border-slate-600'
                    }`}>
                      {isBull && <TrendingUp className="w-2.5 h-2.5" />}
                      {isBear && <TrendingDown className="w-2.5 h-2.5" />}
                      {msg.sentiment}
                    </span>
                    <span className="text-[10px] text-slate-500">{msg.formattedTime}</span>
                  </div>
                </div>

                {/* Message Body */}
                <p className="text-slate-200 text-xs leading-relaxed select-text font-sans">
                  {msg.text}
                </p>

                {/* Message Footer: Like Button */}
                <div className="flex items-center justify-end gap-3 mt-1.5 pt-1 border-t border-terminal-border/40 text-[10px] text-slate-400">
                  <button 
                    onClick={() => handleLikeMessage(msg.id)}
                    className="flex items-center gap-1 hover:text-cyan-300 transition-colors"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{msg.likes}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Real-Time Message Dispatch Form */}
      <form onSubmit={handleSendMessage} className="p-2.5 bg-terminal-900 border-t border-terminal-border space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>Posting to {activeTag} Room Sentiment:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setInputSentiment('BULLISH')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                inputSentiment === 'BULLISH' 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-emerald-400'
              }`}
            >
              <TrendingUp className="w-2.5 h-2.5" />
              <span>BULLISH</span>
            </button>
            <button
              type="button"
              onClick={() => setInputSentiment('BEARISH')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                inputSentiment === 'BEARISH' 
                  ? 'bg-rose-600 text-white border-rose-500' 
                  : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-rose-400'
              }`}
            >
              <TrendingDown className="w-2.5 h-2.5" />
              <span>BEARISH</span>
            </button>
            <button
              type="button"
              onClick={() => setInputSentiment('NEUTRAL')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                inputSentiment === 'NEUTRAL' 
                  ? 'bg-slate-700 text-white border-slate-600' 
                  : 'bg-terminal-950 text-slate-400 border-terminal-border hover:text-slate-200'
              }`}
            >
              <Minus className="w-2.5 h-2.5" />
              <span>NEUTRAL</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Share technical setup, fundamental thesis, or level for ${activeTag}...`}
            className="flex-1 px-3 py-1.5 bg-terminal-950 border border-terminal-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DISPATCH</span>
          </button>
        </div>
      </form>
    </div>
  );
};
