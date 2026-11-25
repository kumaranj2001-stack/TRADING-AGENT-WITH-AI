/**
 * lib/chartjs/plugins/TradePlanOverlayPlugin.ts
 * Chart.js Overlay Plugin for Research Engine Entry Zones, Stop Losses, Targets & S/R Levels
 * Strictly synchronized with live Chart.js market conditions.
 */

import { Chart, Plugin } from 'chart.js';
import { getQriPluginData } from '../ChartPluginRegistry';

export function createTradePlanOverlayPlugin(): Plugin {
  return {
    id: 'qriTradePlanOverlay',
    afterDatasetsDraw(chart: Chart) {
      const data = getQriPluginData(chart);
      if (!data || !data.tradePlan?.enabled) return;

      const yScale = chart.scales.y;
      if (!yScale) return;

      const { ctx, chartArea } = chart;
      const tp = data.tradePlan;
      const dec = data.priceDecimals;

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        chartArea.left,
        chartArea.top,
        chartArea.right - chartArea.left,
        chartArea.bottom - chartArea.top
      );
      ctx.clip();

      ctx.font = 'bold 9px "JetBrains Mono", monospace';

      // Entry Zone Band
      if (tp.entryMin !== undefined && tp.entryMax !== undefined) {
        const yMin = yScale.getPixelForValue(tp.entryMin);
        const yMax = yScale.getPixelForValue(tp.entryMax);
        const top = Math.min(yMin, yMax);
        const h = Math.max(4, Math.abs(yMin - yMax));
        ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
        ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, h);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartArea.left, top, chartArea.right - chartArea.left, h);
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(
          `ENTRY [${tp.entryMin.toFixed(dec)} - ${tp.entryMax.toFixed(dec)}]`,
          chartArea.left + 8,
          top - 3 > chartArea.top + 10 ? top - 3 : top + 10
        );
      }

      const drawHorizontalLevel = (
        price: number | undefined,
        label: string,
        color: string,
        dashed: boolean = true
      ) => {
        if (price === undefined || !Number.isFinite(price)) return;
        const y = yScale.getPixelForValue(price);
        if (y < chartArea.top || y > chartArea.bottom) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        if (dashed) ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = color;
        ctx.fillText(`${label} ${price.toFixed(dec)}`, chartArea.left + 8, y - 4);
      };

      drawHorizontalLevel(tp.stopLoss, 'STOP LOSS', '#f43f5e', true);
      drawHorizontalLevel(tp.target1, 'TARGET 1', '#10b981', true);
      drawHorizontalLevel(tp.target2, 'TARGET 2', '#34d399', true);

      // Indicator telemetry HUD top-left
      const ind = data.indicators;
      const hudParts: string[] = [];
      if (ind.rsi14 !== undefined) hudParts.push(`RSI(14): ${ind.rsi14}`);
      if (ind.macdHistogram !== undefined) hudParts.push(`MACD Hist: ${ind.macdHistogram}`);
      if (ind.atr14 !== undefined) hudParts.push(`ATR(14): ${ind.atr14.toFixed(dec)}`);
      if (hudParts.length > 0) {
        const hudText = hudParts.join('  |  ');
        const tw = ctx.measureText(hudText).width + 12;
        ctx.fillStyle = 'rgba(9, 13, 22, 0.78)';
        ctx.fillRect(chartArea.left + 8, chartArea.top + 6, tw, 18);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chartArea.left + 8, chartArea.top + 6, tw, 18);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(hudText, chartArea.left + 14, chartArea.top + 18);
      }

      ctx.restore();
    },
  };
}
