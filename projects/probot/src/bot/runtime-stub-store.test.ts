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
import { createNoopRuntimeStub, createNoopRuntimeStubReview, createNoopRuntimeStubSafeReport } from "./noop-runtime-stub.js";
import {
  createRuntimeStubStore,
  createRuntimeStubRetrievalContract,
  createRuntimeStubStoreRetrievalSafeReport,
  revokeRuntimeStubStore,
  revokeRuntimeStubRetrievalContract,
  revokeRuntimeStubStoreRetrievalSafeReport,
} from "./runtime-stub-store.js";
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

function createReadyNoopArtifacts() {
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
  const noopStub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const noopReview = createNoopRuntimeStubReview(noopStub);
  const noopSafeReport = createNoopRuntimeStubSafeReport(noopReview, noopStub);
  return { noopStub, noopSafeReport };
}

function createBlockedNoopArtifacts() {
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
  const noopStub = createNoopRuntimeStub(stubDryRunReport, stubContract);
  const noopReview = createNoopRuntimeStubReview(noopStub);
  const noopSafeReport = createNoopRuntimeStubSafeReport(noopReview, noopStub);
  return { noopStub, noopSafeReport };
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

test("VO-7AS-STORE-1: runtime stub store stores summary only", () => {
  const { noopStub, noopSafeReport } = createReadyNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub, { id: "runtime-stub-store-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(store.schema_version, "1.0");
  assert.equal(store.store_state, "approved_for_future_retrieval_contract");
  assert.equal(store.store_scope.artifact_only, true);
  assert.equal(store.store_controls.store_artifact_only, true);
  assert.equal(store.store_controls.stores_stub_summary_only, true);
  assert.equal(store.store_controls.stores_runtime_callable, false);
  assert.equal(store.store_controls.stores_raw_payload, false);
  assert.equal(store.store_controls.stores_raw_response, false);
  assert.equal(store.store_controls.stores_secret_material, false);
  assert.equal(store.stored_stub_summary.summary_only, true);
  assert.equal(store.stored_stub_summary.runtime_callable_stored, false);
  assert.equal(store.stored_stub_summary.raw_payload_stored, false);
  assert.equal(store.stored_stub_summary.raw_response_stored, false);
  assert.equal(store.stored_stub_summary.secret_material_stored, false);
  assertDisabledBoundary(store.execution_boundary);
});

test("VO-7AS-STORE-2: blocked no-op safe report blocks runtime stub store", () => {
  const { noopStub, noopSafeReport } = createBlockedNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);

  assert.equal(store.store_state, "blocked");
  assert.equal(store.validation.complete, false);
  assert.equal(store.validation.ready_for_next_phase, false);
  assert.equal(store.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(store.execution_boundary);
});

test("VO-7AS-RETRIEVAL-3: retrieval contract retrieves nothing executable", () => {
  const { noopStub, noopSafeReport } = createReadyNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const contract = createRuntimeStubRetrievalContract(store, noopStub, { id: "runtime-stub-retrieval-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.retrieval_contract_state, "approved_for_future_store_retrieval_safe_report");
  assert.equal(contract.retrieval_scope.artifact_only, true);
  assert.equal(contract.retrieval_controls.retrieval_contract_only, true);
  assert.equal(contract.retrieval_controls.retrieves_summary_only, true);
  assert.equal(contract.retrieval_controls.runtime_callable_retrieved, false);
  assert.equal(contract.retrieval_controls.raw_payload_retrieved, false);
  assert.equal(contract.retrieval_controls.raw_response_retrieved, false);
  assert.equal(contract.retrieval_controls.secret_material_retrieved, false);
  assert.equal(contract.retrieval_checks.length, 4);
  assert.equal(contract.retrieval_checks.every((check) => check.retrieved_now === false && check.runtime_executed_now === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AS-RETRIEVAL-4: blocked store blocks retrieval contract", () => {
  const { noopStub, noopSafeReport } = createBlockedNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const contract = createRuntimeStubRetrievalContract(store, noopStub);

  assert.equal(contract.retrieval_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7AS-REPORT-5: store retrieval safe report contains no callable, payload, response, or secrets", () => {
  const { noopStub, noopSafeReport } = createReadyNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const contract = createRuntimeStubRetrievalContract(store, noopStub);
  const report = createRuntimeStubStoreRetrievalSafeReport(contract, store, { id: "runtime-stub-store-retrieval-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_manifest");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AS-REPORT-6: blocked retrieval contract blocks store retrieval safe report", () => {
  const { noopStub, noopSafeReport } = createBlockedNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const contract = createRuntimeStubRetrievalContract(store, noopStub);
  const report = createRuntimeStubStoreRetrievalSafeReport(contract, store);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AS-SAFETY-7: unsafe strings are sanitized from store artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { noopStub, noopSafeReport } = createReadyNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub, { id: unsafe, created_at: unsafe });
  const contract = createRuntimeStubRetrievalContract(store, noopStub, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubStoreRetrievalSafeReport(contract, store, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ store, contract, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AS-SAFETY-8: revocation keeps store artifacts disabled", () => {
  const { noopStub, noopSafeReport } = createReadyNoopArtifacts();
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const contract = createRuntimeStubRetrievalContract(store, noopStub);
  const report = createRuntimeStubStoreRetrievalSafeReport(contract, store);
  const revokedStore = revokeRuntimeStubStore(store, "Operator revoked runtime stub store.");
  const revokedContract = revokeRuntimeStubRetrievalContract(contract, "Operator revoked runtime stub retrieval contract.");
  const revokedReport = revokeRuntimeStubStoreRetrievalSafeReport(report, "Operator revoked runtime stub store retrieval safe report.");

  assert.equal(revokedStore.store_state, "revoked");
  assert.equal(revokedStore.validation.complete, false);
  assert.equal(revokedStore.validation.ready_for_next_phase, false);
  assert.equal(revokedStore.provenance.generated_by, "revokeRuntimeStubStore");
  assertDisabledBoundary(revokedStore.execution_boundary);

  assert.equal(revokedContract.retrieval_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeStubRetrievalContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubStoreRetrievalSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
