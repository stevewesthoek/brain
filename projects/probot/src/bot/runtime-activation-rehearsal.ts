import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationSimulationContract, RuntimeActivationSimulationSafeReport } from "./runtime-activation-simulation.js";

export type RuntimeActivationRehearsalContractState = "draft" | "created" | "approved_for_future_rehearsal_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationRehearsalReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_rehearsal_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationRehearsalSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_final_boundary" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationRehearsalCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationRehearsalTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  rehearsal_executed_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationRehearsalReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationRehearsalCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  rehearsal_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationRehearsalSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  rehearsal_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationRehearsalContract {
  schema_version: "1.0";
  runtime_activation_rehearsal_contract_id: string;
  runtime_activation_simulation_safe_report_id: string;
  runtime_activation_simulation_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  rehearsal_contract_state: RuntimeActivationRehearsalContractState;
  required_artifacts: { runtime_activation_simulation_safe_report_validated: true; runtime_activation_simulation_contract_validated: true };
  rehearsal_scope: ControlledRuntimeActivationScope;
  rehearsal_controls: {
    rehearsal_contract_only: true;
    rehearsal_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    rehearsal_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  rehearsal_terms: RuntimeActivationRehearsalTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationRehearsalContract" | "revokeRuntimeActivationRehearsalContract"; source_runtime_activation_simulation_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationRehearsalReview {
  schema_version: "1.0";
  runtime_activation_rehearsal_review_id: string;
  runtime_activation_rehearsal_contract_id: string;
  runtime_activation_simulation_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  rehearsal_review_state: RuntimeActivationRehearsalReviewState;
  required_artifacts: { runtime_activation_rehearsal_contract_validated: true; runtime_activation_simulation_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    rehearsal_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    rehearsal_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationRehearsalReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationRehearsalReview" | "revokeRuntimeActivationRehearsalReview"; source_runtime_activation_rehearsal_contract_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationRehearsalSafeReport {
  schema_version: "1.0";
  runtime_activation_rehearsal_safe_report_id: string;
  runtime_activation_rehearsal_review_id: string;
  runtime_activation_rehearsal_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationRehearsalSafeReportState;
  required_artifacts: { runtime_activation_rehearsal_review_validated: true; runtime_activation_rehearsal_contract_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    rehearsal_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    rehearsal_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationRehearsalSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationRehearsalSafeReport" | "revokeRuntimeActivationRehearsalSafeReport"; source_runtime_activation_rehearsal_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation rehearsal prerequisite was not validated.")))];
}

