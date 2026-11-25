/**
 * lib/chartjs/types.ts
 * Type definitions for QuriTrader's modular Chart.js plugin & overlay architecture.
 */

import { Chart, Plugin } from 'chart.js';
import { Candle } from '../types';

export type ChartDrawingType = 'crosshair' | 'trendline' | 'horizontal' | 'rectangle';

export interface ChartUserDrawing {
  id: string;
  type: ChartDrawingType;
  startIndex: number;
  startPrice: number;
  endIndex?: number;
  endPrice?: number;
  color?: string;
}

export interface VisionAtlasOverlayState {
  enabled: boolean;
  showLabZones?: boolean;
  showOrderBlocks?: boolean;
  showMarketStructure?: boolean;
  showInternalStructure?: boolean;
  showBos?: boolean;
  showChoch?: boolean;
  showQuantumFan?: boolean;
  showMarketDna?: boolean;
  showLiquidityHeatmap?: boolean;
  horizonCandles?: number;
}

export interface TradePlanOverlayState {
  enabled: boolean;
  currency?: string;
  entryMin?: number;
  entryMax?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  invalidationLevel?: number;
  supports?: number[];
  resistances?: number[];
}

export interface TechnicalIndicatorOverlayState {
  ema20?: boolean;
  ema50?: boolean;
  ema200?: boolean;
  bollingerBands?: boolean;
  vwap?: boolean;
  rsi14?: number;
  macdHistogram?: number;
  atr14?: number;
  stochK?: number;
  stochD?: number;
}

export interface QriChartJsPluginData {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  priceDecimals: number;
  chartType: 'Candles' | 'Line';
  theme: 'dark' | 'light';
  livePrice: number;
  indicators: TechnicalIndicatorOverlayState;
  visionAtlas?: VisionAtlasOverlayState;
  tradePlan?: TradePlanOverlayState;
  drawings?: ChartUserDrawing[];
  inProgressDrawing?: ChartUserDrawing | null;
}

export interface ModularChartPluginDescriptor {
  id: string;
  name: string;
  version: string;
  author: 'QRI_PROPRIETARY' | 'THIRD_PARTY' | 'CORE';
  enabled: boolean;
  createPlugin: () => Plugin;
}

export interface ChartPluginErrorEvent {
  pluginId: string;
  error: string;
  timestamp: number;
}
