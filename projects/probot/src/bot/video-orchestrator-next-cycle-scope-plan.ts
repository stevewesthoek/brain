import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubePostPushCloseoutResult, YouTubePostPushCloseoutSafeReport } from "./video-orchestrator-youtube-post-push-closeout.js";

export type VideoOrchestratorNextCycleScopeState = "ready_for_operator_review" | "blocked" | "revoked";
export type VideoOrchestratorNextCycleScopeReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorNextCycleScopeSafeReportState = "complete" | "requires_operator_confirmation_for_selected_scope_implementation" | "blocked" | "revoked";
export type VideoOrchestratorNextCycleCandidateKind = "dashboard_account_ui" | "platform_adapter_generalization" | "credential_registry" | "platform_policy_research" | "migration_parity" | "scheduler_resume";

export interface VideoOrchestratorNextCycleScopeInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  cycle_scope_id: string;
  preferred_scope: "auto" | VideoOrchestratorNextCycleCandidateKind;
  allow_scope_planning_only: true;
  allow_file_creation: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
  allow_delete: false;
  allow_unrelated_changes: false;
}

export interface VideoOrchestratorNextCycleCandidate {
  candidate_id: string;
  candidate_kind: VideoOrchestratorNextCycleCandidateKind;
  priority: number;
  safe_summary: string;
  rationale: string;
  requires_manual_confirmation_before_implementation: true;
  file_creation_enabled_now: false;
  git_add_enabled_now: false;
  commit_enabled_now: false;
  push_enabled_now: false;
  delete_enabled_now: false;
  unrelated_change_enabled_now: false;
}

export interface VideoOrchestratorNextCycleScopePlan {
  schema_version: "1.0";
  next_cycle_scope_plan_id: string;
  post_push_closeout_safe_report_id: string;
  post_push_closeout_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  scope_state: VideoOrchestratorNextCycleScopeState;
  planning_only: true;
  selected_scope: VideoOrchestratorNextCycleCandidateKind | null;
  candidates: VideoOrchestratorNextCycleCandidate[];
  file_creation_enabled: false;
  files_created_now: false;
  git_add_enabled: false;
  git_add_executed: false;
  commit_enabled: false;
  committed_now: false;
  push_enabled: false;
  pushed_now: false;
  delete_enabled: false;
  delete_executed: false;
  unrelated_changes_enabled: false;
  unrelated_changes_modified: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_selected_scope_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorNextCycleScopePlan" | "revokeVideoOrchestratorNextCycleScopePlan"; source_safe_report_id: string };
}

export interface VideoOrchestratorNextCycleScopeReview {
  schema_version: "1.0";
  next_cycle_scope_review_id: string;
  next_cycle_scope_plan_id: string;
  created_at: string;
  review_state: VideoOrchestratorNextCycleScopeReviewState;
  review_only: true;
  selected_scope: VideoOrchestratorNextCycleCandidateKind | null;
  file_creation_enabled: false;
  files_created_now: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  delete_executed: false;
  unrelated_changes_modified: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorNextCycleScopeReview" | "revokeVideoOrchestratorNextCycleScopeReview"; source_plan_id: string };
}

