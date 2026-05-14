export type AccountReferencePostPushState = "pushed_verified" | "blocked" | "revoked";
export type AccountReferencePostPushReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type AccountReferencePostPushSafeReportState = "complete" | "requires_operator_confirmation_for_next_scope" | "blocked" | "revoked";

export interface AccountReferencePostPushInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  branch: string;
  remote: string;
  commit_sha: string;
  commit_message: string;
  pushed_range_summary: string;
  allow_closeout_only: true;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
  allow_delete: false;
  allow_unrelated_changes: false;
}

export interface AccountReferencePostPushCloseout {
  schema_version: "1.0";
  closeout_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  closeout_state: AccountReferencePostPushState;
  closeout_only: true;
  branch: string;
  remote: string;
  commit_sha: string;
  commit_message: string;
  pushed_range_summary: string;
  pushed_verified: boolean;
  unrelated_changes_left_untouched: true;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_scope_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface AccountReferencePostPushReview {
  schema_version: "1.0";
  review_id: string;
  closeout_id: string;
  created_at: string;
  review_state: AccountReferencePostPushReviewState;
  review_only: true;
  pushed_verified: boolean;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface AccountReferencePostPushSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  closeout_id: string;
  created_at: string;
  safe_report_state: AccountReferencePostPushSafeReportState;
  safe_report_only: true;
  pushed_verified: boolean;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function inputReady(input: AccountReferencePostPushInput): boolean {
  return input.allow_closeout_only === true && input.allow_git_add === false && input.allow_commit === false && input.allow_push === false && input.allow_delete === false && input.allow_unrelated_changes === false && input.request_id.trim().length > 0 && input.project_id.trim().length > 0 && input.operator_approval_id.trim().length > 0 && input.branch.trim().length > 0 && input.remote.trim().length > 0 && input.commit_sha.trim().length >= 7 && input.commit_message.trim().length > 0 && input.pushed_range_summary.trim().length > 0;
}

export function createAccountReferencePostPushCloseout(input: AccountReferencePostPushInput, options: { id?: string; created_at?: string } = {}): AccountReferencePostPushCloseout {
  const ready = inputReady(input);
  return { schema_version: "1.0", closeout_id: safe(options.id, `account-reference-post-push-${input.request_id}`), request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), closeout_state: ready ? "pushed_verified" : "blocked", closeout_only: true, branch: safe(input.branch, "branch"), remote: safe(input.remote, "remote"), commit_sha: safe(input.commit_sha, "commit"), commit_message: safe(input.commit_message, "commit message"), pushed_range_summary: safe(input.pushed_range_summary, "push range"), pushed_verified: ready, unrelated_changes_left_untouched: true, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_scope_review: ready, blocking_reasons: ready ? [] : ["Account-reference post-push closeout input was incomplete or unsafe."], warnings: ["Closeout only; unrelated unstaged/untracked repo changes remain untouched."] } };
}

function closeoutReady(closeout: AccountReferencePostPushCloseout): boolean {
  return closeout.closeout_state === "pushed_verified" && closeout.validation.complete && closeout.validation.ready_for_next_scope_review && closeout.pushed_verified && !closeout.git_add_executed && !closeout.committed_now && !closeout.pushed_now && !closeout.deleted_now && !closeout.unrelated_changes_modified;
}

export function createAccountReferencePostPushReview(closeout: AccountReferencePostPushCloseout, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): AccountReferencePostPushReview {
  const ready = closeoutReady(closeout);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "account-reference-post-push-review-001"), closeout_id: closeout.closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, pushed_verified: closeout.pushed_verified, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Account-reference post-push closeout was not ready for review."], warnings: ["Review does not approve staging, commits, pushes, deletes, or unrelated changes."] } };
}

export function createAccountReferencePostPushSafeReport(review: AccountReferencePostPushReview, closeout: AccountReferencePostPushCloseout, options: { id?: string; created_at?: string; requestNextScope?: boolean } = {}): AccountReferencePostPushSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && closeoutReady(closeout);
  const requiresConfirmation = ready && options.requestNextScope !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "account-reference-post-push-safe-report-001"), review_id: review.review_id, closeout_id: closeout.closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_next_scope" : ready ? "complete" : "blocked", safe_report_only: true, pushed_verified: closeout.pushed_verified, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit scope confirmation required before next Video Orchestrator implementation scope."] : ["Account-reference post-push review was not ready for safe report."], warnings: ["Stop before new implementation work, staging, commits, pushes, deletes, or unrelated changes unless separately scoped."] } };
}

export function revokeAccountReferencePostPushCloseout(closeout: AccountReferencePostPushCloseout, reason?: string): AccountReferencePostPushCloseout { return { ...closeout, closeout_state: "revoked", pushed_verified: false, validation: { complete: false, ready_for_next_scope_review: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Account-reference post-push closeout was revoked.")] } }; }
export function revokeAccountReferencePostPushReview(review: AccountReferencePostPushReview, reason?: string): AccountReferencePostPushReview { return { ...review, review_state: "revoked", pushed_verified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Account-reference post-push review was revoked.")] } }; }
export function revokeAccountReferencePostPushSafeReport(report: AccountReferencePostPushSafeReport, reason?: string): AccountReferencePostPushSafeReport { return { ...report, safe_report_state: "revoked", pushed_verified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Account-reference post-push safe report was revoked.")] } }; }
