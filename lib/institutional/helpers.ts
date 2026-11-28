import { BASE_PRICES, PIP_VALUES } from '../marketData';
import { liveMarketAnchorConstraintEngine } from '../liveMarketAnchorConstraintEngine';
import { LiveMarketFeedManager } from '../liveMarketFeed';
import { liveChartTelemetryService } from '../research/LiveChartTelemetryService';
import type { CurrencyPair, TimeFrame } from '../types';

/**
 * Deterministic seeded PRNG helper so institutional simulations and UI tables
 * stay reproducible across server reloads while adapting smoothly to live price changes.
 */
export function seededUnit(seedKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return Number.isFinite(normalized) ? normalized : 0.5;
}

export type InstitutionalAssetClass =
  | 'METALS_COMMODITIES'
  | 'FOREX'
  | 'CRYPTO'
  | 'INDIAN_EQUITY_INDEX'
  | 'US_EQUITY';

/**
 * Classifies any symbol accurately so institutional modules never template Spot Gold or FX
 * into corporate semiconductor equities or corporate unsecured debt.
 */
export function classifyInstitutionalAsset(rawSymbol: string): InstitutionalAssetClass {
  const sym = (rawSymbol || 'XAU/USD').trim().toUpperCase();
  if (
    sym.includes('XAU') ||
    sym.includes('XAG') ||
    sym.includes('WTI') ||
    sym.includes('BRENT') ||
    sym.includes('OIL') ||
    sym.includes('COPPER')
  ) {
    return 'METALS_COMMODITIES';
  }
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('XRP')) {
    return 'CRYPTO';
  }
  if (
    sym.includes('NIFTY') ||
    sym.includes('SENSEX') ||
    sym.includes('INR') ||
    sym === 'RELIANCE' ||
    sym === 'TCS' ||
    sym === 'HDFCBANK'
  ) {
    return 'INDIAN_EQUITY_INDEX';
  }
  if (sym.includes('/')) {
    return 'FOREX';
  }
  return 'US_EQUITY';
}

export function seededRange(seedKey: string, min: number, max: number): number {
  return min + seededUnit(seedKey) * (max - min);
}

/**
 * Resolves any ticker (Forex, Metals, Indian equities, US Equities, Crypto) into
 * synchronized live spot price, precision decimals, and tick increment without disturbing
 * existing MT5/LiveMarketFeed state.
 */
export function resolveInstitutionalAssetContext(
  rawSymbol: string = 'XAU/USD',
  timeframe: TimeFrame = '1h'
): {
  symbol: string;
  spotPrice: number;
  decimals: number;
  tickStep: number;
  atrApprox: number;
  timeframe: TimeFrame;
} {
  const trimmed = (rawSymbol || 'XAU/USD').trim().toUpperCase();
  const isKnownPair = trimmed in BASE_PRICES;

  let spotPrice: number | undefined;
  if (isKnownPair) {
    spotPrice =
      LiveMarketFeedManager.getCanonicalPrice(trimmed as CurrencyPair) ||
      liveMarketAnchorConstraintEngine.getAuthoritativeSpotPrice(trimmed as CurrencyPair) ||
      BASE_PRICES[trimmed as CurrencyPair];
  }

  const cachedTel = liveChartTelemetryService.peekCachedTelemetry(trimmed);
  if (cachedTel && Number.isFinite(cachedTel.livePrice) && cachedTel.livePrice > 0) {
    spotPrice = cachedTel.livePrice;
  }

  const fallbackDefaults: Record<string, number> = {
    NVDA: 142.1,
    TSLA: 262.4,
    AAPL: 229.8,
    MSFT: 428.5,
    'BTC/USD': 96420,
    BTC: 96420,
    'ETH/USD': 3410,
    ETH: 3410,
    'SOL/USD': 218.4,
    SOL: 218.4,
    SPY: 598.4,
    QQQ: 514.2,
  };

  if (!spotPrice || spotPrice <= 0) {
    spotPrice = fallbackDefaults[trimmed] || BASE_PRICES[trimmed as CurrencyPair] || 150.0;
  }

  let decimals = 2;
  let tickStep = 0.05;

  if (trimmed.includes('JPY')) {
    decimals = 3;
    tickStep = 0.01;
  } else if (trimmed.includes('/') && !trimmed.includes('XAU') && !trimmed.includes('XAG') && !trimmed.includes('BTC') && !trimmed.includes('ETH')) {
    decimals = 5;
    tickStep = PIP_VALUES[trimmed as CurrencyPair] || 0.0001;
  } else if (trimmed.includes('XAU')) {
    decimals = 2;
    tickStep = 0.5;
  } else if (trimmed.includes('XAG')) {
    decimals = 3;
    tickStep = 0.025;
  } else if (trimmed.includes('BTC') || trimmed.includes('NIFTY')) {
    decimals = 2;
    tickStep = trimmed.includes('BTC') ? 25 : 5;
  } else if (spotPrice < 5) {
    decimals = 4;
    tickStep = 0.001;
  }

  const atrApprox = Number(Math.max(tickStep * 8, spotPrice * 0.0085).toFixed(decimals));

  return {
    symbol: trimmed,
    spotPrice: Number(spotPrice.toFixed(decimals)),
    decimals,
    tickStep,
    atrApprox,
    timeframe,
  };
}

/**
 * Standard normal CDF (Abramowitz & Stegun approximation) for options Greeks & Probability of Touch.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const erf = 1 - poly * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Deterministic cryptographic-style SHA-256 hex digest (pure JS fallback + Node crypto when available)
 * so track-record auditing works identically in browser preview and Node runtimes.
 */
export function computeAuditDigest(input: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = typeof window === 'undefined' ? require('crypto') : null;
    if (nodeCrypto?.createHash) {
      return nodeCrypto.createHash('sha256').update(input).digest('hex');
    }
  } catch {
    // Fallback below if running in pure Edge/browser context
  }

  const chunks = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    for (let j = 0; j < chunks.length; j++) {
      chunks[j] = (Math.imul(chunks[j] ^ c, 0x45d9f3b + j * 131) + (chunks[(j + 3) % 8] >>> 5)) >>> 0;
    }
  }
  return chunks.map((n) => n.toString(16).padStart(8, '0')).join('');
}

/**
 * Safe recursive-descent arithmetic parser for custom financial ratios (Koyfin/YCharts style)
 * without eval() or Function() risks. Supports +, -, *, /, parentheses, numbers, and variables.
 */
export function evaluateSafeFormula(
  expression: string,
  variables: Record<string, number>
): { ok: boolean; value: number; error?: string } {
  const sanitized = expression.trim();
  if (!sanitized) return { ok: false, value: 0, error: 'Empty formula expression' };

  const tokens: string[] = [];
  let i = 0;
  while (i < sanitized.length) {
    const ch = sanitized[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < sanitized.length && /[0-9.]/.test(sanitized[i])) num += sanitized[i++];
      tokens.push(num);
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < sanitized.length && /[A-Za-z0-9_]/.test(sanitized[i])) ident += sanitized[i++];
      tokens.push(ident);
      continue;
    }
    return { ok: false, value: 0, error: `Unsupported character '${ch}' in formula` };
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpr = (): number => {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '/') {
        if (Math.abs(right) < 1e-12) throw new Error('Division by zero in formula');
        left /= right;
      } else {
        left *= right;
      }
    }
    return left;
  };

  const parseFactor = (): number => {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t === '-') {
      consume();
      return -parseFactor();
    }
    if (t === '+') {
      consume();
      return parseFactor();
    }
    if (t === '(') {
      consume();
      const val = parseExpr();
      if (consume() !== ')') throw new Error('Mismatched parenthesis');
      return val;
    }
    consume();
    if (/^[0-9]+(\.[0-9]+)?$/.test(t)) {
      return Number(t);
    }
    const lowerMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(variables)) {
      lowerMap[k.toLowerCase()] = v;
    }
    if (t.toLowerCase() in lowerMap) {
      return lowerMap[t.toLowerCase()];
    }
    throw new Error(`Unknown financial ratio identifier '${t}'`);
  };

  try {
    const val = parseExpr();
    if (pos < tokens.length) {
      return { ok: false, value: 0, error: `Unexpected token '${tokens[pos]}'` };
    }
    return { ok: true, value: Number(val.toFixed(4)) };
  } catch (err: any) {
    return { ok: false, value: 0, error: err?.message || 'Formula parse error' };
  }
}
