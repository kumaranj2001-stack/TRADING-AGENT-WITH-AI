import { NextRequest, NextResponse } from 'next/server';
import { institutionalHubService } from '@/lib/institutional/InstitutionalHubService';
import { PdfReportGenerator } from '@/lib/research/PdfReportGenerator';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';
  const format = searchParams.get('format');

  if (format === 'tear-sheet-html') {
    const overview = institutionalHubService.getFullOverview(symbol, timeframe);
    const html = PdfReportGenerator.generateInstitutionalTearSheetHtml({
      symbol: overview.symbol,
      spotPrice: overview.spotPrice,
      compositeBias: overview.debateEnrichment.institutionalCompositeBias,
      zeroGammaFlip: overview.options.zeroGammaFlipLevel,
      slippageBps: overview.execution.slippageEstimate.totalSlippageBps,
      altAlphaScore: overview.altData.compositeAltAlphaScore,
      darwinScore: overview.riskAudit.darwinVaREngine.darwinScore,
      twrrPct: overview.riskAudit.verifiedTrackRecord.twrrPct,
      auditHash: overview.riskAudit.verifiedTrackRecord.hashChainHead,
      bulletHighlights: overview.debateEnrichment.summaryBulletPoints,
    });
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({
    success: true,
    data: institutionalHubService.getFullOverview(symbol, timeframe),
  });
}
