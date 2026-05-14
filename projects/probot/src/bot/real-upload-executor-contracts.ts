import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadExecutorAdapterDesign } from "./real-upload-executor-adapter-design.js";

export type ExecutorContractKind =
  | "credential_boundary_contract"
  | "media_read_boundary_contract"
  | "payload_builder_contract"
  | "platform_client_contract"
  | "network_boundary_contract"
  | "response_redaction_contract"
  | "executor_orchestration_contract";

export type RealUploadExecutorContractsState = "draft" | "blocked" | "ready_for_operator_review" | "approved_for_future_executor_contract_tests" | "rejected" | "revoked";
export type RealUploadExecutorContractsMode = "real_upload_executor_contracts_only" | "operator_review_real_upload_executor_contracts";
export type RealUploadExecutorContractTestsState = "draft" | "blocked" | "tested" | "ready_for_operator_review" | "approved_for_future_dry_run_adapter_design" | "rejected" | "revoked";
export type RealUploadExecutorContractTestsMode = "real_upload_executor_contract_tests_only" | "operator_review_real_upload_executor_contract_tests";
export type ExecutorContractTestState = "planned" | "blocked" | "passed" | "failed" | "deferred";

export interface DisabledExecutorBoundary {
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

export interface ExecutorContractRecord {
  contract_id: string;
  contract_kind: ExecutorContractKind;
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
  blocking_reasons: string[];
  warnings: string[];
}

export interface ExecutorContractTestResult {
  test_id: string;
  contract_kind: ExecutorContractKind;
  test_state: ExecutorContractTestState;
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
  blocking_reasons: string[];
  warnings: string[];
}

export interface ExecutorContractsOperatorReviewInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_contracts_only?: boolean;
  understands_no_adapter_code_created?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_platform_api_calls?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_media_reads?: boolean;
  understands_future_executor_contract_tests_required?: boolean;
  decision_note_summary?: string;
}

export interface ExecutorContractTestsOperatorReviewInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_contract_tests_only?: boolean;
  understands_no_adapter_code_created?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_platform_api_calls?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_media_reads?: boolean;
  understands_future_dry_run_adapter_design_required?: boolean;
  decision_note_summary?: string;
}

