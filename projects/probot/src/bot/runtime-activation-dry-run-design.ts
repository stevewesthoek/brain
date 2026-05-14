import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationDryRunContract, RuntimeActivationDryRunSafeReport } from "./runtime-activation-dry-run.js";

export type RuntimeActivationDryRunDesignState = "draft" | "designed" | "approved_for_future_dry_run_design_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunDesignReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_dry_run_design_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunDesignSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_simulation_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationDryRunDesignCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationDryRunDesignSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  runtime_enabled_now: false;
  dry_run_executed_now: false;
  ready_for_real_upload_now: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
}

export interface RuntimeActivationDryRunDesignReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeActivationDryRunDesignCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  dry_run_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeActivationDryRunDesignSafeReportSection {
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

export interface RuntimeActivationDryRunDesign {
  schema_version: "1.0";
  runtime_activation_dry_run_design_id: string;
  runtime_activation_dry_run_safe_report_id: string;
  runtime_activation_dry_run_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_design_state: RuntimeActivationDryRunDesignState;
  required_artifacts: { runtime_activation_dry_run_safe_report_validated: true; runtime_activation_dry_run_contract_validated: true };
  design_scope: ControlledRuntimeActivationScope;
  design_controls: {
    design_only: true;
    dry_run_design_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    dry_run_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  design_sections: RuntimeActivationDryRunDesignSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunDesign" | "revokeRuntimeActivationDryRunDesign"; source_runtime_activation_dry_run_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationDryRunDesignReview {
  schema_version: "1.0";
  runtime_activation_dry_run_design_review_id: string;
  runtime_activation_dry_run_design_id: string;
  runtime_activation_dry_run_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_design_review_state: RuntimeActivationDryRunDesignReviewState;
  required_artifacts: { runtime_activation_dry_run_design_validated: true; runtime_activation_dry_run_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    dry_run_design_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    dry_run_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeActivationDryRunDesignReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunDesignReview" | "revokeRuntimeActivationDryRunDesignReview"; source_runtime_activation_dry_run_design_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationDryRunDesignSafeReport {
  schema_version: "1.0";
  runtime_activation_dry_run_design_safe_report_id: string;
  runtime_activation_dry_run_design_review_id: string;
  runtime_activation_dry_run_design_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationDryRunDesignSafeReportState;
  required_artifacts: { runtime_activation_dry_run_design_review_validated: true; runtime_activation_dry_run_design_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    dry_run_design_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    dry_run_execution_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: RuntimeActivationDryRunDesignSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationDryRunDesignSafeReport" | "revokeRuntimeActivationDryRunDesignSafeReport"; source_runtime_activation_dry_run_design_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation dry-run design prerequisite was not validated.")))];
}

