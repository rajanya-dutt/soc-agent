import React from 'react';
import { 
  Sparkles, 
  FlaskConical, 
  History, 
  ArrowRight, 
  AlertCircle,
  Radio,
  Zap
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface JudgeDemoBarProps {
  currentScenarioId: string;
  onLoadDelayedScenario: () => void;
  onInjectDelayedEvidence: () => void;
  isLoading: boolean;
  incidentStage?: string;
}

export const JudgeDemoBar: React.FC<JudgeDemoBarProps> = ({
  currentScenarioId,
  onLoadDelayedScenario,
  onInjectDelayedEvidence,
  isLoading,
  incidentStage
}) => {
  const isScenario04 = currentScenarioId === '04';

  return (
    <div className="w-full p-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.15)] corner-bracket">
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Judge Demonstration Briefing */}
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center space-x-2 mb-0.5">
              <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500 text-black uppercase">
                AUTONOMOUS JUDGE DEMO
              </span>
              <span className="text-xs font-bold text-amber-300 font-heading">
                CHANGED-CONDITION DYNAMIC REASSESSMENT
              </span>
            </div>

            <p className="text-xs font-mono text-slate-300">
              Demonstrates an autonomous agent modifying its decision when unexpected delayed telemetry emerges in the environment.
            </p>
          </div>
        </div>

        {/* Right: Interactive Action Buttons */}
        <div className="flex items-center space-x-3 shrink-0">
          
          {!isScenario04 ? (
            <button
              disabled={isLoading}
              onClick={() => {
                soundFx.click();
                onLoadDelayedScenario();
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-amber-950/40 text-xs font-mono transition-all cursor-pointer shadow-sm"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>LOAD SCENARIO 04</span>
            </button>
          ) : (
            <button
              disabled={isLoading}
              onClick={() => {
                soundFx.alert();
                onInjectDelayedEvidence();
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 text-xs font-heading font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.6)] cursor-pointer transition-all animate-pulse"
            >
              <Zap className="w-4 h-4" />
              <span>INJECT DELAYED EVIDENCE NOW &rarr;</span>
            </button>
          )}

        </div>

      </div>

    </div>
  );
};
