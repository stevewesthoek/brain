import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadExecutorContractTests } from "./real-upload-executor-contracts.js";

export type DryRunCheckKind =
  | "payload_shape_dry_run_check"
  | "credential_boundary_dry_run_check"
  | "network_boundary_dry_run_check"
  | "media_boundary_dry_run_check"
  | "response_redaction_dry_run_check"
  | "executor_orchestration_dry_run_check";

export type DryRunContractKind =
  | "payload_shape_dry_run_contract"
  | "credential_boundary_dry_run_contract"
  | "network_boundary_dry_run_contract"
  | "media_boundary_dry_run_contract"
  | "response_redaction_dry_run_contract"
  | "executor_orchestration_dry_run_contract";

export type DryRunAdapterDesignState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_dry_run_adapter_contracts" | "rejected" | "revoked";
export type DryRunAdapterDesignMode = "real_upload_dry_run_adapter_design_only" | "operator_review_real_upload_dry_run_adapter_design";
export type DryRunAdapterContractsState = "draft" | "ready_for_operator_review" | "approved_for_future_dry_run_adapter_contract_tests" | "rejected" | "revoked" | "blocked";
export type DryRunAdapterContractTestsState = "draft" | "tested" | "ready_for_operator_review" | "approved_for_final_operator_checklist" | "rejected" | "revoked" | "blocked";

export interface DisabledDryRunBoundary {
  ready_for_real_upload: false;
  real_upload_enabled: false;
  adapter_code_created: false;
  runtime_enabled: false;
  runtime_executed: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  platform_api_calls_allowed: false;
  network_calls_allowed: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_accessed: false;
  media_file_read: false;
  file_mutation_allowed: false;
  dependencies_added: false;
  package_metadata_changed: false;
}

export interface DryRunAdapterDesignReviewInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_design_only?: boolean;
  understands_no_adapter_code_created?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_platform_api_calls?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_media_reads?: boolean;
  understands_future_dry_run_adapter_contracts_required?: boolean;
  decision_note_summary?: string;
}

