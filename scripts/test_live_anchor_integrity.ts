/**
 * scripts/test_live_anchor_integrity.ts
 * Comprehensive End-to-End Test Suite for SSOT Live Market Feed Binding & Tight Variance Constraints
 */

import { liveMarketAnchorConstraintEngine } from '../lib/liveMarketAnchorConstraintEngine';
import { LiveMarketFeedManager } from '../lib/liveMarketFeed';
import { SwarmCoordinator } from '../lib/agents/SwarmCoordinator';
import { visionAtlasEngine } from '../lib/visionAtlasEngine';
import { scalpingEngine } from '../lib/scalpingEngine';
import { preExecutionVerificationEngine } from '../lib/preExecutionVerificationEngine';
import { automatedSignalValidationModule } from '../lib/automatedSignalValidationModule';
import { CurrencyPair } from '../lib/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 LIVE MARKET ANCHOR INTEGRITY & TIGHT VARIANCE TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Universal Live Market Anchor Specifications
  // -------------------------------------------------------------------------
  console.log('📌 Test Group 1: Universal Spec & Proximity Limits');
  {
    const fxSpec = liveMarketAnchorConstraintEngine.getTightVarianceSpec('EUR/USD');
    assert(fxSpec.maxEntryVariancePips === 3.5, 'EUR/USD max entry variance is 3.5 pips');
    assert(fxSpec.maxStopLossPips === 18.0, 'EUR/USD max stop loss is 18.0 pips');

    const goldSpec = liveMarketAnchorConstraintEngine.getTightVarianceSpec('XAU/USD');
    assert(goldSpec.maxEntryVariancePoints === 1.50, 'XAU/USD max entry variance is $1.50');
    assert(goldSpec.maxStopLossPips === 70.0, 'XAU/USD max stop loss is 70 pips ($7.00)');

    const niftySpec = liveMarketAnchorConstraintEngine.getTightVarianceSpec('NIFTY 50');
    assert(niftySpec.maxEntryVariancePoints === 20.0, 'NIFTY 50 max entry variance is 20 points');
    assert(niftySpec.maxStopLossPips === 75.0, 'NIFTY 50 max stop loss is 75 points');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Tight Variance Clamping of Outlier Proposals
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Group 2: Clamping of Outlier Orders');
  {
    // Outlier EUR/USD Buy setup proposed 80 pips away
    const clampedFx = liveMarketAnchorConstraintEngine.enforceTightVarianceConstraint({
      symbol: 'EUR/USD',
      direction: 'BUY',
      proposedEntry: 1.0950,
      proposedStopLoss: 1.0750, // 200 pips away
      customSpotPrice: 1.0850,
    });
    assert(clampedFx.isClamped, 'EUR/USD outlier entry and SL detected as clamped');
    assert(clampedFx.varianceFromSpotPips <= 3.5, `EUR/USD entry clamped within 3.5 pips of spot (got ${clampedFx.varianceFromSpotPips} pips)`);
    assert(clampedFx.stopLossDistancePips <= 18.0, `EUR/USD SL clamped <= 18 pips (got ${clampedFx.stopLossDistancePips} pips)`);
    assert(clampedFx.riskRewardRatio >= 1.5, `EUR/USD Authentic R:R >= 1.5 (got ${clampedFx.riskRewardRatio}:1)`);

    // Outlier Gold Sell setup proposed at rogue price 3787.37 when spot is 3538.20
    const clampedGold = liveMarketAnchorConstraintEngine.enforceTightVarianceConstraint({
      symbol: 'XAU/USD',
      direction: 'SELL',
      proposedEntry: 3787.37, // 249 points away!
      proposedStopLoss: 3820.00,
      customSpotPrice: 3538.20,
    });
    assert(clampedGold.isClamped, 'XAU/USD rogue 3787.37 entry clamped');
    assert(Math.abs(clampedGold.entryPrice - 3538.20) <= 1.50, `XAU/USD entry clamped within $1.50 of spot (${clampedGold.entryPrice})`);
    assert(clampedGold.stopLoss > clampedGold.entryPrice, 'XAU/USD SELL stop loss is strictly above entry');
    assert(clampedGold.takeProfit1 < clampedGold.entryPrice, 'XAU/USD SELL take profit is strictly below entry');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Scalping Engine Micro-Variance Bounds
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Group 3: Scalping Desk Real-Time Grounding');
  {
    const opportunities = scalpingEngine.pollScannerOpportunities({
      activePair: 'EUR/USD',
      currentLivePrice: 1.0850,
    });
    assert(opportunities.length > 0, `Generated ${opportunities.length} scalp opportunities`);
    for (const opp of opportunities) {
      assert(opp.distancePips <= 2.5, `${opp.pair} scalp distance ${opp.distancePips} pips <= 2.5 pips`);
      assert(opp.riskRewardRatio >= 1.5, `${opp.pair} scalp R:R ${opp.riskRewardRatio}:1 >= 1.5:1`);
      if (opp.direction === 'BUY') {
        assert(opp.takeProfit > opp.entryPrice, `${opp.pair} BUY TP > Entry`);
        assert(opp.stopLoss < opp.entryPrice, `${opp.pair} BUY SL < Entry`);
      } else {
        assert(opp.takeProfit < opp.entryPrice, `${opp.pair} SELL TP < Entry`);
        assert(opp.stopLoss > opp.entryPrice, `${opp.pair} SELL SL > Entry`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST 4: Swarm Consensus Calibration
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Group 4: Swarm Consensus Live Calibration');
  {
    const coordinator = new SwarmCoordinator();
    const rawResult = coordinator.runConsensus('XAU/USD', '1h');
    const livePrice = 3538.20;
    const calibrated = LiveMarketFeedManager.calibrateSwarmConsensus(rawResult, livePrice);

    assert(calibrated.executionSignal.status === 'READY', 'Execution signal status is READY');
    assert(calibrated.executionSignal.authorized === true, 'Execution signal is authorized');
    assert(Math.abs(calibrated.executionSignal.entry - livePrice) <= 1.50, `Consensus entry (${calibrated.executionSignal.entry}) within $1.50 of spot (${livePrice})`);
    assert(calibrated.executionSignal.riskReward >= 1.5, `Consensus R:R ${calibrated.executionSignal.riskReward}:1 >= 1.5`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Vision Atlas Blueprint Clamping
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Group 5: Vision Atlas Execution Blueprint');
  {
    const payload = visionAtlasEngine.generateAnalysisPayload('EUR/USD', '15m');
    const blueprint = payload.executionBlueprint;
    const spot = payload.telemetry.currentPrice;
    const entryVariancePips = Number((Math.abs(blueprint.recommendedEntry - spot) / 0.0001).toFixed(2));

    assert(entryVariancePips <= 3.5, `Vision Atlas variance ${entryVariancePips} pips <= 3.5 pips`);
    assert(blueprint.riskRewardRatio >= 1.5, `Vision Atlas R:R ${blueprint.riskRewardRatio}:1 >= 1.5`);
    assert(blueprint.hardStopLoss !== blueprint.recommendedEntry, 'Vision Atlas hard stop loss is separated from entry');
    assert(blueprint.takeProfit1 !== blueprint.recommendedEntry, 'Vision Atlas take profit 1 is separated from entry');
  }

  // -------------------------------------------------------------------------
  // TEST 6: Pre-Execution Atomic Verification
  // -------------------------------------------------------------------------
  console.log('\n📌 Test Group 6: Pre-Execution Atomic Verification');
  {
    const coordinator = new SwarmCoordinator();
    const consensus = coordinator.runConsensus('EUR/USD', '1h');
    const verification = preExecutionVerificationEngine.verifyAtomicTickExecution({
      consensus,
      accountBalance: 100000,
      freeMargin: 85000,
      proposedLots: 0.1,
    });
    assert(verification.action === 'DISPATCH_ORDER', 'Pre-execution gatekeeper approves DISPATCH_ORDER');
    assert(verification.isVerified === true, 'Pre-execution verification isVerified is true');
    assert(verification.slippagePips <= 3.5, `Pre-execution slippage clamped to ${verification.slippagePips} pips (<= 3.5 pips)`);
  }

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
