/**
 * lib/research/CommunityChatEngine.ts
 * Real-Time TradingView-Style Community Live Chat Engine.
 * 
 * Replaces external continuous WebSocket and API market data ingestion with a community
 * live chat transcript buffer that serves as the sole input payload passed into the
 * five-stage sequential multi-agent research orchestration layer.
 */

import { CommunityChatMessage, CommunityChatTranscript, AssetClass } from './types';

export interface LiveChatSyncTelemetry {
  livePrice: number;
  changePercent?: number;
  timeframe?: string;
  rsi14?: number;
  ema20?: number;
  ema50?: number;
  macdHistogram?: number;
  atr14?: number;
  assetClass?: AssetClass;
}

export class CommunityChatEngine {
  private static instance: CommunityChatEngine;
  
  // Buffered transcripts keyed by normalized symbol
  private chatBuffers: Map<string, CommunityChatMessage[]> = new Map();
  private listeners: Set<(message: CommunityChatMessage) => void> = new Set();
  private lastSyncedPriceBySymbol: Map<string, number> = new Map();

  private constructor() {
    this.seedDefaultChatBuffers();
  }

  private getPriceDecimals(symbol: string, assetClass?: AssetClass): number {
    const clean = symbol.toUpperCase();
    if (clean.includes('JPY') || clean.includes('XAG')) return 3;
    if (clean.includes('COPPER')) return 4;
    if (assetClass === 'FOREX' || (!assetClass && /^(EUR|GBP|AUD|NZD|USD)\/(USD|CAD|CHF|GBP|JPY)/.test(clean))) return 5;
    return 2;
  }

  private fmtP(val: number, symbol: string, assetClass?: AssetClass): string {
    const dec = this.getPriceDecimals(symbol, assetClass);
    return Number.isFinite(val) ? val.toFixed(dec) : '0.00';
  }

