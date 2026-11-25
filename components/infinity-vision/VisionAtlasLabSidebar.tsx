'use client';

import React, { useMemo, useState } from 'react';
import {
  Compass,
  HelpCircle,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CurrencyPair } from '@/lib/types';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { liveMarketAnchorConstraintEngine } from '@/lib/liveMarketAnchorConstraintEngine';
import { ResearchReportSnapshot } from '@/lib/research/types';
import {
  computeLivePredictiveAnalytics,
  PredictiveCandleInput,
} from '@/lib/research/PredictiveAnalyticsEngine';

export interface VisionAtlasLabSidebarProps {
  pair: CurrencyPair | string;
  timeframe: string;
  theme?: 'light' | 'dark';
  onSimulate?: () => void;
  livePrice?: number;
  candles?: PredictiveCandleInput[];
  researchReport?: ResearchReportSnapshot | null;
}

export const VisionAtlasLabSidebar: React.FC<VisionAtlasLabSidebarProps> = ({
  pair,
  timeframe,
  theme = 'light',
  onSimulate,
  livePrice: propLivePrice,
  candles = [],
  researchReport,
}) => {
  const isLight = theme === 'light';
  const cleanPair = pair.replace('/', '');
  const [selectedLanguage, setSelectedLanguage] = useState<'ta' | 'en'>('en');
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(true);
  const [voiceSpeed, setVoiceSpeed] = useState<'SLOW' | 'NORMAL' | 'FAST'>('NORMAL');
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [explanationText, setExplanationText] = useState<string>('');

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

  const { visionAtlasLab: lab, decimals } = snapshot;
  const isIndian =
    pair.includes('NIFTY') || pair.includes('RELIANCE') || pair.includes('HDFC') || pair.includes('TCS') || pair.includes('INFY');
  const isFx = pair.includes('/') && !pair.includes('XAU') && !pair.includes('XAG') && !pair.includes('BTC');
  const pricePrefix = isIndian ? '₹' : isFx ? '' : '$';
  const fmt = (n: number) => `${pricePrefix}${n.toFixed(decimals)}`;

  const handleAnalyseAndExplain = () => {
    setIsExplaining(true);
    const primaryBuy = lab.buyZones[0];
    const primarySell = lab.sellZones[0];
    const stopRef =
      researchReport?.technical.tradePlan.stopLoss.price ?? lab.buyZones[1]?.low ?? snapshot.quantum.keySupport;

    const textEn = `Live Vision Atlas Telemetry for ${cleanPair} on ${timeframe}: ${lab.liquiditySweepText}. Structure reads ${lab.structureText} with ${lab.bullishPct}% bullish vs ${lab.bearishPct}% bearish weight (Confluence ${lab.signalEngine.confluenceScore}/100). Key demand spans ${fmt(primaryBuy.low)} to ${fmt(primaryBuy.high)}, supply sits at ${fmt(primarySell.low)} to ${fmt(primarySell.high)}, and invalidation anchor rests near ${fmt(stopRef)}.`;
    const textTa = `${cleanPair} ${timeframe} நேரடி பகுப்பாய்வு: ${fmt(lab.sweepPrice)} நிலையில் பணப்புழக்கம் கண்டறியப்பட்டது. சந்தை அமைப்பு ${lab.structureText} (${lab.bullishPct}% காளை / ${lab.bearishPct}% கரடி). டிமாண்ட் பகுதி ${fmt(primaryBuy.low)} முதல் ${fmt(primaryBuy.high)} வரை உள்ளது. ஆபத்து எல்லை ${fmt(stopRef)}.`;

    const textToSpeak = selectedLanguage === 'ta' ? textTa : textEn;
    setExplanationText(textToSpeak);

    if (isVoiceOn && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = selectedLanguage === 'ta' ? 'ta-IN' : 'en-US';
      utterance.rate = voiceSpeed === 'SLOW' ? 0.8 : voiceSpeed === 'FAST' ? 1.2 : 1.0;
      utterance.onend = () => setIsExplaining(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsExplaining(false), 1800);
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col select-none overflow-y-auto custom-scrollbar font-sans text-xs ${
        isLight ? 'text-slate-800' : 'text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-terminal-border flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              VISION ATLAS LAB
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            Live Order Flow &amp; Institutional Confluences
          </p>
        </div>

        <button
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>{showHelp ? 'Hide' : 'How to use'}</span>
        </button>
      </div>

      <div className="p-3.5 space-y-3.5 flex-1">
        {showHelp && (
          <div className="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5 text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Zones, structure shifts, and Signal Engine triggers synchronize in real time with the Chart.js OHLCV stream and the active AI Research Report ({cleanPair} {timeframe}).
          </div>
        )}

        {/* Language Selection: தமிழ் / English */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border bg-slate-50 dark:bg-terminal-900/40 space-y-1.5">
          <span className="font-bold text-[11px] text-slate-800 dark:text-white block">
            Language - மொழி
          </span>
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setSelectedLanguage('ta')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                selectedLanguage === 'ta'
                  ? 'bg-slate-900 text-white dark:bg-cyan-600'
                  : 'border border-slate-300 dark:border-terminal-border text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              தமிழ் (Tamil)
            </button>
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                selectedLanguage === 'en'
                  ? 'bg-slate-900 text-white dark:bg-cyan-600'
                  : 'border border-slate-300 dark:border-terminal-border text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Institutional Liquidity Snapshot */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Institutional liquidity
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-600 dark:text-emerald-400">
              LIVE COMPUTED
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-sans shrink-0">Liquidity sweep:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{lab.liquiditySweepText}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 font-sans shrink-0">Structure:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right">{lab.structureText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-sans">Analysis confidence:</span>
              <span
                className={`font-bold ${
                  lab.confidenceText === 'High'
                    ? 'text-emerald-600'
                    : lab.confidenceText === 'Moderate'
                    ? 'text-cyan-600'
                    : 'text-amber-600'
                }`}
              >
                {lab.confidenceText} ({lab.signalEngine.confluenceScore}/100)
              </span>
            </div>
          </div>

          {/* Split Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-emerald-600">Bullish {lab.bullishPct}%</span>
              <span className="text-rose-600">Bearish {lab.bearishPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-terminal-800 overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${lab.bullishPct}%` }} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${lab.bearishPct}%` }} />
            </div>
          </div>

          {/* Possible Reaction Zones */}
          <div className="pt-2 border-t border-slate-200 dark:border-terminal-border space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase block font-sans">
              Live Order Block &amp; Reaction Zones
            </span>
            <div className="space-y-1 text-[11px] font-mono">
              {lab.sellZones.slice(0, 2).map((z, idx) => (
                <div key={z.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-rose-500' : 'bg-amber-600'}`} />
                    <span className="text-slate-700 dark:text-slate-300">{z.strengthLabel}</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {fmt(z.low)} - {fmt(z.high)}
                  </span>
                </div>
              ))}
              {lab.buyZones.slice(0, 2).map((z, idx) => (
                <div key={z.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-blue-600'}`} />
                    <span className="text-slate-700 dark:text-slate-300">{z.strengthLabel}</span>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {fmt(z.low)} - {fmt(z.high)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Market Analysis & Explanation Form */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2.5">
          <span className="font-bold text-[11px] text-slate-900 dark:text-white block">
            Market analysis &amp; narration - {cleanPair} {timeframe}
          </span>

          <button
            onClick={handleAnalyseAndExplain}
            disabled={isExplaining}
            className="w-full py-2 px-3 rounded-lg bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isExplaining ? 'animate-spin' : ''}`} />
            <span>{isExplaining ? 'SYNTHESIZING VOICE...' : 'ANALYSE & EXPLAIN LIVE'}</span>
          </button>

          {/* Voice Narration & Speed Controls */}
          <div className="flex items-center justify-between gap-1 pt-1 text-[11px]">
            <button
              onClick={() => setIsVoiceOn(!isVoiceOn)}
              className={`px-2 py-1 rounded border text-[10px] font-bold flex items-center gap-1 ${
                isVoiceOn
                  ? 'bg-slate-900 text-white dark:bg-cyan-600'
                  : 'border-slate-300 dark:border-terminal-border text-slate-400'
              }`}
            >
              {isVoiceOn ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              <span>{isVoiceOn ? 'Voice On' : 'Voice Off'}</span>
            </button>

            <span className="text-slate-400 text-[10px]">Speed:</span>
            {(['SLOW', 'NORMAL', 'FAST'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setVoiceSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  voiceSpeed === s
                    ? 'bg-slate-200 dark:bg-terminal-800 text-slate-900 dark:text-white'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {explanationText && (
            <div className="p-2.5 rounded bg-slate-50 dark:bg-terminal-900/60 border border-slate-200 dark:border-terminal-border text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {explanationText}
            </div>
          )}
        </div>

        {/* Live Scenario Simulator */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-2">
          <span className="font-bold text-[11px] text-slate-900 dark:text-white block">
            Quantum Monte Carlo - {cleanPair} {timeframe}
          </span>
          <button
            onClick={onSimulate}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500 font-bold text-xs transition-colors cursor-pointer"
          >
            OPEN QUANTUM SIMULATOR
          </button>
        </div>

        {/* Live Signal Engine Status */}
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-terminal-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-slate-900 dark:text-white">
              Signal engine - {cleanPair} {timeframe}
            </span>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                lab.signalEngine.status === 'LONG_SIGNAL'
                  ? 'bg-emerald-500/15 text-emerald-600'
                  : lab.signalEngine.status === 'SHORT_SIGNAL'
                  ? 'bg-rose-500/15 text-rose-600'
                  : 'bg-amber-500/15 text-amber-600'
              }`}
            >
              {lab.signalEngine.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 font-mono">
            {lab.signalEngine.headline}
          </p>
          <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
            {lab.signalEngine.detail}
          </p>
        </div>
      </div>
    </div>
  );
};
