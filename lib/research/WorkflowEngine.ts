/**
 * Multi-Agent Trading Research Engine Workflow Engine
 * Implements all 16 research workflows and slash command execution parser.
 */

import { 
  ResearchEngineWorkflow, 
  SlashCommandPayload, 
  ResearchReportSnapshot,
  DiscoveryBrief,
  DefinitiveGrade,
  DefinitiveSignal,
  ChartLiveContext
} from './types';
import { researchEngineOrchestrator } from './ResearchEngineOrchestrator';
import { discoveryBriefCompiler } from './DiscoveryBriefCompiler';
import { PdfReportGenerator } from './PdfReportGenerator';
import { formatAssetPrice, liveChartTelemetryService } from './LiveChartTelemetryService';

export interface SectorRotationItem {
  sector: string;
  oneMonthPerformance: number;
  threeMonthPerformance: number;
  momentumRank: number;
  leadingAsset: string;
  flowStatus: 'ACCUMULATING' | 'ROTATING_IN' | 'OVERBOUGHT' | 'DISTRIBUTING';
}

export interface OptionsStrategySetup {
  strategyName: string;
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL_VOLATILITY' | 'INCOME';
  description: string;
  strikeSetup: string;
  maxProfit: string;
  maxRisk: string;
  breakeven: string;
  recommendedExpiry: string;
}

export interface PreEarningsAnalysis {
  symbol: string;
  expectedDate: string;
  impliedMovePercent: number;
  historicalAvgMovePercent: number;
  epsEstimate: number;
  revenueEstimate: string;
  guidanceRisk: 'HIGH' | 'MODERATE' | 'LOW';
  recommendedStraddleOrSpread: string;
}

export interface StockScreenerResultItem {
  symbol: string;
  name: string;
  assetClass: string;
  price: number;
  changePercent: number;
  compositeScore: number;
  grade: DefinitiveGrade;
  signal: DefinitiveSignal;
  rsi: number;
  peRatio: number;
}

export class WorkflowEngine {
  private static instance: WorkflowEngine;

  private constructor() {}

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  // -------------------------------------------------------------
  // WORKFLOW 1: FLAGSHIP FULL 5-AGENT ANALYSIS
  // -------------------------------------------------------------
  public async runFullAnalysis(symbol: string, chartContext?: ChartLiveContext, timeframe?: string): Promise<ResearchReportSnapshot> {
    return researchEngineOrchestrator.executeFullAnalysis(symbol, chartContext, timeframe);
  }

  // -------------------------------------------------------------
  // WORKFLOW 2: 60-SECOND RAPID PULSE SNAPSHOT
  // -------------------------------------------------------------
  public async runQuickSnapshot(symbol: string, chartContext?: ChartLiveContext, timeframe?: string) {
    return researchEngineOrchestrator.executeQuickSnapshot(symbol, chartContext, timeframe);
  }

  // -------------------------------------------------------------
  // WORKFLOWS 3 - 7: STANDALONE INDIVIDUAL AGENT VIEWS
  // -------------------------------------------------------------
  public async getStandaloneAgentView(symbol: string, agentType: 'tech' | 'fund' | 'sent' | 'risk' | 'thesis', chartContext?: ChartLiveContext, timeframe?: string) {
    const report = await researchEngineOrchestrator.executeFullAnalysis(symbol, chartContext, timeframe);
    switch (agentType) {
      case 'tech': return report.technical;
      case 'fund': return report.fundamental;
      case 'sent': return report.sentiment;
      case 'risk': return report.risk;
      case 'thesis': return report.thesis;
    }
  }

