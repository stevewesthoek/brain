import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { ControlledRuntimeActivationImplementationContract, ControlledRuntimeActivationImplementationDryRunReview } from "./controlled-runtime-activation-implementation.js";

export type ControlledRuntimeActivationCandidateState = "draft" | "ready_for_operator_review" | "approved_for_future_final_review" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationFinalReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_rollback_plan" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationRollbackPlanState = "draft" | "ready_for_operator_review" | "approved_for_future_activation_go_no_go" | "rejected" | "revoked" | "blocked";

export interface RollbackStepRecord {
  step_id: string;
  step_kind: string;
  safe_summary: string;
  executed_now: false;
}

export interface ControlledRuntimeActivationCandidate {
  schema_version: "1.0";
  controlled_runtime_activation_candidate_id: string;
  controlled_runtime_activation_implementation_dry_run_review_id: string;
  controlled_runtime_activation_implementation_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  activation_candidate_state: ControlledRuntimeActivationCandidateState;
  required_artifacts: {
    controlled_runtime_activation_implementation_dry_run_review_validated: true;
    controlled_runtime_activation_implementation_contract_validated: true;
  };
  candidate_scope: ControlledRuntimeActivationScope;
  candidate_controls: {
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    rollback_plan_required: true;
    final_review_required: true;
    runtime_activation_separate_commit_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationCandidate" | "revokeControlledRuntimeActivationCandidate";
    source_controlled_runtime_activation_implementation_dry_run_review_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationFinalReview {
  schema_version: "1.0";
  controlled_runtime_activation_final_review_id: string;
  controlled_runtime_activation_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_review_state: ControlledRuntimeActivationFinalReviewState;
  required_artifacts: {
    controlled_runtime_activation_candidate_validated: true;
  };
  final_review_scope: ControlledRuntimeActivationScope;
  final_review_controls: {
    candidate_reviewed: true;
    rollback_plan_required: true;
    operator_kill_switch_required: true;
    single_upload_limit: 1;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationFinalReview" | "revokeControlledRuntimeActivationFinalReview";
    source_controlled_runtime_activation_candidate_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationRollbackPlan {
  schema_version: "1.0";
  controlled_runtime_activation_rollback_plan_id: string;
  controlled_runtime_activation_final_review_id: string;
  controlled_runtime_activation_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  rollback_plan_state: ControlledRuntimeActivationRollbackPlanState;
  required_artifacts: {
    controlled_runtime_activation_final_review_validated: true;
    controlled_runtime_activation_candidate_validated: true;
  };
  rollback_scope: ControlledRuntimeActivationScope;
  rollback_controls: {
    rollback_plan_only: true;
    operator_kill_switch_required: true;
    single_upload_limit: 1;
    runtime_activation_separate_commit_required: true;
    real_upload_still_blocked: true;
  };
  rollback_steps: RollbackStepRecord[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationRollbackPlan" | "revokeControlledRuntimeActivationRollbackPlan";
    source_controlled_runtime_activation_final_review_id: string;
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

const ROLLBACK_STEPS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "disable-runtime", kind: "disable_runtime_activation", summary: "Rollback step planned only." },
  { id: "revoke-approval", kind: "revoke_approval", summary: "Rollback step planned only." },
  { id: "stop-upload", kind: "stop_upload_execution", summary: "Rollback step planned only." },
  { id: "safe-report", kind: "safe_report", summary: "Rollback step planned only." },
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

function implementationReviewReady(review: ControlledRuntimeActivationImplementationDryRunReview): boolean {
  return (
    review.implementation_dry_run_review_state === "approved_for_future_activation_candidate" &&
    review.validation.complete === true &&
    review.validation.ready_for_next_phase === true &&
    review.validation.ready_for_real_upload === false &&
    review.validation.real_upload_enabled === false &&
    review.validation.upload_allowed === false &&
    review.validation.network_calls_allowed === false &&
    review.validation.platform_api_calls_allowed === false &&
    review.validation.credentials_accessed === false &&
    review.validation.media_file_read === false &&
    review.review_checks.length >= 5 &&
    review.review_checks.every((check) => check.check_state === "passed" && check.implemented_now === false)
  );
}

function implementationContractReady(contract: ControlledRuntimeActivationImplementationContract): boolean {
  return (
    contract.implementation_contract_state === "approved_for_future_implementation_dry_run_review" &&
    contract.validation.complete === true &&
    contract.validation.ready_for_next_phase === true &&
    contract.validation.ready_for_real_upload === false &&
    contract.validation.real_upload_enabled === false &&
    contract.validation.upload_allowed === false &&
    contract.validation.network_calls_allowed === false &&
    contract.validation.platform_api_calls_allowed === false &&
    contract.validation.credentials_accessed === false &&
    contract.validation.media_file_read === false &&
    contract.implementation_contracts.length >= 5 &&
    contract.implementation_contracts.every((item) => item.implemented_now === false)
  );
}

function candidateReady(candidate: ControlledRuntimeActivationCandidate): boolean {
  return (
    candidate.activation_candidate_state === "approved_for_future_final_review" &&
    candidate.validation.complete === true &&
    candidate.validation.ready_for_next_phase === true &&
    candidate.candidate_controls.rollback_plan_required === true &&
    candidate.candidate_controls.final_review_required === true &&
    candidate.candidate_controls.real_upload_still_blocked === true
  );
}

function finalReviewReady(review: ControlledRuntimeActivationFinalReview): boolean {
  return (
    review.final_review_state === "approved_for_future_rollback_plan" &&
    review.validation.complete === true &&
    review.validation.ready_for_next_phase === true &&
    review.final_review_controls.candidate_reviewed === true &&
    review.final_review_controls.rollback_plan_required === true &&
    review.final_review_controls.real_upload_still_blocked === true
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime finalization prerequisite was not validated.")))];
}

function rollbackSteps(): RollbackStepRecord[] {
  return ROLLBACK_STEPS.map((step) => ({
    step_id: `rollback-${sanitizeSafeSummary(step.id, "step")}`,
    step_kind: sanitizeSafeSummary(step.kind, "rollback_step"),
    safe_summary: sanitizeSafeSummary(step.summary, "Rollback step planned only."),
    executed_now: false,
  }));
}

export function createControlledRuntimeActivationCandidate(
  implementationReview: ControlledRuntimeActivationImplementationDryRunReview,
  implementationContract: ControlledRuntimeActivationImplementationContract,
  options: { id?: string; created_at?: string; requestFutureFinalReview?: boolean } = {},
): ControlledRuntimeActivationCandidate {
  const ready = implementationReviewReady(implementationReview) && implementationContractReady(implementationContract);
  const requestFinalReview = options.requestFutureFinalReview !== false;
  const complete = ready;
  const readyForNext = complete && requestFinalReview;
  const reasons = blocking(ready, "Implementation dry-run review or implementation contract was not ready for activation candidate.", [...implementationReview.validation.blocking_reasons, ...implementationContract.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_candidate_id: safe(options.id, "controlled-runtime-activation-candidate-001"),
    controlled_runtime_activation_implementation_dry_run_review_id: implementationReview.controlled_runtime_activation_implementation_dry_run_review_id,
    controlled_runtime_activation_implementation_contract_id: implementationContract.controlled_runtime_activation_implementation_contract_id,
    render_plan_id: implementationReview.render_plan_id,
    project_id: implementationReview.project_id,
    platform: implementationReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    activation_candidate_state: readyForNext ? "approved_for_future_final_review" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_runtime_activation_implementation_dry_run_review_validated: true,
      controlled_runtime_activation_implementation_contract_validated: true,
    },
    candidate_scope: scope(readyForNext),
    candidate_controls: {
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      rollback_plan_required: true,
      final_review_required: true,
      runtime_activation_separate_commit_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationCandidate",
      source_controlled_runtime_activation_implementation_dry_run_review_id: implementationReview.controlled_runtime_activation_implementation_dry_run_review_id,
      source_render_plan_id: implementationReview.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationFinalReview(
  candidate: ControlledRuntimeActivationCandidate,
  options: { id?: string; created_at?: string; requestFutureRollbackPlan?: boolean } = {},
): ControlledRuntimeActivationFinalReview {
  const ready = candidateReady(candidate);
  const requestRollback = options.requestFutureRollbackPlan !== false;
  const complete = ready;
  const readyForNext = complete && requestRollback;
  const reasons = blocking(ready, "Controlled runtime activation candidate was not ready for final review.", candidate.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_final_review_id: safe(options.id, "controlled-runtime-activation-final-review-001"),
    controlled_runtime_activation_candidate_id: candidate.controlled_runtime_activation_candidate_id,
    render_plan_id: candidate.render_plan_id,
    project_id: candidate.project_id,
    platform: candidate.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_review_state: readyForNext ? "approved_for_future_rollback_plan" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_activation_candidate_validated: true },
    final_review_scope: scope(readyForNext),
    final_review_controls: {
      candidate_reviewed: true,
      rollback_plan_required: true,
      operator_kill_switch_required: true,
      single_upload_limit: 1,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationFinalReview",
      source_controlled_runtime_activation_candidate_id: candidate.controlled_runtime_activation_candidate_id,
      source_render_plan_id: candidate.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationRollbackPlan(
  finalReview: ControlledRuntimeActivationFinalReview,
  candidate: ControlledRuntimeActivationCandidate,
  options: { id?: string; created_at?: string; requestFutureActivationGoNoGo?: boolean } = {},
): ControlledRuntimeActivationRollbackPlan {
  const ready = finalReviewReady(finalReview) && candidateReady(candidate);
  const requestGoNoGo = options.requestFutureActivationGoNoGo !== false;
  const complete = ready;
  const readyForNext = complete && requestGoNoGo;
  const reasons = blocking(ready, "Controlled runtime activation final review or candidate was not ready for rollback plan.", [...finalReview.validation.blocking_reasons, ...candidate.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_rollback_plan_id: safe(options.id, "controlled-runtime-activation-rollback-plan-001"),
    controlled_runtime_activation_final_review_id: finalReview.controlled_runtime_activation_final_review_id,
    controlled_runtime_activation_candidate_id: candidate.controlled_runtime_activation_candidate_id,
    render_plan_id: finalReview.render_plan_id,
    project_id: finalReview.project_id,
    platform: finalReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    rollback_plan_state: readyForNext ? "approved_for_future_activation_go_no_go" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_runtime_activation_final_review_validated: true,
      controlled_runtime_activation_candidate_validated: true,
    },
    rollback_scope: scope(readyForNext),
    rollback_controls: {
      rollback_plan_only: true,
      operator_kill_switch_required: true,
      single_upload_limit: 1,
      runtime_activation_separate_commit_required: true,
      real_upload_still_blocked: true,
    },
    rollback_steps: rollbackSteps(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationRollbackPlan",
      source_controlled_runtime_activation_final_review_id: finalReview.controlled_runtime_activation_final_review_id,
      source_render_plan_id: finalReview.render_plan_id,
    },
  };
}

export function revokeControlledRuntimeActivationCandidate(candidate: ControlledRuntimeActivationCandidate, reason?: string): ControlledRuntimeActivationCandidate {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation candidate was revoked.");
  return {
    ...candidate,
    activation_candidate_state: "revoked",
    candidate_scope: scope(false),
    validation: validation(false, false, candidate.validation.blocking_reasons, [...candidate.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...candidate.provenance, generated_by: "revokeControlledRuntimeActivationCandidate" },
  };
}

export function revokeControlledRuntimeActivationFinalReview(review: ControlledRuntimeActivationFinalReview, reason?: string): ControlledRuntimeActivationFinalReview {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation final review was revoked.");
  return {
    ...review,
    final_review_state: "revoked",
    final_review_scope: scope(false),
    validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...review.provenance, generated_by: "revokeControlledRuntimeActivationFinalReview" },
  };
}

export function revokeControlledRuntimeActivationRollbackPlan(plan: ControlledRuntimeActivationRollbackPlan, reason?: string): ControlledRuntimeActivationRollbackPlan {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation rollback plan was revoked.");
  return {
    ...plan,
    rollback_plan_state: "revoked",
    rollback_scope: scope(false),
    rollback_steps: plan.rollback_steps.map((step) => ({ ...step, executed_now: false })),
    validation: validation(false, false, plan.validation.blocking_reasons, [...plan.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...plan.provenance, generated_by: "revokeControlledRuntimeActivationRollbackPlan" },
  };
}
