/**
 * lib/chartjs/plugins/index.ts
 * Registers all QuriTrader Chart.js rendering plugins (Candlestick, Indicators,
 * Vision Atlas SMC/Quantum/DNA/Lab/Liquidity, Execution Blueprint, Interactive Crosshair/Drawing)
 * into the modular ChartJsPluginRegistry.
 */

import { chartJsPluginRegistry } from '../ChartJsPluginRegistry';
import { qriCandlestickPlugin } from './candlestickPlugin';
import { qriIndicatorsPlugin } from './indicatorsOverlayPlugin';
import { qriVisionAtlasPlugin } from './visionAtlasPlugin';
import { qriExecutionBlueprintPlugin } from './executionBlueprintPlugin';
import { qriInteractiveOverlayPlugin } from './interactiveOverlayPlugin';

let initialized = false;

export function ensureDefaultChartJsPluginsRegistered() {
  if (initialized) return chartJsPluginRegistry;
  initialized = true;

  // Core Candle & Spot Tracker Renderer
  chartJsPluginRegistry.register(
    {
      id: 'qriCandlestick',
      name: 'OHLC Candlestick & Spot Line',
      shortLabel: 'Candles',
      category: 'CORE',
      description: 'High-DPI OHLC candlestick renderer with live spot price tracker.',
      defaultEnabled: true,
    },
    qriCandlestickPlugin,
    10
  );

  // Modular Technical Indicators & Vision Atlas Plugin Metadata (rendered by respective Chart.js plugins)
  chartJsPluginRegistry.register(
    {
      id: 'qriVisionAtlas',
      name: 'Vision Atlas Institutional Suite',
      shortLabel: 'Vision Atlas',
      category: 'VISION_ATLAS',
      description: 'Order Blocks, FVG, BOS/CHoCH, Lab Zones, Golden Pocket, Quantum Cone & Liquidity Walls.',
      defaultEnabled: true,
      isThirdPartyCompatible: true,
    },
    qriVisionAtlasPlugin,
    20
  );

  chartJsPluginRegistry.register(
    {
      id: 'qriIndicators',
      name: 'EMA Ribbon / Bollinger / VWAP',
      shortLabel: 'Indicators',
      category: 'TREND',
      description: 'EMA 20/50/200, Bollinger Bands (20,2) and VWAP overlay.',
      defaultEnabled: true,
    },
    qriIndicatorsPlugin,
    30
  );

  chartJsPluginRegistry.register(
    {
      id: 'qriExecutionBlueprint',
      name: 'AI Entry / SL / TP Execution Lines',
      shortLabel: 'Execution Levels',
      category: 'EXECUTION',
      description: 'Draws Entry Zone, Hard Stop Loss, Take Profit 1 & 2 synced with AI Engine.',
      defaultEnabled: true,
    },
    qriExecutionBlueprintPlugin,
    40
  );

  chartJsPluginRegistry.register(
    {
      id: 'qriInteractiveOverlay',
      name: 'Crosshair & Interactive Drawings',
      shortLabel: 'Drawings & HUD',
      category: 'CORE',
      description: 'Coordinate-locked trendlines, horizontal levels, rectangles and crosshair.',
      defaultEnabled: true,
    },
    qriInteractiveOverlayPlugin,
    50
  );

  return chartJsPluginRegistry;
}

export {
  chartJsPluginRegistry,
  qriCandlestickPlugin,
  qriIndicatorsPlugin,
  qriVisionAtlasPlugin,
  qriExecutionBlueprintPlugin,
  qriInteractiveOverlayPlugin,
};
