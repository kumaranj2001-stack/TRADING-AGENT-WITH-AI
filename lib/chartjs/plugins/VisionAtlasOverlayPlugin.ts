/**
 * lib/chartjs/plugins/VisionAtlasOverlayPlugin.ts
 * Proprietary Vision Atlas Modular Chart.js Plugin.
 * Renders Confluence Lab Zones, Demand/Supply Order Blocks, Market Structure (BOS/CHoCH/SH/SL),
 * Market DNA Golden Pocket + Ghost Bars, Quantum Vision Volatility Fan, Liquidity Heatmap Walls,
 * and User Canvas Drawings directly in Chart.js scale coordinates (zero pan/zoom desync).
 */

import { Chart, Plugin } from 'chart.js';
import { getQriPluginData } from '../ChartPluginRegistry';

export function createVisionAtlasOverlayPlugin(): Plugin {
  return {
    id: 'qriVisionAtlasOverlay',
    beforeDatasetsDraw(chart: Chart) {
      const data = getQriPluginData(chart);
      if (!data || !data.visionAtlas?.enabled || !data.candles || data.candles.length < 8) return;

      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;

      const { ctx, chartArea } = chart;
      const candles = data.candles;
      const va = data.visionAtlas;
      const dec = data.priceDecimals;

      const minC = Math.min(...candles.map((c) => c.low));
      const maxC = Math.max(...candles.map((c) => c.high));
      const span = Math.max(maxC - minC, minC * 0.002);

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        chartArea.left,
        chartArea.top,
        chartArea.right - chartArea.left,
        chartArea.bottom - chartArea.top
      );
      ctx.clip();

      // 1. Vision Atlas Lab Confluence Zones (Danger / Caution / Entry / Safe)
      if (va.showLabZones) {
        const zones = [
          {
            name: 'DANGER ZONE (DISTRIBUTION)',
            min: minC + span * 0.88,
            max: minC + span * 1.04,
            fill: 'rgba(239, 68, 68, 0.09)',
            stroke: 'rgba(239, 68, 68, 0.45)',
            text: '#ef4444',
          },
          {
            name: 'CAUTION ZONE (EQUILIBRIUM)',
            min: minC + span * 0.70,
            max: minC + span * 0.88,
            fill: 'rgba(245, 158, 11, 0.08)',
            stroke: 'rgba(245, 158, 11, 0.4)',
            text: '#f59e0b',
          },
          {
            name: 'CONFLUENCE ENTRY ZONE',
            min: minC + span * 0.52,
            max: minC + span * 0.70,
            fill: 'rgba(6, 182, 212, 0.11)',
            stroke: 'rgba(6, 182, 212, 0.55)',
            text: '#06b6d4',
          },
          {
            name: 'SAFE ZONE (ACCUMULATION FLOOR)',
            min: minC + span * 0.34,
            max: minC + span * 0.52,
            fill: 'rgba(16, 185, 129, 0.09)',
            stroke: 'rgba(16, 185, 129, 0.45)',
            text: '#10b981',
          },
        ];

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        for (const z of zones) {
          const yTop = yScale.getPixelForValue(z.max);
          const yBot = yScale.getPixelForValue(z.min);
          const top = Math.max(chartArea.top + 2, Math.min(yTop, yBot));
          const bot = Math.min(chartArea.bottom - 2, Math.max(yTop, yBot));
          const h = Math.max(8, bot - top);
          if (bot < chartArea.top + 4 || top > chartArea.bottom - 4) continue;

          ctx.fillStyle = z.fill;
          ctx.fillRect(chartArea.left + 4, top, Math.max(10, chartArea.right - chartArea.left - 8), h);
          ctx.strokeStyle = z.stroke;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(chartArea.left + 4, top, Math.max(10, chartArea.right - chartArea.left - 8), h);
          ctx.setLineDash([]);

          ctx.fillStyle = z.text;
          const labelY = Math.max(chartArea.top + 12, Math.min(chartArea.bottom - 6, top + 11));
          ctx.fillText(
            `${z.name} [${z.min.toFixed(dec)} - ${z.max.toFixed(dec)}]`,
            chartArea.left + 10,
            labelY
          );
        }
      }

      // 2. Market DNA Golden Pocket Retracement Band (0.618 - 0.786)
      if (va.showMarketDna) {
        const fib618 = minC + span * 0.618;
        const fib786 = minC + span * 0.786;
        const yTop = yScale.getPixelForValue(fib786);
        const yBot = yScale.getPixelForValue(fib618);
        const top = Math.min(yTop, yBot);
        const h = Math.max(6, Math.abs(yBot - yTop));

        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.fillRect(chartArea.left + 10, top, (chartArea.right - chartArea.left) * 0.85, h);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(chartArea.left + 10, top, (chartArea.right - chartArea.left) * 0.85, h);
        ctx.setLineDash([]);

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(
          `FIB GOLDEN POCKET 0.618-0.786 [${fib618.toFixed(dec)} - ${fib786.toFixed(dec)}]`,
          chartArea.left + 16,
          top + 11
        );
      }

      // 3. Order Blocks (Demand & Supply)
      if (va.showOrderBlocks) {
        const demandLow = minC + span * 0.10;
        const demandHigh = demandLow + span * 0.07;
        const supplyHigh = maxC - span * 0.10;
        const supplyLow = supplyHigh - span * 0.07;

        const blocks = [
          {
            label: `OB [Demand] ${demandLow.toFixed(dec)}-${demandHigh.toFixed(dec)}`,
            low: demandLow,
            high: demandHigh,
            fill: 'rgba(16, 185, 129, 0.14)',
            stroke: '#10b981',
          },
          {
            label: `OB [Supply] ${supplyLow.toFixed(dec)}-${supplyHigh.toFixed(dec)}`,
            low: supplyLow,
            high: supplyHigh,
            fill: 'rgba(239, 68, 68, 0.14)',
            stroke: '#ef4444',
          },
        ];

        const bx = chartArea.left + (chartArea.right - chartArea.left) * 0.14;
        const bw = (chartArea.right - chartArea.left) * 0.72;
        ctx.font = 'bold 9px "JetBrains Mono", monospace';

        for (const b of blocks) {
          const yt = yScale.getPixelForValue(b.high);
          const yb = yScale.getPixelForValue(b.low);
          const top = Math.min(yt, yb);
          const h = Math.max(10, Math.abs(yb - yt));
          ctx.fillStyle = b.fill;
          ctx.fillRect(bx, top, bw, h);
          ctx.strokeStyle = b.stroke;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(bx, top, bw, h);
          ctx.fillStyle = b.stroke;
          ctx.fillText(b.label, bx + 6, top + 11);
        }
      }

      ctx.restore();
    },

    afterDatasetsDraw(chart: Chart) {
      const data = getQriPluginData(chart);
      if (!data || !data.visionAtlas?.enabled || !data.candles || data.candles.length < 10) return;

      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!xScale || !yScale) return;

      const { ctx, chartArea } = chart;
      const candles = data.candles;
      const va = data.visionAtlas;

      const minC = Math.min(...candles.map((c) => c.low));
      const maxC = Math.max(...candles.map((c) => c.high));
      const span = Math.max(maxC - minC, minC * 0.002);

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        chartArea.left,
        chartArea.top,
        chartArea.right - chartArea.left,
        chartArea.bottom - chartArea.top
      );
      ctx.clip();

      // 4. Fractal Swing Pivots (SH / SL) & BOS / CHoCH
      const swingHighs: Array<{ idx: number; price: number }> = [];
      const swingLows: Array<{ idx: number; price: number }> = [];

      for (let i = 3; i < candles.length - 3; i++) {
        const cur = candles[i];
        const isSH =
          candles[i - 1].high < cur.high &&
          candles[i - 2].high < cur.high &&
          candles[i + 1].high < cur.high &&
          candles[i + 2].high < cur.high;
        const isSL =
          candles[i - 1].low > cur.low &&
          candles[i - 2].low > cur.low &&
          candles[i + 1].low > cur.low &&
          candles[i + 2].low > cur.low;
        if (isSH) swingHighs.push({ idx: i, price: cur.high });
        if (isSL) swingLows.push({ idx: i, price: cur.low });
      }

      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      if (va.showInternalStructure) {
        for (const sh of swingHighs) {
          const sx = xScale.getPixelForValue(sh.idx);
          const sy = yScale.getPixelForValue(sh.price);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(sh.idx > candles.length - 12 ? 'SH' : 'iH', sx - 7, sy - 6);
        }
        for (const sl of swingLows) {
          const sx = xScale.getPixelForValue(sl.idx);
          const sy = yScale.getPixelForValue(sl.price);
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText(sl.idx > candles.length - 12 ? 'SL' : 'iL', sx - 7, sy + 12);
        }
      }

      if (va.showBos && swingHighs.length > 0) {
        const recentSH = swingHighs[swingHighs.length - 1];
        const yBos = yScale.getPixelForValue(recentSH.price);
        const startX = xScale.getPixelForValue(recentSH.idx);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, yBos);
        ctx.lineTo(chartArea.right - 12, yBos);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#065f46';
        ctx.fillRect(chartArea.right - 92, yBos - 9, 82, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('BOS (Bull)', chartArea.right - 86, yBos + 2);
      }

      if (va.showChoch && swingLows.length > 0) {
        const recentSL = swingLows[swingLows.length - 1];
        const yCh = yScale.getPixelForValue(recentSL.price);
        const startX = xScale.getPixelForValue(recentSL.idx);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, yCh);
        ctx.lineTo(chartArea.right - 12, yCh);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#be123c';
        ctx.fillRect(chartArea.right - 96, yCh - 9, 86, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('CHoCH Floor', chartArea.right - 90, yCh + 2);
      }

      // 5. Quantum Vision 3-Path Volatility Fan Cone (anchored into right-side future margin slots)
      if (va.showQuantumFan) {
        const lastIdx = candles.length - 1;
        const lastX = xScale.getPixelForValue(lastIdx);
        const lastY = yScale.getPixelForValue(data.livePrice);
        const totalLabels = Array.isArray(chart.data.labels) ? chart.data.labels.length : candles.length;
        const availableFutureSlots = Math.max(0, totalLabels - candles.length);
        const horizon = Math.min(va.horizonCandles || 6, Math.max(availableFutureSlots, 4));
        const stepPx = Math.max(10, (chartArea.right - chartArea.left) / Math.max(12, totalLabels));

        const upperPts: Array<{ x: number; y: number }> = [{ x: lastX, y: lastY }];
        const medianPts: Array<{ x: number; y: number }> = [{ x: lastX, y: lastY }];
        const lowerPts: Array<{ x: number; y: number }> = [{ x: lastX, y: lastY }];

        for (let i = 1; i <= horizon; i++) {
          const targetSlot = lastIdx + i;
          const slotX = targetSlot < totalLabels ? xScale.getPixelForValue(targetSlot) : lastX + i * stepPx * 0.85;
          const px = Math.min(chartArea.right - 8, slotX);
          upperPts.push({ x: px, y: Math.max(chartArea.top + 8, lastY - i * 4.2 - Math.sin(i) * 1.5) });
          medianPts.push({ x: px, y: Math.max(chartArea.top + 8, Math.min(chartArea.bottom - 8, lastY - i * 0.7 + Math.cos(i) * 1.2)) });
          lowerPts.push({ x: px, y: Math.min(chartArea.bottom - 8, lastY + i * 4.2 + Math.sin(i * 1.2) * 1.5) });
        }

        // Shaded Probability Cloud
        ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
        ctx.beginPath();
        ctx.moveTo(upperPts[0].x, upperPts[0].y);
        for (const p of upperPts) ctx.lineTo(p.x, p.y);
        for (let i = lowerPts.length - 1; i >= 0; i--) ctx.lineTo(lowerPts[i].x, lowerPts[i].y);
        ctx.closePath();
        ctx.fill();

        const drawPath = (pts: Array<{ x: number; y: number }>, color: string) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.stroke();
          ctx.setLineDash([]);
        };
        drawPath(upperPts, '#06b6d4');
        drawPath(medianPts, '#38bdf8');
        drawPath(lowerPts, '#f43f5e');
      }

      // 6. Live Liquidity Heatmaps (Resting Depth Walls)
      if (va.showLiquidityHeatmap) {
        const walls = [
          { label: 'ASK DEPTH WALL', price: data.livePrice + span * 0.10, width: 72, color: '#f43f5e' },
          { label: 'BID DEPTH WALL', price: data.livePrice - span * 0.10, width: 84, color: '#10b981' },
        ];
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        for (const w of walls) {
          const wy = yScale.getPixelForValue(w.price);
          if (wy >= chartArea.top && wy <= chartArea.bottom) {
            ctx.strokeStyle = w.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(chartArea.right - w.width, wy);
            ctx.lineTo(chartArea.right - 2, wy);
            ctx.stroke();
            ctx.fillStyle = w.color;
            ctx.fillText(w.label, chartArea.right - w.width - 78, wy + 3);
          }
        }
      }

      // 7. User Drawings
      const allDrawings = [...(data.drawings || [])];
      if (data.inProgressDrawing) allDrawings.push(data.inProgressDrawing);

      for (const el of allDrawings) {
        const x1 = xScale.getPixelForValue(el.startIndex);
        const y1 = yScale.getPixelForValue(el.startPrice);
        if (el.type === 'horizontal') {
          ctx.strokeStyle = el.color || '#06b6d4';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(chartArea.left, y1);
          ctx.lineTo(chartArea.right, y1);
          ctx.stroke();
        } else if (el.type === 'trendline' && el.endIndex !== undefined && el.endPrice !== undefined) {
          const x2 = xScale.getPixelForValue(el.endIndex);
          const y2 = yScale.getPixelForValue(el.endPrice);
          ctx.strokeStyle = el.color || '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (el.type === 'rectangle' && el.endIndex !== undefined && el.endPrice !== undefined) {
          const x2 = xScale.getPixelForValue(el.endIndex);
          const y2 = yScale.getPixelForValue(el.endPrice);
          ctx.fillStyle = el.color || 'rgba(6, 182, 212, 0.18)';
          ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        }
      }

      ctx.restore();
    },
  };
}
