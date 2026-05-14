import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationCloseout,
  createRuntimeActivationCloseoutReview,
  createRuntimeActivationCloseoutSafeReport,
  revokeRuntimeActivationCloseout,
  revokeRuntimeActivationCloseoutReview,
  revokeRuntimeActivationCloseoutSafeReport,
} from "./runtime-activation-closeout.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationFinalBoundary, RuntimeActivationFinalBoundarySafeReport } from "./runtime-activation-final-boundary.js";

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

function readyFinalBoundary(): RuntimeActivationFinalBoundary {
  return {
    schema_version: "1.0",
    runtime_activation_final_boundary_id: "runtime-activation-final-boundary-001",
    runtime_activation_rehearsal_safe_report_id: "runtime-activation-rehearsal-safe-report-001",
    runtime_activation_rehearsal_contract_id: "runtime-activation-rehearsal-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    final_boundary_state: "approved_for_future_final_boundary_review",
    required_artifacts: { runtime_activation_rehearsal_safe_report_validated: true, runtime_activation_rehearsal_contract_validated: true },
    final_boundary_scope: {
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
    final_boundary_controls: {
      final_boundary_only: true,
      boundary_review_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      final_boundary_opened: false,
      real_upload_still_blocked: true,
    },
    final_boundary_terms: [
      { term_id: "final-boundary-scope", term_kind: "scope", safe_summary: "Final-boundary scope only; no runtime enabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "final-boundary-runtime", term_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "final-boundary-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "final-boundary-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationFinalBoundary", source_runtime_activation_rehearsal_safe_report_id: "runtime-activation-rehearsal-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyFinalBoundarySafeReport(): RuntimeActivationFinalBoundarySafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_final_boundary_safe_report_id: "runtime-activation-final-boundary-safe-report-001",
    runtime_activation_final_boundary_review_id: "runtime-activation-final-boundary-review-001",
    runtime_activation_final_boundary_id: "runtime-activation-final-boundary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_closeout",
    required_artifacts: { runtime_activation_final_boundary_review_validated: true, runtime_activation_final_boundary_validated: true },
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
      final_boundary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      final_boundary_opened: false,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "final-boundary-safe-report-boundary", section_kind: "boundary", safe_summary: "Runtime activation final boundary summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
      { section_id: "final-boundary-safe-report-review", section_kind: "review", safe_summary: "Runtime activation final-boundary review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
      { section_id: "final-boundary-safe-report-runtime", section_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
      { section_id: "final-boundary-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, boundary_opened_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationFinalBoundarySafeReport", source_runtime_activation_final_boundary_review_id: "runtime-activation-final-boundary-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedFinalBoundary(): RuntimeActivationFinalBoundary {
  return { ...readyFinalBoundary(), final_boundary_state: "blocked", validation: { ...readyFinalBoundary().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Final boundary blocked."] } };
}

function blockedFinalBoundarySafeReport(): RuntimeActivationFinalBoundarySafeReport {
  return { ...readyFinalBoundarySafeReport(), safe_report_state: "blocked", validation: { ...readyFinalBoundarySafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Final-boundary safe report blocked."] } };
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

test("VO-7BJ-CLOSEOUT-1: runtime activation closeout is closeout-only and does not execute", () => {
  const closeout = createRuntimeActivationCloseout(readyFinalBoundarySafeReport(), readyFinalBoundary(), { id: "runtime-activation-closeout-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "approved_for_future_closeout_review");
  assert.equal(closeout.closeout_controls.closeout_only, true);
  assert.equal(closeout.closeout_controls.closeout_record_only, true);
  assert.equal(closeout.closeout_controls.runtime_wiring_implemented, false);
  assert.equal(closeout.closeout_controls.closeout_executed_now, false);
  assert.equal(closeout.closeout_terms.length, 4);
  assert.equal(closeout.closeout_terms.every((term) => term.runtime_enabled_now === false && term.closeout_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(closeout.execution_boundary);
});

test("VO-7BJ-CLOSEOUT-2: blocked final-boundary inputs block closeout", () => {
  const closeout = createRuntimeActivationCloseout(blockedFinalBoundarySafeReport(), blockedFinalBoundary());

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.validation.complete, false);
  assert.equal(closeout.validation.ready_for_next_phase, false);
  assert.equal(closeout.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(closeout.execution_boundary);
});

test("VO-7BJ-CLOSEOUT-3: closeout review remains review-only and does not execute", () => {
  const safeReport = readyFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, readyFinalBoundary());
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport, { id: "runtime-activation-closeout-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.closeout_review_state, "approved_for_future_closeout_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.closeout_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.closeout_executed_now, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.closeout_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BJ-CLOSEOUT-4: blocked closeout blocks closeout review", () => {
  const safeReport = blockedFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, blockedFinalBoundary());
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport);

  assert.equal(review.closeout_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BJ-CLOSEOUT-5: closeout safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const safeReport = readyFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, readyFinalBoundary());
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport);
  const report = createRuntimeActivationCloseoutSafeReport(review, closeout, { id: "runtime-activation-closeout-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_archive");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.closeout_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.closeout_executed_now, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.closeout_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BJ-CLOSEOUT-6: blocked closeout review blocks safe report", () => {
  const safeReport = blockedFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, blockedFinalBoundary());
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport);
  const report = createRuntimeActivationCloseoutSafeReport(review, closeout);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BJ-SAFETY-7: unsafe strings are sanitized from closeout artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, readyFinalBoundary(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationCloseoutSafeReport(review, closeout, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ closeout, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BJ-SAFETY-8: revocation keeps closeout artifacts disabled", () => {
  const safeReport = readyFinalBoundarySafeReport();
  const closeout = createRuntimeActivationCloseout(safeReport, readyFinalBoundary());
  const review = createRuntimeActivationCloseoutReview(closeout, safeReport);
  const report = createRuntimeActivationCloseoutSafeReport(review, closeout);
  const revokedCloseout = revokeRuntimeActivationCloseout(closeout, "Operator revoked runtime activation closeout.");
  const revokedReview = revokeRuntimeActivationCloseoutReview(review, "Operator revoked runtime activation closeout review.");
  const revokedReport = revokeRuntimeActivationCloseoutSafeReport(report, "Operator revoked runtime activation closeout safe report.");

  assert.equal(revokedCloseout.closeout_state, "revoked");
  assert.equal(revokedCloseout.validation.complete, false);
  assert.equal(revokedCloseout.validation.ready_for_next_phase, false);
  assert.equal(revokedCloseout.provenance.generated_by, "revokeRuntimeActivationCloseout");
  assertDisabledBoundary(revokedCloseout.execution_boundary);

  assert.equal(revokedReview.closeout_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationCloseoutReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationCloseoutSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
