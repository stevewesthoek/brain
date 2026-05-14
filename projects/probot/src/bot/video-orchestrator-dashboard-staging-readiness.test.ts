import { test } from "node:test";
import assert from "node:assert";
import {
  createVideoOrchestratorDashboardStagingReadiness,
  createVideoOrchestratorDashboardStagingReadinessReview,
  createVideoOrchestratorDashboardStagingReadinessSafeReport,
  revokeVideoOrchestratorDashboardStagingReadiness,
  revokeVideoOrchestratorDashboardStagingReadinessReview,
  revokeVideoOrchestratorDashboardStagingReadinessSafeReport,
  type VideoOrchestratorDashboardStagingReadinessInput,
} from "./video-orchestrator-dashboard-staging-readiness.js";

const CHANGED_PATHS = [
  "operations/runbooks/README.md",
  "operations/runbooks/video-orchestrator-implementation-plan.md",
  "operations/runbooks/video-orchestrator-roadmap.md",
  "operations/system-configs/codex/config.toml",
  "projects/probot/src/bot/dashboard.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui-adapter.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-account-ui-adapter.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-render-insertion.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-composition.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-composition.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-handler-wiring.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-route-handler-wiring.test.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-runtime-wiring.ts",
  "projects/probot/src/bot/video-orchestrator-dashboard-runtime-wiring.test.ts",
  "projects/probot/src/bot/video-orchestrator-next-cycle-scope-plan.ts",
  "projects/probot/src/bot/video-orchestrator-next-cycle-scope-plan.test.ts",
  "projects/probot/src/bot/video-orchestrator-youtube-post-push-closeout.ts",
  "projects/probot/src/bot/video-orchestrator-youtube-post-push-closeout.test.ts",
  "tools/firecrawl/logs/firecrawl.log",
];

const INPUT: VideoOrchestratorDashboardStagingReadinessInput = {
  request_id: "dashboard-staging-readiness-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-dashboard-staging-readiness-001",
  changed_paths: CHANGED_PATHS,
  allow_readiness_only: true,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
  allow_delete: false,
  allow_unrelated_changes: false,
};

test("VO-7DT-DASHBOARD-STAGING-READINESS-1: allowlists intended paths and excludes unrelated changes", () => {
  const result = createVideoOrchestratorDashboardStagingReadiness(INPUT, { id: "dashboard-staging-readiness-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.readiness_state, "ready_for_staging_review");
  assert.equal(result.intended_paths.includes("projects/probot/src/bot/video-orchestrator-dashboard-account-ui.ts"), true);
  assert.equal(result.intended_paths.includes("projects/probot/src/bot/video-orchestrator-dashboard-staging-readiness.ts"), false);
  assert.equal(result.excluded_paths.includes("operations/runbooks/README.md"), true);
  assert.equal(result.excluded_paths.includes("operations/system-configs/codex/config.toml"), true);
  assert.equal(result.excluded_paths.includes("tools/firecrawl/logs/firecrawl.log"), true);
  assert.equal(result.unknown_dashboard_cycle_paths.length, 0);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.deleted_now, false);
  assert.equal(result.unrelated_changes_modified, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_git_add_review, true);
});

test("VO-7DT-DASHBOARD-STAGING-READINESS-2: unknown dashboard-cycle paths block staging readiness", () => {
  const result = createVideoOrchestratorDashboardStagingReadiness({ ...INPUT, changed_paths: [...CHANGED_PATHS, "projects/probot/src/bot/video-orchestrator-dashboard-surprise.ts"] });

  assert.equal(result.readiness_state, "blocked");
  assert.equal(result.unknown_dashboard_cycle_paths, ["projects/probot/src/bot/video-orchestrator-dashboard-surprise.ts"]);
  assert.equal(result.validation.complete, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
});

test("VO-7DU-DASHBOARD-STAGING-READINESS-REVIEW-1: safe report requires confirmation before git add", () => {
  const result = createVideoOrchestratorDashboardStagingReadiness(INPUT);
  const review = createVideoOrchestratorDashboardStagingReadinessReview(result, { id: "dashboard-staging-readiness-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorDashboardStagingReadinessSafeReport(review, result, { id: "dashboard-staging-readiness-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.intended_path_count, result.intended_paths.length);
  assert.equal(review.excluded_path_count, result.excluded_paths.length);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.deleted_now, false);
  assert.equal(review.unrelated_changes_modified, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_git_add");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.intended_paths, result.intended_paths);
  assert.equal(report.excluded_paths, result.excluded_paths);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.deleted_now, false);
  assert.equal(report.unrelated_changes_modified, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7DU-DASHBOARD-STAGING-READINESS-REVIEW-2: revocation keeps staging artifacts disabled", () => {
  const result = createVideoOrchestratorDashboardStagingReadiness(INPUT);
  const review = createVideoOrchestratorDashboardStagingReadinessReview(result);
  const report = createVideoOrchestratorDashboardStagingReadinessSafeReport(review, result);

  assert.equal(revokeVideoOrchestratorDashboardStagingReadiness(result).readiness_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardStagingReadinessReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardStagingReadinessSafeReport(report).safe_report_state, "revoked");
});
