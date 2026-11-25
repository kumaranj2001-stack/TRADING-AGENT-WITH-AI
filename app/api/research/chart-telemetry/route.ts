import { NextRequest, NextResponse } from 'next/server';
import { liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'telemetry';

    if (action === 'search') {
      const q = searchParams.get('q') || '';
      const results = await liveChartTelemetryService.searchSymbols(q);
      return NextResponse.json({ success: true, results });
    }

    const symbol = searchParams.get('symbol') || 'NVDA';
    const timeframe = searchParams.get('timeframe') || '1h';
    const indicatorsRaw = searchParams.get('indicators');
    const activeIndicators = indicatorsRaw
      ? indicatorsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const telemetry = await liveChartTelemetryService.fetchLiveChartTelemetry(
      symbol,
      timeframe,
      activeIndicators
    );

    return NextResponse.json({
      success: true,
      telemetry,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch live chart telemetry' },
      { status: 500 }
    );
  }
}
