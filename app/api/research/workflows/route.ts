import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/research/WorkflowEngine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'SECTOR_ROTATION';
    const symbol = searchParams.get('symbol') || 'NVDA';
    const symbolA = searchParams.get('symbolA') || symbol;
    const symbolB = searchParams.get('symbolB') || 'AMD';

    switch (action.toUpperCase()) {
      case 'SECTOR_ROTATION':
        return NextResponse.json({ success: true, sectors: workflowEngine.getSectorRotation() });

      case 'COMPARE':
        const comparison = await workflowEngine.compareAssets(symbolA, symbolB);
        return NextResponse.json({ success: true, comparison });

      case 'OPTIONS':
        const options = await workflowEngine.getOptionsStrategies(symbol);
        return NextResponse.json({ success: true, options });

      case 'EARNINGS':
        const earnings = await workflowEngine.getPreEarningsAnalysis(symbol);
        return NextResponse.json({ success: true, earnings });

      case 'PORTFOLIO':
        const portfolio = workflowEngine.getPortfolioRebalance();
        return NextResponse.json({ success: true, portfolio });

      case 'SCREENER':
        const results = workflowEngine.getScreenerResults();
        return NextResponse.json({ success: true, results });

      case 'WATCHLIST':
        const watchlist = workflowEngine.getScoredWatchlist();
        return NextResponse.json({ success: true, watchlist });

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Workflow failed' },
      { status: 500 }
    );
  }
}
