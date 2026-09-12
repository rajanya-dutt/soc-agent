import os
import json
from typing import Dict, Any, List, Optional
import httpx

class ReasoningEngine:
    """
    Dual Reasoning Engine:
    - Mode A: LLM Agent (when OPENAI_API_KEY is available in environment)
    - Mode B: Deterministic Heuristic Sandbox (when no key is set or on fallback)
    Produces concise, audit-safe operational reasoning for SOC analysts.
    """

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    @property
    def mode(self) -> str:
        return "LLM AGENT" if self.api_key else "DETERMINISTIC SANDBOX"

    def assess_knowledge_gaps(
        self,
        alert: Dict[str, Any],
        known_evidence: List[Dict[str, Any]],
        investigation_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Determines what critical evidence is still missing before an attack outcome can be decided.
        """
        if self.api_key:
            try:
                return self._llm_assess_gaps(alert, known_evidence, investigation_history)
            except Exception:
                # Graceful deterministic fallback
                return self._heuristic_assess_gaps(alert, known_evidence, investigation_history)
        return self._heuristic_assess_gaps(alert, known_evidence, investigation_history)

    def select_next_step(
        self,
        alert: Dict[str, Any],
        evidence_by_cat: Dict[str, Any],
        gaps: List[str],
        latest_action_failed: bool = False
    ) -> Dict[str, Any]:
        """
        Selects the next optimal security tool based on evidence gaps.
        """
        # Dynamic tool selection:
        # Priority 1: If Asset is unknown -> get_asset
        if "ASSET" not in evidence_by_cat or not evidence_by_cat["ASSET"]:
            return {
                "tool": "get_asset",
                "params": {"ip": alert["target_ip"]},
                "reasoning": "Asset identity and port exposure must be confirmed before vulnerability correlation."
            }

        # Priority 2: If Vulnerability unresolved -> get_vulnerabilities
        if "VULNERABILITY" not in evidence_by_cat or not evidence_by_cat["VULNERABILITY"]:
            asset_info = evidence_by_cat["ASSET"]
            service = asset_info.get("running_service", "Unknown")
            version = asset_info.get("service_version", "Unknown")
            return {
                "tool": "get_vulnerabilities",
                "params": {"service_name": service, "version": version},
                "reasoning": f"Querying CVE catalog for service '{service}' version '{version}' to verify vulnerability applicability."
            }

        # Priority 3: If Packet metadata unverified -> get_packet_metadata
        if "NETWORK" not in evidence_by_cat or not evidence_by_cat["NETWORK"]:
            return {
                "tool": "get_packet_metadata",
                "params": {"alert_id": alert["id"]},
                "reasoning": "Inspecting raw packet payloads and TCP flags to verify actual exploit delivery signature."
            }

        # Priority 4: If Server logs unverified -> get_server_logs
        if "SERVER" not in evidence_by_cat or not evidence_by_cat["SERVER"]:
            return {
                "tool": "get_server_logs",
                "params": {"asset_ip": alert["target_ip"], "timeframe": "last_1h", "include_delayed": False},
                "reasoning": "Checking host process executions and HTTP status codes to determine if command execution occurred."
            }

        # Priority 5: If previous block failed -> replan with retry
        if latest_action_failed:
            return {
                "tool": "block_ip",
                "params": {"ip": alert["source_ip"], "simulate_failure": False},
                "reasoning": "Previous perimeter block encountered edge timeout. Replanning with secondary route."
            }

        # All evidence collected -> ready for correlation
        return {
            "tool": "CORRELATE",
            "params": {},
            "reasoning": "All essential evidence dimensions gathered. Proceeding to multi-source evidence correlation."
        }

    def correlate_evidence(
        self,
        alert: Dict[str, Any],
        evidence_by_cat: Dict[str, Any],
        delayed_evidence_present: bool = False
    ) -> Dict[str, Any]:
        """
        Correlates multi-source evidence to calculate confidence score and attack outcome.
        Audit-safe concise justification.
        """
        asset = evidence_by_cat.get("ASSET", {})
        vuln = evidence_by_cat.get("VULNERABILITY", {})
        network = evidence_by_cat.get("NETWORK", {})
        server = evidence_by_cat.get("SERVER", {})

        score = 0
        supporting = []
        contradicting = []

        # 1. Asset service exposure check
        port_open = asset.get("status") == "ONLINE / PORT OPEN" or asset.get("port") == alert.get("target_port")
        if port_open:
            score += 20
            supporting.append(f"Target port {alert.get('target_port')} exposed and hosting {asset.get('running_service')}")
        else:
            contradicting.append("Target port is filtered or service not active")

        # 2. Vulnerability match check
        vuln_count = vuln.get("vulnerabilities_found", 0)
        cve_records = vuln.get("records", [])
        if vuln_count > 0:
            score += 25
            cve_ids = ", ".join([c["cve_id"] for c in cve_records[:2]])
            supporting.append(f"Known exploitable CVE matched target version: {cve_ids}")
        else:
            contradicting.append(f"Application {asset.get('running_service')} {asset.get('service_version')} is patched or unvulnerable")

        # 3. Packet exploit indicators
        indicators = network.get("indicators", "")
        payload = network.get("payload_sample", "")
        has_exploit_traffic = (
            "OGNL" in indicators or 
            "RCE" in indicators or 
            "exploit" in indicators.lower() or 
            "payload" in indicators.lower()
        )
        is_benign_traffic = "benign" in indicators.lower() or "normal" in payload.lower()

        if has_exploit_traffic and not is_benign_traffic:
            score += 25
            supporting.append(f"Deep packet inspection verified weaponized exploit payload: {indicators}")
        elif is_benign_traffic:
            contradicting.append("Packet payload analysis revealed benign test traffic")
        else:
            supporting.append("Anomalous packet traffic observed")
            score += 10

        # 4. Server-side host execution
        logs = server.get("logs", [])
        server_exec = any(
            l.get("event_type") == "process_creation" or
            "cmd" in str(l.get("command_line", "")).lower() or
            "bash" in str(l.get("command_line", "")).lower() or
            "whoami" in str(l.get("command_line", "")).lower() or
            "spawn" in str(l.get("command_line", "")).lower()
            for l in logs
        )
        server_blocked_or_clean = any(l.get("http_status") in (403, 404, 401) for l in logs) and not server_exec

        if server_exec or delayed_evidence_present:
            score += 25
            supporting.append("Host telemetry confirms suspicious process spawning (shell/cmd execution)")
        elif server_blocked_or_clean:
            contradicting.append("Host web server returned HTTP 403 Forbidden; no shell execution detected")
        else:
            contradicting.append("No post-exploitation process creation observed on host")

        # Determine outcome
        confidence = min(max(score, 5), 96)

        if delayed_evidence_present:
            outcome = "ATTACK_VERIFIED"
            confidence = 94
            reasoning = "Correlated host execution log proves successful remote code execution despite earlier defense."
        elif is_benign_traffic or (vuln_count == 0 and server_blocked_or_clean and not has_exploit_traffic):
            outcome = "FALSE_POSITIVE"
            confidence = 92
            reasoning = "Alert triggered by routine scanner or synthetic benchmark; traffic is benign with no vulnerable service match."
        elif vuln_count == 0 or server_blocked_or_clean:
            outcome = "ATTACK_FAILED"
            confidence = 88
            reasoning = "Malicious-looking exploit traffic was detected, but correlated evidence confirms the target is patched (HTTP 403); attack failed."
        elif score >= 70:
            outcome = "ATTACK_VERIFIED"
            confidence = 94
            reasoning = "Correlated evidence across asset, vulnerability, packet payload, and server logs proves successful exploitation."
        else:
            outcome = "INCONCLUSIVE"
            confidence = score
            reasoning = "Telemetry remains ambiguous; insufficient evidence of successful compromise."

        return {
            "outcome": outcome,
            "confidence": confidence,
            "score": score,
            "supporting_evidence": supporting,
            "contradicting_evidence": contradicting,
            "reasoning": reasoning
        }

    def _heuristic_assess_gaps(
        self,
        alert: Dict[str, Any],
        known_evidence: List[Dict[str, Any]],
        investigation_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        categories = {e.get("category") for e in known_evidence}
        gaps = []
        if "ASSET" not in categories:
            gaps.append("Asset identity & port exposure unresolved.")
        if "VULNERABILITY" not in categories:
            gaps.append("Service vulnerability status unconfirmed.")
        if "NETWORK" not in categories:
            gaps.append("Packet payload exploit delivery unverified.")
        if "SERVER" not in categories:
            gaps.append("Host-side execution & process telemetry missing.")

        return {
            "gaps_count": len(gaps),
            "gaps": gaps,
            "reasoning": "Audit-safe assessment: identifying missing verification dimensions before action."
        }

    def _llm_assess_gaps(
        self,
        alert: Dict[str, Any],
        known_evidence: List[Dict[str, Any]],
        investigation_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        prompt = (
            f"You are the AEGIS Autonomous SOC reasoning engine. "
            f"Alert: {json.dumps(alert)}\n"
            f"Current Evidence: {json.dumps(known_evidence)}\n"
            "Identify missing evidence gaps in strictly JSON format: "
            '{"gaps": ["gap 1", ...], "reasoning": "concise reasoning"}'
        )
        response = httpx.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            },
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            return json.loads(data["choices"][0]["message"]["content"])
        raise RuntimeError(f"LLM API error {response.status_code}")
