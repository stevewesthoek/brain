import type { RuntimeSchedulerPackageScriptEditReadinessArchiveSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-summary.js";

export type RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceiptState = "terminal_receipt_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceiptInput {
  receipt_id: string;
  operator_id: string;
  issued_at: string;
  allow_receipt_only: true;
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

export interface RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt {
  schema_version: "1.0";
  receipt_id: string;
  receipt_state: RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceiptState;
  receipt_only: true;
  issued_at: string;
  source_summary_state: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary["summary_state"];
  decision: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  receipt_notes: string[];
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
  validation: { complete: boolean; terminal_receipt_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 560) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceiptInput): boolean {
  return input.allow_receipt_only === true
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
    && input.receipt_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.issued_at.trim().length > 0;
}

function summaryReady(summary: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "readiness_archive_summary_ready"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.readiness_archive_summary_ready
    && summary.package_json_path === "projects/probot/package.json"
    && summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && summary.allowed_future_change.includes("probot:video:runtime-scheduler")
    && summary.summary_notes.length > 0
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

export function createRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(input: RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceiptInput, summary: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary): RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt {
  const ready = inputReady(input) && summaryReady(summary);
  return {
    schema_version: "1.0",
    receipt_id: safe(input.receipt_id, "runtime-scheduler-package-script-edit-readiness-archive-terminal-receipt"),
    receipt_state: ready ? "terminal_receipt_ready" : "blocked",
    receipt_only: true,
    issued_at: safe(input.issued_at, "1970-01-01T00:00:00.000Z"),
    source_summary_state: summary.summary_state,
    decision: summary.decision,
    package_json_path: safe(summary.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? summary.allowed_future_change : "none",
    final_boundary: ready ? summary.final_boundary : "Resolve blocked readiness archive summary or unsafe terminal receipt input before continuing.",
    required_confirmation: ready ? summary.required_confirmation : "No confirmation available while blocked.",
    receipt_notes: ready ? [
      "Terminal receipt is informational only and performs no package.json edit.",
      "The next executable action remains separately approved and scoped to one package script entry.",
      "Live scheduler activation, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled here.",
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
    validation: { complete: ready, terminal_receipt_ready: ready, blocking_reasons: ready ? [] : ["Package script edit readiness archive terminal receipt input or summary was unsafe/incomplete."], warnings: ["Terminal receipt only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(receipt: RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt, reason?: string): RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt {
  return { ...receipt, receipt_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", receipt_notes: [], validation: { complete: false, terminal_receipt_ready: false, blocking_reasons: receipt.validation.blocking_reasons, warnings: [...receipt.validation.warnings, safe(reason, "Package script edit readiness archive terminal receipt was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(receipt: RuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness archive terminal receipt",
    `State: ${receipt.receipt_state}`,
    `Issued at: ${receipt.issued_at}`,
    `Decision: ${receipt.decision}`,
    `Path: ${receipt.package_json_path}`,
    `Allowed future change: ${receipt.allowed_future_change}`,
    `Final boundary: ${receipt.final_boundary}`,
    "Receipt notes:",
    ...(receipt.receipt_notes.length ? receipt.receipt_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${receipt.package_json_edited}`,
    `Live scheduler enabled: ${receipt.live_scheduler_enabled}`,
    `Committed now: ${receipt.committed_now}`,
    `Pushed now: ${receipt.pushed_now}`,
  ].join("\n");
}
