import { NextRequest } from 'next/server';
import { visionAtlasEngine } from '@/lib/visionAtlasEngine';
import { CurrencyPair, TimeFrame } from '@/lib/types';
import { BASE_PRICES } from '@/lib/marketData';
import { liveChartTelemetryService } from '@/lib/research/LiveChartTelemetryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get('symbol') || searchParams.get('pair') || 'XAU/USD';
  const rawTf = searchParams.get('timeframe') || '1h';

  const resolved = liveChartTelemetryService.resolveSymbol(rawSymbol);
  const symbol: CurrencyPair = (resolved.symbol in BASE_PRICES) ? (resolved.symbol as CurrencyPair) : 'XAU/USD';
  const timeframe: TimeFrame = (['1m', '5m', '15m', '1h', '4h', '1d'].includes(rawTf)) ? (rawTf as TimeFrame) : '1h';

  const initialLive = await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, timeframe);
  const liveCandles = initialLive.recentCandles || [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send immediate Chart.js-grounded snapshot (0ms initial latency)
      try {
        const initialPayload = visionAtlasEngine.generateAnalysisPayload(symbol, timeframe, liveCandles as any);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'SNAPSHOT',
            payload: initialPayload,
            timestamp: Date.now(),
          })}\n\n`)
        );
      } catch (err) {
        console.error('Vision Atlas SSE initial snapshot error:', err);
      }

      // 2. High-frequency Vision Atlas live stream (400ms cadence)
      const interval = setInterval(() => {
        try {
          const tick = visionAtlasEngine.generateLiveStreamTick(symbol, timeframe);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(tick)}\n\n`)
          );
        } catch {
          clearInterval(interval);
          try {
            controller.close();
          } catch {}
        }
      }, 400);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
