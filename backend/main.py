import os
import json
import asyncio
import datetime
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.connection import get_db, init_db
from backend.database.models import (
    Alert, Asset, Vulnerability, PacketMetadata, ServerLog,
    Incident, InvestigationState, EvidenceRecord, ToolCall,
    ActionRecord, FirewallRule, HumanOverride, ScenarioEvent
)
from backend.tools.synthetic_tools import SyntheticSecurityTools
from backend.agent.orchestrator import AgentOrchestrator
from backend.scenarios.scenario_manager import ScenarioManager, SCENARIOS
from backend.agent.reasoning import ReasoningEngine

# Initialize database
init_db()

app = FastAPI(
    title="AEGIS // Autonomous SOC Backend",
    description="Simulated Autonomous Security Operations Center Investigation & Response Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections for live investigation telemetry streaming
active_connections: Dict[str, List[WebSocket]] = {}

async def broadcast_incident_update(incident_id: str, payload: Dict[str, Any]):
    if incident_id in active_connections:
        dead_sockets = []
        for ws in active_connections[incident_id]:
            try:
                await ws.send_json(payload)
            except Exception:
                dead_sockets.append(ws)
        for ws in dead_sockets:
            active_connections[incident_id].remove(ws)

# ==================== PYDANTIC SCHEMAS ====================
class ScenarioLoadRequest(BaseModel):
    scenario_id: str = "01"

class StartInvestigationRequest(BaseModel):
    alert_id: str
    scenario_id: str = "01"

class HumanOverrideRequest(BaseModel):
    incident_id: str
    decision: str  # APPROVED, OVERRIDDEN, REASSESS
    action_proposed: str = "BLOCK_IP"
    analyst_name: str = "Lead SecOps Analyst"
    analyst_notes: Optional[str] = None

class FirewallBlockRequest(BaseModel):
    ip: str
    simulate_failure: bool = False

class AgentRunRequest(BaseModel):
    incident_id: str
    auto_respond: bool = True

# ==================== SYSTEM & SCENARIO ROUTES ====================
@app.get("/api/system/status")
def get_system_status(db: Session = Depends(get_db)):
    reasoning = ReasoningEngine()
    total_alerts = db.query(Alert).count()
    active_incidents = db.query(Incident).filter(Incident.status == "ACTIVE").count()
    firewall_rules = db.query(FirewallRule).filter(FirewallRule.status == "ACTIVE").count()
    
    return {
        "status": "SANDBOX ACTIVE",
        "mode": reasoning.mode,
        "is_llm_enabled": bool(reasoning.api_key),
        "total_alerts": total_alerts,
        "active_incidents": active_incidents,
        "blocked_ips_count": firewall_rules,
        "simulation_safety": "100% SYNTHETIC ISOLATED ENVIRONMENT",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@app.get("/api/scenarios")
def list_scenarios():
    return list(SCENARIOS.values())

@app.post("/api/scenarios/load")
def load_scenario(req: ScenarioLoadRequest, db: Session = Depends(get_db)):
    mgr = ScenarioManager(db)
    result = mgr.reset_and_seed(req.scenario_id)
    return {
        "success": True,
        "message": f"Scenario {req.scenario_id} loaded successfully.",
        **result
    }

@app.post("/api/scenarios/reset")
def reset_scenario(db: Session = Depends(get_db)):
    mgr = ScenarioManager(db)
    result = mgr.reset_and_seed("01")
    return {
        "success": True,
        "message": "Environment reset to baseline Scenario 01.",
        **result
    }

@app.post("/api/scenarios/{scenario_id}/inject-evidence")
def inject_delayed_evidence(scenario_id: str, db: Session = Depends(get_db)):
    mgr = ScenarioManager(db)
    res = mgr.inject_delayed_evidence(scenario_id)
    return res

# ==================== ALERTS ROUTES ====================
@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).all()
    return [
        {
            "id": a.id,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "rule_id": a.rule_id,
            "signature": a.signature,
            "category": a.category,
            "severity": a.severity,
            "source_ip": a.source_ip,
            "target_ip": a.target_ip,
            "target_port": a.target_port,
            "scenario_id": a.scenario_id,
            "raw_payload": a.raw_payload
        }
        for a in alerts
    ]

@app.get("/api/alerts/{alert_id}")
def get_alert_by_id(alert_id: str, db: Session = Depends(get_db)):
    tools = SyntheticSecurityTools(db)
    alert = tools.get_alert(alert_id)
    if "error" in alert:
        raise HTTPException(status_code=404, detail=alert["error"])
    return alert

# ==================== INVESTIGATION & AGENT ROUTES ====================
@app.post("/api/investigations/start")
def start_investigation(req: StartInvestigationRequest, db: Session = Depends(get_db)):
    # Check if incident already exists
    existing = db.query(Incident).filter(Incident.alert_id == req.alert_id).first()
    if existing:
        return {"incident_id": existing.id, "stage": existing.stage, "status": existing.status}

    alert = db.query(Alert).filter(Alert.id == req.alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {req.alert_id} not found.")

    inc_id = f"INC-{req.scenario_id}-{int(datetime.datetime.utcnow().timestamp()) % 10000}"
    incident = Incident(
        id=inc_id,
        alert_id=req.alert_id,
        scenario_id=req.scenario_id,
        title=f"Investigation: {alert.signature}",
        stage="INTAKE",
        status="ACTIVE",
        initial_assessment="PENDING_EVALUATION",
        current_assessment="UNCERTAIN",
        confidence=0,
        reasoning_summary="Alert ingested. Autonomous agent initialized.",
        target_asset_ip=alert.target_ip,
        attacker_ip=alert.source_ip,
        created_at=datetime.datetime.utcnow()
    )
    db.add(incident)
    db.commit()

    return {"incident_id": inc_id, "stage": "INTAKE", "status": "ACTIVE"}

@app.get("/api/investigations/{incident_id}")
def get_investigation(incident_id: str, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    states = db.query(InvestigationState).filter(InvestigationState.incident_id == incident_id).order_by(InvestigationState.iteration.asc()).all()
    evidence = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).order_by(EvidenceRecord.timestamp.asc()).all()
    tool_calls = db.query(ToolCall).filter(ToolCall.incident_id == incident_id).order_by(ToolCall.timestamp.asc()).all()
    actions = db.query(ActionRecord).filter(ActionRecord.incident_id == incident_id).all()
    overrides = db.query(HumanOverride).filter(HumanOverride.incident_id == incident_id).all()
    alert = db.query(Alert).filter(Alert.id == inc.alert_id).first()

    return {
        "id": inc.id,
        "alert_id": inc.alert_id,
        "alert": {
            "id": alert.id if alert else None,
            "signature": alert.signature if alert else None,
            "severity": alert.severity if alert else None,
            "source_ip": alert.source_ip if alert else None,
            "target_ip": alert.target_ip if alert else None,
            "target_port": alert.target_port if alert else None
        } if alert else None,
        "scenario_id": inc.scenario_id,
        "title": inc.title,
        "stage": inc.stage,
        "status": inc.status,
        "initial_assessment": inc.initial_assessment,
        "current_assessment": inc.current_assessment,
        "confidence": inc.confidence,
        "reasoning_summary": inc.reasoning_summary,
        "target_asset_ip": inc.target_asset_ip,
        "attacker_ip": inc.attacker_ip,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "states": [
            {
                "iteration": s.iteration,
                "current_phase": s.current_phase,
                "knowledge_gaps": json.loads(s.knowledge_gaps) if s.knowledge_gaps else [],
                "selected_tool": s.selected_tool,
                "tool_input": json.loads(s.tool_input) if s.tool_input else {},
                "observation": s.observation,
                "reasoning_text": s.reasoning_text,
                "timestamp": s.timestamp.isoformat() if s.timestamp else None
            }
            for s in states
        ],
        "evidence": [
            {
                "id": e.id,
                "category": e.category,
                "source_tool": e.source_tool,
                "status": e.status,
                "title": e.title,
                "summary": e.summary,
                "raw_data": json.loads(e.raw_data) if e.raw_data else {},
                "timestamp": e.timestamp.isoformat() if e.timestamp else None
            }
            for e in evidence
        ],
        "tool_calls": [
            {
                "tool_name": t.tool_name,
                "status": t.status,
                "input_params": json.loads(t.input_params) if t.input_params else {},
                "output_result": json.loads(t.output_result) if t.output_result else {},
                "timestamp": t.timestamp.isoformat() if t.timestamp else None
            }
            for t in tool_calls
        ],
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "target_ip": a.target_ip,
                "status": a.status,
                "result_message": a.result_message,
                "verified": a.verified,
                "verification_details": a.verification_details,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None
            }
            for a in actions
        ],
        "overrides": [
            {
                "decision": o.decision,
                "action_proposed": o.action_proposed,
                "analyst_name": o.analyst_name,
                "analyst_notes": o.analyst_notes,
                "timestamp": o.timestamp.isoformat() if o.timestamp else None
            }
            for o in overrides
        ]
    }

