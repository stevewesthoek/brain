import type { RuntimeSchedulerPackageScriptEditReadinessReceipt } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-receipt.js";

export type RuntimeSchedulerPackageScriptEditReadinessArchiveState = "readiness_archive_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveInput {
  archive_id: string;
  operator_id: string;
  archived_at: string;
  allow_archive_only: true;
  allow_package_json_edit: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPackageScriptEditReadinessArchive {
  schema_version: "1.0";
  archive_id: string;
  archive_state: RuntimeSchedulerPackageScriptEditReadinessArchiveState;
  archive_only: true;
  archived_at: string;
  source_receipt_state: RuntimeSchedulerPackageScriptEditReadinessReceipt["receipt_state"];
  decision: RuntimeSchedulerPackageScriptEditReadinessReceipt["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  immutable_notes: string[];
  package_json_edited: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; readiness_archive_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 540) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessArchiveInput): boolean {
  return input.allow_archive_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.archive_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.archived_at.trim().length > 0;
}

function receiptReady(receipt: RuntimeSchedulerPackageScriptEditReadinessReceipt): boolean {
  return receipt.schema_version === "1.0"
    && receipt.receipt_state === "readiness_receipt_ready"
    && receipt.receipt_only
    && receipt.validation.complete
    && receipt.validation.readiness_receipt_ready
    && receipt.package_json_path === "projects/probot/package.json"
    && receipt.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && receipt.allowed_future_change.includes("probot:video:runtime-scheduler")
    && !receipt.package_json_edited
    && !receipt.live_scheduler_enabled
    && !receipt.upload_execution_enabled
    && !receipt.network_enabled
    && !receipt.credential_access_enabled
    && !receipt.media_read_enabled
    && !receipt.file_write_enabled
    && !receipt.git_add_executed
    && !receipt.committed_now
    && !receipt.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditReadinessArchive(input: RuntimeSchedulerPackageScriptEditReadinessArchiveInput, receipt: RuntimeSchedulerPackageScriptEditReadinessReceipt): RuntimeSchedulerPackageScriptEditReadinessArchive {
  const ready = inputReady(input) && receiptReady(receipt);
  return {
    schema_version: "1.0",
    archive_id: safe(input.archive_id, "runtime-scheduler-package-script-edit-readiness-archive"),
    archive_state: ready ? "readiness_archive_ready" : "blocked",
    archive_only: true,
    archived_at: safe(input.archived_at, "1970-01-01T00:00:00.000Z"),
    source_receipt_state: receipt.receipt_state,
    decision: receipt.decision,
    package_json_path: safe(receipt.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? receipt.allowed_future_change : "none",
    final_boundary: ready ? receipt.final_boundary : "Resolve blocked readiness receipt or unsafe archive input before continuing.",
    required_confirmation: ready ? receipt.required_confirmation : "No confirmation available while blocked.",
    immutable_notes: ready ? [
      "Archive is informational only and performs no package.json edit.",
      "Future execution remains limited to one scripts entry in projects/probot/package.json.",
      "Live runtime behavior, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled by this module.",
    ] : [],
    package_json_edited: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, readiness_archive_ready: ready, blocking_reasons: ready ? [] : ["Package script edit readiness archive input or receipt was unsafe/incomplete."], warnings: ["Readiness archive only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessArchive(archive: RuntimeSchedulerPackageScriptEditReadinessArchive, reason?: string): RuntimeSchedulerPackageScriptEditReadinessArchive {
  return { ...archive, archive_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", immutable_notes: [], validation: { complete: false, readiness_archive_ready: false, blocking_reasons: archive.validation.blocking_reasons, warnings: [...archive.validation.warnings, safe(reason, "Package script edit readiness archive was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessArchive(archive: RuntimeSchedulerPackageScriptEditReadinessArchive): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness archive",
    `State: ${archive.archive_state}`,
    `Archived at: ${archive.archived_at}`,
    `Decision: ${archive.decision}`,
    `Path: ${archive.package_json_path}`,
    `Allowed future change: ${archive.allowed_future_change}`,
    `Final boundary: ${archive.final_boundary}`,
    "Immutable notes:",
    ...(archive.immutable_notes.length ? archive.immutable_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${archive.package_json_edited}`,
    `Live scheduler enabled: ${archive.live_scheduler_enabled}`,
    `Committed now: ${archive.committed_now}`,
    `Pushed now: ${archive.pushed_now}`,
  ].join("\n");
}
