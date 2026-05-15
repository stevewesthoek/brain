import type { RuntimeSchedulerPackageScriptEditPrepSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-summary.js";

export type RuntimeSchedulerPackageScriptEditBoundaryReportState = "boundary_report_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditBoundaryReportInput {
  report_id: string;
  operator_id: string;
  allow_report_only: true;
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

export interface RuntimeSchedulerPackageScriptEditBoundaryReport {
  schema_version: "1.0";
  report_id: string;
  report_state: RuntimeSchedulerPackageScriptEditBoundaryReportState;
  report_only: true;
  source_summary_state: RuntimeSchedulerPackageScriptEditPrepSummary["summary_state"];
  package_json_path: string;
  commit_message: string;
  required_confirmation: string;
  next_boundary: string;
  allowed_future_change: string;
  disallowed_future_changes: string[];
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
  validation: { complete: boolean; boundary_report_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 460) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditBoundaryReportInput): boolean {
  return input.allow_report_only === true
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
    && input.report_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function summaryReady(summary: RuntimeSchedulerPackageScriptEditPrepSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "prep_summary_ready"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.prep_summary_ready
    && summary.package_json_path === "projects/probot/package.json"
    && summary.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && summary.next_boundary.includes("separate explicitly approved package.json edit")
    && summary.ready_items.length > 0
    && !summary.package_json_edited
    && !summary.live_scheduler_enabled
    && !summary.upload_execution_enabled
    && !summary.network_enabled
    && !summary.credential_access_enabled
    && !summary.media_read_enabled
    && !summary.file_write_enabled
    && !summary.git_add_executed
    && !summary.committed_now
    && !summary.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditBoundaryReport(input: RuntimeSchedulerPackageScriptEditBoundaryReportInput, summary: RuntimeSchedulerPackageScriptEditPrepSummary): RuntimeSchedulerPackageScriptEditBoundaryReport {
  const ready = inputReady(input) && summaryReady(summary);
  return {
    schema_version: "1.0",
    report_id: safe(input.report_id, "runtime-scheduler-package-script-edit-boundary-report"),
    report_state: ready ? "boundary_report_ready" : "blocked",
    report_only: true,
    source_summary_state: summary.summary_state,
    package_json_path: safe(summary.package_json_path, "projects/probot/package.json"),
    commit_message: safe(summary.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    required_confirmation: ready ? summary.required_confirmation : "No confirmation available while blocked.",
    next_boundary: ready ? summary.next_boundary : "Resolve blocked prep summary or unsafe report input before continuing.",
    allowed_future_change: ready ? "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json." : "none",
    disallowed_future_changes: ready ? [
      "package metadata unrelated to scripts",
      "live scheduler activation",
      "upload execution",
      "network calls",
      "credential access",
      "media reads",
      "persistent scheduler writes",
      "git add, commit, or push without separate verification",
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
    validation: { complete: ready, boundary_report_ready: ready, blocking_reasons: ready ? [] : ["Package script edit boundary report input or prep summary was unsafe/incomplete."], warnings: ["Boundary report only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditBoundaryReport(report: RuntimeSchedulerPackageScriptEditBoundaryReport, reason?: string): RuntimeSchedulerPackageScriptEditBoundaryReport {
  return { ...report, report_state: "revoked", required_confirmation: "No confirmation available while revoked.", allowed_future_change: "none", disallowed_future_changes: [], validation: { complete: false, boundary_report_ready: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Package script edit boundary report was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditBoundaryReport(report: RuntimeSchedulerPackageScriptEditBoundaryReport): string {
  return [
    "Video Orchestrator runtime scheduler package script edit boundary report",
    `State: ${report.report_state}`,
    `Path: ${report.package_json_path}`,
    `Commit message: ${report.commit_message}`,
    `Allowed future change: ${report.allowed_future_change}`,
    `Next boundary: ${report.next_boundary}`,
    "Disallowed future changes:",
    ...(report.disallowed_future_changes.length ? report.disallowed_future_changes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${report.package_json_edited}`,
    `Live scheduler enabled: ${report.live_scheduler_enabled}`,
    `Committed now: ${report.committed_now}`,
    `Pushed now: ${report.pushed_now}`,
  ].join("\n");
}
