import { test } from "node:test";
import assert from "node:assert";
import {
  createVideoOrchestratorDashboardPostPushCloseout,
  createVideoOrchestratorDashboardPostPushCloseoutReview,
  createVideoOrchestratorDashboardPostPushCloseoutSafeReport,
  revokeVideoOrchestratorDashboardPostPushCloseout,
  revokeVideoOrchestratorDashboardPostPushCloseoutReview,
  revokeVideoOrchestratorDashboardPostPushCloseoutSafeReport,
  type VideoOrchestratorDashboardPostPushCloseoutInput,
} from "./video-orchestrator-dashboard-post-push-closeout.js";

const INPUT: VideoOrchestratorDashboardPostPushCloseoutInput = {
  request_id: "dashboard-post-push-closeout-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-dashboard-post-push-closeout-001",
  branch: "main",
  remote: "origin",
  commit_sha: "5378e53e",
  commit_message: "Add Video Orchestrator dashboard account UI wiring",
  pushed_range_summary: "b71f2f5f..5378e53e main -> main",
  allow_closeout_only: true,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
  allow_delete: false,
  allow_unrelated_changes: false,
};

test("VO-7DV-DASHBOARD-POST-PUSH-CLOSEOUT-1: records pushed dashboard cycle without new git mutation", () => {
  const result = createVideoOrchestratorDashboardPostPushCloseout(INPUT, { id: "dashboard-post-push-closeout-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.closeout_state, "pushed_verified");
  assert.equal(result.closeout_only, true);
  assert.equal(result.branch, "main");
  assert.equal(result.remote, "origin");
  assert.equal(result.commit_sha, "5378e53e");
  assert.equal(result.pushed_verified, true);
  assert.equal(result.unrelated_changes_left_untouched, true);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.deleted_now, false);
  assert.equal(result.unrelated_changes_modified, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_next_scope_review, true);
});

test("VO-7DV-DASHBOARD-POST-PUSH-CLOSEOUT-2: unsafe input blocks closeout", () => {
  const result = createVideoOrchestratorDashboardPostPushCloseout({ ...INPUT, allow_delete: true as false });

  assert.equal(result.closeout_state, "blocked");
  assert.equal(result.pushed_verified, false);
  assert.equal(result.validation.complete, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.deleted_now, false);
});

test("VO-7DW-DASHBOARD-POST-PUSH-CLOSEOUT-REVIEW-1: safe report requires confirmation before next dashboard or credential scope", () => {
  const closeout = createVideoOrchestratorDashboardPostPushCloseout(INPUT);
  const review = createVideoOrchestratorDashboardPostPushCloseoutReview(closeout, { id: "dashboard-post-push-closeout-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorDashboardPostPushCloseoutSafeReport(review, closeout, { id: "dashboard-post-push-closeout-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.pushed_verified, true);
  assert.equal(review.unrelated_changes_left_untouched, true);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.deleted_now, false);
  assert.equal(review.unrelated_changes_modified, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_next_dashboard_or_credential_scope");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.pushed_verified, true);
  assert.equal(report.unrelated_changes_left_untouched, true);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.deleted_now, false);
  assert.equal(report.unrelated_changes_modified, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7DW-DASHBOARD-POST-PUSH-CLOSEOUT-REVIEW-2: revocation keeps closeout artifacts disabled", () => {
  const closeout = createVideoOrchestratorDashboardPostPushCloseout(INPUT);
  const review = createVideoOrchestratorDashboardPostPushCloseoutReview(closeout);
  const report = createVideoOrchestratorDashboardPostPushCloseoutSafeReport(review, closeout);

  assert.equal(revokeVideoOrchestratorDashboardPostPushCloseout(closeout).closeout_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardPostPushCloseoutReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardPostPushCloseoutSafeReport(report).safe_report_state, "revoked");
});
