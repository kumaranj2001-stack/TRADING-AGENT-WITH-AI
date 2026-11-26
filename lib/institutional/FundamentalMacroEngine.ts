import type { TimeFrame } from '../types';
import type { MacroFundamentalSnapshot } from './types';
import { evaluateSafeFormula, resolveInstitutionalAssetContext, seededRange } from './helpers';

const RATIO_UNIVERSE: Array<{ symbol: string; variables: Record<string, number> }> = [
  { symbol: 'NVDA', variables: { MarketCap: 3480, FCF: 64.2, ROIC: 68.5, EBITDA: 81.4, EV: 3455, Debt: 9.8, Revenue: 130.5, EPS: 2.94 } },
  { symbol: 'MSFT', variables: { MarketCap: 3180, FCF: 74.1, ROIC: 29.4, EBITDA: 136.0, EV: 3195, Debt: 68.2, Revenue: 254.0, EPS: 12.15 } },
  { symbol: 'AAPL', variables: { MarketCap: 3440, FCF: 108.8, ROIC: 54.2, EBITDA: 134.8, EV: 3490, Debt: 101.3, Revenue: 391.0, EPS: 6.75 } },
  { symbol: 'RELIANCE', variables: { MarketCap: 215, FCF: 11.4, ROIC: 11.8, EBITDA: 21.6, EV: 248, Debt: 38.5, Revenue: 118.2, EPS: 1.48 } },
  { symbol: 'TCS', variables: { MarketCap: 142, FCF: 5.9, ROIC: 51.2, EBITDA: 8.1, EV: 137, Debt: 0.9, Revenue: 30.2, EPS: 1.65 } },
];

export class FundamentalMacroEngine {
  private static instance: FundamentalMacroEngine;

  private constructor() {}

  public static getInstance(): FundamentalMacroEngine {
    if (!FundamentalMacroEngine.instance) {
      FundamentalMacroEngine.instance = new FundamentalMacroEngine();
    }
    return FundamentalMacroEngine.instance;
  }

  public evaluateCustomRatio(formula: string = '(FCF / MarketCap) * ROIC'): MacroFundamentalSnapshot['customRatioEvaluation'] {
    const results: Array<{ symbol: string; value: number; variablesUsed: Record<string, number> }> = [];
    for (const row of RATIO_UNIVERSE) {
      const parsed = evaluateSafeFormula(formula, row.variables);
      if (!parsed.ok) {
        return {
          formula,
          valid: false,
          error: parsed.error,
          results: [],
        };
      }
      results.push({
        symbol: row.symbol,
        value: parsed.value,
        variablesUsed: row.variables,
      });
    }
    return {
      formula,
      valid: true,
      results: results.sort((a, b) => b.value - a.value),
    };
  }

