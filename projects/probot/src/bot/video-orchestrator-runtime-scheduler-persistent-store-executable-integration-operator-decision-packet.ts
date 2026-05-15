import type { RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-executable-integration-terminal-handoff.js";

export type RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionState = "operator_decision_ready" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecision = "approve_future_runtime_import_planning" | "defer" | "reject";

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacketInput {
  decision_id: string;
  operator_id: string;
  decision: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecision;
  decision_note: string;
  allow_decision_packet_only: true;
  allow_runtime_imports: false;
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

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket {
  schema_version: "1.0";
  decision_id: string;
  decision_state: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionState;
  decision_packet_only: true;
  source_handoff_state: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff["handoff_state"];
  decision: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecision;
  decision_note: string;
  adapter_interface_name: string;
  plan_step_count: number;
  allowed_future_scope: string[];
  next_boundary: string;
  runtime_imports_enabled: false;
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

function inputReady(input: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacketInput): boolean {
  return input.allow_decision_packet_only === true
    && input.allow_runtime_imports === false
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

function handoffReady(handoff: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "terminal_handoff_ready"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.terminal_handoff_ready
    && handoff.plan_step_count > 0
    && handoff.terminal_notes.length > 0
    && !handoff.runtime_imports_enabled
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

function scope(decision: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecision): string[] {
  if (decision !== "approve_future_runtime_import_planning") return [];
  return [
    "Prepare runtime import planning artifacts only.",
    "Describe disabled-by-default import guards without adding imports.",
    "Describe runtime feature flags without enabling scheduler execution.",
    "Require a new explicit confirmation before any runtime import or executable wiring exists.",
  ];
}

function boundary(decision: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecision): string {
  if (decision === "approve_future_runtime_import_planning") return "Future runtime import planning may proceed in side-effect-free artifacts only; actual runtime imports, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, and pushes remain separate explicit boundaries.";
  if (decision === "defer") return "Runtime import planning remains deferred; continue with executable integration terminal handoff records only.";
  return "Runtime import planning is rejected; do not proceed until a new approval chain is created.";
}

export function createRuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket(input: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacketInput, handoff: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff): RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    decision_id: safe(input.decision_id, "runtime-scheduler-persistent-store-executable-integration-operator-decision"),
    decision_state: ready ? "operator_decision_ready" : "blocked",
    decision_packet_only: true,
    source_handoff_state: handoff.handoff_state,
    decision: input.decision,
    decision_note: ready ? safe(input.decision_note, "Persistent-store executable integration operator decision recorded.") : "No decision note available while blocked.",
    adapter_interface_name: safe(handoff.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    plan_step_count: ready ? handoff.plan_step_count : 0,
    allowed_future_scope: ready ? scope(input.decision) : [],
    next_boundary: ready ? boundary(input.decision) : "Resolve blocked executable integration terminal handoff or unsafe decision input before continuing.",
    runtime_imports_enabled: false,
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
    validation: { complete: ready, operator_decision_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store executable integration operator decision input or terminal handoff was unsafe/incomplete."], warnings: ["Decision packet only; no runtime imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket, reason?: string): RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket {
  return { ...packet, decision_state: "revoked", plan_step_count: 0, allowed_future_scope: [], next_boundary: "No future scope available while revoked.", validation: { complete: false, operator_decision_ready: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler persistent-store executable integration operator decision packet was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store executable integration operator decision packet",
    `State: ${packet.decision_state}`,
    `Decision: ${packet.decision}`,
    `Decision note: ${packet.decision_note}`,
    `Adapter interface: ${packet.adapter_interface_name}`,
    `Plan step count: ${packet.plan_step_count}`,
    "Allowed future scope:",
    ...(packet.allowed_future_scope.length ? packet.allowed_future_scope.map((item) => `- ${item}`) : ["- blocked"]),
    `Next boundary: ${packet.next_boundary}`,
    `Runtime imports enabled: ${packet.runtime_imports_enabled}`,
    `File writes enabled: ${packet.file_write_enabled}`,
    `Database writes enabled: ${packet.database_write_enabled}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
