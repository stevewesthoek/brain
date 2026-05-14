import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeMultiAccountPlatformExpansionResult, YouTubeMultiAccountPlatformExpansionSafeReport } from "./video-orchestrator-youtube-multi-account-platform-expansion.js";

export type YouTubeBulkExecutionBoundaryState = "ready_for_operator_review" | "blocked" | "revoked";
export type YouTubeBulkExecutionBoundaryReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeBulkExecutionBoundarySafeReportState = "complete" | "requires_operator_confirmation_for_controlled_bulk_execution" | "blocked" | "revoked";
export type YouTubeBulkExecutionBoundaryControlKind = "batch_size" | "cadence" | "quota" | "idempotency" | "duplicate_prevention" | "account_partition" | "platform_partition" | "delete_guard" | "metadata_guard" | "manual_pause" | "rollback";

export interface YouTubeBulkExecutionBoundaryInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  bulk_boundary_scope_id: string;
  max_items_per_batch: number;
  allow_boundary_planning: true;
  allow_actual_bulk_uploads: false;
  allow_deletes: false;
  allow_unrelated_metadata_changes: false;
  allow_commits: false;
  allow_pushes: false;
}

export interface YouTubeBulkExecutionBoundaryControl {
  control_id: string;
  control_kind: YouTubeBulkExecutionBoundaryControlKind;
  safe_summary: string;
  planned_now: true;
  implemented_now: boolean;
  actual_bulk_upload_enabled_now: false;
  actual_bulk_upload_executed_now: false;
  delete_enabled_now: false;
  delete_executed_now: false;
  unrelated_metadata_change_enabled_now: false;
  unrelated_metadata_changed_now: false;
  commit_enabled_now: false;
  push_enabled_now: false;
}

