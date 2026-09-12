import React, { useEffect, useRef } from 'react';
import { 
  Terminal, 
  ArrowRight, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Zap,
  CornerDownRight
} from 'lucide-react';
import { Incident, InvestigationState } from '../types/soc';

interface AgentActivityStreamProps {
  incident: Incident | null;
  isLoading: boolean;
}

export const AgentActivityStream: React.FC<AgentActivityStreamProps> = ({ incident, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [incident?.states]);

  const states = incident?.states || [];

  return (
    <div className="flex flex-col h-[520px] rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30 overflow-hidden">
      
      {/* Stream Terminal Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-cyan-500/20">
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold tracking-widest text-cyan-300 font-heading">
            AUTONOMOUS AGENT ACTIVITY STREAM
          </h3>
        </div>

        <div className="flex items-center space-x-2">
          {isLoading && (
            <span className="flex items-center space-x-1.5 text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              <span>EXECUTING...</span>
            </span>
          )}
          <span className="text-[10px] font-mono text-slate-500">
            {states.length} ACTIONS RECORDED
          </span>
        </div>
      </div>

      {/* Vertical Animated Activity Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
        
        {/* Step 0: Ingestion */}
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{incident?.created_at ? new Date(incident.created_at).toLocaleTimeString() : '00:00:00'}</span>
            </span>
            <span className="text-cyan-400 font-bold">EVENT: ALERT_INGESTION</span>
          </div>
          <p className="text-slate-300 font-medium">
            Alert received from NIDS sensor: <strong className="text-cyan-300">{incident?.title}</strong>
          </p>
        </div>

        {/* Dynamic State Entries */}
        {states.map((state, idx) => {
          const isLatest = idx === states.length - 1;
          const isToolStep = Boolean(state.selected_tool);
          const isReassess = state.selected_tool === 'reassess_with_delayed_telemetry';
          
          return (
            <div 
              key={idx}
              className={`p-3.5 rounded-lg border transition-all duration-300 ${
                isReassess
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : isLatest && isLoading
                  ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.25)]'
                  : 'bg-slate-900/80 border-cyan-500/20'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <span className="flex items-center space-x-1.5 text-slate-400">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{state.timestamp ? new Date(state.timestamp).toLocaleTimeString() : `STEP ${state.iteration}`}</span>
                </span>

                <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] ${
                  isReassess
                    ? 'bg-amber-500 text-black'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}>
                  PHASE: {state.current_phase}
                </span>
              </div>

              {/* Tool Execution Row */}
              {isToolStep && (
                <div className="flex items-center space-x-2 my-1 text-cyan-300 font-bold">
                  <CornerDownRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-400">&rarr;</span>
                  <code className="px-1.5 py-0.5 rounded bg-black/50 text-cyan-300 border border-cyan-500/30">
                    {state.selected_tool}()
                  </code>
                </div>
              )}

              {/* Observation Block */}
              {state.observation && (
                <div className="mt-2 p-2 rounded bg-black/40 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                  <div className="text-[10px] font-bold text-emerald-400 tracking-wider mb-0.5 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>OBSERVATION:</span>
                  </div>
                  <p>{state.observation}</p>
                </div>
              )}

              {/* Audit Rationale */}
              {state.reasoning_text && (
                <div className="mt-1.5 text-[10px] text-slate-400 italic">
                  &ldquo;{state.reasoning_text}&rdquo;
                </div>
              )}
            </div>
          );
        })}

        {/* Live Step Loading Indicator */}
        {isLoading && (
          <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-center space-x-3 text-cyan-300 animate-pulse">
            <Cpu className="w-4 h-4 animate-spin" />
            <span className="text-xs">Agent evaluating knowledge gaps & querying tool catalog...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

    </div>
  );
};
