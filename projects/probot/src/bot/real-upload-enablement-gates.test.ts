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
  revokeRealUploadEnablementRequest,
  revokeRealUploadEnablementSafetyPlan,
  revokeRealUploadEnablementReviewGate,
} from "./real-upload-enablement-gates.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary, EnablementRequestAcknowledgementsInput, EnablementReviewGateAcknowledgementsInput } from "./real-upload-enablement-gates.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const REQUEST_ACK: EnablementRequestAcknowledgementsInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_request_only: true,
  understands_real_upload_not_enabled: true,
  understands_future_safety_plan_required: true,
  understands_no_credentials_accessed: true,
  understands_no_network_calls: true,
  understands_no_media_reads: true,
  understands_no_platform_api_calls: true,
  decision_note_summary: "Enablement request only. Real upload remains disabled.",
};

const REVIEW_ACK: EnablementReviewGateAcknowledgementsInput = {
  reviewed_by_label: "operator-001",
  checklist_acknowledged: true,
  understands_review_gate_only: true,
  understands_real_upload_not_enabled: true,
  understands_future_controlled_enablement_artifact_required: true,
  understands_no_credentials_accessed: true,
  understands_no_network_calls: true,
  understands_no_media_reads: true,
  understands_no_platform_api_calls: true,
  decision_note_summary: "Review gate only. Real upload remains disabled.",
};

function createReadyChecklist() {
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
  const adapterDesign = createRealUploadExecutorAdapterDesign(gate, {
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
  const contracts = createRealUploadExecutorContracts(adapterDesign, {
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
  const contractTests = createRealUploadExecutorContractTests(contracts, {
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
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests, {
    mode: "operator_review_real_upload_dry_run_adapter_design",
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
      understands_future_dry_run_adapter_contracts_required: true,
      decision_note_summary: "Dry-run adapter design only. Real upload remains disabled.",
    },
  });
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  const dryRunContractTests = createRealUploadDryRunAdapterContractTests(dryRunContracts);
  return createRealUploadFinalOperatorChecklist(dryRunContractTests, {
    acknowledgements: {
      reviewed_by_label: "operator-001",
      checklist_acknowledged: true,
      understands_final_checklist_only: true,
      understands_real_upload_not_enabled: true,
      understands_future_enablement_request_required: true,
      understands_credentials_are_not_accessed: true,
      understands_network_calls_are_not_enabled: true,
      understands_media_reads_are_not_enabled: true,
      understands_platform_api_calls_are_not_enabled: true,
      understands_dependencies_are_not_added: true,
      decision_note_summary: "Final checklist only. Real upload remains disabled until a separate enablement request.",
    },
  });
}

function createBlockedChecklist() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, { prerequisites_validated: false });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke);
  const adapterDesign = createRealUploadExecutorAdapterDesign(gate);
  const contracts = createRealUploadExecutorContracts(adapterDesign);
  const contractTests = createRealUploadExecutorContractTests(contracts);
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests);
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  const dryRunContractTests = createRealUploadDryRunAdapterContractTests(dryRunContracts);
  return createRealUploadFinalOperatorChecklist(dryRunContractTests, {
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

test("VO-7AH-ENABLEMENT-1: enablement request approves only a future safety plan", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), {
    id: "real-upload-enablement-request-001",
    created_at: "2026-05-14T00:00:00.000Z",
    acknowledgements: REQUEST_ACK,
  });

  assert.equal(request.schema_version, "1.0");
  assert.equal(request.enablement_request_state, "approved_for_future_enablement_safety_plan");
  assert.equal(request.request_scope.enablement_request_only, true);
  assert.equal(request.request_scope.future_enablement_safety_plan_requested, true);
  assert.equal(request.request_scope.real_upload_enabled_now, false);
  assert.equal(request.validation.complete, true);
  assert.equal(request.validation.ready_for_next_phase, true);
  assert.equal(request.validation.ready_for_real_upload, false);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AH-ENABLEMENT-2: incomplete request acknowledgement waits for operator review", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), {
    acknowledgements: { ...REQUEST_ACK, understands_no_network_calls: false },
  });

  assert.equal(request.enablement_request_state, "ready_for_operator_review");
  assert.equal(request.operator_acknowledgements.understands_no_network_calls, false);
  assert.equal(request.validation.complete, false);
  assert.equal(request.validation.ready_for_next_phase, false);
  assert.equal(request.validation.ready_for_real_upload, false);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AH-ENABLEMENT-3: blocked checklist blocks enablement request", () => {
  const request = createRealUploadEnablementRequest(createBlockedChecklist(), {
    acknowledgements: REQUEST_ACK,
  });

  assert.equal(request.enablement_request_state, "blocked");
  assert.equal(request.validation.complete, false);
  assert.equal(request.validation.ready_for_next_phase, false);
  assert.equal(request.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AH-ENABLEMENT-4: safety plan records planned controls and runtime boundaries only", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), { acknowledgements: REQUEST_ACK });
  const plan = createRealUploadEnablementSafetyPlan(request, {
    id: "real-upload-enablement-safety-plan-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.safety_plan_state, "approved_for_future_enablement_review_gate");
  assert.equal(plan.plan_scope.safety_plan_only, true);
  assert.equal(plan.plan_scope.future_enablement_review_gate_requested, true);
  assert.equal(plan.planned_enablement_controls.separate_activation_commit_required, true);
  assert.equal(plan.planned_enablement_controls.operator_kill_switch_required, true);
  assert.equal(plan.planned_enablement_controls.dry_run_first_required, true);
  assert.equal(plan.planned_enablement_controls.single_upload_limit_required, true);
  assert.equal(plan.planned_enablement_controls.safe_reporting_required, true);
  assert.equal(plan.planned_enablement_controls.real_upload_still_blocked, true);
  assert.equal(plan.planned_runtime_boundaries.length, 5);
  assert.equal(plan.planned_runtime_boundaries.every((boundary) => boundary.enabled_now === false), true);
  assert.equal(plan.validation.ready_for_real_upload, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7AH-ENABLEMENT-5: review gate approves only future controlled enablement artifact", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), { acknowledgements: REQUEST_ACK });
  const plan = createRealUploadEnablementSafetyPlan(request);
  const gate = createRealUploadEnablementReviewGate(plan, request, {
    id: "real-upload-enablement-review-gate-001",
    created_at: "2026-05-14T00:00:00.000Z",
    acknowledgements: REVIEW_ACK,
  });

  assert.equal(gate.schema_version, "1.0");
  assert.equal(gate.review_gate_state, "approved_for_future_controlled_enablement_artifact");
  assert.equal(gate.review_scope.review_gate_only, true);
  assert.equal(gate.review_scope.future_controlled_enablement_artifact_requested, true);
  assert.equal(gate.review_scope.real_upload_enabled_now, false);
  assert.equal(gate.review_findings.safety_plan_complete, true);
  assert.equal(gate.review_findings.enablement_request_complete, true);
  assert.equal(gate.review_findings.kill_switch_planned, true);
  assert.equal(gate.review_findings.single_upload_limit_planned, true);
  assert.equal(gate.review_findings.real_upload_still_blocked, true);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assertDisabledBoundary(gate.execution_boundary);
});

test("VO-7AH-ENABLEMENT-6: incomplete review acknowledgement does not approve controlled artifact", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), { acknowledgements: REQUEST_ACK });
  const plan = createRealUploadEnablementSafetyPlan(request);
  const gate = createRealUploadEnablementReviewGate(plan, request, {
    acknowledgements: { ...REVIEW_ACK, understands_no_platform_api_calls: false },
  });

  assert.equal(gate.review_gate_state, "ready_for_operator_review");
  assert.equal(gate.operator_acknowledgements.understands_no_platform_api_calls, false);
  assert.equal(gate.validation.complete, false);
  assert.equal(gate.validation.ready_for_next_phase, false);
  assert.equal(gate.validation.ready_for_real_upload, false);
  assertDisabledBoundary(gate.execution_boundary);
});

