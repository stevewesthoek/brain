import { test } from "node:test";
import assert from "node:assert";
import {
  createRealUploadDisabledNoopWiringActivationResult,
  createRealUploadNoopWiringSmokeTestResult,
} from "./real-upload-disabled-noop-wiring.js";
import { createRealUploadReadinessGateV2 } from "./real-upload-readiness-gate-v2.js";
import { createRealUploadExecutorAdapterDesign } from "./real-upload-executor-adapter-design.js";
import { createRealUploadExecutorContracts, createRealUploadExecutorContractTests } from "./real-upload-executor-contracts.js";
import { createRealUploadDryRunAdapterDesign, createRealUploadDryRunAdapterContracts, createRealUploadDryRunAdapterContractTests } from "./real-upload-dry-run-adapter.js";
import { createRealUploadFinalOperatorChecklist } from "./real-upload-final-operator-checklist.js";
import { createRealUploadEnablementRequest, createRealUploadEnablementSafetyPlan, createRealUploadEnablementReviewGate } from "./real-upload-enablement-gates.js";
import { createControlledRealUploadEnablement, createControlledRealUploadEnablementPreflightResult } from "./controlled-real-upload-enablement.js";
import { createControlledRuntimeActivationRequest, createControlledRuntimeActivationSafetyContract, createControlledRuntimeActivationDryRunResult } from "./controlled-runtime-activation.js";
import { createControlledRuntimeActivationImplementationPlan, createControlledRuntimeActivationImplementationContract, createControlledRuntimeActivationImplementationDryRunReview } from "./controlled-runtime-activation-implementation.js";
import { createControlledRuntimeActivationCandidate, createControlledRuntimeActivationFinalReview, createControlledRuntimeActivationRollbackPlan } from "./controlled-runtime-activation-finalization.js";
import { createControlledRuntimeActivationGoNoGo, createControlledRuntimeActivationFinalSafeReport, createControlledRuntimeActivationBoundaryCompletionSummary } from "./controlled-runtime-activation-summary.js";
import { createControlledRuntimeImplementationBoundaryRequest, createControlledRuntimeImplementationBoundarySafetyContract, createControlledRuntimeImplementationBoundaryDryRun } from "./controlled-runtime-implementation-boundary.js";
import { createControlledRuntimeImplementationCandidate, createControlledRuntimeImplementationCandidateReview, createControlledRuntimeImplementationCandidateSafeReport } from "./controlled-runtime-implementation-candidate.js";
import { createControlledRuntimeImplementationFinalBoundary, createControlledRuntimeImplementationFinalBoundaryReview, createControlledRuntimeImplementationFinalBoundarySafeReport } from "./controlled-runtime-implementation-final-boundary.js";
import {
  createRealRuntimeStubBoundaryRequest,
  createRealRuntimeStubBoundaryContract,
  createRealRuntimeStubBoundaryDryRunReport,
  revokeRealRuntimeStubBoundaryRequest,
  revokeRealRuntimeStubBoundaryContract,
  revokeRealRuntimeStubBoundaryDryRunReport,
} from "./real-runtime-stub-boundary.js";
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

