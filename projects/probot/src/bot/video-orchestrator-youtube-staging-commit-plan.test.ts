import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createYouTubeCommitPushBoundaryPlan, createYouTubeCommitPushBoundaryReview, createYouTubeCommitPushBoundarySafeReport, type YouTubeCommitPushBoundaryInput } from "./video-orchestrator-youtube-commit-push-boundary-plan.js";
import type { YouTubeDeleteMetadataImplementationResult, YouTubeDeleteMetadataImplementationSafeReport } from "./video-orchestrator-youtube-delete-metadata-implementation.js";
import {
  createYouTubeStagingCommitPlan,
  createYouTubeStagingCommitPlanReview,
  createYouTubeStagingCommitSafeReport,
  revokeYouTubeStagingCommitPlan,
  revokeYouTubeStagingCommitPlanReview,
  revokeYouTubeStagingCommitSafeReport,
  type YouTubeStagingCommitPlanInput,
} from "./video-orchestrator-youtube-staging-commit-plan.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const UPSTREAM_RESULT: YouTubeDeleteMetadataImplementationResult = {
  schema_version: "1.0",
  delete_metadata_implementation_result_id: "delete-metadata-result-001",
  delete_metadata_boundary_safe_report_id: "delete-metadata-safe-report-001",
  delete_metadata_boundary_plan_id: "delete-metadata-plan-001",
  request_id: "delete-metadata-request-001",
  project_id: "says-the-bible",
  created_at: "2026-05-14T00:00:00.000Z",
  implementation_state: "ready_for_operator_review",
  implementation_checks_executed: true,
  planned_intents: [{ intent_id: "intent-001", target_kind: "video", target_reference_id: "video-001", safe_summary: "Intent summary.", actual_delete_enabled_now: false, actual_delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false }],
  actual_deletes_enabled: false,
  actual_deletes_executed: false,
  unrelated_metadata_changes_enabled: false,
  unrelated_metadata_changed: false,
  commits_enabled: false,
  pushes_enabled: false,
  raw_payload_stored: false,
  raw_response_stored: false,
  safe_store_result: null,
  execution_boundary: { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false },
  validation: { complete: true, ready_for_commit_push_boundary_review: true, ready_for_real_upload: false, blocking_reasons: [], warnings: [] },
  provenance: { generated_by: "runYouTubeDeleteMetadataImplementation", source_safe_report_id: "delete-metadata-safe-report-001" },
};

const UPSTREAM_REPORT: YouTubeDeleteMetadataImplementationSafeReport = {
  schema_version: "1.0",
  delete_metadata_implementation_safe_report_id: "delete-metadata-safe-report-001",
  delete_metadata_implementation_review_id: "delete-metadata-review-001",
  delete_metadata_implementation_result_id: "delete-metadata-result-001",
  created_at: "2026-05-14T00:00:00.000Z",
  safe_report_state: "requires_operator_confirmation_for_commit_push_boundary",
  safe_report_only: true,
  implementation_checks_executed: true,
  actual_deletes_executed: false,
  unrelated_metadata_changed: false,
  commits_enabled: false,
  pushes_enabled: false,
  ready_for_real_upload: false,
  execution_boundary: UPSTREAM_RESULT.execution_boundary,
  validation: { complete: true, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ["Explicit operator confirmation required before commit/push boundary work."], warnings: [] },
  provenance: { generated_by: "createYouTubeDeleteMetadataImplementationSafeReport", source_review_id: "delete-metadata-review-001" },
};

const BOUNDARY_INPUT: YouTubeCommitPushBoundaryInput = {
  request_id: "commit-push-boundary-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-commit-push-boundary-001",
  boundary_scope_id: "commit-push-boundary-scope-001",
  allow_planning_only: true,
  allow_staging: false,
  allow_commits: false,
  allow_pushes: false,
  allow_destructive_cleanup: false,
};

const STAGING_INPUT: YouTubeStagingCommitPlanInput = {
  request_id: "staging-commit-plan-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-staging-commit-plan-001",
  plan_scope_id: "staging-commit-plan-scope-001",
  allow_plan_only: true,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

function readyBoundaryPair() {
  const boundaryPlan = createYouTubeCommitPushBoundaryPlan(UPSTREAM_REPORT, UPSTREAM_RESULT, BOUNDARY_INPUT);
  const boundaryReview = createYouTubeCommitPushBoundaryReview(boundaryPlan);
  const boundaryReport = createYouTubeCommitPushBoundarySafeReport(boundaryReview, boundaryPlan);
  return { boundaryPlan, boundaryReport };
}

test("VO-7DB-STAGING-COMMIT-PLAN-1: creates staging/commit plan without git add, commit, or push", () => {
  const { boundaryPlan, boundaryReport } = readyBoundaryPair();
  const plan = createYouTubeStagingCommitPlan(boundaryReport, boundaryPlan, STAGING_INPUT, { id: "youtube-staging-commit-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.plan_state, "ready_for_operator_review");
  assert.equal(plan.plan_only, true);
  assert.equal(plan.planned_files.length, 4);
  assert.equal(plan.planned_files.every((file) => !file.staged_now && !file.committed_now && !file.pushed_now), true);
  assert.equal(plan.recommended_commit_message, "Add YouTube Video Orchestrator controlled execution boundaries");
  assert.equal(plan.validation_evidence.length, 2);
  assert.equal(plan.git_add_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.commit_enabled, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.push_enabled, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
  assert.equal(plan.validation.ready_for_git_add_commit_review, true);
  assert.equal(plan.validation.ready_for_real_upload, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7DB-STAGING-COMMIT-PLAN-2: unsafe input blocks planning", () => {
  const { boundaryPlan, boundaryReport } = readyBoundaryPair();
  const plan = createYouTubeStagingCommitPlan(boundaryReport, boundaryPlan, { ...STAGING_INPUT, allow_commit: true as false });

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7DC-STAGING-COMMIT-REVIEW-1: review and safe report require confirmation before git add/commit", () => {
  const { boundaryPlan, boundaryReport } = readyBoundaryPair();
  const plan = createYouTubeStagingCommitPlan(boundaryReport, boundaryPlan, STAGING_INPUT);
  const review = createYouTubeStagingCommitPlanReview(plan, { id: "youtube-staging-commit-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeStagingCommitSafeReport(review, plan, { id: "youtube-staging-commit-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.planned_file_count, 4);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_git_add_commit");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.planned_file_count, 4);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7DC-STAGING-COMMIT-REVIEW-2: revocation keeps staging/commit artifacts disabled", () => {
  const { boundaryPlan, boundaryReport } = readyBoundaryPair();
  const plan = createYouTubeStagingCommitPlan(boundaryReport, boundaryPlan, STAGING_INPUT);
  const review = createYouTubeStagingCommitPlanReview(plan);
  const report = createYouTubeStagingCommitSafeReport(review, plan);

  assert.equal(revokeYouTubeStagingCommitPlan(plan).plan_state, "revoked");
  assert.equal(revokeYouTubeStagingCommitPlanReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeStagingCommitSafeReport(report).safe_report_state, "revoked");
});
