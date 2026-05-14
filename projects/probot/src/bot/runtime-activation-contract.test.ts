import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationContract,
  createRuntimeActivationContractReview,
  createRuntimeActivationContractSafeReport,
  revokeRuntimeActivationContract,
  revokeRuntimeActivationContractReview,
  revokeRuntimeActivationContractSafeReport,
} from "./runtime-activation-contract.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ExplicitRuntimeActivationDesignBoundary, ExplicitRuntimeActivationDesignSafeReport } from "./explicit-runtime-activation-design.js";

const DISABLED_BOUNDARY: DisabledEnablementBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  runtime_enabled: false,
  runtime_executed: false,
  upload_allowed: false,
  upload_execution_enabled: false,
  platform_api_calls_allowed: false,
  network_calls_allowed: false,
  credentials_accessed: false,
  token_accessed: false,
  keychain_accessed: false,
  env_accessed: false,
  media_file_read: false,
  file_mutation_allowed: false,
  dependencies_added: false,
  package_metadata_changed: false,
};

function readyDesignBoundary(): ExplicitRuntimeActivationDesignBoundary {
  return {
    schema_version: "1.0",
    explicit_runtime_activation_design_boundary_id: "explicit-runtime-activation-design-boundary-001",
    runtime_stub_next_phase_decision_record_id: "runtime-stub-next-phase-decision-record-001",
    runtime_stub_operator_handoff_checklist_id: "runtime-stub-operator-handoff-checklist-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    design_boundary_state: "approved_for_future_design_review",
    required_artifacts: { runtime_stub_next_phase_decision_record_validated: true, runtime_stub_operator_handoff_checklist_validated: true },
    design_scope: {
      artifact_only: true,
      future_next_phase_requested: true,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    design_controls: {
      design_only: true,
      activation_boundary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    design_sections: [
      { section_id: "design-boundary-scope", section_kind: "scope", safe_summary: "Future explicit activation design boundary only.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-boundary-interfaces", section_kind: "interfaces", safe_summary: "Interface design only; no callables or payloads.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-boundary-credentials", section_kind: "credentials", safe_summary: "Credential access remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-boundary-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createExplicitRuntimeActivationDesignBoundary", source_runtime_stub_next_phase_decision_record_id: "runtime-stub-next-phase-decision-record-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyDesignSafeReport(): ExplicitRuntimeActivationDesignSafeReport {
  return {
    schema_version: "1.0",
    explicit_runtime_activation_design_safe_report_id: "explicit-runtime-activation-design-safe-report-001",
    explicit_runtime_activation_design_review_id: "explicit-runtime-activation-design-review-001",
    explicit_runtime_activation_design_boundary_id: "explicit-runtime-activation-design-boundary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_contract",
    required_artifacts: { explicit_runtime_activation_design_review_validated: true, explicit_runtime_activation_design_boundary_validated: true },
    report_scope: {
      artifact_only: true,
      future_next_phase_requested: true,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    report_controls: {
      safe_report_only: true,
      activation_design_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "design-safe-report-boundary", section_kind: "boundary", safe_summary: "Design boundary is safe-report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-safe-report-review", section_kind: "review", safe_summary: "Design review is safe-report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "design-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createExplicitRuntimeActivationDesignSafeReport", source_explicit_runtime_activation_design_review_id: "explicit-runtime-activation-design-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedDesignBoundary(): ExplicitRuntimeActivationDesignBoundary {
  return { ...readyDesignBoundary(), design_boundary_state: "blocked", validation: { ...readyDesignBoundary().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Design boundary blocked."] } };
}

function blockedDesignSafeReport(): ExplicitRuntimeActivationDesignSafeReport {
  return { ...readyDesignSafeReport(), safe_report_state: "blocked", validation: { ...readyDesignSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Design safe report blocked."] } };
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

test("VO-7BC-CONTRACT-1: runtime activation contract is contract-only", () => {
  const contract = createRuntimeActivationContract(readyDesignSafeReport(), readyDesignBoundary(), { id: "runtime-activation-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.contract_state, "approved_for_future_contract_review");
  assert.equal(contract.contract_controls.contract_only, true);
  assert.equal(contract.contract_controls.activation_contract_only, true);
  assert.equal(contract.contract_controls.runtime_wiring_implemented, false);
  assert.equal(contract.contract_controls.contains_runtime_callable, false);
  assert.equal(contract.contract_terms.length, 4);
  assert.equal(contract.contract_terms.every((term) => term.runtime_enabled_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BC-CONTRACT-2: blocked design inputs block runtime activation contract", () => {
  const contract = createRuntimeActivationContract(blockedDesignSafeReport(), blockedDesignBoundary());

  assert.equal(contract.contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BC-CONTRACT-3: runtime activation contract review remains review-only", () => {
  const designSafeReport = readyDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, readyDesignBoundary());
  const review = createRuntimeActivationContractReview(contract, designSafeReport, { id: "runtime-activation-contract-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.contract_review_state, "approved_for_future_contract_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.contract_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BC-CONTRACT-4: blocked contract blocks contract review", () => {
  const designSafeReport = blockedDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, blockedDesignBoundary());
  const review = createRuntimeActivationContractReview(contract, designSafeReport);

  assert.equal(review.contract_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BC-CONTRACT-5: contract safe report contains no callable, payload, response, or secrets", () => {
  const designSafeReport = readyDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, readyDesignBoundary());
  const review = createRuntimeActivationContractReview(contract, designSafeReport);
  const report = createRuntimeActivationContractSafeReport(review, contract, { id: "runtime-activation-contract-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_readiness_contract");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.activation_contract_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BC-CONTRACT-6: blocked contract review blocks safe report", () => {
  const designSafeReport = blockedDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, blockedDesignBoundary());
  const review = createRuntimeActivationContractReview(contract, designSafeReport);
  const report = createRuntimeActivationContractSafeReport(review, contract);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BC-SAFETY-7: unsafe strings are sanitized from contract artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const designSafeReport = readyDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, readyDesignBoundary(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationContractReview(contract, designSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationContractSafeReport(review, contract, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ contract, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BC-SAFETY-8: revocation keeps contract artifacts disabled", () => {
  const designSafeReport = readyDesignSafeReport();
  const contract = createRuntimeActivationContract(designSafeReport, readyDesignBoundary());
  const review = createRuntimeActivationContractReview(contract, designSafeReport);
  const report = createRuntimeActivationContractSafeReport(review, contract);
  const revokedContract = revokeRuntimeActivationContract(contract, "Operator revoked runtime activation contract.");
  const revokedReview = revokeRuntimeActivationContractReview(review, "Operator revoked runtime activation contract review.");
  const revokedReport = revokeRuntimeActivationContractSafeReport(report, "Operator revoked runtime activation contract safe report.");

  assert.equal(revokedContract.contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeActivationContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.contract_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationContractReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationContractSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