function createReadyFinalBoundaryArtifacts() {
  const activation = createRealUploadDisabledNoopWiringActivationResult(PLAN);
  const smoke = createRealUploadNoopWiringSmokeTestResult(activation);
  const gate = createRealUploadReadinessGateV2(smoke, { mode: "operator_review_real_upload_readiness_gate_v2", operatorReview: { checklist_acknowledged: true, understands_gate_only: true, understands_real_upload_not_enabled: true, understands_no_network_calls: true, understands_no_platform_api_calls: true, understands_no_credentials_accessed: true, understands_no_media_reads: true, understands_future_executor_adapter_design_required: true } });
  const adapterDesign = createRealUploadExecutorAdapterDesign(gate, { mode: "operator_review_real_upload_executor_adapter_design", operatorReview: { checklist_acknowledged: true, understands_design_only: true, understands_no_adapter_code_created: true, understands_real_upload_not_enabled: true, understands_no_network_calls: true, understands_no_platform_api_calls: true, understands_no_credentials_accessed: true, understands_no_media_reads: true, understands_future_executor_contracts_required: true } });
  const contracts = createRealUploadExecutorContracts(adapterDesign, { mode: "operator_review_real_upload_executor_contracts", operatorReview: { checklist_acknowledged: true, understands_contracts_only: true, understands_no_adapter_code_created: true, understands_real_upload_not_enabled: true, understands_no_network_calls: true, understands_no_platform_api_calls: true, understands_no_credentials_accessed: true, understands_no_media_reads: true, understands_future_executor_contract_tests_required: true } });
  const contractTests = createRealUploadExecutorContractTests(contracts, { mode: "operator_review_real_upload_executor_contract_tests", operatorReview: { checklist_acknowledged: true, understands_contract_tests_only: true, understands_no_adapter_code_created: true, understands_real_upload_not_enabled: true, understands_no_network_calls: true, understands_no_platform_api_calls: true, understands_no_credentials_accessed: true, understands_no_media_reads: true, understands_future_dry_run_adapter_design_required: true } });
  const dryRunDesign = createRealUploadDryRunAdapterDesign(contractTests, { mode: "operator_review_real_upload_dry_run_adapter_design", operatorReview: { checklist_acknowledged: true, understands_design_only: true, understands_no_adapter_code_created: true, understands_real_upload_not_enabled: true, understands_no_network_calls: true, understands_no_platform_api_calls: true, understands_no_credentials_accessed: true, understands_no_media_reads: true, understands_future_dry_run_adapter_contracts_required: true } });
  const dryRunContracts = createRealUploadDryRunAdapterContracts(dryRunDesign);
  const dryRunContractTests = createRealUploadDryRunAdapterContractTests(dryRunContracts);
  const checklist = createRealUploadFinalOperatorChecklist(dryRunContractTests, { acknowledgements: { checklist_acknowledged: true, understands_final_checklist_only: true, understands_real_upload_not_enabled: true, understands_future_enablement_request_required: true, understands_credentials_are_not_accessed: true, understands_network_calls_are_not_enabled: true, understands_media_reads_are_not_enabled: true, understands_platform_api_calls_are_not_enabled: true, understands_dependencies_are_not_added: true } });
  const enablementRequest = createRealUploadEnablementRequest(checklist, { acknowledgements: { checklist_acknowledged: true, understands_request_only: true, understands_real_upload_not_enabled: true, understands_future_safety_plan_required: true, understands_no_credentials_accessed: true, understands_no_network_calls: true, understands_no_media_reads: true, understands_no_platform_api_calls: true } });
  const safetyPlan = createRealUploadEnablementSafetyPlan(enablementRequest);
  const reviewGate = createRealUploadEnablementReviewGate(safetyPlan, enablementRequest, { acknowledgements: { checklist_acknowledged: true, understands_review_gate_only: true, understands_real_upload_not_enabled: true, understands_future_controlled_enablement_artifact_required: true, understands_no_credentials_accessed: true, understands_no_network_calls: true, understands_no_media_reads: true, understands_no_platform_api_calls: true } });
  const controlledEnablement = createControlledRealUploadEnablement(reviewGate, safetyPlan);
  const preflight = createControlledRealUploadEnablementPreflightResult(controlledEnablement);
  const activationRequest = createControlledRuntimeActivationRequest(preflight, controlledEnablement);
  const safetyContract = createControlledRuntimeActivationSafetyContract(activationRequest, preflight);
  const runtimeDryRun = createControlledRuntimeActivationDryRunResult(safetyContract, activationRequest);
  const implementationPlan = createControlledRuntimeActivationImplementationPlan(runtimeDryRun, safetyContract);
  const implementationContract = createControlledRuntimeActivationImplementationContract(implementationPlan, runtimeDryRun);
  const implementationReview = createControlledRuntimeActivationImplementationDryRunReview(implementationContract, implementationPlan);
  const activationCandidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(activationCandidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, activationCandidate);
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const safeReport = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(safeReport, goNoGo);
  const boundaryRequest = createControlledRuntimeImplementationBoundaryRequest(summary);
  const boundarySafety = createControlledRuntimeImplementationBoundarySafetyContract(boundaryRequest);
  const boundaryDryRun = createControlledRuntimeImplementationBoundaryDryRun(boundarySafety, boundaryRequest);
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const candidateReview = createControlledRuntimeImplementationCandidateReview(candidate);
  const candidateSafeReport = createControlledRuntimeImplementationCandidateSafeReport(candidateReview, candidate);
  const finalBoundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const finalBoundaryReview = createControlledRuntimeImplementationFinalBoundaryReview(finalBoundary);
  const finalBoundarySafeReport = createControlledRuntimeImplementationFinalBoundarySafeReport(finalBoundaryReview, finalBoundary);
  return { finalBoundary, finalBoundarySafeReport };
}

