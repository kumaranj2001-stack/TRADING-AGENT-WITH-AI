/**
 * lib/chartjs/ChartJsPluginRegistry.ts
 * Modular Plugin Architecture allowing seamless registration, enable/disable toggling,
 * and priority-ordered canvas rendering for technical indicators and Vision Atlas overlays.
 */

import type { Plugin } from 'chart.js';
import { ChartJsPluginDescriptor } from './types';

export interface RegisteredChartJsPlugin {
  descriptor: ChartJsPluginDescriptor;
  plugin: Plugin<any>;
  order: number;
}

export class ChartJsPluginRegistry {
  private static instance: ChartJsPluginRegistry;
  private registry: Map<string, RegisteredChartJsPlugin> = new Map();

  private constructor() {}

  public static getInstance(): ChartJsPluginRegistry {
    if (!ChartJsPluginRegistry.instance) {
      ChartJsPluginRegistry.instance = new ChartJsPluginRegistry();
    }
    return ChartJsPluginRegistry.instance;
  }

  public register(
    descriptor: ChartJsPluginDescriptor,
    plugin: Plugin<any>,
    order: number = 50
  ): void {
    this.registry.set(descriptor.id, { descriptor, plugin, order });
  }

  public unregister(id: string): boolean {
    return this.registry.delete(id);
  }

  public listDescriptors(): ChartJsPluginDescriptor[] {
    return Array.from(this.registry.values())
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.descriptor);
  }

  public getOrderedPlugins(): Plugin<any>[] {
    return Array.from(this.registry.values())
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.plugin);
  }

  public getDefaultEnabledMap(): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const { descriptor } of this.registry.values()) {
      map[descriptor.id] = descriptor.defaultEnabled;
    }
    return map;
  }
}

export const chartJsPluginRegistry = ChartJsPluginRegistry.getInstance();
