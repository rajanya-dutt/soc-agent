import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from backend.database.connection import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, index=True)
    timestamp = Column(DateTime, default=utc_now)
    rule_id = Column(String(64), nullable=False)
    signature = Column(String(256), nullable=False)
    category = Column(String(128), default="Exploit")
    severity = Column(String(32), default="HIGH")
    source_ip = Column(String(64), nullable=False)
    target_ip = Column(String(64), nullable=False)
    target_port = Column(Integer, default=8080)
    raw_payload = Column(Text, nullable=True)
    scenario_id = Column(String(64), default="01")

class Asset(Base):
    __tablename__ = "assets"

    ip = Column(String(64), primary_key=True, index=True)
    hostname = Column(String(128), nullable=False)
    os = Column(String(128), default="Linux Ubuntu 22.04")
    running_service = Column(String(128), nullable=False)
    service_version = Column(String(64), nullable=False)
    port = Column(Integer, default=8080)
    criticality = Column(String(32), default="HIGH")
    owner = Column(String(128), default="SecOps Core Team")
    environment = Column(String(64), default="Production")

class Vulnerability(Base):
    __tablename__ = "vulnerabilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cve_id = Column(String(64), index=True, nullable=False)
    service_name = Column(String(128), nullable=False)
    affected_versions = Column(String(256), nullable=False)
    cvss_score = Column(Float, default=9.8)
    severity = Column(String(32), default="CRITICAL")
    description = Column(Text, nullable=False)
    exploit_available = Column(Boolean, default=True)

class PacketMetadata(Base):
    __tablename__ = "packet_metadata"

    id = Column(String(64), primary_key=True, index=True)
    alert_id = Column(String(64), ForeignKey("alerts.id"), nullable=True)
    protocol = Column(String(32), default="TCP")
    source_ip = Column(String(64), nullable=False)
    target_ip = Column(String(64), nullable=False)
    target_port = Column(Integer, default=8080)
    packet_size = Column(Integer, default=1420)
    payload_sample = Column(Text, nullable=True)
    flags = Column(String(64), default="[PSH, ACK]")
    indicators = Column(Text, nullable=True)  # JSON or comma-separated exploit indicators

class ServerLog(Base):
    __tablename__ = "server_logs"

    id = Column(String(64), primary_key=True, index=True)
    asset_ip = Column(String(64), ForeignKey("assets.ip"), nullable=False)
    timestamp = Column(DateTime, default=utc_now)
    event_type = Column(String(64), nullable=False)  # process_creation, http_request, auth_failure, network_conn
    process_name = Column(String(128), nullable=True)
    command_line = Column(Text, nullable=True)
    http_status = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    is_delayed = Column(Boolean, default=False)  # For delayed evidence demonstration

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True, index=True)
    alert_id = Column(String(64), ForeignKey("alerts.id"), nullable=False)
    scenario_id = Column(String(64), default="01")
    title = Column(String(256), nullable=False)
    stage = Column(String(64), default="INTAKE") # INTAKE, INVESTIGATING, CORRELATING, ASSESSED, RESPONDING, VERIFIED, CLOSED, REOPENED
    status = Column(String(64), default="ACTIVE") # ACTIVE, MITIGATED, OVERRIDDEN, CLOSED
    initial_assessment = Column(String(64), nullable=True)
    current_assessment = Column(String(64), default="UNCERTAIN") # UNCERTAIN, SUSPICIOUS, ATTACK_VERIFIED, ATTACK_FAILED, FALSE_POSITIVE
    confidence = Column(Integer, default=0) # 0 - 100
    reasoning_summary = Column(Text, nullable=True)
    target_asset_ip = Column(String(64), nullable=True)
    attacker_ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    evidence = relationship("EvidenceRecord", back_populates="incident", cascade="all, delete-orphan")
    investigation_states = relationship("InvestigationState", back_populates="incident", cascade="all, delete-orphan")
    tool_calls = relationship("ToolCall", back_populates="incident", cascade="all, delete-orphan")
    actions = relationship("ActionRecord", back_populates="incident", cascade="all, delete-orphan")
    overrides = relationship("HumanOverride", back_populates="incident", cascade="all, delete-orphan")

class InvestigationState(Base):
    __tablename__ = "investigation_states"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False)
    iteration = Column(Integer, default=1)
    current_phase = Column(String(64), nullable=False) # OBSERVE, GAP_ASSESSMENT, TOOL_SELECTION, EXECUTION, CORRELATION, REASSESSMENT
    knowledge_gaps = Column(Text, nullable=True)
    selected_tool = Column(String(64), nullable=True)
    tool_input = Column(Text, nullable=True)
    observation = Column(Text, nullable=True)
    reasoning_text = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="investigation_states")

class EvidenceRecord(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False)
    category = Column(String(64), nullable=False) # ASSET, VULNERABILITY, NETWORK, SERVER
    source_tool = Column(String(64), nullable=False)
    status = Column(String(64), default="CONFIRMED") # CONFIRMED, SUPPORTING, CONTRADICTING, UNKNOWN
    title = Column(String(128), nullable=False)
    summary = Column(Text, nullable=False)
    raw_data = Column(Text, nullable=True) # JSON payload
    timestamp = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="evidence")

class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False)
    tool_name = Column(String(64), nullable=False)
    input_params = Column(Text, nullable=True)
    output_result = Column(Text, nullable=True)
    status = Column(String(32), default="SUCCESS") # SUCCESS, FAILED
    error_message = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="tool_calls")

class ActionRecord(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False)
    action_type = Column(String(64), default="BLOCK_IP")
    target_ip = Column(String(64), nullable=False)
    status = Column(String(32), default="EXECUTED") # PROPOSED, EXECUTED, FAILED, RETRIED, OVERRIDDEN
    result_message = Column(Text, nullable=True)
    verified = Column(Boolean, default=False)
    verification_details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="actions")

class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip = Column(String(64), unique=True, index=True, nullable=False)
    action = Column(String(32), default="DROP") # DROP, REJECT
    status = Column(String(32), default="ACTIVE") # ACTIVE, DISABLED
    failure_injected = Column(Boolean, default=False) # For scenario 5 (response failure simulation)
    created_at = Column(DateTime, default=utc_now)
    verified_at = Column(DateTime, nullable=True)

class HumanOverride(Base):
    __tablename__ = "human_overrides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False)
    action_proposed = Column(String(64), nullable=False)
    decision = Column(String(32), nullable=False) # APPROVED, OVERRIDDEN, REASSESS
    analyst_name = Column(String(64), default="Lead SecOps Analyst")
    analyst_notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utc_now)

    incident = relationship("Incident", back_populates="overrides")

class ScenarioEvent(Base):
    __tablename__ = "scenario_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(String(64), index=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    state_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
