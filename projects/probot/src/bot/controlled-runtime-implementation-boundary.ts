import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { ControlledRuntimeActivationBoundaryCompletionSummary } from "./controlled-runtime-activation-summary.js";

export type ControlledRuntimeImplementationBoundaryRequestState = "draft" | "ready_for_operator_review" | "approved_for_future_boundary_safety_contract" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationBoundarySafetyContractState = "draft" | "ready_for_operator_review" | "approved_for_future_boundary_dry_run" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationBoundaryDryRunState = "draft" | "passed" | "failed" | "blocked" | "revoked";
export type BoundaryDryRunCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface BoundaryImplementationContractRecord {
  contract_id: string;
  contract_kind: string;
  safe_summary: string;
  implemented_now: false;
}

export interface BoundaryDryRunCheckRecord {
  check_id: string;
  check_kind: string;
  check_state: BoundaryDryRunCheckState;
  safe_summary: string;
  implemented_now: false;
}

export interface ControlledRuntimeImplementationBoundaryRequest {
  schema_version: "1.0";
  controlled_runtime_implementation_boundary_request_id: string;
  controlled_runtime_activation_boundary_completion_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  boundary_request_state: ControlledRuntimeImplementationBoundaryRequestState;
  required_artifacts: { controlled_runtime_activation_boundary_completion_summary_validated: true };
  boundary_scope: ControlledRuntimeActivationScope;
  implementation_controls: {
    boundary_request_only: true;
    safe_stub_only: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationBoundaryRequest" | "revokeControlledRuntimeImplementationBoundaryRequest";
    source_controlled_runtime_activation_boundary_completion_summary_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationBoundarySafetyContract {
  schema_version: "1.0";
  controlled_runtime_implementation_boundary_safety_contract_id: string;
  controlled_runtime_implementation_boundary_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safety_contract_state: ControlledRuntimeImplementationBoundarySafetyContractState;
  required_artifacts: { controlled_runtime_implementation_boundary_request_validated: true };
  contract_scope: ControlledRuntimeActivationScope;
  safety_controls: {
    safe_stub_only: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    raw_payload_storage_allowed: false;
    raw_response_storage_allowed: false;
    real_upload_still_blocked: true;
  };
  implementation_contracts: BoundaryImplementationContractRecord[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationBoundarySafetyContract" | "revokeControlledRuntimeImplementationBoundarySafetyContract";
    source_controlled_runtime_implementation_boundary_request_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationBoundaryDryRun {
  schema_version: "1.0";
  controlled_runtime_implementation_boundary_dry_run_id: string;
  controlled_runtime_implementation_boundary_safety_contract_id: string;
  controlled_runtime_implementation_boundary_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_state: ControlledRuntimeImplementationBoundaryDryRunState;
  required_artifacts: {
    controlled_runtime_implementation_boundary_safety_contract_validated: true;
    controlled_runtime_implementation_boundary_request_validated: true;
  };
  dry_run_scope: ControlledRuntimeActivationScope;
  dry_run_checks: BoundaryDryRunCheckRecord[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationBoundaryDryRun" | "revokeControlledRuntimeImplementationBoundaryDryRun";
    source_controlled_runtime_implementation_boundary_safety_contract_id: string;
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

const BOUNDARY_ITEMS: Array<{ id: string; kind: string }> = [
  { id: "kill-switch", kind: "kill_switch" },
  { id: "single-upload", kind: "single_upload_limit" },
  { id: "credential", kind: "credential_boundary" },
  { id: "network", kind: "network_boundary" },
  { id: "media", kind: "media_boundary" },
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

function summaryReady(summary: ControlledRuntimeActivationBoundaryCompletionSummary): boolean {
  return (
    summary.boundary_completion_state === "approved_for_future_runtime_activation_implementation_boundary" &&
    summary.validation.complete === true &&
    summary.validation.ready_for_next_phase === true &&
    summary.validation.ready_for_real_upload === false &&
    summary.validation.real_upload_enabled === false &&
    summary.validation.upload_allowed === false &&
    summary.validation.network_calls_allowed === false &&
    summary.validation.platform_api_calls_allowed === false &&
    summary.validation.credentials_accessed === false &&
    summary.validation.media_file_read === false &&
    summary.completion_findings.runtime_implementation_still_required === true &&
    summary.completion_findings.separate_activation_commit_required === true &&
    summary.completion_findings.real_upload_still_blocked === true
  );
}

function requestReady(request: ControlledRuntimeImplementationBoundaryRequest): boolean {
  return (
    request.boundary_request_state === "approved_for_future_boundary_safety_contract" &&
    request.validation.complete === true &&
    request.validation.ready_for_next_phase === true &&
    request.implementation_controls.boundary_request_only === true &&
    request.implementation_controls.safe_stub_only === true &&
    request.implementation_controls.real_upload_still_blocked === true
  );
}

function safetyContractReady(contract: ControlledRuntimeImplementationBoundarySafetyContract): boolean {
  return (
    contract.safety_contract_state === "approved_for_future_boundary_dry_run" &&
    contract.validation.complete === true &&
    contract.validation.ready_for_next_phase === true &&
    contract.safety_controls.safe_stub_only === true &&
    contract.safety_controls.raw_payload_storage_allowed === false &&
    contract.safety_controls.raw_response_storage_allowed === false &&
    contract.safety_controls.real_upload_still_blocked === true &&
    contract.implementation_contracts.length >= 5 &&
    contract.implementation_contracts.every((item) => item.implemented_now === false)
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime implementation boundary prerequisite was not validated.")))];
}

function implementationContracts(): BoundaryImplementationContractRecord[] {
  return BOUNDARY_ITEMS.map((item) => ({
    contract_id: `boundary-contract-${sanitizeSafeSummary(item.id, "contract")}`,
    contract_kind: sanitizeSafeSummary(item.kind, "boundary_contract"),
    safe_summary: "Boundary safety contract only.",
    implemented_now: false,
  }));
}

function dryRunChecks(passed: boolean): BoundaryDryRunCheckRecord[] {
  return BOUNDARY_ITEMS.map((item) => ({
    check_id: `boundary-dry-run-${sanitizeSafeSummary(item.id, "check")}`,
    check_kind: sanitizeSafeSummary(item.kind, "boundary_dry_run_check"),
    check_state: passed ? "passed" : "blocked",
    safe_summary: "Boundary dry-run only.",
    implemented_now: false,
  }));
}

export function createControlledRuntimeImplementationBoundaryRequest(
  summary: ControlledRuntimeActivationBoundaryCompletionSummary,
  options: { id?: string; created_at?: string; requestFutureBoundarySafetyContract?: boolean } = {},
): ControlledRuntimeImplementationBoundaryRequest {
  const ready = summaryReady(summary);
  const requestSafety = options.requestFutureBoundarySafetyContract !== false;
  const complete = ready;
  const readyForNext = complete && requestSafety;
  const reasons = blocking(ready, "Boundary completion summary was not ready for implementation boundary request.", summary.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    controlled_runtime_implementation_boundary_request_id: safe(options.id, "controlled-runtime-implementation-boundary-request-001"),
    controlled_runtime_activation_boundary_completion_summary_id: summary.controlled_runtime_activation_boundary_completion_summary_id,
    render_plan_id: summary.render_plan_id,
    project_id: summary.project_id,
    platform: summary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    boundary_request_state: readyForNext ? "approved_for_future_boundary_safety_contract" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_activation_boundary_completion_summary_validated: true },
    boundary_scope: scope(readyForNext),
    implementation_controls: {
      boundary_request_only: true,
      safe_stub_only: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationBoundaryRequest",
      source_controlled_runtime_activation_boundary_completion_summary_id: summary.controlled_runtime_activation_boundary_completion_summary_id,
      source_render_plan_id: summary.render_plan_id,
    },
  };
}

export function createControlledRuntimeImplementationBoundarySafetyContract(
  request: ControlledRuntimeImplementationBoundaryRequest,
  options: { id?: string; created_at?: string; requestFutureBoundaryDryRun?: boolean } = {},
): ControlledRuntimeImplementationBoundarySafetyContract {
  const ready = requestReady(request);
  const requestDryRun = options.requestFutureBoundaryDryRun !== false;
  const complete = ready;
  const readyForNext = complete && requestDryRun;
  const reasons = blocking(ready, "Implementation boundary request was not ready for safety contract.", request.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    controlled_runtime_implementation_boundary_safety_contract_id: safe(options.id, "controlled-runtime-implementation-boundary-safety-contract-001"),
    controlled_runtime_implementation_boundary_request_id: request.controlled_runtime_implementation_boundary_request_id,
    render_plan_id: request.render_plan_id,
    project_id: request.project_id,
    platform: request.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safety_contract_state: readyForNext ? "approved_for_future_boundary_dry_run" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_implementation_boundary_request_validated: true },
    contract_scope: scope(readyForNext),
    safety_controls: {
      safe_stub_only: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      raw_payload_storage_allowed: false,
      raw_response_storage_allowed: false,
      real_upload_still_blocked: true,
    },
    implementation_contracts: implementationContracts(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationBoundarySafetyContract",
      source_controlled_runtime_implementation_boundary_request_id: request.controlled_runtime_implementation_boundary_request_id,
      source_render_plan_id: request.render_plan_id,
    },
  };
}

export function createControlledRuntimeImplementationBoundaryDryRun(
  safetyContract: ControlledRuntimeImplementationBoundarySafetyContract,
  request: ControlledRuntimeImplementationBoundaryRequest,
  options: { id?: string; created_at?: string; requestFutureImplementationCandidate?: boolean } = {},
): ControlledRuntimeImplementationBoundaryDryRun {
  const ready = safetyContractReady(safetyContract) && requestReady(request);
  const requestCandidate = options.requestFutureImplementationCandidate !== false;
  const complete = ready;
  const readyForNext = complete && requestCandidate;
  const reasons = blocking(ready, "Implementation boundary safety contract or request was not ready for dry-run.", [...safetyContract.validation.blocking_reasons, ...request.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_implementation_boundary_dry_run_id: safe(options.id, "controlled-runtime-implementation-boundary-dry-run-001"),
    controlled_runtime_implementation_boundary_safety_contract_id: safetyContract.controlled_runtime_implementation_boundary_safety_contract_id,
    controlled_runtime_implementation_boundary_request_id: request.controlled_runtime_implementation_boundary_request_id,
    render_plan_id: safetyContract.render_plan_id,
    project_id: safetyContract.project_id,
    platform: safetyContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_state: ready ? "passed" : "blocked",
    required_artifacts: {
      controlled_runtime_implementation_boundary_safety_contract_validated: true,
      controlled_runtime_implementation_boundary_request_validated: true,
    },
    dry_run_scope: scope(readyForNext),
    dry_run_checks: dryRunChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createControlledRuntimeImplementationBoundaryDryRun",
      source_controlled_runtime_implementation_boundary_safety_contract_id: safetyContract.controlled_runtime_implementation_boundary_safety_contract_id,
      source_render_plan_id: safetyContract.render_plan_id,
    },
  };
}

export function revokeControlledRuntimeImplementationBoundaryRequest(request: ControlledRuntimeImplementationBoundaryRequest, reason?: string): ControlledRuntimeImplementationBoundaryRequest {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation boundary request was revoked.");
  return { ...request, boundary_request_state: "revoked", boundary_scope: scope(false), validation: validation(false, false, request.validation.blocking_reasons, [...request.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...request.provenance, generated_by: "revokeControlledRuntimeImplementationBoundaryRequest" } };
}

export function revokeControlledRuntimeImplementationBoundarySafetyContract(contract: ControlledRuntimeImplementationBoundarySafetyContract, reason?: string): ControlledRuntimeImplementationBoundarySafetyContract {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation boundary safety contract was revoked.");
  return { ...contract, safety_contract_state: "revoked", contract_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeControlledRuntimeImplementationBoundarySafetyContract" } };
}

export function revokeControlledRuntimeImplementationBoundaryDryRun(dryRun: ControlledRuntimeImplementationBoundaryDryRun, reason?: string): ControlledRuntimeImplementationBoundaryDryRun {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation boundary dry-run was revoked.");
  return { ...dryRun, dry_run_state: "revoked", dry_run_scope: scope(false), dry_run_checks: dryRun.dry_run_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, dryRun.validation.blocking_reasons, [...dryRun.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...dryRun.provenance, generated_by: "revokeControlledRuntimeImplementationBoundaryDryRun" } };
}
