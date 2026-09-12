import httpx
import pytest

BASE_URL = "http://127.0.0.1:8000"

def test_live_system_status():
    r = httpx.get(f"{BASE_URL}/api/system/status")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "SANDBOX ACTIVE"
    assert "DETERMINISTIC" in data["mode"] or "LLM" in data["mode"]

def test_live_scenario_01_flow():
    # 1. Load scenario 01
    r = httpx.post(f"{BASE_URL}/api/scenarios/load", json={"scenario_id": "01"})
    assert r.status_code == 200
    seed = r.json()
    inc_id = seed["incident_id"]

    # 2. Run autonomous agent
    r = httpx.post(f"{BASE_URL}/api/agent/run", json={"incident_id": inc_id, "auto_respond": True})
    assert r.status_code == 200

    # 3. Check incident status
    r = httpx.get(f"{BASE_URL}/api/investigations/{inc_id}")
    assert r.status_code == 200
    inc = r.json()
    assert inc["current_assessment"] == "ATTACK_VERIFIED"
    assert inc["confidence"] >= 90
    assert inc["stage"] == "VERIFIED"

    # 4. Check firewall
    r = httpx.get(f"{BASE_URL}/api/firewall/10.0.0.25")
    assert r.status_code == 200
    fw = r.json()
    assert fw["status"] == "ACTIVE"

def test_live_scenario_04_judge_demo_delayed_evidence():
    # 1. Load scenario 04
    r = httpx.post(f"{BASE_URL}/api/scenarios/load", json={"scenario_id": "04"})
    seed = r.json()
    inc_id = seed["incident_id"]

    # 2. Step agent 5 times (initial assessment before delayed evidence)
    for _ in range(5):
        httpx.post(f"{BASE_URL}/api/investigations/{inc_id}/step")

    r = httpx.get(f"{BASE_URL}/api/investigations/{inc_id}")
    initial_verdict = r.json()["current_assessment"]
    assert initial_verdict in ("ATTACK_FAILED", "INCONCLUSIVE", "SUSPICIOUS")

    # 3. Judge Demo action: Inject delayed evidence
    r = httpx.post(f"{BASE_URL}/api/scenarios/04/inject-evidence")
    assert r.status_code == 200
    assert r.json()["delayed_logs_activated"] >= 1

    # 4. Trigger reassessment
    r = httpx.post(f"{BASE_URL}/api/investigations/{inc_id}/reassess")
    assert r.status_code == 200
    reassess_data = r.json()
    assert reassess_data["reopened"] is True
    assert reassess_data["new_assessment"] == "ATTACK_VERIFIED"

    # 5. Respond and verify
    r = httpx.post(f"{BASE_URL}/api/investigations/{inc_id}/respond-and-verify")
    assert r.status_code == 200
    assert r.json()["verified"] is True

def test_live_scenario_06_human_override():
    r = httpx.post(f"{BASE_URL}/api/scenarios/load", json={"scenario_id": "06"})
    inc_id = r.json()["incident_id"]

    # Step up to correlation
    for _ in range(5):
        httpx.post(f"{BASE_URL}/api/investigations/{inc_id}/step")

    # Analyst intervenes
    r = httpx.post(f"{BASE_URL}/api/human-override", json={
        "incident_id": inc_id,
        "decision": "OVERRIDDEN",
        "action_proposed": "BLOCK_IP",
        "analyst_name": "Senior SecOps Lead",
        "analyst_notes": "Authorised penetration test range."
    })
    assert r.status_code == 200

    r = httpx.get(f"{BASE_URL}/api/investigations/{inc_id}")
    inc = r.json()
    assert inc["stage"] == "OVERRIDDEN"

    # Confirm no block in firewall
    r = httpx.get(f"{BASE_URL}/api/firewall/10.0.0.99")
    assert r.json()["status"] == "NOT_BLOCKED"

def test_live_export_report():
    r = httpx.post(f"{BASE_URL}/api/scenarios/load", json={"scenario_id": "01"})
    inc_id = r.json()["incident_id"]
    httpx.post(f"{BASE_URL}/api/agent/run", json={"incident_id": inc_id})

    # JSON export
    r_json = httpx.get(f"{BASE_URL}/api/reports/{inc_id}/export?format=json")
    assert r_json.status_code == 200
    data = r_json.json()
    assert "AEGIS // AUTONOMOUS SOC" in data["product"]
    assert len(data["evidence_matrix"]) >= 4

    # Markdown export
    r_md = httpx.get(f"{BASE_URL}/api/reports/{inc_id}/export?format=markdown")
    assert r_md.status_code == 200
    assert "# AEGIS // AUTONOMOUS SOC" in r_md.text
