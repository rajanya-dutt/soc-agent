import React, { useEffect, useState } from 'react';
import { 
  GitMerge, 
  ShieldCheck, 
  AlertOctagon, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  TrendingUp,
  ShieldX
} from 'lucide-react';
import { Incident } from '../types/soc';

interface CorrelationHUDProps {
  incident: Incident | null;
}

export const CorrelationHUD: React.FC<CorrelationHUDProps> = ({ incident }) => {
  const [displayConfidence, setDisplayConfidence] = useState(0);

  const targetConfidence = incident?.confidence || 0;
  const assessment = incident?.current_assessment || 'UNCERTAIN';

  // Smooth number counter animation
  useEffect(() => {
    let start = displayConfidence;
    const end = targetConfidence;
    if (start === end) return;

    const stepTime = 15;
    const steps = 20;
    const diff = (end - start) / steps;
    let curStep = 0;

    const timer = setInterval(() => {
      curStep++;
      start += diff;
      if (curStep >= steps) {
        setDisplayConfidence(end);
        clearInterval(timer);
      } else {
        setDisplayConfidence(Math.round(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetConfidence]);

  const getDecisionTheme = () => {
    switch (assessment) {
      case 'ATTACK_VERIFIED':
        return {
          title: 'ATTACK VERIFIED',
          subtitle: 'Evidence strongly indicates successful remote code exploitation.',
          border: 'border-rose-500/60',
          bg: 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/30',
          badge: 'bg-rose-500 text-black',
          textColor: 'text-rose-400',
          icon: ShieldX
        };
      case 'ATTACK_FAILED':
        return {
          title: 'ATTACK FAILED',
          subtitle: 'Malicious exploit traffic detected, but target application is patched (HTTP 403). No compromise.',
          border: 'border-amber-500/60',
          bg: 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30',
          badge: 'bg-amber-500 text-black',
          textColor: 'text-amber-400',
          icon: AlertOctagon
        };
      case 'FALSE_POSITIVE':
        return {
          title: 'FALSE POSITIVE / BENIGN',
          subtitle: 'Alert triggered on benign benchmark probe. Zero vulnerability match and normal server telemetry.',
          border: 'border-emerald-500/60',
          bg: 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30',
          badge: 'bg-emerald-500 text-black',
          textColor: 'text-emerald-400',
          icon: CheckCircle2
        };
      default:
        return {
          title: 'EVALUATION IN PROGRESS',
          subtitle: 'Autonomous agent gathering multi-source evidence across asset, vulnerability, and server telemetry.',
          border: 'border-cyan-500/30',
          bg: 'bg-slate-900/80',
          badge: 'bg-cyan-500/20 text-cyan-300',
          textColor: 'text-cyan-300',
          icon: HelpCircle
        };
    }
  };

  const theme = getDecisionTheme();
  const Icon = theme.icon;

  return (
    <div className={`p-6 rounded-xl border ${theme.border} ${theme.bg} transition-all duration-500 aegis-panel corner-bracket`}>
      
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Left: Converging Evidence Signals */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400 tracking-wider">
            <GitMerge className="w-4 h-4" />
            <span className="font-bold">EVIDENCE CORRELATION ENGINE</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-black/40 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[9px]">SIGNAL 01</span>
              <span className="text-cyan-300 font-bold">PORT EXPOSURE</span>
            </div>
            <div className="p-2 rounded bg-black/40 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[9px]">SIGNAL 02</span>
              <span className="text-cyan-300 font-bold">CVE MATCH</span>
            </div>
            <div className="p-2 rounded bg-black/40 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[9px]">SIGNAL 03</span>
              <span className="text-cyan-300 font-bold">DPI PAYLOAD</span>
            </div>
            <div className="p-2 rounded bg-black/40 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[9px]">SIGNAL 04</span>
              <span className="text-cyan-300 font-bold">HOST EXECUTION</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-mono italic">
            &ldquo;{incident?.reasoning_summary || 'Ingesting real-time synthetic telemetry to calculate causal compromise probability.'}&rdquo;
          </p>
        </div>

        {/* Center: Animated Confidence Dial */}
        <div className="flex flex-col items-center justify-center px-6 py-2 border-y lg:border-y-0 lg:border-x border-cyan-500/20 shrink-0">
          <span className="text-[10px] font-mono text-slate-400 tracking-widest flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>CONFIDENCE SCORE</span>
          </span>

          <div className="flex items-baseline space-x-1 my-1">
            <span className={`text-4xl font-extrabold font-mono tracking-tighter ${theme.textColor}`}>
              {displayConfidence}
            </span>
            <span className="text-xl font-bold text-slate-400 font-mono">%</span>
          </div>

          <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden mt-1 p-0.5 border border-slate-700">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                assessment === 'ATTACK_VERIFIED' 
                  ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' 
                  : assessment === 'FALSE_POSITIVE'
                  ? 'bg-emerald-500'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${displayConfidence}%` }}
            ></div>
          </div>
        </div>

        {/* Right: Decision State Card */}
        <div className="flex flex-col items-start lg:items-end text-left lg:text-right shrink-0">
          <span className={`px-3 py-1 rounded text-xs font-heading font-bold uppercase tracking-wider ${theme.badge} mb-2`}>
            {theme.title}
          </span>
          <p className="text-xs font-mono text-slate-300 max-w-xs">
            {theme.subtitle}
          </p>
        </div>

      </div>

    </div>
  );
};