@app.post("/api/investigations/{incident_id}/step")
async def step_investigation(incident_id: str, db: Session = Depends(get_db)):
    orchestrator = AgentOrchestrator(db, incident_id)
    step_result = orchestrator.run_next_step()
    await broadcast_incident_update(incident_id, {"type": "STEP_COMPLETED", "data": step_result})
    return step_result

@app.post("/api/investigations/{incident_id}/reassess")
async def reassess_investigation(incident_id: str, db: Session = Depends(get_db)):
    orchestrator = AgentOrchestrator(db, incident_id)
    reassessment = orchestrator.trigger_reassessment()
    await broadcast_incident_update(incident_id, {"type": "REASSESSMENT_TRIGGERED", "data": reassessment})
    return reassessment

@app.post("/api/investigations/{incident_id}/respond-and-verify")
async def respond_and_verify(incident_id: str, retry: bool = False, db: Session = Depends(get_db)):
    orchestrator = AgentOrchestrator(db, incident_id)
    res = orchestrator.execute_response_and_verify(force_retry=retry)
    await broadcast_incident_update(incident_id, {"type": "RESPONSE_VERIFIED", "data": res})
    return res

@app.post("/api/agent/run")
async def run_autonomous_agent(req: AgentRunRequest, db: Session = Depends(get_db)):
    orchestrator = AgentOrchestrator(db, req.incident_id)
    steps = orchestrator.run_full_autonomous_loop()
    await broadcast_incident_update(req.incident_id, {"type": "AUTONOMOUS_RUN_FINISHED", "steps": steps})
    return {"incident_id": req.incident_id, "steps_executed": len(steps), "steps": steps}