function simulationSafeReportReady(report: RuntimeActivationSimulationSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_rehearsal_contract" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.simulation_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.simulation_execution_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.simulation_executed_now && !section.ready_for_real_upload_now);
}
function simulationContractReady(contract: RuntimeActivationSimulationContract): boolean {
  return contract.simulation_contract_state === "approved_for_future_simulation_review" && contract.validation.complete && contract.validation.ready_for_next_phase && !contract.validation.ready_for_real_upload && contract.simulation_controls.simulation_contract_only && contract.simulation_controls.simulation_only && !contract.simulation_controls.contains_runtime_callable && !contract.simulation_controls.contains_raw_payload && !contract.simulation_controls.contains_raw_response && !contract.simulation_controls.contains_secret_material && !contract.simulation_controls.runtime_wiring_implemented && contract.simulation_controls.runtime_invocation_disabled && contract.simulation_controls.simulation_execution_disabled && contract.simulation_controls.real_upload_still_blocked && contract.simulation_terms.every((term) => !term.runtime_enabled_now && !term.simulation_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function rehearsalContractReady(contract: RuntimeActivationRehearsalContract): boolean {
  return contract.rehearsal_contract_state === "approved_for_future_rehearsal_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.rehearsal_controls.rehearsal_contract_only && contract.rehearsal_controls.rehearsal_only && !contract.rehearsal_controls.contains_runtime_callable && !contract.rehearsal_controls.contains_raw_payload && !contract.rehearsal_controls.contains_raw_response && !contract.rehearsal_controls.contains_secret_material && !contract.rehearsal_controls.runtime_wiring_implemented && contract.rehearsal_controls.runtime_invocation_disabled && contract.rehearsal_controls.rehearsal_execution_disabled && contract.rehearsal_controls.real_upload_still_blocked && contract.rehearsal_terms.length >= 4 && contract.rehearsal_terms.every((term) => !term.runtime_enabled_now && !term.rehearsal_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function rehearsalReviewReady(review: RuntimeActivationRehearsalReview): boolean {
  return review.rehearsal_review_state === "approved_for_future_rehearsal_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.rehearsal_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.rehearsal_execution_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.rehearsal_executed_now && !check.ready_for_real_upload_now);
}

function rehearsalTerms(): RuntimeActivationRehearsalTerm[] {
  return [
    { term_id: "rehearsal-contract-scope", term_kind: "scope", safe_summary: "Rehearsal contract scope only; no runtime enabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "rehearsal-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "rehearsal-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "rehearsal-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationRehearsalReviewCheck[] {
  const checks = [
    ["rehearsal-review-scope", "scope", "Rehearsal scope reviewed only."],
    ["rehearsal-review-terms", "terms", "Rehearsal terms reviewed only."],
    ["rehearsal-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["rehearsal-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationRehearsalSafeReportSection[] {
  return [
    { section_id: "rehearsal-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation rehearsal contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "rehearsal-safe-report-review", section_kind: "review", safe_summary: "Runtime activation rehearsal review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "rehearsal-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "rehearsal-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationRehearsalContract(simulationSafeReport: RuntimeActivationSimulationSafeReport, simulationContract: RuntimeActivationSimulationContract, options: { id?: string; created_at?: string; requestFutureRehearsalReview?: boolean } = {}): RuntimeActivationRehearsalContract {
  const ready = simulationSafeReportReady(simulationSafeReport) && simulationContractReady(simulationContract);
  const requestReview = options.requestFutureRehearsalReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation simulation safe report or contract was not ready for rehearsal contract.", [...simulationSafeReport.validation.blocking_reasons, ...simulationContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_rehearsal_contract_id: safe(options.id, "runtime-activation-rehearsal-contract-001"),
    runtime_activation_simulation_safe_report_id: simulationSafeReport.runtime_activation_simulation_safe_report_id,
    runtime_activation_simulation_contract_id: simulationContract.runtime_activation_simulation_contract_id,
    render_plan_id: simulationSafeReport.render_plan_id,
    project_id: simulationSafeReport.project_id,
    platform: simulationSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    rehearsal_contract_state: readyForNext ? "approved_for_future_rehearsal_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_simulation_safe_report_validated: true, runtime_activation_simulation_contract_validated: true },
    rehearsal_scope: scope(readyForNext),
    rehearsal_controls: { rehearsal_contract_only: true, rehearsal_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, rehearsal_execution_disabled: true, real_upload_still_blocked: true },
    rehearsal_terms: rehearsalTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationRehearsalContract", source_runtime_activation_simulation_safe_report_id: simulationSafeReport.runtime_activation_simulation_safe_report_id, source_render_plan_id: simulationSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationRehearsalReview(rehearsalContract: RuntimeActivationRehearsalContract, simulationSafeReport: RuntimeActivationSimulationSafeReport, options: { id?: string; created_at?: string; requestFutureRehearsalSafeReport?: boolean } = {}): RuntimeActivationRehearsalReview {
  const ready = rehearsalContractReady(rehearsalContract) && simulationSafeReportReady(simulationSafeReport);
  const requestReport = options.requestFutureRehearsalSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation rehearsal contract or simulation safe report was not ready for rehearsal review.", [...rehearsalContract.validation.blocking_reasons, ...simulationSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_rehearsal_review_id: safe(options.id, "runtime-activation-rehearsal-review-001"),
    runtime_activation_rehearsal_contract_id: rehearsalContract.runtime_activation_rehearsal_contract_id,
    runtime_activation_simulation_safe_report_id: rehearsalContract.runtime_activation_simulation_safe_report_id,
    render_plan_id: rehearsalContract.render_plan_id,
    project_id: rehearsalContract.project_id,
    platform: rehearsalContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    rehearsal_review_state: readyForNext ? "approved_for_future_rehearsal_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_rehearsal_contract_validated: true, runtime_activation_simulation_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, rehearsal_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, rehearsal_execution_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationRehearsalReview", source_runtime_activation_rehearsal_contract_id: rehearsalContract.runtime_activation_rehearsal_contract_id, source_render_plan_id: rehearsalContract.render_plan_id },
  };
}

export function createRuntimeActivationRehearsalSafeReport(rehearsalReview: RuntimeActivationRehearsalReview, rehearsalContract: RuntimeActivationRehearsalContract, options: { id?: string; created_at?: string; requestFutureRuntimeActivationFinalBoundary?: boolean } = {}): RuntimeActivationRehearsalSafeReport {
  const ready = rehearsalReviewReady(rehearsalReview) && rehearsalContractReady(rehearsalContract);
  const requestFinalBoundary = options.requestFutureRuntimeActivationFinalBoundary !== false;
  const complete = ready;
  const readyForNext = complete && requestFinalBoundary;
  const reasons = blocking(ready, "Runtime activation rehearsal review or contract was not ready for rehearsal safe report.", [...rehearsalReview.validation.blocking_reasons, ...rehearsalContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_rehearsal_safe_report_id: safe(options.id, "runtime-activation-rehearsal-safe-report-001"),
    runtime_activation_rehearsal_review_id: rehearsalReview.runtime_activation_rehearsal_review_id,
    runtime_activation_rehearsal_contract_id: rehearsalContract.runtime_activation_rehearsal_contract_id,
    render_plan_id: rehearsalReview.render_plan_id,
    project_id: rehearsalReview.project_id,
    platform: rehearsalReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_final_boundary" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_rehearsal_review_validated: true, runtime_activation_rehearsal_contract_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, rehearsal_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, rehearsal_execution_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationRehearsalSafeReport", source_runtime_activation_rehearsal_review_id: rehearsalReview.runtime_activation_rehearsal_review_id, source_render_plan_id: rehearsalReview.render_plan_id },
  };
}

export function revokeRuntimeActivationRehearsalContract(contract: RuntimeActivationRehearsalContract, reason?: string): RuntimeActivationRehearsalContract {
  const warning = sanitizeSafeSummary(reason, "Runtime activation rehearsal contract was revoked.");
  return { ...contract, rehearsal_contract_state: "revoked", rehearsal_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeActivationRehearsalContract" } };
}
export function revokeRuntimeActivationRehearsalReview(review: RuntimeActivationRehearsalReview, reason?: string): RuntimeActivationRehearsalReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation rehearsal review was revoked.");
  return { ...review, rehearsal_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationRehearsalReview" } };
}
export function revokeRuntimeActivationRehearsalSafeReport(report: RuntimeActivationRehearsalSafeReport, reason?: string): RuntimeActivationRehearsalSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation rehearsal safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationRehearsalSafeReport" } };
}
