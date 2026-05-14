import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeAutomationExpansionResult, YouTubeAutomationExpansionSafeReport } from "./video-orchestrator-youtube-automation-expansion.js";

export type YouTubeMultiAccountPlatformExpansionState = "ready_for_cross_account_platform_review" | "blocked" | "revoked";
export type YouTubeMultiAccountPlatformExpansionReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeMultiAccountPlatformExpansionSafeReportState = "complete" | "requires_operator_confirmation_for_bulk_execution_boundary" | "blocked" | "revoked";
export type YouTubeExpansionPlatform = "youtube" | "tiktok" | "pinterest" | "facebook" | "instagram" | "linkedin" | "x" | "bluesky";

export interface YouTubeMultiAccountPlatformExpansionInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  account_scope_id: string;
  platform_scope_id: string;
  allow_multi_account: true;
  allow_multi_platform: true;
  allow_bulk_uploads: false;
  allow_deletes: false;
  allow_unrelated_metadata_changes: false;
  allow_upload_execution: false;
}

export interface YouTubeExpansionAccountPlatformQueue {
  queue_id: string;
  project_id: string;
  platform_account_id: string;
  platform: YouTubeExpansionPlatform;
  queue_item_count: number;
  safe_summary: string;
  upload_execution_enabled_now: false;
  bulk_upload_enabled_now: false;
  delete_enabled_now: false;
  unrelated_metadata_change_enabled_now: false;
}

