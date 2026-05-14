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
} from "./controlled-runtime-activation-finalization.js";
import {
  createControlledRuntimeActivationGoNoGo,
  createControlledRuntimeActivationFinalSafeReport,
  createControlledRuntimeActivationBoundaryCompletionSummary,
  revokeControlledRuntimeActivationGoNoGo,
  revokeControlledRuntimeActivationFinalSafeReport,
  revokeControlledRuntimeActivationBoundaryCompletionSummary,
} from "./controlled-runtime-activation-summary.js";
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

function createReadyFinalizationArtifacts() {
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
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);
  return { rollbackPlan, finalReview };
}

function createBlockedFinalizationArtifacts() {
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
  const candidate = createControlledRuntimeActivationCandidate(implementationReview, implementationContract);
  const finalReview = createControlledRuntimeActivationFinalReview(candidate);
  const rollbackPlan = createControlledRuntimeActivationRollbackPlan(finalReview, candidate);
  return { rollbackPlan, finalReview };
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

test("VO-7AM-SUMMARY-1: go/no-go approves only final safe activation report", () => {
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview, {
    id: "controlled-runtime-activation-go-no-go-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(goNoGo.schema_version, "1.0");
  assert.equal(goNoGo.go_no_go_state, "approved_for_final_safe_activation_report");
  assert.equal(goNoGo.decision_scope.artifact_only, true);
  assert.equal(goNoGo.decision_scope.future_next_phase_requested, true);
  assert.equal(goNoGo.decision_scope.real_upload_enabled_now, false);
  assert.equal(goNoGo.validation.complete, true);
  assert.equal(goNoGo.validation.ready_for_next_phase, true);
  assert.equal(goNoGo.validation.ready_for_real_upload, false);
  assertDisabledBoundary(goNoGo.execution_boundary);
});

test("VO-7AM-SUMMARY-2: no-go decision blocks next phase without enabling upload", () => {
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview, { operatorGo: false });

  assert.equal(goNoGo.go_no_go_state, "no_go");
  assert.equal(goNoGo.validation.complete, false);
  assert.equal(goNoGo.validation.ready_for_next_phase, false);
  assert.equal(goNoGo.validation.ready_for_real_upload, false);
  assertDisabledBoundary(goNoGo.execution_boundary);
});

test("VO-7AM-SUMMARY-3: blocked rollback/final review blocks go/no-go", () => {
  const { rollbackPlan, finalReview } = createBlockedFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);

  assert.equal(goNoGo.go_no_go_state, "blocked");
  assert.equal(goNoGo.validation.complete, false);
  assert.equal(goNoGo.validation.ready_for_next_phase, false);
  assert.equal(goNoGo.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(goNoGo.execution_boundary);
});

test("VO-7AM-SUMMARY-4: final safe report contains safe sections only", () => {
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo, {
    id: "controlled-runtime-activation-final-safe-report-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.final_safe_report_state, "approved_for_boundary_completion_summary");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.report_scope.future_next_phase_requested, true);
  assert.equal(report.report_scope.real_upload_enabled_now, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assert.equal(report.validation.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AM-SUMMARY-5: blocked go/no-go blocks final safe report", () => {
  const { rollbackPlan, finalReview } = createBlockedFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo);

  assert.equal(report.final_safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AM-SUMMARY-6: boundary completion summary closes artifact chain but keeps implementation required", () => {
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(report, goNoGo, {
    id: "controlled-runtime-activation-boundary-completion-summary-001",
    created_at: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.boundary_completion_state, "approved_for_future_runtime_activation_implementation_boundary");
  assert.equal(summary.summary_scope.artifact_only, true);
  assert.equal(summary.summary_scope.future_next_phase_requested, true);
  assert.equal(summary.summary_scope.real_upload_enabled_now, false);
  assert.equal(summary.completion_findings.artifact_chain_complete, true);
  assert.equal(summary.completion_findings.runtime_implementation_still_required, true);
  assert.equal(summary.completion_findings.separate_activation_commit_required, true);
  assert.equal(summary.completion_findings.real_upload_still_blocked, true);
  assert.equal(summary.validation.ready_for_real_upload, false);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AM-SUMMARY-7: blocked final safe report blocks boundary completion summary", () => {
  const { rollbackPlan, finalReview } = createBlockedFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(report, goNoGo);

  assert.equal(summary.boundary_completion_state, "blocked");
  assert.equal(summary.validation.complete, false);
  assert.equal(summary.validation.ready_for_next_phase, false);
  assert.equal(summary.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AM-SAFETY-8: unsafe strings are sanitized from summary artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview, { id: unsafe, created_at: unsafe });
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo, { id: unsafe, created_at: unsafe });
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(report, goNoGo, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ goNoGo, report, summary });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AM-SAFETY-9: revocation keeps summary artifacts disabled", () => {
  const { rollbackPlan, finalReview } = createReadyFinalizationArtifacts();
  const goNoGo = createControlledRuntimeActivationGoNoGo(rollbackPlan, finalReview);
  const report = createControlledRuntimeActivationFinalSafeReport(goNoGo);
  const summary = createControlledRuntimeActivationBoundaryCompletionSummary(report, goNoGo);
  const revokedGoNoGo = revokeControlledRuntimeActivationGoNoGo(goNoGo, "Operator revoked go/no-go.");
  const revokedReport = revokeControlledRuntimeActivationFinalSafeReport(report, "Operator revoked final safe report.");
  const revokedSummary = revokeControlledRuntimeActivationBoundaryCompletionSummary(summary, "Operator revoked boundary completion summary.");

  assert.equal(revokedGoNoGo.go_no_go_state, "revoked");
  assert.equal(revokedGoNoGo.validation.complete, false);
  assert.equal(revokedGoNoGo.validation.ready_for_next_phase, false);
  assert.equal(revokedGoNoGo.provenance.generated_by, "revokeControlledRuntimeActivationGoNoGo");
  assertDisabledBoundary(revokedGoNoGo.execution_boundary);

  assert.equal(revokedReport.final_safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeControlledRuntimeActivationFinalSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);

  assert.equal(revokedSummary.boundary_completion_state, "revoked");
  assert.equal(revokedSummary.validation.complete, false);
  assert.equal(revokedSummary.validation.ready_for_next_phase, false);
  assert.equal(revokedSummary.provenance.generated_by, "revokeControlledRuntimeActivationBoundaryCompletionSummary");
  assertDisabledBoundary(revokedSummary.execution_boundary);
});
