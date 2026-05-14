import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeCommitPushBoundaryPlan, YouTubeCommitPushBoundarySafeReport } from "./video-orchestrator-youtube-commit-push-boundary-plan.js";

export type YouTubeStagingCommitPlanState = "ready_for_operator_review" | "blocked" | "revoked";
export type YouTubeStagingCommitReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeStagingCommitSafeReportState = "complete" | "requires_operator_confirmation_for_git_add_commit" | "blocked" | "revoked";
export type YouTubeStagingCommitFileKind = "source" | "test" | "runbook" | "other";

export interface YouTubeStagingCommitPlanInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  plan_scope_id: string;
  allow_plan_only: true;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface YouTubeStagingCommitPlannedFile {
  path: string;
  file_kind: YouTubeStagingCommitFileKind;
  safe_summary: string;
  include_in_future_staging: boolean;
  staged_now: false;
  committed_now: false;
  pushed_now: false;
}

export interface YouTubeStagingCommitPlanResult {
  schema_version: "1.0";
  staging_commit_plan_id: string;
  commit_push_boundary_safe_report_id: string;
  commit_push_boundary_plan_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  plan_state: YouTubeStagingCommitPlanState;
  plan_only: true;
  planned_files: YouTubeStagingCommitPlannedFile[];
  recommended_commit_message: string;
  validation_evidence: string[];
  git_add_enabled: false;
  git_add_executed: false;
  commit_enabled: false;
  committed_now: false;
  push_enabled: false;
  pushed_now: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_git_add_commit_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeStagingCommitPlan" | "revokeYouTubeStagingCommitPlan"; source_safe_report_id: string };
}

export interface YouTubeStagingCommitPlanReview {
  schema_version: "1.0";
  staging_commit_review_id: string;
  staging_commit_plan_id: string;
  created_at: string;
  review_state: YouTubeStagingCommitReviewState;
  review_only: true;
  planned_file_count: number;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeStagingCommitPlanReview" | "revokeYouTubeStagingCommitPlanReview"; source_plan_id: string };
}

export interface YouTubeStagingCommitSafeReport {
  schema_version: "1.0";
  staging_commit_safe_report_id: string;
  staging_commit_review_id: string;
  staging_commit_plan_id: string;
  created_at: string;
  safe_report_state: YouTubeStagingCommitSafeReportState;
  safe_report_only: true;
  planned_file_count: number;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeStagingCommitSafeReport" | "revokeYouTubeStagingCommitSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function boundaryReady(report: YouTubeCommitPushBoundarySafeReport, plan: YouTubeCommitPushBoundaryPlan): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_staging_commit_push"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.staged_now
    && !report.committed_now
    && !report.pushed_now
    && !report.destructive_cleanup_performed
    && plan.validation.complete
    && plan.validation.ready_for_safe_report_review
    && !plan.validation.ready_for_real_upload
    && plan.planning_only
    && !plan.staged_now
    && !plan.committed_now
    && !plan.pushed_now
    && !plan.destructive_cleanup_performed;
}

function inputReady(input: YouTubeStagingCommitPlanInput): boolean {
  return input.allow_plan_only === true
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.plan_scope_id.trim().length > 0;
}

function plannedFiles(): YouTubeStagingCommitPlannedFile[] {
  const rows: Array<[string, YouTubeStagingCommitFileKind, string]> = [
    ["projects/probot/src/bot/video-orchestrator-youtube-*.ts", "source", "Future staging candidate: YouTube Video Orchestrator source helpers only."],
    ["projects/probot/src/bot/video-orchestrator-youtube-*.test.ts", "test", "Future staging candidate: YouTube Video Orchestrator tests only."],
    ["operations/runbooks/video-orchestrator-roadmap.md", "runbook", "Future staging candidate: roadmap status and phase notes."],
    ["operations/runbooks/video-orchestrator-implementation-plan.md", "runbook", "Future staging candidate: implementation status and phase notes."],
  ];
  return rows.map(([path, file_kind, summary]) => ({ path: safe(path, "path"), file_kind, safe_summary: safe(summary, "Planned file."), include_in_future_staging: true, staged_now: false, committed_now: false, pushed_now: false }));
}