export interface PlannedDryRunCheck {
  check_id: string;
  check_kind: DryRunCheckKind;
  safe_summary: string;
  code_created: false;
  runtime_enabled: false;
  upload_enabled: false;
  network_enabled: false;
  platform_api_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  raw_payload_allowed: false;
  raw_response_allowed: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface DryRunAdapterContractRecord {
  contract_id: string;
  contract_kind: DryRunContractKind;
  safe_summary: string;
  contract_defined: boolean;
  code_created: false;
  runtime_enabled: false;
  upload_enabled: false;
  network_enabled: false;
  platform_api_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  raw_payload_allowed: false;
  raw_response_allowed: false;
}

export interface DryRunAdapterContractTestResult {
  test_id: string;
  contract_kind: DryRunContractKind;
  test_state: "passed" | "failed" | "blocked" | "deferred";
  safe_summary: string;
  contract_shape_checked: boolean;
  code_created: false;
  runtime_enabled: false;
  upload_enabled: false;
  network_enabled: false;
  platform_api_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  raw_payload_allowed: false;
  raw_response_allowed: false;
}

export interface RealUploadDryRunAdapterDesign {
  schema_version: "1.0";
  real_upload_dry_run_adapter_design_id: string;
  real_upload_executor_contract_tests_id: string;
  real_upload_executor_contracts_id: string;
  real_upload_executor_adapter_design_id: string;
  real_upload_readiness_gate_v2_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_adapter_design_state: DryRunAdapterDesignState;
  dry_run_adapter_design_mode: DryRunAdapterDesignMode;
  required_artifacts: { real_upload_executor_contract_tests_validated: true; real_upload_executor_contracts_validated: true; real_upload_executor_adapter_design_validated: true; real_upload_readiness_gate_v2_validated: true };
  design_scope: { future_dry_run_adapter_contracts_requested: boolean; dry_run_adapter_design_only: true; adapter_code_created: false; runtime_enabled: false; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  dry_run_adapter_boundaries: { local_simulation_only: true; no_real_network_required: true; no_credentials_required: true; no_media_read_required: true; safe_payload_summary_only: true; safe_response_summary_only: true; real_upload_still_blocked: true };
  planned_dry_run_checks: PlannedDryRunCheck[];
  operator_review: Required<DryRunAdapterDesignReviewInput>;
  execution_boundary: DisabledDryRunBoundary;
  validation: { dry_run_adapter_design_complete: boolean; ready_for_future_dry_run_adapter_contracts: boolean; ready_for_real_upload: false; real_upload_enabled: false; adapter_code_created: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadDryRunAdapterDesign" | "revokeRealUploadDryRunAdapterDesign"; source_real_upload_executor_contract_tests_id: string; source_real_upload_executor_contracts_id: string; source_real_upload_executor_adapter_design_id: string; source_real_upload_readiness_gate_v2_id: string; source_render_plan_id: string };
}

export interface RealUploadDryRunAdapterContracts {
  schema_version: "1.0";
  real_upload_dry_run_adapter_contracts_id: string;
  real_upload_dry_run_adapter_design_id: string;
  real_upload_executor_contract_tests_id: string;
  real_upload_executor_contracts_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_adapter_contracts_state: DryRunAdapterContractsState;
  required_artifacts: { real_upload_dry_run_adapter_design_validated: true; real_upload_executor_contract_tests_validated: true; real_upload_executor_contracts_validated: true };
  contracts_scope: { dry_run_adapter_contracts_only: true; future_dry_run_adapter_contract_tests_requested: boolean; adapter_code_created: false; runtime_enabled: false; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  dry_run_adapter_contracts: DryRunAdapterContractRecord[];
  execution_boundary: DisabledDryRunBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; real_upload_enabled: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadDryRunAdapterContracts" | "revokeRealUploadDryRunAdapterContracts"; source_real_upload_dry_run_adapter_design_id: string; source_render_plan_id: string };
}

export interface RealUploadDryRunAdapterContractTests {
  schema_version: "1.0";
  real_upload_dry_run_adapter_contract_tests_id: string;
  real_upload_dry_run_adapter_contracts_id: string;
  real_upload_dry_run_adapter_design_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  dry_run_adapter_contract_tests_state: DryRunAdapterContractTestsState;
  required_artifacts: { real_upload_dry_run_adapter_contracts_validated: true; real_upload_dry_run_adapter_design_validated: true };
  contract_tests_scope: { dry_run_adapter_contract_tests_only: true; future_final_operator_checklist_requested: boolean; adapter_code_created: false; runtime_enabled: false; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  dry_run_contract_test_results: DryRunAdapterContractTestResult[];
  execution_boundary: DisabledDryRunBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; real_upload_enabled: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadDryRunAdapterContractTests" | "revokeRealUploadDryRunAdapterContractTests"; source_real_upload_dry_run_adapter_contracts_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledDryRunBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  adapter_code_created: false,
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

const DRY_RUN_ITEMS: Array<{ id: string; checkKind: DryRunCheckKind; contractKind: DryRunContractKind; checkSummary: string; contractSummary: string; testSummary: string }> = [
  { id: "payload", checkKind: "payload_shape_dry_run_check", contractKind: "payload_shape_dry_run_contract", checkSummary: "Payload shape dry-run check only.", contractSummary: "Payload dry-run contract only.", testSummary: "Payload dry-run contract shape checked." },
  { id: "credential", checkKind: "credential_boundary_dry_run_check", contractKind: "credential_boundary_dry_run_contract", checkSummary: "Credential boundary dry-run check only.", contractSummary: "Credential dry-run contract only.", testSummary: "Credential dry-run contract shape checked." },
  { id: "network", checkKind: "network_boundary_dry_run_check", contractKind: "network_boundary_dry_run_contract", checkSummary: "Network boundary dry-run check only.", contractSummary: "Network dry-run contract only.", testSummary: "Network dry-run contract shape checked." },
  { id: "media", checkKind: "media_boundary_dry_run_check", contractKind: "media_boundary_dry_run_contract", checkSummary: "Media boundary dry-run check only.", contractSummary: "Media dry-run contract only.", testSummary: "Media dry-run contract shape checked." },
  { id: "response", checkKind: "response_redaction_dry_run_check", contractKind: "response_redaction_dry_run_contract", checkSummary: "Response redaction dry-run check only.", contractSummary: "Response redaction dry-run contract only.", testSummary: "Response dry-run contract shape checked." },
  { id: "orchestration", checkKind: "executor_orchestration_dry_run_check", contractKind: "executor_orchestration_dry_run_contract", checkSummary: "Executor orchestration dry-run check only.", contractSummary: "Executor orchestration dry-run contract only.", testSummary: "Orchestration dry-run contract shape checked." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function contractTestsReady(tests: RealUploadExecutorContractTests): boolean {
  return (
    (tests.executor_contract_tests_state === "ready_for_operator_review" || tests.executor_contract_tests_state === "approved_for_future_dry_run_adapter_design") &&
    tests.validation.executor_contract_tests_complete &&
    tests.validation.ready_for_future_dry_run_adapter_design &&
    !tests.validation.ready_for_real_upload &&
    !tests.validation.real_upload_enabled &&
    !tests.validation.adapter_code_created &&
    !tests.validation.upload_allowed &&
    !tests.validation.network_calls_allowed &&
    !tests.validation.platform_api_calls_allowed &&
    !tests.validation.credentials_accessed &&
    !tests.validation.media_file_read
  );
}

function dryRunDesignReady(design: RealUploadDryRunAdapterDesign): boolean {
  return (design.dry_run_adapter_design_state === "ready_for_operator_review" || design.dry_run_adapter_design_state === "approved_for_future_dry_run_adapter_contracts") && design.validation.dry_run_adapter_design_complete && design.validation.ready_for_future_dry_run_adapter_contracts;
}

function dryRunContractsReady(contracts: RealUploadDryRunAdapterContracts): boolean {
  return (contracts.dry_run_adapter_contracts_state === "ready_for_operator_review" || contracts.dry_run_adapter_contracts_state === "approved_for_future_dry_run_adapter_contract_tests") && contracts.validation.complete && contracts.validation.ready_for_next_phase && contracts.dry_run_adapter_contracts.every((contract) => contract.contract_defined);
}

function normalizeReview(input: DryRunAdapterDesignReviewInput = {}): Required<DryRunAdapterDesignReviewInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_design_only: input.understands_design_only === true,
    understands_no_adapter_code_created: input.understands_no_adapter_code_created === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_future_dry_run_adapter_contracts_required: input.understands_future_dry_run_adapter_contracts_required === true,
    decision_note_summary: safe(input.decision_note_summary, "Dry-run adapter design only. Real upload remains disabled."),
  };
}

function reviewComplete(review: Required<DryRunAdapterDesignReviewInput>): boolean {
  return review.checklist_acknowledged && review.understands_design_only && review.understands_no_adapter_code_created && review.understands_real_upload_not_enabled && review.understands_no_network_calls && review.understands_no_platform_api_calls && review.understands_no_credentials_accessed && review.understands_no_media_reads && review.understands_future_dry_run_adapter_contracts_required;
}

function blockingReasons(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Dry-run prerequisite was not validated.")))];
}

function plannedChecks(reasons: string[]): PlannedDryRunCheck[] {
  return DRY_RUN_ITEMS.map((item) => ({
    check_id: `dry-run-check-${item.id}`,
    check_kind: item.checkKind,
    safe_summary: sanitizeSafeSummary(item.checkSummary, "Dry-run check only."),
    code_created: false,
    runtime_enabled: false,
    upload_enabled: false,
    network_enabled: false,
    platform_api_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    raw_payload_allowed: false,
    raw_response_allowed: false,
    blocking_reasons: reasons,
    warnings: [],
  }));
}

function dryRunContracts(defined: boolean): DryRunAdapterContractRecord[] {
  return DRY_RUN_ITEMS.map((item) => ({
    contract_id: `dry-run-contract-${item.id}`,
    contract_kind: item.contractKind,
    safe_summary: sanitizeSafeSummary(item.contractSummary, "Dry-run contract only."),
    contract_defined: defined,
    code_created: false,
    runtime_enabled: false,
    upload_enabled: false,
    network_enabled: false,
    platform_api_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    raw_payload_allowed: false,
    raw_response_allowed: false,
  }));
}

function dryRunContractTests(contracts: RealUploadDryRunAdapterContracts, passed: boolean): DryRunAdapterContractTestResult[] {
  return contracts.dry_run_adapter_contracts.map((contract) => ({
    test_id: contract.contract_id.replace("dry-run-contract-", "dry-run-test-"),
    contract_kind: contract.contract_kind,
    test_state: passed ? "passed" : "blocked",
    safe_summary: sanitizeSafeSummary(DRY_RUN_ITEMS.find((item) => item.contractKind === contract.contract_kind)?.testSummary, "Dry-run contract shape checked."),
    contract_shape_checked: passed,
    code_created: false,
    runtime_enabled: false,
    upload_enabled: false,
    network_enabled: false,
    platform_api_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    raw_payload_allowed: false,
    raw_response_allowed: false,
  }));
}

export function createRealUploadDryRunAdapterDesign(
  contractTests: RealUploadExecutorContractTests,
  options: { id?: string; created_at?: string; mode?: DryRunAdapterDesignMode; requestFutureDryRunAdapterContracts?: boolean; operatorReview?: DryRunAdapterDesignReviewInput } = {},
): RealUploadDryRunAdapterDesign {
  const ready = contractTestsReady(contractTests);
  const reasons = blockingReasons(ready, "Executor contract tests were not ready for dry-run adapter design.", contractTests.validation.blocking_reasons);
  const review = normalizeReview(options.operatorReview);
  const mode = options.mode ?? "real_upload_dry_run_adapter_design_only";
  const requestContracts = options.requestFutureDryRunAdapterContracts !== false;
  let state: DryRunAdapterDesignState = "blocked";
  if (ready && mode === "operator_review_real_upload_dry_run_adapter_design" && reviewComplete(review) && requestContracts) state = "approved_for_future_dry_run_adapter_contracts";
  else if (ready) state = "ready_for_operator_review";
  const complete = ready && state !== "blocked";
  return {
    schema_version: "1.0",
    real_upload_dry_run_adapter_design_id: safe(options.id, "real-upload-dry-run-adapter-design-001"),
    real_upload_executor_contract_tests_id: contractTests.real_upload_executor_contract_tests_id,
    real_upload_executor_contracts_id: contractTests.real_upload_executor_contracts_id,
    real_upload_executor_adapter_design_id: contractTests.real_upload_executor_adapter_design_id,
    real_upload_readiness_gate_v2_id: contractTests.real_upload_readiness_gate_v2_id,
    render_plan_id: contractTests.render_plan_id,
    project_id: contractTests.project_id,
    platform: contractTests.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_adapter_design_state: state,
    dry_run_adapter_design_mode: mode,
    required_artifacts: { real_upload_executor_contract_tests_validated: true, real_upload_executor_contracts_validated: true, real_upload_executor_adapter_design_validated: true, real_upload_readiness_gate_v2_validated: true },
    design_scope: { future_dry_run_adapter_contracts_requested: requestContracts, dry_run_adapter_design_only: true, adapter_code_created: false, runtime_enabled: false, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    dry_run_adapter_boundaries: { local_simulation_only: true, no_real_network_required: true, no_credentials_required: true, no_media_read_required: true, safe_payload_summary_only: true, safe_response_summary_only: true, real_upload_still_blocked: true },
    planned_dry_run_checks: plannedChecks(reasons),
    operator_review: review,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { dry_run_adapter_design_complete: complete, ready_for_future_dry_run_adapter_contracts: complete && requestContracts, ready_for_real_upload: false, real_upload_enabled: false, adapter_code_created: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadDryRunAdapterDesign", source_real_upload_executor_contract_tests_id: contractTests.real_upload_executor_contract_tests_id, source_real_upload_executor_contracts_id: contractTests.real_upload_executor_contracts_id, source_real_upload_executor_adapter_design_id: contractTests.real_upload_executor_adapter_design_id, source_real_upload_readiness_gate_v2_id: contractTests.real_upload_readiness_gate_v2_id, source_render_plan_id: contractTests.render_plan_id },
  };
}

export function createRealUploadDryRunAdapterContracts(
  design: RealUploadDryRunAdapterDesign,
  options: { id?: string; created_at?: string; requestFutureDryRunAdapterContractTests?: boolean; approveForFutureContractTests?: boolean } = {},
): RealUploadDryRunAdapterContracts {
  const ready = dryRunDesignReady(design);
  const reasons = blockingReasons(ready, "Dry-run adapter design was not ready for dry-run adapter contracts.", design.validation.blocking_reasons);
  const requestTests = options.requestFutureDryRunAdapterContractTests !== false;
  const complete = ready;
  return {
    schema_version: "1.0",
    real_upload_dry_run_adapter_contracts_id: safe(options.id, "real-upload-dry-run-adapter-contracts-001"),
    real_upload_dry_run_adapter_design_id: design.real_upload_dry_run_adapter_design_id,
    real_upload_executor_contract_tests_id: design.real_upload_executor_contract_tests_id,
    real_upload_executor_contracts_id: design.real_upload_executor_contracts_id,
    render_plan_id: design.render_plan_id,
    project_id: design.project_id,
    platform: design.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_adapter_contracts_state: ready && options.approveForFutureContractTests !== false ? "approved_for_future_dry_run_adapter_contract_tests" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { real_upload_dry_run_adapter_design_validated: true, real_upload_executor_contract_tests_validated: true, real_upload_executor_contracts_validated: true },
    contracts_scope: { dry_run_adapter_contracts_only: true, future_dry_run_adapter_contract_tests_requested: requestTests, adapter_code_created: false, runtime_enabled: false, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    dry_run_adapter_contracts: dryRunContracts(complete),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete, ready_for_next_phase: complete && requestTests, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadDryRunAdapterContracts", source_real_upload_dry_run_adapter_design_id: design.real_upload_dry_run_adapter_design_id, source_render_plan_id: design.render_plan_id },
  };
}

export function createRealUploadDryRunAdapterContractTests(
  contracts: RealUploadDryRunAdapterContracts,
  options: { id?: string; created_at?: string; requestFutureFinalOperatorChecklist?: boolean; approveForFinalOperatorChecklist?: boolean } = {},
): RealUploadDryRunAdapterContractTests {
  const ready = dryRunContractsReady(contracts);
  const reasons = blockingReasons(ready, "Dry-run adapter contracts were not ready for dry-run contract tests.", contracts.validation.blocking_reasons);
  const requestChecklist = options.requestFutureFinalOperatorChecklist !== false;
  const complete = ready;
  return {
    schema_version: "1.0",
    real_upload_dry_run_adapter_contract_tests_id: safe(options.id, "real-upload-dry-run-adapter-contract-tests-001"),
    real_upload_dry_run_adapter_contracts_id: contracts.real_upload_dry_run_adapter_contracts_id,
    real_upload_dry_run_adapter_design_id: contracts.real_upload_dry_run_adapter_design_id,
    render_plan_id: contracts.render_plan_id,
    project_id: contracts.project_id,
    platform: contracts.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    dry_run_adapter_contract_tests_state: ready && options.approveForFinalOperatorChecklist !== false ? "approved_for_final_operator_checklist" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { real_upload_dry_run_adapter_contracts_validated: true, real_upload_dry_run_adapter_design_validated: true },
    contract_tests_scope: { dry_run_adapter_contract_tests_only: true, future_final_operator_checklist_requested: requestChecklist, adapter_code_created: false, runtime_enabled: false, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    dry_run_contract_test_results: dryRunContractTests(contracts, complete),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete, ready_for_next_phase: complete && requestChecklist, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadDryRunAdapterContractTests", source_real_upload_dry_run_adapter_contracts_id: contracts.real_upload_dry_run_adapter_contracts_id, source_render_plan_id: contracts.render_plan_id },
  };
}

export function revokeRealUploadDryRunAdapterDesign(design: RealUploadDryRunAdapterDesign, reason?: string): RealUploadDryRunAdapterDesign {
  const warning = sanitizeSafeSummary(reason, "Dry-run adapter design was revoked.");
  return { ...design, dry_run_adapter_design_state: "revoked", validation: { ...design.validation, dry_run_adapter_design_complete: false, ready_for_future_dry_run_adapter_contracts: false, warnings: [...design.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...design.provenance, generated_by: "revokeRealUploadDryRunAdapterDesign" } };
}

export function revokeRealUploadDryRunAdapterContracts(contracts: RealUploadDryRunAdapterContracts, reason?: string): RealUploadDryRunAdapterContracts {
  const warning = sanitizeSafeSummary(reason, "Dry-run adapter contracts were revoked.");
  return { ...contracts, dry_run_adapter_contracts_state: "revoked", validation: { ...contracts.validation, complete: false, ready_for_next_phase: false, warnings: [...contracts.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contracts.provenance, generated_by: "revokeRealUploadDryRunAdapterContracts" } };
}

export function revokeRealUploadDryRunAdapterContractTests(tests: RealUploadDryRunAdapterContractTests, reason?: string): RealUploadDryRunAdapterContractTests {
  const warning = sanitizeSafeSummary(reason, "Dry-run adapter contract tests were revoked.");
  return { ...tests, dry_run_adapter_contract_tests_state: "revoked", dry_run_contract_test_results: tests.dry_run_contract_test_results.map((result) => ({ ...result, test_state: "blocked" })), validation: { ...tests.validation, complete: false, ready_for_next_phase: false, warnings: [...tests.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...tests.provenance, generated_by: "revokeRealUploadDryRunAdapterContractTests" } };
}
