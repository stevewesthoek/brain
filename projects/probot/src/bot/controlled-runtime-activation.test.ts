import { test } from "node:test";
import assert from "node:assert";
import {
  createRealUploadDisabledNoopWiringActivationResult,
  createRealUploadNoopWiringSmokeTestResult,
} from "./real-upload-disabled-noop-wiring.js";
import { createRealUploadReadinessGateV2 } from "./real-upload-readiness-gate-v2.js";
import { createRealUploadExecutorAdapterDesign } from "./real-upload-executor-adapter-design.js";
import {
  createRealUploadExecutorContracts,
  createRealUploadExecutorContractTests,
} from "./real-upload-executor-contracts.js";
import {
  createRealUploadDryRunAdapterDesign,
  createRealUploadDryRunAdapterContracts,
  createRealUploadDryRunAdapterContractTests,
} from "./real-upload-dry-run-adapter.js";
import { createRealUploadFinalOperatorChecklist } from "./real-upload-final-operator-checklist.js";
import {
  createRealUploadEnablementRequest,
  createRealUploadEnablementSafetyPlan,
  createRealUploadEnablementReviewGate,
} from "./real-upload-enablement-gates.js";
import {
  createControlledRealUploadEnablement,
  createControlledRealUploadEnablementPreflightResult,
} from "./controlled-real-upload-enablement.js";
import {
  createControlledRuntimeActivationRequest,
  createControlledRuntimeActivationSafetyContract,
  createControlledRuntimeActivationDryRunResult,
  revokeControlledRuntimeActivationRequest,
  revokeControlledRuntimeActivationSafetyContract,
  revokeControlledRuntimeActivationDryRunResult,
} from "./controlled-runtime-activation.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

function createReadyControlledEnablement() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke, {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: {
      checklist_acknowledged: true,
      understands_gate_only: true,
      understands_real_upload_not_enabled: true,
      understands_no_network_calls: true,
      understands_no_platform_api_calls: true,
      understands_no_credentials_accessed: true,
      understands_no_media_reads: true,
      understands_future_executor_adapter_design_required: true,
    },
  });
  const adapterDesign = createRealUploadExecutorAdapterDesign(gate, {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: {
      checklist_acknowledged: true,
      understands_design_only: true,
      understands_no_adapter_code_created: true,
      understands_real_upload_not_enabled: true,
      understands_no_network_calls: true,
      understands_no_platform_api_calls: true,
      understands_no_credentials_accessed: true,
      understands_no_media_reads: true,
      understands_future_executor_contracts_required: true,
    },
  });
  const contracts = createRealUploadExecutorContracts(adapterDesign, {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: {
      checklist_acknowledged: true,
      understands_contracts_only: true,
      understands_no_adapter_code_created: true,
      understands_real_upload_not_enabled: true,
      understands_no_network_calls: true,
      understands_no_platform_api_calls: true,
      understands_no_credentials_accessed: true,
      understands_no_media_reads: true,
      understands_future_executor_contract_tests_required: true,
    },
  });
  const contractTests = createRealUploadExecutorContractTests(contracts, {
    mode: "operator_review_real_upload_executor_contract_tests",
    operatorReview: {
      checklist_acknowledged: true,
      understands_contract_tests_only: true,
      understands_no_adapter_code_created: true,
      understands_real_upload_not_enabled: true,
      understands_no_network_calls: true,
      understands_no_platform_api_calls: true,
      understands_no_credentials_accessed: true,
      understands_no_media_reads: true,
      understands_future_dry_run_adapter_design_required: true,
    },
  });
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests, {
    mode: "operator_review_real_upload_dry_run_adapter_design",
    operatorReview: {
      checklist_acknowledged: true,
      understands_design_only: true,
      understands_no_adapter_code_created: true,
      understands_real_upload_not_enabled: true,
      understands_no_network_calls: true,
      understands_no_platform_api_calls: true,
      understands_no_credentials_accessed: true,
      understands_no_media_reads: true,
      understands_future_dry_run_adapter_contracts_required: true,
    },
  });
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  const dryRunContractTests = createRealUploadDryRunAdapterContractTests(dryRunContracts);
  const checklist = createRealUploadFinalOperatorChecklist(dryRunContractTests, {
    acknowledgements: {
      checklist_acknowledged: true,
      understands_final_checklist_only: true,
      understands_real_upload_not_enabled: true,
      understands_future_enablement_request_required: true,
      understands_credentials_are_not_accessed: true,
      understands_network_calls_are_not_enabled: true,
      understands_media_reads_are_not_enabled: true,
      understands_platform_api_calls_are_not_enabled: true,
      understands_dependencies_are_not_added: true,
    },
  });
  const request = createRealUploadEnablementRequest(checklist, {
    acknowledgements: {
      checklist_acknowledged: true,
      understands_request_only: true,
      understands_real_upload_not_enabled: true,
      understands_future_safety_plan_required: true,
      understands_no_credentials_accessed: true,
      understands_no_network_calls: true,
      understands_no_media_reads: true,
      understands_no_platform_api_calls: true,
    },
  });
  const safetyPlan = createRealUploadEnablementSafetyPlan(request);
  const reviewGate = createRealUploadEnablementReviewGate(safetyPlan, request, {
    acknowledgements: {
      checklist_acknowledged: true,
      understands_review_gate_only: true,
      understands_real_upload_not_enabled: true,
      understands_future_controlled_enablement_artifact_required: true,
      understands_no_credentials_accessed: true,
      understands_no_network_calls: true,
      understands_no_media_reads: true,
      understands_no_platform_api_calls: true,
    },
  });
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement);
  return { enablement, preflight };
}

