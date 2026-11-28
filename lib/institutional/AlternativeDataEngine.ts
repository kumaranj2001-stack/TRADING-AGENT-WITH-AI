import type { TimeFrame } from '../types';
import type { AlternativeDataSnapshot } from './types';
import { classifyInstitutionalAsset, resolveInstitutionalAssetContext, seededRange } from './helpers';

export class AlternativeDataEngine {
  private static instance: AlternativeDataEngine;

  private constructor() {}

  public static getInstance(): AlternativeDataEngine {
    if (!AlternativeDataEngine.instance) {
      AlternativeDataEngine.instance = new AlternativeDataEngine();
    }
    return AlternativeDataEngine.instance;
  }

  public getSnapshot(params?: { symbol?: string; timeframe?: TimeFrame }): AlternativeDataSnapshot {
    const ctx = resolveInstitutionalAssetContext(params?.symbol || 'XAU/USD', params?.timeframe || '1h');
    const assetClass = classifyInstitutionalAsset(ctx.symbol);

    const esgGeopoliticalNlp: AlternativeDataSnapshot['esgGeopoliticalNlp'] = [
      { pillar: 'ENVIRONMENTAL', score: 78, controversyVelocity: -4.2, keyDriver: assetClass === 'METALS_COMMODITIES' ? 'LBMA responsible sourcing & low-carbon bullion refining' : 'Grid decarbonization PPA & renewable procurement contracts' },
      { pillar: 'SOCIAL', score: 71, controversyVelocity: 1.8, keyDriver: assetClass === 'FOREX' ? 'Real wage growth & labor participation trends' : 'Technical talent retention & STEM workforce expansion' },
      { pillar: 'GOVERNANCE', score: 84, controversyVelocity: -1.1, keyDriver: assetClass === 'METALS_COMMODITIES' || assetClass === 'FOREX' ? 'Central bank policy credibility & reserve audit transparency' : 'Independent audit committee & capital return discipline' },
      { pillar: 'GEOPOLITICAL', score: Math.round(seededRange(`${ctx.symbol}:geo`, 42, 74)), controversyVelocity: 12.4, keyDriver: 'Export-control tariff risk, maritime shipping diversion & central bank reserve shifts' },
    ];

    const newsNoveltyScores = [
      { timestamp: '06:51 UTC', headline: `Fresh sovereign reserve diversification accelerates physical demand near ${ctx.spotPrice}`, ensNoveltyScore: 94, essSentimentScore: 0.72, taxonomyCode: 'MACRO > CENTRAL_BANK > RESERVES' },
      { timestamp: '06:34 UTC', headline: 'Wire echo: Quarterly PMI manufacturing sub-index repeat syndication across 14 outlets', ensNoveltyScore: 22, essSentimentScore: -0.18, taxonomyCode: 'MACRO > ECONOMIC_RELEASE > PMI' },
      {
        timestamp: '06:12 UTC',
        headline:
          assetClass === 'METALS_COMMODITIES' || assetClass === 'FOREX'
            ? `Real-yield & central-bank liquidity revision shifts forward macro positioning on ${ctx.symbol}`
            : `Primary supply chain capex revision alters forward margin outlook for ${ctx.symbol}`,
        ensNoveltyScore: 88,
        essSentimentScore: 0.64,
        taxonomyCode: assetClass === 'METALS_COMMODITIES' || assetClass === 'FOREX' ? 'MACRO > RATES > LIQUIDITY' : 'CORP > GUIDANCE > CAPEX',
      },
    ];

    const macroImpactTaxonomy = [
      { group: 'Monetary Policy', category: 'Central Bank Balance Sheet', eventType: 'QT Pace Taper Signal', historicalBetaWeight: 0.86, activeRegimeSignal: 'DOVISH_LIQUIDITY_SUPPORTIVE' },
      { group: 'Geopolitics & Trade', category: 'Maritime & Tariff Disruption', eventType: 'Red Sea / Strait Diversion', historicalBetaWeight: 0.74, activeRegimeSignal: 'INFLATION_SUPPLY_RISK' },
      { group: 'Corporate Real Economy', category: 'Capex & Inventory Cycle', eventType: 'AI / Cloud Data Center Build', historicalBetaWeight: 0.69, activeRegimeSignal: 'SECULAR_EXPANSION' },
    ];

    const satelliteParkingData =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { retailer: 'LBMA London Vaults (Brinks/HSBC)', ticker: 'LBMA_AU', fillRatePct: 86.2, yoyTrafficDeltaPct: 5.8, regionsSampled: 14 },
            { retailer: 'Zurich / Swiss Assay Refineries', ticker: 'PAMP_CH', fillRatePct: 91.4, yoyTrafficDeltaPct: 7.2, regionsSampled: 9 },
            { retailer: 'Shanghai Gold Exchange Hubs', ticker: 'SGE_AU', fillRatePct: 78.9, yoyTrafficDeltaPct: 4.5, regionsSampled: 18 },
            { retailer: 'COMEX Approved Depositories', ticker: 'COMEX_NY', fillRatePct: 73.1, yoyTrafficDeltaPct: -2.4, regionsSampled: 11 },
          ]
        : assetClass === 'FOREX'
          ? [
              { retailer: 'Rotterdam Europort Freight Hubs', ticker: 'EUR_TRADE', fillRatePct: 81.5, yoyTrafficDeltaPct: 2.8, regionsSampled: 32 },
              { retailer: 'Los Angeles / Long Beach Ports', ticker: 'USD_IMPORT', fillRatePct: 84.3, yoyTrafficDeltaPct: 5.1, regionsSampled: 26 },
              { retailer: 'Yokohama / Tokyo Auto & Tech Export', ticker: 'JPY_EXP', fillRatePct: 76.8, yoyTrafficDeltaPct: 3.4, regionsSampled: 19 },
              { retailer: 'London GatewayFX Clearing Zones', ticker: 'GBP_CLR', fillRatePct: 79.0, yoyTrafficDeltaPct: 1.9, regionsSampled: 15 },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { retailer: 'JNPT & Mundra Port Cargo Terminals', ticker: 'INDIA_PORT', fillRatePct: 88.7, yoyTrafficDeltaPct: 9.2, regionsSampled: 44 },
                { retailer: 'Dedicated Freight Corridor Hubs', ticker: 'IR_DFC', fillRatePct: 85.1, yoyTrafficDeltaPct: 7.8, regionsSampled: 112 },
                { retailer: 'NHAI FASTag Highway Logistics', ticker: 'NHAI_TOLL', fillRatePct: 89.4, yoyTrafficDeltaPct: 11.4, regionsSampled: 420 },
                { retailer: 'Gujarat & Maharashtra Industrial Zones', ticker: 'IND_MFG', fillRatePct: 82.6, yoyTrafficDeltaPct: 6.3, regionsSampled: 96 },
              ]
            : assetClass === 'CRYPTO'
              ? [
                  { retailer: 'North America BTC Mining Immersion Sites', ticker: 'BTC_HASH', fillRatePct: 92.5, yoyTrafficDeltaPct: 14.2, regionsSampled: 68 },
                  { retailer: 'Institutional Cold Custody Vaults', ticker: 'CUSTODY', fillRatePct: 87.9, yoyTrafficDeltaPct: 18.6, regionsSampled: 24 },
                  { retailer: 'Texas / ERCOT Power Load Shedding Nodes', ticker: 'ERCOT_MW', fillRatePct: 74.0, yoyTrafficDeltaPct: 5.4, regionsSampled: 31 },
                  { retailer: 'Equinix LD4 / TY3 Colocation Racks', ticker: 'COLO_L3', fillRatePct: 90.2, yoyTrafficDeltaPct: 8.1, regionsSampled: 16 },
                ]
              : [
                  { retailer: 'Costco Wholesale', ticker: 'COST', fillRatePct: 84.6, yoyTrafficDeltaPct: 6.4, regionsSampled: 412 },
                  { retailer: 'Walmart Supercenters', ticker: 'WMT', fillRatePct: 79.2, yoyTrafficDeltaPct: 4.1, regionsSampled: 1280 },
                  { retailer: 'Home Depot', ticker: 'HD', fillRatePct: 68.4, yoyTrafficDeltaPct: -1.8, regionsSampled: 640 },
                  { retailer: 'Target Stores', ticker: 'TGT', fillRatePct: 72.1, yoyTrafficDeltaPct: 2.3, regionsSampled: 580 },
                ];

