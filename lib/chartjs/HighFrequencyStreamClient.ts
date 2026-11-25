/**
 * lib/chartjs/HighFrequencyStreamClient.ts
 * Zero-Latency Client Streaming Ingestion Engine connecting Chart.js directly to:
 *   1. Native WebSocket transport (Binance public WS for crypto OR QuriTrader Node WebSocketServer)
 *   2. High-Frequency Server-Sent Events (/api/market/stream at 300ms cadence)
 *
 * Includes sequence monotonicity verification, spike outlier circuit breaker,
 * exponential backoff reconnection, and SSOT propagation into LiveMarketFeedManager.
 */

'use client';

import { BASE_PRICES } from '../marketData';
import { LiveMarketFeedManager } from '../liveMarketFeed';
import { ssotPriceSyncEngine } from '../ssotPriceSyncEngine';
import { CurrencyPair, TimeFrame } from '../types';
import { liveChartTelemetryService, roundAssetPrice } from '../research/LiveChartTelemetryService';
import {
  ChartJsCandleBar,
  HighFrequencyTickFrame,
  StreamConnectionTelemetry,
} from './types';

export type ChartStreamFrameListener = (
  frame: HighFrequencyTickFrame,
  candles: ChartJsCandleBar[]
) => void;
export type ChartStreamStatusListener = (telemetry: StreamConnectionTelemetry) => void;

export class HighFrequencyStreamClient {
  private symbol: string;
  private timeframe: string;
  private candles: ChartJsCandleBar[] = [];
  private latestPrice: number = 0;
  private lastSeq: number = 0;
  private lastAcceptedTs: number = 0;
  private droppedTicks: number = 0;
  private totalTicks: number = 0;
  private tickTimestampsWindow: number[] = [];

  private frameListeners: Set<ChartStreamFrameListener> = new Set();
  private statusListeners: Set<ChartStreamStatusListener> = new Set();

  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private isDestroyed: boolean = false;

  private telemetry: StreamConnectionTelemetry = {
    isConnected: false,
    status: 'CONNECTING',
    protocol: 'Initializing Stream',
    latencyMs: 0,
    ticksPerSec: 0,
    totalTicks: 0,
    droppedTicks: 0,
    seqId: 0,
    lastTickTimestamp: Date.now(),
  };

  constructor(symbol: string, timeframe: string = '1h') {
    const resolved = liveChartTelemetryService.resolveSymbol(symbol);
    this.symbol = resolved.symbol;
    this.timeframe = timeframe.toLowerCase();
  }

  public getSymbol(): string {
    return this.symbol;
  }

  public getTimeframe(): string {
    return this.timeframe;
  }

  public getCandles(): ChartJsCandleBar[] {
    return this.candles;
  }

  public getLatestPrice(): number {
    return this.latestPrice;
  }

  public getTelemetry(): StreamConnectionTelemetry {
    return { ...this.telemetry };
  }

  public subscribeFrames(listener: ChartStreamFrameListener): () => void {
    this.frameListeners.add(listener);
    if (this.candles.length > 0) {
      const last = this.candles[this.candles.length - 1];
      listener(
        {
          type: 'SNAPSHOT',
          seq: this.lastSeq,
          symbol: this.symbol,
          timeframe: this.timeframe,
          price: this.latestPrice || last.close,
          open: last.open,
          high: last.high,
          low: last.low,
          close: this.latestPrice || last.close,
          volume: last.volume,
          bid: this.latestPrice || last.close,
          ask: this.latestPrice || last.close,
          changePercent: 0,
          timestamp: Date.now(),
          latencyMs: this.telemetry.latencyMs,
          source: 'CANONICAL_CACHE',
          candles: this.candles,
        },
        this.candles
      );
    }
    return () => this.frameListeners.delete(listener);
  }

  public subscribeStatus(listener: ChartStreamStatusListener): () => void {
    this.statusListeners.add(listener);
    listener({ ...this.telemetry });
    return () => this.statusListeners.delete(listener);
  }

