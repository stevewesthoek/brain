import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationFinalBoundary, RuntimeActivationFinalBoundarySafeReport } from "./runtime-activation-final-boundary.js";

export type RuntimeActivationCloseoutState = "draft" | "created" | "approved_for_future_closeout_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCloseoutReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_closeout_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCloseoutSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_archive" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCloseoutCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationCloseoutTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  closeout_executed_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationCloseoutReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationCloseoutCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  closeout_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationCloseoutSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  closeout_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationCloseout {
  schema_version: "1.0";
  runtime_activation_closeout_id: string;
  runtime_activation_final_boundary_safe_report_id: string;
  runtime_activation_final_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  closeout_state: RuntimeActivationCloseoutState;
  required_artifacts: { runtime_activation_final_boundary_safe_report_validated: true; runtime_activation_final_boundary_validated: true };
  closeout_scope: ControlledRuntimeActivationScope;
  closeout_controls: {
    closeout_only: true;
    closeout_record_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    closeout_executed_now: false;
    real_upload_still_blocked: true;
  };
  closeout_terms: RuntimeActivationCloseoutTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCloseout" | "revokeRuntimeActivationCloseout"; source_runtime_activation_final_boundary_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationCloseoutReview {
  schema_version: "1.0";
  runtime_activation_closeout_review_id: string;
  runtime_activation_closeout_id: string;
  runtime_activation_final_boundary_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  closeout_review_state: RuntimeActivationCloseoutReviewState;
  required_artifacts: { runtime_activation_closeout_validated: true; runtime_activation_final_boundary_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    closeout_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    closeout_executed_now: false;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationCloseoutReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCloseoutReview" | "revokeRuntimeActivationCloseoutReview"; source_runtime_activation_closeout_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationCloseoutSafeReport {
  schema_version: "1.0";
  runtime_activation_closeout_safe_report_id: string;
  runtime_activation_closeout_review_id: string;
  runtime_activation_closeout_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationCloseoutSafeReportState;
  required_artifacts: { runtime_activation_closeout_review_validated: true; runtime_activation_closeout_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    closeout_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    closeout_executed_now: false;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationCloseoutSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCloseoutSafeReport" | "revokeRuntimeActivationCloseoutSafeReport"; source_runtime_activation_closeout_review_id: string; source_render_plan_id: string };
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

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation closeout prerequisite was not validated.")))];
}

function finalBoundarySafeReportReady(report: RuntimeActivationFinalBoundarySafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_closeout" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.final_boundary_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.final_boundary_opened && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.boundary_opened_now && !section.ready_for_real_upload_now);
}
function finalBoundaryReady(boundary: RuntimeActivationFinalBoundary): boolean {
  return boundary.final_boundary_state === "approved_for_future_final_boundary_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && !boundary.validation.ready_for_real_upload && boundary.final_boundary_controls.final_boundary_only && boundary.final_boundary_controls.boundary_review_only && !boundary.final_boundary_controls.contains_runtime_callable && !boundary.final_boundary_controls.contains_raw_payload && !boundary.final_boundary_controls.contains_raw_response && !boundary.final_boundary_controls.contains_secret_material && !boundary.final_boundary_controls.runtime_wiring_implemented && boundary.final_boundary_controls.runtime_invocation_disabled && !boundary.final_boundary_controls.final_boundary_opened && boundary.final_boundary_controls.real_upload_still_blocked && boundary.final_boundary_terms.every((term) => !term.runtime_enabled_now && !term.boundary_opened_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function closeoutReady(closeout: RuntimeActivationCloseout): boolean {
  return closeout.closeout_state === "approved_for_future_closeout_review" && closeout.validation.complete && closeout.validation.ready_for_next_phase && closeout.closeout_controls.closeout_only && closeout.closeout_controls.closeout_record_only && !closeout.closeout_controls.contains_runtime_callable && !closeout.closeout_controls.contains_raw_payload && !closeout.closeout_controls.contains_raw_response && !closeout.closeout_controls.contains_secret_material && !closeout.closeout_controls.runtime_wiring_implemented && closeout.closeout_controls.runtime_invocation_disabled && !closeout.closeout_controls.closeout_executed_now && closeout.closeout_controls.real_upload_still_blocked && closeout.closeout_terms.length >= 4 && closeout.closeout_terms.every((term) => !term.runtime_enabled_now && !term.closeout_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function closeoutReviewReady(review: RuntimeActivationCloseoutReview): boolean {
  return review.closeout_review_state === "approved_for_future_closeout_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.closeout_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && !review.review_controls.closeout_executed_now && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.closeout_executed_now && !check.ready_for_real_upload_now);
}

function closeoutTerms(): RuntimeActivationCloseoutTerm[] {
  return [
    { term_id: "closeout-scope", term_kind: "scope", safe_summary: "Closeout record scope only; no runtime enabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "closeout-runtime", term_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "closeout-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "closeout-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationCloseoutReviewCheck[] {
  const checks = [
    ["closeout-review-scope", "scope", "Closeout scope reviewed only."],
    ["closeout-review-runtime", "runtime", "Runtime invocation remains disabled."],
    ["closeout-review-credentials", "credentials", "Credentials remain inaccessible."],
    ["closeout-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationCloseoutSafeReportSection[] {
  return [
    { section_id: "closeout-safe-report-closeout", section_kind: "closeout", safe_summary: "Runtime activation closeout summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "closeout-safe-report-review", section_kind: "review", safe_summary: "Runtime activation closeout review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "closeout-safe-report-runtime", section_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "closeout-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationCloseout(finalBoundarySafeReport: RuntimeActivationFinalBoundarySafeReport, finalBoundary: RuntimeActivationFinalBoundary, options: { id?: string; created_at?: string; requestFutureCloseoutReview?: boolean } = {}): RuntimeActivationCloseout {
  const ready = finalBoundarySafeReportReady(finalBoundarySafeReport) && finalBoundaryReady(finalBoundary);
  const requestReview = options.requestFutureCloseoutReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation final-boundary safe report or boundary was not ready for closeout.", [...finalBoundarySafeReport.validation.blocking_reasons, ...finalBoundary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_closeout_id: safe(options.id, "runtime-activation-closeout-001"),
    runtime_activation_final_boundary_safe_report_id: finalBoundarySafeReport.runtime_activation_final_boundary_safe_report_id,
    runtime_activation_final_boundary_id: finalBoundary.runtime_activation_final_boundary_id,
    render_plan_id: finalBoundarySafeReport.render_plan_id,
    project_id: finalBoundarySafeReport.project_id,
    platform: finalBoundarySafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_state: readyForNext ? "approved_for_future_closeout_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_final_boundary_safe_report_validated: true, runtime_activation_final_boundary_validated: true },
    closeout_scope: scope(readyForNext),
    closeout_controls: { closeout_only: true, closeout_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, closeout_executed_now: false, real_upload_still_blocked: true },
    closeout_terms: closeoutTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationCloseout", source_runtime_activation_final_boundary_safe_report_id: finalBoundarySafeReport.runtime_activation_final_boundary_safe_report_id, source_render_plan_id: finalBoundarySafeReport.render_plan_id },
  };
}

export function createRuntimeActivationCloseoutReview(closeout: RuntimeActivationCloseout, finalBoundarySafeReport: RuntimeActivationFinalBoundarySafeReport, options: { id?: string; created_at?: string; requestFutureCloseoutSafeReport?: boolean } = {}): RuntimeActivationCloseoutReview {
  const ready = closeoutReady(closeout) && finalBoundarySafeReportReady(finalBoundarySafeReport);
  const requestReport = options.requestFutureCloseoutSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation closeout or final-boundary safe report was not ready for closeout review.", [...closeout.validation.blocking_reasons, ...finalBoundarySafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_closeout_review_id: safe(options.id, "runtime-activation-closeout-review-001"),
    runtime_activation_closeout_id: closeout.runtime_activation_closeout_id,
    runtime_activation_final_boundary_safe_report_id: closeout.runtime_activation_final_boundary_safe_report_id,
    render_plan_id: closeout.render_plan_id,
    project_id: closeout.project_id,
    platform: closeout.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    closeout_review_state: readyForNext ? "approved_for_future_closeout_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_closeout_validated: true, runtime_activation_final_boundary_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, closeout_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, closeout_executed_now: false, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationCloseoutReview", source_runtime_activation_closeout_id: closeout.runtime_activation_closeout_id, source_render_plan_id: closeout.render_plan_id },
  };
}

export function createRuntimeActivationCloseoutSafeReport(review: RuntimeActivationCloseoutReview, closeout: RuntimeActivationCloseout, options: { id?: string; created_at?: string; requestFutureRuntimeActivationArchive?: boolean } = {}): RuntimeActivationCloseoutSafeReport {
  const ready = closeoutReviewReady(review) && closeoutReady(closeout);
  const requestArchive = options.requestFutureRuntimeActivationArchive !== false;
  const complete = ready;
  const readyForNext = complete && requestArchive;
  const reasons = blocking(ready, "Runtime activation closeout review or closeout was not ready for closeout safe report.", [...review.validation.blocking_reasons, ...closeout.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_closeout_safe_report_id: safe(options.id, "runtime-activation-closeout-safe-report-001"),
    runtime_activation_closeout_review_id: review.runtime_activation_closeout_review_id,
    runtime_activation_closeout_id: closeout.runtime_activation_closeout_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_archive" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_closeout_review_validated: true, runtime_activation_closeout_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, closeout_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, closeout_executed_now: false, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationCloseoutSafeReport", source_runtime_activation_closeout_review_id: review.runtime_activation_closeout_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeActivationCloseout(closeout: RuntimeActivationCloseout, reason?: string): RuntimeActivationCloseout {
  const warning = sanitizeSafeSummary(reason, "Runtime activation closeout was revoked.");
  return { ...closeout, closeout_state: "revoked", closeout_scope: scope(false), validation: validation(false, false, closeout.validation.blocking_reasons, [...closeout.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...closeout.provenance, generated_by: "revokeRuntimeActivationCloseout" } };
}
export function revokeRuntimeActivationCloseoutReview(review: RuntimeActivationCloseoutReview, reason?: string): RuntimeActivationCloseoutReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation closeout review was revoked.");
  return { ...review, closeout_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationCloseoutReview" } };
}
export function revokeRuntimeActivationCloseoutSafeReport(report: RuntimeActivationCloseoutSafeReport, reason?: string): RuntimeActivationCloseoutSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation closeout safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationCloseoutSafeReport" } };
}