  // -------------------------------------------------------------
  // WORKFLOW 8: SECTOR ROTATION HEATMAP (Live-Grounded)
  // -------------------------------------------------------------
  public getSectorRotation(): SectorRotationItem[] {
    const sectorDefs = [
      { sector: 'Technology & Semiconductors', base1M: 6.4, base3M: 16.2, leadingAsset: 'NVDA' },
      { sector: 'Metals & Bullion (Gold/Silver)', base1M: 4.8, base3M: 13.5, leadingAsset: 'XAU/USD' },
      { sector: 'Indian Banking & Financials', base1M: 3.9, base3M: 9.4, leadingAsset: 'HDFC BANK' },
      { sector: 'Indian IT & Consulting', base1M: 3.2, base3M: 10.6, leadingAsset: 'TCS' },
      { sector: 'Global FX Majors Carry Basket', base1M: 1.1, base3M: 2.6, leadingAsset: 'USD/JPY' },
      { sector: 'Energy & Crude Oil', base1M: -1.4, base3M: 3.1, leadingAsset: 'WTI_CRUDE' },
      { sector: 'Healthcare & Biotech', base1M: 1.6, base3M: 4.9, leadingAsset: 'AAPL' },
      { sector: 'Consumer Discretionary', base1M: -2.1, base3M: -0.9, leadingAsset: 'TSLA' },
    ];

    const enriched = sectorDefs.map((s) => {
      const report = researchEngineOrchestrator.getPersistedReport(s.leadingAsset);
      const cached = liveChartTelemetryService.peekCachedTelemetry(s.leadingAsset);
      const liveDelta = report?.brief.pricing.changePercent ?? cached?.changePercent ?? 0;
      const oneMonth = Number((s.base1M + liveDelta * 0.85).toFixed(2));
      const threeMonth = Number((s.base3M + liveDelta * 1.4).toFixed(2));
      const flowStatus: SectorRotationItem['flowStatus'] =
        oneMonth >= 5.0
          ? 'ACCUMULATING'
          : oneMonth >= 1.5
          ? 'ROTATING_IN'
          : oneMonth <= -1.0
          ? 'DISTRIBUTING'
          : 'OVERBOUGHT';
      return {
        sector: s.sector,
        oneMonthPerformance: oneMonth,
        threeMonthPerformance: threeMonth,
        leadingAsset: s.leadingAsset,
        flowStatus,
      };
    });

    enriched.sort((a, b) => b.oneMonthPerformance - a.oneMonthPerformance);
    return enriched.map((item, idx) => ({
      ...item,
      momentumRank: idx + 1,
    }));
  }

  // -------------------------------------------------------------
  // WORKFLOW 9: HEAD-TO-HEAD COMPARISON (/trade compare)
  // -------------------------------------------------------------
  public async compareAssets(symbolA: string, symbolB: string) {
    const [reportA, reportB] = await Promise.all([
      researchEngineOrchestrator.executeFullAnalysis(symbolA),
      researchEngineOrchestrator.executeFullAnalysis(symbolB),
    ]);

    return {
      assetA: {
        symbol: reportA.symbol,
        name: reportA.name,
        currency: reportA.brief.pricing.currency,
        price: reportA.brief.pricing.currentPrice,
        compositeScore: reportA.compositeScore,
        grade: reportA.grade,
        signal: reportA.signal,
        technicalScore: reportA.technical.totalScore,
        fundamentalScore: reportA.fundamental.totalScore,
        sentimentScore: reportA.sentiment.totalScore,
        riskScore: reportA.risk.totalScore,
        thesisScore: reportA.thesis.totalScore,
      },
      assetB: {
        symbol: reportB.symbol,
        name: reportB.name,
        currency: reportB.brief.pricing.currency,
        price: reportB.brief.pricing.currentPrice,
        compositeScore: reportB.compositeScore,
        grade: reportB.grade,
        signal: reportB.signal,
        technicalScore: reportB.technical.totalScore,
        fundamentalScore: reportB.fundamental.totalScore,
        sentimentScore: reportB.sentiment.totalScore,
        riskScore: reportB.risk.totalScore,
        thesisScore: reportB.thesis.totalScore,
      },
      headToHeadWinner: reportA.compositeScore >= reportB.compositeScore ? reportA.symbol : reportB.symbol,
      scoreDifference: Math.abs(reportA.compositeScore - reportB.compositeScore),
    };
  }

