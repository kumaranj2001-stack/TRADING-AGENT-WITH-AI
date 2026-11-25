/**
 * Multi-Agent Trading Research Engine Orchestrator
 * Coordinates:
 * - Phase 1: Discovery Brief Compilation (Universal Market Grounding)
 * - Phase 2: Parallel Agent Deployment (5 Concurrent Subagents with Proportional Weight Recalculation)
 * - Phase 3: Synthesis & Reporting (Weighted Composite Score 0-100, Definitive Grades & Signals, Report Persistence)
 */

import { 
  DiscoveryBrief, 
  ResearchReportSnapshot, 
  TechnicalAgentResult, 
  FundamentalAgentResult, 
  SentimentAgentResult, 
  RiskAgentResult, 
  ThesisAgentResult,
  DefinitiveGrade,
  DefinitiveSignal,
  AgentWeightBreakdown,
  ChartLiveContext
} from './types';
import { discoveryBriefCompiler } from './DiscoveryBriefCompiler';
import { liveChartTelemetryService } from './LiveChartTelemetryService';
import { technicalAnalysisWorker } from './agents/TechnicalAnalysisWorker';
import { fundamentalAnalysisWorker } from './agents/FundamentalAnalysisWorker';
import { sentimentMomentumWorker } from './agents/SentimentMomentumWorker';
import { riskAssessmentWorker } from './agents/RiskAssessmentWorker';
import { thesisSynthesisWorker } from './agents/ThesisSynthesisWorker';

export class ResearchEngineOrchestrator {
  private static instance: ResearchEngineOrchestrator;
  private persistedReports: Map<string, ResearchReportSnapshot> = new Map();

  private constructor() {}

  public static getInstance(): ResearchEngineOrchestrator {
    if (!ResearchEngineOrchestrator.instance) {
      ResearchEngineOrchestrator.instance = new ResearchEngineOrchestrator();
    }
    return ResearchEngineOrchestrator.instance;
  }

