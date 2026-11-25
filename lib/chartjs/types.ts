/**
 * lib/chartjs/types.ts
 * Core TypeScript definitions for QuriTrader's unrestricted Chart.js rendering pipeline,
 * high-frequency WebSocket ingestion, and modular Vision Atlas plugin architecture.
 */

export interface ChartJsCandleBar {
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartPluginCategory = 'CORE' | 'TREND' | 'VOLATILITY' | 'MOMENTUM' | 'VISION_ATLAS' | 'EXECUTION';

export interface ChartJsPluginDescriptor {
  id: string;
  name: string;
  shortLabel: string;
  category: ChartPluginCategory;
  description: string;
  defaultEnabled: boolean;
  isThirdPartyCompatible?: boolean;
}

export interface ChartJsExecutionLevels {
  entryMin?: number;
  entryMax?: number;
  stopLoss?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  bias?: 'BUY' | 'SELL' | 'NEUTRAL';
}

export interface DrawnChartShape {
  id: string;
  type: 'trendline' | 'horizontal' | 'rectangle';
  startIndex: number;
  startPrice: number;
  endIndex: number;
  endPrice: number;
  color: string;
}

export interface VisionAtlasSwingPoint {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
  label: string;
}

export interface VisionAtlasStructureLevel {
  startIndex: number;
  price: number;
  direction: 'BULLISH' | 'BEARISH';
  kind: 'BOS' | 'CHOCH';
  label: string;
}

export interface VisionAtlasOrderBlock {
  startIndex: number;
  endIndex: number;
  lowPrice: number;
  highPrice: number;
  type: 'DEMAND' | 'SUPPLY';
  label: string;
}

export interface VisionAtlasFvgGap {
  startIndex: number;
  lowPrice: number;
  highPrice: number;
  type: 'BULLISH_FVG' | 'BEARISH_FVG';
  label: string;
}

export interface VisionAtlasLabZone {
  name: string;
  minPrice: number;
  maxPrice: number;
  fillColor: string;
  borderColor: string;
  textColor: string;
}

export interface VisionAtlasLiquidityWall {
  label: string;
  price: number;
  widthRatio: number; // 0-1
  isAsk: boolean;
}

export interface VisionAtlasQuantumPoint {
  offsetBars: number;
  upperPrice: number;
  medianPrice: number;
  lowerPrice: number;
}

export interface VisionAtlasOverlaySnapshot {
  computedAt: number;
  anchorPrice: number;
  candleCount: number;
  ema20: number[];
  ema50: number[];
  ema200: number[];
  vwap: number[];
  bbUpper: number[];
  bbMiddle: number[];
  bbLower: number[];
  rsi14: number[];
  macdLine: number[];
  macdSignal: number[];
  macdHistogram: number[];
  atr14: number;
  latestRsi: number;
  latestMacd: number;
  latestMacdSignal: number;
  swings: VisionAtlasSwingPoint[];
  structures: VisionAtlasStructureLevel[];
  orderBlocks: VisionAtlasOrderBlock[];
  fairValueGaps: VisionAtlasFvgGap[];
  labZones: VisionAtlasLabZone[];
  goldenPocket: { minPrice: number; maxPrice: number };
  liquidityWalls: VisionAtlasLiquidityWall[];
  quantumFan: VisionAtlasQuantumPoint[];
}

export interface ChartJsPluginRenderState {
  candles: ChartJsCandleBar[];
  overlays: VisionAtlasOverlaySnapshot;
  enabledPlugins: Record<string, boolean>;
  chartType: 'Candles' | 'Line';
  theme: 'dark' | 'light';
  decimals: number;
  symbol: string;
  executionLevels?: ChartJsExecutionLevels;
  drawnShapes?: DrawnChartShape[];
  inProgressShape?: DrawnChartShape | null;
  crosshair?: {
    xPixel: number;
    yPixel: number;
    barIndex: number;
    price: number;
  } | null;
  viewRange?: {
    minIndex: number;
    maxIndex: number;
    rightOffsetBars: number;
  };
}

export interface HighFrequencyTickFrame {
  type: 'SNAPSHOT' | 'TICK' | 'HEARTBEAT' | 'ERROR';
  seq: number;
  symbol: string;
  timeframe: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid: number;
  ask: number;
  changePercent: number;
  timestamp: number;
  latencyMs: number;
  source: 'WS_BINANCE' | 'WS_QURI' | 'SSE_OPEN_STREAM' | 'CANONICAL_CACHE';
  candles?: ChartJsCandleBar[];
  name?: string;
  currency?: string;
  isFrozen?: boolean;
  error?: string;
}

export interface StreamConnectionTelemetry {
  isConnected: boolean;
  status: 'CONNECTING' | 'LIVE_WS' | 'LIVE_SSE' | 'RECONNECTING' | 'CIRCUIT_HALTED' | 'FROZEN';
  protocol: string;
  latencyMs: number;
  ticksPerSec: number;
  totalTicks: number;
  droppedTicks: number;
  seqId: number;
  lastTickTimestamp: number;
  lastError?: string;
}
