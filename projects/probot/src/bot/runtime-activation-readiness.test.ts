import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationReadinessContract,
  createRuntimeActivationReadinessReview,
  createRuntimeActivationReadinessSafeReport,
  revokeRuntimeActivationReadinessContract,
  revokeRuntimeActivationReadinessReview,
  revokeRuntimeActivationReadinessSafeReport,
} from "./runtime-activation-readiness.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationContract, RuntimeActivationContractSafeReport } from "./runtime-activation-contract.js";

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

function readyContract(): RuntimeActivationContract {
  return {
    schema_version: "1.0",
    runtime_activation_contract_id: "runtime-activation-contract-001",
    explicit_runtime_activation_design_safe_report_id: "explicit-runtime-activation-design-safe-report-001",
    explicit_runtime_activation_design_boundary_id: "explicit-runtime-activation-design-boundary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    contract_state: "approved_for_future_contract_review",
    required_artifacts: { explicit_runtime_activation_design_safe_report_validated: true, explicit_runtime_activation_design_boundary_validated: true },
    contract_scope: {
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
    contract_controls: {
      contract_only: true,
      activation_contract_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    contract_terms: [
      { term_id: "contract-scope", term_kind: "scope", safe_summary: "Contract scope only; no runtime enabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationContract", source_explicit_runtime_activation_design_safe_report_id: "explicit-runtime-activation-design-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyContractSafeReport(): RuntimeActivationContractSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_contract_safe_report_id: "runtime-activation-contract-safe-report-001",
    runtime_activation_contract_review_id: "runtime-activation-contract-review-001",
    runtime_activation_contract_id: "runtime-activation-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_readiness_contract",
    required_artifacts: { runtime_activation_contract_review_validated: true, runtime_activation_contract_validated: true },
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
      activation_contract_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "contract-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "contract-safe-report-review", section_kind: "review", safe_summary: "Runtime activation contract review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "contract-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "contract-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationContractSafeReport", source_runtime_activation_contract_review_id: "runtime-activation-contract-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedContract(): RuntimeActivationContract {
  return { ...readyContract(), contract_state: "blocked", validation: { ...readyContract().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Contract blocked."] } };
}

function blockedContractSafeReport(): RuntimeActivationContractSafeReport {
  return { ...readyContractSafeReport(), safe_report_state: "blocked", validation: { ...readyContractSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Contract safe report blocked."] } };
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

test("VO-7BD-READINESS-1: runtime activation readiness contract is readiness-only", () => {
  const contract = createRuntimeActivationReadinessContract(readyContractSafeReport(), readyContract(), { id: "runtime-activation-readiness-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.readiness_contract_state, "approved_for_future_readiness_review");
  assert.equal(contract.readiness_controls.readiness_contract_only, true);
  assert.equal(contract.readiness_controls.readiness_only, true);
  assert.equal(contract.readiness_controls.runtime_wiring_implemented, false);
  assert.equal(contract.readiness_controls.contains_runtime_callable, false);
  assert.equal(contract.readiness_terms.length, 4);
  assert.equal(contract.readiness_terms.every((term) => term.runtime_enabled_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BD-READINESS-2: blocked contract inputs block readiness contract", () => {
  const contract = createRuntimeActivationReadinessContract(blockedContractSafeReport(), blockedContract());

  assert.equal(contract.readiness_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BD-READINESS-3: runtime activation readiness review remains review-only", () => {
  const contractSafeReport = readyContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, readyContract());
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport, { id: "runtime-activation-readiness-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.readiness_review_state, "approved_for_future_readiness_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.readiness_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BD-READINESS-4: blocked readiness contract blocks readiness review", () => {
  const contractSafeReport = blockedContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, blockedContract());
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport);

  assert.equal(review.readiness_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BD-READINESS-5: readiness safe report contains no callable, payload, response, or secrets", () => {
  const contractSafeReport = readyContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, readyContract());
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport);
  const report = createRuntimeActivationReadinessSafeReport(review, contract, { id: "runtime-activation-readiness-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_dry_run_contract");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.readiness_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BD-READINESS-6: blocked readiness review blocks safe report", () => {
  const contractSafeReport = blockedContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, blockedContract());
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport);
  const report = createRuntimeActivationReadinessSafeReport(review, contract);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BD-SAFETY-7: unsafe strings are sanitized from readiness artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const contractSafeReport = readyContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, readyContract(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationReadinessSafeReport(review, contract, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ contract, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BD-SAFETY-8: revocation keeps readiness artifacts disabled", () => {
  const contractSafeReport = readyContractSafeReport();
  const contract = createRuntimeActivationReadinessContract(contractSafeReport, readyContract());
  const review = createRuntimeActivationReadinessReview(contract, contractSafeReport);
  const report = createRuntimeActivationReadinessSafeReport(review, contract);
  const revokedContract = revokeRuntimeActivationReadinessContract(contract, "Operator revoked runtime activation readiness contract.");
  const revokedReview = revokeRuntimeActivationReadinessReview(review, "Operator revoked runtime activation readiness review.");
  const revokedReport = revokeRuntimeActivationReadinessSafeReport(report, "Operator revoked runtime activation readiness safe report.");

  assert.equal(revokedContract.readiness_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeActivationReadinessContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.readiness_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationReadinessReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationReadinessSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
