import { NextRequest, NextResponse } from 'next/server';
import { microstructureEngine } from '@/lib/institutional/MicrostructureEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const smartTapeMinFilter = Number(searchParams.get('smartTapeMinFilter') || 25);

  return NextResponse.json({
    success: true,
    data: microstructureEngine.getSnapshot({ symbol, timeframe, smartTapeMinFilter }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = body?.symbol || 'XAU/USD';
    const timeframe = (body?.timeframe as TimeFrame) || '1h';

    return NextResponse.json({
      success: true,
      data: microstructureEngine.getSnapshot({
        symbol,
        timeframe,
        smartTapeMinFilter: Number(body.smartTapeMinFilter || 25),
        cppSourceCode: body.cppSourceCode,
        atmPreset: body.atmPreset,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Microstructure error' }, { status: 400 });
  }
}
