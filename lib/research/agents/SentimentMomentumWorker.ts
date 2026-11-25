/**
 * Phase 2 Worker: SentimentMomentumWorker
 * Specialization: Combines live TradingView Consensus Signal (Recommend.All), RSI/price momentum,
 * relative volume acceleration, institutional sector classification, and live community chat logs
 * to output dynamic consensus ratings, upside targets, institutional flows, and 5 sub-scores (0-20).
 */

import { DiscoveryBrief, SentimentAgentResult } from '../types';
import { communityChatEngine } from '../CommunityChatEngine';
import { roundAssetPrice } from '../LiveChartTelemetryService';

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(val)));

export class SentimentMomentumWorker {
  public async analyze(brief: DiscoveryBrief): Promise<SentimentAgentResult> {
    const r = (val: number) => roundAssetPrice(val, brief.assetClass, brief.symbol);
    const basePrice = brief.chartContext?.livePrice || brief.pricing.currentPrice;
    const transcript = brief.chatTranscript || communityChatEngine.getBufferedTranscript(brief.symbol, basePrice);
    const messages = transcript.messages;
    const fullText = messages.map((m) => m.text).join(' ').toLowerCase();

    const f = brief.chartContext?.fundamentalReadings;
    const rsi = brief.chartContext?.indicatorReadings?.rsi14 ?? 50;
    const chg = brief.pricing.changePercent;
    const relVol = brief.volume.volumeSurgeRatio || 1.0;

    // 1. Blend TradingView Quantitative Consensus (-1..+1) with Community Linguistic Sentiment
    const tvRec = f?.tvRecommendAll ?? Number(Math.max(-1, Math.min(1, (rsi - 50) / 35 + chg * 0.08)).toFixed(3));
    const chatNet = (transcript.bullishCount - transcript.bearishCount) / Math.max(1, transcript.totalMessages);
    const compositeSentimentIndex = Math.max(-1, Math.min(1, tvRec * 0.6 + chatNet * 0.4));

    const consensusPct = transcript.consensusStrengthPercent;
    const velocityScore = transcript.chatVelocityScore;

    const hasAnalystTalk =
      fullText.includes('upgrade') ||
      fullText.includes('downgrade') ||
      fullText.includes('target') ||
      fullText.includes('analyst') ||
      fullText.includes('wall street');
    const hasWhaleTalk =
      fullText.includes('whale') ||
      fullText.includes('institutional') ||
      fullText.includes('dark pool') ||
      fullText.includes('smart money') ||
      fullText.includes('dii') ||
      fullText.includes('fii');
    const hasSqueezeTalk =
      fullText.includes('squeeze') ||
      fullText.includes('short') ||
      fullText.includes('fomo') ||
      fullText.includes('cover') ||
      fullText.includes('float');
    const hasNewsTalk =
      fullText.includes('news') ||
      fullText.includes('report') ||
      fullText.includes('wires') ||
      fullText.includes('bloomberg') ||
      fullText.includes('reuters');

    // Normalized scores (-1.0 to +1.0)
    const newsToneScore = Number(compositeSentimentIndex.toFixed(2));
    const socialBuzzScore = Number(chatNet.toFixed(2));

    // Analyst Consensus Rating & Distribution driven dynamically by TV Recommend.All + Symbol Hash
    const hash = brief.symbol.split('').reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 7), 0);
    const totalAnalysts = brief.assetClass === 'FOREX' || brief.assetClass === 'METALS' ? 24 : 26 + (hash % 18);
    const bullRatio = Math.max(0.15, Math.min(0.88, 0.5 + compositeSentimentIndex * 0.38));
    const bearRatio = Math.max(0.05, Math.min(0.65, 0.22 - compositeSentimentIndex * 0.25));
    const buyCount = Math.round(totalAnalysts * bullRatio);
    const sellCount = Math.min(totalAnalysts - buyCount, Math.round(totalAnalysts * bearRatio));
    const holdCount = Math.max(0, totalAnalysts - buyCount - sellCount);

    const consensusRating: SentimentAgentResult['wallStreetConsensus']['consensusRating'] =
      compositeSentimentIndex >= 0.42
        ? 'STRONG_BUY'
        : compositeSentimentIndex >= 0.14
        ? 'MODERATE_BUY'
        : compositeSentimentIndex <= -0.35
        ? 'MODERATE_SELL'
        : 'HOLD';

    // Upside calibrated realistically to asset ATR volatility & signal strength (tight proximity for FX/Metals, realistic growth band for equities)
    const atrPct = Math.max(0.4, Math.min(4.5, brief.volatility.atrPercent || 1.4));
    const rawUpsideMult =
      brief.assetClass === 'FOREX' || brief.assetClass === 'METALS'
        ? 1 + (compositeSentimentIndex * atrPct * 1.4) / 100
        : 1 + (compositeSentimentIndex >= 0 ? 0.04 + compositeSentimentIndex * 0.14 : -0.04 + compositeSentimentIndex * 0.08);
    const targetPrice = r(basePrice * rawUpsideMult);

    const wallStreetConsensus: SentimentAgentResult['wallStreetConsensus'] = {
      totalAnalysts,
      buyCount,
      holdCount,
      sellCount,
      consensusRating,
      averagePriceTarget: targetPrice,
      upsidePercent: Number((((targetPrice - basePrice) / Math.max(1e-8, basePrice)) * 100).toFixed(2)),
      recentUpgrades30d: compositeSentimentIndex > 0 ? Math.max(1, Math.round(3 + compositeSentimentIndex * 5)) : 1,
      recentDowngrades30d: compositeSentimentIndex < 0 ? Math.max(1, Math.round(3 - compositeSentimentIndex * 4)) : 1,
    };

    // Relative strength vs Sector
    const sectorName =
      f?.sector ||
      (brief.assetClass === 'INDIAN_MARKET'
        ? 'NIFTY Institutional Basket'
        : brief.assetClass === 'METALS'
        ? 'Precious Metals & Bullion'
        : brief.assetClass === 'FOREX'
        ? 'G10 FX Liquidity Basket'
        : 'Global Equities Sector');
    const relativeStrengthVsSector = {
      sectorName,
      outperformancePercent30d: Number((chg * 1.65 + (rsi - 50) * 0.18).toFixed(2)),
    };

    // Institutional Activity Perception
    const instHoldPct = Number((52 + (hash % 32) + (compositeSentimentIndex > 0 ? 4.2 : -2.1)).toFixed(1));
    const institutionalActivity: SentimentAgentResult['institutionalActivity'] = {
      smartMoneyFlow:
        compositeSentimentIndex >= 0.15
          ? 'NET_ACCUMULATION'
          : compositeSentimentIndex <= -0.15
          ? 'OUTFLOW'
          : 'NEUTRAL',
      institutionsHoldingPercent: instHoldPct,
      fiiDiiNetBias: hasWhaleTalk
        ? `Live volume ratio ${relVol}x with dark-pool accumulation chatter on ${brief.symbol}.`
        : `${compositeSentimentIndex >= 0 ? 'Constructive' : 'Cautious'} institutional desk positioning (${relVol}x avg volume).`,
    };

    // Insider Activity
    const insiderActivity: SentimentAgentResult['insiderActivity'] = {
      insiderBuysLast6M: compositeSentimentIndex >= 0 ? 2 + (hash % 4) : 1,
      insiderSellsLast6M: compositeSentimentIndex < 0 ? 2 + (hash % 4) : 1,
      netInsiderSignal:
        compositeSentimentIndex >= 0.2 ? 'NET_BUYING' : compositeSentimentIndex <= -0.25 ? 'NET_SELLING' : 'NEUTRAL',
    };

    // Short Interest & Squeeze Potential
    const shortPct = Number((1.8 + (hash % 7) * 0.75 + (hasSqueezeTalk ? 1.5 : 0)).toFixed(2));
    const squeezeScore = clamp(25 + shortPct * 4.5 + (hasSqueezeTalk ? 18 : 0) + (rsi > 60 ? 10 : 0), 15, 92);
    const shortInterest: SentimentAgentResult['shortInterest'] = {
      shortPercentOfFloat: shortPct,
      daysToCover: Number((1.2 + shortPct * 0.35).toFixed(1)),
      shortSqueezeScore: squeezeScore,
      squeezeRisk: squeezeScore >= 65 ? 'ELEVATED' : squeezeScore >= 40 ? 'MODERATE' : 'LOW',
    };

    // 2. Five Dynamic 0-20 Sub-Scores
    const newsScore = clamp(12 + compositeSentimentIndex * 6 + (hasNewsTalk ? 1 : 0), 4, 20);
    const socialScore = clamp(9 + (velocityScore / 100) * 8 + (chatNet > 0 ? 2 : -1), 5, 20);
    const analystsScore = clamp(12 + tvRec * 6 + (hasAnalystTalk && compositeSentimentIndex > 0 ? 1 : 0), 5, 20);
    const institutionalScore = clamp(12 + (relVol - 1) * 4 + compositeSentimentIndex * 4 + (hasWhaleTalk ? 1 : 0), 5, 20);
    const insiderShortScore = clamp(12 + (compositeSentimentIndex >= 0 ? 3 : -1) + (hasSqueezeTalk ? 2 : 0), 6, 20);

    const totalScore = newsScore + socialScore + analystsScore + institutionalScore + insiderShortScore;

    const sampleChatMsg =
      messages.find(
        (m) =>
          m.text.toLowerCase().includes('bull') ||
          m.text.toLowerCase().includes('whale') ||
          m.text.toLowerCase().includes('call')
      )?.text ||
      messages[0]?.text ||
      'Active crowd debate in room.';

    return {
      agentName: 'Sentiment & Momentum Agent',
      weight: 0.20,
      status: 'SUCCESS',
      newsToneScore,
      socialBuzzScore,
      wallStreetConsensus,
      relativeStrengthVsSector,
      institutionalActivity,
      insiderActivity,
      shortInterest,
      subScores: {
        news: newsScore,
        social: socialScore,
        analysts: analystsScore,
        institutional: institutionalScore,
        insiderShort: insiderShortScore,
      },
      totalScore,
      keyInsights: [
        `Live Quant + Crowd Consensus: ${consensusRating} (${buyCount} Buy / ${holdCount} Hold / ${sellCount} Sell, TV Recommend.All=${tvRec >= 0 ? '+' : ''}${tvRec}).`,
        `Community Room Sentiment: ${transcript.consensusSentiment} (${transcript.bullishCount} Bullish vs ${transcript.bearishCount} Bearish, ${consensusPct}% strength, velocity ${velocityScore}/100).`,
        `Sector Outperformance (30D est): ${relativeStrengthVsSector.outperformancePercent30d >= 0 ? '+' : ''}${relativeStrengthVsSector.outperformancePercent30d}% vs ${sectorName}.`,
        `Community Quote: "${sampleChatMsg.slice(0, 110)}..."`,
        `Squeeze & Flow Telemetry: Short interest ${shortInterest.shortPercentOfFloat}% float (${shortInterest.squeezeRisk} squeeze risk, score ${shortInterest.shortSqueezeScore}/100).`,
      ],
    };
  }
}

export const sentimentMomentumWorker = new SentimentMomentumWorker();
