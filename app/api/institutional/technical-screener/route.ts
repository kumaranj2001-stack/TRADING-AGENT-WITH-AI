import { NextRequest, NextResponse } from 'next/server';
import { technicalScreenerEngine } from '@/lib/institutional/TechnicalScreenerEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const replayBarIndex = Number(searchParams.get('replayBarIndex') || 45);

  return NextResponse.json({
    success: true,
    data: technicalScreenerEngine.getSnapshot({ symbol, timeframe, replayBarIndex }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === 'SCORE_NEWS') {
      const scored = technicalScreenerEngine.scoreUnstructuredHeadline(
        String(body.headline || ''),
        String(body.source || 'API_INGEST')
      );
      return NextResponse.json({ success: true, scored });
    }

    return NextResponse.json({
      success: true,
      data: technicalScreenerEngine.getSnapshot({
        symbol: body?.symbol || 'XAU/USD',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
        pineCode: body?.pineCode,
        replayBarIndex: typeof body?.replayBarIndex === 'number' ? body.replayBarIndex : undefined,
        customHeadline: body?.headline,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Technical screener error' }, { status: 400 });
  }
}
