import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubSequenceIntegrityAudit,
  createRuntimeStubSequenceRegressionReport,
  createRuntimeStubSequenceFinalHandoff,
  revokeRuntimeStubSequenceIntegrityAudit,
  revokeRuntimeStubSequenceRegressionReport,
  revokeRuntimeStubSequenceFinalHandoff,
} from "./runtime-stub-sequence-integrity.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubArchive, RuntimeStubArchiveFinalSummary } from "./runtime-stub-archive.js";

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

function readyArchive(): RuntimeStubArchive {
  return {
    schema_version: "1.0",
    runtime_stub_archive_id: "runtime-stub-archive-001",
    runtime_stub_closeout_safe_report_id: "runtime-stub-closeout-safe-report-001",
    runtime_stub_closeout_id: "runtime-stub-closeout-001",
    runtime_stub_completion_summary_id: "runtime-stub-completion-summary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    archive_state: "approved_for_future_archive_review",
    required_artifacts: { runtime_stub_closeout_safe_report_validated: true, runtime_stub_closeout_validated: true },
    archive_scope: {
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
    archive_controls: {
      archive_only: true,
      summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    archive_items: [
      { item_id: "archive-closeout", item_kind: "closeout", item_state: "archived", safe_summary: "Closeout summarized only.", archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "archive-completion", item_kind: "completion", item_state: "archived", safe_summary: "Completion summarized only.", archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "archive-boundaries", item_kind: "boundaries", item_state: "archived", safe_summary: "Runtime invocation remains disabled.", archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "archive-status", item_kind: "status", item_state: "archived", safe_summary: "Real upload remains disabled.", archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubArchive", source_runtime_stub_closeout_safe_report_id: "runtime-stub-closeout-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyArchiveFinalSummary(): RuntimeStubArchiveFinalSummary {
  return {
    schema_version: "1.0",
    runtime_stub_archive_final_summary_id: "runtime-stub-archive-final-summary-001",
    runtime_stub_archive_review_id: "runtime-stub-archive-review-001",
    runtime_stub_archive_id: "runtime-stub-archive-001",
    runtime_stub_closeout_id: "runtime-stub-closeout-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    final_summary_state: "runtime_stub_sequence_complete",
    required_artifacts: { runtime_stub_archive_review_validated: true, runtime_stub_archive_validated: true },
    final_summary_scope: {
      artifact_only: true,
      future_next_phase_requested: false,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    final_summary_controls: {
      final_summary_only: true,
      runtime_stub_sequence_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    final_summary_sections: [
      { section_id: "archive-final-summary-archive", section_kind: "archive", safe_summary: "Runtime stub archive summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-review", section_kind: "review", safe_summary: "Runtime stub archive review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: false, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubArchiveFinalSummary", source_runtime_stub_archive_review_id: "runtime-stub-archive-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedArchive(): RuntimeStubArchive {
  return { ...readyArchive(), archive_state: "blocked", validation: { ...readyArchive().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Archive blocked."] } };
}

function blockedArchiveFinalSummary(): RuntimeStubArchiveFinalSummary {
  return { ...readyArchiveFinalSummary(), final_summary_state: "blocked", validation: { ...readyArchiveFinalSummary().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Archive final summary blocked."] } };
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

test("VO-7AZ-SEQUENCE-1: integrity audit passes sequence checks without runtime execution or real-upload readiness", () => {
  const audit = createRuntimeStubSequenceIntegrityAudit(readyArchiveFinalSummary(), readyArchive(), { id: "runtime-stub-sequence-integrity-audit-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(audit.schema_version, "1.0");
  assert.equal(audit.audit_state, "approved_for_future_sequence_regression_report");
  assert.equal(audit.audit_scope.artifact_only, true);
  assert.equal(audit.audit_controls.audit_only, true);
  assert.equal(audit.audit_controls.sequence_integrity_only, true);
  assert.equal(audit.audit_controls.contains_runtime_callable, false);
  assert.equal(audit.audit_controls.contains_raw_payload, false);
  assert.equal(audit.audit_controls.contains_raw_response, false);
  assert.equal(audit.audit_controls.contains_secret_material, false);
  assert.equal(audit.audit_checks.length, 5);
  assert.equal(audit.audit_checks.every((check) => check.check_state === "passed" && check.runtime_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(audit.execution_boundary);
});

test("VO-7AZ-SEQUENCE-2: blocked archive inputs block integrity audit", () => {
  const audit = createRuntimeStubSequenceIntegrityAudit(blockedArchiveFinalSummary(), blockedArchive());

  assert.equal(audit.audit_state, "blocked");
  assert.equal(audit.validation.complete, false);
  assert.equal(audit.validation.ready_for_next_phase, false);
  assert.equal(audit.validation.blocking_reasons.length > 0, true);
  assert.equal(audit.audit_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(audit.execution_boundary);
});

test("VO-7AZ-SEQUENCE-3: regression report passes checks without runtime execution or real-upload readiness", () => {
  const finalSummary = readyArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, readyArchive());
  const report = createRuntimeStubSequenceRegressionReport(audit, finalSummary, { id: "runtime-stub-sequence-regression-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.regression_report_state, "approved_for_future_sequence_final_handoff");
  assert.equal(report.regression_scope.artifact_only, true);
  assert.equal(report.regression_controls.regression_report_only, true);
  assert.equal(report.regression_controls.sequence_regression_only, true);
  assert.equal(report.regression_controls.contains_runtime_callable, false);
  assert.equal(report.regression_checks.length, 5);
  assert.equal(report.regression_checks.every((check) => check.check_state === "passed" && check.runtime_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AZ-SEQUENCE-4: blocked audit blocks regression report", () => {
  const finalSummary = blockedArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, blockedArchive());
  const report = createRuntimeStubSequenceRegressionReport(audit, finalSummary);

  assert.equal(report.regression_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.regression_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AZ-SEQUENCE-5: final handoff completes handoff only without requesting next phase", () => {
  const finalSummary = readyArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, readyArchive());
  const regression = createRuntimeStubSequenceRegressionReport(audit, finalSummary);
  const handoff = createRuntimeStubSequenceFinalHandoff(regression, audit, { id: "runtime-stub-sequence-final-handoff-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "runtime_stub_sequence_handed_off");
  assert.equal(handoff.handoff_scope.artifact_only, true);
  assert.equal(handoff.handoff_scope.future_next_phase_requested, false);
  assert.equal(handoff.handoff_controls.handoff_only, true);
  assert.equal(handoff.handoff_controls.sequence_handoff_only, true);
  assert.equal(handoff.handoff_controls.contains_runtime_callable, false);
  assert.equal(handoff.handoff_sections.length, 4);
  assert.equal(handoff.handoff_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false && section.ready_for_real_upload_now === false), true);
  assert.equal(handoff.validation.ready_for_next_phase, false);
  assert.equal(handoff.validation.ready_for_real_upload, false);
  assertDisabledBoundary(handoff.execution_boundary);
});

test("VO-7AZ-SEQUENCE-6: blocked regression report blocks final handoff", () => {
  const finalSummary = blockedArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, blockedArchive());
  const regression = createRuntimeStubSequenceRegressionReport(audit, finalSummary);
  const handoff = createRuntimeStubSequenceFinalHandoff(regression, audit);

  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.validation.complete, false);
  assert.equal(handoff.validation.ready_for_next_phase, false);
  assert.equal(handoff.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(handoff.execution_boundary);
});

test("VO-7AZ-SAFETY-7: unsafe strings are sanitized from sequence artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const finalSummary = readyArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, readyArchive(), { id: unsafe, created_at: unsafe });
  const regression = createRuntimeStubSequenceRegressionReport(audit, finalSummary, { id: unsafe, created_at: unsafe });
  const handoff = createRuntimeStubSequenceFinalHandoff(regression, audit, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ audit, regression, handoff });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AZ-SAFETY-8: revocation keeps sequence artifacts disabled", () => {
  const finalSummary = readyArchiveFinalSummary();
  const audit = createRuntimeStubSequenceIntegrityAudit(finalSummary, readyArchive());
  const regression = createRuntimeStubSequenceRegressionReport(audit, finalSummary);
  const handoff = createRuntimeStubSequenceFinalHandoff(regression, audit);
  const revokedAudit = revokeRuntimeStubSequenceIntegrityAudit(audit, "Operator revoked integrity audit.");
  const revokedRegression = revokeRuntimeStubSequenceRegressionReport(regression, "Operator revoked regression report.");
  const revokedHandoff = revokeRuntimeStubSequenceFinalHandoff(handoff, "Operator revoked final handoff.");

  assert.equal(revokedAudit.audit_state, "revoked");
  assert.equal(revokedAudit.validation.complete, false);
  assert.equal(revokedAudit.validation.ready_for_next_phase, false);
  assert.equal(revokedAudit.audit_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedAudit.provenance.generated_by, "revokeRuntimeStubSequenceIntegrityAudit");
  assertDisabledBoundary(revokedAudit.execution_boundary);

  assert.equal(revokedRegression.regression_report_state, "revoked");
  assert.equal(revokedRegression.validation.complete, false);
  assert.equal(revokedRegression.validation.ready_for_next_phase, false);
  assert.equal(revokedRegression.regression_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedRegression.provenance.generated_by, "revokeRuntimeStubSequenceRegressionReport");
  assertDisabledBoundary(revokedRegression.execution_boundary);

  assert.equal(revokedHandoff.handoff_state, "revoked");
  assert.equal(revokedHandoff.validation.complete, false);
  assert.equal(revokedHandoff.validation.ready_for_next_phase, false);
  assert.equal(revokedHandoff.provenance.generated_by, "revokeRuntimeStubSequenceFinalHandoff");
  assertDisabledBoundary(revokedHandoff.execution_boundary);
});
