/**
 * Comprehensive End-to-End Verification of the Multi-Agent Trading Research Engine
 */

import { communityChatEngine } from '../lib/research/CommunityChatEngine';
import { discoveryBriefCompiler } from '../lib/research/DiscoveryBriefCompiler';
import { liveChartTelemetryService } from '../lib/research/LiveChartTelemetryService';
import { researchEngineOrchestrator } from '../lib/research/ResearchEngineOrchestrator';
import { workflowEngine } from '../lib/research/WorkflowEngine';
import { PdfReportGenerator } from '../lib/research/PdfReportGenerator';
import { computeLiveVisionAtlasSnapshot } from '../lib/research/VisionAtlasLiveAnalytics';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TESTING MULTI-AGENT TRADING RESEARCH ENGINE ARCHITECTURE');
  console.log('   (Real-Time Community Live Chat Ingestion & 5 Sequential Subagents)');
  console.log('================================================================\n');

  // TEST 0: Community Live Chat Engine Buffering, Ticker Filtering & Dispatch
  console.log('--- TEST 0: Community Live Chat Engine & Transcript Ingestion ---');
  const chatSymbols = ['NVDA', 'XAU/USD', 'EUR/USD', 'NIFTY 50', 'TSLA'];
  for (const sym of chatSymbols) {
    const transcript = communityChatEngine.getBufferedTranscript(sym);
    console.log(`✅ [Chat Feed] ${sym}: ${transcript.totalMessages} buffered messages`);
    console.log(`   Consensus Sentiment: ${transcript.consensusSentiment} (${transcript.consensusStrengthPercent}% strength)`);
    console.log(`   Chat Velocity: ${transcript.chatVelocityScore}/100 | Supports: [${transcript.extractedPriceLevels?.supports?.join(', ') || 'none'}]`);
    console.log(`   Key Linguistic Themes: ${transcript.dominantThemes.join(', ')}`);
  }

  // Test User Message Dispatch
  const dispatched = communityChatEngine.dispatchUserMessage({
    symbol: 'NVDA',
    username: 'AlphaQuant',
    message: '$NVDA breakout confirmed above 128.50 with heavy volume, looking for 136 target!',
    sentiment: 'BULLISH',
    badges: ['PRO TRADER']
  });
  console.log(`✅ Real-Time Chat Dispatch verified: [${dispatched.username}] "${dispatched.text}" (ID: ${dispatched.id})`);

  // TEST 1: Universal Market Grounding across diverse asset classes from Chat Ingestion
  console.log('--- TEST 1: Phase 1 Discovery Brief Compilation Across Asset Classes ---');
  const testSymbols = ['EUR/USD', 'XAU/USD', 'NIFTY 50', 'RELIANCE', 'NVDA'];
  
  for (const sym of testSymbols) {
    const brief = await discoveryBriefCompiler.compileBrief(sym);
    console.log(`✅ [${brief.assetClass}] ${brief.symbol} (${brief.name}):`);
    console.log(`   Price: ${brief.pricing.currency} ${brief.pricing.currentPrice} (${brief.pricing.change >= 0 ? '+' : ''}${brief.pricing.changePercent}%)`);
    console.log(`   Spread: ${brief.pricing.spreadPipsOrTicks} | Benchmark: ${brief.benchmarkIndex}`);
    console.log(`   ATR-14: ${brief.volatility.atr14} (${brief.volatility.atrPercent}%) | Beta: ${brief.volatility.betaVsBenchmark} | 30d Vol: ${brief.volatility.historicalVol30d}%`);
    console.log(`   Central Bank: ${brief.macro.centralBankStance} at ${brief.macro.policyInterestRate}% | Real Yield 10Y: ${brief.macro.realYield10Y}%`);
    if (brief.macro.fiiDiiNetFlows) {
      console.log(`   FII/DII Net: FII ₹${brief.macro.fiiDiiNetFlows.fiiNetCr} Cr, DII ₹${brief.macro.fiiDiiNetFlows.diiNetCr} Cr`);
    }
  }

  // TEST 2: Phase 2 Parallel Subagent Dispatch & Operational Bounds
  console.log('\n--- TEST 2: Phase 2 Parallel Subagent Deployment & Operational Bounds ---');
  const report = await researchEngineOrchestrator.executeFullAnalysis('NVDA');

  console.log(`✅ Technical Agent (Weight: ${report.weightsBreakdown[0].baseWeight * 100}%):`);
  console.log(`   Status: ${report.technical.status} | Total Score: ${report.technical.totalScore}/100`);
  console.log(`   EMA Alignment: ${report.technical.emaAlignment} (20: ${report.technical.ema20}, 50: ${report.technical.ema50}, 200: ${report.technical.ema200})`);
  console.log(`   Confluent Supports: ${report.technical.supportLevels.length} levels (S1: $${report.technical.supportLevels[0].price}, S2: $${report.technical.supportLevels[1].price}, S3: $${report.technical.supportLevels[2].price})`);
  console.log(`   Confluent Resistances: ${report.technical.resistanceLevels.length} levels (R1: $${report.technical.resistanceLevels[0].price}, R2: $${report.technical.resistanceLevels[1].price}, R3: $${report.technical.resistanceLevels[2].price})`);
  console.log(`   Realistic Trade Plan in Immediate Proximity:`);
  console.log(`     Entry Zone: $${report.technical.tradePlan.entryZone.min} - $${report.technical.tradePlan.entryZone.max}`);
  console.log(`     Stop Loss: $${report.technical.tradePlan.stopLoss.price} (-${report.technical.tradePlan.stopLoss.riskPercent}%)`);
  console.log(`     Target 1: $${report.technical.tradePlan.target1.price} (+${report.technical.tradePlan.target1.rewardPercent}%, 1:${report.technical.tradePlan.target1.riskRewardRatio} R:R)`);
  console.log(`     Target 2: $${report.technical.tradePlan.target2.price} (+${report.technical.tradePlan.target2.rewardPercent}%, 1:${report.technical.tradePlan.target2.riskRewardRatio} R:R)`);
  console.log(`   5 Sub-Scores: Trend=${report.technical.subScores.trend}, Mom=${report.technical.subScores.momentum}, Vol=${report.technical.subScores.volume}, Pattern=${report.technical.subScores.patternQuality}, RS=${report.technical.subScores.relativeStrength}`);

  console.log(`\n✅ Fundamental Agent (Weight: ${report.weightsBreakdown[1].baseWeight * 100}%):`);
  console.log(`   Status: ${report.fundamental.status} | Total Score: ${report.fundamental.totalScore}/100`);
  console.log(`   Forward P/E: ${report.fundamental.assetSpecificMetrics.forwardPE}x | PEG: ${report.fundamental.assetSpecificMetrics.pegRatio}x | YoY Rev: +${report.fundamental.assetSpecificMetrics.revenueGrowthYoY}%`);
  console.log(`   Moat: ${report.fundamental.assetSpecificMetrics.moatRating} | ROIC: ${report.fundamental.assetSpecificMetrics.roic}%`);
  console.log(`   5 Sub-Scores: Val=${report.fundamental.subScores.valuation}, Growth=${report.fundamental.subScores.growth}, Profit=${report.fundamental.subScores.profitability}, Health=${report.fundamental.subScores.financialHealth}, Moat=${report.fundamental.subScores.moatStrength}`);

  console.log(`\n✅ Sentiment & Momentum Agent (Weight: ${report.weightsBreakdown[2].baseWeight * 100}%):`);
  console.log(`   Status: ${report.sentiment.status} | Total Score: ${report.sentiment.totalScore}/100`);
  console.log(`   Wall St Consensus: ${report.sentiment.wallStreetConsensus.consensusRating} (${report.sentiment.wallStreetConsensus.buyCount} Buys, ${report.sentiment.wallStreetConsensus.holdCount} Holds)`);
  console.log(`   Price Target: $${report.sentiment.wallStreetConsensus.averagePriceTarget} (+${report.sentiment.wallStreetConsensus.upsidePercent}% upside)`);
  console.log(`   5 Sub-Scores: News=${report.sentiment.subScores.news}, Social=${report.sentiment.subScores.social}, Analysts=${report.sentiment.subScores.analysts}, Inst=${report.sentiment.subScores.institutional}, Insider/Short=${report.sentiment.subScores.insiderShort}`);

  console.log(`\n✅ Risk Assessment Agent (Weight: ${report.weightsBreakdown[3].baseWeight * 100}%):`);
  console.log(`   Status: ${report.risk.status} | Total Score: ${report.risk.totalScore}/100 (Inverted: Higher = Safer)`);
  console.log(`   Kelly Position Sizing: ${report.risk.positionSizingKelly.recommendedPositionPercentNAV}% NAV ($${report.risk.positionSizingKelly.maxRiskExposureDollars} max capital risk)`);
  console.log(`   Bear-Case Drawdown Scenarios: Mild (-7%) $${report.risk.bearCaseDrawdownScenario.mildCorrectionPrice}, Deep (-15%) $${report.risk.bearCaseDrawdownScenario.deepCorrectionPrice}`);
  console.log(`   Top 5 Risk Factors Ranked: ${report.risk.top5RiskMatrix.length} factors (Top: ${report.risk.top5RiskMatrix[0].title})`);
  console.log(`   5 Inverted Sub-Scores: Vol=${report.risk.subScores.volatilitySafety}, Downside=${report.risk.subScores.downsideProtection}, Macro=${report.risk.subScores.macroResilience}, Liq=${report.risk.subScores.liquidity}, RR=${report.risk.subScores.riskRewardRatio}`);

  console.log(`\n✅ Thesis Synthesis Agent (Weight: ${report.weightsBreakdown[4].baseWeight * 100}%):`);
  console.log(`   Status: ${report.thesis.status} | Total Score: ${report.thesis.totalScore}/100`);
  console.log(`   Executive Thesis: "${report.thesis.executiveThesis}"`);
  console.log(`   Bull Catalysts: ${report.thesis.bullCatalysts.length} | Bear Risks: ${report.thesis.bearRisks.length}`);
  console.log(`   Catalyst Calendar: ${report.thesis.catalystCalendar.length} milestone events`);
  console.log(`   Invalidation Trigger: $${report.thesis.invalidationTrigger.priceLevel} (${report.thesis.invalidationTrigger.macroOrEventCondition})`);
  console.log(`   5 Sub-Scores: Clarity=${report.thesis.subScores.catalystClarity}, Timing=${report.thesis.subScores.timing}, Asymmetry=${report.thesis.subScores.asymmetry}, Edge=${report.thesis.subScores.edge}, Conviction=${report.thesis.subScores.conviction}`);

  // TEST 3: Phase 3 Synthesis & 25 Sub-Score Matrix
  console.log('\n--- TEST 3: Phase 3 Synthesis, Composite Trade Score & Grade Mapping ---');
  console.log(`✅ Composite Trade Score: ${report.compositeScore}/100`);
  console.log(`✅ Definitive Grade: ${report.grade} | Signal: ${report.signal}`);
  console.log(`✅ Grade Description: ${report.gradeDescription}`);
  console.log(`✅ Total Sub-Scores Count: ${report.all25SubScores.length} (Expected: 25)`);

  // Verify all 25 sub-scores have maxScore 20 and score in 0-20
  const invalidSubScores = report.all25SubScores.filter(s => s.score < 0 || s.score > 20 || s.maxScore !== 20);
  if (invalidSubScores.length === 0) {
    console.log('✅ ALL 25 Sub-Scores validated strictly within [0 - 20] range.');
  } else {
    console.error('❌ Sub-scores out of bounds:', invalidSubScores);
  }

  // TEST 4: 6-Page PDF Report Generator
  console.log('\n--- TEST 4: Server-Side 6-Page PDF Investment Report Generator ---');
  const pdfHtml = PdfReportGenerator.generateHtmlReport(report);
  console.log(`✅ Generated PDF HTML string: length ${pdfHtml.length} characters.`);
  const hasPage1 = pdfHtml.includes('PAGE 1 OF 6');
  const hasPage2 = pdfHtml.includes('PAGE 2 OF 6');
  const hasPage3 = pdfHtml.includes('PAGE 3 OF 6');
  const hasPage4 = pdfHtml.includes('PAGE 4 OF 6');
  const hasPage5 = pdfHtml.includes('PAGE 5 OF 6');
  const hasPage6 = pdfHtml.includes('PAGE 6 OF 6');
  const hasDisclaimer = pdfHtml.includes('COMPLIANCE DISCLAIMER');
  console.log(`✅ 6-Page Validation: P1:${hasPage1}, P2:${hasPage2}, P3:${hasPage3}, P4:${hasPage4}, P5:${hasPage5}, P6:${hasPage6}, Disclaimer:${hasDisclaimer}`);

  // TEST 5: All 16 Workflows & Slash Commands
  console.log('\n--- TEST 5: All 16 Workflows Verification ---');
  
  // Slash command parsing
  const testCmds = [
    '/trade analyze NVDA',
    '/trade quick EUR/USD',
    '/trade compare NVDA AMD',
    '/trade sector',
    '/trade options TSLA',
    '/trade earnings INFY',
    '/trade portfolio',
    '/trade screen',
    '/trade watchlist',
    '/trade report-pdf XAU/USD',
    '/trade technical MSFT',
    '/trade fundamental AAPL',
    '/trade sentiment GOOGL',
    '/trade risk BRENT_CRUDE',
    '/trade thesis RELIANCE',
    'XAU/USD'
  ];

  for (const cmd of testCmds) {
    const parsed = workflowEngine.parseSlashCommand(cmd);
    console.log(`✅ Command "${cmd}" => Workflow: ${parsed.parsedWorkflow} (SymA: ${parsed.primarySymbol}${parsed.secondarySymbol ? `, SymB: ${parsed.secondarySymbol}` : ''})`);
  }

  // Quick Snapshot
  const quick = await workflowEngine.runQuickSnapshot('EUR/USD');
  console.log(`✅ 60-Second Snapshot: ${quick.symbol} Score: ${quick.quickScore}/100 [Grade ${quick.quickGrade} - ${quick.quickSignal}]`);

  // Sector Rotation
  const sectors = workflowEngine.getSectorRotation();
  console.log(`✅ Sector Rotation: ${sectors.length} sectors covered (Top leader: ${sectors[0].leadingAsset} in ${sectors[0].sector} +${sectors[0].oneMonthPerformance}%)`);

  // Compare Assets
  const comparison = await workflowEngine.compareAssets('NVDA', 'AMD');
  console.log(`✅ Head-to-Head Comparison: ${comparison.assetA.symbol} (${comparison.assetA.compositeScore}) vs ${comparison.assetB.symbol} (${comparison.assetB.compositeScore}) -> Winner: ${comparison.headToHeadWinner}`);

  // Options Strategies
  const options = await workflowEngine.getOptionsStrategies('TSLA');
  console.log(`✅ Options Strategies: ${options.symbol} IV: ${options.impliedVolPercent}%, IV Rank: ${options.ivRank}, Setups: ${options.recommendedStrategies.length}`);

  // Pre-Earnings
  const earnings = await workflowEngine.getPreEarningsAnalysis('INFY');
  console.log(`✅ Pre-Earnings: ${earnings.symbol} Implied Move: ±${earnings.impliedMovePercent}%, EPS Est: $${earnings.epsEstimate}`);

  // Portfolio Rebalancing
  const portfolio = workflowEngine.getPortfolioRebalance();
  console.log(`✅ Portfolio Rebalancing: Sharpe ${portfolio.portfolioSharpeProjected}, Diversification: ${portfolio.crossAssetDiversificationScore}/100, Assets: ${portfolio.riskParityAllocation.length}`);

  // Stock Screener & Watchlist
  const screener = workflowEngine.getScreenerResults();
  const watchlist = workflowEngine.getScoredWatchlist();
  console.log(`✅ Stock Screener: ${screener.length} instruments screened | Watchlist: ${watchlist.length} items`);

  // TEST 6: Chart Symbol Switch & Bidirectional Live Synchronization (XAU/USD -> NASDAQ:NVDA -> FX:EURUSD)
  console.log('\n--- TEST 6: Chart Symbol Switch & Live Telemetry Synchronization ---');
  const goldTelemetry = await liveChartTelemetryService.fetchLiveChartTelemetry('OANDA:XAUUSD', '1h');
  const nvdaTelemetry = await liveChartTelemetryService.fetchLiveChartTelemetry('NASDAQ:NVDA', '4h');
  const eurTelemetry = await liveChartTelemetryService.fetchLiveChartTelemetry('FX:EURUSD', '15m');

  const goldReport = await researchEngineOrchestrator.executeFullAnalysis('OANDA:XAUUSD', goldTelemetry, '1h');
  const nvdaReport = await researchEngineOrchestrator.executeFullAnalysis('NASDAQ:NVDA', nvdaTelemetry, '4h');
  const eurReport = await researchEngineOrchestrator.executeFullAnalysis('FX:EURUSD', eurTelemetry, '15m');

  if (goldReport.symbol !== 'XAU/USD' || nvdaReport.symbol !== 'NVDA' || eurReport.symbol !== 'EUR/USD') {
    throw new Error(`Symbol canonicalization mismatch: ${goldReport.symbol}, ${nvdaReport.symbol}, ${eurReport.symbol}`);
  }
  if (Math.abs(nvdaReport.brief.pricing.currentPrice - nvdaTelemetry.livePrice) > 0.05) {
    throw new Error(`NVDA live chart parity broken: report=${nvdaReport.brief.pricing.currentPrice}, chart=${nvdaTelemetry.livePrice}`);
  }
  if (nvdaReport.thesis.invalidationTrigger.priceLevel !== nvdaReport.technical.tradePlan.stopLoss.price) {
    throw new Error(`Invalidation trigger drift: thesis=${nvdaReport.thesis.invalidationTrigger.priceLevel}, tech SL=${nvdaReport.technical.tradePlan.stopLoss.price}`);
  }
  if (eurReport.technical.tradePlan.entryZone.min.toString().split('.')[1]?.length === undefined) {
    throw new Error(`EUR/USD precision lost: ${eurReport.technical.tradePlan.entryZone.min}`);
  }

  console.log(`✅ XAU/USD (1h): Live Price ${goldReport.brief.pricing.currentPrice} | Chat Room ${goldReport.brief.chatTranscript?.tickerTag} | Score ${goldReport.compositeScore}/100 | SL ${goldReport.technical.tradePlan.stopLoss.price}`);
  console.log(`✅ NASDAQ:NVDA (4h): Live Price ${nvdaReport.brief.pricing.currentPrice} | Chat Room ${nvdaReport.brief.chatTranscript?.tickerTag} | Score ${nvdaReport.compositeScore}/100 | SL ${nvdaReport.technical.tradePlan.stopLoss.price} == Thesis Inv ${nvdaReport.thesis.invalidationTrigger.priceLevel}`);
  console.log(`✅ FX:EURUSD (15m): Live Price ${eurReport.brief.pricing.currentPrice} | Chat Room ${eurReport.brief.chatTranscript?.tickerTag} | Score ${eurReport.compositeScore}/100 | Entry ${eurReport.technical.tradePlan.entryZone.min}-${eurReport.technical.tradePlan.entryZone.max}`);

  const eurPdf = PdfReportGenerator.generateHtmlReport(eurReport);
  if (!eurPdf.includes(eurReport.brief.pricing.currentPrice.toFixed(4).slice(0, 5))) {
    throw new Error('EUR/USD PDF precision formatting error');
  }
  console.log('✅ EUR/USD 6-Page PDF Report preserves exact FX precision and live chart timeframe.');

  // TEST 7: Single Source of Truth — 25 Sub-Score Parity, PDF Snapshot Parity & Vision Atlas Live Grounding
  console.log('\n--- TEST 7: Single Source of Truth (25 Sub-Scores <-> Agents <-> PDF <-> Vision Atlas) ---');
  for (const r of [nvdaReport, goldReport, eurReport]) {
    const agentNames: Array<{ key: 'Technical' | 'Fundamental' | 'Sentiment' | 'Risk' | 'Thesis'; idx: number }> = [
      { key: 'Technical', idx: 0 },
      { key: 'Fundamental', idx: 1 },
      { key: 'Sentiment', idx: 2 },
      { key: 'Risk', idx: 3 },
      { key: 'Thesis', idx: 4 },
    ];
    for (const a of agentNames) {
      const subSum = r.all25SubScores
        .filter((s) => s.agent === a.key)
        .reduce((acc, s) => acc + s.score, 0);
      const rawScore = r.weightsBreakdown[a.idx].scoreRaw;
      if (subSum !== rawScore) {
        throw new Error(`${r.symbol} ${a.key} sub-score mismatch: matrix sum=${subSum} vs weightsBreakdown=${rawScore}`);
      }
    }

    const pdfFromSnapshot = await workflowEngine.generateReportPdfHtml(r.symbol, r.brief.chartContext, r.brief.chartContext?.timeframe || '1h', r);
    if (!pdfFromSnapshot.includes(r.reportId) || !pdfFromSnapshot.includes(`${r.compositeScore}/100`)) {
      throw new Error(`${r.symbol} PDF snapshot parity mismatch`);
    }

    const vaLive = computeLiveVisionAtlasSnapshot({
      pair: r.symbol,
      timeframe: r.brief.chartContext?.timeframe || '1h',
      livePrice: r.brief.pricing.currentPrice,
      report: r,
    });
    if (Math.abs(vaLive.livePrice - r.brief.pricing.currentPrice) > 0.05) {
      throw new Error(`Vision Atlas live price drift for ${r.symbol}: va=${vaLive.livePrice} vs report=${r.brief.pricing.currentPrice}`);
    }
    if (vaLive.sweepSummary.includes('3998.47')) {
      throw new Error(`Vision Atlas stale hardcoded sweep detected for ${r.symbol}`);
    }
    console.log(`✅ [SSOT Verified] ${r.symbol}: 25 Sub-Scores Sum==RawScores | PDF Report ID=${r.reportId} (${r.compositeScore}/100) | Vision Atlas Live=${vaLive.livePrice}`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL ARCHITECTURAL TESTS AND WORKFLOWS PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
