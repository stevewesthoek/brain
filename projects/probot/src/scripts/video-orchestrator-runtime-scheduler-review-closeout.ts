import type { RuntimeSchedulerLedgerReview } from "./video-orchestrator-runtime-scheduler-ledger-review.js";

export type RuntimeSchedulerReviewCloseoutState = "closed_for_operator_boundary" | "blocked" | "revoked";

export interface RuntimeSchedulerReviewCloseoutInput {
  closeout_id: string;
  operator_id: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerReviewCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerReviewCloseoutState;
  closeout_only: true;
  source_review_state: RuntimeSchedulerLedgerReview["review_state"];
  decision: RuntimeSchedulerLedgerReview["decision"];
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
  validation: { complete: boolean; closed_for_operator_boundary: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 320) : fallback;
}

function inputReady(input: RuntimeSchedulerReviewCloseoutInput): boolean {
  return input.allow_closeout_only === true
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
    && input.closeout_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function reviewReady(review: RuntimeSchedulerLedgerReview): boolean {
  return review.schema_version === "1.0"
    && review.review_state === "ready_for_manual_review"
    && review.review_only
    && review.validation.complete
    && review.validation.ready_for_manual_review
    && !review.package_json_edited
    && !review.live_scheduler_enabled
    && !review.upload_execution_enabled
    && !review.network_enabled
    && !review.credential_access_enabled
    && !review.media_read_enabled
    && !review.file_write_enabled
    && !review.git_add_executed
    && !review.committed_now
    && !review.pushed_now;
}

export function createRuntimeSchedulerReviewCloseout(input: RuntimeSchedulerReviewCloseoutInput, review: RuntimeSchedulerLedgerReview): RuntimeSchedulerReviewCloseout {
  const ready = inputReady(input) && reviewReady(review);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-review-closeout"),
    closeout_state: ready ? "closed_for_operator_boundary" : "blocked",
    closeout_only: true,
    source_review_state: review.review_state,
    decision: review.decision,
    final_status: ready ? review.final_status : "Blocked before review closeout.",
    operator_boundary: ready ? review.manual_boundary : "Resolve blocked ledger review or unsafe closeout input before continuing.",
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
    validation: { complete: ready, closed_for_operator_boundary: ready, blocking_reasons: ready ? [] : ["Runtime scheduler review closeout input or ledger review was unsafe/incomplete."], warnings: ["Closeout only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerReviewCloseout(closeout: RuntimeSchedulerReviewCloseout, reason?: string): RuntimeSchedulerReviewCloseout {
  return { ...closeout, closeout_state: "revoked", final_status: "Revoked.", validation: { complete: false, closed_for_operator_boundary: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Runtime scheduler review closeout was revoked.")] } };
}

export function renderRuntimeSchedulerReviewCloseout(closeout: RuntimeSchedulerReviewCloseout): string {
  return [
    "Video Orchestrator runtime scheduler review closeout",
    `State: ${closeout.closeout_state}`,
    `Decision: ${closeout.decision}`,
    `Source review state: ${closeout.source_review_state}`,
    `package.json edited: ${closeout.package_json_edited}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
    `Final status: ${closeout.final_status}`,
    `Operator boundary: ${closeout.operator_boundary}`,
  ].join("\n");
}
