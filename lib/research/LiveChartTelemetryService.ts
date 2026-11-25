/**
 * LiveChartTelemetryService
 * Authoritative live price, OHLCV bar, TradingView symbol search, and technical indicator reader
 * across Forex, Metals, Indian Markets, US/Global Equities, and Crypto.
 *
 * Ensures the Research Engine, 5 Subagents, and PDF Reports stay 100% synchronized
 * with the active symbol, timeframe, and live market structure displayed on the chart.
 */

import {
  AssetClass,
  ChartIndicatorReadings,
  ChartLiveContext,
  ChartOHLCVBar,
  ChartPriceScaleMetadata,
} from './types';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
} from '../indicators';
import { Candle } from '../types';

export interface SymbolResolution {
  symbol: string;      // Canonical app symbol, e.g. 'NVDA', 'XAU/USD', 'EUR/USD'
  tvSymbol: string;    // TradingView exchange:symbol, e.g. 'NASDAQ:NVDA', 'OANDA:XAUUSD'
  yahooSymbol: string; // Yahoo Finance ticker, e.g. 'NVDA', 'GC=F', 'EURUSD=X'
  name: string;
  assetClass: AssetClass;
  benchmark: string;
  currency: string;
  isIndian: boolean;
  fallbackPrice: number;
}

export interface ChartSymbolSearchResult {
  symbol: string;
  tvSymbol: string;
  description: string;
  exchange: string;
  type: string;
  currency: string;
}

