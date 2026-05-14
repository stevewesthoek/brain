import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationReadinessContract, RuntimeActivationReadinessSafeReport } from "./runtime-activation-readiness.js";

export type RuntimeActivationDryRunContractState = "draft" | "created" | "approved_for_future_dry_run_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_dry_run_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_dry_run_design" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationDryRunTerm {
  term_id: string;
  term_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  dry_run_executed_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationDryRunReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationDryRunCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  dry_run_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationDryRunSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  dry_run_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationDryRunContract {
  schema_version: "1.0";
  runtime_activation_dry_run_contract_id: string;
  runtime_activation_readiness_safe_report_id: string;
  runtime_activation_readiness_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_contract_state: RuntimeActivationDryRunContractState;
  required_artifacts: { runtime_activation_readiness_safe_report_validated: true; runtime_activation_readiness_contract_validated: true };
  dry_run_scope: ControlledRuntimeActivationScope;
  dry_run_controls: {
    dry_run_contract_only: true;
    dry_run_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  dry_run_terms: RuntimeActivationDryRunTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunContract" | "revokeRuntimeActivationDryRunContract"; source_runtime_activation_readiness_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationDryRunReview {
  schema_version: "1.0";
  runtime_activation_dry_run_review_id: string;
  runtime_activation_dry_run_contract_id: string;
  runtime_activation_readiness_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_review_state: RuntimeActivationDryRunReviewState;
  required_artifacts: { runtime_activation_dry_run_contract_validated: true; runtime_activation_readiness_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    dry_run_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationDryRunReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunReview" | "revokeRuntimeActivationDryRunReview"; source_runtime_activation_dry_run_contract_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationDryRunSafeReport {
  schema_version: "1.0";
  runtime_activation_dry_run_safe_report_id: string;
  runtime_activation_dry_run_review_id: string;
  runtime_activation_dry_run_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationDryRunSafeReportState;
  required_artifacts: { runtime_activation_dry_run_review_validated: true; runtime_activation_dry_run_contract_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    dry_run_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationDryRunSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunSafeReport" | "revokeRuntimeActivationDryRunSafeReport"; source_runtime_activation_dry_run_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation dry-run prerequisite was not validated.")))];
}

