import React from 'react';
import { 
  FileText, 
  Download, 
  X, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  ShieldCheck, 
  Copy,
  ExternalLink
} from 'lucide-react';
import { Incident } from '../types/soc';
import { soundFx } from '../utils/audio';

interface AuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident | null;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({
  isOpen,
  onClose,
  incident
}) => {
  if (!isOpen || !incident) return null;

  const handleDownload = async (format: 'json' | 'markdown') => {
    soundFx.click();
    try {
      const res = await fetch(`/api/reports/${incident.id}/export?format=${format}`);
      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AEGIS-AUDIT-${incident.id}.json`;
        a.click();
      } else {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AEGIS-AUDIT-${incident.id}.md`;
        a.click();
      }
    } catch {
      // download fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md scanlines select-none p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/40 corner-bracket relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading">
                FORENSIC INCIDENT AUDIT LEDGER & COMPLIANCE REPORT
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                INCIDENT ID: <strong className="text-slate-200">{incident.id}</strong> &bull; SCENARIO: <strong className="text-cyan-300">{incident.scenario_id}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleDownload('json')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 text-cyan-300 hover:bg-slate-700 text-xs font-mono border border-cyan-500/30 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT JSON</span>
            </button>

            <button
              onClick={() => handleDownload('markdown')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyan-500 text-black hover:bg-cyan-400 text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT MARKDOWN</span>
            </button>

            <button 
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs text-slate-300">
          
          {/* Executive Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-black/50 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 block">FINAL STATUS</span>
              <strong className="text-cyan-300 font-bold">{incident.status}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">FINAL VERDICT</span>
              <strong className={incident.current_assessment === 'ATTACK_VERIFIED' ? 'text-rose-400' : 'text-emerald-400'}>
                {incident.current_assessment}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">CONFIDENCE SCORE</span>
              <strong className="text-amber-300 font-bold">{incident.confidence}%</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">ACTIONS VERIFIED</span>
              <strong className="text-emerald-400">
                {incident.actions.filter(a => a.verified).length} OF {incident.actions.length}
              </strong>
            </div>
          </div>

          {/* Reasoning Summary */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-cyan-500/20">
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
              AUTONOMOUS AUDIT JUSTIFICATION
            </h4>
            <p className="text-slate-300 leading-relaxed italic">
              &ldquo;{incident.reasoning_summary}&rdquo;
            </p>
          </div>

          {/* Evidence Ledger */}
          <div>
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
              VERIFIED EVIDENCE CHAIN ({incident.evidence.length} SURFACES)
            </h4>
            <div className="space-y-2">
              {incident.evidence.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 mr-2">
                      {ev.category}
                    </span>
                    <strong className="text-slate-200">{ev.title}</strong>
                    <p className="text-[11px] text-slate-400 mt-1">{ev.summary}</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30">
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Iteration Audit Trail */}
          <div>
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
              AGENT STATE MACHINE TIMELINE
            </h4>
            <div className="space-y-2">
              {incident.states.map((st, idx) => (
                <div key={idx} className="p-2.5 rounded bg-slate-900/40 border border-slate-800/80 text-[11px]">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>ITERATION {st.iteration} &bull; {st.current_phase}</span>
                    <span className="text-cyan-400">{st.timestamp ? new Date(st.timestamp).toLocaleTimeString() : ''}</span>
                  </div>
                  <p className="text-slate-300">
                    <strong className="text-cyan-300">{st.selected_tool}()</strong> &rarr; {st.observation}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