export interface VideoOrchestratorNextCycleScopeSafeReport {
  schema_version: "1.0";
  next_cycle_scope_safe_report_id: string;
  next_cycle_scope_review_id: string;
  next_cycle_scope_plan_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorNextCycleScopeSafeReportState;
  safe_report_only: true;
  selected_scope: VideoOrchestratorNextCycleCandidateKind | null;
  file_creation_enabled: false;
  files_created_now: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  delete_executed: false;
  unrelated_changes_modified: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorNextCycleScopeSafeReport" | "revokeVideoOrchestratorNextCycleScopeSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function upstreamReady(report: YouTubePostPushCloseoutSafeReport, closeout: YouTubePostPushCloseoutResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_next_implementation_cycle"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.pushed_verified
    && report.unrelated_changes_left_untouched
    && !report.git_add_executed
    && !report.committed_now
    && !report.pushed_now
    && !report.delete_executed
    && !report.unrelated_changes_modified
    && closeout.validation.complete
    && closeout.validation.ready_for_next_implementation_cycle_review
    && !closeout.validation.ready_for_real_upload
    && closeout.pushed_verified
    && closeout.unrelated_changes_left_untouched
    && !closeout.git_add_executed
    && !closeout.committed_now
    && !closeout.pushed_now
    && !closeout.delete_executed
    && !closeout.unrelated_changes_modified;
}

function inputReady(input: VideoOrchestratorNextCycleScopeInput): boolean {
  return input.allow_scope_planning_only === true
    && input.allow_file_creation === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.allow_delete === false
    && input.allow_unrelated_changes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.cycle_scope_id.trim().length > 0;
}

function candidates(): VideoOrchestratorNextCycleCandidate[] {
  const rows: Array<[VideoOrchestratorNextCycleCandidateKind, number, string, string]> = [
    ["dashboard_account_ui", 1, "Plan the ProBot dashboard account/project/platform UI boundary.", "The user identified the account/credential UI as the canonical place to manage projects, accounts, platforms, and OAuth handoff."],
    ["credential_registry", 2, "Plan the credential registry abstraction without reading or writing secrets.", "Multiple projects and accounts require a reusable credential reference model before broader adapters can be safely generalized."],
    ["platform_adapter_generalization", 3, "Plan a platform-neutral adapter contract expansion.", "The Video Orchestrator should be one reusable production house rather than a YouTube-only pipeline."],
    ["scheduler_resume", 4, "Plan resumable scheduling and limit-aware queue boundaries.", "Bulk execution needs quota/cadence resume semantics before more platforms are enabled."],
    ["migration_parity", 5, "Plan Says the Bible migration parity checkpoints.", "The legacy pipeline remains unchanged until Video Orchestrator parity is demonstrably safe."],
    ["platform_policy_research", 6, "Plan platform policy research artifacts.", "Each platform needs frequency and rules boundaries before real broad posting."],
  ];
  return rows.map(([kind, priority, summary, rationale]) => ({ candidate_id: `next-cycle-${kind}`, candidate_kind: kind, priority, safe_summary: safe(summary, "Next cycle candidate."), rationale: safe(rationale, "Candidate rationale."), requires_manual_confirmation_before_implementation: true, file_creation_enabled_now: false, git_add_enabled_now: false, commit_enabled_now: false, push_enabled_now: false, delete_enabled_now: false, unrelated_change_enabled_now: false }));
}

function selectCandidate(input: VideoOrchestratorNextCycleScopeInput, rows: VideoOrchestratorNextCycleCandidate[]): VideoOrchestratorNextCycleCandidateKind | null {
  if (input.preferred_scope !== "auto") return rows.some((row) => row.candidate_kind === input.preferred_scope) ? input.preferred_scope : null;
  return rows.sort((a, b) => a.priority - b.priority)[0]?.candidate_kind ?? null;
}

export function createVideoOrchestratorNextCycleScopePlan(report: YouTubePostPushCloseoutSafeReport, closeout: YouTubePostPushCloseoutResult, input: VideoOrchestratorNextCycleScopeInput, options: { id?: string; created_at?: string } = {}): VideoOrchestratorNextCycleScopePlan {
  const rows = candidates();
  const selected = selectCandidate(input, rows);
  const ready = upstreamReady(report, closeout) && inputReady(input) && selected !== null;
  return { schema_version: "1.0", next_cycle_scope_plan_id: safe(options.id, `video-orchestrator-next-cycle-scope-${input.request_id}`), post_push_closeout_safe_report_id: report.post_push_closeout_safe_report_id, post_push_closeout_id: closeout.post_push_closeout_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), scope_state: ready ? "ready_for_operator_review" : "blocked", planning_only: true, selected_scope: ready ? selected : null, candidates: rows, file_creation_enabled: false, files_created_now: false, git_add_enabled: false, git_add_executed: false, commit_enabled: false, committed_now: false, push_enabled: false, pushed_now: false, delete_enabled: false, delete_executed: false, unrelated_changes_enabled: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_selected_scope_review: ready, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Next implementation cycle scope input or post-push closeout evidence was not ready."], warnings: ["Scope planning only; no implementation files, staging, commits, pushes, deletes, or unrelated changes are enabled."] }, provenance: { generated_by: "createVideoOrchestratorNextCycleScopePlan", source_safe_report_id: report.post_push_closeout_safe_report_id } };
}

function planReady(plan: VideoOrchestratorNextCycleScopePlan): boolean {
  return plan.scope_state === "ready_for_operator_review" && plan.validation.complete && plan.validation.ready_for_selected_scope_review && plan.selected_scope !== null && plan.planning_only && !plan.files_created_now && !plan.git_add_executed && !plan.committed_now && !plan.pushed_now && !plan.delete_executed && !plan.unrelated_changes_modified && Object.values(plan.execution_boundary).every((value) => value === false);
}

export function createVideoOrchestratorNextCycleScopeReview(plan: VideoOrchestratorNextCycleScopePlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorNextCycleScopeReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", next_cycle_scope_review_id: safe(options.id, "video-orchestrator-next-cycle-scope-review-001"), next_cycle_scope_plan_id: plan.next_cycle_scope_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, selected_scope: plan.selected_scope, file_creation_enabled: false, files_created_now: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Next implementation cycle scope plan was not ready for review."], warnings: ["Review does not approve implementation file creation, staging, commits, pushes, deletes, or unrelated changes."] }, provenance: { generated_by: "createVideoOrchestratorNextCycleScopeReview", source_plan_id: plan.next_cycle_scope_plan_id } };
}

