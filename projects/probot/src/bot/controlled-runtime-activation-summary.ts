import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { ControlledRuntimeActivationFinalReview, ControlledRuntimeActivationRollbackPlan } from "./controlled-runtime-activation-finalization.js";

export type ControlledRuntimeActivationGoNoGoState = "draft" | "go_candidate" | "no_go" | "approved_for_final_safe_activation_report" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationFinalSafeReportState = "draft" | "complete" | "approved_for_boundary_completion_summary" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationBoundaryCompletionState = "draft" | "complete" | "approved_for_future_runtime_activation_implementation_boundary" | "rejected" | "revoked" | "blocked";

export interface SafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface ControlledRuntimeActivationGoNoGo {
  schema_version: "1.0";
  controlled_runtime_activation_go_no_go_id: string;
  controlled_runtime_activation_rollback_plan_id: string;
  controlled_runtime_activation_final_review_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  go_no_go_state: ControlledRuntimeActivationGoNoGoState;
  required_artifacts: {
    controlled_runtime_activation_rollback_plan_validated: true;
    controlled_runtime_activation_final_review_validated: true;
  };
  decision_scope: ControlledRuntimeActivationScope;
  decision_controls: {
    go_no_go_only: true;
    operator_kill_switch_required: true;
    single_upload_limit: 1;
    rollback_plan_validated: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationGoNoGo" | "revokeControlledRuntimeActivationGoNoGo";
    source_controlled_runtime_activation_rollback_plan_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationFinalSafeReport {
  schema_version: "1.0";
  controlled_runtime_activation_final_safe_report_id: string;
  controlled_runtime_activation_go_no_go_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_safe_report_state: ControlledRuntimeActivationFinalSafeReportState;
  required_artifacts: {
    controlled_runtime_activation_go_no_go_validated: true;
  };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: SafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationFinalSafeReport" | "revokeControlledRuntimeActivationFinalSafeReport";
    source_controlled_runtime_activation_go_no_go_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationBoundaryCompletionSummary {
  schema_version: "1.0";
  controlled_runtime_activation_boundary_completion_summary_id: string;
  controlled_runtime_activation_final_safe_report_id: string;
  controlled_runtime_activation_go_no_go_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  boundary_completion_state: ControlledRuntimeActivationBoundaryCompletionState;
  required_artifacts: {
    controlled_runtime_activation_final_safe_report_validated: true;
    controlled_runtime_activation_go_no_go_validated: true;
  };
  summary_scope: ControlledRuntimeActivationScope;
  completion_findings: {
    artifact_chain_complete: true;
    runtime_implementation_still_required: true;
    separate_activation_commit_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationBoundaryCompletionSummary" | "revokeControlledRuntimeActivationBoundaryCompletionSummary";
    source_controlled_runtime_activation_final_safe_report_id: string;
    source_render_plan_id: string;
  };
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

const SAFE_REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "boundaries", kind: "boundaries", summary: "Boundary summary only." },
  { id: "controls", kind: "controls", summary: "Control summary only." },
  { id: "rollback", kind: "rollback", summary: "Rollback summary only." },
  { id: "status", kind: "status", summary: "Status summary only; real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return {
    artifact_only: true,
    future_next_phase_requested: futureNextPhaseRequested,
    real_upload_enabled_now: false,
    upload_execution_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    credential_access_enabled_now: false,
    media_read_enabled_now: false,
    dependencies_requested: false,
    package_metadata_changes_requested: false,
  };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return {
    complete,
    ready_for_next_phase: readyForNextPhase,
    ready_for_real_upload: false,
    real_upload_enabled: false,
    upload_allowed: false,
    network_calls_allowed: false,
    platform_api_calls_allowed: false,
    credentials_accessed: false,
    media_file_read: false,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

function finalReviewReady(review: ControlledRuntimeActivationFinalReview): boolean {
  return (
    review.final_review_state === "approved_for_future_rollback_plan" &&
    review.validation.complete === true &&
    review.validation.ready_for_next_phase === true &&
    review.validation.ready_for_real_upload === false &&
    review.validation.real_upload_enabled === false &&
    review.validation.upload_allowed === false &&
    review.validation.network_calls_allowed === false &&
    review.validation.platform_api_calls_allowed === false &&
    review.validation.credentials_accessed === false &&
    review.validation.media_file_read === false &&
    review.final_review_controls.real_upload_still_blocked === true
  );
}

function rollbackPlanReady(plan: ControlledRuntimeActivationRollbackPlan): boolean {
  return (
    plan.rollback_plan_state === "approved_for_future_activation_go_no_go" &&
    plan.validation.complete === true &&
    plan.validation.ready_for_next_phase === true &&
    plan.validation.ready_for_real_upload === false &&
    plan.validation.real_upload_enabled === false &&
    plan.validation.upload_allowed === false &&
    plan.validation.network_calls_allowed === false &&
    plan.validation.platform_api_calls_allowed === false &&
    plan.validation.credentials_accessed === false &&
    plan.validation.media_file_read === false &&
    plan.rollback_controls.rollback_plan_only === true &&
    plan.rollback_controls.real_upload_still_blocked === true &&
    plan.rollback_steps.length >= 4 &&
    plan.rollback_steps.every((step) => step.executed_now === false)
  );
}

function goNoGoReady(goNoGo: ControlledRuntimeActivationGoNoGo): boolean {
  return (
    goNoGo.go_no_go_state === "approved_for_final_safe_activation_report" &&
    goNoGo.validation.complete === true &&
    goNoGo.validation.ready_for_next_phase === true &&
    goNoGo.validation.ready_for_real_upload === false &&
    goNoGo.validation.real_upload_enabled === false &&
    goNoGo.validation.upload_allowed === false &&
    goNoGo.validation.network_calls_allowed === false &&
    goNoGo.validation.platform_api_calls_allowed === false &&
    goNoGo.validation.credentials_accessed === false &&
    goNoGo.validation.media_file_read === false &&
    goNoGo.decision_controls.go_no_go_only === true &&
    goNoGo.decision_controls.real_upload_still_blocked === true
  );
}

function finalSafeReportReady(report: ControlledRuntimeActivationFinalSafeReport): boolean {
  return (
    report.final_safe_report_state === "approved_for_boundary_completion_summary" &&
    report.validation.complete === true &&
    report.validation.ready_for_next_phase === true &&
    report.safe_report_sections.length >= 4 &&
    report.safe_report_sections.every((section) => section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false)
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime summary prerequisite was not validated.")))];
}

function safeReportSections(): SafeReportSection[] {
  return SAFE_REPORT_SECTIONS.map((section) => ({
    section_id: `safe-report-${sanitizeSafeSummary(section.id, "section")}`,
    section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"),
    safe_summary: sanitizeSafeSummary(section.summary, "Safe report section only."),
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
  }));
}

export function createControlledRuntimeActivationGoNoGo(
  rollbackPlan: ControlledRuntimeActivationRollbackPlan,
  finalReview: ControlledRuntimeActivationFinalReview,
  options: { id?: string; created_at?: string; requestFutureFinalSafeReport?: boolean; operatorGo?: boolean } = {},
): ControlledRuntimeActivationGoNoGo {
  const ready = rollbackPlanReady(rollbackPlan) && finalReviewReady(finalReview);
  const operatorGo = options.operatorGo !== false;
  const requestFinalSafeReport = options.requestFutureFinalSafeReport !== false;
  const complete = ready && operatorGo;
  const readyForNext = complete && requestFinalSafeReport;
  const reasons = blocking(ready, "Controlled runtime activation rollback plan or final review was not ready for go/no-go.", [...rollbackPlan.validation.blocking_reasons, ...finalReview.validation.blocking_reasons]);
  const state: ControlledRuntimeActivationGoNoGoState = readyForNext ? "approved_for_final_safe_activation_report" : ready && operatorGo ? "go_candidate" : ready ? "no_go" : "blocked";

  return {
    schema_version: "1.0",
    controlled_runtime_activation_go_no_go_id: safe(options.id, "controlled-runtime-activation-go-no-go-001"),
    controlled_runtime_activation_rollback_plan_id: rollbackPlan.controlled_runtime_activation_rollback_plan_id,
    controlled_runtime_activation_final_review_id: finalReview.controlled_runtime_activation_final_review_id,
    render_plan_id: rollbackPlan.render_plan_id,
    project_id: rollbackPlan.project_id,
    platform: rollbackPlan.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    go_no_go_state: state,
    required_artifacts: {
      controlled_runtime_activation_rollback_plan_validated: true,
      controlled_runtime_activation_final_review_validated: true,
    },
    decision_scope: scope(readyForNext),
    decision_controls: {
      go_no_go_only: true,
      operator_kill_switch_required: true,
      single_upload_limit: 1,
      rollback_plan_validated: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationGoNoGo",
      source_controlled_runtime_activation_rollback_plan_id: rollbackPlan.controlled_runtime_activation_rollback_plan_id,
      source_render_plan_id: rollbackPlan.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationFinalSafeReport(
  goNoGo: ControlledRuntimeActivationGoNoGo,
  options: { id?: string; created_at?: string; requestFutureBoundaryCompletionSummary?: boolean } = {},
): ControlledRuntimeActivationFinalSafeReport {
  const ready = goNoGoReady(goNoGo);
  const requestSummary = options.requestFutureBoundaryCompletionSummary !== false;
  const complete = ready;
  const readyForNext = complete && requestSummary;
  const reasons = blocking(ready, "Controlled runtime activation go/no-go was not ready for final safe report.", goNoGo.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_final_safe_report_id: safe(options.id, "controlled-runtime-activation-final-safe-report-001"),
    controlled_runtime_activation_go_no_go_id: goNoGo.controlled_runtime_activation_go_no_go_id,
    render_plan_id: goNoGo.render_plan_id,
    project_id: goNoGo.project_id,
    platform: goNoGo.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_safe_report_state: readyForNext ? "approved_for_boundary_completion_summary" : ready ? "complete" : "blocked",
    required_artifacts: { controlled_runtime_activation_go_no_go_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationFinalSafeReport",
      source_controlled_runtime_activation_go_no_go_id: goNoGo.controlled_runtime_activation_go_no_go_id,
      source_render_plan_id: goNoGo.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationBoundaryCompletionSummary(
  report: ControlledRuntimeActivationFinalSafeReport,
  goNoGo: ControlledRuntimeActivationGoNoGo,
  options: { id?: string; created_at?: string; requestFutureRuntimeActivationImplementationBoundary?: boolean } = {},
): ControlledRuntimeActivationBoundaryCompletionSummary {
  const ready = finalSafeReportReady(report) && goNoGoReady(goNoGo);
  const requestBoundary = options.requestFutureRuntimeActivationImplementationBoundary !== false;
  const complete = ready;
  const readyForNext = complete && requestBoundary;
  const reasons = blocking(ready, "Controlled runtime activation final safe report or go/no-go was not ready for boundary completion summary.", [...report.validation.blocking_reasons, ...goNoGo.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_boundary_completion_summary_id: safe(options.id, "controlled-runtime-activation-boundary-completion-summary-001"),
    controlled_runtime_activation_final_safe_report_id: report.controlled_runtime_activation_final_safe_report_id,
    controlled_runtime_activation_go_no_go_id: goNoGo.controlled_runtime_activation_go_no_go_id,
    render_plan_id: report.render_plan_id,
    project_id: report.project_id,
    platform: report.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    boundary_completion_state: readyForNext ? "approved_for_future_runtime_activation_implementation_boundary" : ready ? "complete" : "blocked",
    required_artifacts: {
      controlled_runtime_activation_final_safe_report_validated: true,
      controlled_runtime_activation_go_no_go_validated: true,
    },
    summary_scope: scope(readyForNext),
    completion_findings: {
      artifact_chain_complete: true,
      runtime_implementation_still_required: true,
      separate_activation_commit_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationBoundaryCompletionSummary",
      source_controlled_runtime_activation_final_safe_report_id: report.controlled_runtime_activation_final_safe_report_id,
      source_render_plan_id: report.render_plan_id,
    },
  };
}

export function revokeControlledRuntimeActivationGoNoGo(goNoGo: ControlledRuntimeActivationGoNoGo, reason?: string): ControlledRuntimeActivationGoNoGo {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation go/no-go was revoked.");
  return {
    ...goNoGo,
    go_no_go_state: "revoked",
    decision_scope: scope(false),
    validation: validation(false, false, goNoGo.validation.blocking_reasons, [...goNoGo.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...goNoGo.provenance, generated_by: "revokeControlledRuntimeActivationGoNoGo" },
  };
}

export function revokeControlledRuntimeActivationFinalSafeReport(report: ControlledRuntimeActivationFinalSafeReport, reason?: string): ControlledRuntimeActivationFinalSafeReport {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation final safe report was revoked.");
  return {
    ...report,
    final_safe_report_state: "revoked",
    report_scope: scope(false),
    validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...report.provenance, generated_by: "revokeControlledRuntimeActivationFinalSafeReport" },
  };
}

export function revokeControlledRuntimeActivationBoundaryCompletionSummary(summary: ControlledRuntimeActivationBoundaryCompletionSummary, reason?: string): ControlledRuntimeActivationBoundaryCompletionSummary {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation boundary completion summary was revoked.");
  return {
    ...summary,
    boundary_completion_state: "revoked",
    summary_scope: scope(false),
    validation: validation(false, false, summary.validation.blocking_reasons, [...summary.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...summary.provenance, generated_by: "revokeControlledRuntimeActivationBoundaryCompletionSummary" },
  };
}
