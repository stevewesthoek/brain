import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationFinalHandoff,
  createRuntimeActivationFinalHandoffReview,
  createRuntimeActivationFinalHandoffSafeReport,
  revokeRuntimeActivationFinalHandoff,
  revokeRuntimeActivationFinalHandoffReview,
  revokeRuntimeActivationFinalHandoffSafeReport,
} from "./runtime-activation-final-handoff.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationCompletionReport, RuntimeActivationCompletionReportSafeReport } from "./runtime-activation-completion-report.js";

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

function readyCompletion(): RuntimeActivationCompletionReport {
  return { schema_version: "1.0", runtime_activation_completion_report_id: "runtime-activation-completion-report-001", runtime_activation_sequence_summary_safe_report_id: "runtime-activation-sequence-summary-safe-report-001", runtime_activation_sequence_summary_id: "runtime-activation-sequence-summary-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", completion_report_state: "approved_for_future_completion_report_review", required_artifacts: { runtime_activation_sequence_summary_safe_report_validated: true, runtime_activation_sequence_summary_validated: true }, completion_report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, completion_report_controls: { completion_report_only: true, completion_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, completion_finalized_now: false, real_upload_still_blocked: true }, completion_report_terms: ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `completion-report-${kind}`, term_kind: kind, safe_summary: "safe", runtime_enabled_now: false, completion_finalized_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationCompletionReport", source_runtime_activation_sequence_summary_safe_report_id: "runtime-activation-sequence-summary-safe-report-001", source_render_plan_id: "render-plan-001" } };
}
function readyCompletionSafeReport(): RuntimeActivationCompletionReportSafeReport {
  return { schema_version: "1.0", runtime_activation_completion_report_safe_report_id: "runtime-activation-completion-report-safe-report-001", runtime_activation_completion_report_review_id: "runtime-activation-completion-report-review-001", runtime_activation_completion_report_id: "runtime-activation-completion-report-001", render_plan_id: "render-plan-001", project_id: "project-001", platform: "youtube", created_at: "2026-05-14T00:00:00.000Z", safe_report_state: "approved_for_future_runtime_activation_final_handoff", required_artifacts: { runtime_activation_completion_report_review_validated: true, runtime_activation_completion_report_validated: true }, report_scope: { artifact_only: true, future_next_phase_requested: true, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }, report_controls: { safe_report_only: true, completion_report_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, completion_finalized_now: false, real_upload_still_blocked: true }, safe_report_sections: ["completion", "review", "runtime", "status"].map((kind) => ({ section_id: `completion-report-safe-report-${kind}`, section_kind: kind, safe_summary: "safe", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, completion_finalized_now: false, ready_for_real_upload_now: false })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] }, provenance: { generated_by: "createRuntimeActivationCompletionReportSafeReport", source_runtime_activation_completion_report_review_id: "runtime-activation-completion-report-review-001", source_render_plan_id: "render-plan-001" } };
}
function blockedCompletion(): RuntimeActivationCompletionReport { return { ...readyCompletion(), completion_report_state: "blocked", validation: { ...readyCompletion().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Completion report blocked."] } }; }
function blockedSafeReport(): RuntimeActivationCompletionReportSafeReport { return { ...readyCompletionSafeReport(), safe_report_state: "blocked", validation: { ...readyCompletionSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Completion report safe report blocked."] } }; }
function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

test("VO-7BO-FINAL-HANDOFF-1: final handoff is record-only and does not execute", () => {
  const handoff = createRuntimeActivationFinalHandoff(readyCompletionSafeReport(), readyCompletion(), { id: "runtime-activation-final-handoff-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(handoff.final_handoff_state, "approved_for_future_final_handoff_review");
  assert.equal(handoff.final_handoff_controls.final_handoff_only, true);
  assert.equal(handoff.final_handoff_controls.final_handoff_executed_now, false);
  assert.equal(handoff.final_handoff_terms.every((term) => !term.runtime_enabled_now && !term.final_handoff_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material), true);
  assertDisabledBoundary(handoff.execution_boundary);
});

test("VO-7BO-FINAL-HANDOFF-2: blocked completion inputs block final handoff", () => {
  const handoff = createRuntimeActivationFinalHandoff(blockedSafeReport(), blockedCompletion());
  assert.equal(handoff.final_handoff_state, "blocked");
  assert.equal(handoff.validation.complete, false);
  assert.equal(handoff.validation.ready_for_next_phase, false);
});

test("VO-7BO-FINAL-HANDOFF-3: review and safe report remain inert", () => {
  const safeReport = readyCompletionSafeReport();
  const handoff = createRuntimeActivationFinalHandoff(safeReport, readyCompletion());
  const review = createRuntimeActivationFinalHandoffReview(handoff, safeReport);
  const report = createRuntimeActivationFinalHandoffSafeReport(review, handoff);
  assert.equal(review.final_handoff_review_state, "approved_for_future_final_handoff_safe_report");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_terminal_summary");
  assert.equal(report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.final_handoff_executed_now && !section.ready_for_real_upload_now), true);
  assertDisabledBoundary(review.execution_boundary);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BO-FINAL-HANDOFF-4: unsafe strings are sanitized and revocation disables artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyCompletionSafeReport();
  const handoff = createRuntimeActivationFinalHandoff(safeReport, readyCompletion(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationFinalHandoffReview(handoff, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationFinalHandoffSafeReport(review, handoff, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ handoff, review, report });
  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) assert.equal(serialized.includes(blocked), false);
  assert.equal(revokeRuntimeActivationFinalHandoff(handoff).final_handoff_state, "revoked");
  assert.equal(revokeRuntimeActivationFinalHandoffReview(review).final_handoff_review_state, "revoked");
  assert.equal(revokeRuntimeActivationFinalHandoffSafeReport(report).safe_report_state, "revoked");
});