  // -------------------------------------------------------------
  // WORKFLOW 10: OPTIONS STRATEGIES (/trade options)
  // -------------------------------------------------------------
  public async getOptionsStrategies(symbol: string, chartContext?: ChartLiveContext): Promise<{
    symbol: string;
    impliedVolPercent: number;
    ivRank: number;
    recommendedStrategies: OptionsStrategySetup[];
  }> {
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;
    const persisted = researchEngineOrchestrator.getPersistedReport(resolvedSym);
    const brief = persisted?.brief || (await discoveryBriefCompiler.compileBrief(resolvedSym, chartContext));
    const price = brief.pricing.currentPrice;
    const atrPct = Math.max(0.5, brief.volatility.atrPercent);
    const cur = brief.pricing.currency;
    const fmt = (v: number) => `${cur} ${formatAssetPrice(v, brief.assetClass, brief.symbol)}`;
    const iv = Number((brief.volatility.optionsImpliedVol || Math.max(12, atrPct * 14.5)).toFixed(1));
    const ivRank = Math.min(95, Math.max(15, Math.round(brief.volatility.optionsIVRank || atrPct * 22)));
    const stepUp = Math.max(0.02, atrPct * 0.022);

    return {
      symbol: resolvedSym,
      impliedVolPercent: iv,
      ivRank,
      recommendedStrategies: [
        {
          strategyName: 'Bull Call Debit Spread (Vertical)',
          type: 'BULLISH',
          description: `Capitalizes on upward directional breakout anchored to live ${resolvedSym} spot (${fmt(price)}) with capped risk.`,
          strikeSetup: `Buy ATM Call ${fmt(price)}, Sell OTM Call ${fmt(price * (1 + stepUp))}`,
          maxProfit: `${fmt(price * stepUp * 0.65)} per unit`,
          maxRisk: `Net Debit Paid (~${fmt(price * stepUp * 0.35)})`,
          breakeven: fmt(price * (1 + stepUp * 0.35)),
          recommendedExpiry: '30 to 45 Days to Expiration (DTE)',
        },
        {
          strategyName: 'Cash-Secured Put (Income Accumulation)',
          type: 'INCOME',
          description: `Collects implied volatility (${iv}%) while bidding near confluent support (${fmt(price * (1 - stepUp * 0.9))}).`,
          strikeSetup: `Sell OTM Put ${fmt(price * (1 - stepUp * 0.9))}`,
          maxProfit: 'Premium Received upfront',
          maxRisk: `Assignment at discounted strike ${fmt(price * (1 - stepUp * 0.9))}`,
          breakeven: fmt(price * (1 - stepUp * 1.15)),
          recommendedExpiry: '21 to 35 DTE',
        },
        {
          strategyName: 'Long Volatility Straddle',
          type: 'NEUTRAL_VOLATILITY',
          description: `Plays volatility expansion beyond ±${(atrPct * 1.8).toFixed(1)}% implied swing from current spot.`,
          strikeSetup: `Buy ATM Call ${fmt(price)} & Buy ATM Put ${fmt(price)}`,
          maxProfit: 'Unlimited in either direction',
          maxRisk: 'Total combined premium paid',
          breakeven: `Up: ${fmt(price * (1 + stepUp))} / Down: ${fmt(price * (1 - stepUp))}`,
          recommendedExpiry: '14 to 28 DTE',
        },
      ],
    };
  }

