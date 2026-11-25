/**
 * scripts/ws_stream_server.ts
 * Standalone High-Frequency Node WebSocket Server (using `ws`) for Vision Atlas & Research Engine.
 * Streams real-time TradingView Scanner + Yahoo Finance OHLCV & indicator ticks over ws://localhost:3001.
 * Run optionally with: npx tsx scripts/ws_stream_server.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { liveChartTelemetryService, roundAssetPrice } from '../lib/research/LiveChartTelemetryService';

const PORT = Number(process.env.QRI_WS_PORT || 3001);

export function startHighFrequencyWsServer(port: number = PORT) {
  const wss = new WebSocketServer({ port });
  console.log(`[QRI High-Frequency WS] Listening on ws://localhost:${port}`);

  wss.on('connection', async (ws: WebSocket, req) => {
    const reqUrl = new URL(req.url || '/', `http://localhost:${port}`);
    const rawSymbol = reqUrl.searchParams.get('symbol') || 'XAU/USD';
    const timeframe = (reqUrl.searchParams.get('timeframe') || '1h').toLowerCase();
    const resolved = liveChartTelemetryService.resolveSymbol(rawSymbol);

    let seq = 0;
    let latest = await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, timeframe);

    const safeSend = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    safeSend({
      seq: seq++,
      type: 'SNAPSHOT',
      ...latest,
      candles: latest.recentCandles || [],
      timestamp: Date.now(),
    });

    const quoteRefresh = setInterval(async () => {
      try {
        latest = await liveChartTelemetryService.fetchLiveChartTelemetry(resolved.symbol, timeframe);
      } catch {}
    }, 3000);

    const tickLoop = setInterval(() => {
      const jitter = (Math.random() - 0.5) * 0.00035 * latest.livePrice;
      const tickPrice = roundAssetPrice(latest.livePrice + jitter, resolved.assetClass, resolved.symbol);
      safeSend({
        seq: seq++,
        type: 'TICK',
        symbol: latest.symbol,
        tvSymbol: latest.tvSymbol,
        timeframe: latest.timeframe,
        livePrice: tickPrice,
        open: latest.open,
        high: Math.max(latest.high, tickPrice),
        low: Math.min(latest.low, tickPrice),
        close: tickPrice,
        prevClose: latest.prevClose,
        volume: latest.volume,
        changePercent: latest.changePercent,
        currency: latest.currency,
        indicatorReadings: latest.indicatorReadings,
        source: latest.source,
        timestamp: Date.now(),
      });
    }, 300);

    ws.on('close', () => {
      clearInterval(quoteRefresh);
      clearInterval(tickLoop);
    });
  });

  return wss;
}

if (require.main === module) {
  startHighFrequencyWsServer();
}
