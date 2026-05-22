/**
 * Agent Ledger — Append-only event log for all agent operations
 * Version: 1.0 (2026-05-22)
 * Schema: immutable, signed, timestamped entries
 */

export type AgentLedgerEventType =
  | 'session_start'
  | 'session_end'
  | 'model_escalation'
  | 'tool_call'
  | 'tool_result'
  | 'state_mutation'
  | 'decision'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'error_encountered'
  | 'verification_passed'
  | 'verification_failed'
  | 'parallel_work_started'
  | 'parallel_work_completed'
  | 'parallel_work_failed'
  | 'agent_assigned_task'
  | 'agent_task_completed';

export type AgentId = 'claude-code' | 'codex-cli' | 'gemini-cli' | 'unknown';
export type ActorModel = 'haiku' | 'sonnet' | 'opus' | 'codex-low' | 'codex-standard' | 'codex-max' | 'gemini-flash' | 'gemini-pro' | 'unknown';
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';
export type EventStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface AgentLedgerMetadata {
  model: ActorModel;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
  };
  duration_ms?: number;
  tags?: string[];
}

export interface AgentLedgerPayload {
  [key: string]: unknown;
}

export interface AgentLedgerEntry {
  id: string;
  version: string;
  timestamp: string;
  sessionId: string;
  agent: AgentId;
  type: AgentLedgerEventType;
  actor: ActorModel;
  severity: EventSeverity;
  status: EventStatus;
  metadata: AgentLedgerMetadata;
  payload: AgentLedgerPayload;
  signature?: string;
}

export interface SessionStartPayload {
  repo?: string;
  tool: 'claude-code' | 'codex-cli' | 'gemini-cli';
  user?: string;
  context_size_tokens: number;
  handoff_loaded: boolean;
}

export interface SessionEndPayload {
  outcome: 'success' | 'error' | 'interrupted' | 'timeout';
  total_cost: number;
  event_count: number;
  decision_count: number;
  error_count: number;
  duration_seconds: number;
}

export interface ModelEscalationPayload {
  from: ActorModel;
  to: ActorModel;
  reason: string;
  cost_impact: number;
  justification: string;
}

export interface ToolCallPayload {
  tool_name: string;
  tool_type: 'bash' | 'read' | 'write' | 'edit' | 'agent' | 'skill' | 'api';
  args?: Record<string, unknown>;
  tags?: string[];
}

export interface ToolResultPayload {
  tool_name: string;
  exit_code?: number;
  success: boolean;
  output_lines?: number;
  error?: string;
  duration_ms: number;
}

export interface StateMutationPayload {
  type: 'file_write' | 'file_edit' | 'file_delete' | 'variable_set' | 'memory_write';
  path: string;
  operation: 'create' | 'update' | 'delete' | 'append';
  reason?: string;
  lines_changed?: number;
}

export interface DecisionPayload {
  context: string;
  options: string[];
  choice: string;
  rationale: string;
  alternatives?: string[];
  confidence?: number;
}

export interface ApprovalPayload {
  action_id: string;
  action_description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  approval_deadline?: string;
  approver?: string;
  comment?: string;
}

export interface ErrorPayload {
  error_type: string;
  message: string;
  stack_trace?: string;
  recovery_step?: string;
  severity: 'recoverable' | 'non-recoverable';
}

export interface VerificationPayload {
  verifier: string;
  iteration?: number;
  checks_run: string[];
  all_passed: boolean;
  failures?: string[];
}

export interface LedgerQuery {
  type?: AgentLedgerEventType;
  agent?: AgentId;
  actor?: ActorModel;
  sessionId?: string;
  severity?: EventSeverity;
  timeRange?: {
    from: string;
    to: string;
  };
  limit?: number;
  offset?: number;
}

export interface LedgerQueryResult {
  total_matched: number;
  returned: number;
  entries: AgentLedgerEntry[];
  query: LedgerQuery;
  executed_at: string;
}
