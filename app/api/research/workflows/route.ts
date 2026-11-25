import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/research/WorkflowEngine';
import { ChartLiveContext } from '@/lib/research/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'NVDA';
    const symbol = searchParams.get('symbol') || 'NVDA';
    const symbolA = searchParams.get('symbolA') || symbol;
    const symbolB = searchParams.get('symbolB') || 'AMD';
    const timeframe = searchParams.get('timeframe') || '1h';

    return await handleWorkflow(action, symbol, symbolA, symbolB, undefined, timeframe);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Workflow failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body?.action || 'SECTOR_ROTATION';
    const symbol: string = body?.symbol || 'NVDA';
    const symbolA: string = body?.symbolA || symbol;
    const symbolB: string = body?.symbolB || 'AMD';
    const chartContext: ChartLiveContext | undefined = body?.chartContext;
    const timeframe: string = body?.timeframe || chartContext?.timeframe || '1h';

    return await handleWorkflow(action, symbol, symbolA, symbolB, chartContext, timeframe);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Workflow failed' },
      { status: 500 }
    );
  }
}

async function handleWorkflow(
  action: string,
  symbol: string,
  symbolA: string,
  symbolB: string,
  chartContext?: ChartLiveContext,
  timeframe: string = '1h'
) {
  switch (action.toUpperCase()) {
    case 'SECTOR_ROTATION':
      return NextResponse.json({ success: true, sectors: workflowEngine.getSectorRotation() });

    case 'COMPARE':
      const comparison = await workflowEngine.compareAssets(symbolA, symbolB);
      return NextResponse.json({ success: true, comparison });

    case 'OPTIONS':
      const options = await workflowEngine.getOptionsStrategies(symbol, chartContext);
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
      const techData = await workflowEngine.getStandaloneAgentView(symbol, 'tech', chartContext, timeframe);
      return NextResponse.json({ success: true, agent: 'Technical Analysis Agent', data: techData });

    case 'STANDALONE_FUND':
      const fundData = await workflowEngine.getStandaloneAgentView(symbol, 'fund', chartContext, timeframe);
      return NextResponse.json({ success: true, agent: 'Fundamental Analysis Agent', data: fundData });

    case 'STANDALONE_SENT':
      const sentData = await workflowEngine.getStandaloneAgentView(symbol, 'sent', chartContext, timeframe);
      return NextResponse.json({ success: true, agent: 'Sentiment & Momentum Agent', data: sentData });

    case 'STANDALONE_RISK':
      const riskData = await workflowEngine.getStandaloneAgentView(symbol, 'risk', chartContext, timeframe);
      return NextResponse.json({ success: true, agent: 'Risk Assessment Agent', data: riskData });

    case 'STANDALONE_THESIS':
      const thesisData = await workflowEngine.getStandaloneAgentView(symbol, 'thesis', chartContext, timeframe);
      return NextResponse.json({ success: true, agent: 'Thesis Synthesis Agent', data: thesisData });

    default:
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  }
}
