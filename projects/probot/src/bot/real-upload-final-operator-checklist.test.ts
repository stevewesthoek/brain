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
import {
  createRealUploadFinalOperatorChecklist,
  rejectRealUploadFinalOperatorChecklist,
  revokeRealUploadFinalOperatorChecklist,
} from "./real-upload-final-operator-checklist.js";
import type { RealUploadDisabledNoopWiringActivationPlanRef } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledFinalChecklistBoundary, FinalOperatorAcknowledgementsInput } from "./real-upload-final-operator-checklist.js";

const PLAN: RealUploadDisabledNoopWiringActivationPlanRef = {
  real_upload_disabled_noop_wiring_activation_plan_id: "real-upload-disabled-noop-wiring-activation-plan-001",
  real_upload_noop_wiring_readiness_review_id: "real-upload-noop-wiring-readiness-review-001",
  real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
  render_plan_id: "render-plan-001",
  project_id: "project-001",
  platform: "youtube",
};

const ACKS: FinalOperatorAcknowledgementsInput = {
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
};

function createReadyDryRunContractTests() {
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
  return createRealUploadDryRunAdapterContractTests(dryRunContracts);
}

function createBlockedDryRunContractTests() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN, { prerequisites_validated: false });
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke);
  const design = createRealUploadExecutorAdapterDesign(gate);
  const contracts = createRealUploadExecutorContracts(design);
  const contractTests = createRealUploadExecutorContractTests(contracts);
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests);
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  return createRealUploadDryRunAdapterContractTests(dryRunContracts);
}

function assertDisabledBoundary(boundary: DisabledFinalChecklistBoundary) {
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

test("VO-7AG-CHECKLIST-1: final checklist approves only a future enablement request", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    id: "real-upload-final-operator-checklist-001",
    created_at: "2026-05-14T00:00:00.000Z",
    acknowledgements: ACKS,
  });

  assert.equal(checklist.schema_version, "1.0");
  assert.equal(checklist.final_checklist_state, "approved_for_future_real_upload_enablement_request");
  assert.equal(checklist.checklist_scope.final_operator_checklist_only, true);
  assert.equal(checklist.checklist_scope.future_real_upload_enablement_request_allowed, true);
  assert.equal(checklist.checklist_scope.real_upload_enabled_now, false);
  assert.equal(checklist.validation.complete, true);
  assert.equal(checklist.validation.ready_for_next_phase, true);
  assert.equal(checklist.validation.ready_for_real_upload, false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-CHECKLIST-2: incomplete acknowledgements keep checklist at operator review", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    acknowledgements: {
      ...ACKS,
      understands_network_calls_are_not_enabled: false,
    },
  });

  assert.equal(checklist.final_checklist_state, "ready_for_operator_review");
  assert.equal(checklist.operator_acknowledgements.understands_network_calls_are_not_enabled, false);
  assert.equal(checklist.checklist_scope.future_real_upload_enablement_request_allowed, false);
  assert.equal(checklist.validation.complete, false);
  assert.equal(checklist.validation.ready_for_next_phase, false);
  assert.equal(checklist.validation.ready_for_real_upload, false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-CHECKLIST-3: blocked dry-run contract tests block checklist", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createBlockedDryRunContractTests(), {
    acknowledgements: ACKS,
  });

  assert.equal(checklist.final_checklist_state, "blocked");
  assert.equal(checklist.validation.complete, false);
  assert.equal(checklist.validation.ready_for_next_phase, false);
  assert.equal(checklist.validation.blocking_reasons.length > 0, true);
  assert.equal(checklist.checklist_scope.future_real_upload_enablement_request_allowed, false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-CHECKLIST-4: all remaining real upload blocks remain explicit", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    acknowledgements: ACKS,
  });

  assert.equal(checklist.remaining_real_upload_blocks.real_upload_enablement_request_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.explicit_credentials_boundary_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.explicit_network_boundary_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.explicit_media_read_boundary_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.explicit_platform_api_boundary_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.separate_commit_required, true);
  assert.equal(checklist.remaining_real_upload_blocks.real_upload_still_blocked, true);
  assert.equal(checklist.validation.ready_for_real_upload, false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-CHECKLIST-5: disabling future enablement request keeps real upload blocked", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    acknowledgements: ACKS,
    requestFutureRealUploadEnablement: false,
  });

  assert.equal(checklist.final_checklist_state, "ready_for_operator_review");
  assert.equal(checklist.validation.complete, true);
  assert.equal(checklist.validation.ready_for_next_phase, false);
  assert.equal(checklist.checklist_scope.future_real_upload_enablement_request_allowed, false);
  assert.equal(checklist.validation.ready_for_real_upload, false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-SAFETY-6: unsafe strings are sanitized from checklist artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    id: unsafe,
    created_at: unsafe,
    acknowledgements: {
      ...ACKS,
      reviewed_by_label: unsafe,
      decision_note_summary: unsafe,
    },
  });

  const serialized = JSON.stringify(checklist);
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7AG-SAFETY-7: reject and revoke keep checklist disabled", () => {
  const checklist = createRealUploadFinalOperatorChecklist(createReadyDryRunContractTests(), {
    acknowledgements: ACKS,
  });
  const rejected = rejectRealUploadFinalOperatorChecklist(checklist, "Operator rejected final checklist.");
  const revoked = revokeRealUploadFinalOperatorChecklist(checklist, "Operator revoked final checklist.");

  assert.equal(rejected.final_checklist_state, "rejected");
  assert.equal(rejected.validation.complete, false);
  assert.equal(rejected.validation.ready_for_next_phase, false);
  assert.equal(rejected.checklist_scope.future_real_upload_enablement_request_allowed, false);
  assert.equal(rejected.validation.ready_for_real_upload, false);
  assertDisabledBoundary(rejected.execution_boundary);

  assert.equal(revoked.final_checklist_state, "revoked");
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.ready_for_next_phase, false);
  assert.equal(revoked.checklist_scope.future_real_upload_enablement_request_allowed, false);
  assert.equal(revoked.validation.ready_for_real_upload, false);
  assert.equal(revoked.provenance.generated_by, "revokeRealUploadFinalOperatorChecklist");
  assertDisabledBoundary(revoked.execution_boundary);
});