  public computeEconomicScatter(xIndicator = 'US CPI YoY (%)', yIndicator = 'US 10Y Yield (%)'): MacroFundamentalSnapshot['economicScatterPlot'] {
    const rawPoints = [
      { label: 'Q1-23', x: 5.8, y: 3.55 },
      { label: 'Q2-23', x: 4.1, y: 3.78 },
      { label: 'Q3-23', x: 3.6, y: 4.57 },
      { label: 'Q4-23', x: 3.2, y: 3.88 },
      { label: 'Q1-24', x: 3.4, y: 4.21 },
      { label: 'Q2-24', x: 3.0, y: 4.36 },
      { label: 'Q3-24', x: 2.5, y: 3.79 },
      { label: 'Q4-24', x: 2.7, y: 4.42 },
      { label: 'Q1-25', x: 2.9, y: 4.55 },
      { label: 'Q2-25', x: 2.4, y: 4.18 },
    ];

    const n = rawPoints.length;
    const meanX = rawPoints.reduce((a, p) => a + p.x, 0) / n;
    const meanY = rawPoints.reduce((a, p) => a + p.y, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (const p of rawPoints) {
      num += (p.x - meanX) * (p.y - meanY);
      denX += (p.x - meanX) ** 2;
      denY += (p.y - meanY) ** 2;
    }
    const slope = denX > 0 ? Number((num / denX).toFixed(3)) : 0;
    const r = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;

    return {
      xIndicator,
      yIndicator,
      slope,
      rSquared: Number((r * r).toFixed(3)),
      points: rawPoints,
    };
  }

  public getSnapshot(params?: {
    symbol?: string;
    timeframe?: TimeFrame;
    customFormula?: string;
  }): MacroFundamentalSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const cleanSym = ctx.symbol.replace('/USD', '');

    const otcBonds = [
      { ticker: 'UST 2Y OTR', issuer: 'United States Treasury', tenor: '2Y', yieldPct: 4.24, cleanPrice: 99.64, oasBps: 0, dv01PerMillion: 188, dailyChangeBps: -3.2 },
      { ticker: 'UST 10Y OTR', issuer: 'United States Treasury', tenor: '10Y', yieldPct: 4.38, cleanPrice: 98.12, oasBps: 0, dv01PerMillion: 794, dailyChangeBps: 2.1 },
      { ticker: 'UST 30Y OTR', issuer: 'United States Treasury', tenor: '30Y', yieldPct: 4.59, cleanPrice: 95.88, oasBps: 0, dv01PerMillion: 1620, dailyChangeBps: 3.4 },
      { ticker: 'DBR 10Y', issuer: 'Federal Republic of Germany', tenor: '10Y', yieldPct: 2.34, cleanPrice: 100.41, oasBps: -204, dv01PerMillion: 835, dailyChangeBps: -1.8 },
      { ticker: 'UKT 10Y', issuer: 'UK Debt Management Office', tenor: '10Y', yieldPct: 4.46, cleanPrice: 97.52, oasBps: 8, dv01PerMillion: 775, dailyChangeBps: 1.5 },
      { ticker: 'IGB 10Y', issuer: 'Government of India (RBI)', tenor: '10Y', yieldPct: 6.78, cleanPrice: 101.18, oasBps: 240, dv01PerMillion: 682, dailyChangeBps: -2.4 },
    ];

    const supplyChainGraph: MacroFundamentalSnapshot['supplyChainGraph'] = [
      { tier: 'UPSTREAM_SUPPLIER', entity: 'ASML Holding / Tokyo Electron', country: 'NLD/JPN', revenueDependencyPct: 84, fragilityScore: 78, chokepointRisk: 'EUV Lithography Export Control' },
      { tier: 'UPSTREAM_SUPPLIER', entity: 'SK Hynix (HBM3E Memory)', country: 'KOR', revenueDependencyPct: 62, fragilityScore: 69, chokepointRisk: 'CoWoS Packaging Allocation' },
      { tier: 'MIDSTREAM_FOUNDRY', entity: 'TSMC N3/N4P Fab Clusters', country: 'TWN', revenueDependencyPct: 91, fragilityScore: 86, chokepointRisk: 'Taiwan Strait Maritime Chokepoint' },
      { tier: 'DOWNSTREAM_CUSTOMER', entity: 'Microsoft / Meta / Alphabet Hyperscalers', country: 'USA', revenueDependencyPct: 47, fragilityScore: 32, chokepointRisk: 'Capex Digestion Cycle' },
    ];

    const assets = ['XAU/USD', 'EUR/USD', 'NVDA', 'US10Y', 'BTC/USD', 'NIFTY50'];
    const values = [
      [1.0, 0.64, 0.21, -0.71, 0.42, 0.19],
      [0.64, 1.0, 0.31, -0.58, 0.37, 0.28],
      [0.21, 0.31, 1.0, -0.44, 0.56, 0.49],
      [-0.71, -0.58, -0.44, 1.0, -0.39, -0.33],
      [0.42, 0.37, 0.56, -0.39, 1.0, 0.36],
      [0.19, 0.28, 0.49, -0.33, 0.36, 1.0],
    ];

    const starMineAnalystScores = [
      { firm: 'Goldman Sachs', analyst: 'T. Hari', accuracyPercentile: 96, smartEstimate: 0.94, consensusEstimate: 0.85, predictedSurprisePct: 10.6, rating: 'CONVICTION_BUY' },
      { firm: 'Morgan Stanley', analyst: 'J. Moore', accuracyPercentile: 92, smartEstimate: 0.91, consensusEstimate: 0.85, predictedSurprisePct: 7.1, rating: 'OVERWEIGHT' },
      { firm: 'Bernstein Research', analyst: 'S. Rasgon', accuracyPercentile: 95, smartEstimate: 0.93, consensusEstimate: 0.85, predictedSurprisePct: 9.4, rating: 'OUTPERFORM' },
      { firm: 'J.P. Morgan', analyst: 'H. Sur', accuracyPercentile: 89, smartEstimate: 0.88, consensusEstimate: 0.85, predictedSurprisePct: 3.5, rating: 'OVERWEIGHT' },
    ];

    const shippingTracker: MacroFundamentalSnapshot['shippingTracker'] = {
      balticDryIndex: 1842,
      bdiChangePct: 2.34,
      wciContainerUsd: 3420,
      redSeaTransitDropPct: -54.2,
      chokepoints: [
        { name: 'Bab el-Mandeb / Red Sea', status: 'DISRUPTED', avgDelayHours: 196, activeVessels: 42 },
        { name: 'Panama Canal Locks', status: 'CONGESTED', avgDelayHours: 38, activeVessels: 89 },
        { name: 'Strait of Malacca', status: 'NORMAL', avgDelayHours: 6, activeVessels: 312 },
        { name: 'Strait of Hormuz', status: 'CONGESTED', avgDelayHours: 14, activeVessels: 124 },
      ],
    };

    const pitFundamentalRevisions = [
      { period: 'FY24 Q2', metric: 'Non-GAAP EPS ($)', asReportedValue: 0.68, restatedValue: 0.68, revisionDeltaPct: 0.0, filingDate: '2024-08-28' },
      { period: 'FY24 Q3', metric: 'Gross Margin (%)', asReportedValue: 74.6, restatedValue: 73.9, revisionDeltaPct: -0.94, filingDate: '2024-11-20' },
      { period: 'FY24 Q4', metric: 'Free Cash Flow ($B)', asReportedValue: 15.5, restatedValue: 15.82, revisionDeltaPct: 2.06, filingDate: '2025-02-26' },
    ];

    const institutionalOwnership = [
      { institution: 'Vanguard Group (13F)', ownershipPct: 8.74, sharesMillions: 2140.5, qoqChangePct: 1.4, filingQuarter: 'Q4-13F' },
      { institution: 'BlackRock Institutional Trust', ownershipPct: 7.42, sharesMillions: 1817.2, qoqChangePct: 2.1, filingQuarter: 'Q4-13F' },
      { institution: 'FMR / Fidelity Management', ownershipPct: 4.18, sharesMillions: 1024.0, qoqChangePct: 3.8, filingQuarter: 'Q4-13F' },
      { institution: 'Citadel Advisors (Multi-Strat)', ownershipPct: 0.96, sharesMillions: 235.1, qoqChangePct: 14.2, filingQuarter: 'Q4-13F' },
    ];

    const cdsSpreads = [
      { referenceEntity: `${cleanSym} Senior Unsecured`, tenor: '5Y' as const, spreadBps: Math.round(seededRange(`${ctx.symbol}:cds`, 24, 68)), dailyChangeBps: -1.4, implied5YDefaultProbPct: 0.52 },
      { referenceEntity: 'USA Sovereign 5Y CDS', tenor: '5Y' as const, spreadBps: 38, dailyChangeBps: 0.6, implied5YDefaultProbPct: 0.63 },
      { referenceEntity: 'CDX.NA.IG Investment Grade', tenor: '5Y' as const, spreadBps: 51, dailyChangeBps: -0.9, implied5YDefaultProbPct: 0.85 },
      { referenceEntity: 'iTraxx Europe Crossover HY', tenor: '5Y' as const, spreadBps: 294, dailyChangeBps: -4.2, implied5YDefaultProbPct: 4.82 },
    ];

    const privateMaMultiples = [
      { target: 'Run:ai GPU Orchestration', acquirer: 'NVIDIA Corp.', sector: 'AI Infrastructure', dealValueBillions: 0.7, evToEbitda: 28.4, evToRevenue: 14.2, announcedDate: '2024-04-24' },
      { target: 'Wiz Cloud Security (Ref Comp)', acquirer: 'Alphabet / Consortium', sector: 'Cybersecurity', dealValueBillions: 32.0, evToEbitda: 41.2, evToRevenue: 24.6, announcedDate: '2025-03-18' },
      { target: 'HashiCorp Multi-Cloud', acquirer: 'IBM Corp.', sector: 'DevOps Infra', dealValueBillions: 6.4, evToEbitda: 31.0, evToRevenue: 10.8, announcedDate: '2024-04-24' },
    ];

    const yieldCurveHistory: MacroFundamentalSnapshot['yieldCurveHistory'] = [
      {
        snapshotLabel: 'TODAY',
        points: [
          { tenor: '3M', yieldPct: 4.32 },
          { tenor: '2Y', yieldPct: 4.24 },
          { tenor: '5Y', yieldPct: 4.29 },
          { tenor: '10Y', yieldPct: 4.38 },
          { tenor: '30Y', yieldPct: 4.59 },
        ],
        spread2s10sBps: 14,
      },
      {
        snapshotLabel: '1M_AGO',
        points: [
          { tenor: '3M', yieldPct: 4.46 },
          { tenor: '2Y', yieldPct: 4.31 },
          { tenor: '5Y', yieldPct: 4.33 },
          { tenor: '10Y', yieldPct: 4.41 },
          { tenor: '30Y', yieldPct: 4.62 },
        ],
        spread2s10sBps: 10,
      },
      {
        snapshotLabel: '6M_AGO',
        points: [
          { tenor: '3M', yieldPct: 5.18 },
          { tenor: '2Y', yieldPct: 4.12 },
          { tenor: '5Y', yieldPct: 3.84 },
          { tenor: '10Y', yieldPct: 3.92 },
          { tenor: '30Y', yieldPct: 4.21 },
        ],
        spread2s10sBps: -20,
      },
      {
        snapshotLabel: '1Y_AGO',
        points: [
          { tenor: '3M', yieldPct: 5.38 },
          { tenor: '2Y', yieldPct: 4.68 },
          { tenor: '5Y', yieldPct: 4.31 },
          { tenor: '10Y', yieldPct: 4.32 },
          { tenor: '30Y', yieldPct: 4.46 },
        ],
        spread2s10sBps: -36,
      },
    ];

    const dynamicTaxAdjustment = [
      { company: cleanSym, statutoryRatePct: 21.0, effectiveRatePct: 13.8, normalizedRatePct: 18.5, reportedEbitMillions: 18400, taxAdjustedNopatMillions: 14996, nopatVariancePct: -5.4 },
      { company: 'MSFT', statutoryRatePct: 21.0, effectiveRatePct: 18.2, normalizedRatePct: 19.5, reportedEbitMillions: 29200, taxAdjustedNopatMillions: 23506, nopatVariancePct: -1.6 },
      { company: 'RELIANCE (India Tax)', statutoryRatePct: 25.17, effectiveRatePct: 24.4, normalizedRatePct: 25.17, reportedEbitMillions: 21600, taxAdjustedNopatMillions: 16163, nopatVariancePct: -1.0 },
    ];

    return {
      symbol: ctx.symbol,
      spotPrice: ctx.spotPrice,
      otcBonds,
      supplyChainGraph,
      correlationMatrix: { assets, values, lookbackDays: 90 },
      starMineAnalystScores,
      shippingTracker,
      pitFundamentalRevisions,
      institutionalOwnership,
      cdsSpreads,
      privateMaMultiples,
      yieldCurveHistory,
      customRatioEvaluation: this.evaluateCustomRatio(params?.customFormula || '(FCF / MarketCap) * ROIC'),
      economicScatterPlot: this.computeEconomicScatter(),
      dynamicTaxAdjustment,
    };
  }
}

export const fundamentalMacroEngine = FundamentalMacroEngine.getInstance();
