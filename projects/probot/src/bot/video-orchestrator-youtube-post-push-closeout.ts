import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

export type YouTubePostPushCloseoutState = "pushed_verified" | "blocked" | "revoked";
export type YouTubePostPushCloseoutReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubePostPushCloseoutSafeReportState = "complete" | "requires_operator_confirmation_for_next_implementation_cycle" | "blocked" | "revoked";

export interface YouTubePostPushCloseoutInput {
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

export interface YouTubePostPushCloseoutResult {
  schema_version: "1.0";
  post_push_closeout_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  closeout_state: YouTubePostPushCloseoutState;
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
  delete_executed: false;
  unrelated_changes_modified: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_implementation_cycle_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePostPushCloseout" | "revokeYouTubePostPushCloseout" };
}

export interface YouTubePostPushCloseoutReview {
  schema_version: "1.0";
  post_push_closeout_review_id: string;
  post_push_closeout_id: string;
  created_at: string;
  review_state: YouTubePostPushCloseoutReviewState;
  review_only: true;
  pushed_verified: boolean;
  unrelated_changes_left_untouched: true;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  delete_executed: false;
  unrelated_changes_modified: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePostPushCloseoutReview" | "revokeYouTubePostPushCloseoutReview"; source_closeout_id: string };
}

export interface YouTubePostPushCloseoutSafeReport {
  schema_version: "1.0";
  post_push_closeout_safe_report_id: string;
  post_push_closeout_review_id: string;
  post_push_closeout_id: string;
  created_at: string;
  safe_report_state: YouTubePostPushCloseoutSafeReportState;
  safe_report_only: true;
  pushed_verified: boolean;
  unrelated_changes_left_untouched: true;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  delete_executed: false;
  unrelated_changes_modified: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePostPushCloseoutSafeReport" | "revokeYouTubePostPushCloseoutSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function inputReady(input: YouTubePostPushCloseoutInput): boolean {
  return input.allow_closeout_only === true
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.allow_delete === false
    && input.allow_unrelated_changes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.branch.trim().length > 0
    && input.remote.trim().length > 0
    && input.commit_sha.trim().length >= 7
    && input.commit_message.trim().length > 0
    && input.pushed_range_summary.trim().length > 0;
}

export function createYouTubePostPushCloseout(input: YouTubePostPushCloseoutInput, options: { id?: string; created_at?: string } = {}): YouTubePostPushCloseoutResult {
  const ready = inputReady(input);
  return {
    schema_version: "1.0",
    post_push_closeout_id: safe(options.id, `youtube-post-push-closeout-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_state: ready ? "pushed_verified" : "blocked",
    closeout_only: true,
    branch: safe(input.branch, "branch"),
    remote: safe(input.remote, "remote"),
    commit_sha: safe(input.commit_sha, "commit"),
    commit_message: safe(input.commit_message, "commit message"),
    pushed_range_summary: safe(input.pushed_range_summary, "push summary"),
    pushed_verified: ready,
    unrelated_changes_left_untouched: true,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    delete_executed: false,
    unrelated_changes_modified: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_implementation_cycle_review: ready, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Post-push closeout input was not safe or complete."], warnings: ["Closeout only; no additional git add, commit, push, delete, or unrelated change mutation is performed."] },
    provenance: { generated_by: "createYouTubePostPushCloseout" },
  };
}

function closeoutReady(closeout: YouTubePostPushCloseoutResult): boolean {
  return closeout.closeout_state === "pushed_verified" && closeout.validation.complete && closeout.validation.ready_for_next_implementation_cycle_review && closeout.pushed_verified && closeout.unrelated_changes_left_untouched && !closeout.git_add_executed && !closeout.committed_now && !closeout.pushed_now && !closeout.delete_executed && !closeout.unrelated_changes_modified && Object.values(closeout.execution_boundary).every((value) => value === false);
}

export function createYouTubePostPushCloseoutReview(closeout: YouTubePostPushCloseoutResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubePostPushCloseoutReview {
  const ready = closeoutReady(closeout);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", post_push_closeout_review_id: safe(options.id, "youtube-post-push-closeout-review-001"), post_push_closeout_id: closeout.post_push_closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, pushed_verified: closeout.pushed_verified, unrelated_changes_left_untouched: true, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Post-push closeout was not ready for review."], warnings: ["Review does not approve further staging, commits, pushes, deletes, or unrelated change mutation."] }, provenance: { generated_by: "createYouTubePostPushCloseoutReview", source_closeout_id: closeout.post_push_closeout_id } };
}

export function createYouTubePostPushCloseoutSafeReport(review: YouTubePostPushCloseoutReview, closeout: YouTubePostPushCloseoutResult, options: { id?: string; created_at?: string; requestNextImplementationCycle?: boolean } = {}): YouTubePostPushCloseoutSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && closeoutReady(closeout);
  const requiresConfirmation = ready && options.requestNextImplementationCycle !== false;
  return { schema_version: "1.0", post_push_closeout_safe_report_id: safe(options.id, "youtube-post-push-closeout-safe-report-001"), post_push_closeout_review_id: review.post_push_closeout_review_id, post_push_closeout_id: closeout.post_push_closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_next_implementation_cycle" : ready ? "complete" : "blocked", safe_report_only: true, pushed_verified: closeout.pushed_verified, unrelated_changes_left_untouched: true, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before the next implementation cycle." ] : ["Post-push closeout review was not ready for safe report."], warnings: ["Stop before new implementation work, staging, commits, pushes, deletes, or unrelated change mutation unless separately approved."] }, provenance: { generated_by: "createYouTubePostPushCloseoutSafeReport", source_review_id: review.post_push_closeout_review_id } };
}

export function revokeYouTubePostPushCloseout(closeout: YouTubePostPushCloseoutResult, reason?: string): YouTubePostPushCloseoutResult { return { ...closeout, closeout_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_implementation_cycle_review: false, ready_for_real_upload: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Post-push closeout was revoked.")] }, provenance: { generated_by: "revokeYouTubePostPushCloseout" } }; }
export function revokeYouTubePostPushCloseoutReview(review: YouTubePostPushCloseoutReview, reason?: string): YouTubePostPushCloseoutReview { return { ...review, review_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Post-push closeout review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubePostPushCloseoutReview" } }; }
export function revokeYouTubePostPushCloseoutSafeReport(report: YouTubePostPushCloseoutSafeReport, reason?: string): YouTubePostPushCloseoutSafeReport { return { ...report, safe_report_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Post-push closeout safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubePostPushCloseoutSafeReport" } }; }
