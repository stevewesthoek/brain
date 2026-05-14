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
  revokeRealUploadExecutorContracts,
  revokeRealUploadExecutorContractTests,
} from "./real-upload-executor-contracts.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadReadinessGateV2OperatorReviewInput } from "./real-upload-readiness-gate-v2.js";
import type { RealUploadExecutorAdapterDesignOperatorReviewInput } from "./real-upload-executor-adapter-design.js";
import type { DisabledExecutorBoundary, ExecutorContractsOperatorReviewInput, ExecutorContractTestsOperatorReviewInput } from "./real-upload-executor-contracts.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const GATE_REVIEW: RealUploadReadinessGateV2OperatorReviewInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_gate_only: true,
  understands_real_upload_not_enabled: true,
  understands_no_network_calls: true,
  understands_no_platform_api_calls: true,
  understands_no_credentials_accessed: true,
  understands_no_media_reads: true,
  understands_future_executor_adapter_design_required: true,
  decision_note_summary: "Gate only. Real upload remains disabled.",
};

const DESIGN_REVIEW: RealUploadExecutorAdapterDesignOperatorReviewInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_design_only: true,
  understands_no_adapter_code_created: true,
  understands_real_upload_not_enabled: true,
  understands_no_network_calls: true,
  understands_no_platform_api_calls: true,
  understands_no_credentials_accessed: true,
  understands_no_media_reads: true,
  understands_future_executor_contracts_required: true,
  decision_note_summary: "Executor adapter design only. Real upload remains disabled.",
};

const CONTRACT_REVIEW: ExecutorContractsOperatorReviewInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_contracts_only: true,
  understands_no_adapter_code_created: true,
  understands_real_upload_not_enabled: true,
  understands_no_network_calls: true,
  understands_no_platform_api_calls: true,
  understands_no_credentials_accessed: true,
  understands_no_media_reads: true,
  understands_future_executor_contract_tests_required: true,
  decision_note_summary: "Executor contracts only. Real upload remains disabled.",
};

const CONTRACT_TEST_REVIEW: ExecutorContractTestsOperatorReviewInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_contract_tests_only: true,
  understands_no_adapter_code_created: true,
  understands_real_upload_not_enabled: true,
  understands_no_network_calls: true,
  understands_no_platform_api_calls: true,
  understands_no_credentials_accessed: true,
  understands_no_media_reads: true,
  understands_future_dry_run_adapter_design_required: true,
  decision_note_summary: "Executor contract tests only. Real upload remains disabled.",
};

function createReadyDesign() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke, {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: GATE_REVIEW,
  });
  return createRealUploadExecutorAdapterDesign(gate, {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: DESIGN_REVIEW,
  });
}

function createBlockedDesign() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, { prerequisites_validated: false });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke);
  return createRealUploadExecutorAdapterDesign(gate);
}

function assertDisabledBoundary(boundary: DisabledExecutorBoundary) {
  assert.equal(boundary.ready_for_real_upload, false);
  assert.equal(boundary.real_upload_enabled, false);
  assert.equal(boundary.adapter_code_created, false);
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

test("VO-7AE-CONTRACTS-1: ready adapter design creates executor contracts only", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    id: "real-upload-executor-contracts-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(contracts.schema_version, "1.0");
  assert.equal(contracts.executor_contracts_state, "ready_for_operator_review");
  assert.equal(contracts.executor_contracts_mode, "real_upload_executor_contracts_only");
  assert.equal(contracts.contracts_scope.executor_contracts_only, true);
  assert.equal(contracts.contracts_scope.adapter_code_created, false);
  assert.equal(contracts.validation.executor_contracts_complete, true);
  assert.equal(contracts.validation.ready_for_future_executor_contract_tests, true);
  assert.equal(contracts.validation.ready_for_real_upload, false);
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7AE-CONTRACTS-2: executor contracts cover all required contract kinds and stay inert", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign());
  const kinds = contracts.executor_contracts.map((contract) => contract.contract_kind).sort();

  assert.equal(contracts.executor_contracts.length, 7);
  assert.deepEqual(kinds, [
    "credential_boundary_contract",
    "executor_orchestration_contract",
    "media_read_boundary_contract",
    "network_boundary_contract",
    "payload_builder_contract",
    "platform_client_contract",
    "response_redaction_contract",
  ].sort());

  for (const contract of contracts.executor_contracts) {
    assert.equal(contract.contract_defined, true);
    assert.equal(contract.code_created, false);
    assert.equal(contract.runtime_enabled, false);
    assert.equal(contract.upload_enabled, false);
    assert.equal(contract.network_enabled, false);
    assert.equal(contract.platform_api_enabled, false);
    assert.equal(contract.credential_access_enabled, false);
    assert.equal(contract.media_read_enabled, false);
    assert.equal(contract.raw_payload_allowed, false);
    assert.equal(contract.raw_response_allowed, false);
  }
});

