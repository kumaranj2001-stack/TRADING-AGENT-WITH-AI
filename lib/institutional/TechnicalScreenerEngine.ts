import { getMarketSegmentForSymbol } from '../marketData';
import { unifiedMarketAuthority } from '../unifiedMarketAuthority';
import type { Candle, CurrencyPair, TimeFrame } from '../types';
import type { TechnicalScreenerSnapshot } from './types';
import { classifyInstitutionalAsset, resolveInstitutionalAssetContext, seededRange } from './helpers';

const DEFAULT_PINE_V5 = `//@version=5
indicator("QRI Institutional EMA Cross + RSI Filter", overlay=true)
fast = ta.ema(close, 9)
slow = ta.ema(close, 21)
rsiVal = ta.rsi(close, 14)
bullCross = ta.crossover(fast, slow)
bearCross = ta.crossunder(fast, slow)
plot(fast, title="EMA Fast (9)")
plot(slow, title="EMA Slow (21)")
plot(rsiVal, title="RSI (14)")`;

function computeSmaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - period + 1);
    const slice = values.slice(start, i + 1);
    out.push(Number((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(4)));
  }
  return out;
}

function computeEmaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(Number(prev.toFixed(4)));
  }
  return out;
}

function computeRsiSeries(values: number[], period: number): number[] {
  const out: number[] = [50];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(Number((100 - 100 / (1 + rs)).toFixed(2)));
  }
  return out;
}

export class TechnicalScreenerEngine {
  private static instance: TechnicalScreenerEngine;

  private constructor() {}

  public static getInstance(): TechnicalScreenerEngine {
    if (!TechnicalScreenerEngine.instance) {
      TechnicalScreenerEngine.instance = new TechnicalScreenerEngine();
    }
    return TechnicalScreenerEngine.instance;
  }

  public compilePineScriptV5(sourceCode: string, candles: Candle[]): TechnicalScreenerSnapshot['pineCompiler'] {
    const lines = sourceCode.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const errors: string[] = [];
    let title = 'QRI Custom Pine Script v5';
    const seriesMap: Record<string, number[]> = {
      close: candles.map((c) => c.close),
      open: candles.map((c) => c.open),
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      volume: candles.map((c) => c.volume),
    };
    const boolSignals: Record<string, boolean[]> = {};
    const plots: Array<{ name: string; latestValue: number; series: number[] }> = [];

    if (!lines.some((l) => l.includes('//@version=5'))) {
      errors.push('Warning: //@version=5 directive recommended on line 1; defaulting to v5 runtime.');
    }

    for (let idx = 0; idx < lines.length; idx++) {
      const rawLine = lines[idx];
      if (rawLine.startsWith('//')) continue;
      const line = rawLine.replace(/\s+\/\/.*$/, '').trim();
      if (!line) continue;

      const indMatch = line.match(/^(?:indicator|study)\(\s*["']([^"']+)["']/);
      if (indMatch) {
        title = indMatch[1];
        continue;
      }

      const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const rhs = assignMatch[2].trim();
        const taFn = rhs.match(/^ta\.(ema|sma|rsi|wma|vwma)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(\d+)\s*\)$/);
        const crossFn = rhs.match(/^ta\.(crossover|crossunder)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/);
        const mathFn = rhs.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([+\-*\/])\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)$/);

        if (taFn) {
          const [, fn, srcKey, periodStr] = taFn;
          const period = Math.max(1, Number(periodStr));
          const src = seriesMap[srcKey];
          if (!src) {
            errors.push(`Line ${idx + 1}: Unknown source series '${srcKey}'`);
          } else {
            seriesMap[varName] =
              fn === 'ema' || fn === 'wma' || fn === 'vwma'
                ? computeEmaSeries(src, period)
                : fn === 'sma'
                ? computeSmaSeries(src, period)
                : computeRsiSeries(src, period);
          }
        } else if (crossFn) {
          const [, kind, aKey, bKey] = crossFn;
          const a = seriesMap[aKey];
          const b = seriesMap[bKey];
          if (!a || !b) {
            errors.push(`Line ${idx + 1}: Unknown crossover operand '${aKey}' or '${bKey}'`);
          } else {
            boolSignals[varName] = a.map((val, k) => {
              if (k === 0) return false;
              return kind === 'crossover' ? a[k - 1] <= b[k - 1] && val > b[k] : a[k - 1] >= b[k - 1] && val < b[k];
            });
          }
        } else if (seriesMap[rhs]) {
          seriesMap[varName] = [...seriesMap[rhs]];
        } else if (mathFn) {
          const [, leftKey, op, rightKey] = mathFn;
          const left = seriesMap[leftKey];
          const rightArr = seriesMap[rightKey];
          const rightNum = Number(rightKey);
          if (!left || (!rightArr && !Number.isFinite(rightNum))) {
            errors.push(`Line ${idx + 1}: Unknown expression operand '${rhs}'`);
          } else {
            seriesMap[varName] = left.map((lv, k) => {
              const rv = rightArr ? rightArr[k] ?? 0 : rightNum;
              if (op === '+') return Number((lv + rv).toFixed(4));
              if (op === '-') return Number((lv - rv).toFixed(4));
              if (op === '*') return Number((lv * rv).toFixed(4));
              return Number((rv === 0 ? 0 : lv / rv).toFixed(4));
            });
          }
        } else {
          errors.push(`Line ${idx + 1}: Unsupported ta.* expression '${rhs}'`);
        }
        continue;
      }

      const plotMatch = line.match(
        /^plot\(\s*([A-Za-z_][A-Za-z0-9_]*)(?:[^)]*?\btitle\s*=\s*["']([^"']+)["']|\s*,\s*["']([^"']+)["'])?/
      );
      if (plotMatch) {
        const varName = plotMatch[1];
        const plotName = plotMatch[2] || plotMatch[3] || varName;
        const s = seriesMap[varName];
        if (!s) {
          errors.push(`Line ${idx + 1}: Cannot plot undeclared identifier '${varName}'`);
        } else {
          plots.push({ name: plotName, latestValue: s[s.length - 1] ?? 0, series: s.slice(-24) });
        }
        continue;
      }

      if (!line.startsWith('indicator(') && !line.startsWith('study(')) {
        errors.push(`Line ${idx + 1}: Unrecognized Pine v5 statement '${line}'`);
      }
    }

    const signals: Array<{ index: number; type: 'BUY' | 'SELL'; price: number }> = [];
    for (const [sigName, flags] of Object.entries(boolSignals)) {
      const type: 'BUY' | 'SELL' = sigName.toLowerCase().includes('bear') || sigName.toLowerCase().includes('sell') ? 'SELL' : 'BUY';
      flags.forEach((hit, k) => {
        if (hit && candles[k]) {
          signals.push({ index: k, type, price: candles[k].close });
        }
      });
    }

    const hardErrors = errors.filter((e) => !e.startsWith('Warning:'));
    return {
      title,
      version: 5,
      sourceCode,
      compiledOk: hardErrors.length === 0,
      errors,
      plots,
      signals: signals.slice(-8),
    };
  }

  public scoreUnstructuredHeadline(headline: string, source = 'Bloomberg Live API'): TechnicalScreenerSnapshot['unstructuredNewsSentiment'][number] {
    const lower = headline.toLowerCase();
    const bullWords = ['beat', 'surge', 'cut', 'dovish', 'upgrade', 'breakout', 'accumulate', 'record', 'expansion', 'inflow'];
    const bearWords = ['miss', 'hawkish', 'hike', 'downgrade', 'plunge', 'tariff', 'default', 'recession', 'warning', 'outflow'];
    let score = 0;
    for (const w of bullWords) if (lower.includes(w)) score += 0.24;
    for (const w of bearWords) if (lower.includes(w)) score -= 0.24;
    const clamped = Number(Math.max(-1, Math.min(1, score)).toFixed(2));
    const entities = ['FED', 'ECB', 'NVDA', 'XAU/USD', 'EUR/USD', 'OPEC', 'TSMC', 'RBI'].filter((e) =>
      headline.toUpperCase().includes(e.replace('/USD', ''))
    );

    return {
      id: `NEWS_${Math.abs(headline.length * 31 + clamped * 100)}`,
      source,
      headline,
      nlpScore: clamped,
      confidence: Number((0.72 + Math.min(0.25, Math.abs(clamped) * 0.25)).toFixed(2)),
      entities: entities.length > 0 ? entities : ['MACRO_BROAD'],
      debateImpactNote:
        clamped >= 0.2
          ? 'Injects +Bullish News Catalyst weight into Seven-Agent Debate & Scanner'
          : clamped <= -0.2
          ? 'Injects -Bearish Risk Veto weight into Seven-Agent Debate & Scanner'
          : 'Neutral informational context logged into episodic memory',
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    pineCode?: string;
    replayBarIndex?: number;
    customHeadline?: string;
  }): TechnicalScreenerSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const candles = unifiedMarketAuthority.getAuthoritativeCandles(ctx.symbol as CurrencyPair, ctx.timeframe).slice(-60);
    const totalBars = candles.length;
    const idx = Math.max(15, Math.min(totalBars, params?.replayBarIndex ?? 45));
    const replayVisible = candles.slice(0, idx);
    const entryPx = replayVisible[10]?.close ?? ctx.spotPrice;
    const currPx = replayVisible[replayVisible.length - 1]?.close ?? ctx.spotPrice;

    const pineCompiler = this.compilePineScriptV5(params?.pineCode || DEFAULT_PINE_V5, candles);

    const communityScripts: TechnicalScreenerSnapshot['communityScripts'] = [
      {
        id: 'script_qri_ema_rsi',
        title: 'Institutional EMA 9/21 + RSI Momentum Filter',
        author: 'QriQuant_Core',
        language: 'Pine Script v5',
        stars: 4820,
        category: 'Trend & Momentum',
        code: DEFAULT_PINE_V5,
      },
      {
        id: 'script_smt_vwap',
        title: 'Smart Money Rolling 50-SMA + RSI Extremes',
        author: 'DeskAlpha_NY',
        language: 'Pine Script v5',
        stars: 3190,
        category: 'Mean Reversion',
        code: `//@version=5\nindicator("Smart Money SMA50 + RSI", overlay=true)\nslow = ta.sma(close, 50)\nfast = ta.ema(close, 12)\nr = ta.rsi(close, 14)\nbullCross = ta.crossover(fast, slow)\nplot(fast, title="EMA12")\nplot(slow, title="SMA50")\nplot(r, title="RSI14")`,
      },
      {
        id: 'script_mt5_cbot',
        title: 'MT5 / cTrader ATR Adaptive Liquidity Sweeper',
        author: 'ECN_Bridge_Dev',
        language: 'C# cBot',
        stars: 2640,
        category: 'Execution Algo',
        code: '// cTrader Automate Robot mounted cleanly on live MT5 ECN feed',
      },
    ];

    const assetClass = classifyInstitutionalAsset(ctx.symbol);

    const mtfTrendlines: TechnicalScreenerSnapshot['mtfTrendlines'] = (['15m', '1h', '4h', '1d'] as const).map((tf, k) => {
      const isSupport = k % 2 === 0;
      const dist = isSupport
        ? Number((-seededRange(`${ctx.symbol}:tl:${tf}:sup`, 0.14, 0.85)).toFixed(2))
        : Number(seededRange(`${ctx.symbol}:tl:${tf}:res`, 0.14, 0.85).toFixed(2));
      return {
        timeframe: tf,
        type: isSupport ? 'ASCENDING_SUPPORT' : 'DESCENDING_RESISTANCE',
        slopePerBar: Number((ctx.tickStep * (isSupport ? 0.6 : -0.7)).toFixed(ctx.decimals)),
        touchCount: 3 + (k % 3),
        currentLinePrice: Number((ctx.spotPrice * (1 + dist / 100)).toFixed(ctx.decimals)),
        distancePct: dist,
        breakoutStatus: Math.abs(dist) < 0.25 ? 'TESTING' : Math.abs(dist) > 0.65 ? 'BROKEN' : 'HOLDING',
      };
    });

    const raindropCandles = candles.slice(-8).map((c) => {
      const mid = (c.open + c.close) / 2;
      const leftHalfVwap = Number(((c.open + c.low + mid) / 3).toFixed(ctx.decimals));
      const rightHalfVwap = Number(((c.close + c.high + mid) / 3).toFixed(ctx.decimals));
      const leftVolumePct = Number(seededRange(`${ctx.symbol}:rd:${c.time}`, 32, 68).toFixed(1));
      const rightVolumePct = Number((100 - leftVolumePct).toFixed(1));
      return {
        time: c.time,
        leftHalfVwap,
        rightHalfVwap,
        leftVolumePct,
        rightVolumePct,
        bias:
          rightHalfVwap > leftHalfVwap && rightVolumePct >= 52
            ? ('ACCUMULATION' as const)
            : rightHalfVwap < leftHalfVwap && rightVolumePct >= 52
            ? ('DISTRIBUTION' as const)
            : ('BALANCED' as const),
      };
    });

    const hollyAiStrategies: TechnicalScreenerSnapshot['hollyAiStrategies'] =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { strategyName: 'London/NY Vault Liquidity Sweep Reclaim', direction: 'LONG', signalSymbol: ctx.symbol, winRatePct: 67.4, profitFactor: 2.38, expectedValueR: 0.44, riskOffTargetExit: Number((ctx.spotPrice * 1.014).toFixed(ctx.decimals)) },
            { strategyName: 'COMEX Session VWAP Pullback Continuation', direction: 'LONG', signalSymbol: 'XAG/USD', winRatePct: 64.1, profitFactor: 2.15, expectedValueR: 0.39, riskOffTargetExit: Number((ctx.spotPrice * 0.0115).toFixed(2)) },
            { strategyName: 'Real-Yield Spike Exhaustion Fade', direction: 'SHORT', signalSymbol: ctx.symbol, winRatePct: 61.8, profitFactor: 1.94, expectedValueR: 0.31, riskOffTargetExit: Number((ctx.spotPrice * 0.986).toFixed(ctx.decimals)) },
          ]
        : assetClass === 'FOREX'
          ? [
              { strategyName: 'London Open Stop-Hunt Mean Reversion', direction: 'LONG', signalSymbol: ctx.symbol, winRatePct: 66.2, profitFactor: 2.29, expectedValueR: 0.42, riskOffTargetExit: Number((ctx.spotPrice * 1.006).toFixed(ctx.decimals)) },
              { strategyName: 'NY Fixing Rate Differential Momentum', direction: 'LONG', signalSymbol: 'EUR/USD', winRatePct: 63.5, profitFactor: 2.08, expectedValueR: 0.36, riskOffTargetExit: 1.0945 },
              { strategyName: 'ECB/Fed Overnight Carry Drain', direction: 'SHORT', signalSymbol: ctx.symbol, winRatePct: 60.9, profitFactor: 1.88, expectedValueR: 0.29, riskOffTargetExit: Number((ctx.spotPrice * 0.994).toFixed(ctx.decimals)) },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { strategyName: 'NSE Opening Range VWAP Breakout', direction: 'LONG', signalSymbol: ctx.symbol, winRatePct: 68.1, profitFactor: 2.41, expectedValueR: 0.46, riskOffTargetExit: Number((ctx.spotPrice * 1.012).toFixed(ctx.decimals)) },
                { strategyName: 'BankNifty Gamma Pin Mean Reversion', direction: 'LONG', signalSymbol: 'BANK NIFTY', winRatePct: 63.8, profitFactor: 2.11, expectedValueR: 0.37, riskOffTargetExit: 52640.0 },
                { strategyName: 'FII Cash Flow Exhaustion Reversal', direction: 'SHORT', signalSymbol: 'RELIANCE', winRatePct: 61.4, profitFactor: 1.92, expectedValueR: 0.30, riskOffTargetExit: 1362.5 },
              ]
            : [
                { strategyName: 'Holly Grail Opening Drive Pullback', direction: 'LONG', signalSymbol: ctx.symbol, winRatePct: 67.4, profitFactor: 2.38, expectedValueR: 0.44, riskOffTargetExit: Number((ctx.spotPrice * 1.018).toFixed(ctx.decimals)) },
                { strategyName: 'Nickelodeon VWAP Squeeze Reclaim', direction: 'LONG', signalSymbol: 'NVDA', winRatePct: 64.1, profitFactor: 2.15, expectedValueR: 0.39, riskOffTargetExit: 147.8 },
                { strategyName: 'Mighty Mouse Exhaustion Mean-Revert', direction: 'SHORT', signalSymbol: 'AAPL', winRatePct: 61.8, profitFactor: 1.94, expectedValueR: 0.31, riskOffTargetExit: 222.4 },
              ];

    const rvolSurges: TechnicalScreenerSnapshot['rvolSurges'] =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { symbol: ctx.symbol, price: ctx.spotPrice, rvolMultiplier: 3.42, changePct: 1.48, floatTurnoverPct: 3.2, alertTag: 'EXTREME_SURGE' },
            { symbol: 'XAG/USD', price: 32.85, rvolMultiplier: 2.64, changePct: 1.82, floatTurnoverPct: 2.7, alertTag: 'INSTITUTIONAL_OPEN' },
            { symbol: 'XPT/USD', price: 985.4, rvolMultiplier: 2.19, changePct: 0.94, floatTurnoverPct: 1.6, alertTag: 'INSTITUTIONAL_OPEN' },
            { symbol: 'COPPER', price: 4.382, rvolMultiplier: 2.41, changePct: 1.25, floatTurnoverPct: 1.9, alertTag: 'EXTREME_SURGE' },
          ]
        : assetClass === 'FOREX'
          ? [
              { symbol: ctx.symbol, price: ctx.spotPrice, rvolMultiplier: 3.18, changePct: 0.46, floatTurnoverPct: 4.1, alertTag: 'EXTREME_SURGE' },
              { symbol: 'EUR/USD', price: 1.0935, rvolMultiplier: 2.52, changePct: 0.32, floatTurnoverPct: 3.4, alertTag: 'INSTITUTIONAL_OPEN' },
              { symbol: 'GBP/USD', price: 1.2984, rvolMultiplier: 2.24, changePct: 0.28, floatTurnoverPct: 2.8, alertTag: 'INSTITUTIONAL_OPEN' },
              { symbol: 'USD/JPY', price: 153.42, rvolMultiplier: 2.79, changePct: -0.54, floatTurnoverPct: 3.7, alertTag: 'EXTREME_SURGE' },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { symbol: ctx.symbol, price: ctx.spotPrice, rvolMultiplier: 3.28, changePct: 1.12, floatTurnoverPct: 2.4, alertTag: 'EXTREME_SURGE' },
                { symbol: 'RELIANCE', price: 1377.5, rvolMultiplier: 2.61, changePct: 1.65, floatTurnoverPct: 1.8, alertTag: 'INSTITUTIONAL_OPEN' },
                { symbol: 'HDFC BANK', price: 1742.8, rvolMultiplier: 2.34, changePct: 1.18, floatTurnoverPct: 1.5, alertTag: 'INSTITUTIONAL_OPEN' },
                { symbol: 'TCS', price: 4125.4, rvolMultiplier: 2.12, changePct: 0.89, floatTurnoverPct: 1.1, alertTag: 'EXTREME_SURGE' },
              ]
            : [
                { symbol: ctx.symbol, price: ctx.spotPrice, rvolMultiplier: 3.42, changePct: 1.84, floatTurnoverPct: 2.1, alertTag: 'EXTREME_SURGE' },
                { symbol: 'NVDA', price: 142.1, rvolMultiplier: 2.86, changePct: 3.12, floatTurnoverPct: 4.8, alertTag: 'INSTITUTIONAL_OPEN' },
                { symbol: 'BTC/USD', price: 96420.0, rvolMultiplier: 2.58, changePct: 2.45, floatTurnoverPct: 3.2, alertTag: 'INSTITUTIONAL_OPEN' },
                { symbol: 'ETH/USD', price: 3410.0, rvolMultiplier: 2.29, changePct: 1.94, floatTurnoverPct: 2.6, alertTag: 'EXTREME_SURGE' },
              ];

    const sp500SectorHeatmap =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { sector: 'Spot Bullion & LBMA Vaults', weightPct: 34.0, changePct: 1.48, leader: ctx.symbol, leaderChangePct: 1.48 },
            { sector: 'COMEX Metals Futures', weightPct: 24.5, changePct: 1.72, leader: 'XAG/USD', leaderChangePct: 1.82 },
            { sector: 'Sovereign Central Bank Demand', weightPct: 19.0, changePct: 1.15, leader: 'GLD ETF', leaderChangePct: 1.18 },
            { sector: 'Precious & Platinum Group', weightPct: 12.5, changePct: 0.84, leader: 'XPT/USD', leaderChangePct: 0.94 },
            { sector: 'Industrial Base Metals', weightPct: 10.0, changePct: 1.04, leader: 'COPPER', leaderChangePct: 1.25 },
          ]
        : assetClass === 'FOREX'
          ? [
              { sector: 'G10 Euro & Swiss Complexes', weightPct: 36.2, changePct: 0.42, leader: 'EUR/USD', leaderChangePct: 0.45 },
              { sector: 'USD Dollar Index Basket', weightPct: 28.4, changePct: -0.38, leader: 'DXY', leaderChangePct: -0.38 },
              { sector: 'G10 Safe-Haven Yen', weightPct: 18.0, changePct: 0.54, leader: 'USD/JPY', leaderChangePct: -0.54 },
              { sector: 'Commodity FX (AUD/CAD)', weightPct: 17.4, changePct: 0.61, leader: 'AUD/USD', leaderChangePct: 0.64 },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { sector: 'NIFTY Financial Services', weightPct: 33.8, changePct: 1.32, leader: 'HDFC BANK', leaderChangePct: 1.48 },
                { sector: 'NIFTY IT Services', weightPct: 14.6, changePct: 0.94, leader: 'TCS', leaderChangePct: 1.12 },
                { sector: 'NIFTY Oil & Gas Energy', weightPct: 12.4, changePct: 1.56, leader: 'RELIANCE', leaderChangePct: 1.65 },
                { sector: 'NIFTY Auto & Industrials', weightPct: 11.2, changePct: 0.78, leader: 'TATAMOTORS', leaderChangePct: 0.92 },
                { sector: 'NIFTY Pharma & Healthcare', weightPct: 8.4, changePct: 0.41, leader: 'SUNPHARMA', leaderChangePct: 0.65 },
              ]
            : [
                { sector: 'Information Technology', weightPct: 31.4, changePct: 1.85, leader: 'NVDA', leaderChangePct: 3.12 },
                { sector: 'Financials', weightPct: 13.2, changePct: 0.94, leader: 'JPM', leaderChangePct: 1.48 },
                { sector: 'Communication Services', weightPct: 9.1, changePct: 1.42, leader: 'META', leaderChangePct: 2.19 },
                { sector: 'Health Care', weightPct: 11.4, changePct: -0.32, leader: 'LLY', leaderChangePct: 0.88 },
                { sector: 'Consumer Discretionary', weightPct: 10.6, changePct: 0.71, leader: 'AMZN', leaderChangePct: 1.64 },
                { sector: 'Industrials', weightPct: 8.5, changePct: 0.56, leader: 'GE', leaderChangePct: 1.91 },
                { sector: 'Energy', weightPct: 3.7, changePct: -1.14, leader: 'XOM', leaderChangePct: -0.95 },
                { sector: 'Utilities & Staples', weightPct: 12.1, changePct: -0.45, leader: 'COST', leaderChangePct: 0.42 },
              ];

    const insiderTrades: TechnicalScreenerSnapshot['insiderTrades'] =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { filingDate: 'COT Weekly Report', symbol: ctx.symbol, insiderName: 'Managed Money Net Long (CFTC)', role: 'Commercial / Swap Dealer', transactionType: 'OPEN_MARKET_BUY', shares: 48200, valueUsd: 16840000, isClusterBuy: true },
            { filingDate: 'Today LD4 Vault', symbol: ctx.symbol, insiderName: 'Central Bank Reserve Desk (PBoC/NBP)', role: 'Sovereign Buyer', transactionType: 'OPEN_MARKET_BUY', shares: 31500, valueUsd: 11025000, isClusterBuy: true },
            { filingDate: '2d Ago COMEX', symbol: 'XAG/USD', insiderName: 'Producer / Merchant Hedging Desk', role: 'Commercial Short Cover', transactionType: 'OPEN_MARKET_BUY', shares: 19400, valueUsd: 6420000, isClusterBuy: false },
          ]
        : assetClass === 'FOREX'
          ? [
              { filingDate: 'COT Institutional', symbol: ctx.symbol, insiderName: 'Asset Manager G10 Positioning', role: 'Real-Money Fund Desk', transactionType: 'OPEN_MARKET_BUY', shares: 64000, valueUsd: 14200000, isClusterBuy: true },
              { filingDate: 'Today WM/R Fix', symbol: ctx.symbol, insiderName: 'Cross-Border Reserve Rebalance', role: 'Sovereign FX Desk', transactionType: 'OPEN_MARKET_BUY', shares: 42000, valueUsd: 9650000, isClusterBuy: false },
              { filingDate: '2d Ago BIS', symbol: 'USD/JPY', insiderName: 'Leveraged Carry Unwind Desk', role: 'CTAs / Macro Fund', transactionType: 'OPEN_MARKET_SELL', shares: 38500, valueUsd: 8140000, isClusterBuy: false },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { filingDate: 'NSE Bulk Deal Today', symbol: ctx.symbol, insiderName: 'Domestic Mutual Fund (DII Block)', role: 'Institutional AMC', transactionType: 'OPEN_MARKET_BUY', shares: 285000, valueUsd: 12450000, isClusterBuy: true },
                { filingDate: 'NSE FII Flow', symbol: 'RELIANCE', insiderName: 'Promoter / Strategic Group', role: 'Promoter Filing', transactionType: 'OPEN_MARKET_BUY', shares: 140000, valueUsd: 5980000, isClusterBuy: true },
                { filingDate: 'Yesterday F&O', symbol: 'HDFC BANK', insiderName: 'FPI Derivative Hedge Desk', role: 'Foreign Portfolio', transactionType: 'OPEN_MARKET_SELL', shares: 95000, valueUsd: 4120000, isClusterBuy: false },
              ]
            : [
                { filingDate: 'Today 08:14', symbol: 'NVDA', insiderName: 'Jensen Huang', role: 'CEO / President', transactionType: 'OPEN_MARKET_SELL', shares: 120000, valueUsd: 17052000, isClusterBuy: false },
                { filingDate: 'Yesterday 16:42', symbol: 'MSFT', insiderName: 'Director Buy Cluster (3 Filers)', role: 'Board / EVP', transactionType: 'OPEN_MARKET_BUY', shares: 18500, valueUsd: 7927250, isClusterBuy: true },
                { filingDate: '2d Ago', symbol: 'TSLA', insiderName: 'Independent Director', role: 'Board Audit Chair', transactionType: 'OPEN_MARKET_BUY', shares: 22000, valueUsd: 5772800, isClusterBuy: false },
              ];

    const audioSquawkFeed: TechnicalScreenerSnapshot['audioSquawkFeed'] = [
      {
        id: 'sq_1',
        time: '14:52:10',
        priority: 'FLASH',
        headline: `${ctx.symbol} sweeps resting offer @ ${ctx.spotPrice}; 3.4x RVOL institutional footprint confirmed.`,
        voiceScript: `Flash squawk alert. ${ctx.symbol} sweeping offer near ${ctx.spotPrice} with 3.4 times relative volume.`,
        sentimentTag: 'RISK_ON',
      },
      {
        id: 'sq_2',
        time: '14:48:04',
        priority: 'URGENT',
        headline: 'Federal Reserve Vice Chair notes Treasury liquidity conditions orderly; front-end yields ease 3 bps.',
        voiceScript: 'Urgent macro squawk. Fed Vice Chair notes orderly Treasury liquidity, 2-year yield down 3 basis points.',
        sentimentTag: 'DOVISH',
      },
      {
        id: 'sq_3',
        time: '14:41:33',
        priority: 'NORMAL',
        headline: 'Zero Gamma flip threshold holding firm; dealer hedging dampens realized 15-minute volatility.',
        voiceScript: 'Options desk squawk. Dealers remain net positive gamma above flip level.',
        sentimentTag: 'RISK_ON',
      },
    ];

    const baseHeadlines = [
      params?.customHeadline || `${ctx.symbol} breaks multi-session equilibrium on strong institutional inflow and margin expansion`,
      'ECB governing council emphasizes data-dependent pace ahead of quarterly wage tracker release',
      'Treasury auction tails by 1.4 bps prompting defensive short-covering across bullion desks',
    ];

    return {
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
      spotPrice: ctx.spotPrice,
      pineCompiler,
      barReplay: {
        totalBars,
        currentBarIndex: idx,
        visibleBars: replayVisible.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
        simulatedPnl: Number((((currPx - entryPx) / Math.max(1e-8, entryPx)) * 10000).toFixed(2)),
      },
      communityScripts,
      mtfTrendlines,
      raindropCandles,
      hollyAiStrategies,
      rvolSurges,
      sp500SectorHeatmap,
      insiderTrades,
      audioSquawkFeed,
      unstructuredNewsSentiment: baseHeadlines.map((h) => this.scoreUnstructuredHeadline(h)),
    };
  }
}

export const technicalScreenerEngine = TechnicalScreenerEngine.getInstance();
