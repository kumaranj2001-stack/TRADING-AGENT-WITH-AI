/**
 * lib/chartjs/ChartPluginRegistry.ts
 * Modular Plugin Manager for QuriTrader's unrestricted Chart.js rendering pipeline.
 * Supports registering/unregistering proprietary Vision Atlas & third-party indicators
 * with per-plugin error isolation so overlays never crash or desync the main canvas.
 */

import { Chart, Plugin } from 'chart.js';
import {
  ChartPluginErrorEvent,
  ModularChartPluginDescriptor,
  QriChartJsPluginData,
} from './types';

export function getQriPluginData(chart: Chart): QriChartJsPluginData | null {
  const raw = (chart.options?.plugins as any)?.qriContext as QriChartJsPluginData | undefined;
  return raw || null;
}

export function wrapSafeChartPlugin(
  descriptor: ModularChartPluginDescriptor,
  rawPlugin: Plugin,
  onPluginError?: (evt: ChartPluginErrorEvent) => void
): Plugin {
  const safeHook = (hookName: 'beforeDatasetsDraw' | 'afterDatasetsDraw' | 'afterDraw' | 'beforeUpdate') => {
    const original = (rawPlugin as any)[hookName];
    if (typeof original !== 'function') return undefined;
    return function wrappedHook(chart: Chart, args: any, options: any) {
      try {
        return original.call(rawPlugin, chart, args, options);
      } catch (err: any) {
        onPluginError?.({
          pluginId: descriptor.id,
          error: err?.message || 'Plugin render exception',
          timestamp: Date.now(),
        });
      }
    };
  };

  return {
    ...rawPlugin,
    id: descriptor.id,
    beforeUpdate: safeHook('beforeUpdate'),
    beforeDatasetsDraw: safeHook('beforeDatasetsDraw'),
    afterDatasetsDraw: safeHook('afterDatasetsDraw'),
    afterDraw: safeHook('afterDraw'),
  };
}

export class ChartPluginRegistry {
  private static instance: ChartPluginRegistry;
  private descriptors: Map<string, ModularChartPluginDescriptor> = new Map();
  private errorLog: ChartPluginErrorEvent[] = [];

  private constructor() {}

  public static getInstance(): ChartPluginRegistry {
    if (!ChartPluginRegistry.instance) {
      ChartPluginRegistry.instance = new ChartPluginRegistry();
    }
    return ChartPluginRegistry.instance;
  }

  public registerPlugin(descriptor: ModularChartPluginDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  public unregisterPlugin(id: string): void {
    this.descriptors.delete(id);
  }

  public setPluginEnabled(id: string, enabled: boolean): void {
    const existing = this.descriptors.get(id);
    if (existing) {
      existing.enabled = enabled;
    }
  }

  public listPlugins(): ModularChartPluginDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  public buildChartJsPlugins(filterIds?: string[]): Plugin[] {
    const plugins: Plugin[] = [];
    for (const desc of this.descriptors.values()) {
      if (!desc.enabled) continue;
      if (filterIds && !filterIds.includes(desc.id)) continue;
      const raw = desc.createPlugin();
      plugins.push(
        wrapSafeChartPlugin(desc, raw, (evt) => {
          this.errorLog = [evt, ...this.errorLog.slice(0, 24)];
        })
      );
    }
    return plugins;
  }

  public getRecentErrors(): ChartPluginErrorEvent[] {
    return this.errorLog;
  }
}

export const chartPluginRegistry = ChartPluginRegistry.getInstance();
