/**
 * Server-Side PDF Report Generator
 * Exports a formatted 6-page institutional investment research report complete with
 * score gauges, charts, structured tables, 25 sub-scores, and a persistent research disclaimer.
 */

import { ResearchReportSnapshot } from './types';
import { formatAssetPrice } from './LiveChartTelemetryService';

export class PdfReportGenerator {
  public static generateHtmlReport(report: ResearchReportSnapshot): string {
    const {
      symbol,
      name,
      assetClass,
      formattedDate,
      compositeScore,
      grade,
      signal,
      gradeDescription,
      brief,
      technical,
      fundamental,
      sentiment,
      risk,
      thesis,
      weightsBreakdown,
      all25SubScores,
      researchDisclaimer,
    } = report;

    const fmt = (val: number) => formatAssetPrice(val, assetClass, symbol);
    const activeTimeframe = brief.chartContext?.timeframe?.toUpperCase() || '1H';
    const activeIndList = brief.chartContext?.activeIndicators?.join(', ') || 'RSI, EMA20/50/200, MACD, BB';

    const gradeColor = 
      grade === 'A+' ? '#10b981' :
      grade === 'A' ? '#059669' :
      grade === 'B' ? '#3b82f6' :
      grade === 'C' ? '#f59e0b' :
      grade === 'D' ? '#f97316' : '#ef4444';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QRI Research Report - ${symbol}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
    
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.5;
    }

