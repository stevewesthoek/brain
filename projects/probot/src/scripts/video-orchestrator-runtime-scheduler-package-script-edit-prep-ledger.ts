import type { RuntimeSchedulerPackageScriptEditAuditCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-audit-closeout.js";

export type RuntimeSchedulerPackageScriptEditPrepLedgerState = "prep_ledger_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditPrepLedgerInput {
  ledger_id: string;
  operator_id: string;
  recorded_at: string;
  allow_ledger_only: true;
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

export interface RuntimeSchedulerPackageScriptEditPrepLedger {
  schema_version: "1.0";
  ledger_id: string;
  ledger_state: RuntimeSchedulerPackageScriptEditPrepLedgerState;
  ledger_only: true;
  recorded_at: string;
  source_closeout_state: RuntimeSchedulerPackageScriptEditAuditCloseout["closeout_state"];
  package_json_path: string;
  commit_message: string;
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
  validation: { complete: boolean; prep_ledger_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 420) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditPrepLedgerInput): boolean {
  return input.allow_ledger_only === true
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
    && input.ledger_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.recorded_at.trim().length > 0;
}

function closeoutReady(closeout: RuntimeSchedulerPackageScriptEditAuditCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "closed_for_explicit_package_json_edit_boundary"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.closed_for_explicit_package_json_edit_boundary
    && closeout.package_json_path === "projects/probot/package.json"
    && closeout.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && closeout.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
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

export function createRuntimeSchedulerPackageScriptEditPrepLedger(input: RuntimeSchedulerPackageScriptEditPrepLedgerInput, closeout: RuntimeSchedulerPackageScriptEditAuditCloseout): RuntimeSchedulerPackageScriptEditPrepLedger {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    ledger_id: safe(input.ledger_id, "runtime-scheduler-package-script-edit-prep-ledger"),
    ledger_state: ready ? "prep_ledger_ready" : "blocked",
    ledger_only: true,
    recorded_at: safe(input.recorded_at, "1970-01-01T00:00:00.000Z"),
    source_closeout_state: closeout.closeout_state,
    package_json_path: safe(closeout.package_json_path, "projects/probot/package.json"),
    commit_message: safe(closeout.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    final_boundary: ready ? closeout.final_boundary : "Resolve blocked audit closeout or unsafe ledger input before continuing.",
    required_confirmation: ready ? closeout.required_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, prep_ledger_ready: ready, blocking_reasons: ready ? [] : ["Package script edit prep ledger input or audit closeout was unsafe/incomplete."], warnings: ["Prep ledger only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditPrepLedger(ledger: RuntimeSchedulerPackageScriptEditPrepLedger, reason?: string): RuntimeSchedulerPackageScriptEditPrepLedger {
  return { ...ledger, ledger_state: "revoked", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, prep_ledger_ready: false, blocking_reasons: ledger.validation.blocking_reasons, warnings: [...ledger.validation.warnings, safe(reason, "Package script edit prep ledger was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditPrepLedger(ledger: RuntimeSchedulerPackageScriptEditPrepLedger): string {
  return [
    "Video Orchestrator runtime scheduler package script edit prep ledger",
    `State: ${ledger.ledger_state}`,
    `Recorded at: ${ledger.recorded_at}`,
    `Path: ${ledger.package_json_path}`,
    `Commit message: ${ledger.commit_message}`,
    `Final boundary: ${ledger.final_boundary}`,
    `package.json edited: ${ledger.package_json_edited}`,
    `Live scheduler enabled: ${ledger.live_scheduler_enabled}`,
    `Committed now: ${ledger.committed_now}`,
    `Pushed now: ${ledger.pushed_now}`,
  ].join("\n");
}
