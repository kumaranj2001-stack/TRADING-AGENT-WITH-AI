/**
 * lib/chartjs/plugins/visionAtlasPlugin.ts
 * Proprietary Modular Chart.js Plugin for Vision Atlas Overlays:
 *  - SMC Order Blocks (Demand / Supply)
 *  - Fair Value Gaps (FVG)
 *  - Market Structure Break of Structure (BOS) & CHoCH + Fractal Swing Pivots
 *  - Vision Atlas Lab Zones (Danger, Confluence Entry, Safe Floor)
 *  - Market DNA Fibonacci Golden Pocket (0.618 - 0.786)
 *  - Quantum Vision Future Prediction Cone extending from latest live candle
 *  - Live Liquidity Depth Heatmaps
 *
 * Rendered synchronously inside Chart.js beforeDatasetsDraw / afterDatasetsDraw hooks
 * using chart.scales.x and chart.scales.y coordinate transforms.
 */

import type { Chart, Plugin } from 'chart.js';
import { ChartJsPluginRenderState } from '../types';

export const qriVisionAtlasPlugin: Plugin<any> = {
  id: 'qriVisionAtlas',

  beforeDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state || !state.overlays || state.candles.length === 0) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const ov = state.overlays;
    const flags = state.enabledPlugins || {};

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 1. Vision Atlas Lab Confluence Zones (Background Bands)
    if (flags.vision_atlas_lab) {
      for (const zone of ov.labZones) {
        const yTop = yScale.getPixelForValue(zone.maxPrice);
        const yBot = yScale.getPixelForValue(zone.minPrice);
        const h = Math.max(6, Math.abs(yBot - yTop));
        const topPx = Math.min(yTop, yBot);

        ctx.fillStyle = zone.fillColor;
        ctx.fillRect(left, topPx, right - left, h);

        ctx.strokeStyle = zone.borderColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(left, topPx, right - left, h);
        ctx.setLineDash([]);

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = zone.textColor;
        ctx.fillText(`${zone.name} [${zone.minPrice} - ${zone.maxPrice}]`, left + 8, topPx + 12);
      }
    }

    // 2. Market DNA Golden Pocket (0.618 - 0.786 Fib Retracement Band)
    if (flags.market_dna && ov.goldenPocket.maxPrice > ov.goldenPocket.minPrice) {
      const yTop = yScale.getPixelForValue(ov.goldenPocket.maxPrice);
      const yBot = yScale.getPixelForValue(ov.goldenPocket.minPrice);
      const h = Math.max(4, Math.abs(yBot - yTop));
      const topPx = Math.min(yTop, yBot);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
      ctx.fillRect(left + (right - left) * 0.06, topPx, (right - left) * 0.88, h);

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(left + (right - left) * 0.06, topPx, (right - left) * 0.88, h);
      ctx.setLineDash([]);

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(
        `FIB GOLDEN POCKET 0.618-0.786 [${ov.goldenPocket.minPrice} - ${ov.goldenPocket.maxPrice}]`,
        left + (right - left) * 0.07,
        topPx + 11
      );
    }

    // 3. Fair Value Gaps (FVG Imbalances)
    if (flags.vision_atlas_smc) {
      for (const fvg of ov.fairValueGaps) {
        const startX = Math.max(left, xScale.getPixelForValue(fvg.startIndex));
        const yTop = yScale.getPixelForValue(fvg.highPrice);
        const yBot = yScale.getPixelForValue(fvg.lowPrice);
        const topPx = Math.min(yTop, yBot);
        const h = Math.max(4, Math.abs(yBot - yTop));
        const isBull = fvg.type === 'BULLISH_FVG';

        ctx.fillStyle = isBull ? 'rgba(6, 182, 212, 0.14)' : 'rgba(244, 63, 94, 0.14)';
        ctx.fillRect(startX, topPx, right - startX, h);
        ctx.strokeStyle = isBull ? 'rgba(6, 182, 212, 0.55)' : 'rgba(244, 63, 94, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, topPx, right - startX, h);

        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = isBull ? '#22d3ee' : '#fb7185';
        ctx.fillText(fvg.label, startX + 4, topPx + 9);
      }

      // 4. Institutional Order Blocks (OB Demand & Supply)
      for (const ob of ov.orderBlocks) {
        const startX = Math.max(left, xScale.getPixelForValue(ob.startIndex));
        const yTop = yScale.getPixelForValue(ob.highPrice);
        const yBot = yScale.getPixelForValue(ob.lowPrice);
        const topPx = Math.min(yTop, yBot);
        const h = Math.max(8, Math.abs(yBot - yTop));
        const isDemand = ob.type === 'DEMAND';

        ctx.fillStyle = isDemand ? 'rgba(16, 185, 129, 0.13)' : 'rgba(239, 68, 68, 0.13)';
        ctx.fillRect(startX, topPx, right - startX, h);

        ctx.strokeStyle = isDemand ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(startX, topPx, right - startX, h);

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = isDemand ? '#34d399' : '#f87171';
        ctx.fillText(ob.label, startX + 6, topPx + 11);
      }
    }

    ctx.restore();
  },

  afterDatasetsDraw(chart: Chart) {
    const state = (chart.options.plugins as any)?.qriState as ChartJsPluginRenderState | undefined;
    if (!state || !state.overlays || state.candles.length === 0) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;
    if (!xScale || !yScale || !chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const ov = state.overlays;
    const flags = state.enabledPlugins || {};
    const lastIdx = state.candles.length - 1;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();

    // 5. BOS / CHoCH Structure Lines & Swing Pivot Markers
    if (flags.vision_atlas_smc) {
      for (const st of ov.structures) {
        const startX = Math.max(left, xScale.getPixelForValue(st.startIndex));
        const y = yScale.getPixelForValue(st.price);
        const isBull = st.direction === 'BULLISH';
        const color = st.kind === 'BOS' ? (isBull ? '#10b981' : '#ef4444') : (isBull ? '#06b6d4' : '#f43f5e');

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        const midX = Math.min(right - 95, Math.max(left + 10, (startX + right) / 2));
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(midX, y - 9, 86, 17, 3);
        ctx.fill();

        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.kind === 'BOS' ? `BOS ${st.direction}` : `CHoCH ${st.direction}`, midX + 5, y);
      }

      // Swing pivots
      for (const sw of ov.swings) {
        const x = xScale.getPixelForValue(sw.index);
        const y = yScale.getPixelForValue(sw.price);
        if (x < left || x > right) continue;
        const isHigh = sw.type === 'HIGH';

        ctx.fillStyle = isHigh ? '#ef4444' : '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sw.label, x, isHigh ? y - 9 : y + 11);
      }
      ctx.textAlign = 'left';
    }

    // 6. Quantum Vision Volatility Prediction Fan extending from latest live candle
    if (flags.quantum_vision && ov.quantumFan.length > 1) {
      const upperPts = ov.quantumFan.map((p) => ({
        x: xScale.getPixelForValue(lastIdx + p.offsetBars),
        y: yScale.getPixelForValue(p.upperPrice),
      }));
      const medianPts = ov.quantumFan.map((p) => ({
        x: xScale.getPixelForValue(lastIdx + p.offsetBars),
        y: yScale.getPixelForValue(p.medianPrice),
      }));
      const lowerPts = ov.quantumFan.map((p) => ({
        x: xScale.getPixelForValue(lastIdx + p.offsetBars),
        y: yScale.getPixelForValue(p.lowerPrice),
      }));

      // Shaded probability cone
      const grad = ctx.createLinearGradient(upperPts[0].x, 0, upperPts[upperPts.length - 1].x, 0);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      grad.addColorStop(1, 'rgba(59, 130, 246, 0.08)');
      ctx.beginPath();
      upperPts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      for (let i = lowerPts.length - 1; i >= 0; i--) ctx.lineTo(lowerPts[i].x, lowerPts[i].y);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      const drawFanLine = (pts: Array<{ x: number; y: number }>, color: string, dash: number[]) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.setLineDash(dash);
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
        ctx.setLineDash([]);
      };

      drawFanLine(upperPts, '#22d3ee', [4, 3]);
      drawFanLine(medianPts, '#38bdf8', [2, 2]);
      drawFanLine(lowerPts, '#fb7185', [4, 3]);

      const endUpper = upperPts[upperPts.length - 1];
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('QUANTUM TARGET', Math.min(right - 85, endUpper.x - 40), Math.max(top + 12, endUpper.y - 6));
    }

    // 7. Live Liquidity Depth Heatmaps along Right Edge
    if (flags.liquidity_heatmap) {
      for (const wall of ov.liquidityWalls) {
        const y = yScale.getPixelForValue(wall.price);
        if (y < top + 6 || y > bottom - 6) continue;
        const barW = wall.widthRatio * 74;
        const color = wall.isAsk ? '#f43f5e' : '#10b981';

        ctx.fillStyle = wall.isAsk ? 'rgba(244, 63, 94, 0.72)' : 'rgba(16, 185, 129, 0.72)';
        ctx.fillRect(right - barW, y - 2, barW, 4);

        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(wall.label, right - barW - 5, y);
      }
      ctx.textAlign = 'left';
    }

    ctx.restore();
  },
};
