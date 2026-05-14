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
  revokeControlledRuntimeActivationImplementationPlan,
  revokeControlledRuntimeActivationImplementationContract,
  revokeControlledRuntimeActivationImplementationDryRunReview,
} from "./controlled-runtime-activation-implementation.js";
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

function createReadyRuntimeDryRun() {
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
  const dryRun = createControlledRuntimeActivationDryRunResult(safetyContract, activationRequest);
  return { dryRun, safetyContract };
}

function createBlockedRuntimeDryRun() {
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
  const dryRun = createControlledRuntimeActivationDryRunResult(safetyContract, activationRequest);
  return { dryRun, safetyContract };
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

test("VO-7AK-IMPLEMENTATION-1: implementation plan approves only future implementation contract", () => {
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract, {
    id: "controlled-runtime-activation-implementation-plan-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.implementation_plan_state, "approved_for_future_implementation_contract");
  assert.equal(plan.implementation_scope.artifact_only, true);
  assert.equal(plan.implementation_scope.future_next_phase_requested, true);
  assert.equal(plan.implementation_scope.real_upload_enabled_now, false);
  assert.equal(plan.validation.complete, true);
  assert.equal(plan.validation.ready_for_next_phase, true);
  assert.equal(plan.validation.ready_for_real_upload, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7AK-IMPLEMENTATION-2: planned changes are not implemented", () => {
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);

  assert.equal(plan.planned_changes.length, 5);
  assert.equal(plan.planned_changes.every((change) => change.implemented_now === false), true);
  assert.deepEqual(plan.planned_changes.map((change) => change.change_kind).sort(), [
    "credential_boundary",
    "kill_switch",
    "media_boundary",
    "network_boundary",
    "single_upload_limit",
  ].sort());
});

test("VO-7AK-IMPLEMENTATION-3: blocked dry-run blocks implementation plan", () => {
  const { dryRun, safetyContract } = createBlockedRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);

  assert.equal(plan.implementation_plan_state, "blocked");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.validation.ready_for_next_phase, false);
  assert.equal(plan.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7AK-CONTRACT-4: implementation contract remains contract-only", () => {
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun, {
    id: "controlled-runtime-activation-implementation-contract-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.implementation_contract_state, "approved_for_future_implementation_dry_run_review");
  assert.equal(contract.implementation_contract_scope.artifact_only, true);
  assert.equal(contract.implementation_contracts.length, 5);
  assert.equal(contract.implementation_contracts.every((item) => item.implemented_now === false), true);
  assert.equal(contract.validation.complete, true);
  assert.equal(contract.validation.ready_for_next_phase, true);
  assert.equal(contract.validation.ready_for_real_upload, false);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AK-CONTRACT-5: blocked plan blocks implementation contract", () => {
  const { dryRun, safetyContract } = createBlockedRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun);

  assert.equal(contract.implementation_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AK-REVIEW-6: implementation dry-run review approves only future activation candidate", () => {
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun);
  const review = createControlledRuntimeActivationImplementationDryRunReview(contract, plan, {
    id: "controlled-runtime-activation-implementation-dry-run-review-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.implementation_dry_run_review_state, "approved_for_future_activation_candidate");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_scope.future_next_phase_requested, true);
  assert.equal(review.review_checks.length, 5);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.implemented_now === false), true);
  assert.equal(review.validation.complete, true);
  assert.equal(review.validation.ready_for_next_phase, true);
  assert.equal(review.validation.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AK-REVIEW-7: blocked contract blocks implementation dry-run review", () => {
  const { dryRun, safetyContract } = createBlockedRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun);
  const review = createControlledRuntimeActivationImplementationDryRunReview(contract, plan);

  assert.equal(review.implementation_dry_run_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.validation.blocking_reasons.length > 0, true);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AK-SAFETY-8: unsafe strings are sanitized from implementation artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract, { id: unsafe, created_at: unsafe });
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun, { id: unsafe, created_at: unsafe });
  const review = createControlledRuntimeActivationImplementationDryRunReview(contract, plan, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ plan, contract, review });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AK-SAFETY-9: revocation keeps implementation artifacts disabled", () => {
  const { dryRun, safetyContract } = createReadyRuntimeDryRun();
  const plan = createControlledRuntimeActivationImplementationPlan(dryRun, safetyContract);
  const contract = createControlledRuntimeActivationImplementationContract(plan, dryRun);
  const review = createControlledRuntimeActivationImplementationDryRunReview(contract, plan);
  const revokedPlan = revokeControlledRuntimeActivationImplementationPlan(plan, "Operator revoked implementation plan.");
  const revokedContract = revokeControlledRuntimeActivationImplementationContract(contract, "Operator revoked implementation contract.");
  const revokedReview = revokeControlledRuntimeActivationImplementationDryRunReview(review, "Operator revoked implementation dry-run review.");

  assert.equal(revokedPlan.implementation_plan_state, "revoked");
  assert.equal(revokedPlan.validation.complete, false);
  assert.equal(revokedPlan.validation.ready_for_next_phase, false);
  assert.equal(revokedPlan.provenance.generated_by, "revokeControlledRuntimeActivationImplementationPlan");
  assertDisabledBoundary(revokedPlan.execution_boundary);

  assert.equal(revokedContract.implementation_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeControlledRuntimeActivationImplementationContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.implementation_dry_run_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeControlledRuntimeActivationImplementationDryRunReview");
  assertDisabledBoundary(revokedReview.execution_boundary);
});
