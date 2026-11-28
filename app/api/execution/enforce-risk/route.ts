import { NextResponse } from 'next/server';
import { unifiedLedgerService } from '@/lib/ledger/UnifiedLedgerService';
import { LiveMarketFeedManager } from '@/lib/liveMarketFeed';
import { institutionalBrokerBridge } from '@/lib/execution/InstitutionalBrokerBridge';
import { deterministicRiskFirewall } from '@/lib/governance/DeterministicRiskFirewall';
import { PIP_VALUES } from '@/lib/marketData';
import type { CurrencyPair, Position } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const positions: Position[] = Array.isArray(body?.positions) ? body.positions : [];
    const balance = typeof body?.balance === 'number' ? body.balance : 25000;
    const dailyStartingBalance =
      typeof body?.dailyStartingBalance === 'number' ? body.dailyStartingBalance : balance;
    const maxDailyDrawdownPercent =
      typeof body?.maxDailyDrawdownPercent === 'number' && body.maxDailyDrawdownPercent > 0
        ? body.maxDailyDrawdownPercent
        : 4.0;
    const overrides: Record<string, number> =
      body?.marketPrices && typeof body.marketPrices === 'object' ? body.marketPrices : {};

    const result = unifiedLedgerService.evaluateAndEnforcePositions({
      positions,
      balance,
      dailyStartingBalance,
      maxDailyDrawdownPercent,
      resolvePrice: (symbol: CurrencyPair) => {
        const clientSpot = overrides[symbol];
        if (typeof clientSpot === 'number' && clientSpot > 0) return clientSpot;
        return LiveMarketFeedManager.getCanonicalPrice(symbol);
      },
    });

    const brokerReports = [];
    for (const ev of result.closedEvents) {
      const units = Math.max(1000, Math.round(ev.lots * (PIP_VALUES[ev.symbol] ? 100000 : 10000)));
      const report = await institutionalBrokerBridge.routeOrder({
        protocol: 'FIX_4_4',
        clOrdId: `RISK_${ev.reason}_${ev.positionId}_${Date.now()}`,
        symbol: ev.symbol,
        side: ev.side === 'BUY' ? 'SELL' : 'BUY',
        orderType: 'MARKET',
        quantityUnits: units,
        price: ev.exitPrice,
        timeInForce: 'IOC',
      });
      brokerReports.push(report);
    }

    deterministicRiskFirewall.updateEquityTelemetry(result.updatedEquity, dailyStartingBalance);

    return NextResponse.json({
      success: true,
      enforced: result.closedEvents.length > 0,
      remainingPositions: result.remainingPositions,
      closedEvents: result.closedEvents,
      updatedBalance: result.updatedBalance,
      updatedEquity: result.updatedEquity,
      drawdownPercent: result.drawdownPercent,
      drawdownBreached: result.drawdownBreached,
      brokerReports,
      ledger: unifiedLedgerService.getSnapshot(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API /execution/enforce-risk POST] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to enforce risk governance' }, { status: 500 });
  }
}
