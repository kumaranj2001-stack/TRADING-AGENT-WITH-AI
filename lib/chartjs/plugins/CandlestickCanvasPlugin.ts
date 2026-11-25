/**
 * lib/chartjs/plugins/CandlestickCanvasPlugin.ts
 * Native Chart.js v4 OHLC Candlestick & Live Price Line Plugin.
 * Eliminates third-party chart iframe restrictions with crisp, high-frequency Canvas 2D rendering.
 */

import { Chart, Plugin } from 'chart.js';
import { getQriPluginData } from '../ChartPluginRegistry';

export function createCandlestickCanvasPlugin(): Plugin {
  return {
    id: 'qriCandlestick',
    afterDatasetsDraw(chart: Chart) {
      const data = getQriPluginData(chart);
      if (!data || !data.candles || data.candles.length === 0) return;

      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;

      const { ctx, chartArea } = chart;
      const candles = data.candles;
      const isLight = data.theme === 'light';

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        chartArea.left,
        chartArea.top,
        chartArea.right - chartArea.left,
        chartArea.bottom - chartArea.top
      );
      ctx.clip();

      if (data.chartType === 'Candles') {
        const count = candles.length;
        const plotWidth = Math.max(10, chartArea.right - chartArea.left);
        const stepPx = plotWidth / Math.max(1, count);
        const bodyWidth = Math.max(2, Math.min(14, stepPx * 0.62));

        for (let i = 0; i < count; i++) {
          const c = candles[i];
          const x = xScale.getPixelForValue(i);
          if (x < chartArea.left - 20 || x > chartArea.right + 20) continue;

          const yOpen = yScale.getPixelForValue(c.open);
          const yClose = yScale.getPixelForValue(c.close);
          const yHigh = yScale.getPixelForValue(c.high);
          const yLow = yScale.getPixelForValue(c.low);

          const isUp = c.close >= c.open;
          const color = isUp ? '#10b981' : '#ef4444';

          // Draw High/Low Wick
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(x, yHigh);
          ctx.lineTo(x, yLow);
          ctx.stroke();

          // Draw Open/Close Body
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
          ctx.fillStyle = color;
          ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
        }
      }

      // Draw Live Price Line
      const liveY = yScale.getPixelForValue(data.livePrice);
      if (liveY >= chartArea.top && liveY <= chartArea.bottom) {
        const last = candles[candles.length - 1];
        const isUp = data.livePrice >= (last?.open ?? data.livePrice);
        const lineColor = isUp ? '#10b981' : '#ef4444';

        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, liveY);
        ctx.lineTo(chartArea.right, liveY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price Badge on right edge of plot
        const label = data.livePrice.toFixed(data.priceDecimals);
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        const textW = ctx.measureText(label).width + 10;
        const badgeX = chartArea.right - textW - 2;
        const badgeY = Math.max(chartArea.top + 2, Math.min(chartArea.bottom - 18, liveY - 9));

        ctx.fillStyle = lineColor;
        ctx.fillRect(badgeX, badgeY, textW, 17);
        ctx.fillStyle = isLight ? '#ffffff' : '#ffffff';
        ctx.fillText(label, badgeX + 5, badgeY + 12);
      }

      ctx.restore();
    },
  };
}
