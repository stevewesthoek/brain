import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationDryRunContract,
  createRuntimeActivationDryRunReview,
  createRuntimeActivationDryRunSafeReport,
  revokeRuntimeActivationDryRunContract,
  revokeRuntimeActivationDryRunReview,
  revokeRuntimeActivationDryRunSafeReport,
} from "./runtime-activation-dry-run.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationReadinessContract, RuntimeActivationReadinessSafeReport } from "./runtime-activation-readiness.js";

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

function readyReadinessContract(): RuntimeActivationReadinessContract {
  return {
    schema_version: "1.0",
    runtime_activation_readiness_contract_id: "runtime-activation-readiness-contract-001",
    runtime_activation_contract_safe_report_id: "runtime-activation-contract-safe-report-001",
    runtime_activation_contract_id: "runtime-activation-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    readiness_contract_state: "approved_for_future_readiness_review",
    required_artifacts: { runtime_activation_contract_safe_report_validated: true, runtime_activation_contract_validated: true },
    readiness_scope: {
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
    readiness_controls: {
      readiness_contract_only: true,
      readiness_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    readiness_terms: [
      { term_id: "readiness-contract-scope", term_kind: "scope", safe_summary: "Readiness contract scope only; no runtime enabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "readiness-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "readiness-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "readiness-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationReadinessContract", source_runtime_activation_contract_safe_report_id: "runtime-activation-contract-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyReadinessSafeReport(): RuntimeActivationReadinessSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_readiness_safe_report_id: "runtime-activation-readiness-safe-report-001",
    runtime_activation_readiness_review_id: "runtime-activation-readiness-review-001",
    runtime_activation_readiness_contract_id: "runtime-activation-readiness-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_dry_run_contract",
    required_artifacts: { runtime_activation_readiness_review_validated: true, runtime_activation_readiness_contract_validated: true },
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
      readiness_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "readiness-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation readiness contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "readiness-safe-report-review", section_kind: "review", safe_summary: "Runtime activation readiness review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "readiness-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
      { section_id: "readiness-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationReadinessSafeReport", source_runtime_activation_readiness_review_id: "runtime-activation-readiness-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedReadinessContract(): RuntimeActivationReadinessContract {
  return { ...readyReadinessContract(), readiness_contract_state: "blocked", validation: { ...readyReadinessContract().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Readiness contract blocked."] } };
}

function blockedReadinessSafeReport(): RuntimeActivationReadinessSafeReport {
  return { ...readyReadinessSafeReport(), safe_report_state: "blocked", validation: { ...readyReadinessSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Readiness safe report blocked."] } };
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

test("VO-7BE-DRY-RUN-1: runtime activation dry-run contract is dry-run-only and does not execute", () => {
  const contract = createRuntimeActivationDryRunContract(readyReadinessSafeReport(), readyReadinessContract(), { id: "runtime-activation-dry-run-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.dry_run_contract_state, "approved_for_future_dry_run_review");
  assert.equal(contract.dry_run_controls.dry_run_contract_only, true);
  assert.equal(contract.dry_run_controls.dry_run_only, true);
  assert.equal(contract.dry_run_controls.runtime_wiring_implemented, false);
  assert.equal(contract.dry_run_controls.contains_runtime_callable, false);
  assert.equal(contract.dry_run_terms.length, 4);
  assert.equal(contract.dry_run_terms.every((term) => term.runtime_enabled_now === false && term.dry_run_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BE-DRY-RUN-2: blocked readiness inputs block dry-run contract", () => {
  const contract = createRuntimeActivationDryRunContract(blockedReadinessSafeReport(), blockedReadinessContract());

  assert.equal(contract.dry_run_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BE-DRY-RUN-3: runtime activation dry-run review remains review-only and does not execute", () => {
  const readinessSafeReport = readyReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, readyReadinessContract());
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport, { id: "runtime-activation-dry-run-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.dry_run_review_state, "approved_for_future_dry_run_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.dry_run_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.dry_run_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BE-DRY-RUN-4: blocked dry-run contract blocks dry-run review", () => {
  const readinessSafeReport = blockedReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, blockedReadinessContract());
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport);

  assert.equal(review.dry_run_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BE-DRY-RUN-5: dry-run safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const readinessSafeReport = readyReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, readyReadinessContract());
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport);
  const report = createRuntimeActivationDryRunSafeReport(review, contract, { id: "runtime-activation-dry-run-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_dry_run_design");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.dry_run_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.dry_run_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BE-DRY-RUN-6: blocked dry-run review blocks safe report", () => {
  const readinessSafeReport = blockedReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, blockedReadinessContract());
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport);
  const report = createRuntimeActivationDryRunSafeReport(review, contract);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BE-SAFETY-7: unsafe strings are sanitized from dry-run artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const readinessSafeReport = readyReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, readyReadinessContract(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationDryRunSafeReport(review, contract, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ contract, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BE-SAFETY-8: revocation keeps dry-run artifacts disabled", () => {
  const readinessSafeReport = readyReadinessSafeReport();
  const contract = createRuntimeActivationDryRunContract(readinessSafeReport, readyReadinessContract());
  const review = createRuntimeActivationDryRunReview(contract, readinessSafeReport);
  const report = createRuntimeActivationDryRunSafeReport(review, contract);
  const revokedContract = revokeRuntimeActivationDryRunContract(contract, "Operator revoked runtime activation dry-run contract.");
  const revokedReview = revokeRuntimeActivationDryRunReview(review, "Operator revoked runtime activation dry-run review.");
  const revokedReport = revokeRuntimeActivationDryRunSafeReport(report, "Operator revoked runtime activation dry-run safe report.");

  assert.equal(revokedContract.dry_run_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeActivationDryRunContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.dry_run_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationDryRunReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationDryRunSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
