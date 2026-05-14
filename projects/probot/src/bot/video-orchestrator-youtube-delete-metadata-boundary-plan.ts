import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeControlledBulkExecutionResult, YouTubeControlledBulkExecutionSafeReport } from "./video-orchestrator-youtube-controlled-bulk-execution.js";

export type YouTubeDeleteMetadataBoundaryPlanState = "approved_for_operator_review" | "blocked" | "revoked";
export type YouTubeDeleteMetadataBoundaryReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeDeleteMetadataBoundarySafeReportState = "complete" | "requires_operator_confirmation_for_delete_metadata_implementation" | "blocked" | "revoked";
export type YouTubeDeleteMetadataBoundaryControlKind = "delete_intent" | "metadata_intent" | "scope_limit" | "approval_gate" | "dry_run_required" | "audit_log" | "redaction" | "rollback" | "no_commit_push";

export interface YouTubeDeleteMetadataBoundaryInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  boundary_scope_id: string;
  allow_planning_only: true;
  allow_actual_deletes: false;
  allow_unrelated_metadata_changes: false;
  allow_commits: false;
  allow_pushes: false;
}

export interface YouTubeDeleteMetadataBoundaryControl {
  control_id: string;
  control_kind: YouTubeDeleteMetadataBoundaryControlKind;
  safe_summary: string;
  planned_now: true;
  implemented_now: false;
  actual_delete_enabled_now: false;
  actual_delete_executed_now: false;
  unrelated_metadata_change_enabled_now: false;
  unrelated_metadata_changed_now: false;
  commit_enabled_now: false;
  push_enabled_now: false;
  requires_future_confirmation: true;
}

export interface YouTubeDeleteMetadataBoundaryPlan {
  schema_version: "1.0";
  delete_metadata_boundary_plan_id: string;
  controlled_bulk_execution_safe_report_id: string;
  controlled_bulk_execution_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  plan_state: YouTubeDeleteMetadataBoundaryPlanState;
  planning_only: true;
  controls: YouTubeDeleteMetadataBoundaryControl[];
  actual_deletes_enabled: false;
  actual_deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_safe_report_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeDeleteMetadataBoundaryPlan" | "revokeYouTubeDeleteMetadataBoundaryPlan"; source_safe_report_id: string };
}

export interface YouTubeDeleteMetadataBoundaryPlanReview {
  schema_version: "1.0";
  delete_metadata_boundary_review_id: string;
  delete_metadata_boundary_plan_id: string;
  created_at: string;
  review_state: YouTubeDeleteMetadataBoundaryReviewState;
  review_only: true;
  planned_control_ids: string[];
  actual_deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeDeleteMetadataBoundaryPlanReview" | "revokeYouTubeDeleteMetadataBoundaryPlanReview"; source_plan_id: string };
}