  public switchInstrument(nextSymbol: string, nextTimeframe: string = this.timeframe): void {
    const resolved = liveChartTelemetryService.resolveSymbol(nextSymbol);
    const cleanTf = nextTimeframe.toLowerCase();
    if (resolved.symbol === this.symbol && cleanTf === this.timeframe && this.telemetry.isConnected) {
      return;
    }
    this.symbol = resolved.symbol;
    this.timeframe = cleanTf;
    this.candles = [];
    this.latestPrice = 0;
    this.lastSeq = 0;
    this.reconnectAttempts = 0;
    this.disconnectTransports();
    this.connect();
  }

  public connect(): void {
    if (this.isDestroyed || typeof window === 'undefined') return;
    this.disconnectTransports();
    this.updateTelemetry({ status: 'CONNECTING', isConnected: false, lastError: undefined });

    // Start high-frequency SSE open stream (always works across all pairs & environments)
    this.connectSseStream();

    // Concurrently attempt native WebSocket upgrade when eligible (Crypto Binance WS or Quri WS server)
    this.tryNativeWebSocketUpgrade();

    this.startHeartbeatMonitor();
  }

  public reconnect(): void {
    if (this.isDestroyed) return;
    this.reconnectAttempts = 0;
    this.connect();
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disconnectTransports();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.frameListeners.clear();
    this.statusListeners.clear();
  }

