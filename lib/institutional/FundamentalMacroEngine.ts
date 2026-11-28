import type { TimeFrame } from '../types';
import type { MacroFundamentalSnapshot } from './types';
import { classifyInstitutionalAsset, evaluateSafeFormula, resolveInstitutionalAssetContext, seededRange } from './helpers';

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
    const assetClass = classifyInstitutionalAsset(ctx.symbol);
    const cleanSym = ctx.symbol.replace('/USD', '');

    const otcBonds = [
      { ticker: 'UST 2Y OTR', issuer: 'United States Treasury', tenor: '2Y', yieldPct: 4.24, cleanPrice: 99.64, oasBps: 0, dv01PerMillion: 188, dailyChangeBps: -3.2 },
      { ticker: 'UST 10Y OTR', issuer: 'United States Treasury', tenor: '10Y', yieldPct: 4.38, cleanPrice: 98.12, oasBps: 0, dv01PerMillion: 794, dailyChangeBps: 2.1 },
      { ticker: 'UST 30Y OTR', issuer: 'United States Treasury', tenor: '30Y', yieldPct: 4.59, cleanPrice: 95.88, oasBps: 0, dv01PerMillion: 1620, dailyChangeBps: 3.4 },
      { ticker: 'DBR 10Y', issuer: 'Federal Republic of Germany', tenor: '10Y', yieldPct: 2.34, cleanPrice: 100.41, oasBps: -204, dv01PerMillion: 835, dailyChangeBps: -1.8 },
      { ticker: 'UKT 10Y', issuer: 'UK Debt Management Office', tenor: '10Y', yieldPct: 4.46, cleanPrice: 97.52, oasBps: 8, dv01PerMillion: 775, dailyChangeBps: 1.5 },
      { ticker: 'IGB 10Y', issuer: 'Government of India (RBI)', tenor: '10Y', yieldPct: 6.78, cleanPrice: 101.18, oasBps: 240, dv01PerMillion: 682, dailyChangeBps: -2.4 },
    ];

    const supplyChainGraph: MacroFundamentalSnapshot['supplyChainGraph'] =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { tier: 'UPSTREAM_SUPPLIER', entity: 'Primary Mines (Newmont / Barrick / AngloGold)', country: 'AUS/CAN/ZAF', revenueDependencyPct: 76, fragilityScore: 61, chokepointRisk: 'AISC Energy Cost & Ore Grade Depletion' },
            { tier: 'UPSTREAM_SUPPLIER', entity: 'Swiss Good-Delivery Refineries (PAMP / Valcambi)', country: 'CHE', revenueDependencyPct: 68, fragilityScore: 44, chokepointRisk: 'Doré Assay Throughput & Customs Quota' },
            { tier: 'MIDSTREAM_FOUNDRY', entity: 'LBMA London Vaults & COMEX Clearing Warehouses', country: 'GBR/USA', revenueDependencyPct: 89, fragilityScore: 52, chokepointRisk: 'EFP Basis Spread & Registered Vault Drawdown' },
            { tier: 'DOWNSTREAM_CUSTOMER', entity: 'Sovereign Central Banks, GLD/IAU ETFs & Asian Bullion Hubs', country: 'CHN/IND/POL', revenueDependencyPct: 82, fragilityScore: 39, chokepointRisk: 'US Real Yield (10Y TIPS) & DXY Regime' },
          ]
        : assetClass === 'FOREX'
        ? [
            { tier: 'UPSTREAM_SUPPLIER', entity: 'Central Bank Policy Liquidity (Fed / ECB / BoJ / BoE)', country: 'G10', revenueDependencyPct: 92, fragilityScore: 64, chokepointRisk: 'Terminal Rate Spread Divergence' },
            { tier: 'UPSTREAM_SUPPLIER', entity: 'CLS / Tier-1 Prime FX Settlement Clearing Banks', country: 'USA/GBR', revenueDependencyPct: 86, fragilityScore: 38, chokepointRisk: 'Quarter-End Cross-Currency Basis Turn' },
            { tier: 'MIDSTREAM_FOUNDRY', entity: 'Institutional ECN Venues (EBS Direct / LMAX / Currenex)', country: 'LD4/NY4', revenueDependencyPct: 79, fragilityScore: 41, chokepointRisk: 'Macro Print Liquidity Gap' },
            { tier: 'DOWNSTREAM_CUSTOMER', entity: 'Sovereign Reserve Managers, CTAs & Multinational Hedgers', country: 'GLOBAL', revenueDependencyPct: 71, fragilityScore: 47, chokepointRisk: 'Risk-Off USD Funding Squeeze' },
          ]
        : assetClass === 'CRYPTO'
        ? [
            { tier: 'UPSTREAM_SUPPLIER', entity: 'Layer-1 Validators & Listed Bitcoin Miners (MARA / RIOT)', country: 'USA/CAN', revenueDependencyPct: 74, fragilityScore: 68, chokepointRisk: 'Hashprice Compression & Power Curtailment' },
            { tier: 'UPSTREAM_SUPPLIER', entity: 'Institutional Qualified Custodians (Coinbase Prime / BitGo)', country: 'USA', revenueDependencyPct: 81, fragilityScore: 54, chokepointRisk: 'Cold Storage Key & Regulatory Compliance' },
            { tier: 'MIDSTREAM_FOUNDRY', entity: 'Spot ETF Authorized Participants & CME Futures Desk', country: 'USA', revenueDependencyPct: 88, fragilityScore: 46, chokepointRisk: 'CME Basis Carry Unwind' },
            { tier: 'DOWNSTREAM_CUSTOMER', entity: 'BlackRock IBIT / Fidelity FBTC ETF & Corporate Treasuries', country: 'GLOBAL', revenueDependencyPct: 67, fragilityScore: 52, chokepointRisk: 'Net Daily ETF Outflow Streak' },
          ]
        : [
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

    const starMineAnalystScores =
      assetClass === 'METALS_COMMODITIES' || assetClass === 'FOREX' || assetClass === 'CRYPTO'
        ? [
            { firm: 'Goldman Sachs Commodities/FX', analyst: 'D. Struyven', accuracyPercentile: 95, smartEstimate: Number((ctx.spotPrice * 1.032).toFixed(ctx.decimals)), consensusEstimate: Number((ctx.spotPrice * 1.015).toFixed(ctx.decimals)), predictedSurprisePct: 1.7, rating: 'CONVICTION_BUY' as const },
            { firm: 'J.P. Morgan Global Research', analyst: 'N. Kaneva', accuracyPercentile: 91, smartEstimate: Number((ctx.spotPrice * 1.024).toFixed(ctx.decimals)), consensusEstimate: Number((ctx.spotPrice * 1.012).toFixed(ctx.decimals)), predictedSurprisePct: 1.2, rating: 'OVERWEIGHT' as const },
            { firm: 'UBS Chief Investment Office', analyst: 'G. Staunovo', accuracyPercentile: 90, smartEstimate: Number((ctx.spotPrice * 1.019).toFixed(ctx.decimals)), consensusEstimate: Number((ctx.spotPrice * 1.009).toFixed(ctx.decimals)), predictedSurprisePct: 1.0, rating: 'OUTPERFORM' as const },
            { firm: 'Morgan Stanley Macro', analyst: 'A. Sheets', accuracyPercentile: 87, smartEstimate: Number((ctx.spotPrice * 1.008).toFixed(ctx.decimals)), consensusEstimate: Number((ctx.spotPrice * 1.002).toFixed(ctx.decimals)), predictedSurprisePct: 0.6, rating: 'OVERWEIGHT' as const },
          ]
        : [
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

    const pitFundamentalRevisions =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { period: '2025 Q4', metric: 'Global Central Bank Net Purchases (Tonnes)', asReportedValue: 286, restatedValue: 312, revisionDeltaPct: 9.09, filingDate: '2026-01-30' },
            { period: '2026 Q1', metric: 'Industry Average AISC ($/oz)', asReportedValue: 1385, restatedValue: 1428, revisionDeltaPct: 3.1, filingDate: '2026-04-28' },
            { period: '2026 Q2', metric: 'COMEX Registered Vault Coverage (%)', asReportedValue: 34.2, restatedValue: 31.8, revisionDeltaPct: -7.02, filingDate: '2026-07-15' },
          ]
        : assetClass === 'FOREX'
        ? [
            { period: '2026 Q1', metric: 'G10 Sovereign Reserve Allocation (%)', asReportedValue: 58.2, restatedValue: 57.6, revisionDeltaPct: -1.03, filingDate: '2026-03-31' },
            { period: '2026 Q2', metric: 'US-Euro 2Y Yield Spread (bps)', asReportedValue: 190, restatedValue: 184, revisionDeltaPct: -3.16, filingDate: '2026-06-20' },
            { period: '2026 Q3', metric: 'CFTC Leveraged Net Positioning (K Contracts)', asReportedValue: 42.5, restatedValue: 49.1, revisionDeltaPct: 15.53, filingDate: '2026-09-18' },
          ]
        : [
            { period: 'FY24 Q2', metric: 'Non-GAAP EPS ($)', asReportedValue: 0.68, restatedValue: 0.68, revisionDeltaPct: 0.0, filingDate: '2024-08-28' },
            { period: 'FY24 Q3', metric: 'Gross Margin (%)', asReportedValue: 74.6, restatedValue: 73.9, revisionDeltaPct: -0.94, filingDate: '2024-11-20' },
            { period: 'FY24 Q4', metric: 'Free Cash Flow ($B)', asReportedValue: 15.5, restatedValue: 15.82, revisionDeltaPct: 2.06, filingDate: '2025-02-26' },
          ];

    const institutionalOwnership =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { institution: 'Sovereign Central Banks (IMF COFER / WGC)', ownershipPct: 18.4, sharesMillions: 36700, qoqChangePct: 2.9, filingQuarter: 'Q2-WGC' },
            { institution: 'SPDR Gold Shares Physical Trust (GLD)', ownershipPct: 4.35, sharesMillions: 874.2, qoqChangePct: 3.4, filingQuarter: 'DAILY-LBMA' },
            { institution: 'iShares Gold Trust Physical (IAU)', ownershipPct: 2.18, sharesMillions: 438.6, qoqChangePct: 1.9, filingQuarter: 'DAILY-LBMA' },
            { institution: 'COMEX Managed Money Net Long', ownershipPct: 1.42, sharesMillions: 218.5, qoqChangePct: 11.4, filingQuarter: 'CFTC-COT' },
          ]
        : assetClass === 'FOREX'
        ? [
            { institution: 'IMF Sovereign FX Reserves (Allocated)', ownershipPct: 20.1, sharesMillions: 2450, qoqChangePct: 0.8, filingQuarter: 'Q2-COFER' },
            { institution: 'CFTC Institutional Asset Managers', ownershipPct: 11.4, sharesMillions: 412, qoqChangePct: 4.6, filingQuarter: 'CFTC-COT' },
            { institution: 'CLS Real-Money Pension Hedgers', ownershipPct: 6.9, sharesMillions: 318, qoqChangePct: 1.7, filingQuarter: 'BIS-FLOW' },
            { institution: 'Macro Systematic CTA Leveraged Funds', ownershipPct: 3.4, sharesMillions: 144, qoqChangePct: 9.2, filingQuarter: 'CFTC-COT' },
          ]
        : [
            { institution: 'Vanguard Group (13F)', ownershipPct: 8.74, sharesMillions: 2140.5, qoqChangePct: 1.4, filingQuarter: 'Q4-13F' },
            { institution: 'BlackRock Institutional Trust', ownershipPct: 7.42, sharesMillions: 1817.2, qoqChangePct: 2.1, filingQuarter: 'Q4-13F' },
            { institution: 'FMR / Fidelity Management', ownershipPct: 4.18, sharesMillions: 1024.0, qoqChangePct: 3.8, filingQuarter: 'Q4-13F' },
            { institution: 'Citadel Advisors (Multi-Strat)', ownershipPct: 0.96, sharesMillions: 235.1, qoqChangePct: 14.2, filingQuarter: 'Q4-13F' },
          ];

    const cdsSpreads =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { referenceEntity: `${ctx.symbol} LBMA Lease & Real-Yield Basis`, tenor: '5Y' as const, spreadBps: Math.round(seededRange(`${ctx.symbol}:cds`, 18, 42)), dailyChangeBps: -1.1, implied5YDefaultProbPct: 0.08 },
            { referenceEntity: 'USA Sovereign 5Y CDS (Fiat Devaluation Hedge)', tenor: '5Y' as const, spreadBps: 38, dailyChangeBps: 0.6, implied5YDefaultProbPct: 0.63 },
            { referenceEntity: 'US 10Y TIPS Real Yield Basis (bps)', tenor: '5Y' as const, spreadBps: 182, dailyChangeBps: -3.4, implied5YDefaultProbPct: 0.25 },
            { referenceEntity: 'COMEX EFP Exchange-for-Physical Basis', tenor: '5Y' as const, spreadBps: 29, dailyChangeBps: 1.2, implied5YDefaultProbPct: 0.14 },
          ]
        : assetClass === 'FOREX'
        ? [
            { referenceEntity: `${ctx.symbol} Cross-Currency XCCY Basis`, tenor: '5Y' as const, spreadBps: Math.round(seededRange(`${ctx.symbol}:cds`, 14, 38)), dailyChangeBps: -0.8, implied5YDefaultProbPct: 0.35 },
            { referenceEntity: 'USA Sovereign 5Y CDS', tenor: '5Y' as const, spreadBps: 38, dailyChangeBps: 0.6, implied5YDefaultProbPct: 0.63 },
            { referenceEntity: 'Eurozone BTP-Bund 10Y Spread (bps)', tenor: '5Y' as const, spreadBps: 118, dailyChangeBps: -2.1, implied5YDefaultProbPct: 1.22 },
            { referenceEntity: 'Japan Sovereign 5Y CDS', tenor: '5Y' as const, spreadBps: 22, dailyChangeBps: 0.3, implied5YDefaultProbPct: 0.37 },
          ]
        : [
            { referenceEntity: `${cleanSym} Senior Unsecured`, tenor: '5Y' as const, spreadBps: Math.round(seededRange(`${ctx.symbol}:cds`, 24, 68)), dailyChangeBps: -1.4, implied5YDefaultProbPct: 0.52 },
            { referenceEntity: 'USA Sovereign 5Y CDS', tenor: '5Y' as const, spreadBps: 38, dailyChangeBps: 0.6, implied5YDefaultProbPct: 0.63 },
            { referenceEntity: 'CDX.NA.IG Investment Grade', tenor: '5Y' as const, spreadBps: 51, dailyChangeBps: -0.9, implied5YDefaultProbPct: 0.85 },
            { referenceEntity: 'iTraxx Europe Crossover HY', tenor: '5Y' as const, spreadBps: 294, dailyChangeBps: -4.2, implied5YDefaultProbPct: 4.82 },
          ];

    const privateMaMultiples =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { target: 'Newcrest Mining Assets', acquirer: 'Newmont Corp.', sector: 'Tier-1 Gold Producers', dealValueBillions: 16.8, evToEbitda: 8.6, evToRevenue: 3.4, announcedDate: '2023-11-06' },
            { target: 'De Grey Mining (Hemi)', acquirer: 'Northern Star Resources', sector: 'Gold Exploration', dealValueBillions: 3.3, evToEbitda: 10.4, evToRevenue: 4.1, announcedDate: '2024-12-02' },
            { target: 'Filo / Vicuna Copper-Gold', acquirer: 'BHP / Lundin JV', sector: 'Metals & Mining', dealValueBillions: 3.25, evToEbitda: 9.8, evToRevenue: 3.9, announcedDate: '2024-07-29' },
          ]
        : [
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

    const dynamicTaxAdjustment =
      assetClass === 'METALS_COMMODITIES' || assetClass === 'FOREX' || assetClass === 'CRYPTO'
        ? [
            { company: 'Gold Producer Sector AISC Benchmark', statutoryRatePct: 24.0, effectiveRatePct: 21.8, normalizedRatePct: 22.5, reportedEbitMillions: 9850, taxAdjustedNopatMillions: 7633, nopatVariancePct: -0.9 },
            { company: 'MSFT (Broad Tech Reference)', statutoryRatePct: 21.0, effectiveRatePct: 18.2, normalizedRatePct: 19.5, reportedEbitMillions: 29200, taxAdjustedNopatMillions: 23506, nopatVariancePct: -1.6 },
            { company: 'RELIANCE (India Tax)', statutoryRatePct: 25.17, effectiveRatePct: 24.4, normalizedRatePct: 25.17, reportedEbitMillions: 21600, taxAdjustedNopatMillions: 16163, nopatVariancePct: -1.0 },
          ]
        : [
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
