import { test } from "node:test";
import assert from "node:assert";
import {
  createRealUploadDisabledNoopWiringActivationResult,
  createRealUploadNoopWiringSmokeTestResult,
} from "./real-upload-disabled-noop-wiring.js";
import {
  createRealUploadReadinessGateV2,
  rejectRealUploadReadinessGateV2,
  revokeRealUploadReadinessGateV2,
} from "./real-upload-readiness-gate-v2.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadReadinessGateV2ExecutionBoundary, RealUploadReadinessGateV2OperatorReviewInput } from "./real-upload-readiness-gate-v2.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const COMPLETE_REVIEW: RealUploadReadinessGateV2OperatorReviewInput = {
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

function createPassedSmokeTest() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  return createRealUploadNoopWiringSmokeTestResult(activation, {
    id: "real-upload-noop-wiring-smoke-test-result-001",
    check_kinds: ["disabled_import_boundary", "disabled_runtime_boundary", "disabled_upload_boundary"],
  });
}

function createBlockedSmokeTest() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, {
    prerequisites_validated: false,
  });
  return createRealUploadNoopWiringSmokeTestResult(activation);
}

function assertRealUploadDisabled(boundary: RealUploadReadinessGateV2ExecutionBoundary) {
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

test("VO-7AC-GATEV2-1: passed smoke test creates readiness gate for operator review only", () => {
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest(), {
    id: "real-upload-readiness-gate-v2-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(gate.schema_version, "1.0");
  assert.equal(gate.readiness_gate_state, "ready_for_operator_review");
  assert.equal(gate.readiness_gate_mode, "real_upload_readiness_gate_v2_only");
  assert.equal(gate.gate_scope.future_real_upload_executor_adapter_design_requested, true);
  assert.equal(gate.gate_scope.readiness_gate_only, true);
  assert.equal(gate.noop_wiring_review.noop_wiring_smoke_test_complete, true);
  assert.equal(gate.noop_wiring_review.noop_wiring_remains_disabled, true);
  assert.equal(gate.validation.readiness_gate_v2_complete, true);
  assert.equal(gate.validation.ready_for_future_real_upload_executor_adapter_design, true);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assert.equal(gate.real_upload_remaining_gates.real_upload_still_blocked, true);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-2: operator-reviewed mode can approve only future executor adapter design", () => {
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest(), {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: COMPLETE_REVIEW,
  });

  assert.equal(gate.readiness_gate_state, "approved_for_future_real_upload_executor_adapter_design");
  assert.equal(gate.operator_review.checklist_acknowledged, true);
  assert.equal(gate.operator_review.understands_real_upload_not_enabled, true);
  assert.equal(gate.validation.ready_for_future_real_upload_executor_adapter_design, true);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assert.equal(gate.gate_scope.real_upload_enabled_now, false);
  assert.equal(gate.gate_scope.upload_execution_enabled_now, false);
  assert.equal(gate.gate_scope.network_calls_enabled_now, false);
  assert.equal(gate.gate_scope.platform_api_calls_enabled_now, false);
  assert.equal(gate.gate_scope.credential_access_enabled_now, false);
  assert.equal(gate.gate_scope.media_read_enabled_now, false);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-3: blocked smoke test blocks readiness gate", () => {
  const gate = createRealUploadReadinessGateV2(createBlockedSmokeTest());

  assert.equal(gate.readiness_gate_state, "blocked");
  assert.equal(gate.noop_wiring_review.noop_wiring_smoke_test_complete, false);
  assert.equal(gate.validation.readiness_gate_v2_complete, false);
  assert.equal(gate.validation.ready_for_future_real_upload_executor_adapter_design, false);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assert.equal(gate.validation.blocking_reasons.length > 0, true);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-4: incomplete operator review does not approve future adapter design state", () => {
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest(), {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: {
      ...COMPLETE_REVIEW,
      understands_no_network_calls: false,
    },
  });

  assert.equal(gate.readiness_gate_state, "ready_for_operator_review");
  assert.equal(gate.operator_review.understands_no_network_calls, false);
  assert.equal(gate.validation.readiness_gate_v2_complete, true);
  assert.equal(gate.validation.ready_for_future_real_upload_executor_adapter_design, true);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-5: gate stores remaining gates and keeps real upload blocked", () => {
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest());

  assert.equal(gate.real_upload_remaining_gates.executor_adapter_design_required, true);
  assert.equal(gate.real_upload_remaining_gates.executor_contract_required, true);
  assert.equal(gate.real_upload_remaining_gates.dry_run_adapter_required, true);
  assert.equal(gate.real_upload_remaining_gates.credential_boundary_required, true);
  assert.equal(gate.real_upload_remaining_gates.network_boundary_required, true);
  assert.equal(gate.real_upload_remaining_gates.media_read_boundary_required, true);
  assert.equal(gate.real_upload_remaining_gates.operator_final_checklist_required, true);
  assert.equal(gate.real_upload_remaining_gates.real_upload_still_blocked, true);
  assert.equal(gate.real_upload_remaining_gates.blocking_reasons.length, 1);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-6: sanitization removes unsafe operator and id content", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest(), {
    id: unsafe,
    created_at: unsafe,
    operatorReview: {
      ...COMPLETE_REVIEW,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });

  const serialized = JSON.stringify(gate);
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
  assertRealUploadDisabled(gate.execution_boundary);
});

test("VO-7AC-GATEV2-7: reject and revoke keep all execution boundaries disabled", () => {
  const gate = createRealUploadReadinessGateV2(createPassedSmokeTest(), {
    mode: "operator_review_real_upload_readiness_gate_v2",
    operatorReview: COMPLETE_REVIEW,
  });
  const rejected = rejectRealUploadReadinessGateV2(gate, "Operator rejected future executor adapter design.");
  const revoked = revokeRealUploadReadinessGateV2(gate, "Operator revoked gate v2.");

  assert.equal(rejected.readiness_gate_state, "rejected");
  assert.equal(rejected.validation.readiness_gate_v2_complete, false);
  assert.equal(rejected.validation.ready_for_future_real_upload_executor_adapter_design, false);
  assert.equal(rejected.validation.ready_for_real_upload, false);
  assertRealUploadDisabled(rejected.execution_boundary);

  assert.equal(revoked.readiness_gate_state, "revoked");
  assert.equal(revoked.validation.readiness_gate_v2_complete, false);
  assert.equal(revoked.validation.ready_for_future_real_upload_executor_adapter_design, false);
  assert.equal(revoked.validation.ready_for_real_upload, false);
  assert.equal(revoked.provenance.generated_by, "revokeRealUploadReadinessGateV2");
  assertRealUploadDisabled(revoked.execution_boundary);
});
