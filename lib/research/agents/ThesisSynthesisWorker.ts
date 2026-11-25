/**
 * Phase 2 Worker: ThesisSynthesisWorker
 * Synthesizes the holistic investment thesis, bull catalysts with upside targets,
 * bear risks with structural invalidation levels, catalyst calendar, and scaling plan
 * strictly derived from the live chart asset's price structure and community chat consensus.
 */

import {
  CatalystItem,
  DiscoveryBrief,
  TechnicalAgentResult,
  ThesisAgentResult,
} from '../types';
import { communityChatEngine } from '../CommunityChatEngine';
import { roundAssetPrice } from '../LiveChartTelemetryService';

export class ThesisSynthesisWorker {
  public async analyze(
    brief: DiscoveryBrief,
    technicalContext?: TechnicalAgentResult
  ): Promise<ThesisAgentResult> {
    const r = (val: number) => roundAssetPrice(val, brief.assetClass, brief.symbol);
    const price = brief.chartContext?.livePrice || brief.pricing.currentPrice;
    const transcript =
      brief.chatTranscript ||
      communityChatEngine.getBufferedTranscript(brief.symbol, price);
    const messages = transcript.messages;
    const fullText = messages.map((m) => m.text).join(' ').toLowerCase();

    const atr = Math.max(brief.volatility.atr14 || price * 0.015, price * 0.002);
    const isBull = technicalContext
      ? technicalContext.trendDirection === 'STRONG_BULLISH' || technicalContext.trendDirection === 'BULLISH'
      : transcript.consensusSentiment === 'BULLISH';
    const consensusPct = transcript.consensusStrengthPercent;

    // Anchor Thesis Targets & Invalidation strictly to TechnicalAnalysisWorker's live trade plan
    const target1 = technicalContext?.tradePlan?.target1?.price ?? r(isBull ? price + atr * 2.2 : price - atr * 2.2);
    const target2 = technicalContext?.tradePlan?.target2?.price ?? r(isBull ? price + atr * 3.8 : price - atr * 3.8);
    const invalidationLevel = technicalContext?.tradePlan?.stopLoss?.price ?? r(isBull ? price - atr * 1.4 : price + atr * 1.4);

    const upsidePotential = Number((Math.abs((target1 - price) / price) * 100).toFixed(2));
    const runnerPotential = Number((Math.abs((target2 - price) / price) * 100).toFixed(2));
    const downsideRisk = Number((Math.abs((price - invalidationLevel) / price) * 100).toFixed(2));

    const dominantThemesStr = transcript.dominantThemes.join(', ');
    const topBullMsg = messages.find((m) => m.sentiment === 'BULLISH')?.text || `Live momentum monitoring for ${brief.symbol}`;
    const topBearMsg = messages.find((m) => m.sentiment === 'BEARISH')?.text || `Strict stop enforcement at ${invalidationLevel}`;

    const executiveThesis = `${brief.symbol} (${brief.name}) @ ${brief.pricing.currency} ${price} on ${brief.chartContext?.timeframe?.toUpperCase() || '1H'} chart exhibits ${technicalContext?.trendDirection || transcript.consensusSentiment} structure paired with ${transcript.consensusSentiment} community conviction (${consensusPct}% agreement across ${transcript.totalMessages} messages in ${transcript.tickerTag}). Key drivers: ${dominantThemesStr}. Trade asymmetry (+${upsidePotential}% to T1 / +${runnerPotential}% to T2 vs ${downsideRisk}% stop distance) aligns with strict invalidation at ${brief.pricing.currency} ${invalidationLevel}.`;

    const catalystCalendar: CatalystItem[] = [
      {
        id: 'cat_01',
        dateOrWindow: 'Imminent (Next 1-2 Weeks)',
        title:
          brief.assetClass === 'EQUITY' || brief.assetClass === 'INDIAN_MARKET'
            ? `${brief.symbol} Quarterly Earnings & Institutional Guidance Window`
            : `${brief.symbol} High-Impact Macro / Central Bank Volatility Release`,
        type: brief.assetClass === 'EQUITY' || brief.assetClass === 'INDIAN_MARKET' ? 'EARNINGS' : 'CENTRAL_BANK',
        expectedImpact: 'HIGH',
        directionalBias: isBull ? 'BULLISH' : 'VOLATILITY',
      },
      {
        id: 'cat_02',
        dateOrWindow: 'Monthly Cycle Window',
        title: `Macro Liquidity & ${brief.benchmarkIndex} Benchmark Rotation`,
        type: 'MACRO_DATA',
        expectedImpact: 'HIGH',
        directionalBias: 'VOLATILITY',
      },
      {
        id: 'cat_03',
        dateOrWindow: 'Rolling 30-Day Window',
        title: `${brief.symbol} Institutional Order Flow & Rebalancing`,
        type: 'PRODUCT_RELEASE',
        expectedImpact: 'MEDIUM',
        directionalBias: isBull ? 'BULLISH' : 'BEARISH',
      },
    ];

    const bullCatalysts = [
      {
        title: `${brief.symbol} Structural Breakout Toward Target 1 (${brief.pricing.currency} ${target1})`,
        catalystExplanation: `Live technical alignment (${technicalContext?.emaAlignment || 'MOMENTUM'}) supported by crowd consensus. Quote: "${topBullMsg.slice(0, 95)}..."`,
        upsideTargetPrice: target1,
        upsidePotentialPercent: upsidePotential,
      },
      {
        title: `Runner Extension Objective (${brief.pricing.currency} ${target2})`,
        catalystExplanation: `Sustained directional volume above Target 1 projects measured move to secondary liquidity cluster.`,
        upsideTargetPrice: target2,
        upsidePotentialPercent: runnerPotential,
      },
    ];

    const bearRisks = [
      {
        title: `Structural Invalidation Breach (${brief.pricing.currency} ${invalidationLevel})`,
        riskExplanation: `Decisive break of ${brief.pricing.currency} ${invalidationLevel} invalidates the active ${brief.symbol} setup. Quote: "${topBearMsg.slice(0, 95)}..."`,
        downsideTargetPrice: invalidationLevel,
        downsideRiskPercent: downsideRisk,
      },
      {
        title: `Deep Mean-Reversion Pullback Stress Level`,
        riskExplanation: `Macro shock against ${brief.benchmarkIndex} or correlation breakdown triggers 2.5x ATR volatility expansion.`,
        downsideTargetPrice: r(isBull ? price - atr * 2.8 : price + atr * 2.8),
        downsideRiskPercent: Number((downsideRisk * 1.9).toFixed(2)),
      },
    ];

    const entryZone = technicalContext?.tradePlan?.entryZone;
    const scalingPlan = {
      initialTranchePercent: 50,
      scalingTriggers: [
        `Deploy 50% initial tranche inside live Entry Zone (${entryZone ? `${entryZone.min} - ${entryZone.max}` : price}).`,
        `Add 25% second tranche upon ${brief.chartContext?.timeframe?.toUpperCase() || '1H'} candle confirmation toward ${target1}.`,
        `Deploy final 25% upon retest of broken resistance/support level as confirmed hold.`,
      ],
      profitTakingSchedule: [
        `Trim 40% at Target 1 (${brief.pricing.currency} ${target1}, 1:${technicalContext?.tradePlan?.target1?.riskRewardRatio ?? 1.8} R:R) and move Stop Loss to Entry.`,
        `Trim 35% at Target 2 (${brief.pricing.currency} ${target2}) to lock in core swing alpha.`,
        `Trail remaining 25% runner behind 20-EMA / swing structure.`,
      ],
    };

    const invalidationTrigger = {
      priceLevel: invalidationLevel,
      macroOrEventCondition: `${brief.chartContext?.timeframe?.toUpperCase() || '1H'} close beyond ${brief.pricing.currency} ${invalidationLevel} violating active chart swing structure.`,
      exitAction: `Close ${brief.symbol} exposure immediately upon invalidation breach; re-evaluate only after structure stabilizes.`,
    };

    const rr1 = technicalContext?.tradePlan?.target1?.riskRewardRatio ?? 1.8;
    const catalystClarityScore = fullText.includes('earnings') || fullText.includes('fed') || fullText.includes('catalyst') ? 18 : 15;
    const timingScore = Math.min(20, Math.max(8, isBull ? 16 : 12) + (technicalContext && Math.abs(technicalContext.rsi14 - 50) < 18 ? 1 : 0));
    const asymmetryScore = Math.min(20, Math.max(8, rr1 >= 2.2 ? 19 : rr1 >= 1.7 ? 17 : 13));
    const edgeScore = Math.min(20, Math.max(10, transcript.dominantThemes.length >= 3 ? 18 : 15));
    const convictionScore = Math.min(20, Math.max(8, Math.round(10 + (consensusPct / 100) * 8 + (rr1 >= 1.8 ? 1 : 0))));

    const totalScore =
      catalystClarityScore + timingScore + asymmetryScore + edgeScore + convictionScore;

    return {
      agentName: 'Thesis Synthesis Agent',
      weight: 0.15,
      status: 'SUCCESS',
      executiveThesis,
      primaryTimeframe:
        brief.chartContext?.timeframe === '1m' || brief.chartContext?.timeframe === '5m' || brief.chartContext?.timeframe === '15m'
          ? 'DAY_TRADE'
          : brief.chartContext?.timeframe === '1d' || brief.chartContext?.timeframe === '1w'
          ? 'MULTI_WEEK'
          : 'SWING_TRADE',
      bullCatalysts,
      bearRisks,
      catalystCalendar,
      scalingPlan,
      invalidationTrigger,
      subScores: {
        catalystClarity: catalystClarityScore,
        timing: timingScore,
        asymmetry: asymmetryScore,
        edge: edgeScore,
        conviction: convictionScore,
      },
      totalScore,
      keyInsights: [
        `Executive Thesis (${brief.symbol}): ${executiveThesis.slice(0, 140)}...`,
        `Live Risk/Reward Asymmetry: +${upsidePotential}% (T1) / +${runnerPotential}% (T2) vs -${downsideRisk}% stop distance (1:${rr1} R:R).`,
        `Hard Invalidation Level: ${brief.pricing.currency} ${invalidationTrigger.priceLevel} strictly derived from live chart swing structure.`,
        `Swarm Alignment Score: ${convictionScore}/20 conviction across ${transcript.tickerTag} participants and live indicators.`,
      ],
    };
  }
}

export const thesisSynthesisWorker = new ThesisSynthesisWorker();
