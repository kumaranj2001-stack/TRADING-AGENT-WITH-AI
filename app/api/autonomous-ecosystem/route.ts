import { NextRequest, NextResponse } from 'next/server';
import { marketVectorGraphStore } from '@/lib/perception/MarketVectorGraphStore';
import { agenticHybridRAGEngine } from '@/lib/perception/AgenticHybridRAG';
import { metaControllerCredibilityEngine } from '@/lib/reasoning/MetaControllerCredibility';
import { AGENT_PERSONA_SPECS } from '@/lib/reasoning/AgentPersonaSpecs';
import { directedStateGraphOrchestrator } from '@/lib/reasoning/DirectedStateGraphOrchestrator';
import { institutionalBrokerBridge } from '@/lib/execution/InstitutionalBrokerBridge';
import { autonomousSizingEngine } from '@/lib/execution/AutonomousSizingEngine';
import { activeTradeLifecycleManager } from '@/lib/execution/ActiveTradeLifecycleManager';
import { episodicMemoryStore } from '@/lib/memory/EpisodicMemoryStore';
import { asynchronousReflectionAgent } from '@/lib/memory/AsynchronousReflectionAgent';
import { continuousFineTuningPipeline } from '@/lib/memory/ContinuousFineTuningPipeline';
import { deterministicRiskFirewall } from '@/lib/governance/DeterministicRiskFirewall';
import { hardwareKillSwitch } from '@/lib/governance/HardwareKillSwitch';
import { generateCandles } from '@/lib/marketData';
import { CurrencyPair, TimeFrame } from '@/lib/types';

export async function GET() {
  try {
    const perceptionStats = marketVectorGraphStore.getStats();
    const credibilityProfiles = metaControllerCredibilityEngine.getAllProfiles();
    const brokerTelemetry = institutionalBrokerBridge.getTelemetry();
    const activePositions = activeTradeLifecycleManager.getActivePositions();
    const lifecycleLogs = activeTradeLifecycleManager.getLifecycleLogs(10);
    const reflectionLogs = asynchronousReflectionAgent.getReflectionLogs(10);
    const fineTuningTelemetry = continuousFineTuningPipeline.getTelemetry();
    const recentSFT = continuousFineTuningPipeline.getRecentSFTSamples(3);
    const recentDPO = continuousFineTuningPipeline.getRecentDPOSamples(3);
    const firewallTelemetry = deterministicRiskFirewall.getSecurityTelemetry();
    const killSwitchStatus = hardwareKillSwitch.getStatus();
    const episodicCount = episodicMemoryStore.getAllSnapshots().length;

    return NextResponse.json({
      status: 'ONLINE',
      timestamp: Date.now(),
      ecosystemVersion: '5.0.0-AUTONOMOUS-EVOLVING',
      layer1Perception: {
        vectorGraphStats: perceptionStats,
        recentMacroWiresCount: marketVectorGraphStore.getRecentMacroWires(5).length,
      },
      layer2Reasoning: {
        agentCount: Object.keys(AGENT_PERSONA_SPECS).length,
        personas: AGENT_PERSONA_SPECS,
        credibilityProfiles,
      },
      layer3Execution: {
        brokerTelemetry,
        activePositionsCount: activePositions.length,
        activePositions,
        recentLifecycleLogs: lifecycleLogs,
      },
      layer4MemoryReflection: {
        totalEpisodicTradesLogged: episodicCount,
        reflectionLogs,
        fineTuningTelemetry,
        sampleSFTTrajectores: recentSFT,
        sampleDPOTrajectories: recentDPO,
      },
      layer5DeterministicGovernance: {
        firewall: firewallTelemetry,
        killSwitch: killSwitchStatus,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch ecosystem telemetry' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'EXECUTE_CYCLE': {
        const symbol: CurrencyPair = body.symbol || 'XAU/USD';
        const timeframe: TimeFrame = body.timeframe || '1h';
        const candles = generateCandles(symbol, timeframe, 60);
        const currentPrice = candles[candles.length - 1].close;

        const trace = await directedStateGraphOrchestrator.executeCycle(
          symbol,
          timeframe,
          candles,
          currentPrice,
          body.cvd || 150,
          body.sentiment || 0.2
        );

        return NextResponse.json({ success: true, trace });
      }

      case 'TRIGGER_REFLECTION': {
        const processedCount = await asynchronousReflectionAgent.runBackgroundWorkerCycle();
        return NextResponse.json({
          success: true,
          processedCount,
          logs: asynchronousReflectionAgent.getReflectionLogs(5),
        });
      }

      case 'KILL_SWITCH_TRIGGER': {
        const reason = body.reason || 'OPERATOR_MANUAL_HALT';
        const message = body.message || 'Operator triggered manual hardware kill switch override.';
        const status = await hardwareKillSwitch.triggerKillSwitch(reason, message);
        return NextResponse.json({ success: true, status });
      }

      case 'KILL_SWITCH_RESET': {
        const passcode = body.passcode || '';
        const success = hardwareKillSwitch.operatorReset(passcode);
        return NextResponse.json({ success, status: hardwareKillSwitch.getStatus() });
      }

      case 'EXPORT_FINETUNING': {
        const exportResult = continuousFineTuningPipeline.triggerBatchExport();
        return NextResponse.json({ success: true, exportResult });
      }

      case 'ORDER_PRECHECK': {
        const order = body.order;
        const equity = body.equity || 100000;
        const freeMargin = body.freeMargin || 90000;
        const riskDollars = body.riskDollars || 1000;
        const spread = body.spread || 0.8;
        const latency = body.latency || 15;

        const verification = deterministicRiskFirewall.verifyOrderPreRouting(
          order,
          equity,
          freeMargin,
          riskDollars,
          spread,
          latency
        );

        return NextResponse.json({ success: true, verification });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
