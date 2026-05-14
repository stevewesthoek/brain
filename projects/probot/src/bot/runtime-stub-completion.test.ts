import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubCompletionSummary,
  createRuntimeStubCompletionReview,
  createRuntimeStubCompletionSafeReport,
  revokeRuntimeStubCompletionSummary,
  revokeRuntimeStubCompletionReview,
  revokeRuntimeStubCompletionSafeReport,
} from "./runtime-stub-completion.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubFinalGate, RuntimeStubFinalGateSafeReport } from "./runtime-stub-final-gate.js";

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

function readyFinalGate(): RuntimeStubFinalGate {
  return {
    schema_version: "1.0",
    runtime_stub_final_gate_id: "runtime-stub-final-gate-001",
    runtime_stub_release_candidate_safe_report_id: "runtime-stub-release-candidate-safe-report-001",
    runtime_stub_release_candidate_id: "runtime-stub-release-candidate-001",
    runtime_stub_manifest_id: "runtime-stub-manifest-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    final_gate_state: "approved_for_future_final_gate_review",
    required_artifacts: { runtime_stub_release_candidate_safe_report_validated: true, runtime_stub_release_candidate_validated: true },
    gate_scope: {
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
    gate_controls: {
      final_gate_only: true,
      summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    gate_checks: [
      { check_id: "final-gate-candidate", check_kind: "candidate", check_state: "passed", safe_summary: "Final gate check only.", opened_now: false, runtime_executed_now: false },
      { check_id: "final-gate-review", check_kind: "review", check_state: "passed", safe_summary: "Final gate check only.", opened_now: false, runtime_executed_now: false },
      { check_id: "final-gate-boundaries", check_kind: "boundaries", check_state: "passed", safe_summary: "Runtime invocation remains disabled.", opened_now: false, runtime_executed_now: false },
      { check_id: "final-gate-status", check_kind: "status", check_state: "passed", safe_summary: "Real upload remains disabled.", opened_now: false, runtime_executed_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubFinalGate", source_runtime_stub_release_candidate_safe_report_id: "runtime-stub-release-candidate-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyFinalGateSafeReport(): RuntimeStubFinalGateSafeReport {
  return {
    schema_version: "1.0",
    runtime_stub_final_gate_safe_report_id: "runtime-stub-final-gate-safe-report-001",
    runtime_stub_final_gate_review_id: "runtime-stub-final-gate-review-001",
    runtime_stub_final_gate_id: "runtime-stub-final-gate-001",
    runtime_stub_release_candidate_id: "runtime-stub-release-candidate-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_stub_completion_summary",
    required_artifacts: { runtime_stub_final_gate_review_validated: true, runtime_stub_final_gate_validated: true },
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
    safe_report_sections: [
      { section_id: "final-gate-safe-report-gate", section_kind: "gate", safe_summary: "Final gate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "final-gate-safe-report-review", section_kind: "review", safe_summary: "Final gate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "final-gate-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "final-gate-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubFinalGateSafeReport", source_runtime_stub_final_gate_review_id: "runtime-stub-final-gate-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedFinalGate(): RuntimeStubFinalGate {
  return { ...readyFinalGate(), final_gate_state: "blocked", validation: { ...readyFinalGate().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Final gate blocked."] } };
}

function blockedFinalGateSafeReport(): RuntimeStubFinalGateSafeReport {
  return { ...readyFinalGateSafeReport(), safe_report_state: "blocked", validation: { ...readyFinalGateSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Final gate safe report blocked."] } };
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

test("VO-7AW-COMPLETION-1: completion summary records complete items without runtime execution or real-upload readiness", () => {
  const summary = createRuntimeStubCompletionSummary(readyFinalGateSafeReport(), readyFinalGate(), { id: "runtime-stub-completion-summary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.completion_summary_state, "approved_for_future_completion_review");
  assert.equal(summary.summary_scope.artifact_only, true);
  assert.equal(summary.summary_controls.summary_only, true);
  assert.equal(summary.summary_controls.completion_only, true);
  assert.equal(summary.summary_controls.contains_runtime_callable, false);
  assert.equal(summary.summary_controls.contains_raw_payload, false);
  assert.equal(summary.summary_controls.contains_raw_response, false);
  assert.equal(summary.summary_controls.contains_secret_material, false);
  assert.equal(summary.summary_controls.runtime_invocation_disabled, true);
  assert.equal(summary.completion_items.length, 4);
  assert.equal(summary.completion_items.every((item) => item.item_state === "complete" && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AW-COMPLETION-2: blocked final gate inputs block completion summary", () => {
  const summary = createRuntimeStubCompletionSummary(blockedFinalGateSafeReport(), blockedFinalGate());

  assert.equal(summary.completion_summary_state, "blocked");
  assert.equal(summary.validation.complete, false);
  assert.equal(summary.validation.ready_for_next_phase, false);
  assert.equal(summary.validation.blocking_reasons.length > 0, true);
  assert.equal(summary.completion_items.every((item) => item.item_state === "blocked"), true);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AW-COMPLETION-3: completion review passes without runtime execution or real-upload readiness", () => {
  const gate = readyFinalGate();
  const summary = createRuntimeStubCompletionSummary(readyFinalGateSafeReport(), gate);
  const review = createRuntimeStubCompletionReview(summary, gate, { id: "runtime-stub-completion-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.completion_review_state, "approved_for_future_completion_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.completion_reviewed, true);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_items.length, 4);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AW-COMPLETION-4: blocked completion summary blocks review", () => {
  const gate = blockedFinalGate();
  const summary = createRuntimeStubCompletionSummary(blockedFinalGateSafeReport(), gate);
  const review = createRuntimeStubCompletionReview(summary, gate);

  assert.equal(review.completion_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AW-COMPLETION-5: completion safe report contains no callable, payload, response, or secrets", () => {
  const gate = readyFinalGate();
  const summary = createRuntimeStubCompletionSummary(readyFinalGateSafeReport(), gate);
  const review = createRuntimeStubCompletionReview(summary, gate);
  const report = createRuntimeStubCompletionSafeReport(review, summary, { id: "runtime-stub-completion-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_closeout");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AW-COMPLETION-6: blocked completion review blocks safe report", () => {
  const gate = blockedFinalGate();
  const summary = createRuntimeStubCompletionSummary(blockedFinalGateSafeReport(), gate);
  const review = createRuntimeStubCompletionReview(summary, gate);
  const report = createRuntimeStubCompletionSafeReport(review, summary);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AW-SAFETY-7: unsafe strings are sanitized from completion artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const gate = readyFinalGate();
  const summary = createRuntimeStubCompletionSummary(readyFinalGateSafeReport(), gate, { id: unsafe, created_at: unsafe });
  const review = createRuntimeStubCompletionReview(summary, gate, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubCompletionSafeReport(review, summary, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ summary, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AW-SAFETY-8: revocation keeps completion artifacts disabled", () => {
  const gate = readyFinalGate();
  const summary = createRuntimeStubCompletionSummary(readyFinalGateSafeReport(), gate);
  const review = createRuntimeStubCompletionReview(summary, gate);
  const report = createRuntimeStubCompletionSafeReport(review, summary);
  const revokedSummary = revokeRuntimeStubCompletionSummary(summary, "Operator revoked completion summary.");
  const revokedReview = revokeRuntimeStubCompletionReview(review, "Operator revoked completion review.");
  const revokedReport = revokeRuntimeStubCompletionSafeReport(report, "Operator revoked completion safe report.");

  assert.equal(revokedSummary.completion_summary_state, "revoked");
  assert.equal(revokedSummary.validation.complete, false);
  assert.equal(revokedSummary.validation.ready_for_next_phase, false);
  assert.equal(revokedSummary.completion_items.every((item) => item.item_state === "blocked"), true);
  assert.equal(revokedSummary.provenance.generated_by, "revokeRuntimeStubCompletionSummary");
  assertDisabledBoundary(revokedSummary.execution_boundary);

  assert.equal(revokedReview.completion_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeStubCompletionReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubCompletionSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
