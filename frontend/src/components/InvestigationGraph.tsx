import React from 'react';
import { 
  AlertTriangle, 
  Server, 
  ShieldAlert, 
  Cpu, 
  FileSearch, 
  GitMerge, 
  CheckCircle, 
  Lock, 
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Incident } from '../types/soc';

interface InvestigationGraphProps {
  incident: Incident | null;
}

export const InvestigationGraph: React.FC<InvestigationGraphProps> = ({ incident }) => {
  const evidenceCategories = incident?.evidence.map(e => e.category) || [];
  const hasAsset = evidenceCategories.includes('ASSET');
  const hasVuln = evidenceCategories.includes('VULNERABILITY');
  const hasPacket = evidenceCategories.includes('NETWORK');
  const hasServer = evidenceCategories.includes('SERVER');

  const hasCorrelation = incident?.stage === 'CORRELATING' || incident?.stage === 'ASSESSED' || incident?.stage === 'RESPONDING' || incident?.stage === 'VERIFIED' || incident?.stage === 'CLOSED' || incident?.stage === 'OVERRIDDEN';
  const hasAssessment = incident?.current_assessment && incident?.current_assessment !== 'UNCERTAIN';
  const hasResponse = incident?.stage === 'RESPONDING' || incident?.stage === 'VERIFIED' || incident?.stage === 'RESPONSE_FAILED';
  const hasVerified = incident?.stage === 'VERIFIED';

  const getNodeState = (isDone: boolean, isActive: boolean) => {
    if (isDone) {
      return {
        bg: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
        status: 'CONFIRMED',
        statusIcon: CheckCircle2,
        statusColor: 'text-emerald-400'
      };
    }
    if (isActive) {
      return {
        bg: 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] animate-pulse',
        status: 'ANALYZING',
        statusIcon: Cpu,
        statusColor: 'text-cyan-400'
      };
    }
    return {
      bg: 'bg-slate-900/60 border-slate-700/60 text-slate-500',
      status: 'PENDING',
      statusIcon: HelpCircle,
      statusColor: 'text-slate-600'
    };
  };

  const assetState = getNodeState(hasAsset, incident?.stage === 'INVESTIGATING' && !hasAsset);
  const vulnState = getNodeState(hasVuln, hasAsset && !hasVuln);
  const packetState = getNodeState(hasPacket, hasAsset && !hasPacket);
  const serverState = getNodeState(hasServer, hasAsset && !hasServer);
  const corrState = getNodeState(hasCorrelation, hasAsset && hasVuln && hasPacket && hasServer && !hasCorrelation);
  const assessState = getNodeState(Boolean(hasAssessment), hasCorrelation && !hasAssessment);
  const respState = getNodeState(Boolean(hasResponse), incident?.stage === 'ASSESSED' && incident?.current_assessment === 'ATTACK_VERIFIED');
  const verifyState = getNodeState(Boolean(hasVerified), hasResponse && !hasVerified);

  return (
    <div className="w-full p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-cyan-500/20">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading flex items-center space-x-2">
            <GitMerge className="w-4 h-4 text-cyan-400" />
            <span>AUTONOMOUS INVESTIGATION & CORRELATION DAG</span>
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Dynamic evidence acquisition graph & causal dependency chain
          </p>
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            <span>PENDING</span>
          </span>
          <span className="flex items-center space-x-1.5 text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>ANALYZING</span>
          </span>
          <span className="flex items-center space-x-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>CONFIRMED</span>
          </span>
        </div>
      </div>

      {/* DAG Visualization */}
      <div className="flex flex-col items-center space-y-5 relative">

        {/* Level 1: NIDS Alert */}
        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-3 px-5 py-2.5 rounded-lg border bg-rose-950/80 border-rose-500/70 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            <div className="text-left">
              <span className="text-[10px] font-mono text-rose-400 block tracking-widest font-bold">STAGE 01</span>
              <span className="text-xs font-heading font-bold">{incident?.alert?.signature || 'NIDS SURICATA INTRUSION ALERT'}</span>
            </div>
          </div>
          <div className="w-0.5 h-6 bg-cyan-500/40 my-0.5"></div>
        </div>

        {/* Level 2: Target Asset */}
        <div className="flex flex-col items-center">
          <div className={`flex items-center space-x-3 px-5 py-2.5 rounded-lg border ${assetState.bg} transition-all duration-300`}>
            <Server className="w-4 h-4" />
            <div className="text-left">
              <span className="text-[10px] font-mono block tracking-widest font-bold">ASSET RESOLUTION</span>
              <span className="text-xs font-heading font-bold">{incident?.target_asset_ip || 'web-server-01 (10.0.0.10:8080)'}</span>
            </div>
            <assetState.statusIcon className={`w-3.5 h-3.5 ${assetState.statusColor}`} />
          </div>
          <div className="w-0.5 h-6 bg-cyan-500/40 my-0.5"></div>
        </div>

        {/* Level 3: Three parallel evidence branches (CVE, Packet, Logs) */}
        <div className="w-full max-w-2xl relative flex flex-col items-center">
          {/* Connector branching line */}
          <div className="w-4/5 h-0.5 bg-cyan-500/40 mb-3"></div>

          <div className="grid grid-cols-3 gap-4 w-full">
            
            {/* CVE Node */}
            <div className={`p-3 rounded-lg border ${vulnState.bg} flex flex-col justify-between transition-all duration-300`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold">CVE MATCH</span>
                <vulnState.statusIcon className={`w-3.5 h-3.5 ${vulnState.statusColor}`} />
              </div>
              <p className="text-xs font-heading font-bold truncate">Vulnerability KB</p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {hasVuln ? 'CVE-2017-5638 verified' : 'Vulnerability unresolved'}
              </p>
            </div>

            {/* Packet Metadata Node */}
            <div className={`p-3 rounded-lg border ${packetState.bg} flex flex-col justify-between transition-all duration-300`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold">DPI PACKETS</span>
                <packetState.statusIcon className={`w-3.5 h-3.5 ${packetState.statusColor}`} />
              </div>
              <p className="text-xs font-heading font-bold truncate">Payload Inspection</p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {hasPacket ? 'Weaponized OGNL syntax' : 'Exploit delivery unverified'}
              </p>
            </div>

            {/* Server Logs Node */}
            <div className={`p-3 rounded-lg border ${serverState.bg} flex flex-col justify-between transition-all duration-300`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold">HOST LOGS</span>
                <serverState.statusIcon className={`w-3.5 h-3.5 ${serverState.statusColor}`} />
              </div>
              <p className="text-xs font-heading font-bold truncate">EDR & Process Tree</p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                {hasServer ? 'Execution telemetry verified' : 'Host execution missing'}
              </p>
            </div>

          </div>

          {/* Connector merge line */}
          <div className="w-4/5 h-0.5 bg-cyan-500/40 mt-3"></div>
          <div className="w-0.5 h-6 bg-cyan-500/40 my-0.5"></div>
        </div>

        {/* Level 4: Correlation & Assessment */}
        <div className="flex items-center space-x-4">
          
          <div className={`flex items-center space-x-3 px-5 py-2.5 rounded-lg border ${corrState.bg} transition-all duration-300`}>
            <GitMerge className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <span className="text-[10px] font-mono block tracking-widest font-bold">MULTI-SOURCE</span>
              <span className="text-xs font-heading font-bold">CORRELATION</span>
            </div>
            <corrState.statusIcon className={`w-3.5 h-3.5 ${corrState.statusColor}`} />
          </div>

          <div className="text-cyan-500 font-mono text-sm">&rarr;</div>

          <div className={`flex items-center space-x-3 px-5 py-2.5 rounded-lg border ${assessState.bg} transition-all duration-300`}>
            <Cpu className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <span className="text-[10px] font-mono block tracking-widest font-bold">DECISION VERDICT</span>
              <span className="text-xs font-heading font-bold">{incident?.current_assessment || 'ASSESSMENT PENDING'}</span>
            </div>
            <assessState.statusIcon className={`w-3.5 h-3.5 ${assessState.statusColor}`} />
          </div>

        </div>

        <div className="w-0.5 h-6 bg-cyan-500/40 my-0.5"></div>

        {/* Level 5: Response & Verify */}
        <div className="flex items-center space-x-4">
          
          <div className={`flex items-center space-x-3 px-5 py-2.5 rounded-lg border ${respState.bg} transition-all duration-300`}>
            <Lock className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <span className="text-[10px] font-mono block tracking-widest font-bold">ACTION EXECUTION</span>
              <span className="text-xs font-heading font-bold">BLOCK {incident?.attacker_ip || '10.0.0.25'}</span>
            </div>
            <respState.statusIcon className={`w-3.5 h-3.5 ${respState.statusColor}`} />
          </div>

          <div className="text-cyan-500 font-mono text-sm">&rarr;</div>

          <div className={`flex items-center space-x-3 px-5 py-2.5 rounded-lg border ${verifyState.bg} transition-all duration-300`}>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <span className="text-[10px] font-mono block tracking-widest font-bold">ACTIVE PROBE</span>
              <span className="text-xs font-heading font-bold">RESPONSE VERIFIED</span>
            </div>
            <verifyState.statusIcon className={`w-3.5 h-3.5 ${verifyState.statusColor}`} />
          </div>

        </div>

      </div>

    </div>
  );
};
