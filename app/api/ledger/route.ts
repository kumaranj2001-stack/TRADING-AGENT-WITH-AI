import { NextResponse } from 'next/server';
import { unifiedLedgerService } from '@/lib/ledger/UnifiedLedgerService';
import { deterministicRiskFirewall } from '@/lib/governance/DeterministicRiskFirewall';
import type { PortfolioState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ledger = unifiedLedgerService.getSnapshot();
    const firewall = deterministicRiskFirewall.getSecurityTelemetry();
    return NextResponse.json({
      success: true,
      ledger,
      firewall,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API /ledger GET] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve unified ledger snapshot' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const portfolio: PortfolioState | undefined = body?.portfolio;
    const maxDailyDrawdownPercent =
      typeof body?.maxDailyDrawdownPercent === 'number' && body.maxDailyDrawdownPercent > 0
        ? body.maxDailyDrawdownPercent
        : 4.0;

    if (portfolio && typeof portfolio.balance === 'number') {
      unifiedLedgerService.syncPortfolioState(portfolio, maxDailyDrawdownPercent);
      const unrealized = (portfolio.positions || []).reduce((s, p) => s + (p.pnl || 0), 0);
      deterministicRiskFirewall.updateEquityTelemetry(
        portfolio.balance + unrealized,
        portfolio.dailyStartingBalance || portfolio.balance
      );
    }

    return NextResponse.json({
      success: true,
      ledger: unifiedLedgerService.getSnapshot(),
      firewall: deterministicRiskFirewall.getSecurityTelemetry(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API /ledger POST] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to synchronize unified ledger' }, { status: 500 });
  }
}
