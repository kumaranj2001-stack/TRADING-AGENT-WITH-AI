/**
 * Layer 5: HardwareKillSwitch
 * Automated hardware-level emergency kill-switch.
 * Flattens all open positions immediately and halts autonomous agent execution upon detecting:
 * - Anomalous broker telemetry (disconnects, heartbeats > 5000ms)
 * - Liquidity blackouts (L2 DOM depth collapses)
 * - Erratic swarm behavior (rapid signal flip-flopping)
 * - Explicit emergency manual trigger
 */

import { institutionalBrokerBridge } from '../execution/InstitutionalBrokerBridge';
import { activeTradeLifecycleManager } from '../execution/ActiveTradeLifecycleManager';
import { deterministicRiskFirewall } from './DeterministicRiskFirewall';

export type KillSwitchTriggerReason = 
  | 'BROKER_TELEMETRY_ANOMALY'
  | 'LIQUIDITY_BLACKOUT'
  | 'ERRATIC_SWARM_BEHAVIOR'
  | 'DRAWDOWN_CIRCUIT_BREAKER'
  | 'OPERATOR_MANUAL_HALT';

export interface KillSwitchStatus {
  isArmed: boolean;
  isTriggered: boolean;
  triggeredAt: number | null;
  triggerReason: KillSwitchTriggerReason | null;
  positionsFlattenedCount: number;
  ordersCancelledCount: number;
  haltMessage: string;
}

export class HardwareKillSwitch {
  private static instance: HardwareKillSwitch;

  private isArmed: boolean = true;
  private isTriggered: boolean = false;
  private triggeredAt: number | null = null;
  private triggerReason: KillSwitchTriggerReason | null = null;
  private haltMessage: string = 'System normal. Hardware kill switch armed.';
  private positionsFlattenedCount: number = 0;
  private ordersCancelledCount: number = 0;

  // Swarm behavior telemetry tracking
  private recentConsensusSignals: Array<{ timestamp: number; direction: string }> = [];

  private constructor() {}

  public static getInstance(): HardwareKillSwitch {
    if (!HardwareKillSwitch.instance) {
      HardwareKillSwitch.instance = new HardwareKillSwitch();
    }
    return HardwareKillSwitch.instance;
  }

  /**
   * Monitor live broker telemetry and market liquidity for trigger conditions
   */
  public evaluateTelemetryHealth(
    isBrokerConnected: boolean,
    heartbeatLatencyMs: number,
    domRestingDensity: number,
    currentSpreadPips: number
  ): boolean {
    if (this.isTriggered) return false;

    // 1. Broker Telemetry Anomaly Check
    if (!isBrokerConnected || heartbeatLatencyMs > 5000) {
      this.triggerKillSwitch(
        'BROKER_TELEMETRY_ANOMALY',
        `Broker telemetry failed: Disconnected or heartbeat latency (${heartbeatLatencyMs}ms) exceeded 5000ms safety threshold.`
      );
      return false;
    }

    // 2. Liquidity Blackout Check (resting density below critical floor or extreme spread)
    if (domRestingDensity < 5 || currentSpreadPips > 10.0) {
      this.triggerKillSwitch(
        'LIQUIDITY_BLACKOUT',
        `Critical liquidity blackout detected: DOM resting density fell to ${domRestingDensity} with spread ${currentSpreadPips.toFixed(1)} pips.`
      );
      return false;
    }

    return true;
  }

  /**
   * Track Swarm Signals for Erratic Swarm Behavior (rapid flip-flopping)
   */
  public recordSwarmSignal(direction: string): void {
    if (this.isTriggered) return;
    const now = Date.now();
    this.recentConsensusSignals.push({ timestamp: now, direction });
    this.recentConsensusSignals = this.recentConsensusSignals.filter(s => now - s.timestamp < 15000);

    // If direction changes more than 4 times in 15 seconds, flag erratic swarm behavior
    let directionChanges = 0;
    for (let i = 1; i < this.recentConsensusSignals.length; i++) {
      if (this.recentConsensusSignals[i].direction !== this.recentConsensusSignals[i - 1].direction) {
        directionChanges++;
      }
    }

    if (directionChanges >= 4) {
      this.triggerKillSwitch(
        'ERRATIC_SWARM_BEHAVIOR',
        `Erratic swarm behavior detected: ${directionChanges} directional flip-flops in 15 seconds.`
      );
    }
  }

  /**
   * EMERGENCY TRIGGER: Flattens all positions and locks system
   */
  public async triggerKillSwitch(reason: KillSwitchTriggerReason, message: string): Promise<KillSwitchStatus> {
    this.isTriggered = true;
    this.triggeredAt = Date.now();
    this.triggerReason = reason;
    this.haltMessage = message;

    // Trip deterministic risk firewall
    deterministicRiskFirewall.tripCircuitBreaker(`Hardware Kill Switch Triggered: ${reason} - ${message}`);

    // Immediately flatten all open positions via low-latency broker bridge
    const openPositions = activeTradeLifecycleManager.getActivePositions();
    this.positionsFlattenedCount = openPositions.length;

    for (const pos of openPositions) {
      try {
        await institutionalBrokerBridge.routeOrder({
          clOrdId: `kill_switch_flatten_${pos.tradeId}_${Date.now()}`,
          symbol: pos.symbol,
          side: pos.side === 'BUY' ? 'SELL' : 'BUY',
          orderType: 'MARKET',
          quantityUnits: pos.currentUnits,
          protocol: 'FIX_4_4',
          timeInForce: 'IOC',
        });
      } catch (err) {
        console.error(`Failed to route flatten order for ${pos.tradeId}:`, err);
      }
    }

    return this.getStatus();
  }

  /**
   * Operator Manual Reset (Requires explicit intervention)
   */
  public operatorReset(operatorPasscode: string): boolean {
    if (operatorPasscode === 'OVERRIDE_QRI_AUTONOMOUS_SAFE') {
      this.isTriggered = false;
      this.triggeredAt = null;
      this.triggerReason = null;
      this.haltMessage = 'System normal. Hardware kill switch re-armed.';
      this.positionsFlattenedCount = 0;
      deterministicRiskFirewall.resetCircuitBreaker();
      return true;
    }
    return false;
  }

  public getStatus(): KillSwitchStatus {
    return {
      isArmed: this.isArmed,
      isTriggered: this.isTriggered,
      triggeredAt: this.triggeredAt,
      triggerReason: this.triggerReason,
      positionsFlattenedCount: this.positionsFlattenedCount,
      ordersCancelledCount: this.ordersCancelledCount,
      haltMessage: this.haltMessage,
    };
  }
}

export const hardwareKillSwitch = HardwareKillSwitch.getInstance();
