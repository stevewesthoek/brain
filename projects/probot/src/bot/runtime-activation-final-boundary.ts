import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationRehearsalContract, RuntimeActivationRehearsalSafeReport } from "./runtime-activation-rehearsal.js";

export type RuntimeActivationFinalBoundaryState = "draft" | "created" | "approved_for_future_final_boundary_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalBoundaryReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_final_boundary_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalBoundarySafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_closeout" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalBoundaryCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationFinalBoundaryTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  boundary_opened_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationFinalBoundaryReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationFinalBoundaryCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  boundary_opened_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationFinalBoundarySafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  boundary_opened_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationFinalBoundary {
  schema_version: "1.0";
  runtime_activation_final_boundary_id: string;
  runtime_activation_rehearsal_safe_report_id: string;
  runtime_activation_rehearsal_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_boundary_state: RuntimeActivationFinalBoundaryState;
  required_artifacts: { runtime_activation_rehearsal_safe_report_validated: true; runtime_activation_rehearsal_contract_validated: true };
  final_boundary_scope: ControlledRuntimeActivationScope;
  final_boundary_controls: {
    final_boundary_only: true;
    boundary_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    final_boundary_opened: false;
    real_upload_still_blocked: true;
  };
  final_boundary_terms: RuntimeActivationFinalBoundaryTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalBoundary" | "revokeRuntimeActivationFinalBoundary"; source_runtime_activation_rehearsal_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationFinalBoundaryReview {
  schema_version: "1.0";
  runtime_activation_final_boundary_review_id: string;
  runtime_activation_final_boundary_id: string;
  runtime_activation_rehearsal_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_boundary_review_state: RuntimeActivationFinalBoundaryReviewState;
  required_artifacts: { runtime_activation_final_boundary_validated: true; runtime_activation_rehearsal_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    final_boundary_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    final_boundary_opened: false;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationFinalBoundaryReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalBoundaryReview" | "revokeRuntimeActivationFinalBoundaryReview"; source_runtime_activation_final_boundary_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationFinalBoundarySafeReport {
  schema_version: "1.0";
  runtime_activation_final_boundary_safe_report_id: string;
  runtime_activation_final_boundary_review_id: string;
  runtime_activation_final_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationFinalBoundarySafeReportState;
  required_artifacts: { runtime_activation_final_boundary_review_validated: true; runtime_activation_final_boundary_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    final_boundary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    final_boundary_opened: false;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationFinalBoundarySafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalBoundarySafeReport" | "revokeRuntimeActivationFinalBoundarySafeReport"; source_runtime_activation_final_boundary_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation final-boundary prerequisite was not validated.")))];
}

