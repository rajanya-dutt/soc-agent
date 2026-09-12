import pytest
from backend.database.connection import Base, engine, SessionLocal
from backend.scenarios.scenario_manager import ScenarioManager
from backend.agent.orchestrator import AgentOrchestrator
from backend.tools.synthetic_tools import SyntheticSecurityTools
from backend.database.models import Incident, FirewallRule, HumanOverride, ServerLog

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

def test_scenario_01_successful_exploit():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("01")
        incident_id = seed["incident_id"]

        orchestrator = AgentOrchestrator(db, incident_id)
        steps = orchestrator.run_full_autonomous_loop()

        inc = orchestrator.get_incident()
        assert inc.current_assessment == "ATTACK_VERIFIED"
        assert inc.confidence >= 90
        assert inc.stage in ("VERIFIED", "ASSESSED")
        assert inc.status == "MITIGATED"

        # Verify firewall rule was created and verified
        rule = db.query(FirewallRule).filter(FirewallRule.ip == "10.0.0.25").first()
        assert rule is not None
        assert rule.status == "ACTIVE"
        assert rule.verified_at is not None
    finally:
        db.close()

def test_scenario_02_failed_exploit():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("02")
        incident_id = seed["incident_id"]

        orchestrator = AgentOrchestrator(db, incident_id)
        steps = orchestrator.run_full_autonomous_loop()

        inc = orchestrator.get_incident()
        assert inc.current_assessment == "ATTACK_FAILED"
        assert inc.stage == "CLOSED"
        # No block should be deployed
        rule = db.query(FirewallRule).filter(FirewallRule.ip == "198.51.100.44").first()
        assert rule is None
    finally:
        db.close()

def test_scenario_03_false_positive():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("03")
        incident_id = seed["incident_id"]

        orchestrator = AgentOrchestrator(db, incident_id)
        steps = orchestrator.run_full_autonomous_loop()

        inc = orchestrator.get_incident()
        assert inc.current_assessment == "FALSE_POSITIVE"
        assert inc.stage == "CLOSED"
    finally:
        db.close()

def test_scenario_04_delayed_evidence_reassessment():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("04")
        incident_id = seed["incident_id"]

        orchestrator = AgentOrchestrator(db, incident_id)
        
        # Step until initial assessment is made (before delayed evidence)
        for _ in range(5):
            orchestrator.run_next_step()
        
        inc = orchestrator.get_incident()
        initial_assessment = inc.current_assessment
        assert initial_assessment in ("ATTACK_FAILED", "INCONCLUSIVE", "SUSPICIOUS")

        # Now simulate Judge clicking "INJECT DELAYED EVIDENCE"
        mgr.inject_delayed_evidence("04")
        
        # Trigger reassessment
        reassess_res = orchestrator.trigger_reassessment()
        assert reassess_res["reopened"] is True
        assert reassess_res["new_assessment"] == "ATTACK_VERIFIED"
        assert reassess_res["new_confidence"] >= 90

        # Agent proceeds to block and verify
        verify_res = orchestrator.execute_response_and_verify()
        assert verify_res["verified"] is True
        assert verify_res["stage"] == "VERIFIED"
    finally:
        db.close()

def test_scenario_05_response_failure_and_replanning():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("05")
        incident_id = seed["incident_id"]

        orchestrator = AgentOrchestrator(db, incident_id)
        # Gather evidence up to correlation
        for _ in range(5):
            orchestrator.run_next_step()

        inc = orchestrator.get_incident()
        assert inc.current_assessment == "ATTACK_VERIFIED"

        # Execute response (initial attempt fails due to simulated edge timeout)
        resp1 = orchestrator.execute_response_and_verify(force_retry=False)
        assert resp1["stage"] == "RESPONSE_FAILED"
        assert resp1["verified"] is False

        # Agent observes failure, replans, and retries
        resp2 = orchestrator.execute_response_and_verify(force_retry=True)
        assert resp2["stage"] == "VERIFIED"
        assert resp2["verified"] is True
    finally:
        db.close()

def test_scenario_06_human_override():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("06")
        incident_id = seed["incident_id"]

        # Security Analyst submits an override before or at response stage
        override = HumanOverride(
            incident_id=incident_id,
            action_proposed="BLOCK_IP",
            decision="OVERRIDDEN",
            analyst_name="Senior SecOps Lead",
            analyst_notes="Host 10.0.0.99 belongs to simulated red team engagement exercise. Withholding firewall drop."
        )
        db.add(override)
        db.commit()

        orchestrator = AgentOrchestrator(db, incident_id)
        steps = orchestrator.run_full_autonomous_loop()

        inc = orchestrator.get_incident()
        assert inc.stage == "OVERRIDDEN"
        assert inc.status == "OVERRIDDEN"

        # Confirm IP was NOT blocked in firewall
        rule = db.query(FirewallRule).filter(FirewallRule.ip == "10.0.0.99").first()
        assert rule is None
    finally:
        db.close()

def test_synthetic_tools_isolation():
    db = SessionLocal()
    try:
        mgr = ScenarioManager(db)
        seed = mgr.reset_and_seed("01")
        tools = SyntheticSecurityTools(db)
        
        # Test all 13 tools return safe local synthetic data
        alert = tools.get_alert(seed["alert_id"])
        assert "error" not in alert
        
        asset = tools.get_asset("10.0.0.10")
        assert asset["hostname"] == "web-server-01.aegis.internal"
        
        vuln = tools.get_vulnerabilities("Apache Struts", "2.3.30")
        assert vuln["vulnerabilities_found"] >= 1
        
        pkt = tools.get_packet_metadata(seed["alert_id"])
        assert "protocol" in pkt
        
        logs = tools.get_server_logs("10.0.0.10")
        assert "logs" in logs
        
        fw = tools.get_firewall_status()
        assert "rules" in fw
    finally:
        db.close()