test("VO-7AH-SAFETY-7: unsafe strings are sanitized from enablement artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const request = createRealUploadEnablementRequest(createReadyChecklist(), {
    id: unsafe,
    created_at: unsafe,
    acknowledgements: { ...REQUEST_ACK, reviewed_by_label: unsafe, decision_note_summary: unsafe },
  });
  const plan = createRealUploadEnablementSafetyPlan(request, { id: unsafe, created_at: unsafe });
  const gate = createRealUploadEnablementReviewGate(plan, request, {
    id: unsafe,
    created_at: unsafe,
    acknowledgements: { ...REVIEW_ACK, reviewed_by_label: unsafe, decision_note_summary: unsafe },
  });

  const serialized = JSON.stringify({ request, plan, gate });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AH-SAFETY-8: revocation keeps all enablement gates disabled", () => {
  const request = createRealUploadEnablementRequest(createReadyChecklist(), { acknowledgements: REQUEST_ACK });
  const plan = createRealUploadEnablementSafetyPlan(request);
  const gate = createRealUploadEnablementReviewGate(plan, request, { acknowledgements: REVIEW_ACK });
  const revokedRequest = revokeRealUploadEnablementRequest(request, "Operator revoked enablement request.");
  const revokedPlan = revokeRealUploadEnablementSafetyPlan(plan, "Operator revoked enablement safety plan.");
  const revokedGate = revokeRealUploadEnablementReviewGate(gate, "Operator revoked enablement review gate.");

  assert.equal(revokedRequest.enablement_request_state, "revoked");
  assert.equal(revokedRequest.validation.complete, false);
  assert.equal(revokedRequest.validation.ready_for_next_phase, false);
  assert.equal(revokedRequest.provenance.generated_by, "revokeRealUploadEnablementRequest");
  assertDisabledBoundary(revokedRequest.execution_boundary);

  assert.equal(revokedPlan.safety_plan_state, "revoked");
  assert.equal(revokedPlan.validation.complete, false);
  assert.equal(revokedPlan.validation.ready_for_next_phase, false);
  assert.equal(revokedPlan.provenance.generated_by, "revokeRealUploadEnablementSafetyPlan");
  assertDisabledBoundary(revokedPlan.execution_boundary);

  assert.equal(revokedGate.review_gate_state, "revoked");
  assert.equal(revokedGate.validation.complete, false);
  assert.equal(revokedGate.validation.ready_for_next_phase, false);
  assert.equal(revokedGate.provenance.generated_by, "revokeRealUploadEnablementReviewGate");
  assertDisabledBoundary(revokedGate.execution_boundary);
});
