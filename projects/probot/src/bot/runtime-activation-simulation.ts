import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationDryRunDesign, RuntimeActivationDryRunDesignSafeReport } from "./runtime-activation-dry-run-design.js";

export type RuntimeActivationSimulationContractState = "draft" | "created" | "approved_for_future_simulation_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSimulationReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_simulation_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSimulationSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_rehearsal_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSimulationCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationSimulationTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  simulation_executed_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationSimulationReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationSimulationCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  simulation_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationSimulationSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  simulation_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationSimulationContract {
  schema_version: "1.0";
  runtime_activation_simulation_contract_id: string;
  runtime_activation_dry_run_design_safe_report_id: string;
  runtime_activation_dry_run_design_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  simulation_contract_state: RuntimeActivationSimulationContractState;
  required_artifacts: { runtime_activation_dry_run_design_safe_report_validated: true; runtime_activation_dry_run_design_validated: true };
  simulation_scope: ControlledRuntimeActivationScope;
  simulation_controls: {
    simulation_contract_only: true;
    simulation_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    simulation_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  simulation_terms: RuntimeActivationSimulationTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSimulationContract" | "revokeRuntimeActivationSimulationContract"; source_runtime_activation_dry_run_design_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationSimulationReview {
  schema_version: "1.0";
  runtime_activation_simulation_review_id: string;
  runtime_activation_simulation_contract_id: string;
  runtime_activation_dry_run_design_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  simulation_review_state: RuntimeActivationSimulationReviewState;
  required_artifacts: { runtime_activation_simulation_contract_validated: true; runtime_activation_dry_run_design_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    simulation_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    simulation_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationSimulationReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSimulationReview" | "revokeRuntimeActivationSimulationReview"; source_runtime_activation_simulation_contract_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationSimulationSafeReport {
  schema_version: "1.0";
  runtime_activation_simulation_safe_report_id: string;
  runtime_activation_simulation_review_id: string;
  runtime_activation_simulation_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationSimulationSafeReportState;
  required_artifacts: { runtime_activation_simulation_review_validated: true; runtime_activation_simulation_contract_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    simulation_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    simulation_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationSimulationSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSimulationSafeReport" | "revokeRuntimeActivationSimulationSafeReport"; source_runtime_activation_simulation_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation simulation prerequisite was not validated.")))];
}

function dryRunDesignSafeReportReady(report: RuntimeActivationDryRunDesignSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_simulation_contract" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.dry_run_design_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.dry_run_execution_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.dry_run_executed_now && !section.ready_for_real_upload_now);
}
function dryRunDesignReady(design: RuntimeActivationDryRunDesign): boolean {
  return design.dry_run_design_state === "approved_for_future_dry_run_design_review" && design.validation.complete && design.validation.ready_for_next_phase && !design.validation.ready_for_real_upload && design.design_controls.design_only && design.design_controls.dry_run_design_only && !design.design_controls.contains_runtime_callable && !design.design_controls.contains_raw_payload && !design.design_controls.contains_raw_response && !design.design_controls.contains_secret_material && !design.design_controls.runtime_wiring_implemented && design.design_controls.runtime_invocation_disabled && design.design_controls.dry_run_execution_disabled && design.design_controls.real_upload_still_blocked && design.design_sections.every((section) => !section.runtime_enabled_now && !section.dry_run_executed_now && !section.ready_for_real_upload_now && !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_secret_material);
}
function simulationContractReady(contract: RuntimeActivationSimulationContract): boolean {
  return contract.simulation_contract_state === "approved_for_future_simulation_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.simulation_controls.simulation_contract_only && contract.simulation_controls.simulation_only && !contract.simulation_controls.contains_runtime_callable && !contract.simulation_controls.contains_raw_payload && !contract.simulation_controls.contains_raw_response && !contract.simulation_controls.contains_secret_material && !contract.simulation_controls.runtime_wiring_implemented && contract.simulation_controls.runtime_invocation_disabled && contract.simulation_controls.simulation_execution_disabled && contract.simulation_controls.real_upload_still_blocked && contract.simulation_terms.length >= 4 && contract.simulation_terms.every((term) => !term.runtime_enabled_now && !term.simulation_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function simulationReviewReady(review: RuntimeActivationSimulationReview): boolean {
  return review.simulation_review_state === "approved_for_future_simulation_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.simulation_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.simulation_execution_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.simulation_executed_now && !check.ready_for_real_upload_now);
}