function createBlockedControlledEnablement() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, { prerequisites_validated: false });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke);
  const adapterDesign = createRealUploadExecutorAdapterDesign(gate);
  const contracts = createRealUploadExecutorContracts(adapterDesign);
  const contractTests = createRealUploadExecutorContractTests(contracts);
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests);
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  const dryRunContractTests = createRealUploadDryRunAdapterContractTests(dryRunContracts);
  const checklist = createRealUploadFinalOperatorChecklist(dryRunContractTests, { acknowledgements: { checklist_acknowledged: true } });
  const request = createRealUploadEnablementRequest(checklist, { acknowledgements: { checklist_acknowledged: true } });
  const safetyPlan = createRealUploadEnablementSafetyPlan(request);
  const reviewGate = createRealUploadEnablementReviewGate(safetyPlan, request, { acknowledgements: { checklist_acknowledged: true } });
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement);
  return { enablement, preflight };
}

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  assert.equal(boundary.ready_for_real_upload, false);
  assert.equal(boundary.real_upload_enabled, false);
  assert.equal(boundary.runtime_enabled, false);
  assert.equal(boundary.runtime_executed, false);
  assert.equal(boundary.upload_allowed, false);
  assert.equal(boundary.upload_execution_enabled, false);
  assert.equal(boundary.platform_api_calls_allowed, false);
  assert.equal(boundary.network_calls_allowed, false);
  assert.equal(boundary.credentials_accessed, false);
  assert.equal(boundary.token_accessed, false);
  assert.equal(boundary.keychain_accessed, false);
  assert.equal(boundary.env_accessed, false);
  assert.equal(boundary.media_file_read, false);
  assert.equal(boundary.file_mutation_allowed, false);
  assert.equal(boundary.dependencies_added, false);
  assert.equal(boundary.package_metadata_changed, false);
}