@app.get("/api/investigations/{incident_id}/timeline")
def get_timeline(incident_id: str, db: Session = Depends(get_db)):
    states = db.query(InvestigationState).filter(InvestigationState.incident_id == incident_id).order_by(InvestigationState.timestamp.asc()).all()
    actions = db.query(ActionRecord).filter(ActionRecord.incident_id == incident_id).order_by(ActionRecord.timestamp.asc()).all()
    
    events = []
    for s in states:
        events.append({
            "timestamp": s.timestamp.isoformat() if s.timestamp else None,
            "type": "AGENT_STEP",
            "phase": s.current_phase,
            "description": f"Tool: {s.selected_tool} -> {s.observation[:120]}...",
            "details": s.observation
        })
    for a in actions:
        events.append({
            "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            "type": "RESPONSE_ACTION",
            "phase": "RESPONSE",
            "description": f"Action: {a.action_type} on {a.target_ip} ({'VERIFIED' if a.verified else a.status})",
            "details": a.result_message
        })

    events.sort(key=lambda x: x["timestamp"] or "")
    return events

@app.get("/api/investigations/{incident_id}/evidence")
def get_evidence(incident_id: str, db: Session = Depends(get_db)):
    records = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).all()
    return [
        {
            "id": r.id,
            "category": r.category,
            "source_tool": r.source_tool,
            "status": r.status,
            "title": r.title,
            "summary": r.summary,
            "raw_data": json.loads(r.raw_data) if r.raw_data else {},
            "timestamp": r.timestamp.isoformat() if r.timestamp else None
        }
        for r in records
    ]

