import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import {
  createYouTubePostPushCloseout,
  createYouTubePostPushCloseoutReview,
  createYouTubePostPushCloseoutSafeReport,
  revokeYouTubePostPushCloseout,
  revokeYouTubePostPushCloseoutReview,
  revokeYouTubePostPushCloseoutSafeReport,
  type YouTubePostPushCloseoutInput,
} from "./video-orchestrator-youtube-post-push-closeout.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const INPUT: YouTubePostPushCloseoutInput = {
  request_id: "youtube-post-push-closeout-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-post-push-closeout-001",
  branch: "main",
  remote: "origin",
  commit_sha: "b71f2f5f",
  commit_message: "Add YouTube Video Orchestrator controlled execution boundaries",
  pushed_range_summary: "ec3eb37d..b71f2f5f main -> main",
  allow_closeout_only: true,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
  allow_delete: false,
  allow_unrelated_changes: false,
};

test("VO-7DD-POST-PUSH-CLOSEOUT-1: creates pushed closeout without new git mutation", () => {
  const result = createYouTubePostPushCloseout(INPUT, { id: "youtube-post-push-closeout-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.closeout_state, "pushed_verified");
  assert.equal(result.closeout_only, true);
  assert.equal(result.branch, "main");
  assert.equal(result.remote, "origin");
  assert.equal(result.commit_sha, "b71f2f5f");
  assert.equal(result.pushed_verified, true);
  assert.equal(result.unrelated_changes_left_untouched, true);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.delete_executed, false);
  assert.equal(result.unrelated_changes_modified, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_next_implementation_cycle_review, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7DD-POST-PUSH-CLOSEOUT-2: unsafe input blocks closeout", () => {
  const result = createYouTubePostPushCloseout({ ...INPUT, allow_push: true as false });

  assert.equal(result.closeout_state, "blocked");
  assert.equal(result.pushed_verified, false);
  assert.equal(result.validation.complete, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7DE-POST-PUSH-REVIEW-1: review and safe report require confirmation for next implementation cycle", () => {
  const closeout = createYouTubePostPushCloseout(INPUT);
  const review = createYouTubePostPushCloseoutReview(closeout, { id: "youtube-post-push-closeout-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubePostPushCloseoutSafeReport(review, closeout, { id: "youtube-post-push-closeout-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.pushed_verified, true);
  assert.equal(review.unrelated_changes_left_untouched, true);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.delete_executed, false);
  assert.equal(review.unrelated_changes_modified, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_next_implementation_cycle");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.pushed_verified, true);
  assert.equal(report.unrelated_changes_left_untouched, true);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.delete_executed, false);
  assert.equal(report.unrelated_changes_modified, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7DE-POST-PUSH-REVIEW-2: revocation keeps post-push artifacts disabled", () => {
  const closeout = createYouTubePostPushCloseout(INPUT);
  const review = createYouTubePostPushCloseoutReview(closeout);
  const report = createYouTubePostPushCloseoutSafeReport(review, closeout);

  assert.equal(revokeYouTubePostPushCloseout(closeout).closeout_state, "revoked");
  assert.equal(revokeYouTubePostPushCloseoutReview(review).review_state, "revoked");
  assert.equal(revokeYouTubePostPushCloseoutSafeReport(report).safe_report_state, "revoked");
});
