import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationArchive,
  createRuntimeActivationArchiveReview,
  createRuntimeActivationArchiveSafeReport,
  revokeRuntimeActivationArchive,
  revokeRuntimeActivationArchiveReview,
  revokeRuntimeActivationArchiveSafeReport,
} from "./runtime-activation-archive.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationCloseout, RuntimeActivationCloseoutSafeReport } from "./runtime-activation-closeout.js";

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

function readyCloseout(): RuntimeActivationCloseout {
  return {
    schema_version: "1.0",
    runtime_activation_closeout_id: "runtime-activation-closeout-001",
    runtime_activation_final_boundary_safe_report_id: "runtime-activation-final-boundary-safe-report-001",
    runtime_activation_final_boundary_id: "runtime-activation-final-boundary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    closeout_state: "approved_for_future_closeout_review",
    required_artifacts: { runtime_activation_final_boundary_safe_report_validated: true, runtime_activation_final_boundary_validated: true },
    closeout_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    closeout_controls: { closeout_only: true, closeout_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, closeout_executed_now: false, real_upload_still_blocked: true },
    closeout_terms: [
      { term_id: "closeout-scope", term_kind: "scope", safe_summary: "Closeout record scope only; no runtime enabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "closeout-runtime", term_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "closeout-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "closeout-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationCloseout", source_runtime_activation_final_boundary_safe_report_id: "runtime-activation-final-boundary-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyCloseoutSafeReport(): RuntimeActivationCloseoutSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_closeout_safe_report_id: "runtime-activation-closeout-safe-report-001",
    runtime_activation_closeout_review_id: "runtime-activation-closeout-review-001",
    runtime_activation_closeout_id: "runtime-activation-closeout-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_archive",
    required_artifacts: { runtime_activation_closeout_review_validated: true, runtime_activation_closeout_validated: true },
    report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    report_controls: { safe_report_only: true, closeout_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, closeout_executed_now: false, real_upload_still_blocked: true },
    safe_report_sections: [
      { section_id: "closeout-safe-report-closeout", section_kind: "closeout", safe_summary: "Runtime activation closeout summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "closeout-safe-report-review", section_kind: "review", safe_summary: "Runtime activation closeout review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "closeout-safe-report-runtime", section_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "closeout-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, closeout_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationCloseoutSafeReport", source_runtime_activation_closeout_review_id: "runtime-activation-closeout-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedCloseout(): RuntimeActivationCloseout {
  return { ...readyCloseout(), closeout_state: "blocked", validation: { ...readyCloseout().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Closeout blocked."] } };
}
function blockedCloseoutSafeReport(): RuntimeActivationCloseoutSafeReport {
  return { ...readyCloseoutSafeReport(), safe_report_state: "blocked", validation: { ...readyCloseoutSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Closeout safe report blocked."] } };
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

test("VO-7BK-ARCHIVE-1: runtime activation archive is archive-only and does not execute", () => {
  const archive = createRuntimeActivationArchive(readyCloseoutSafeReport(), readyCloseout(), { id: "runtime-activation-archive-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(archive.schema_version, "1.0");
  assert.equal(archive.archive_state, "approved_for_future_archive_review");
  assert.equal(archive.archive_controls.archive_only, true);
  assert.equal(archive.archive_controls.archive_record_only, true);
  assert.equal(archive.archive_controls.runtime_wiring_implemented, false);
  assert.equal(archive.archive_controls.archive_executed_now, false);
  assert.equal(archive.archive_terms.length, 4);
  assert.equal(archive.archive_terms.every((term) => term.runtime_enabled_now === false && term.archive_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(archive.execution_boundary);
});

test("VO-7BK-ARCHIVE-2: blocked closeout inputs block archive", () => {
  const archive = createRuntimeActivationArchive(blockedCloseoutSafeReport(), blockedCloseout());
  assert.equal(archive.archive_state, "blocked");
  assert.equal(archive.validation.complete, false);
  assert.equal(archive.validation.ready_for_next_phase, false);
  assert.equal(archive.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(archive.execution_boundary);
});

test("VO-7BK-ARCHIVE-3: archive review remains review-only and does not execute", () => {
  const safeReport = readyCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, readyCloseout());
  const review = createRuntimeActivationArchiveReview(archive, safeReport, { id: "runtime-activation-archive-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(review.schema_version, "1.0");
  assert.equal(review.archive_review_state, "approved_for_future_archive_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.archive_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.archive_executed_now, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.archive_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BK-ARCHIVE-4: blocked archive blocks archive review", () => {
  const safeReport = blockedCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, blockedCloseout());
  const review = createRuntimeActivationArchiveReview(archive, safeReport);
  assert.equal(review.archive_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BK-ARCHIVE-5: archive safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const safeReport = readyCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, readyCloseout());
  const review = createRuntimeActivationArchiveReview(archive, safeReport);
  const report = createRuntimeActivationArchiveSafeReport(review, archive, { id: "runtime-activation-archive-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_handoff");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.archive_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.archive_executed_now, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.archive_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BK-ARCHIVE-6: blocked archive review blocks safe report", () => {
  const safeReport = blockedCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, blockedCloseout());
  const review = createRuntimeActivationArchiveReview(archive, safeReport);
  const report = createRuntimeActivationArchiveSafeReport(review, archive);
  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BK-SAFETY-7: unsafe strings are sanitized from archive artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, readyCloseout(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationArchiveReview(archive, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationArchiveSafeReport(review, archive, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ archive, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BK-SAFETY-8: revocation keeps archive artifacts disabled", () => {
  const safeReport = readyCloseoutSafeReport();
  const archive = createRuntimeActivationArchive(safeReport, readyCloseout());
  const review = createRuntimeActivationArchiveReview(archive, safeReport);
  const report = createRuntimeActivationArchiveSafeReport(review, archive);
  const revokedArchive = revokeRuntimeActivationArchive(archive, "Operator revoked runtime activation archive.");
  const revokedReview = revokeRuntimeActivationArchiveReview(review, "Operator revoked runtime activation archive review.");
  const revokedReport = revokeRuntimeActivationArchiveSafeReport(report, "Operator revoked runtime activation archive safe report.");
  assert.equal(revokedArchive.archive_state, "revoked");
  assert.equal(revokedArchive.validation.complete, false);
  assert.equal(revokedArchive.validation.ready_for_next_phase, false);
  assert.equal(revokedArchive.provenance.generated_by, "revokeRuntimeActivationArchive");
  assertDisabledBoundary(revokedArchive.execution_boundary);
  assert.equal(revokedReview.archive_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationArchiveReview");
  assertDisabledBoundary(revokedReview.execution_boundary);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationArchiveSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
