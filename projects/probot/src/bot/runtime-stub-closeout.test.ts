import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubCloseout,
  createRuntimeStubCloseoutReview,
  createRuntimeStubCloseoutSafeReport,
  revokeRuntimeStubCloseout,
  revokeRuntimeStubCloseoutReview,
  revokeRuntimeStubCloseoutSafeReport,
} from "./runtime-stub-closeout.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubCompletionSafeReport, RuntimeStubCompletionSummary } from "./runtime-stub-completion.js";

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

function readyCompletionSummary(): RuntimeStubCompletionSummary {
  return {
    schema_version: "1.0",
    runtime_stub_completion_summary_id: "runtime-stub-completion-summary-001",
    runtime_stub_final_gate_safe_report_id: "runtime-stub-final-gate-safe-report-001",
    runtime_stub_final_gate_id: "runtime-stub-final-gate-001",
    runtime_stub_release_candidate_id: "runtime-stub-release-candidate-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    completion_summary_state: "approved_for_future_completion_review",
    required_artifacts: { runtime_stub_final_gate_safe_report_validated: true, runtime_stub_final_gate_validated: true },
    summary_scope: {
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
    summary_controls: {
      summary_only: true,
      completion_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    completion_items: [
      { item_id: "completion-final-gate", item_kind: "final_gate", item_state: "complete", safe_summary: "Final gate summarized only.", runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "completion-release-candidate", item_kind: "release_candidate", item_state: "complete", safe_summary: "Release candidate summarized only.", runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "completion-boundaries", item_kind: "boundaries", item_state: "complete", safe_summary: "Runtime invocation remains disabled.", runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "completion-status", item_kind: "status", item_state: "complete", safe_summary: "Real upload remains disabled.", runtime_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubCompletionSummary", source_runtime_stub_final_gate_safe_report_id: "runtime-stub-final-gate-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyCompletionSafeReport(): RuntimeStubCompletionSafeReport {
  return {
    schema_version: "1.0",
    runtime_stub_completion_safe_report_id: "runtime-stub-completion-safe-report-001",
    runtime_stub_completion_review_id: "runtime-stub-completion-review-001",
    runtime_stub_completion_summary_id: "runtime-stub-completion-summary-001",
    runtime_stub_final_gate_id: "runtime-stub-final-gate-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_stub_closeout",
    required_artifacts: { runtime_stub_completion_review_validated: true, runtime_stub_completion_summary_validated: true },
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
      { section_id: "completion-safe-report-summary", section_kind: "summary", safe_summary: "Runtime stub completion safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "completion-safe-report-review", section_kind: "review", safe_summary: "Runtime stub completion safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "completion-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "completion-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubCompletionSafeReport", source_runtime_stub_completion_review_id: "runtime-stub-completion-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedCompletionSummary(): RuntimeStubCompletionSummary {
  return { ...readyCompletionSummary(), completion_summary_state: "blocked", validation: { ...readyCompletionSummary().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Completion summary blocked."] } };
}

function blockedCompletionSafeReport(): RuntimeStubCompletionSafeReport {
  return { ...readyCompletionSafeReport(), safe_report_state: "blocked", validation: { ...readyCompletionSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Completion safe report blocked."] } };
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

test("VO-7AX-CLOSEOUT-1: closeout records closed summary items without closing now, runtime execution, or real-upload readiness", () => {
  const closeout = createRuntimeStubCloseout(readyCompletionSafeReport(), readyCompletionSummary(), { id: "runtime-stub-closeout-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "approved_for_future_closeout_review");
  assert.equal(closeout.closeout_scope.artifact_only, true);
  assert.equal(closeout.closeout_controls.closeout_only, true);
  assert.equal(closeout.closeout_controls.summary_only, true);
  assert.equal(closeout.closeout_controls.contains_runtime_callable, false);
  assert.equal(closeout.closeout_controls.contains_raw_payload, false);
  assert.equal(closeout.closeout_controls.contains_raw_response, false);
  assert.equal(closeout.closeout_controls.contains_secret_material, false);
  assert.equal(closeout.closeout_controls.runtime_invocation_disabled, true);
  assert.equal(closeout.closeout_items.length, 4);
  assert.equal(closeout.closeout_items.every((item) => item.item_state === "closed" && item.closed_now === false && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(closeout.execution_boundary);
});

test("VO-7AX-CLOSEOUT-2: blocked completion inputs block closeout", () => {
  const closeout = createRuntimeStubCloseout(blockedCompletionSafeReport(), blockedCompletionSummary());

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.validation.complete, false);
  assert.equal(closeout.validation.ready_for_next_phase, false);
  assert.equal(closeout.validation.blocking_reasons.length > 0, true);
  assert.equal(closeout.closeout_items.every((item) => item.item_state === "blocked"), true);
  assertDisabledBoundary(closeout.execution_boundary);
});

test("VO-7AX-CLOSEOUT-3: closeout review passes without closing now, runtime execution, or real-upload readiness", () => {
  const summary = readyCompletionSummary();
  const closeout = createRuntimeStubCloseout(readyCompletionSafeReport(), summary);
  const review = createRuntimeStubCloseoutReview(closeout, summary, { id: "runtime-stub-closeout-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.closeout_review_state, "approved_for_future_closeout_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.closeout_reviewed, true);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_items.length, 4);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.closed_now === false && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AX-CLOSEOUT-4: blocked closeout blocks review", () => {
  const summary = blockedCompletionSummary();
  const closeout = createRuntimeStubCloseout(blockedCompletionSafeReport(), summary);
  const review = createRuntimeStubCloseoutReview(closeout, summary);

  assert.equal(review.closeout_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AX-CLOSEOUT-5: closeout safe report contains no callable, payload, response, or secrets", () => {
  const summary = readyCompletionSummary();
  const closeout = createRuntimeStubCloseout(readyCompletionSafeReport(), summary);
  const review = createRuntimeStubCloseoutReview(closeout, summary);
  const report = createRuntimeStubCloseoutSafeReport(review, closeout, { id: "runtime-stub-closeout-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_archive");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AX-CLOSEOUT-6: blocked closeout review blocks safe report", () => {
  const summary = blockedCompletionSummary();
  const closeout = createRuntimeStubCloseout(blockedCompletionSafeReport(), summary);
  const review = createRuntimeStubCloseoutReview(closeout, summary);
  const report = createRuntimeStubCloseoutSafeReport(review, closeout);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AX-SAFETY-7: unsafe strings are sanitized from closeout artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const summary = readyCompletionSummary();
  const closeout = createRuntimeStubCloseout(readyCompletionSafeReport(), summary, { id: unsafe, created_at: unsafe });
  const review = createRuntimeStubCloseoutReview(closeout, summary, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubCloseoutSafeReport(review, closeout, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ closeout, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AX-SAFETY-8: revocation keeps closeout artifacts disabled", () => {
  const summary = readyCompletionSummary();
  const closeout = createRuntimeStubCloseout(readyCompletionSafeReport(), summary);
  const review = createRuntimeStubCloseoutReview(closeout, summary);
  const report = createRuntimeStubCloseoutSafeReport(review, closeout);
  const revokedCloseout = revokeRuntimeStubCloseout(closeout, "Operator revoked closeout.");
  const revokedReview = revokeRuntimeStubCloseoutReview(review, "Operator revoked closeout review.");
  const revokedReport = revokeRuntimeStubCloseoutSafeReport(report, "Operator revoked closeout safe report.");

  assert.equal(revokedCloseout.closeout_state, "revoked");
  assert.equal(revokedCloseout.validation.complete, false);
  assert.equal(revokedCloseout.validation.ready_for_next_phase, false);
  assert.equal(revokedCloseout.closeout_items.every((item) => item.item_state === "blocked"), true);
  assert.equal(revokedCloseout.provenance.generated_by, "revokeRuntimeStubCloseout");
  assertDisabledBoundary(revokedCloseout.execution_boundary);

  assert.equal(revokedReview.closeout_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeStubCloseoutReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubCloseoutSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