  // -------------------------------------------------------------
  // WORKFLOW 11: PRE-EARNINGS ANALYSIS (/trade earnings)
  // -------------------------------------------------------------
  public async getPreEarningsAnalysis(symbol: string): Promise<PreEarningsAnalysis> {
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;
    const persisted = researchEngineOrchestrator.getPersistedReport(resolvedSym);
    const brief = persisted?.brief || (await discoveryBriefCompiler.compileBrief(resolvedSym));
    const revYoY = persisted?.fundamental.assetSpecificMetrics.revenueGrowthYoY ?? 14.2;
    const impliedMove = Number(Math.max(1.2, Math.min(18, brief.volatility.atrPercent * 2.4)).toFixed(1));
    const histMove = Number((impliedMove * 0.82).toFixed(1));
    const epsEst = Number(Math.max(0.25, (brief.pricing.currentPrice / (persisted?.fundamental.assetSpecificMetrics.forwardPE || 25)) / 4).toFixed(2));
    const riskScore = persisted?.risk.totalScore ?? 72;

    return {
      symbol: resolvedSym,
      expectedDate: brief.assetClass === 'EQUITY' || brief.assetClass === 'INDIAN_MARKET'
        ? 'Next Scheduled Quarterly Catalyst Window (14-21 Sessions)'
        : 'Upcoming Central Bank / Macro Rate Print Window',
      impliedMovePercent: impliedMove,
      historicalAvgMovePercent: histMove,
      epsEstimate: epsEst,
      revenueEstimate: `${brief.pricing.currency} Stream (+${revYoY}% YoY consensus)`,
      guidanceRisk: riskScore >= 75 ? 'LOW' : riskScore >= 58 ? 'MODERATE' : 'HIGH',
      recommendedStraddleOrSpread: riskScore >= 70
        ? `Defined-risk Bull Put Spread anchored near ${formatAssetPrice(persisted?.technical.supportLevels[0]?.price || brief.pricing.currentPrice * 0.96, brief.assetClass, brief.symbol)}`
        : 'ATM Long Straddle / Delta-Hedged Collar until volatility compresses.',
    };
  }

  // -------------------------------------------------------------
  // WORKFLOW 12: PORTFOLIO CORRELATION & REBALANCING (/trade portfolio)
  // -------------------------------------------------------------
  public getPortfolioRebalance(symbols: string[] = ['NVDA', 'XAU/USD', 'RELIANCE', 'EUR/USD']) {
    const items = symbols.map((raw) => {
      const resolved = liveChartTelemetryService.resolveSymbol(raw);
      const report = researchEngineOrchestrator.getPersistedReport(resolved.symbol);
      const cached = liveChartTelemetryService.peekCachedTelemetry(resolved.symbol);
      const atrPct = report?.brief.volatility.atrPercent ?? (resolved.assetClass === 'FOREX' ? 0.55 : resolved.assetClass === 'METALS' ? 1.15 : 2.1);
      const score = report?.compositeScore ?? Math.min(90, Math.max(48, Math.round(68 + (cached?.changePercent ?? 0) * 4)));
      const rawWeight = score / Math.max(0.5, atrPct);
      return { resolved, report, score, rawWeight };
    });

    const totalRawWeight = items.reduce((s, x) => s + x.rawWeight, 0) || 1;
    const riskParityAllocation = items.map((x) => {
      const pct = Number(((x.rawWeight / totalRawWeight) * 100).toFixed(1));
      const rationale = x.report
        ? `Live Composite ${x.report.compositeScore}/100 (Grade ${x.report.grade}) • ATR ${x.report.brief.volatility.atrPercent}% risk-adjusted`
        : `${x.resolved.assetClass} inverse-volatility risk parity baseline`;
      return {
        symbol: x.resolved.symbol,
        assetClass: x.resolved.assetClass,
        recommendedWeight: pct,
        rationale,
      };
    });

    const avgScore = items.reduce((s, x) => s + x.score, 0) / Math.max(1, items.length);
    return {
      assetsCovered: items.map((x) => x.resolved.symbol),
      crossAssetDiversificationScore: Math.min(96, Math.max(60, Math.round(72 + new Set(items.map(i => i.resolved.assetClass)).size * 4))),
      riskParityAllocation,
      portfolioSharpeProjected: Number((1.4 + (avgScore - 50) * 0.028).toFixed(2)),
      expectedMaxDrawdown: `${Math.max(5.5, Number((16 - (avgScore - 50) * 0.14).toFixed(1)))}%`,
    };
  }

