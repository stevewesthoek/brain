import type { RuntimeSchedulerPackageScriptEditDecisionLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-ledger.js";

export type RuntimeSchedulerPackageScriptEditDecisionSummaryState = "decision_summary_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditDecisionSummaryInput {
  summary_id: string;
  operator_id: string;
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

export interface RuntimeSchedulerPackageScriptEditDecisionSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerPackageScriptEditDecisionSummaryState;
  summary_only: true;
  source_ledger_state: RuntimeSchedulerPackageScriptEditDecisionLedger["ledger_state"];
  decision: RuntimeSchedulerPackageScriptEditDecisionLedger["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  summary_items: string[];
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
  validation: { complete: boolean; decision_summary_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 500) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditDecisionSummaryInput): boolean {
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
    && input.operator_id.trim().length > 0;
}

function ledgerReady(ledger: RuntimeSchedulerPackageScriptEditDecisionLedger): boolean {
  return ledger.schema_version === "1.0"
    && ledger.ledger_state === "decision_ledger_ready"
    && ledger.ledger_only
    && ledger.validation.complete
    && ledger.validation.decision_ledger_ready
    && ledger.package_json_path === "projects/probot/package.json"
    && !ledger.package_json_edited
    && !ledger.live_scheduler_enabled
    && !ledger.upload_execution_enabled
    && !ledger.network_enabled
    && !ledger.credential_access_enabled
    && !ledger.media_read_enabled
    && !ledger.file_write_enabled
    && !ledger.git_add_executed
    && !ledger.committed_now
    && !ledger.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditDecisionSummary(input: RuntimeSchedulerPackageScriptEditDecisionSummaryInput, ledger: RuntimeSchedulerPackageScriptEditDecisionLedger): RuntimeSchedulerPackageScriptEditDecisionSummary {
  const ready = inputReady(input) && ledgerReady(ledger);
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-package-script-edit-decision-summary"),
    summary_state: ready ? "decision_summary_ready" : "blocked",
    summary_only: true,
    source_ledger_state: ledger.ledger_state,
    decision: ledger.decision,
    package_json_path: safe(ledger.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? ledger.allowed_future_change : "none",
    final_boundary: ready ? ledger.final_boundary : "Resolve blocked decision ledger or unsafe summary input before continuing.",
    required_confirmation: ready ? ledger.required_confirmation : "No confirmation available while blocked.",
    summary_items: ready ? [
      "Decision ledger is complete and side-effect-free.",
      "No package.json edit has been performed by the preparation chain.",
      "The future allowed change remains limited to the runtime scheduler package script entry.",
      "Runtime activation, uploads, network calls, credentials, media reads, file writes, git add, commit, and push remain disabled here.",
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
    validation: { complete: ready, decision_summary_ready: ready, blocking_reasons: ready ? [] : ["Package script edit decision summary input or ledger was unsafe/incomplete."], warnings: ["Decision summary only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditDecisionSummary(summary: RuntimeSchedulerPackageScriptEditDecisionSummary, reason?: string): RuntimeSchedulerPackageScriptEditDecisionSummary {
  return { ...summary, summary_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", summary_items: [], validation: { complete: false, decision_summary_ready: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Package script edit decision summary was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditDecisionSummary(summary: RuntimeSchedulerPackageScriptEditDecisionSummary): string {
  return [
    "Video Orchestrator runtime scheduler package script edit decision summary",
    `State: ${summary.summary_state}`,
    `Decision: ${summary.decision}`,
    `Path: ${summary.package_json_path}`,
    `Allowed future change: ${summary.allowed_future_change}`,
    `Final boundary: ${summary.final_boundary}`,
    "Summary items:",
    ...(summary.summary_items.length ? summary.summary_items.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${summary.package_json_edited}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
    `Committed now: ${summary.committed_now}`,
    `Pushed now: ${summary.pushed_now}`,
  ].join("\n");
}
