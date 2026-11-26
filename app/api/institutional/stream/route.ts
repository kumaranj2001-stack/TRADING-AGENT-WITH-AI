import { NextRequest } from 'next/server';
import { resolveInstitutionalAssetContext, seededRange } from '@/lib/institutional/helpers';
import { institutionalHubService } from '@/lib/institutional/InstitutionalHubService';
import type { TimeFrame } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'XAU/USD';
  const timeframe = (searchParams.get('timeframe') as TimeFrame) || '1h';

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let seq = 0;

  const stream = new ReadableStream({
    start(controller) {
      const sendFrame = () => {
        seq += 1;
        const ctx = resolveInstitutionalAssetContext(symbol, timeframe);
        const microDelta = seededRange(`${symbol}:sse:${seq}`, -0.0004, 0.0004);
        const tickSpot = Number((ctx.spotPrice * (1 + microDelta)).toFixed(ctx.decimals));
        const enrichment = institutionalHubService.getDebateEnrichment(ctx.symbol, timeframe);

        const payload = {
          type: seq === 1 ? 'SNAPSHOT' : 'INST_TICK',
          seq,
          symbol: ctx.symbol,
          timeframe,
          spotPrice: tickSpot,
          fixLatencyMs: Number(seededRange(`lat:${seq}`, 1.2, 4.8).toFixed(1)),
          rvolMultiplier: Number(seededRange(`rvol:${seq}`, 1.8, 3.7).toFixed(2)),
          zeroGammaFlip: enrichment.zeroGammaFlipLevel,
          slippageBps: enrichment.slippageBps,
          altAlphaScore: enrichment.altDataAlphaScore,
          fundingAprMax: 24.2,
          timestamp: Date.now(),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      sendFrame();
      timer = setInterval(sendFrame, 1200);
    },
    cancel() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
