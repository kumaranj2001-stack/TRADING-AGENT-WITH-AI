import { NextRequest, NextResponse } from 'next/server';
import { optionsDerivativesEngine } from '@/lib/institutional/OptionsDerivativesEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'NVDA';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const ivShiftPct = Number(searchParams.get('ivShiftPct') || 0);
  const potTargetPrice = Number(searchParams.get('potTargetPrice') || 0);
  const potDte = Number(searchParams.get('potDte') || 21);

  return NextResponse.json({
    success: true,
    data: optionsDerivativesEngine.getSnapshot({
      symbol,
      timeframe,
      ivShiftPct,
      potTargetPrice: potTargetPrice > 0 ? potTargetPrice : undefined,
      potDte,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      data: optionsDerivativesEngine.getSnapshot({
        symbol: body?.symbol || 'NVDA',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
        ivShiftPct: Number(body?.ivShiftPct || 0),
        potTargetPrice: Number(body?.potTargetPrice || 0) || undefined,
        potDte: Number(body?.potDte || 21),
        minIvRankFilter: Number(body?.minIvRankFilter || 0),
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Options engine error' }, { status: 400 });
  }
}
