import { NextRequest, NextResponse } from 'next/server';
import { fundamentalMacroEngine } from '@/lib/institutional/FundamentalMacroEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const customFormula = searchParams.get('formula') || '(FCF / MarketCap) * ROIC';

  return NextResponse.json({
    success: true,
    data: fundamentalMacroEngine.getSnapshot({ symbol, timeframe, customFormula }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === 'EVALUATE_RATIO') {
      const customRatioEvaluation = fundamentalMacroEngine.evaluateCustomRatio(String(body.formula || '(FCF / MarketCap) * ROIC'));
      return NextResponse.json({ success: true, customRatioEvaluation });
    }
    if (body?.action === 'SCATTER') {
      const economicScatterPlot = fundamentalMacroEngine.computeEconomicScatter(body.xIndicator, body.yIndicator);
      return NextResponse.json({ success: true, economicScatterPlot });
    }

    return NextResponse.json({
      success: true,
      data: fundamentalMacroEngine.getSnapshot({
        symbol: body?.symbol || 'XAU/USD',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
        customFormula: body?.formula,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Macro fundamental error' }, { status: 400 });
  }
}
