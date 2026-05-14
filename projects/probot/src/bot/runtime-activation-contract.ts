import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { ExplicitRuntimeActivationDesignBoundary, ExplicitRuntimeActivationDesignSafeReport } from "./explicit-runtime-activation-design.js";

export type RuntimeActivationContractState = "draft" | "created" | "approved_for_future_contract_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationContractReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_contract_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationContractSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_readiness_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationContractCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationContractTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationContractReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationContractCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationContractSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationContract {
  schema_version: "1.0";
  runtime_activation_contract_id: string;
  explicit_runtime_activation_design_safe_report_id: string;
  explicit_runtime_activation_design_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  contract_state: RuntimeActivationContractState;
  required_artifacts: { explicit_runtime_activation_design_safe_report_validated: true; explicit_runtime_activation_design_boundary_validated: true };
  contract_scope: ControlledRuntimeActivationScope;
  contract_controls: {
    contract_only: true;
    activation_contract_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  contract_terms: RuntimeActivationContractTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationContract" | "revokeRuntimeActivationContract"; source_explicit_runtime_activation_design_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationContractReview {
  schema_version: "1.0";
  runtime_activation_contract_review_id: string;
  runtime_activation_contract_id: string;
  explicit_runtime_activation_design_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  contract_review_state: RuntimeActivationContractReviewState;
  required_artifacts: { runtime_activation_contract_validated: true; explicit_runtime_activation_design_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    contract_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationContractReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationContractReview" | "revokeRuntimeActivationContractReview"; source_runtime_activation_contract_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationContractSafeReport {
  schema_version: "1.0";
  runtime_activation_contract_safe_report_id: string;
  runtime_activation_contract_review_id: string;
  runtime_activation_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationContractSafeReportState;
  required_artifacts: { runtime_activation_contract_review_validated: true; runtime_activation_contract_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    activation_contract_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationContractSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationContractSafeReport" | "revokeRuntimeActivationContractSafeReport"; source_runtime_activation_contract_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation contract prerequisite was not validated.")))];
}

function designSafeReportReady(report: ExplicitRuntimeActivationDesignSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_contract" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.activation_design_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.ready_for_real_upload_now);
}
function designBoundaryReady(boundary: ExplicitRuntimeActivationDesignBoundary): boolean {
  return boundary.design_boundary_state === "approved_for_future_design_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && !boundary.validation.ready_for_real_upload && boundary.design_controls.design_only && boundary.design_controls.activation_boundary_only && !boundary.design_controls.contains_runtime_callable && !boundary.design_controls.contains_raw_payload && !boundary.design_controls.contains_raw_response && !boundary.design_controls.contains_secret_material && !boundary.design_controls.runtime_wiring_implemented && boundary.design_controls.runtime_invocation_disabled && boundary.design_controls.real_upload_still_blocked && boundary.design_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_secret_material && !section.runtime_enabled_now && !section.ready_for_real_upload_now);
}
function contractReady(contract: RuntimeActivationContract): boolean {
  return contract.contract_state === "approved_for_future_contract_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.contract_controls.contract_only && contract.contract_controls.activation_contract_only && !contract.contract_controls.contains_runtime_callable && !contract.contract_controls.contains_raw_payload && !contract.contract_controls.contains_raw_response && !contract.contract_controls.contains_secret_material && !contract.contract_controls.runtime_wiring_implemented && contract.contract_controls.runtime_invocation_disabled && contract.contract_controls.real_upload_still_blocked && contract.contract_terms.length >= 4 && contract.contract_terms.every((term) => !term.runtime_enabled_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function reviewReady(review: RuntimeActivationContractReview): boolean {
  return review.contract_review_state === "approved_for_future_contract_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.contract_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.ready_for_real_upload_now);
}

function contractTerms(): RuntimeActivationContractTerm[] {
  return [
    { term_id: "contract-scope", term_kind: "scope", safe_summary: "Contract scope only; no runtime enabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationContractReviewCheck[] {
  const checks = [
    ["contract-review-scope", "scope", "Contract scope reviewed only."],
    ["contract-review-terms", "terms", "Contract terms reviewed only."],
    ["contract-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["contract-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationContractSafeReportSection[] {
  return [
    { section_id: "contract-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "contract-safe-report-review", section_kind: "review", safe_summary: "Runtime activation contract review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "contract-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "contract-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationContract(designSafeReport: ExplicitRuntimeActivationDesignSafeReport, designBoundary: ExplicitRuntimeActivationDesignBoundary, options: { id?: string; created_at?: string; requestFutureContractReview?: boolean } = {}): RuntimeActivationContract {
  const ready = designSafeReportReady(designSafeReport) && designBoundaryReady(designBoundary);
  const requestReview = options.requestFutureContractReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Explicit runtime activation design safe report or boundary was not ready for runtime activation contract.", [...designSafeReport.validation.blocking_reasons, ...designBoundary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_contract_id: safe(options.id, "runtime-activation-contract-001"),
    explicit_runtime_activation_design_safe_report_id: designSafeReport.explicit_runtime_activation_design_safe_report_id,
    explicit_runtime_activation_design_boundary_id: designBoundary.explicit_runtime_activation_design_boundary_id,
    render_plan_id: designSafeReport.render_plan_id,
    project_id: designSafeReport.project_id,
    platform: designSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    contract_state: readyForNext ? "approved_for_future_contract_review" : ready ? "created" : "blocked",
    required_artifacts: { explicit_runtime_activation_design_safe_report_validated: true, explicit_runtime_activation_design_boundary_validated: true },
    contract_scope: scope(readyForNext),
    contract_controls: { contract_only: true, activation_contract_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    contract_terms: contractTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationContract", source_explicit_runtime_activation_design_safe_report_id: designSafeReport.explicit_runtime_activation_design_safe_report_id, source_render_plan_id: designSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationContractReview(contract: RuntimeActivationContract, designSafeReport: ExplicitRuntimeActivationDesignSafeReport, options: { id?: string; created_at?: string; requestFutureContractSafeReport?: boolean } = {}): RuntimeActivationContractReview {
  const ready = contractReady(contract) && designSafeReportReady(designSafeReport);
  const requestReport = options.requestFutureContractSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation contract or explicit runtime activation design safe report was not ready for contract review.", [...contract.validation.blocking_reasons, ...designSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_contract_review_id: safe(options.id, "runtime-activation-contract-review-001"),
    runtime_activation_contract_id: contract.runtime_activation_contract_id,
    explicit_runtime_activation_design_safe_report_id: contract.explicit_runtime_activation_design_safe_report_id,
    render_plan_id: contract.render_plan_id,
    project_id: contract.project_id,
    platform: contract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    contract_review_state: readyForNext ? "approved_for_future_contract_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_contract_validated: true, explicit_runtime_activation_design_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, contract_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationContractReview", source_runtime_activation_contract_id: contract.runtime_activation_contract_id, source_render_plan_id: contract.render_plan_id },
  };
}

export function createRuntimeActivationContractSafeReport(review: RuntimeActivationContractReview, contract: RuntimeActivationContract, options: { id?: string; created_at?: string; requestFutureRuntimeActivationReadinessContract?: boolean } = {}): RuntimeActivationContractSafeReport {
  const ready = reviewReady(review) && contractReady(contract);
  const requestReadiness = options.requestFutureRuntimeActivationReadinessContract !== false;
  const complete = ready;
  const readyForNext = complete && requestReadiness;
  const reasons = blocking(ready, "Runtime activation contract review or contract was not ready for contract safe report.", [...review.validation.blocking_reasons, ...contract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_contract_safe_report_id: safe(options.id, "runtime-activation-contract-safe-report-001"),
    runtime_activation_contract_review_id: review.runtime_activation_contract_review_id,
    runtime_activation_contract_id: contract.runtime_activation_contract_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_readiness_contract" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_contract_review_validated: true, runtime_activation_contract_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, activation_contract_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationContractSafeReport", source_runtime_activation_contract_review_id: review.runtime_activation_contract_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeActivationContract(contract: RuntimeActivationContract, reason?: string): RuntimeActivationContract {
  const warning = sanitizeSafeSummary(reason, "Runtime activation contract was revoked.");
  return { ...contract, contract_state: "revoked", contract_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeActivationContract" } };
}
export function revokeRuntimeActivationContractReview(review: RuntimeActivationContractReview, reason?: string): RuntimeActivationContractReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation contract review was revoked.");
  return { ...review, contract_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationContractReview" } };
}
export function revokeRuntimeActivationContractSafeReport(report: RuntimeActivationContractSafeReport, reason?: string): RuntimeActivationContractSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation contract safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationContractSafeReport" } };
}