function createBlockedFinalBoundaryArtifacts() {
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
  const activationCandidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(activationCandidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, activationCandidate);
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const safeReport = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(safeReport, goNoGo);
  const boundaryRequest = createControlledRuntimeImplementationBoundaryRequest(summary);
  const boundarySafety = createControlledRuntimeImplementationBoundarySafetyContract(boundaryRequest);
  const boundaryDryRun = createControlledRuntimeImplementationBoundaryDryRun(boundarySafety, boundaryRequest);
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const candidateReview = createControlledRuntimeImplementationCandidateReview(candidate);
  const candidateSafeReport = createControlledRuntimeImplementationCandidateSafeReport(candidateReview, candidate);
  const finalBoundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const finalBoundaryReview = createControlledRuntimeImplementationFinalBoundaryReview(finalBoundary);
  const finalBoundarySafeReport = createControlledRuntimeImplementationFinalBoundarySafeReport(finalBoundaryReview, finalBoundary);
  return { finalBoundary, finalBoundarySafeReport };
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

test("VO-7AQ-STUB-1: real runtime stub boundary request approves only future stub contract", () => {
  const { finalBoundary, finalBoundarySafeReport } = createReadyFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary, { id: "real-runtime-stub-boundary-request-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(request.schema_version, "1.0");
  assert.equal(request.stub_boundary_request_state, "approved_for_future_stub_boundary_contract");
  assert.equal(request.request_scope.artifact_only, true);
  assert.equal(request.request_scope.future_next_phase_requested, true);
  assert.equal(request.stub_controls.stub_boundary_request_only, true);
  assert.equal(request.stub_controls.runtime_stub_only, true);
  assert.equal(request.stub_controls.no_op_runtime_required, true);
  assert.equal(request.validation.ready_for_real_upload, false);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AQ-STUB-2: blocked final boundary safe report blocks stub request", () => {
  const { finalBoundary, finalBoundarySafeReport } = createBlockedFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);

  assert.equal(request.stub_boundary_request_state, "blocked");
  assert.equal(request.validation.complete, false);
  assert.equal(request.validation.ready_for_next_phase, false);
  assert.equal(request.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(request.execution_boundary);
});

test("VO-7AQ-STUB-3: stub contract records no-op runtime controls only", () => {
  const { finalBoundary, finalBoundarySafeReport } = createReadyFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const contract = createRealRuntimeStubBoundaryContract(request, { id: "real-runtime-stub-boundary-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.stub_contract_state, "approved_for_future_stub_boundary_dry_run_report");
  assert.equal(contract.contract_scope.artifact_only, true);
  assert.equal(contract.stub_contract_controls.contract_only, true);
  assert.equal(contract.stub_contract_controls.runtime_stub_only, true);
  assert.equal(contract.stub_contract_controls.no_op_runtime_required, true);
  assert.equal(contract.stub_contract_controls.raw_payload_storage_allowed, false);
  assert.equal(contract.stub_contract_controls.raw_response_storage_allowed, false);
  assert.equal(contract.stub_contract_items.length, 5);
  assert.equal(contract.stub_contract_items.every((item) => item.implemented_now === false && item.runtime_executed_now === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AQ-STUB-4: blocked request blocks stub contract", () => {
  const { finalBoundary, finalBoundarySafeReport } = createBlockedFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const contract = createRealRuntimeStubBoundaryContract(request);

  assert.equal(contract.stub_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AQ-STUB-5: stub dry-run report approves only future no-op runtime stub", () => {
  const { finalBoundary, finalBoundarySafeReport } = createReadyFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const contract = createRealRuntimeStubBoundaryContract(request);
  const report = createRealRuntimeStubBoundaryDryRunReport(contract, request, { id: "real-runtime-stub-boundary-dry-run-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.dry_run_report_state, "approved_for_future_noop_runtime_stub");
  assert.equal(report.dry_run_scope.artifact_only, true);
  assert.equal(report.dry_run_scope.future_next_phase_requested, true);
  assert.equal(report.dry_run_results.length, 5);
  assert.equal(report.dry_run_results.every((result) => result.result_state === "passed" && result.implemented_now === false && result.runtime_executed_now === false), true);
  assert.equal(report.validation.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AQ-STUB-6: blocked contract blocks stub dry-run report", () => {
  const { finalBoundary, finalBoundarySafeReport } = createBlockedFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const contract = createRealRuntimeStubBoundaryContract(request);
  const report = createRealRuntimeStubBoundaryDryRunReport(contract, request);

  assert.equal(report.dry_run_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.dry_run_results.every((result) => result.result_state === "blocked"), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AQ-SAFETY-7: unsafe strings are sanitized from stub boundary artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { finalBoundary, finalBoundarySafeReport } = createReadyFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary, { id: unsafe, created_at: unsafe });
  const contract = createRealRuntimeStubBoundaryContract(request, { id: unsafe, created_at: unsafe });
  const report = createRealRuntimeStubBoundaryDryRunReport(contract, request, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ request, contract, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AQ-SAFETY-8: revocation keeps stub boundary artifacts disabled", () => {
  const { finalBoundary, finalBoundarySafeReport } = createReadyFinalBoundaryArtifacts();
  const request = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const contract = createRealRuntimeStubBoundaryContract(request);
  const report = createRealRuntimeStubBoundaryDryRunReport(contract, request);
  const revokedRequest = revokeRealRuntimeStubBoundaryRequest(request, "Operator revoked stub request.");
  const revokedContract = revokeRealRuntimeStubBoundaryContract(contract, "Operator revoked stub contract.");
  const revokedReport = revokeRealRuntimeStubBoundaryDryRunReport(report, "Operator revoked stub dry-run report.");

  assert.equal(revokedRequest.stub_boundary_request_state, "revoked");
  assert.equal(revokedRequest.validation.complete, false);
  assert.equal(revokedRequest.validation.ready_for_next_phase, false);
  assert.equal(revokedRequest.provenance.generated_by, "revokeRealRuntimeStubBoundaryRequest");
  assertDisabledBoundary(revokedRequest.execution_boundary);

  assert.equal(revokedContract.stub_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRealRuntimeStubBoundaryContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReport.dry_run_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.dry_run_results.every((result) => result.result_state === "blocked"), true);
  assert.equal(revokedReport.provenance.generated_by, "revokeRealRuntimeStubBoundaryDryRunReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