export interface YouTubeBulkExecutionBoundaryAdapters {
  planBoundaryControls(input: YouTubeBulkExecutionBoundaryInput): Promise<YouTubeBulkExecutionBoundaryControl[]> | YouTubeBulkExecutionBoundaryControl[];
  checkBoundaryReadiness(input: YouTubeBulkExecutionBoundaryInput, controls: YouTubeBulkExecutionBoundaryControl[]): Promise<{ ready: boolean; safe_summary: string; blocking_reasons: string[] }> | { ready: boolean; safe_summary: string; blocking_reasons: string[] };
  storeSafeSummary?(result: YouTubeBulkExecutionBoundaryResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeBulkExecutionBoundaryResult {
  schema_version: "1.0";
  bulk_execution_boundary_result_id: string;
  multi_account_platform_safe_report_id: string;
  multi_account_platform_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  boundary_state: YouTubeBulkExecutionBoundaryState;
  boundary_planned: boolean;
  boundary_implemented: boolean;
  max_items_per_batch: number;
  controls: YouTubeBulkExecutionBoundaryControl[];
  actual_bulk_uploads_enabled: false;
  actual_bulk_uploads_executed: false;
  deletes_enabled: false;
  deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_controlled_bulk_execution_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeBulkExecutionBoundary" | "revokeYouTubeBulkExecutionBoundaryResult"; source_safe_report_id: string };
}

export interface YouTubeBulkExecutionBoundaryReview {
  schema_version: "1.0";
  bulk_execution_boundary_review_id: string;
  bulk_execution_boundary_result_id: string;
  created_at: string;
  review_state: YouTubeBulkExecutionBoundaryReviewState;
  review_only: true;
  boundary_planned: boolean;
  boundary_implemented: boolean;
  actual_bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeBulkExecutionBoundaryReview" | "revokeYouTubeBulkExecutionBoundaryReview"; source_result_id: string };
}

export interface YouTubeBulkExecutionBoundarySafeReport {
  schema_version: "1.0";
  bulk_execution_boundary_safe_report_id: string;
  bulk_execution_boundary_review_id: string;
  bulk_execution_boundary_result_id: string;
  created_at: string;
  safe_report_state: YouTubeBulkExecutionBoundarySafeReportState;
  safe_report_only: true;
  boundary_planned: boolean;
  boundary_implemented: boolean;
  actual_bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeBulkExecutionBoundarySafeReport" | "revokeYouTubeBulkExecutionBoundarySafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeBatch(value: number): number { return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 25) : 1; }

function expansionReady(report: YouTubeMultiAccountPlatformExpansionSafeReport, result: YouTubeMultiAccountPlatformExpansionResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_bulk_execution_boundary"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.multi_account_checked
    && report.multi_platform_checked
    && !report.upload_executed
    && !report.bulk_uploads_executed
    && !report.deletes_executed
    && !report.unrelated_metadata_changed
    && result.validation.complete
    && result.validation.ready_for_bulk_execution_boundary_review
    && !result.validation.ready_for_real_upload
    && result.multi_account_checked
    && result.multi_platform_checked
    && !result.upload_executed
    && !result.bulk_uploads_executed
    && !result.deletes_executed
    && !result.unrelated_metadata_changed;
}

function inputReady(input: YouTubeBulkExecutionBoundaryInput): boolean {
  return input.allow_boundary_planning === true
    && input.allow_actual_bulk_uploads === false
    && input.allow_deletes === false
    && input.allow_unrelated_metadata_changes === false
    && input.allow_commits === false
    && input.allow_pushes === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.bulk_boundary_scope_id.trim().length > 0
    && input.max_items_per_batch > 0;
}

function sanitizeControl(control: YouTubeBulkExecutionBoundaryControl): YouTubeBulkExecutionBoundaryControl {
  return { control_id: safe(control.control_id, "bulk-boundary-control"), control_kind: control.control_kind, safe_summary: safe(control.safe_summary, "Bulk execution boundary control."), planned_now: true, implemented_now: control.implemented_now === true, actual_bulk_upload_enabled_now: false, actual_bulk_upload_executed_now: false, delete_enabled_now: false, delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false, commit_enabled_now: false, push_enabled_now: false };
}

function blocked(report: YouTubeMultiAccountPlatformExpansionSafeReport, result: YouTubeMultiAccountPlatformExpansionResult, input: YouTubeBulkExecutionBoundaryInput, createdAt: string, reasons: string[]): YouTubeBulkExecutionBoundaryResult {
  return { schema_version: "1.0", bulk_execution_boundary_result_id: safe(`youtube-bulk-execution-boundary-${input.request_id}`, "youtube-bulk-execution-boundary-result"), multi_account_platform_safe_report_id: report.multi_account_platform_safe_report_id, multi_account_platform_result_id: result.multi_account_platform_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), boundary_state: "blocked", boundary_planned: false, boundary_implemented: false, max_items_per_batch: safeBatch(input.max_items_per_batch), controls: [], actual_bulk_uploads_enabled: false, actual_bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_controlled_bulk_execution_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Bulk execution boundary blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeBulkExecutionBoundary", source_safe_report_id: report.multi_account_platform_safe_report_id } };
}

export async function runYouTubeBulkExecutionBoundary(report: YouTubeMultiAccountPlatformExpansionSafeReport, result: YouTubeMultiAccountPlatformExpansionResult, input: YouTubeBulkExecutionBoundaryInput, adapters: YouTubeBulkExecutionBoundaryAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeBulkExecutionBoundaryResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!expansionReady(report, result)) return blocked(report, result, input, createdAt, ["Multi-account/platform safe report/result were not ready for bulk execution boundary work."]);
  if (!inputReady(input)) return blocked(report, result, input, createdAt, ["Bulk execution boundary input violates no-bulk/no-delete/no-metadata/no-commit/no-push constraints."]);

  const controls = (await adapters.planBoundaryControls(input)).map(sanitizeControl);
  const unsafeControl = controls.some((control) => control.actual_bulk_upload_enabled_now || control.actual_bulk_upload_executed_now || control.delete_enabled_now || control.delete_executed_now || control.unrelated_metadata_change_enabled_now || control.unrelated_metadata_changed_now || control.commit_enabled_now || control.push_enabled_now);
  const readiness = await adapters.checkBoundaryReadiness(input, controls);
  const blockingReasons = [
    ...(controls.length < 8 ? ["Bulk execution boundary requires at least eight controls."] : []),
    ...(unsafeControl ? ["A boundary control attempted to enable forbidden bulk/delete/metadata/commit/push behavior."] : []),
    ...(readiness.ready === true ? [] : readiness.blocking_reasons.map((reason) => safe(reason, "Bulk boundary readiness blocked."))),
  ];

  const output: YouTubeBulkExecutionBoundaryResult = { schema_version: "1.0", bulk_execution_boundary_result_id: safe(options.id, `youtube-bulk-execution-boundary-${input.request_id}`), multi_account_platform_safe_report_id: report.multi_account_platform_safe_report_id, multi_account_platform_result_id: result.multi_account_platform_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: createdAt, boundary_state: blockingReasons.length === 0 ? "ready_for_operator_review" : "blocked", boundary_planned: true, boundary_implemented: controls.some((control) => control.implemented_now), max_items_per_batch: safeBatch(input.max_items_per_batch), controls, actual_bulk_uploads_enabled: false, actual_bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: blockingReasons.length === 0, ready_for_controlled_bulk_execution_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Bulk execution boundary does not execute bulk uploads, deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "runYouTubeBulkExecutionBoundary", source_safe_report_id: report.multi_account_platform_safe_report_id } };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(output);
    output.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-bulk-execution-boundary-safe-summary"), safe_summary: safe(stored.safe_summary, "Bulk execution boundary safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!output.safe_store_result.stored) {
      output.boundary_state = "blocked";
      output.validation.complete = false;
      output.validation.ready_for_controlled_bulk_execution_review = false;
      output.validation.blocking_reasons = [...output.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return output;
}

function resultReady(result: YouTubeBulkExecutionBoundaryResult): boolean {
  return result.boundary_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_controlled_bulk_execution_review && !result.validation.ready_for_real_upload && result.boundary_planned && !result.actual_bulk_uploads_executed && !result.deletes_executed && !result.unrelated_metadata_changed && !result.commits_enabled && !result.pushes_enabled && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeBulkExecutionBoundaryReview(result: YouTubeBulkExecutionBoundaryResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeBulkExecutionBoundaryReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", bulk_execution_boundary_review_id: safe(options.id, "youtube-bulk-execution-boundary-review-001"), bulk_execution_boundary_result_id: result.bulk_execution_boundary_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, boundary_planned: result.boundary_planned, boundary_implemented: result.boundary_implemented, actual_bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Bulk execution boundary result was not ready for review."], warnings: ["Review does not approve actual bulk upload execution."] }, provenance: { generated_by: "createYouTubeBulkExecutionBoundaryReview", source_result_id: result.bulk_execution_boundary_result_id } };
}

