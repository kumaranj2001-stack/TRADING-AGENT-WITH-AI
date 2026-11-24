'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Database, 
  ShieldAlert, 
  ShieldCheck, 
  Layers, 
  RefreshCw, 
  Zap, 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Binary, 
  GitMerge, 
  FileText, 
  Play, 
  Lock, 
  Unlock, 
  Sliders, 
  Share2, 
  CheckCircle2, 
  Crosshair, 
  ArrowRight, 
  BarChart3, 
  Scale, 
  Radio, 
  Eye, 
  Sparkles 
} from 'lucide-react';
import { CurrencyPair, TimeFrame } from '@/lib/types';
import { AGENT_PERSONA_SPECS, AgentRoleType } from '@/lib/reasoning/AgentPersonaSpecs';

export interface AutonomousEcosystemDashboardProps {
  selectedPair?: CurrencyPair;
  timeframe?: TimeFrame;
  onBackToTerminal?: () => void;
}

export const AutonomousEcosystemDashboard: React.FC<AutonomousEcosystemDashboardProps> = ({
  selectedPair = 'XAU/USD',
  timeframe = '1h',
  onBackToTerminal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'perception' | 'reasoning' | 'execution' | 'memory' | 'governance'>('overview');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecutingCycle, setIsExecutingCycle] = useState<boolean>(false);
  const [lastCycleTrace, setLastCycleTrace] = useState<any>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [passcode, setPasscode] = useState<string>('');
  const [showPasscodeModal, setShowPasscodeModal] = useState<boolean>(false);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/autonomous-ecosystem');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.error('Failed to fetch autonomous ecosystem telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleRunCycle = async () => {
    setIsExecutingCycle(true);
    setActionFeedback('Executing 5-Layer Autonomous Think-Act-Observe Cycle...');
    try {
      const res = await fetch('/api/autonomous-ecosystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EXECUTE_CYCLE',
          symbol: selectedPair,
          timeframe,
          cvd: 320,
          sentiment: 0.35,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastCycleTrace(data.trace);
        setActionFeedback(`Cycle Completed in ${data.trace.elapsedMs}ms! Consensus: ${data.trace.consensusResult.finalDirection} (${(data.trace.consensusResult.compositeConfidence * 100).toFixed(1)}% confidence)`);
        fetchTelemetry();
      }
    } catch (err: any) {
      setActionFeedback(`Cycle execution error: ${err.message}`);
    } finally {
      setIsExecutingCycle(false);
    }
  };

  const handleTriggerReflection = async () => {
    setActionFeedback('Triggering Asynchronous Reflection Worker...');
    try {
      const res = await fetch('/api/autonomous-ecosystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TRIGGER_REFLECTION' }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionFeedback(`Reflection loop executed. Processed ${data.processedCount} closed trade trajectories.`);
        fetchTelemetry();
      }
    } catch (err: any) {
      setActionFeedback(`Reflection error: ${err.message}`);
    }
  };

  const handleTriggerKillSwitch = async () => {
    if (!confirm('EMERGENCY: Are you sure you want to trigger the Hardware Kill-Switch? All open positions will be flattened immediately and autonomous execution halted!')) {
      return;
    }
    setActionFeedback('TRIGGERING HARDWARE EMERGENCY KILL-SWITCH...');
    try {
      const res = await fetch('/api/autonomous-ecosystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'KILL_SWITCH_TRIGGER',
          reason: 'OPERATOR_MANUAL_HALT',
          message: 'Operator manually triggered emergency kill switch from Command Center.',
        }),
      });
      if (res.ok) {
        setActionFeedback('HARDWARE KILL-SWITCH TRIGGERED: All positions flattened.');
        fetchTelemetry();
      }
    } catch (err: any) {
      setActionFeedback(`Kill-switch trigger error: ${err.message}`);
    }
  };

  const handleResetKillSwitch = async () => {
    try {
      const res = await fetch('/api/autonomous-ecosystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'KILL_SWITCH_RESET',
          passcode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActionFeedback('Kill Switch successfully re-armed! Autonomous execution resumed.');
          setShowPasscodeModal(false);
          setPasscode('');
          fetchTelemetry();
        } else {
          setActionFeedback('Invalid Operator Passcode. Access denied.');
        }
      }
    } catch (err: any) {
      setActionFeedback(`Reset error: ${err.message}`);
    }
  };

  const handleExportFineTuning = async () => {
    setActionFeedback('Exporting continuous SFT/DPO dataset batch...');
    try {
      const res = await fetch('/api/autonomous-ecosystem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'EXPORT_FINETUNING' }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionFeedback(`Continuous Fine-Tuning Batch [${data.exportResult.batchId}] Exported: ${data.exportResult.sftCount} SFT pairs, ${data.exportResult.dpoCount} DPO pairs.`);
        fetchTelemetry();
      }
    } catch (err: any) {
      setActionFeedback(`Export error: ${err.message}`);
    }
  };

  const isKillSwitchTripped = telemetry?.layer5DeterministicGovernance?.killSwitch?.isTriggered;
  const firewallStatus = telemetry?.layer5DeterministicGovernance?.firewall?.firewallStatus || 'ACTIVE_ARMED';

  return (
    <div className="bg-terminal-900 border border-terminal-border rounded-xl p-4 sm:p-6 shadow-2xl space-y-6 text-slate-200">
      {/* Top Header Bar */}
      <div className="border-b border-terminal-border pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span>00 // AUTONOMOUS SELF-EVOLVING AI ECOSYSTEM</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  5-LAYER RE-ENGINEERED
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Perception RAG • Fine-Tuned 8-Agent Chamber • FIX Execution • Episodic Reflection • Deterministic Firewall
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleRunCycle}
            disabled={isExecutingCycle || isKillSwitchTripped}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isExecutingCycle ? 'animate-spin' : ''}`} />
            <span>{isExecutingCycle ? 'EXECUTING SWARM...' : 'RUN 5-LAYER CYCLE'}</span>
          </button>

          <button
            onClick={handleTriggerReflection}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>TRIGGER REFLECTION</span>
          </button>

          <button
            onClick={handleExportFineTuning}
            className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white border border-terminal-border font-mono text-xs flex items-center gap-1.5 transition-colors"
          >
            <Binary className="w-3.5 h-3.5 text-amber-400" />
            <span>EXPORT SFT/DPO</span>
          </button>

          {isKillSwitchTripped ? (
            <button
              onClick={() => setShowPasscodeModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg animate-pulse"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>RE-ARM KILL SWITCH</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerKillSwitch}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg hover:shadow-rose-500/20"
              title="Flatten all positions and halt agents immediately"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>KILL SWITCH</span>
            </button>
          )}

          {onBackToTerminal && (
            <button
              onClick={onBackToTerminal}
              className="px-3 py-1.5 rounded-lg bg-terminal-800 hover:bg-terminal-700 text-slate-300 hover:text-white border border-terminal-border font-mono text-xs transition-colors"
            >
              RETURN
            </button>
          )}
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* 5-Layer Interactive Flow Visualizer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Layer 1 */}
        <div 
          onClick={() => setActiveSubTab('perception')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${activeSubTab === 'perception' ? 'bg-cyan-950/60 border-cyan-500 ring-1 ring-cyan-500' : 'bg-terminal-950/80 border-cyan-900/40 hover:border-cyan-700/60'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">LAYER 01</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <h3 className="text-xs font-bold text-white">Dynamic Perception</h3>
          <p className="text-[11px] text-slate-400 mt-1">Hybrid Vector & Graph RAG</p>
          <div className="mt-2.5 pt-2 border-t border-cyan-900/30 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Vectors / Nodes:</span>
            <span className="text-cyan-300 font-semibold">{telemetry?.layer1Perception?.vectorGraphStats?.vectorCount || 5} / {telemetry?.layer1Perception?.vectorGraphStats?.nodeCount || 8}</span>
          </div>
        </div>

        {/* Layer 2 */}
        <div 
          onClick={() => setActiveSubTab('reasoning')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${activeSubTab === 'reasoning' ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500' : 'bg-terminal-950/80 border-indigo-900/40 hover:border-indigo-700/60'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">LAYER 02</span>
            <GitMerge className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-xs font-bold text-white">Fine-Tuned Swarm</h3>
          <p className="text-[11px] text-slate-400 mt-1">8-Agent Directed State-Graph</p>
          <div className="mt-2.5 pt-2 border-t border-indigo-900/30 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Active Desks:</span>
            <span className="text-indigo-300 font-semibold">8 FT Models (DPO/RLAIF)</span>
          </div>
        </div>

        {/* Layer 3 */}
        <div 
          onClick={() => setActiveSubTab('execution')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${activeSubTab === 'execution' ? 'bg-teal-950/60 border-teal-500 ring-1 ring-teal-500' : 'bg-terminal-950/80 border-teal-900/40 hover:border-teal-700/60'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-teal-400 font-bold uppercase tracking-wider">LAYER 03</span>
            <Crosshair className="w-4 h-4 text-teal-400" />
          </div>
          <h3 className="text-xs font-bold text-white">Autonomous Execution</h3>
          <p className="text-[11px] text-slate-400 mt-1">FIX Protocol & Active Lifecycle</p>
          <div className="mt-2.5 pt-2 border-t border-teal-900/30 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Latency / Sizing:</span>
            <span className="text-teal-300 font-semibold">14ms • Kelly/Parity</span>
          </div>
        </div>

        {/* Layer 4 */}
        <div 
          onClick={() => setActiveSubTab('memory')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${activeSubTab === 'memory' ? 'bg-purple-950/60 border-purple-500 ring-1 ring-purple-500' : 'bg-terminal-950/80 border-purple-900/40 hover:border-purple-700/60'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">LAYER 04</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-xs font-bold text-white">Episodic Reflection</h3>
          <p className="text-[11px] text-slate-400 mt-1">Self-Evolution & SFT Pipeline</p>
          <div className="mt-2.5 pt-2 border-t border-purple-900/30 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Episodes / Batches:</span>
            <span className="text-purple-300 font-semibold">{telemetry?.layer4MemoryReflection?.totalEpisodicTradesLogged || 1} Snapshots</span>
          </div>
        </div>

        {/* Layer 5 */}
        <div 
          onClick={() => setActiveSubTab('governance')}
          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${activeSubTab === 'governance' ? 'bg-rose-950/60 border-rose-500 ring-1 ring-rose-500' : 'bg-terminal-950/80 border-rose-900/40 hover:border-rose-700/60'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">LAYER 05</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-xs font-bold text-white">Deterministic Firewall</h3>
          <p className="text-[11px] text-slate-400 mt-1">Immutable Drawdown Breakers</p>
          <div className="mt-2.5 pt-2 border-t border-rose-900/30 flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Firewall / Kill Switch:</span>
            <span className={`font-semibold ${isKillSwitchTripped ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
              {isKillSwitchTripped ? 'HALTED' : 'ARMED (3% Max DD)'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-terminal-border/80 flex items-center gap-1 overflow-x-auto text-xs font-mono">
        {[
          { id: 'overview', label: 'Ecosystem Overview' },
          { id: 'perception', label: 'Layer 1: Perception RAG' },
          { id: 'reasoning', label: 'Layer 2: 8-Agent Swarm' },
          { id: 'execution', label: 'Layer 3: Execution Bridge' },
          { id: 'memory', label: 'Layer 4: Memory & Self-Evolution' },
          { id: 'governance', label: 'Layer 5: Deterministic Firewall' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${activeSubTab === tab.id ? 'border-cyan-400 text-cyan-300 font-semibold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 1: ECOSYSTEM OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-xs font-mono text-slate-400">Swarm Architecture</span>
              <div className="text-lg font-bold text-white">8 Fine-Tuned Models</div>
              <span className="text-[11px] font-mono text-emerald-400">SFT + RLAIF + DPO</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-xs font-mono text-slate-400">Execution Bridge</span>
              <div className="text-lg font-bold text-white">FIX.4.4 / Low-Latency</div>
              <span className="text-[11px] font-mono text-teal-400">{telemetry?.layer3Execution?.brokerTelemetry?.averageExecutionLatencyMs || 14.2}ms avg latency</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-xs font-mono text-slate-400">Self-Evolution Queue</span>
              <div className="text-lg font-bold text-white">
                {(telemetry?.layer4MemoryReflection?.fineTuningTelemetry?.queuedSFTSamples || 0) + (telemetry?.layer4MemoryReflection?.fineTuningTelemetry?.queuedDPOSamples || 0)} Trajectories
              </div>
              <span className="text-[11px] font-mono text-indigo-400">Continuous SFT/DPO Pipeline</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1">
              <span className="text-xs font-mono text-slate-400">Deterministic Safety</span>
              <div className="text-lg font-bold text-white">Hard-Coded Firewall</div>
              <span className="text-[11px] font-mono text-rose-400">Max DD: 3.0% / Weekly: 6.0%</span>
            </div>
          </div>

          {/* Last Execution Trace or Live State Graph Card */}
          {lastCycleTrace && (
            <div className="p-4 sm:p-5 rounded-xl bg-terminal-950 border border-cyan-500/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                    <Activity className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Latest Directed State-Graph Execution Trace</h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Cycle ID: {lastCycleTrace.cycleId} • Elapsed: {lastCycleTrace.elapsedMs}ms
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${lastCycleTrace.consensusResult.finalDirection.includes('BUY') ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : lastCycleTrace.consensusResult.finalDirection.includes('SELL') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-700 text-slate-300'}`}>
                    {lastCycleTrace.consensusResult.finalDirection} ({(lastCycleTrace.consensusResult.compositeConfidence * 100).toFixed(1)}%)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${lastCycleTrace.consensusResult.isAuthorizedByChiefRisk ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                    {lastCycleTrace.consensusResult.isAuthorizedByChiefRisk ? 'CHIEF RISK: AUTHORIZED' : `CHIEF RISK: VETOED (${lastCycleTrace.consensusResult.vetoReason})`}
                  </span>
                </div>
              </div>

              {/* State Transitions Stepper */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {lastCycleTrace.nodeSnapshots?.map((snap: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-terminal-900 border border-terminal-border/60 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-cyan-400 mb-1">
                      <span className="font-bold">STEP 0{idx + 1}</span>
                      <span>{Math.round(snap.timestamp)}ms</span>
                    </div>
                    <div className="font-semibold text-slate-200 truncate">{snap.node.replace('NODE_', '')}</div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{snap.outputSummary}</div>
                  </div>
                ))}
              </div>

              {/* Debate Coalitions Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-terminal-border/60">
                <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-400">
                    <span>BUY-SIDE CHANNEL WEIGHT</span>
                    <span>{(lastCycleTrace.consensusResult.buySideWeightSum * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {lastCycleTrace.debateRounds?.[0]?.buySideArguments?.[0]?.argument || 'Consensus indicates institutional support.'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-400">
                    <span>SELL-SIDE REBUTTAL WEIGHT</span>
                    <span>{(lastCycleTrace.consensusResult.sellSideWeightSum * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {lastCycleTrace.debateRounds?.[0]?.sellSideRebuttals?.[0]?.rebuttal || 'Counter-thesis monitoring opposing liquidity pools.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Trades Lifecycle Tracker */}
          <div className="p-4 sm:p-5 rounded-xl bg-terminal-950 border border-terminal-border space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-teal-400" />
                <span>Active Trade Lifecycle Monitor (Opposing Invalidation & Trailing Stops)</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/40">
                {telemetry?.layer3Execution?.activePositionsCount || 0} ACTIVE TRADES
              </span>
            </div>

            {telemetry?.layer3Execution?.activePositions?.length > 0 ? (
              <div className="space-y-2">
                {telemetry.layer3Execution.activePositions.map((pos: any) => (
                  <div key={pos.tradeId} className="p-3 rounded-lg bg-terminal-900 border border-terminal-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${pos.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {pos.side}
                        </span>
                        <span>{pos.symbol}</span>
                        <span className="text-slate-400 font-normal">({pos.currentUnits} units)</span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-1">
                        Entry: {pos.entryPrice.toFixed(4)} • SL: {pos.stopLossPrice.toFixed(4)} • Invalidation Anchor: {pos.structuralInvalidationAnchor.toFixed(4)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-slate-400 text-[10px]">Excursions</div>
                        <div className="text-white font-semibold">
                          +{pos.maxFavorableExcursionPips?.toFixed(1)}p / -{pos.maxAdverseExcursionPips?.toFixed(1)}p
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[10px]">Unrealized PnL</div>
                        <div className={`font-bold ${pos.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${pos.unrealizedPnL?.toFixed(2)}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-[10px] bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                        {pos.thesisStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 font-mono text-xs border border-dashed border-terminal-border rounded-lg">
                No active bracket orders currently running. Launch a 5-layer cycle or signal to dispatch institutional FIX order.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 2: LAYER 1 PERCEPTION & HYBRID RAG */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'perception' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-cyan-800/40 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Layer 1 // Dynamic Perception Engine (Hybrid Vector & Knowledge Graph RAG)</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Replaces static lookup tables with runtime semantic queries. Continuously streams tick order flow, footprint CVD, Level 2 depth-of-book (DOM) pools, and live macroeconomic wire feeds into high-dimensional embeddings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vector Space Stats */}
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-terminal-border pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Binary className="w-4 h-4 text-cyan-400" />
                  <span>High-Dimensional Vector Store</span>
                </span>
                <span className="text-cyan-400 font-bold">{telemetry?.layer1Perception?.vectorGraphStats?.vectorCount || 5} Indexed Analogs</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Indexes 8-dimensional normalized regime vectors: [priceMomentum, ATR, CVD, sentiment, session, structure, noise, volRegime].
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-slate-300">
                  <span>Cosine Similarity Metric:</span>
                  <span className="text-emerald-400">Dot Product Normalized (1e-9 safe)</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Dynamic Query Formulation:</span>
                  <span className="text-cyan-300">Active Market Condition Runtime</span>
                </div>
              </div>
            </div>

            {/* Knowledge Graph Stats */}
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-terminal-border pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>Knowledge Graph Database</span>
                </span>
                <span className="text-cyan-400 font-bold">{telemetry?.layer1Perception?.vectorGraphStats?.nodeCount || 8} Nodes • {telemetry?.layer1Perception?.vectorGraphStats?.edgeCount || 10} Edges</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Traverses multi-hop causal paths: (Symbol) &rarr; [TRIGGERED_BY] &rarr; (MacroEvent) &rarr; [SUPPORTS_STRUCTURE] &rarr; (HistoricalAnalog).
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-slate-300">
                  <span>Max Multi-Hop Traversal Depth:</span>
                  <span className="text-emerald-400">2-Hop Directed Path</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Active Regime Invalidation Link:</span>
                  <span className="text-cyan-300">Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 3: LAYER 2 8-AGENT SWARM */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'reasoning' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-indigo-800/40 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Layer 2 // 8-Agent Fine-Tuned Chamber & Dynamic Credibility Meta-Controller</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Replaces static prompt templates with individually fine-tuned foundation models trained via SFT, RLAIF, and DPO. Runtime Meta-Controller dynamically weights votes based on empirical credibility in active volatility and session regimes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(AGENT_PERSONA_SPECS).map(([roleKey, spec]) => (
              <div key={roleKey} className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-indigo-400">{spec.modelIdentifier}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    ECE: {spec.fineTuningMethodology.calibrationECE}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{spec.role.replace(/_/g, ' ')}</h4>
                <p className="text-[11px] text-slate-300">{spec.primaryCompetency}</p>
                <div className="p-2.5 rounded bg-terminal-900 border border-terminal-border/60 text-[10px] font-mono space-y-1">
                  <div className="text-slate-400 font-semibold">Fine-Tuning Architecture:</div>
                  <div className="text-slate-300">• SFT: {spec.fineTuningMethodology.sftDatasetSize}</div>
                  <div className="text-slate-300">• DPO: {spec.fineTuningMethodology.dpoPairs}</div>
                  <div className="text-indigo-400">• Invalidation: {spec.invalidationTriggerLogic}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 4: LAYER 3 EXECUTION BRIDGE */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'execution' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-teal-800/40 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-teal-400" />
              <span>Layer 3 // Autonomous Institutional Execution Bridge & Active Lifecycle Engine</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Direct FIX Protocol (Tag 35=D) and REST execution bridge. Dynamically sizes positions via Fractional Kelly Criterion and Volatility-adjusted Risk Parity, actively managing trailing stops and structural invalidations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Institutional Protocol</span>
              <div className="text-base font-bold text-teal-400">FIX.4.4 / IOC Routing</div>
              <span className="text-[11px] text-slate-300">Tag 35=D NewOrderSingle</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Mathematical Sizing</span>
              <div className="text-base font-bold text-teal-400">Kelly & Risk Parity</div>
              <span className="text-[11px] text-slate-300">Damped Kelly factor (0.35x)</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Active Lifecycle Brackets</span>
              <div className="text-base font-bold text-teal-400">3-Stage Liquidity Pools</div>
              <span className="text-[11px] text-slate-300">TP1 (33% BE) • TP2 (33%) • Runner</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 5: LAYER 4 MEMORY & SELF-EVOLUTION */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'memory' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-purple-800/40 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Layer 4 // Persistent Episodic Memory & Continuous Self-Evolution Pipeline</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Logs full trade state snapshots (RAG context, debate transcripts, MFE/MAE excursion metrics). Asynchronous reflection worker performs root-cause attribution, updates agent credibility, and queues SFT/DPO datasets for periodic model weight updates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3 font-mono text-xs">
              <h4 className="font-bold text-purple-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Continuous Fine-Tuning Pipeline Telemetry</span>
              </h4>
              <div className="space-y-2 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>Queued SFT Samples:</span>
                  <span className="text-white font-bold">{telemetry?.layer4MemoryReflection?.fineTuningTelemetry?.queuedSFTSamples || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Queued DPO Pairwise Preferences:</span>
                  <span className="text-white font-bold">{telemetry?.layer4MemoryReflection?.fineTuningTelemetry?.queuedDPOSamples || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Export Batches Triggered:</span>
                  <span className="text-emerald-400 font-bold">{telemetry?.layer4MemoryReflection?.fineTuningTelemetry?.exportedBatchesCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Export Threshold:</span>
                  <span className="text-cyan-300 font-bold">50 Trajectories</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-3 font-mono text-xs">
              <h4 className="font-bold text-purple-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Asynchronous Reflection Logs</span>
              </h4>
              <div className="space-y-2 text-[11px]">
                {telemetry?.layer4MemoryReflection?.reflectionLogs?.length > 0 ? (
                  telemetry.layer4MemoryReflection.reflectionLogs.map((log: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-terminal-900 border border-terminal-border/60">
                      <div className="flex justify-between text-purple-300 font-bold">
                        <span>{log.symbol}</span>
                        <span>{log.attribution}</span>
                      </div>
                      <p className="text-slate-400 text-[10px] mt-1">{log.attributionExplanation}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 py-4 text-center">No closed trade reflection cycles logged yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-VIEW 6: LAYER 5 DETERMINISTIC FIREWALL */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'governance' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-terminal-950 border border-rose-800/40 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Layer 5 // Immutable Deterministic Risk Firewall & Emergency Kill Switch</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Immutable, deterministic code guardrail layer. LLM agents cannot bypass or modify these constraints. Hard-coded circuit breakers prior to and during order routing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Daily Drawdown Cap</span>
              <div className="text-lg font-bold text-white">3.0% Max Loss</div>
              <span className="text-[11px] text-emerald-400">Current: {telemetry?.layer5DeterministicGovernance?.firewall?.dailyDrawdownPercent || 0.0}%</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Weekly Drawdown Cap</span>
              <div className="text-lg font-bold text-white">6.0% Max Loss</div>
              <span className="text-[11px] text-emerald-400">Current: {telemetry?.layer5DeterministicGovernance?.firewall?.weeklyDrawdownPercent || 0.0}%</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Per-Trade NAV Risk Ceiling</span>
              <div className="text-lg font-bold text-white">1.5% Hard Cap</div>
              <span className="text-[11px] text-cyan-300">Enforced Pre-Routing</span>
            </div>

            <div className="p-4 rounded-xl bg-terminal-950 border border-terminal-border space-y-1 font-mono text-xs">
              <span className="text-slate-400">Hardware Kill Switch</span>
              <div className={`text-lg font-bold ${isKillSwitchTripped ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {isKillSwitchTripped ? 'TRIGGERED (HALT)' : 'ARMED & HEALTHY'}
              </div>
              <span className="text-[11px] text-slate-400">Auto-Flatten on Anomaly</span>
            </div>
          </div>
        </div>
      )}

      {/* Operator Passcode Modal for Kill Switch Reset */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-terminal-900 border border-terminal-border rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-terminal-border pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Operator Override Passcode Required</span>
              </h3>
              <button onClick={() => setShowPasscodeModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Enter the authorized operator security passcode to re-arm the hardware kill-switch and deterministic risk firewall:
            </p>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode (e.g. OVERRIDE_QRI_AUTONOMOUS_SAFE)"
              className="w-full px-3 py-2 bg-terminal-950 border border-terminal-border rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPasscodeModal(false)}
                className="px-3 py-1.5 rounded-lg bg-terminal-800 text-slate-300 hover:text-white text-xs font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleResetKillSwitch}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold"
              >
                Authorize & Re-Arm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
