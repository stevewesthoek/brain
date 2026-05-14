import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubFinalGate, RuntimeStubFinalGateSafeReport } from "./runtime-stub-final-gate.js";

export type RuntimeStubCompletionSummaryState = "draft" | "complete" | "approved_for_future_completion_review" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCompletionReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_completion_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCompletionSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_closeout" | "rejected" | "revoked" | "blocked";
export type RuntimeStubCompletionItemState = "complete" | "blocked" | "deferred";
export type RuntimeStubCompletionReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubCompletionItem {
  item_id: string;
  item_kind: string;
  item_state: RuntimeStubCompletionItemState;
  safe_summary: string;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubCompletionReviewItem {
  item_id: string;
  item_kind: string;
  review_state: RuntimeStubCompletionReviewItemState;
  safe_summary: string;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubCompletionSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubCompletionSummary {
  schema_version: "1.0";
  runtime_stub_completion_summary_id: string;
  runtime_stub_final_gate_safe_report_id: string;
  runtime_stub_final_gate_id: string;
  runtime_stub_release_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  completion_summary_state: RuntimeStubCompletionSummaryState;
  required_artifacts: { runtime_stub_final_gate_safe_report_validated: true; runtime_stub_final_gate_validated: true };
  summary_scope: ControlledRuntimeActivationScope;
  summary_controls: {
    summary_only: true;
    completion_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  completion_items: RuntimeStubCompletionItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCompletionSummary" | "revokeRuntimeStubCompletionSummary"; source_runtime_stub_final_gate_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubCompletionReview {
  schema_version: "1.0";
  runtime_stub_completion_review_id: string;
  runtime_stub_completion_summary_id: string;
  runtime_stub_final_gate_id: string;
  runtime_stub_release_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  completion_review_state: RuntimeStubCompletionReviewState;
  required_artifacts: { runtime_stub_completion_summary_validated: true; runtime_stub_final_gate_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    completion_reviewed: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_items: RuntimeStubCompletionReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCompletionReview" | "revokeRuntimeStubCompletionReview"; source_runtime_stub_completion_summary_id: string; source_render_plan_id: string };
}

export interface RuntimeStubCompletionSafeReport {
  schema_version: "1.0";
  runtime_stub_completion_safe_report_id: string;
  runtime_stub_completion_review_id: string;
  runtime_stub_completion_summary_id: string;
  runtime_stub_final_gate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubCompletionSafeReportState;
  required_artifacts: { runtime_stub_completion_review_validated: true; runtime_stub_completion_summary_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubCompletionSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubCompletionSafeReport" | "revokeRuntimeStubCompletionSafeReport"; source_runtime_stub_completion_review_id: string; source_render_plan_id: string };
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

const ITEMS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "final-gate", kind: "final_gate", summary: "Final gate summarized only." },
  { id: "release-candidate", kind: "release_candidate", summary: "Release candidate summarized only." },
  { id: "boundaries", kind: "boundaries", summary: "Runtime invocation remains disabled." },
  { id: "status", kind: "status", summary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}

function finalGateReady(finalGate: RuntimeStubFinalGate): boolean {
  return finalGate.final_gate_state === "approved_for_future_final_gate_review" && finalGate.validation.complete && finalGate.validation.ready_for_next_phase && finalGate.gate_controls.final_gate_only && finalGate.gate_controls.summary_only && !finalGate.gate_controls.contains_runtime_callable && !finalGate.gate_controls.contains_raw_payload && !finalGate.gate_controls.contains_raw_response && !finalGate.gate_controls.contains_secret_material && finalGate.gate_controls.runtime_invocation_disabled && finalGate.gate_controls.real_upload_still_blocked && finalGate.gate_checks.every((check) => check.check_state === "passed" && !check.opened_now && !check.runtime_executed_now);
}

function finalGateSafeReportReady(report: RuntimeStubFinalGateSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_completion_summary" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function completionSummaryReady(summary: RuntimeStubCompletionSummary): boolean {
  return summary.completion_summary_state === "approved_for_future_completion_review" && summary.validation.complete && summary.validation.ready_for_next_phase && summary.summary_controls.summary_only && summary.summary_controls.completion_only && !summary.summary_controls.contains_runtime_callable && !summary.summary_controls.contains_raw_payload && !summary.summary_controls.contains_raw_response && !summary.summary_controls.contains_secret_material && summary.summary_controls.runtime_invocation_disabled && summary.summary_controls.real_upload_still_blocked && summary.completion_items.length >= 4 && summary.completion_items.every((item) => item.item_state === "complete" && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function completionReviewReady(review: RuntimeStubCompletionReview): boolean {
  return review.completion_review_state === "approved_for_future_completion_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.completion_reviewed && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_items.length >= 4 && review.review_items.every((item) => item.review_state === "passed" && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub completion prerequisite was not validated.")))];
}

function completionItems(complete: boolean): RuntimeStubCompletionItem[] {
  return ITEMS.map((item) => ({ item_id: `completion-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "completion_item"), item_state: complete ? "complete" : "blocked", safe_summary: sanitizeSafeSummary(item.summary, "Runtime stub completion summary only."), runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function reviewItems(passed: boolean): RuntimeStubCompletionReviewItem[] {
  return ITEMS.map((item) => ({ item_id: `completion-review-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "completion_review_item"), review_state: passed ? "passed" : "blocked", safe_summary: item.kind === "final_gate" ? "Final gate completion reviewed only." : item.kind === "release_candidate" ? "Release candidate completion reviewed only." : sanitizeSafeSummary(item.summary, "Runtime stub completion review only."), runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function safeReportSections(): RuntimeStubCompletionSafeReportSection[] {
  return [
    { section_id: "completion-safe-report-summary", section_kind: "summary", safe_summary: "Runtime stub completion safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "completion-safe-report-review", section_kind: "review", safe_summary: "Runtime stub completion safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "completion-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "completion-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
  ];
}

export function createRuntimeStubCompletionSummary(finalGateSafeReport: RuntimeStubFinalGateSafeReport, finalGate: RuntimeStubFinalGate, options: { id?: string; created_at?: string; requestFutureCompletionReview?: boolean } = {}): RuntimeStubCompletionSummary {
  const ready = finalGateSafeReportReady(finalGateSafeReport) && finalGateReady(finalGate);
  const requestReview = options.requestFutureCompletionReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub final gate safe report or final gate was not ready for completion summary.", [...finalGateSafeReport.validation.blocking_reasons, ...finalGate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_completion_summary_id: safe(options.id, "runtime-stub-completion-summary-001"),
    runtime_stub_final_gate_safe_report_id: finalGateSafeReport.runtime_stub_final_gate_safe_report_id,
    runtime_stub_final_gate_id: finalGate.runtime_stub_final_gate_id,
    runtime_stub_release_candidate_id: finalGate.runtime_stub_release_candidate_id,
    render_plan_id: finalGateSafeReport.render_plan_id,
    project_id: finalGateSafeReport.project_id,
    platform: finalGateSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    completion_summary_state: readyForNext ? "approved_for_future_completion_review" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_final_gate_safe_report_validated: true, runtime_stub_final_gate_validated: true },
    summary_scope: scope(readyForNext),
    summary_controls: { summary_only: true, completion_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    completion_items: completionItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCompletionSummary", source_runtime_stub_final_gate_safe_report_id: finalGateSafeReport.runtime_stub_final_gate_safe_report_id, source_render_plan_id: finalGateSafeReport.render_plan_id },
  };
}

export function createRuntimeStubCompletionReview(summary: RuntimeStubCompletionSummary, finalGate: RuntimeStubFinalGate, options: { id?: string; created_at?: string; requestFutureCompletionSafeReport?: boolean } = {}): RuntimeStubCompletionReview {
  const ready = completionSummaryReady(summary) && finalGateReady(finalGate);
  const requestReport = options.requestFutureCompletionSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub completion summary or final gate was not ready for completion review.", [...summary.validation.blocking_reasons, ...finalGate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_completion_review_id: safe(options.id, "runtime-stub-completion-review-001"),
    runtime_stub_completion_summary_id: summary.runtime_stub_completion_summary_id,
    runtime_stub_final_gate_id: finalGate.runtime_stub_final_gate_id,
    runtime_stub_release_candidate_id: finalGate.runtime_stub_release_candidate_id,
    render_plan_id: summary.render_plan_id,
    project_id: summary.project_id,
    platform: summary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    completion_review_state: readyForNext ? "approved_for_future_completion_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_completion_summary_validated: true, runtime_stub_final_gate_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, completion_reviewed: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCompletionReview", source_runtime_stub_completion_summary_id: summary.runtime_stub_completion_summary_id, source_render_plan_id: summary.render_plan_id },
  };
}

export function createRuntimeStubCompletionSafeReport(review: RuntimeStubCompletionReview, summary: RuntimeStubCompletionSummary, options: { id?: string; created_at?: string; requestFutureRuntimeStubCloseout?: boolean } = {}): RuntimeStubCompletionSafeReport {
  const ready = completionReviewReady(review) && completionSummaryReady(summary);
  const requestCloseout = options.requestFutureRuntimeStubCloseout !== false;
  const complete = ready;
  const readyForNext = complete && requestCloseout;
  const reasons = blocking(ready, "Runtime stub completion review or summary was not ready for completion safe report.", [...review.validation.blocking_reasons, ...summary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_completion_safe_report_id: safe(options.id, "runtime-stub-completion-safe-report-001"),
    runtime_stub_completion_review_id: review.runtime_stub_completion_review_id,
    runtime_stub_completion_summary_id: summary.runtime_stub_completion_summary_id,
    runtime_stub_final_gate_id: summary.runtime_stub_final_gate_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_closeout" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_completion_review_validated: true, runtime_stub_completion_summary_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubCompletionSafeReport", source_runtime_stub_completion_review_id: review.runtime_stub_completion_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeStubCompletionSummary(summary: RuntimeStubCompletionSummary, reason?: string): RuntimeStubCompletionSummary {
  const warning = sanitizeSafeSummary(reason, "Runtime stub completion summary was revoked.");
  return { ...summary, completion_summary_state: "revoked", summary_scope: scope(false), completion_items: summary.completion_items.map((item) => ({ ...item, item_state: "blocked" })), validation: validation(false, false, summary.validation.blocking_reasons, [...summary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...summary.provenance, generated_by: "revokeRuntimeStubCompletionSummary" } };
}

export function revokeRuntimeStubCompletionReview(review: RuntimeStubCompletionReview, reason?: string): RuntimeStubCompletionReview {
  const warning = sanitizeSafeSummary(reason, "Runtime stub completion review was revoked.");
  return { ...review, completion_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeStubCompletionReview" } };
}

export function revokeRuntimeStubCompletionSafeReport(report: RuntimeStubCompletionSafeReport, reason?: string): RuntimeStubCompletionSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub completion safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubCompletionSafeReport" } };
}
