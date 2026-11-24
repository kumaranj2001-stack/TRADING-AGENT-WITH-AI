/**
 * Layer 5: DeterministicRiskFirewall
 * Immutable, deterministic code-based risk and safety guardrail layer.
 * LLM agents CANNOT bypass or modify these rules under any circumstance.
 * Enforces hard-coded circuit breakers prior to and during order routing:
 * - Max daily & weekly drawdown caps
 * - Per-trade max risk limits
 * - Pre-trade margin and leverage verification
 * - Max allowable slippage and latency thresholds
 * - API rate-limiting to prevent infinite order loops
 */

import { CurrencyPair } from '../types';
import { InstitutionalOrderRequest } from '../execution/InstitutionalBrokerBridge';

export interface FirewallSecurityTelemetry {
  firewallStatus: 'ACTIVE_ARMED' | 'CIRCUIT_BREAKER_TRIPPED' | 'EMERGENCY_HALTED';
  dailyDrawdownPercent: number;
  maxDailyDrawdownCapPercent: number;
  weeklyDrawdownPercent: number;
  maxWeeklyDrawdownCapPercent: number;
  currentTradeRiskCapPercent: number;
  ordersRoutedLastMinute: number;
  maxOrdersPerMinuteCap: number;
  circuitBreakerTrippedReason?: string;
  totalViolationsBlocked: number;
  lastBlockedViolation?: {
    timestamp: number;
    rule: string;
    reason: string;
  };
}

export class DeterministicRiskFirewall {
  private static instance: DeterministicRiskFirewall;

  // HARD-CODED IMMUTABLE CIRCUIT BREAKER THRESHOLDS
  public readonly MAX_DAILY_DRAWDOWN_PERCENT = 3.0;     // 3.0% daily halt
  public readonly MAX_WEEKLY_DRAWDOWN_PERCENT = 6.0;    // 6.0% weekly halt
  public readonly MAX_PER_TRADE_RISK_PERCENT = 1.5;     // 1.5% NAV max risk per trade
  public readonly MAX_ALLOWABLE_SPREAD_PIPS = 3.5;      // Reject if spread > 3.5 pips
  public readonly MAX_ALLOWABLE_LATENCY_MS = 250;       // Reject if execution latency > 250ms
  public readonly MAX_ORDERS_PER_MINUTE = 6;            // Anti-looping rate limit
  public readonly MAX_LEVERAGE_CEILING = 30;            // 30:1 hard leverage ceiling
  public readonly MIN_FREE_MARGIN_BUFFER_PERCENT = 20;  // 20% margin cushion required

  // State Tracking
  private dailyStartEquity: number = 100000;
  private weeklyStartEquity: number = 100000;
  private currentEquity: number = 100000;
  private peakDailyEquity: number = 100000;
  
  private orderTimestamps: number[] = [];
  private orderDeduplicationLocks: Map<string, number> = new Map(); // symbol -> timestamp
  private totalBlockedCount: number = 0;
  private lastBlockedViolation?: { timestamp: number; rule: string; reason: string };
  private isCircuitBreakerTripped: boolean = false;
  private trippedReason?: string;

  private constructor() {}

  public static getInstance(): DeterministicRiskFirewall {
    if (!DeterministicRiskFirewall.instance) {
      DeterministicRiskFirewall.instance = new DeterministicRiskFirewall();
    }
    return DeterministicRiskFirewall.instance;
  }

  /**
   * Deterministic Pre-Trade Gatekeeper:
   * Returns true only if EVERY immutable safety check passes.
   * If ANY check fails, order is REJECTED deterministically before reaching broker.
   */
  public verifyOrderPreRouting(
    order: InstitutionalOrderRequest,
    accountEquity: number,
    freeMargin: number,
    riskDollars: number,
    currentSpreadPips: number,
    brokerLatencyMs: number
  ): { allowed: boolean; code: 'CLEARED' | 'BLOCKED'; reason?: string } {
    this.currentEquity = accountEquity;
    if (accountEquity > this.peakDailyEquity) {
      this.peakDailyEquity = accountEquity;
    }

    // 0. Emergency Circuit Breaker Global Check
    if (this.isCircuitBreakerTripped) {
      return this.recordViolation('CIRCUIT_BREAKER_TRIPPED', `Execution halted: ${this.trippedReason}`);
    }

    // 1. Daily Drawdown Circuit Breaker
    const dailyDrawdownPercent = ((this.peakDailyEquity - accountEquity) / (this.peakDailyEquity || 1)) * 100;
    if (dailyDrawdownPercent >= this.MAX_DAILY_DRAWDOWN_PERCENT) {
      this.tripCircuitBreaker(`Daily drawdown (${dailyDrawdownPercent.toFixed(2)}%) breached hard limit (${this.MAX_DAILY_DRAWDOWN_PERCENT}%)`);
      return this.recordViolation('DAILY_DRAWDOWN_BREACH', `Daily drawdown limit exceeded.`);
    }

    // 2. Weekly Drawdown Circuit Breaker
    const weeklyDrawdownPercent = ((this.weeklyStartEquity - accountEquity) / (this.weeklyStartEquity || 1)) * 100;
    if (weeklyDrawdownPercent >= this.MAX_WEEKLY_DRAWDOWN_PERCENT) {
      this.tripCircuitBreaker(`Weekly drawdown (${weeklyDrawdownPercent.toFixed(2)}%) breached hard limit (${this.MAX_WEEKLY_DRAWDOWN_PERCENT}%)`);
      return this.recordViolation('WEEKLY_DRAWDOWN_BREACH', `Weekly drawdown limit exceeded.`);
    }

    // 3. Per-Trade Risk Exposure Cap
    const tradeRiskPercent = (riskDollars / (accountEquity || 1)) * 100;
    if (tradeRiskPercent > this.MAX_PER_TRADE_RISK_PERCENT) {
      return this.recordViolation(
        'PER_TRADE_RISK_BREACH',
        `Proposed trade risk (${tradeRiskPercent.toFixed(2)}%) exceeds immutable ceiling (${this.MAX_PER_TRADE_RISK_PERCENT}% NAV).`
      );
    }

    // 4. Rate-Limiting & Anti-Looping Lock
    const now = Date.now();
    this.orderTimestamps = this.orderTimestamps.filter(t => now - t < 60000);
    if (this.orderTimestamps.length >= this.MAX_ORDERS_PER_MINUTE) {
      return this.recordViolation(
        'RATE_LIMIT_EXCEEDED',
        `Anti-looping trigger: routed ${this.orderTimestamps.length} orders in last 60s (max ${this.MAX_ORDERS_PER_MINUTE}).`
      );
    }

    // Duplicate Order Lock (5-second block on same symbol)
    const lastOrderTime = this.orderDeduplicationLocks.get(order.symbol);
    if (lastOrderTime && now - lastOrderTime < 5000) {
      return this.recordViolation(
        'DUPLICATE_ORDER_LOCK',
        `Rapid repeated order lock: order on ${order.symbol} attempted within 5s of previous routing.`
      );
    }

    // 5. Spread and Latency Anomaly Thresholds
    if (currentSpreadPips > this.MAX_ALLOWABLE_SPREAD_PIPS) {
      return this.recordViolation(
        'SPREAD_ANOMALY',
        `Current market spread (${currentSpreadPips.toFixed(1)} pips) exceeds maximum allowable threshold (${this.MAX_ALLOWABLE_SPREAD_PIPS} pips).`
      );
    }

    if (brokerLatencyMs > this.MAX_ALLOWABLE_LATENCY_MS) {
      return this.recordViolation(
        'LATENCY_ANOMALY',
        `Broker telemetry latency (${brokerLatencyMs}ms) exceeds maximum allowable ceiling (${this.MAX_ALLOWABLE_LATENCY_MS}ms).`
      );
    }

    // 6. Free Margin and Leverage Cushion
    const notionalValue = order.quantityUnits * (order.price || 1.0850);
    const requiredMargin = notionalValue / this.MAX_LEVERAGE_CEILING;
    const minRequiredBuffer = (accountEquity * this.MIN_FREE_MARGIN_BUFFER_PERCENT) / 100;

    if (freeMargin < requiredMargin + minRequiredBuffer) {
      return this.recordViolation(
        'INSUFFICIENT_MARGIN_BUFFER',
        `Free margin ($${freeMargin.toFixed(2)}) insufficient for required margin ($${requiredMargin.toFixed(2)}) + 20% buffer.`
      );
    }

    // All deterministic checks PASSED
    this.orderTimestamps.push(now);
    this.orderDeduplicationLocks.set(order.symbol, now);

    return { allowed: true, code: 'CLEARED' };
  }

  public tripCircuitBreaker(reason: string): void {
    this.isCircuitBreakerTripped = true;
    this.trippedReason = reason;
  }

  public resetCircuitBreaker(): void {
    this.isCircuitBreakerTripped = false;
    this.trippedReason = undefined;
  }

  public updateEquityTelemetry(current: number, dailyStart?: number, weeklyStart?: number): void {
    this.currentEquity = current;
    if (dailyStart) this.dailyStartEquity = dailyStart;
    if (weeklyStart) this.weeklyStartEquity = weeklyStart;
    if (current > this.peakDailyEquity) this.peakDailyEquity = current;
  }

  public getSecurityTelemetry(): FirewallSecurityTelemetry {
    const dailyDrawdownPercent = Math.max(0, ((this.peakDailyEquity - this.currentEquity) / (this.peakDailyEquity || 1)) * 100);
    const weeklyDrawdownPercent = Math.max(0, ((this.weeklyStartEquity - this.currentEquity) / (this.weeklyStartEquity || 1)) * 100);

    return {
      firewallStatus: this.isCircuitBreakerTripped ? 'CIRCUIT_BREAKER_TRIPPED' : 'ACTIVE_ARMED',
      dailyDrawdownPercent: Math.round(dailyDrawdownPercent * 100) / 100,
      maxDailyDrawdownCapPercent: this.MAX_DAILY_DRAWDOWN_PERCENT,
      weeklyDrawdownPercent: Math.round(weeklyDrawdownPercent * 100) / 100,
      maxWeeklyDrawdownCapPercent: this.MAX_WEEKLY_DRAWDOWN_PERCENT,
      currentTradeRiskCapPercent: this.MAX_PER_TRADE_RISK_PERCENT,
      ordersRoutedLastMinute: this.orderTimestamps.length,
      maxOrdersPerMinuteCap: this.MAX_ORDERS_PER_MINUTE,
      circuitBreakerTrippedReason: this.trippedReason,
      totalViolationsBlocked: this.totalBlockedCount,
      lastBlockedViolation: this.lastBlockedViolation,
    };
  }

  private recordViolation(rule: string, reason: string): { allowed: boolean; code: 'BLOCKED'; reason: string } {
    this.totalBlockedCount++;
    this.lastBlockedViolation = {
      timestamp: Date.now(),
      rule,
      reason,
    };
    return {
      allowed: false,
      code: 'BLOCKED',
      reason,
    };
  }
}

export const deterministicRiskFirewall = DeterministicRiskFirewall.getInstance();