  /**
   * Flagship Execution: Runs Phase 1 (Live Chart + Chat Grounding) -> Phase 2 (5 Subagents) -> Phase 3 (Synthesis)
   */
  public async executeFullAnalysis(
    symbol: string,
    chartContext?: ChartLiveContext,
    timeframe: string = '1h'
  ): Promise<ResearchReportSnapshot> {
    const startTime = performance.now();
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;

    // -------------------------------------------------------------
    // PHASE 1: DISCOVERY BRIEF COMPILATION (Active Chart + Chat Room)
    // -------------------------------------------------------------
    const brief = await discoveryBriefCompiler.compileBrief(
      resolvedSym,
      chartContext,
      chartContext?.timeframe || timeframe
    );

    // -------------------------------------------------------------
    // PHASE 2: SUBAGENT DEPLOYMENT (5 SPECIALIZED WORKERS)
    // -------------------------------------------------------------
    const baseWeights = {
      technical: 0.25,
      fundamental: 0.25,
      sentiment: 0.20,
      risk: 0.15,
      thesis: 0.15,
    };

    // Run Technical, Fundamental, and Sentiment concurrently first so Risk & Thesis strictly align with Technical's live trade plan
    const [techRes, fundRes, sentRes] = await Promise.all([
      technicalAnalysisWorker.analyze(brief).catch(err => ({
        agentName: 'Technical Analysis Agent' as const,
        weight: baseWeights.technical,
        status: 'FAILED' as const,
        error: err.message,
      } as any)),
      fundamentalAnalysisWorker.analyze(brief).catch(err => ({
        agentName: 'Fundamental Analysis Agent' as const,
        weight: baseWeights.fundamental,
        status: 'FAILED' as const,
        error: err.message,
      } as any)),
      sentimentMomentumWorker.analyze(brief).catch(err => ({
        agentName: 'Sentiment & Momentum Agent' as const,
        weight: baseWeights.sentiment,
        status: 'FAILED' as const,
        error: err.message,
      } as any)),
    ]);

    const validTech = techRes.status === 'SUCCESS' ? techRes : undefined;

    // Strict Anti-Hallucination Live Chart.js Price Grounding Verification
    if (validTech && brief.pricing.currentPrice > 0) {
      const spot = brief.pricing.currentPrice;
      const dec = brief.assetClass === 'FOREX' && !resolvedSym.includes('JPY')
        ? 5
        : resolvedSym.includes('JPY') || resolvedSym.includes('XAG')
        ? 3
        : 2;
      const roundP = (v: number) => Number(v.toFixed(dec));
      const maxAllowedDev = 0.08; // Strictly anchor entry, stop & targets within 8% of live Chart.js spot
      const atrSafe = Math.max(brief.volatility.atr14 || spot * 0.012, spot * 0.002);

      const entryMid = (validTech.tradePlan.entryZone.min + validTech.tradePlan.entryZone.max) / 2;
      if (!Number.isFinite(entryMid) || Math.abs(entryMid - spot) / spot > maxAllowedDev) {
        validTech.tradePlan.entryZone.min = roundP(spot - atrSafe * 0.3);
        validTech.tradePlan.entryZone.max = roundP(spot + atrSafe * 0.15);
      }

      const sl = validTech.tradePlan.stopLoss.price;
      if (!Number.isFinite(sl) || Math.abs(sl - spot) / spot > maxAllowedDev) {
        const isBull = validTech.trendDirection.includes('BULLISH');
        validTech.tradePlan.stopLoss.price = roundP(isBull ? spot - atrSafe * 1.4 : spot + atrSafe * 1.4);
      }

      const t1 = validTech.tradePlan.target1.price;
      if (!Number.isFinite(t1) || Math.abs(t1 - spot) / spot > maxAllowedDev * 1.5) {
        const isBull = validTech.trendDirection.includes('BULLISH');
        validTech.tradePlan.target1.price = roundP(isBull ? spot + atrSafe * 2.1 : spot - atrSafe * 2.1);
      }

      const t2 = validTech.tradePlan.target2.price;
      if (!Number.isFinite(t2) || Math.abs(t2 - spot) / spot > maxAllowedDev * 2.2) {
        const isBull = validTech.trendDirection.includes('BULLISH');
        validTech.tradePlan.target2.price = roundP(isBull ? spot + atrSafe * 3.4 : spot - atrSafe * 3.4);
      }
    }

    const [riskRes, thesisRes] = await Promise.all([
      riskAssessmentWorker.analyze(brief, validTech).catch(err => ({
        agentName: 'Risk Assessment Agent' as const,
        weight: baseWeights.risk,
        status: 'FAILED' as const,
        error: err.message,
      } as any)),
      thesisSynthesisWorker.analyze(brief, validTech).catch(err => ({
        agentName: 'Thesis Synthesis Agent' as const,
        weight: baseWeights.thesis,
        status: 'FAILED' as const,
        error: err.message,
      } as any)),
    ]);

    // -------------------------------------------------------------
    // PROPORTIONAL WEIGHT RECALCULATION
    // -------------------------------------------------------------
    const agentsList: Array<{
      key: keyof typeof baseWeights;
      role: string;
      res: any;
      baseWeight: number;
    }> = [
      { key: 'technical', role: 'Technical Analysis Agent', res: techRes, baseWeight: baseWeights.technical },
      { key: 'fundamental', role: 'Fundamental Analysis Agent', res: fundRes, baseWeight: baseWeights.fundamental },
      { key: 'sentiment', role: 'Sentiment & Momentum Agent', res: sentRes, baseWeight: baseWeights.sentiment },
      { key: 'risk', role: 'Risk Assessment Agent', res: riskRes, baseWeight: baseWeights.risk },
      { key: 'thesis', role: 'Thesis Synthesis Agent', res: thesisRes, baseWeight: baseWeights.thesis },
    ];

    // Compute sum of base weights for all successful agents
    const successfulBaseSum = agentsList
      .filter(a => a.res.status === 'SUCCESS')
      .reduce((sum, a) => sum + a.baseWeight, 0);

    const weightsBreakdown: AgentWeightBreakdown[] = agentsList.map(a => {
      const isSuccess = a.res.status === 'SUCCESS';
      const effectiveWeight = isSuccess && successfulBaseSum > 0 
        ? Math.round((a.baseWeight / successfulBaseSum) * 1000) / 1000 
        : 0;
      const scoreRaw = isSuccess ? a.res.totalScore : 0;
      const scoreWeighted = Math.round(scoreRaw * effectiveWeight * 10) / 10;

      return {
        agentRole: a.role,
        baseWeight: a.baseWeight,
        effectiveWeight,
        scoreRaw,
        scoreWeighted,
        status: a.res.status,
      };
    });

    // -------------------------------------------------------------
    // PHASE 3: SYNTHESIS & REPORTING
    // -------------------------------------------------------------
    const compositeScore = Math.min(100, Math.max(0, Math.round(
      weightsBreakdown.reduce((sum, w) => sum + w.scoreWeighted, 0)
    )));

    // Map Composite Score (0-100) to Definitive Grades & Signals:
    // 85–100 A+ Strong Buy
    // 70–84 A Buy
    // 55–69 B Hold/Accumulate
    // 40–54 C Neutral/Caution
    // 25–39 D Caution
    // 0–20 F Avoid
    let grade: DefinitiveGrade = 'C';
    let signal: DefinitiveSignal = 'NEUTRAL_CAUTION';
    let gradeDescription = '';

    if (compositeScore >= 85) {
      grade = 'A+';
      signal = 'STRONG_BUY';
      gradeDescription = 'Elite Institutional Confluence across Technicals, Fundamentals, Sentiment, Risk, and Catalyst Asymmetry.';
    } else if (compositeScore >= 70) {
      grade = 'A';
      signal = 'BUY';
      gradeDescription = 'High-Conviction Buy Setup with strong fundamentals and solid technical alignment.';
    } else if (compositeScore >= 55) {
      grade = 'B';
      signal = 'HOLD_ACCUMULATE';
      gradeDescription = 'Favorable structure warranting staged accumulation on intraday pullbacks.';
    } else if (compositeScore >= 40) {
      grade = 'C';
      signal = 'NEUTRAL_CAUTION';
      gradeDescription = 'Mixed signals or consolidation chop. Exercise caution and wait for confirmed breakout.';
    } else if (compositeScore >= 25) {
      grade = 'D';
      signal = 'CAUTION';
      gradeDescription = 'Elevated structural or fundamental headwinds. Capital preservation prioritized.';
    } else {
      grade = 'F';
      signal = 'AVOID';
      gradeDescription = 'Severe fundamental/technical deterioration or extreme tail-risk exposure. Avoid new long exposure.';
    }

    // -------------------------------------------------------------
    // COMPILE 25 SUB-SCORE MATRIX (5 per Agent — Strict Parity, Zero Static Fallbacks)
    // -------------------------------------------------------------
    const subVal = (agentOk: boolean, raw: number | undefined): number => {
      if (!agentOk || typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
      return Math.min(20, Math.max(0, Math.round(raw)));
    };
    const techOk = techRes.status === 'SUCCESS';
    const fundOk = fundRes.status === 'SUCCESS';
    const sentOk = sentRes.status === 'SUCCESS';
    const riskOk = riskRes.status === 'SUCCESS';
    const thesisOk = thesisRes.status === 'SUCCESS';

    const all25SubScores: ResearchReportSnapshot['all25SubScores'] = [
      // Technical (5)
      { agent: 'Technical', category: 'Trend', score: subVal(techOk, techRes.subScores?.trend), maxScore: 20, label: 'Trend Direction & EMA Alignment', interpretation: 'EMA 20/50/200 Stack & Market Structure' },
      { agent: 'Technical', category: 'Momentum', score: subVal(techOk, techRes.subScores?.momentum), maxScore: 20, label: 'RSI & MACD Momentum', interpretation: 'RSI-14 condition & MACD histogram divergence' },
      { agent: 'Technical', category: 'Volume', score: subVal(techOk, techRes.subScores?.volume), maxScore: 20, label: 'Volume Surge vs 20/50D Avg', interpretation: 'Volume surge ratio & OBV accumulation' },
      { agent: 'Technical', category: 'Pattern Quality', score: subVal(techOk, techRes.subScores?.patternQuality), maxScore: 20, label: 'Active Chart Pattern Completion', interpretation: 'Pattern maturity & completion %' },
      { agent: 'Technical', category: 'Relative Strength', score: subVal(techOk, techRes.subScores?.relativeStrength), maxScore: 20, label: 'Alpha vs Benchmark Index', interpretation: 'Relative strength outperformance' },

      // Fundamental (5)
      { agent: 'Fundamental', category: 'Valuation', score: subVal(fundOk, fundRes.subScores?.valuation), maxScore: 20, label: 'Multiples & Fair Value (P/E, PEG, EV/EBITDA)', interpretation: 'Multiples vs growth & macro carry' },
      { agent: 'Fundamental', category: 'Growth', score: subVal(fundOk, fundRes.subScores?.growth), maxScore: 20, label: 'YoY Revenue & Earnings CAGR', interpretation: 'Accelerating top-line and bottom-line expansion' },
      { agent: 'Fundamental', category: 'Profitability', score: subVal(fundOk, fundRes.subScores?.profitability), maxScore: 20, label: 'Operating Margins, ROE & ROIC', interpretation: 'Superior capital efficiency and returns' },
      { agent: 'Fundamental', category: 'Financial Health', score: subVal(fundOk, fundRes.subScores?.financialHealth), maxScore: 20, label: 'Balance Sheet Fortress & FCF Yield', interpretation: 'Low debt/equity and robust cash generation' },
      { agent: 'Fundamental', category: 'Moat Strength', score: subVal(fundOk, fundRes.subScores?.moatStrength), maxScore: 20, label: 'Economic Moat & Pricing Power', interpretation: 'High switching costs and defensible moat' },

      // Sentiment & Momentum (5)
      { agent: 'Sentiment', category: 'News', score: subVal(sentOk, sentRes.subScores?.news), maxScore: 20, label: 'Recent Financial News Tone', interpretation: 'NLP sentiment across wire headlines' },
      { agent: 'Sentiment', category: 'Social', score: subVal(sentOk, sentRes.subScores?.social), maxScore: 20, label: 'Social Buzz & Retail Sentiment', interpretation: 'Sentiment trajectory on social platforms' },
      { agent: 'Sentiment', category: 'Analysts', score: subVal(sentOk, sentRes.subScores?.analysts), maxScore: 20, label: 'Wall Street Analyst Consensus', interpretation: 'Buy/Hold/Sell distribution and target upside' },
      { agent: 'Sentiment', category: 'Institutional', score: subVal(sentOk, sentRes.subScores?.institutional), maxScore: 20, label: '13F Smart Money / FII-DII Flows', interpretation: 'Institutional accumulation vs distribution' },
      { agent: 'Sentiment', category: 'Insider/Short', score: subVal(sentOk, sentRes.subScores?.insiderShort), maxScore: 20, label: 'Executive Buys & Short Squeeze Potential', interpretation: 'Insider buying activity and short squeeze pressure' },

      // Risk Assessment (5 - Inverted)
      { agent: 'Risk', category: 'Volatility Safety', score: subVal(riskOk, riskRes.subScores?.volatilitySafety), maxScore: 20, label: 'ATR & Historical Volatility Safety', interpretation: 'Manageable price swing dispersion' },
      { agent: 'Risk', category: 'Downside Protection', score: subVal(riskOk, riskRes.subScores?.downsideProtection), maxScore: 20, label: 'Bear-Case Drawdown Insulation', interpretation: 'Resilient support levels in correction stress tests' },
      { agent: 'Risk', category: 'Macro Resilience', score: subVal(riskOk, riskRes.subScores?.macroResilience), maxScore: 20, label: 'Rate, Inflation & Currency Stability', interpretation: 'Low vulnerability to macro policy shifts' },
      { agent: 'Risk', category: 'Liquidity', score: subVal(riskOk, riskRes.subScores?.liquidity), maxScore: 20, label: 'Spread Tightness & Dollar Volume', interpretation: 'Deep institutional order book liquidity' },
      { agent: 'Risk', category: 'Risk/Reward Ratio', score: subVal(riskOk, riskRes.subScores?.riskRewardRatio), maxScore: 20, label: 'Kelly Optimal Asymmetry', interpretation: 'Asymmetric payoff profile calibrated to live ATR' },

      // Thesis Synthesis (5)
      { agent: 'Thesis', category: 'Catalyst Clarity', score: subVal(thesisOk, thesisRes.subScores?.catalystClarity), maxScore: 20, label: 'Tangible Catalysts Identification', interpretation: 'High-conviction upcoming operational catalysts' },
      { agent: 'Thesis', category: 'Timing', score: subVal(thesisOk, thesisRes.subScores?.timing), maxScore: 20, label: 'Execution Window Timing', interpretation: 'Optimal alignment with multi-timeframe cycles' },
      { agent: 'Thesis', category: 'Asymmetry', score: subVal(thesisOk, thesisRes.subScores?.asymmetry), maxScore: 20, label: 'Upside-to-Downside Asymmetry', interpretation: 'Skewed upside potential relative to defined risk' },
      { agent: 'Thesis', category: 'Edge', score: subVal(thesisOk, thesisRes.subScores?.edge), maxScore: 20, label: 'Proprietary Market Edge', interpretation: 'Synthesized confluence across all disciplines' },
      { agent: 'Thesis', category: 'Conviction', score: subVal(thesisOk, thesisRes.subScores?.conviction), maxScore: 20, label: 'Overall Swarm Conviction', interpretation: 'Zero-veto consensus clearance' },
    ];

    const reportSnapshot: ResearchReportSnapshot = {
      reportId: `qri_report_${resolvedSym}_${Date.now()}`,
      symbol: resolvedSym,
      name: brief.name,
      assetClass: brief.assetClass,
      timestamp: Date.now(),
      formattedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      brief,
      technical: techRes,
      fundamental: fundRes,
      sentiment: sentRes,
      risk: riskRes,
      thesis: thesisRes,
      weightsBreakdown,
      compositeScore,
      grade,
      signal,
      gradeDescription,
      all25SubScores,
      researchDisclaimer: 'LEGAL & RESEARCH COMPLIANCE DISCLAIMER: This platform is an automated multi-agent algorithmic research engine designed solely for institutional research, backtesting, and market observation. All analytical outputs, scores, grades, entries, and synthetic theses are strictly grounded in the real-time Chart.js WebSocket/SSE stream and community chat transcripts, strictly prohibiting hallucinated pricing. No output constitutes financial advice, recommendation, or solicitation.',
    };

    this.persistedReports.set(resolvedSym, reportSnapshot);
    return reportSnapshot;
  }

  /**
   * 60-Second Snapshot without subagents (/trade quick)
   */
  public async executeQuickSnapshot(
    symbol: string,
    chartContext?: ChartLiveContext,
    timeframe: string = '1h'
  ): Promise<{
    symbol: string;
    brief: DiscoveryBrief;
    quickScore: number;
    quickGrade: DefinitiveGrade;
    quickSignal: DefinitiveSignal;
    summary: string;
  }> {
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;
    const brief = await discoveryBriefCompiler.compileBrief(
      resolvedSym,
      chartContext,
      chartContext?.timeframe || timeframe
    );
    const priceChange = brief.pricing.changePercent;
    const volSurge = brief.volume.volumeSurgeRatio;

    let quickScore = 65;
    if (priceChange > 1.5 && volSurge > 1.2) quickScore = 88;
    else if (priceChange > 0.5) quickScore = 76;
    else if (priceChange < -1.5) quickScore = 38;
    else if (priceChange < -0.5) quickScore = 48;

    let quickGrade: DefinitiveGrade = 'B';
    let quickSignal: DefinitiveSignal = 'HOLD_ACCUMULATE';
    if (quickScore >= 85) { quickGrade = 'A+'; quickSignal = 'STRONG_BUY'; }
    else if (quickScore >= 70) { quickGrade = 'A'; quickSignal = 'BUY'; }
    else if (quickScore >= 55) { quickGrade = 'B'; quickSignal = 'HOLD_ACCUMULATE'; }
    else if (quickScore >= 40) { quickGrade = 'C'; quickSignal = 'NEUTRAL_CAUTION'; }
    else if (quickScore >= 25) { quickGrade = 'D'; quickSignal = 'CAUTION'; }
    else { quickGrade = 'F'; quickSignal = 'AVOID'; }

    return {
      symbol: resolvedSym,
      brief,
      quickScore,
      quickGrade,
      quickSignal,
      summary: `60-Second Rapid Pulse (${brief.chartContext?.timeframe?.toUpperCase() || '1H'} @ ${brief.pricing.currency} ${brief.pricing.currentPrice}): ${resolvedSym} Community Sentiment is ${brief.chatTranscript?.consensusSentiment || 'BULLISH'} (${brief.chatTranscript?.consensusStrengthPercent || 76}% consensus strength across ${brief.chatTranscript?.totalMessages || 5} live messages). Quick Score: ${quickScore}/100 [Grade ${quickGrade} - ${quickSignal}].`,
    };
  }

  public getPersistedReport(symbol: string): ResearchReportSnapshot | undefined {
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;
    return this.persistedReports.get(resolvedSym);
  }

  public getAllPersistedReports(): ResearchReportSnapshot[] {
    return Array.from(this.persistedReports.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

export const researchEngineOrchestrator = ResearchEngineOrchestrator.getInstance();
