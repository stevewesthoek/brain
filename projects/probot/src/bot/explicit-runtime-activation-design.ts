import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubNextPhaseDecisionRecord, RuntimeStubOperatorHandoffChecklist } from "./runtime-stub-sequence-handoff.js";

export type ExplicitRuntimeActivationDesignBoundaryState = "draft" | "designed" | "approved_for_future_design_review" | "rejected" | "revoked" | "blocked";
export type ExplicitRuntimeActivationDesignReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_design_safe_report" | "rejected" | "revoked" | "blocked";
export type ExplicitRuntimeActivationDesignSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_contract" | "rejected" | "revoked" | "blocked";
export type ExplicitRuntimeActivationDesignCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface ExplicitRuntimeActivationDesignSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_secret_material: false;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface ExplicitRuntimeActivationDesignReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: ExplicitRuntimeActivationDesignCheckState;
  safe_summary: string;
  runtime_enabled_now: false;
  ready_for_real_upload_now: false;
}

export interface ExplicitRuntimeActivationDesignSafeReportSection {
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

export interface ExplicitRuntimeActivationDesignBoundary {
  schema_version: "1.0";
  explicit_runtime_activation_design_boundary_id: string;
  runtime_stub_next_phase_decision_record_id: string;
  runtime_stub_operator_handoff_checklist_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  design_boundary_state: ExplicitRuntimeActivationDesignBoundaryState;
  required_artifacts: { runtime_stub_next_phase_decision_record_validated: true; runtime_stub_operator_handoff_checklist_validated: true };
  design_scope: ControlledRuntimeActivationScope;
  design_controls: {
    design_only: true;
    activation_boundary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  design_sections: ExplicitRuntimeActivationDesignSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createExplicitRuntimeActivationDesignBoundary" | "revokeExplicitRuntimeActivationDesignBoundary"; source_runtime_stub_next_phase_decision_record_id: string; source_render_plan_id: string };
}

export interface ExplicitRuntimeActivationDesignReview {
  schema_version: "1.0";
  explicit_runtime_activation_design_review_id: string;
  explicit_runtime_activation_design_boundary_id: string;
  runtime_stub_next_phase_decision_record_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  design_review_state: ExplicitRuntimeActivationDesignReviewState;
  required_artifacts: { explicit_runtime_activation_design_boundary_validated: true; runtime_stub_next_phase_decision_record_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    design_review_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: ExplicitRuntimeActivationDesignReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createExplicitRuntimeActivationDesignReview" | "revokeExplicitRuntimeActivationDesignReview"; source_explicit_runtime_activation_design_boundary_id: string; source_render_plan_id: string };
}

export interface ExplicitRuntimeActivationDesignSafeReport {
  schema_version: "1.0";
  explicit_runtime_activation_design_safe_report_id: string;
  explicit_runtime_activation_design_review_id: string;
  explicit_runtime_activation_design_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: ExplicitRuntimeActivationDesignSafeReportState;
  required_artifacts: { explicit_runtime_activation_design_review_validated: true; explicit_runtime_activation_design_boundary_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: {
    safe_report_only: true;
    activation_design_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_wiring_implemented: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  safe_report_sections: ExplicitRuntimeActivationDesignSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createExplicitRuntimeActivationDesignSafeReport" | "revokeExplicitRuntimeActivationDesignSafeReport"; source_explicit_runtime_activation_design_review_id: string; source_render_plan_id: string };
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
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Explicit runtime activation design prerequisite was not validated.")))];
}

function decisionRecordReady(record: RuntimeStubNextPhaseDecisionRecord): boolean {
  return record.decision_state === "approved_for_future_explicit_runtime_activation_design" && record.validation.complete && record.validation.ready_for_next_phase && !record.validation.ready_for_real_upload && record.decision_controls.decision_record_only && record.decision_controls.future_phase_only && !record.decision_controls.contains_runtime_callable && !record.decision_controls.contains_raw_payload && !record.decision_controls.contains_raw_response && !record.decision_controls.contains_secret_material && record.decision_controls.runtime_invocation_disabled && record.decision_controls.real_upload_still_blocked && record.selected_decision.decision_kind === "document_future_activation_design" && !record.selected_decision.runtime_enabled_now && !record.selected_decision.ready_for_real_upload_now;
}

function checklistReady(checklist: RuntimeStubOperatorHandoffChecklist): boolean {
  return checklist.checklist_state === "approved_for_future_next_phase_decision_record" && checklist.validation.complete && checklist.validation.ready_for_next_phase && !checklist.validation.ready_for_real_upload && checklist.checklist_controls.checklist_only && checklist.checklist_controls.operator_handoff_only && !checklist.checklist_controls.contains_runtime_callable && !checklist.checklist_controls.contains_raw_payload && !checklist.checklist_controls.contains_raw_response && !checklist.checklist_controls.contains_secret_material && checklist.checklist_controls.runtime_invocation_disabled && checklist.checklist_controls.real_upload_still_blocked && checklist.checklist_items.every((item) => item.item_state === "checked" && !item.operator_action_required_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function designBoundaryReady(boundary: ExplicitRuntimeActivationDesignBoundary): boolean {
  return boundary.design_boundary_state === "approved_for_future_design_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && boundary.design_controls.design_only && boundary.design_controls.activation_boundary_only && !boundary.design_controls.contains_runtime_callable && !boundary.design_controls.contains_raw_payload && !boundary.design_controls.contains_raw_response && !boundary.design_controls.contains_secret_material && !boundary.design_controls.runtime_wiring_implemented && boundary.design_controls.runtime_invocation_disabled && boundary.design_controls.real_upload_still_blocked && boundary.design_sections.length >= 4 && boundary.design_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_secret_material && !section.runtime_enabled_now && !section.ready_for_real_upload_now);
}

function designReviewReady(review: ExplicitRuntimeActivationDesignReview): boolean {
  return review.design_review_state === "approved_for_future_design_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.design_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.ready_for_real_upload_now);
}

function designSections(): ExplicitRuntimeActivationDesignSection[] {
  return [
    { section_id: "design-boundary-scope", section_kind: "scope", safe_summary: "Future explicit activation design boundary only.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-boundary-interfaces", section_kind: "interfaces", safe_summary: "Interface design only; no callables or payloads.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-boundary-credentials", section_kind: "credentials", safe_summary: "Credential access remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-boundary-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
  ];
}

function reviewChecks(passed: boolean): ExplicitRuntimeActivationDesignReviewCheck[] {
  const checks = [
    ["review-scope", "scope", "Design scope reviewed only."],
    ["review-interfaces", "interfaces", "Interface design reviewed only."],
    ["review-boundaries", "boundaries", "Runtime remains disabled."],
    ["review-status", "status", "Real upload remains disabled."],
  ] as const;
  return checks.map(([check_id, check_kind, safe_summary]) => ({ check_id, check_kind, check_state: passed ? "passed" : "blocked", safe_summary, runtime_enabled_now: false, ready_for_real_upload_now: false }));
}

function safeReportSections(): ExplicitRuntimeActivationDesignSafeReportSection[] {
  return [
    { section_id: "design-safe-report-boundary", section_kind: "boundary", safe_summary: "Design boundary is safe-report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-safe-report-review", section_kind: "review", safe_summary: "Design review is safe-report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    { section_id: "design-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
  ];
}

export function createExplicitRuntimeActivationDesignBoundary(decisionRecord: RuntimeStubNextPhaseDecisionRecord, checklist: RuntimeStubOperatorHandoffChecklist, options: { id?: string; created_at?: string; requestFutureDesignReview?: boolean } = {}): ExplicitRuntimeActivationDesignBoundary {
  const ready = decisionRecordReady(decisionRecord) && checklistReady(checklist);
  const requestReview = options.requestFutureDesignReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub next phase decision record or operator handoff checklist was not ready for explicit runtime activation design boundary.", [...decisionRecord.validation.blocking_reasons, ...checklist.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    explicit_runtime_activation_design_boundary_id: safe(options.id, "explicit-runtime-activation-design-boundary-001"),
    runtime_stub_next_phase_decision_record_id: decisionRecord.runtime_stub_next_phase_decision_record_id,
    runtime_stub_operator_handoff_checklist_id: checklist.runtime_stub_operator_handoff_checklist_id,
    render_plan_id: decisionRecord.render_plan_id,
    project_id: decisionRecord.project_id,
    platform: decisionRecord.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    design_boundary_state: readyForNext ? "approved_for_future_design_review" : ready ? "designed" : "blocked",
    required_artifacts: { runtime_stub_next_phase_decision_record_validated: true, runtime_stub_operator_handoff_checklist_validated: true },
    design_scope: scope(readyForNext),
    design_controls: { design_only: true, activation_boundary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    design_sections: designSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createExplicitRuntimeActivationDesignBoundary", source_runtime_stub_next_phase_decision_record_id: decisionRecord.runtime_stub_next_phase_decision_record_id, source_render_plan_id: decisionRecord.render_plan_id },
  };
}

export function createExplicitRuntimeActivationDesignReview(boundary: ExplicitRuntimeActivationDesignBoundary, decisionRecord: RuntimeStubNextPhaseDecisionRecord, options: { id?: string; created_at?: string; requestFutureDesignSafeReport?: boolean } = {}): ExplicitRuntimeActivationDesignReview {
  const ready = designBoundaryReady(boundary) && decisionRecordReady(decisionRecord);
  const requestReport = options.requestFutureDesignSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Explicit runtime activation design boundary or decision record was not ready for design review.", [...boundary.validation.blocking_reasons, ...decisionRecord.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    explicit_runtime_activation_design_review_id: safe(options.id, "explicit-runtime-activation-design-review-001"),
    explicit_runtime_activation_design_boundary_id: boundary.explicit_runtime_activation_design_boundary_id,
    runtime_stub_next_phase_decision_record_id: boundary.runtime_stub_next_phase_decision_record_id,
    render_plan_id: boundary.render_plan_id,
    project_id: boundary.project_id,
    platform: boundary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    design_review_state: readyForNext ? "approved_for_future_design_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { explicit_runtime_activation_design_boundary_validated: true, runtime_stub_next_phase_decision_record_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, design_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createExplicitRuntimeActivationDesignReview", source_explicit_runtime_activation_design_boundary_id: boundary.explicit_runtime_activation_design_boundary_id, source_render_plan_id: boundary.render_plan_id },
  };
}

export function createExplicitRuntimeActivationDesignSafeReport(review: ExplicitRuntimeActivationDesignReview, boundary: ExplicitRuntimeActivationDesignBoundary, options: { id?: string; created_at?: string; requestFutureRuntimeActivationContract?: boolean } = {}): ExplicitRuntimeActivationDesignSafeReport {
  const ready = designReviewReady(review) && designBoundaryReady(boundary);
  const requestContract = options.requestFutureRuntimeActivationContract !== false;
  const complete = ready;
  const readyForNext = complete && requestContract;
  const reasons = blocking(ready, "Explicit runtime activation design review or boundary was not ready for design safe report.", [...review.validation.blocking_reasons, ...boundary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    explicit_runtime_activation_design_safe_report_id: safe(options.id, "explicit-runtime-activation-design-safe-report-001"),
    explicit_runtime_activation_design_review_id: review.explicit_runtime_activation_design_review_id,
    explicit_runtime_activation_design_boundary_id: boundary.explicit_runtime_activation_design_boundary_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_activation_contract" : ready ? "complete" : "blocked",
    required_artifacts: { explicit_runtime_activation_design_review_validated: true, explicit_runtime_activation_design_boundary_validated: true },
    report_scope: scope(readyForNext),
    report_controls: { safe_report_only: true, activation_design_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createExplicitRuntimeActivationDesignSafeReport", source_explicit_runtime_activation_design_review_id: review.explicit_runtime_activation_design_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeExplicitRuntimeActivationDesignBoundary(boundary: ExplicitRuntimeActivationDesignBoundary, reason?: string): ExplicitRuntimeActivationDesignBoundary {
  const warning = sanitizeSafeSummary(reason, "Explicit runtime activation design boundary was revoked.");
  return { ...boundary, design_boundary_state: "revoked", design_scope: scope(false), validation: validation(false, false, boundary.validation.blocking_reasons, [...boundary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...boundary.provenance, generated_by: "revokeExplicitRuntimeActivationDesignBoundary" } };
}

export function revokeExplicitRuntimeActivationDesignReview(review: ExplicitRuntimeActivationDesignReview, reason?: string): ExplicitRuntimeActivationDesignReview {
  const warning = sanitizeSafeSummary(reason, "Explicit runtime activation design review was revoked.");
  return { ...review, design_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeExplicitRuntimeActivationDesignReview" } };
}

export function revokeExplicitRuntimeActivationDesignSafeReport(report: ExplicitRuntimeActivationDesignSafeReport, reason?: string): ExplicitRuntimeActivationDesignSafeReport {
  const warning = sanitizeSafeSummary(reason, "Explicit runtime activation design safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeExplicitRuntimeActivationDesignSafeReport" } };
}
