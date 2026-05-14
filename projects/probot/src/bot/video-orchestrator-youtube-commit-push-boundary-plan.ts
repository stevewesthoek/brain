import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeDeleteMetadataImplementationResult, YouTubeDeleteMetadataImplementationSafeReport } from "./video-orchestrator-youtube-delete-metadata-implementation.js";

export type YouTubeCommitPushBoundaryPlanState = "approved_for_operator_review" | "blocked" | "revoked";
export type YouTubeCommitPushBoundaryReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeCommitPushBoundarySafeReportState = "complete" | "requires_operator_confirmation_for_staging_commit_push" | "blocked" | "revoked";
export type YouTubeCommitPushBoundaryControlKind = "git_status" | "changed_file_allowlist" | "staging_plan" | "commit_message" | "no_push_default" | "validation_evidence" | "destructive_cleanup_guard" | "rollback_note" | "operator_confirmation";

export interface YouTubeCommitPushBoundaryInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  boundary_scope_id: string;
  allow_planning_only: true;
  allow_staging: false;
  allow_commits: false;
  allow_pushes: false;
  allow_destructive_cleanup: false;
}

export interface YouTubeCommitPushBoundaryControl {
  control_id: string;
  control_kind: YouTubeCommitPushBoundaryControlKind;
  safe_summary: string;
  planned_now: true;
  implemented_now: false;
  staging_enabled_now: false;
  commit_enabled_now: false;
  push_enabled_now: false;
  destructive_cleanup_enabled_now: false;
  requires_future_confirmation: true;
}

export interface YouTubeCommitPushBoundaryPlan {
  schema_version: "1.0";
  commit_push_boundary_plan_id: string;
  delete_metadata_implementation_safe_report_id: string;
  delete_metadata_implementation_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  plan_state: YouTubeCommitPushBoundaryPlanState;
  planning_only: true;
  controls: YouTubeCommitPushBoundaryControl[];
  staging_enabled: false;
  staged_now: false;
  commits_enabled: false;
  committed_now: false;
  pushes_enabled: false;
  pushed_now: false;
  destructive_cleanup_enabled: false;
  destructive_cleanup_performed: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_safe_report_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeCommitPushBoundaryPlan" | "revokeYouTubeCommitPushBoundaryPlan"; source_safe_report_id: string };
}

export interface YouTubeCommitPushBoundaryReview {
  schema_version: "1.0";
  commit_push_boundary_review_id: string;
  commit_push_boundary_plan_id: string;
  created_at: string;
  review_state: YouTubeCommitPushBoundaryReviewState;
  review_only: true;
  planned_control_ids: string[];
  staged_now: false;
  committed_now: false;
  pushed_now: false;
  destructive_cleanup_performed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeCommitPushBoundaryReview" | "revokeYouTubeCommitPushBoundaryReview"; source_plan_id: string };
}

