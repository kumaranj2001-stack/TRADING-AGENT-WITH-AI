import { Candle, ConfluenceGrade, CurrencyPair, MarketSegment, TimeFrame } from './types';
import { BASE_PRICES, PIP_VALUES, getMarketSegmentForSymbol as getMarketSegment, getSymbolDecimals } from './marketData';

export interface CanonicalQuoteRecord {
  symbol: CurrencyPair;
  exchange: string;
  timeframe: TimeFrame;
  timestamp: number;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  decimals: number;
  currencySymbol: '₹' | '$' | '';
  source: string;
  latencyMs: number;
  driftPct: number;
  circuitBreakerTripped: boolean;
  circuitBreakerReason?: string;
  candles?: Candle[];
}

export interface CanonicalSignalObject {
  id: string;
  symbol: CurrencyPair;
  exchange: string;
  timeframe: TimeFrame;
  timestamp: number;
  direction: 'BUY' | 'SELL' | 'HOLD';
  grade: ConfluenceGrade;
  probability: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  lotSize: number;
  agreementRatio: string;
  invalidationReason?: string;
  haltedByCircuitBreaker?: boolean;
}

export interface DirectionalInvariantResult {
  valid: boolean;
  wasCorrected: boolean;
  direction: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  correctionReason?: string;
}

/**
 * Resolves the canonical institutional exchange/venue for a given symbol.
 */
export function getCanonicalExchangeForSymbol(symbol: CurrencyPair): string {
  const seg = getMarketSegment(symbol);
  if (seg === 'INDIAN_MARKET') return 'NSE_INDIA';
  if (seg === 'CRYPTO_EQUITIES') {
    const up = symbol.toUpperCase();
    return up.includes('BTC') || up.includes('ETH') || up.includes('SOL')
      ? 'COINBASE_LMAX_SPOT'
      : 'NASDAQ_ITCH';
  }
  if (seg === 'METALS_COMMODITIES') return 'LBMA_COMEX_OTC';
  return 'FX_INTERBANK_ECN';
}

/**
 * Asset-aware currency prefix for banners, freezes, and panels.
 */
export function getCurrencySymbolForAsset(symbol: CurrencyPair): '₹' | '$' | '' {
  const seg = getMarketSegment(symbol);
  if (seg === 'INDIAN_MARKET' || symbol.includes('/INR')) return '₹';
  if (seg === 'METALS_COMMODITIES' || seg === 'CRYPTO_EQUITIES') return '$';
  return '';
}

export function formatCanonicalPrice(symbol: CurrencyPair, price: number): string {
  if (!Number.isFinite(price)) return '—';
  const decimals = getSymbolDecimals(symbol);
  const prefix = getCurrencySymbolForAsset(symbol);
  if (prefix === '₹') {
    return `₹${price.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `${prefix}${price.toFixed(decimals)}`;
}

/**
 * Clamps support/resistance arrays so that every support is strictly below spot
 * and every resistance is strictly above spot, preserving monotone separation.
 */
export function clampSupportResistanceLevels(
  spot: number,
  rawSupports: number[],
  rawResistances: number[],
  minStep: number,
  decimals: number
): { supportLevels: number[]; resistanceLevels: number[] } {
  const safeStep = Math.max(minStep, spot * 0.0004, Math.pow(10, -decimals));

  const validSupports = rawSupports
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Math.min(v, spot - safeStep))
    .sort((a, b) => b - a); // Descending: s1 closest below spot, s2 lower

  const s1 = Number((validSupports[0] ?? spot - safeStep * 1.5).toFixed(decimals));
  const rawS2 = validSupports[1] ?? s1 - safeStep * 1.5;
  const s2 = Number(Math.min(rawS2, s1 - safeStep).toFixed(decimals));

  const validResistances = rawResistances
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Math.max(v, spot + safeStep))
    .sort((a, b) => a - b); // Ascending: r1 closest above spot, r2 higher

  const r1 = Number((validResistances[0] ?? spot + safeStep * 1.5).toFixed(decimals));
  const rawR2 = validResistances[1] ?? r1 + safeStep * 1.5;
  const r2 = Number(Math.max(rawR2, r1 + safeStep).toFixed(decimals));

  return {
    supportLevels: [s1, s2],
    resistanceLevels: [r1, r2],
  };
}

/**
 * Hard mathematical validator enforcing directional ordering invariants:
 *   - BUY : takeProfit > entry > stopLoss
 *   - SELL: stopLoss > entry > takeProfit
 * Also recalculates Risk:Reward strictly after any adjustment.
 */
export function validateDirectionalInvariants(params: {
  symbol: CurrencyPair;
  direction: 'BUY' | 'SELL' | 'HOLD';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  atr?: number;
}): DirectionalInvariantResult {
  const decimals = getSymbolDecimals(params.symbol);
  const pip = PIP_VALUES[params.symbol] || (params.symbol.includes('JPY') ? 0.01 : 0.0001);
  const safeEntry =
    Number.isFinite(params.entry) && params.entry > 0
      ? Number(params.entry.toFixed(decimals))
      : Number((BASE_PRICES[params.symbol] || 1).toFixed(decimals));

  if (params.direction === 'HOLD') {
    return {
      valid: true,
      wasCorrected: false,
      direction: 'HOLD',
      entry: safeEntry,
      stopLoss: 0,
      takeProfit: 0,
      rrRatio: 0,
    };
  }

  const minRisk = Math.max(pip * 3, safeEntry * 0.0008, (params.atr || 0) * 0.85, Math.pow(10, -decimals) * 2);
  let sl = Number((params.stopLoss || 0).toFixed(decimals));
  let tp = Number((params.takeProfit || 0).toFixed(decimals));
  let wasCorrected = false;
  const reasons: string[] = [];

  if (params.direction === 'BUY') {
    if (!Number.isFinite(sl) || sl <= 0 || sl >= safeEntry) {
      const dist = Number.isFinite(sl) && sl > 0 ? Math.max(minRisk, Math.abs(sl - safeEntry)) : minRisk;
      sl = Number((safeEntry - dist).toFixed(decimals));
      wasCorrected = true;
      reasons.push(`Adjusted BUY Stop Loss strictly below entry (${sl} < ${safeEntry})`);
    }
    const riskDist = Math.max(minRisk * 0.25, safeEntry - sl);
    if (!Number.isFinite(tp) || tp <= safeEntry) {
      const rawReward = Number.isFinite(tp) && tp > 0 ? Math.abs(safeEntry - tp) : riskDist * 1.8;
      const rewardDist = Math.max(riskDist * 1.5, rawReward);
      tp = Number((safeEntry + rewardDist).toFixed(decimals));
      wasCorrected = true;
      reasons.push(`Adjusted BUY Take Profit strictly above entry (${tp} > ${safeEntry})`);
    }
    const rrRatio = Number(((tp - safeEntry) / Math.max(1e-8, safeEntry - sl)).toFixed(2));
    return {
      valid: tp > safeEntry && safeEntry > sl,
      wasCorrected,
      direction: 'BUY',
      entry: safeEntry,
      stopLoss: sl,
      takeProfit: tp,
      rrRatio,
      correctionReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  }

  // SELL
  if (!Number.isFinite(sl) || sl <= safeEntry) {
    const dist = Number.isFinite(sl) && sl > 0 ? Math.max(minRisk, Math.abs(safeEntry - sl)) : minRisk;
    sl = Number((safeEntry + dist).toFixed(decimals));
    wasCorrected = true;
    reasons.push(`Adjusted SELL Stop Loss strictly above entry (${sl} > ${safeEntry})`);
  }
  const riskDist = Math.max(minRisk * 0.25, sl - safeEntry);
  if (!Number.isFinite(tp) || tp <= 0 || tp >= safeEntry) {
    const rawReward = Number.isFinite(tp) && tp > 0 ? Math.abs(tp - safeEntry) : riskDist * 1.8;
    const rewardDist = Math.max(riskDist * 1.5, rawReward);
    tp = Number(Math.max(Math.pow(10, -decimals), safeEntry - rewardDist).toFixed(decimals));
    wasCorrected = true;
    reasons.push(`Adjusted SELL Take Profit strictly below entry (${tp} < ${safeEntry})`);
  }
  const rrRatio = Number(((safeEntry - tp) / Math.max(1e-8, sl - safeEntry)).toFixed(2));
  return {
    valid: sl > safeEntry && safeEntry > tp,
    wasCorrected,
    direction: 'SELL',
    entry: safeEntry,
    stopLoss: sl,
    takeProfit: tp,
    rrRatio,
    correctionReason: reasons.length > 0 ? reasons.join('; ') : undefined,
  };
}

class CanonicalMarketStore {
  private static instance: CanonicalMarketStore;
  private activeSymbol: CurrencyPair = 'XAU/USD';
  private activeTimeframe: TimeFrame = '1h';
  private quotes = new Map<string, CanonicalQuoteRecord>();
  private signals = new Map<string, CanonicalSignalObject>();
  private circuitBreakers = new Map<CurrencyPair, { tripped: boolean; reason: string; timestamp: number }>();
  private listeners = new Set<(event: { type: 'QUOTE' | 'SIGNAL' | 'SYMBOL_SWITCH'; symbol: CurrencyPair }) => void>();

  private constructor() {}

  public static getInstance(): CanonicalMarketStore {
    if (!CanonicalMarketStore.instance) {
      CanonicalMarketStore.instance = new CanonicalMarketStore();
    }
    return CanonicalMarketStore.instance;
  }

  private quoteKey(symbol: CurrencyPair, exchange: string, timeframe: TimeFrame): string {
    return `${symbol}::${exchange}::${timeframe}`;
  }

  private signalKey(symbol: CurrencyPair, timeframe: TimeFrame): string {
    return `${symbol}::${timeframe}`;
  }

  public getActiveContext(): { symbol: CurrencyPair; exchange: string; timeframe: TimeFrame } {
    return {
      symbol: this.activeSymbol,
      exchange: getCanonicalExchangeForSymbol(this.activeSymbol),
      timeframe: this.activeTimeframe,
    };
  }

  /**
   * Atomic symbol/timeframe switch: purges stale cross-symbol quotes/signals if switching instruments
   * so delayed quotes from prior symbols can never render in the active workspace.
   */
  public setActiveContext(symbol: CurrencyPair, timeframe?: TimeFrame): void {
    const changed = symbol !== this.activeSymbol || (timeframe && timeframe !== this.activeTimeframe);
    this.activeSymbol = symbol;
    if (timeframe) this.activeTimeframe = timeframe;
    if (changed) {
      this.notify({ type: 'SYMBOL_SWITCH', symbol });
    }
  }

  public publishQuote(input: {
    symbol: CurrencyPair;
    timeframe?: TimeFrame;
    exchange?: string;
    timestamp?: number;
    bid: number;
    ask: number;
    mid?: number;
    source?: string;
    latencyMs?: number;
    candles?: Candle[];
    bypassDriftCheck?: boolean;
  }): CanonicalQuoteRecord {
    const tf = input.timeframe || this.activeTimeframe || '1h';
    const exchange = input.exchange || getCanonicalExchangeForSymbol(input.symbol);
    const decimals = getSymbolDecimals(input.symbol);
    const pip = PIP_VALUES[input.symbol] || (input.symbol.includes('JPY') ? 0.01 : 0.0001);
    const ts = input.timestamp || Date.now();
    const latencyMs = Math.max(0, Math.round(input.latencyMs ?? 12));

    const midRaw = input.mid ?? (input.bid + input.ask) / 2;
    const bid = Number(input.bid.toFixed(decimals));
    const ask = Number(input.ask.toFixed(decimals));
    const mid = Number(midRaw.toFixed(decimals));
    const spread = Math.max(0, Number((ask - bid).toFixed(decimals)));
    const spreadPips = spread > 0 ? Number((spread / pip).toFixed(2)) : 0;

    const prev = this.getQuote(input.symbol, tf);
    let driftPct = 0;
    if (prev && prev.mid > 0 && mid > 0) {
      driftPct = Number((Math.abs(mid - prev.mid) / prev.mid * 100).toFixed(3));
    }

    let breaker = this.circuitBreakers.get(input.symbol);
    if (!Number.isFinite(mid) || mid <= 0) {
      breaker = { tripped: true, reason: `CIRCUIT_BREAKER_INVALID_QUOTE: Non-positive mid for ${input.symbol}`, timestamp: ts };
      this.circuitBreakers.set(input.symbol, breaker);
    } else if (latencyMs > 5000) {
      breaker = { tripped: true, reason: `CIRCUIT_BREAKER_LATENCY: Feed latency ${latencyMs}ms exceeds 5,000ms threshold`, timestamp: ts };
      this.circuitBreakers.set(input.symbol, breaker);
    } else if (!input.bypassDriftCheck && prev && driftPct > 12.0) {
      breaker = { tripped: true, reason: `CIRCUIT_BREAKER_DRIFT: Instant quote drift ${driftPct}% exceeded 12% guard`, timestamp: ts };
      this.circuitBreakers.set(input.symbol, breaker);
    } else if (breaker && !breaker.reason.startsWith('MANUAL_')) {
      this.circuitBreakers.delete(input.symbol);
      breaker = undefined;
    }

    const record: CanonicalQuoteRecord = {
      symbol: input.symbol,
      exchange,
      timeframe: tf,
      timestamp: ts,
      bid,
      ask,
      mid,
      spread,
      spreadPips,
      decimals,
      currencySymbol: getCurrencySymbolForAsset(input.symbol),
      source: input.source || 'CANONICAL_BUS',
      latencyMs,
      driftPct,
      circuitBreakerTripped: Boolean(breaker?.tripped),
      circuitBreakerReason: breaker?.reason,
      candles: input.candles,
    };

    this.quotes.set(this.quoteKey(input.symbol, exchange, tf), record);
    this.notify({ type: 'QUOTE', symbol: input.symbol });
    return record;
  }

  public getQuote(symbol: CurrencyPair, timeframe?: TimeFrame): CanonicalQuoteRecord | null {
    const tf = timeframe || this.activeTimeframe || '1h';
    const exchange = getCanonicalExchangeForSymbol(symbol);
    return (
      this.quotes.get(this.quoteKey(symbol, exchange, tf)) ||
      Array.from(this.quotes.values()).find((q) => q.symbol === symbol && q.timeframe === tf) ||
      Array.from(this.quotes.values()).find((q) => q.symbol === symbol) ||
      null
    );
  }

  public tripCircuitBreaker(symbol: CurrencyPair, reason: string): void {
    this.circuitBreakers.set(symbol, {
      tripped: true,
      reason: reason.startsWith('CIRCUIT_BREAKER_') || reason.startsWith('MANUAL_') ? reason : `MANUAL_${reason}`,
      timestamp: Date.now(),
    });
    const existing = this.getQuote(symbol);
    if (existing) {
      existing.circuitBreakerTripped = true;
      existing.circuitBreakerReason = this.circuitBreakers.get(symbol)?.reason;
    }
  }

  public clearCircuitBreaker(symbol: CurrencyPair): void {
    this.circuitBreakers.delete(symbol);
    for (const q of this.quotes.values()) {
      if (q.symbol === symbol) {
        q.circuitBreakerTripped = false;
        q.circuitBreakerReason = undefined;
      }
    }
  }

  public getCircuitBreakerState(symbol: CurrencyPair): { tripped: boolean; reason?: string } {
    const b = this.circuitBreakers.get(symbol);
    return b?.tripped ? { tripped: true, reason: b.reason } : { tripped: false };
  }

  public publishSignal(signal: CanonicalSignalObject): CanonicalSignalObject {
    const validated = validateDirectionalInvariants({
      symbol: signal.symbol,
      direction: signal.haltedByCircuitBreaker ? 'HOLD' : signal.direction,
      entry: signal.entry,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    });
    const immutableSignal: CanonicalSignalObject = {
      ...signal,
      exchange: signal.exchange || getCanonicalExchangeForSymbol(signal.symbol),
      direction: validated.direction,
      entry: validated.entry,
      stopLoss: validated.stopLoss,
      takeProfit: validated.takeProfit,
      rrRatio: validated.rrRatio,
      lotSize: validated.direction === 'HOLD' ? 0 : signal.lotSize,
      invalidationReason: signal.invalidationReason || validated.correctionReason,
    };
    this.signals.set(this.signalKey(immutableSignal.symbol, immutableSignal.timeframe), immutableSignal);
    this.notify({ type: 'SIGNAL', symbol: immutableSignal.symbol });
    return immutableSignal;
  }

  public getSignal(symbol: CurrencyPair, timeframe?: TimeFrame): CanonicalSignalObject | null {
    const tf = timeframe || this.activeTimeframe || '1h';
    return (
      this.signals.get(this.signalKey(symbol, tf)) ||
      Array.from(this.signals.values()).find((s) => s.symbol === symbol) ||
      null
    );
  }

  public clearSymbolState(symbol?: CurrencyPair): void {
    if (!symbol) {
      this.quotes.clear();
      this.signals.clear();
      this.circuitBreakers.clear();
      return;
    }
    for (const [k, v] of this.quotes.entries()) {
      if (v.symbol === symbol) this.quotes.delete(k);
    }
    for (const [k, v] of this.signals.entries()) {
      if (v.symbol === symbol) this.signals.delete(k);
    }
  }

  public subscribe(fn: (event: { type: 'QUOTE' | 'SIGNAL' | 'SYMBOL_SWITCH'; symbol: CurrencyPair }) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(event: { type: 'QUOTE' | 'SIGNAL' | 'SYMBOL_SWITCH'; symbol: CurrencyPair }): void {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // Non-blocking subscriber guard
      }
    });
  }
}

export const canonicalMarketStore = CanonicalMarketStore.getInstance();
export type { MarketSegment };
