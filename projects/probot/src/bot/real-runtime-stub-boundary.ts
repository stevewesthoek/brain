import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type {
  ControlledRuntimeImplementationFinalBoundary,
  ControlledRuntimeImplementationFinalBoundarySafeReport,
  FinalBoundarySafeReportSection,
} from "./controlled-runtime-implementation-final-boundary.js";

export type RealRuntimeStubBoundaryRequestState = "draft" | "ready_for_operator_review" | "approved_for_future_stub_boundary_contract" | "rejected" | "revoked" | "blocked";
export type RealRuntimeStubBoundaryContractState = "draft" | "ready_for_operator_review" | "approved_for_future_stub_boundary_dry_run_report" | "rejected" | "revoked" | "blocked";
export type RealRuntimeStubBoundaryDryRunReportState = "draft" | "passed" | "failed" | "blocked" | "approved_for_future_noop_runtime_stub" | "revoked";
export type StubDryRunResultState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubContractItem {
  item_id: string;
  item_kind: string;
  safe_summary: string;
  implemented_now: false;
  runtime_executed_now: false;
}

export interface RuntimeStubDryRunResult {
  result_id: string;
  result_kind: string;
  result_state: StubDryRunResultState;
  safe_summary: string;
  implemented_now: false;
  runtime_executed_now: false;
}

export interface RealRuntimeStubBoundaryRequest {
  schema_version: "1.0";
  real_runtime_stub_boundary_request_id: string;
  controlled_runtime_implementation_final_boundary_safe_report_id: string;
  controlled_runtime_implementation_final_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  stub_boundary_request_state: RealRuntimeStubBoundaryRequestState;
  required_artifacts: {
    controlled_runtime_implementation_final_boundary_safe_report_validated: true;
    controlled_runtime_implementation_final_boundary_validated: true;
  };
  request_scope: ControlledRuntimeActivationScope;
  stub_controls: {
    stub_boundary_request_only: true;
    runtime_stub_only: true;
    no_op_runtime_required: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRealRuntimeStubBoundaryRequest" | "revokeRealRuntimeStubBoundaryRequest";
    source_controlled_runtime_implementation_final_boundary_safe_report_id: string;
    source_render_plan_id: string;
  };
}

export interface RealRuntimeStubBoundaryContract {
  schema_version: "1.0";
  real_runtime_stub_boundary_contract_id: string;
  real_runtime_stub_boundary_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  stub_contract_state: RealRuntimeStubBoundaryContractState;
  required_artifacts: { real_runtime_stub_boundary_request_validated: true };
  contract_scope: ControlledRuntimeActivationScope;
  stub_contract_controls: {
    contract_only: true;
    runtime_stub_only: true;
    no_op_runtime_required: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    raw_payload_storage_allowed: false;
    raw_response_storage_allowed: false;
    real_upload_still_blocked: true;
  };
  stub_contract_items: RuntimeStubContractItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRealRuntimeStubBoundaryContract" | "revokeRealRuntimeStubBoundaryContract";
    source_real_runtime_stub_boundary_request_id: string;
    source_render_plan_id: string;
  };
}