function simulationTerms(): RuntimeActivationSimulationTerm[] {
  return [
    { term_id: "simulation-contract-scope", term_kind: "scope", safe_summary: "Simulation contract scope only; no runtime enabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "simulation-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "simulation-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "simulation-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationSimulationReviewCheck[] {
  const checks = [
    ["simulation-review-scope", "scope", "Simulation scope reviewed only."],
    ["simulation-review-terms", "terms", "Simulation terms reviewed only."],
    ["simulation-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["simulation-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationSimulationSafeReportSection[] {
  return [
    { section_id: "simulation-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation simulation contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "simulation-safe-report-review", section_kind: "review", safe_summary: "Runtime activation simulation review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "simulation-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "simulation-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationSimulationContract(dryRunDesignSafeReport: RuntimeActivationDryRunDesignSafeReport, dryRunDesign: RuntimeActivationDryRunDesign, options: { id?: string; created_at?: string; requestFutureSimulationReview?: boolean } = {}): RuntimeActivationSimulationContract {
  const ready = dryRunDesignSafeReportReady(dryRunDesignSafeReport) && dryRunDesignReady(dryRunDesign);
  const requestReview = options.requestFutureSimulationReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation dry-run design safe report or design was not ready for simulation contract.", [...dryRunDesignSafeReport.validation.blocking_reasons, ...dryRunDesign.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_simulation_contract_id: safe(options.id, "runtime-activation-simulation-contract-001"),
    runtime_activation_dry_run_design_safe_report_id: dryRunDesignSafeReport.runtime_activation_dry_run_design_safe_report_id,
    runtime_activation_dry_run_design_id: dryRunDesign.runtime_activation_dry_run_design_id,
    render_plan_id: dryRunDesignSafeReport.render_plan_id,
    project_id: dryRunDesignSafeReport.project_id,
    platform: dryRunDesignSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    simulation_contract_state: readyForNext ? "approved_for_future_simulation_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_dry_run_design_safe_report_validated: true, runtime_activation_dry_run_design_validated: true },
    simulation_scope: scope(readyForNext),
    simulation_controls: { simulation_contract_only: true, simulation_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, simulation_execution_disabled: true, real_upload_still_blocked: true },
    simulation_terms: simulationTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationSimulationContract", source_runtime_activation_dry_run_design_safe_report_id: dryRunDesignSafeReport.runtime_activation_dry_run_design_safe_report_id, source_render_plan_id: dryRunDesignSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationSimulationReview(simulationContract: RuntimeActivationSimulationContract, dryRunDesignSafeReport: RuntimeActivationDryRunDesignSafeReport, options: { id?: string; created_at?: string; requestFutureSimulationSafeReport?: boolean } = {}): RuntimeActivationSimulationReview {
  const ready = simulationContractReady(simulationContract) && dryRunDesignSafeReportReady(dryRunDesignSafeReport);
  const requestReport = options.requestFutureSimulationSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation simulation contract or dry-run design safe report was not ready for simulation review.", [...simulationContract.validation.blocking_reasons, ...dryRunDesignSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_simulation_review_id: safe(options.id, "runtime-activation-simulation-review-001"),
    runtime_activation_simulation_contract_id: simulationContract.runtime_activation_simulation_contract_id,
    runtime_activation_dry_run_design_safe_report_id: simulationContract.runtime_activation_dry_run_design_safe_report_id,
    render_plan_id: simulationContract.render_plan_id,
    project_id: simulationContract.project_id,
    platform: simulationContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    simulation_review_state: readyForNext ? "approved_for_future_simulation_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_simulation_contract_validated: true, runtime_activation_dry_run_design_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, simulation_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, simulation_execution_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationSimulationReview", source_runtime_activation_simulation_contract_id: simulationContract.runtime_activation_simulation_contract_id, source_render_plan_id: simulationContract.render_plan_id },
  };
}

export function createRuntimeActivationSimulationSafeReport(simulationReview: RuntimeActivationSimulationReview, simulationContract: RuntimeActivationSimulationContract, options: { id?: string; created_at?: string; requestFutureRuntimeActivationRehearsalContract?: boolean } = {}): RuntimeActivationSimulationSafeReport {
  const ready = simulationReviewReady(simulationReview) && simulationContractReady(simulationContract);
  const requestRehearsal = options.requestFutureRuntimeActivationRehearsalContract !== false;
  const complete = ready;
  const readyForNext = complete && requestRehearsal;
  const reasons = blocking(ready, "Runtime activation simulation review or contract was not ready for simulation safe report.", [...simulationReview.validation.blocking_reasons, ...simulationContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_simulation_safe_report_id: safe(options.id, "runtime-activation-simulation-safe-report-001"),
    runtime_activation_simulation_review_id: simulationReview.runtime_activation_simulation_review_id,
    runtime_activation_simulation_contract_id: simulationContract.runtime_activation_simulation_contract_id,
    render_plan_id: simulationReview.render_plan_id,
    project_id: simulationReview.project_id,
    platform: simulationReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_rehearsal_contract" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_simulation_review_validated: true, runtime_activation_simulation_contract_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, simulation_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, simulation_execution_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationSimulationSafeReport", source_runtime_activation_simulation_review_id: simulationReview.runtime_activation_simulation_review_id, source_render_plan_id: simulationReview.render_plan_id },
  };
}

export function revokeRuntimeActivationSimulationContract(contract: RuntimeActivationSimulationContract, reason?: string): RuntimeActivationSimulationContract {
  const warning = sanitizeSafeSummary(reason, "Runtime activation simulation contract was revoked.");
  return { ...contract, simulation_contract_state: "revoked", simulation_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeActivationSimulationContract" } };
}
export function revokeRuntimeActivationSimulationReview(review: RuntimeActivationSimulationReview, reason?: string): RuntimeActivationSimulationReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation simulation review was revoked.");
  return { ...review, simulation_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationSimulationReview" } };
}
export function revokeRuntimeActivationSimulationSafeReport(report: RuntimeActivationSimulationSafeReport, reason?: string): RuntimeActivationSimulationSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation simulation safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationSimulationSafeReport" } };
}
