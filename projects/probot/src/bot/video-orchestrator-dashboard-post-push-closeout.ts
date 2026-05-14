export type VideoOrchestratorDashboardPostPushCloseoutState = "pushed_verified" | "blocked" | "revoked";
export type VideoOrchestratorDashboardPostPushCloseoutReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorDashboardPostPushCloseoutSafeReportState = "complete" | "requires_operator_confirmation_for_next_dashboard_or_credential_scope" | "blocked" | "revoked";

export interface VideoOrchestratorDashboardPostPushCloseoutInput {
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

export interface VideoOrchestratorDashboardPostPushCloseoutResult {
  schema_version: "1.0";
  dashboard_post_push_closeout_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  closeout_state: VideoOrchestratorDashboardPostPushCloseoutState;
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
  provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseout" | "revokeVideoOrchestratorDashboardPostPushCloseout" };
}

export interface VideoOrchestratorDashboardPostPushCloseoutReview {
  schema_version: "1.0";
  dashboard_post_push_closeout_review_id: string;
  dashboard_post_push_closeout_id: string;
  created_at: string;
  review_state: VideoOrchestratorDashboardPostPushCloseoutReviewState;
  review_only: true;
  pushed_verified: boolean;
  unrelated_changes_left_untouched: true;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseoutReview" | "revokeVideoOrchestratorDashboardPostPushCloseoutReview"; source_closeout_id: string };
}

export interface VideoOrchestratorDashboardPostPushCloseoutSafeReport {
  schema_version: "1.0";
  dashboard_post_push_closeout_safe_report_id: string;
  dashboard_post_push_closeout_review_id: string;
  dashboard_post_push_closeout_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorDashboardPostPushCloseoutSafeReportState;
  safe_report_only: true;
  pushed_verified: boolean;
  unrelated_changes_left_untouched: true;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseoutSafeReport" | "revokeVideoOrchestratorDashboardPostPushCloseoutSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function inputReady(input: VideoOrchestratorDashboardPostPushCloseoutInput): boolean {
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

export function createVideoOrchestratorDashboardPostPushCloseout(input: VideoOrchestratorDashboardPostPushCloseoutInput, options: { id?: string; created_at?: string } = {}): VideoOrchestratorDashboardPostPushCloseoutResult {
  const ready = inputReady(input);
  return {
    schema_version: "1.0",
    dashboard_post_push_closeout_id: safe(options.id, `dashboard-post-push-closeout-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_state: ready ? "pushed_verified" : "blocked",
    closeout_only: true,
    branch: safe(input.branch, "branch"),
    remote: safe(input.remote, "remote"),
    commit_sha: safe(input.commit_sha, "commit"),
    commit_message: safe(input.commit_message, "commit message"),
    pushed_range_summary: safe(input.pushed_range_summary, "push range"),
    pushed_verified: ready,
    unrelated_changes_left_untouched: true,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    deleted_now: false,
    unrelated_changes_modified: false,
    validation: { complete: ready, ready_for_next_scope_review: ready, blocking_reasons: ready ? [] : ["Dashboard post-push closeout input was incomplete or unsafe."], warnings: ["Closeout only; unrelated unstaged/untracked repo changes remain untouched."] },
    provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseout" },
  };
}

function closeoutReady(result: VideoOrchestratorDashboardPostPushCloseoutResult): boolean {
  return result.closeout_state === "pushed_verified" && result.validation.complete && result.validation.ready_for_next_scope_review && result.pushed_verified && result.unrelated_changes_left_untouched && !result.git_add_executed && !result.committed_now && !result.pushed_now && !result.deleted_now && !result.unrelated_changes_modified;
}

export function createVideoOrchestratorDashboardPostPushCloseoutReview(result: VideoOrchestratorDashboardPostPushCloseoutResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorDashboardPostPushCloseoutReview {
  const ready = closeoutReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", dashboard_post_push_closeout_review_id: safe(options.id, "dashboard-post-push-closeout-review-001"), dashboard_post_push_closeout_id: result.dashboard_post_push_closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, pushed_verified: result.pushed_verified, unrelated_changes_left_untouched: true, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Dashboard post-push closeout was not ready for review."], warnings: ["Review does not approve staging, commits, pushes, deletes, or unrelated changes."] }, provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseoutReview", source_closeout_id: result.dashboard_post_push_closeout_id } };
}

export function createVideoOrchestratorDashboardPostPushCloseoutSafeReport(review: VideoOrchestratorDashboardPostPushCloseoutReview, result: VideoOrchestratorDashboardPostPushCloseoutResult, options: { id?: string; created_at?: string; requestNextScope?: boolean } = {}): VideoOrchestratorDashboardPostPushCloseoutSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && closeoutReady(result);
  const requiresConfirmation = ready && options.requestNextScope !== false;
  return { schema_version: "1.0", dashboard_post_push_closeout_safe_report_id: safe(options.id, "dashboard-post-push-closeout-safe-report-001"), dashboard_post_push_closeout_review_id: review.dashboard_post_push_closeout_review_id, dashboard_post_push_closeout_id: result.dashboard_post_push_closeout_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_next_dashboard_or_credential_scope" : ready ? "complete" : "blocked", safe_report_only: true, pushed_verified: result.pushed_verified, unrelated_changes_left_untouched: true, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit scope confirmation required before the next dashboard or credential implementation cycle."] : ["Dashboard post-push closeout review was not ready for safe report."], warnings: ["Stop before new implementation work, staging, commits, pushes, deletes, or unrelated changes unless separately scoped."] }, provenance: { generated_by: "createVideoOrchestratorDashboardPostPushCloseoutSafeReport", source_review_id: review.dashboard_post_push_closeout_review_id } };
}

export function revokeVideoOrchestratorDashboardPostPushCloseout(result: VideoOrchestratorDashboardPostPushCloseoutResult, reason?: string): VideoOrchestratorDashboardPostPushCloseoutResult { return { ...result, closeout_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_next_scope_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Dashboard post-push closeout was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorDashboardPostPushCloseout" } }; }
export function revokeVideoOrchestratorDashboardPostPushCloseoutReview(review: VideoOrchestratorDashboardPostPushCloseoutReview, reason?: string): VideoOrchestratorDashboardPostPushCloseoutReview { return { ...review, review_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Dashboard post-push closeout review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorDashboardPostPushCloseoutReview" } }; }
export function revokeVideoOrchestratorDashboardPostPushCloseoutSafeReport(report: VideoOrchestratorDashboardPostPushCloseoutSafeReport, reason?: string): VideoOrchestratorDashboardPostPushCloseoutSafeReport { return { ...report, safe_report_state: "revoked", pushed_verified: false, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Dashboard post-push closeout safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorDashboardPostPushCloseoutSafeReport" } }; }