export function createVideoOrchestratorNextCycleScopeSafeReport(review: VideoOrchestratorNextCycleScopeReview, plan: VideoOrchestratorNextCycleScopePlan, options: { id?: string; created_at?: string; requestSelectedScopeImplementation?: boolean } = {}): VideoOrchestratorNextCycleScopeSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestSelectedScopeImplementation !== false;
  return { schema_version: "1.0", next_cycle_scope_safe_report_id: safe(options.id, "video-orchestrator-next-cycle-scope-safe-report-001"), next_cycle_scope_review_id: review.next_cycle_scope_review_id, next_cycle_scope_plan_id: plan.next_cycle_scope_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_selected_scope_implementation" : ready ? "complete" : "blocked", safe_report_only: true, selected_scope: plan.selected_scope, file_creation_enabled: false, files_created_now: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before implementing the selected next-cycle scope."] : ["Next implementation cycle scope review was not ready for safe report."], warnings: ["Stop before implementation file creation, staging, commits, pushes, deletes, or unrelated changes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorNextCycleScopeSafeReport", source_review_id: review.next_cycle_scope_review_id } };
}

export function revokeVideoOrchestratorNextCycleScopePlan(plan: VideoOrchestratorNextCycleScopePlan, reason?: string): VideoOrchestratorNextCycleScopePlan { return { ...plan, scope_state: "revoked", file_creation_enabled: false, files_created_now: false, git_add_enabled: false, git_add_executed: false, commit_enabled: false, committed_now: false, push_enabled: false, pushed_now: false, delete_enabled: false, delete_executed: false, unrelated_changes_enabled: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_selected_scope_review: false, ready_for_real_upload: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Next implementation cycle scope plan was revoked.")] }, provenance: { ...plan.provenance, generated_by: "revokeVideoOrchestratorNextCycleScopePlan" } }; }
export function revokeVideoOrchestratorNextCycleScopeReview(review: VideoOrchestratorNextCycleScopeReview, reason?: string): VideoOrchestratorNextCycleScopeReview { return { ...review, review_state: "revoked", file_creation_enabled: false, files_created_now: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Next implementation cycle scope review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorNextCycleScopeReview" } }; }
export function revokeVideoOrchestratorNextCycleScopeSafeReport(report: VideoOrchestratorNextCycleScopeSafeReport, reason?: string): VideoOrchestratorNextCycleScopeSafeReport { return { ...report, safe_report_state: "revoked", file_creation_enabled: false, files_created_now: false, git_add_executed: false, committed_now: false, pushed_now: false, delete_executed: false, unrelated_changes_modified: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Next implementation cycle scope safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorNextCycleScopeSafeReport" } }; }
