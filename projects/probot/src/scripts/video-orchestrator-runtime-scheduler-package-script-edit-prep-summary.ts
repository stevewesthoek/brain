import type { RuntimeSchedulerPackageScriptEditPrepLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-ledger.js";

export type RuntimeSchedulerPackageScriptEditPrepSummaryState = "prep_summary_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditPrepSummaryInput {
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

export interface RuntimeSchedulerPackageScriptEditPrepSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerPackageScriptEditPrepSummaryState;
  summary_only: true;
  source_ledger_state: RuntimeSchedulerPackageScriptEditPrepLedger["ledger_state"];
  package_json_path: string;
  commit_message: string;
  required_confirmation: string;
  next_boundary: string;
  ready_items: string[];
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
  validation: { complete: boolean; prep_summary_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 440) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditPrepSummaryInput): boolean {
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

function ledgerReady(ledger: RuntimeSchedulerPackageScriptEditPrepLedger): boolean {
  return ledger.schema_version === "1.0"
    && ledger.ledger_state === "prep_ledger_ready"
    && ledger.ledger_only
    && ledger.validation.complete
    && ledger.validation.prep_ledger_ready
    && ledger.package_json_path === "projects/probot/package.json"
    && ledger.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && ledger.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
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

export function createRuntimeSchedulerPackageScriptEditPrepSummary(input: RuntimeSchedulerPackageScriptEditPrepSummaryInput, ledger: RuntimeSchedulerPackageScriptEditPrepLedger): RuntimeSchedulerPackageScriptEditPrepSummary {
  const ready = inputReady(input) && ledgerReady(ledger);
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-package-script-edit-prep-summary"),
    summary_state: ready ? "prep_summary_ready" : "blocked",
    summary_only: true,
    source_ledger_state: ledger.ledger_state,
    package_json_path: safe(ledger.package_json_path, "projects/probot/package.json"),
    commit_message: safe(ledger.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    required_confirmation: ready ? ledger.required_confirmation : "No confirmation available while blocked.",
    next_boundary: ready ? "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler." : "Resolve blocked prep ledger or unsafe summary input before continuing.",
    ready_items: ready ? [
      "Audit closeout is recorded in the prep ledger.",
      "The package.json edit remains unperformed.",
      "The future edit is constrained to one scripts entry.",
      "Live scheduling, uploads, network calls, credentials, media reads, unrelated metadata changes, commits, and pushes remain blocked without separate scope.",
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
    validation: { complete: ready, prep_summary_ready: ready, blocking_reasons: ready ? [] : ["Package script edit prep summary input or ledger was unsafe/incomplete."], warnings: ["Prep summary only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditPrepSummary(summary: RuntimeSchedulerPackageScriptEditPrepSummary, reason?: string): RuntimeSchedulerPackageScriptEditPrepSummary {
  return { ...summary, summary_state: "revoked", required_confirmation: "No confirmation available while revoked.", ready_items: [], validation: { complete: false, prep_summary_ready: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Package script edit prep summary was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditPrepSummary(summary: RuntimeSchedulerPackageScriptEditPrepSummary): string {
  return [
    "Video Orchestrator runtime scheduler package script edit prep summary",
    `State: ${summary.summary_state}`,
    `Path: ${summary.package_json_path}`,
    `Commit message: ${summary.commit_message}`,
    `Next boundary: ${summary.next_boundary}`,
    "Ready items:",
    ...(summary.ready_items.length ? summary.ready_items.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${summary.package_json_edited}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
    `Committed now: ${summary.committed_now}`,
    `Pushed now: ${summary.pushed_now}`,
  ].join("\n");
}
