import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeRepeatabilityAutomationSafeReport } from "./video-orchestrator-youtube-repeatability-automation-plan.js";

export type YouTubeRepeatabilityImplementationState = "ready_for_repeat_attempt_review" | "blocked" | "revoked";
export type YouTubeRepeatabilityReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeRepeatabilitySafeReportState = "complete" | "requires_operator_confirmation_for_automation_expansion" | "blocked" | "revoked";

export interface YouTubeRepeatabilityAttemptInput {
  request_id: string;
  project_id: string;
  platform_account_id: string;
  render_plan_id: string;
  idempotency_key: string;
  prior_first_upload_result_id: string;
  scheduled_window_id: string;
  operator_approval_id: string;
  allow_repeatability_check: true;
  allow_repeat_upload_execution: false;
  bulk_uploads_enabled: false;
  deletes_enabled: false;
  unrelated_metadata_changes_enabled: false;
}

export interface YouTubeRepeatabilityCheckAdapters {
  checkIdempotency(input: YouTubeRepeatabilityAttemptInput): Promise<{ idempotency_key: string; duplicate_found: boolean; safe_summary: string }> | { idempotency_key: string; duplicate_found: boolean; safe_summary: string };
  checkScheduleWindow(input: YouTubeRepeatabilityAttemptInput): Promise<{ scheduled_window_id: string; window_open: boolean; safe_summary: string }> | { scheduled_window_id: string; window_open: boolean; safe_summary: string };
  checkQuotaResume(input: YouTubeRepeatabilityAttemptInput): Promise<{ quota_available: boolean; retry_after: string | null; safe_summary: string }> | { quota_available: boolean; retry_after: string | null; safe_summary: string };
  storeSafeSummary?(result: YouTubeRepeatabilityImplementationResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeRepeatabilityImplementationResult {
  schema_version: "1.0";
  repeatability_result_id: string;
  repeatability_safe_report_id: string;
  request_id: string;
  project_id: string;
  platform_account_id: string;
  render_plan_id: string;
  created_at: string;
  repeatability_state: YouTubeRepeatabilityImplementationState;
  repeatability_check_executed: boolean;
  repeat_upload_execution_enabled: false;
  repeat_upload_executed: false;
  automation_enabled: false;
  bulk_uploads_enabled: false;
  bulk_uploads_executed: false;
  deletes_enabled: false;
  deletes_executed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  idempotency_key: string;
  duplicate_found: boolean;
  schedule_window_open: boolean;
  quota_available: boolean;
  retry_after: string | null;
  raw_payload_stored: false;
  raw_response_stored: false;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_automation_expansion_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeRepeatabilityImplementation" | "revokeYouTubeRepeatabilityImplementationResult"; source_safe_report_id: string };
}

export interface YouTubeRepeatabilityImplementationReview {
  schema_version: "1.0";
  repeatability_review_id: string;
  repeatability_result_id: string;
  created_at: string;
  review_state: YouTubeRepeatabilityReviewState;
  review_only: true;
  repeatability_check_executed: boolean;
  repeat_upload_executed: false;
  automation_enabled: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeRepeatabilityImplementationReview" | "revokeYouTubeRepeatabilityImplementationReview"; source_result_id: string };
}

export interface YouTubeRepeatabilityImplementationSafeReport {
  schema_version: "1.0";
  repeatability_implementation_safe_report_id: string;
  repeatability_review_id: string;
  repeatability_result_id: string;
  created_at: string;
  safe_report_state: YouTubeRepeatabilitySafeReportState;
  safe_report_only: true;
  repeatability_check_executed: boolean;
  repeat_upload_executed: false;
  automation_enabled: false;
  bulk_uploads_executed: false;
  deletes_executed: false;
  unrelated_metadata_changed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeRepeatabilityImplementationSafeReport" | "revokeYouTubeRepeatabilityImplementationSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function reportReady(report: YouTubeRepeatabilityAutomationSafeReport): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_repeatability_implementation"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.repeatability_implementation_enabled_now
    && !report.automation_enabled_now
    && !report.repeat_upload_execution_enabled_now
    && !report.bulk_uploads_enabled_now
    && !report.deletes_enabled_now
    && !report.unrelated_metadata_changes_enabled_now
    && !report.upload_execution_enabled_now;
}

function inputReady(input: YouTubeRepeatabilityAttemptInput): boolean {
  return input.allow_repeatability_check === true
    && input.allow_repeat_upload_execution === false
    && input.bulk_uploads_enabled === false
    && input.deletes_enabled === false
    && input.unrelated_metadata_changes_enabled === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.platform_account_id.trim().length > 0
    && input.render_plan_id.trim().length > 0
    && input.idempotency_key.trim().length > 0
    && input.prior_first_upload_result_id.trim().length > 0
    && input.scheduled_window_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0;
}

function blocked(report: YouTubeRepeatabilityAutomationSafeReport, input: YouTubeRepeatabilityAttemptInput, createdAt: string, reasons: string[]): YouTubeRepeatabilityImplementationResult {
  return { schema_version: "1.0", repeatability_result_id: safe(`youtube-repeatability-${input.request_id}`, "youtube-repeatability-result"), repeatability_safe_report_id: report.repeatability_automation_safe_report_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), platform_account_id: safe(input.platform_account_id, "platform-account"), render_plan_id: safe(input.render_plan_id, "render-plan"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), repeatability_state: "blocked", repeatability_check_executed: false, repeat_upload_execution_enabled: false, repeat_upload_executed: false, automation_enabled: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, idempotency_key: safe(input.idempotency_key, "idempotency-key"), duplicate_found: false, schedule_window_open: false, quota_available: false, retry_after: null, raw_payload_stored: false, raw_response_stored: false, safe_store_result: null, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_automation_expansion_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "Repeatability implementation blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeRepeatabilityImplementation", source_safe_report_id: report.repeatability_automation_safe_report_id } };
}

