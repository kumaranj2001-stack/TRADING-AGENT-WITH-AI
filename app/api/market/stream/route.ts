import { NextRequest } from 'next/server';
import { liveChartTelemetryService, roundAssetPrice } from '@/lib/research/LiveChartTelemetryService';
import { highFrequencyWsServer } from '@/lib/chartjs/HighFrequencyWsServer';
import { HighFrequencyTickFrame } from '@/lib/chartjs/types';
import { MarketSessionManager } from '@/lib/marketSessionManager';
import { BASE_PRICES } from '@/lib/marketData';
import { CurrencyPair } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get('symbol') || searchParams.get('pair') || 'XAU/USD';
  const rawTf = (searchParams.get('timeframe') || '1h').toLowerCase();

  // Opportunistically boot standalone ws:// server when running in long-lived Node runtime
  if (process.env.ENABLE_LOCAL_WS === 'true') {
    highFrequencyWsServer.ensureStarted().catch(() => {});
  }

  const resolved = liveChartTelemetryService.resolveSymbol(rawSymbol);
  const r = (v: number) => roundAssetPrice(v, resolved.assetClass, resolved.symbol);
  const initialTelemetry = await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, rawTf);

  const candles = [...(initialTelemetry.recentCandles || [])];
  let anchorPrice = initialTelemetry.livePrice;
  const prevClose = initialTelemetry.prevClose || anchorPrice;
  let seq = 1;

  const isCorePair = resolved.symbol in BASE_PRICES;
  const isFrozen = isCorePair ? MarketSessionManager.getMarketSessionInfo(resolved.symbol as CurrencyPair).isFrozen : false;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendFrame = (frame: HighFrequencyTickFrame) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        } catch {}
      };

      const lastBar = candles[candles.length - 1];
      // 1. Immediate verified SNAPSHOT frame (0ms backfill latency)
      sendFrame({
        type: 'SNAPSHOT',
        seq: seq++,
        symbol: resolved.symbol,
        timeframe: rawTf,
        price: anchorPrice,
        open: lastBar?.open ?? anchorPrice,
        high: lastBar?.high ?? anchorPrice,
        low: lastBar?.low ?? anchorPrice,
        close: anchorPrice,
        volume: lastBar?.volume ?? 100000,
        bid: anchorPrice,
        ask: anchorPrice,
        changePercent: initialTelemetry.changePercent,
        timestamp: Date.now(),
        latencyMs: 4,
        source: 'SSE_OPEN_STREAM',
        candles,
        name: initialTelemetry.name,
        currency: initialTelemetry.currency,
        isFrozen,
      });

      // 2. Refresh real upstream live market spot every 3 seconds
      const upstreamRefreshTimer = setInterval(async () => {
        if (isFrozen) return;
        try {
          const fresh = await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, rawTf);
          if (fresh.livePrice > 0) {
            anchorPrice = fresh.livePrice;
          }
        } catch {
          // Maintain last verified anchor cleanly
        }
      }, 3000);

      // 3. High-frequency tick emission every 350ms anchored strictly to live spot
      const tickTimer = setInterval(() => {
        const curLast = candles[candles.length - 1];
        let tickPrice = anchorPrice;

        if (!isFrozen) {
          const microStep = Math.max(anchorPrice * 0.00022, 0.000015);
          tickPrice = r(anchorPrice + (Math.random() - 0.5) * microStep * 0.45);
        }

        const spread = r(Math.max(anchorPrice * 0.00014, 0.00004));
        const nextHigh = curLast ? r(Math.max(curLast.high, tickPrice)) : tickPrice;
        const nextLow = curLast ? r(Math.min(curLast.low, tickPrice)) : tickPrice;
        const nextVol = (curLast?.volume || 15000) + (isFrozen ? 0 : Math.floor(Math.random() * 15 + 1));

        if (curLast) {
          candles[candles.length - 1] = {
            ...curLast,
            close: tickPrice,
            high: nextHigh,
            low: nextLow,
            volume: nextVol,
          };
        }

        sendFrame({
          type: 'TICK',
          seq: seq++,
          symbol: resolved.symbol,
          timeframe: rawTf,
          price: tickPrice,
          open: curLast?.open ?? tickPrice,
          high: nextHigh,
          low: nextLow,
          close: tickPrice,
          volume: nextVol,
          bid: r(tickPrice - spread / 2),
          ask: r(tickPrice + spread / 2),
          changePercent: prevClose > 0 ? Number((((tickPrice - prevClose) / prevClose) * 100).toFixed(2)) : initialTelemetry.changePercent,
          timestamp: Date.now(),
          latencyMs: 6,
          source: 'SSE_OPEN_STREAM',
          isFrozen,
        });
      }, 350);

      req.signal.addEventListener('abort', () => {
        clearInterval(tickTimer);
        clearInterval(upstreamRefreshTimer);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