export function createYouTubeBulkExecutionBoundarySafeReport(review: YouTubeBulkExecutionBoundaryReview, result: YouTubeBulkExecutionBoundaryResult, options: { id?: string; created_at?: string; requestControlledBulkExecution?: boolean } = {}): YouTubeBulkExecutionBoundarySafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestControlledBulkExecution !== false;
  return { schema_version: "1.0", bulk_execution_boundary_safe_report_id: safe(options.id, "youtube-bulk-execution-boundary-safe-report-001"), bulk_execution_boundary_review_id: review.bulk_execution_boundary_review_id, bulk_execution_boundary_result_id: result.bulk_execution_boundary_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_controlled_bulk_execution" : ready ? "complete" : "blocked", safe_report_only: true, boundary_planned: result.boundary_planned, boundary_implemented: result.boundary_implemented, actual_bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before controlled bulk execution."] : ["Bulk execution boundary review was not ready for safe report."], warnings: ["Stop before actual bulk uploads, deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "createYouTubeBulkExecutionBoundarySafeReport", source_review_id: review.bulk_execution_boundary_review_id } };
}

export function revokeYouTubeBulkExecutionBoundaryResult(result: YouTubeBulkExecutionBoundaryResult, reason?: string): YouTubeBulkExecutionBoundaryResult { return { ...result, boundary_state: "revoked", actual_bulk_uploads_enabled: false, actual_bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_controlled_bulk_execution_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Bulk execution boundary result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeBulkExecutionBoundaryResult" } }; }
export function revokeYouTubeBulkExecutionBoundaryReview(review: YouTubeBulkExecutionBoundaryReview, reason?: string): YouTubeBulkExecutionBoundaryReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Bulk execution boundary review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeBulkExecutionBoundaryReview" } }; }
export function revokeYouTubeBulkExecutionBoundarySafeReport(report: YouTubeBulkExecutionBoundarySafeReport, reason?: string): YouTubeBulkExecutionBoundarySafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Bulk execution boundary safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeBulkExecutionBoundarySafeReport" } }; }
