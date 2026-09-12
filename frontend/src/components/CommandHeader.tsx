import { 
  ShieldAlert, 
  Cpu, 
  Network, 
  FileText, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Layers,
  Activity,
  MonitorPlay
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { SystemStatus } from '../types/soc';

interface CommandHeaderProps {
  currentView: 'OPERATIONS' | 'INVESTIGATION' | 'NETWORK' | 'AUDIT';
  onSelectView: (view: 'OPERATIONS' | 'INVESTIGATION' | 'NETWORK' | 'AUDIT') => void;
  systemStatus: SystemStatus | null;
  onReset: () => void;
  onReplayIntro?: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({
  currentView,
  onSelectView,
  systemStatus,
  onReset,
  onReplayIntro,
  soundEnabled,
  onToggleSound
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#060a12]/90 backdrop-blur-md border-b border-cyan-500/20 px-6 py-3">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Product Branding & Status */}
        <div className="flex items-center space-x-4">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-cyan-950/60 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 font-heading">
                AEGIS // AUTONOMOUS SOC
              </span>
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>SANDBOX ACTIVE</span>
              </span>
            </div>
            
            <p className="text-[11px] font-mono text-slate-400 tracking-wide">
              <span className="text-cyan-400 font-semibold">Investigate. Correlate. Respond. Verify.</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-slate-400">Autonomous investigation and response simulation</span>
            </p>
          </div>
        </div>

        {/* Center: View Switcher Navigation */}
        <nav className="flex items-center p-1 rounded-lg bg-slate-900/80 border border-cyan-500/20 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              soundFx.click();
              onSelectView('OPERATIONS');
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentView === 'OPERATIONS'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>OPERATIONS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.click();
              onSelectView('INVESTIGATION');
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentView === 'INVESTIGATION'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>INVESTIGATION & EVIDENCE</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.click();
              onSelectView('NETWORK');
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentView === 'NETWORK'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>NETWORK TOPOLOGY</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.click();
              onSelectView('AUDIT');
            }}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentView === 'AUDIT'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>AUDIT LEDGER</span>
          </button>
        </nav>

        {/* Right: Engine Indicator & System Actions */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {/* Dual Reasoning Engine Badge */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded bg-slate-900/80 border border-cyan-500/20 text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-slate-400">ENGINE:</span>
            <span className="text-cyan-300 font-bold tracking-wider">
              {systemStatus?.mode || "DETERMINISTIC SANDBOX"}
            </span>
          </div>

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleSound();
              soundFx.click();
            }}
            title={soundEnabled ? "Mute Tactical Audio" : "Enable Tactical Audio"}
            className={`p-2 rounded border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 hover:bg-cyan-900/40'
                : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Replay Intro Button */}
          {onReplayIntro && (
            <button
              type="button"
              onClick={() => {
                soundFx.click();
                onReplayIntro();
              }}
              title="Replay System Boot & Initialization Sequence"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900/40 hover:text-cyan-200 transition-colors cursor-pointer"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>BOOT INTRO</span>
            </button>
          )}

          {/* Emergency Reset Button */}
          <button
            type="button"
            onClick={() => {
              soundFx.alert();
              onReset();
            }}
            title="Reset Simulation to Initial State"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-red-950/30 text-red-400 border border-red-500/30 hover:bg-red-900/40 hover:text-red-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>

      </div>
    </header>
  );
};
