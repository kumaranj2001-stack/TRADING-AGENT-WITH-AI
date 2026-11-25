/**
 * lib/chartjs/registerDefaultPlugins.ts
 * Registers QuriTrader's core Chart.js plugins (Candlestick renderer, Vision Atlas overlays, Trade Plan overlays).
 */

import { chartPluginRegistry } from './ChartPluginRegistry';
import { createCandlestickCanvasPlugin } from './plugins/CandlestickCanvasPlugin';
import { createVisionAtlasOverlayPlugin } from './plugins/VisionAtlasOverlayPlugin';
import { createTradePlanOverlayPlugin } from './plugins/TradePlanOverlayPlugin';

let registered = false;

export function ensureDefaultChartPluginsRegistered() {
  if (registered) return;
  registered = true;

  chartPluginRegistry.registerPlugin({
    id: 'qriCandlestick',
    name: 'OHLC Candlestick & Live Spot Renderer',
    version: '1.0.0',
    author: 'CORE',
    enabled: true,
    createPlugin: createCandlestickCanvasPlugin,
  });

  chartPluginRegistry.registerPlugin({
    id: 'qriVisionAtlasOverlay',
    name: 'Vision Atlas Institutional SMC & Quantum Overlays',
    version: '2.0.0',
    author: 'QRI_PROPRIETARY',
    enabled: true,
    createPlugin: createVisionAtlasOverlayPlugin,
  });

  chartPluginRegistry.registerPlugin({
    id: 'qriTradePlanOverlay',
    name: 'AI Trade Plan Entry / Stop / Target Overlays',
    version: '1.0.0',
    author: 'QRI_PROPRIETARY',
    enabled: true,
    createPlugin: createTradePlanOverlayPlugin,
  });
}