test("VO-7AJ-RUNTIME-1: runtime activation request approves only future safety contract", () => {
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement, {
    id: "controlled-runtime-activation-request-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(request.schema_version, "1.0");
  assert.equal(request.activation_request_state, "approved_for_future_runtime_activation_safety_contract");
  assert.equal(request.activation_request_scope.artifact_only, true);
  assert.equal(request.activation_request_scope.future_next_phase_requested, true);
  assert.equal(request.activation_request_scope.real_upload_enabled_now, false);
  assert.equal(request.validation.complete, true);
  assert.equal(request.validation.ready_for_next_phase, true);
  assert.equal(request.validation.ready_for_real_upload, false);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AJ-RUNTIME-2: runtime activation request keeps runtime controls explicit", () => {
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);

  assert.equal(request.requested_runtime_controls.single_upload_limit, 1);
  assert.equal(request.requested_runtime_controls.operator_kill_switch_required, true);
  assert.equal(request.requested_runtime_controls.dry_run_first_required, true);
  assert.equal(request.requested_runtime_controls.runtime_activation_contract_required, true);
  assert.equal(request.requested_runtime_controls.runtime_activation_dry_run_required, true);
  assert.equal(request.requested_runtime_controls.real_upload_still_blocked, true);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AJ-RUNTIME-3: blocked preflight blocks runtime activation request", () => {
  const { enablement, preflight } = createBlockedControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);

  assert.equal(request.activation_request_state, "blocked");
  assert.equal(request.validation.complete, false);
  assert.equal(request.validation.ready_for_next_phase, false);
  assert.equal(request.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AJ-SAFETY-4: safety contract records contracts and still blocks real upload", () => {
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight, {
    id: "controlled-runtime-activation-safety-contract-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.safety_contract_state, "approved_for_future_runtime_activation_dry_run");
  assert.equal(contract.safety_contract_scope.artifact_only, true);
  assert.equal(contract.safety_contract_scope.future_next_phase_requested, true);
  assert.equal(contract.runtime_safety_controls.single_upload_limit, 1);
  assert.equal(contract.runtime_safety_controls.operator_kill_switch_required, true);
  assert.equal(contract.runtime_safety_controls.dry_run_first_required, true);
  assert.equal(contract.runtime_safety_controls.safe_reporting_required, true);
  assert.equal(contract.runtime_safety_controls.raw_payload_storage_allowed, false);
  assert.equal(contract.runtime_safety_controls.raw_response_storage_allowed, false);
  assert.equal(contract.runtime_safety_controls.real_upload_still_blocked, true);
  assert.equal(contract.runtime_safety_contracts.length, 5);
  assert.equal(contract.runtime_safety_contracts.every((item) => item.enabled_now === false), true);
  assert.equal(contract.validation.ready_for_real_upload, false);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AJ-SAFETY-5: blocked request blocks safety contract", () => {
  const { enablement, preflight } = createBlockedControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight);

  assert.equal(contract.safety_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AJ-DRYRUN-6: runtime activation dry-run passes without enabling runtime", () => {
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight);
  const dryRun = createControlledRuntimeActivationDryRunResult(contract, request, {
    id: "controlled-runtime-activation-dry-run-result-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(dryRun.schema_version, "1.0");
  assert.equal(dryRun.dry_run_state, "passed");
  assert.equal(dryRun.dry_run_scope.artifact_only, true);
  assert.equal(dryRun.dry_run_scope.future_next_phase_requested, true);
  assert.equal(dryRun.dry_run_scope.real_upload_enabled_now, false);
  assert.equal(dryRun.validation.complete, true);
  assert.equal(dryRun.validation.ready_for_next_phase, true);
  assert.equal(dryRun.validation.ready_for_real_upload, false);
  assert.equal(dryRun.dry_run_checks.length, 5);
  assert.equal(dryRun.dry_run_checks.every((check) => check.check_state === "passed" && check.enabled_now === false), true);
  assertDisabledBoundary(dryRun.execution_boundary);
});

test("VO-7AJ-DRYRUN-7: blocked safety contract blocks runtime activation dry-run", () => {
  const { enablement, preflight } = createBlockedControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight);
  const dryRun = createControlledRuntimeActivationDryRunResult(contract, request);

  assert.equal(dryRun.dry_run_state, "blocked");
  assert.equal(dryRun.validation.complete, false);
  assert.equal(dryRun.validation.ready_for_next_phase, false);
  assert.equal(dryRun.validation.blocking_reasons.length > 0, true);
  assert.equal(dryRun.dry_run_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(dryRun.execution_boundary);
});

test("VO-7AJ-SAFETY-8: unsafe strings are sanitized from runtime activation artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement, { id: unsafe, created_at: unsafe });
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight, { id: unsafe, created_at: unsafe });
  const dryRun = createControlledRuntimeActivationDryRunResult(contract, request, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ request, contract, dryRun });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AJ-SAFETY-9: revocation keeps runtime activation artifacts disabled", () => {
  const { enablement, preflight } = createReadyControlledEnablement();
  const request = createControlledRuntimeActivationRequest(preflight, enablement);
  const contract = createControlledRuntimeActivationSafetyContract(request, preflight);
  const dryRun = createControlledRuntimeActivationDryRunResult(contract, request);
  const revokedRequest = revokeControlledRuntimeActivationRequest(request, "Operator revoked runtime activation request.");
  const revokedContract = revokeControlledRuntimeActivationSafetyContract(contract, "Operator revoked runtime activation safety contract.");
  const revokedDryRun = revokeControlledRuntimeActivationDryRunResult(dryRun, "Operator revoked runtime activation dry-run.");

  assert.equal(revokedRequest.activation_request_state, "revoked");
  assert.equal(revokedRequest.validation.complete, false);
  assert.equal(revokedRequest.validation.ready_for_next_phase, false);
  assert.equal(revokedRequest.provenance.generated_by, "revokeControlledRuntimeActivationRequest");
  assertDisabledBoundary(revokedRequest.execution_boundary);

  assert.equal(revokedContract.safety_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeControlledRuntimeActivationSafetyContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedDryRun.dry_run_state, "revoked");
  assert.equal(revokedDryRun.validation.complete, false);
  assert.equal(revokedDryRun.validation.ready_for_next_phase, false);
  assert.equal(revokedDryRun.dry_run_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedDryRun.provenance.generated_by, "revokeControlledRuntimeActivationDryRunResult");
  assertDisabledBoundary(revokedDryRun.execution_boundary);
});