    .page {
      page-break-after: always;
      position: relative;
      height: 270mm;
      max-height: 270mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-bottom: 5mm;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .header-bar {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .brand-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      font-family: 'JetBrains Mono', monospace;
    }

    .brand-subtitle {
      font-size: 10px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    .page-number {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #64748b;
    }

    .footer-bar {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      font-size: 8.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      font-family: 'JetBrains Mono', monospace;
    }

    .hero-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .score-badge-large {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      font-size: 20px;
      color: #ffffff;
      background: ${gradeColor};
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }

    .card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #ffffff;
    }

    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
      margin-bottom: 6px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 8px;
    }

    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      text-align: left;
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
    }

    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
    }

    .text-right { text-align: right; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .font-bold { font-weight: 700; }
    .text-emerald { color: #059669; }
    .text-rose { color: #dc2626; }
    .text-cyan { color: #0284c7; }

    .bar-container {
      background: #e2e8f0;
      border-radius: 3px;
      height: 7px;
      width: 100%;
      overflow: hidden;
      margin-top: 2px;
    }

    .bar-fill {
      height: 100%;
      background: #0284c7;
      border-radius: 3px;
    }

    .disclaimer-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 9px;
      color: #991b1b;
      margin-top: 10px;
    }
  </style>
</head>
<body>

  <!-- ============================================================= -->
  <!-- PAGE 1: EXECUTIVE SUMMARY & COMPOSITE TRADE SCORE -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">QRI TRADER // MULTI-AGENT RESEARCH ENGINE</div>
          <div class="brand-subtitle">UNIVERSAL REAL-TIME MARKET GROUNDING • 5 CONCURRENT SUBAGENTS</div>
        </div>
        <div class="page-number">PAGE 1 OF 6</div>
      </div>

      <div class="hero-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 24px; margin: 0 0 4px 0; color: #0f172a; font-family: 'JetBrains Mono', monospace;">
              ${symbol} <span style="font-size: 15px; color: #64748b; font-weight: 400;">(${name})</span>
            </h1>
            <div class="font-mono" style="font-size: 11px; color: #475569;">
              Asset Class: <strong>${assetClass}</strong> • Timeframe: <strong>${activeTimeframe}</strong> • Benchmark: <strong>${brief.benchmarkIndex}</strong> • Date: ${formattedDate}
            </div>
            <div style="margin-top: 8px; font-size: 14px;" class="font-mono">
              Live Chart Price: <strong>${brief.pricing.currency} ${fmt(brief.pricing.currentPrice)}</strong> 
              <span class="${brief.pricing.change >= 0 ? 'text-emerald' : 'text-rose'}">
                (${brief.pricing.change >= 0 ? '+' : ''}${brief.pricing.changePercent}%)
              </span>
            </div>
            <div style="margin-top: 4px; font-size: 9.5px; color: #64748b;" class="font-mono">
              Active Indicators: ${activeIndList}
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #64748b; margin-bottom: 4px;">COMPOSITE TRADE SCORE</div>
            <div class="score-badge-large">${compositeScore}/100</div>
            <div style="font-size: 13px; font-weight: 800; color: ${gradeColor}; margin-top: 4px; font-family: 'JetBrains Mono', monospace;">
              GRADE ${grade} // ${signal.replace('_', ' ')}
            </div>
          </div>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 10.5px; color: #334155; line-height: 1.4;">
          <strong>Executive Assessment:</strong> ${gradeDescription}
        </p>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <div class="card-title">Phase 1: Universal Discovery Brief & Telemetry Grounding</div>
        <div class="grid-3" style="margin-bottom: 0;">
          <div>
            <strong>Pricing & Spread:</strong><br>
            Day Range: ${brief.pricing.currency} ${brief.pricing.dayLow} - ${brief.pricing.dayHigh}<br>
            Spread: ${brief.pricing.spreadPipsOrTicks} pips / ticks
          </div>
          <div>
            <strong>Volume Dynamics:</strong><br>
            Current Vol: ${(brief.volume.currentVolume / 1e6).toFixed(2)}M<br>
            Surge Ratio: ${brief.volume.volumeSurgeRatio}x (vs 20D avg)
          </div>
          <div>
            <strong>Macro & Volatility:</strong><br>
            ATR-14: ${brief.volatility.atr14} (${brief.volatility.atrPercent}%)<br>
            Central Bank: ${brief.macro.centralBankStance} (${brief.macro.policyInterestRate}%)
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">5-Dimension Weighted Synthesis Table & Proportional Weight Recalculation</div>
        <table>
          <thead>
            <tr>
              <th>Specialized AI Subagent</th>
              <th>Base Weight</th>
              <th>Effective Weight</th>
              <th class="text-right">Raw Score (0-100)</th>
              <th class="text-right">Weighted Contribution</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${weightsBreakdown.map(w => `
              <tr>
                <td><strong>${w.agentRole}</strong></td>
                <td>${(w.baseWeight * 100).toFixed(0)}%</td>
                <td><strong class="text-cyan">${(w.effectiveWeight * 100).toFixed(1)}%</strong></td>
                <td class="text-right font-mono">${w.scoreRaw}/100</td>
                <td class="text-right font-mono font-bold">+${w.scoreWeighted.toFixed(1)}</td>
                <td><span style="color: #059669; font-weight: 600;">PASSED</span></td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: 700;">
              <td colspan="4">TOTAL WEIGHTED COMPOSITE SCORE:</td>
              <td class="text-right font-mono" style="font-size: 12px; color: ${gradeColor};">${compositeScore}/100</td>
              <td><strong>GRADE ${grade}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • PHASE 1 & SYNTHESIS OVERVIEW</span>
      <span>PAGE 1</span>
    </div>
  </div>

  <!-- ============================================================= -->
  <!-- PAGE 2: TECHNICAL ANALYSIS & CONFLUENCE LEVELS -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">01 // TECHNICAL ANALYSIS DEEP-DIVE (25% WEIGHT)</div>
          <div class="brand-subtitle">MARKET STRUCTURE • EMA STACKS • CONFLUENT LEVELS • REALISTIC ENTRY/EXIT</div>
        </div>
        <div class="page-number">PAGE 2 OF 6</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Technical Sub-Scores Breakdown (${technical.totalScore}/100)</div>
          <div style="space-y: 6px;">
            <div>Trend Direction (${technical.subScores.trend}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(technical.subScores.trend / 20) * 100}%;"></div></div></div>
            <div>Momentum RSI & MACD (${technical.subScores.momentum}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(technical.subScores.momentum / 20) * 100}%;"></div></div></div>
            <div>Volume vs 20/50D (${technical.subScores.volume}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(technical.subScores.volume / 20) * 100}%;"></div></div></div>
            <div>Pattern Quality (${technical.subScores.patternQuality}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(technical.subScores.patternQuality / 20) * 100}%;"></div></div></div>
            <div>Relative Strength (${technical.subScores.relativeStrength}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(technical.subScores.relativeStrength / 20) * 100}%;"></div></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Trend & Moving Average Ribbon</div>
          <div>EMA-20: <strong class="font-mono">${fmt(technical.ema20)}</strong></div>
          <div>EMA-50: <strong class="font-mono">${fmt(technical.ema50)}</strong></div>
          <div>EMA-200: <strong class="font-mono">${fmt(technical.ema200)}</strong></div>
          <div>Alignment: <strong class="text-cyan">${technical.emaAlignment}</strong></div>
          <div>Structure: <strong>${technical.marketStructure}</strong></div>
          <div>RSI-14: <strong>${technical.rsi14} (${technical.rsiCondition})</strong></div>
          <div>Bollinger Bands: [${fmt(technical.bollingerBands.lower)} - ${fmt(technical.bollingerBands.upper)}] %B: ${technical.bollingerBands.percentB}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">3 Confluent Support Levels</div>
          ${technical.supportLevels.map((lvl, idx) => `
            <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0;">
              <strong class="font-mono text-emerald">S${idx + 1}: ${fmt(lvl.price)}</strong> (${lvl.strength})<br>
              <span style="font-size: 9.5px; color: #475569;">${lvl.confluenceFactors.join(' • ')}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-title">3 Confluent Resistance Levels</div>
          ${technical.resistanceLevels.map((lvl, idx) => `
            <div style="margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0;">
              <strong class="font-mono text-rose">R${idx + 1}: ${fmt(lvl.price)}</strong> (${lvl.strength})<br>
              <span style="font-size: 9.5px; color: #475569;">${lvl.confluenceFactors.join(' • ')}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Realistic Trade Plan in Immediate Proximity</div>
        <table>
          <thead>
            <tr>
              <th>Order Component</th>
              <th>Price Level</th>
              <th>Distance / Risk-Reward</th>
              <th>Strategic Operational Rationale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>ENTRY ZONE</strong></td>
              <td class="font-mono text-cyan">${fmt(technical.tradePlan.entryZone.min)} - ${fmt(technical.tradePlan.entryZone.max)}</td>
              <td>Immediate Market</td>
              <td>${technical.tradePlan.entryZone.note}</td>
            </tr>
            <tr>
              <td><strong>STOP LOSS</strong></td>
              <td class="font-mono text-rose">${fmt(technical.tradePlan.stopLoss.price)}</td>
              <td class="text-rose font-mono">-${technical.tradePlan.stopLoss.riskPercent}% (${fmt(technical.tradePlan.stopLoss.distancePoints)} pts)</td>
              <td>${technical.tradePlan.stopLoss.rationale}</td>
            </tr>
            <tr>
              <td><strong>TARGET 1</strong></td>
              <td class="font-mono text-emerald">${fmt(technical.tradePlan.target1.price)}</td>
              <td class="text-emerald font-mono">+${technical.tradePlan.target1.rewardPercent}% (1:${technical.tradePlan.target1.riskRewardRatio})</td>
              <td>${technical.tradePlan.target1.rationale}</td>
            </tr>
            <tr>
              <td><strong>TARGET 2 (RUNNER)</strong></td>
              <td class="font-mono text-emerald">${fmt(technical.tradePlan.target2.price)}</td>
              <td class="text-emerald font-mono">+${technical.tradePlan.target2.rewardPercent}% (1:${technical.tradePlan.target2.riskRewardRatio})</td>
              <td>${technical.tradePlan.target2.rationale}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • TECHNICAL ANALYSIS AUDIT</span>
      <span>PAGE 2</span>
    </div>
  </div>

  <!-- ============================================================= -->
  <!-- PAGE 3: FUNDAMENTAL ANALYSIS & VALUATION DEEP-DIVE -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">02 // FUNDAMENTAL ANALYSIS & VALUATION (25% WEIGHT)</div>
          <div class="brand-subtitle">MULTIPLES • REVENUE/EARNINGS GROWTH • MARGINS • BALANCE SHEET • MOAT</div>
        </div>
        <div class="page-number">PAGE 3 OF 6</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Fundamental Sub-Scores (${fundamental.totalScore}/100)</div>
          <div style="space-y: 6px;">
            <div>Valuation Multiples (${fundamental.subScores.valuation}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(fundamental.subScores.valuation / 20) * 100}%;"></div></div></div>
            <div>Growth YoY & CAGR (${fundamental.subScores.growth}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(fundamental.subScores.growth / 20) * 100}%;"></div></div></div>
            <div>Profitability Margins (${fundamental.subScores.profitability}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(fundamental.subScores.profitability / 20) * 100}%;"></div></div></div>
            <div>Financial Health & FCF (${fundamental.subScores.financialHealth}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(fundamental.subScores.financialHealth / 20) * 100}%;"></div></div></div>
            <div>Economic Moat Strength (${fundamental.subScores.moatStrength}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(fundamental.subScores.moatStrength / 20) * 100}%;"></div></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Key Valuation & Operational Ratios</div>
          <table>
            <tr><td>Forward P/E Ratio:</td><td class="font-mono text-right">${fundamental.assetSpecificMetrics.forwardPE ?? 'N/A'}x</td></tr>
            <tr><td>PEG Ratio:</td><td class="font-mono text-right">${fundamental.assetSpecificMetrics.pegRatio ?? 'N/A'}x</td></tr>
            <tr><td>EV / EBITDA:</td><td class="font-mono text-right">${fundamental.assetSpecificMetrics.evToEbitda ?? 'N/A'}x</td></tr>
            <tr><td>Operating Margin:</td><td class="font-mono text-right text-emerald">${fundamental.assetSpecificMetrics.operatingMarginPercent ?? 'N/A'}%</td></tr>
            <tr><td>Return on Invested Capital (ROIC):</td><td class="font-mono text-right text-emerald">${fundamental.assetSpecificMetrics.roic ?? 'N/A'}%</td></tr>
            <tr><td>Debt-to-Equity Ratio:</td><td class="font-mono text-right">${fundamental.assetSpecificMetrics.debtToEquity ?? 'N/A'}</td></tr>
          </table>
        </div>
      </div>

      <div class="card" style="margin-bottom: 12px;">
        <div class="card-title">Competitive Moat & Management Alignment</div>
        <p><strong>Economic Moat Rating:</strong> <span class="text-cyan font-bold">${fundamental.assetSpecificMetrics.moatRating}</span></p>
        <p><strong>Management & Ownership:</strong> ${fundamental.assetSpecificMetrics.managementAlignment}</p>
        <ul style="margin: 6px 0 0 16px; padding: 0;">
          ${fundamental.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • FUNDAMENTAL EVALUATION</span>
      <span>PAGE 3</span>
    </div>
  </div>

  <!-- ============================================================= -->
  <!-- PAGE 4: SENTIMENT, SMART MONEY & MOMENTUM -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">03 // SENTIMENT & MOMENTUM ANALYSIS (20% WEIGHT)</div>
          <div class="brand-subtitle">NEWS TONE • WALL STREET ANALYSTS • 13F / FII FLOWS • INSIDERS & SHORT SQUEEZE</div>
        </div>
        <div class="page-number">PAGE 4 OF 6</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Sentiment Sub-Scores (${sentiment.totalScore}/100)</div>
          <div style="space-y: 6px;">
            <div>News Tone (${sentiment.subScores.news}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(sentiment.subScores.news / 20) * 100}%;"></div></div></div>
            <div>Social Buzz (${sentiment.subScores.social}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(sentiment.subScores.social / 20) * 100}%;"></div></div></div>
            <div>Analyst Ratings (${sentiment.subScores.analysts}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(sentiment.subScores.analysts / 20) * 100}%;"></div></div></div>
            <div>Institutional Flows (${sentiment.subScores.institutional}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(sentiment.subScores.institutional / 20) * 100}%;"></div></div></div>
            <div>Insider & Short Metrics (${sentiment.subScores.insiderShort}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(sentiment.subScores.insiderShort / 20) * 100}%;"></div></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Wall Street Analyst Consensus</div>
          <div style="font-size: 14px; font-weight: 700; color: #059669; font-family: 'JetBrains Mono', monospace; margin-bottom: 6px;">
            ${sentiment.wallStreetConsensus.consensusRating} (${sentiment.wallStreetConsensus.buyCount} Buys / ${sentiment.wallStreetConsensus.holdCount} Holds / ${sentiment.wallStreetConsensus.sellCount} Sells)
          </div>
          <div>Avg Price Target: <strong class="font-mono text-cyan">${sentiment.wallStreetConsensus.averagePriceTarget}</strong> (+${sentiment.wallStreetConsensus.upsidePercent}% upside)</div>
          <div>30-Day Revisions: <strong class="text-emerald">+${sentiment.wallStreetConsensus.recentUpgrades30d} Upgrades</strong> / <span class="text-rose">-${sentiment.wallStreetConsensus.recentDowngrades30d} Downgrade</span></div>
          <div>Sector Alpha: Outperforming sector by +${sentiment.relativeStrengthVsSector.outperformancePercent30d}%</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Smart Money, Insiders & Short Interest Telemetry</div>
        <div class="grid-2" style="margin-bottom: 0;">
          <div>
            <strong>Institutional 13F / FII Activity:</strong><br>
            Signal: <strong class="text-cyan">${sentiment.institutionalActivity.smartMoneyFlow}</strong><br>
            ${sentiment.institutionalActivity.fiiDiiNetBias}
          </div>
          <div>
            <strong>Short Interest & Squeeze Gauge:</strong><br>
            Short % of Float: <strong>${sentiment.shortInterest.shortPercentOfFloat}%</strong> (Days to Cover: ${sentiment.shortInterest.daysToCover})<br>
            Squeeze Potential: <strong class="text-cyan">${sentiment.shortInterest.squeezeRisk}</strong> (${sentiment.shortInterest.shortSqueezeScore}/100)
          </div>
        </div>
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • SENTIMENT & INSTITUTIONAL FLOWS</span>
      <span>PAGE 4</span>
    </div>
  </div>

  <!-- ============================================================= -->
  <!-- PAGE 5: RISK ASSESSMENT & PORTFOLIO POSITION SIZING -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">04 // RISK ASSESSMENT & SIZING (15% WEIGHT)</div>
          <div class="brand-subtitle">VOLATILITY • BEAR DRAWDOWN • KELLY SIZING • RANKED TOP 5 RISK MATRIX</div>
        </div>
        <div class="page-number">PAGE 5 OF 6</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Risk Sub-Scores (Inverted: Higher = Safer) [${risk.totalScore}/100]</div>
          <div style="space-y: 6px;">
            <div>Volatility Safety (${risk.subScores.volatilitySafety}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(risk.subScores.volatilitySafety / 20) * 100}%;"></div></div></div>
            <div>Downside Protection (${risk.subScores.downsideProtection}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(risk.subScores.downsideProtection / 20) * 100}%;"></div></div></div>
            <div>Macro Resilience (${risk.subScores.macroResilience}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(risk.subScores.macroResilience / 20) * 100}%;"></div></div></div>
            <div>Liquidity Quality (${risk.subScores.liquidity}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(risk.subScores.liquidity / 20) * 100}%;"></div></div></div>
            <div>Risk/Reward Ratio (${risk.subScores.riskRewardRatio}/20):<div class="bar-container"><div class="bar-fill" style="width: ${(risk.subScores.riskRewardRatio / 20) * 100}%;"></div></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Kelly Criterion & Sizing Governance</div>
          <div>Recommended NAV Allocation: <strong class="text-cyan font-mono">${risk.positionSizingKelly.recommendedPositionPercentNAV}%</strong></div>
          <div>Max Capital at Risk: <strong class="font-mono">$${risk.positionSizingKelly.maxRiskExposureDollars}</strong></div>
          <div>Half-Kelly Mathematical Ceiling: <strong>${risk.positionSizingKelly.halfKellyPercent}%</strong></div>
          <div style="margin-top: 6px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
            <strong>Stress-Tested Drawdown Thresholds:</strong><br>
            Mild Correction (-7%): $${risk.bearCaseDrawdownScenario.mildCorrectionPrice}<br>
            Deep Correction (-15%): $${risk.bearCaseDrawdownScenario.deepCorrectionPrice}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Ranked Top 5 Risk Matrix & Explicit Mitigations</div>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Category</th>
              <th>Risk Factor Title & Description</th>
              <th>Severity</th>
              <th>Likelihood</th>
              <th>Mitigation Strategy</th>
            </tr>
          </thead>
          <tbody>
            ${risk.top5RiskMatrix.map(rf => `
              <tr>
                <td><strong>#${rf.rank}</strong></td>
                <td><span class="font-mono text-cyan">${rf.category}</span></td>
                <td><strong>${rf.title}</strong><br><span style="font-size: 9px; color: #475569;">${rf.description}</span></td>
                <td class="text-center font-mono">${rf.severity}/5</td>
                <td class="text-center font-mono">${rf.likelihood}/5</td>
                <td style="font-size: 9px; color: #059669;">${rf.mitigationStrategy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • RISK GOVERNANCE AUDIT</span>
      <span>PAGE 5</span>
    </div>
  </div>

  <!-- ============================================================= -->
  <!-- PAGE 6: THESIS SYNTHESIS & STRATEGIC ROADMAP -->
  <!-- ============================================================= -->
  <div class="page">
    <div>
      <div class="header-bar">
        <div>
          <div class="brand-title">05 // THESIS SYNTHESIS & STRATEGIC ROADMAP (15% WEIGHT)</div>
          <div class="brand-subtitle">CATALYST TIMELINE • BULL/BEAR TARGETS • SCALING PLAN • INVALIDATION</div>
        </div>
        <div class="page-number">PAGE 6 OF 6</div>
      </div>

      <div class="card" style="margin-bottom: 12px; background: #f8fafc;">
        <div class="card-title">Executive Core Investment Thesis (${thesis.totalScore}/100)</div>
        <p style="font-size: 11px; line-height: 1.5; color: #0f172a;">
          ${thesis.executiveThesis}
        </p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Top Bullish Catalysts & Targets</div>
          ${thesis.bullCatalysts.map(c => `
            <div style="margin-bottom: 6px;">
              <strong class="text-emerald">${c.title}</strong><br>
              <span style="font-size: 9.5px; color: #475569;">${c.catalystExplanation}</span><br>
              Target: <strong class="font-mono text-emerald">$${c.upsideTargetPrice} (+${c.upsidePotentialPercent}%)</strong>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-title">Top Bearish Risks & Targets</div>
          ${thesis.bearRisks.map(r => `
            <div style="margin-bottom: 6px;">
              <strong class="text-rose">${r.title}</strong><br>
              <span style="font-size: 9.5px; color: #475569;">${r.riskExplanation}</span><br>
              Risk Floor: <strong class="font-mono text-rose">$${r.downsideTargetPrice} (-${r.downsideRiskPercent}%)</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Upcoming Catalyst Calendar</div>
          ${thesis.catalystCalendar.map(cat => `
            <div style="margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px dashed #e2e8f0;">
              <strong>${cat.dateOrWindow}</strong>: ${cat.title} 
              <span class="font-mono" style="font-size: 9px; color: #0284c7;">[${cat.type}]</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <div class="card-title">Strict Invalidation Trigger & Exit Protocol</div>
          <div>Invalidation Level: <strong class="font-mono text-rose">$${thesis.invalidationTrigger.priceLevel}</strong></div>
          <div>Breach Condition: ${thesis.invalidationTrigger.macroOrEventCondition}</div>
          <div style="color: #dc2626; margin-top: 4px;"><strong>Exit Action:</strong> ${thesis.invalidationTrigger.exitAction}</div>
        </div>
      </div>

      <div class="disclaimer-box">
        <strong>LEGAL & RESEARCH COMPLIANCE DISCLAIMER:</strong><br>
        ${researchDisclaimer} Past performance is no guarantee of future returns. Models are probabilistic and subject to market execution risk.
      </div>
    </div>

    <div class="footer-bar">
      <span>QRI TRADER RESEARCH ENGINE // CONFIDENTIAL</span>
      <span>${symbol} • THESIS & COMPLIANCE SIGN-OFF</span>
      <span>PAGE 6</span>
    </div>
  </div>

</body>
</html>`;
  }
}

export const pdfReportGenerator = PdfReportGenerator;
