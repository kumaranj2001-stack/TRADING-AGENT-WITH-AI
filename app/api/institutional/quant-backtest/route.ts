import { NextRequest, NextResponse } from 'next/server';
import { quantBacktestEngine } from '@/lib/institutional/QuantBacktestEngine';
import { resolveInstitutionalAssetContext } from '@/lib/institutional/helpers';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const symbol = String(body?.symbol || 'XAU/USD');
    const timeframe = (body?.timeframe as TimeFrame) || '1h';

    if (body?.action === 'DISPATCH_WEBHOOK') {
      const ctx = resolveInstitutionalAssetContext(symbol, timeframe);
      const cloudWebhookScanner = quantBacktestEngine.dispatchCloudWebhookSignal({
        symbol: ctx.symbol,
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        price: Number(body.price) > 0 ? Number(body.price) : ctx.spotPrice,
        lots: Number(body.lots || 0.5),
        condition: body.condition,
        previousCount: typeof body.previousCount === 'number' ? body.previousCount : undefined,
      });
      return NextResponse.json({ success: true, cloudWebhookScanner });
    }

    if (body?.action === 'RUN_FORMULA') {
      const formulaBacktester = quantBacktestEngine.evaluateFormulaBacktest(
        body.script,
        body.language === 'CSHARP_QC' ? 'CSHARP_QC' : 'POWER_LANGUAGE',
        symbol
      );
      return NextResponse.json({ success: true, formulaBacktester });
    }

    return NextResponse.json({
      success: true,
      data: quantBacktestEngine.getSnapshot({
        symbol,
        timeframe,
        formulaScript: body?.script,
        formulaLanguage: body?.language,
        topNRotation: Number(body?.topNRotation || 4),
        includeDelisted: typeof body?.includeDelisted === 'boolean' ? body.includeDelisted : true,
        lookbackMonths: Number(body?.lookbackMonths || 12),
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Quant backtest error' }, { status: 400 });
  }
}
