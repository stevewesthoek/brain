import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationSequenceSummary,
  createRuntimeActivationSequenceSummaryReview,
  createRuntimeActivationSequenceSummarySafeReport,
  revokeRuntimeActivationSequenceSummary,
  revokeRuntimeActivationSequenceSummaryReview,
  revokeRuntimeActivationSequenceSummarySafeReport,
} from "./runtime-activation-sequence-summary.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationHandoff, RuntimeActivationHandoffSafeReport } from "./runtime-activation-handoff.js";

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

function readyHandoff(): RuntimeActivationHandoff {
  return { schema_version: "1.0", runtime_activation_handoff_id: "runtime-activation-handoff-001", runtime_activation_archive_safe_report_id: "runtime-activation-archive-safe-report-001", runtime_activation_archive_id: "runtime-activation-archive-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", handoff_state: "approved_for_future_handoff_review", required_artifacts: { runtime_activation_archive_safe_report_validated: true, runtime_activation_archive_validated: true }, handoff_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, handoff_controls: { handoff_only: true, handoff_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, handoff_executed_now: false, real_upload_still_blocked: true }, handoff_terms: ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `handoff-${kind}`, term_kind: kind, safe_summary: "safe", runtime_enabled_now: false, handoff_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationHandoff", source_runtime_activation_archive_safe_report_id: "runtime-activation-archive-safe-report-001", source_render_plan_id: "render-plan-001" } };
}

function readyHandoffSafeReport(): RuntimeActivationHandoffSafeReport {
  return { schema_version: "1.0", runtime_activation_handoff_safe_report_id: "runtime-activation-handoff-safe-report-001", runtime_activation_handoff_review_id: "runtime-activation-handoff-review-001", runtime_activation_handoff_id: "runtime-activation-handoff-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", safe_report_state: "approved_for_future_runtime_activation_sequence_summary", required_artifacts: { runtime_activation_handoff_review_validated: true, runtime_activation_handoff_validated: true }, report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, report_controls: { safe_report_only: true, handoff_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, handoff_executed_now: false, real_upload_still_blocked: true }, safe_report_sections: ["handoff", "review", "runtime", "status"].map((kind) => ({ section_id: `handoff-safe-report-${kind}`, section_kind: kind, safe_summary: "safe", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, handoff_executed_now: false, ready_for_real_upload_now: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationHandoffSafeReport", source_runtime_activation_handoff_review_id: "runtime-activation-handoff-review-001", source_render_plan_id: "render-plan-001" } };
}

function blockedHandoff(): RuntimeActivationHandoff { return { ...readyHandoff(), handoff_state: "blocked", validation: { ...readyHandoff().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Handoff blocked."] } }; }
function blockedHandoffSafeReport(): RuntimeActivationHandoffSafeReport { return { ...readyHandoffSafeReport(), safe_report_state: "blocked", validation: { ...readyHandoffSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Handoff safe report blocked."] } }; }
function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

test("VO-7BM-SEQUENCE-SUMMARY-1: sequence summary is summary-only and does not finalize", () => {
  const summary = createRuntimeActivationSequenceSummary(readyHandoffSafeReport(), readyHandoff(), { id: "runtime-activation-sequence-summary-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(summary.sequence_summary_state, "approved_for_future_sequence_summary_review");
  assert.equal(summary.sequence_summary_controls.sequence_summary_only, true);
  assert.equal(summary.sequence_summary_controls.summary_finalized_now, false);
  assert.equal(summary.sequence_summary_terms.length, 4);
  assert.equal(summary.sequence_summary_terms.every((term) => !term.runtime_enabled_now && !term.summary_finalized_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material), true);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7BM-SEQUENCE-SUMMARY-2: blocked handoff inputs block sequence summary", () => {
  const summary = createRuntimeActivationSequenceSummary(blockedHandoffSafeReport(), blockedHandoff());
  assert.equal(summary.sequence_summary_state, "blocked");
  assert.equal(summary.validation.complete, false);
  assert.equal(summary.validation.ready_for_next_phase, false);
  assert.equal(summary.validation.blocking_reasons.length > 0, true);
});

test("VO-7BM-SEQUENCE-SUMMARY-3: sequence summary review and safe report remain inert", () => {
  const handoffSafeReport = readyHandoffSafeReport();
  const summary = createRuntimeActivationSequenceSummary(handoffSafeReport, readyHandoff());
  const review = createRuntimeActivationSequenceSummaryReview(summary, handoffSafeReport);
  const report = createRuntimeActivationSequenceSummarySafeReport(review, summary);
  assert.equal(review.sequence_summary_review_state, "approved_for_future_sequence_summary_safe_report");
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.summary_finalized_now && !check.ready_for_real_upload_now), true);
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_completion_report");
  assert.equal(report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.summary_finalized_now && !section.ready_for_real_upload_now), true);
  assertDisabledBoundary(review.execution_boundary);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BM-SEQUENCE-SUMMARY-4: unsafe strings are sanitized and revocation disables artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const handoffSafeReport = readyHandoffSafeReport();
  const summary = createRuntimeActivationSequenceSummary(handoffSafeReport, readyHandoff(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationSequenceSummaryReview(summary, handoffSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationSequenceSummarySafeReport(review, summary, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ summary, review, report });
  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) assert.equal(serialized.includes(blocked), false);
  assert.equal(revokeRuntimeActivationSequenceSummary(summary).sequence_summary_state, "revoked");
  assert.equal(revokeRuntimeActivationSequenceSummaryReview(review).sequence_summary_review_state, "revoked");
  assert.equal(revokeRuntimeActivationSequenceSummarySafeReport(report).safe_report_state, "revoked");
});