export interface YouTubeCommitPushBoundarySafeReport {
  schema_version: "1.0";
  commit_push_boundary_safe_report_id: string;
  commit_push_boundary_review_id: string;
  commit_push_boundary_plan_id: string;
  created_at: string;
  safe_report_state: YouTubeCommitPushBoundarySafeReportState;
  safe_report_only: true;
  staged_now: false;
  committed_now: false;
  pushed_now: false;
  destructive_cleanup_performed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeCommitPushBoundarySafeReport" | "revokeYouTubeCommitPushBoundarySafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function upstreamReady(report: YouTubeDeleteMetadataImplementationSafeReport, result: YouTubeDeleteMetadataImplementationResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_commit_push_boundary"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.implementation_checks_executed
    && !report.actual_deletes_executed
    && !report.unrelated_metadata_changed
    && !report.commits_enabled
    && !report.pushes_enabled
    && result.validation.complete
    && result.validation.ready_for_commit_push_boundary_review
    && !result.validation.ready_for_real_upload
    && result.implementation_checks_executed
    && !result.actual_deletes_executed
    && !result.unrelated_metadata_changed
    && !result.commits_enabled
    && !result.pushes_enabled;
}

function inputReady(input: YouTubeCommitPushBoundaryInput): boolean {
  return input.allow_planning_only === true
    && input.allow_staging === false
    && input.allow_commits === false
    && input.allow_pushes === false
    && input.allow_destructive_cleanup === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.boundary_scope_id.trim().length > 0;
}

function controls(): YouTubeCommitPushBoundaryControl[] {
  const rows: Array<[string, YouTubeCommitPushBoundaryControlKind, string]> = [
    ["git-status", "git_status", "Future staging must start from reviewed git status output."],
    ["changed-file-allowlist", "changed_file_allowlist", "Future staging must include only reviewed Video Orchestrator files and docs."],
    ["staging-plan", "staging_plan", "Future staging must stage intended files only after explicit confirmation."],
    ["commit-message", "commit_message", "Future commit must use an operator-approved single-line message and optional body."],
    ["no-push-default", "no_push_default", "Future push remains disabled unless separately approved."],
    ["validation-evidence", "validation_evidence", "Future commit must include current validation evidence such as typecheck status."],
    ["destructive-cleanup-guard", "destructive_cleanup_guard", "Future cleanup must avoid deletes unless separately approved."],
    ["rollback-note", "rollback_note", "Future commit plan must include rollback notes or revert strategy."],
    ["operator-confirmation", "operator_confirmation", "Future staging, commit, and push require explicit operator confirmation."],
  ];
  return rows.map(([id, kind, summary]) => ({ control_id: `youtube-commit-push-boundary-${safe(id, "control")}`, control_kind: kind, safe_summary: safe(summary, "Commit push boundary control."), planned_now: true, implemented_now: false, staging_enabled_now: false, commit_enabled_now: false, push_enabled_now: false, destructive_cleanup_enabled_now: false, requires_future_confirmation: true }));
}

export function createYouTubeCommitPushBoundaryPlan(report: YouTubeDeleteMetadataImplementationSafeReport, result: YouTubeDeleteMetadataImplementationResult, input: YouTubeCommitPushBoundaryInput, options: { id?: string; created_at?: string } = {}): YouTubeCommitPushBoundaryPlan {
  const ready = upstreamReady(report, result) && inputReady(input);
  return { schema_version: "1.0", commit_push_boundary_plan_id: safe(options.id, `youtube-commit-push-boundary-${input.request_id}`), delete_metadata_implementation_safe_report_id: report.delete_metadata_implementation_safe_report_id, delete_metadata_implementation_result_id: result.delete_metadata_implementation_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), plan_state: ready ? "approved_for_operator_review" : "blocked", planning_only: true, controls: controls(), staging_enabled: false, staged_now: false, commits_enabled: false, committed_now: false, pushes_enabled: false, pushed_now: false, destructive_cleanup_enabled: false, destructive_cleanup_performed: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_safe_report_review: ready, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Delete/metadata implementation safe report/result or planning input was not ready for commit/push boundary planning."], warnings: ["Planning only; staging, commits, pushes, and destructive cleanup remain disabled."] }, provenance: { generated_by: "createYouTubeCommitPushBoundaryPlan", source_safe_report_id: report.delete_metadata_implementation_safe_report_id } };
}

function planReady(plan: YouTubeCommitPushBoundaryPlan): boolean {
  return plan.plan_state === "approved_for_operator_review" && plan.validation.complete && plan.validation.ready_for_safe_report_review && plan.planning_only && plan.controls.length >= 9 && plan.controls.every((control) => control.planned_now && !control.implemented_now && !control.staging_enabled_now && !control.commit_enabled_now && !control.push_enabled_now && !control.destructive_cleanup_enabled_now && control.requires_future_confirmation) && !plan.staged_now && !plan.committed_now && !plan.pushed_now && !plan.destructive_cleanup_performed && Object.values(plan.execution_boundary).every((value) => value === false);
}

export function createYouTubeCommitPushBoundaryReview(plan: YouTubeCommitPushBoundaryPlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeCommitPushBoundaryReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", commit_push_boundary_review_id: safe(options.id, "youtube-commit-push-boundary-review-001"), commit_push_boundary_plan_id: plan.commit_push_boundary_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, planned_control_ids: plan.controls.map((control) => control.control_id), staged_now: false, committed_now: false, pushed_now: false, destructive_cleanup_performed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Commit/push boundary plan was not ready for review."], warnings: ["Review does not approve staging, commits, pushes, or cleanup."] }, provenance: { generated_by: "createYouTubeCommitPushBoundaryReview", source_plan_id: plan.commit_push_boundary_plan_id } };
}

export function createYouTubeCommitPushBoundarySafeReport(review: YouTubeCommitPushBoundaryReview, plan: YouTubeCommitPushBoundaryPlan, options: { id?: string; created_at?: string; requestStagingCommitPush?: boolean } = {}): YouTubeCommitPushBoundarySafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestStagingCommitPush !== false;
  return { schema_version: "1.0", commit_push_boundary_safe_report_id: safe(options.id, "youtube-commit-push-boundary-safe-report-001"), commit_push_boundary_review_id: review.commit_push_boundary_review_id, commit_push_boundary_plan_id: plan.commit_push_boundary_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_staging_commit_push" : ready ? "complete" : "blocked", safe_report_only: true, staged_now: false, committed_now: false, pushed_now: false, destructive_cleanup_performed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before staging, committing, or pushing."] : ["Commit/push boundary review was not ready for safe report."], warnings: ["Stop before staging, commits, pushes, or destructive cleanup."] }, provenance: { generated_by: "createYouTubeCommitPushBoundarySafeReport", source_review_id: review.commit_push_boundary_review_id } };
}

export function revokeYouTubeCommitPushBoundaryPlan(plan: YouTubeCommitPushBoundaryPlan, reason?: string): YouTubeCommitPushBoundaryPlan { return { ...plan, plan_state: "revoked", staging_enabled: false, staged_now: false, commits_enabled: false, committed_now: false, pushes_enabled: false, pushed_now: false, destructive_cleanup_enabled: false, destructive_cleanup_performed: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_safe_report_review: false, ready_for_real_upload: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Commit/push boundary plan was revoked.")] }, provenance: { ...plan.provenance, generated_by: "revokeYouTubeCommitPushBoundaryPlan" } }; }
export function revokeYouTubeCommitPushBoundaryReview(review: YouTubeCommitPushBoundaryReview, reason?: string): YouTubeCommitPushBoundaryReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Commit/push boundary review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeCommitPushBoundaryReview" } }; }
export function revokeYouTubeCommitPushBoundarySafeReport(report: YouTubeCommitPushBoundarySafeReport, reason?: string): YouTubeCommitPushBoundarySafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Commit/push boundary safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeCommitPushBoundarySafeReport" } }; }
