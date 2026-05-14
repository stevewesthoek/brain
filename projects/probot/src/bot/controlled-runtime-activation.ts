import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { ControlledRealUploadEnablement, ControlledRealUploadEnablementPreflightResult } from "./controlled-real-upload-enablement.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

export type ControlledRuntimeActivationRequestState = "draft" | "ready_for_operator_review" | "approved_for_future_runtime_activation_safety_contract" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationSafetyContractState = "draft" | "ready_for_operator_review" | "approved_for_future_runtime_activation_dry_run" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeActivationDryRunState = "draft" | "passed" | "failed" | "blocked" | "revoked";
export type ControlledRuntimeActivationCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface ControlledRuntimeActivationScope {
  artifact_only: true;
  future_next_phase_requested: boolean;
  real_upload_enabled_now: false;
  upload_execution_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  credential_access_enabled_now: false;
  media_read_enabled_now: false;
  dependencies_requested: false;
  package_metadata_changes_requested: false;
}

export interface ControlledRuntimeActivationValidation {
  complete: boolean;
  ready_for_next_phase: boolean;
  ready_for_real_upload: false;
  real_upload_enabled: false;
  upload_allowed: false;
  network_calls_allowed: false;
  platform_api_calls_allowed: false;
  credentials_accessed: false;
  media_file_read: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RuntimeSafetyContractRecord {
  contract_id: string;
  contract_kind: string;
  safe_summary: string;
  enabled_now: false;
}

export interface RuntimeActivationDryRunCheck {
  check_id: string;
  check_kind: string;
  check_state: ControlledRuntimeActivationCheckState;
  safe_summary: string;
  enabled_now: false;
}

export interface ControlledRuntimeActivationRequest {
  schema_version: "1.0";
  controlled_runtime_activation_request_id: string;
  controlled_real_upload_enablement_preflight_result_id: string;
  controlled_real_upload_enablement_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  activation_request_state: ControlledRuntimeActivationRequestState;
  required_artifacts: {
    controlled_real_upload_enablement_preflight_result_validated: true;
    controlled_real_upload_enablement_validated: true;
  };
  activation_request_scope: ControlledRuntimeActivationScope;
  requested_runtime_controls: {
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    dry_run_first_required: true;
    runtime_activation_contract_required: true;
    runtime_activation_dry_run_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationRequest" | "revokeControlledRuntimeActivationRequest";
    source_controlled_real_upload_enablement_preflight_result_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationSafetyContract {
  schema_version: "1.0";
  controlled_runtime_activation_safety_contract_id: string;
  controlled_runtime_activation_request_id: string;
  controlled_real_upload_enablement_preflight_result_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safety_contract_state: ControlledRuntimeActivationSafetyContractState;
  required_artifacts: {
    controlled_runtime_activation_request_validated: true;
    controlled_real_upload_enablement_preflight_result_validated: true;
  };
  safety_contract_scope: ControlledRuntimeActivationScope;
  runtime_safety_controls: {
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    dry_run_first_required: true;
    safe_reporting_required: true;
    raw_payload_storage_allowed: false;
    raw_response_storage_allowed: false;
    real_upload_still_blocked: true;
  };
  runtime_safety_contracts: RuntimeSafetyContractRecord[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationSafetyContract" | "revokeControlledRuntimeActivationSafetyContract";
    source_controlled_runtime_activation_request_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeActivationDryRunResult {
  schema_version: "1.0";
  controlled_runtime_activation_dry_run_result_id: string;
  controlled_runtime_activation_safety_contract_id: string;
  controlled_runtime_activation_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_state: ControlledRuntimeActivationDryRunState;
  required_artifacts: {
    controlled_runtime_activation_safety_contract_validated: true;
    controlled_runtime_activation_request_validated: true;
  };
  dry_run_scope: ControlledRuntimeActivationScope;
  dry_run_checks: RuntimeActivationDryRunCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeActivationDryRunResult" | "revokeControlledRuntimeActivationDryRunResult";
    source_controlled_runtime_activation_safety_contract_id: string;
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

const RUNTIME_SAFETY_ITEMS: Array<{ id: string; kind: string; contractSummary: string; dryRunSummary: string }> = [
  { id: "kill-switch", kind: "kill_switch", contractSummary: "Kill switch contract only.", dryRunSummary: "Kill switch dry-run only." },
  { id: "single-upload", kind: "single_upload_limit", contractSummary: "Single upload limit contract only.", dryRunSummary: "Single upload dry-run only." },
  { id: "credential", kind: "credential_boundary", contractSummary: "Credential boundary contract only.", dryRunSummary: "Credential boundary dry-run only." },
  { id: "network", kind: "network_boundary", contractSummary: "Network boundary contract only.", dryRunSummary: "Network boundary dry-run only." },
  { id: "media", kind: "media_boundary", contractSummary: "Media boundary contract only.", dryRunSummary: "Media boundary dry-run only." },
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

function preflightReady(preflight: ControlledRealUploadEnablementPreflightResult): boolean {
  return (
    preflight.preflight_state === "passed" &&
    preflight.validation.complete === true &&
    preflight.validation.ready_for_next_phase === true &&
    preflight.validation.ready_for_real_upload === false &&
    preflight.validation.real_upload_enabled === false &&
    preflight.validation.upload_allowed === false &&
    preflight.validation.network_calls_allowed === false &&
    preflight.validation.platform_api_calls_allowed === false &&
    preflight.validation.credentials_accessed === false &&
    preflight.validation.media_file_read === false &&
    preflight.preflight_checks.length >= 5 &&
    preflight.preflight_checks.every((check) => check.check_state === "passed" && check.enabled_now === false)
  );
}

function enablementReady(enablement: ControlledRealUploadEnablement): boolean {
  return (
    enablement.enablement_state === "approved_for_future_enablement_preflight" &&
    enablement.validation.complete === true &&
    enablement.validation.ready_for_next_phase === true &&
    enablement.controlled_enablement_controls.single_upload_limit === 1 &&
    enablement.controlled_enablement_controls.operator_kill_switch_required === true &&
    enablement.controlled_enablement_controls.real_upload_still_blocked === true &&
    enablement.execution_boundary.real_upload_enabled === false &&
    enablement.execution_boundary.runtime_enabled === false &&
    enablement.execution_boundary.upload_allowed === false &&
    enablement.execution_boundary.network_calls_allowed === false &&
    enablement.execution_boundary.credentials_accessed === false &&
    enablement.execution_boundary.media_file_read === false
  );
}

function requestReady(request: ControlledRuntimeActivationRequest): boolean {
  return (
    request.activation_request_state === "approved_for_future_runtime_activation_safety_contract" &&
    request.validation.complete === true &&
    request.validation.ready_for_next_phase === true &&
    request.requested_runtime_controls.runtime_activation_contract_required === true &&
    request.requested_runtime_controls.runtime_activation_dry_run_required === true &&
    request.requested_runtime_controls.real_upload_still_blocked === true
  );
}

function safetyContractReady(contract: ControlledRuntimeActivationSafetyContract): boolean {
  return (
    contract.safety_contract_state === "approved_for_future_runtime_activation_dry_run" &&
    contract.validation.complete === true &&
    contract.validation.ready_for_next_phase === true &&
    contract.runtime_safety_controls.raw_payload_storage_allowed === false &&
    contract.runtime_safety_controls.raw_response_storage_allowed === false &&
    contract.runtime_safety_controls.real_upload_still_blocked === true &&
    contract.runtime_safety_contracts.length >= 5 &&
    contract.runtime_safety_contracts.every((item) => item.enabled_now === false)
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime activation prerequisite was not validated.")))];
}

function runtimeSafetyContracts(): RuntimeSafetyContractRecord[] {
  return RUNTIME_SAFETY_ITEMS.map((item) => ({
    contract_id: `runtime-safety-${sanitizeSafeSummary(item.id, "contract")}`,
    contract_kind: sanitizeSafeSummary(item.kind, "runtime_safety_contract"),
    safe_summary: sanitizeSafeSummary(item.contractSummary, "Runtime safety contract only."),
    enabled_now: false,
  }));
}

function runtimeDryRunChecks(passed: boolean): RuntimeActivationDryRunCheck[] {
  return RUNTIME_SAFETY_ITEMS.map((item) => ({
    check_id: `runtime-dry-run-${sanitizeSafeSummary(item.id, "check")}`,
    check_kind: sanitizeSafeSummary(item.kind, "runtime_activation_dry_run_check"),
    check_state: passed ? "passed" : "blocked",
    safe_summary: sanitizeSafeSummary(item.dryRunSummary, "Runtime activation dry-run only."),
    enabled_now: false,
  }));
}

export function createControlledRuntimeActivationRequest(
  preflight: ControlledRealUploadEnablementPreflightResult,
  enablement: ControlledRealUploadEnablement,
  options: { id?: string; created_at?: string; requestFutureSafetyContract?: boolean } = {},
): ControlledRuntimeActivationRequest {
  const ready = preflightReady(preflight) && enablementReady(enablement);
  const requestSafetyContract = options.requestFutureSafetyContract !== false;
  const complete = ready;
  const readyForNext = complete && requestSafetyContract;
  const reasons = blocking(ready, "Controlled enablement preflight or enablement was not ready for runtime activation request.", [...preflight.validation.blocking_reasons, ...enablement.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_request_id: safe(options.id, "controlled-runtime-activation-request-001"),
    controlled_real_upload_enablement_preflight_result_id: preflight.controlled_real_upload_enablement_preflight_result_id,
    controlled_real_upload_enablement_id: enablement.controlled_real_upload_enablement_id,
    render_plan_id: preflight.render_plan_id,
    project_id: preflight.project_id,
    platform: preflight.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    activation_request_state: readyForNext ? "approved_for_future_runtime_activation_safety_contract" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_real_upload_enablement_preflight_result_validated: true,
      controlled_real_upload_enablement_validated: true,
    },
    activation_request_scope: scope(readyForNext),
    requested_runtime_controls: {
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      dry_run_first_required: true,
      runtime_activation_contract_required: true,
      runtime_activation_dry_run_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationRequest",
      source_controlled_real_upload_enablement_preflight_result_id: preflight.controlled_real_upload_enablement_preflight_result_id,
      source_render_plan_id: preflight.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationSafetyContract(
  request: ControlledRuntimeActivationRequest,
  preflight: ControlledRealUploadEnablementPreflightResult,
  options: { id?: string; created_at?: string; requestFutureDryRun?: boolean } = {},
): ControlledRuntimeActivationSafetyContract {
  const ready = requestReady(request) && preflightReady(preflight);
  const requestDryRun = options.requestFutureDryRun !== false;
  const complete = ready;
  const readyForNext = complete && requestDryRun;
  const reasons = blocking(ready, "Controlled runtime activation request or preflight was not ready for safety contract.", [...request.validation.blocking_reasons, ...preflight.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_safety_contract_id: safe(options.id, "controlled-runtime-activation-safety-contract-001"),
    controlled_runtime_activation_request_id: request.controlled_runtime_activation_request_id,
    controlled_real_upload_enablement_preflight_result_id: preflight.controlled_real_upload_enablement_preflight_result_id,
    render_plan_id: request.render_plan_id,
    project_id: request.project_id,
    platform: request.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safety_contract_state: readyForNext ? "approved_for_future_runtime_activation_dry_run" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_runtime_activation_request_validated: true,
      controlled_real_upload_enablement_preflight_result_validated: true,
    },
    safety_contract_scope: scope(readyForNext),
    runtime_safety_controls: {
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      dry_run_first_required: true,
      safe_reporting_required: true,
      raw_payload_storage_allowed: false,
      raw_response_storage_allowed: false,
      real_upload_still_blocked: true,
    },
    runtime_safety_contracts: runtimeSafetyContracts(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationSafetyContract",
      source_controlled_runtime_activation_request_id: request.controlled_runtime_activation_request_id,
      source_render_plan_id: request.render_plan_id,
    },
  };
}

export function createControlledRuntimeActivationDryRunResult(
  safetyContract: ControlledRuntimeActivationSafetyContract,
  request: ControlledRuntimeActivationRequest,
  options: { id?: string; created_at?: string; requestFutureActivationCandidate?: boolean } = {},
): ControlledRuntimeActivationDryRunResult {
  const ready = safetyContractReady(safetyContract) && requestReady(request);
  const requestCandidate = options.requestFutureActivationCandidate !== false;
  const complete = ready;
  const readyForNext = complete && requestCandidate;
  const reasons = blocking(ready, "Controlled runtime activation safety contract or request was not ready for dry-run.", [...safetyContract.validation.blocking_reasons, ...request.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_runtime_activation_dry_run_result_id: safe(options.id, "controlled-runtime-activation-dry-run-result-001"),
    controlled_runtime_activation_safety_contract_id: safetyContract.controlled_runtime_activation_safety_contract_id,
    controlled_runtime_activation_request_id: request.controlled_runtime_activation_request_id,
    render_plan_id: safetyContract.render_plan_id,
    project_id: safetyContract.project_id,
    platform: safetyContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_state: ready ? "passed" : "blocked",
    required_artifacts: {
      controlled_runtime_activation_safety_contract_validated: true,
      controlled_runtime_activation_request_validated: true,
    },
    dry_run_scope: scope(readyForNext),
    dry_run_checks: runtimeDryRunChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, reasons),
    provenance: {
      generated_by: "createControlledRuntimeActivationDryRunResult",
      source_controlled_runtime_activation_safety_contract_id: safetyContract.controlled_runtime_activation_safety_contract_id,
      source_render_plan_id: safetyContract.render_plan_id,
    },
  };
}

export function revokeControlledRuntimeActivationRequest(request: ControlledRuntimeActivationRequest, reason?: string): ControlledRuntimeActivationRequest {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation request was revoked.");
  return {
    ...request,
    activation_request_state: "revoked",
    activation_request_scope: scope(false),
    validation: validation(false, false, request.validation.blocking_reasons, [...request.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...request.provenance, generated_by: "revokeControlledRuntimeActivationRequest" },
  };
}

export function revokeControlledRuntimeActivationSafetyContract(contract: ControlledRuntimeActivationSafetyContract, reason?: string): ControlledRuntimeActivationSafetyContract {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation safety contract was revoked.");
  return {
    ...contract,
    safety_contract_state: "revoked",
    safety_contract_scope: scope(false),
    validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...contract.provenance, generated_by: "revokeControlledRuntimeActivationSafetyContract" },
  };
}

export function revokeControlledRuntimeActivationDryRunResult(result: ControlledRuntimeActivationDryRunResult, reason?: string): ControlledRuntimeActivationDryRunResult {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime activation dry-run result was revoked.");
  return {
    ...result,
    dry_run_state: "revoked",
    dry_run_scope: scope(false),
    dry_run_checks: result.dry_run_checks.map((check) => ({ ...check, check_state: "blocked" })),
    validation: validation(false, false, result.validation.blocking_reasons, [...result.validation.warnings, warning]),
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...result.provenance, generated_by: "revokeControlledRuntimeActivationDryRunResult" },
  };
}
