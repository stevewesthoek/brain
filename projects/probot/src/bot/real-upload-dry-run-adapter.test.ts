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
  revokeRealUploadDryRunAdapterDesign,
  revokeRealUploadDryRunAdapterContracts,
  revokeRealUploadDryRunAdapterContractTests,
} from "./real-upload-dry-run-adapter.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledDryRunBoundary, DryRunAdapterDesignReviewInput } from "./real-upload-dry-run-adapter.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const DESIGN_REVIEW: DryRunAdapterDesignReviewInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_design_only: true,
  understands_no_adapter_code_created: true,
  understands_real_upload_not_enabled: true,
  understands_no_network_calls: true,
  understands_no_platform_api_calls: true,
  understands_no_credentials_accessed: true,
  understands_no_media_reads: true,
  understands_future_dry_run_adapter_contracts_required: true,
  decision_note_summary: "Dry-run adapter design only. Real upload remains disabled.",
};

function createReadyContractTests() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke, {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: {
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
    },
  });
  const design = createRealUploadExecutorAdapterDesign(gate, {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: {
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
    },
  });
  const contracts = createRealUploadExecutorContracts(design, {
    mode: "operator_review_real_upload_executor_contracts",
    operatorReview: {
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
    },
  });
  return createRealUploadExecutorContractTests(contracts, {
    mode: "operator_review_real_upload_executor_contract_tests",
    operatorReview: {
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
    },
  });
}

function createBlockedContractTests() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, { prerequisites_validated: false });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke);
  const design = createRealUploadExecutorAdapterDesign(gate);
  const contracts = createRealUploadExecutorContracts(design);
  return createRealUploadExecutorContractTests(contracts);
}

