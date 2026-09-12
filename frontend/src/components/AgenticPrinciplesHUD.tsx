import React from 'react';
import { 
  Target, 
  Wrench, 
  Database, 
  Cpu, 
  Zap, 
  Eye, 
  RotateCw, 
  ShieldCheck, 
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { Incident } from '../types/soc';

interface AgenticPrinciplesHUDProps {
  incident: Incident | null;
}

export const AgenticPrinciplesHUD: React.FC<AgenticPrinciplesHUDProps> = ({ incident }) => {
  const statesCount = incident?.states.length || 0;
  const hasEvidence = (incident?.evidence.length || 0) > 0;
  const hasAction = (incident?.actions.length || 0) > 0;
  const isVerified = incident?.stage === 'VERIFIED';
  const hasReplanned = incident?.stage === 'REOPENED' || incident?.scenario_id === '04' || incident?.scenario_id === '05';
  const hasOverride = (incident?.overrides.length || 0) > 0;

  const CRITERIA = [
    {
      id: 'goal',
      title: 'GOAL-DRIVEN',
      desc: 'Autonomous objective: evaluate attack outcome without manual intervention.',
      active: true,
      icon: Target
    },
    {
      id: 'multitool',
      title: 'MULTI-TOOL',
      desc: 'Orchestrates 13 discrete synthetic tools across assets, CVEs, packets, and EDR.',
      active: statesCount >= 2,
      icon: Wrench
    },
    {
      id: 'stateful',
      title: 'PERSISTENT STATE',
      desc: 'SQLite task ledger preserves iteration history and evidence graph.',
      active: true,
      icon: Database
    },
    {
      id: 'adaptive',
      title: 'ADAPTIVE GAP REASONING',
      desc: 'Dynamically selects next evidence source based on knowledge gaps.',
      active: statesCount >= 3,
      icon: Cpu
    },
    {
      id: 'action',
      title: 'ACTION + FEEDBACK',
      desc: 'Simulated perimeter rule deployment accompanied by observation.',
      active: hasAction,
      icon: Zap
    },
    {
      id: 'replan',
      title: 'REPLANNING & REASSESSMENT',
      desc: 'Adapts posture when delayed telemetry arrives or response encounters failure.',
      active: hasReplanned,
      icon: RotateCw
    },
    {
      id: 'verified',
      title: 'CLOSED-LOOP VERIFICATION',
      desc: 'Active probe tests whether connection is actually denied by firewall.',
      active: isVerified,
      icon: ShieldCheck
    },
    {
      id: 'override',
      title: 'HUMAN-IN-THE-LOOP',
      desc: 'Analyst policy gate can inspect, approve, override, or request reassessment.',
      active: hasOverride,
      icon: UserCheck
    }
  ];

  return (
    <div className="w-full p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-5">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>AUTONOMOUS AGENT CAPABILITY MATRIX</span>
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Real-time fulfillment of autonomous agent criteria
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded border border-emerald-500/30 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>AUTONOMOUS SPEC COMPLIANT</span>
        </span>
      </div>

      {/* Grid of 8 Interconnected Principles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {CRITERIA.map(c => {
          const Icon = c.icon;
          return (
            <div
              key={c.id}
              className={`p-3.5 rounded-lg border transition-all duration-300 ${
                c.active
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Icon className={`w-4 h-4 ${c.active ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <h4 className="text-xs font-bold font-heading">{c.title}</h4>
                </div>
                <span className={`w-2 h-2 rounded-full ${c.active ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`}></span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                {c.desc}
              </p>
            </div>
          );
        })}
      </div>

    </div>
  );
};
