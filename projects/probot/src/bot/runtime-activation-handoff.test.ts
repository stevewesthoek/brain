import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationHandoff,
  createRuntimeActivationHandoffReview,
  createRuntimeActivationHandoffSafeReport,
  revokeRuntimeActivationHandoff,
  revokeRuntimeActivationHandoffReview,
  revokeRuntimeActivationHandoffSafeReport,
} from "./runtime-activation-handoff.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationArchive, RuntimeActivationArchiveSafeReport } from "./runtime-activation-archive.js";

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

function readyArchive(): RuntimeActivationArchive {
  return {
    schema_version: "1.0",
    runtime_activation_archive_id: "runtime-activation-archive-001",
    runtime_activation_closeout_safe_report_id: "runtime-activation-closeout-safe-report-001",
    runtime_activation_closeout_id: "runtime-activation-closeout-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    archive_state: "approved_for_future_archive_review",
    required_artifacts: { runtime_activation_closeout_safe_report_validated: true, runtime_activation_closeout_validated: true },
    archive_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    archive_controls: { archive_only: true, archive_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, archive_executed_now: false, real_upload_still_blocked: true },
    archive_terms: [
      { term_id: "archive-scope", term_kind: "scope", safe_summary: "Archive record scope only; no runtime enabled.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "archive-runtime", term_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "archive-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "archive-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationArchive", source_runtime_activation_closeout_safe_report_id: "runtime-activation-closeout-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyArchiveSafeReport(): RuntimeActivationArchiveSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_archive_safe_report_id: "runtime-activation-archive-safe-report-001",
    runtime_activation_archive_review_id: "runtime-activation-archive-review-001",
    runtime_activation_archive_id: "runtime-activation-archive-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_handoff",
    required_artifacts: { runtime_activation_archive_review_validated: true, runtime_activation_archive_validated: true },
    report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    report_controls: { safe_report_only: true, archive_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, archive_executed_now: false, real_upload_still_blocked: true },
    safe_report_sections: [
      { section_id: "archive-safe-report-archive", section_kind: "archive", safe_summary: "Runtime activation archive summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "archive-safe-report-review", section_kind: "review", safe_summary: "Runtime activation archive review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "archive-safe-report-runtime", section_kind: "runtime", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "archive-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationArchiveSafeReport", source_runtime_activation_archive_review_id: "runtime-activation-archive-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedArchive(): RuntimeActivationArchive {
  return { ...readyArchive(), archive_state: "blocked", validation: { ...readyArchive().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Archive blocked."] } };
}
function blockedArchiveSafeReport(): RuntimeActivationArchiveSafeReport {
  return { ...readyArchiveSafeReport(), safe_report_state: "blocked", validation: { ...readyArchiveSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Archive safe report blocked."] } };
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

test("VO-7BL-HANDOFF-1: runtime activation handoff is handoff-only and does not execute", () => {
  const handoff = createRuntimeActivationHandoff(readyArchiveSafeReport(), readyArchive(), { id: "runtime-activation-handoff-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "approved_for_future_handoff_review");
  assert.equal(handoff.handoff_controls.handoff_only, true);
  assert.equal(handoff.handoff_controls.handoff_record_only, true);
  assert.equal(handoff.handoff_controls.runtime_wiring_implemented, false);
  assert.equal(handoff.handoff_controls.handoff_executed_now, false);
  assert.equal(handoff.handoff_terms.length, 4);
  assert.equal(handoff.handoff_terms.every((term) => term.runtime_enabled_now === false && term.handoff_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(handoff.execution_boundary);
});

test("VO-7BL-HANDOFF-2: blocked archive inputs block handoff", () => {
  const handoff = createRuntimeActivationHandoff(blockedArchiveSafeReport(), blockedArchive());
  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.validation.complete, false);
  assert.equal(handoff.validation.ready_for_next_phase, false);
  assert.equal(handoff.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(handoff.execution_boundary);
});

test("VO-7BL-HANDOFF-3: handoff review remains review-only and does not execute", () => {
  const safeReport = readyArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, readyArchive());
  const review = createRuntimeActivationHandoffReview(handoff, safeReport, { id: "runtime-activation-handoff-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(review.schema_version, "1.0");
  assert.equal(review.handoff_review_state, "approved_for_future_handoff_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.handoff_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.handoff_executed_now, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.handoff_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BL-HANDOFF-4: blocked handoff blocks handoff review", () => {
  const safeReport = blockedArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, blockedArchive());
  const review = createRuntimeActivationHandoffReview(handoff, safeReport);
  assert.equal(review.handoff_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BL-HANDOFF-5: handoff safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const safeReport = readyArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, readyArchive());
  const review = createRuntimeActivationHandoffReview(handoff, safeReport);
  const report = createRuntimeActivationHandoffSafeReport(review, handoff, { id: "runtime-activation-handoff-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_sequence_summary");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.handoff_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.handoff_executed_now, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.handoff_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BL-HANDOFF-6: blocked handoff review blocks safe report", () => {
  const safeReport = blockedArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, blockedArchive());
  const review = createRuntimeActivationHandoffReview(handoff, safeReport);
  const report = createRuntimeActivationHandoffSafeReport(review, handoff);
  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BL-SAFETY-7: unsafe strings are sanitized from handoff artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, readyArchive(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationHandoffReview(handoff, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationHandoffSafeReport(review, handoff, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ handoff, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BL-SAFETY-8: revocation keeps handoff artifacts disabled", () => {
  const safeReport = readyArchiveSafeReport();
  const handoff = createRuntimeActivationHandoff(safeReport, readyArchive());
  const review = createRuntimeActivationHandoffReview(handoff, safeReport);
  const report = createRuntimeActivationHandoffSafeReport(review, handoff);
  const revokedHandoff = revokeRuntimeActivationHandoff(handoff, "Operator revoked runtime activation handoff.");
  const revokedReview = revokeRuntimeActivationHandoffReview(review, "Operator revoked runtime activation handoff review.");
  const revokedReport = revokeRuntimeActivationHandoffSafeReport(report, "Operator revoked runtime activation handoff safe report.");
  assert.equal(revokedHandoff.handoff_state, "revoked");
  assert.equal(revokedHandoff.validation.complete, false);
  assert.equal(revokedHandoff.validation.ready_for_next_phase, false);
  assert.equal(revokedHandoff.provenance.generated_by, "revokeRuntimeActivationHandoff");
  assertDisabledBoundary(revokedHandoff.execution_boundary);
  assert.equal(revokedReview.handoff_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationHandoffReview");
  assertDisabledBoundary(revokedReview.execution_boundary);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationHandoffSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
