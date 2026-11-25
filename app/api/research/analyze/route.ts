import { NextRequest, NextResponse } from 'next/server';
import { researchEngineOrchestrator } from '@/lib/research/ResearchEngineOrchestrator';
import { ChartLiveContext } from '@/lib/research/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'NVDA';
    const timeframe = searchParams.get('timeframe') || '1h';

    const report = await researchEngineOrchestrator.executeFullAnalysis(symbol, undefined, timeframe);

    return NextResponse.json({
      success: true,
      symbol: report.symbol,
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute full analysis' },
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

    const report = await researchEngineOrchestrator.executeFullAnalysis(symbol, chartContext, timeframe);

    return NextResponse.json({
      success: true,
      symbol: report.symbol,
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute full analysis' },
      { status: 500 }
    );
  }
}
