import type { RuntimeSchedulerOutcomeLedgerEntry } from "./video-orchestrator-runtime-scheduler-outcome-ledger.js";

export type RuntimeSchedulerLedgerReviewState = "ready_for_manual_review" | "blocked" | "revoked";

export interface RuntimeSchedulerLedgerReviewInput {
  review_id: string;
  operator_id: string;
  allow_review_only: true;
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

export interface RuntimeSchedulerLedgerReview {
  schema_version: "1.0";
  review_id: string;
  review_state: RuntimeSchedulerLedgerReviewState;
  review_only: true;
  source_ledger_state: RuntimeSchedulerOutcomeLedgerEntry["ledger_state"];
  decision: RuntimeSchedulerOutcomeLedgerEntry["decision"];
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
  validation: { complete: boolean; ready_for_manual_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 320) : fallback;
}

function inputReady(input: RuntimeSchedulerLedgerReviewInput): boolean {
  return input.allow_review_only === true
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
    && input.review_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function ledgerReady(entry: RuntimeSchedulerOutcomeLedgerEntry): boolean {
  return entry.schema_version === "1.0"
    && entry.ledger_state === "ledger_entry_ready"
    && entry.ledger_only
    && entry.validation.complete
    && entry.validation.ledger_entry_ready
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

export function createRuntimeSchedulerLedgerReview(input: RuntimeSchedulerLedgerReviewInput, entry: RuntimeSchedulerOutcomeLedgerEntry): RuntimeSchedulerLedgerReview {
  const ready = inputReady(input) && ledgerReady(entry);
  return {
    schema_version: "1.0",
    review_id: safe(input.review_id, "runtime-scheduler-ledger-review"),
    review_state: ready ? "ready_for_manual_review" : "blocked",
    review_only: true,
    source_ledger_state: entry.ledger_state,
    decision: entry.decision,
    final_status: ready ? entry.final_status : "Blocked before ledger review.",
    manual_boundary: ready ? entry.next_manual_boundary : "Resolve blocked ledger entry or unsafe review input before continuing.",
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
    validation: { complete: ready, ready_for_manual_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler ledger review input or ledger entry was unsafe/incomplete."], warnings: ["Review only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerLedgerReview(review: RuntimeSchedulerLedgerReview, reason?: string): RuntimeSchedulerLedgerReview {
  return { ...review, review_state: "revoked", validation: { complete: false, ready_for_manual_review: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler ledger review was revoked.")] } };
}

export function renderRuntimeSchedulerLedgerReview(review: RuntimeSchedulerLedgerReview): string {
  return [
    "Video Orchestrator runtime scheduler ledger review",
    `State: ${review.review_state}`,
    `Decision: ${review.decision}`,
    `Source ledger state: ${review.source_ledger_state}`,
    `package.json edited: ${review.package_json_edited}`,
    `Live scheduler enabled: ${review.live_scheduler_enabled}`,
    `Final status: ${review.final_status}`,
    `Manual boundary: ${review.manual_boundary}`,
  ].join("\n");
}
