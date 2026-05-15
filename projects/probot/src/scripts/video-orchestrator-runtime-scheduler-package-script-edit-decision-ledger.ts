import type { RuntimeSchedulerPackageScriptEditDecisionCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-closeout.js";

export type RuntimeSchedulerPackageScriptEditDecisionLedgerState = "decision_ledger_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditDecisionLedgerInput {
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

export interface RuntimeSchedulerPackageScriptEditDecisionLedger {
  schema_version: "1.0";
  ledger_id: string;
  ledger_state: RuntimeSchedulerPackageScriptEditDecisionLedgerState;
  ledger_only: true;
  recorded_at: string;
  source_closeout_state: RuntimeSchedulerPackageScriptEditDecisionCloseout["closeout_state"];
  decision: RuntimeSchedulerPackageScriptEditDecisionCloseout["decision"];
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
  validation: { complete: boolean; decision_ledger_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 480) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditDecisionLedgerInput): boolean {
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

function closeoutReady(closeout: RuntimeSchedulerPackageScriptEditDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.closeout_ready
    && closeout.package_json_path === "projects/probot/package.json"
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

export function createRuntimeSchedulerPackageScriptEditDecisionLedger(input: RuntimeSchedulerPackageScriptEditDecisionLedgerInput, closeout: RuntimeSchedulerPackageScriptEditDecisionCloseout): RuntimeSchedulerPackageScriptEditDecisionLedger {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    ledger_id: safe(input.ledger_id, "runtime-scheduler-package-script-edit-decision-ledger"),
    ledger_state: ready ? "decision_ledger_ready" : "blocked",
    ledger_only: true,
    recorded_at: safe(input.recorded_at, "1970-01-01T00:00:00.000Z"),
    source_closeout_state: closeout.closeout_state,
    decision: closeout.decision,
    package_json_path: safe(closeout.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? closeout.allowed_future_change : "none",
    final_boundary: ready ? closeout.final_boundary : "Resolve blocked decision closeout or unsafe ledger input before continuing.",
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
    validation: { complete: ready, decision_ledger_ready: ready, blocking_reasons: ready ? [] : ["Package script edit decision ledger input or closeout was unsafe/incomplete."], warnings: ["Decision ledger only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditDecisionLedger(ledger: RuntimeSchedulerPackageScriptEditDecisionLedger, reason?: string): RuntimeSchedulerPackageScriptEditDecisionLedger {
  return { ...ledger, ledger_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, decision_ledger_ready: false, blocking_reasons: ledger.validation.blocking_reasons, warnings: [...ledger.validation.warnings, safe(reason, "Package script edit decision ledger was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditDecisionLedger(ledger: RuntimeSchedulerPackageScriptEditDecisionLedger): string {
  return [
    "Video Orchestrator runtime scheduler package script edit decision ledger",
    `State: ${ledger.ledger_state}`,
    `Recorded at: ${ledger.recorded_at}`,
    `Decision: ${ledger.decision}`,
    `Path: ${ledger.package_json_path}`,
    `Allowed future change: ${ledger.allowed_future_change}`,
    `Final boundary: ${ledger.final_boundary}`,
    `package.json edited: ${ledger.package_json_edited}`,
    `Live scheduler enabled: ${ledger.live_scheduler_enabled}`,
    `Committed now: ${ledger.committed_now}`,
    `Pushed now: ${ledger.pushed_now}`,
  ].join("\n");
}
