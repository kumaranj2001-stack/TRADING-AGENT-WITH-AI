import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/research/WorkflowEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || 'NVDA';

    const html = await workflowEngine.generateReportPdfHtml(symbol);

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