function rehearsalSafeReportReady(report: RuntimeActivationRehearsalSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_final_boundary" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.rehearsal_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.rehearsal_execution_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.rehearsal_executed_now && !section.ready_for_real_upload_now);
}
function rehearsalContractReady(contract: RuntimeActivationRehearsalContract): boolean {
  return contract.rehearsal_contract_state === "approved_for_future_rehearsal_review" && contract.validation.complete && contract.validation.ready_for_next_phase && !contract.validation.ready_for_real_upload && contract.rehearsal_controls.rehearsal_contract_only && contract.rehearsal_controls.rehearsal_only && !contract.rehearsal_controls.contains_runtime_callable && !contract.rehearsal_controls.contains_raw_payload && !contract.rehearsal_controls.contains_raw_response && !contract.rehearsal_controls.contains_secret_material && !contract.rehearsal_controls.runtime_wiring_implemented && contract.rehearsal_controls.runtime_invocation_disabled && contract.rehearsal_controls.rehearsal_execution_disabled && contract.rehearsal_controls.real_upload_still_blocked && contract.rehearsal_terms.every((term) => !term.runtime_enabled_now && !term.rehearsal_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function finalBoundaryReady(boundary: RuntimeActivationFinalBoundary): boolean {
  return boundary.final_boundary_state === "approved_for_future_final_boundary_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && boundary.final_boundary_controls.final_boundary_only && boundary.final_boundary_controls.boundary_review_only && !boundary.final_boundary_controls.contains_runtime_callable && !boundary.final_boundary_controls.contains_raw_payload && !boundary.final_boundary_controls.contains_raw_response && !boundary.final_boundary_controls.contains_secret_material && !boundary.final_boundary_controls.runtime_wiring_implemented && boundary.final_boundary_controls.runtime_invocation_disabled && !boundary.final_boundary_controls.final_boundary_opened && boundary.final_boundary_controls.real_upload_still_blocked && boundary.final_boundary_terms.length >= 4 && boundary.final_boundary_terms.every((term) => !term.runtime_enabled_now && !term.boundary_opened_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function finalBoundaryReviewReady(review: RuntimeActivationFinalBoundaryReview): boolean {
  return review.final_boundary_review_state === "approved_for_future_final_boundary_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.final_boundary_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && !review.review_controls.final_boundary_opened && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.boundary_opened_now && !check.ready_for_real_upload_now);
}

function boundaryTerms(): RuntimeActivationFinalBoundaryTerm[] {
  return [
    { term_id: "final-boundary-scope", term_kind: "scope", safe_summary: "Final-boundary scope only; no runtime enabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "final-boundary-runtime", term_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "final-boundary-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "final-boundary-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationFinalBoundaryReviewCheck[] {
  const checks = [
    ["final-boundary-review-scope", "scope", "Final-boundary scope reviewed only."],
    ["final-boundary-review-runtime", "runtime", "Runtime invocation remains disabled."],
    ["final-boundary-review-credentials", "credentials", "Credentials remain inaccessible."],
    ["final-boundary-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationFinalBoundarySafeReportSection[] {
  return [
    { section_id: "final-boundary-safe-report-boundary", section_kind: "boundary", safe_summary: "Runtime activation final boundary summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
    { section_id: "final-boundary-safe-report-review", section_kind: "review", safe_summary: "Runtime activation final-boundary review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
    { section_id: "final-boundary-safe-report-runtime", section_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
    { section_id: "final-boundary-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationFinalBoundary(rehearsalSafeReport: RuntimeActivationRehearsalSafeReport, rehearsalContract: RuntimeActivationRehearsalContract, options: { id?: string; created_at?: string; requestFutureFinalBoundaryReview?: boolean } = {}): RuntimeActivationFinalBoundary {
  const ready = rehearsalSafeReportReady(rehearsalSafeReport) && rehearsalContractReady(rehearsalContract);
  const requestReview = options.requestFutureFinalBoundaryReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation rehearsal safe report or contract was not ready for final boundary.", [...rehearsalSafeReport.validation.blocking_reasons, ...rehearsalContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_final_boundary_id: safe(options.id, "runtime-activation-final-boundary-001"),
    runtime_activation_rehearsal_safe_report_id: rehearsalSafeReport.runtime_activation_rehearsal_safe_report_id,
    runtime_activation_rehearsal_contract_id: rehearsalContract.runtime_activation_rehearsal_contract_id,
    render_plan_id: rehearsalSafeReport.render_plan_id,
    project_id: rehearsalSafeReport.project_id,
    platform: rehearsalSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_boundary_state: readyForNext ? "approved_for_future_final_boundary_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_rehearsal_safe_report_validated: true, runtime_activation_rehearsal_contract_validated: true },
    final_boundary_scope: scope(readyForNext),
    final_boundary_controls: { final_boundary_only: true, boundary_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_boundary_opened: false, real_upload_still_blocked: true },
    final_boundary_terms: boundaryTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationFinalBoundary", source_runtime_activation_rehearsal_safe_report_id: rehearsalSafeReport.runtime_activation_rehearsal_safe_report_id, source_render_plan_id: rehearsalSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationFinalBoundaryReview(finalBoundary: RuntimeActivationFinalBoundary, rehearsalSafeReport: RuntimeActivationRehearsalSafeReport, options: { id?: string; created_at?: string; requestFutureFinalBoundarySafeReport?: boolean } = {}): RuntimeActivationFinalBoundaryReview {
  const ready = finalBoundaryReady(finalBoundary) && rehearsalSafeReportReady(rehearsalSafeReport);
  const requestReport = options.requestFutureFinalBoundarySafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation final boundary or rehearsal safe report was not ready for final-boundary review.", [...finalBoundary.validation.blocking_reasons, ...rehearsalSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_final_boundary_review_id: safe(options.id, "runtime-activation-final-boundary-review-001"),
    runtime_activation_final_boundary_id: finalBoundary.runtime_activation_final_boundary_id,
    runtime_activation_rehearsal_safe_report_id: finalBoundary.runtime_activation_rehearsal_safe_report_id,
    render_plan_id: finalBoundary.render_plan_id,
    project_id: finalBoundary.project_id,
    platform: finalBoundary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_boundary_review_state: readyForNext ? "approved_for_future_final_boundary_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_final_boundary_validated: true, runtime_activation_rehearsal_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, final_boundary_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_boundary_opened: false, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationFinalBoundaryReview", source_runtime_activation_final_boundary_id: finalBoundary.runtime_activation_final_boundary_id, source_render_plan_id: finalBoundary.render_plan_id },
  };
}

export function createRuntimeActivationFinalBoundarySafeReport(review: RuntimeActivationFinalBoundaryReview, finalBoundary: RuntimeActivationFinalBoundary, options: { id?: string; created_at?: string; requestFutureRuntimeActivationCloseout?: boolean } = {}): RuntimeActivationFinalBoundarySafeReport {
  const ready = finalBoundaryReviewReady(review) && finalBoundaryReady(finalBoundary);
  const requestCloseout = options.requestFutureRuntimeActivationCloseout !== false;
  const complete = ready;
  const readyForNext = complete && requestCloseout;
  const reasons = blocking(ready, "Runtime activation final-boundary review or boundary was not ready for final-boundary safe report.", [...review.validation.blocking_reasons, ...finalBoundary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_final_boundary_safe_report_id: safe(options.id, "runtime-activation-final-boundary-safe-report-001"),
    runtime_activation_final_boundary_review_id: review.runtime_activation_final_boundary_review_id,
    runtime_activation_final_boundary_id: finalBoundary.runtime_activation_final_boundary_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_closeout" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_final_boundary_review_validated: true, runtime_activation_final_boundary_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, final_boundary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_boundary_opened: false, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationFinalBoundarySafeReport", source_runtime_activation_final_boundary_review_id: review.runtime_activation_final_boundary_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeActivationFinalBoundary(boundary: RuntimeActivationFinalBoundary, reason?: string): RuntimeActivationFinalBoundary {
  const warning = sanitizeSafeSummary(reason, "Runtime activation final boundary was revoked.");
  return { ...boundary, final_boundary_state: "revoked", final_boundary_scope: scope(false), validation: validation(false, false, boundary.validation.blocking_reasons, [...boundary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...boundary.provenance, generated_by: "revokeRuntimeActivationFinalBoundary" } };
}
export function revokeRuntimeActivationFinalBoundaryReview(review: RuntimeActivationFinalBoundaryReview, reason?: string): RuntimeActivationFinalBoundaryReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation final-boundary review was revoked.");
  return { ...review, final_boundary_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationFinalBoundaryReview" } };
}
export function revokeRuntimeActivationFinalBoundarySafeReport(report: RuntimeActivationFinalBoundarySafeReport, reason?: string): RuntimeActivationFinalBoundarySafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation final-boundary safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationFinalBoundarySafeReport" } };
}
