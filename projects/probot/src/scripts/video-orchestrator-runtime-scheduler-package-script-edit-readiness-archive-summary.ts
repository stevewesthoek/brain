import type { RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-closeout.js";

export type RuntimeSchedulerPackageScriptEditReadinessArchiveSummaryState = "readiness_archive_summary_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveSummaryInput {
  summary_id: string;
  operator_id: string;
  summarized_at: string;
  allow_summary_only: true;
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

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerPackageScriptEditReadinessArchiveSummaryState;
  summary_only: true;
  summarized_at: string;
  source_closeout_state: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout["closeout_state"];
  decision: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  summary_notes: string[];
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
  validation: { complete: boolean; readiness_archive_summary_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 560) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessArchiveSummaryInput): boolean {
  return input.allow_summary_only === true
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
    && input.summary_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.summarized_at.trim().length > 0;
}

function closeoutReady(closeout: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "readiness_archive_closed"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.readiness_archive_closed
    && closeout.package_json_path === "projects/probot/package.json"
    && closeout.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && closeout.allowed_future_change.includes("probot:video:runtime-scheduler")
    && closeout.closeout_notes.length > 0
    && !closeout.package_json_edited
    && !closeout.live_scheduler_enabled
    && !closeout.upload_execution_enabled
    && !closeout.network_enabled
    && !closeout.credential_access_enabled
    && !closeout.media_read_enabled
    && !closeout.file_write_enabled
    && !closeout.git_add_executed
    && !closeout.committed_now
    && !closeout.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(input: RuntimeSchedulerPackageScriptEditReadinessArchiveSummaryInput, closeout: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout): RuntimeSchedulerPackageScriptEditReadinessArchiveSummary {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-package-script-edit-readiness-archive-summary"),
    summary_state: ready ? "readiness_archive_summary_ready" : "blocked",
    summary_only: true,
    summarized_at: safe(input.summarized_at, "1970-01-01T00:00:00.000Z"),
    source_closeout_state: closeout.closeout_state,
    decision: closeout.decision,
    package_json_path: safe(closeout.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? closeout.allowed_future_change : "none",
    final_boundary: ready ? closeout.final_boundary : "Resolve blocked readiness archive closeout or unsafe summary input before continuing.",
    required_confirmation: ready ? closeout.required_confirmation : "No confirmation available while blocked.",
    summary_notes: ready ? [
      "Readiness archive closeout is complete and summary-only.",
      "No package.json edit has been performed in this chain.",
      "Only the runtime scheduler package script entry is allowed in the future execution step.",
      "Runtime activation, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled by this module.",
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
    validation: { complete: ready, readiness_archive_summary_ready: ready, blocking_reasons: ready ? [] : ["Package script edit readiness archive summary input or closeout was unsafe/incomplete."], warnings: ["Readiness archive summary only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(summary: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary, reason?: string): RuntimeSchedulerPackageScriptEditReadinessArchiveSummary {
  return { ...summary, summary_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", summary_notes: [], validation: { complete: false, readiness_archive_summary_ready: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Package script edit readiness archive summary was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(summary: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness archive summary",
    `State: ${summary.summary_state}`,
    `Summarized at: ${summary.summarized_at}`,
    `Decision: ${summary.decision}`,
    `Path: ${summary.package_json_path}`,
    `Allowed future change: ${summary.allowed_future_change}`,
    `Final boundary: ${summary.final_boundary}`,
    "Summary notes:",
    ...(summary.summary_notes.length ? summary.summary_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${summary.package_json_edited}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
    `Committed now: ${summary.committed_now}`,
    `Pushed now: ${summary.pushed_now}`,
  ].join("\n");
}
