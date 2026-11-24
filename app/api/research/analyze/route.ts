import { NextRequest, NextResponse } from 'next/server';
import { researchEngineOrchestrator } from '@/lib/research/ResearchEngineOrchestrator';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'NVDA';

    const report = await researchEngineOrchestrator.executeFullAnalysis(symbol);

    return NextResponse.json({
      success: true,
      symbol,
      report,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute full analysis' },
      { status: 500 }
    );
  }
}
