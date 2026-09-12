import React from 'react';
import { 
  Server, 
  ShieldAlert, 
  Network, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Clock,
  Layers,
  FileCode2
} from 'lucide-react';
import { EvidenceRecord, Incident } from '../types/soc';

interface EvidenceDeckProps {
  incident: Incident | null;
}

export const EvidenceDeck: React.FC<EvidenceDeckProps> = ({ incident }) => {
  const evidenceList = incident?.evidence || [];
  
  const getEvidence = (category: string): EvidenceRecord | undefined => {
    return evidenceList.find(e => e.category === category);
  };

  const assetEv = getEvidence('ASSET');
  const vulnEv = getEvidence('VULNERABILITY');
  const netEv = getEvidence('NETWORK');
  const serverEv = getEvidence('SERVER');

  const renderBadge = (ev?: EvidenceRecord) => {
    if (!ev) {
      return (
        <span className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
          <HelpCircle className="w-3 h-3" />
          <span>UNKNOWN</span>
        </span>
      );
    }
    if (ev.status === 'SUPPORTING' || ev.status === 'CONFIRMED') {
      return (
        <span className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>{ev.status}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
        <XCircle className="w-3 h-3 text-amber-400" />
        <span>{ev.status}</span>
      </span>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-300 font-heading flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>PROGRESSIVE EVIDENCE MATRIX</span>
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Multi-surface forensic verification (Assets • CVE • Deep Packet • Host EDR)
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-500/30">
          {evidenceList.length} OF 4 SURFACES VERIFIED
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Surface 1: ASSET */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          assetEv 
            ? 'aegis-panel aegis-panel-glow border-cyan-500/40' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-heading">ASSET IDENTITY</span>
            </div>
            {renderBadge(assetEv)}
          </div>

          {assetEv ? (
            <div className="space-y-2 text-xs font-mono">
              <p className="text-cyan-300 font-bold">{assetEv.title}</p>
              <div className="text-[11px] text-slate-300 space-y-1">
                <p>{assetEv.summary}</p>
                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-800/80 flex justify-between">
                  <span>CRITICALITY: <strong className="text-rose-400">HIGH</strong></span>
                  <span>ENVIRONMENT: <strong className="text-cyan-300">PROD</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-600">
              <p className="animate-pulse">Awaiting asset query...</p>
              <span className="text-[10px] text-slate-700 mt-1 block">get_asset()</span>
            </div>
          )}
        </div>

        {/* Surface 2: VULNERABILITY */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          vulnEv 
            ? 'aegis-panel aegis-panel-glow border-cyan-500/40' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-heading">VULNERABILITY</span>
            </div>
            {renderBadge(vulnEv)}
          </div>

          {vulnEv ? (
            <div className="space-y-2 text-xs font-mono">
              <p className="text-cyan-300 font-bold">{vulnEv.title}</p>
              <div className="text-[11px] text-slate-300 space-y-1">
                <p>{vulnEv.summary}</p>
                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-800/80 flex justify-between">
                  <span>CATALOG: <strong className="text-amber-400">CVE/NVD</strong></span>
                  <span>STATUS: <strong className={vulnEv.status === 'SUPPORTING' ? 'text-rose-400' : 'text-emerald-400'}>{vulnEv.status}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-600">
              <p className="animate-pulse">Awaiting CVE catalog query...</p>
              <span className="text-[10px] text-slate-700 mt-1 block">get_vulnerabilities()</span>
            </div>
          )}
        </div>

        {/* Surface 3: NETWORK */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          netEv 
            ? 'aegis-panel aegis-panel-glow border-cyan-500/40' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <div className="flex items-center space-x-2">
              <Network className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-heading">NETWORK & DPI</span>
            </div>
            {renderBadge(netEv)}
          </div>

          {netEv ? (
            <div className="space-y-2 text-xs font-mono">
              <p className="text-cyan-300 font-bold">{netEv.title}</p>
              <div className="text-[11px] text-slate-300 space-y-1">
                <p>{netEv.summary}</p>
                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-800/80 flex justify-between">
                  <span>INSPECTION: <strong className="text-cyan-300">LAYER 7 DPI</strong></span>
                  <span>ENCODING: <strong className="text-amber-400">OGNL/RAW</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-600">
              <p className="animate-pulse">Awaiting packet telemetry...</p>
              <span className="text-[10px] text-slate-700 mt-1 block">get_packet_metadata()</span>
            </div>
          )}
        </div>

        {/* Surface 4: SERVER */}
        <div className={`p-4 rounded-xl border transition-all duration-300 ${
          serverEv 
            ? 'aegis-panel aegis-panel-glow border-cyan-500/40' 
            : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 font-heading">HOST EXECUTION</span>
            </div>
            {renderBadge(serverEv)}
          </div>

          {serverEv ? (
            <div className="space-y-2 text-xs font-mono">
              <p className="text-cyan-300 font-bold">{serverEv.title}</p>
              <div className="text-[11px] text-slate-300 space-y-1">
                <p>{serverEv.summary}</p>
                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-800/80 flex justify-between">
                  <span>EDR AGENT: <strong className="text-cyan-300">AUDITD/OSQUERY</strong></span>
                  <span>SUB-PROCESS: <strong className={serverEv.status === 'SUPPORTING' ? 'text-rose-400 font-bold' : 'text-slate-400'}>{serverEv.status === 'SUPPORTING' ? 'SPAWNED' : 'NONE'}</strong></span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-600">
              <p className="animate-pulse">Awaiting host process logs...</p>
              <span className="text-[10px] text-slate-700 mt-1 block">get_server_logs()</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
