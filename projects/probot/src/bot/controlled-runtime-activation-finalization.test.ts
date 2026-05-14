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
  revokeControlledRuntimeActivationCandidate,
  revokeControlledRuntimeActivationFinalReview,
  revokeControlledRuntimeActivationRollbackPlan,
} from "./controlled-runtime-activation-finalization.js";
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

function createReadyImplementationArtifacts() {
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
  return { implementationReview, implementationContract };
}

function createBlockedImplementationArtifacts() {
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
  return { implementationReview, implementationContract };
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

test("VO-7AL-FINALIZATION-1: activation candidate approves only future final review", () => {
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract, {
    id: "controlled-runtime-activation-candidate-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(candidate.schema_version, "1.0");
  assert.equal(candidate.activation_candidate_state, "approved_for_future_final_review");
  assert.equal(candidate.candidate_scope.artifact_only, true);
  assert.equal(candidate.candidate_scope.future_next_phase_requested, true);
  assert.equal(candidate.candidate_scope.real_upload_enabled_now, false);
  assert.equal(candidate.validation.complete, true);
  assert.equal(candidate.validation.ready_for_next_phase, true);
  assert.equal(candidate.validation.ready_for_real_upload, false);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AL-FINALIZATION-2: candidate controls stay explicit and blocked for real upload", () => {
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);

  assert.equal(candidate.candidate_controls.single_upload_limit, 1);
  assert.equal(candidate.candidate_controls.operator_kill_switch_required, true);
  assert.equal(candidate.candidate_controls.rollback_plan_required, true);
  assert.equal(candidate.candidate_controls.final_review_required, true);
  assert.equal(candidate.candidate_controls.runtime_activation_separate_commit_required, true);
  assert.equal(candidate.candidate_controls.real_upload_still_blocked, true);
  assert.equal(candidate.validation.real_upload_enabled, false);
  assert.equal(candidate.validation.upload_allowed, false);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AL-FINALIZATION-3: blocked implementation review blocks candidate", () => {
  const { implementationReview, implementationContract } = createBlockedImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);

  assert.equal(candidate.activation_candidate_state, "blocked");
  assert.equal(candidate.validation.complete, false);
  assert.equal(candidate.validation.ready_for_next_phase, false);
  assert.equal(candidate.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AL-FINALIZATION-4: final review approves only future rollback plan", () => {
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate, {
    id: "controlled-runtime-activation-final-review-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(finalReview.schema_version, "1.0");
  assert.equal(finalReview.final_review_state, "approved_for_future_rollback_plan");
  assert.equal(finalReview.final_review_scope.artifact_only, true);
  assert.equal(finalReview.final_review_scope.future_next_phase_requested, true);
  assert.equal(finalReview.final_review_scope.real_upload_enabled_now, false);
  assert.equal(finalReview.final_review_controls.candidate_reviewed, true);
  assert.equal(finalReview.final_review_controls.rollback_plan_required, true);
  assert.equal(finalReview.final_review_controls.operator_kill_switch_required, true);
  assert.equal(finalReview.final_review_controls.single_upload_limit, 1);
  assert.equal(finalReview.final_review_controls.real_upload_still_blocked, true);
  assert.equal(finalReview.validation.ready_for_real_upload, false);
  assertDisabledBoundary(finalReview.execution_boundary);
});

test("VO-7AL-FINALIZATION-5: blocked candidate blocks final review", () => {
  const { implementationReview, implementationContract } = createBlockedImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);

  assert.equal(finalReview.final_review_state, "blocked");
  assert.equal(finalReview.validation.complete, false);
  assert.equal(finalReview.validation.ready_for_next_phase, false);
  assert.equal(finalReview.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(finalReview.execution_boundary);
});

test("VO-7AL-FINALIZATION-6: rollback plan approves only future go/no-go and executes nothing", () => {
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollback = createControlledRuntimeActivationRollbackPlan(finalReview, candidate, {
    id: "controlled-runtime-activation-rollback-plan-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(rollback.schema_version, "1.0");
  assert.equal(rollback.rollback_plan_state, "approved_for_future_activation_go_no_go");
  assert.equal(rollback.rollback_scope.artifact_only, true);
  assert.equal(rollback.rollback_scope.future_next_phase_requested, true);
  assert.equal(rollback.rollback_scope.real_upload_enabled_now, false);
  assert.equal(rollback.rollback_controls.rollback_plan_only, true);
  assert.equal(rollback.rollback_controls.operator_kill_switch_required, true);
  assert.equal(rollback.rollback_controls.single_upload_limit, 1);
  assert.equal(rollback.rollback_controls.runtime_activation_separate_commit_required, true);
  assert.equal(rollback.rollback_controls.real_upload_still_blocked, true);
  assert.equal(rollback.rollback_steps.length, 4);
  assert.equal(rollback.rollback_steps.every((step) => step.executed_now === false), true);
  assert.equal(rollback.validation.ready_for_real_upload, false);
  assertDisabledBoundary(rollback.execution_boundary);
});

test("VO-7AL-FINALIZATION-7: blocked final review blocks rollback plan", () => {
  const { implementationReview, implementationContract } = createBlockedImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollback = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);

  assert.equal(rollback.rollback_plan_state, "blocked");
  assert.equal(rollback.validation.complete, false);
  assert.equal(rollback.validation.ready_for_next_phase, false);
  assert.equal(rollback.validation.blocking_reasons.length > 0, true);
  assert.equal(rollback.rollback_steps.every((step) => step.executed_now === false), true);
  assertDisabledBoundary(rollback.execution_boundary);
});

test("VO-7AL-SAFETY-8: unsafe strings are sanitized from finalization artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract, { id: unsafe, created_at: unsafe });
  const finalReview = createControlledRuntimeActivationFinalReview(candidate, { id: unsafe, created_at: unsafe });
  const rollback = createControlledRuntimeActivationRollbackPlan(finalReview, candidate, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ candidate, finalReview, rollback });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AL-SAFETY-9: revocation keeps finalization artifacts disabled", () => {
  const { implementationReview, implementationContract } = createReadyImplementationArtifacts();
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollback = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);
  const revokedCandidate = revokeControlledRuntimeActivationCandidate(candidate, "Operator revoked activation candidate.");
  const revokedFinalReview = revokeControlledRuntimeActivationFinalReview(finalReview, "Operator revoked final review.");
  const revokedRollback = revokeControlledRuntimeActivationRollbackPlan(rollback, "Operator revoked rollback plan.");

  assert.equal(revokedCandidate.activation_candidate_state, "revoked");
  assert.equal(revokedCandidate.validation.complete, false);
  assert.equal(revokedCandidate.validation.ready_for_next_phase, false);
  assert.equal(revokedCandidate.provenance.generated_by, "revokeControlledRuntimeActivationCandidate");
  assertDisabledBoundary(revokedCandidate.execution_boundary);

  assert.equal(revokedFinalReview.final_review_state, "revoked");
  assert.equal(revokedFinalReview.validation.complete, false);
  assert.equal(revokedFinalReview.validation.ready_for_next_phase, false);
  assert.equal(revokedFinalReview.provenance.generated_by, "revokeControlledRuntimeActivationFinalReview");
  assertDisabledBoundary(revokedFinalReview.execution_boundary);

  assert.equal(revokedRollback.rollback_plan_state, "revoked");
  assert.equal(revokedRollback.validation.complete, false);
  assert.equal(revokedRollback.validation.ready_for_next_phase, false);
  assert.equal(revokedRollback.rollback_steps.every((step) => step.executed_now === false), true);
  assert.equal(revokedRollback.provenance.generated_by, "revokeControlledRuntimeActivationRollbackPlan");
  assertDisabledBoundary(revokedRollback.execution_boundary);
});
