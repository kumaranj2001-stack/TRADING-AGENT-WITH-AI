/**
 * Phase 1: DiscoveryBriefCompiler
 * Community Live Chat Grounding Orchestrator.
 * 
 * Replaces external continuous WebSocket and API market data ingestion with real-time
 * TradingView-style community live chat transcript buffering as the sole input payload
 * passed into the five-stage subagent pipeline.
 */

import { AssetClass, DiscoveryBrief, LocalizedPricing, VolumeBenchmarks, VolatilityBenchmarks, MacroeconomicBenchmarks } from './types';
import { communityChatEngine } from './CommunityChatEngine';

export class DiscoveryBriefCompiler {
  private static instance: DiscoveryBriefCompiler;

  // Cache for continuous grounding
  private briefCache: Map<string, DiscoveryBrief> = new Map();

  private constructor() {}

  public static getInstance(): DiscoveryBriefCompiler {
    if (!DiscoveryBriefCompiler.instance) {
      DiscoveryBriefCompiler.instance = new DiscoveryBriefCompiler();
    }
    return DiscoveryBriefCompiler.instance;
  }

  /**
   * Universal Asset Class Detector & Benchmark Resolver
   */
  public detectAssetClass(symbol: string): { assetClass: AssetClass; benchmark: string; currency: string } {
    const cleanSym = symbol.toUpperCase().trim();

    // Indian Markets
    if (
      cleanSym.includes('NIFTY') || 
      cleanSym.includes('INR') || 
      ['RELIANCE', 'TCS', 'HDFC BANK', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'TATAMOTORS'].includes(cleanSym)
    ) {
      return {
        assetClass: 'INDIAN_MARKET',
        benchmark: 'NIFTY 50 Index (NSE)',
        currency: 'INR (₹)',
      };
    }

    // Metals & Commodities
    if (
      cleanSym.includes('XAU') || 
      cleanSym.includes('GOLD') || 
      cleanSym.includes('XAG') || 
      cleanSym.includes('SILVER') || 
      cleanSym.includes('XPT') ||
      cleanSym.includes('PLATINUM') ||
      cleanSym.includes('CRUDE') || 
      cleanSym.includes('OIL') || 
      cleanSym.includes('COPPER')
    ) {
      return {
        assetClass: 'METALS',
        benchmark: 'Bloomberg Commodity Index / Spot Bullion',
        currency: 'USD ($)',
      };
    }

    // Forex Pairs
    if (
      cleanSym.includes('/') || 
      ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'].includes(cleanSym.replace('/', ''))
    ) {
      const currency = cleanSym.includes('JPY') ? 'JPY (¥)' : cleanSym.includes('EUR') && !cleanSym.includes('USD') ? 'EUR (€)' : cleanSym.includes('GBP') && !cleanSym.includes('USD') ? 'GBP (£)' : 'USD ($)';
      return {
        assetClass: 'FOREX',
        benchmark: 'US Dollar Index (DXY)',
        currency,
      };
    }

    // Equities Default
    return {
      assetClass: 'EQUITY',
      benchmark: 'S&P 500 Index (SPX)',
      currency: 'USD ($)',
    };
  }

  /**
   * Compiles the Phase 1 DISCOVERY_BRIEF strictly using buffered Community Live Chat Transcripts
   * (External WebSocket & API telemetry bindings deprecated and decoupled)
   */
  public async compileBrief(symbol: string): Promise<DiscoveryBrief> {
    const cleanSym = symbol.toUpperCase().trim();
    const { assetClass, benchmark, currency } = this.detectAssetClass(symbol);
    const now = Date.now();

    // Ingest buffered community chat transcript as sole input payload
    const chatTranscript = communityChatEngine.getBufferedTranscript(cleanSym);

    // Derive community baseline pricing and discussion levels
    let basePrice: number = 142.80;
    let name: string = cleanSym;

    if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) {
      basePrice = 3538.20;
      name = 'Spot Gold / USD (Troy Oz)';
    } else if (cleanSym.includes('XAG') || cleanSym.includes('SILVER')) {
      basePrice = 41.22;
      name = 'Spot Silver / USD';
    } else if (cleanSym.includes('XPT') || cleanSym.includes('PLATINUM')) {
      basePrice = 1296.60;
      name = 'Spot Platinum / USD';
    } else if (cleanSym.includes('COPPER')) {
      basePrice = 5.485;
      name = 'COMEX High Grade Copper / USD';
    } else if (cleanSym.includes('WTI') || cleanSym === 'CRUDE' || cleanSym === 'OIL') {
      basePrice = 83.41;
      name = 'WTI Light Sweet Crude Oil (NYMEX)';
    } else if (cleanSym.includes('BRENT')) {
      basePrice = 92.57;
      name = 'Brent Global Benchmark Crude Oil';
    } else if (cleanSym === 'EUR/USD' || cleanSym === 'EURUSD') {
      basePrice = 1.0968;
      name = 'Euro / US Dollar FX Spot';
    } else if (cleanSym === 'GBP/USD' || cleanSym === 'GBPUSD') {
      basePrice = 1.3086;
      name = 'British Pound / US Dollar FX Spot';
    } else if (cleanSym === 'USD/JPY' || cleanSym === 'USDJPY') {
      basePrice = 158.56;
      name = 'US Dollar / Japanese Yen FX Spot';
    } else if (cleanSym === 'NIFTY 50' || cleanSym === 'NIFTY') {
      basePrice = 25800.60;
      name = 'NSE NIFTY 50 Benchmark Index';
    } else if (cleanSym.includes('RELIANCE')) {
      basePrice = 1265.40;
      name = 'Reliance Industries Ltd (NSE)';
    } else if (cleanSym === 'NVDA') {
      basePrice = 142.80;
      name = 'NVIDIA Corporation (NASDAQ)';
    } else if (cleanSym === 'AAPL') {
      basePrice = 228.50;
      name = 'Apple Inc. (NASDAQ)';
    } else if (cleanSym === 'TSLA') {
      basePrice = 345.20;
      name = 'Tesla, Inc. (NASDAQ)';
    } else if (cleanSym === 'MSFT') {
      basePrice = 422.30;
      name = 'Microsoft Corporation (NASDAQ)';
    } else if (cleanSym === 'AMD') {
      basePrice = 138.90;
      name = 'Advanced Micro Devices (NASDAQ)';
    }