export interface YouTubeDeleteMetadataBoundarySafeReport {
  schema_version: "1.0";
  delete_metadata_boundary_safe_report_id: string;
  delete_metadata_boundary_review_id: string;
  delete_metadata_boundary_plan_id: string;
  created_at: string;
  safe_report_state: YouTubeDeleteMetadataBoundarySafeReportState;
  safe_report_only: true;
  actual_deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeDeleteMetadataBoundarySafeReport" | "revokeYouTubeDeleteMetadataBoundarySafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function controlledBulkReady(report: YouTubeControlledBulkExecutionSafeReport, result: YouTubeControlledBulkExecutionResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_delete_metadata_boundary"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.controlled_bulk_execution_executed
    && !report.deletes_executed
    && !report.unrelated_metadata_changed
    && !report.commits_enabled
    && !report.pushes_enabled
    && result.validation.complete
    && result.validation.ready_for_delete_metadata_boundary_review
    && !result.validation.ready_for_real_upload
    && result.controlled_bulk_execution_executed
    && !result.deletes_executed
    && !result.unrelated_metadata_changed
    && !result.commits_enabled
    && !result.pushes_enabled;
}

function inputReady(input: YouTubeDeleteMetadataBoundaryInput): boolean {
  return input.allow_planning_only === true
    && input.allow_actual_deletes === false
    && input.allow_unrelated_metadata_changes === false
    && input.allow_commits === false
    && input.allow_pushes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.boundary_scope_id.trim().length > 0;
}

function controls(): YouTubeDeleteMetadataBoundaryControl[] {
  const rows: Array<[string, YouTubeDeleteMetadataBoundaryControlKind, string]> = [
    ["delete-intent", "delete_intent", "Future delete capability must require explicit item-level intent and is not enabled now."],
    ["metadata-intent", "metadata_intent", "Future metadata mutation must require explicit field-level intent and is not enabled now."],
    ["scope-limit", "scope_limit", "Future delete/metadata work must be scoped to reviewed project/account/platform items only."],
    ["approval-gate", "approval_gate", "Future delete/metadata implementation requires separate explicit operator confirmation."],
    ["dry-run-required", "dry_run_required", "Future delete/metadata behavior must support dry-run review before execution."],
    ["audit-log", "audit_log", "Future delete/metadata behavior must write safe audit summaries without raw payloads."],
    ["redaction", "redaction", "Future delete/metadata output must redact account, token, path, and raw response values."],
    ["rollback", "rollback", "Future delete/metadata implementation must be reversible or safely disableable."],
    ["no-commit-push", "no_commit_push", "Future boundary work must not commit or push unless separately approved."],
  ];
  return rows.map(([id, kind, summary]) => ({ control_id: `youtube-delete-metadata-boundary-${safe(id, "control")}`, control_kind: kind, safe_summary: safe(summary, "Delete metadata boundary control."), planned_now: true, implemented_now: false, actual_delete_enabled_now: false, actual_delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false, commit_enabled_now: false, push_enabled_now: false, requires_future_confirmation: true }));
}

export function createYouTubeDeleteMetadataBoundaryPlan(report: YouTubeControlledBulkExecutionSafeReport, result: YouTubeControlledBulkExecutionResult, input: YouTubeDeleteMetadataBoundaryInput, options: { id?: string; created_at?: string } = {}): YouTubeDeleteMetadataBoundaryPlan {
  const ready = controlledBulkReady(report, result) && inputReady(input);
  return { schema_version: "1.0", delete_metadata_boundary_plan_id: safe(options.id, `youtube-delete-metadata-boundary-${input.request_id}`), controlled_bulk_execution_safe_report_id: report.controlled_bulk_execution_safe_report_id, controlled_bulk_execution_result_id: result.controlled_bulk_execution_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), plan_state: ready ? "approved_for_operator_review" : "blocked", planning_only: true, controls: controls(), actual_deletes_enabled: false, actual_deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_safe_report_review: ready, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Controlled bulk execution safe report/result or planning input was not ready for delete/metadata boundary planning."], warnings: ["Planning only; actual deletes and unrelated metadata changes remain disabled."] }, provenance: { generated_by: "createYouTubeDeleteMetadataBoundaryPlan", source_safe_report_id: report.controlled_bulk_execution_safe_report_id } };
}

function planReady(plan: YouTubeDeleteMetadataBoundaryPlan): boolean {
  return plan.plan_state === "approved_for_operator_review" && plan.validation.complete && plan.validation.ready_for_safe_report_review && plan.controls.length >= 9 && plan.controls.every((control) => control.planned_now && !control.implemented_now && !control.actual_delete_enabled_now && !control.actual_delete_executed_now && !control.unrelated_metadata_change_enabled_now && !control.unrelated_metadata_changed_now && !control.commit_enabled_now && !control.push_enabled_now && control.requires_future_confirmation) && !plan.actual_deletes_executed && !plan.unrelated_metadata_changed && !plan.commits_enabled && !plan.pushes_enabled && !plan.raw_payload_stored && !plan.raw_response_stored && Object.values(plan.execution_boundary).every((value) => value === false);
}

export function createYouTubeDeleteMetadataBoundaryPlanReview(plan: YouTubeDeleteMetadataBoundaryPlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeDeleteMetadataBoundaryPlanReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", delete_metadata_boundary_review_id: safe(options.id, "youtube-delete-metadata-boundary-review-001"), delete_metadata_boundary_plan_id: plan.delete_metadata_boundary_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, planned_control_ids: plan.controls.map((control) => control.control_id), actual_deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Delete/metadata boundary plan was not ready for review."], warnings: ["Review does not approve actual deletes or metadata changes."] }, provenance: { generated_by: "createYouTubeDeleteMetadataBoundaryPlanReview", source_plan_id: plan.delete_metadata_boundary_plan_id } };
}

export function createYouTubeDeleteMetadataBoundarySafeReport(review: YouTubeDeleteMetadataBoundaryPlanReview, plan: YouTubeDeleteMetadataBoundaryPlan, options: { id?: string; created_at?: string; requestImplementation?: boolean } = {}): YouTubeDeleteMetadataBoundarySafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestImplementation !== false;
  return { schema_version: "1.0", delete_metadata_boundary_safe_report_id: safe(options.id, "youtube-delete-metadata-boundary-safe-report-001"), delete_metadata_boundary_review_id: review.delete_metadata_boundary_review_id, delete_metadata_boundary_plan_id: plan.delete_metadata_boundary_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_delete_metadata_implementation" : ready ? "complete" : "blocked", safe_report_only: true, actual_deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before delete/metadata implementation."] : ["Delete/metadata boundary review was not ready for safe report."], warnings: ["Stop before actual deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "createYouTubeDeleteMetadataBoundarySafeReport", source_review_id: review.delete_metadata_boundary_review_id } };
}

export function revokeYouTubeDeleteMetadataBoundaryPlan(plan: YouTubeDeleteMetadataBoundaryPlan, reason?: string): YouTubeDeleteMetadataBoundaryPlan { return { ...plan, plan_state: "revoked", actual_deletes_enabled: false, actual_deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_safe_report_review: false, ready_for_real_upload: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Delete/metadata boundary plan was revoked.")] }, provenance: { ...plan.provenance, generated_by: "revokeYouTubeDeleteMetadataBoundaryPlan" } }; }
export function revokeYouTubeDeleteMetadataBoundaryPlanReview(review: YouTubeDeleteMetadataBoundaryPlanReview, reason?: string): YouTubeDeleteMetadataBoundaryPlanReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Delete/metadata boundary review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeDeleteMetadataBoundaryPlanReview" } }; }
export function revokeYouTubeDeleteMetadataBoundarySafeReport(report: YouTubeDeleteMetadataBoundarySafeReport, reason?: string): YouTubeDeleteMetadataBoundarySafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Delete/metadata boundary safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeDeleteMetadataBoundarySafeReport" } }; }
