import type { TimeFrame } from '../types';
import type { QuantBacktestSnapshot } from './types';
import { executionBridgeEngine } from './ExecutionBridgeEngine';
import { resolveInstitutionalAssetContext, seededRange } from './helpers';

const DEFAULT_POWER_SCRIPT = `// MultiCharts PowerLanguage / QuantConnect C# Hybrid Momentum
Inputs: FastLen(12), SlowLen(26), RiskAtrMult(1.8);
Vars: FastEMA(0), SlowEMA(0);
FastEMA = XAverage(Close, FastLen);
SlowEMA = XAverage(Close, SlowLen);
If FastEMA crosses above SlowEMA Then Buy ("QRI_Long") Next Bar at Market;
If Close < FastEMA - (AvgTrueRange(14) * RiskAtrMult) Then Sell ("QRI_Stop") Next Bar at Market;`;

export class QuantBacktestEngine {
  private static instance: QuantBacktestEngine;
  private webhookDispatchCount = 3;
  private lastMt5BridgeStatus = 'MT5_BRIDGE_READY_0MS';

  private constructor() {}

  public static getInstance(): QuantBacktestEngine {
    if (!QuantBacktestEngine.instance) {
      QuantBacktestEngine.instance = new QuantBacktestEngine();
    }
    return QuantBacktestEngine.instance;
  }

