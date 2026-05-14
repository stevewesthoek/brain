import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubCompletionSafeReport, RuntimeStubCompletionSummary } from "./runtime-stub-completion.js";

export type RuntimeStubCloseoutState = "draft" | "closed" | "approved_for_future_closeout_review" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCloseoutReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_closeout_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCloseoutSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_archive" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCloseoutItemState = "closed" | "blocked" | "deferred";
export type RuntimeStubCloseoutReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubCloseoutItem {
  item_id: string;
  item_kind: string;
  item_state: RuntimeStubCloseoutItemState;
  safe_summary: string;
  closed_now: false;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubCloseoutReviewItem {
  item_id: string;
  item_kind: string;
  review_state: RuntimeStubCloseoutReviewItemState;
  safe_summary: string;
  closed_now: false;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubCloseoutSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubCloseout {
  schema_version: "1.0";
  runtime_stub_closeout_id: string;
  runtime_stub_completion_safe_report_id: string;
  runtime_stub_completion_summary_id: string;
  runtime_stub_final_gate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  closeout_state: RuntimeStubCloseoutState;
  required_artifacts: { runtime_stub_completion_safe_report_validated: true; runtime_stub_completion_summary_validated: true };
  closeout_scope: ControlledRuntimeActivationScope;
  closeout_controls: {
    closeout_only: true;
    summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  closeout_items: RuntimeStubCloseoutItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCloseout" | "revokeRuntimeStubCloseout"; source_runtime_stub_completion_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubCloseoutReview {
  schema_version: "1.0";
  runtime_stub_closeout_review_id: string;
  runtime_stub_closeout_id: string;
  runtime_stub_completion_summary_id: string;
  runtime_stub_final_gate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  closeout_review_state: RuntimeStubCloseoutReviewState;
  required_artifacts: { runtime_stub_closeout_validated: true; runtime_stub_completion_summary_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    closeout_reviewed: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_items: RuntimeStubCloseoutReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCloseoutReview" | "revokeRuntimeStubCloseoutReview"; source_runtime_stub_closeout_id: string; source_render_plan_id: string };
}

export interface RuntimeStubCloseoutSafeReport {
  schema_version: "1.0";
  runtime_stub_closeout_safe_report_id: string;
  runtime_stub_closeout_review_id: string;
  runtime_stub_closeout_id: string;
  runtime_stub_completion_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubCloseoutSafeReportState;
  required_artifacts: { runtime_stub_closeout_review_validated: true; runtime_stub_closeout_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubCloseoutSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCloseoutSafeReport" | "revokeRuntimeStubCloseoutSafeReport"; source_runtime_stub_closeout_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  runtime_enabled: false,
  runtime_executed: false,
  upload_allowed: false,
  upload_execution_enabled: false,
  platform_api_calls_allowed: false,
  network_calls_allowed: false,
  credentials_accessed: false,
  token_accessed: false,
  keychain_accessed: false,
  env_accessed: false,
  media_file_read: false,
  file_mutation_allowed: false,
  dependencies_added: false,
  package_metadata_changed: false,
};

const ITEMS: Array<{ id: string; kind: string; closeoutSummary: string; reviewSummary: string }> = [
  { id: "completion", kind: "completion", closeoutSummary: "Completion summarized only.", reviewSummary: "Completion closeout reviewed only." },
  { id: "final-gate", kind: "final_gate", closeoutSummary: "Final gate summarized only.", reviewSummary: "Final gate closeout reviewed only." },
  { id: "boundaries", kind: "boundaries", closeoutSummary: "Runtime invocation remains disabled.", reviewSummary: "Runtime invocation remains disabled." },
  { id: "status", kind: "status", closeoutSummary: "Real upload remains disabled.", reviewSummary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}

function completionSummaryReady(summary: RuntimeStubCompletionSummary): boolean {
  return summary.completion_summary_state === "approved_for_future_completion_review" && summary.validation.complete && summary.validation.ready_for_next_phase && summary.summary_controls.summary_only && summary.summary_controls.completion_only && !summary.summary_controls.contains_runtime_callable && !summary.summary_controls.contains_raw_payload && !summary.summary_controls.contains_raw_response && !summary.summary_controls.contains_secret_material && summary.summary_controls.runtime_invocation_disabled && summary.summary_controls.real_upload_still_blocked && summary.completion_items.length >= 4 && summary.completion_items.every((item) => item.item_state === "complete" && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function completionSafeReportReady(report: RuntimeStubCompletionSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_closeout" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function closeoutReady(closeout: RuntimeStubCloseout): boolean {
  return closeout.closeout_state === "approved_for_future_closeout_review" && closeout.validation.complete && closeout.validation.ready_for_next_phase && closeout.closeout_controls.closeout_only && closeout.closeout_controls.summary_only && !closeout.closeout_controls.contains_runtime_callable && !closeout.closeout_controls.contains_raw_payload && !closeout.closeout_controls.contains_raw_response && !closeout.closeout_controls.contains_secret_material && closeout.closeout_controls.runtime_invocation_disabled && closeout.closeout_controls.real_upload_still_blocked && closeout.closeout_items.length >= 4 && closeout.closeout_items.every((item) => item.item_state === "closed" && !item.closed_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function closeoutReviewReady(review: RuntimeStubCloseoutReview): boolean {
  return review.closeout_review_state === "approved_for_future_closeout_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.closeout_reviewed && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_items.length >= 4 && review.review_items.every((item) => item.review_state === "passed" && !item.closed_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub closeout prerequisite was not validated.")))];
}

function closeoutItems(closed: boolean): RuntimeStubCloseoutItem[] {
  return ITEMS.map((item) => ({ item_id: `closeout-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "closeout_item"), item_state: closed ? "closed" : "blocked", safe_summary: sanitizeSafeSummary(item.closeoutSummary, "Runtime stub closeout only."), closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function reviewItems(passed: boolean): RuntimeStubCloseoutReviewItem[] {
  return ITEMS.map((item) => ({ item_id: `closeout-review-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "closeout_review_item"), review_state: passed ? "passed" : "blocked", safe_summary: sanitizeSafeSummary(item.reviewSummary, "Runtime stub closeout review only."), closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function safeReportSections(): RuntimeStubCloseoutSafeReportSection[] {
  return [
    { section_id: "closeout-safe-report-closeout", section_kind: "closeout", safe_summary: "Runtime stub closeout safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "closeout-safe-report-review", section_kind: "review", safe_summary: "Runtime stub closeout safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "closeout-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "closeout-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
  ];
}

export function createRuntimeStubCloseout(completionSafeReport: RuntimeStubCompletionSafeReport, completionSummary: RuntimeStubCompletionSummary, options: { id?: string; created_at?: string; requestFutureCloseoutReview?: boolean } = {}): RuntimeStubCloseout {
  const ready = completionSafeReportReady(completionSafeReport) && completionSummaryReady(completionSummary);
  const requestReview = options.requestFutureCloseoutReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub completion safe report or summary was not ready for closeout.", [...completionSafeReport.validation.blocking_reasons, ...completionSummary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_closeout_id: safe(options.id, "runtime-stub-closeout-001"),
    runtime_stub_completion_safe_report_id: completionSafeReport.runtime_stub_completion_safe_report_id,
    runtime_stub_completion_summary_id: completionSummary.runtime_stub_completion_summary_id,
    runtime_stub_final_gate_id: completionSummary.runtime_stub_final_gate_id,
    render_plan_id: completionSafeReport.render_plan_id,
    project_id: completionSafeReport.project_id,
    platform: completionSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_state: readyForNext ? "approved_for_future_closeout_review" : ready ? "closed" : "blocked",
    required_artifacts: { runtime_stub_completion_safe_report_validated: true, runtime_stub_completion_summary_validated: true },
    closeout_scope: scope(readyForNext),
    closeout_controls: { closeout_only: true, summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    closeout_items: closeoutItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCloseout", source_runtime_stub_completion_safe_report_id: completionSafeReport.runtime_stub_completion_safe_report_id, source_render_plan_id: completionSafeReport.render_plan_id },
  };
}

export function createRuntimeStubCloseoutReview(closeout: RuntimeStubCloseout, completionSummary: RuntimeStubCompletionSummary, options: { id?: string; created_at?: string; requestFutureCloseoutSafeReport?: boolean } = {}): RuntimeStubCloseoutReview {
  const ready = closeoutReady(closeout) && completionSummaryReady(completionSummary);
  const requestReport = options.requestFutureCloseoutSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub closeout or completion summary was not ready for closeout review.", [...closeout.validation.blocking_reasons, ...completionSummary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_closeout_review_id: safe(options.id, "runtime-stub-closeout-review-001"),
    runtime_stub_closeout_id: closeout.runtime_stub_closeout_id,
    runtime_stub_completion_summary_id: completionSummary.runtime_stub_completion_summary_id,
    runtime_stub_final_gate_id: completionSummary.runtime_stub_final_gate_id,
    render_plan_id: closeout.render_plan_id,
    project_id: closeout.project_id,
    platform: closeout.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_review_state: readyForNext ? "approved_for_future_closeout_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_closeout_validated: true, runtime_stub_completion_summary_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, closeout_reviewed: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCloseoutReview", source_runtime_stub_closeout_id: closeout.runtime_stub_closeout_id, source_render_plan_id: closeout.render_plan_id },
  };
}

export function createRuntimeStubCloseoutSafeReport(review: RuntimeStubCloseoutReview, closeout: RuntimeStubCloseout, options: { id?: string; created_at?: string; requestFutureRuntimeStubArchive?: boolean } = {}): RuntimeStubCloseoutSafeReport {
  const ready = closeoutReviewReady(review) && closeoutReady(closeout);
  const requestArchive = options.requestFutureRuntimeStubArchive !== false;
  const complete = ready;
  const readyForNext = complete && requestArchive;
  const reasons = blocking(ready, "Runtime stub closeout review or closeout was not ready for closeout safe report.", [...review.validation.blocking_reasons, ...closeout.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_closeout_safe_report_id: safe(options.id, "runtime-stub-closeout-safe-report-001"),
    runtime_stub_closeout_review_id: review.runtime_stub_closeout_review_id,
    runtime_stub_closeout_id: closeout.runtime_stub_closeout_id,
    runtime_stub_completion_summary_id: closeout.runtime_stub_completion_summary_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_archive" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_closeout_review_validated: true, runtime_stub_closeout_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCloseoutSafeReport", source_runtime_stub_closeout_review_id: review.runtime_stub_closeout_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeStubCloseout(closeout: RuntimeStubCloseout, reason?: string): RuntimeStubCloseout {
  const warning = sanitizeSafeSummary(reason, "Runtime stub closeout was revoked.");
  return { ...closeout, closeout_state: "revoked", closeout_scope: scope(false), closeout_items: closeout.closeout_items.map((item) => ({ ...item, item_state: "blocked" })), validation: validation(false, false, closeout.validation.blocking_reasons, [...closeout.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...closeout.provenance, generated_by: "revokeRuntimeStubCloseout" } };
}

export function revokeRuntimeStubCloseoutReview(review: RuntimeStubCloseoutReview, reason?: string): RuntimeStubCloseoutReview {
  const warning = sanitizeSafeSummary(reason, "Runtime stub closeout review was revoked.");
  return { ...review, closeout_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeStubCloseoutReview" } };
}

export function revokeRuntimeStubCloseoutSafeReport(report: RuntimeStubCloseoutSafeReport, reason?: string): RuntimeStubCloseoutSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub closeout safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubCloseoutSafeReport" } };
}