function assertDisabledBoundary(boundary: DisabledDryRunBoundary) {
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

test("VO-7AF-DRYRUN-1: ready contract tests create dry-run adapter design only", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    id: "real-upload-dry-run-adapter-design-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(design.schema_version, "1.0");
  assert.equal(design.dry_run_adapter_design_state, "ready_for_operator_review");
  assert.equal(design.dry_run_adapter_design_mode, "real_upload_dry_run_adapter_design_only");
  assert.equal(design.design_scope.dry_run_adapter_design_only, true);
  assert.equal(design.design_scope.adapter_code_created, false);
  assert.equal(design.validation.dry_run_adapter_design_complete, true);
  assert.equal(design.validation.ready_for_future_dry_run_adapter_contracts, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AF-DRYRUN-2: dry-run design plans all safe dry-run checks", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests());
  const kinds = design.planned_dry_run_checks.map((check) => check.check_kind).sort();

  assert.equal(design.planned_dry_run_checks.length, 6);
  assert.deepEqual(kinds, [
    "credential_boundary_dry_run_check",
    "executor_orchestration_dry_run_check",
    "media_boundary_dry_run_check",
    "network_boundary_dry_run_check",
    "payload_shape_dry_run_check",
    "response_redaction_dry_run_check",
  ].sort());

  for (const check of design.planned_dry_run_checks) {
    assert.equal(check.code_created, false);
    assert.equal(check.runtime_enabled, false);
    assert.equal(check.upload_enabled, false);
    assert.equal(check.network_enabled, false);
    assert.equal(check.platform_api_enabled, false);
    assert.equal(check.credential_access_enabled, false);
    assert.equal(check.media_read_enabled, false);
    assert.equal(check.raw_payload_allowed, false);
    assert.equal(check.raw_response_allowed, false);
  }
});

test("VO-7AF-DRYRUN-3: operator review approves only future dry-run adapter contracts", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    mode: "operator_review_real_upload_dry_run_adapter_design",
    operatorReview: DESIGN_REVIEW,
  });

  assert.equal(design.dry_run_adapter_design_state, "approved_for_future_dry_run_adapter_contracts");
  assert.equal(design.operator_review.checklist_acknowledged, true);
  assert.equal(design.operator_review.understands_no_adapter_code_created, true);
  assert.equal(design.validation.ready_for_future_dry_run_adapter_contracts, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AF-DRYRUN-4: blocked contract tests block dry-run adapter design", () => {
  const design = createRealUploadDryRunAdapterDesign(createBlockedContractTests());

  assert.equal(design.dry_run_adapter_design_state, "blocked");
  assert.equal(design.validation.dry_run_adapter_design_complete, false);
  assert.equal(design.validation.ready_for_future_dry_run_adapter_contracts, false);
  assert.equal(design.validation.blocking_reasons.length > 0, true);
  assert.equal(design.planned_dry_run_checks.every((check) => check.blocking_reasons.length > 0), true);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AF-DRYRUN-5: dry-run adapter contracts are contract-only and inert", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    mode: "operator_review_real_upload_dry_run_adapter_design",
    operatorReview: DESIGN_REVIEW,
  });
  const contracts = createRealUploadDryRunAdapterContracts(design, {
    id: "real-upload-dry-run-adapter-contracts-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(contracts.schema_version, "1.0");
  assert.equal(contracts.dry_run_adapter_contracts_state, "approved_for_future_dry_run_adapter_contract_tests");
  assert.equal(contracts.validation.complete, true);
  assert.equal(contracts.validation.ready_for_next_phase, true);
  assert.equal(contracts.validation.ready_for_real_upload, false);
  assert.equal(contracts.dry_run_adapter_contracts.length, 6);

  for (const contract of contracts.dry_run_adapter_contracts) {
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
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7AF-DRYRUN-6: dry-run adapter contract tests pass safe shapes only", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    mode: "operator_review_real_upload_dry_run_adapter_design",
    operatorReview: DESIGN_REVIEW,
  });
  const contracts = createRealUploadDryRunAdapterContracts(design);
  const tests = createRealUploadDryRunAdapterContractTests(contracts, {
    id: "real-upload-dry-run-adapter-contract-tests-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(tests.schema_version, "1.0");
  assert.equal(tests.dry_run_adapter_contract_tests_state, "approved_for_final_operator_checklist");
  assert.equal(tests.validation.complete, true);
  assert.equal(tests.validation.ready_for_next_phase, true);
  assert.equal(tests.validation.ready_for_real_upload, false);
  assert.equal(tests.dry_run_contract_test_results.length, 6);

  for (const result of tests.dry_run_contract_test_results) {
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

test("VO-7AF-DRYRUN-7: blocked dry-run design blocks dry-run contracts and tests", () => {
  const design = createRealUploadDryRunAdapterDesign(createBlockedContractTests());
  const contracts = createRealUploadDryRunAdapterContracts(design);
  const tests = createRealUploadDryRunAdapterContractTests(contracts);

  assert.equal(contracts.dry_run_adapter_contracts_state, "blocked");
  assert.equal(contracts.validation.complete, false);
  assert.equal(contracts.validation.ready_for_next_phase, false);
  assert.equal(contracts.dry_run_adapter_contracts.every((contract) => contract.contract_defined === false), true);
  assertDisabledBoundary(contracts.execution_boundary);

  assert.equal(tests.dry_run_adapter_contract_tests_state, "blocked");
  assert.equal(tests.validation.complete, false);
  assert.equal(tests.validation.ready_for_next_phase, false);
  assert.equal(tests.dry_run_contract_test_results.every((result) => result.test_state === "blocked"), true);
  assert.equal(tests.dry_run_contract_test_results.every((result) => result.contract_shape_checked === false), true);
  assertDisabledBoundary(tests.execution_boundary);
});

test("VO-7AF-SAFETY-8: unsafe strings are sanitized from dry-run artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    id: unsafe,
    created_at: unsafe,
    operatorReview: {
      ...DESIGN_REVIEW,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });
  const contracts = createRealUploadDryRunAdapterContracts(design, { id: unsafe, created_at: unsafe });
  const tests = createRealUploadDryRunAdapterContractTests(contracts, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ design, contracts, tests });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AF-SAFETY-9: revocation keeps dry-run artifacts disabled", () => {
  const design = createRealUploadDryRunAdapterDesign(createReadyContractTests(), {
    mode: "operator_review_real_upload_dry_run_adapter_design",
    operatorReview: DESIGN_REVIEW,
  });
  const contracts = createRealUploadDryRunAdapterContracts(design);
  const tests = createRealUploadDryRunAdapterContractTests(contracts);
  const revokedDesign = revokeRealUploadDryRunAdapterDesign(design, "Operator revoked dry-run adapter design.");
  const revokedContracts = revokeRealUploadDryRunAdapterContracts(contracts, "Operator revoked dry-run adapter contracts.");
  const revokedTests = revokeRealUploadDryRunAdapterContractTests(tests, "Operator revoked dry-run adapter contract tests.");

  assert.equal(revokedDesign.dry_run_adapter_design_state, "revoked");
  assert.equal(revokedDesign.validation.dry_run_adapter_design_complete, false);
  assert.equal(revokedDesign.validation.ready_for_future_dry_run_adapter_contracts, false);
  assert.equal(revokedDesign.provenance.generated_by, "revokeRealUploadDryRunAdapterDesign");
  assertDisabledBoundary(revokedDesign.execution_boundary);

  assert.equal(revokedContracts.dry_run_adapter_contracts_state, "revoked");
  assert.equal(revokedContracts.validation.complete, false);
  assert.equal(revokedContracts.validation.ready_for_next_phase, false);
  assert.equal(revokedContracts.provenance.generated_by, "revokeRealUploadDryRunAdapterContracts");
  assertDisabledBoundary(revokedContracts.execution_boundary);

  assert.equal(revokedTests.dry_run_adapter_contract_tests_state, "revoked");
  assert.equal(revokedTests.validation.complete, false);
  assert.equal(revokedTests.validation.ready_for_next_phase, false);
  assert.equal(revokedTests.dry_run_contract_test_results.every((result) => result.test_state === "blocked"), true);
  assert.equal(revokedTests.provenance.generated_by, "revokeRealUploadDryRunAdapterContractTests");
  assertDisabledBoundary(revokedTests.execution_boundary);
});
