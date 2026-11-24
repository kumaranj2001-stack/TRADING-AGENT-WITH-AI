/**
 * components/research/TradingViewLiveChart.tsx
 * Highly credible, fully accessible, and editable live chart powered by official TradingView library.
 * Allows adding and removing all technical indicators, changing timeframes, drawing tools, and styling.
 */

'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import { BarChart3, AlertCircle, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

export interface TradingViewLiveChartProps {
  symbol: string;
  timeframe?: string;
  theme?: 'dark' | 'light';
  height?: number;
  containerIdPrefix?: string;
  allowIndicatorsCustomization?: boolean;
}

// Maps any app ticker to its authoritative, high-liquidity TradingView exchange:symbol string
export function mapToTradingViewSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().trim();
  
  // Specific mappings
  const mapping: Record<string, string> = {
    'NVDA': 'NASDAQ:NVDA',
    'AAPL': 'NASDAQ:AAPL',
    'TSLA': 'NASDAQ:TSLA',
    'MSFT': 'NASDAQ:MSFT',
    'AMZN': 'NASDAQ:AMZN',
    'GOOGL': 'NASDAQ:GOOGL',
    'GOOG': 'NASDAQ:GOOGL',
    'META': 'NASDAQ:META',
    'AMD': 'NASDAQ:AMD',
    'SPY': 'AMEX:SPY',
    'QQQ': 'NASDAQ:QQQ',
    // Metals
    'XAU/USD': 'OANDA:XAUUSD',
    'XAUUSD': 'OANDA:XAUUSD',
    'GOLD': 'OANDA:XAUUSD',
    'XAG/USD': 'OANDA:XAGUSD',
    'XAGUSD': 'OANDA:XAGUSD',
    'SILVER': 'OANDA:XAGUSD',
    'XPT/USD': 'OANDA:XPTUSD',
    'PLATINUM': 'OANDA:XPTUSD',
    'COPPER': 'COMEX:HG1!',
    'WTI_CRUDE': 'TVC:USOIL',
    'BRENT_CRUDE': 'TVC:UKOIL',
    'CRUDE': 'TVC:USOIL',
    'OIL': 'TVC:USOIL',
    // Forex
    'EUR/USD': 'FX:EURUSD',
    'EURUSD': 'FX:EURUSD',
    'GBP/USD': 'FX:GBPUSD',
    'GBPUSD': 'FX:GBPUSD',
    'USD/JPY': 'FX:USDJPY',
    'USDJPY': 'FX:USDJPY',
    'AUD/USD': 'FX:AUDUSD',
    'USD/CAD': 'FX:USDCAD',
    'USD/CHF': 'FX:USDCHF',
    'NZD/USD': 'FX:NZDUSD',
    'EUR/GBP': 'FX:EURGBP',
    // Indian Markets
    'NIFTY 50': 'NSE:NIFTY',
    'NIFTY': 'NSE:NIFTY',
    'BANK NIFTY': 'NSE:BANKNIFTY',
    'BANKNIFTY': 'NSE:BANKNIFTY',
    'RELIANCE': 'NSE:RELIANCE',
    'TCS': 'NSE:TCS',
    'HDFC BANK': 'NSE:HDFCBANK',
    'HDFCBANK': 'NSE:HDFCBANK',
    'INFY': 'NSE:INFY',
    'ICICIBANK': 'NSE:ICICIBANK',
    'SBIN': 'NSE:SBIN',
  };

  if (mapping[clean]) return mapping[clean];

  // If already prefixed
  if (clean.includes(':')) return clean;

  // Forex slash notation
  if (clean.includes('/')) {
    return `FX:${clean.replace('/', '')}`;
  }

  // Default to US stock on NASDAQ
  return `NASDAQ:${clean}`;
}

const getTimeframeInterval = (tf?: string): string => {
  if (!tf) return '60';
  const lower = tf.toLowerCase();
  if (lower === '1m') return '1';
  if (lower === '5m') return '5';
  if (lower === '15m') return '15';
  if (lower === '30m') return '30';
  if (lower === '1h') return '60';
  if (lower === '4h') return '240';
  if (lower === '1d') return 'D';
  if (lower === '1w') return 'W';
  return '60';
};

export const TradingViewLiveChart: React.FC<TradingViewLiveChartProps> = memo(({
  symbol,
  timeframe = '1h',
  theme = 'dark',
  height = 480,
  containerIdPrefix = 'tv_research_chart',
  allowIndicatorsCustomization = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const tvSymbol = mapToTradingViewSymbol(symbol);
  const interval = getTimeframeInterval(timeframe);
  const containerId = `${containerIdPrefix}_${symbol.replace(/[^A-Za-z0-9]/g, '_')}`;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(false);

    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const initWidget = () => {
      if (!isMounted || !containerRef.current) return;
      try {
        if (typeof (window as any).TradingView !== 'undefined') {
          new (window as any).TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval,
            timezone: 'Etc/UTC',
            theme: theme === 'light' ? 'light' : 'dark',
            style: '1',
            locale: 'en',
            toolbar_bg: theme === 'light' ? '#f8fafc' : '#090d16',
            enable_publishing: false,
            allow_symbol_change: true,
            container_id: containerRef.current.id,
            hide_side_toolbar: false,
            withdateranges: true,
            save_image: true,
            studies: [
              'RSI@tv-basicstudies',
              'MASimple@tv-basicstudies',
              'BollingerBands@tv-basicstudies',
            ],
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650',
          });
          setIsLoading(false);
        } else {
          setLoadError(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(true);
          setIsLoading(false);
        }
      }
    };

    const existingScript = document.getElementById('tradingview-widget-script');
    if (existingScript && typeof (window as any).TradingView !== 'undefined') {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        if (isMounted) initWidget();
      };
      script.onerror = () => {
        if (isMounted) {
          setLoadError(true);
          setIsLoading(false);
        }
      };
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [tvSymbol, interval, theme]);

  return (
    <div className={`relative w-full rounded-xl overflow-hidden border border-terminal-border bg-terminal-950 transition-all ${
      isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : ''
    }`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-terminal-900/90 border-b border-terminal-border text-xs font-mono">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white tracking-wider">TRADINGVIEW ADVANCED LIVE CHART</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {tvSymbol}
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            • Editable Indicators Library • Real-Time Credible Source
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-terminal-950/90 backdrop-blur-sm text-cyan-400 font-mono text-xs gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>INITIALIZING TRADINGVIEW ENGINE ({tvSymbol})...</span>
        </div>
      )}

      {/* Error fallback */}
      {loadError && (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-terminal-950 text-slate-400 font-mono text-xs space-y-2" style={{ height }}>
          <AlertCircle className="w-8 h-8 text-amber-400" />
          <div className="font-bold text-slate-200">TradingView Live Feed Temporarily Unavailable</div>
          <p className="text-[11px] max-w-md text-slate-500">
            Unable to connect to TradingView CDN script. Verify internet connection or firewall access.
          </p>
        </div>
      )}

      {/* TradingView Widget Container */}
      <div
        id={containerId}
        ref={containerRef}
        style={{ height: isFullscreen ? 'calc(100% - 37px)' : height }}
        className="w-full bg-terminal-950"
      />
    </div>
  );
});

TradingViewLiveChart.displayName = 'TradingViewLiveChart';
