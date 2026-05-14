import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationDryRunResult, ControlledRuntimeActivationSafetyContract, ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";

export type ControlledRuntimeActivationImplementationPlanState = "draft" | "ready_for_operator_review" | "approved_for_future_implementation_contract" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationImplementationContractState = "draft" | "ready_for_operator_review" | "approved_for_future_implementation_dry_run_review" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationImplementationDryRunReviewState = "draft" | "passed" | "failed" | "ready_for_operator_review" | "approved_for_future_activation_candidate" | "rejected" | "revoked" | "blocked";
export type ImplementationReviewCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface PlannedRuntimeImplementationChange {
  change_id: string;
  change_kind: string;
  safe_summary: string;
  implemented_now: false;
}

export interface RuntimeImplementationContractRecord {
  contract_id: string;
  contract_kind: string;
  safe_summary: string;
  implemented_now: false;
}

export interface RuntimeImplementationDryRunReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: ImplementationReviewCheckState;
  safe_summary: string;
  implemented_now: false;
}

export interface ControlledRuntimeActivationImplementationPlan {
  schema_version: "1.0";
  controlled_runtime_activation_implementation_plan_id: string;
  controlled_runtime_activation_dry_run_result_id: string;
  controlled_runtime_activation_safety_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  implementation_plan_state: ControlledRuntimeActivationImplementationPlanState;
  required_artifacts: {
    controlled_runtime_activation_dry_run_result_validated: true;
    controlled_runtime_activation_safety_contract_validated: true;
  };
  implementation_scope: ControlledRuntimeActivationScope;
  planned_changes: PlannedRuntimeImplementationChange[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationImplementationPlan" | "revokeControlledRuntimeActivationImplementationPlan";
    source_controlled_runtime_activation_dry_run_result_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationImplementationContract {
  schema_version: "1.0";
  controlled_runtime_activation_implementation_contract_id: string;
  controlled_runtime_activation_implementation_plan_id: string;
  controlled_runtime_activation_dry_run_result_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  implementation_contract_state: ControlledRuntimeActivationImplementationContractState;
  required_artifacts: {
    controlled_runtime_activation_implementation_plan_validated: true;
    controlled_runtime_activation_dry_run_result_validated: true;
  };
  implementation_contract_scope: ControlledRuntimeActivationScope;
  implementation_contracts: RuntimeImplementationContractRecord[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationImplementationContract" | "revokeControlledRuntimeActivationImplementationContract";
    source_controlled_runtime_activation_implementation_plan_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationImplementationDryRunReview {
  schema_version: "1.0";
  controlled_runtime_activation_implementation_dry_run_review_id: string;
  controlled_runtime_activation_implementation_contract_id: string;
  controlled_runtime_activation_implementation_plan_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  implementation_dry_run_review_state: ControlledRuntimeActivationImplementationDryRunReviewState;
  required_artifacts: {
    controlled_runtime_activation_implementation_contract_validated: true;
    controlled_runtime_activation_implementation_plan_validated: true;
  };
  review_scope: ControlledRuntimeActivationScope;
  review_checks: RuntimeImplementationDryRunReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationImplementationDryRunReview" | "revokeControlledRuntimeActivationImplementationDryRunReview";
    source_controlled_runtime_activation_implementation_contract_id: string;
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

const ITEMS: Array<{ id: string; kind: string; plan: string; contract: string; review: string }> = [
  { id: "kill-switch", kind: "kill_switch", plan: "Plan kill switch only.", contract: "Contract kill switch only.", review: "Review kill switch plan only." },
  { id: "single-upload", kind: "single_upload_limit", plan: "Plan single upload limit only.", contract: "Contract single upload limit only.", review: "Review single upload limit plan only." },
  { id: "credential", kind: "credential_boundary", plan: "Plan credential boundary only.", contract: "Contract credential boundary only.", review: "Review credential boundary plan only." },
  { id: "network", kind: "network_boundary", plan: "Plan network boundary only.", contract: "Contract network boundary only.", review: "Review network boundary plan only." },
  { id: "media", kind: "media_boundary", plan: "Plan media boundary only.", contract: "Contract media boundary only.", review: "Review media boundary plan only." },
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

function dryRunReady(dryRun: ControlledRuntimeActivationDryRunResult): boolean {
  return dryRun.dry_run_state === "passed" && dryRun.validation.complete && dryRun.validation.ready_for_next_phase && !dryRun.validation.ready_for_real_upload && !dryRun.validation.real_upload_enabled && !dryRun.validation.upload_allowed && !dryRun.validation.network_calls_allowed && !dryRun.validation.platform_api_calls_allowed && !dryRun.validation.credentials_accessed && !dryRun.validation.media_file_read && dryRun.dry_run_checks.length >= 5 && dryRun.dry_run_checks.every((check) => check.check_state === "passed" && check.enabled_now === false);
}

function safetyContractReady(contract: ControlledRuntimeActivationSafetyContract): boolean {
  return contract.safety_contract_state === "approved_for_future_runtime_activation_dry_run" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.runtime_safety_controls.raw_payload_storage_allowed === false && contract.runtime_safety_controls.raw_response_storage_allowed === false && contract.runtime_safety_controls.real_upload_still_blocked === true && contract.runtime_safety_contracts.length >= 5 && contract.runtime_safety_contracts.every((item) => item.enabled_now === false);
}

function implementationPlanReady(plan: ControlledRuntimeActivationImplementationPlan): boolean {
  return plan.implementation_plan_state === "approved_for_future_implementation_contract" && plan.validation.complete && plan.validation.ready_for_next_phase && plan.planned_changes.length >= 5 && plan.planned_changes.every((change) => change.implemented_now === false);
}

function implementationContractReady(contract: ControlledRuntimeActivationImplementationContract): boolean {
  return contract.implementation_contract_state === "approved_for_future_implementation_dry_run_review" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.implementation_contracts.length >= 5 && contract.implementation_contracts.every((item) => item.implemented_now === false);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime implementation prerequisite was not validated.")))];
}

function plannedChanges(): PlannedRuntimeImplementationChange[] {
  return ITEMS.map((item) => ({
    change_id: `plan-${sanitizeSafeSummary(item.id, "change")}`,
    change_kind: sanitizeSafeSummary(item.kind, "implementation_plan_change"),
    safe_summary: sanitizeSafeSummary(item.plan, "Implementation plan only."),
    implemented_now: false,
  }));
}

function implementationContracts(): RuntimeImplementationContractRecord[] {
  return ITEMS.map((item) => ({
    contract_id: `contract-${sanitizeSafeSummary(item.id, "contract")}`,
    contract_kind: sanitizeSafeSummary(item.kind, "implementation_contract"),
    safe_summary: sanitizeSafeSummary(item.contract, "Implementation contract only."),
    implemented_now: false,
  }));
}

function reviewChecks(passed: boolean): RuntimeImplementationDryRunReviewCheck[] {
  return ITEMS.map((item) => ({
    check_id: `review-${sanitizeSafeSummary(item.id, "check")}`,
    check_kind: sanitizeSafeSummary(item.kind, "implementation_review_check"),
    check_state: passed ? "passed" : "blocked",
    safe_summary: sanitizeSafeSummary(item.review, "Implementation dry-run review only."),
    implemented_now: false,
  }));
}

export function createControlledRuntimeActivationImplementationPlan(
  dryRun: ControlledRuntimeActivationDryRunResult,
  safetyContract: ControlledRuntimeActivationSafetyContract,
  options: { id?: string; created_at?: string; requestFutureImplementationContract?: boolean } = {},
): ControlledRuntimeActivationImplementationPlan {
  const ready = dryRunReady(dryRun) && safetyContractReady(safetyContract);
  const requestContract = options.requestFutureImplementationContract !== false;
  const complete = ready;
  const readyForNext = complete && requestContract;
  const reasons = blocking(ready, "Controlled runtime activation dry-run or safety contract was not ready for implementation plan.", [...dryRun.validation.blocking_reasons, ...safetyContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_activation_implementation_plan_id: safe(options.id, "controlled-runtime-activation-implementation-plan-001"),
    controlled_runtime_activation_dry_run_result_id: dryRun.controlled_runtime_activation_dry_run_result_id,
    controlled_runtime_activation_safety_contract_id: safetyContract.controlled_runtime_activation_safety_contract_id,
    render_plan_id: dryRun.render_plan_id,
    project_id: dryRun.project_id,
    platform: dryRun.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    implementation_plan_state: readyForNext ? "approved_for_future_implementation_contract" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_activation_dry_run_result_validated: true, controlled_runtime_activation_safety_contract_validated: true },
    implementation_scope: scope(readyForNext),
    planned_changes: plannedChanges(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: { generated_by: "createControlledRuntimeActivationImplementationPlan", source_controlled_runtime_activation_dry_run_result_id: dryRun.controlled_runtime_activation_dry_run_result_id, source_render_plan_id: dryRun.render_plan_id },
  };
}

export function createControlledRuntimeActivationImplementationContract(
  plan: ControlledRuntimeActivationImplementationPlan,
  dryRun: ControlledRuntimeActivationDryRunResult,
  options: { id?: string; created_at?: string; requestFutureImplementationDryRunReview?: boolean } = {},
): ControlledRuntimeActivationImplementationContract {
  const ready = implementationPlanReady(plan) && dryRunReady(dryRun);
  const requestReview = options.requestFutureImplementationDryRunReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Controlled runtime activation implementation plan or dry-run was not ready for implementation contract.", [...plan.validation.blocking_reasons, ...dryRun.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_activation_implementation_contract_id: safe(options.id, "controlled-runtime-activation-implementation-contract-001"),
    controlled_runtime_activation_implementation_plan_id: plan.controlled_runtime_activation_implementation_plan_id,
    controlled_runtime_activation_dry_run_result_id: dryRun.controlled_runtime_activation_dry_run_result_id,
    render_plan_id: plan.render_plan_id,
    project_id: plan.project_id,
    platform: plan.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    implementation_contract_state: readyForNext ? "approved_for_future_implementation_dry_run_review" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_activation_implementation_plan_validated: true, controlled_runtime_activation_dry_run_result_validated: true },
    implementation_contract_scope: scope(readyForNext),
    implementation_contracts: implementationContracts(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: { generated_by: "createControlledRuntimeActivationImplementationContract", source_controlled_runtime_activation_implementation_plan_id: plan.controlled_runtime_activation_implementation_plan_id, source_render_plan_id: plan.render_plan_id },
  };
}

export function createControlledRuntimeActivationImplementationDryRunReview(
  contract: ControlledRuntimeActivationImplementationContract,
  plan: ControlledRuntimeActivationImplementationPlan,
  options: { id?: string; created_at?: string; requestFutureActivationCandidate?: boolean } = {},
): ControlledRuntimeActivationImplementationDryRunReview {
  const ready = implementationContractReady(contract) && implementationPlanReady(plan);
  const requestCandidate = options.requestFutureActivationCandidate !== false;
  const complete = ready;
  const readyForNext = complete && requestCandidate;
  const reasons = blocking(ready, "Controlled runtime activation implementation contract or plan was not ready for implementation dry-run review.", [...contract.validation.blocking_reasons, ...plan.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_activation_implementation_dry_run_review_id: safe(options.id, "controlled-runtime-activation-implementation-dry-run-review-001"),
    controlled_runtime_activation_implementation_contract_id: contract.controlled_runtime_activation_implementation_contract_id,
    controlled_runtime_activation_implementation_plan_id: plan.controlled_runtime_activation_implementation_plan_id,
    render_plan_id: contract.render_plan_id,
    project_id: contract.project_id,
    platform: contract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    implementation_dry_run_review_state: readyForNext ? "approved_for_future_activation_candidate" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_activation_implementation_contract_validated: true, controlled_runtime_activation_implementation_plan_validated: true },
    review_scope: scope(readyForNext),
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: { generated_by: "createControlledRuntimeActivationImplementationDryRunReview", source_controlled_runtime_activation_implementation_contract_id: contract.controlled_runtime_activation_implementation_contract_id, source_render_plan_id: contract.render_plan_id },
  };
}

export function revokeControlledRuntimeActivationImplementationPlan(plan: ControlledRuntimeActivationImplementationPlan, reason?: string): ControlledRuntimeActivationImplementationPlan {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation implementation plan was revoked.");
  return { ...plan, implementation_plan_state: "revoked", implementation_scope: scope(false), validation: validation(false, false, plan.validation.blocking_reasons, [...plan.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...plan.provenance, generated_by: "revokeControlledRuntimeActivationImplementationPlan" } };
}

export function revokeControlledRuntimeActivationImplementationContract(contract: ControlledRuntimeActivationImplementationContract, reason?: string): ControlledRuntimeActivationImplementationContract {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation implementation contract was revoked.");
  return { ...contract, implementation_contract_state: "revoked", implementation_contract_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeControlledRuntimeActivationImplementationContract" } };
}

export function revokeControlledRuntimeActivationImplementationDryRunReview(review: ControlledRuntimeActivationImplementationDryRunReview, reason?: string): ControlledRuntimeActivationImplementationDryRunReview {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation implementation dry-run review was revoked.");
  return { ...review, implementation_dry_run_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeControlledRuntimeActivationImplementationDryRunReview" } };
}
