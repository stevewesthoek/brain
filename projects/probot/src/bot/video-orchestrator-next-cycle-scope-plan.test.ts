import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubePostPushCloseoutResult, YouTubePostPushCloseoutSafeReport } from "./video-orchestrator-youtube-post-push-closeout.js";
import {
  createVideoOrchestratorNextCycleScopePlan,
  createVideoOrchestratorNextCycleScopeReview,
  createVideoOrchestratorNextCycleScopeSafeReport,
  revokeVideoOrchestratorNextCycleScopePlan,
  revokeVideoOrchestratorNextCycleScopeReview,
  revokeVideoOrchestratorNextCycleScopeSafeReport,
  type VideoOrchestratorNextCycleScopeInput,
} from "./video-orchestrator-next-cycle-scope-plan.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

const CLOSEOUT: YouTubePostPushCloseoutResult = {
  schema_version: "1.0",
  post_push_closeout_id: "youtube-post-push-closeout-001",
  request_id: "youtube-post-push-closeout-request-001",
  project_id: "says-the-bible",
  created_at: "2026-05-14T00:00:00.000Z",
  closeout_state: "pushed_verified",
  closeout_only: true,
  branch: "main",
  remote: "origin",
  commit_sha: "b71f2f5f",
  commit_message: "Add YouTube Video Orchestrator controlled execution boundaries",
  pushed_range_summary: "ec3eb37d..b71f2f5f main -> main",
  pushed_verified: true,
  unrelated_changes_left_untouched: true,
  git_add_executed: false,
  committed_now: false,
  pushed_now: false,
  delete_executed: false,
  unrelated_changes_modified: false,
  execution_boundary: DISABLED_BOUNDARY,
  validation: { complete: true, ready_for_next_implementation_cycle_review: true, ready_for_real_upload: false, blocking_reasons: [], warnings: [] },
  provenance: { generated_by: "createYouTubePostPushCloseout" },
};

const REPORT: YouTubePostPushCloseoutSafeReport = {
  schema_version: "1.0",
  post_push_closeout_safe_report_id: "youtube-post-push-closeout-safe-report-001",
  post_push_closeout_review_id: "youtube-post-push-closeout-review-001",
  post_push_closeout_id: "youtube-post-push-closeout-001",
  created_at: "2026-05-14T00:00:00.000Z",
  safe_report_state: "requires_operator_confirmation_for_next_implementation_cycle",
  safe_report_only: true,
  pushed_verified: true,
  unrelated_changes_left_untouched: true,
  git_add_executed: false,
  committed_now: false,
  pushed_now: false,
  delete_executed: false,
  unrelated_changes_modified: false,
  ready_for_real_upload: false,
  execution_boundary: DISABLED_BOUNDARY,
  validation: { complete: true, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ["Explicit operator confirmation required before the next implementation cycle."], warnings: [] },
  provenance: { generated_by: "createYouTubePostPushCloseoutSafeReport", source_review_id: "youtube-post-push-closeout-review-001" },
};

const INPUT: VideoOrchestratorNextCycleScopeInput = {
  request_id: "next-cycle-scope-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-next-cycle-scope-001",
  cycle_scope_id: "next-cycle-scope-001",
  preferred_scope: "auto",
  allow_scope_planning_only: true,
  allow_file_creation: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
  allow_delete: false,
  allow_unrelated_changes: false,
};

test("VO-7DF-NEXT-CYCLE-SCOPE-1: selects dashboard account UI as the next logical scope", () => {
  const plan = createVideoOrchestratorNextCycleScopePlan(REPORT, CLOSEOUT, INPUT, { id: "next-cycle-scope-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.scope_state, "ready_for_operator_review");
  assert.equal(plan.planning_only, true);
  assert.equal(plan.selected_scope, "dashboard_account_ui");
  assert.equal(plan.candidates.length, 6);
  assert.equal(plan.candidates.every((candidate) => candidate.requires_manual_confirmation_before_implementation && !candidate.file_creation_enabled_now && !candidate.git_add_enabled_now && !candidate.commit_enabled_now && !candidate.push_enabled_now && !candidate.delete_enabled_now && !candidate.unrelated_change_enabled_now), true);
  assert.equal(plan.file_creation_enabled, false);
  assert.equal(plan.files_created_now, false);
  assert.equal(plan.git_add_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.commit_enabled, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.push_enabled, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.delete_enabled, false);
  assert.equal(plan.delete_executed, false);
  assert.equal(plan.unrelated_changes_enabled, false);
  assert.equal(plan.unrelated_changes_modified, false);
  assert.equal(plan.validation.complete, true);
  assert.equal(plan.validation.ready_for_selected_scope_review, true);
  assert.equal(plan.validation.ready_for_real_upload, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7DF-NEXT-CYCLE-SCOPE-2: unsafe input blocks next-cycle scope planning", () => {
  const plan = createVideoOrchestratorNextCycleScopePlan(REPORT, CLOSEOUT, { ...INPUT, allow_commit: true as false });

  assert.equal(plan.scope_state, "blocked");
  assert.equal(plan.selected_scope, null);
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7DG-NEXT-CYCLE-SCOPE-REVIEW-1: safe report requires confirmation before selected scope implementation", () => {
  const plan = createVideoOrchestratorNextCycleScopePlan(REPORT, CLOSEOUT, INPUT);
  const review = createVideoOrchestratorNextCycleScopeReview(plan, { id: "next-cycle-scope-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorNextCycleScopeSafeReport(review, plan, { id: "next-cycle-scope-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.selected_scope, "dashboard_account_ui");
  assert.equal(review.file_creation_enabled, false);
  assert.equal(review.files_created_now, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.delete_executed, false);
  assert.equal(review.unrelated_changes_modified, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_selected_scope_implementation");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.selected_scope, "dashboard_account_ui");
  assert.equal(report.file_creation_enabled, false);
  assert.equal(report.files_created_now, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.delete_executed, false);
  assert.equal(report.unrelated_changes_modified, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7DG-NEXT-CYCLE-SCOPE-REVIEW-2: revocation keeps scope artifacts disabled", () => {
  const plan = createVideoOrchestratorNextCycleScopePlan(REPORT, CLOSEOUT, INPUT);
  const review = createVideoOrchestratorNextCycleScopeReview(plan);
  const report = createVideoOrchestratorNextCycleScopeSafeReport(review, plan);

  assert.equal(revokeVideoOrchestratorNextCycleScopePlan(plan).scope_state, "revoked");
  assert.equal(revokeVideoOrchestratorNextCycleScopeReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorNextCycleScopeSafeReport(report).safe_report_state, "revoked");
});
