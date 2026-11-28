import { NextRequest } from 'next/server';
import { orderFlowEngine } from '@/lib/orderFlowEngine';
import { MarketSessionManager } from '@/lib/marketSessionManager';
import { CurrencyPair } from '@/lib/types';
import { BASE_PRICES } from '@/lib/marketData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get('symbol') || 'XAU/USD';
  const symbol: CurrencyPair = (rawSymbol in BASE_PRICES) ? (rawSymbol as CurrencyPair) : 'XAU/USD';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const frozen = MarketSessionManager.isMarketFrozen(symbol);
      // 1. Send initial full order flow snapshot keyed strictly by symbol
      const initialReport = orderFlowEngine.analyzeOrderFlow(symbol);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'ORDER_FLOW_SNAPSHOT', symbol, isFrozen: frozen, payload: initialReport })}\n\n`)
      );

      // 2. High-frequency price action stream paused cleanly under Global State Freeze
      const interval = frozen
        ? null
        : setInterval(() => {
            try {
              if (MarketSessionManager.isMarketFrozen(symbol)) return;
              const tick = orderFlowEngine.generateLiveStreamTick(symbol);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...tick, symbol })}\n\n`));
            } catch {
              if (interval) clearInterval(interval);
            }
          }, 900);

      // 3. Periodic snapshot refresh only when market is actively trading
      const snapshotInterval = frozen
        ? null
        : setInterval(() => {
            try {
              if (MarketSessionManager.isMarketFrozen(symbol)) return;
              const freshReport = orderFlowEngine.analyzeOrderFlow(symbol);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'ORDER_FLOW_SNAPSHOT', symbol, isFrozen: false, payload: freshReport })}\n\n`)
              );
            } catch {
              if (snapshotInterval) clearInterval(snapshotInterval);
            }
          }, 6000);

      // Handle client disconnect / connection close
      req.signal.addEventListener('abort', () => {
        if (interval) clearInterval(interval);
        if (snapshotInterval) clearInterval(snapshotInterval);
        try {
          controller.close();
        } catch {
          // stream already closed
        }
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