    // Decimal precision logic
    const isFxFourDec = assetClass === 'FOREX' && !cleanSym.includes('JPY');
    const roundPrice = (val: number) => isFxFourDec ? Math.round(val * 100000) / 100000 : Math.round(val * 100) / 100;

    const changeDirection = chatTranscript.consensusSentiment === 'BULLISH' ? 1 : chatTranscript.consensusSentiment === 'BEARISH' ? -1 : 0.2;
    const changePercent = Number((changeDirection * (chatTranscript.consensusStrengthPercent / 45)).toFixed(2));
    const change = roundPrice(basePrice * (changePercent / 100));

    const pricing: LocalizedPricing = {
      currentPrice: roundPrice(basePrice),
      currency,
      dayHigh: roundPrice(basePrice * 1.015),
      dayLow: roundPrice(basePrice * 0.985),
      openPrice: roundPrice(basePrice - change),
      prevClose: roundPrice(basePrice - change),
      change,
      changePercent,
      bid: roundPrice(basePrice - 0.05),
      ask: roundPrice(basePrice + 0.05),
      spreadPipsOrTicks: isFxFourDec ? 0.00012 : 0.05,
    };

    const volume: VolumeBenchmarks = {
      currentVolume: chatTranscript.totalMessages * 10000,
      avgVolume20Day: 85000,
      avgVolume50Day: 80000,
      volumeSurgeRatio: Number((chatTranscript.chatVelocityScore / 50).toFixed(2)),
      volumeTrend: chatTranscript.chatVelocityScore > 75 ? 'ABOVE_AVERAGE' : 'NORMAL',
    };

    const volatility: VolatilityBenchmarks = {
      atr14: roundPrice(basePrice * 0.015),
      atrPercent: 1.5,
      betaVsBenchmark: 1.15,
      historicalVol30d: 22.4,
      optionsImpliedVol: 28.5,
      optionsIVRank: 52,
    };

    const macro: MacroeconomicBenchmarks = {
      centralBankStance: 'NEUTRAL',
      policyInterestRate: 5.25,
      realYield10Y: 1.95,
      cpiInflationYoY: 2.7,
      dxyIndex: 104.2,
      putCallRatio: 0.95,
    };

    const brief: DiscoveryBrief = {
      symbol: cleanSym,
      name,
      assetClass,
      benchmarkIndex: benchmark,
      timestamp: now,
      pricing,
      volume,
      volatility,
      macro,
      chatTranscript,
      summary: `[COMMUNITY CHAT DISCOVERY BRIEF] ${cleanSym} (${name}): ${chatTranscript.totalMessages} live messages buffered (${chatTranscript.consensusSentiment} bias, ${chatTranscript.consensusStrengthPercent}% consensus strength, velocity score ${chatTranscript.chatVelocityScore}/100). Dominant themes: ${chatTranscript.dominantThemes.join(', ')}. Stream of raw community chat messages serves as sole input payload for 5-stage research pipeline.`,
    };

    this.briefCache.set(cleanSym, brief);
    return brief;
  }

  public getCachedBrief(symbol: string): DiscoveryBrief | undefined {
    return this.briefCache.get(symbol.toUpperCase().trim());
  }
}

export const discoveryBriefCompiler = DiscoveryBriefCompiler.getInstance();
