import json
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.database.models import (
    Alert, Asset, Vulnerability, PacketMetadata, ServerLog,
    FirewallRule, HumanOverride, Incident, ToolCall, ActionRecord
)

class SyntheticSecurityTools:
    """
    13 Safe Simulated Security Operations Tools.
    All operations are strictly confined to the synthetic local SQLite database.
    Zero interaction with actual host network or OS firewall.
    """

    def __init__(self, db: Session, incident_id: Optional[str] = None):
        self.db = db
        self.incident_id = incident_id

    def _log_tool_call(self, tool_name: str, params: Dict[str, Any], result: Dict[str, Any], status: str = "SUCCESS", error: Optional[str] = None):
        if self.incident_id:
            call = ToolCall(
                incident_id=self.incident_id,
                tool_name=tool_name,
                input_params=json.dumps(params),
                output_result=json.dumps(result),
                status=status,
                error_message=error,
                timestamp=datetime.datetime.utcnow()
            )
            self.db.add(call)
            self.db.commit()

    # 1. get_alert
    def get_alert(self, alert_id: str) -> Dict[str, Any]:
        alert = self.db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            res = {"error": f"Alert with ID '{alert_id}' not found."}
            self._log_tool_call("get_alert", {"alert_id": alert_id}, res, status="FAILED", error="Not found")
            return res

        res = {
            "id": alert.id,
            "timestamp": alert.timestamp.isoformat() if alert.timestamp else None,
            "rule_id": alert.rule_id,
            "signature": alert.signature,
            "category": alert.category,
            "severity": alert.severity,
            "source_ip": alert.source_ip,
            "target_ip": alert.target_ip,
            "target_port": alert.target_port,
            "raw_payload": alert.raw_payload,
            "scenario_id": alert.scenario_id
        }
        self._log_tool_call("get_alert", {"alert_id": alert_id}, res)
        return res

    # 2. get_asset
    def get_asset(self, ip: str) -> Dict[str, Any]:
        asset = self.db.query(Asset).filter(Asset.ip == ip).first()
        if not asset:
            res = {"error": f"Asset with IP '{ip}' not found in inventory."}
            self._log_tool_call("get_asset", {"ip": ip}, res, status="FAILED", error="Asset not found")
            return res

        res = {
            "ip": asset.ip,
            "hostname": asset.hostname,
            "os": asset.os,
            "running_service": asset.running_service,
            "service_version": asset.service_version,
            "port": asset.port,
            "criticality": asset.criticality,
            "environment": asset.environment,
            "status": "ONLINE / PORT OPEN"
        }
        self._log_tool_call("get_asset", {"ip": ip}, res)
        return res

    # 3. get_vulnerabilities
    def get_vulnerabilities(self, service_name: str, version: Optional[str] = None) -> Dict[str, Any]:
        def parse_ver(v_str: str):
            parts = []
            for p in v_str.strip().split("."):
                num = "".join(c for c in p if c.isdigit())
                parts.append(int(num) if num else 0)
            return tuple(parts)

        def is_in_range(v_target: str, spec: str) -> bool:
            spec = spec.strip()
            if spec == "*" or spec.lower() == "all":
                return True
            if "-" in spec:
                p_min, p_max = spec.split("-", 1)
                try:
                    return parse_ver(p_min) <= parse_ver(v_target) <= parse_ver(p_max)
                except Exception:
                    return False
            return spec in v_target or v_target in spec

        query = self.db.query(Vulnerability).filter(Vulnerability.service_name.ilike(f"%{service_name}%"))
        vulns = query.all()
        matched = []
        for v in vulns:
            is_match = False
            if version:
                affected_specs = [s.strip() for s in v.affected_versions.split(",")]
                if any(is_in_range(version, s) for s in affected_specs):
                    is_match = True
            else:
                is_match = True

            if is_match:
                matched.append({
                    "cve_id": v.cve_id,
                    "service_name": v.service_name,
                    "affected_versions": v.affected_versions,
                    "cvss_score": v.cvss_score,
                    "severity": v.severity,
                    "description": v.description,
                    "exploit_available": v.exploit_available
                })

        res = {
            "service": service_name,
            "queried_version": version,
            "vulnerabilities_found": len(matched),
            "records": matched
        }
        self._log_tool_call("get_vulnerabilities", {"service_name": service_name, "version": version}, res)
        return res

    # 4. get_packet_metadata
    def get_packet_metadata(self, alert_id: str) -> Dict[str, Any]:
        pkt = self.db.query(PacketMetadata).filter(PacketMetadata.alert_id == alert_id).first()
        if not pkt:
            # Fallback to any packet for this scenario alert
            pkt = self.db.query(PacketMetadata).first()

        if not pkt:
            res = {"error": f"No synthetic packet telemetry found for alert '{alert_id}'."}
            self._log_tool_call("get_packet_metadata", {"alert_id": alert_id}, res, status="FAILED")
            return res

        res = {
            "id": pkt.id,
            "alert_id": pkt.alert_id,
            "protocol": pkt.protocol,
            "source_ip": pkt.source_ip,
            "target_ip": pkt.target_ip,
            "target_port": pkt.target_port,
            "packet_size": pkt.packet_size,
            "payload_sample": pkt.payload_sample,
            "tcp_flags": pkt.flags,
            "indicators": pkt.indicators
        }
        self._log_tool_call("get_packet_metadata", {"alert_id": alert_id}, res)
        return res

    # 5. get_server_logs
    def get_server_logs(self, asset_ip: str, timeframe: str = "last_1h", include_delayed: bool = False) -> Dict[str, Any]:
        q = self.db.query(ServerLog).filter(ServerLog.asset_ip == asset_ip)
        if not include_delayed:
            q = q.filter(ServerLog.is_delayed == False)
        logs = q.order_by(ServerLog.timestamp.desc()).limit(20).all()

        log_records = [
            {
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "event_type": l.event_type,
                "process_name": l.process_name,
                "command_line": l.command_line,
                "http_status": l.http_status,
                "details": l.details,
                "is_delayed": l.is_delayed
            }
            for l in logs
        ]

        res = {
            "asset_ip": asset_ip,
            "timeframe": timeframe,
            "total_logs": len(log_records),
            "logs": log_records
        }
        self._log_tool_call("get_server_logs", {"asset_ip": asset_ip, "timeframe": timeframe, "include_delayed": include_delayed}, res)
        return res

    # 6. search_related_logs
    def search_related_logs(self, query: str, asset_ip: Optional[str] = None) -> Dict[str, Any]:
        q = self.db.query(ServerLog)
        if asset_ip:
            q = q.filter(ServerLog.asset_ip == asset_ip)
        
        matches = []
        for l in q.all():
            text_repr = f"{l.event_type} {l.process_name or ''} {l.command_line or ''} {l.details or ''}".lower()
            if query.lower() in text_repr:
                matches.append({
                    "id": l.id,
                    "event_type": l.event_type,
                    "process_name": l.process_name,
                    "command_line": l.command_line,
                    "details": l.details,
                    "timestamp": l.timestamp.isoformat() if l.timestamp else None
                })

        res = {
            "query": query,
            "matches_count": len(matches),
            "matches": matches
        }
        self._log_tool_call("search_related_logs", {"query": query, "asset_ip": asset_ip}, res)
        return res

    # 7. get_recent_activity
    def get_recent_activity(self, asset_ip: str) -> Dict[str, Any]:
        recent_logs = self.db.query(ServerLog).filter(ServerLog.asset_ip == asset_ip).order_by(ServerLog.timestamp.desc()).limit(5).all()
        activity = [
            f"[{l.timestamp.strftime('%H:%M:%S') if l.timestamp else 'NOW'}] {l.event_type.upper()}: {l.process_name or l.details}"
            for l in recent_logs
        ]
        res = {
            "asset_ip": asset_ip,
            "recent_events": activity,
            "status": "MONITORING_ACTIVE"
        }
        self._log_tool_call("get_recent_activity", {"asset_ip": asset_ip}, res)
        return res

    # 8. get_firewall_status
    def get_firewall_status(self) -> Dict[str, Any]:
        rules = self.db.query(FirewallRule).all()
        rules_list = [
            {
                "id": r.id,
                "ip": r.ip,
                "action": r.action,
                "status": r.status,
                "failure_injected": r.failure_injected,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "verified_at": r.verified_at.isoformat() if r.verified_at else None
            }
            for r in rules
        ]
        res = {
            "active_rules_count": len(rules_list),
            "rules": rules_list,
            "firewall_engine": "SIMULATED_PERIMETER_IPTABLES_V4"
        }
        self._log_tool_call("get_firewall_status", {}, res)
        return res

    # 9. block_ip
    def block_ip(self, ip: str, simulate_failure: bool = False) -> Dict[str, Any]:
        rule = self.db.query(FirewallRule).filter(FirewallRule.ip == ip).first()
        if not rule:
            rule = FirewallRule(
                ip=ip,
                action="DROP",
                status="ACTIVE" if not simulate_failure else "FAILED",
                failure_injected=simulate_failure,
                created_at=datetime.datetime.utcnow()
            )
            self.db.add(rule)
        else:
            rule.status = "ACTIVE" if not simulate_failure else "FAILED"
            rule.failure_injected = simulate_failure

        self.db.commit()

        # Record action in incident
        if self.incident_id:
            act = ActionRecord(
                incident_id=self.incident_id,
                action_type="BLOCK_IP",
                target_ip=ip,
                status="EXECUTED" if not simulate_failure else "FAILED",
                result_message=f"Synthetic rule added to drop traffic from {ip}" if not simulate_failure else "Simulated rule deployment timed out on perimeter edge-01",
                verified=False
            )
            self.db.add(act)
            self.db.commit()

        if simulate_failure:
            res = {
                "success": False,
                "ip": ip,
                "error": "Perimeter firewall agent returned timeout (Error code: EDGE_TIMEOUT_504)",
                "status": "FAILED"
            }
            self._log_tool_call("block_ip", {"ip": ip, "simulate_failure": simulate_failure}, res, status="FAILED", error="Edge timeout")
            return res

        res = {
            "success": True,
            "ip": ip,
            "action": "DROP",
            "status": "ACTIVE",
            "message": f"Source IP {ip} successfully added to simulated firewall perimeter table."
        }
        self._log_tool_call("block_ip", {"ip": ip, "simulate_failure": simulate_failure}, res)
        return res

    # 10. unblock_ip
    def unblock_ip(self, ip: str) -> Dict[str, Any]:
        rule = self.db.query(FirewallRule).filter(FirewallRule.ip == ip).first()
        if rule:
            self.db.delete(rule)
            self.db.commit()
            res = {"success": True, "ip": ip, "message": f"IP {ip} removed from firewall."}
        else:
            res = {"success": True, "ip": ip, "message": f"IP {ip} was not blocked."}
        self._log_tool_call("unblock_ip", {"ip": ip}, res)
        return res

    # 11. verify_block (Active probe simulation)
    def verify_block(self, ip: str) -> Dict[str, Any]:
        """
        Simulates an active verification probe by sending a test packet
        from the blocked IP towards the target asset to confirm enforcement.
        """
        rule = self.db.query(FirewallRule).filter(FirewallRule.ip == ip).first()

        # If rule exists, is ACTIVE, and failure is not injected, the probe is DENIED (verification successful)
        if rule and rule.status == "ACTIVE" and not rule.failure_injected:
            rule.verified_at = datetime.datetime.utcnow()
            
            # Update action record
            if self.incident_id:
                act = self.db.query(ActionRecord).filter(
                    ActionRecord.incident_id == self.incident_id,
                    ActionRecord.target_ip == ip
                ).order_by(ActionRecord.id.desc()).first()
                if act:
                    act.verified = True
                    act.verification_details = "Simulated follow-up probe: SYN packet REJECTED / DROPPED by perimeter."

            self.db.commit()

            res = {
                "verified": True,
                "ip": ip,
                "probe_result": "CONNECTION_REFUSED / PACKET_DROPPED",
                "details": "Simulated follow-up connection from source was intercepted and dropped by simulated firewall.",
                "status": "VERIFIED_BLOCKED"
            }
            self._log_tool_call("verify_block", {"ip": ip}, res)
            return res
        else:
            # Failed verification
            res = {
                "verified": False,
                "ip": ip,
                "probe_result": "CONNECTION_SUCCEEDED",
                "details": "Simulated probe packet reached target asset! Firewall rule is INACTIVE or failed to take effect.",
                "status": "VERIFICATION_FAILED"
            }
            self._log_tool_call("verify_block", {"ip": ip}, res, status="FAILED", error="Probe connection succeeded")
            return res

    # 12. get_investigation_state
    def get_investigation_state(self, incident_id: str) -> Dict[str, Any]:
        inc = self.db.query(Incident).filter(Incident.id == incident_id).first()
        if not inc:
            return {"error": f"Incident '{incident_id}' not found."}

        states = self.db.query(InvestigationState).filter(InvestigationState.incident_id == incident_id).order_by(InvestigationState.iteration.asc()).all()
        evidence = self.db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).all()
        actions = self.db.query(ActionRecord).filter(ActionRecord.incident_id == incident_id).all()
        overrides = self.db.query(HumanOverride).filter(HumanOverride.incident_id == incident_id).all()

        res = {
            "incident_id": inc.id,
            "title": inc.title,
            "stage": inc.stage,
            "status": inc.status,
            "initial_assessment": inc.initial_assessment,
            "current_assessment": inc.current_assessment,
            "confidence": inc.confidence,
            "reasoning_summary": inc.reasoning_summary,
            "iterations_count": len(states),
            "evidence_count": len(evidence),
            "actions_count": len(actions),
            "overrides_count": len(overrides),
            "latest_phase": states[-1].current_phase if states else "INTAKE"
        }
        self._log_tool_call("get_investigation_state", {"incident_id": incident_id}, res)
        return res

    # 13. get_human_override
    def get_human_override(self, incident_id: str) -> Dict[str, Any]:
        override = self.db.query(HumanOverride).filter(HumanOverride.incident_id == incident_id).order_by(HumanOverride.id.desc()).first()
        if not override:
            res = {"has_override": False, "decision": "NONE", "analyst_notes": None}
        else:
            res = {
                "has_override": True,
                "action_proposed": override.action_proposed,
                "decision": override.decision,
                "analyst_name": override.analyst_name,
                "analyst_notes": override.analyst_notes,
                "timestamp": override.timestamp.isoformat() if override.timestamp else None
            }
        self._log_tool_call("get_human_override", {"incident_id": incident_id}, res)
        return res