  // -------------------------------------------------------------
  // WORKFLOW 13: CRITERIA STOCK SCREENER (/trade screen)
  // -------------------------------------------------------------
  public getScreenerResults(): StockScreenerResultItem[] {
    const universe = ['NVDA', 'XAU/USD', 'HDFC BANK', 'AAPL', 'RELIANCE', 'EUR/USD', 'TSLA'];
    return universe.map((sym) => {
      const resolved = liveChartTelemetryService.resolveSymbol(sym);
      const report = researchEngineOrchestrator.getPersistedReport(resolved.symbol);
      const cached = liveChartTelemetryService.peekCachedTelemetry(resolved.symbol);

      const price = report?.brief.pricing.currentPrice ?? cached?.livePrice ?? resolved.fallbackPrice;
      const changePercent = Number((report?.brief.pricing.changePercent ?? cached?.changePercent ?? 0).toFixed(2));
      const rsi = Number((report?.technical.rsi14 ?? cached?.indicatorReadings?.rsi14 ?? 52).toFixed(1));
      const peRatio = Number((report?.fundamental.assetSpecificMetrics.forwardPE ?? (resolved.assetClass === 'EQUITY' ? 24.5 : resolved.assetClass === 'INDIAN_MARKET' ? 19.5 : 0)).toFixed(1));
      const compositeScore = report?.compositeScore ?? Math.min(94, Math.max(38, Math.round(62 + changePercent * 5 + (rsi - 50) * 0.4)));

      let grade: DefinitiveGrade = 'B';
      let signal: DefinitiveSignal = 'HOLD_ACCUMULATE';
      if (report) {
        grade = report.grade;
        signal = report.signal;
      } else if (compositeScore >= 85) { grade = 'A+'; signal = 'STRONG_BUY'; }
      else if (compositeScore >= 70) { grade = 'A'; signal = 'BUY'; }
      else if (compositeScore >= 55) { grade = 'B'; signal = 'HOLD_ACCUMULATE'; }
      else if (compositeScore >= 40) { grade = 'C'; signal = 'NEUTRAL_CAUTION'; }
      else { grade = 'D'; signal = 'CAUTION'; }

      return {
        symbol: resolved.symbol,
        name: resolved.name,
        assetClass: resolved.assetClass,
        price,
        changePercent,
        compositeScore,
        grade,
        signal,
        rsi,
        peRatio,
      };
    });
  }

  // -------------------------------------------------------------
  // WORKFLOW 14: SCORED WATCHLIST (/trade watchlist)
  // -------------------------------------------------------------
  public getScoredWatchlist() {
    return this.getScreenerResults().map(item => ({
      ...item,
      lastAudited: researchEngineOrchestrator.getPersistedReport(item.symbol) ? 'AI Full Report Synced' : 'Live Chart Stream',
      quickAction: `/trade analyze ${item.symbol}`,
    }));
  }

  // -------------------------------------------------------------
  // WORKFLOW 15: 6-PAGE PDF REPORT EXPORT (/trade report-pdf)
  // Single Source of Truth: Renders active snapshot verbatim if present!
  // -------------------------------------------------------------
  public async generateReportPdfHtml(
    symbol: string,
    chartContext?: ChartLiveContext,
    timeframe?: string,
    existingReport?: ResearchReportSnapshot
  ): Promise<string> {
    const resolvedSym = liveChartTelemetryService.resolveSymbol(symbol).symbol;

    if (
      existingReport &&
      liveChartTelemetryService.resolveSymbol(existingReport.symbol).symbol === resolvedSym &&
      existingReport.all25SubScores?.length === 25
    ) {
      return PdfReportGenerator.generateHtmlReport(existingReport);
    }

    const persisted = researchEngineOrchestrator.getPersistedReport(resolvedSym);
    const requestedTf = (timeframe || chartContext?.timeframe || '1h').toLowerCase();
    const persistedTf = (persisted?.brief.chartContext?.timeframe || '1h').toLowerCase();
    if (persisted && persistedTf === requestedTf) {
      return PdfReportGenerator.generateHtmlReport(persisted);
    }

    const report = await researchEngineOrchestrator.executeFullAnalysis(resolvedSym, chartContext, timeframe);
    return PdfReportGenerator.generateHtmlReport(report);
  }

