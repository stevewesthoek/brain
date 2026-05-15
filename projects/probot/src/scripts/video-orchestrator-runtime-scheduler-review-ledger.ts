import type { RuntimeSchedulerReviewCloseout } from "./video-orchestrator-runtime-scheduler-review-closeout.js";

export type RuntimeSchedulerReviewLedgerState = "review_ledger_entry_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerReviewLedgerInput {
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

export interface RuntimeSchedulerReviewLedgerEntry {
  schema_version: "1.0";
  ledger_id: string;
  ledger_state: RuntimeSchedulerReviewLedgerState;
  ledger_only: true;
  recorded_at: string;
  decision: RuntimeSchedulerReviewCloseout["decision"];
  source_closeout_state: RuntimeSchedulerReviewCloseout["closeout_state"];
  final_status: string;
  operator_boundary: string;
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
  validation: { complete: boolean; review_ledger_entry_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 320) : fallback;
}

function inputReady(input: RuntimeSchedulerReviewLedgerInput): boolean {
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

function closeoutReady(closeout: RuntimeSchedulerReviewCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "closed_for_operator_boundary"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.closed_for_operator_boundary
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

export function createRuntimeSchedulerReviewLedgerEntry(input: RuntimeSchedulerReviewLedgerInput, closeout: RuntimeSchedulerReviewCloseout): RuntimeSchedulerReviewLedgerEntry {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    ledger_id: safe(input.ledger_id, "runtime-scheduler-review-ledger"),
    ledger_state: ready ? "review_ledger_entry_ready" : "blocked",
    ledger_only: true,
    recorded_at: safe(input.recorded_at, "1970-01-01T00:00:00.000Z"),
    decision: closeout.decision,
    source_closeout_state: closeout.closeout_state,
    final_status: ready ? closeout.final_status : "Blocked before review ledger entry.",
    operator_boundary: ready ? closeout.operator_boundary : "Resolve blocked review closeout or unsafe ledger input before continuing.",
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
    validation: { complete: ready, review_ledger_entry_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler review ledger input or closeout was unsafe/incomplete."], warnings: ["Review ledger entry only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerReviewLedgerEntry(entry: RuntimeSchedulerReviewLedgerEntry, reason?: string): RuntimeSchedulerReviewLedgerEntry {
  return { ...entry, ledger_state: "revoked", validation: { complete: false, review_ledger_entry_ready: false, blocking_reasons: entry.validation.blocking_reasons, warnings: [...entry.validation.warnings, safe(reason, "Runtime scheduler review ledger entry was revoked.")] } };
}

export function renderRuntimeSchedulerReviewLedgerEntry(entry: RuntimeSchedulerReviewLedgerEntry): string {
  return [
    "Video Orchestrator runtime scheduler review ledger entry",
    `State: ${entry.ledger_state}`,
    `Recorded at: ${entry.recorded_at}`,
    `Decision: ${entry.decision}`,
    `Source closeout state: ${entry.source_closeout_state}`,
    `package.json edited: ${entry.package_json_edited}`,
    `Live scheduler enabled: ${entry.live_scheduler_enabled}`,
    `Final status: ${entry.final_status}`,
    `Operator boundary: ${entry.operator_boundary}`,
  ].join("\n");
}