export interface YouTubeMultiAccountPlatformExpansionAdapters {
  listAccountPlatformQueues(input: YouTubeMultiAccountPlatformExpansionInput): Promise<YouTubeExpansionAccountPlatformQueue[]> | YouTubeExpansionAccountPlatformQueue[];
  checkExpansionReadiness(input: YouTubeMultiAccountPlatformExpansionInput, queues: YouTubeExpansionAccountPlatformQueue[]): Promise<{ ready: boolean; safe_summary: string; blocking_reasons: string[] }> | { ready: boolean; safe_summary: string; blocking_reasons: string[] };
  storeSafeSummary?(result: YouTubeMultiAccountPlatformExpansionResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeMultiAccountPlatformExpansionResult {
  schema_version: "1.0";
  multi_account_platform_result_id: string;
  automation_expansion_safe_report_id: string;
  automation_expansion_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  expansion_state: YouTubeMultiAccountPlatformExpansionState;
  multi_account_checked: boolean;
  multi_platform_checked: boolean;
  queues: YouTubeExpansionAccountPlatformQueue[];
  upload_execution_enabled: false;
  upload_executed: false;
  bulk_uploads_enabled: false;
  bulk_uploads_executed: false;
  deletes_enabled: false;
  deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_bulk_execution_boundary_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeMultiAccountPlatformExpansion" | "revokeYouTubeMultiAccountPlatformExpansionResult"; source_safe_report_id: string };
}

export interface YouTubeMultiAccountPlatformExpansionReview {
  schema_version: "1.0";
  multi_account_platform_review_id: string;
  multi_account_platform_result_id: string;
  created_at: string;
  review_state: YouTubeMultiAccountPlatformExpansionReviewState;
  review_only: true;
  multi_account_checked: boolean;
  multi_platform_checked: boolean;
  upload_executed: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeMultiAccountPlatformExpansionReview" | "revokeYouTubeMultiAccountPlatformExpansionReview"; source_result_id: string };
}

export interface YouTubeMultiAccountPlatformExpansionSafeReport {
  schema_version: "1.0";
  multi_account_platform_safe_report_id: string;
  multi_account_platform_review_id: string;
  multi_account_platform_result_id: string;
  created_at: string;
  safe_report_state: YouTubeMultiAccountPlatformExpansionSafeReportState;
  safe_report_only: true;
  multi_account_checked: boolean;
  multi_platform_checked: boolean;
  upload_executed: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeMultiAccountPlatformExpansionSafeReport" | "revokeYouTubeMultiAccountPlatformExpansionSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeCount(value: number): number { return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }

function automationReady(report: YouTubeAutomationExpansionSafeReport, result: YouTubeAutomationExpansionResult): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_multi_account_platform_expansion"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.single_account_queue_checked
    && !report.automation_execution_enabled
    && !report.repeat_upload_executed
    && !report.bulk_uploads_executed
    && !report.deletes_executed
    && !report.unrelated_metadata_changed
    && !report.multi_account_enabled
    && !report.multi_platform_enabled
    && result.validation.complete
    && result.validation.ready_for_multi_account_platform_review
    && !result.validation.ready_for_real_upload
    && result.single_account_queue_checked
    && !result.automation_executed
    && !result.repeat_upload_executed
    && !result.bulk_uploads_executed
    && !result.deletes_executed
    && !result.unrelated_metadata_changed
    && !result.multi_account_enabled
    && !result.multi_platform_enabled;
}

function inputReady(input: YouTubeMultiAccountPlatformExpansionInput): boolean {
  return input.allow_multi_account === true
    && input.allow_multi_platform === true
    && input.allow_bulk_uploads === false
    && input.allow_deletes === false
    && input.allow_unrelated_metadata_changes === false
    && input.allow_upload_execution === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.account_scope_id.trim().length > 0
    && input.platform_scope_id.trim().length > 0;
}

function sanitizeQueue(queue: YouTubeExpansionAccountPlatformQueue): YouTubeExpansionAccountPlatformQueue {
  return {
    queue_id: safe(queue.queue_id, "queue"),
    project_id: safe(queue.project_id, "project"),
    platform_account_id: safe(queue.platform_account_id, "platform-account"),
    platform: queue.platform,
    queue_item_count: safeCount(queue.queue_item_count),
    safe_summary: safe(queue.safe_summary, "Account/platform queue."),
    upload_execution_enabled_now: false,
    bulk_upload_enabled_now: false,
    delete_enabled_now: false,
    unrelated_metadata_change_enabled_now: false,
  };
}

function blocked(report: YouTubeAutomationExpansionSafeReport, result: YouTubeAutomationExpansionResult, input: YouTubeMultiAccountPlatformExpansionInput, createdAt: string, reasons: string[]): YouTubeMultiAccountPlatformExpansionResult {
  return { schema_version: "1.0", multi_account_platform_result_id: safe(`youtube-multi-account-platform-${input.request_id}`, "youtube-multi-account-platform-result"), automation_expansion_safe_report_id: report.automation_expansion_safe_report_id, automation_expansion_result_id: result.automation_expansion_result_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), expansion_state: "blocked", multi_account_checked: false, multi_platform_checked: false, queues: [], upload_execution_enabled: false, upload_executed: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_bulk_execution_boundary_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Multi-account/platform expansion blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeMultiAccountPlatformExpansion", source_safe_report_id: report.automation_expansion_safe_report_id } };
}

export async function runYouTubeMultiAccountPlatformExpansion(report: YouTubeAutomationExpansionSafeReport, result: YouTubeAutomationExpansionResult, input: YouTubeMultiAccountPlatformExpansionInput, adapters: YouTubeMultiAccountPlatformExpansionAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeMultiAccountPlatformExpansionResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!automationReady(report, result)) return blocked(report, result, input, createdAt, ["Automation expansion safe report/result were not ready for multi-account/platform expansion."]);
  if (!inputReady(input)) return blocked(report, result, input, createdAt, ["Multi-account/platform input violates no-bulk/no-delete/no-metadata/no-upload constraints."]);

  const queues = (await adapters.listAccountPlatformQueues(input)).map(sanitizeQueue);
  const platforms = new Set(queues.map((queue) => queue.platform));
  const accounts = new Set(queues.map((queue) => queue.platform_account_id));
  const unsafeQueue = queues.some((queue) => queue.upload_execution_enabled_now || queue.bulk_upload_enabled_now || queue.delete_enabled_now || queue.unrelated_metadata_change_enabled_now);
  const readiness = await adapters.checkExpansionReadiness(input, queues);
  const blockingReasons = [
    ...(queues.length === 0 ? ["No account/platform queues returned."] : []),
    ...(accounts.size < 1 ? ["No platform account scope available."] : []),
    ...(platforms.size < 1 ? ["No platform scope available."] : []),
    ...(unsafeQueue ? ["Queue attempted to enable upload, bulk, delete, or metadata behavior."] : []),
    ...(readiness.ready === true ? [] : readiness.blocking_reasons.map((reason) => safe(reason, "Expansion readiness blocked."))),
  ];

  const output: YouTubeMultiAccountPlatformExpansionResult = {
    schema_version: "1.0",
    multi_account_platform_result_id: safe(options.id, `youtube-multi-account-platform-${input.request_id}`),
    automation_expansion_safe_report_id: report.automation_expansion_safe_report_id,
    automation_expansion_result_id: result.automation_expansion_result_id,
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: createdAt,
    expansion_state: blockingReasons.length === 0 ? "ready_for_cross_account_platform_review" : "blocked",
    multi_account_checked: true,
    multi_platform_checked: true,
    queues,
    upload_execution_enabled: false,
    upload_executed: false,
    bulk_uploads_enabled: false,
    bulk_uploads_executed: false,
    deletes_enabled: false,
    deletes_executed: false,
    unrelated_metadata_changes_enabled: false,
    unrelated_metadata_changed: false,
    raw_payload_stored: false,
    raw_response_stored: false,
    safe_store_result: null,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: blockingReasons.length === 0, ready_for_bulk_execution_boundary_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Multi-account/platform expansion does not execute uploads, bulk uploads, deletes, or unrelated metadata changes."] },
    provenance: { generated_by: "runYouTubeMultiAccountPlatformExpansion", source_safe_report_id: report.automation_expansion_safe_report_id },
  };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(output);
    output.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-multi-account-platform-safe-summary"), safe_summary: safe(stored.safe_summary, "Multi-account/platform safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!output.safe_store_result.stored) {
      output.expansion_state = "blocked";
      output.validation.complete = false;
      output.validation.ready_for_bulk_execution_boundary_review = false;
      output.validation.blocking_reasons = [...output.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return output;
}

function resultReady(result: YouTubeMultiAccountPlatformExpansionResult): boolean {
  return result.expansion_state === "ready_for_cross_account_platform_review" && result.validation.complete && result.validation.ready_for_bulk_execution_boundary_review && !result.validation.ready_for_real_upload && result.multi_account_checked && result.multi_platform_checked && !result.upload_executed && !result.bulk_uploads_executed && !result.deletes_executed && !result.unrelated_metadata_changed && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeMultiAccountPlatformExpansionReview(result: YouTubeMultiAccountPlatformExpansionResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeMultiAccountPlatformExpansionReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", multi_account_platform_review_id: safe(options.id, "youtube-multi-account-platform-review-001"), multi_account_platform_result_id: result.multi_account_platform_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, multi_account_checked: result.multi_account_checked, multi_platform_checked: result.multi_platform_checked, upload_executed: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Multi-account/platform expansion result was not ready for review."], warnings: ["Review does not approve bulk execution, deletes, or unrelated metadata changes."] }, provenance: { generated_by: "createYouTubeMultiAccountPlatformExpansionReview", source_result_id: result.multi_account_platform_result_id } };
}