export interface RealUploadExecutorContracts {
  schema_version: "1.0";
  real_upload_executor_contracts_id: string;
  real_upload_executor_adapter_design_id: string;
  real_upload_readiness_gate_v2_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  executor_contracts_state: RealUploadExecutorContractsState;
  executor_contracts_mode: RealUploadExecutorContractsMode;
  required_artifacts: { real_upload_executor_adapter_design_validated: true; real_upload_readiness_gate_v2_validated: true };
  contracts_scope: {
    future_executor_contract_tests_requested: boolean;
    executor_contracts_only: true;
    adapter_code_created: false;
    runtime_enabled: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  executor_contracts: ExecutorContractRecord[];
  operator_review: Required<ExecutorContractsOperatorReviewInput>;
  execution_boundary: DisabledExecutorBoundary;
  validation: {
    executor_contracts_complete: boolean;
    ready_for_future_executor_contract_tests: boolean;
    ready_for_real_upload: false;
    real_upload_enabled: false;
    adapter_code_created: false;
    upload_allowed: false;
    network_calls_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: { generated_by: "createRealUploadExecutorContracts" | "revokeRealUploadExecutorContracts"; source_real_upload_executor_adapter_design_id: string; source_real_upload_readiness_gate_v2_id: string; source_render_plan_id: string };
}

export interface RealUploadExecutorContractTests {
  schema_version: "1.0";
  real_upload_executor_contract_tests_id: string;
  real_upload_executor_contracts_id: string;
  real_upload_executor_adapter_design_id: string;
  real_upload_readiness_gate_v2_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  executor_contract_tests_state: RealUploadExecutorContractTestsState;
  executor_contract_tests_mode: RealUploadExecutorContractTestsMode;
  required_artifacts: { real_upload_executor_contracts_validated: true; real_upload_executor_adapter_design_validated: true; real_upload_readiness_gate_v2_validated: true };
  contract_tests_scope: {
    future_dry_run_adapter_design_requested: boolean;
    executor_contract_tests_only: true;
    adapter_code_created: false;
    runtime_enabled: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  executor_contract_test_results: ExecutorContractTestResult[];
  operator_review: Required<ExecutorContractTestsOperatorReviewInput>;
  execution_boundary: DisabledExecutorBoundary;
  validation: {
    executor_contract_tests_complete: boolean;
    ready_for_future_dry_run_adapter_design: boolean;
    ready_for_real_upload: false;
    real_upload_enabled: false;
    adapter_code_created: false;
    upload_allowed: false;
    network_calls_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: { generated_by: "createRealUploadExecutorContractTests" | "revokeRealUploadExecutorContractTests"; source_real_upload_executor_contracts_id: string; source_real_upload_executor_adapter_design_id: string; source_real_upload_readiness_gate_v2_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledExecutorBoundary = {
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

const CONTRACTS: Array<{ id: string; kind: ExecutorContractKind; summary: string; testSummary: string }> = [
  { id: "credential", kind: "credential_boundary_contract", summary: "Credential boundary contract only.", testSummary: "Credential boundary contract shape checked." },
  { id: "media", kind: "media_read_boundary_contract", summary: "Media read boundary contract only.", testSummary: "Media read boundary contract shape checked." },
  { id: "payload", kind: "payload_builder_contract", summary: "Payload builder contract only.", testSummary: "Payload builder contract shape checked." },
  { id: "platform-client", kind: "platform_client_contract", summary: "Platform client contract only.", testSummary: "Platform client contract shape checked." },
  { id: "network", kind: "network_boundary_contract", summary: "Network boundary contract only.", testSummary: "Network boundary contract shape checked." },
  { id: "response-redaction", kind: "response_redaction_contract", summary: "Response redaction contract only.", testSummary: "Response redaction contract shape checked." },
  { id: "orchestration", kind: "executor_orchestration_contract", summary: "Executor orchestration contract only.", testSummary: "Executor orchestration contract shape checked." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function designReady(design: RealUploadExecutorAdapterDesign): boolean {
  return (
    (design.executor_adapter_design_state === "ready_for_operator_review" || design.executor_adapter_design_state === "approved_for_future_executor_contracts") &&
    design.validation.executor_adapter_design_complete &&
    design.validation.ready_for_future_executor_contracts &&
    !design.validation.ready_for_real_upload &&
    !design.validation.real_upload_enabled &&
    !design.validation.adapter_code_created &&
    !design.validation.upload_allowed &&
    !design.validation.network_calls_allowed &&
    !design.validation.platform_api_calls_allowed &&
    !design.validation.credentials_accessed &&
    !design.validation.media_file_read
  );
}

function contractsReady(contracts: RealUploadExecutorContracts): boolean {
  return (
    (contracts.executor_contracts_state === "ready_for_operator_review" || contracts.executor_contracts_state === "approved_for_future_executor_contract_tests") &&
    contracts.validation.executor_contracts_complete &&
    contracts.validation.ready_for_future_executor_contract_tests &&
    contracts.executor_contracts.length >= 7 &&
    contracts.executor_contracts.every((contract) => contract.contract_defined && contract.code_created === false && contract.runtime_enabled === false && contract.upload_enabled === false && contract.network_enabled === false && contract.platform_api_enabled === false && contract.credential_access_enabled === false && contract.media_read_enabled === false && contract.raw_payload_allowed === false && contract.raw_response_allowed === false)
  );
}

function normalizeContractsReview(input: ExecutorContractsOperatorReviewInput = {}): Required<ExecutorContractsOperatorReviewInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_contracts_only: input.understands_contracts_only === true,
    understands_no_adapter_code_created: input.understands_no_adapter_code_created === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_future_executor_contract_tests_required: input.understands_future_executor_contract_tests_required === true,
    decision_note_summary: safe(input.decision_note_summary, "Executor contracts only. Real upload remains disabled."),
  };
}

function normalizeContractTestsReview(input: ExecutorContractTestsOperatorReviewInput = {}): Required<ExecutorContractTestsOperatorReviewInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_contract_tests_only: input.understands_contract_tests_only === true,
    understands_no_adapter_code_created: input.understands_no_adapter_code_created === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_future_dry_run_adapter_design_required: input.understands_future_dry_run_adapter_design_required === true,
    decision_note_summary: safe(input.decision_note_summary, "Executor contract tests only. Real upload remains disabled."),
  };
}

function contractsReviewComplete(review: Required<ExecutorContractsOperatorReviewInput>): boolean {
  return review.checklist_acknowledged && review.understands_contracts_only && review.understands_no_adapter_code_created && review.understands_real_upload_not_enabled && review.understands_no_network_calls && review.understands_no_platform_api_calls && review.understands_no_credentials_accessed && review.understands_no_media_reads && review.understands_future_executor_contract_tests_required;
}

function contractTestsReviewComplete(review: Required<ExecutorContractTestsOperatorReviewInput>): boolean {
  return review.checklist_acknowledged && review.understands_contract_tests_only && review.understands_no_adapter_code_created && review.understands_real_upload_not_enabled && review.understands_no_network_calls && review.understands_no_platform_api_calls && review.understands_no_credentials_accessed && review.understands_no_media_reads && review.understands_future_dry_run_adapter_design_required;
}

function blockingReasonsFromDesign(design: RealUploadExecutorAdapterDesign): string[] {
  const reasons = [...design.validation.blocking_reasons];
  if (!designReady(design)) reasons.push("Executor adapter design was not ready for executor contracts.");
  return [...new Set(reasons.map((reason) => sanitizeSafeSummary(reason, "Executor adapter design prerequisite was not validated.")))];
}

function blockingReasonsFromContracts(contracts: RealUploadExecutorContracts): string[] {
  const reasons = [...contracts.validation.blocking_reasons];
  if (!contractsReady(contracts)) reasons.push("Executor contracts were not ready for contract tests.");
  return [...new Set(reasons.map((reason) => sanitizeSafeSummary(reason, "Executor contracts prerequisite was not validated.")))];
}

function createContracts(defined: boolean, blockingReasons: string[]): ExecutorContractRecord[] {
  return CONTRACTS.map((contract) => ({
    contract_id: `executor-contract-${sanitizeSafeSummary(contract.id, "contract")}`,
    contract_kind: contract.kind,
    safe_summary: sanitizeSafeSummary(contract.summary, "Executor contract only."),
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
    blocking_reasons: blockingReasons,
    warnings: [],
  }));
}

function createContractTests(contracts: RealUploadExecutorContracts, passed: boolean, blockingReasons: string[]): ExecutorContractTestResult[] {
  return contracts.executor_contracts.map((contract) => ({
    test_id: `test-${contract.contract_id.replace(/^executor-contract-/, "")}`,
    contract_kind: contract.contract_kind,
    test_state: passed ? "passed" : "blocked",
    safe_summary: sanitizeSafeSummary(CONTRACTS.find((item) => item.kind === contract.contract_kind)?.testSummary, "Executor contract shape checked."),
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
    blocking_reasons: blockingReasons,
    warnings: [],
  }));
}

export function createRealUploadExecutorContracts(
  design: RealUploadExecutorAdapterDesign,
  options: { id?: string; created_at?: string; mode?: RealUploadExecutorContractsMode; requestFutureContractTests?: boolean; operatorReview?: ExecutorContractsOperatorReviewInput } = {},
): RealUploadExecutorContracts {
  const ready = designReady(design);
  const blockingReasons = blockingReasonsFromDesign(design);
  const review = normalizeContractsReview(options.operatorReview);
  const reviewReady = contractsReviewComplete(review);
  const mode = options.mode ?? "real_upload_executor_contracts_only";
  const requestTests = options.requestFutureContractTests !== false;
  let state: RealUploadExecutorContractsState = "blocked";
  if (ready && mode === "operator_review_real_upload_executor_contracts" && reviewReady && requestTests) state = "approved_for_future_executor_contract_tests";
  else if (ready) state = "ready_for_operator_review";
  const complete = ready && state !== "blocked";
  const reasons = ready ? [] : blockingReasons;
  return {
    schema_version: "1.0",
    real_upload_executor_contracts_id: safe(options.id, "real-upload-executor-contracts-001"),
    real_upload_executor_adapter_design_id: design.real_upload_executor_adapter_design_id,
    real_upload_readiness_gate_v2_id: design.real_upload_readiness_gate_v2_id,
    render_plan_id: design.render_plan_id,
    project_id: design.project_id,
    platform: design.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    executor_contracts_state: state,
    executor_contracts_mode: mode,
    required_artifacts: { real_upload_executor_adapter_design_validated: true, real_upload_readiness_gate_v2_validated: true },
    contracts_scope: { future_executor_contract_tests_requested: requestTests, executor_contracts_only: true, adapter_code_created: false, runtime_enabled: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    executor_contracts: createContracts(complete, reasons),
    operator_review: review,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { executor_contracts_complete: complete, ready_for_future_executor_contract_tests: complete && requestTests, ready_for_real_upload: false, real_upload_enabled: false, adapter_code_created: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadExecutorContracts", source_real_upload_executor_adapter_design_id: design.real_upload_executor_adapter_design_id, source_real_upload_readiness_gate_v2_id: design.real_upload_readiness_gate_v2_id, source_render_plan_id: design.render_plan_id },
  };
}

export function createRealUploadExecutorContractTests(
  contracts: RealUploadExecutorContracts,
  options: { id?: string; created_at?: string; mode?: RealUploadExecutorContractTestsMode; requestFutureDryRunAdapterDesign?: boolean; operatorReview?: ExecutorContractTestsOperatorReviewInput } = {},
): RealUploadExecutorContractTests {
  const ready = contractsReady(contracts);
  const blockingReasons = blockingReasonsFromContracts(contracts);
  const review = normalizeContractTestsReview(options.operatorReview);
  const reviewReady = contractTestsReviewComplete(review);
  const mode = options.mode ?? "real_upload_executor_contract_tests_only";
  const requestDryRunDesign = options.requestFutureDryRunAdapterDesign !== false;
  let state: RealUploadExecutorContractTestsState = "blocked";
  if (ready && mode === "operator_review_real_upload_executor_contract_tests" && reviewReady && requestDryRunDesign) state = "approved_for_future_dry_run_adapter_design";
  else if (ready) state = "ready_for_operator_review";
  const complete = ready && state !== "blocked";
  const reasons = ready ? [] : blockingReasons;
  return {
    schema_version: "1.0",
    real_upload_executor_contract_tests_id: safe(options.id, "real-upload-executor-contract-tests-001"),
    real_upload_executor_contracts_id: contracts.real_upload_executor_contracts_id,
    real_upload_executor_adapter_design_id: contracts.real_upload_executor_adapter_design_id,
    real_upload_readiness_gate_v2_id: contracts.real_upload_readiness_gate_v2_id,
    render_plan_id: contracts.render_plan_id,
    project_id: contracts.project_id,
    platform: contracts.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    executor_contract_tests_state: state,
    executor_contract_tests_mode: mode,
    required_artifacts: { real_upload_executor_contracts_validated: true, real_upload_executor_adapter_design_validated: true, real_upload_readiness_gate_v2_validated: true },
    contract_tests_scope: { future_dry_run_adapter_design_requested: requestDryRunDesign, executor_contract_tests_only: true, adapter_code_created: false, runtime_enabled: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    executor_contract_test_results: createContractTests(contracts, complete, reasons),
    operator_review: review,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { executor_contract_tests_complete: complete, ready_for_future_dry_run_adapter_design: complete && requestDryRunDesign, ready_for_real_upload: false, real_upload_enabled: false, adapter_code_created: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadExecutorContractTests", source_real_upload_executor_contracts_id: contracts.real_upload_executor_contracts_id, source_real_upload_executor_adapter_design_id: contracts.real_upload_executor_adapter_design_id, source_real_upload_readiness_gate_v2_id: contracts.real_upload_readiness_gate_v2_id, source_render_plan_id: contracts.render_plan_id },
  };
}

export function revokeRealUploadExecutorContracts(contracts: RealUploadExecutorContracts, reason?: string): RealUploadExecutorContracts {
  const warning = sanitizeSafeSummary(reason, "Executor contracts were revoked.");
  return { ...contracts, executor_contracts_state: "revoked", validation: { ...contracts.validation, executor_contracts_complete: false, ready_for_future_executor_contract_tests: false, warnings: [...contracts.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contracts.provenance, generated_by: "revokeRealUploadExecutorContracts" } };
}

export function revokeRealUploadExecutorContractTests(tests: RealUploadExecutorContractTests, reason?: string): RealUploadExecutorContractTests {
  const warning = sanitizeSafeSummary(reason, "Executor contract tests were revoked.");
  return { ...tests, executor_contract_tests_state: "revoked", executor_contract_test_results: tests.executor_contract_test_results.map((result) => ({ ...result, test_state: "blocked", warnings: [...result.warnings, warning] })), validation: { ...tests.validation, executor_contract_tests_complete: false, ready_for_future_dry_run_adapter_design: false, warnings: [...tests.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...tests.provenance, generated_by: "revokeRealUploadExecutorContractTests" } };
}
