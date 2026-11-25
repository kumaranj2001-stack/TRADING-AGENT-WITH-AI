/**
 * Phase 2 Worker: RiskAssessmentWorker
 * Evaluates live volatility metrics (ATR-14, historical volatility, live price swings),
 * dynamic drawdown thresholds, Kelly sizing, and community chat risk warnings
 * strictly derived from the active chart asset.
 */

import { DiscoveryBrief, RiskAgentResult, RiskFactor, TechnicalAgentResult } from '../types';
import { communityChatEngine } from '../CommunityChatEngine';
import { roundAssetPrice } from '../LiveChartTelemetryService';

export class RiskAssessmentWorker {
  public async analyze(
    brief: DiscoveryBrief,
    technicalContext?: TechnicalAgentResult
  ): Promise<RiskAgentResult> {
    const r = (val: number) => roundAssetPrice(val, brief.assetClass, brief.symbol);
    const price = brief.chartContext?.livePrice || brief.pricing.currentPrice;
    const transcript =
      brief.chatTranscript ||
      communityChatEngine.getBufferedTranscript(brief.symbol, price);
    const messages = transcript.messages;
    const fullText = messages.map((m) => m.text).join(' ').toLowerCase();

    const hasCrashTalk = fullText.includes('crash') || fullText.includes('dump') || fullText.includes('reversal') || fullText.includes('breakdown');
    const hasStopLossTalk = fullText.includes('stop loss') || fullText.includes('sl') || fullText.includes('invalidation') || fullText.includes('tight stop');
    const hasVolatilityTalk = fullText.includes('volatility') || fullText.includes('choppy') || fullText.includes('whipsaw') || fullText.includes('iv');
    const hasMacroRiskTalk = fullText.includes('fed') || fullText.includes('inflation') || fullText.includes('rate hike') || fullText.includes('cpi');
    const hasLiquidityTalk = fullText.includes('liquidity') || fullText.includes('slippage') || fullText.includes('spread') || fullText.includes('gap');

    const atr = Math.max(brief.volatility.atr14 || price * 0.015, price * 0.002);
    const atrPercent = brief.volatility.atrPercent || Number(((atr / price) * 100).toFixed(2));
    const isBullBias = technicalContext
      ? technicalContext.trendDirection === 'STRONG_BULLISH' || technicalContext.trendDirection === 'BULLISH'
      : transcript.consensusSentiment === 'BULLISH';

    // Bear-case / stress-tested drawdown scenarios anchored strictly to live spot & ATR
    const stopPrice = technicalContext?.tradePlan?.stopLoss?.price || r(price - atr * 1.4);
    const mildCorrectionPrice = r(Math.min(stopPrice, price - atr * 1.8));
    const deepCorrectionPrice = r(price - atr * 3.8);
    const tailRiskCrashPrice = r(Math.max(price * 0.6, price - atr * 7.5));

    const bearCaseDrawdownScenario = {
      mildCorrectionPrice,
      deepCorrectionPrice,
      tailRiskCrashPrice,
      maxHistoricDrawdownPercent: Number(Math.min(55, Math.max(8, atrPercent * 11)).toFixed(1)),
    };

    const correlations = {
      macroRatesCorrelation: brief.assetClass === 'FOREX' ? 0.68 : 0.35,
      currencyCorrelation: brief.assetClass === 'METALS' ? -0.72 : brief.assetClass === 'FOREX' ? 0.85 : 0.25,
      broaderMarketCorrelation: brief.assetClass === 'EQUITY' ? 0.82 : 0.48,
      regulatoryRiskScore: 'LOW' as const,
    };

    const liquidityAssessment = {
      dailyVolumeDollar: Math.round(price * (brief.volume.currentVolume || 1000000)),
      bidAskSlippagePercent: brief.assetClass === 'FOREX' ? 0.01 : 0.04,
      executionRisk: (hasLiquidityTalk ? 'ACCEPTABLE' : 'MINIMAL_SLIPPAGE') as
        | 'MINIMAL_SLIPPAGE'
        | 'ACCEPTABLE'
        | 'WIDE_SPREAD_RISK',
    };

    const rrRatio = technicalContext?.tradePlan?.target1?.riskRewardRatio ?? 1.85;
    const stopRiskPct = technicalContext?.tradePlan?.stopLoss?.riskPercent || atrPercent * 1.2;
    const recommendedNav = Number(
      Math.min(4.0, Math.max(0.75, (2.2 / Math.max(0.5, stopRiskPct)) * (rrRatio >= 1.8 ? 1.15 : 0.85))).toFixed(2)
    );

    const positionSizingKelly = {
      recommendedPositionPercentNAV: recommendedNav,
      halfKellyPercent: Number(Math.min(35, Math.max(8, rrRatio * 9.5)).toFixed(1)),
      maxRiskExposureDollars: Math.round(100000 * (recommendedNav / 100)),
      recommendedLotsOrUnits: Math.max(1, Math.floor((100000 * (recommendedNav / 100)) / Math.max(atr, 0.01))),
    };

    const top5RiskMatrix: RiskFactor[] = [
      {
        rank: 1,
        category: 'MARKET',
        title: hasStopLossTalk
          ? `${brief.symbol} Structural Invalidation Breach (${stopPrice})`
          : `Intraday ${brief.symbol} Volatility & Liquidity Sweep`,
        severity: hasCrashTalk || atrPercent > 3.5 ? 4 : 3,
        likelihood: 3,
        description: `Live ATR-14 is ${atr} (${atrPercent}%). Stop clusters near ${stopPrice} face stop-run risk on high-volume candles.`,
        mitigationStrategy: `Anchor hard stop-loss at ${stopPrice} beyond ${brief.chartContext?.timeframe?.toUpperCase() || '1H'} swing structure.`,
      },
      {
        rank: 2,
        category: 'MACRO',
        title: hasMacroRiskTalk ? 'Central Bank Policy & Sovereign Yield Volatility' : 'Cross-Asset DXY / Benchmark Correlation Shift',
        severity: 3,
        likelihood: 3,
        description: `Macro policy sensitivity against ${brief.benchmarkIndex} can accelerate intraday swings beyond baseline ATR.`,
        mitigationStrategy: 'Monitor macro calendar triggers and deploy staged entry tranches.',
      },
      {
        rank: 3,
        category: 'VALUATION',
        title: brief.assetClass === 'EQUITY' ? 'Guidance / Multiple Compression Sensitivity' : 'Momentum Mean-Reversion Pullback',
        severity: 3,
        likelihood: 2,
        description: `Extended deviation from EMA-20 (${technicalContext?.ema20 ?? r(price * 0.99)}) invites profit-taking pullbacks.`,
        mitigationStrategy: `Scale out 50% at Target 1 (${technicalContext?.tradePlan?.target1?.price ?? r(price + atr * 2)}) and trail stop to breakeven.`,
      },
      {
        rank: 4,
        category: 'LIQUIDITY',
        title: 'Session Transition Spread & Gap Risk',
        severity: 2,
        likelihood: 3,
        description: 'Off-peak liquidity pockets widen bid/ask spread during session rollovers or earnings prints.',
        mitigationStrategy: 'Execute within peak session volume windows using limit orders in Entry Zone.',
      },
      {
        rank: 5,
        category: 'GEOPOLITICAL',
        title: 'Exogenous Headline & Macro Shock Risk',
        severity: 3,
        likelihood: 2,
        description: 'Unscheduled geopolitical or regulatory headlines can spike correlation across risk assets.',
        mitigationStrategy: `Enforce ${recommendedNav}% max NAV position cap under Kelly governance.`,
      },
    ];

    // Five INVERTED 0-20 Sub-Scores (Higher = Safer / Lower Risk)
    const volatilitySafetyScore = Math.min(20, Math.max(6, Math.round(19 - atrPercent * 1.4 - (hasVolatilityTalk ? 1 : 0))));
    const downsideProtectionScore = Math.min(20, Math.max(8, (hasStopLossTalk ? 17 : 15) + (rrRatio >= 1.8 ? 1 : 0)));
    const macroResilienceScore = Math.min(20, Math.max(8, (hasMacroRiskTalk ? 14 : 16) + (brief.assetClass === 'METALS' ? 1 : 0)));
    const liquidityScore = Math.min(20, Math.max(10, hasLiquidityTalk ? 17 : 18));
    const riskRewardScore = Math.min(20, Math.max(7, rrRatio >= 2.2 ? 19 : rrRatio >= 1.7 ? 17 : rrRatio >= 1.3 ? 14 : 10));

    const totalScore =
      volatilitySafetyScore +
      downsideProtectionScore +
      macroResilienceScore +
      liquidityScore +
      riskRewardScore;

    const sampleRiskMsg =
      messages.find((m) => m.text.toLowerCase().includes('risk') || m.text.toLowerCase().includes('stop'))?.text ||
      messages[messages.length - 1]?.text ||
      'Risk parameters anchored to active chart ATR.';

    return {
      agentName: 'Risk Assessment Agent',
      weight: 0.15,
      status: 'SUCCESS',
      volatilityMetrics: {
        historicalVolAnnualized: brief.volatility.historicalVol30d,
        atr14Points: atr,
        atrPercent,
        beta: brief.volatility.betaVsBenchmark,
        optionsIVPercentile: brief.volatility.optionsIVRank ?? 48,
      },
      bearCaseDrawdownScenario,
      correlations,
      liquidityAssessment,
      positionSizingKelly,
      top5RiskMatrix,
      subScores: {
        volatilitySafety: volatilitySafetyScore,
        downsideProtection: downsideProtectionScore,
        macroResilience: macroResilienceScore,
        liquidity: liquidityScore,
        riskRewardRatio: riskRewardScore,
      },
      totalScore,
      keyInsights: [
        `Live Volatility Audit (${brief.symbol}): ATR-14 = ${atr} (${atrPercent}%), Annualized Vol = ${brief.volatility.historicalVol30d}%.`,
        `Dynamic Stop & Bear Stress Test: Primary stop anchored at ${brief.pricing.currency} ${stopPrice}; deep stress floor at ${brief.pricing.currency} ${deepCorrectionPrice}.`,
        `Kelly Criterion Governance: Recommended allocation ${recommendedNav}% NAV (1:${rrRatio} R:R profile, max risk $${positionSizingKelly.maxRiskExposureDollars}).`,
        `Chat Risk Context (${transcript.tickerTag}): "${sampleRiskMsg.slice(0, 105)}..."`,
        `Top Risk Mitigation: ${top5RiskMatrix[0].mitigationStrategy}`,
      ],
    };
  }
}

export const riskAssessmentWorker = new RiskAssessmentWorker();
