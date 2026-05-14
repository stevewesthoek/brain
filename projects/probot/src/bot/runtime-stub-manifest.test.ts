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
import { createRuntimeStubStore, createRuntimeStubRetrievalContract, createRuntimeStubStoreRetrievalSafeReport } from "./runtime-stub-store.js";
import {
  createRuntimeStubManifest,
  createRuntimeStubIndexContract,
  createRuntimeStubManifestIndexSafeReport,
  revokeRuntimeStubManifest,
  revokeRuntimeStubIndexContract,
  revokeRuntimeStubManifestIndexSafeReport,
} from "./runtime-stub-manifest.js";
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

function createReadyStoreArtifacts() {
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
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const retrieval = createRuntimeStubRetrievalContract(store, noopStub);
  const storeRetrievalSafeReport = createRuntimeStubStoreRetrievalSafeReport(retrieval, store);
  return { store, storeRetrievalSafeReport };
}

function createBlockedStoreArtifacts() {
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
  const store = createRuntimeStubStore(noopSafeReport, noopStub);
  const retrieval = createRuntimeStubRetrievalContract(store, noopStub);
  const storeRetrievalSafeReport = createRuntimeStubStoreRetrievalSafeReport(retrieval, store);
  return { store, storeRetrievalSafeReport };
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

test("VO-7AT-MANIFEST-1: runtime stub manifest indexes summary-only artifacts", () => {
  const { store, storeRetrievalSafeReport } = createReadyStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store, { id: "runtime-stub-manifest-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.manifest_state, "approved_for_future_index_contract");
  assert.equal(manifest.manifest_scope.artifact_only, true);
  assert.equal(manifest.manifest_controls.manifest_only, true);
  assert.equal(manifest.manifest_controls.indexes_summary_only, true);
  assert.equal(manifest.manifest_controls.contains_runtime_callable, false);
  assert.equal(manifest.manifest_controls.contains_raw_payload, false);
  assert.equal(manifest.manifest_controls.contains_raw_response, false);
  assert.equal(manifest.manifest_controls.contains_secret_material, false);
  assert.equal(manifest.manifest_entries.length, 3);
  assert.equal(manifest.manifest_entries.every((entry) => entry.runtime_callable_present === false && entry.raw_payload_present === false && entry.secret_material_present === false), true);
  assertDisabledBoundary(manifest.execution_boundary);
});

test("VO-7AT-MANIFEST-2: blocked store retrieval safe report blocks manifest", () => {
  const { store, storeRetrievalSafeReport } = createBlockedStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);

  assert.equal(manifest.manifest_state, "blocked");
  assert.equal(manifest.validation.complete, false);
  assert.equal(manifest.validation.ready_for_next_phase, false);
  assert.equal(manifest.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(manifest.execution_boundary);
});

test("VO-7AT-INDEX-3: runtime stub index contract indexes nothing now", () => {
  const { store, storeRetrievalSafeReport } = createReadyStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);
  const index = createRuntimeStubIndexContract(manifest, store, { id: "runtime-stub-index-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(index.schema_version, "1.0");
  assert.equal(index.index_contract_state, "approved_for_future_manifest_index_safe_report");
  assert.equal(index.index_scope.artifact_only, true);
  assert.equal(index.index_controls.index_contract_only, true);
  assert.equal(index.index_controls.indexes_summary_only, true);
  assert.equal(index.index_controls.contains_runtime_callable, false);
  assert.equal(index.index_controls.contains_raw_payload, false);
  assert.equal(index.index_controls.contains_raw_response, false);
  assert.equal(index.index_controls.contains_secret_material, false);
  assert.equal(index.index_entries.length, 3);
  assert.equal(index.index_entries.every((entry) => entry.indexed_now === false && entry.runtime_executed_now === false), true);
  assertDisabledBoundary(index.execution_boundary);
});

test("VO-7AT-INDEX-4: blocked manifest blocks index contract", () => {
  const { store, storeRetrievalSafeReport } = createBlockedStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);
  const index = createRuntimeStubIndexContract(manifest, store);

  assert.equal(index.index_contract_state, "blocked");
  assert.equal(index.validation.complete, false);
  assert.equal(index.validation.ready_for_next_phase, false);
  assert.equal(index.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(index.execution_boundary);
});

test("VO-7AT-REPORT-5: manifest index safe report contains no callable, payload, response, or secrets", () => {
  const { store, storeRetrievalSafeReport } = createReadyStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);
  const index = createRuntimeStubIndexContract(manifest, store);
  const report = createRuntimeStubManifestIndexSafeReport(index, manifest, { id: "runtime-stub-manifest-index-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_release_candidate");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AT-REPORT-6: blocked index contract blocks manifest index safe report", () => {
  const { store, storeRetrievalSafeReport } = createBlockedStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);
  const index = createRuntimeStubIndexContract(manifest, store);
  const report = createRuntimeStubManifestIndexSafeReport(index, manifest);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AT-SAFETY-7: unsafe strings are sanitized from manifest artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { store, storeRetrievalSafeReport } = createReadyStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store, { id: unsafe, created_at: unsafe });
  const index = createRuntimeStubIndexContract(manifest, store, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubManifestIndexSafeReport(index, manifest, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ manifest, index, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AT-SAFETY-8: revocation keeps manifest artifacts disabled", () => {
  const { store, storeRetrievalSafeReport } = createReadyStoreArtifacts();
  const manifest = createRuntimeStubManifest(storeRetrievalSafeReport, store);
  const index = createRuntimeStubIndexContract(manifest, store);
  const report = createRuntimeStubManifestIndexSafeReport(index, manifest);
  const revokedManifest = revokeRuntimeStubManifest(manifest, "Operator revoked runtime stub manifest.");
  const revokedIndex = revokeRuntimeStubIndexContract(index, "Operator revoked runtime stub index contract.");
  const revokedReport = revokeRuntimeStubManifestIndexSafeReport(report, "Operator revoked runtime stub manifest index safe report.");

  assert.equal(revokedManifest.manifest_state, "revoked");
  assert.equal(revokedManifest.validation.complete, false);
  assert.equal(revokedManifest.validation.ready_for_next_phase, false);
  assert.equal(revokedManifest.provenance.generated_by, "revokeRuntimeStubManifest");
  assertDisabledBoundary(revokedManifest.execution_boundary);

  assert.equal(revokedIndex.index_contract_state, "revoked");
  assert.equal(revokedIndex.validation.complete, false);
  assert.equal(revokedIndex.validation.ready_for_next_phase, false);
  assert.equal(revokedIndex.provenance.generated_by, "revokeRuntimeStubIndexContract");
  assertDisabledBoundary(revokedIndex.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubManifestIndexSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
