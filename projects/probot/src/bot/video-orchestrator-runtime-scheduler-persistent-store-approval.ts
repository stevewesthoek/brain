import type { RuntimeSchedulerStoreReadinessSafeReport } from "./video-orchestrator-runtime-scheduler-store-readiness.js";

export type RuntimeSchedulerPersistentStoreApprovalState = "ready_for_operator_confirmation" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreApprovalDecision = "approve_persistent_store_planning" | "defer" | "reject";

export interface RuntimeSchedulerPersistentStoreApprovalInput {
  approval_id: string;
  operator_id: string;
  requested_decision: RuntimeSchedulerPersistentStoreApprovalDecision;
  proposed_store_kind: "repo_json" | "sqlite" | "external_queue" | "dashboard_runtime_store";
  proposed_path_or_reference: string;
  allow_approval_packet_only: true;
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

export interface RuntimeSchedulerPersistentStoreApprovalPacket {
  schema_version: "1.0";
  approval_id: string;
  approval_state: RuntimeSchedulerPersistentStoreApprovalState;
  approval_packet_only: true;
  decision: RuntimeSchedulerPersistentStoreApprovalDecision;
  proposed_store_kind: RuntimeSchedulerPersistentStoreApprovalInput["proposed_store_kind"];
  proposed_path_or_reference: string;
  source_safe_report_state: RuntimeSchedulerStoreReadinessSafeReport["safe_report_state"];
  source_item_count: number;
  required_confirmation: string;
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
  validation: { complete: boolean; ready_for_operator_confirmation: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 220) : fallback;
}

function safeReference(value: string): string {
  const text = safe(value, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  if (text.startsWith("/") || text.includes("..") || text.includes(".env") || text.includes(".git/") || text.includes("node_modules/") || text.includes("secrets")) return "blocked-reference";
  return text;
}

function inputReady(input: RuntimeSchedulerPersistentStoreApprovalInput): boolean {
  return input.allow_approval_packet_only === true
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
    && input.approval_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && safeReference(input.proposed_path_or_reference) !== "blocked-reference";
}

function reportReady(report: RuntimeSchedulerStoreReadinessSafeReport): boolean {
  return report.schema_version === "1.0"
    && report.safe_report_only
    && report.safe_report_state === "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging"
    && report.validation.complete
    && report.source_item_count > 0
    && !report.file_write_enabled
    && !report.database_write_enabled
    && !report.live_scheduler_enabled
    && !report.upload_execution_enabled
    && !report.network_enabled
    && !report.credential_access_enabled
    && !report.media_read_enabled
    && !report.git_add_executed
    && !report.committed_now
    && !report.pushed_now;
}

function confirmationFor(decision: RuntimeSchedulerPersistentStoreApprovalDecision, kind: RuntimeSchedulerPersistentStoreApprovalInput["proposed_store_kind"], reference: string): string {
  if (decision === "approve_persistent_store_planning") return `I approve persistent scheduler store implementation planning only for ${kind} at ${reference}, with no writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes until separately confirmed.`;
  if (decision === "defer") return "Persistent scheduler store implementation is deferred; keep memory-store/readiness mode only.";
  return "Persistent scheduler store implementation is rejected; keep runtime scheduler persistence disabled.";
}

function boundaryFor(decision: RuntimeSchedulerPersistentStoreApprovalDecision): string {
  if (decision === "approve_persistent_store_planning") return "Next step may plan the persistent store implementation contract only; actual writes, migrations, live scheduler activation, git staging, commits, and pushes remain separate explicit boundaries.";
  if (decision === "defer") return "Stop at memory-store/readiness mode until a new explicit approval is supplied.";
  return "Stop; do not implement persistent store behavior.";
}

export function createRuntimeSchedulerPersistentStoreApprovalPacket(input: RuntimeSchedulerPersistentStoreApprovalInput, report: RuntimeSchedulerStoreReadinessSafeReport): RuntimeSchedulerPersistentStoreApprovalPacket {
  const reference = safeReference(input.proposed_path_or_reference);
  const ready = inputReady(input) && reportReady(report);
  return {
    schema_version: "1.0",
    approval_id: safe(input.approval_id, "runtime-scheduler-persistent-store-approval"),
    approval_state: ready ? "ready_for_operator_confirmation" : "blocked",
    approval_packet_only: true,
    decision: input.requested_decision,
    proposed_store_kind: input.proposed_store_kind,
    proposed_path_or_reference: reference,
    source_safe_report_state: report.safe_report_state,
    source_item_count: ready ? report.source_item_count : 0,
    required_confirmation: ready ? confirmationFor(input.requested_decision, input.proposed_store_kind, reference) : "No confirmation available while blocked.",
    next_boundary: ready ? boundaryFor(input.requested_decision) : "Resolve blocked safe report or unsafe approval packet input before continuing.",
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
    validation: { complete: ready, ready_for_operator_confirmation: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store approval packet input or safe report was unsafe/incomplete."], warnings: ["Approval packet only; persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, and pushes remain disabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreApprovalPacket(packet: RuntimeSchedulerPersistentStoreApprovalPacket, reason?: string): RuntimeSchedulerPersistentStoreApprovalPacket {
  return { ...packet, approval_state: "revoked", source_item_count: 0, required_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_operator_confirmation: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler persistent-store approval packet was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreApprovalPacket(packet: RuntimeSchedulerPersistentStoreApprovalPacket): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store approval packet",
    `State: ${packet.approval_state}`,
    `Decision: ${packet.decision}`,
    `Store kind: ${packet.proposed_store_kind}`,
    `Reference: ${packet.proposed_path_or_reference}`,
    `Source items: ${packet.source_item_count}`,
    `Required confirmation: ${packet.required_confirmation}`,
    `Next boundary: ${packet.next_boundary}`,
    `File writes enabled: ${packet.file_write_enabled}`,
    `Database writes enabled: ${packet.database_write_enabled}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