    const consumerTransactionPanels =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { merchantCategory: 'Physical Bullion Bars & Coins Retail Demand', spendYoYPct: 14.8, avgTicketChangePct: 6.4, cardPanelUsersMillions: 6.8 },
            { merchantCategory: 'Asian Sovereign & Bridal Jewellery Fabrication', spendYoYPct: 9.2, avgTicketChangePct: 4.1, cardPanelUsersMillions: 18.4 },
            { merchantCategory: 'Industrial Solar & Electronics Paste Demand', spendYoYPct: 11.5, avgTicketChangePct: 3.0, cardPanelUsersMillions: 4.2 },
          ]
        : assetClass === 'FOREX'
          ? [
              { merchantCategory: 'Cross-Border SWIFT & FX Corporate Settlement', spendYoYPct: 7.4, avgTicketChangePct: 2.1, cardPanelUsersMillions: 12.6 },
              { merchantCategory: 'International Tourism & Duty-Free Spend', spendYoYPct: 11.2, avgTicketChangePct: 4.6, cardPanelUsersMillions: 14.2 },
              { merchantCategory: 'G10 Sovereign T-Bill & MMF Flows', spendYoYPct: 15.1, avgTicketChangePct: 5.9, cardPanelUsersMillions: 9.4 },
            ]
          : [
              { merchantCategory: 'Cloud & Enterprise SaaS Card Spend', spendYoYPct: 18.4, avgTicketChangePct: 5.2, cardPanelUsersMillions: 14.2 },
              { merchantCategory: 'Consumer Apparel & Luxury Retail', spendYoYPct: 1.9, avgTicketChangePct: -2.1, cardPanelUsersMillions: 14.2 },
              { merchantCategory: 'Travel, Airlines & Hospitality', spendYoYPct: 9.7, avgTicketChangePct: 3.4, cardPanelUsersMillions: 14.2 },
            ];

    const primaryDeskLabel =
      assetClass === 'METALS_COMMODITIES'
        ? `LBMA / COMEX Bullion Institutional Desk Peers (${ctx.symbol})`
        : assetClass === 'FOREX'
        ? `G10 Macro Quant & E-FX Bank Peers (${ctx.symbol})`
        : ctx.symbol;

    const corporateJobVelocity: AlternativeDataSnapshot['corporateJobVelocity'] = [
      { company: primaryDeskLabel, openRoles: 2480, aiEngineeringDelta30dPct: 14.6, salesHiringDelta30dPct: 6.2, signal: 'EXPANSIONARY' },
      { company: 'MSFT / Azure', openRoles: 6120, aiEngineeringDelta30dPct: 11.4, salesHiringDelta30dPct: 3.8, signal: 'EXPANSIONARY' },
      { company: 'Legacy Retail Peer', openRoles: 840, aiEngineeringDelta30dPct: -3.2, salesHiringDelta30dPct: -6.8, signal: 'HIRING_FREEZE' },
    ];

    const ecommercePricingTracker =
      assetClass === 'METALS_COMMODITIES'
        ? [
            { brand: 'London AM/PM Bullion Benchmark Premium', avgDiscountPct: 0.2, priceIndexVs30d: 103.8, outOfStockRatePct: 3.1 },
            { brand: 'Shanghai Gold Physical Fix Premium ($/oz)', avgDiscountPct: 0.0, priceIndexVs30d: 106.4, outOfStockRatePct: 12.5 },
            { brand: 'Swiss Mint / Sovereign Gold Coin Premium', avgDiscountPct: 1.1, priceIndexVs30d: 104.2, outOfStockRatePct: 9.8 },
          ]
        : assetClass === 'FOREX'
          ? [
              { brand: 'EUR/USD 3M Cross-Currency Basis Index', avgDiscountPct: 0.3, priceIndexVs30d: 100.8, outOfStockRatePct: 1.2 },
              { brand: 'USD/JPY Forward Swap Implied Index', avgDiscountPct: 0.5, priceIndexVs30d: 102.4, outOfStockRatePct: 2.0 },
              { brand: 'DXY Real Rate Differential Tracker', avgDiscountPct: 0.1, priceIndexVs30d: 101.6, outOfStockRatePct: 1.5 },
            ]
          : assetClass === 'INDIAN_EQUITY_INDEX'
            ? [
                { brand: 'NSE Retail Consumption & Auto Basket', avgDiscountPct: 3.8, priceIndexVs30d: 103.1, outOfStockRatePct: 2.9 },
                { brand: 'UPI Digital Merchant Settlement Index', avgDiscountPct: 0.2, priceIndexVs30d: 109.4, outOfStockRatePct: 0.4 },
                { brand: 'India IT Services Export Deal Pipeline', avgDiscountPct: 1.5, priceIndexVs30d: 102.2, outOfStockRatePct: 1.8 },
              ]
            : assetClass === 'CRYPTO'
              ? [
                  { brand: 'Spot BTC ETF Net Creation Premium (bps)', avgDiscountPct: 0.1, priceIndexVs30d: 107.8, outOfStockRatePct: 1.4 },
                  { brand: 'CME Annualized Front-Month Basis', avgDiscountPct: 0.2, priceIndexVs30d: 109.2, outOfStockRatePct: 2.1 },
                  { brand: 'Stablecoin On-Chain Peg Liquidity Index', avgDiscountPct: 0.0, priceIndexVs30d: 100.1, outOfStockRatePct: 0.3 },
                ]
              : [
                  { brand: 'Apple Consumer Hardware', avgDiscountPct: 2.4, priceIndexVs30d: 101.2, outOfStockRatePct: 4.8 },
                  { brand: 'Nike Direct DTC', avgDiscountPct: 18.6, priceIndexVs30d: 96.4, outOfStockRatePct: 8.1 },
                  { brand: 'NVIDIA Partner GPU SKUs', avgDiscountPct: 0.4, priceIndexVs30d: 108.5, outOfStockRatePct: 26.4 },
                ];

    const compositeAltAlphaScore = Math.round(
      (esgGeopoliticalNlp[2].score * 0.2 +
        newsNoveltyScores[0].ensNoveltyScore * 0.35 +
        (65 + satelliteParkingData[0].yoyTrafficDeltaPct * 2) * 0.25 +
        (60 + corporateJobVelocity[0].aiEngineeringDelta30dPct) * 0.2)
    );

    return {
      symbol: ctx.symbol,
      compositeAltAlphaScore: Math.max(15, Math.min(98, compositeAltAlphaScore)),
      esgGeopoliticalNlp,
      newsNoveltyScores,
      macroImpactTaxonomy,
      satelliteParkingData,
      consumerTransactionPanels,
      corporateJobVelocity,
      ecommercePricingTracker,
    };
  }
}

export const alternativeDataEngine = AlternativeDataEngine.getInstance();