test("VO-7AE-CONTRACTS-3: operator-reviewed contracts approve only future contract tests", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: CONTRACT_REVIEW,
  });

  assert.equal(contracts.executor_contracts_state, "approved_for_future_executor_contract_tests");
  assert.equal(contracts.operator_review.checklist_acknowledged, true);
  assert.equal(contracts.operator_review.understands_no_adapter_code_created, true);
  assert.equal(contracts.validation.ready_for_future_executor_contract_tests, true);
  assert.equal(contracts.validation.ready_for_real_upload, false);
  assert.equal(contracts.validation.adapter_code_created, false);
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7AE-CONTRACTS-4: blocked adapter design blocks contracts", () => {
  const contracts = createRealUploadExecutorContracts(createBlockedDesign());

  assert.equal(contracts.executor_contracts_state, "blocked");
  assert.equal(contracts.validation.executor_contracts_complete, false);
  assert.equal(contracts.validation.ready_for_future_executor_contract_tests, false);
  assert.equal(contracts.validation.blocking_reasons.length > 0, true);
  assert.equal(contracts.executor_contracts.every((contract) => contract.contract_defined === false), true);
  assert.equal(contracts.executor_contracts.every((contract) => contract.blocking_reasons.length > 0), true);
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7AE-CONTRACT-TESTS-5: contract tests pass safe shapes without runtime or upload", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: CONTRACT_REVIEW,
  });
  const tests = createRealUploadExecutorContractTests(contracts, {
    id: "real-upload-executor-contract-tests-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(tests.schema_version, "1.0");
  assert.equal(tests.executor_contract_tests_state, "ready_for_operator_review");
  assert.equal(tests.contract_tests_scope.executor_contract_tests_only, true);
  assert.equal(tests.validation.executor_contract_tests_complete, true);
  assert.equal(tests.validation.ready_for_future_dry_run_adapter_design, true);
  assert.equal(tests.validation.ready_for_real_upload, false);
  assert.equal(tests.executor_contract_test_results.length, 7);

  for (const result of tests.executor_contract_test_results) {
    assert.equal(result.test_state, "passed");
    assert.equal(result.contract_shape_checked, true);
    assert.equal(result.code_created, false);
    assert.equal(result.runtime_enabled, false);
    assert.equal(result.upload_enabled, false);
    assert.equal(result.network_enabled, false);
    assert.equal(result.platform_api_enabled, false);
    assert.equal(result.credential_access_enabled, false);
    assert.equal(result.media_read_enabled, false);
    assert.equal(result.raw_payload_allowed, false);
    assert.equal(result.raw_response_allowed, false);
  }
  assertDisabledBoundary(tests.execution_boundary);
});

test("VO-7AE-CONTRACT-TESTS-6: operator-reviewed contract tests approve only future dry-run adapter design", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: CONTRACT_REVIEW,
  });
  const tests = createRealUploadExecutorContractTests(contracts, {
    mode: "operator_review_real_upload_executor_contract_tests",
    operatorReview: CONTRACT_TEST_REVIEW,
  });

  assert.equal(tests.executor_contract_tests_state, "approved_for_future_dry_run_adapter_design");
  assert.equal(tests.operator_review.checklist_acknowledged, true);
  assert.equal(tests.operator_review.understands_real_upload_not_enabled, true);
  assert.equal(tests.validation.ready_for_future_dry_run_adapter_design, true);
  assert.equal(tests.validation.ready_for_real_upload, false);
  assert.equal(tests.validation.adapter_code_created, false);
  assertDisabledBoundary(tests.execution_boundary);
});

test("VO-7AE-CONTRACT-TESTS-7: blocked contracts block contract tests", () => {
  const contracts = createRealUploadExecutorContracts(createBlockedDesign());
  const tests = createRealUploadExecutorContractTests(contracts);

  assert.equal(tests.executor_contract_tests_state, "blocked");
  assert.equal(tests.validation.executor_contract_tests_complete, false);
  assert.equal(tests.validation.ready_for_future_dry_run_adapter_design, false);
  assert.equal(tests.validation.blocking_reasons.length > 0, true);
  assert.equal(tests.executor_contract_test_results.every((result) => result.test_state === "blocked"), true);
  assert.equal(tests.executor_contract_test_results.every((result) => result.contract_shape_checked === false), true);
  assertDisabledBoundary(tests.execution_boundary);
});

test("VO-7AE-SAFETY-8: unsafe strings are sanitized from contracts and contract tests", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    id: unsafe,
    created_at: unsafe,
    operatorReview: {
      ...CONTRACT_REVIEW,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });
  const tests = createRealUploadExecutorContractTests(contracts, {
    id: unsafe,
    created_at: unsafe,
    operatorReview: {
      ...CONTRACT_TEST_REVIEW,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });

  const serialized = JSON.stringify({ contracts, tests });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
  assertDisabledBoundary(contracts.execution_boundary);
  assertDisabledBoundary(tests.execution_boundary);
});

test("VO-7AE-SAFETY-9: revocation keeps contracts and tests disabled", () => {
  const contracts = createRealUploadExecutorContracts(createReadyDesign(), {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: CONTRACT_REVIEW,
  });
  const tests = createRealUploadExecutorContractTests(contracts, {
    mode: "operator_review_real_upload_executor_contract_tests",
    operatorReview: CONTRACT_TEST_REVIEW,
  });
  const revokedContracts = revokeRealUploadExecutorContracts(contracts, "Operator revoked executor contracts.");
  const revokedTests = revokeRealUploadExecutorContractTests(tests, "Operator revoked executor contract tests.");

  assert.equal(revokedContracts.executor_contracts_state, "revoked");
  assert.equal(revokedContracts.validation.executor_contracts_complete, false);
  assert.equal(revokedContracts.validation.ready_for_future_executor_contract_tests, false);
  assert.equal(revokedContracts.validation.ready_for_real_upload, false);
  assert.equal(revokedContracts.provenance.generated_by, "revokeRealUploadExecutorContracts");
  assertDisabledBoundary(revokedContracts.execution_boundary);

  assert.equal(revokedTests.executor_contract_tests_state, "revoked");
  assert.equal(revokedTests.validation.executor_contract_tests_complete, false);
  assert.equal(revokedTests.validation.ready_for_future_dry_run_adapter_design, false);
  assert.equal(revokedTests.validation.ready_for_real_upload, false);
  assert.equal(revokedTests.executor_contract_test_results.every((result) => result.test_state === "blocked"), true);
  assert.equal(revokedTests.provenance.generated_by, "revokeRealUploadExecutorContractTests");
  assertDisabledBoundary(revokedTests.execution_boundary);
});