export interface RealRuntimeStubBoundaryDryRunReport {
  schema_version: "1.0";
  real_runtime_stub_boundary_dry_run_report_id: string;
  real_runtime_stub_boundary_contract_id: string;
  real_runtime_stub_boundary_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_report_state: RealRuntimeStubBoundaryDryRunReportState;
  required_artifacts: {
    real_runtime_stub_boundary_contract_validated: true;
    real_runtime_stub_boundary_request_validated: true;
  };
  dry_run_scope: ControlledRuntimeActivationScope;
  dry_run_results: RuntimeStubDryRunResult[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRealRuntimeStubBoundaryDryRunReport" | "revokeRealRuntimeStubBoundaryDryRunReport";
    source_real_runtime_stub_boundary_contract_id: string;
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

const ITEMS: Array<{ id: string; kind: string }> = [
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

function finalBoundaryReady(boundary: ControlledRuntimeImplementationFinalBoundary): boolean {
  return boundary.final_boundary_state === "approved_for_future_final_boundary_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && boundary.boundary_controls.safe_stub_only && boundary.boundary_controls.real_upload_still_blocked && boundary.boundary_items.length >= 5 && boundary.boundary_items.every((item) => item.implemented_now === false);
}

function finalSafeReportReady(report: ControlledRuntimeImplementationFinalBoundarySafeReport): boolean {
  return report.safe_report_state === "approved_for_future_real_runtime_stub_boundary" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section: FinalBoundarySafeReportSection) => !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function requestReady(request: RealRuntimeStubBoundaryRequest): boolean {
  return request.stub_boundary_request_state === "approved_for_future_stub_boundary_contract" && request.validation.complete && request.validation.ready_for_next_phase && request.stub_controls.stub_boundary_request_only && request.stub_controls.runtime_stub_only && request.stub_controls.no_op_runtime_required && request.stub_controls.real_upload_still_blocked;
}

function contractReady(contract: RealRuntimeStubBoundaryContract): boolean {
  return contract.stub_contract_state === "approved_for_future_stub_boundary_dry_run_report" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.stub_contract_controls.contract_only && contract.stub_contract_controls.runtime_stub_only && contract.stub_contract_controls.no_op_runtime_required && !contract.stub_contract_controls.raw_payload_storage_allowed && !contract.stub_contract_controls.raw_response_storage_allowed && contract.stub_contract_controls.real_upload_still_blocked && contract.stub_contract_items.length >= 5 && contract.stub_contract_items.every((item) => !item.implemented_now && !item.runtime_executed_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Real runtime stub boundary prerequisite was not validated.")))];
}

function contractItems(): RuntimeStubContractItem[] {
  return ITEMS.map((item) => ({
    item_id: `stub-contract-${sanitizeSafeSummary(item.id, "item")}`,
    item_kind: sanitizeSafeSummary(item.kind, "stub_contract_item"),
    safe_summary: "Stub contract only.",
    implemented_now: false,
    runtime_executed_now: false,
  }));
}

function dryRunResults(passed: boolean): RuntimeStubDryRunResult[] {
  return ITEMS.map((item) => ({
    result_id: `stub-dry-run-${sanitizeSafeSummary(item.id, "result")}`,
    result_kind: sanitizeSafeSummary(item.kind, "stub_dry_run_result"),
    result_state: passed ? "passed" : "blocked",
    safe_summary: "Stub dry-run only.",
    implemented_now: false,
    runtime_executed_now: false,
  }));
}

export function createRealRuntimeStubBoundaryRequest(
  finalSafeReport: ControlledRuntimeImplementationFinalBoundarySafeReport,
  finalBoundary: ControlledRuntimeImplementationFinalBoundary,
  options: { id?: string; created_at?: string; requestFutureStubBoundaryContract?: boolean } = {},
): RealRuntimeStubBoundaryRequest {
  const ready = finalSafeReportReady(finalSafeReport) && finalBoundaryReady(finalBoundary);
  const requestContract = options.requestFutureStubBoundaryContract !== false;
  const complete = ready;
  const readyForNext = complete && requestContract;
  const reasons = blocking(ready, "Final boundary safe report or final boundary was not ready for real runtime stub boundary request.", [...finalSafeReport.validation.blocking_reasons, ...finalBoundary.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    real_runtime_stub_boundary_request_id: safe(options.id, "real-runtime-stub-boundary-request-001"),
    controlled_runtime_implementation_final_boundary_safe_report_id: finalSafeReport.controlled_runtime_implementation_final_boundary_safe_report_id,
    controlled_runtime_implementation_final_boundary_id: finalBoundary.controlled_runtime_implementation_final_boundary_id,
    render_plan_id: finalSafeReport.render_plan_id,
    project_id: finalSafeReport.project_id,
    platform: finalSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    stub_boundary_request_state: readyForNext ? "approved_for_future_stub_boundary_contract" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      controlled_runtime_implementation_final_boundary_safe_report_validated: true,
      controlled_runtime_implementation_final_boundary_validated: true,
    },
    request_scope: scope(readyForNext),
    stub_controls: {
      stub_boundary_request_only: true,
      runtime_stub_only: true,
      no_op_runtime_required: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createRealRuntimeStubBoundaryRequest",
      source_controlled_runtime_implementation_final_boundary_safe_report_id: finalSafeReport.controlled_runtime_implementation_final_boundary_safe_report_id,
      source_render_plan_id: finalSafeReport.render_plan_id,
    },
  };
}

export function createRealRuntimeStubBoundaryContract(
  request: RealRuntimeStubBoundaryRequest,
  options: { id?: string; created_at?: string; requestFutureStubBoundaryDryRunReport?: boolean } = {},
): RealRuntimeStubBoundaryContract {
  const ready = requestReady(request);
  const requestDryRun = options.requestFutureStubBoundaryDryRunReport !== false;
  const complete = ready;
  const readyForNext = complete && requestDryRun;
  const reasons = blocking(ready, "Real runtime stub boundary request was not ready for stub boundary contract.", request.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    real_runtime_stub_boundary_contract_id: safe(options.id, "real-runtime-stub-boundary-contract-001"),
    real_runtime_stub_boundary_request_id: request.real_runtime_stub_boundary_request_id,
    render_plan_id: request.render_plan_id,
    project_id: request.project_id,
    platform: request.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    stub_contract_state: readyForNext ? "approved_for_future_stub_boundary_dry_run_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { real_runtime_stub_boundary_request_validated: true },
    contract_scope: scope(readyForNext),
    stub_contract_controls: {
      contract_only: true,
      runtime_stub_only: true,
      no_op_runtime_required: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      raw_payload_storage_allowed: false,
      raw_response_storage_allowed: false,
      real_upload_still_blocked: true,
    },
    stub_contract_items: contractItems(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createRealRuntimeStubBoundaryContract",
      source_real_runtime_stub_boundary_request_id: request.real_runtime_stub_boundary_request_id,
      source_render_plan_id: request.render_plan_id,
    },
  };
}

export function createRealRuntimeStubBoundaryDryRunReport(
  contract: RealRuntimeStubBoundaryContract,
  request: RealRuntimeStubBoundaryRequest,
  options: { id?: string; created_at?: string; requestFutureNoopRuntimeStub?: boolean } = {},
): RealRuntimeStubBoundaryDryRunReport {
  const ready = contractReady(contract) && requestReady(request);
  const requestNoopStub = options.requestFutureNoopRuntimeStub !== false;
  const complete = ready;
  const readyForNext = complete && requestNoopStub;
  const reasons = blocking(ready, "Real runtime stub boundary contract or request was not ready for dry-run report.", [...contract.validation.blocking_reasons, ...request.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    real_runtime_stub_boundary_dry_run_report_id: safe(options.id, "real-runtime-stub-boundary-dry-run-report-001"),
    real_runtime_stub_boundary_contract_id: contract.real_runtime_stub_boundary_contract_id,
    real_runtime_stub_boundary_request_id: request.real_runtime_stub_boundary_request_id,
    render_plan_id: contract.render_plan_id,
    project_id: contract.project_id,
    platform: contract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_report_state: readyForNext ? "approved_for_future_noop_runtime_stub" : ready ? "passed" : "blocked",
    required_artifacts: {
      real_runtime_stub_boundary_contract_validated: true,
      real_runtime_stub_boundary_request_validated: true,
    },
    dry_run_scope: scope(readyForNext),
    dry_run_results: dryRunResults(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: {
      generated_by: "createRealRuntimeStubBoundaryDryRunReport",
      source_real_runtime_stub_boundary_contract_id: contract.real_runtime_stub_boundary_contract_id,
      source_render_plan_id: contract.render_plan_id,
    },
  };
}

export function revokeRealRuntimeStubBoundaryRequest(request: RealRuntimeStubBoundaryRequest, reason?: string): RealRuntimeStubBoundaryRequest {
  const warning = sanitizeSafeSummary(reason, "Real runtime stub boundary request was revoked.");
  return { ...request, stub_boundary_request_state: "revoked", request_scope: scope(false), validation: validation(false, false, request.validation.blocking_reasons, [...request.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...request.provenance, generated_by: "revokeRealRuntimeStubBoundaryRequest" } };
}

export function revokeRealRuntimeStubBoundaryContract(contract: RealRuntimeStubBoundaryContract, reason?: string): RealRuntimeStubBoundaryContract {
  const warning = sanitizeSafeSummary(reason, "Real runtime stub boundary contract was revoked.");
  return { ...contract, stub_contract_state: "revoked", contract_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRealRuntimeStubBoundaryContract" } };
}

export function revokeRealRuntimeStubBoundaryDryRunReport(report: RealRuntimeStubBoundaryDryRunReport, reason?: string): RealRuntimeStubBoundaryDryRunReport {
  const warning = sanitizeSafeSummary(reason, "Real runtime stub boundary dry-run report was revoked.");
  return { ...report, dry_run_report_state: "revoked", dry_run_scope: scope(false), dry_run_results: report.dry_run_results.map((result) => ({ ...result, result_state: "blocked" })), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRealRuntimeStubBoundaryDryRunReport" } };
}
