import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createDisabledVideoOrchestratorRuntimeActivationResult, type VideoOrchestratorRuntimeActivationInput } from "./video-orchestrator-runtime-activation-entrypoint.js";
import { createVideoOrchestratorRuntimeActivationEntrypointReview, createVideoOrchestratorRuntimeActivationEntrypointSafeReport } from "./video-orchestrator-runtime-activation-entrypoint-review.js";
import { createVideoOrchestratorRuntimeDryRunInvocationDesign, createVideoOrchestratorRuntimeDryRunInvocationDesignReview, createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport } from "./video-orchestrator-runtime-dry-run-invocation-design.js";
import {
  createVideoOrchestratorRuntimeDryRunInvocationResult,
  createVideoOrchestratorRuntimeDryRunInvocationResultReview,
  revokeVideoOrchestratorRuntimeDryRunInvocationResult,
  revokeVideoOrchestratorRuntimeDryRunInvocationResultReview,
} from "./video-orchestrator-runtime-dry-run-invocation-result.js";

const INPUT: VideoOrchestratorRuntimeActivationInput = { request_id: "runtime-activation-request-001", project_id: "project-001", render_plan_id: "render-plan-001", platform: "youtube", operator_approval_id: "operator-approval-001", dry_run: true, runtime_enabled: false };
function readyDesignPair() {
  const result = createDisabledVideoOrchestratorRuntimeActivationResult(INPUT);
  const entryReview = createVideoOrchestratorRuntimeActivationEntrypointReview(result);
  const entrySafeReport = createVideoOrchestratorRuntimeActivationEntrypointSafeReport(entryReview);
  const design = createVideoOrchestratorRuntimeDryRunInvocationDesign(entrySafeReport);
  const review = createVideoOrchestratorRuntimeDryRunInvocationDesignReview(design, entrySafeReport);
  const safeReport = createVideoOrchestratorRuntimeDryRunInvocationDesignSafeReport(review, design);
  return { design, safeReport };
}
function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

test("VO-7BV-DRY-RUN-RESULT-1: disabled dry-run invocation result does not invoke anything", () => {
  const { design, safeReport } = readyDesignPair();
  const result = createVideoOrchestratorRuntimeDryRunInvocationResult(safeReport, design, { id: "runtime-dry-run-invocation-result-001", created_at: "2026-05-14T00:00:00.000Z" });
  const review = createVideoOrchestratorRuntimeDryRunInvocationResultReview(result);

  assert.equal(result.result_state, "approved_for_future_disabled_runtime_wiring_closeout");
  assert.equal(result.disabled_result_only, true);
  assert.equal(result.dry_run_invoked_now, false);
  assert.equal(result.runtime_invoked_now, false);
  assert.equal(result.upload_executed_now, false);
  assert.equal(result.platform_api_called, false);
  assert.equal(result.network_called, false);
  assert.equal(result.credentials_accessed, false);
  assert.equal(result.media_read, false);
  assert.equal(result.contains_runtime_callable, false);
  assert.equal(result.contains_raw_payload, false);
  assert.equal(result.contains_raw_response, false);
  assert.equal(result.contains_secret_material, false);
  assert.equal(result.result_checks.every((check) => check.check_state === "passed" && !check.dry_run_invoked_now && !check.runtime_invoked_now && !check.upload_executed_now && !check.ready_for_real_upload_now), true);
  assertDisabledBoundary(result.execution_boundary);

  assert.equal(review.review_state, "approved_for_future_disabled_runtime_wiring_closeout");
  assert.equal(review.review_only, true);
  assert.equal(review.dry_run_invoked_now, false);
  assert.equal(review.runtime_invoked_now, false);
  assert.equal(review.upload_executed_now, false);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BV-DRY-RUN-RESULT-2: blocked design path blocks result", () => {
  const { design, safeReport } = readyDesignPair();
  const blockedDesign = { ...design, design_state: "blocked" as const, validation: { ...design.validation, complete: false, ready_for_next_phase: false } };
  const result = createVideoOrchestratorRuntimeDryRunInvocationResult(safeReport, blockedDesign);
  const review = createVideoOrchestratorRuntimeDryRunInvocationResultReview(result);
  assert.equal(result.result_state, "blocked");
  assert.equal(result.validation.complete, false);
  assert.equal(review.review_state, "blocked");
});

test("VO-7BV-DRY-RUN-RESULT-3: revocation keeps result artifacts disabled", () => {
  const { design, safeReport } = readyDesignPair();
  const result = createVideoOrchestratorRuntimeDryRunInvocationResult(safeReport, design);
  const review = createVideoOrchestratorRuntimeDryRunInvocationResultReview(result);
  const revokedResult = revokeVideoOrchestratorRuntimeDryRunInvocationResult(result, "Operator revoked disabled dry-run invocation result.");
  const revokedReview = revokeVideoOrchestratorRuntimeDryRunInvocationResultReview(review, "Operator revoked disabled dry-run invocation review.");

  assert.equal(revokedResult.result_state, "revoked");
  assert.equal(revokedResult.validation.complete, false);
  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assertDisabledBoundary(revokedResult.execution_boundary);
  assertDisabledBoundary(revokedReview.execution_boundary);
});
