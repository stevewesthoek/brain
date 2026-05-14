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
import {
  createControlledRuntimeImplementationFinalBoundary,
  createControlledRuntimeImplementationFinalBoundaryReview,
  createControlledRuntimeImplementationFinalBoundarySafeReport,
  revokeControlledRuntimeImplementationFinalBoundary,
  revokeControlledRuntimeImplementationFinalBoundaryReview,
  revokeControlledRuntimeImplementationFinalBoundarySafeReport,
} from "./controlled-runtime-implementation-final-boundary.js";
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

function createReadyCandidateArtifacts() {
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
  const review = createControlledRuntimeImplementationCandidateReview(candidate);
  const candidateSafeReport = createControlledRuntimeImplementationCandidateSafeReport(review, candidate);
  return { candidate, candidateSafeReport };
}

function createBlockedCandidateArtifacts() {
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
  const review = createControlledRuntimeImplementationCandidateReview(candidate);
  const candidateSafeReport = createControlledRuntimeImplementationCandidateSafeReport(review, candidate);
  return { candidate, candidateSafeReport };
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

test("VO-7AP-FINAL-BOUNDARY-1: final boundary approves only future final boundary review", () => {
  const { candidate, candidateSafeReport } = createReadyCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate, { id: "controlled-runtime-implementation-final-boundary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(boundary.schema_version, "1.0");
  assert.equal(boundary.final_boundary_state, "approved_for_future_final_boundary_review");
  assert.equal(boundary.boundary_scope.artifact_only, true);
  assert.equal(boundary.boundary_scope.future_next_phase_requested, true);
  assert.equal(boundary.boundary_controls.final_boundary_only, true);
  assert.equal(boundary.boundary_controls.safe_stub_only, true);
  assert.equal(boundary.boundary_items.length, 5);
  assert.equal(boundary.boundary_items.every((item) => item.implemented_now === false), true);
  assert.equal(boundary.validation.ready_for_real_upload, false);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7AP-FINAL-BOUNDARY-2: blocked candidate safe report blocks final boundary", () => {
  const { candidate, candidateSafeReport } = createBlockedCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);

  assert.equal(boundary.final_boundary_state, "blocked");
  assert.equal(boundary.validation.complete, false);
  assert.equal(boundary.validation.ready_for_next_phase, false);
  assert.equal(boundary.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7AP-FINAL-BOUNDARY-3: final boundary review passes boundary items only", () => {
  const { candidate, candidateSafeReport } = createReadyCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary, { id: "controlled-runtime-implementation-final-boundary-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.final_boundary_review_state, "approved_for_future_final_boundary_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.final_boundary_reviewed, true);
  assert.equal(review.review_items.length, 5);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.implemented_now === false), true);
  assert.equal(review.validation.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AP-FINAL-BOUNDARY-4: blocked final boundary blocks review", () => {
  const { candidate, candidateSafeReport } = createBlockedCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary);

  assert.equal(review.final_boundary_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AP-FINAL-BOUNDARY-5: final boundary safe report contains no payloads, responses, or secrets", () => {
  const { candidate, candidateSafeReport } = createReadyCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary);
  const report = createControlledRuntimeImplementationFinalBoundarySafeReport(review, boundary, { id: "controlled-runtime-implementation-final-boundary-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_real_runtime_stub_boundary");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assert.equal(report.validation.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AP-FINAL-BOUNDARY-6: blocked review blocks final boundary safe report", () => {
  const { candidate, candidateSafeReport } = createBlockedCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary);
  const report = createControlledRuntimeImplementationFinalBoundarySafeReport(review, boundary);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AP-SAFETY-7: unsafe strings are sanitized from final boundary artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { candidate, candidateSafeReport } = createReadyCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate, { id: unsafe, created_at: unsafe });
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary, { id: unsafe, created_at: unsafe });
  const report = createControlledRuntimeImplementationFinalBoundarySafeReport(review, boundary, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ boundary, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AP-SAFETY-8: revocation keeps final boundary artifacts disabled", () => {
  const { candidate, candidateSafeReport } = createReadyCandidateArtifacts();
  const boundary = createControlledRuntimeImplementationFinalBoundary(candidateSafeReport, candidate);
  const review = createControlledRuntimeImplementationFinalBoundaryReview(boundary);
  const report = createControlledRuntimeImplementationFinalBoundarySafeReport(review, boundary);
  const revokedBoundary = revokeControlledRuntimeImplementationFinalBoundary(boundary, "Operator revoked final boundary.");
  const revokedReview = revokeControlledRuntimeImplementationFinalBoundaryReview(review, "Operator revoked final boundary review.");
  const revokedReport = revokeControlledRuntimeImplementationFinalBoundarySafeReport(report, "Operator revoked final boundary safe report.");

  assert.equal(revokedBoundary.final_boundary_state, "revoked");
  assert.equal(revokedBoundary.validation.complete, false);
  assert.equal(revokedBoundary.validation.ready_for_next_phase, false);
  assert.equal(revokedBoundary.provenance.generated_by, "revokeControlledRuntimeImplementationFinalBoundary");
  assertDisabledBoundary(revokedBoundary.execution_boundary);

  assert.equal(revokedReview.final_boundary_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeControlledRuntimeImplementationFinalBoundaryReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeControlledRuntimeImplementationFinalBoundarySafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
