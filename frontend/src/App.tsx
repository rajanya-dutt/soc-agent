import React, { useState, useEffect, useCallback } from 'react';
import { BootSequence } from './components/BootSequence';
import { CommandHeader } from './components/CommandHeader';
import { NetworkTopologyCanvas } from './components/NetworkTopologyCanvas';
import { AlertBanner } from './components/AlertBanner';
import { InvestigationGraph } from './components/InvestigationGraph';
import { AgentActivityStream } from './components/AgentActivityStream';
import { EvidenceDeck } from './components/EvidenceDeck';
import { CorrelationHUD } from './components/CorrelationHUD';
import { ResponseVisualizer } from './components/ResponseVisualizer';
import { JudgeDemoBar } from './components/JudgeDemoBar';
import { HumanOverrideModal } from './components/HumanOverrideModal';
import { ScenarioSelector } from './components/ScenarioSelector';
import { AgenticPrinciplesHUD } from './components/AgenticPrinciplesHUD';
import { AuditReportModal } from './components/AuditReportModal';

import { Alert, Incident, Scenario, SystemStatus, FirewallRule } from './types/soc';
import { soundFx } from './utils/audio';
import { API_BASE, getWsUrl } from './config';

export function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem('aegis_intro_seen') !== 'true';
  });

  const handleEnterCommandCenter = useCallback(() => {
    localStorage.setItem('aegis_intro_seen', 'true');
    setShowIntro(false);
  }, []);

  const handleReplayIntro = useCallback(() => {
    setShowIntro(true);
  }, []);

  const [currentView, setCurrentView] = useState<'OPERATIONS' | 'INVESTIGATION' | 'NETWORK' | 'AUDIT'>('OPERATIONS');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // System & Data State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('01');
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Fetch system status
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/system/status`);
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch incident details
  const fetchIncident = useCallback(async (incidentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${incidentId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentIncident(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch firewall rules
  const fetchFirewall = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/firewall`);
      if (res.ok) {
        const data = await res.json();
        setFirewallRules(data.rules || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load / Seed Scenario
  const handleLoadScenario = useCallback(async (scenarioId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scenarios/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScenarioId(scenarioId);

        // Fetch alert
        const alertRes = await fetch(`${API_BASE}/api/alerts/${data.alert_id}`);
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          setCurrentAlert(alertData);
        }

        // Fetch initialized incident
        await fetchIncident(data.incident_id);
        await fetchFirewall();
        await fetchSystemStatus();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [fetchIncident, fetchFirewall, fetchSystemStatus]);

  // Initial mount
  useEffect(() => {
    fetchSystemStatus();
    fetchScenarios();
    handleLoadScenario('01');
  }, [fetchSystemStatus, fetchScenarios, handleLoadScenario]);

  // WebSocket for real-time investigation updates
  useEffect(() => {
    if (!currentIncident?.id) return;

    const wsUrl = getWsUrl(`/api/ws/${currentIncident.id}`);
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STEP_COMPLETED' || msg.type === 'REASSESSMENT_TRIGGERED' || msg.type === 'RESPONSE_VERIFIED') {
            fetchIncident(currentIncident.id);
            fetchFirewall();
            fetchSystemStatus();
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // websocket fallback
    }

    return () => {
      if (socket) socket.close();
    };
  }, [currentIncident?.id, fetchIncident, fetchFirewall, fetchSystemStatus]);

  // Run full autonomous agent loop
  const handleStartAutonomous = async () => {
    if (!currentIncident) return;
    setIsLoading(true);
    soundFx.alert();
    try {
      const res = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: currentIncident.id, auto_respond: true })
      });
      if (res.ok) {
        await fetchIncident(currentIncident.id);
        await fetchFirewall();
        await fetchSystemStatus();
        soundFx.success();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Step investigation 1x
  const handleStepInvestigation = async () => {
    if (!currentIncident) return;
    setIsLoading(true);
    soundFx.click();
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${currentIncident.id}/step`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchIncident(currentIncident.id);
        await fetchFirewall();
        await fetchSystemStatus();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Response & Verification Probe
  const handleExecuteResponse = async (retry: boolean = false) => {
    if (!currentIncident) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/investigations/${currentIncident.id}/respond-and-verify?retry=${retry}`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchIncident(currentIncident.id);
        await fetchFirewall();
        await fetchSystemStatus();
        soundFx.success();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Judge Demo: Inject Delayed Evidence
  const handleInjectDelayedEvidence = async () => {
    if (!currentIncident) return;
    setIsLoading(true);
    soundFx.alert();
    try {
      const injectRes = await fetch(`${API_BASE}/api/scenarios/${activeScenarioId}/inject-evidence`, {
        method: 'POST'
      });
      if (injectRes.ok) {
        // Trigger agent reassessment
        const reassessRes = await fetch(`${API_BASE}/api/investigations/${currentIncident.id}/reassess`, {
          method: 'POST'
        });
        if (reassessRes.ok) {
          await fetchIncident(currentIncident.id);
          await fetchFirewall();
          await fetchSystemStatus();
          soundFx.success();
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Submit human override
  const handleConfirmOverride = async (decision: 'APPROVED' | 'OVERRIDDEN' | 'REASSESS', notes: string) => {
    if (!currentIncident) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/human-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: currentIncident.id,
          decision,
          action_proposed: 'BLOCK_IP',
          analyst_name: 'Senior SecOps Lead (Console)',
          analyst_notes: notes
        })
      });
      if (res.ok) {
        await fetchIncident(currentIncident.id);
        await fetchFirewall();
        await fetchSystemStatus();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Reset entire simulation
  const handleResetSimulation = async () => {
    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/api/scenarios/reset`, { method: 'POST' });
      await handleLoadScenario('01');
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Cinematic Startup Boot Sequence */}
      {showIntro && (
        <BootSequence onComplete={handleEnterCommandCenter} />
      )}

      {/* Top Command Bar */}
      <CommandHeader
        currentView={currentView}
        onSelectView={setCurrentView}
        systemStatus={systemStatus}
        onReset={handleResetSimulation}
        onReplayIntro={handleReplayIntro}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          soundFx.enabled = !soundEnabled;
          setSoundEnabled(!soundEnabled);
        }}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* VIEW 1: OPERATIONS (Main Command Center) */}
        {currentView === 'OPERATIONS' && (
          <div className="space-y-6">
            
            {/* Autonomous Judge Demo Quick Action Bar */}
            <JudgeDemoBar
              currentScenarioId={activeScenarioId}
              onLoadDelayedScenario={() => handleLoadScenario('04')}
              onInjectDelayedEvidence={handleInjectDelayedEvidence}
              isLoading={isLoading}
              incidentStage={currentIncident?.stage}
            />

            {/* Alert Intake Banner */}
            <AlertBanner
              alert={currentAlert}
              incident={currentIncident}
              onStartAutonomous={handleStartAutonomous}
              onStepInvestigation={handleStepInvestigation}
              isLoading={isLoading}
            />

            {/* Interactive Network Topology with Particle Animation */}
            <NetworkTopologyCanvas
              incident={currentIncident}
            />

            {/* Split Stage: Stream & Forensics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Vertical Agent Activity Stream (5 cols) */}
              <div className="lg:col-span-5">
                <AgentActivityStream
                  incident={currentIncident}
                  isLoading={isLoading}
                />
              </div>

              {/* Right Column: Progressive Evidence Deck & Correlation & Response (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 4 Forensic Surfaces */}
                <EvidenceDeck
                  incident={currentIncident}
                />

                {/* Evidence Correlation & Confidence Dial */}
                <CorrelationHUD
                  incident={currentIncident}
                />

                {/* Simulated Firewall Response & Verification Probe */}
                <ResponseVisualizer
                  incident={currentIncident}
                  onExecuteResponse={handleExecuteResponse}
                  isLoading={isLoading}
                />

                {/* Human Override Trigger Bar */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400">HUMAN-IN-THE-LOOP SAFETY GATE:</span>
                    <p className="text-slate-300 text-[11px]">Intervene to inspect, approve, override, or request reassessment.</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsAuditModalOpen(true)}
                      className="px-3.5 py-1.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/30 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      VIEW AUDIT LEDGER
                    </button>

                    <button
                      onClick={() => {
                        soundFx.click();
                        setIsOverrideModalOpen(true);
                      }}
                      className="px-4 py-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors cursor-pointer font-bold"
                    >
                      OVERRIDE ACTION
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Operation Scenario Matrix Selector */}
            <ScenarioSelector
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={handleLoadScenario}
              isLoading={isLoading}
            />

            {/* Autonomous Capability Matrix HUD */}
            <AgenticPrinciplesHUD
              incident={currentIncident}
            />

          </div>
        )}

        {/* VIEW 2: INVESTIGATION & EVIDENCE */}
        {currentView === 'INVESTIGATION' && (
          <div className="space-y-6">
            <InvestigationGraph
              incident={currentIncident}
            />

            <EvidenceDeck
              incident={currentIncident}
            />

            <CorrelationHUD
              incident={currentIncident}
            />

            <AgenticPrinciplesHUD
              incident={currentIncident}
            />
          </div>
        )}

        {/* VIEW 3: NETWORK TOPOLOGY */}
        {currentView === 'NETWORK' && (
          <div className="space-y-6">
            <NetworkTopologyCanvas
              incident={currentIncident}
            />

            {/* Perimeter Firewall Rules Inspector */}
            <div className="p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30">
              <h3 className="text-sm font-bold font-heading text-cyan-300 tracking-wider mb-2">
                SIMULATED PERIMETER FIREWALL RULE LEDGER
              </h3>
              <p className="text-xs font-mono text-slate-400 mb-4">
                Active drop chains deployed by the autonomous response engine
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-950 border-b border-cyan-500/20 text-slate-400">
                    <tr>
                      <th className="p-3">RULE ID</th>
                      <th className="p-3">IP ADDRESS</th>
                      <th className="p-3">ACTION</th>
                      <th className="p-3">STATUS</th>
                      <th className="p-3">DEPLOYED AT</th>
                      <th className="p-3">ACTIVE PROBE VERIFIED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {firewallRules.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-900/40">
                        <td className="p-3 text-cyan-400">#PERIMETER-{r.id}</td>
                        <td className="p-3 font-bold text-rose-400">{r.ip}</td>
                        <td className="p-3 text-amber-300">{r.action}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleTimeString() : 'N/A'}</td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {r.verified_at ? `✓ VERIFIED (${new Date(r.verified_at).toLocaleTimeString()})` : 'AWAITING VERIFICATION'}
                        </td>
                      </tr>
                    ))}
                    {firewallRules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          Zero active block rules in perimeter table.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: AUDIT LEDGER */}
        {currentView === 'AUDIT' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl aegis-panel aegis-panel-glow border border-cyan-500/30">
              <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20 mb-4">
                <div>
                  <h3 className="text-sm font-bold font-heading text-cyan-300 tracking-wider">
                    COMPLETE INCIDENT AUDIT & REASSESSMENT LEDGER
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    Cryptographic-ready state persistence for regulatory compliance
                  </p>
                </div>

                <button
                  onClick={() => setIsAuditModalOpen(true)}
                  className="px-4 py-2 rounded bg-cyan-500 text-black hover:bg-cyan-400 font-heading font-bold text-xs uppercase tracking-wider cursor-pointer shadow-sm"
                >
                  OPEN AUDIT REPORT EXPORTER
                </button>
              </div>

              {/* State Machine Log */}
              <div className="space-y-2 font-mono text-xs">
                {currentIncident?.states.map((s, idx) => (
                  <div key={idx} className="p-3 rounded bg-slate-900/60 border border-slate-800 flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 text-[10px] text-cyan-400 mb-1">
                        <span>ITERATION {s.iteration}</span>
                        <span>&bull;</span>
                        <span>PHASE: {s.current_phase}</span>
                        <span>&bull;</span>
                        <code className="text-amber-300 font-bold">{s.selected_tool}()</code>
                      </div>
                      <p className="text-slate-200">{s.observation}</p>
                      <p className="text-[10px] text-slate-500 italic mt-1">&ldquo;{s.reasoning_text}&rdquo;</p>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <AgenticPrinciplesHUD
              incident={currentIncident}
            />
          </div>
        )}

      </main>

      {/* Human Override Modal */}
      <HumanOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        targetIp={currentIncident?.attacker_ip || '10.0.0.25'}
        onConfirmOverride={handleConfirmOverride}
        isLoading={isLoading}
      />

      {/* Audit Report Modal */}
      <AuditReportModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        incident={currentIncident}
      />

      {/* Footer */}
      <footer className="w-full border-t border-cyan-500/10 py-3 px-6 text-center text-[10px] font-mono text-slate-500 bg-[#04060a]">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AEGIS // AUTONOMOUS SOC &bull; NEXT-GEN CYBER COMMAND CENTER</span>
          <span className="text-cyan-400">100% SAFE LOCAL SYNTHETIC SANDBOX &bull; ZERO REAL NETWORK ACTIONS</span>
          <span>PERSISTENCE: SQLITE (WAL MODE)</span>
        </div>
      </footer>

    </div>
  );
}

export default App;
