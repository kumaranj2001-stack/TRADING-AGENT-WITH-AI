import { NextRequest, NextResponse } from 'next/server';
import { quantBacktestEngine } from '@/lib/institutional/QuantBacktestEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const topNRotation = Number(searchParams.get('topNRotation') || 4);

  return NextResponse.json({
    success: true,
    data: quantBacktestEngine.getSnapshot({ symbol, timeframe, topNRotation }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body?.action === 'DISPATCH_WEBHOOK') {
      const cloudWebhookScanner = quantBacktestEngine.dispatchCloudWebhookSignal({
        symbol: String(body.symbol || 'XAU/USD'),
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        price: Number(body.price || 3538.2),
        lots: Number(body.lots || 0.5),
        condition: body.condition,
      });
      return NextResponse.json({ success: true, cloudWebhookScanner });
    }

    if (body?.action === 'RUN_FORMULA') {
      const formulaBacktester = quantBacktestEngine.evaluateFormulaBacktest(
        body.script,
        body.language === 'CSHARP_QC' ? 'CSHARP_QC' : 'POWER_LANGUAGE',
        body.symbol || 'XAU/USD'
      );
      return NextResponse.json({ success: true, formulaBacktester });
    }

    return NextResponse.json({
      success: true,
      data: quantBacktestEngine.getSnapshot({
        symbol: body?.symbol || 'XAU/USD',
        timeframe: (body?.timeframe as TimeFrame) || '1h',
        formulaScript: body?.script,
        formulaLanguage: body?.language,
        topNRotation: Number(body?.topNRotation || 4),
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Quant backtest error' }, { status: 400 });
  }
}
