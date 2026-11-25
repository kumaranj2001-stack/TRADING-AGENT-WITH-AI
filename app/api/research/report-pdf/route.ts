import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/research/WorkflowEngine';
import { ChartLiveContext } from '@/lib/research/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'NVDA';
    const timeframe = searchParams.get('timeframe') || '1h';

    const html = await workflowEngine.generateReportPdfHtml(symbol, undefined, timeframe);

    return NextResponse.json({
      success: true,
      symbol,
      html,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol: string = body?.symbol || 'NVDA';
    const timeframe: string = body?.timeframe || body?.chartContext?.timeframe || '1h';
    const chartContext: ChartLiveContext | undefined = body?.chartContext;

    const html = await workflowEngine.generateReportPdfHtml(symbol, chartContext, timeframe);

    return NextResponse.json({
      success: true,
      symbol,
      html,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}