export function createYouTubeMultiAccountPlatformExpansionSafeReport(review: YouTubeMultiAccountPlatformExpansionReview, result: YouTubeMultiAccountPlatformExpansionResult, options: { id?: string; created_at?: string; requestBulkExecutionBoundary?: boolean } = {}): YouTubeMultiAccountPlatformExpansionSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestBulkExecutionBoundary !== false;
  return { schema_version: "1.0", multi_account_platform_safe_report_id: safe(options.id, "youtube-multi-account-platform-safe-report-001"), multi_account_platform_review_id: review.multi_account_platform_review_id, multi_account_platform_result_id: result.multi_account_platform_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_bulk_execution_boundary" : ready ? "complete" : "blocked", safe_report_only: true, multi_account_checked: result.multi_account_checked, multi_platform_checked: result.multi_platform_checked, upload_executed: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before bulk execution boundary work."] : ["Multi-account/platform expansion review was not ready for safe report."], warnings: ["Stop before bulk execution, deletes, unrelated metadata changes, commits, or pushes."] }, provenance: { generated_by: "createYouTubeMultiAccountPlatformExpansionSafeReport", source_review_id: review.multi_account_platform_review_id } };
}

export function revokeYouTubeMultiAccountPlatformExpansionResult(result: YouTubeMultiAccountPlatformExpansionResult, reason?: string): YouTubeMultiAccountPlatformExpansionResult { return { ...result, expansion_state: "revoked", upload_execution_enabled: false, upload_executed: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_bulk_execution_boundary_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Multi-account/platform expansion result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeMultiAccountPlatformExpansionResult" } }; }
export function revokeYouTubeMultiAccountPlatformExpansionReview(review: YouTubeMultiAccountPlatformExpansionReview, reason?: string): YouTubeMultiAccountPlatformExpansionReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Multi-account/platform expansion review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeMultiAccountPlatformExpansionReview" } }; }
export function revokeYouTubeMultiAccountPlatformExpansionSafeReport(report: YouTubeMultiAccountPlatformExpansionSafeReport, reason?: string): YouTubeMultiAccountPlatformExpansionSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Multi-account/platform expansion safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeMultiAccountPlatformExpansionSafeReport" } }; }