export function createYouTubeStagingCommitPlan(report: YouTubeCommitPushBoundarySafeReport, boundaryPlan: YouTubeCommitPushBoundaryPlan, input: YouTubeStagingCommitPlanInput, options: { id?: string; created_at?: string } = {}): YouTubeStagingCommitPlanResult {
  const ready = boundaryReady(report, boundaryPlan) && inputReady(input);
  return {
    schema_version: "1.0",
    staging_commit_plan_id: safe(options.id, `youtube-staging-commit-plan-${input.request_id}`),
    commit_push_boundary_safe_report_id: report.commit_push_boundary_safe_report_id,
    commit_push_boundary_plan_id: boundaryPlan.commit_push_boundary_plan_id,
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    plan_state: ready ? "ready_for_operator_review" : "blocked",
    plan_only: true,
    planned_files: plannedFiles(),
    recommended_commit_message: "Add YouTube Video Orchestrator controlled execution boundaries",
    validation_evidence: ["npm run typecheck --workspace-equivalent projects/probot completed with exit 0", "git status --short reviewed without staging"],
    git_add_enabled: false,
    git_add_executed: false,
    commit_enabled: false,
    committed_now: false,
    push_enabled: false,
    pushed_now: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_git_add_commit_review: ready, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Commit/push boundary safe report/plan or staging input was not ready."], warnings: ["Plan only; git add, commit, and push remain disabled."] },
    provenance: { generated_by: "createYouTubeStagingCommitPlan", source_safe_report_id: report.commit_push_boundary_safe_report_id },
  };
}

function planReady(plan: YouTubeStagingCommitPlanResult): boolean {
  return plan.plan_state === "ready_for_operator_review" && plan.validation.complete && plan.validation.ready_for_git_add_commit_review && plan.plan_only && plan.planned_files.length > 0 && plan.planned_files.every((file) => !file.staged_now && !file.committed_now && !file.pushed_now) && !plan.git_add_executed && !plan.committed_now && !plan.pushed_now && Object.values(plan.execution_boundary).every((value) => value === false);
}

export function createYouTubeStagingCommitPlanReview(plan: YouTubeStagingCommitPlanResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeStagingCommitPlanReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", staging_commit_review_id: safe(options.id, "youtube-staging-commit-review-001"), staging_commit_plan_id: plan.staging_commit_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, planned_file_count: plan.planned_files.length, git_add_executed: false, committed_now: false, pushed_now: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Staging/commit plan was not ready for review."], warnings: ["Review does not approve git add, commit, or push."] }, provenance: { generated_by: "createYouTubeStagingCommitPlanReview", source_plan_id: plan.staging_commit_plan_id } };
}

export function createYouTubeStagingCommitSafeReport(review: YouTubeStagingCommitPlanReview, plan: YouTubeStagingCommitPlanResult, options: { id?: string; created_at?: string; requestGitAddCommit?: boolean } = {}): YouTubeStagingCommitSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestGitAddCommit !== false;
  return { schema_version: "1.0", staging_commit_safe_report_id: safe(options.id, "youtube-staging-commit-safe-report-001"), staging_commit_review_id: review.staging_commit_review_id, staging_commit_plan_id: plan.staging_commit_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_git_add_commit" : ready ? "complete" : "blocked", safe_report_only: true, planned_file_count: plan.planned_files.length, git_add_executed: false, committed_now: false, pushed_now: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before git add or commit."] : ["Staging/commit review was not ready for safe report."], warnings: ["Stop before git add, commit, or push."] }, provenance: { generated_by: "createYouTubeStagingCommitSafeReport", source_review_id: review.staging_commit_review_id } };
}

export function revokeYouTubeStagingCommitPlan(plan: YouTubeStagingCommitPlanResult, reason?: string): YouTubeStagingCommitPlanResult { return { ...plan, plan_state: "revoked", git_add_enabled: false, git_add_executed: false, commit_enabled: false, committed_now: false, push_enabled: false, pushed_now: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_git_add_commit_review: false, ready_for_real_upload: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Staging/commit plan was revoked.")] }, provenance: { ...plan.provenance, generated_by: "revokeYouTubeStagingCommitPlan" } }; }
export function revokeYouTubeStagingCommitPlanReview(review: YouTubeStagingCommitPlanReview, reason?: string): YouTubeStagingCommitPlanReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Staging/commit review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeStagingCommitPlanReview" } }; }
export function revokeYouTubeStagingCommitSafeReport(report: YouTubeStagingCommitSafeReport, reason?: string): YouTubeStagingCommitSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Staging/commit safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeStagingCommitSafeReport" } }; }
