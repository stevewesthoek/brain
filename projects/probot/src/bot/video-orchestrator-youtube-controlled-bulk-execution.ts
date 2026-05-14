import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeBulkExecutionBoundaryResult, YouTubeBulkExecutionBoundarySafeReport } from "./video-orchestrator-youtube-bulk-execution-boundary.js";

export type YouTubeControlledBulkExecutionState = "completed" | "partial" | "blocked" | "revoked";
export type YouTubeControlledBulkExecutionReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeControlledBulkExecutionSafeReportState = "complete" | "requires_operator_confirmation_for_delete_metadata_boundary" | "blocked" | "revoked";

export interface YouTubeControlledBulkExecutionInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  bulk_execution_scope_id: string;
  max_items_to_execute: number;
  allow_controlled_bulk_execution: true;
  allow_deletes: false;
  allow_unrelated_metadata_changes: false;
  allow_commits: false;
  allow_pushes: false;
}

export interface YouTubeControlledBulkQueueItem {
  queue_item_id: string;
  project_id: string;
  platform_account_id: string;
  platform: "youtube" | "tiktok" | "pinterest" | "facebook" | "instagram" | "linkedin" | "x" | "bluesky";
  render_plan_id: string;
  idempotency_key: string;
  safe_summary: string;
  delete_enabled_now: false;
  unrelated_metadata_change_enabled_now: false;
}

export interface YouTubeControlledBulkItemResult {
  queue_item_id: string;
  attempted: boolean;
  uploaded: boolean;
  skipped: boolean;
  uploaded_video_id: string | null;
  scheduled_publish_at: string | null;
  privacy_status: "private";
  safe_summary: string;
  delete_performed: false;
  unrelated_metadata_changed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
}

