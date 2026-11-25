/**
 * lib/chartjs/plugins/interactiveOverlayPlugin.ts
 * Draws user drawings (Trendlines, Horizontal Levels, Confluence Boxes) stored in data coordinates
 * so drawings never desync on pan/zoom, plus synchronized Crosshair HUD lines & axis labels.
 */

import type { Chart, Plugin } from 'chart.js';
import { ChartJsPluginRenderState, DrawnChartShape } from '../types';

function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: DrawnChartShape,
  xScale: any,
  yScale: any,
  left: number,
  right: number,
  dashed: boolean = false
) {
  ctx.save();
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.strokeStyle = shape.color || '#06b6d4';
  ctx.lineWidth = 1.8;

  if (shape.type === 'horizontal') {
    const y = yScale.getPixelForValue(shape.startPrice);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  } else if (shape.type === 'trendline') {
    const x1 = xScale.getPixelForValue(shape.startIndex);
    const y1 = yScale.getPixelForValue(shape.startPrice);
    const x2 = xScale.getPixelForValue(shape.endIndex);
    const y2 = yScale.getPixelForValue(shape.endPrice);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (shape.type === 'rectangle') {
    const x1 = xScale.getPixelForValue(shape.startIndex);
    const y1 = yScale.getPixelForValue(shape.startPrice);
    const x2 = xScale.getPixelForValue(shape.endIndex);
    const y2 = yScale.getPixelForValue(shape.endPrice);
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
  }
  ctx.restore();
}

export const qriInteractiveOverlayPlugin: Plugin<any> = {
  id: 'qriInteractiveOverlay',

  afterDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 1. Committed user drawings anchored by data coordinates
    if (state.drawnShapes) {
      for (const shape of state.drawnShapes) {
        renderShape(ctx, shape, xScale, yScale, left, right, false);
      }
    }

    // 2. Active in-progress drawing
    if (state.inProgressShape) {
      renderShape(ctx, state.inProgressShape, xScale, yScale, left, right, true);
    }

    // 3. Synchronized Crosshair Lines
    const ch = state.crosshair;
    if (ch && ch.xPixel >= left && ch.xPixel <= right && ch.yPixel >= top && ch.yPixel <= bottom) {
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(ch.xPixel, top);
      ctx.lineTo(ch.xPixel, bottom);
      ctx.moveTo(left, ch.yPixel);
      ctx.lineTo(right, ch.yPixel);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // 4. Crosshair Y-axis price readout badge
    if (ch && ch.yPixel >= top && ch.yPixel <= bottom) {
      ctx.save();
      const label = ch.price.toFixed(state.decimals);
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(right + 2, ch.yPixel - 8, w, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, right + 7, ch.yPixel);
      ctx.restore();
    }
  },
};