function dryRunSafeReportReady(report: RuntimeActivationDryRunSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_dry_run_design" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.dry_run_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.dry_run_executed_now && !section.ready_for_real_upload_now);
}
function dryRunContractReady(contract: RuntimeActivationDryRunContract): boolean {
  return contract.dry_run_contract_state === "approved_for_future_dry_run_review" && contract.validation.complete && contract.validation.ready_for_next_phase && !contract.validation.ready_for_real_upload && contract.dry_run_controls.dry_run_contract_only && contract.dry_run_controls.dry_run_only && !contract.dry_run_controls.contains_runtime_callable && !contract.dry_run_controls.contains_raw_payload && !contract.dry_run_controls.contains_raw_response && !contract.dry_run_controls.contains_secret_material && !contract.dry_run_controls.runtime_wiring_implemented && contract.dry_run_controls.runtime_invocation_disabled && contract.dry_run_controls.real_upload_still_blocked && contract.dry_run_terms.every((term) => !term.runtime_enabled_now && !term.dry_run_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function dryRunDesignReady(design: RuntimeActivationDryRunDesign): boolean {
  return design.dry_run_design_state === "approved_for_future_dry_run_design_review" && design.validation.complete && design.validation.ready_for_next_phase && design.design_controls.design_only && design.design_controls.dry_run_design_only && !design.design_controls.contains_runtime_callable && !design.design_controls.contains_raw_payload && !design.design_controls.contains_raw_response && !design.design_controls.contains_secret_material && !design.design_controls.runtime_wiring_implemented && design.design_controls.runtime_invocation_disabled && design.design_controls.dry_run_execution_disabled && design.design_controls.real_upload_still_blocked && design.design_sections.length >= 4 && design.design_sections.every((section) => !section.runtime_enabled_now && !section.dry_run_executed_now && !section.ready_for_real_upload_now && !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_secret_material);
}
function dryRunDesignReviewReady(review: RuntimeActivationDryRunDesignReview): boolean {
  return review.dry_run_design_review_state === "approved_for_future_dry_run_design_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.dry_run_design_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.dry_run_execution_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.dry_run_executed_now && !check.ready_for_real_upload_now);
}

function designSections(): RuntimeActivationDryRunDesignSection[] {
  return [
    { section_id: "dry-run-design-scope", section_kind: "scope", safe_summary: "Dry-run design scope only; no runtime enabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { section_id: "dry-run-design-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { section_id: "dry-run-design-credentials", section_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    { section_id: "dry-run-design-status", section_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
  ];
}
function reviewChecks(passed: boolean): RuntimeActivationDryRunDesignReviewCheck[] {
  const checks = [
    ["dry-run-design-review-scope", "scope", "Dry-run design scope reviewed only."],
    ["dry-run-design-review-terms", "terms", "Dry-run design terms reviewed only."],
    ["dry-run-design-review-boundaries", "boundaries", "Runtime invocation remains disabled."],
    ["dry-run-design-review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false }));
}
function safeReportSections(): RuntimeActivationDryRunDesignSafeReportSection[] {
  return [
    { section_id: "dry-run-design-safe-report-design", section_kind: "design", safe_summary: "Runtime activation dry-run design summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-design-safe-report-review", section_kind: "review", safe_summary: "Runtime activation dry-run design review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-design-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    { section_id: "dry-run-design-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeActivationDryRunDesign(dryRunSafeReport: RuntimeActivationDryRunSafeReport, dryRunContract: RuntimeActivationDryRunContract, options: { id?: string; created_at?: string; requestFutureDryRunDesignReview?: boolean } = {}): RuntimeActivationDryRunDesign {
  const ready = dryRunSafeReportReady(dryRunSafeReport) && dryRunContractReady(dryRunContract);
  const requestReview = options.requestFutureDryRunDesignReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime activation dry-run safe report or contract was not ready for dry-run design.", [...dryRunSafeReport.validation.blocking_reasons, ...dryRunContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_design_id: safe(options.id, "runtime-activation-dry-run-design-001"),
    runtime_activation_dry_run_safe_report_id: dryRunSafeReport.runtime_activation_dry_run_safe_report_id,
    runtime_activation_dry_run_contract_id: dryRunContract.runtime_activation_dry_run_contract_id,
    render_plan_id: dryRunSafeReport.render_plan_id,
    project_id: dryRunSafeReport.project_id,
    platform: dryRunSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_design_state: readyForNext ? "approved_for_future_dry_run_design_review" : ready ? "designed" : "blocked",
    required_artifacts: { runtime_activation_dry_run_safe_report_validated: true, runtime_activation_dry_run_contract_validated: true },
    design_scope: scope(readyForNext),
    design_controls: { design_only: true, dry_run_design_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, dry_run_execution_disabled: true, real_upload_still_blocked: true },
    design_sections: designSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunDesign", source_runtime_activation_dry_run_safe_report_id: dryRunSafeReport.runtime_activation_dry_run_safe_report_id, source_render_plan_id: dryRunSafeReport.render_plan_id },
  };
}

export function createRuntimeActivationDryRunDesignReview(design: RuntimeActivationDryRunDesign, dryRunSafeReport: RuntimeActivationDryRunSafeReport, options: { id?: string; created_at?: string; requestFutureDryRunDesignSafeReport?: boolean } = {}): RuntimeActivationDryRunDesignReview {
  const ready = dryRunDesignReady(design) && dryRunSafeReportReady(dryRunSafeReport);
  const requestReport = options.requestFutureDryRunDesignSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime activation dry-run design or safe report was not ready for dry-run design review.", [...design.validation.blocking_reasons, ...dryRunSafeReport.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_design_review_id: safe(options.id, "runtime-activation-dry-run-design-review-001"),
    runtime_activation_dry_run_design_id: design.runtime_activation_dry_run_design_id,
    runtime_activation_dry_run_safe_report_id: design.runtime_activation_dry_run_safe_report_id,
    render_plan_id: design.render_plan_id,
    project_id: design.project_id,
    platform: design.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_design_review_state: readyForNext ? "approved_for_future_dry_run_design_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_activation_dry_run_design_validated: true, runtime_activation_dry_run_safe_report_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, dry_run_design_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, dry_run_execution_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunDesignReview", source_runtime_activation_dry_run_design_id: design.runtime_activation_dry_run_design_id, source_render_plan_id: design.render_plan_id },
  };
}

export function createRuntimeActivationDryRunDesignSafeReport(review: RuntimeActivationDryRunDesignReview, design: RuntimeActivationDryRunDesign, options: { id?: string; created_at?: string; requestFutureRuntimeActivationSimulationContract?: boolean } = {}): RuntimeActivationDryRunDesignSafeReport {
  const ready = dryRunDesignReviewReady(review) && dryRunDesignReady(design);
  const requestSimulation = options.requestFutureRuntimeActivationSimulationContract !== false;
  const complete = ready;
  const readyForNext = complete && requestSimulation;
  const reasons = blocking(ready, "Runtime activation dry-run design review or design was not ready for dry-run design safe report.", [...review.validation.blocking_reasons, ...design.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_design_safe_report_id: safe(options.id, "runtime-activation-dry-run-design-safe-report-001"),
    runtime_activation_dry_run_design_review_id: review.runtime_activation_dry_run_design_review_id,
    runtime_activation_dry_run_design_id: design.runtime_activation_dry_run_design_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_simulation_contract" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_activation_dry_run_design_review_validated: true, runtime_activation_dry_run_design_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, dry_run_design_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, dry_run_execution_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeActivationDryRunDesignSafeReport", source_runtime_activation_dry_run_design_review_id: review.runtime_activation_dry_run_design_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeActivationDryRunDesign(design: RuntimeActivationDryRunDesign, reason?: string): RuntimeActivationDryRunDesign {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run design was revoked.");
  return { ...design, dry_run_design_state: "revoked", design_scope: scope(false), validation: validation(false, false, design.validation.blocking_reasons, [...design.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...design.provenance, generated_by: "revokeRuntimeActivationDryRunDesign" } };
}
export function revokeRuntimeActivationDryRunDesignReview(review: RuntimeActivationDryRunDesignReview, reason?: string): RuntimeActivationDryRunDesignReview {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run design review was revoked.");
  return { ...review, dry_run_design_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationDryRunDesignReview" } };
}
export function revokeRuntimeActivationDryRunDesignSafeReport(report: RuntimeActivationDryRunDesignSafeReport, reason?: string): RuntimeActivationDryRunDesignSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime activation dry-run design safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationDryRunDesignSafeReport" } };
}
