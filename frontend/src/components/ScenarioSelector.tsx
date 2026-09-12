import React from 'react';
import { 
  ShieldAlert, 
  ShieldX, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  UserCheck, 
  Radio, 
  ChevronRight,
  Flame
} from 'lucide-react';
import { Scenario } from '../types/soc';
import { soundFx } from '../utils/audio';

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  activeScenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
  isLoading: boolean;
}

const SCENARIO_ICONS: Record<string, React.ElementType> = {
  "01": Flame,
  "02": ShieldX,
  "03": CheckCircle2,
  "04": Clock,
  "05": RotateCcw,
  "06": UserCheck
};

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  isLoading
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>OPERATION SCENARIO MATRIX</span>
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Select a pre-calibrated incident environment to evaluate agent reasoning
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          6 SIMULATED RUNTIMES READY
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {scenarios.map(sc => {
          const isCurrent = sc.id === activeScenarioId;
          const Icon = SCENARIO_ICONS[sc.id] || Radio;

          return (
            <div
              key={sc.id}
              onClick={() => {
                if (isLoading) return;
                soundFx.click();
                onSelectScenario(sc.id);
              }}
              className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer relative group ${
                isCurrent
                  ? 'aegis-panel aegis-panel-glow border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(0,240,255,0.25)]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/90'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  OPERATION {sc.id}
                </span>

                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  sc.severity === 'CRITICAL' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                    : sc.severity === 'HIGH'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {sc.severity}
                </span>
              </div>

              {/* Title */}
              <div className="flex items-center space-x-2 my-1.5">
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'}`} />
                <h4 className="text-xs font-bold font-heading text-slate-100 group-hover:text-cyan-200 transition-colors">
                  {sc.name}
                </h4>
              </div>

              {/* Description */}
              <p className="text-[11px] font-mono text-slate-400 line-clamp-2 leading-relaxed mb-3">
                {sc.description}
              </p>

              {/* Target & Expected telemetry footer */}
              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>TARGET: <strong className="text-slate-300">{sc.service}</strong></span>
                <span className="flex items-center space-x-1 text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  <span>LOAD SCENARIO</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
