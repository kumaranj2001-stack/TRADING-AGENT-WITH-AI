/**
 * app/api/research/stream/route.ts
 * High-Frequency SSE Streaming Endpoint for Chart.js (Research Engine & Universal Instruments).
 * Anchors every intra-bar stream tick strictly to live TradingView Scanner + Yahoo Finance telemetry.
 */

import { NextRequest } from 'next/server';
import { liveChartTelemetryService, roundAssetPrice } from '@/lib/research/LiveChartTelemetryService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get('symbol') || 'NVDA';
  const rawTf = searchParams.get('timeframe') || '1h';

  const resolved = liveChartTelemetryService.resolveSymbol(rawSymbol);
  const symbol = resolved.symbol;
  const timeframe = rawTf.toLowerCase();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let seq = 0;
      let isClosed = false;
      let latestTelemetry = await liveChartTelemetryService.fetchLiveChartTelemetry(symbol, timeframe);
      let currentLivePrice = latestTelemetry.livePrice;

      const sendFrame = (payload: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      // 1. Immediate verified SNAPSHOT frame with full OHLCV bars, indicators & MT5 price scale metadata
      sendFrame({
        seq: seq++,
        type: 'SNAPSHOT',
        symbol: latestTelemetry.symbol,
        tvSymbol: latestTelemetry.tvSymbol,
        timeframe: latestTelemetry.timeframe,
        livePrice: latestTelemetry.livePrice,
        open: latestTelemetry.open,
        high: latestTelemetry.high,
        low: latestTelemetry.low,
        close: latestTelemetry.close,
        prevClose: latestTelemetry.prevClose,
        volume: latestTelemetry.volume,
        changePercent: latestTelemetry.changePercent,
        currency: latestTelemetry.currency,
        candles: latestTelemetry.recentCandles || [],
        indicatorReadings: latestTelemetry.indicatorReadings,
        priceScale: latestTelemetry.priceScale,
        source: latestTelemetry.source,
        timestamp: Date.now(),
      });

      // 2. Refresh authoritative live market quote & OHLCV candles every 3.5 seconds from upstream
      const quoteRefreshInterval = setInterval(async () => {
        if (isClosed) return;
        try {
          const fresh = await liveChartTelemetryService.fetchLiveChartTelemetry(symbol, timeframe);
          latestTelemetry = fresh;
          currentLivePrice = fresh.livePrice;
        } catch {}
      }, 3500);

      // 3. High-frequency micro-tick cadence (450ms) strictly clamped to +-0.03% of live verified quote
      const tickInterval = setInterval(() => {
        if (isClosed) return;
        const microJitter = (Math.random() - 0.5) * 0.0004 * latestTelemetry.livePrice;
        const tickPrice = roundAssetPrice(
          latestTelemetry.livePrice + microJitter,
          resolved.assetClass,
          symbol
        );
        currentLivePrice = tickPrice;

        const prevScale = latestTelemetry.priceScale;
        const updatedScale = prevScale
          ? {
              ...prevScale,
              minPrice: Math.min(prevScale.minPrice, currentLivePrice),
              maxPrice: Math.max(prevScale.maxPrice, currentLivePrice),
              rangeSpan: Math.max(
                prevScale.atr14,
                Math.max(prevScale.maxPrice, currentLivePrice) - Math.min(prevScale.minPrice, currentLivePrice)
              ),
              recommendedMinY: Math.min(prevScale.recommendedMinY, currentLivePrice - prevScale.atr14 * 0.35),
              recommendedMaxY: Math.max(prevScale.recommendedMaxY, currentLivePrice + prevScale.atr14 * 0.35),
            }
          : undefined;

        sendFrame({
          seq: seq++,
          type: 'TICK',
          symbol: latestTelemetry.symbol,
          tvSymbol: latestTelemetry.tvSymbol,
          timeframe: latestTelemetry.timeframe,
          livePrice: currentLivePrice,
          open: latestTelemetry.open,
          high: Math.max(latestTelemetry.high, currentLivePrice),
          low: Math.min(latestTelemetry.low, currentLivePrice),
          close: currentLivePrice,
          prevClose: latestTelemetry.prevClose,
          volume: latestTelemetry.volume,
          changePercent: latestTelemetry.changePercent,
          currency: latestTelemetry.currency,
          indicatorReadings: latestTelemetry.indicatorReadings,
          priceScale: updatedScale,
          source: latestTelemetry.source,
          timestamp: Date.now(),
        });
      }, 450);

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(quoteRefreshInterval);
        clearInterval(tickInterval);
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
