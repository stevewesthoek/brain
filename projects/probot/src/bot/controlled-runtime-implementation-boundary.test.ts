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
} from "./controlled-runtime-activation.js";
import {
  createControlledRuntimeActivationImplementationPlan,
  createControlledRuntimeActivationImplementationContract,
  createControlledRuntimeActivationImplementationDryRunReview,
} from "./controlled-runtime-activation-implementation.js";
import {
  createControlledRuntimeActivationCandidate,
  createControlledRuntimeActivationFinalReview,
  createControlledRuntimeActivationRollbackPlan,
} from "./controlled-runtime-activation-finalization.js";
import {
  createControlledRuntimeActivationGoNoGo,
  createControlledRuntimeActivationFinalSafeReport,
  createControlledRuntimeActivationBoundaryCompletionSummary,
} from "./controlled-runtime-activation-summary.js";
import {
  createControlledRuntimeImplementationBoundaryRequest,
  createControlledRuntimeImplementationBoundarySafetyContract,
  createControlledRuntimeImplementationBoundaryDryRun,
  revokeControlledRuntimeImplementationBoundaryRequest,
  revokeControlledRuntimeImplementationBoundarySafetyContract,
  revokeControlledRuntimeImplementationBoundaryDryRun,
} from "./controlled-runtime-implementation-boundary.js";
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