# ==================== FIREWALL ROUTES ====================
@app.get("/api/firewall")
def get_firewall_rules(db: Session = Depends(get_db)):
    tools = SyntheticSecurityTools(db)
    return tools.get_firewall_status()

@app.get("/api/firewall/{ip}")
def get_ip_firewall_status(ip: str, db: Session = Depends(get_db)):
    rule = db.query(FirewallRule).filter(FirewallRule.ip == ip).first()
    if not rule:
        return {"ip": ip, "status": "NOT_BLOCKED", "action": "ALLOW"}
    return {
        "ip": rule.ip,
        "action": rule.action,
        "status": rule.status,
        "failure_injected": rule.failure_injected,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "verified_at": rule.verified_at.isoformat() if rule.verified_at else None
    }

@app.post("/api/firewall/block")
def manual_block_ip(req: FirewallBlockRequest, db: Session = Depends(get_db)):
    tools = SyntheticSecurityTools(db)
    return tools.block_ip(req.ip, simulate_failure=req.simulate_failure)

@app.post("/api/firewall/unblock")
def manual_unblock_ip(ip: str = Query(...), db: Session = Depends(get_db)):
    tools = SyntheticSecurityTools(db)
    return tools.unblock_ip(ip)

# ==================== HUMAN OVERRIDE ROUTE ====================
@app.post("/api/human-override")
async def submit_human_override(req: HumanOverrideRequest, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == req.incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    override = HumanOverride(
        incident_id=req.incident_id,
        action_proposed=req.action_proposed,
        decision=req.decision,
        analyst_name=req.analyst_name,
        analyst_notes=req.analyst_notes,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(override)

    if req.decision == "OVERRIDDEN":
        inc.stage = "OVERRIDDEN"
        inc.status = "OVERRIDDEN"
        inc.reasoning_summary = f"HUMAN OVERRIDE: Action '{req.action_proposed}' withheld by {req.analyst_name}. Rationale: {req.analyst_notes or 'Analyst discretionary withhold'}"
    elif req.decision == "APPROVED":
        # Resume response
        inc.stage = "ASSESSED"
        inc.status = "ACTIVE"
    elif req.decision == "REASSESS":
        inc.stage = "INVESTIGATING"
        inc.status = "ACTIVE"

    db.commit()
    await broadcast_incident_update(req.incident_id, {"type": "HUMAN_OVERRIDE_RECORDED", "decision": req.decision})

    return {
        "success": True,
        "incident_id": req.incident_id,
        "decision": req.decision,
        "stage": inc.stage,
        "message": f"Analyst override recorded: {req.decision}"
    }

# ==================== AUDIT & EXPORT ====================
@app.get("/api/reports/{incident_id}/export")
def export_incident_report(incident_id: str, format: str = "json", db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    alert = db.query(Alert).filter(Alert.id == inc.alert_id).first()
    evidence = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident_id).all()
    actions = db.query(ActionRecord).filter(ActionRecord.incident_id == incident_id).all()
    states = db.query(InvestigationState).filter(InvestigationState.incident_id == incident_id).order_by(InvestigationState.iteration.asc()).all()
    overrides = db.query(HumanOverride).filter(HumanOverride.incident_id == incident_id).all()

    report_data = {
        "report_generated_at": datetime.datetime.utcnow().isoformat(),
        "product": "AEGIS // AUTONOMOUS SOC",
        "tagline": "Investigate. Correlate. Respond. Verify.",
        "incident_id": inc.id,
        "scenario_id": inc.scenario_id,
        "title": inc.title,
        "status": inc.status,
        "stage": inc.stage,
        "initial_assessment": inc.initial_assessment,
        "current_assessment": inc.current_assessment,
        "confidence_score": f"{inc.confidence}%",
        "reasoning_summary": inc.reasoning_summary,
        "alert": {
            "signature": alert.signature if alert else "N/A",
            "rule_id": alert.rule_id if alert else "N/A",
            "severity": alert.severity if alert else "N/A",
            "source_ip": alert.source_ip if alert else "N/A",
            "target_ip": alert.target_ip if alert else "N/A",
            "target_port": alert.target_port if alert else 8080
        },
        "evidence_matrix": [
            {
                "category": e.category,
                "title": e.title,
                "status": e.status,
                "summary": e.summary
            }
            for e in evidence
        ],
        "response_actions": [
            {
                "action": a.action_type,
                "target_ip": a.target_ip,
                "status": a.status,
                "verified": a.verified,
                "verification_details": a.verification_details
            }
            for a in actions
        ],
        "human_overrides": [
            {
                "decision": o.decision,
                "action_proposed": o.action_proposed,
                "analyst_name": o.analyst_name,
                "notes": o.analyst_notes,
                "timestamp": o.timestamp.isoformat() if o.timestamp else None
            }
            for o in overrides
        ],
        "reassessment_history": [
            {
                "iteration": s.iteration,
                "phase": s.current_phase,
                "selected_tool": s.selected_tool,
                "observation": s.observation,
                "reasoning": s.reasoning_text
            }
            for s in states
        ]
    }

    if format == "json":
        return JSONResponse(content=report_data)

    # Human-readable Markdown export
    md = f"""# AEGIS // AUTONOMOUS SOC - INCIDENT AUDIT REPORT
**Generated:** {report_data['report_generated_at']}
**Incident ID:** `{inc.id}` | **Scenario:** `{inc.scenario_id}` | **Status:** `{inc.status}`

---

## 1. Executive Summary
- **Alert:** {report_data['alert']['signature']} ({report_data['alert']['severity']})
- **Attack Vector:** `{report_data['alert']['source_ip']}` -> `{report_data['alert']['target_ip']}:{report_data['alert']['target_port']}`
- **Correlated Assessment:** **{inc.current_assessment}** ({inc.confidence}% Confidence)
- **Agent Reasoning:** {inc.reasoning_summary}

---

## 2. Evidence Matrix
"""
    for e in evidence:
        md += f"- **[{e.category}]** {e.title} ({e.status})\n  *Summary:* {e.summary}\n"

    md += "\n## 3. Response & Active Verification\n"
    for a in actions:
        md += f"- **Action:** `{a.action_type}` on `{a.target_ip}` | Status: `{a.status}` | **Verified:** `{a.verified}`\n"
        if a.verification_details:
            md += f"  *Probe Telemetry:* {a.verification_details}\n"

    if overrides:
        md += "\n## 4. Human Analyst Overrides\n"
        for o in overrides:
            md += f"- **Decision:** `{o.decision}` by {o.analyst_name} | Notes: {o.analyst_notes}\n"

    md += "\n## 5. Agent Iteration Ledger (Audit Trail)\n"
    for s in states:
        md += f"### Iteration {s.iteration} - {s.current_phase}\n"
        md += f"- **Tool Invoked:** `{s.selected_tool}`\n"
        md += f"- **Observation:** {s.observation}\n"
        md += f"- **Audit Reason:** {s.reasoning_text}\n\n"

    md += "\n---\n*CONFIDENTIAL // AEGIS AUTONOMOUS SOC AUDIT TRAIL // 100% SYNTHETIC SIMULATION*\n"

    return PlainTextResponse(content=md, media_type="text/markdown")

# ==================== WEBSOCKET STREAM ====================
@app.websocket("/api/ws/{incident_id}")
async def websocket_endpoint(websocket: WebSocket, incident_id: str):
    await websocket.accept()
    if incident_id not in active_connections:
        active_connections[incident_id] = []
    active_connections[incident_id].append(websocket)
    try:
        while True:
            # Keep-alive receive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if incident_id in active_connections and websocket in active_connections[incident_id]:
            active_connections[incident_id].remove(websocket)
