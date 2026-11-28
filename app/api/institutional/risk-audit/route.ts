import { NextRequest, NextResponse } from 'next/server';
import { journalRiskAuditEngine } from '@/lib/institutional/JournalRiskAuditEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const drawdownHardLimitPct = Number(searchParams.get('drawdownHardLimitPct') || 6.0);

  return NextResponse.json({
    success: true,
    data: journalRiskAuditEngine.getSnapshot({ symbol, timeframe, drawdownHardLimitPct }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === 'MONTE_CARLO') {
      const monteCarloEquity = journalRiskAuditEngine.runMonteCarloSimulation(
        Number(body.initialEquity || 100000),
        Number(body.horizonTrades || 50),
        Number(body.winRatePct || 58),
        Number(body.avgWinR || 1.85),
        Number(body.riskPerTradePct || 1.0),
        Number(body.simulations || 1000)
      );
      return NextResponse.json({ success: true, monteCarloEquity });
    }

    return NextResponse.json({
      success: true,
      data: journalRiskAuditEngine.getSnapshot({
        symbol: body?.symbol || 'XAU/USD',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
        drawdownHardLimitPct: Number(body?.drawdownHardLimitPct || 6.0),
        targetVaRPct: Number(body?.targetVaRPct || 10.0),
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Risk audit error' }, { status: 400 });
  }
}
