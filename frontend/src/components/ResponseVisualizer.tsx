import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCw, 
  Lock, 
  Terminal,
  Activity
} from 'lucide-react';
import { Incident, ActionRecord } from '../types/soc';
import { soundFx } from '../utils/audio';

interface ResponseVisualizerProps {
  incident: Incident | null;
  onExecuteResponse: (retry?: boolean) => void;
  isLoading: boolean;
}

export const ResponseVisualizer: React.FC<ResponseVisualizerProps> = ({
  incident,
  onExecuteResponse,
  isLoading
}) => {
  const actions = incident?.actions || [];
  const latestAction = actions[actions.length - 1];

  const isVerified = incident?.stage === 'VERIFIED';
  const isFailed = incident?.stage === 'RESPONSE_FAILED' || incident?.stage === 'VERIFICATION_FAILED';
  const isOverridden = incident?.stage === 'OVERRIDDEN';
  const isResponding = incident?.stage === 'RESPONDING';

  return (
    <div className="w-full p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-6">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading flex items-center space-x-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>SIMULATED FIREWALL RESPONSE & ACTIVE VERIFICATION</span>
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Perimeter rule deployment with closed-loop synthetic probe verification
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-500">ENGINE:</span>
          <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-500/30">
            SIMULATED PERIMETER EDGE-01
          </span>
        </div>
      </div>

      {/* Verification Sequence Display */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 text-xs font-mono">
        
        {/* Step 1: Decision */}
        <div className="p-3.5 rounded-lg bg-slate-900/80 border border-cyan-500/20">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>STEP 01</span>
            <span className="text-cyan-400 font-bold">PROPOSAL</span>
          </div>
          <p className="text-slate-200 font-bold">
            BLOCK {incident?.attacker_ip || '10.0.0.25'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Action justified by 94% exploit correlation.
          </p>
        </div>

        {/* Step 2: Firewall Deployment */}
        <div className={`p-3.5 rounded-lg border transition-all duration-300 ${
          isFailed 
            ? 'bg-red-950/40 border-red-500/50 text-red-300' 
            : actions.length > 0 
            ? 'bg-slate-900/80 border-cyan-500/20 text-slate-200' 
            : 'bg-slate-950/50 border-slate-800 text-slate-600'
        }`}>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span>STEP 02</span>
            <span className="font-bold">{isFailed ? 'FAILED' : 'DEPLOYMENT'}</span>
          </div>
          <p className="font-bold">
            {isFailed ? 'EDGE TIMEOUT (504)' : 'PERIMETER RULE DEPLOYED'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {isFailed ? 'Primary edge agent timed out. Replanning required.' : 'Target IP added to DROP chain.'}
          </p>
        </div>

        {/* Step 3: Active Verification Probe */}
        <div className={`p-3.5 rounded-lg border transition-all duration-300 ${
          isVerified
            ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
            : isFailed
            ? 'bg-red-950/40 border-red-500/50 text-red-300'
            : 'bg-slate-950/50 border-slate-800 text-slate-600'
        }`}>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span>STEP 03</span>
            <span className="font-bold">ACTIVE PROBE</span>
          </div>
          <p className="font-bold">
            {isVerified ? 'SYN PROBE DENIED' : isFailed ? 'PROBE UNVERIFIED' : 'AWAITING PROBE'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Synthetic test packet sent from source to target.
          </p>
        </div>

        {/* Step 4: Outcome */}
        <div className={`p-3.5 rounded-lg border transition-all duration-300 ${
          isVerified
            ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
            : isOverridden
            ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
            : isFailed
            ? 'bg-red-950/60 border-red-500/60 text-red-300'
            : 'bg-slate-950/50 border-slate-800 text-slate-600'
        }`}>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span>FINAL STATE</span>
            {isVerified ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
          </div>
          <p className="font-bold font-heading text-sm">
            {isVerified ? 'RESPONSE VERIFIED' : isOverridden ? 'OVERRIDDEN' : isFailed ? 'RETRY REQUIRED' : 'PENDING'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {isVerified ? 'Closed-loop verification confirmed threat neutralized.' : isOverridden ? 'Action withheld by analyst policy.' : 'Awaiting enforcement.'}
          </p>
        </div>

      </div>

      {/* Failure & Replanning Demonstration Banner */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/40 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-red-300 text-xs font-mono">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-red-200">
                ACTION OBSERVATION & REPLANNING CYCLE:
              </p>
              <p className="text-slate-300 text-[11px]">
                Initial perimeter rule timed out. Agent observes failure, updates task state, and initiates retry on secondary perimeter gateway.
              </p>
            </div>
          </div>

          <button
            disabled={isLoading}
            onClick={() => {
              soundFx.alert();
              onExecuteResponse(true); // force_retry = true
            }}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500 text-black hover:bg-red-400 text-xs font-heading font-bold uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>REPLAN & RETRY NOW</span>
          </button>
        </div>
      )}

      {/* Manual Trigger for Verification Demo if at Assessed stage */}
      {incident?.stage === 'ASSESSED' && incident?.current_assessment === 'ATTACK_VERIFIED' && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between">
          <div className="text-xs font-mono text-cyan-200">
            <p className="font-bold text-cyan-300">ATTACK CONFIRMED &bull; READY FOR RESPONSE</p>
            <p className="text-slate-400 text-[11px]">Execute simulated perimeter drop and trigger closed-loop follow-up verification probe.</p>
          </div>

          <button
            disabled={isLoading}
            onClick={() => {
              soundFx.lock();
              onExecuteResponse(false);
            }}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 text-xs font-heading font-bold uppercase tracking-wider cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all"
          >
            <Lock className="w-4 h-4" />
            <span>DEPLOY FIREWALL BLOCK & VERIFY</span>
          </button>
        </div>
      )}

    </div>
  );
};