function createReadyBoundaryCompletionSummary() {
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
  const enablementRequest = createRealUploadEnablementRequest(checklist, {
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
  const safetyPlan = createRealUploadEnablementSafetyPlan(enablementRequest);
  const reviewGate = createRealUploadEnablementReviewGate(safetyPlan, enablementRequest, {
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
  const controlledEnablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(controlledEnablement);
  const activationRequest = createControlledRuntimeActivationRequest(preflight, controlledEnablement);
  const safetyContract = createControlledRuntimeActivationSafetyContract(activationRequest, preflight);
  const runtimeDryRun = createControlledRuntimeActivationDryRunResult(safetyContract, activationRequest);
  const implementationPlan = createControlledRuntimeActivationImplementationPlan(runtimeDryRun, safetyContract);
  const implementationContract = createControlledRuntimeActivationImplementationContract(implementationPlan, runtimeDryRun);
  const implementationReview = createControlledRuntimeActivationImplementationDryRunReview(implementationContract, implementationPlan);
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const safeReport = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  return createControlledRuntimeActivationBoundaryCompletionSummary(safeReport, goNoGo);
}

function createBlockedBoundaryCompletionSummary() {
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
  const enablementRequest = createRealUploadEnablementRequest(checklist, { acknowledgements: { checklist_acknowledged: true } });
  const safetyPlan = createRealUploadEnablementSafetyPlan(enablementRequest);
  const reviewGate = createRealUploadEnablementReviewGate(safetyPlan, enablementRequest, { acknowledgements: { checklist_acknowledged: true } });
  const controlledEnablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(controlledEnablement);
  const activationRequest = createControlledRuntimeActivationRequest(preflight, controlledEnablement);
  const safetyContract = createControlledRuntimeActivationSafetyContract(activationRequest, preflight);
  const runtimeDryRun = createControlledRuntimeActivationDryRunResult(safetyContract, activationRequest);
  const implementationPlan = createControlledRuntimeActivationImplementationPlan(runtimeDryRun, safetyContract);
  const implementationContract = createControlledRuntimeActivationImplementationContract(implementationPlan, runtimeDryRun);
  const implementationReview = createControlledRuntimeActivationImplementationDryRunReview(implementationContract, implementationPlan);
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const safeReport = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  return createControlledRuntimeActivationBoundaryCompletionSummary(safeReport, goNoGo);
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

test("VO-7AN-BOUNDARY-1: boundary request approves only future boundary safety contract", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createReadyBoundaryCompletionSummary(), {
    id: "controlled-runtime-implementation-boundary-request-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(request.schema_version, "1.0");
  assert.equal(request.boundary_request_state, "approved_for_future_boundary_safety_contract");
  assert.equal(request.boundary_scope.artifact_only, true);
  assert.equal(request.boundary_scope.future_next_phase_requested, true);
  assert.equal(request.boundary_scope.real_upload_enabled_now, false);
  assert.equal(request.implementation_controls.boundary_request_only, true);
  assert.equal(request.implementation_controls.safe_stub_only, true);
  assert.equal(request.validation.complete, true);
  assert.equal(request.validation.ready_for_next_phase, true);
  assert.equal(request.validation.ready_for_real_upload, false);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AN-BOUNDARY-2: blocked summary blocks boundary request", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createBlockedBoundaryCompletionSummary());

  assert.equal(request.boundary_request_state, "blocked");
  assert.equal(request.validation.complete, false);
  assert.equal(request.validation.ready_for_next_phase, false);
  assert.equal(request.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AN-BOUNDARY-3: boundary safety contract records safe stub contracts only", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createReadyBoundaryCompletionSummary());
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request, {
    id: "controlled-runtime-implementation-boundary-safety-contract-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.safety_contract_state, "approved_for_future_boundary_dry_run");
  assert.equal(contract.contract_scope.artifact_only, true);
  assert.equal(contract.safety_controls.safe_stub_only, true);
  assert.equal(contract.safety_controls.single_upload_limit, 1);
  assert.equal(contract.safety_controls.operator_kill_switch_required, true);
  assert.equal(contract.safety_controls.raw_payload_storage_allowed, false);
  assert.equal(contract.safety_controls.raw_response_storage_allowed, false);
  assert.equal(contract.safety_controls.real_upload_still_blocked, true);
  assert.equal(contract.implementation_contracts.length, 5);
  assert.equal(contract.implementation_contracts.every((item) => item.implemented_now === false), true);
  assert.equal(contract.validation.ready_for_real_upload, false);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AN-BOUNDARY-4: blocked request blocks boundary safety contract", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createBlockedBoundaryCompletionSummary());
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request);

  assert.equal(contract.safety_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AN-BOUNDARY-5: boundary dry-run passes without implementing runtime", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createReadyBoundaryCompletionSummary());
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request);
  const dryRun = createControlledRuntimeImplementationBoundaryDryRun(contract, request, {
    id: "controlled-runtime-implementation-boundary-dry-run-001",
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
  assert.equal(dryRun.dry_run_checks.every((check) => check.check_state === "passed" && check.implemented_now === false), true);
  assertDisabledBoundary(dryRun.execution_boundary);
});

test("VO-7AN-BOUNDARY-6: blocked safety contract blocks boundary dry-run", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createBlockedBoundaryCompletionSummary());
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request);
  const dryRun = createControlledRuntimeImplementationBoundaryDryRun(contract, request);

  assert.equal(dryRun.dry_run_state, "blocked");
  assert.equal(dryRun.validation.complete, false);
  assert.equal(dryRun.validation.ready_for_next_phase, false);
  assert.equal(dryRun.validation.blocking_reasons.length > 0, true);
  assert.equal(dryRun.dry_run_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(dryRun.execution_boundary);
});

test("VO-7AN-SAFETY-7: unsafe strings are sanitized from boundary artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const request = createControlledRuntimeImplementationBoundaryRequest(createReadyBoundaryCompletionSummary(), { id: unsafe, created_at: unsafe });
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request, { id: unsafe, created_at: unsafe });
  const dryRun = createControlledRuntimeImplementationBoundaryDryRun(contract, request, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ request, contract, dryRun });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AN-SAFETY-8: revocation keeps boundary artifacts disabled", () => {
  const request = createControlledRuntimeImplementationBoundaryRequest(createReadyBoundaryCompletionSummary());
  const contract = createControlledRuntimeImplementationBoundarySafetyContract(request);
  const dryRun = createControlledRuntimeImplementationBoundaryDryRun(contract, request);
  const revokedRequest = revokeControlledRuntimeImplementationBoundaryRequest(request, "Operator revoked boundary request.");
  const revokedContract = revokeControlledRuntimeImplementationBoundarySafetyContract(contract, "Operator revoked boundary safety contract.");
  const revokedDryRun = revokeControlledRuntimeImplementationBoundaryDryRun(dryRun, "Operator revoked boundary dry-run.");

  assert.equal(revokedRequest.boundary_request_state, "revoked");
  assert.equal(revokedRequest.validation.complete, false);
  assert.equal(revokedRequest.validation.ready_for_next_phase, false);
  assert.equal(revokedRequest.provenance.generated_by, "revokeControlledRuntimeImplementationBoundaryRequest");
  assertDisabledBoundary(revokedRequest.execution_boundary);

  assert.equal(revokedContract.safety_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeControlledRuntimeImplementationBoundarySafetyContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedDryRun.dry_run_state, "revoked");
  assert.equal(revokedDryRun.validation.complete, false);
  assert.equal(revokedDryRun.validation.ready_for_next_phase, false);
  assert.equal(revokedDryRun.dry_run_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedDryRun.provenance.generated_by, "revokeControlledRuntimeImplementationBoundaryDryRun");
  assertDisabledBoundary(revokedDryRun.execution_boundary);
});
