import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationFinalBoundary,
  createRuntimeActivationFinalBoundaryReview,
  createRuntimeActivationFinalBoundarySafeReport,
  revokeRuntimeActivationFinalBoundary,
  revokeRuntimeActivationFinalBoundaryReview,
  revokeRuntimeActivationFinalBoundarySafeReport,
} from "./runtime-activation-final-boundary.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationRehearsalContract, RuntimeActivationRehearsalSafeReport } from "./runtime-activation-rehearsal.js";

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

function readyRehearsalContract(): RuntimeActivationRehearsalContract {
  return {
    schema_version: "1.0",
    runtime_activation_rehearsal_contract_id: "runtime-activation-rehearsal-contract-001",
    runtime_activation_simulation_safe_report_id: "runtime-activation-simulation-safe-report-001",
    runtime_activation_simulation_contract_id: "runtime-activation-simulation-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    rehearsal_contract_state: "approved_for_future_rehearsal_review",
    required_artifacts: { runtime_activation_simulation_safe_report_validated: true, runtime_activation_simulation_contract_validated: true },
    rehearsal_scope: {
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
    rehearsal_controls: {
      rehearsal_contract_only: true,
      rehearsal_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      rehearsal_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    rehearsal_terms: [
      { term_id: "rehearsal-contract-scope", term_kind: "scope", safe_summary: "Rehearsal contract scope only; no runtime enabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "rehearsal-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "rehearsal-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "rehearsal-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationRehearsalContract", source_runtime_activation_simulation_safe_report_id: "runtime-activation-simulation-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyRehearsalSafeReport(): RuntimeActivationRehearsalSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_rehearsal_safe_report_id: "runtime-activation-rehearsal-safe-report-001",
    runtime_activation_rehearsal_review_id: "runtime-activation-rehearsal-review-001",
    runtime_activation_rehearsal_contract_id: "runtime-activation-rehearsal-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_final_boundary",
    required_artifacts: { runtime_activation_rehearsal_review_validated: true, runtime_activation_rehearsal_contract_validated: true },
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
      rehearsal_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      rehearsal_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "rehearsal-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation rehearsal contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "rehearsal-safe-report-review", section_kind: "review", safe_summary: "Runtime activation rehearsal review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "rehearsal-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "rehearsal-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, rehearsal_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationRehearsalSafeReport", source_runtime_activation_rehearsal_review_id: "runtime-activation-rehearsal-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedRehearsalContract(): RuntimeActivationRehearsalContract {
  return { ...readyRehearsalContract(), rehearsal_contract_state: "blocked", validation: { ...readyRehearsalContract().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Rehearsal contract blocked."] } };
}

function blockedRehearsalSafeReport(): RuntimeActivationRehearsalSafeReport {
  return { ...readyRehearsalSafeReport(), safe_report_state: "blocked", validation: { ...readyRehearsalSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Rehearsal safe report blocked."] } };
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

test("VO-7BI-FINAL-BOUNDARY-1: runtime activation final boundary is boundary-only and does not open", () => {
  const boundary = createRuntimeActivationFinalBoundary(readyRehearsalSafeReport(), readyRehearsalContract(), { id: "runtime-activation-final-boundary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(boundary.schema_version, "1.0");
  assert.equal(boundary.final_boundary_state, "approved_for_future_final_boundary_review");
  assert.equal(boundary.final_boundary_controls.final_boundary_only, true);
  assert.equal(boundary.final_boundary_controls.boundary_review_only, true);
  assert.equal(boundary.final_boundary_controls.runtime_wiring_implemented, false);
  assert.equal(boundary.final_boundary_controls.final_boundary_opened, false);
  assert.equal(boundary.final_boundary_terms.length, 4);
  assert.equal(boundary.final_boundary_terms.every((term) => term.runtime_enabled_now === false && term.boundary_opened_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7BI-FINAL-BOUNDARY-2: blocked rehearsal inputs block final boundary", () => {
  const boundary = createRuntimeActivationFinalBoundary(blockedRehearsalSafeReport(), blockedRehearsalContract());

  assert.equal(boundary.final_boundary_state, "blocked");
  assert.equal(boundary.validation.complete, false);
  assert.equal(boundary.validation.ready_for_next_phase, false);
  assert.equal(boundary.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7BI-FINAL-BOUNDARY-3: final-boundary review remains review-only and does not open boundary", () => {
  const rehearsalSafeReport = readyRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, readyRehearsalContract());
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport, { id: "runtime-activation-final-boundary-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.final_boundary_review_state, "approved_for_future_final_boundary_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.final_boundary_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.final_boundary_opened, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.boundary_opened_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BI-FINAL-BOUNDARY-4: blocked final boundary blocks final-boundary review", () => {
  const rehearsalSafeReport = blockedRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, blockedRehearsalContract());
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport);

  assert.equal(review.final_boundary_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BI-FINAL-BOUNDARY-5: final-boundary safe report contains no callable, payload, response, or secrets and does not open", () => {
  const rehearsalSafeReport = readyRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, readyRehearsalContract());
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport);
  const report = createRuntimeActivationFinalBoundarySafeReport(review, boundary, { id: "runtime-activation-final-boundary-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_closeout");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.final_boundary_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.final_boundary_opened, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.boundary_opened_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BI-FINAL-BOUNDARY-6: blocked final-boundary review blocks safe report", () => {
  const rehearsalSafeReport = blockedRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, blockedRehearsalContract());
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport);
  const report = createRuntimeActivationFinalBoundarySafeReport(review, boundary);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BI-SAFETY-7: unsafe strings are sanitized from final-boundary artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const rehearsalSafeReport = readyRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, readyRehearsalContract(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationFinalBoundarySafeReport(review, boundary, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ boundary, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BI-SAFETY-8: revocation keeps final-boundary artifacts disabled", () => {
  const rehearsalSafeReport = readyRehearsalSafeReport();
  const boundary = createRuntimeActivationFinalBoundary(rehearsalSafeReport, readyRehearsalContract());
  const review = createRuntimeActivationFinalBoundaryReview(boundary, rehearsalSafeReport);
  const report = createRuntimeActivationFinalBoundarySafeReport(review, boundary);
  const revokedBoundary = revokeRuntimeActivationFinalBoundary(boundary, "Operator revoked runtime activation final boundary.");
  const revokedReview = revokeRuntimeActivationFinalBoundaryReview(review, "Operator revoked runtime activation final-boundary review.");
  const revokedReport = revokeRuntimeActivationFinalBoundarySafeReport(report, "Operator revoked runtime activation final-boundary safe report.");

  assert.equal(revokedBoundary.final_boundary_state, "revoked");
  assert.equal(revokedBoundary.validation.complete, false);
  assert.equal(revokedBoundary.validation.ready_for_next_phase, false);
  assert.equal(revokedBoundary.provenance.generated_by, "revokeRuntimeActivationFinalBoundary");
  assertDisabledBoundary(revokedBoundary.execution_boundary);

  assert.equal(revokedReview.final_boundary_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationFinalBoundaryReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationFinalBoundarySafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