  /**
   * Synchronizes a symbol's community chat stream strictly to active Chart.js live price,
   * technical indicators, and timeframe while preserving any trader-posted messages.
   */
  public syncWithLiveTelemetry(rawSymbol: string, ctx: LiveChatSyncTelemetry): void {
    const cleanSym = this.canonicalizeSymbol(rawSymbol);
    const tickerTag = this.normalizeTickerTag(cleanSym);
    const price = ctx.livePrice;
    if (!Number.isFinite(price) || price <= 0) return;

    this.lastSyncedPriceBySymbol.set(cleanSym, price);
    const tf = (ctx.timeframe || '1h').toUpperCase();
    const ema20 = ctx.ema20 ?? price;
    const ema50 = ctx.ema50 ?? price;
    const rsi14 = ctx.rsi14 ?? 50;
    const macdHist = ctx.macdHistogram ?? 0;
    const changePct = ctx.changePercent ?? 0;
    const atr = Math.max(ctx.atr14 || price * 0.012, price * 0.0015);
    const fmt = (v: number) => this.fmtP(v, cleanSym, ctx.assetClass);

    const bullPts =
      (price >= ema20 ? 1 : -1) +
      (ema20 >= ema50 ? 1 : -1) +
      (rsi14 >= 53 ? 1 : rsi14 <= 46 ? -1 : 0) +
      (macdHist > 0 ? 1 : macdHist < 0 ? -1 : 0) +
      (changePct >= 0.3 ? 1 : changePct <= -0.3 ? -1 : 0);

    const s1 = fmt(price - atr * 1.15);
    const s2 = fmt(price - atr * 2.25);
    const r1 = fmt(price + atr * 1.35);
    const r2 = fmt(price + atr * 2.65);

    const isBull = bullPts >= 2;
    const isBear = bullPts <= -2;
    const now = Date.now();

    const liveSystemMessages: CommunityChatMessage[] = isBull
      ? [
          {
            id: `seed_live_${cleanSym}_1`,
            username: 'QuantumAlpha',
            badge: 'PRO TRADER',
            ticker: cleanSym,
            tickerTag,
            text: `${tickerTag} (${tf}) trading above EMA-20 (${fmt(ema20)}) at ${fmt(price)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%). Support holding at ${s1}, breakout target ${r1} -> ${r2}.`,
            timestamp: now - 180000,
            formattedTime: '3m ago',
            sentiment: 'BULLISH',
            likes: 18,
          },
          {
            id: `seed_live_${cleanSym}_2`,
            username: 'ApexFlows',
            badge: 'ALGO SCALPER',
            ticker: cleanSym,
            tickerTag,
            text: `Order flow absorption detected on ${tf} above ${s1}. Momentum RSI-14 at ${rsi14.toFixed(1)} with positive MACD trend supporting continuation.`,
            timestamp: now - 120000,
            formattedTime: '2m ago',
            sentiment: 'BULLISH',
            likes: 14,
          },
          {
            id: `seed_live_${cleanSym}_3`,
            username: 'MacroVance',
            badge: 'MACRO ANALYST',
            ticker: cleanSym,
            tickerTag,
            text: `Growth & valuation multiples remain supportive relative to sector benchmarks. Keep disciplined stop loss below ${s2} if volatility widens.`,
            timestamp: now - 75000,
            formattedTime: '1m ago',
            sentiment: 'BULLISH',
            likes: 21,
          },
          {
            id: `seed_live_${cleanSym}_4`,
            username: 'RiskWatchDesk',
            badge: 'CHARTIST',
            ticker: cleanSym,
            tickerTag,
            text: `Watching resistance cluster around ${r1}. If RSI pushes overbought >72, trim partial position ahead of ${r2}.`,
            timestamp: now - 30000,
            formattedTime: 'Live',
            sentiment: 'NEUTRAL',
            likes: 9,
          },
        ]
      : isBear
      ? [
          {
            id: `seed_live_${cleanSym}_1`,
            username: 'BearishSentinel',
            badge: 'CHARTIST',
            ticker: cleanSym,
            tickerTag,
            text: `${tickerTag} (${tf}) losing structure below EMA-20 (${fmt(ema20)}) at ${fmt(price)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%). Resistance capping rallies at ${r1}; next support test at ${s1}.`,
            timestamp: now - 180000,
            formattedTime: '3m ago',
            sentiment: 'BEARISH',
            likes: 19,
          },
          {
            id: `seed_live_${cleanSym}_2`,
            username: 'AlgoRiskDesk',
            badge: 'ALGO SCALPER',
            ticker: cleanSym,
            tickerTag,
            text: `Negative MACD histogram (${macdHist.toFixed(4)}) and soft RSI-14 (${rsi14.toFixed(1)}) confirm distribution pressure. Bearish target zone ${s1} -> ${s2}.`,
            timestamp: now - 120000,
            formattedTime: '2m ago',
            sentiment: 'BEARISH',
            likes: 15,
          },
          {
            id: `seed_live_${cleanSym}_3`,
            username: 'MacroHedge',
            badge: 'MACRO ANALYST',
            ticker: cleanSym,
            tickerTag,
            text: `Tighten risk caps and enforce invalidation stops above ${r1} / ${r2}. Elevated downside volatility warns against premature long exposure.`,
            timestamp: now - 70000,
            formattedTime: '1m ago',
            sentiment: 'BEARISH',
            likes: 12,
          },
          {
            id: `seed_live_${cleanSym}_4`,
            username: 'LiquidityWatch',
            badge: 'PRO TRADER',
            ticker: cleanSym,
            tickerTag,
            text: `Tracking potential liquidity sweep around ${s1}. Reclaiming ${fmt(ema20)} on ${tf} close would shift bias back to neutral.`,
            timestamp: now - 25000,
            formattedTime: 'Live',
            sentiment: 'NEUTRAL',
            likes: 7,
          },
        ]
      : [
          {
            id: `seed_live_${cleanSym}_1`,
            username: 'StructureScanner',
            badge: 'CHARTIST',
            ticker: cleanSym,
            tickerTag,
            text: `${tickerTag} (${tf}) consolidating in balanced equilibrium near ${fmt(price)} (EMA-20: ${fmt(ema20)}, RSI-14: ${rsi14.toFixed(1)}). Range bounded by ${s1} and ${r1}.`,
            timestamp: now - 160000,
            formattedTime: '2m ago',
            sentiment: 'NEUTRAL',
            likes: 11,
          },
          {
            id: `seed_live_${cleanSym}_2`,
            username: 'BullionDesk',
            badge: 'PRO TRADER',
            ticker: cleanSym,
            tickerTag,
            text: `Buyers defending ${s1} liquidity shelf cleanly. A confirmed breakout above ${r1} targets ${r2}.`,
            timestamp: now - 105000,
            formattedTime: '1m ago',
            sentiment: 'BULLISH',
            likes: 10,
          },
          {
            id: `seed_live_${cleanSym}_3`,
            username: 'DeltaHedger',
            badge: 'ALGO SCALPER',
            ticker: cleanSym,
            tickerTag,
            text: `Upside capped near ${r1} while MACD momentum remains flat (${macdHist.toFixed(4)}). Stop loss discipline around ${s2} or ${r1} recommended.`,
            timestamp: now - 45000,
            formattedTime: 'Live',
            sentiment: 'BEARISH',
            likes: 10,
          },
        ];

    // Preserve any messages explicitly posted by users or dynamic runtime dispatches (non-seed_live_ messages)
    const existing = this.chatBuffers.get(cleanSym) || [];
    const customMessages = existing.filter((m) => !m.id.startsWith('seed_live_') && !m.id.startsWith('msg_') && !m.id.startsWith('dyn_'));
    this.chatBuffers.set(cleanSym, [...liveSystemMessages, ...customMessages]);
  }

