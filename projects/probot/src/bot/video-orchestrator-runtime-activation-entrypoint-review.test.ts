import { test } from "node:test";
import assert from "node:assert";
import { createDisabledVideoOrchestratorRuntimeActivationResult, type VideoOrchestratorRuntimeActivationInput } from "./video-orchestrator-runtime-activation-entrypoint.js";
import {
  createVideoOrchestratorRuntimeActivationEntrypointReview,
  createVideoOrchestratorRuntimeActivationEntrypointSafeReport,
  revokeVideoOrchestratorRuntimeActivationEntrypointReview,
  revokeVideoOrchestratorRuntimeActivationEntrypointSafeReport,
} from "./video-orchestrator-runtime-activation-entrypoint-review.js";

const INPUT: VideoOrchestratorRuntimeActivationInput = {
  request_id: "runtime-activation-request-001",
  project_id: "project-001",
  render_plan_id: "render-plan-001",
  platform: "youtube",
  operator_approval_id: "operator-approval-001",
  dry_run: true,
  runtime_enabled: false,
};

test("VO-7BT-RUNTIME-ENTRYPOINT-REVIEW-1: review and safe report preserve disabled boundaries", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);
  const review = createVideoOrchestratorRuntimeActivationEntrypointReview(result, { id: "runtime-activation-entrypoint-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorRuntimeActivationEntrypointSafeReport(review, { id: "runtime-activation-entrypoint-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.production_imports_added, false);
  assert.equal(review.automatic_invocation_added, false);
  assert.equal(review.runtime_invoked, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.platform_api_called, false);
  assert.equal(review.network_called, false);
  assert.equal(review.credentials_accessed, false);
  assert.equal(review.media_read, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_invoked && !check.upload_executed && !check.ready_for_real_upload_now), true);
  for (const value of Object.values(review.execution_boundary)) assert.equal(value, false);

  assert.equal(report.safe_report_state, "approved_for_future_disabled_dry_run_invocation_design");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.runtime_invoked, false);
  assert.equal(report.upload_executed, false);
  assert.equal(report.platform_api_called, false);
  assert.equal(report.network_called, false);
  assert.equal(report.credentials_accessed, false);
  assert.equal(report.media_read, false);
  assert.equal(report.safe_report_sections.every((section) => !section.runtime_invoked && !section.upload_executed && !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.ready_for_real_upload_now), true);
  for (const value of Object.values(report.execution_boundary)) assert.equal(value, false);
});

test("VO-7BT-RUNTIME-ENTRYPOINT-REVIEW-2: blocked source blocks review and safe report", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult({ ...INPUT, runtime_enabled: true as false });
  const review = createVideoOrchestratorRuntimeActivationEntrypointReview(result);
  const report = createVideoOrchestratorRuntimeActivationEntrypointSafeReport(review);

  assert.equal(review.review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7BT-RUNTIME-ENTRYPOINT-REVIEW-3: revocation keeps artifacts disabled", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);
  const review = createVideoOrchestratorRuntimeActivationEntrypointReview(result);
  const report = createVideoOrchestratorRuntimeActivationEntrypointSafeReport(review);
  const revokedReview = revokeVideoOrchestratorRuntimeActivationEntrypointReview(review, "Operator revoked disabled runtime entrypoint review.");
  const revokedReport = revokeVideoOrchestratorRuntimeActivationEntrypointSafeReport(report, "Operator revoked disabled runtime entrypoint safe report.");

  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  for (const value of Object.values(revokedReview.execution_boundary)) assert.equal(value, false);
  for (const value of Object.values(revokedReport.execution_boundary)) assert.equal(value, false);
});