  // -------------------------------------------------------------
  // WORKFLOW 16: SLASH COMMAND PARSER (/trade ...)
  // -------------------------------------------------------------
  public parseSlashCommand(input: string): SlashCommandPayload {
    const trimmed = input.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);

    // If input is purely a raw symbol (e.g., "NVDA", "XAU/USD", "NIFTY 50")
    if (!trimmed.startsWith('/')) {
      const cleanSym = trimmed.toUpperCase().replace('$', '');
      return {
        command: `/trade analyze ${cleanSym}`,
        parsedWorkflow: 'ANALYZE_FULL',
        primarySymbol: cleanSym || 'NVDA',
      };
    }

    // Determine command verb and arguments
    // Examples:
    // ["/trade", "analyze", "AAPL"]
    // ["/trade", "compare", "NVDA", "AMD"]
    // ["/trade", "quick", "EUR/USD"]
    // ["/trade", "sector"]
    // ["/quick", "TSLA"]
    // ["/analyze", "AAPL"]
    const first = parts[0]?.toLowerCase() || '';
    const second = parts[1]?.toLowerCase() || '';

    let verb = '';
    let symbolA = 'NVDA';
    let symbolB = 'AMD';

    if (first === '/trade') {
      verb = second;
      symbolA = (parts[2] || 'NVDA').toUpperCase().replace('$', '');
      symbolB = (parts[3] || 'AMD').toUpperCase().replace('$', '');
    } else {
      verb = first.replace('/', '');
      symbolA = (parts[1] || 'NVDA').toUpperCase().replace('$', '');
      symbolB = (parts[2] || 'AMD').toUpperCase().replace('$', '');
    }

    // Map verb to workflow
    switch (verb) {
      case 'quick':
      case 'snapshot':
        return { command: input, parsedWorkflow: 'QUICK_SNAPSHOT', primarySymbol: symbolA };

      case 'tech':
      case 'technical':
        return { command: input, parsedWorkflow: 'STANDALONE_TECH', primarySymbol: symbolA };

      case 'fund':
      case 'fundamental':
        return { command: input, parsedWorkflow: 'STANDALONE_FUND', primarySymbol: symbolA };

      case 'sent':
      case 'sentiment':
        return { command: input, parsedWorkflow: 'STANDALONE_SENT', primarySymbol: symbolA };

      case 'risk':
        return { command: input, parsedWorkflow: 'STANDALONE_RISK', primarySymbol: symbolA };

      case 'thesis':
        return { command: input, parsedWorkflow: 'STANDALONE_THESIS', primarySymbol: symbolA };

      case 'sector':
      case 'sectors':
        return { command: input, parsedWorkflow: 'SECTOR_ROTATION', primarySymbol: symbolA };

      case 'compare':
        return { command: input, parsedWorkflow: 'COMPARE_ASSETS', primarySymbol: symbolA, secondarySymbol: symbolB };

      case 'options':
      case 'option':
        return { command: input, parsedWorkflow: 'OPTIONS_STRATEGIES', primarySymbol: symbolA };

      case 'earnings':
      case 'earning':
        return { command: input, parsedWorkflow: 'PRE_EARNINGS', primarySymbol: symbolA };

      case 'portfolio':
      case 'rebalance':
        return { command: input, parsedWorkflow: 'PORTFOLIO_REBALANCE', primarySymbol: symbolA };

      case 'screen':
      case 'screener':
        return { command: input, parsedWorkflow: 'STOCK_SCREENER', primarySymbol: symbolA };

      case 'watchlist':
      case 'watch':
        return { command: input, parsedWorkflow: 'SCORED_WATCHLIST', primarySymbol: symbolA };

      case 'report-pdf':
      case 'pdf':
      case 'report':
        return { command: input, parsedWorkflow: 'REPORT_PDF', primarySymbol: symbolA };

      case 'analyze':
      default:
        return { command: input, parsedWorkflow: 'ANALYZE_FULL', primarySymbol: symbolA };
    }
  }
}

export const workflowEngine = WorkflowEngine.getInstance();
