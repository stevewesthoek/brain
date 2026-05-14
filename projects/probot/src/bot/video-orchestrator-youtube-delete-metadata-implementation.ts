import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeDeleteMetadataBoundaryPlan, YouTubeDeleteMetadataBoundarySafeReport } from "./video-orchestrator-youtube-delete-metadata-boundary-plan.js";

export type YouTubeDeleteMetadataImplementationState = "ready_for_operator_review" | "blocked" | "revoked";
export type YouTubeDeleteMetadataImplementationReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeDeleteMetadataImplementationSafeReportState = "complete" | "requires_operator_confirmation_for_commit_push_boundary" | "blocked" | "revoked";

export interface YouTubeDeleteMetadataImplementationInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  implementation_scope_id: string;
  allow_implementation_checks: true;
  allow_actual_deletes: false;
  allow_unrelated_metadata_changes: false;
  allow_commits: false;
  allow_pushes: false;
}

export interface YouTubeDeleteMetadataIntentSummary {
  intent_id: string;
  target_kind: "video" | "upload_record" | "queue_item" | "metadata_field";
  target_reference_id: string;
  safe_summary: string;
  actual_delete_enabled_now: false;
  actual_delete_executed_now: false;
  unrelated_metadata_change_enabled_now: false;
  unrelated_metadata_changed_now: false;
}

export interface YouTubeDeleteMetadataImplementationAdapters {
  listPlannedIntents(input: YouTubeDeleteMetadataImplementationInput): Promise<YouTubeDeleteMetadataIntentSummary[]> | YouTubeDeleteMetadataIntentSummary[];
  checkImplementationReadiness(input: YouTubeDeleteMetadataImplementationInput, intents: YouTubeDeleteMetadataIntentSummary[]): Promise<{ ready: boolean; safe_summary: string; blocking_reasons: string[] }> | { ready: boolean; safe_summary: string; blocking_reasons: string[] };
  storeSafeSummary?(result: YouTubeDeleteMetadataImplementationResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeDeleteMetadataImplementationResult {
  schema_version: "1.0";
  delete_metadata_implementation_result_id: string;
  delete_metadata_boundary_safe_report_id: string;
  delete_metadata_boundary_plan_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  implementation_state: YouTubeDeleteMetadataImplementationState;
  implementation_checks_executed: boolean;
  planned_intents: YouTubeDeleteMetadataIntentSummary[];
  actual_deletes_enabled: false;
  actual_deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_commit_push_boundary_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeDeleteMetadataImplementation" | "revokeYouTubeDeleteMetadataImplementationResult"; source_safe_report_id: string };
}

export interface YouTubeDeleteMetadataImplementationReview {
  schema_version: "1.0";
  delete_metadata_implementation_review_id: string;
  delete_metadata_implementation_result_id: string;
  created_at: string;
  review_state: YouTubeDeleteMetadataImplementationReviewState;
  review_only: true;
  implementation_checks_executed: boolean;
  actual_deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeDeleteMetadataImplementationReview" | "revokeYouTubeDeleteMetadataImplementationReview"; source_result_id: string };
}

export interface YouTubeDeleteMetadataImplementationSafeReport {
  schema_version: "1.0";
  delete_metadata_implementation_safe_report_id: string;
  delete_metadata_implementation_review_id: string;
  delete_metadata_implementation_result_id: string;
  created_at: string;
  safe_report_state: YouTubeDeleteMetadataImplementationSafeReportState;
  safe_report_only: true;
  implementation_checks_executed: boolean;
  actual_deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeDeleteMetadataImplementationSafeReport" | "revokeYouTubeDeleteMetadataImplementationSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function boundaryReady(report: YouTubeDeleteMetadataBoundarySafeReport, plan: YouTubeDeleteMetadataBoundaryPlan): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_delete_metadata_implementation"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.actual_deletes_executed
    && !report.unrelated_metadata_changed
    && !report.commits_enabled
    && !report.pushes_enabled
    && plan.validation.complete
    && plan.validation.ready_for_safe_report_review
    && !plan.validation.ready_for_real_upload
    && plan.planning_only
    && !plan.actual_deletes_executed
    && !plan.unrelated_metadata_changed
    && !plan.commits_enabled
    && !plan.pushes_enabled;
}

function inputReady(input: YouTubeDeleteMetadataImplementationInput): boolean {
  return input.allow_implementation_checks === true
    && input.allow_actual_deletes === false
    && input.allow_unrelated_metadata_changes === false
    && input.allow_commits === false
    && input.allow_pushes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.implementation_scope_id.trim().length > 0;
}

function sanitizeIntent(intent: YouTubeDeleteMetadataIntentSummary): YouTubeDeleteMetadataIntentSummary {
  return { intent_id: safe(intent.intent_id, "intent"), target_kind: intent.target_kind, target_reference_id: safe(intent.target_reference_id, "target"), safe_summary: safe(intent.safe_summary, "Delete metadata intent."), actual_delete_enabled_now: false, actual_delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false };
}

function blocked(report: YouTubeDeleteMetadataBoundarySafeReport, plan: YouTubeDeleteMetadataBoundaryPlan, input: YouTubeDeleteMetadataImplementationInput, createdAt: string, reasons: string[]): YouTubeDeleteMetadataImplementationResult {
  return { schema_version: "1.0", delete_metadata_implementation_result_id: safe(`youtube-delete-metadata-implementation-${input.request_id}`, "youtube-delete-metadata-implementation-result"), delete_metadata_boundary_safe_report_id: report.delete_metadata_boundary_safe_report_id, delete_metadata_boundary_plan_id: plan.delete_metadata_boundary_plan_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), implementation_state: "blocked", implementation_checks_executed: false, planned_intents: [], actual_deletes_enabled: false, actual_deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_commit_push_boundary_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Delete metadata implementation blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeDeleteMetadataImplementation", source_safe_report_id: report.delete_metadata_boundary_safe_report_id } };
}

export async function runYouTubeDeleteMetadataImplementation(report: YouTubeDeleteMetadataBoundarySafeReport, plan: YouTubeDeleteMetadataBoundaryPlan, input: YouTubeDeleteMetadataImplementationInput, adapters: YouTubeDeleteMetadataImplementationAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeDeleteMetadataImplementationResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!boundaryReady(report, plan)) return blocked(report, plan, input, createdAt, ["Delete/metadata boundary safe report or plan was not ready for implementation checks."]);
  if (!inputReady(input)) return blocked(report, plan, input, createdAt, ["Delete/metadata implementation input violates no-delete/no-metadata/no-commit/no-push constraints."]);

  const intents = (await adapters.listPlannedIntents(input)).map(sanitizeIntent);
  const unsafeIntent = intents.some((intent) => intent.actual_delete_enabled_now || intent.actual_delete_executed_now || intent.unrelated_metadata_change_enabled_now || intent.unrelated_metadata_changed_now);
  const readiness = await adapters.checkImplementationReadiness(input, intents);
  const blockingReasons = [
    ...(intents.length === 0 ? ["No delete/metadata intents returned for implementation checks."] : []),
    ...(unsafeIntent ? ["An intent attempted to enable actual delete or unrelated metadata behavior."] : []),
    ...(readiness.ready === true ? [] : readiness.blocking_reasons.map((reason) => safe(reason, "Delete metadata readiness blocked."))),
  ];

  const output: YouTubeDeleteMetadataImplementationResult = { schema_version: "1.0", delete_metadata_implementation_result_id: safe(options.id, `youtube-delete-metadata-implementation-${input.request_id}`), delete_metadata_boundary_safe_report_id: report.delete_metadata_boundary_safe_report_id, delete_metadata_boundary_plan_id: plan.delete_metadata_boundary_plan_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: createdAt, implementation_state: blockingReasons.length === 0 ? "ready_for_operator_review" : "blocked", implementation_checks_executed: true, planned_intents: intents, actual_deletes_enabled: false, actual_deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: blockingReasons.length === 0, ready_for_commit_push_boundary_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Delete/metadata implementation does not execute actual deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "runYouTubeDeleteMetadataImplementation", source_safe_report_id: report.delete_metadata_boundary_safe_report_id } };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(output);
    output.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-delete-metadata-implementation-safe-summary"), safe_summary: safe(stored.safe_summary, "Delete metadata implementation safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!output.safe_store_result.stored) {
      output.implementation_state = "blocked";
      output.validation.complete = false;
      output.validation.ready_for_commit_push_boundary_review = false;
      output.validation.blocking_reasons = [...output.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return output;
}

function resultReady(result: YouTubeDeleteMetadataImplementationResult): boolean {
  return result.implementation_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_commit_push_boundary_review && !result.validation.ready_for_real_upload && result.implementation_checks_executed && result.planned_intents.length > 0 && !result.actual_deletes_executed && !result.unrelated_metadata_changed && !result.commits_enabled && !result.pushes_enabled && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeDeleteMetadataImplementationReview(result: YouTubeDeleteMetadataImplementationResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeDeleteMetadataImplementationReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", delete_metadata_implementation_review_id: safe(options.id, "youtube-delete-metadata-implementation-review-001"), delete_metadata_implementation_result_id: result.delete_metadata_implementation_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, implementation_checks_executed: result.implementation_checks_executed, actual_deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Delete/metadata implementation result was not ready for review."], warnings: ["Review does not approve commits or pushes."] }, provenance: { generated_by: "createYouTubeDeleteMetadataImplementationReview", source_result_id: result.delete_metadata_implementation_result_id } };
}

