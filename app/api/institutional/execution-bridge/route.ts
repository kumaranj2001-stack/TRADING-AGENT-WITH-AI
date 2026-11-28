import { NextRequest, NextResponse } from 'next/server';
import { executionBridgeEngine } from '@/lib/institutional/ExecutionBridgeEngine';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const algorithm = (searchParams.get('algorithm') as any) || 'VWAP';
  const orderUnits = Number(searchParams.get('orderUnits') || 120);
  const side = searchParams.get('side') === 'SELL' ? 'SELL' : 'BUY';

  return NextResponse.json({
    success: true,
    data: executionBridgeEngine.getSnapshot({ symbol, timeframe, algorithm, orderUnits, side }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as string;
    const symbol = body?.symbol || 'XAU/USD';
    const timeframe = (body?.timeframe as TimeFrame) || '1h';

    if (action === 'DOM_SUBMIT') {
      const ticket = executionBridgeEngine.submitDomOrder({
        symbol,
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        orderType: body.orderType || 'LIMIT',
        price: Number(body.price),
        quantityLots: Number(body.quantityLots || 1),
        venue: body.venue,
      });
      return NextResponse.json({ success: true, ticket, data: executionBridgeEngine.getSnapshot({ symbol, timeframe }) });
    }

    if (action === 'DOM_CANCEL') {
      const cancelled = executionBridgeEngine.cancelDomOrder(String(body.orderId || ''));
      return NextResponse.json({ success: true, cancelled, data: executionBridgeEngine.getSnapshot({ symbol, timeframe }) });
    }

    if (action === 'COMPILE_CBOT') {
      const compileResult = executionBridgeEngine.compileCSharpCBot(String(body.code || ''), symbol);
      return NextResponse.json({ success: true, compileResult });
    }

    if (action === 'RUN_GA') {
      const geneticOptimization = executionBridgeEngine.runGeneticOptimization(
        symbol,
        Math.max(4, Math.min(40, Number(body.generations || 24))),
        Math.max(8, Math.min(48, Number(body.populationSize || 32)))
      );
      return NextResponse.json({ success: true, geneticOptimization });
    }

    return NextResponse.json({
      success: true,
      data: executionBridgeEngine.getSnapshot({
        symbol,
        timeframe,
        orderUnits: Number(body.orderUnits || 120),
        side: body.side === 'SELL' ? 'SELL' : 'BUY',
        algorithm: body.algorithm || 'VWAP',
        cBotCode: body.code,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Execution bridge error' }, { status: 400 });
  }
}
