import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationContract, RuntimeActivationContractSafeReport } from "./runtime-activation-contract.js";

export type RuntimeActivationReadinessContractState = "draft" | "created" | "approved_for_future_readiness_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationReadinessReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_readiness_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationReadinessSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_dry_run_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationReadinessCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationReadinessTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationReadinessReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationReadinessCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationReadinessSafeReportSection {
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

export interface RuntimeActivationReadinessContract {
  schema_version: "1.0";
  runtime_activation_readiness_contract_id: string;
  runtime_activation_contract_safe_report_id: string;
  runtime_activation_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  readiness_contract_state: RuntimeActivationReadinessContractState;
  required_artifacts: { runtime_activation_contract_safe_report_validated: true; runtime_activation_contract_validated: true };
  readiness_scope: ControlledRuntimeActivationScope;
  readiness_controls: {
    readiness_contract_only: true;
    readiness_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  readiness_terms: RuntimeActivationReadinessTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationReadinessContract" | "revokeRuntimeActivationReadinessContract"; source_runtime_activation_contract_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationReadinessReview {
  schema_version: "1.0";
  runtime_activation_readiness_review_id: string;
  runtime_activation_readiness_contract_id: string;
  runtime_activation_contract_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  readiness_review_state: RuntimeActivationReadinessReviewState;
  required_artifacts: { runtime_activation_readiness_contract_validated: true; runtime_activation_contract_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    readiness_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationReadinessReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationReadinessReview" | "revokeRuntimeActivationReadinessReview"; source_runtime_activation_readiness_contract_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationReadinessSafeReport {
  schema_version: "1.0";
  runtime_activation_readiness_safe_report_id: string;
  runtime_activation_readiness_review_id: string;
  runtime_activation_readiness_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationReadinessSafeReportState;
  required_artifacts: { runtime_activation_readiness_review_validated: true; runtime_activation_readiness_contract_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    readiness_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationReadinessSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationReadinessSafeReport" | "revokeRuntimeActivationReadinessSafeReport"; source_runtime_activation_readiness_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation readiness prerequisite was not validated.")))];
}

function contractSafeReportReady(report: RuntimeActivationContractSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_readiness_contract" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.activation_contract_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.ready_for_real_upload_now);
}
function contractReady(contract: RuntimeActivationContract): boolean {
  return contract.contract_state === "approved_for_future_contract_review" && contract.validation.complete && contract.validation.ready_for_next_phase && !contract.validation.ready_for_real_upload && contract.contract_controls.contract_only && contract.contract_controls.activation_contract_only && !contract.contract_controls.contains_runtime_callable && !contract.contract_controls.contains_raw_payload && !contract.contract_controls.contains_raw_response && !contract.contract_controls.contains_secret_material && !contract.contract_controls.runtime_wiring_implemented && contract.contract_controls.runtime_invocation_disabled && contract.contract_controls.real_upload_still_blocked && contract.contract_terms.every((term) => !term.runtime_enabled_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function readinessContractReady(contract: RuntimeActivationReadinessContract): boolean {
  return contract.readiness_contract_state === "approved_for_future_readiness_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.readiness_controls.readiness_contract_only && contract.readiness_controls.readiness_only && !contract.readiness_controls.contains_runtime_callable && !contract.readiness_controls.contains_raw_payload && !contract.readiness_controls.contains_raw_response && !contract.readiness_controls.contains_secret_material && !contract.readiness_controls.runtime_wiring_implemented && contract.readiness_controls.runtime_invocation_disabled && contract.readiness_controls.real_upload_still_blocked && contract.readiness_terms.length >= 4 && contract.readiness_terms.every((term) => !term.runtime_enabled_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function readinessReviewReady(review: RuntimeActivationReadinessReview): boolean {
  return review.readiness_review_state === "approved_for_future_readiness_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.readiness_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.ready_for_real_upload_now);
}

function readinessTerms(): RuntimeActivationReadinessTerm[] {
  return [
    { term_id: "readiness-contract-scope", term_kind: "scope", safe_summary: "Readiness contract scope only; no runtime enabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "readiness-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "readiness-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "readiness-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationReadinessReviewCheck[] {
  const checks = [
    ["readiness-review-scope", "scope", "Readiness scope reviewed only."],
    ["readiness-review-terms", "terms", "Readiness terms reviewed only."],
    ["readiness-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["readiness-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationReadinessSafeReportSection[] {
  return [
    { section_id: "readiness-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation readiness contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "readiness-safe-report-review", section_kind: "review", safe_summary: "Runtime activation readiness review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "readiness-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "readiness-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationReadinessContract(contractSafeReport: RuntimeActivationContractSafeReport, contract: RuntimeActivationContract, options: { id?: string; created_at?: string; requestFutureReadinessReview?: boolean } = {}): RuntimeActivationReadinessContract {
  const ready = contractSafeReportReady(contractSafeReport) && contractReady(contract);
  const requestReview = options.requestFutureReadinessReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation contract safe report or contract was not ready for readiness contract.", [...contractSafeReport.validation.blocking_reasons, ...contract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_readiness_contract_id: safe(options.id, "runtime-activation-readiness-contract-001"),
    runtime_activation_contract_safe_report_id: contractSafeReport.runtime_activation_contract_safe_report_id,
    runtime_activation_contract_id: contract.runtime_activation_contract_id,
    render_plan_id: contractSafeReport.render_plan_id,
    project_id: contractSafeReport.project_id,
    platform: contractSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    readiness_contract_state: readyForNext ? "approved_for_future_readiness_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_contract_safe_report_validated: true, runtime_activation_contract_validated: true },
    readiness_scope: scope(readyForNext),
    readiness_controls: { readiness_contract_only: true, readiness_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    readiness_terms: readinessTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationReadinessContract", source_runtime_activation_contract_safe_report_id: contractSafeReport.runtime_activation_contract_safe_report_id, source_render_plan_id: contractSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationReadinessReview(readinessContract: RuntimeActivationReadinessContract, contractSafeReport: RuntimeActivationContractSafeReport, options: { id?: string; created_at?: string; requestFutureReadinessSafeReport?: boolean } = {}): RuntimeActivationReadinessReview {
  const ready = readinessContractReady(readinessContract) && contractSafeReportReady(contractSafeReport);
  const requestReport = options.requestFutureReadinessSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation readiness contract or contract safe report was not ready for readiness review.", [...readinessContract.validation.blocking_reasons, ...contractSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_readiness_review_id: safe(options.id, "runtime-activation-readiness-review-001"),
    runtime_activation_readiness_contract_id: readinessContract.runtime_activation_readiness_contract_id,
    runtime_activation_contract_safe_report_id: readinessContract.runtime_activation_contract_safe_report_id,
    render_plan_id: readinessContract.render_plan_id,
    project_id: readinessContract.project_id,
    platform: readinessContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    readiness_review_state: readyForNext ? "approved_for_future_readiness_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_readiness_contract_validated: true, runtime_activation_contract_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, readiness_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationReadinessReview", source_runtime_activation_readiness_contract_id: readinessContract.runtime_activation_readiness_contract_id, source_render_plan_id: readinessContract.render_plan_id },
  };
}

export function createRuntimeActivationReadinessSafeReport(readinessReview: RuntimeActivationReadinessReview, readinessContract: RuntimeActivationReadinessContract, options: { id?: string; created_at?: string; requestFutureRuntimeActivationDryRunContract?: boolean } = {}): RuntimeActivationReadinessSafeReport {
  const ready = readinessReviewReady(readinessReview) && readinessContractReady(readinessContract);
  const requestDryRun = options.requestFutureRuntimeActivationDryRunContract !== false;
  const complete = ready;
  const readyForNext = complete && requestDryRun;
  const reasons = blocking(ready, "Runtime activation readiness review or contract was not ready for readiness safe report.", [...readinessReview.validation.blocking_reasons, ...readinessContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_readiness_safe_report_id: safe(options.id, "runtime-activation-readiness-safe-report-001"),
    runtime_activation_readiness_review_id: readinessReview.runtime_activation_readiness_review_id,
    runtime_activation_readiness_contract_id: readinessContract.runtime_activation_readiness_contract_id,
    render_plan_id: readinessReview.render_plan_id,
    project_id: readinessReview.project_id,
    platform: readinessReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_dry_run_contract" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_readiness_review_validated: true, runtime_activation_readiness_contract_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, readiness_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationReadinessSafeReport", source_runtime_activation_readiness_review_id: readinessReview.runtime_activation_readiness_review_id, source_render_plan_id: readinessReview.render_plan_id },
  };
}

export function revokeRuntimeActivationReadinessContract(contract: RuntimeActivationReadinessContract, reason?: string): RuntimeActivationReadinessContract {
  const warning = sanitizeSafeSummary(reason, "Runtime activation readiness contract was revoked.");
  return { ...contract, readiness_contract_state: "revoked", readiness_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeActivationReadinessContract" } };
}
export function revokeRuntimeActivationReadinessReview(review: RuntimeActivationReadinessReview, reason?: string): RuntimeActivationReadinessReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation readiness review was revoked.");
  return { ...review, readiness_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationReadinessReview" } };
}
export function revokeRuntimeActivationReadinessSafeReport(report: RuntimeActivationReadinessSafeReport, reason?: string): RuntimeActivationReadinessSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation readiness safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationReadinessSafeReport" } };
}
