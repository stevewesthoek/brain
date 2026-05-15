import type { RuntimeSchedulerPackageScriptEditReadinessArchive } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive.js";

export type RuntimeSchedulerPackageScriptEditReadinessArchiveCloseoutState = "readiness_archive_closed" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveCloseoutInput {
  closeout_id: string;
  operator_id: string;
  closed_at: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseoutState;
  closeout_only: true;
  closed_at: string;
  source_archive_state: RuntimeSchedulerPackageScriptEditReadinessArchive["archive_state"];
  decision: RuntimeSchedulerPackageScriptEditReadinessArchive["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  closeout_notes: string[];
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
  validation: { complete: boolean; readiness_archive_closed: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 560) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseoutInput): boolean {
  return input.allow_closeout_only === true
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
    && input.closeout_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.closed_at.trim().length > 0;
}

function archiveReady(archive: RuntimeSchedulerPackageScriptEditReadinessArchive): boolean {
  return archive.schema_version === "1.0"
    && archive.archive_state === "readiness_archive_ready"
    && archive.archive_only
    && archive.validation.complete
    && archive.validation.readiness_archive_ready
    && archive.package_json_path === "projects/probot/package.json"
    && archive.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && archive.allowed_future_change.includes("probot:video:runtime-scheduler")
    && archive.immutable_notes.length > 0
    && !archive.package_json_edited
    && !archive.live_scheduler_enabled
    && !archive.upload_execution_enabled
    && !archive.network_enabled
    && !archive.credential_access_enabled
    && !archive.media_read_enabled
    && !archive.file_write_enabled
    && !archive.git_add_executed
    && !archive.committed_now
    && !archive.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(input: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseoutInput, archive: RuntimeSchedulerPackageScriptEditReadinessArchive): RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout {
  const ready = inputReady(input) && archiveReady(archive);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-package-script-edit-readiness-archive-closeout"),
    closeout_state: ready ? "readiness_archive_closed" : "blocked",
    closeout_only: true,
    closed_at: safe(input.closed_at, "1970-01-01T00:00:00.000Z"),
    source_archive_state: archive.archive_state,
    decision: archive.decision,
    package_json_path: safe(archive.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? archive.allowed_future_change : "none",
    final_boundary: ready ? archive.final_boundary : "Resolve blocked readiness archive or unsafe closeout input before continuing.",
    required_confirmation: ready ? archive.required_confirmation : "No confirmation available while blocked.",
    closeout_notes: ready ? [
      "Readiness archive has been closed for operator review.",
      "No package.json edit was performed by this closeout.",
      "The next executable action remains a separate explicit approval scoped only to one package script entry.",
      "Runtime activation, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled here.",
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
    validation: { complete: ready, readiness_archive_closed: ready, blocking_reasons: ready ? [] : ["Package script edit readiness archive closeout input or archive was unsafe/incomplete."], warnings: ["Readiness archive closeout only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(closeout: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout, reason?: string): RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout {
  return { ...closeout, closeout_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", closeout_notes: [], validation: { complete: false, readiness_archive_closed: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Package script edit readiness archive closeout was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(closeout: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness archive closeout",
    `State: ${closeout.closeout_state}`,
    `Closed at: ${closeout.closed_at}`,
    `Decision: ${closeout.decision}`,
    `Path: ${closeout.package_json_path}`,
    `Allowed future change: ${closeout.allowed_future_change}`,
    `Final boundary: ${closeout.final_boundary}`,
    "Closeout notes:",
    ...(closeout.closeout_notes.length ? closeout.closeout_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${closeout.package_json_edited}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
    `Committed now: ${closeout.committed_now}`,
    `Pushed now: ${closeout.pushed_now}`,
  ].join("\n");
}
