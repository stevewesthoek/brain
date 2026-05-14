import { test } from "node:test";
import assert from "node:assert";
import {
  createRealUploadDisabledNoopWiringActivationResult,
  createRealUploadNoopWiringSmokeTestResult,
} from "./real-upload-disabled-noop-wiring.js";
import { createRealUploadReadinessGateV2 } from "./real-upload-readiness-gate-v2.js";
import {
  createRealUploadExecutorAdapterDesign,
  rejectRealUploadExecutorAdapterDesign,
  revokeRealUploadExecutorAdapterDesign,
} from "./real-upload-executor-adapter-design.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadExecutorAdapterDesignExecutionBoundary, RealUploadExecutorAdapterDesignOperatorReviewInput } from "./real-upload-executor-adapter-design.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const COMPLETE_REVIEW: RealUploadExecutorAdapterDesignOperatorReviewInput = {
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

function createReadyGate() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  return createRealUploadReadinessGateV2(smoke, {
    id: "real-upload-readiness-gate-v2-001",
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
}

function createBlockedGate() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, {
    prerequisites_validated: false,
  });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  return createRealUploadReadinessGateV2(smoke);
}

function assertDisabledBoundary(boundary: RealUploadExecutorAdapterDesignExecutionBoundary) {
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

test("VO-7AD-ADAPTER-DESIGN-1: ready gate creates design-only adapter artifact", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate(), {
    id: "real-upload-executor-adapter-design-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(design.schema_version, "1.0");
  assert.equal(design.executor_adapter_design_state, "ready_for_operator_review");
  assert.equal(design.executor_adapter_design_mode, "real_upload_executor_adapter_design_only");
  assert.equal(design.design_scope.future_executor_contracts_requested, true);
  assert.equal(design.design_scope.executor_adapter_design_only, true);
  assert.equal(design.design_scope.adapter_code_created, false);
  assert.equal(design.design_scope.runtime_adapter_enabled, false);
  assert.equal(design.validation.executor_adapter_design_complete, true);
  assert.equal(design.validation.ready_for_future_executor_contracts, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-2: planned adapter modules include all required design boundaries", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate());
  const kinds = design.planned_adapter_modules.map((module) => module.module_kind).sort();

  assert.equal(design.planned_adapter_modules.length, 7);
  assert.deepEqual(kinds, [
    "credential_boundary_adapter_design",
    "executor_orchestration_adapter_design",
    "media_read_boundary_adapter_design",
    "network_boundary_adapter_design",
    "payload_builder_adapter_design",
    "platform_client_adapter_design",
    "response_redaction_adapter_design",
  ].sort());

  for (const module of design.planned_adapter_modules) {
    assert.equal(module.code_created, false);
    assert.equal(module.runtime_enabled, false);
    assert.equal(module.upload_enabled, false);
    assert.equal(module.network_enabled, false);
    assert.equal(module.platform_api_enabled, false);
    assert.equal(module.credential_access_enabled, false);
    assert.equal(module.media_read_enabled, false);
  }
});

test("VO-7AD-ADAPTER-DESIGN-3: operator-reviewed mode can approve only future executor contracts", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate(), {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: COMPLETE_REVIEW,
  });

  assert.equal(design.executor_adapter_design_state, "approved_for_future_executor_contracts");
  assert.equal(design.operator_review.checklist_acknowledged, true);
  assert.equal(design.operator_review.understands_no_adapter_code_created, true);
  assert.equal(design.validation.ready_for_future_executor_contracts, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assert.equal(design.validation.adapter_code_created, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-4: blocked readiness gate blocks adapter design", () => {
  const design = createRealUploadExecutorAdapterDesign(createBlockedGate());

  assert.equal(design.executor_adapter_design_state, "blocked");
  assert.equal(design.validation.executor_adapter_design_complete, false);
  assert.equal(design.validation.ready_for_future_executor_contracts, false);
  assert.equal(design.validation.ready_for_real_upload, false);
  assert.equal(design.validation.blocking_reasons.length > 0, true);
  assert.equal(design.planned_adapter_modules.every((module) => module.blocking_reasons.length > 0), true);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-5: incomplete operator review does not approve future contracts state", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate(), {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: {
      ...COMPLETE_REVIEW,
      understands_no_network_calls: false,
    },
  });

  assert.equal(design.executor_adapter_design_state, "ready_for_operator_review");
  assert.equal(design.operator_review.understands_no_network_calls, false);
  assert.equal(design.validation.executor_adapter_design_complete, true);
  assert.equal(design.validation.ready_for_future_executor_contracts, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-6: adapter boundaries all remain required and real upload remains blocked", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate());

  assert.equal(design.adapter_boundaries.credential_boundary_required, true);
  assert.equal(design.adapter_boundaries.network_boundary_required, true);
  assert.equal(design.adapter_boundaries.platform_api_boundary_required, true);
  assert.equal(design.adapter_boundaries.media_read_boundary_required, true);
  assert.equal(design.adapter_boundaries.payload_contract_required, true);
  assert.equal(design.adapter_boundaries.response_redaction_required, true);
  assert.equal(design.adapter_boundaries.dry_run_first_required, true);
  assert.equal(design.adapter_boundaries.real_upload_still_blocked, true);
  assert.equal(design.validation.ready_for_real_upload, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-7: sanitization removes unsafe operator and id content", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const design = createRealUploadExecutorAdapterDesign(createReadyGate(), {
    id: unsafe,
    created_at: unsafe,
    operatorReview: {
      ...COMPLETE_REVIEW,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });

  const serialized = JSON.stringify(design);
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7AD-ADAPTER-DESIGN-8: reject and revoke keep all execution boundaries disabled", () => {
  const design = createRealUploadExecutorAdapterDesign(createReadyGate(), {
    mode: "operator_review_real_upload_executor_adapter_design",
    operatorReview: COMPLETE_REVIEW,
  });
  const rejected = rejectRealUploadExecutorAdapterDesign(design, "Operator rejected executor adapter design.");
  const revoked = revokeRealUploadExecutorAdapterDesign(design, "Operator revoked executor adapter design.");

  assert.equal(rejected.executor_adapter_design_state, "rejected");
  assert.equal(rejected.validation.executor_adapter_design_complete, false);
  assert.equal(rejected.validation.ready_for_future_executor_contracts, false);
  assert.equal(rejected.validation.ready_for_real_upload, false);
  assertDisabledBoundary(rejected.execution_boundary);

  assert.equal(revoked.executor_adapter_design_state, "revoked");
  assert.equal(revoked.validation.executor_adapter_design_complete, false);
  assert.equal(revoked.validation.ready_for_future_executor_contracts, false);
  assert.equal(revoked.validation.ready_for_real_upload, false);
  assert.equal(revoked.provenance.generated_by, "revokeRealUploadExecutorAdapterDesign");
  assertDisabledBoundary(revoked.execution_boundary);
});
