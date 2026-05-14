import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationCompletionReport,
  createRuntimeActivationCompletionReportReview,
  createRuntimeActivationCompletionReportSafeReport,
  revokeRuntimeActivationCompletionReport,
  revokeRuntimeActivationCompletionReportReview,
  revokeRuntimeActivationCompletionReportSafeReport,
} from "./runtime-activation-completion-report.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationSequenceSummary, RuntimeActivationSequenceSummarySafeReport } from "./runtime-activation-sequence-summary.js";

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

function readySequenceSummary(): RuntimeActivationSequenceSummary {
  return { schema_version: "1.0", runtime_activation_sequence_summary_id: "runtime-activation-sequence-summary-001", runtime_activation_handoff_safe_report_id: "runtime-activation-handoff-safe-report-001", runtime_activation_handoff_id: "runtime-activation-handoff-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", sequence_summary_state: "approved_for_future_sequence_summary_review", required_artifacts: { runtime_activation_handoff_safe_report_validated: true, runtime_activation_handoff_validated: true }, sequence_summary_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, sequence_summary_controls: { sequence_summary_only: true, summary_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, summary_finalized_now: false, real_upload_still_blocked: true }, sequence_summary_terms: ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `sequence-summary-${kind}`, term_kind: kind, safe_summary: "safe", runtime_enabled_now: false, summary_finalized_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationSequenceSummary", source_runtime_activation_handoff_safe_report_id: "runtime-activation-handoff-safe-report-001", source_render_plan_id: "render-plan-001" } };
}

function readySequenceSummarySafeReport(): RuntimeActivationSequenceSummarySafeReport {
  return { schema_version: "1.0", runtime_activation_sequence_summary_safe_report_id: "runtime-activation-sequence-summary-safe-report-001", runtime_activation_sequence_summary_review_id: "runtime-activation-sequence-summary-review-001", runtime_activation_sequence_summary_id: "runtime-activation-sequence-summary-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", safe_report_state: "approved_for_future_runtime_activation_completion_report", required_artifacts: { runtime_activation_sequence_summary_review_validated: true, runtime_activation_sequence_summary_validated: true }, report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, report_controls: { safe_report_only: true, sequence_summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, summary_finalized_now: false, real_upload_still_blocked: true }, safe_report_sections: ["summary", "review", "runtime", "status"].map((kind) => ({ section_id: `sequence-summary-safe-report-${kind}`, section_kind: kind, safe_summary: "safe", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, summary_finalized_now: false, ready_for_real_upload_now: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationSequenceSummarySafeReport", source_runtime_activation_sequence_summary_review_id: "runtime-activation-sequence-summary-review-001", source_render_plan_id: "render-plan-001" } };
}

function blockedSummary(): RuntimeActivationSequenceSummary { return { ...readySequenceSummary(), sequence_summary_state: "blocked", validation: { ...readySequenceSummary().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Sequence summary blocked."] } }; }
function blockedSafeReport(): RuntimeActivationSequenceSummarySafeReport { return { ...readySequenceSummarySafeReport(), safe_report_state: "blocked", validation: { ...readySequenceSummarySafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Sequence summary safe report blocked."] } }; }
function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

test("VO-7BN-COMPLETION-REPORT-1: completion report is record-only and does not finalize", () => {
  const report = createRuntimeActivationCompletionReport(readySequenceSummarySafeReport(), readySequenceSummary(), { id: "runtime-activation-completion-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(report.completion_report_state, "approved_for_future_completion_report_review");
  assert.equal(report.completion_report_controls.completion_report_only, true);
  assert.equal(report.completion_report_controls.completion_finalized_now, false);
  assert.equal(report.completion_report_terms.length, 4);
  assert.equal(report.completion_report_terms.every((term) => !term.runtime_enabled_now && !term.completion_finalized_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BN-COMPLETION-REPORT-2: blocked sequence summary inputs block completion report", () => {
  const report = createRuntimeActivationCompletionReport(blockedSafeReport(), blockedSummary());
  assert.equal(report.completion_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
});

test("VO-7BN-COMPLETION-REPORT-3: review and safe report remain inert", () => {
  const sequenceSafeReport = readySequenceSummarySafeReport();
  const completion = createRuntimeActivationCompletionReport(sequenceSafeReport, readySequenceSummary());
  const review = createRuntimeActivationCompletionReportReview(completion, sequenceSafeReport);
  const report = createRuntimeActivationCompletionReportSafeReport(review, completion);
  assert.equal(review.completion_report_review_state, "approved_for_future_completion_report_safe_report");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_final_handoff");
  assert.equal(report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.completion_finalized_now && !section.ready_for_real_upload_now), true);
  assertDisabledBoundary(review.execution_boundary);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BN-COMPLETION-REPORT-4: unsafe strings are sanitized and revocation disables artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const sequenceSafeReport = readySequenceSummarySafeReport();
  const completion = createRuntimeActivationCompletionReport(sequenceSafeReport, readySequenceSummary(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationCompletionReportReview(completion, sequenceSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationCompletionReportSafeReport(review, completion, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ completion, review, report });
  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) assert.equal(serialized.includes(blocked), false);
  assert.equal(revokeRuntimeActivationCompletionReport(completion).completion_report_state, "revoked");
  assert.equal(revokeRuntimeActivationCompletionReportReview(review).completion_report_review_state, "revoked");
  assert.equal(revokeRuntimeActivationCompletionReportSafeReport(report).safe_report_state, "revoked");
});
