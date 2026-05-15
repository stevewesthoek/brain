import type { RuntimeSchedulerReviewLedgerEntry } from "./video-orchestrator-runtime-scheduler-review-ledger.js";

export type RuntimeSchedulerFinalReviewSummaryState = "manual_boundary_confirmed" | "blocked" | "revoked";

export interface RuntimeSchedulerFinalReviewSummaryInput {
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

export interface RuntimeSchedulerFinalReviewSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerFinalReviewSummaryState;
  summary_only: true;
  source_ledger_state: RuntimeSchedulerReviewLedgerEntry["ledger_state"];
  decision: RuntimeSchedulerReviewLedgerEntry["decision"];
  final_status: string;
  manual_boundary: string;
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
  next_required_operator_action: string;
  validation: { complete: boolean; manual_boundary_confirmed: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerFinalReviewSummaryInput): boolean {
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

function ledgerReady(entry: RuntimeSchedulerReviewLedgerEntry): boolean {
  return entry.schema_version === "1.0"
    && entry.ledger_state === "review_ledger_entry_ready"
    && entry.ledger_only
    && entry.validation.complete
    && entry.validation.review_ledger_entry_ready
    && !entry.package_json_edited
    && !entry.live_scheduler_enabled
    && !entry.upload_execution_enabled
    && !entry.network_enabled
    && !entry.credential_access_enabled
    && !entry.media_read_enabled
    && !entry.file_write_enabled
    && !entry.git_add_executed
    && !entry.committed_now
    && !entry.pushed_now;
}

export function createRuntimeSchedulerFinalReviewSummary(input: RuntimeSchedulerFinalReviewSummaryInput, entry: RuntimeSchedulerReviewLedgerEntry): RuntimeSchedulerFinalReviewSummary {
  const ready = inputReady(input) && ledgerReady(entry);
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-final-review-summary"),
    summary_state: ready ? "manual_boundary_confirmed" : "blocked",
    summary_only: true,
    source_ledger_state: entry.ledger_state,
    decision: entry.decision,
    final_status: ready ? entry.final_status : "Blocked before final review summary.",
    manual_boundary: ready ? entry.operator_boundary : "Resolve blocked review ledger entry or unsafe summary input before continuing.",
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
    next_required_operator_action: ready ? "Provide a separate explicit approval before package.json edits, persistent scheduler writes, live scheduler activation, uploads, network calls, credential access, or media reads." : "Resolve blocked final review summary inputs before continuing.",
    validation: { complete: ready, manual_boundary_confirmed: ready, blocking_reasons: ready ? [] : ["Runtime scheduler final review summary input or review ledger entry was unsafe/incomplete."], warnings: ["Final review summary only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerFinalReviewSummary(summary: RuntimeSchedulerFinalReviewSummary, reason?: string): RuntimeSchedulerFinalReviewSummary {
  return { ...summary, summary_state: "revoked", final_status: "Revoked.", validation: { complete: false, manual_boundary_confirmed: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Runtime scheduler final review summary was revoked.")] } };
}

export function renderRuntimeSchedulerFinalReviewSummary(summary: RuntimeSchedulerFinalReviewSummary): string {
  return [
    "Video Orchestrator runtime scheduler final review summary",
    `State: ${summary.summary_state}`,
    `Decision: ${summary.decision}`,
    `Source ledger state: ${summary.source_ledger_state}`,
    `package.json edited: ${summary.package_json_edited}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
    `Final status: ${summary.final_status}`,
    `Manual boundary: ${summary.manual_boundary}`,
    `Next required operator action: ${summary.next_required_operator_action}`,
  ].join("\n");
}
