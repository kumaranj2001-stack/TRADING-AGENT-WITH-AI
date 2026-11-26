import type { TimeFrame } from '../types';
import type { AlternativeDataSnapshot } from './types';
import { resolveInstitutionalAssetContext, seededRange } from './helpers';

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

    const esgGeopoliticalNlp: AlternativeDataSnapshot['esgGeopoliticalNlp'] = [
      { pillar: 'ENVIRONMENTAL', score: 78, controversyVelocity: -4.2, keyDriver: 'Grid decarbonization PPA & renewable procurement contracts' },
      { pillar: 'SOCIAL', score: 71, controversyVelocity: 1.8, keyDriver: 'Technical talent retention & STEM workforce expansion' },
      { pillar: 'GOVERNANCE', score: 84, controversyVelocity: -1.1, keyDriver: 'Independent audit committee & capital return discipline' },
      { pillar: 'GEOPOLITICAL', score: Math.round(seededRange(`${ctx.symbol}:geo`, 42, 74)), controversyVelocity: 12.4, keyDriver: 'Export-control tariff risk, maritime shipping diversion & central bank reserve shifts' },
    ];

    const newsNoveltyScores = [
      { timestamp: '06:51 UTC', headline: `Fresh sovereign reserve diversification accelerates physical demand near ${ctx.spotPrice}`, ensNoveltyScore: 94, essSentimentScore: 0.72, taxonomyCode: 'MACRO > CENTRAL_BANK > RESERVES' },
      { timestamp: '06:34 UTC', headline: 'Wire echo: Quarterly PMI manufacturing sub-index repeat syndication across 14 outlets', ensNoveltyScore: 22, essSentimentScore: -0.18, taxonomyCode: 'MACRO > ECONOMIC_RELEASE > PMI' },
      { timestamp: '06:12 UTC', headline: `Primary supply chain capex revision alters forward margin outlook for ${ctx.symbol}`, ensNoveltyScore: 88, essSentimentScore: 0.64, taxonomyCode: 'CORP > GUIDANCE > CAPEX' },
    ];

    const macroImpactTaxonomy = [
      { group: 'Monetary Policy', category: 'Central Bank Balance Sheet', eventType: 'QT Pace Taper Signal', historicalBetaWeight: 0.86, activeRegimeSignal: 'DOVISH_LIQUIDITY_SUPPORTIVE' },
      { group: 'Geopolitics & Trade', category: 'Maritime & Tariff Disruption', eventType: 'Red Sea / Strait Diversion', historicalBetaWeight: 0.74, activeRegimeSignal: 'INFLATION_SUPPLY_RISK' },
      { group: 'Corporate Real Economy', category: 'Capex & Inventory Cycle', eventType: 'AI / Cloud Data Center Build', historicalBetaWeight: 0.69, activeRegimeSignal: 'SECULAR_EXPANSION' },
    ];

    const satelliteParkingData = [
      { retailer: 'Costco Wholesale', ticker: 'COST', fillRatePct: 84.6, yoyTrafficDeltaPct: 6.4, regionsSampled: 412 },
      { retailer: 'Walmart Supercenters', ticker: 'WMT', fillRatePct: 79.2, yoyTrafficDeltaPct: 4.1, regionsSampled: 1280 },
      { retailer: 'Home Depot', ticker: 'HD', fillRatePct: 68.4, yoyTrafficDeltaPct: -1.8, regionsSampled: 640 },
      { retailer: 'Target Stores', ticker: 'TGT', fillRatePct: 72.1, yoyTrafficDeltaPct: 2.3, regionsSampled: 580 },
    ];

    const consumerTransactionPanels = [
      { merchantCategory: 'Cloud & Enterprise SaaS Card Spend', spendYoYPct: 18.4, avgTicketChangePct: 5.2, cardPanelUsersMillions: 14.2 },
      { merchantCategory: 'Consumer Apparel & Luxury Retail', spendYoYPct: 1.9, avgTicketChangePct: -2.1, cardPanelUsersMillions: 14.2 },
      { merchantCategory: 'Travel, Airlines & Hospitality', spendYoYPct: 9.7, avgTicketChangePct: 3.4, cardPanelUsersMillions: 14.2 },
    ];

    const corporateJobVelocity: AlternativeDataSnapshot['corporateJobVelocity'] = [
      { company: ctx.symbol, openRoles: 2480, aiEngineeringDelta30dPct: 14.6, salesHiringDelta30dPct: 6.2, signal: 'EXPANSIONARY' },
      { company: 'MSFT / Azure', openRoles: 6120, aiEngineeringDelta30dPct: 11.4, salesHiringDelta30dPct: 3.8, signal: 'EXPANSIONARY' },
      { company: 'Legacy Retail Peer', openRoles: 840, aiEngineeringDelta30dPct: -3.2, salesHiringDelta30dPct: -6.8, signal: 'HIRING_FREEZE' },
    ];

    const ecommercePricingTracker = [
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