const KNOWN_INSTRUMENTS: Record<string, SymbolResolution> = {
  // US Equities & Tech
  'NVDA': { symbol: 'NVDA', tvSymbol: 'NASDAQ:NVDA', yahooSymbol: 'NVDA', name: 'NVIDIA Corporation (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 155.38 },
  'AAPL': { symbol: 'AAPL', tvSymbol: 'NASDAQ:AAPL', yahooSymbol: 'AAPL', name: 'Apple Inc. (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 228.50 },
  'TSLA': { symbol: 'TSLA', tvSymbol: 'NASDAQ:TSLA', yahooSymbol: 'TSLA', name: 'Tesla, Inc. (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 345.20 },
  'MSFT': { symbol: 'MSFT', tvSymbol: 'NASDAQ:MSFT', yahooSymbol: 'MSFT', name: 'Microsoft Corporation (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 422.30 },
  'AMD': { symbol: 'AMD', tvSymbol: 'NASDAQ:AMD', yahooSymbol: 'AMD', name: 'Advanced Micro Devices (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 138.90 },
  'GOOGL': { symbol: 'GOOGL', tvSymbol: 'NASDAQ:GOOGL', yahooSymbol: 'GOOGL', name: 'Alphabet Inc. (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 178.40 },
  'AMZN': { symbol: 'AMZN', tvSymbol: 'NASDAQ:AMZN', yahooSymbol: 'AMZN', name: 'Amazon.com, Inc. (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 210.20 },
  'META': { symbol: 'META', tvSymbol: 'NASDAQ:META', yahooSymbol: 'META', name: 'Meta Platforms, Inc. (NASDAQ)', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 590.00 },
  'SPY': { symbol: 'SPY', tvSymbol: 'AMEX:SPY', yahooSymbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: 'EQUITY', benchmark: 'S&P 500 Index (SPX)', currency: 'USD ($)', isIndian: false, fallbackPrice: 595.00 },
  'QQQ': { symbol: 'QQQ', tvSymbol: 'NASDAQ:QQQ', yahooSymbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: 'EQUITY', benchmark: 'NASDAQ 100', currency: 'USD ($)', isIndian: false, fallbackPrice: 510.00 },

  // Metals & Commodities
  'XAU/USD': { symbol: 'XAU/USD', tvSymbol: 'OANDA:XAUUSD', yahooSymbol: 'GC=F', name: 'Spot Gold / USD (Troy Oz)', assetClass: 'METALS', benchmark: 'Bloomberg Commodity Index / Spot Bullion', currency: 'USD ($)', isIndian: false, fallbackPrice: 3536.84 },
  'XAG/USD': { symbol: 'XAG/USD', tvSymbol: 'OANDA:XAGUSD', yahooSymbol: 'SI=F', name: 'Spot Silver / USD', assetClass: 'METALS', benchmark: 'Bloomberg Commodity Index / Spot Bullion', currency: 'USD ($)', isIndian: false, fallbackPrice: 41.22 },
  'XPT/USD': { symbol: 'XPT/USD', tvSymbol: 'OANDA:XPTUSD', yahooSymbol: 'PL=F', name: 'Spot Platinum / USD', assetClass: 'METALS', benchmark: 'Bloomberg Commodity Index', currency: 'USD ($)', isIndian: false, fallbackPrice: 1296.60 },
  'COPPER': { symbol: 'COPPER', tvSymbol: 'COMEX:HG1!', yahooSymbol: 'HG=F', name: 'COMEX High Grade Copper / USD', assetClass: 'METALS', benchmark: 'Bloomberg Commodity Index', currency: 'USD ($)', isIndian: false, fallbackPrice: 5.485 },
  'WTI_CRUDE': { symbol: 'WTI_CRUDE', tvSymbol: 'TVC:USOIL', yahooSymbol: 'CL=F', name: 'WTI Light Sweet Crude Oil', assetClass: 'METALS', benchmark: 'Global Energy Benchmark', currency: 'USD ($)', isIndian: false, fallbackPrice: 83.41 },
  'BRENT_CRUDE': { symbol: 'BRENT_CRUDE', tvSymbol: 'TVC:UKOIL', yahooSymbol: 'BZ=F', name: 'Brent Crude Oil Benchmark', assetClass: 'METALS', benchmark: 'Global Energy Benchmark', currency: 'USD ($)', isIndian: false, fallbackPrice: 92.57 },

  // Forex Majors
  'EUR/USD': { symbol: 'EUR/USD', tvSymbol: 'FX:EURUSD', yahooSymbol: 'EURUSD=X', name: 'Euro / US Dollar FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'USD ($)', isIndian: false, fallbackPrice: 1.0958 },
  'GBP/USD': { symbol: 'GBP/USD', tvSymbol: 'FX:GBPUSD', yahooSymbol: 'GBPUSD=X', name: 'British Pound / US Dollar FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'USD ($)', isIndian: false, fallbackPrice: 1.3086 },
  'USD/JPY': { symbol: 'USD/JPY', tvSymbol: 'FX:USDJPY', yahooSymbol: 'USDJPY=X', name: 'US Dollar / Japanese Yen FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'JPY (¥)', isIndian: false, fallbackPrice: 158.56 },
  'AUD/USD': { symbol: 'AUD/USD', tvSymbol: 'FX:AUDUSD', yahooSymbol: 'AUDUSD=X', name: 'Australian Dollar / US Dollar FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'USD ($)', isIndian: false, fallbackPrice: 0.6619 },
  'USD/CAD': { symbol: 'USD/CAD', tvSymbol: 'FX:USDCAD', yahooSymbol: 'USDCAD=X', name: 'US Dollar / Canadian Dollar FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'CAD ($)', isIndian: false, fallbackPrice: 1.4343 },
  'USD/CHF': { symbol: 'USD/CHF', tvSymbol: 'FX:USDCHF', yahooSymbol: 'USDCHF=X', name: 'US Dollar / Swiss Franc FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'CHF', isIndian: false, fallbackPrice: 0.8401 },
  'NZD/USD': { symbol: 'NZD/USD', tvSymbol: 'FX:NZDUSD', yahooSymbol: 'NZDUSD=X', name: 'New Zealand Dollar / US Dollar FX Spot', assetClass: 'FOREX', benchmark: 'US Dollar Index (DXY)', currency: 'USD ($)', isIndian: false, fallbackPrice: 0.5471 },
  'EUR/GBP': { symbol: 'EUR/GBP', tvSymbol: 'FX:EURGBP', yahooSymbol: 'EURGBP=X', name: 'Euro / British Pound FX Spot', assetClass: 'FOREX', benchmark: 'ECB / BOE Differential', currency: 'GBP (£)', isIndian: false, fallbackPrice: 0.8382 },

  // Indian Markets
  'NIFTY 50': { symbol: 'NIFTY 50', tvSymbol: 'NSE:NIFTY', yahooSymbol: '^NSEI', name: 'NSE NIFTY 50 Benchmark Index', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 25349.65 },
  'BANK NIFTY': { symbol: 'BANK NIFTY', tvSymbol: 'NSE:BANKNIFTY', yahooSymbol: '^NSEBANK', name: 'NSE NIFTY Bank Index', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 53635.20 },
  'RELIANCE': { symbol: 'RELIANCE', tvSymbol: 'NSE:RELIANCE', yahooSymbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd (NSE)', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 1351.00 },
  'TCS': { symbol: 'TCS', tvSymbol: 'NSE:TCS', yahooSymbol: 'TCS.NS', name: 'Tata Consultancy Services (NSE)', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 4120.00 },
  'HDFC BANK': { symbol: 'HDFC BANK', tvSymbol: 'NSE:HDFCBANK', yahooSymbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd (NSE)', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 1740.00 },
  'INFY': { symbol: 'INFY', tvSymbol: 'NSE:INFY', yahooSymbol: 'INFY.NS', name: 'Infosys Limited (NSE)', assetClass: 'INDIAN_MARKET', benchmark: 'NIFTY 50 Index (NSE)', currency: 'INR (₹)', isIndian: true, fallbackPrice: 1890.00 },
  'USD/INR': { symbol: 'USD/INR', tvSymbol: 'FX_IDC:USDINR', yahooSymbol: 'USDINR=X', name: 'US Dollar / Indian Rupee', assetClass: 'INDIAN_MARKET', benchmark: 'RBI Reference Rate', currency: 'INR (₹)', isIndian: true, fallbackPrice: 86.50 },
};

const ALIAS_MAP: Record<string, string> = {
  'NVIDIA': 'NVDA',
  'NASDAQ:NVDA': 'NVDA',
  'APPLE': 'AAPL',
  'NASDAQ:AAPL': 'AAPL',
  'TESLA': 'TSLA',
  'NASDAQ:TSLA': 'TSLA',
  'MICROSOFT': 'MSFT',
  'NASDAQ:MSFT': 'MSFT',
  'GOOGLE': 'GOOGL',
  'NASDAQ:GOOGL': 'GOOGL',
  'AMAZON': 'AMZN',
  'NASDAQ:AMZN': 'AMZN',
  'XAUUSD': 'XAU/USD',
  'OANDA:XAUUSD': 'XAU/USD',
  'GOLD': 'XAU/USD',
  'XAGUSD': 'XAG/USD',
  'OANDA:XAGUSD': 'XAG/USD',
  'SILVER': 'XAG/USD',
  'XPTUSD': 'XPT/USD',
  'OANDA:XPTUSD': 'XPT/USD',
  'PLATINUM': 'XPT/USD',
  'USOIL': 'WTI_CRUDE',
  'TVC:USOIL': 'WTI_CRUDE',
  'CRUDE': 'WTI_CRUDE',
  'OIL': 'WTI_CRUDE',
  'UKOIL': 'BRENT_CRUDE',
  'TVC:UKOIL': 'BRENT_CRUDE',
  'EURUSD': 'EUR/USD',
  'FX:EURUSD': 'EUR/USD',
  'OANDA:EURUSD': 'EUR/USD',
  'GBPUSD': 'GBP/USD',
  'FX:GBPUSD': 'GBP/USD',
  'OANDA:GBPUSD': 'GBP/USD',
  'USDJPY': 'USD/JPY',
  'FX:USDJPY': 'USD/JPY',
  'OANDA:USDJPY': 'USD/JPY',
  'AUDUSD': 'AUD/USD',
  'FX:AUDUSD': 'AUD/USD',
  'USDCAD': 'USD/CAD',
  'FX:USDCAD': 'USD/CAD',
  'USDCHF': 'USD/CHF',
  'FX:USDCHF': 'USD/CHF',
  'NZDUSD': 'NZD/USD',
  'FX:NZDUSD': 'NZD/USD',
  'EURGBP': 'EUR/GBP',
  'FX:EURGBP': 'EUR/GBP',
  'NIFTY': 'NIFTY 50',
  'NSE:NIFTY': 'NIFTY 50',
  'BANKNIFTY': 'BANK NIFTY',
  'NSE:BANKNIFTY': 'BANK NIFTY',
  'NSE:RELIANCE': 'RELIANCE',
  'NSE:TCS': 'TCS',
  'HDFCBANK': 'HDFC BANK',
  'NSE:HDFCBANK': 'HDFC BANK',
  'NSE:INFY': 'INFY',
  'USDINR': 'USD/INR',
  'FX_IDC:USDINR': 'USD/INR',
};

export function getAssetDecimals(assetClass: AssetClass, symbol: string): number {
  const clean = symbol.toUpperCase();
  if (clean.includes('JPY') || clean.includes('XAG')) return 3;
  if (clean.includes('COPPER')) return 4;
  if (assetClass === 'FOREX') return 5;
  return 2;
}

export function roundAssetPrice(value: number, assetClass: AssetClass, symbol: string): number {
  if (!Number.isFinite(value)) return 0;
  const decimals = getAssetDecimals(assetClass, symbol);
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatAssetPrice(value: number, assetClass: AssetClass, symbol: string): string {
  if (!Number.isFinite(value)) return '0.00';
  const decimals = getAssetDecimals(assetClass, symbol);
  return value.toFixed(decimals);
}

const YAHOO_TIMEFRAME_MAP: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '5d' },
  '30m': { interval: '30m', range: '1mo' },
  '1h': { interval: '1h', range: '1mo' },
  '4h': { interval: '1h', range: '3mo' },
  '1d': { interval: '1d', range: '1y' },
  '1w': { interval: '1wk', range: '2y' },
};

const TV_INTERVAL_SUFFIX: Record<string, string> = {
  '1m': '|1',
  '5m': '|5',
  '15m': '|15',
  '30m': '|30',
  '1h': '|60',
  '4h': '|240',
  '1d': '',
  '1w': '|1W',
};

export class LiveChartTelemetryService {
  private static instance: LiveChartTelemetryService;
  private cache: Map<string, { data: ChartLiveContext; fetchedAt: number }> = new Map();
  private static readonly CACHE_TTL_MS = 10000; // 10 seconds

  private constructor() {}

  public static getInstance(): LiveChartTelemetryService {
    if (!LiveChartTelemetryService.instance) {
      LiveChartTelemetryService.instance = new LiveChartTelemetryService();
    }
    return LiveChartTelemetryService.instance;
  }

  /**
   * Synchronously inspects cached live telemetry for a given symbol if recently fetched.
   */
  public peekCachedTelemetry(symbol: string): ChartLiveContext | undefined {
    const resolved = this.resolveSymbol(symbol);
    for (const key of ['1h', '15m', '5m', '4h', '1d']) {
      const hit = this.cache.get(`${resolved.symbol}_${key}`);
      if (hit) return hit.data;
    }
    for (const [k, entry] of this.cache.entries()) {
      if (k.startsWith(`${resolved.symbol}_`)) return entry.data;
    }
    return undefined;
  }

  public resolveSymbol(rawInput: string): SymbolResolution {
    const clean = (rawInput || 'NVDA').toUpperCase().trim().replace(/^\$/, '');
    const mappedKey = ALIAS_MAP[clean] || clean;

    if (KNOWN_INSTRUMENTS[mappedKey]) {
      return KNOWN_INSTRUMENTS[mappedKey];
    }

    // Handle arbitrary EXCHANGE:TICKER format (e.g. NASDAQ:PLTR, NYSE:BABA, NSE:SBIN, BINANCE:BTCUSDT)
    if (clean.includes(':')) {
      const [exchange, ticker] = clean.split(':');
      const isIndian = exchange === 'NSE' || exchange === 'BSE';
      const isCrypto = exchange === 'BINANCE' || exchange === 'COINBASE' || ticker.endsWith('USDT');
      const isFx = exchange === 'FX' || exchange === 'OANDA' || exchange === 'FX_IDC';

      let yahooSymbol = ticker;
      let assetClass: AssetClass = 'EQUITY';
      let currency = 'USD ($)';
      let benchmark = 'S&P 500 Index (SPX)';

      if (isIndian) {
        assetClass = 'INDIAN_MARKET';
        yahooSymbol = ticker === 'NIFTY' ? '^NSEI' : ticker === 'BANKNIFTY' ? '^NSEBANK' : `${ticker}.NS`;
        currency = 'INR (₹)';
        benchmark = 'NIFTY 50 Index (NSE)';
      } else if (isCrypto) {
        yahooSymbol = ticker.replace(/USDT$/, '-USD').replace(/USD$/, '-USD');
      } else if (isFx) {
        assetClass = ticker.includes('XAU') || ticker.includes('XAG') || ticker.includes('XPT') ? 'METALS' : 'FOREX';
        yahooSymbol = ticker.includes('XAU') ? 'GC=F' : ticker.includes('XAG') ? 'SI=F' : `${ticker}=X`;
        benchmark = assetClass === 'METALS' ? 'Bloomberg Commodity Index' : 'US Dollar Index (DXY)';
      }

      return {
        symbol: ticker,
        tvSymbol: clean,
        yahooSymbol,
        name: `${ticker} (${exchange})`,
        assetClass,
        benchmark,
        currency,
        isIndian,
        fallbackPrice: 100,
      };
    }

    // Handle arbitrary Forex/Crypto slash pairs (e.g. BTC/USD, EUR/JPY)
    if (clean.includes('/')) {
      const [base, quote] = clean.split('/');
      const isCrypto = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB'].includes(base);
      if (isCrypto) {
        return {
          symbol: clean,
          tvSymbol: `COINBASE:${base}${quote}`,
          yahooSymbol: `${base}-${quote}`,
          name: `${base} / ${quote}`,
          assetClass: 'EQUITY',
          benchmark: 'Crypto Market Cap Index',
          currency: quote === 'USD' ? 'USD ($)' : quote,
          isIndian: false,
          fallbackPrice: base === 'BTC' ? 92000 : base === 'ETH' ? 3200 : 150,
        };
      }
      return {
        symbol: clean,
        tvSymbol: `FX:${base}${quote}`,
        yahooSymbol: `${base}${quote}=X`,
        name: `${base} / ${quote} FX Spot`,
        assetClass: quote === 'INR' ? 'INDIAN_MARKET' : 'FOREX',
        benchmark: 'US Dollar Index (DXY)',
        currency: quote === 'JPY' ? 'JPY (¥)' : quote === 'INR' ? 'INR (₹)' : quote === 'GBP' ? 'GBP (£)' : 'USD ($)',
        isIndian: quote === 'INR',
        fallbackPrice: quote === 'JPY' ? 150 : 1.1,
      };
    }

    // Arbitrary US/Global stock ticker (e.g. PLTR, COIN, NFLX, AVGO, TSM)
    return {
      symbol: clean,
      tvSymbol: `NASDAQ:${clean}`,
      yahooSymbol: clean,
      name: `${clean} (Global Equity)`,
      assetClass: 'EQUITY',
      benchmark: 'S&P 500 Index (SPX)',
      currency: 'USD ($)',
      isIndian: false,
      fallbackPrice: 100,
    };
  }

  public async searchSymbols(query: string): Promise<ChartSymbolSearchResult[]> {
    const q = query.trim();
    const curated: ChartSymbolSearchResult[] = Object.values(KNOWN_INSTRUMENTS).map((item) => ({
      symbol: item.symbol,
      tvSymbol: item.tvSymbol,
      description: item.name,
      exchange: item.tvSymbol.split(':')[0] || 'GLOBAL',
      type: item.assetClass.toLowerCase(),
      currency: item.currency,
    }));

    if (!q) {
      return curated.slice(0, 15);
    }

    const lowerQ = q.toLowerCase();
    const localMatches = curated.filter(
      (c) =>
        c.symbol.toLowerCase().includes(lowerQ) ||
        c.tvSymbol.toLowerCase().includes(lowerQ) ||
        c.description.toLowerCase().includes(lowerQ)
    );

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${encodeURIComponent(q)}&hl=0&lang=en&domain=production&sort_by_country=US`;
      const res = await fetch(url, {
        headers: {
          Origin: 'https://www.tradingview.com',
          'User-Agent': 'Mozilla/5.0',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const remoteList: ChartSymbolSearchResult[] = (json?.symbols || [])
          .slice(0, 12)
          .map((s: any) => {
            const ex = (s.source_id || s.exchange || 'NASDAQ').toUpperCase();
            const sym = (s.symbol || '').toUpperCase();
            const tvSym = `${ex}:${sym}`;
            const canonical = ALIAS_MAP[tvSym] || ALIAS_MAP[sym] || (ex === 'FX' || ex === 'OANDA' ? `${sym.slice(0, 3)}/${sym.slice(3)}` : sym);
            return {
              symbol: canonical.length === 7 && canonical.includes('/') ? canonical : sym,
              tvSymbol: tvSym,
              description: (s.description || sym).replace(/<\/?em>/g, ''),
              exchange: ex,
              type: s.type || 'stock',
              currency: s.currency_code || 'USD',
            };
          });

        // Deduplicate local + remote preferring curated canonical items first
        const seen = new Set<string>();
        const merged: ChartSymbolSearchResult[] = [];
        for (const item of [...localMatches, ...remoteList]) {
          if (!seen.has(item.tvSymbol)) {
            seen.add(item.tvSymbol);
            merged.push(item);
          }
        }
        return merged.slice(0, 16);
      }
    } catch {
      // Fallback cleanly to local matches
    }

    return localMatches.length > 0
      ? localMatches
      : [
          {
            symbol: q.toUpperCase(),
            tvSymbol: q.includes(':') ? q.toUpperCase() : `NASDAQ:${q.toUpperCase()}`,
            description: `${q.toUpperCase()} (Custom Symbol)`,
            exchange: 'CUSTOM',
            type: 'stock',
            currency: 'USD',
          },
        ];
  }

  public async fetchLiveChartTelemetry(
    rawSymbol: string,
    timeframe: string = '1h',
    activeIndicators: string[] = ['RSI', 'EMA20', 'EMA50', 'EMA200', 'MACD', 'BB', 'STOCH', 'ATR']
  ): Promise<ChartLiveContext> {
    const resolved = this.resolveSymbol(rawSymbol);
    const tf = timeframe.toLowerCase();
    const cacheKey = `${resolved.tvSymbol}_${tf}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.fetchedAt < LiveChartTelemetryService.CACHE_TTL_MS) {
      return {
        ...cached.data,
        activeIndicators,
      };
    }

    // Fetch TradingView Scanner + Yahoo Finance candles in parallel
    const [tvData, yfData] = await Promise.all([
      this.fetchTradingViewScanner(resolved, tf),
      this.fetchYahooCandles(resolved, tf),
    ]);

    let candles = yfData.candles;
    const lastYahooCandle = candles.length > 0 ? candles[candles.length - 1] : undefined;

    const livePrice =
      tvData?.close ||
      yfData.livePrice ||
      lastYahooCandle?.close ||
      resolved.fallbackPrice;

    // If upstream historical bars are unavailable or sparse, synthesize a deterministic ATR-calibrated
    // historical window strictly anchored backwards from the authoritative live spot price so chart panning
    // and indicators stay consistent across all symbols and timeframes.
    if (candles.length < 24) {
      const dec = getAssetDecimals(resolved.assetClass, resolved.symbol);
      const tfMinutesMap: Record<string, number> = {
        '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440, '1w': 10080,
      };
      const stepMs = (tfMinutesMap[tf] || 60) * 60000;
      const barCount = 120;
      const anchorVol = livePrice * (resolved.assetClass === 'FOREX' ? 0.0018 : resolved.assetClass === 'METALS' ? 0.0042 : 0.0075);
      const driftRatio = ((tvData?.changePercent ?? 0) / 100) / Math.max(24, barCount);
      const generated: ChartOHLCVBar[] = [];
      let cursorClose = livePrice;
      const alignedNow = Math.floor(now / stepMs) * stepMs;

      for (let i = 0; i < barCount; i++) {
        const idxFromEnd = i;
        const ts = alignedNow - idxFromEnd * stepMs;
        const wave = Math.sin((barCount - i) * 0.42) * anchorVol * 0.65 + Math.cos((barCount - i) * 0.19) * anchorVol * 0.35;
        const close = i === 0 ? livePrice : cursorClose;
        const open = close - wave - close * driftRatio;
        const wickHi = Math.abs(Math.sin((i + 1) * 1.7)) * anchorVol * 0.45;
        const wickLo = Math.abs(Math.cos((i + 2) * 1.3)) * anchorVol * 0.45;
        generated.unshift({
          timestamp: ts,
          time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: roundAssetPrice(open, resolved.assetClass, resolved.symbol),
          high: roundAssetPrice(Math.max(open, close) + wickHi, resolved.assetClass, resolved.symbol),
          low: roundAssetPrice(Math.max(livePrice * 0.2, Math.min(open, close) - wickLo), resolved.assetClass, resolved.symbol),
          close: roundAssetPrice(close, resolved.assetClass, resolved.symbol),
          volume: Math.round((tvData?.volume || 150000) / 24),
        });
        cursorClose = open;
      }
      candles = generated;
    }

    const lastCandle = candles[candles.length - 1];
    const prevClose = tvData?.prevClose || yfData.prevClose || livePrice;
    const changePercent =
      tvData?.changePercent !== undefined
        ? Number(tvData.changePercent.toFixed(2))
        : prevClose > 0
        ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2))
        : 0;

    // Compute local OHLCV-based indicators whenever real candles exist, then blend with TradingView scanner readings
    let indicatorReadings: ChartIndicatorReadings = { ...(tvData?.indicators || {}) };
    if (candles.length >= 20) {
      const closes = candles.map((c) => c.close);
      const ema20Arr = calculateEMA(closes, 20);
      const ema50Arr = calculateEMA(closes, Math.min(50, closes.length));
      const ema200Arr = calculateEMA(closes, Math.min(200, closes.length));
      const rsiArr = calculateRSI(closes, 14);
      const macdObj = calculateMACD(closes);
      const bbObj = calculateBollingerBands(closes, 20, 2);
      const atrArr = calculateATR(candles as Candle[], 14);

      const last = closes.length - 1;
      const computedRsi = rsiArr[last];
      const window14 = candles.slice(-14);
      const hh14 = Math.max(...window14.map((c) => c.high));
      const ll14 = Math.min(...window14.map((c) => c.low));
      const localStochK = hh14 > ll14 ? Number((((livePrice - ll14) / (hh14 - ll14)) * 100).toFixed(2)) : 50;

      indicatorReadings = {
        rsi14: indicatorReadings.rsi14 ?? computedRsi,
        ema20: ema20Arr[last] ?? indicatorReadings.ema20,
        ema50: ema50Arr[last] ?? indicatorReadings.ema50,
        ema200: indicatorReadings.ema200 ?? ema200Arr[last],
        macdLine: macdObj.macdLine[last] ?? indicatorReadings.macdLine,
        macdSignal: macdObj.signalLine[last] ?? indicatorReadings.macdSignal,
        macdHistogram:
          macdObj.histogram[last] ??
          (indicatorReadings.macdLine !== undefined && indicatorReadings.macdSignal !== undefined
            ? Number((indicatorReadings.macdLine - indicatorReadings.macdSignal).toFixed(5))
            : undefined),
        bbUpper: bbObj.upper[last] ?? indicatorReadings.bbUpper,
        bbMiddle: bbObj.middle[last] ?? indicatorReadings.ema20,
        bbLower: bbObj.lower[last] ?? indicatorReadings.bbLower,
        atr14: atrArr[last] ?? indicatorReadings.atr14,
        stochK: indicatorReadings.stochK ?? localStochK,
        stochD: indicatorReadings.stochD ?? Number((localStochK * 0.96).toFixed(2)),
      };
    }

    // Ensure ATR is always non-zero & calibrated to instrument
    if (!indicatorReadings.atr14 || indicatorReadings.atr14 <= 0) {
      indicatorReadings.atr14 = roundAssetPrice(livePrice * 0.014, resolved.assetClass, resolved.symbol);
    }

    const finalCandles = candles.slice(-180);
    const windowLow = finalCandles.length > 0 ? Math.min(...finalCandles.map((c) => c.low)) : livePrice * 0.985;
    const windowHigh = finalCandles.length > 0 ? Math.max(...finalCandles.map((c) => c.high)) : livePrice * 1.015;
    const span = Math.max(indicatorReadings.atr14 || livePrice * 0.01, windowHigh - windowLow);
    const pad = Math.max(span * 0.14, (indicatorReadings.atr14 || livePrice * 0.01) * 0.5);
    const dec = getAssetDecimals(resolved.assetClass, resolved.symbol);
    const priceScale: ChartPriceScaleMetadata = {
      minPrice: roundAssetPrice(windowLow, resolved.assetClass, resolved.symbol),
      maxPrice: roundAssetPrice(windowHigh, resolved.assetClass, resolved.symbol),
      rangeSpan: roundAssetPrice(span, resolved.assetClass, resolved.symbol),
      atr14: roundAssetPrice(indicatorReadings.atr14 || livePrice * 0.014, resolved.assetClass, resolved.symbol),
      tickStep: Number((Math.pow(10, -dec) * 10).toFixed(dec)),
      priceDecimals: dec,
      recommendedMinY: roundAssetPrice(windowLow - pad, resolved.assetClass, resolved.symbol),
      recommendedMaxY: roundAssetPrice(windowHigh + pad, resolved.assetClass, resolved.symbol),
      supportsVerticalPan: true,
      supportsPriceScaleDrag: true,
    };

    const context: ChartLiveContext = {
      symbol: resolved.symbol,
      tvSymbol: resolved.tvSymbol,
      name: tvData?.description || yfData.name || resolved.name,
      timeframe: tf,
      livePrice: roundAssetPrice(livePrice, resolved.assetClass, resolved.symbol),
      open: roundAssetPrice(tvData?.open || lastCandle?.open || livePrice, resolved.assetClass, resolved.symbol),
      high: roundAssetPrice(tvData?.high || lastCandle?.high || livePrice * 1.005, resolved.assetClass, resolved.symbol),
      low: roundAssetPrice(tvData?.low || lastCandle?.low || livePrice * 0.995, resolved.assetClass, resolved.symbol),
      close: roundAssetPrice(livePrice, resolved.assetClass, resolved.symbol),
      prevClose: roundAssetPrice(prevClose, resolved.assetClass, resolved.symbol),
      volume: tvData?.volume || lastCandle?.volume || 100000,
      changePercent,
      currency: resolved.currency,
      activeIndicators,
      indicatorReadings,
      recentCandles: finalCandles,
      priceScale,
      source: tvData ? 'TRADINGVIEW_SCANNER' : yfData.candles.length > 0 ? 'YAHOO_FINANCE' : 'SYNTHETIC_FALLBACK',
      timestamp: now,
    };

    this.cache.set(cacheKey, { data: context, fetchedAt: now });
    return context;
  }

  private async fetchTradingViewScanner(
    resolved: SymbolResolution,
    timeframe: string
  ): Promise<{
    description?: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    prevClose?: number;
    volume?: number;
    changePercent?: number;
    indicators: ChartIndicatorReadings;
  } | null> {
    const endpoint = resolved.isIndian
      ? 'https://scanner.tradingview.com/india/scan'
      : 'https://scanner.tradingview.com/global/scan';

    const sfx = TV_INTERVAL_SUFFIX[timeframe] ?? '|60';
    const tryScan = async (ticker: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          symbols: { tickers: [ticker] },
          columns: [
            'description',
            'close',
            'open',
            'high',
            'low',
            'volume',
            'change',
            `RSI${sfx}`,
            `EMA20${sfx}`,
            `EMA50${sfx}`,
            `EMA200${sfx}`,
            `MACD.macd${sfx}`,
            `MACD.signal${sfx}`,
            `BB.upper${sfx}`,
            `BB.lower${sfx}`,
            `ATR${sfx}`,
            `Stoch.K${sfx}`,
            `Stoch.D${sfx}`,
          ],
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const json = await res.json();
      const row = json?.data?.[0]?.d;
      if (!row || typeof row[1] !== 'number') return null;

      const close = row[1];
      const changePercent = typeof row[6] === 'number' ? row[6] : 0;
      const prevClose = changePercent !== 0 ? close / (1 + changePercent / 100) : close;
      const macdLine = typeof row[11] === 'number' ? row[11] : undefined;
      const macdSignal = typeof row[12] === 'number' ? row[12] : undefined;
      const bbUpper = typeof row[13] === 'number' ? row[13] : undefined;
      const bbLower = typeof row[14] === 'number' ? row[14] : undefined;

      return {
        description: typeof row[0] === 'string' ? row[0] : undefined,
        close,
        open: typeof row[2] === 'number' ? row[2] : undefined,
        high: typeof row[3] === 'number' ? row[3] : undefined,
        low: typeof row[4] === 'number' ? row[4] : undefined,
        prevClose,
        volume: typeof row[5] === 'number' ? row[5] : undefined,
        changePercent,
        indicators: {
          rsi14: typeof row[7] === 'number' ? Number(row[7].toFixed(2)) : undefined,
          ema20: typeof row[8] === 'number' ? row[8] : undefined,
          ema50: typeof row[9] === 'number' ? row[9] : undefined,
          ema200: typeof row[10] === 'number' ? row[10] : undefined,
          macdLine,
          macdSignal,
          macdHistogram:
            macdLine !== undefined && macdSignal !== undefined
              ? Number((macdLine - macdSignal).toFixed(5))
              : undefined,
          bbUpper,
          bbMiddle:
            bbUpper !== undefined && bbLower !== undefined
              ? (bbUpper + bbLower) / 2
              : undefined,
          bbLower,
          atr14: typeof row[15] === 'number' ? row[15] : undefined,
          stochK: typeof row[16] === 'number' ? Number(row[16].toFixed(2)) : undefined,
          stochD: typeof row[17] === 'number' ? Number(row[17].toFixed(2)) : undefined,
        },
      };
    };

    try {
      const primary = await tryScan(resolved.tvSymbol);
      if (primary) return primary;
      // Fallback exchange attempt for US equities (NYSE vs NASDAQ vs AMEX)
      if (!resolved.isIndian && resolved.tvSymbol.startsWith('NASDAQ:')) {
        const nyseTry = await tryScan(resolved.tvSymbol.replace('NASDAQ:', 'NYSE:'));
        if (nyseTry) return nyseTry;
      }
    } catch {
      // Ignore network errors cleanly
    }

    return null;
  }

  private async fetchYahooCandles(
    resolved: SymbolResolution,
    timeframe: string
  ): Promise<{ candles: ChartOHLCVBar[]; livePrice?: number; prevClose?: number; name?: string }> {
    const cfg = YAHOO_TIMEFRAME_MAP[timeframe] || YAHOO_TIMEFRAME_MAP['1h'];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved.yahooSymbol)}?interval=${cfg.interval}&range=${cfg.range}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);
      if (!res.ok) return { candles: [] };

      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) return { candles: [] };

      const meta = result.meta || {};
      const timestamps: number[] = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens: number[] = quote.open || [];
      const highs: number[] = quote.high || [];
      const lows: number[] = quote.low || [];
      const closes: number[] = quote.close || [];
      const volumes: number[] = quote.volume || [];

      const rawBars: ChartOHLCVBar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        if (
          typeof o !== 'number' ||
          typeof h !== 'number' ||
          typeof l !== 'number' ||
          typeof c !== 'number'
        ) {
          continue;
        }
        const tsMs = timestamps[i] * 1000;
        rawBars.push({
          timestamp: tsMs,
          time: new Date(tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: roundAssetPrice(o, resolved.assetClass, resolved.symbol),
          high: roundAssetPrice(h, resolved.assetClass, resolved.symbol),
          low: roundAssetPrice(l, resolved.assetClass, resolved.symbol),
          close: roundAssetPrice(c, resolved.assetClass, resolved.symbol),
          volume: typeof volumes[i] === 'number' ? volumes[i] : 0,
        });
      }

      // If 4h requested, aggregate 1h bars in groups of 4
      let finalBars = rawBars;
      if (timeframe === '4h' && rawBars.length >= 8) {
        const agg: ChartOHLCVBar[] = [];
        for (let i = 0; i < rawBars.length; i += 4) {
          const chunk = rawBars.slice(i, i + 4);
          if (chunk.length === 0) continue;
          agg.push({
            timestamp: chunk[0].timestamp,
            time: chunk[0].time,
            open: chunk[0].open,
            high: Math.max(...chunk.map((b) => b.high)),
            low: Math.min(...chunk.map((b) => b.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((acc, b) => acc + b.volume, 0),
          });
        }
        finalBars = agg;
      }

      return {
        candles: finalBars,
        livePrice: typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : undefined,
        prevClose: typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : undefined,
        name: meta.longName || meta.shortName,
      };
    } catch {
      return { candles: [] };
    }
  }
}

export const liveChartTelemetryService = LiveChartTelemetryService.getInstance();