export async function runYouTubeRepeatabilityImplementation(report: YouTubeRepeatabilityAutomationSafeReport, input: YouTubeRepeatabilityAttemptInput, adapters: YouTubeRepeatabilityCheckAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeRepeatabilityImplementationResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!reportReady(report)) return blocked(report, input, createdAt, ["Repeatability safe report is not ready for implementation."]);
  if (!inputReady(input)) return blocked(report, input, createdAt, ["Repeatability input violates safety constraints."]);

  const idempotency = await adapters.checkIdempotency(input);
  const schedule = await adapters.checkScheduleWindow(input);
  const quota = await adapters.checkQuotaResume(input);
  const duplicateFound = idempotency.duplicate_found === true;
  const windowOpen = schedule.window_open === true;
  const quotaAvailable = quota.quota_available === true;
  const blockingReasons = [
    ...(duplicateFound ? ["Duplicate idempotency key found; repeat upload execution remains blocked."] : []),
    ...(!windowOpen ? ["Schedule window is not open."] : []),
    ...(!quotaAvailable ? ["Quota is not available for repeatability readiness."] : []),
  ];

  const result: YouTubeRepeatabilityImplementationResult = {
    schema_version: "1.0",
    repeatability_result_id: safe(options.id, `youtube-repeatability-${input.request_id}`),
    repeatability_safe_report_id: report.repeatability_automation_safe_report_id,
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    platform_account_id: safe(input.platform_account_id, "platform-account"),
    render_plan_id: safe(input.render_plan_id, "render-plan"),
    created_at: createdAt,
    repeatability_state: blockingReasons.length === 0 ? "ready_for_repeat_attempt_review" : "blocked",
    repeatability_check_executed: true,
    repeat_upload_execution_enabled: false,
    repeat_upload_executed: false,
    automation_enabled: false,
    bulk_uploads_enabled: false,
    bulk_uploads_executed: false,
    deletes_enabled: false,
    deletes_executed: false,
    unrelated_metadata_changes_enabled: false,
    unrelated_metadata_changed: false,
    idempotency_key: safe(idempotency.idempotency_key, "idempotency-key"),
    duplicate_found: duplicateFound,
    schedule_window_open: windowOpen,
    quota_available: quotaAvailable,
    retry_after: quota.retry_after ? safe(quota.retry_after, "retry-after") : null,
    raw_payload_stored: false,
    raw_response_stored: false,
    safe_store_result: null,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: blockingReasons.length === 0, ready_for_automation_expansion_review: blockingReasons.length === 0, ready_for_real_upload: false, blocking_reasons: blockingReasons, warnings: ["Repeatability implementation does not execute repeat uploads or automation."] },
    provenance: { generated_by: "runYouTubeRepeatabilityImplementation", source_safe_report_id: report.repeatability_automation_safe_report_id },
  };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(result);
    result.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-repeatability-safe-summary"), safe_summary: safe(stored.safe_summary, "Repeatability safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!result.safe_store_result.stored) {
      result.repeatability_state = "blocked";
      result.validation.complete = false;
      result.validation.ready_for_automation_expansion_review = false;
      result.validation.blocking_reasons = [...result.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return result;
}

function resultReady(result: YouTubeRepeatabilityImplementationResult): boolean {
  return result.repeatability_state === "ready_for_repeat_attempt_review" && result.validation.complete && result.validation.ready_for_automation_expansion_review && !result.validation.ready_for_real_upload && result.repeatability_check_executed && !result.repeat_upload_executed && !result.automation_enabled && !result.bulk_uploads_executed && !result.deletes_executed && !result.unrelated_metadata_changed && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeRepeatabilityImplementationReview(result: YouTubeRepeatabilityImplementationResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeRepeatabilityImplementationReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", repeatability_review_id: safe(options.id, "youtube-repeatability-implementation-review-001"), repeatability_result_id: result.repeatability_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, repeatability_check_executed: result.repeatability_check_executed, repeat_upload_executed: false, automation_enabled: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Repeatability implementation result was not ready for review."], warnings: ["Review does not approve automation expansion."] }, provenance: { generated_by: "createYouTubeRepeatabilityImplementationReview", source_result_id: result.repeatability_result_id } };
}

export function createYouTubeRepeatabilityImplementationSafeReport(review: YouTubeRepeatabilityImplementationReview, result: YouTubeRepeatabilityImplementationResult, options: { id?: string; created_at?: string; requestAutomationExpansion?: boolean } = {}): YouTubeRepeatabilityImplementationSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestAutomationExpansion !== false;
  return { schema_version: "1.0", repeatability_implementation_safe_report_id: safe(options.id, "youtube-repeatability-implementation-safe-report-001"), repeatability_review_id: review.repeatability_review_id, repeatability_result_id: result.repeatability_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_automation_expansion" : ready ? "complete" : "blocked", safe_report_only: true, repeatability_check_executed: result.repeatability_check_executed, repeat_upload_executed: false, automation_enabled: false, bulk_uploads_executed: false, deletes_executed: false, unrelated_metadata_changed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before automation expansion."] : ["Repeatability implementation review was not ready for safe report."], warnings: ["Stop before automation expansion, bulk scheduling, deletes, or unrelated metadata changes."] }, provenance: { generated_by: "createYouTubeRepeatabilityImplementationSafeReport", source_review_id: review.repeatability_review_id } };
}

export function revokeYouTubeRepeatabilityImplementationResult(result: YouTubeRepeatabilityImplementationResult, reason?: string): YouTubeRepeatabilityImplementationResult { return { ...result, repeatability_state: "revoked", repeat_upload_execution_enabled: false, repeat_upload_executed: false, automation_enabled: false, bulk_uploads_enabled: false, bulk_uploads_executed: false, deletes_enabled: false, deletes_executed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_automation_expansion_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Repeatability implementation result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeRepeatabilityImplementationResult" } }; }
export function revokeYouTubeRepeatabilityImplementationReview(review: YouTubeRepeatabilityImplementationReview, reason?: string): YouTubeRepeatabilityImplementationReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Repeatability implementation review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeRepeatabilityImplementationReview" } }; }
export function revokeYouTubeRepeatabilityImplementationSafeReport(report: YouTubeRepeatabilityImplementationSafeReport, reason?: string): YouTubeRepeatabilityImplementationSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Repeatability implementation safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeRepeatabilityImplementationSafeReport" } }; }