  public static getInstance(): CommunityChatEngine {
    if (!CommunityChatEngine.instance) {
      CommunityChatEngine.instance = new CommunityChatEngine();
    }
    return CommunityChatEngine.instance;
  }

  /**
   * Normalizes any exchange-prefixed or alias symbol (e.g. 'NASDAQ:NVDA' -> 'NVDA', 'OANDA:XAUUSD' -> 'XAU/USD')
   */
  public canonicalizeSymbol(symbol: string): string {
    const clean = (symbol || 'NVDA').toUpperCase().trim().replace(/^\$/, '');
    const alias: Record<string, string> = {
      'NASDAQ:NVDA': 'NVDA',
      'NVIDIA': 'NVDA',
      'OANDA:XAUUSD': 'XAU/USD',
      'XAUUSD': 'XAU/USD',
      'GOLD': 'XAU/USD',
      'FX:EURUSD': 'EUR/USD',
      'OANDA:EURUSD': 'EUR/USD',
      'EURUSD': 'EUR/USD',
      'OANDA:XAGUSD': 'XAG/USD',
      'XAGUSD': 'XAG/USD',
      'FX:GBPUSD': 'GBP/USD',
      'GBPUSD': 'GBP/USD',
      'FX:USDJPY': 'USD/JPY',
      'USDJPY': 'USD/JPY',
      'NSE:NIFTY': 'NIFTY 50',
      'NIFTY': 'NIFTY 50',
      'NSE:BANKNIFTY': 'BANK NIFTY',
      'BANKNIFTY': 'BANK NIFTY',
      'NSE:RELIANCE': 'RELIANCE',
      'NSE:HDFCBANK': 'HDFC BANK',
    };
    if (alias[clean]) return alias[clean];
    if (clean.includes(':')) return clean.split(':')[1] || clean;
    return clean;
  }

  /**
   * Helper to normalize symbol to tag, e.g. 'NVDA' -> '$NVDA', 'XAU/USD' -> '$XAUUSD'
   */
  public normalizeTickerTag(symbol: string): string {
    const canonical = this.canonicalizeSymbol(symbol);
    const clean = canonical.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return `$${clean}`;
  }

  /**
   * Dispatches a new user message into the real-time community chat buffer
   */
  public dispatchUserMessage(params: {
    symbol: string;
    text?: string;
    message?: string;
    sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    username?: string;
    badge?: CommunityChatMessage['badge'];
    badges?: any[];
  }): CommunityChatMessage {
    const cleanSym = this.canonicalizeSymbol(params.symbol);
    const tickerTag = this.normalizeTickerTag(cleanSym);
    const now = Date.now();
    const textContent = params.text || params.message || '';

    // Auto-detect sentiment from linguistic tone if not explicitly provided
    let sentiment = params.sentiment;
    if (!sentiment) {
      const lower = textContent.toLowerCase();
      if (lower.includes('buy') || lower.includes('bull') || lower.includes('moon') || lower.includes('long') || lower.includes('breakout') || lower.includes('support holds')) {
        sentiment = 'BULLISH';
      } else if (lower.includes('sell') || lower.includes('bear') || lower.includes('short') || lower.includes('dump') || lower.includes('breakdown') || lower.includes('resistance reject')) {
        sentiment = 'BEARISH';
      } else {
        sentiment = 'NEUTRAL';
      }
    }

    const assignedBadge: CommunityChatMessage['badge'] = 
      params.badge || (params.badges && params.badges[0]) || 'PRO TRADER';

    const newMessage: CommunityChatMessage = {
      id: `chat_${cleanSym}_${now}_${Math.floor(Math.random() * 1000)}`,
      username: params.username || 'You (Trader)',
      badge: assignedBadge,
      ticker: cleanSym,
      tickerTag,
      text: textContent,
      timestamp: now,
      formattedTime: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sentiment,
      likes: 1,
    };

    const currentList = this.chatBuffers.get(cleanSym) || [];
    this.chatBuffers.set(cleanSym, [...currentList, newMessage]);

    // Notify live subscribers
    this.listeners.forEach(fn => fn(newMessage));

    return newMessage;
  }

