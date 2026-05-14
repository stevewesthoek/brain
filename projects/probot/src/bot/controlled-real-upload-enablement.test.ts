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
  revokeControlledRealUploadEnablement,
  revokeControlledRealUploadEnablementPreflightResult,
} from "./controlled-real-upload-enablement.js";
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

function createReadyEnablementInputs() {
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
  return { safetyPlan, reviewGate };
}

function createBlockedEnablementInputs() {
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
  return { safetyPlan, reviewGate };
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

test("VO-7AI-CONTROLLED-1: controlled enablement approves only future preflight", () => {
  const { safetyPlan, reviewGate } = createReadyEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan, {
    id: "controlled-real-upload-enablement-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(enablement.schema_version, "1.0");
  assert.equal(enablement.enablement_state, "approved_for_future_enablement_preflight");
  assert.equal(enablement.enablement_scope.controlled_enablement_artifact_only, true);
  assert.equal(enablement.enablement_scope.future_enablement_preflight_requested, true);
  assert.equal(enablement.enablement_scope.real_upload_enabled_now, false);
  assert.equal(enablement.validation.complete, true);
  assert.equal(enablement.validation.ready_for_next_phase, true);
  assert.equal(enablement.validation.ready_for_real_upload, false);
  assertDisabledBoundary(enablement.execution_boundary);
});

test("VO-7AI-CONTROLLED-2: controlled enablement keeps all controls explicit", () => {
  const { safetyPlan, reviewGate } = createReadyEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);

  assert.equal(enablement.controlled_enablement_controls.single_upload_limit, 1);
  assert.equal(enablement.controlled_enablement_controls.operator_kill_switch_required, true);
  assert.equal(enablement.controlled_enablement_controls.dry_run_first_required, true);
  assert.equal(enablement.controlled_enablement_controls.separate_runtime_activation_required, true);
  assert.equal(enablement.controlled_enablement_controls.safe_reporting_required, true);
  assert.equal(enablement.controlled_enablement_controls.real_upload_still_blocked, true);
  assert.equal(enablement.validation.real_upload_enabled, false);
  assert.equal(enablement.validation.upload_allowed, false);
  assertDisabledBoundary(enablement.execution_boundary);
});

test("VO-7AI-CONTROLLED-3: blocked review gate or safety plan blocks enablement", () => {
  const { safetyPlan, reviewGate } = createBlockedEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);

  assert.equal(enablement.enablement_state, "blocked");
  assert.equal(enablement.validation.complete, false);
  assert.equal(enablement.validation.ready_for_next_phase, false);
  assert.equal(enablement.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(enablement.execution_boundary);
});

test("VO-7AI-PREFLIGHT-4: preflight passes checks but remains preflight-only", () => {
  const { safetyPlan, reviewGate } = createReadyEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement, {
    id: "controlled-real-upload-enablement-preflight-result-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(preflight.schema_version, "1.0");
  assert.equal(preflight.preflight_state, "passed");
  assert.equal(preflight.preflight_scope.preflight_only, true);
  assert.equal(preflight.preflight_scope.future_runtime_activation_artifact_requested, true);
  assert.equal(preflight.preflight_scope.real_upload_enabled_now, false);
  assert.equal(preflight.validation.complete, true);
  assert.equal(preflight.validation.ready_for_next_phase, true);
  assert.equal(preflight.validation.ready_for_real_upload, false);
  assert.equal(preflight.preflight_checks.length, 5);
  assert.equal(preflight.preflight_checks.every((check) => check.check_state === "passed" && check.enabled_now === false), true);
  assertDisabledBoundary(preflight.execution_boundary);
});

test("VO-7AI-PREFLIGHT-5: blocked enablement blocks preflight checks", () => {
  const { safetyPlan, reviewGate } = createBlockedEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement);

  assert.equal(preflight.preflight_state, "blocked");
  assert.equal(preflight.validation.complete, false);
  assert.equal(preflight.validation.ready_for_next_phase, false);
  assert.equal(preflight.validation.blocking_reasons.length > 0, true);
  assert.equal(preflight.preflight_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(preflight.execution_boundary);
});

test("VO-7AI-SAFETY-6: unsafe strings are sanitized from controlled enablement artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { safetyPlan, reviewGate } = createReadyEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan, { id: unsafe, created_at: unsafe });
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ enablement, preflight });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AI-SAFETY-7: revocation keeps controlled enablement and preflight disabled", () => {
  const { safetyPlan, reviewGate } = createReadyEnablementInputs();
  const enablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(enablement);
  const revokedEnablement = revokeControlledRealUploadEnablement(enablement, "Operator revoked controlled enablement.");
  const revokedPreflight = revokeControlledRealUploadEnablementPreflightResult(preflight, "Operator revoked controlled enablement preflight.");

  assert.equal(revokedEnablement.enablement_state, "revoked");
  assert.equal(revokedEnablement.validation.complete, false);
  assert.equal(revokedEnablement.validation.ready_for_next_phase, false);
  assert.equal(revokedEnablement.provenance.generated_by, "revokeControlledRealUploadEnablement");
  assertDisabledBoundary(revokedEnablement.execution_boundary);

  assert.equal(revokedPreflight.preflight_state, "revoked");
  assert.equal(revokedPreflight.validation.complete, false);
  assert.equal(revokedPreflight.validation.ready_for_next_phase, false);
  assert.equal(revokedPreflight.preflight_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedPreflight.provenance.generated_by, "revokeControlledRealUploadEnablementPreflightResult");
  assertDisabledBoundary(revokedPreflight.execution_boundary);
});
