import React, { useEffect, useRef, useState } from 'react';
import { 
  Globe, 
  Skull, 
  Eye, 
  ShieldCheck, 
  Server, 
  Layers, 
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Incident } from '../types/soc';

interface NetworkTopologyCanvasProps {
  incident: Incident | null;
  onNodeClick?: (nodeId: string) => void;
}

interface NodeDef {
  id: string;
  label: string;
  sublabel: string;
  type: string;
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  icon: React.ElementType;
}

const NODES: NodeDef[] = [
  { id: 'internet', label: 'INTERNET GATEWAY', sublabel: 'WAN Edge (0.0.0.0/0)', type: 'gateway', x: 8, y: 50, icon: Globe },
  { id: 'threat_actor', label: 'THREAT ACTOR', sublabel: '10.0.0.25 (Simulated)', type: 'attacker', x: 22, y: 50, icon: Skull },
  { id: 'nids_sensors', label: 'NIDS SENSORS', sublabel: 'Suricata Core Cluster', type: 'sensor', x: 38, y: 50, icon: Eye },
  { id: 'firewall', label: 'PERIMETER FIREWALL', sublabel: 'Simulated Edge iptables', type: 'firewall', x: 54, y: 50, icon: ShieldCheck },
  { id: 'web_server', label: 'WEB SERVER (01)', sublabel: '10.0.0.10:8080', type: 'asset', x: 70, y: 35, icon: Server },
  { id: 'application', label: 'STRUTS APP RUNTIME', sublabel: 'PID 4110 / JRE 17', type: 'runtime', x: 86, y: 35, icon: Layers },
  { id: 'database', label: 'INTERNAL DATASTORE', sublabel: 'Postgres Core (10.0.0.50)', type: 'database', x: 86, y: 68, icon: Database }
];

const EDGES = [
  { from: 'internet', to: 'threat_actor' },
  { from: 'threat_actor', to: 'nids_sensors' },
  { from: 'nids_sensors', to: 'firewall' },
  { from: 'firewall', to: 'web_server' },
  { from: 'web_server', to: 'application' },
  { from: 'web_server', to: 'database' }
];

