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
        return NextResponse.json({ success: true, portfolio: workflowEngine.getPortfolioRebalance() });

      case 'SCREENER':
        return NextResponse.json({ success: true, results: workflowEngine.getScreenerResults() });

      case 'WATCHLIST':
        return NextResponse.json({ success: true, watchlist: workflowEngine.getScoredWatchlist() });

      case 'STANDALONE_TECH':
        const techData = await workflowEngine.getStandaloneAgentView(symbol, 'tech');
        return NextResponse.json({ success: true, agent: 'Technical Analysis Agent', data: techData });

      case 'STANDALONE_FUND':
        const fundData = await workflowEngine.getStandaloneAgentView(symbol, 'fund');
        return NextResponse.json({ success: true, agent: 'Fundamental Analysis Agent', data: fundData });

      case 'STANDALONE_SENT':
        const sentData = await workflowEngine.getStandaloneAgentView(symbol, 'sent');
        return NextResponse.json({ success: true, agent: 'Sentiment & Momentum Agent', data: sentData });

      case 'STANDALONE_RISK':
        const riskData = await workflowEngine.getStandaloneAgentView(symbol, 'risk');
        return NextResponse.json({ success: true, agent: 'Risk Assessment Agent', data: riskData });

      case 'STANDALONE_THESIS':
        const thesisData = await workflowEngine.getStandaloneAgentView(symbol, 'thesis');
        return NextResponse.json({ success: true, agent: 'Thesis Synthesis Agent', data: thesisData });

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
