import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeRepeatabilityImplementationResult, YouTubeRepeatabilityImplementationSafeReport } from "./video-orchestrator-youtube-repeatability-implementation.js";

export type YouTubeAutomationExpansionState = "ready_for_single_account_queue_review" | "blocked" | "revoked";
export type YouTubeAutomationExpansionReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeAutomationExpansionSafeReportState = "complete" | "requires_operator_confirmation_for_multi_account_platform_expansion" | "blocked" | "revoked";

export interface YouTubeAutomationExpansionInput {
  request_id: string;
  project_id: string;
  platform_account_id: string;
  queue_id: string;
  schedule_window_id: string;
  idempotency_scope: string;
  operator_approval_id: string;
  allow_single_account_queue: true;
  allow_automation_expansion: true;
  allow_repeat_upload_execution: false;
  bulk_uploads_enabled: false;
  deletes_enabled: false;
  unrelated_metadata_changes_enabled: false;
  multi_account_enabled: false;
  multi_platform_enabled: false;
}

export interface YouTubeAutomationQueueItem {
  queue_item_id: string;
  render_plan_id: string;
  idempotency_key: string;
  scheduled_window_id: string;
  safe_summary: string;
  upload_execution_enabled_now: false;
  upload_executed_now: false;
  bulk_upload_enabled_now: false;
  delete_enabled_now: false;
  unrelated_metadata_change_enabled_now: false;
}

