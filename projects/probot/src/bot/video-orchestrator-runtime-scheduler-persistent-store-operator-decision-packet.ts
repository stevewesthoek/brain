import type { RuntimeSchedulerPersistentStoreTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-terminal-handoff.js";

export type RuntimeSchedulerPersistentStoreOperatorDecisionState = "operator_decision_ready" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreOperatorDecision = "approve_future_implementation_planning" | "defer" | "reject";

export interface RuntimeSchedulerPersistentStoreOperatorDecisionPacketInput {
  decision_id: string;
  operator_id: string;
  decision: RuntimeSchedulerPersistentStoreOperatorDecision;
  decision_note: string;
  allow_decision_packet_only: true;
  allow_file_write: false;
  allow_database_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPersistentStoreOperatorDecisionPacket {
  schema_version: "1.0";
  decision_id: string;
  decision_state: RuntimeSchedulerPersistentStoreOperatorDecisionState;
  decision_packet_only: true;
  source_handoff_state: RuntimeSchedulerPersistentStoreTerminalHandoff["handoff_state"];
  decision: RuntimeSchedulerPersistentStoreOperatorDecision;
  decision_note: string;
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreTerminalHandoff["store_kind"];
  store_reference: string;
  operation_count: number;
  next_boundary: string;
  allowed_future_scope: string[];
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; operator_decision_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreOperatorDecisionPacketInput): boolean {
  return input.allow_decision_packet_only === true
    && input.allow_file_write === false
    && input.allow_database_write === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.decision_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.decision_note.trim().length > 0;
}

function handoffReady(handoff: RuntimeSchedulerPersistentStoreTerminalHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "terminal_handoff_ready"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.terminal_handoff_ready
    && handoff.operation_count > 0
    && handoff.passed_check_count >= handoff.operation_count
    && handoff.handoff_notes.length > 0
    && !handoff.file_write_enabled
    && !handoff.database_write_enabled
    && !handoff.live_scheduler_enabled
    && !handoff.upload_execution_enabled
    && !handoff.network_enabled
    && !handoff.credential_access_enabled
    && !handoff.media_read_enabled
    && !handoff.git_add_executed
    && !handoff.committed_now
    && !handoff.pushed_now;
}

function boundaryFor(decision: RuntimeSchedulerPersistentStoreOperatorDecision): string {
  if (decision === "approve_future_implementation_planning") return "Future implementation planning may proceed in side-effect-free design artifacts only; file writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, and pushes remain separate explicit boundaries.";
  if (decision === "defer") return "Persistent scheduler store implementation remains deferred; continue with terminal handoff records only.";
  return "Persistent scheduler store implementation is rejected; do not proceed with implementation planning until a new approval chain is created.";
}

function scopeFor(decision: RuntimeSchedulerPersistentStoreOperatorDecision): string[] {
  if (decision !== "approve_future_implementation_planning") return [];
  return [
    "Prepare implementation design notes only.",
    "Describe adapter write boundaries without enabling writes.",
    "Keep live scheduler activation and platform dispatch disabled.",
    "Require a new explicit confirmation before any executable persistence behavior is introduced.",
  ];
}

export function createRuntimeSchedulerPersistentStoreOperatorDecisionPacket(input: RuntimeSchedulerPersistentStoreOperatorDecisionPacketInput, handoff: RuntimeSchedulerPersistentStoreTerminalHandoff): RuntimeSchedulerPersistentStoreOperatorDecisionPacket {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    decision_id: safe(input.decision_id, "runtime-scheduler-persistent-store-operator-decision"),
    decision_state: ready ? "operator_decision_ready" : "blocked",
    decision_packet_only: true,
    source_handoff_state: handoff.handoff_state,
    decision: input.decision,
    decision_note: ready ? safe(input.decision_note, "Persistent-store operator decision recorded.") : "No decision note available while blocked.",
    adapter_name: safe(handoff.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: handoff.store_kind,
    store_reference: safe(handoff.store_reference, "blocked-reference"),
    operation_count: ready ? handoff.operation_count : 0,
    next_boundary: ready ? boundaryFor(input.decision) : "Resolve blocked terminal handoff or unsafe decision packet input before continuing.",
    allowed_future_scope: ready ? scopeFor(input.decision) : [],
    file_write_enabled: false,
    database_write_enabled: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, operator_decision_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store operator decision input or terminal handoff was unsafe/incomplete."], warnings: ["Decision packet only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStoreOperatorDecisionPacket, reason?: string): RuntimeSchedulerPersistentStoreOperatorDecisionPacket {
  return { ...packet, decision_state: "revoked", operation_count: 0, allowed_future_scope: [], next_boundary: "No future scope available while revoked.", validation: { complete: false, operator_decision_ready: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler persistent-store operator decision packet was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStoreOperatorDecisionPacket): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store operator decision packet",
    `State: ${packet.decision_state}`,
    `Decision: ${packet.decision}`,
    `Decision note: ${packet.decision_note}`,
    `Adapter: ${packet.adapter_name}`,
    `Store kind: ${packet.store_kind}`,
    `Store reference: ${packet.store_reference}`,
    `Operation count: ${packet.operation_count}`,
    `Next boundary: ${packet.next_boundary}`,
    "Allowed future scope:",
    ...(packet.allowed_future_scope.length ? packet.allowed_future_scope.map((item) => `- ${item}`) : ["- blocked"]),
    `File writes enabled: ${packet.file_write_enabled}`,
    `Database writes enabled: ${packet.database_write_enabled}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