function readinessSafeReportReady(report: RuntimeActivationReadinessSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_dry_run_contract" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.readiness_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.ready_for_real_upload_now);
}
function readinessContractReady(contract: RuntimeActivationReadinessContract): boolean {
  return contract.readiness_contract_state === "approved_for_future_readiness_review" && contract.validation.complete && contract.validation.ready_for_next_phase && !contract.validation.ready_for_real_upload && contract.readiness_controls.readiness_contract_only && contract.readiness_controls.readiness_only && !contract.readiness_controls.contains_runtime_callable && !contract.readiness_controls.contains_raw_payload && !contract.readiness_controls.contains_raw_response && !contract.readiness_controls.contains_secret_material && !contract.readiness_controls.runtime_wiring_implemented && contract.readiness_controls.runtime_invocation_disabled && contract.readiness_controls.real_upload_still_blocked && contract.readiness_terms.every((term) => !term.runtime_enabled_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function dryRunContractReady(contract: RuntimeActivationDryRunContract): boolean {
  return contract.dry_run_contract_state === "approved_for_future_dry_run_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.dry_run_controls.dry_run_contract_only && contract.dry_run_controls.dry_run_only && !contract.dry_run_controls.contains_runtime_callable && !contract.dry_run_controls.contains_raw_payload && !contract.dry_run_controls.contains_raw_response && !contract.dry_run_controls.contains_secret_material && !contract.dry_run_controls.runtime_wiring_implemented && contract.dry_run_controls.runtime_invocation_disabled && contract.dry_run_controls.real_upload_still_blocked && contract.dry_run_terms.length >= 4 && contract.dry_run_terms.every((term) => !term.runtime_enabled_now && !term.dry_run_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function dryRunReviewReady(review: RuntimeActivationDryRunReview): boolean {
  return review.dry_run_review_state === "approved_for_future_dry_run_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.dry_run_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.dry_run_executed_now && !check.ready_for_real_upload_now);
}

function dryRunTerms(): RuntimeActivationDryRunTerm[] {
  return [
    { term_id: "dry-run-contract-scope", term_kind: "scope", safe_summary: "Dry-run contract scope only; no runtime enabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "dry-run-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "dry-run-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { term_id: "dry-run-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationDryRunReviewCheck[] {
  const checks = [
    ["dry-run-review-scope", "scope", "Dry-run scope reviewed only."],
    ["dry-run-review-terms", "terms", "Dry-run terms reviewed only."],
    ["dry-run-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["dry-run-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationDryRunSafeReportSection[] {
  return [
    { section_id: "dry-run-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation dry-run contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-safe-report-review", section_kind: "review", safe_summary: "Runtime activation dry-run review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationDryRunContract(readinessSafeReport: RuntimeActivationReadinessSafeReport, readinessContract: RuntimeActivationReadinessContract, options: { id?: string; created_at?: string; requestFutureDryRunReview?: boolean } = {}): RuntimeActivationDryRunContract {
  const ready = readinessSafeReportReady(readinessSafeReport) && readinessContractReady(readinessContract);
  const requestReview = options.requestFutureDryRunReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation readiness safe report or contract was not ready for dry-run contract.", [...readinessSafeReport.validation.blocking_reasons, ...readinessContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_contract_id: safe(options.id, "runtime-activation-dry-run-contract-001"),
    runtime_activation_readiness_safe_report_id: readinessSafeReport.runtime_activation_readiness_safe_report_id,
    runtime_activation_readiness_contract_id: readinessContract.runtime_activation_readiness_contract_id,
    render_plan_id: readinessSafeReport.render_plan_id,
    project_id: readinessSafeReport.project_id,
    platform: readinessSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_contract_state: readyForNext ? "approved_for_future_dry_run_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_activation_readiness_safe_report_validated: true, runtime_activation_readiness_contract_validated: true },
    dry_run_scope: scope(readyForNext),
    dry_run_controls: { dry_run_contract_only: true, dry_run_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    dry_run_terms: dryRunTerms(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunContract", source_runtime_activation_readiness_safe_report_id: readinessSafeReport.runtime_activation_readiness_safe_report_id, source_render_plan_id: readinessSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationDryRunReview(dryRunContract: RuntimeActivationDryRunContract, readinessSafeReport: RuntimeActivationReadinessSafeReport, options: { id?: string; created_at?: string; requestFutureDryRunSafeReport?: boolean } = {}): RuntimeActivationDryRunReview {
  const ready = dryRunContractReady(dryRunContract) && readinessSafeReportReady(readinessSafeReport);
  const requestReport = options.requestFutureDryRunSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation dry-run contract or readiness safe report was not ready for dry-run review.", [...dryRunContract.validation.blocking_reasons, ...readinessSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_review_id: safe(options.id, "runtime-activation-dry-run-review-001"),
    runtime_activation_dry_run_contract_id: dryRunContract.runtime_activation_dry_run_contract_id,
    runtime_activation_readiness_safe_report_id: dryRunContract.runtime_activation_readiness_safe_report_id,
    render_plan_id: dryRunContract.render_plan_id,
    project_id: dryRunContract.project_id,
    platform: dryRunContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_review_state: readyForNext ? "approved_for_future_dry_run_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_dry_run_contract_validated: true, runtime_activation_readiness_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, dry_run_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunReview", source_runtime_activation_dry_run_contract_id: dryRunContract.runtime_activation_dry_run_contract_id, source_render_plan_id: dryRunContract.render_plan_id },
  };
}

export function createRuntimeActivationDryRunSafeReport(dryRunReview: RuntimeActivationDryRunReview, dryRunContract: RuntimeActivationDryRunContract, options: { id?: string; created_at?: string; requestFutureRuntimeActivationDryRunDesign?: boolean } = {}): RuntimeActivationDryRunSafeReport {
  const ready = dryRunReviewReady(dryRunReview) && dryRunContractReady(dryRunContract);
  const requestDesign = options.requestFutureRuntimeActivationDryRunDesign !== false;
  const complete = ready;
  const readyForNext = complete && requestDesign;
  const reasons = blocking(ready, "Runtime activation dry-run review or contract was not ready for dry-run safe report.", [...dryRunReview.validation.blocking_reasons, ...dryRunContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_safe_report_id: safe(options.id, "runtime-activation-dry-run-safe-report-001"),
    runtime_activation_dry_run_review_id: dryRunReview.runtime_activation_dry_run_review_id,
    runtime_activation_dry_run_contract_id: dryRunContract.runtime_activation_dry_run_contract_id,
    render_plan_id: dryRunReview.render_plan_id,
    project_id: dryRunReview.project_id,
    platform: dryRunReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_dry_run_design" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_dry_run_review_validated: true, runtime_activation_dry_run_contract_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, dry_run_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunSafeReport", source_runtime_activation_dry_run_review_id: dryRunReview.runtime_activation_dry_run_review_id, source_render_plan_id: dryRunReview.render_plan_id },
  };
}

export function revokeRuntimeActivationDryRunContract(contract: RuntimeActivationDryRunContract, reason?: string): RuntimeActivationDryRunContract {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run contract was revoked.");
  return { ...contract, dry_run_contract_state: "revoked", dry_run_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeActivationDryRunContract" } };
}
export function revokeRuntimeActivationDryRunReview(review: RuntimeActivationDryRunReview, reason?: string): RuntimeActivationDryRunReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run review was revoked.");
  return { ...review, dry_run_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationDryRunReview" } };
}
export function revokeRuntimeActivationDryRunSafeReport(report: RuntimeActivationDryRunSafeReport, reason?: string): RuntimeActivationDryRunSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationDryRunSafeReport" } };
}
