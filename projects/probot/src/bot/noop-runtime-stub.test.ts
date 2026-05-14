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
import { createRealRuntimeStubBoundaryRequest, createRealRuntimeStubBoundaryContract, createRealRuntimeStubBoundaryDryRunReport } from "./real-runtime-stub-boundary.js";
import {
  createNoopRuntimeStub,
  createNoopRuntimeStubReview,
  createNoopRuntimeStubSafeReport,
  revokeNoopRuntimeStub,
  revokeNoopRuntimeStubReview,
  revokeNoopRuntimeStubSafeReport,
} from "./noop-runtime-stub.js";
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

function createReadyBoundaryArtifacts() {
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
  const stubRequest = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const stubContract = createRealRuntimeStubBoundaryContract(stubRequest);
  const stubDryRunReport = createRealRuntimeStubBoundaryDryRunReport(stubContract, stubRequest);
  return { stubContract, stubDryRunReport };
}

function createBlockedBoundaryArtifacts() {
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
  const stubRequest = createRealRuntimeStubBoundaryRequest(finalBoundarySafeReport, finalBoundary);
  const stubContract = createRealRuntimeStubBoundaryContract(stubRequest);
  const stubDryRunReport = createRealRuntimeStubBoundaryDryRunReport(stubContract, stubRequest);
  return { stubContract, stubDryRunReport };
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

test("VO-7AR-NOOP-1: no-op runtime stub approves only future review", () => {
  const { stubContract, stubDryRunReport } = createReadyBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract, { id: "noop-runtime-stub-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(stub.schema_version, "1.0");
  assert.equal(stub.stub_state, "approved_for_future_noop_runtime_stub_review");
  assert.equal(stub.stub_scope.artifact_only, true);
  assert.equal(stub.stub_scope.future_next_phase_requested, true);
  assert.equal(stub.stub_controls.noop_stub_only, true);
  assert.equal(stub.stub_controls.runtime_invocation_disabled, true);
  assert.equal(stub.stub_controls.network_client_absent, true);
  assert.equal(stub.stub_controls.platform_adapter_absent, true);
  assert.equal(stub.stub_controls.credential_provider_absent, true);
  assert.equal(stub.stub_controls.media_resolver_absent, true);
  assert.equal(stub.stub_items.length, 5);
  assert.equal(stub.stub_items.every((item) => item.implemented_now === false && item.runtime_executed_now === false), true);
  assert.equal(stub.validation.ready_for_real_upload, false);
  assertDisabledBoundary(stub.execution_boundary);
});

test("VO-7AR-NOOP-2: blocked stub boundary dry-run blocks no-op runtime stub", () => {
  const { stubContract, stubDryRunReport } = createBlockedBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);

  assert.equal(stub.stub_state, "blocked");
  assert.equal(stub.validation.complete, false);
  assert.equal(stub.validation.ready_for_next_phase, false);
  assert.equal(stub.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(stub.execution_boundary);
});

test("VO-7AR-NOOP-3: no-op runtime stub review remains review-only", () => {
  const { stubContract, stubDryRunReport } = createReadyBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const review = createNoopRuntimeStubReview(stub, { id: "noop-runtime-stub-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.stub_review_state, "approved_for_future_noop_runtime_stub_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.noop_stub_reviewed, true);
  assert.equal(review.review_controls.runtime_invocation_disabled, true);
  assert.equal(review.review_controls.network_client_absent, true);
  assert.equal(review.review_controls.platform_adapter_absent, true);
  assert.equal(review.review_controls.credential_provider_absent, true);
  assert.equal(review.review_controls.media_resolver_absent, true);
  assert.equal(review.review_items.length, 5);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.runtime_executed_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AR-NOOP-4: blocked no-op runtime stub blocks review", () => {
  const { stubContract, stubDryRunReport } = createBlockedBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const review = createNoopRuntimeStubReview(stub);

  assert.equal(review.stub_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AR-NOOP-5: no-op runtime stub safe report contains no raw payloads, responses, or secrets", () => {
  const { stubContract, stubDryRunReport } = createReadyBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const review = createNoopRuntimeStubReview(stub);
  const report = createNoopRuntimeStubSafeReport(review, stub, { id: "noop-runtime-stub-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_store");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assert.equal(report.validation.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AR-NOOP-6: blocked review blocks no-op runtime stub safe report", () => {
  const { stubContract, stubDryRunReport } = createBlockedBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const review = createNoopRuntimeStubReview(stub);
  const report = createNoopRuntimeStubSafeReport(review, stub);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AR-SAFETY-7: unsafe strings are sanitized from no-op runtime stub artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { stubContract, stubDryRunReport } = createReadyBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract, { id: unsafe, created_at: unsafe });
  const review = createNoopRuntimeStubReview(stub, { id: unsafe, created_at: unsafe });
  const report = createNoopRuntimeStubSafeReport(review, stub, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ stub, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AR-SAFETY-8: revocation keeps no-op runtime stub artifacts disabled", () => {
  const { stubContract, stubDryRunReport } = createReadyBoundaryArtifacts();
  const stub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const review = createNoopRuntimeStubReview(stub);
  const report = createNoopRuntimeStubSafeReport(review, stub);
  const revokedStub = revokeNoopRuntimeStub(stub, "Operator revoked no-op runtime stub.");
  const revokedReview = revokeNoopRuntimeStubReview(review, "Operator revoked no-op runtime stub review.");
  const revokedReport = revokeNoopRuntimeStubSafeReport(report, "Operator revoked no-op runtime stub safe report.");

  assert.equal(revokedStub.stub_state, "revoked");
  assert.equal(revokedStub.validation.complete, false);
  assert.equal(revokedStub.validation.ready_for_next_phase, false);
  assert.equal(revokedStub.provenance.generated_by, "revokeNoopRuntimeStub");
  assertDisabledBoundary(revokedStub.execution_boundary);

  assert.equal(revokedReview.stub_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeNoopRuntimeStubReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeNoopRuntimeStubSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
