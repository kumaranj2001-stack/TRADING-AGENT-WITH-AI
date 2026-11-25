/**
 * lib/chartjs/plugins/indicatorsOverlayPlugin.ts
 * Modular Chart.js Indicator Plugin:
 * Draws EMA 20 / 50 / 200 Ribbon, Bollinger Bands (20,2) Shaded Channel, and VWAP
 * directly within the Chart.js coordinate frame for zero desynchronization.
 */

import type { Chart, Plugin } from 'chart.js';
import { ChartJsPluginRenderState } from '../types';

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  values: number[],
  xScale: any,
  yScale: any,
  minIdx: number,
  maxIdx: number,
  color: string,
  lineWidth: number = 1.4,
  dashed: boolean = false
) {
  if (!values || values.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  let started = false;
  for (let i = minIdx; i <= Math.min(maxIdx, values.length - 1); i++) {
    const val = values[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    const x = xScale.getPixelForValue(i);
    const y = yScale.getPixelForValue(val);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export const qriIndicatorsPlugin: Plugin<any> = {
  id: 'qriIndicators',

  afterDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state || !state.overlays || state.candles.length === 0) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const minIdx = Math.max(0, Math.floor(xScale.min ?? 0));
    const maxIdx = Math.min(state.candles.length - 1, Math.ceil(xScale.max ?? state.candles.length - 1));
    const ov = state.overlays;
    const flags = state.enabledPlugins || {};

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 1. Bollinger Bands (Upper, Middle, Lower + Shaded Fill)
    if (flags.bb && ov.bbUpper.length === state.candles.length && ov.bbLower.length === state.candles.length) {
      ctx.save();
      ctx.beginPath();
      let started = false;
      for (let i = minIdx; i <= maxIdx; i++) {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(ov.bbUpper[i]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      for (let i = maxIdx; i >= minIdx; i--) {
        const x = xScale.getPixelForValue(i);
        const y = yScale.getPixelForValue(ov.bbLower[i]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.fill();
      ctx.restore();

      drawLineSeries(ctx, ov.bbUpper, xScale, yScale, minIdx, maxIdx, 'rgba(56, 189, 248, 0.55)', 1);
      drawLineSeries(ctx, ov.bbMiddle, xScale, yScale, minIdx, maxIdx, 'rgba(148, 163, 184, 0.45)', 1, true);
      drawLineSeries(ctx, ov.bbLower, xScale, yScale, minIdx, maxIdx, 'rgba(56, 189, 248, 0.55)', 1);
    }

    // 2. VWAP Line
    if (flags.vwap) {
      drawLineSeries(ctx, ov.vwap, xScale, yScale, minIdx, maxIdx, '#e879f9', 1.4, true);
    }

    // 3. EMA 20 / 50 / 200 Ribbon
    if (flags.ema20 || flags.trend_ema) {
      drawLineSeries(ctx, ov.ema20, xScale, yScale, minIdx, maxIdx, '#06b6d4', 1.6);
    }
    if (flags.ema50 || flags.trend_ema) {
      drawLineSeries(ctx, ov.ema50, xScale, yScale, minIdx, maxIdx, '#f59e0b', 1.6);
    }
    if (flags.ema200) {
      drawLineSeries(ctx, ov.ema200, xScale, yScale, minIdx, maxIdx, '#a855f7', 1.8);
    }

    ctx.restore();
  },
};
