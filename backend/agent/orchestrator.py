import json
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.database.models import (
    Incident, InvestigationState, EvidenceRecord, Alert, Asset,
    Vulnerability, PacketMetadata, ServerLog, FirewallRule,
    HumanOverride, ActionRecord
)
from backend.tools.synthetic_tools import SyntheticSecurityTools
from backend.agent.reasoning import ReasoningEngine

class AgentOrchestrator:
    """
    Autonomous SOC Agent Orchestrator.
    Implements iterative agentic loop:
    OBSERVE -> ASSESS GAPS -> SELECT TOOL -> EXECUTE -> UPDATE STATE -> CORRELATE -> ASSESS -> RESPOND -> OBSERVE RESPONSE -> VERIFY -> REPLAN.
    """

    def __init__(self, db: Session, incident_id: str):
        self.db = db
        self.incident_id = incident_id
        self.tools = SyntheticSecurityTools(db, incident_id)
        self.reasoning_engine = ReasoningEngine()

    def get_incident(self) -> Incident:
        inc = self.db.query(Incident).filter(Incident.id == self.incident_id).first()
        if not inc:
            raise ValueError(f"Incident {self.incident_id} not found.")
        return inc

    def run_next_step(self) -> Dict[str, Any]:
        """
        Executes one discrete step in the agentic decision cycle.
        Returns the step details, observation, updated evidence, and current stage.
        """
        inc = self.get_incident()
        alert_data = self.tools.get_alert(inc.alert_id)
        existing_evidence = self.db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == inc.id).all()
        history = self.db.query(InvestigationState).filter(InvestigationState.incident_id == inc.id).order_by(InvestigationState.iteration.asc()).all()
        latest_action = self.db.query(ActionRecord).filter(ActionRecord.incident_id == inc.id).order_by(ActionRecord.id.desc()).first()

        latest_action_failed = False
        if latest_action and latest_action.status == "FAILED" and not latest_action.verified:
            latest_action_failed = True

        evidence_by_cat = {e.category: json.loads(e.raw_data) if e.raw_data else {} for e in existing_evidence}

        iteration = len(history) + 1

        # Check if we are already verified and closed
        if inc.stage in ("VERIFIED", "CLOSED") and inc.status == "CLOSED":
            return {
                "step_completed": "ALREADY_CLOSED",
                "incident_id": inc.id,
                "stage": inc.stage,
                "status": inc.status,
                "assessment": inc.current_assessment,
                "confidence": inc.confidence
            }

        # 1. ASSESS KNOWLEDGE GAPS & SELECT TOOL
        gap_info = self.reasoning_engine.assess_knowledge_gaps(
            alert=alert_data,
            known_evidence=[{"category": e.category, "title": e.title} for e in existing_evidence],
            investigation_history=[{"phase": h.current_phase, "tool": h.selected_tool} for h in history]
        )

        decision = self.reasoning_engine.select_next_step(
            alert=alert_data,
            evidence_by_cat=evidence_by_cat,
            gaps=gap_info.get("gaps", []),
            latest_action_failed=latest_action_failed
        )

        selected_tool = decision["tool"]
        tool_params = decision["params"]
        rationale = decision["reasoning"]

        observation_text = ""
        evidence_created = None

        # 2. EXECUTE CHOSEN TOOL
        if selected_tool == "get_asset":
            inc.stage = "INVESTIGATING"
            asset_res = self.tools.get_asset(tool_params["ip"])
            observation_text = f"Asset identified: {asset_res.get('hostname')} running {asset_res.get('running_service')} v{asset_res.get('service_version')} on port {asset_res.get('port')} (Criticality: {asset_res.get('criticality')})"
            ev = EvidenceRecord(
                incident_id=inc.id,
                category="ASSET",
                source_tool="get_asset",
                status="CONFIRMED",
                title=f"{asset_res.get('hostname')} ({asset_res.get('ip')})",
                summary=f"Service: {asset_res.get('running_service')} {asset_res.get('service_version')} / Port {asset_res.get('port')} OPEN",
                raw_data=json.dumps(asset_res)
            )
            self.db.add(ev)
            evidence_created = "ASSET"

        elif selected_tool == "get_vulnerabilities":
            vuln_res = self.tools.get_vulnerabilities(tool_params["service_name"], tool_params.get("version"))
            count = vuln_res.get("vulnerabilities_found", 0)
            if count > 0:
                top_cve = vuln_res["records"][0]
                observation_text = f"Vulnerability match found: {top_cve['cve_id']} (CVSS {top_cve['cvss_score']} {top_cve['severity']}) - {top_cve['description']}"
                ev_status = "SUPPORTING"
            else:
                observation_text = f"No active CVE match for version '{tool_params.get('version')}'. Application appears patched or resilient."
                ev_status = "CONTRADICTING"

            ev = EvidenceRecord(
                incident_id=inc.id,
                category="VULNERABILITY",
                source_tool="get_vulnerabilities",
                status=ev_status,
                title="CVE Assessment",
                summary=f"{count} vulnerability match(es) for {tool_params['service_name']} {tool_params.get('version', '')}",
                raw_data=json.dumps(vuln_res)
            )
            self.db.add(ev)
            evidence_created = "VULNERABILITY"

        elif selected_tool == "get_packet_metadata":
            pkt_res = self.tools.get_packet_metadata(tool_params["alert_id"])
            indicators = pkt_res.get("indicators", "None")
            is_exploit = "OGNL" in indicators or "RCE" in indicators or "SHELL" in indicators
            if is_exploit:
                observation_text = f"Packet inspection confirmed weaponized payload: {indicators} [Flags: {pkt_res.get('tcp_flags')}]"
                ev_status = "SUPPORTING"
            else:
                observation_text = f"Packet telemetry indicates benign probe or non-weaponized syntax: {indicators}"
                ev_status = "CONTRADICTING"

            ev = EvidenceRecord(
                incident_id=inc.id,
                category="NETWORK",
                source_tool="get_packet_metadata",
                status=ev_status,
                title="Packet Payload Telemetry",
                summary=f"Protocol: {pkt_res.get('protocol')} | Indicators: {indicators}",
                raw_data=json.dumps(pkt_res)
            )
            self.db.add(ev)
            evidence_created = "NETWORK"

        elif selected_tool == "get_server_logs":
            logs_res = self.tools.get_server_logs(tool_params["asset_ip"], include_delayed=False)
            logs = logs_res.get("logs", [])
            has_proc = any(l.get("event_type") == "process_creation" for l in logs)
            has_403 = any(l.get("http_status") == 403 for l in logs)
            
            if has_proc:
                proc_log = next(l for l in logs if l.get("event_type") == "process_creation")
                observation_text = f"Host process execution detected: {proc_log.get('command_line')}"
                ev_status = "SUPPORTING"
            elif has_403:
                observation_text = "Host application returned HTTP 403 Forbidden; request dropped before execution."
                ev_status = "CONTRADICTING"
            else:
                observation_text = "Host telemetry recorded standard HTTP requests; no child process execution found."
                ev_status = "CONTRADICTING"

            ev = EvidenceRecord(
                incident_id=inc.id,
                category="SERVER",
                source_tool="get_server_logs",
                status=ev_status,
                title="Server-Side Host Telemetry",
                summary=observation_text,
                raw_data=json.dumps(logs_res)
            )
            self.db.add(ev)
            evidence_created = "SERVER"

        elif selected_tool == "CORRELATE":
            inc.stage = "CORRELATING"
            # Multi-source correlation
            corr = self.reasoning_engine.correlate_evidence(
                alert=alert_data,
                evidence_by_cat=evidence_by_cat
            )
            inc.current_assessment = corr["outcome"]
            inc.confidence = corr["confidence"]
            inc.reasoning_summary = corr["reasoning"]
            observation_text = f"Correlation Complete -> Verdict: {corr['outcome']} ({corr['confidence']}% Confidence). {corr['reasoning']}"

            if inc.initial_assessment == "PENDING_EVALUATION" or not inc.initial_assessment:
                inc.initial_assessment = corr["outcome"]

            # Next phase determination
            if corr["outcome"] == "ATTACK_VERIFIED":
                inc.stage = "ASSESSED" # Ready for response
            elif corr["outcome"] in ("ATTACK_FAILED", "FALSE_POSITIVE"):
                inc.stage = "CLOSED"
                inc.status = "CLOSED"

        elif selected_tool == "block_ip":
            # Check for simulated response failure scenario
            simulate_failure = inc.scenario_id == "05" and latest_action_failed is False
            
            inc.stage = "RESPONDING"
            block_res = self.tools.block_ip(tool_params["ip"], simulate_failure=simulate_failure)
            
            if block_res.get("success"):
                observation_text = f"Simulated firewall rule deployed: DROP traffic from {tool_params['ip']}."
                # Automatically trigger verification probe in next step
            else:
                observation_text = f"Simulated firewall rule deployment failed: {block_res.get('error')}."
                inc.stage = "RESPONSE_FAILED"

        # Record investigation state
        state_record = InvestigationState(
            incident_id=inc.id,
            iteration=iteration,
            current_phase=inc.stage,
            knowledge_gaps=json.dumps(gap_info.get("gaps", [])),
            selected_tool=selected_tool,
            tool_input=json.dumps(tool_params),
            observation=observation_text,
            reasoning_text=rationale,
            timestamp=datetime.datetime.utcnow()
        )
        self.db.add(state_record)
        self.db.commit()

        # Check if we should execute response or verification
        if inc.stage == "ASSESSED" and inc.current_assessment == "ATTACK_VERIFIED":
            # Check human override
            override = self.tools.get_human_override(inc.id)
            if override["has_override"] and override["decision"] == "OVERRIDDEN":
                inc.stage = "OVERRIDDEN"
                inc.status = "OVERRIDDEN"
                inc.reasoning_summary = f"Agent recommended BLOCK {alert_data['source_ip']}, but Human Analyst overrode and withheld action: {override.get('analyst_notes')}"
                self.db.commit()

        return {
            "iteration": iteration,
            "stage": inc.stage,
            "status": inc.status,
            "tool_executed": selected_tool,
            "params": tool_params,
            "observation": observation_text,
            "reasoning": rationale,
            "evidence_category": evidence_created,
            "assessment": inc.current_assessment,
            "confidence": inc.confidence,
            "mode": self.reasoning_engine.mode
        }

    def execute_response_and_verify(self, force_retry: bool = False) -> Dict[str, Any]:
        """
        Executes simulated firewall response and verifies it via simulated follow-up probe.
        Handles replanning if response fails.
        """
        inc = self.get_incident()
        alert_data = self.tools.get_alert(inc.alert_id)
        attacker_ip = inc.attacker_ip or alert_data.get("source_ip", "10.0.0.25")

        # Check human override
        override = self.tools.get_human_override(inc.id)
        if override["has_override"] and override["decision"] == "OVERRIDDEN":
            return {
                "success": False,
                "action": "WITHHELD",
                "message": "Human analyst has OVERRIDDEN this action. Firewall rule was withheld.",
                "verified": False,
                "stage": "OVERRIDDEN"
            }

        # Check if failure scenario (scenario 05) and not yet retried
        simulate_failure = (inc.scenario_id == "05" and not force_retry)
        
        # 1. Execute Block Action
        inc.stage = "RESPONDING"
        self.db.commit()
        
        block_res = self.tools.block_ip(attacker_ip, simulate_failure=simulate_failure)
        
        if not block_res.get("success"):
            # Action failed!
            inc.stage = "RESPONSE_FAILED"
            self.db.commit()
            return {
                "success": False,
                "action": "BLOCK_IP",
                "ip": attacker_ip,
                "error": block_res.get("error"),
                "stage": "RESPONSE_FAILED",
                "verified": False,
                "message": "Firewall edge timeout. Replanning required."
            }

        # 2. Active Verification Phase (Probe Connection)
        probe_res = self.tools.verify_block(attacker_ip)
        
        if probe_res.get("verified"):
            inc.stage = "VERIFIED"
            inc.status = "MITIGATED"
            self.db.commit()
            return {
                "success": True,
                "action": "BLOCK_IP",
                "ip": attacker_ip,
                "verified": True,
                "probe_result": probe_res["probe_result"],
                "message": "Block verified! Simulated probe traffic from source IP was intercepted and rejected.",
                "stage": "VERIFIED"
            }
        else:
            inc.stage = "VERIFICATION_FAILED"
            self.db.commit()
            return {
                "success": True,
                "action": "BLOCK_IP",
                "ip": attacker_ip,
                "verified": False,
                "probe_result": probe_res["probe_result"],
                "message": "Verification failed: Simulated probe packet was not blocked.",
                "stage": "VERIFICATION_FAILED"
            }

    def trigger_reassessment(self) -> Dict[str, Any]:
        """
        Delayed Evidence Reassessment:
        Agent observes newly arrived server telemetry, reopens incident, flips verdict to ATTACK_VERIFIED,
        executes block, and verifies.
        """
        inc = self.get_incident()
        alert_data = self.tools.get_alert(inc.alert_id)
        
        # 1. Reopen incident
        inc.stage = "REOPENED"
        inc.status = "ACTIVE"
        
        # 2. Query newly emerged server logs (including delayed)
        logs_res = self.tools.get_server_logs(inc.target_asset_ip, include_delayed=True)
        
        # Add new EvidenceRecord
        ev = EvidenceRecord(
            incident_id=inc.id,
            category="SERVER",
            source_tool="get_server_logs",
            status="SUPPORTING",
            title="DELAYED TELEMETRY DETECTED",
            summary="Late-arriving EDR telemetry: suspicious_process_created (cmd_simulated / reverse interactive shell).",
            raw_data=json.dumps(logs_res)
        )
        self.db.add(ev)

        # 3. Correlate with delayed evidence present
        existing_evidence = self.db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == inc.id).all()
        evidence_by_cat = {e.category: json.loads(e.raw_data) if e.raw_data else {} for e in existing_evidence}
        
        corr = self.reasoning_engine.correlate_evidence(
            alert=alert_data,
            evidence_by_cat=evidence_by_cat,
            delayed_evidence_present=True
        )

        inc.current_assessment = corr["outcome"] # ATTACK_VERIFIED
        inc.confidence = corr["confidence"] # 94%
        inc.reasoning_summary = f"REASSESSMENT TRIGGERED BY DELAYED TELEMETRY: Host process spawning confirmed. Previous verdict of {inc.initial_assessment} overturned to ATTACK_VERIFIED."
        inc.stage = "ASSESSED"

        # Record InvestigationState for audit trail
        history_count = self.db.query(InvestigationState).filter(InvestigationState.incident_id == inc.id).count()
        state_record = InvestigationState(
            incident_id=inc.id,
            iteration=history_count + 1,
            current_phase="REASSESSMENT",
            knowledge_gaps="[]",
            selected_tool="reassess_with_delayed_telemetry",
            tool_input=json.dumps({"delayed_logs_checked": True}),
            observation="New server-side execution telemetry observed. Previous defense assumption invalidated.",
            reasoning_text="Delayed host evidence proves attacker achieved shell execution. Reopening incident and upgrading response posture.",
            timestamp=datetime.datetime.utcnow()
        )
        self.db.add(state_record)
        self.db.commit()

        return {
            "incident_id": inc.id,
            "reopened": True,
            "initial_assessment": inc.initial_assessment,
            "new_assessment": inc.current_assessment,
            "new_confidence": inc.confidence,
            "reasoning": inc.reasoning_summary,
            "stage": inc.stage
        }

    def run_full_autonomous_loop(self, max_steps: int = 10) -> List[Dict[str, Any]]:
        """
        Runs the full autonomous loop until correlation, response, and verification are completed.
        """
        step_logs = []
        for _ in range(max_steps):
            inc = self.get_incident()
            if inc.stage in ("CLOSED", "VERIFIED", "OVERRIDDEN") and inc.status in ("CLOSED", "MITIGATED", "OVERRIDDEN"):
                break

            if inc.stage == "ASSESSED" and inc.current_assessment == "ATTACK_VERIFIED":
                override = self.tools.get_human_override(inc.id)
                if override.get("has_override") and override.get("decision") == "OVERRIDDEN":
                    inc.stage = "OVERRIDDEN"
                    inc.status = "OVERRIDDEN"
                    self.db.commit()
                    step_logs.append({
                        "stage": "OVERRIDDEN",
                        "tool_executed": "human_override_withheld",
                        "observation": "Human analyst intervened: BLOCK action withheld by policy override.",
                        "verified": False
                    })
                    break

                # Execute response & verification
                resp = self.execute_response_and_verify()
                step_logs.append({
                    "stage": resp["stage"],
                    "tool_executed": "block_and_verify",
                    "observation": resp["message"],
                    "verified": resp.get("verified", False)
                })
                # If failed response in scenario 05, agent replans and retries
                if resp["stage"] == "RESPONSE_FAILED":
                    retry_resp = self.execute_response_and_verify(force_retry=True)
                    step_logs.append({
                        "stage": retry_resp["stage"],
                        "tool_executed": "replan_and_retry_block",
                        "observation": f"REPLANNING COMPLETE: {retry_resp['message']}",
                        "verified": retry_resp.get("verified", False)
                    })
                break

            step_res = self.run_next_step()
            step_logs.append(step_res)

        return step_logs
