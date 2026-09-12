import React from 'react';
import { 
  AlertOctagon, 
  ArrowRight, 
  Play, 
  FastForward, 
  ShieldAlert, 
  Clock, 
  Server,
  Radio
} from 'lucide-react';
import { Alert, Incident } from '../types/soc';
import { soundFx } from '../utils/audio';

interface AlertBannerProps {
  alert: Alert | null;
  incident: Incident | null;
  onStartAutonomous: () => void;
  onStepInvestigation: () => void;
  isLoading: boolean;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  alert,
  incident,
  onStartAutonomous,
  onStepInvestigation,
  isLoading
}) => {
  if (!alert) return null;

  const isInvestigating = incident?.stage === 'INVESTIGATING' || incident?.stage === 'CORRELATING';
  const isResolved = incident?.stage === 'VERIFIED' || incident?.stage === 'CLOSED';

  return (
    <div className="relative overflow-hidden rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-slate-950 p-5 shadow-[0_0_25px_rgba(244,63,94,0.15)] corner-bracket">
      
      {/* Background scan glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
        
        {/* Left: Severity & Signature */}
        <div className="flex items-start space-x-4">
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] shrink-0 animate-pulse">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest bg-rose-500 text-black uppercase shadow-sm">
                {alert.severity} SEVERITY
              </span>
              <span className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                <Radio className="w-3 h-3 text-rose-400 animate-ping" />
                <span>NIDS INTAKE: {alert.rule_id}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'RECENT'}</span>
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-100 font-heading tracking-wide">
              {alert.signature}
            </h2>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-slate-300">
              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500">ATTACKER:</span>
                <strong className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                  {alert.source_ip}
                </strong>
              </span>

              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />

              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500">TARGET:</span>
                <strong className="text-cyan-300 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                  {alert.target_ip}:{alert.target_port}
                </strong>
              </span>

              <span className="flex items-center space-x-1.5">
                <span className="text-slate-500">CATEGORY:</span>
                <span className="text-amber-300">{alert.category}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Agent Action Triggers */}
        <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
          
          {/* Step-by-Step Manual Button */}
          <button
            disabled={isLoading || isResolved}
            onClick={() => {
              soundFx.click();
              onStepInvestigation();
            }}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:border-cyan-500/40 text-xs font-mono transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            <span>STEP AGENT (1x)</span>
          </button>

          {/* Full Autonomous Run Button */}
          <button
            disabled={isLoading || isResolved}
            onClick={() => {
              soundFx.alert();
              onStartAutonomous();
            }}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 text-xs font-heading font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.5)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FastForward className="w-4 h-4" />
            <span>{isInvestigating ? 'AGENT INVESTIGATING...' : 'RUN AUTONOMOUS AGENT'}</span>
          </button>

        </div>

      </div>

    </div>
  );
};
