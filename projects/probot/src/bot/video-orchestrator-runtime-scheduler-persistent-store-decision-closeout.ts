import type { RuntimeSchedulerPersistentStoreOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-operator-decision-packet.js";

export type RuntimeSchedulerPersistentStoreDecisionCloseoutState = "decision_closeout_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreDecisionCloseoutInput {
  closeout_id: string;
  operator_id: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerPersistentStoreDecisionCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerPersistentStoreDecisionCloseoutState;
  closeout_only: true;
  source_decision_state: RuntimeSchedulerPersistentStoreOperatorDecisionPacket["decision_state"];
  decision: RuntimeSchedulerPersistentStoreOperatorDecisionPacket["decision"];
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreOperatorDecisionPacket["store_kind"];
  store_reference: string;
  operation_count: number;
  allowed_future_scope_count: number;
  closeout_items: string[];
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
  validation: { complete: boolean; decision_closeout_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreDecisionCloseoutInput): boolean {
  return input.allow_closeout_only === true
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

function packetReady(packet: RuntimeSchedulerPersistentStoreOperatorDecisionPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.decision_state === "operator_decision_ready"
    && packet.decision_packet_only
    && packet.validation.complete
    && packet.validation.operator_decision_ready
    && packet.operation_count > 0
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

function closeoutItems(packet: RuntimeSchedulerPersistentStoreOperatorDecisionPacket): string[] {
  if (packet.decision === "approve_future_implementation_planning") return [
    "Operator approved future implementation planning artifacts only.",
    "No executable persistent-store behavior is enabled by this closeout.",
    "Future implementation still requires a separate explicit boundary before writes are introduced.",
  ];
  if (packet.decision === "defer") return [
    "Operator deferred persistent-store implementation planning.",
    "Runtime scheduler remains in side-effect-free review mode.",
  ];
  return [
    "Operator rejected persistent-store implementation planning.",
    "Runtime scheduler persistence remains disabled until a new approval chain is created.",
  ];
}

export function createRuntimeSchedulerPersistentStoreDecisionCloseout(input: RuntimeSchedulerPersistentStoreDecisionCloseoutInput, packet: RuntimeSchedulerPersistentStoreOperatorDecisionPacket): RuntimeSchedulerPersistentStoreDecisionCloseout {
  const ready = inputReady(input) && packetReady(packet);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-persistent-store-decision-closeout"),
    closeout_state: ready ? "decision_closeout_ready" : "blocked",
    closeout_only: true,
    source_decision_state: packet.decision_state,
    decision: packet.decision,
    adapter_name: safe(packet.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: packet.store_kind,
    store_reference: safe(packet.store_reference, "blocked-reference"),
    operation_count: ready ? packet.operation_count : 0,
    allowed_future_scope_count: ready ? packet.allowed_future_scope.length : 0,
    closeout_items: ready ? closeoutItems(packet) : [],
    next_boundary: ready ? packet.next_boundary : "Resolve blocked operator decision packet or unsafe closeout input before continuing.",
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
    validation: { complete: ready, decision_closeout_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store decision closeout input or operator decision packet was unsafe/incomplete."], warnings: ["Decision closeout only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreDecisionCloseout(closeout: RuntimeSchedulerPersistentStoreDecisionCloseout, reason?: string): RuntimeSchedulerPersistentStoreDecisionCloseout {
  return { ...closeout, closeout_state: "revoked", operation_count: 0, allowed_future_scope_count: 0, closeout_items: [], validation: { complete: false, decision_closeout_ready: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Runtime scheduler persistent-store decision closeout was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreDecisionCloseout(closeout: RuntimeSchedulerPersistentStoreDecisionCloseout): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store decision closeout",
    `State: ${closeout.closeout_state}`,
    `Decision: ${closeout.decision}`,
    `Adapter: ${closeout.adapter_name}`,
    `Store kind: ${closeout.store_kind}`,
    `Store reference: ${closeout.store_reference}`,
    `Operation count: ${closeout.operation_count}`,
    `Allowed future scope count: ${closeout.allowed_future_scope_count}`,
    "Closeout items:",
    ...(closeout.closeout_items.length ? closeout.closeout_items.map((item) => `- ${item}`) : ["- blocked"]),
    `Next boundary: ${closeout.next_boundary}`,
    `File writes enabled: ${closeout.file_write_enabled}`,
    `Database writes enabled: ${closeout.database_write_enabled}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
  ].join("\n");
}