export interface YouTubeAutomationExpansionAdapters {
  listSingleAccountQueue(input: YouTubeAutomationExpansionInput): Promise<YouTubeAutomationQueueItem[]> | YouTubeAutomationQueueItem[];
  checkQueueReadiness(input: YouTubeAutomationExpansionInput, items: YouTubeAutomationQueueItem[]): Promise<{ ready: boolean; safe_summary: string; blocking_reasons: string[] }> | { ready: boolean; safe_summary: string; blocking_reasons: string[] };
  storeSafeSummary?(result: YouTubeAutomationExpansionResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeAutomationExpansionResult {
  schema_version: "1.0";
  automation_expansion_result_id: string;
  repeatability_safe_report_id: string;
  repeatability_result_id: string;
  request_id: string;
  project_id: string;
  platform_account_id: string;
  queue_id: string;
  created_at: string;
  automation_state: YouTubeAutomationExpansionState;
  single_account_queue_checked: boolean;
  automation_expansion_checked: boolean;
  queue_items: YouTubeAutomationQueueItem[];
  repeat_upload_execution_enabled: false;
  repeat_upload_executed: false;
  automation_execution_enabled: false;
  automation_executed: false;
  bulk_uploads_enabled: false;
  bulk_uploads_executed: false;
  deletes_enabled: false;
  deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  multi_account_enabled: false;
  multi_platform_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_multi_account_platform_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeAutomationExpansion" | "revokeYouTubeAutomationExpansionResult"; source_safe_report_id: string };
}

export interface YouTubeAutomationExpansionReview {
  schema_version: "1.0";
  automation_expansion_review_id: string;
  automation_expansion_result_id: string;
  created_at: string;
  review_state: YouTubeAutomationExpansionReviewState;
  review_only: true;
  single_account_queue_checked: boolean;
  automation_execution_enabled: false;
  repeat_upload_executed: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  multi_account_enabled: false;
  multi_platform_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeAutomationExpansionReview" | "revokeYouTubeAutomationExpansionReview"; source_result_id: string };
}

export interface YouTubeAutomationExpansionSafeReport {
  schema_version: "1.0";
  automation_expansion_safe_report_id: string;
  automation_expansion_review_id: string;
  automation_expansion_result_id: string;
  created_at: string;
  safe_report_state: YouTubeAutomationExpansionSafeReportState;
  safe_report_only: true;
  single_account_queue_checked: boolean;
  automation_execution_enabled: false;
  repeat_upload_executed: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  multi_account_enabled: false;
  multi_platform_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeAutomationExpansionSafeReport" | "revokeYouTubeAutomationExpansionSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function repeatabilityReady(report: YouTubeRepeatabilityImplementationSafeReport, result: YouTubeRepeatabilityImplementationResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_automation_expansion"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.repeatability_check_executed
    && !report.repeat_upload_executed
    && !report.automation_enabled
    && !report.bulk_uploads_executed
    && !report.deletes_executed
    && !report.unrelated_metadata_changed
    && result.validation.complete
    && result.validation.ready_for_automation_expansion_review
    && !result.validation.ready_for_real_upload
    && result.repeatability_check_executed
    && !result.repeat_upload_executed
    && !result.automation_enabled
    && !result.bulk_uploads_executed
    && !result.deletes_executed
    && !result.unrelated_metadata_changed;
}

function inputReady(input: YouTubeAutomationExpansionInput): boolean {
  return input.allow_single_account_queue === true
    && input.allow_automation_expansion === true
    && input.allow_repeat_upload_execution === false
    && input.bulk_uploads_enabled === false
    && input.deletes_enabled === false
    && input.unrelated_metadata_changes_enabled === false
    && input.multi_account_enabled === false
    && input.multi_platform_enabled === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.platform_account_id.trim().length > 0
    && input.queue_id.trim().length > 0
    && input.schedule_window_id.trim().length > 0
    && input.idempotency_scope.trim().length > 0
    && input.operator_approval_id.trim().length > 0;
}

function sanitizeItem(item: YouTubeAutomationQueueItem): YouTubeAutomationQueueItem {
  return { queue_item_id: safe(item.queue_item_id, "queue-item"), render_plan_id: safe(item.render_plan_id, "render-plan"), idempotency_key: safe(item.idempotency_key, "idempotency-key"), scheduled_window_id: safe(item.scheduled_window_id, "schedule-window"), safe_summary: safe(item.safe_summary, "Automation queue item."), upload_execution_enabled_now: false, upload_executed_now: false, bulk_upload_enabled_now: false, delete_enabled_now: false, unrelated_metadata_change_enabled_now: false };
}

function blocked(report: YouTubeRepeatabilityImplementationSafeReport, result: YouTubeRepeatabilityImplementationResult, input: YouTubeAutomationExpansionInput, createdAt: string, reasons: string[]): YouTubeAutomationExpansionResult {
  return { schema_version: "1.0", automation_expansion_result_id: safe(`youtube-automation-expansion-${input.request_id}`, "youtube-automation-expansion-result"), repeatability_safe_report_id: report.repeatability_implementation_safe_report_id, repeatability_result_id: result.repeatability_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), platform_account_id: safe(input.platform_account_id, "platform-account"), queue_id: safe(input.queue_id, "queue"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), automation_state: "blocked", single_account_queue_checked: false, automation_expansion_checked: false, queue_items: [], repeat_upload_execution_enabled: false, repeat_upload_executed: false, automation_execution_enabled: false, automation_executed: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, multi_account_enabled: false, multi_platform_enabled: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_multi_account_platform_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Automation expansion blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeAutomationExpansion", source_safe_report_id: report.repeatability_implementation_safe_report_id } };
}

export async function runYouTubeAutomationExpansion(report: YouTubeRepeatabilityImplementationSafeReport, result: YouTubeRepeatabilityImplementationResult, input: YouTubeAutomationExpansionInput, adapters: YouTubeAutomationExpansionAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeAutomationExpansionResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!repeatabilityReady(report, result)) return blocked(report, result, input, createdAt, ["Repeatability implementation safe report/result were not ready for automation expansion."]);
  if (!inputReady(input)) return blocked(report, result, input, createdAt, ["Automation expansion input violates no-bulk/no-delete/no-metadata or single-account constraints."]);

  const queueItems = (await adapters.listSingleAccountQueue(input)).map(sanitizeItem);
  const hasUnsafeItem = queueItems.some((item) => item.upload_execution_enabled_now || item.upload_executed_now || item.bulk_upload_enabled_now || item.delete_enabled_now || item.unrelated_metadata_change_enabled_now);
  const readiness = await adapters.checkQueueReadiness(input, queueItems);
  const blockingReasons = [
    ...(queueItems.length === 0 ? ["Single-account queue is empty."] : []),
    ...(hasUnsafeItem ? ["Queue item attempted to enable upload/bulk/delete/metadata behavior."] : []),
    ...(readiness.ready === true ? [] : readiness.blocking_reasons.map((reason) => safe(reason, "Queue readiness blocked."))),
  ];

  const output: YouTubeAutomationExpansionResult = {
    schema_version: "1.0",
    automation_expansion_result_id: safe(options.id, `youtube-automation-expansion-${input.request_id}`),
    repeatability_safe_report_id: report.repeatability_implementation_safe_report_id,
    repeatability_result_id: result.repeatability_result_id,
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    platform_account_id: safe(input.platform_account_id, "platform-account"),
    queue_id: safe(input.queue_id, "queue"),
    created_at: createdAt,
    automation_state: blockingReasons.length === 0 ? "ready_for_single_account_queue_review" : "blocked",
    single_account_queue_checked: true,
    automation_expansion_checked: true,
    queue_items: queueItems,
    repeat_upload_execution_enabled: false,
    repeat_upload_executed: false,
    automation_execution_enabled: false,
    automation_executed: false,
    bulk_uploads_enabled: false,
    bulk_uploads_executed: false,
    deletes_enabled: false,
    deletes_executed: false,
    unrelated_metadata_changes_enabled: false,
    unrelated_metadata_changed: false,
    multi_account_enabled: false,
    multi_platform_enabled: false,
    raw_payload_stored: false,
    raw_response_stored: false,
    safe_store_result: null,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: blockingReasons.length === 0, ready_for_multi_account_platform_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Automation expansion does not execute uploads, bulk scheduling, deletes, or unrelated metadata changes."] },
    provenance: { generated_by: "runYouTubeAutomationExpansion", source_safe_report_id: report.repeatability_implementation_safe_report_id },
  };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(output);
    output.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-automation-expansion-safe-summary"), safe_summary: safe(stored.safe_summary, "Automation expansion safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!output.safe_store_result.stored) {
      output.automation_state = "blocked";
      output.validation.complete = false;
      output.validation.ready_for_multi_account_platform_review = false;
      output.validation.blocking_reasons = [...output.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return output;
}

function resultReady(result: YouTubeAutomationExpansionResult): boolean {
  return result.automation_state === "ready_for_single_account_queue_review" && result.validation.complete && result.validation.ready_for_multi_account_platform_review && !result.validation.ready_for_real_upload && result.single_account_queue_checked && result.automation_expansion_checked && !result.repeat_upload_executed && !result.automation_executed && !result.bulk_uploads_executed && !result.deletes_executed && !result.unrelated_metadata_changed && !result.multi_account_enabled && !result.multi_platform_enabled && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeAutomationExpansionReview(result: YouTubeAutomationExpansionResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeAutomationExpansionReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", automation_expansion_review_id: safe(options.id, "youtube-automation-expansion-review-001"), automation_expansion_result_id: result.automation_expansion_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, single_account_queue_checked: result.single_account_queue_checked, automation_execution_enabled: false, repeat_upload_executed: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, multi_account_enabled: false, multi_platform_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Automation expansion result was not ready for review."], warnings: ["Review does not approve multi-account or multi-platform expansion."] }, provenance: { generated_by: "createYouTubeAutomationExpansionReview", source_result_id: result.automation_expansion_result_id } };
}

export function createYouTubeAutomationExpansionSafeReport(review: YouTubeAutomationExpansionReview, result: YouTubeAutomationExpansionResult, options: { id?: string; created_at?: string; requestMultiAccountPlatformExpansion?: boolean } = {}): YouTubeAutomationExpansionSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestMultiAccountPlatformExpansion !== false;
  return { schema_version: "1.0", automation_expansion_safe_report_id: safe(options.id, "youtube-automation-expansion-safe-report-001"), automation_expansion_review_id: review.automation_expansion_review_id, automation_expansion_result_id: result.automation_expansion_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_multi_account_platform_expansion" : ready ? "complete" : "blocked", safe_report_only: true, single_account_queue_checked: result.single_account_queue_checked, automation_execution_enabled: false, repeat_upload_executed: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, multi_account_enabled: false, multi_platform_enabled: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before multi-account/platform expansion."] : ["Automation expansion review was not ready for safe report."], warnings: ["Stop before multi-account, multi-platform, bulk upload, delete, or unrelated metadata expansion."] }, provenance: { generated_by: "createYouTubeAutomationExpansionSafeReport", source_review_id: review.automation_expansion_review_id } };
}

export function revokeYouTubeAutomationExpansionResult(result: YouTubeAutomationExpansionResult, reason?: string): YouTubeAutomationExpansionResult { return { ...result, automation_state: "revoked", repeat_upload_execution_enabled: false, repeat_upload_executed: false, automation_execution_enabled: false, automation_executed: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, multi_account_enabled: false, multi_platform_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_multi_account_platform_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Automation expansion result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeAutomationExpansionResult" } }; }
export function revokeYouTubeAutomationExpansionReview(review: YouTubeAutomationExpansionReview, reason?: string): YouTubeAutomationExpansionReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Automation expansion review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeAutomationExpansionReview" } }; }
export function revokeYouTubeAutomationExpansionSafeReport(report: YouTubeAutomationExpansionSafeReport, reason?: string): YouTubeAutomationExpansionSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Automation expansion safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeAutomationExpansionSafeReport" } }; }
