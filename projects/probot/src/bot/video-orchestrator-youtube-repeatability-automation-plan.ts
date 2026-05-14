import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeFirstControlledUploadResult, YouTubeFirstControlledUploadSafeReport } from "./video-orchestrator-youtube-first-controlled-upload.js";

export type YouTubeRepeatabilityAutomationPlanState = "created" | "approved_for_repeatability_design_review" | "blocked" | "revoked";
export type YouTubeRepeatabilityAutomationReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeRepeatabilityAutomationSafeReportState = "complete" | "requires_operator_confirmation_for_repeatability_implementation" | "blocked" | "revoked";
export type YouTubeRepeatabilityAutomationItemKind = "idempotency" | "schedule_window" | "quota_resume" | "single_account_queue" | "duplicate_prevention" | "safe_summary_storage" | "operator_review" | "bulk_upload_guard" | "delete_guard" | "metadata_guard" | "rollback";

export interface YouTubeRepeatabilityAutomationPlanItem {
  item_id: string;
  item_kind: YouTubeRepeatabilityAutomationItemKind;
  safe_summary: string;
  planned_now: true;
  implemented_now: false;
  repeat_upload_executed_now: false;
  bulk_upload_enabled_now: false;
  bulk_upload_executed_now: false;
  delete_enabled_now: false;
  delete_executed_now: false;
  unrelated_metadata_change_enabled_now: false;
  unrelated_metadata_changed_now: false;
  network_call_enabled_now: false;
  platform_api_call_enabled_now: false;
  media_read_enabled_now: false;
  upload_execution_enabled_now: false;
  requires_future_confirmation: true;
}

export interface YouTubeRepeatabilityAutomationPlan {
  schema_version: "1.0";
  repeatability_automation_plan_id: string;
  first_upload_safe_report_id: string;
  first_upload_result_id: string;
  created_at: string;
  plan_state: YouTubeRepeatabilityAutomationPlanState;
  planning_only: true;
  first_upload_reviewed: true;
  repeatability_implementation_enabled_now: false;
  automation_enabled_now: false;
  repeat_upload_execution_enabled_now: false;
  bulk_uploads_enabled_now: false;
  bulk_uploads_executed_now: false;
  deletes_enabled_now: false;
  deletes_executed_now: false;
  unrelated_metadata_changes_enabled_now: false;
  unrelated_metadata_changed_now: false;
  media_reads_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  package_metadata_changed_now: false;
  dependency_changes_now: false;
  plan_items: YouTubeRepeatabilityAutomationPlanItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeRepeatabilityAutomationPlan" | "revokeYouTubeRepeatabilityAutomationPlan"; source_first_upload_safe_report_id: string; operator_confirmed_planning_only: true };
}

export interface YouTubeRepeatabilityAutomationPlanReview {
  schema_version: "1.0";
  repeatability_automation_review_id: string;
  repeatability_automation_plan_id: string;
  created_at: string;
  review_state: YouTubeRepeatabilityAutomationReviewState;
  review_only: true;
  reviewed_item_ids: string[];
  repeatability_implementation_enabled_now: false;
  automation_enabled_now: false;
  repeat_upload_execution_enabled_now: false;
  bulk_uploads_enabled_now: false;
  deletes_enabled_now: false;
  unrelated_metadata_changes_enabled_now: false;
  upload_execution_enabled_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeRepeatabilityAutomationPlanReview" | "revokeYouTubeRepeatabilityAutomationPlanReview"; source_plan_id: string };
}

export interface YouTubeRepeatabilityAutomationSafeReport {
  schema_version: "1.0";
  repeatability_automation_safe_report_id: string;
  repeatability_automation_review_id: string;
  repeatability_automation_plan_id: string;
  created_at: string;
  safe_report_state: YouTubeRepeatabilityAutomationSafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  repeatability_implementation_enabled_now: false;
  automation_enabled_now: false;
  repeat_upload_execution_enabled_now: false;
  bulk_uploads_enabled_now: false;
  bulk_uploads_executed_now: false;
  deletes_enabled_now: false;
  deletes_executed_now: false;
  unrelated_metadata_changes_enabled_now: false;
  unrelated_metadata_changed_now: false;
  media_reads_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  package_metadata_changed_now: false;
  dependency_changes_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeRepeatabilityAutomationSafeReport" | "revokeYouTubeRepeatabilityAutomationSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function firstUploadReady(report: YouTubeFirstControlledUploadSafeReport, result: YouTubeFirstControlledUploadResult): boolean {
  return report.safe_report_state === "requires_operator_review_for_repeatability"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && report.upload_executed
    && report.one_upload_attempt_only
    && !report.bulk_upload_performed
    && !report.delete_performed
    && !report.unrelated_metadata_changed
    && !report.raw_payload_stored
    && !report.raw_response_stored
    && result.validation.complete
    && result.validation.ready_for_repeatability_review
    && !result.validation.ready_for_real_upload
    && result.upload_executed
    && result.one_project_only
    && result.one_platform_account_only
    && result.one_render_artifact_only
    && result.one_upload_attempt_only
    && result.scheduled_first_private_fallback
    && !result.bulk_upload_performed
    && !result.delete_performed
    && !result.unrelated_metadata_changed
    && !result.raw_payload_stored
    && !result.raw_response_stored;
}

function planReady(plan: YouTubeRepeatabilityAutomationPlan): boolean {
  return plan.plan_state === "approved_for_repeatability_design_review"
    && plan.validation.complete
    && plan.validation.ready_for_next_phase
    && plan.planning_only
    && plan.first_upload_reviewed
    && plan.plan_items.length >= 11
    && plan.plan_items.every((item) => item.planned_now && !item.implemented_now && !item.repeat_upload_executed_now && !item.bulk_upload_enabled_now && !item.bulk_upload_executed_now && !item.delete_enabled_now && !item.delete_executed_now && !item.unrelated_metadata_change_enabled_now && !item.unrelated_metadata_changed_now && !item.network_call_enabled_now && !item.platform_api_call_enabled_now && !item.media_read_enabled_now && !item.upload_execution_enabled_now && item.requires_future_confirmation)
    && !plan.repeatability_implementation_enabled_now
    && !plan.automation_enabled_now
    && !plan.repeat_upload_execution_enabled_now
    && !plan.bulk_uploads_enabled_now
    && !plan.bulk_uploads_executed_now
    && !plan.deletes_enabled_now
    && !plan.deletes_executed_now
    && !plan.unrelated_metadata_changes_enabled_now
    && !plan.unrelated_metadata_changed_now
    && !plan.media_reads_enabled_now
    && !plan.network_calls_enabled_now
    && !plan.platform_api_calls_enabled_now
    && !plan.upload_execution_enabled_now
    && !plan.package_metadata_changed_now
    && !plan.dependency_changes_now
    && Object.values(plan.execution_boundary).every((value) => value === false);
}

function reviewReady(review: YouTubeRepeatabilityAutomationPlanReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && review.reviewed_item_ids.length >= 11
    && !review.repeatability_implementation_enabled_now
    && !review.automation_enabled_now
    && !review.repeat_upload_execution_enabled_now
    && !review.bulk_uploads_enabled_now
    && !review.deletes_enabled_now
    && !review.unrelated_metadata_changes_enabled_now
    && !review.upload_execution_enabled_now
    && !review.ready_for_real_upload
    && Object.values(review.execution_boundary).every((value) => value === false);
}

function items(): YouTubeRepeatabilityAutomationPlanItem[] {
  const rows: Array<[string, YouTubeRepeatabilityAutomationItemKind, string]> = [
    ["idempotency", "idempotency", "Plan idempotency keys for repeated scheduling without duplicate uploads."],
    ["schedule-window", "schedule_window", "Plan per-account schedule windows and cadence checks before any repeat execution."],
    ["quota-resume", "quota_resume", "Plan quota/rate-limit blocked states and next-job resume behavior."],
    ["single-account-queue", "single_account_queue", "Plan per-account queue ordering before any automation executes."],
    ["duplicate-prevention", "duplicate_prevention", "Plan duplicate prevention for render plan, account, platform, and idempotency key."],
    ["safe-summary-storage", "safe_summary_storage", "Plan safe summary storage for future repeated attempts without raw payloads or responses."],
    ["operator-review", "operator_review", "Plan operator review gates before repeatability implementation and automation."],
    ["bulk-upload-guard", "bulk_upload_guard", "Plan bulk upload guardrails; bulk uploads remain disabled now."],
    ["delete-guard", "delete_guard", "Plan delete guardrails; deletes remain disabled now."],
    ["metadata-guard", "metadata_guard", "Plan unrelated metadata-change guardrails; unrelated metadata changes remain disabled now."],
    ["rollback", "rollback", "Plan rollback and disablement for repeatability implementation without affecting the first upload record."],
  ];
  return rows.map(([item_id, item_kind, safe_summary]) => ({
    item_id: `youtube-repeatability-automation-${safe(item_id, "item")}`,
    item_kind,
    safe_summary: safe(safe_summary, "Repeatability automation planning item."),
    planned_now: true,
    implemented_now: false,
    repeat_upload_executed_now: false,
    bulk_upload_enabled_now: false,
    bulk_upload_executed_now: false,
    delete_enabled_now: false,
    delete_executed_now: false,
    unrelated_metadata_change_enabled_now: false,
    unrelated_metadata_changed_now: false,
    network_call_enabled_now: false,
    platform_api_call_enabled_now: false,
    media_read_enabled_now: false,
    upload_execution_enabled_now: false,
    requires_future_confirmation: true,
  }));
}

export function createYouTubeRepeatabilityAutomationPlan(report: YouTubeFirstControlledUploadSafeReport, result: YouTubeFirstControlledUploadResult, options: { id?: string; created_at?: string; requestDesignReview?: boolean } = {}): YouTubeRepeatabilityAutomationPlan {
  const ready = firstUploadReady(report, result);
  const readyForNext = ready && options.requestDesignReview !== false;
  return {
    schema_version: "1.0",
    repeatability_automation_plan_id: safe(options.id, "youtube-repeatability-automation-plan-001"),
    first_upload_safe_report_id: report.first_upload_safe_report_id,
    first_upload_result_id: result.first_upload_result_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    plan_state: readyForNext ? "approved_for_repeatability_design_review" : ready ? "created" : "blocked",
    planning_only: true,
    first_upload_reviewed: true,
    repeatability_implementation_enabled_now: false,
    automation_enabled_now: false,
    repeat_upload_execution_enabled_now: false,
    bulk_uploads_enabled_now: false,
    bulk_uploads_executed_now: false,
    deletes_enabled_now: false,
    deletes_executed_now: false,
    unrelated_metadata_changes_enabled_now: false,
    unrelated_metadata_changed_now: false,
    media_reads_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    package_metadata_changed_now: false,
    dependency_changes_now: false,
    plan_items: items(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["First controlled upload safe report/result were not ready for repeatability planning."], warnings: ["Planning only; repeat upload execution and automation remain disabled."] },
    provenance: { generated_by: "createYouTubeRepeatabilityAutomationPlan", source_first_upload_safe_report_id: report.first_upload_safe_report_id, operator_confirmed_planning_only: true },
  };
}

export function createYouTubeRepeatabilityAutomationPlanReview(plan: YouTubeRepeatabilityAutomationPlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeRepeatabilityAutomationPlanReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    repeatability_automation_review_id: safe(options.id, "youtube-repeatability-automation-review-001"),
    repeatability_automation_plan_id: plan.repeatability_automation_plan_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    reviewed_item_ids: plan.plan_items.map((item) => item.item_id),
    repeatability_implementation_enabled_now: false,
    automation_enabled_now: false,
    repeat_upload_execution_enabled_now: false,
    bulk_uploads_enabled_now: false,
    deletes_enabled_now: false,
    unrelated_metadata_changes_enabled_now: false,
    upload_execution_enabled_now: false,
    ready_for_real_upload: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Repeatability automation plan was not ready for review."], warnings: [] },
    provenance: { generated_by: "createYouTubeRepeatabilityAutomationPlanReview", source_plan_id: plan.repeatability_automation_plan_id },
  };
}

export function createYouTubeRepeatabilityAutomationSafeReport(review: YouTubeRepeatabilityAutomationPlanReview, plan: YouTubeRepeatabilityAutomationPlan, options: { id?: string; created_at?: string; requestImplementationConfirmation?: boolean } = {}): YouTubeRepeatabilityAutomationSafeReport {
  const ready = reviewReady(review) && planReady(plan);
  const requiresConfirmation = ready && options.requestImplementationConfirmation !== false;
  return {
    schema_version: "1.0",
    repeatability_automation_safe_report_id: safe(options.id, "youtube-repeatability-automation-safe-report-001"),
    repeatability_automation_review_id: review.repeatability_automation_review_id,
    repeatability_automation_plan_id: plan.repeatability_automation_plan_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_repeatability_implementation" : ready ? "complete" : "blocked",
    safe_report_only: true,
    summary_sections: ["idempotency", "schedule windows", "quota resume", "single-account queue", "duplicate prevention", "safe summaries", "operator gates", "bulk guard", "delete guard", "metadata guard", "rollback"],
    repeatability_implementation_enabled_now: false,
    automation_enabled_now: false,
    repeat_upload_execution_enabled_now: false,
    bulk_uploads_enabled_now: false,
    bulk_uploads_executed_now: false,
    deletes_enabled_now: false,
    deletes_executed_now: false,
    unrelated_metadata_changes_enabled_now: false,
    unrelated_metadata_changed_now: false,
    media_reads_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    package_metadata_changed_now: false,
    dependency_changes_now: false,
    ready_for_real_upload: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before repeatability implementation."] : ["Repeatability automation review was not ready for safe report."], warnings: ["Stop before repeat upload execution, automation, bulk scheduling, deletes, or unrelated metadata updates."] },
    provenance: { generated_by: "createYouTubeRepeatabilityAutomationSafeReport", source_review_id: review.repeatability_automation_review_id },
  };
}

export function revokeYouTubeRepeatabilityAutomationPlan(plan: YouTubeRepeatabilityAutomationPlan, reason?: string): YouTubeRepeatabilityAutomationPlan { return { ...plan, plan_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Repeatability automation plan was revoked.")] }, provenance: { ...plan.provenance, generated_by: "revokeYouTubeRepeatabilityAutomationPlan" } }; }
export function revokeYouTubeRepeatabilityAutomationPlanReview(review: YouTubeRepeatabilityAutomationPlanReview, reason?: string): YouTubeRepeatabilityAutomationPlanReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Repeatability automation review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeRepeatabilityAutomationPlanReview" } }; }
export function revokeYouTubeRepeatabilityAutomationSafeReport(report: YouTubeRepeatabilityAutomationSafeReport, reason?: string): YouTubeRepeatabilityAutomationSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Repeatability automation safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeRepeatabilityAutomationSafeReport" } }; }