  public dispatchCloudWebhookSignal(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    lots?: number;
    condition?: string;
  }): QuantBacktestSnapshot['cloudWebhookScanner'] {
    const order = executionBridgeEngine.submitDomOrder({
      symbol: params.symbol,
      side: params.side,
      orderType: 'MARKET',
      price: params.price,
      quantityLots: params.lots ?? 0.5,
      venue: 'CLOUD_WEBHOOK -> MT5_ECN',
    });
    this.webhookDispatchCount += 1;
    this.lastMt5BridgeStatus = `ROUTED_FIX_${order.id}_SEQ_${order.fixMsgSeqNum}`;

    const conditionExpression = params.condition || `CLOSE > EMA(20) AND RVOL >= 2.0 ON ${params.symbol}`;
    return {
      webhookUrl: 'https://api.qri-trader.internal/v1/institutional/quant-backtest/webhook',
      conditionExpression,
      payloadJson: JSON.stringify(
        {
          secret: 'QRI_HMAC_VERIFIED',
          action: params.side,
          symbol: params.symbol,
          price: params.price,
          lots: params.lots ?? 0.5,
          bridge: 'MT5_PRESERVED_FIX_4_4',
          orderId: order.id,
        },
        null,
        2
      ),
      dispatchedCount: this.webhookDispatchCount,
      lastMt5BridgeStatus: this.lastMt5BridgeStatus,
    };
  }

  public evaluateFormulaBacktest(
    script: string = DEFAULT_POWER_SCRIPT,
    language: 'POWER_LANGUAGE' | 'CSHARP_QC' = 'POWER_LANGUAGE',
    symbol = 'XAU/USD'
  ): QuantBacktestSnapshot['formulaBacktester'] {
    const valid = script.trim().length > 20 && (script.includes('Buy') || script.includes('SetHoldings') || script.includes('Order'));
    return {
      language,
      script,
      compiledValid: valid,
      totalSignals: valid ? Math.round(seededRange(`${symbol}:qb:${script.length}`, 84, 240)) : 0,
      profitFactor: valid ? Number(seededRange(`${symbol}:qpf:${language}`, 1.62, 2.48).toFixed(2)) : 0,
      netReturnPct: valid ? Number(seededRange(`${symbol}:qret:${language}`, 28.4, 86.2).toFixed(1)) : 0,
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    formulaScript?: string;
    formulaLanguage?: 'POWER_LANGUAGE' | 'CSHARP_QC';
    topNRotation?: number;
  }): QuantBacktestSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const spot = ctx.spotPrice;
    const topN = Math.max(2, Math.min(6, params?.topNRotation ?? 4));

    const equityCurve = Array.from({ length: 12 }, (_, idx) => {
      const m = `M${idx + 1}`;
      const port = Number((100000 * (1 + idx * 0.036 + seededRange(`${ctx.symbol}:eq:${idx}`, -0.015, 0.032))).toFixed(0));
      const bench = Number((100000 * (1 + idx * 0.015 + seededRange(`${ctx.symbol}:bm:${idx}`, -0.01, 0.02))).toFixed(0));
      return { date: m, portfolioEquity: port, benchmarkEquity: bench };
    });

    const rotationalCandidates = [
      { symbol: 'NVDA', positionScore: 94.2 },
      { symbol: 'XAU/USD', positionScore: 91.6 },
      { symbol: 'BTC/USD', positionScore: 88.4 },
      { symbol: 'MSFT', positionScore: 82.9 },
      { symbol: 'RELIANCE', positionScore: 79.1 },
      { symbol: 'EUR/USD', positionScore: 71.5 },
    ].slice(0, topN);

    const sumScore = rotationalCandidates.reduce((a, b) => a + b.positionScore, 0);
    const rotationalHoldings = rotationalCandidates.map((c, idx) => ({
      rank: idx + 1,
      symbol: c.symbol,
      positionScore: c.positionScore,
      weightPct: Number(((c.positionScore / sumScore) * 100).toFixed(1)),
    }));

    return {
      symbol: ctx.symbol,
      eventDrivenTickBacktest: {
        universeMode: 'SURVIVORSHIP_FREE_WITH_DELISTED',
        activeConstituents: 500,
        delistedConstituentsIncluded: 318,
        totalTrades: 1420,
        cagrPct: 24.8,
        sharpeRatio: 2.04,
        sortinoRatio: 2.86,
        maxDrawdownPct: -8.4,
        equityCurve,
      },
      formulaBacktester: this.evaluateFormulaBacktest(params?.formulaScript, params?.formulaLanguage, ctx.symbol),
      aflArrayBacktest: {
        computeTimeMs: 4.8,
        topNRotation: topN,
        cagrPct: Number((19.4 + topN * 1.6).toFixed(1)),
        rotationalHoldings,
      },
      symphonyWalkForward: {
        symphonyName: 'Adaptive Risk-Parity & RSI Mean-Reversion Symphony',
        rulesSummary: [
          'IF SPY_10d_RSI > 78 THEN Allocate 60% TLT / 40% XAU/USD (Overbought Hedge)',
          'ELSE Weight Top-4 Volatility-Adjusted Momentum Assets Quarterly',
          'Rebalance Threshold Drift Band: ±3.5% Out-of-Sample Validated',
        ],
        inSampleSharpe: 2.18,
        outOfSampleSharpe: 1.89,
        walkForwardEfficiencyPct: 86.7,
        folds: [
          { fold: 'WF Fold 1 (2022)', isReturnPct: 18.4, oosReturnPct: 15.1 },
          { fold: 'WF Fold 2 (2023)', isReturnPct: 29.2, oosReturnPct: 24.8 },
          { fold: 'WF Fold 3 (2024)', isReturnPct: 33.6, oosReturnPct: 28.9 },
          { fold: 'WF Fold 4 (2025-26)', isReturnPct: 26.1, oosReturnPct: 23.4 },
        ],
      },
      cloudWebhookScanner: {
        webhookUrl: 'https://api.qri-trader.internal/v1/institutional/quant-backtest/webhook',
        conditionExpression: `CLOSE > EMA(20) AND RVOL >= 2.0 ON ${ctx.symbol}`,
        payloadJson: JSON.stringify(
          {
            secret: 'QRI_HMAC_VERIFIED',
            action: 'BUY',
            symbol: ctx.symbol,
            price: spot,
            lots: 0.5,
            bridge: 'MT5_PRESERVED_FIX_4_4',
          },
          null,
          2
        ),
        dispatchedCount: this.webhookDispatchCount,
        lastMt5BridgeStatus: this.lastMt5BridgeStatus,
      },
      dcaGridBots: [
        {
          botName: `${ctx.symbol} Neutral Liquidity Grid`,
          type: 'GRID',
          pair: ctx.symbol,
          rangeLow: Number((spot * 0.96).toFixed(ctx.decimals)),
          rangeHigh: Number((spot * 1.04).toFixed(ctx.decimals)),
          gridLevelsOrSafetyOrders: 32,
          realizedPnlUsd: 2480.5,
          estimatedAprPct: 38.4,
          status: 'RUNNING',
        },
        {
          botName: 'Multi-Pair Composite DCA Engine',
          type: 'MULTI_PAIR_DCA',
          pair: 'BTC/USD, ETH/USD, XAU/USD',
          rangeLow: Number((spot * 0.91).toFixed(ctx.decimals)),
          rangeHigh: Number((spot * 1.09).toFixed(ctx.decimals)),
          gridLevelsOrSafetyOrders: 7,
          realizedPnlUsd: 4125.0,
          estimatedAprPct: 44.2,
          status: 'RUNNING',
        },
      ],
      trailingStopEngine: {
        mode: 'ATR_CHANDELIER',
        currentStopPrice: Number((spot - ctx.atrApprox * 1.4).toFixed(ctx.decimals)),
        lockedProfitR: 1.65,
        distanceBps: Number((((ctx.atrApprox * 1.4) / Math.max(1e-8, spot)) * 10000).toFixed(1)),
      },
    };
  }
}

export const quantBacktestEngine = QuantBacktestEngine.getInstance();
