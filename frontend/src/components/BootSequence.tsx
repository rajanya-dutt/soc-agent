import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, CheckCircle2, Terminal } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface BootSequenceProps {
  onComplete: () => void;
}

const SUBSYSTEMS = [
  "NIDS SURICATA SENSOR CLUSTER",
  "SYNTHETIC ASSET INVENTORY (CMDB)",
  "CVE VULNERABILITY CATALOG (NVD/MITRE)",
  "PACKET INSPECTION TELEMETRY ENGINE",
  "HOST EDR & AUDITD PROCESS TELEMETRY",
  "SIMULATED PERIMETER FIREWALL (IPTABLES V4)",
  "AUTONOMOUS AGENTIC INVESTIGATION DAEMON",
  "ACTIVE PROBE RESPONSE VERIFIER"
];

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [allDone, setAllDone] = useState(false);
  const timerIdsRef = useRef<number[]>([]);
  const hasExitedRef = useRef(false);

  // Single reliable exit handler
  const enterCommandCenter = useCallback(() => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;

    // Clear all pending subsystem animation timers cleanly
    timerIdsRef.current.forEach(t => clearTimeout(t));
    timerIdsRef.current = [];

    // Restore body overflow
    document.body.style.overflow = "";

    soundFx.click();
    onComplete();
  }, [onComplete]);

  // Handle body scroll locking and keyboard ESC listener
  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        enterCommandCenter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Initial audio alert
    soundFx.alert();

    // Staggered subsystem activation sequence
    SUBSYSTEMS.forEach((_, idx) => {
      const timer = window.setTimeout(() => {
        setCompletedSteps(prev => [...prev, idx]);
        soundFx.click();
        if (idx === SUBSYSTEMS.length - 1) {
          const finalTimer = window.setTimeout(() => {
            setAllDone(true);
            soundFx.success();
          }, 350);
          timerIdsRef.current.push(finalTimer);
        }
      }, (idx + 1) * 200);
      timerIdsRef.current.push(timer);
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      timerIdsRef.current.forEach(t => clearTimeout(t));
      timerIdsRef.current = [];
    };
  }, [enterCommandCenter]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#04060a]/95 backdrop-blur-md cyber-grid select-none pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="AEGIS System Initialization Modal"
    >
      <div className="w-full max-w-xl p-8 rounded-lg aegis-panel aegis-panel-glow corner-bracket relative border border-cyan-500/40 pointer-events-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-cyan-500/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
              <Shield className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider text-cyan-300 font-heading">
                AEGIS // AUTONOMOUS SOC
              </h1>
              <p className="text-xs text-slate-400 tracking-widest font-mono">
                INITIALIZING SECURE SANDBOX ENVIRONMENT
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            SIMULATION ONLY
          </span>
        </div>

        {/* Subsystems Checklist */}
        <div className="py-6 space-y-2.5 font-mono text-xs">
          {SUBSYSTEMS.map((sys, idx) => {
            const isCompleted = completedSteps.includes(idx);
            return (
              <div 
                key={sys}
                className={`flex items-center justify-between px-3 py-1.5 rounded transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-cyan-950/30 text-cyan-200 border border-cyan-500/20' 
                    : 'text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Terminal className={`w-3.5 h-3.5 ${isCompleted ? 'text-cyan-400' : 'text-slate-600'}`} />
                  <span>{sys}</span>
                </div>
                <div>
                  {isCompleted ? (
                    <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ONLINE</span>
                    </span>
                  ) : (
                    <span className="text-slate-600 animate-pulse">PENDING...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>SYSTEM INTEGRITY: 100% ISOLATED</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={enterCommandCenter}
              className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded border border-transparent hover:border-cyan-500/30 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-400"
              aria-label="Skip initialization and enter command center"
            >
              Skip Intro [ESC]
            </button>
            <button
              type="button"
              onClick={enterCommandCenter}
              className={`px-5 py-2 text-xs font-heading font-bold uppercase tracking-wider rounded transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                allDone
                  ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(0,240,255,0.6)] hover:bg-cyan-400'
                  : 'bg-cyan-500/90 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:bg-cyan-400'
              }`}
              aria-label="Enter AEGIS Command Center"
            >
              Enter Command Center &rarr;
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
