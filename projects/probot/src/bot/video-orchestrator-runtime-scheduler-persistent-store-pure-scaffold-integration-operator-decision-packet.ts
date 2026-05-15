import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-terminal-handoff.js";

export type RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionState = "operator_decision_ready" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecision = "approve_future_executable_integration_planning" | "defer" | "reject";

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacketInput {
  decision_id: string;
  operator_id: string;
  decision: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecision;
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

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket {
  schema_version: "1.0";
  decision_id: string;
  decision_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionState;
  decision_packet_only: true;
  source_handoff_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff["handoff_state"];
  decision: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecision;
  decision_note: string;
  adapter_interface_name: string;
  integration_step_count: number;
  allowed_future_scope: string[];
  next_boundary: string;
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

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacketInput): boolean {
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

function handoffReady(handoff: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "terminal_handoff_ready"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.terminal_handoff_ready
    && handoff.integration_step_count > 0
    && handoff.terminal_notes.length > 0
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

function scope(decision: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecision): string[] {
  if (decision !== "approve_future_executable_integration_planning") return [];
  return [
    "Prepare executable integration planning artifacts only.",
    "Describe guarded import boundaries without adding runtime imports.",
    "Describe storage-write gates without enabling file or database writes.",
    "Require a new explicit confirmation before executable call-site wiring exists.",
  ];
}

function boundary(decision: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecision): string {
  if (decision === "approve_future_executable_integration_planning") return "Future executable integration planning may proceed in side-effect-free artifacts only; runtime imports, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, and pushes remain separate explicit boundaries.";
  if (decision === "defer") return "Executable pure scaffold integration remains deferred; continue with terminal handoff records only.";
  return "Executable pure scaffold integration is rejected; do not proceed until a new approval chain is created.";
}

export function createRuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacketInput, handoff: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff): RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    decision_id: safe(input.decision_id, "runtime-scheduler-persistent-store-pure-scaffold-integration-operator-decision"),
    decision_state: ready ? "operator_decision_ready" : "blocked",
    decision_packet_only: true,
    source_handoff_state: handoff.handoff_state,
    decision: input.decision,
    decision_note: ready ? safe(input.decision_note, "Persistent-store pure scaffold integration operator decision recorded.") : "No decision note available while blocked.",
    adapter_interface_name: safe(handoff.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    integration_step_count: ready ? handoff.integration_step_count : 0,
    allowed_future_scope: ready ? scope(input.decision) : [],
    next_boundary: ready ? boundary(input.decision) : "Resolve blocked integration terminal handoff or unsafe decision input before continuing.",
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
    validation: { complete: ready, operator_decision_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold integration operator decision input or handoff was unsafe/incomplete."], warnings: ["Decision packet only; no runtime imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket {
  return { ...packet, decision_state: "revoked", integration_step_count: 0, allowed_future_scope: [], next_boundary: "No future scope available while revoked.", validation: { complete: false, operator_decision_ready: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold integration operator decision packet was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket(packet: RuntimeSchedulerPersistentStorePureScaffoldIntegrationOperatorDecisionPacket): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold integration operator decision packet",
    `State: ${packet.decision_state}`,
    `Decision: ${packet.decision}`,
    `Decision note: ${packet.decision_note}`,
    `Adapter interface: ${packet.adapter_interface_name}`,
    `Integration step count: ${packet.integration_step_count}`,
    "Allowed future scope:",
    ...(packet.allowed_future_scope.length ? packet.allowed_future_scope.map((item) => `- ${item}`) : ["- blocked"]),
    `Next boundary: ${packet.next_boundary}`,
    `File writes enabled: ${packet.file_write_enabled}`,
    `Database writes enabled: ${packet.database_write_enabled}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