  /**
   * Subscribes to live incoming community messages
   */
  public subscribeMessages(listener: (message: CommunityChatMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Retrieves all buffered chat messages for a symbol or filtered by tag
   */
  public getMessagesForSymbol(symbol: string, tagFilter?: string): CommunityChatMessage[] {
    const cleanSym = this.canonicalizeSymbol(symbol);
    let msgs: CommunityChatMessage[] = [];
    
    if (this.chatBuffers.has(cleanSym)) {
      msgs = this.chatBuffers.get(cleanSym)!;
    } else {
      let matched = false;
      for (const [key, list] of this.chatBuffers.entries()) {
        if (key === cleanSym || this.normalizeTickerTag(key) === this.normalizeTickerTag(cleanSym)) {
          msgs = list;
          matched = true;
          break;
        }
      }
      if (!matched) {
        msgs = this.generateDynamicSeedForSymbol(cleanSym);
        this.chatBuffers.set(cleanSym, msgs);
      }
    }

    if (tagFilter && tagFilter !== 'ALL') {
      const cleanTag = tagFilter.startsWith('$') ? tagFilter : `$${tagFilter}`;
      return msgs.filter(m => 
        m.tickerTag.toUpperCase() === cleanTag.toUpperCase() || 
        m.text.toUpperCase().includes(cleanTag.toUpperCase())
      );
    }

    return msgs;
  }

  /**
   * Compiles the buffered chat transcript into the primary input payload for the multi-agent pipeline
   */
  public getBufferedTranscript(symbol: string, livePriceHint?: number): CommunityChatTranscript {
    const cleanSym = this.canonicalizeSymbol(symbol);
    const tickerTag = this.normalizeTickerTag(cleanSym);
    const messages = this.getMessagesForSymbol(cleanSym);

    const bullishCount = messages.filter(m => m.sentiment === 'BULLISH').length;
    const bearishCount = messages.filter(m => m.sentiment === 'BEARISH').length;
    const neutralCount = messages.filter(m => m.sentiment === 'NEUTRAL').length;
    const total = messages.length || 1;

    let consensusSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let consensusStrengthPercent = 50;

    if (bullishCount > bearishCount * 1.3) {
      consensusSentiment = 'BULLISH';
      consensusStrengthPercent = Math.min(95, Math.round((bullishCount / total) * 100));
    } else if (bearishCount > bullishCount * 1.3) {
      consensusSentiment = 'BEARISH';
      consensusStrengthPercent = Math.min(95, Math.round((bearishCount / total) * 100));
    } else {
      consensusSentiment = 'NEUTRAL';
      consensusStrengthPercent = 52;
    }

    // Extract dominant linguistic themes from chat text
    const dominantThemes = this.extractDominantThemes(messages);

    // Extract community-cited numeric levels calibrated strictly around the live chart price
    const effectiveHint = livePriceHint ?? this.lastSyncedPriceBySymbol.get(cleanSym);
    const extractedPriceLevels = this.extractCommunityPriceLevels(messages, cleanSym, effectiveHint);

    return {
      symbol: cleanSym,
      tickerTag,
      messages,
      totalMessages: messages.length,
      bullishCount,
      bearishCount,
      neutralCount,
      consensusSentiment,
      consensusStrengthPercent,
      chatVelocityScore: Math.min(98, 65 + (messages.length * 3)),
      dominantThemes,
      extractedPriceLevels,
      timestamp: Date.now(),
    };
  }

  /**
   * Linguistic Theme Extractor
   */
  private extractDominantThemes(messages: CommunityChatMessage[]): string[] {
    const fullText = messages.map(m => m.text).join(' ').toLowerCase();
    const themes: string[] = [];

    if (fullText.includes('ema') || fullText.includes('golden cross') || fullText.includes('death cross')) {
      themes.push('Moving Average Structure');
    }
    if (fullText.includes('support') || fullText.includes('resistance') || fullText.includes('level') || fullText.includes('breakout')) {
      themes.push('Key S/R Confluence & Breakouts');
    }
    if (fullText.includes('earnings') || fullText.includes('revenue') || fullText.includes('growth') || fullText.includes('guidance')) {
      themes.push('Earnings & Growth Expectations');
    }
    if (fullText.includes('valuation') || fullText.includes('p/e') || fullText.includes('multiples') || fullText.includes('cheap')) {
      themes.push('Valuation Multiples Debate');
    }
    if (fullText.includes('whale') || fullText.includes('institution') || fullText.includes('13f') || fullText.includes('smart money')) {
      themes.push('Institutional Smart Money Flows');
    }
    if (fullText.includes('short') || fullText.includes('squeeze') || fullText.includes('fomo')) {
      themes.push('Short Squeeze & Asymmetry');
    }
    if (fullText.includes('risk') || fullText.includes('stop loss') || fullText.includes('drawdown') || fullText.includes('volatility')) {
      themes.push('Downside Risk Management');
    }
    if (fullText.includes('catalyst') || fullText.includes('launch') || fullText.includes('fed') || fullText.includes('rate')) {
      themes.push('Upcoming Macro & Corporate Catalysts');
    }

    if (themes.length === 0) {
      themes.push('Consensus Momentum', 'Trend Extension');
    }

    return themes;
  }

  /**
   * Community-Cited Price Levels Extractor
   */
  private extractCommunityPriceLevels(messages: CommunityChatMessage[], symbol: string, livePriceHint?: number): {
    supports: number[];
    resistances: number[];
    entryZone?: { min: number; max: number };
    stopLoss?: number;
    targets?: number[];
  } {
    const fullText = messages.map(m => m.text).join(' ');
    const numberMatches = fullText.match(/\$?\b\d+(\.\d{1,5})?\b/g) || [];
    const validNums = numberMatches
      .map(n => parseFloat(n.replace('$', '')))
      .filter(n => Number.isFinite(n) && n > 0 && n < 1000000);

    // Anchor around live chart price when available; otherwise sensible market baseline
    let anchorBase = livePriceHint && livePriceHint > 0 ? livePriceHint : 155.0;
    if (!livePriceHint || livePriceHint <= 0) {
      if (symbol.includes('XAU')) anchorBase = 3536.0;
      else if (symbol.includes('XAG')) anchorBase = 41.2;
      else if (symbol.includes('EUR')) anchorBase = 1.0958;
      else if (symbol.includes('GBP')) anchorBase = 1.3086;
      else if (symbol.includes('JPY')) anchorBase = 158.56;
      else if (symbol.includes('NIFTY')) anchorBase = 25350.0;
      else if (symbol.includes('RELIANCE')) anchorBase = 1351.0;
      else if (symbol.includes('TSLA')) anchorBase = 345.0;
      else if (symbol.includes('AAPL')) anchorBase = 228.5;
    }

    const nearbyNums = Array.from(
      new Set(validNums.filter(n => Math.abs(n - anchorBase) / anchorBase < 0.12))
    ).sort((a, b) => a - b);

    const supports = nearbyNums.filter(n => n < anchorBase * 0.999).slice(-3).reverse();
    const resistances = nearbyNums.filter(n => n > anchorBase * 1.001).slice(0, 3);

    const finalSupports = [
      supports[0] ?? anchorBase * 0.988,
      supports[1] ?? anchorBase * 0.976,
      supports[2] ?? anchorBase * 0.962,
    ];
    const finalResistances = [
      resistances[0] ?? anchorBase * 1.015,
      resistances[1] ?? anchorBase * 1.032,
      resistances[2] ?? anchorBase * 1.050,
    ];

    return {
      supports: finalSupports,
      resistances: finalResistances,
      entryZone: { min: anchorBase * 0.996, max: anchorBase * 1.002 },
      stopLoss: finalSupports[0] * 0.994,
      targets: finalResistances,
    };
  }

  /**
   * Seed authentic TradingView-style community chat streams for major tickers
   */
  private seedDefaultChatBuffers() {
    // 1. $NVDA Community Chat Room
    this.chatBuffers.set('NVDA', [
      {
        id: 'msg_nvda_1',
        username: 'QuantumAlpha',
        badge: 'PRO TRADER',
        ticker: 'NVDA',
        tickerTag: '$NVDA',
        text: '$NVDA retested the 50-day EMA near $138.50 and printed a massive rejection wick. Clean bull flag on the 4H chart. Looking for a breakout above $145.20 resistance.',
        timestamp: Date.now() - 320000,
        formattedTime: '5m ago',
        sentiment: 'BULLISH',
        likes: 14,
      },
      {
        id: 'msg_nvda_2',
        username: 'MacroVance',
        badge: 'MACRO ANALYST',
        ticker: 'NVDA',
        tickerTag: '$NVDA',
        text: 'Blackwell chip architecture guidance expected to accelerate data center CAPEX by 34% YoY. Valuation at 28x forward P/E is surprisingly fair given 50%+ gross margins.',
        timestamp: Date.now() - 260000,
        formattedTime: '4m ago',
        sentiment: 'BULLISH',
        likes: 21,
      },
      {
        id: 'msg_nvda_3',
        username: 'BearishSentinel',
        badge: 'CHARTIST',
        ticker: 'NVDA',
        tickerTag: '$NVDA',
        text: 'Watch out for RSI-14 bearish divergence on the daily time frame. If tech broad indices reject $144.80, downside risk extends to $136.00 gap fill.',
        timestamp: Date.now() - 210000,
        formattedTime: '3m ago',
        sentiment: 'BEARISH',
        likes: 8,
      },
      {
        id: 'msg_nvda_4',
        username: 'ApexFlows',
        badge: 'ALGO SCALPER',
        ticker: 'NVDA',
        tickerTag: '$NVDA',
        text: 'Large institutional dark pool prints detected at $141.80. Smart money absorption confirms higher lows. Stop loss tightly placed below $139.50.',
        timestamp: Date.now() - 150000,
        formattedTime: '2m ago',
        sentiment: 'BULLISH',
        likes: 19,
      },
      {
        id: 'msg_nvda_5',
        username: 'SiliconValleyHodl',
        badge: 'COMMUNITY',
        ticker: 'NVDA',
        tickerTag: '$NVDA',
        text: 'Upcoming hyperscaler earnings from MSFT, GOOGL, META will confirm continued AI compute cluster buildout. Conviction is high for $155+ quarterly target.',
        timestamp: Date.now() - 60000,
        formattedTime: '1m ago',
        sentiment: 'BULLISH',
        likes: 27,
      },
    ]);

    // 2. $XAUUSD (Spot Gold) Community Chat Room
    this.chatBuffers.set('XAU/USD', [
      {
        id: 'msg_gold_1',
        username: 'BullionKing',
        badge: 'MACRO ANALYST',
        ticker: 'XAU/USD',
        tickerTag: '$XAUUSD',
        text: '$XAUUSD holding firmly above $3525 institutional support. Central bank de-dollarization and geopolitical hedging creating persistent buying pressure on dips.',
        timestamp: Date.now() - 350000,
        formattedTime: '6m ago',
        sentiment: 'BULLISH',
        likes: 18,
      },
      {
        id: 'msg_gold_2',
        username: 'LondonFixTrader',
        badge: 'PRO TRADER',
        ticker: 'XAU/USD',
        tickerTag: '$XAUUSD',
        text: 'Clean liquidity sweep of retail stop losses at $3532.50. High volume absorption on LBMA speed wires. First upside target $3555, runner to $3580.',
        timestamp: Date.now() - 280000,
        formattedTime: '4m ago',
        sentiment: 'BULLISH',
        likes: 24,
      },
      {
        id: 'msg_gold_3',
        username: 'RateHikeHawk',
        badge: 'CHARTIST',
        ticker: 'XAU/USD',
        tickerTag: '$XAUUSD',
        text: 'Be cautious of DXY bounce around 104.20. Real yields are edging higher which could cap upside near $3550 resistance zone.',
        timestamp: Date.now() - 180000,
        formattedTime: '3m ago',
        sentiment: 'NEUTRAL',
        likes: 9,
      },
      {
        id: 'msg_gold_4',
        username: 'GoldScalpPro',
        badge: 'ALGO SCALPER',
        ticker: 'XAU/USD',
        tickerTag: '$XAUUSD',
        text: 'Order flow shows resting ask wall at $3545 being chipped away by aggressive market buy orders. Delta cumulative volume is strongly positive.',
        timestamp: Date.now() - 90000,
        formattedTime: '1m ago',
        sentiment: 'BULLISH',
        likes: 15,
      },
    ]);

    // 3. $EURUSD (Forex) Community Chat Room
    this.chatBuffers.set('EUR/USD', [
      {
        id: 'msg_eur_1',
        username: 'EuroFXMaster',
        badge: 'PRO TRADER',
        ticker: 'EUR/USD',
        tickerTag: '$EURUSD',
        text: '$EURUSD rejecting the 1.0980 resistance band. ECB policy rate cuts diverging from Fed high-for-longer stance is creating downside momentum.',
        timestamp: Date.now() - 400000,
        formattedTime: '7m ago',
        sentiment: 'BEARISH',
        likes: 12,
      },
      {
        id: 'msg_eur_2',
        username: 'PipsHunter',
        badge: 'ALGO SCALPER',
        ticker: 'EUR/USD',
        tickerTag: '$EURUSD',
        text: 'Bearish engulfing candle on 1H at 1.0970. Key support sitting at 1.0910. Placing stop loss 15 pips above recent swing high at 1.0985.',
        timestamp: Date.now() - 220000,
        formattedTime: '3m ago',
        sentiment: 'BEARISH',
        likes: 16,
      },
      {
        id: 'msg_eur_3',
        username: 'GermanYields',
        badge: 'MACRO ANALYST',
        ticker: 'EUR/USD',
        tickerTag: '$EURUSD',
        text: 'Eurozone manufacturing PMI print came in soft at 46.2. Terms of trade softening. Consensus among institutional desks is leaning short.',
        timestamp: Date.now() - 120000,
        formattedTime: '2m ago',
        sentiment: 'BEARISH',
        likes: 14,
      },
    ]);

    // 4. $NIFTY50 (Indian Market) Community Chat Room
    this.chatBuffers.set('NIFTY 50', [
      {
        id: 'msg_nifty_1',
        username: 'DalalStreetAlpha',
        badge: 'PRO TRADER',
        ticker: 'NIFTY 50',
        tickerTag: '$NIFTY',
        text: '$NIFTY 50 comfortably holding above 25,750 base. DII net inflows of ₹2,450 Cr completely absorbing FII profit booking. Trend remains higher highs.',
        timestamp: Date.now() - 380000,
        formattedTime: '6m ago',
        sentiment: 'BULLISH',
        likes: 31,
      },
      {
        id: 'msg_nifty_2',
        username: 'SensexGuru',
        badge: 'CHARTIST',
        ticker: 'NIFTY 50',
        tickerTag: '$NIFTY',
        text: 'Nifty Bank and IT index both displaying bullish EMA crossover. Resistance at 25,950 followed by psychological target 26,200.',
        timestamp: Date.now() - 240000,
        formattedTime: '4m ago',
        sentiment: 'BULLISH',
        likes: 22,
      },
      {
        id: 'msg_nifty_3',
        username: 'IndiaMacroPulse',
        badge: 'MACRO ANALYST',
        ticker: 'NIFTY 50',
        tickerTag: '$NIFTY',
        text: 'GDP growth projected at 7.2%, inflation well within RBI tolerance band. Corporate earnings CAGR robust across private banks and infrastructure.',
        timestamp: Date.now() - 110000,
        formattedTime: '1m ago',
        sentiment: 'BULLISH',
        likes: 28,
      },
    ]);

    // 5. $TSLA Community Chat Room
    this.chatBuffers.set('TSLA', [
      {
        id: 'msg_tsla_1',
        username: 'AutopilotVision',
        badge: 'PRO TRADER',
        ticker: 'TSLA',
        tickerTag: '$TSLA',
        text: '$TSLA breaking above the 200 EMA with expanding volume. Cybercab regulatory approval timeline advancing in multiple states.',
        timestamp: Date.now() - 310000,
        formattedTime: '5m ago',
        sentiment: 'BULLISH',
        likes: 19,
      },
      {
        id: 'msg_tsla_2',
        username: 'EVValuationWatcher',
        badge: 'CHARTIST',
        ticker: 'TSLA',
        tickerTag: '$TSLA',
        text: 'Short squeeze setup developing. Short interest is 3.4% of float with days to cover at 1.8. Target 1 at $228, invalidation below $208.',
        timestamp: Date.now() - 180000,
        formattedTime: '3m ago',
        sentiment: 'BULLISH',
        likes: 15,
      },
    ]);
  }

  /**
   * Generates dynamic high-quality seed messages for any arbitrary symbol
   */
  private generateDynamicSeedForSymbol(symbol: string): CommunityChatMessage[] {
    const cleanSym = symbol.toUpperCase().trim();
    const tag = this.normalizeTickerTag(cleanSym);
    const now = Date.now();

    return [
      {
        id: `dyn_${cleanSym}_1`,
        username: 'ChartMaster99',
        badge: 'CHARTIST',
        ticker: cleanSym,
        tickerTag: tag,
        text: `${tag} testing key confluence structure on the 1-hour chart. Volume profile shows high liquidity node absorbing pullbacks.`,
        timestamp: now - 360000,
        formattedTime: '6m ago',
        sentiment: 'BULLISH',
        likes: 11,
      },
      {
        id: `dyn_${cleanSym}_2`,
        username: 'MacroAlphaDesk',
        badge: 'MACRO ANALYST',
        ticker: cleanSym,
        tickerTag: tag,
        text: `Fundamental catalysts aligning for ${tag}. Sector rotation data favors leading momentum plays with strong pricing power.`,
        timestamp: now - 240000,
        formattedTime: '4m ago',
        sentiment: 'BULLISH',
        likes: 17,
      },
      {
        id: `dyn_${cleanSym}_3`,
        username: 'RiskFirstTrader',
        badge: 'PRO TRADER',
        ticker: cleanSym,
        tickerTag: tag,
        text: `Tighten invalidation stops for ${tag}. As long as structural support holds, upside risk-to-reward is highly asymmetric.`,
        timestamp: now - 120000,
        formattedTime: '2m ago',
        sentiment: 'NEUTRAL',
        likes: 8,
      },
    ];
  }
}

export const communityChatEngine = CommunityChatEngine.getInstance();
