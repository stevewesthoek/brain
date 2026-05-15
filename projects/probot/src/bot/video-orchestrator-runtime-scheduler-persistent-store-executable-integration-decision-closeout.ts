import type { RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-executable-integration-operator-decision-packet.js";

export type RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseoutState = "decision_closeout_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseoutInput {
  closeout_id: string;
  operator_id: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseoutState;
  closeout_only: true;
  source_decision_state: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket["decision_state"];
  decision: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket["decision"];
  adapter_interface_name: string;
  plan_step_count: number;
  allowed_future_scope_count: number;
  closeout_items: string[];
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
  validation: { complete: boolean; decision_closeout_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseoutInput): boolean {
  return input.allow_closeout_only === true
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
    && input.closeout_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function packetReady(packet: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.decision_state === "operator_decision_ready"
    && packet.decision_packet_only
    && packet.validation.complete
    && packet.validation.operator_decision_ready
    && packet.plan_step_count > 0
    && !packet.runtime_imports_enabled
    && !packet.file_write_enabled
    && !packet.database_write_enabled
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

function closeoutItems(packet: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket): string[] {
  if (packet.decision === "approve_future_runtime_import_planning") return [
    "Operator approved future runtime import planning artifacts only.",
    "No runtime import, executable integration, persistence, or live scheduler behavior is enabled by this closeout.",
    "Future runtime imports still require a separate explicit boundary before code wiring is introduced.",
  ];
  if (packet.decision === "defer") return ["Operator deferred runtime import planning.", "Runtime scheduler remains in side-effect-free executable integration handoff mode."];
  return ["Operator rejected runtime import planning.", "Runtime scheduler executable integration remains disabled until a new approval chain is created."];
}

export function createRuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout(input: RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseoutInput, packet: RuntimeSchedulerPersistentStoreExecutableIntegrationOperatorDecisionPacket): RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout {
  const ready = inputReady(input) && packetReady(packet);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-persistent-store-executable-integration-decision-closeout"),
    closeout_state: ready ? "decision_closeout_ready" : "blocked",
    closeout_only: true,
    source_decision_state: packet.decision_state,
    decision: packet.decision,
    adapter_interface_name: safe(packet.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    plan_step_count: ready ? packet.plan_step_count : 0,
    allowed_future_scope_count: ready ? packet.allowed_future_scope.length : 0,
    closeout_items: ready ? closeoutItems(packet) : [],
    next_boundary: ready ? packet.next_boundary : "Resolve blocked operator decision packet or unsafe closeout input before continuing.",
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
    validation: { complete: ready, decision_closeout_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store executable integration decision closeout input or operator decision packet was unsafe/incomplete."], warnings: ["Decision closeout only; no runtime imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout(closeout: RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout, reason?: string): RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout {
  return { ...closeout, closeout_state: "revoked", plan_step_count: 0, allowed_future_scope_count: 0, closeout_items: [], validation: { complete: false, decision_closeout_ready: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Runtime scheduler persistent-store executable integration decision closeout was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout(closeout: RuntimeSchedulerPersistentStoreExecutableIntegrationDecisionCloseout): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store executable integration decision closeout",
    `State: ${closeout.closeout_state}`,
    `Decision: ${closeout.decision}`,
    `Adapter interface: ${closeout.adapter_interface_name}`,
    `Plan step count: ${closeout.plan_step_count}`,
    `Allowed future scope count: ${closeout.allowed_future_scope_count}`,
    "Closeout items:",
    ...(closeout.closeout_items.length ? closeout.closeout_items.map((item) => `- ${item}`) : ["- blocked"]),
    `Next boundary: ${closeout.next_boundary}`,
    `Runtime imports enabled: ${closeout.runtime_imports_enabled}`,
    `File writes enabled: ${closeout.file_write_enabled}`,
    `Database writes enabled: ${closeout.database_write_enabled}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
  ].join("\n");
}
