/**
 * lib/chartjs/plugins/executionBlueprintPlugin.ts
 * Draws live AI-verified Entry Zone, Hard Stop Loss, Take Profit 1 & Take Profit 2 lines
 * anchored directly to Chart.js price scale coordinates.
 */

import type { Chart, Plugin } from 'chart.js';
import { ChartJsPluginRenderState } from '../types';

export const qriExecutionBlueprintPlugin: Plugin<any> = {
  id: 'qriExecutionBlueprint',

  afterDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state || !state.executionLevels || state.enabledPlugins?.execution_blueprint === false) return;

    const { ctx, chartArea, scales } = chart;
    const yScale = scales.y;
    if (!yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const lvl = state.executionLevels;
    const fmt = (n: number) => n.toFixed(state.decimals);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 1. Entry Zone Band
    if (lvl.entryMin && lvl.entryMax && Number.isFinite(lvl.entryMin) && Number.isFinite(lvl.entryMax)) {
      const yTop = yScale.getPixelForValue(Math.max(lvl.entryMin, lvl.entryMax));
      const yBot = yScale.getPixelForValue(Math.min(lvl.entryMin, lvl.entryMax));
      const h = Math.max(6, Math.abs(yBot - yTop));
      ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
      ctx.fillRect(left, yTop, right - left, h);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(left, (yTop + yBot) / 2);
      ctx.lineTo(right, (yTop + yBot) / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0891b2';
      ctx.fillRect(left + 8, yTop - 15, 165, 14);
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`ENTRY ZONE: ${fmt(lvl.entryMin)} - ${fmt(lvl.entryMax)}`, left + 12, yTop - 5);
    }

    const drawLevel = (price: number | undefined, label: string, color: string, bg: string) => {
      if (!price || !Number.isFinite(price)) return;
      const y = yScale.getPixelForValue(price);
      if (y < top || y > bottom) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const text = `${label}: ${fmt(price)}`;
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = bg;
      ctx.fillRect(left + 8, y - 16, w, 15);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, left + 13, y - 5);
    };

    drawLevel(lvl.stopLoss, 'STOP LOSS', '#ef4444', '#7f1d1d');
    drawLevel(lvl.takeProfit1, 'TARGET 1', '#10b981', '#064e3b');
    drawLevel(lvl.takeProfit2, 'TARGET 2', '#34d399', '#065f46');

    ctx.restore();
  },
};
