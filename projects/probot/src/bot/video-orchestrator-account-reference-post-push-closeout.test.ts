import { test } from "node:test";
import assert from "node:assert";
import {
  createAccountReferencePostPushCloseout,
  createAccountReferencePostPushReview,
  createAccountReferencePostPushSafeReport,
  revokeAccountReferencePostPushCloseout,
  revokeAccountReferencePostPushReview,
  revokeAccountReferencePostPushSafeReport,
  type AccountReferencePostPushInput,
} from "./video-orchestrator-account-reference-post-push-closeout.js";

const INPUT: AccountReferencePostPushInput = {
  request_id: "account-reference-post-push-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-account-reference-post-push-001",
  branch: "main",
  remote: "origin",
  commit_sha: "a1fce4c8",
  commit_message: "Add Video Orchestrator account reference registry",
  pushed_range_summary: "5378e53e..a1fce4c8 main -> main",
  allow_closeout_only: true,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
  allow_delete: false,
  allow_unrelated_changes: false,
};

test("VO-7EH-ACCOUNT-REFERENCE-POST-PUSH-1: records pushed account-reference milestone without new git mutation", () => {
  const closeout = createAccountReferencePostPushCloseout(INPUT, { id: "account-reference-post-push-closeout-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(closeout.closeout_state, "pushed_verified");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.branch, "main");
  assert.equal(closeout.remote, "origin");
  assert.equal(closeout.commit_sha, "a1fce4c8");
  assert.equal(closeout.pushed_verified, true);
  assert.equal(closeout.unrelated_changes_left_untouched, true);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
  assert.equal(closeout.deleted_now, false);
  assert.equal(closeout.unrelated_changes_modified, false);
  assert.equal(closeout.validation.complete, true);
  assert.equal(closeout.validation.ready_for_next_scope_review, true);
});

test("VO-7EH-ACCOUNT-REFERENCE-POST-PUSH-2: unsafe input blocks closeout", () => {
  const closeout = createAccountReferencePostPushCloseout({ ...INPUT, allow_push: true as false });

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.pushed_verified, false);
  assert.equal(closeout.validation.complete, false);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
});

test("VO-7EI-ACCOUNT-REFERENCE-POST-PUSH-REVIEW-1: safe report requires confirmation before next scope", () => {
  const closeout = createAccountReferencePostPushCloseout(INPUT);
  const review = createAccountReferencePostPushReview(closeout, { id: "account-reference-post-push-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createAccountReferencePostPushSafeReport(review, closeout, { id: "account-reference-post-push-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.pushed_verified, true);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.deleted_now, false);
  assert.equal(review.unrelated_changes_modified, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_next_scope");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.pushed_verified, true);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.deleted_now, false);
  assert.equal(report.unrelated_changes_modified, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7EI-ACCOUNT-REFERENCE-POST-PUSH-REVIEW-2: revocation keeps closeout artifacts disabled", () => {
  const closeout = createAccountReferencePostPushCloseout(INPUT);
  const review = createAccountReferencePostPushReview(closeout);
  const report = createAccountReferencePostPushSafeReport(review, closeout);

  assert.equal(revokeAccountReferencePostPushCloseout(closeout).closeout_state, "revoked");
  assert.equal(revokeAccountReferencePostPushReview(review).review_state, "revoked");
  assert.equal(revokeAccountReferencePostPushSafeReport(report).safe_report_state, "revoked");
});
