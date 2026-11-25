/**
 * lib/chartjs/plugins/candlestickPlugin.ts
 * Core Chart.js Plugin rendering OHLC Candlesticks, Volume Histogram,
 * and the Live Spot Price Tracker Line + Price Tag cleanly inside chartArea.
 */

import type { Chart, Plugin } from 'chart.js';
import { ChartJsPluginRenderState } from '../types';

export const qriCandlestickPlugin: Plugin<any> = {
  id: 'qriCandlestick',

  afterDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state || !state.candles || state.candles.length === 0) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const width = right - left;
    const height = bottom - top;
    const candles = state.candles;

    // Determine visible index bounds from xScale
    const minVisible = Math.max(0, Math.floor(xScale.min ?? 0));
    const maxVisible = Math.min(candles.length - 1, Math.ceil(xScale.max ?? candles.length - 1));
    const visibleCount = Math.max(1, maxVisible - minVisible + 1);
    const stepPx = width / Math.max(1, (xScale.max ?? candles.length) - (xScale.min ?? 0));
    const bodyWidth = Math.max(2, Math.min(18, stepPx * 0.68));

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, width, height);
    ctx.clip();

    // 1. Optional Volume Histogram in bottom 14%
    if (state.enabledPlugins?.volume_histogram !== false) {
      let maxVol = 1;
      for (let i = minVisible; i <= maxVisible; i++) {
        if ((candles[i]?.volume || 0) > maxVol) maxVol = candles[i].volume;
      }
      const volZoneHeight = height * 0.14;
      for (let i = minVisible; i <= maxVisible; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = xScale.getPixelForValue(i);
        const h = ((c.volume || 0) / maxVol) * volZoneHeight;
        const isBull = c.close >= c.open;
        ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)';
        ctx.fillRect(x - bodyWidth / 2, bottom - h, bodyWidth, h);
      }
    }

    // 2. Render Candlesticks if chartType === 'Candles'
    if (state.chartType === 'Candles') {
      for (let i = minVisible; i <= maxVisible; i++) {
        const c = candles[i];
        if (!c) continue;
        const x = xScale.getPixelForValue(i);
        const yHigh = yScale.getPixelForValue(c.high);
        const yLow = yScale.getPixelForValue(c.low);
        const yOpen = yScale.getPixelForValue(c.open);
        const yClose = yScale.getPixelForValue(c.close);

        const isBull = c.close >= c.open;
        const color = isBull ? '#10b981' : '#ef4444';
        const wickColor = isBull ? '#34d399' : '#f87171';

        // Wick
        ctx.strokeStyle = wickColor;
        ctx.lineWidth = Math.max(1, Math.min(2, bodyWidth * 0.2));
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        // Body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyH);
      }
    }

    // 3. Live Spot Price Horizontal Reference Line
    const lastBar = candles[candles.length - 1];
    if (lastBar) {
      const liveY = yScale.getPixelForValue(lastBar.close);
      const isUp = lastBar.close >= lastBar.open;
      const spotColor = isUp ? '#10b981' : '#ef4444';

      ctx.strokeStyle = spotColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(left, liveY);
      ctx.lineTo(right, liveY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // 4. Right-Axis Spot Price Pill (drawn outside clip on the right scale)
    if (lastBar) {
      const liveY = Math.max(top + 10, Math.min(bottom - 10, yScale.getPixelForValue(lastBar.close)));
      const isUp = lastBar.close >= lastBar.open;
      const spotColor = isUp ? '#059669' : '#dc2626';
      const label = lastBar.close.toFixed(state.decimals);

      ctx.save();
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const textW = ctx.measureText(label).width;
      const boxW = textW + 12;
      const boxX = right + 2;

      ctx.fillStyle = spotColor;
      ctx.beginPath();
      ctx.roundRect(boxX, liveY - 9, boxW, 18, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + 6, liveY);
      ctx.restore();
    }
  },
};
