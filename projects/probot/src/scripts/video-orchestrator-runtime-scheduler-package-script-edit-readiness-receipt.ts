import type { RuntimeSchedulerPackageScriptEditTerminalHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.js";

export type RuntimeSchedulerPackageScriptEditReadinessReceiptState = "readiness_receipt_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessReceiptInput {
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

export interface RuntimeSchedulerPackageScriptEditReadinessReceipt {
  schema_version: "1.0";
  receipt_id: string;
  receipt_state: RuntimeSchedulerPackageScriptEditReadinessReceiptState;
  receipt_only: true;
  issued_at: string;
  source_handoff_state: RuntimeSchedulerPackageScriptEditTerminalHandoff["handoff_state"];
  decision: RuntimeSchedulerPackageScriptEditTerminalHandoff["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
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
  validation: { complete: boolean; readiness_receipt_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 520) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessReceiptInput): boolean {
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

function handoffReady(handoff: RuntimeSchedulerPackageScriptEditTerminalHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "terminal_handoff_ready"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.terminal_handoff_ready
    && handoff.package_json_path === "projects/probot/package.json"
    && handoff.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && handoff.allowed_future_change.includes("probot:video:runtime-scheduler")
    && !handoff.package_json_edited
    && !handoff.live_scheduler_enabled
    && !handoff.upload_execution_enabled
    && !handoff.network_enabled
    && !handoff.credential_access_enabled
    && !handoff.media_read_enabled
    && !handoff.file_write_enabled
    && !handoff.git_add_executed
    && !handoff.committed_now
    && !handoff.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditReadinessReceipt(input: RuntimeSchedulerPackageScriptEditReadinessReceiptInput, handoff: RuntimeSchedulerPackageScriptEditTerminalHandoff): RuntimeSchedulerPackageScriptEditReadinessReceipt {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    receipt_id: safe(input.receipt_id, "runtime-scheduler-package-script-edit-readiness-receipt"),
    receipt_state: ready ? "readiness_receipt_ready" : "blocked",
    receipt_only: true,
    issued_at: safe(input.issued_at, "1970-01-01T00:00:00.000Z"),
    source_handoff_state: handoff.handoff_state,
    decision: handoff.decision,
    package_json_path: safe(handoff.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? handoff.allowed_future_change : "none",
    final_boundary: ready ? handoff.final_boundary : "Resolve blocked terminal handoff or unsafe readiness receipt input before continuing.",
    required_confirmation: ready ? handoff.required_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, readiness_receipt_ready: ready, blocking_reasons: ready ? [] : ["Package script edit readiness receipt input or terminal handoff was unsafe/incomplete."], warnings: ["Readiness receipt only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessReceipt(receipt: RuntimeSchedulerPackageScriptEditReadinessReceipt, reason?: string): RuntimeSchedulerPackageScriptEditReadinessReceipt {
  return { ...receipt, receipt_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, readiness_receipt_ready: false, blocking_reasons: receipt.validation.blocking_reasons, warnings: [...receipt.validation.warnings, safe(reason, "Package script edit readiness receipt was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessReceipt(receipt: RuntimeSchedulerPackageScriptEditReadinessReceipt): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness receipt",
    `State: ${receipt.receipt_state}`,
    `Issued at: ${receipt.issued_at}`,
    `Decision: ${receipt.decision}`,
    `Path: ${receipt.package_json_path}`,
    `Allowed future change: ${receipt.allowed_future_change}`,
    `Final boundary: ${receipt.final_boundary}`,
    `package.json edited: ${receipt.package_json_edited}`,
    `Live scheduler enabled: ${receipt.live_scheduler_enabled}`,
    `Committed now: ${receipt.committed_now}`,
    `Pushed now: ${receipt.pushed_now}`,
  ].join("\n");
}