export function createYouTubeDeleteMetadataImplementationSafeReport(review: YouTubeDeleteMetadataImplementationReview, result: YouTubeDeleteMetadataImplementationResult, options: { id?: string; created_at?: string; requestCommitPushBoundary?: boolean } = {}): YouTubeDeleteMetadataImplementationSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestCommitPushBoundary !== false;
  return { schema_version: "1.0", delete_metadata_implementation_safe_report_id: safe(options.id, "youtube-delete-metadata-implementation-safe-report-001"), delete_metadata_implementation_review_id: review.delete_metadata_implementation_review_id, delete_metadata_implementation_result_id: result.delete_metadata_implementation_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_commit_push_boundary" : ready ? "complete" : "blocked", safe_report_only: true, implementation_checks_executed: result.implementation_checks_executed, actual_deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before commit/push boundary work."] : ["Delete/metadata implementation review was not ready for safe report."], warnings: ["Stop before commits or pushes."] }, provenance: { generated_by: "createYouTubeDeleteMetadataImplementationSafeReport", source_review_id: review.delete_metadata_implementation_review_id } };
}

export function revokeYouTubeDeleteMetadataImplementationResult(result: YouTubeDeleteMetadataImplementationResult, reason?: string): YouTubeDeleteMetadataImplementationResult { return { ...result, implementation_state: "revoked", actual_deletes_enabled: false, actual_deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_commit_push_boundary_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Delete/metadata implementation result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeDeleteMetadataImplementationResult" } }; }
export function revokeYouTubeDeleteMetadataImplementationReview(review: YouTubeDeleteMetadataImplementationReview, reason?: string): YouTubeDeleteMetadataImplementationReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Delete/metadata implementation review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeDeleteMetadataImplementationReview" } }; }
export function revokeYouTubeDeleteMetadataImplementationSafeReport(report: YouTubeDeleteMetadataImplementationSafeReport, reason?: string): YouTubeDeleteMetadataImplementationSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Delete/metadata implementation safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeDeleteMetadataImplementationSafeReport" } }; }