  private disconnectTransports(): void {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.onopen = null;
        this.eventSource.onmessage = null;
        this.eventSource.onerror = null;
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }
  }

  private connectSseStream(): void {
    if (this.isDestroyed) return;
    const url = `/api/market/stream?symbol=${encodeURIComponent(this.symbol)}&timeframe=${encodeURIComponent(this.timeframe)}`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onopen = () => {
      if (this.isDestroyed || this.eventSource !== es) return;
      this.reconnectAttempts = 0;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.updateTelemetry({
          isConnected: true,
          status: 'LIVE_SSE',
          protocol: 'High-Frequency SSE Stream (Open Feed)',
        });
      }
    };

    es.onmessage = (event) => {
      if (this.isDestroyed || this.eventSource !== es) return;
      try {
        const frame = JSON.parse(event.data) as HighFrequencyTickFrame;
        // If a native WebSocket is already delivering faster ticks, only accept SNAPSHOT backfill from SSE
        if (this.ws && this.ws.readyState === WebSocket.OPEN && frame.type === 'TICK') {
          return;
        }
        this.ingestFrame(frame);
      } catch {
        // Ignore non-JSON heartbeat noise
      }
    };

    es.onerror = () => {
      if (this.isDestroyed || this.eventSource !== es) return;
      try {
        es.close();
      } catch {}
      this.eventSource = null;

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.scheduleReconnect('SSE stream interrupted — reconnecting');
      }
    };
  }

  private tryNativeWebSocketUpgrade(): void {
    if (this.isDestroyed) return;
    const resolved = liveChartTelemetryService.resolveSymbol(this.symbol);

    // 1. Direct Binance public WSS for Crypto pairs (zero restrictions, sub-100ms ticks)
    if (resolved.binanceSymbol) {
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${resolved.binanceSymbol}@aggTrade`);
        this.ws = ws;
        ws.onopen = () => {
          if (this.isDestroyed || this.ws !== ws) return;
          this.updateTelemetry({
            isConnected: true,
            status: 'LIVE_WS',
            protocol: 'WSS Live (Binance Public WebSocket)',
          });
        };
        ws.onmessage = (evt) => {
          if (this.isDestroyed || this.ws !== ws) return;
          try {
            const msg = JSON.parse(evt.data);
            const price = parseFloat(msg?.p);
            const qty = parseFloat(msg?.q || '0');
            if (!Number.isFinite(price) || price <= 0) return;

            this.ingestFrame({
              type: 'TICK',
              seq: this.lastSeq + 1,
              symbol: this.symbol,
              timeframe: this.timeframe,
              price,
              open: this.candles[this.candles.length - 1]?.open ?? price,
              high: Math.max(this.candles[this.candles.length - 1]?.high ?? price, price),
              low: Math.min(this.candles[this.candles.length - 1]?.low ?? price, price),
              close: price,
              volume: (this.candles[this.candles.length - 1]?.volume ?? 0) + (Number.isFinite(qty) ? qty : 1),
              bid: price,
              ask: price,
              changePercent: this.candles[0]?.open
                ? Number((((price - this.candles[0].open) / this.candles[0].open) * 100).toFixed(2))
                : 0,
              timestamp: typeof msg?.E === 'number' ? msg.E : Date.now(),
              latencyMs: 8,
              source: 'WS_BINANCE',
            });
          } catch {}
        };
        ws.onerror = () => {
          // Silently fall back to SSE stream already running
          if (this.ws === ws) this.ws = null;
        };
      } catch {
        this.ws = null;
      }
      return;
    }

    // 2. Optional Custom / Local QuriTrader High-Frequency Node WebSocket Server
    const wsUrl =
      process.env.NEXT_PUBLIC_MARKET_WS_URL ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `ws://${window.location.hostname}:3001`
        : '');

    if (!wsUrl) return;

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      ws.onopen = () => {
        if (this.isDestroyed || this.ws !== ws) {
          ws.close();
          return;
        }
        ws.send(JSON.stringify({ action: 'subscribe', symbol: this.symbol, timeframe: this.timeframe }));
        this.updateTelemetry({
          isConnected: true,
          status: 'LIVE_WS',
          protocol: 'WSS Live (QuriTrader High-Frequency WS)',
        });
      };
      ws.onmessage = (evt) => {
        if (this.isDestroyed || this.ws !== ws) return;
        try {
          const frame = JSON.parse(evt.data) as HighFrequencyTickFrame;
          this.ingestFrame(frame);
        } catch {}
      };
      ws.onerror = () => {
        if (this.ws === ws) {
          try {
            ws.close();
          } catch {}
          this.ws = null;
        }
      };
    } catch {
      this.ws = null;
    }
  }

  private ingestFrame(frame: HighFrequencyTickFrame): void {
    if (!frame || frame.type === 'HEARTBEAT') {
      this.updateTelemetry({ lastTickTimestamp: Date.now() });
      return;
    }
    if (frame.type === 'ERROR') {
      this.updateTelemetry({ status: 'CIRCUIT_HALTED', lastError: frame.error });
      return;
    }

    const resolved = liveChartTelemetryService.resolveSymbol(frame.symbol);
    if (resolved.symbol !== this.symbol) return;

    // 1. Sequence & Outlier Guardrail
    if (frame.seq && frame.type === 'TICK' && frame.seq < this.lastSeq) {
      this.droppedTicks++;
      this.updateTelemetry({ droppedTicks: this.droppedTicks });
      return;
    }
    if (!Number.isFinite(frame.price) || frame.price <= 0) {
      this.droppedTicks++;
      return;
    }
    // Reject single-frame >5% flash outlier on TICK frames
    if (
      frame.type === 'TICK' &&
      this.latestPrice > 0 &&
      Math.abs(frame.price - this.latestPrice) / this.latestPrice > 0.05
    ) {
      this.droppedTicks++;
      this.updateTelemetry({
        droppedTicks: this.droppedTicks,
        lastError: `Outlier spike filtered (${frame.price})`,
      });
      return;
    }

    const r = (v: number) => roundAssetPrice(v, resolved.assetClass, resolved.symbol);
    const nextPrice = r(frame.price);
    this.latestPrice = nextPrice;
    if (frame.seq) this.lastSeq = frame.seq;
    this.lastAcceptedTs = frame.timestamp || Date.now();
    this.totalTicks++;

    // Update rolling 1-second tick throughput meter
    const now = Date.now();
    this.tickTimestampsWindow = [...this.tickTimestampsWindow.filter((t) => now - t <= 1000), now];

    // 2. Apply Snapshot or High-Frequency Candle Bar Mutation
    if (frame.type === 'SNAPSHOT' && frame.candles && frame.candles.length > 0) {
      this.candles = frame.candles.map((c) => ({ ...c }));
    } else if (this.candles.length > 0) {
      const last = this.candles[this.candles.length - 1];
      const barIntervalMs = this.getIntervalMs(this.timeframe);

      if (frame.timestamp && frame.timestamp - last.timestamp >= barIntervalMs) {
        // Roll into a new live candle cleanly without losing history
        const newBar: ChartJsCandleBar = {
          timestamp: last.timestamp + barIntervalMs,
          time: new Date(last.timestamp + barIntervalMs).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          open: last.close,
          high: Math.max(last.close, nextPrice),
          low: Math.min(last.close, nextPrice),
          close: nextPrice,
          volume: frame.volume || 1000,
        };
        this.candles = [...this.candles.slice(-149), newBar];
      } else {
        // In-place latest candle tick mutation for zero-flicker Chart.js update('none')
        const updatedLast: ChartJsCandleBar = {
          ...last,
          close: nextPrice,
          high: r(Math.max(last.high, frame.high || nextPrice)),
          low: r(Math.min(last.low, frame.low || nextPrice)),
          volume: Math.max(last.volume, frame.volume || last.volume),
        };
        this.candles = [...this.candles.slice(0, -1), updatedLast];
      }
    } else {
      this.candles = [
        {
          timestamp: now,
          time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: nextPrice,
          high: nextPrice,
          low: nextPrice,
          close: nextPrice,
          volume: frame.volume || 1000,
        },
      ];
    }

    // 3. Synchronize canonical price into LiveMarketFeedManager & SSOT when tracked core pair
    if (this.symbol in BASE_PRICES) {
      const corePair = this.symbol as CurrencyPair;
      const coreTf = (['1m', '5m', '15m', '1h', '4h', '1d'].includes(this.timeframe)
        ? this.timeframe
        : '1h') as TimeFrame;
      LiveMarketFeedManager.setCanonicalFeed(corePair, coreTf, this.candles);
      try {
        ssotPriceSyncEngine.broadcastTerminalTick(
          corePair,
          nextPrice,
          '03_chartjs_ws',
          frame.latencyMs || 8
        );
      } catch {}
    }

    const computedLatency = Math.max(2, Math.min(180, frame.latencyMs || (now - this.lastAcceptedTs) || 8));
    this.updateTelemetry({
      isConnected: true,
      status: frame.isFrozen
        ? 'FROZEN'
        : frame.source === 'WS_BINANCE' || frame.source === 'WS_QURI'
        ? 'LIVE_WS'
        : 'LIVE_SSE',
      latencyMs: computedLatency,
      ticksPerSec: this.tickTimestampsWindow.length,
      totalTicks: this.totalTicks,
      droppedTicks: this.droppedTicks,
      seqId: this.lastSeq,
      lastTickTimestamp: now,
    });

    // 4. Fan out frame & latest candle buffer to all subscribed Chart.js instances
    const snapshotCandles = this.candles;
    this.frameListeners.forEach((listener) => {
      try {
        listener(frame, snapshotCandles);
      } catch (err) {
        console.error('[HighFrequencyStreamClient] Listener error:', err);
      }
    });
  }

  private scheduleReconnect(reason: string): void {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(800 * Math.pow(1.4, this.reconnectAttempts), 6000);
    this.reconnectAttempts++;
    this.updateTelemetry({
      isConnected: false,
      status: 'RECONNECTING',
      lastError: reason,
    });
    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeatMonitor(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.isDestroyed) return;
      const elapsed = Date.now() - this.telemetry.lastTickTimestamp;
      if (elapsed > 12000 && this.telemetry.status !== 'FROZEN') {
        this.scheduleReconnect('Heartbeat stale (>12s) — auto-recovering stream');
      }
    }, 3000);
  }

  private getIntervalMs(tf: string): number {
    switch (tf) {
      case '1m': return 60000;
      case '5m': return 300000;
      case '15m': return 900000;
      case '30m': return 1800000;
      case '4h': return 14400000;
      case '1d': return 86400000;
      case '1w': return 604800000;
      default: return 3600000;
    }
  }

  private updateTelemetry(updates: Partial<StreamConnectionTelemetry>): void {
    this.telemetry = { ...this.telemetry, ...updates };
    const copy = { ...this.telemetry };
    this.statusListeners.forEach((fn) => {
      try {
        fn(copy);
      } catch {}
    });
  }
}
