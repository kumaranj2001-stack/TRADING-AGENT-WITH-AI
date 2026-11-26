import { NextRequest, NextResponse } from 'next/server';
import { alternativeDataEngine } from '@/lib/institutional/AlternativeDataEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';

  return NextResponse.json({
    success: true,
    data: alternativeDataEngine.getSnapshot({ symbol, timeframe }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      data: alternativeDataEngine.getSnapshot({
        symbol: body?.symbol || 'XAU/USD',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Alt data error' }, { status: 400 });
  }
}