export interface YouTubeControlledBulkExecutionAdapters {
  listApprovedBulkItems(input: YouTubeControlledBulkExecutionInput): Promise<YouTubeControlledBulkQueueItem[]> | YouTubeControlledBulkQueueItem[];
  executeSingleApprovedItem(item: YouTubeControlledBulkQueueItem, input: YouTubeControlledBulkExecutionInput): Promise<YouTubeControlledBulkItemResult> | YouTubeControlledBulkItemResult;
  storeSafeSummary?(result: YouTubeControlledBulkExecutionResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeControlledBulkExecutionResult {
  schema_version: "1.0";
  controlled_bulk_execution_result_id: string;
  bulk_execution_boundary_safe_report_id: string;
  bulk_execution_boundary_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  execution_state: YouTubeControlledBulkExecutionState;
  controlled_bulk_execution_enabled: true;
  controlled_bulk_execution_executed: boolean;
  max_items_to_execute: number;
  attempted_count: number;
  uploaded_count: number;
  skipped_count: number;
  item_results: YouTubeControlledBulkItemResult[];
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
  validation: { complete: boolean; ready_for_delete_metadata_boundary_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeControlledBulkExecution" | "revokeYouTubeControlledBulkExecutionResult"; source_safe_report_id: string };
}

export interface YouTubeControlledBulkExecutionReview {
  schema_version: "1.0";
  controlled_bulk_execution_review_id: string;
  controlled_bulk_execution_result_id: string;
  created_at: string;
  review_state: YouTubeControlledBulkExecutionReviewState;
  review_only: true;
  controlled_bulk_execution_executed: boolean;
  attempted_count: number;
  uploaded_count: number;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeControlledBulkExecutionReview" | "revokeYouTubeControlledBulkExecutionReview"; source_result_id: string };
}

export interface YouTubeControlledBulkExecutionSafeReport {
  schema_version: "1.0";
  controlled_bulk_execution_safe_report_id: string;
  controlled_bulk_execution_review_id: string;
  controlled_bulk_execution_result_id: string;
  created_at: string;
  safe_report_state: YouTubeControlledBulkExecutionSafeReportState;
  safe_report_only: true;
  controlled_bulk_execution_executed: boolean;
  attempted_count: number;
  uploaded_count: number;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  commits_enabled: false;
  pushes_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeControlledBulkExecutionSafeReport" | "revokeYouTubeControlledBulkExecutionSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeLimit(value: number): number { return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 25) : 1; }

function boundaryReady(report: YouTubeBulkExecutionBoundarySafeReport, result: YouTubeBulkExecutionBoundaryResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_controlled_bulk_execution"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.boundary_planned
    && !report.actual_bulk_uploads_executed
    && !report.deletes_executed
    && !report.unrelated_metadata_changed
    && !report.commits_enabled
    && !report.pushes_enabled
    && result.validation.complete
    && result.validation.ready_for_controlled_bulk_execution_review
    && !result.validation.ready_for_real_upload
    && result.boundary_planned
    && !result.actual_bulk_uploads_executed
    && !result.deletes_executed
    && !result.unrelated_metadata_changed
    && !result.commits_enabled
    && !result.pushes_enabled;
}

function inputReady(input: YouTubeControlledBulkExecutionInput): boolean {
  return input.allow_controlled_bulk_execution === true
    && input.allow_deletes === false
    && input.allow_unrelated_metadata_changes === false
    && input.allow_commits === false
    && input.allow_pushes === false
    && input.max_items_to_execute > 0
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.bulk_execution_scope_id.trim().length > 0;
}

function sanitizeItem(item: YouTubeControlledBulkQueueItem): YouTubeControlledBulkQueueItem {
  return { queue_item_id: safe(item.queue_item_id, "queue-item"), project_id: safe(item.project_id, "project"), platform_account_id: safe(item.platform_account_id, "platform-account"), platform: item.platform, render_plan_id: safe(item.render_plan_id, "render-plan"), idempotency_key: safe(item.idempotency_key, "idempotency-key"), safe_summary: safe(item.safe_summary, "Controlled bulk queue item."), delete_enabled_now: false, unrelated_metadata_change_enabled_now: false };
}

function sanitizeItemResult(result: YouTubeControlledBulkItemResult): YouTubeControlledBulkItemResult {
  return { queue_item_id: safe(result.queue_item_id, "queue-item"), attempted: result.attempted === true, uploaded: result.uploaded === true, skipped: result.skipped === true, uploaded_video_id: result.uploaded_video_id ? safe(result.uploaded_video_id, "video") : null, scheduled_publish_at: result.scheduled_publish_at ? safe(result.scheduled_publish_at, "scheduled-publish-at") : null, privacy_status: "private", safe_summary: safe(result.safe_summary, "Controlled bulk item result."), delete_performed: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false };
}

function blocked(report: YouTubeBulkExecutionBoundarySafeReport, result: YouTubeBulkExecutionBoundaryResult, input: YouTubeControlledBulkExecutionInput, createdAt: string, reasons: string[]): YouTubeControlledBulkExecutionResult {
  return { schema_version: "1.0", controlled_bulk_execution_result_id: safe(`youtube-controlled-bulk-${input.request_id}`, "youtube-controlled-bulk-result"), bulk_execution_boundary_safe_report_id: report.bulk_execution_boundary_safe_report_id, bulk_execution_boundary_result_id: result.bulk_execution_boundary_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), execution_state: "blocked", controlled_bulk_execution_enabled: true, controlled_bulk_execution_executed: false, max_items_to_execute: safeLimit(input.max_items_to_execute), attempted_count: 0, uploaded_count: 0, skipped_count: 0, item_results: [], deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_delete_metadata_boundary_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Controlled bulk execution blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeControlledBulkExecution", source_safe_report_id: report.bulk_execution_boundary_safe_report_id } };
}

export async function runYouTubeControlledBulkExecution(report: YouTubeBulkExecutionBoundarySafeReport, boundaryResult: YouTubeBulkExecutionBoundaryResult, input: YouTubeControlledBulkExecutionInput, adapters: YouTubeControlledBulkExecutionAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeControlledBulkExecutionResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!boundaryReady(report, boundaryResult)) return blocked(report, boundaryResult, input, createdAt, ["Bulk execution boundary safe report/result were not ready for controlled bulk execution."]);
  if (!inputReady(input)) return blocked(report, boundaryResult, input, createdAt, ["Controlled bulk execution input violates no-delete/no-metadata/no-commit/no-push constraints."]);

  const limit = safeLimit(input.max_items_to_execute);
  const items = (await adapters.listApprovedBulkItems(input)).map(sanitizeItem).slice(0, limit);
  const unsafeItem = items.some((item) => item.delete_enabled_now || item.unrelated_metadata_change_enabled_now);
  if (items.length === 0) return blocked(report, boundaryResult, input, createdAt, ["No approved controlled bulk items returned."]);
  if (unsafeItem) return blocked(report, boundaryResult, input, createdAt, ["A controlled bulk item attempted to enable delete or unrelated metadata behavior."]);

  const itemResults: YouTubeControlledBulkItemResult[] = [];
  for (const item of items) {
    itemResults.push(sanitizeItemResult(await adapters.executeSingleApprovedItem(item, input)));
  }

  const invalidResult = itemResults.some((item) => item.delete_performed || item.unrelated_metadata_changed || item.raw_payload_stored || item.raw_response_stored);
  const attemptedCount = itemResults.filter((item) => item.attempted).length;
  const uploadedCount = itemResults.filter((item) => item.uploaded).length;
  const skippedCount = itemResults.filter((item) => item.skipped).length;
  const blockingReasons = [
    ...(invalidResult ? ["A controlled bulk item result attempted forbidden delete, metadata, or raw storage behavior."] : []),
    ...(attemptedCount === 0 ? ["No controlled bulk item was attempted."] : []),
  ];

  const output: YouTubeControlledBulkExecutionResult = { schema_version: "1.0", controlled_bulk_execution_result_id: safe(options.id, `youtube-controlled-bulk-${input.request_id}`), bulk_execution_boundary_safe_report_id: report.bulk_execution_boundary_safe_report_id, bulk_execution_boundary_result_id: boundaryResult.bulk_execution_boundary_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: createdAt, execution_state: blockingReasons.length === 0 ? (uploadedCount === itemResults.length ? "completed" : "partial") : "blocked", controlled_bulk_execution_enabled: true, controlled_bulk_execution_executed: blockingReasons.length === 0, max_items_to_execute: limit, attempted_count: attemptedCount, uploaded_count: uploadedCount, skipped_count: skippedCount, item_results: itemResults, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: blockingReasons.length === 0, ready_for_delete_metadata_boundary_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Controlled bulk execution does not approve deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "runYouTubeControlledBulkExecution", source_safe_report_id: report.bulk_execution_boundary_safe_report_id } };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(output);
    output.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-controlled-bulk-safe-summary"), safe_summary: safe(stored.safe_summary, "Controlled bulk execution safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!output.safe_store_result.stored) {
      output.execution_state = "blocked";
      output.validation.complete = false;
      output.validation.ready_for_delete_metadata_boundary_review = false;
      output.validation.blocking_reasons = [...output.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return output;
}

function resultReady(result: YouTubeControlledBulkExecutionResult): boolean {
  return (result.execution_state === "completed" || result.execution_state === "partial") && result.validation.complete && result.validation.ready_for_delete_metadata_boundary_review && !result.validation.ready_for_real_upload && result.controlled_bulk_execution_executed && result.attempted_count > 0 && !result.deletes_executed && !result.unrelated_metadata_changed && !result.commits_enabled && !result.pushes_enabled && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeControlledBulkExecutionReview(result: YouTubeControlledBulkExecutionResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeControlledBulkExecutionReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", controlled_bulk_execution_review_id: safe(options.id, "youtube-controlled-bulk-execution-review-001"), controlled_bulk_execution_result_id: result.controlled_bulk_execution_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, controlled_bulk_execution_executed: result.controlled_bulk_execution_executed, attempted_count: result.attempted_count, uploaded_count: result.uploaded_count, deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Controlled bulk execution result was not ready for review."], warnings: ["Review does not approve deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "createYouTubeControlledBulkExecutionReview", source_result_id: result.controlled_bulk_execution_result_id } };
}

export function createYouTubeControlledBulkExecutionSafeReport(review: YouTubeControlledBulkExecutionReview, result: YouTubeControlledBulkExecutionResult, options: { id?: string; created_at?: string; requestDeleteMetadataBoundary?: boolean } = {}): YouTubeControlledBulkExecutionSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestDeleteMetadataBoundary !== false;
  return { schema_version: "1.0", controlled_bulk_execution_safe_report_id: safe(options.id, "youtube-controlled-bulk-execution-safe-report-001"), controlled_bulk_execution_review_id: review.controlled_bulk_execution_review_id, controlled_bulk_execution_result_id: result.controlled_bulk_execution_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_delete_metadata_boundary" : ready ? "complete" : "blocked", safe_report_only: true, controlled_bulk_execution_executed: result.controlled_bulk_execution_executed, attempted_count: result.attempted_count, uploaded_count: result.uploaded_count, deletes_executed: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before delete/metadata boundary work."] : ["Controlled bulk execution review was not ready for safe report."], warnings: ["Stop before deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "createYouTubeControlledBulkExecutionSafeReport", source_review_id: review.controlled_bulk_execution_review_id } };
}

export function revokeYouTubeControlledBulkExecutionResult(result: YouTubeControlledBulkExecutionResult, reason?: string): YouTubeControlledBulkExecutionResult { return { ...result, execution_state: "revoked", deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, commits_enabled: false, pushes_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_delete_metadata_boundary_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Controlled bulk execution result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeControlledBulkExecutionResult" } }; }
export function revokeYouTubeControlledBulkExecutionReview(review: YouTubeControlledBulkExecutionReview, reason?: string): YouTubeControlledBulkExecutionReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Controlled bulk execution review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeControlledBulkExecutionReview" } }; }
export function revokeYouTubeControlledBulkExecutionSafeReport(report: YouTubeControlledBulkExecutionSafeReport, reason?: string): YouTubeControlledBulkExecutionSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Controlled bulk execution safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeControlledBulkExecutionSafeReport" } }; }