export const NetworkTopologyCanvas: React.FC<NetworkTopologyCanvasProps> = ({ incident, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const isBlocked = incident?.stage === 'VERIFIED' || incident?.status === 'MITIGATED';
  const isInvestigating = incident?.stage === 'INVESTIGATING' || incident?.stage === 'CORRELATING';
  const isAttacking = incident && incident.status === 'ACTIVE' && !isBlocked;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particleOffset = 0;

    const render = () => {
      // Handle canvas resolution
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      particleOffset = (particleOffset + 0.008) % 1;

      // Draw Edges
      EDGES.forEach(edge => {
        const fromNode = NODES.find(n => n.id === edge.from)!;
        const toNode = NODES.find(n => n.id === edge.to)!;

        const x1 = (fromNode.x / 100) * width;
        const y1 = (fromNode.y / 100) * height;
        const x2 = (toNode.x / 100) * width;
        const y2 = (toNode.y / 100) * height;

        // Base line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        
        const isAttackEdge = (edge.from === 'threat_actor' || edge.from === 'nids_sensors') && isAttacking;
        const isBlockedEdge = edge.to === 'firewall' && isBlocked;

        if (isBlockedEdge) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.setLineDash([4, 4]);
        } else if (isAttackEdge) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)';
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
          ctx.setLineDash([]);
        }

        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw animated packet particles
        const numParticles = 2;
        for (let i = 0; i < numParticles; i++) {
          const t = (particleOffset + i / numParticles) % 1;
          
          // If firewall is blocking, particles bounce or stop before firewall
          if (isBlocked && edge.from === 'nids_sensors' && edge.to === 'firewall' && t > 0.85) {
            // Particle blocked!
            ctx.beginPath();
            const bx = x1 + (x2 - x1) * 0.88;
            const by = y1 + (y2 - y1) * 0.88;
            ctx.arc(bx, by, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
            continue;
          }

          // If blocked, no attack packets pass beyond firewall to web server
          if (isBlocked && (edge.from === 'firewall' && edge.to === 'web_server')) {
            continue;
          }

          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;

          ctx.beginPath();
          ctx.arc(px, py, isAttackEdge ? 3.5 : 2.5, 0, Math.PI * 2);

          if (isAttackEdge) {
            ctx.fillStyle = '#f43f5e';
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 6;
          }

          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [isBlocked, isInvestigating, isAttacking]);

  return (
    <div className="relative w-full h-[460px] rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30 overflow-hidden select-none">
      
      {/* Background Grid & Scanlines */}
      <div className="absolute inset-0 cyber-grid opacity-75 pointer-events-none"></div>
      <div className="absolute inset-0 scanlines opacity-50 pointer-events-none"></div>

      {/* Top Overlay HUD */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none z-20">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <h2 className="text-sm font-bold tracking-widest text-cyan-300 font-heading">
              LIVE NETWORK INFRASTRUCTURE & ATTACK PATH MAP
            </h2>
          </div>
          <p className="text-[11px] font-mono text-slate-400">
            Real-time simulated telemetry path • Deep Packet Inspection active
          </p>
        </div>

        {/* Live Attack Status Badge */}
        <div className="pointer-events-auto flex items-center space-x-2">
          {isBlocked ? (
            <div className="flex items-center space-x-2 px-3 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PERIMETER LOCK: ATTACK TRAFFIC DENIED</span>
            </div>
          ) : isAttacking ? (
            <div className="flex items-center space-x-2 px-3 py-1 rounded bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>INTRUSION STREAM ACTIVE: {incident?.attacker_ip || '10.0.0.25'}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1 rounded bg-slate-900/60 border border-slate-700 text-slate-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>NORMAL TRAFFIC BASELINE</span>
            </div>
          )}
        </div>
      </div>

      {/* HTML5 Canvas for dynamic particle beams */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full z-0 pointer-events-none"
      />

      {/* Interactive Nodes Layer */}
      <div className="absolute inset-0 z-10 pointer-events-auto">
        {NODES.map(node => {
          const Icon = node.icon;
          const isAttackerNode = node.id === 'threat_actor';
          const isTargetNode = node.id === 'web_server';
          const isFirewallNode = node.id === 'firewall';
          const isSensorNode = node.id === 'nids_sensors';

          let nodeStyle = 'bg-slate-900/90 border-cyan-500/30 text-cyan-300';
          let glowStyle = 'hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]';

          if (isAttackerNode) {
            nodeStyle = isAttacking 
              ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
              : 'bg-slate-900/90 border-slate-700 text-slate-400';
          } else if (isTargetNode) {
            nodeStyle = isInvestigating || isAttacking
              ? 'bg-amber-950/90 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
              : 'bg-slate-900/90 border-cyan-500/40 text-cyan-300';
          } else if (isFirewallNode) {
            nodeStyle = isBlocked
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
              : 'bg-slate-900/90 border-cyan-500/40 text-cyan-300';
          } else if (isSensorNode && isAttacking) {
            nodeStyle = 'bg-cyan-950/90 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.4)]';
          }

          return (
            <div
              key={node.id}
              onClick={() => {
                setSelectedNode(node.id);
                if (onNodeClick) onNodeClick(node.id);
              }}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className={`absolute flex flex-col items-center cursor-pointer group transition-all duration-300`}
            >
              {/* Node Icon Box */}
              <div className={`p-3.5 rounded-xl border ${nodeStyle} ${glowStyle} transition-all duration-300 relative`}>
                <Icon className="w-6 h-6" />

                {/* Firewall Block Badge */}
                {isFirewallNode && isBlocked && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-black rounded-full p-0.5 shadow-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}

                {/* Attacker Blocked Cross */}
                {isAttackerNode && isBlocked && (
                  <span className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-0.5 shadow-md">
                    <XCircle className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              {/* Node Labels */}
              <div className="mt-2 text-center whitespace-nowrap">
                <p className="text-xs font-heading font-bold tracking-wider text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {node.label}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {node.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Inspection Bar */}
      <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/80 px-4 py-2 rounded border border-cyan-500/20 backdrop-blur-sm z-20">
        <div className="flex items-center space-x-6">
          <span>SOURCE: <strong className="text-rose-400">{incident?.attacker_ip || '10.0.0.25'}</strong></span>
          <span>SENSOR: <strong className="text-cyan-300">SURICATA-NIDS-01</strong></span>
          <span>PERIMETER: <strong className={isBlocked ? 'text-emerald-400' : 'text-amber-400'}>{isBlocked ? 'BLOCKED [DROP]' : 'INSPECTING'}</strong></span>
          <span>TARGET: <strong className="text-cyan-300">{incident?.target_asset_ip || '10.0.0.10'}:8080</strong></span>
        </div>

        <div className="text-slate-500 text-[10px]">
          CLICK ANY NODE FOR SUB-SURFACE TELEMETRY
        </div>
      </div>

    </div>
  );
};
