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
import {
  createControlledRuntimeImplementationCandidate,
  createControlledRuntimeImplementationCandidateReview,
  createControlledRuntimeImplementationCandidateSafeReport,
  revokeControlledRuntimeImplementationCandidate,
  revokeControlledRuntimeImplementationCandidateReview,
  revokeControlledRuntimeImplementationCandidateSafeReport,
} from "./controlled-runtime-implementation-candidate.js";
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
  return { boundaryDryRun, boundarySafety };
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
  return { boundaryDryRun, boundarySafety };
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

test("VO-7AO-CANDIDATE-1: implementation candidate approves only future candidate review", () => {
  const { boundaryDryRun, boundarySafety } = createReadyBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety, { id: "controlled-runtime-implementation-candidate-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(candidate.schema_version, "1.0");
  assert.equal(candidate.candidate_state, "approved_for_future_candidate_review");
  assert.equal(candidate.candidate_scope.artifact_only, true);
  assert.equal(candidate.candidate_scope.future_next_phase_requested, true);
  assert.equal(candidate.candidate_scope.real_upload_enabled_now, false);
  assert.equal(candidate.candidate_controls.candidate_only, true);
  assert.equal(candidate.candidate_controls.safe_stub_only, true);
  assert.equal(candidate.candidate_items.length, 5);
  assert.equal(candidate.candidate_items.every((item) => item.implemented_now === false), true);
  assert.equal(candidate.validation.ready_for_real_upload, false);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AO-CANDIDATE-2: blocked boundary dry-run blocks candidate", () => {
  const { boundaryDryRun, boundarySafety } = createBlockedBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);

  assert.equal(candidate.candidate_state, "blocked");
  assert.equal(candidate.validation.complete, false);
  assert.equal(candidate.validation.ready_for_next_phase, false);
  assert.equal(candidate.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AO-REVIEW-3: candidate review passes candidate items only", () => {
  const { boundaryDryRun, boundarySafety } = createReadyBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const review = createControlledRuntimeImplementationCandidateReview(candidate, { id: "controlled-runtime-implementation-candidate-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.candidate_review_state, "approved_for_future_candidate_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.candidate_reviewed, true);
  assert.equal(review.review_items.length, 5);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.implemented_now === false), true);
  assert.equal(review.validation.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AO-REVIEW-4: blocked candidate blocks candidate review", () => {
  const { boundaryDryRun, boundarySafety } = createBlockedBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const review = createControlledRuntimeImplementationCandidateReview(candidate);

  assert.equal(review.candidate_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AO-REPORT-5: candidate safe report contains no raw payloads, responses, or secrets", () => {
  const { boundaryDryRun, boundarySafety } = createReadyBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const review = createControlledRuntimeImplementationCandidateReview(candidate);
  const report = createControlledRuntimeImplementationCandidateSafeReport(review, candidate, { id: "controlled-runtime-implementation-candidate-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_implementation_final_boundary");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assert.equal(report.validation.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AO-REPORT-6: blocked review blocks candidate safe report", () => {
  const { boundaryDryRun, boundarySafety } = createBlockedBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const review = createControlledRuntimeImplementationCandidateReview(candidate);
  const report = createControlledRuntimeImplementationCandidateSafeReport(review, candidate);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AO-SAFETY-7: unsafe strings are sanitized from candidate artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { boundaryDryRun, boundarySafety } = createReadyBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety, { id: unsafe, created_at: unsafe });
  const review = createControlledRuntimeImplementationCandidateReview(candidate, { id: unsafe, created_at: unsafe });
  const report = createControlledRuntimeImplementationCandidateSafeReport(review, candidate, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ candidate, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AO-SAFETY-8: revocation keeps candidate artifacts disabled", () => {
  const { boundaryDryRun, boundarySafety } = createReadyBoundaryArtifacts();
  const candidate = createControlledRuntimeImplementationCandidate(boundaryDryRun, boundarySafety);
  const review = createControlledRuntimeImplementationCandidateReview(candidate);
  const report = createControlledRuntimeImplementationCandidateSafeReport(review, candidate);
  const revokedCandidate = revokeControlledRuntimeImplementationCandidate(candidate, "Operator revoked implementation candidate.");
  const revokedReview = revokeControlledRuntimeImplementationCandidateReview(review, "Operator revoked implementation candidate review.");
  const revokedReport = revokeControlledRuntimeImplementationCandidateSafeReport(report, "Operator revoked implementation candidate safe report.");

  assert.equal(revokedCandidate.candidate_state, "revoked");
  assert.equal(revokedCandidate.validation.complete, false);
  assert.equal(revokedCandidate.validation.ready_for_next_phase, false);
  assert.equal(revokedCandidate.provenance.generated_by, "revokeControlledRuntimeImplementationCandidate");
  assertDisabledBoundary(revokedCandidate.execution_boundary);

  assert.equal(revokedReview.candidate_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeControlledRuntimeImplementationCandidateReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeControlledRuntimeImplementationCandidateSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
