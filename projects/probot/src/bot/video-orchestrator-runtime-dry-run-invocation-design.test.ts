import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createDisabledVideoOrchestratorRuntimeActivationResult, type VideoOrchestratorRuntimeActivationInput } from "./video-orchestrator-runtime-activation-entrypoint.js";
import { createVideoOrchestratorRuntimeActivationEntrypointReview, createVideoOrchestratorRuntimeActivationEntrypointSafeReport } from "./video-orchestrator-runtime-activation-entrypoint-review.js";
import {
  createVideoOrchestratorRuntimeDryRunInvocationDesign,
  createVideoOrchestratorRuntimeDryRunInvocationDesignReview,
  createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport,
  revokeVideoOrchestratorRuntimeDryRunInvocationDesign,
  revokeVideoOrchestratorRuntimeDryRunInvocationDesignReview,
  revokeVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport,
} from "./video-orchestrator-runtime-dry-run-invocation-design.js";

const INPUT: VideoOrchestratorRuntimeActivationInput = {
  request_id: "runtime-activation-request-001",
  project_id: "project-001",
  render_plan_id: "render-plan-001",
  platform: "youtube",
  operator_approval_id: "operator-approval-001",
  dry_run: true,
  runtime_enabled: false,
};

function readySafeReport() {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);
  const review = createVideoOrchestratorRuntimeActivationEntrypointReview(result);
  return createVideoOrchestratorRuntimeActivationEntrypointSafeReport(review);
}

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

test("VO-7BU-DRY-RUN-DESIGN-1: disabled dry-run invocation design never invokes dry-run/runtime/upload behavior", () => {
  const safeReport = readySafeReport();
  const design = createVideoOrchestratorRuntimeDryRunInvocationDesign(safeReport, { id: "runtime-dry-run-invocation-design-001", created_at: "2026-05-14T00:00:00.000Z" });
  const review = createVideoOrchestratorRuntimeDryRunInvocationDesignReview(design, safeReport);
  const report = createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport(review, design);

  assert.equal(design.design_state, "approved_for_future_disabled_dry_run_invocation_review");
  assert.equal(design.design_only, true);
  assert.equal(design.dry_run_invocation_design_only, true);
  assert.equal(design.dry_run_invoked_now, false);
  assert.equal(design.runtime_invoked_now, false);
  assert.equal(design.upload_executed_now, false);
  assert.equal(design.design_terms.every((term) => !term.dry_run_invoked_now && !term.runtime_invoked_now && !term.upload_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material), true);
  assertDisabledBoundary(design.execution_boundary);

  assert.equal(review.review_state, "approved_for_future_disabled_dry_run_invocation_safe_report");
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && !check.dry_run_invoked_now && !check.runtime_invoked_now && !check.upload_executed_now && !check.ready_for_real_upload_now), true);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_future_disabled_dry_run_invocation_result");
  assert.equal(report.safe_report_sections.every((section) => !section.dry_run_invoked_now && !section.runtime_invoked_now && !section.upload_executed_now && !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.ready_for_real_upload_now), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BU-DRY-RUN-DESIGN-2: blocked prerequisite blocks design path", () => {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult({ ...INPUT, runtime_enabled: true as false });
  const review = createVideoOrchestratorRuntimeActivationEntrypointReview(result);
  const safeReport = createVideoOrchestratorRuntimeActivationEntrypointSafeReport(review);
  const design = createVideoOrchestratorRuntimeDryRunInvocationDesign(safeReport);
  const designReview = createVideoOrchestratorRuntimeDryRunInvocationDesignReview(design, safeReport);
  const report = createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport(designReview, design);

  assert.equal(design.design_state, "blocked");
  assert.equal(design.validation.complete, false);
  assert.equal(designReview.review_state, "blocked");
  assert.equal(report.safe_report_state, "blocked");
});

test("VO-7BU-DRY-RUN-DESIGN-3: revocation keeps design artifacts disabled", () => {
  const safeReport = readySafeReport();
  const design = createVideoOrchestratorRuntimeDryRunInvocationDesign(safeReport);
  const review = createVideoOrchestratorRuntimeDryRunInvocationDesignReview(design, safeReport);
  const report = createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport(review, design);

  assert.equal(revokeVideoOrchestratorRuntimeDryRunInvocationDesign(design).design_state, "revoked");
  assert.equal(revokeVideoOrchestratorRuntimeDryRunInvocationDesignReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport(report).safe_report_state, "revoked");
});
