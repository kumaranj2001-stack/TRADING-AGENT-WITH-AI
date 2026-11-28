'use client';

import React, { useState, useEffect } from 'react';
import { 
  Snowflake, 
  Lock, 
  Unlock, 
  Clock, 
  ShieldCheck, 
  AlertTriangle,
  Play, 
  Pause,
  RefreshCw
} from 'lucide-react';
import { MarketSessionInfo } from '@/lib/types';
import { MarketSessionManager } from '@/lib/marketSessionManager';
import { formatInstrumentPrice } from '@/lib/marketData';

interface MarketCloseFreezeBannerProps {
  sessionInfo: MarketSessionInfo | null;
  onToggleManualOverride?: (isManualOverride: boolean) => void;
  theme?: 'dark' | 'light';
}

export const MarketCloseFreezeBanner: React.FC<MarketCloseFreezeBannerProps> = ({
  sessionInfo,
  onToggleManualOverride,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [countdownFormatted, setCountdownFormatted] = useState<string>(() => {
    return sessionInfo?.nextOpenFormatted || '';
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return sessionInfo?.secondsUntilOpen || 0;
  });

  // ⏱️ Active real-time countdown decrement loop (ticks every 1,000ms)
  useEffect(() => {
    setMounted(true);
    if (!sessionInfo?.isFrozen || !sessionInfo?.nextOpenDate) {
      if (sessionInfo?.nextOpenFormatted) {
        setCountdownFormatted(sessionInfo.nextOpenFormatted);
      }
      return;
    }

    const tick = () => {
      const res = MarketSessionManager.formatCountdown(sessionInfo.nextOpenDate);
      setCountdownFormatted(res.formatted);
      setSecondsRemaining(res.secondsRemaining);

      if (res.secondsRemaining <= 0) {
        // Countdown reached zero: trigger automated session boundary transition
        MarketSessionManager.forceSessionCheck();
      }
    };

    // Immediate calculation on mount/dependency change
    tick();

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sessionInfo?.nextOpenDate, sessionInfo?.isFrozen, sessionInfo?.pair]);

  if (!sessionInfo || (!sessionInfo.isFrozen && !isManualOverride) || isDismissed) {
    return null;
  }

  const handleToggleOverride = () => {
    const next = !isManualOverride;
    setIsManualOverride(next);
    MarketSessionManager.setManualFreeze(!next && sessionInfo.isFrozen);
    if (onToggleManualOverride) {
      onToggleManualOverride(next);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 sm:p-4 text-xs font-mono shadow-xl transition-all mb-3 ${
      isLight
        ? 'border-sky-300 bg-gradient-to-r from-sky-50 via-white to-indigo-50 text-slate-800'
        : 'border-sky-500/40 bg-gradient-to-r from-sky-950/80 via-slate-900/95 to-indigo-950/80'
    }`}>
      {/* Background soft icy glow */}
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
        {/* Left column: Lock Status & Description */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className={`p-2 sm:p-2.5 rounded-lg border shrink-0 shadow-sm ${
            isLight ? 'bg-sky-100 border-sky-300 text-sky-700' : 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-sky-500/20'
          }`}>
            <Snowflake className={`w-4 h-4 sm:w-5 sm:h-5 animate-pulse ${isLight ? 'text-sky-600' : 'text-sky-300'}`} />
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-extrabold tracking-wider text-xs sm:text-sm flex items-center gap-1.5 ${
                isLight ? 'text-sky-900' : 'text-sky-200'
              }`}>
                <Lock className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                GLOBAL STATE FREEZE ACTIVE
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                isLight ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-sky-900/60 border-sky-600/60 text-sky-300'
              }`}>
                {sessionInfo.statusLabel}
              </span>
              <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                isLight ? 'text-emerald-800 bg-emerald-100 border-emerald-300' : 'text-emerald-400 bg-emerald-950/50 border-emerald-500/30'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                ZERO DRIFT ENFORCED
              </span>
            </div>

            <p className={`text-[11px] sm:text-xs leading-relaxed max-w-2xl ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Market closure detected. Asynchronous background workers and synthetic micro-tickers are locked.
              Displayed values for <strong className={isLight ? 'text-slate-950' : 'text-white'}>{sessionInfo.pair}</strong> are frozen at{' '}
              <strong className={isLight ? 'text-cyan-800' : 'text-cyan-300'}>
                {formatInstrumentPrice(sessionInfo.pair, sessionInfo.lastClosePrice)}
              </strong>.
            </p>
          </div>
        </div>

        {/* Right column: Countdown & Simulation Override Button */}
        <div className={`flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 ${
          isLight ? 'border-sky-200' : 'border-sky-800/40'
        }`}>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] shadow-sm ${
            isLight
              ? 'bg-amber-50 border-amber-300 text-slate-900'
              : 'bg-slate-950/80 border-sky-500/30 text-sky-300'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'} ${secondsRemaining > 0 ? 'animate-pulse' : ''}`} />
            <span className={isLight ? 'text-slate-700 font-semibold' : 'text-slate-400 font-medium'}>Resumes:</span>
            <span className={`font-bold font-mono tracking-tight ${isLight ? 'text-amber-900' : 'text-amber-300'}`} suppressHydrationWarning>
              {mounted ? (countdownFormatted || sessionInfo.nextOpenFormatted) : sessionInfo.nextOpenFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleOverride}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
              isManualOverride
                ? isLight
                  ? 'bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                : isLight
                ? 'bg-sky-600 text-white border border-sky-700 hover:bg-sky-700'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/50 hover:bg-sky-500/30'
            }`}
            title="Toggle between frozen state and simulated active stream"
          >
            {isManualOverride ? (
              <>
                <Pause className={`w-3 h-3 ${isLight ? 'text-amber-800' : 'text-amber-400'}`} />
                <span>Re-freeze State</span>
              </>
            ) : (
              <>
                <Play className={`w-3 h-3 ${isLight ? 'text-white' : 'text-sky-400'}`} />
                <span>Simulate Open</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
