import React, { useState } from 'react';
import { 
  UserCheck, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Ban, 
  RotateCw, 
  Send 
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface HumanOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetIp: string;
  onConfirmOverride: (decision: 'APPROVED' | 'OVERRIDDEN' | 'REASSESS', notes: string) => void;
  isLoading: boolean;
}

export const HumanOverrideModal: React.FC<HumanOverrideModalProps> = ({
  isOpen,
  onClose,
  targetIp,
  onConfirmOverride,
  isLoading
}) => {
  const [analystNotes, setAnalystNotes] = useState('');
  const [selectedDecision, setSelectedDecision] = useState<'APPROVED' | 'OVERRIDDEN' | 'REASSESS'>('OVERRIDDEN');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md scanlines select-none p-4">
      <div className="w-full max-w-lg p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/40 corner-bracket relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
          <div className="flex items-center space-x-2.5">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading">
              HUMAN-IN-THE-LOOP ANALYST OVERRIDE
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Proposed Action Banner */}
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 mb-4 text-xs font-mono">
          <span className="text-[10px] text-slate-500 block mb-1">AGENT PROPOSED ACTION:</span>
          <div className="flex items-center justify-between">
            <strong className="text-rose-400 font-bold text-sm">
              BLOCK TRAFFIC FROM {targetIp}
            </strong>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              PENDING ANALYST GATE
            </span>
          </div>
        </div>

        {/* Decision Selector */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-mono text-slate-400 block">SELECT ANALYST DIRECTIVE:</label>
          
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            
            <button
              type="button"
              onClick={() => {
                soundFx.click();
                setSelectedDecision('APPROVED');
              }}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                selectedDecision === 'APPROVED'
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
              <span>APPROVE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.click();
                setSelectedDecision('OVERRIDDEN');
              }}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                selectedDecision === 'OVERRIDDEN'
                  ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ban className="w-4 h-4 mx-auto mb-1 text-amber-400" />
              <span>OVERRIDE</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundFx.click();
                setSelectedDecision('REASSESS');
              }}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                selectedDecision === 'REASSESS'
                  ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)] font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <RotateCw className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
              <span>REASSESS</span>
            </button>

          </div>
        </div>

        {/* Notes input */}
        <div className="space-y-1.5 mb-5">
          <label className="text-xs font-mono text-slate-400 block">
            ANALYST AUDIT RATIONALE (PERSISTED IN LEDGER):
          </label>
          <textarea
            value={analystNotes}
            onChange={(e) => setAnalystNotes(e.target.value)}
            placeholder="E.g., Host belongs to scheduled penetration test / false alert suppression."
            rows={3}
            className="w-full p-2.5 rounded-lg bg-black/60 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
          ></textarea>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-cyan-500/20">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          
          <button
            disabled={isLoading}
            onClick={() => {
              soundFx.alert();
              onConfirmOverride(selectedDecision, analystNotes || 'Analyst discretionary override recorded.');
              onClose();
            }}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 font-heading font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SUBMIT DIRECTIVE</span>
          </button>
        </div>

      </div>
    </div>
  );
};
