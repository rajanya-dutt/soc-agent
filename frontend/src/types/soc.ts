export interface Alert {
  id: string;
  timestamp: string | null;
  rule_id: string;
  signature: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source_ip: string;
  target_ip: string;
  target_port: number;
  scenario_id: string;
  raw_payload?: string;
}

export interface InvestigationState {
  iteration: number;
  current_phase: string;
  knowledge_gaps: string[];
  selected_tool: string;
  tool_input: Record<string, unknown>;
  observation: string;
  reasoning_text: string;
  timestamp: string | null;
}

export interface EvidenceRecord {
  id: number;
  category: 'ASSET' | 'VULNERABILITY' | 'NETWORK' | 'SERVER';
  source_tool: string;
  status: 'CONFIRMED' | 'SUPPORTING' | 'CONTRADICTING' | 'UNKNOWN';
  title: string;
  summary: string;
  raw_data: Record<string, unknown>;
  timestamp: string | null;
}

export interface ActionRecord {
  id: number;
  action_type: string;
  target_ip: string;
  status: 'PROPOSED' | 'EXECUTED' | 'FAILED' | 'RETRIED' | 'OVERRIDDEN';
  result_message: string | null;
  verified: boolean;
  verification_details: string | null;
  timestamp: string | null;
}

export interface HumanOverride {
  decision: 'APPROVED' | 'OVERRIDDEN' | 'REASSESS';
  action_proposed: string;
  analyst_name: string;
  analyst_notes: string | null;
  timestamp: string | null;
}

export interface Incident {
  id: string;
  alert_id: string;
  alert?: Alert;
  scenario_id: string;
  title: string;
  stage: 'INTAKE' | 'INVESTIGATING' | 'CORRELATING' | 'ASSESSED' | 'RESPONDING' | 'RESPONSE_FAILED' | 'VERIFIED' | 'VERIFICATION_FAILED' | 'CLOSED' | 'REOPENED' | 'OVERRIDDEN';
  status: 'ACTIVE' | 'MITIGATED' | 'OVERRIDDEN' | 'CLOSED';
  initial_assessment: string | null;
  current_assessment: 'UNCERTAIN' | 'SUSPICIOUS' | 'ATTACK_VERIFIED' | 'ATTACK_FAILED' | 'FALSE_POSITIVE' | 'INCONCLUSIVE';
  confidence: number;
  reasoning_summary: string | null;
  target_asset_ip?: string;
  attacker_ip?: string;
  created_at: string | null;
  states: InvestigationState[];
  evidence: EvidenceRecord[];
  actions: ActionRecord[];
  overrides: HumanOverride[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  alert_signature: string;
  severity: string;
  source_ip: string;
  target_ip: string;
  target_port: number;
  service: string;
  version: string;
  cve_id: string;
  exploit_indicators: string;
  has_execution: boolean;
  expect_outcome: string;
  expect_block: boolean;
}

export interface SystemStatus {
  status: string;
  mode: 'LLM AGENT' | 'DETERMINISTIC SANDBOX';
  is_llm_enabled: boolean;
  total_alerts: number;
  active_incidents: number;
  blocked_ips_count: number;
  simulation_safety: string;
  timestamp: string;
}

export interface FirewallRule {
  id: number;
  ip: string;
  action: string;
  status: string;
  failure_injected: boolean;
  created_at: string | null;
  verified_at: string | null;
}
