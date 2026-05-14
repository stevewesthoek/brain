export type VideoOrchestratorDashboardStagingReadinessState = "ready_for_staging_review" | "blocked" | "revoked";
export type VideoOrchestratorDashboardStagingReadinessReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorDashboardStagingReadinessSafeReportState = "complete" | "requires_operator_confirmation_for_git_add" | "blocked" | "revoked";

export interface VideoOrchestratorDashboardStagingReadinessInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  changed_paths: string[];
  allow_readiness_only: true;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
  allow_delete: false;
  allow_unrelated_changes: false;
}

export interface VideoOrchestratorDashboardStagingReadinessResult {
  schema_version: "1.0";
  staging_readiness_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  readiness_state: VideoOrchestratorDashboardStagingReadinessState;
  intended_paths: string[];
  excluded_paths: string[];
  unknown_dashboard_cycle_paths: string[];
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_git_add_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadiness" | "revokeVideoOrchestratorDashboardStagingReadiness" };
}

export interface VideoOrchestratorDashboardStagingReadinessReview {
  schema_version: "1.0";
  staging_readiness_review_id: string;
  staging_readiness_id: string;
  created_at: string;
  review_state: VideoOrchestratorDashboardStagingReadinessReviewState;
  review_only: true;
  intended_path_count: number;
  excluded_path_count: number;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadinessReview" | "revokeVideoOrchestratorDashboardStagingReadinessReview"; source_readiness_id: string };
}

export interface VideoOrchestratorDashboardStagingReadinessSafeReport {
  schema_version: "1.0";
  staging_readiness_safe_report_id: string;
  staging_readiness_review_id: string;
  staging_readiness_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorDashboardStagingReadinessSafeReportState;
  safe_report_only: true;
  intended_paths: string[];
  excluded_paths: string[];
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  deleted_now: false;
  unrelated_changes_modified: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadinessSafeReport" | "revokeVideoOrchestratorDashboardStagingReadinessSafeReport"; source_review_id: string };
}

const DASHBOARD_CYCLE_ALLOWLIST = new Set([
  "projects/probot/src/bot/dashboard.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui-adapter.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui-adapter.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-runtime-wiring.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-runtime-wiring.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-composition.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-composition.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-render-insertion.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-handler-wiring.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-handler-wiring.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-staging-readiness.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-staging-readiness.test.ts",
  "projects/probot/src/bot/video-orchestrator-next-cycle-scope-plan.ts",
  "projects/probot/src/bot/video-orchestrator-next-cycle-scope-plan.test.ts",
  "projects/probot/src/bot/video-orchestrator-youtube-post-push-closeout.ts",
  "projects/probot/src/bot/video-orchestrator-youtube-post-push-closeout.test.ts",
  "operations/runbooks/video-orchestrator-roadmap.md",
  "operations/runbooks/video-orchestrator-implementation-plan.md",
]);

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function inputReady(input: VideoOrchestratorDashboardStagingReadinessInput): boolean {
  return input.allow_readiness_only === true
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.allow_delete === false
    && input.allow_unrelated_changes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.changed_paths.length > 0;
}

export function createVideoOrchestratorDashboardStagingReadiness(input: VideoOrchestratorDashboardStagingReadinessInput, options: { id?: string; created_at?: string } = {}): VideoOrchestratorDashboardStagingReadinessResult {
  const uniquePaths = Array.from(new Set(input.changed_paths.map((path) => safe(path, "path"))));
  const intendedPaths = uniquePaths.filter((path) => DASHBOARD_CYCLE_ALLOWLIST.has(path)).sort();
  const excludedPaths = uniquePaths.filter((path) => !DASHBOARD_CYCLE_ALLOWLIST.has(path)).sort();
  const unknownDashboardCyclePaths = uniquePaths.filter((path) => path.includes("video-orchestrator-dashboard") && !DASHBOARD_CYCLE_ALLOWLIST.has(path)).sort();
  const ready = inputReady(input) && intendedPaths.length > 0 && unknownDashboardCyclePaths.length === 0;
  return {
    schema_version: "1.0",
    staging_readiness_id: safe(options.id, `dashboard-staging-readiness-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    readiness_state: ready ? "ready_for_staging_review" : "blocked",
    intended_paths: intendedPaths,
    excluded_paths: excludedPaths,
    unknown_dashboard_cycle_paths: unknownDashboardCyclePaths,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    deleted_now: false,
    unrelated_changes_modified: false,
    validation: {
      complete: ready,
      ready_for_git_add_review: ready,
      blocking_reasons: ready ? [] : ["Dashboard staging readiness input had no intended paths or contained unknown dashboard-cycle paths."],
      warnings: excludedPaths.length > 0 ? ["Unrelated modified/untracked paths are excluded from the intended staging set."] : [],
    },
    provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadiness" },
  };
}

function readinessReady(result: VideoOrchestratorDashboardStagingReadinessResult): boolean {
  return result.readiness_state === "ready_for_staging_review" && result.validation.complete && result.validation.ready_for_git_add_review && result.intended_paths.length > 0 && result.unknown_dashboard_cycle_paths.length === 0 && !result.git_add_executed && !result.committed_now && !result.pushed_now && !result.deleted_now && !result.unrelated_changes_modified;
}

export function createVideoOrchestratorDashboardStagingReadinessReview(result: VideoOrchestratorDashboardStagingReadinessResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorDashboardStagingReadinessReview {
  const ready = readinessReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", staging_readiness_review_id: safe(options.id, "dashboard-staging-readiness-review-001"), staging_readiness_id: result.staging_readiness_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, intended_path_count: result.intended_paths.length, excluded_path_count: result.excluded_paths.length, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Dashboard staging readiness result was not ready for review."], warnings: ["Review does not execute git add, commit, push, delete, or unrelated changes."] }, provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadinessReview", source_readiness_id: result.staging_readiness_id } };
}

export function createVideoOrchestratorDashboardStagingReadinessSafeReport(review: VideoOrchestratorDashboardStagingReadinessReview, result: VideoOrchestratorDashboardStagingReadinessResult, options: { id?: string; created_at?: string; requestGitAdd?: boolean } = {}): VideoOrchestratorDashboardStagingReadinessSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && readinessReady(result);
  const requiresConfirmation = ready && options.requestGitAdd !== false;
  return { schema_version: "1.0", staging_readiness_safe_report_id: safe(options.id, "dashboard-staging-readiness-safe-report-001"), staging_readiness_review_id: review.staging_readiness_review_id, staging_readiness_id: result.staging_readiness_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_git_add" : ready ? "complete" : "blocked", safe_report_only: true, intended_paths: result.intended_paths, excluded_paths: result.excluded_paths, git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit operator confirmation required before git add."] : ["Dashboard staging readiness review was not ready for safe report."], warnings: ["Stage only intended_paths; excluded_paths must remain untouched."] }, provenance: { generated_by: "createVideoOrchestratorDashboardStagingReadinessSafeReport", source_review_id: review.staging_readiness_review_id } };
}

export function revokeVideoOrchestratorDashboardStagingReadiness(result: VideoOrchestratorDashboardStagingReadinessResult, reason?: string): VideoOrchestratorDashboardStagingReadinessResult { return { ...result, readiness_state: "revoked", git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_git_add_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Dashboard staging readiness was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorDashboardStagingReadiness" } }; }
export function revokeVideoOrchestratorDashboardStagingReadinessReview(review: VideoOrchestratorDashboardStagingReadinessReview, reason?: string): VideoOrchestratorDashboardStagingReadinessReview { return { ...review, review_state: "revoked", git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Dashboard staging readiness review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorDashboardStagingReadinessReview" } }; }
export function revokeVideoOrchestratorDashboardStagingReadinessSafeReport(report: VideoOrchestratorDashboardStagingReadinessSafeReport, reason?: string): VideoOrchestratorDashboardStagingReadinessSafeReport { return { ...report, safe_report_state: "revoked", git_add_executed: false, committed_now: false, pushed_now: false, deleted_now: false, unrelated_changes_modified: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Dashboard staging readiness safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorDashboardStagingReadinessSafeReport" } }; }
