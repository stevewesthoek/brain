import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorDashboardAccountUiModel, renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";
import {
  composeVideoOrchestratorDashboardAccountPanel,
  createVideoOrchestratorDashboardRouteCompositionReview,
  createVideoOrchestratorDashboardRouteCompositionSafeReport,
  revokeVideoOrchestratorDashboardComposedPanel,
  revokeVideoOrchestratorDashboardRouteCompositionReview,
  revokeVideoOrchestratorDashboardRouteCompositionSafeReport,
  type VideoOrchestratorDashboardRouteCompositionInput,
} from "./video-orchestrator-dashboard-route-composition.js";

function accountHtml(): string {
  const model = createVideoOrchestratorDashboardAccountUiModel([
    { project_id: "says-the-bible", display_name: "Says the Bible", accounts: [{ account_id: "yt-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected" }] },
  ]);
  return renderVideoOrchestratorDashboardAccountUi(model);
}

const INPUT: VideoOrchestratorDashboardRouteCompositionInput = {
  request_id: "dashboard-route-composition-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-dashboard-route-composition-001",
  route_surface: "dashboard_html",
  account_ui_html: accountHtml(),
  allow_composition_helper_only: true,
  allow_render_tree_patch: false,
  allow_secret_access: false,
  allow_oauth_exchange: false,
  allow_runtime_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

test("VO-7DN-DASHBOARD-ROUTE-COMPOSITION-1: composes account panel without render tree patch", () => {
  const composition = composeVideoOrchestratorDashboardAccountPanel(INPUT, { id: "dashboard-route-composition-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(composition.composition_state, "ready_for_render_insertion");
  assert.equal(composition.route_surface, "dashboard_html");
  assert.equal(composition.account_ui_included, true);
  assert.equal(composition.html.includes("Video Orchestrator Accounts"), true);
  assert.equal(composition.render_tree_patched, false);
  assert.equal(composition.secret_accessed, false);
  assert.equal(composition.oauth_exchange_executed, false);
  assert.equal(composition.runtime_write_executed, false);
  assert.equal(composition.git_add_executed, false);
  assert.equal(composition.committed_now, false);
  assert.equal(composition.pushed_now, false);
  assert.equal(composition.validation.complete, true);
  assert.equal(composition.validation.ready_for_render_tree_patch_review, true);
});

test("VO-7DN-DASHBOARD-ROUTE-COMPOSITION-2: unsafe html blocks composition", () => {
  const composition = composeVideoOrchestratorDashboardAccountPanel({ ...INPUT, account_ui_html: `${accountHtml()} [CREDENTIAL_REFERENCE]` });

  assert.equal(composition.composition_state, "blocked");
  assert.equal(composition.account_ui_included, false);
  assert.equal(composition.html, "");
  assert.equal(composition.validation.complete, false);
  assert.equal(composition.git_add_executed, false);
  assert.equal(composition.committed_now, false);
  assert.equal(composition.pushed_now, false);
});

test("VO-7DO-DASHBOARD-ROUTE-COMPOSITION-REVIEW-1: safe report requires confirmation before render tree patch or staging", () => {
  const composition = composeVideoOrchestratorDashboardAccountPanel(INPUT);
  const review = createVideoOrchestratorDashboardRouteCompositionReview(composition, { id: "dashboard-route-composition-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorDashboardRouteCompositionSafeReport(review, composition, { id: "dashboard-route-composition-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.account_ui_included, true);
  assert.equal(review.render_tree_patched, false);
  assert.equal(review.secret_accessed, false);
  assert.equal(review.oauth_exchange_executed, false);
  assert.equal(review.runtime_write_executed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_render_tree_patch_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.account_ui_included, true);
  assert.equal(report.render_tree_patched, false);
  assert.equal(report.secret_accessed, false);
  assert.equal(report.oauth_exchange_executed, false);
  assert.equal(report.runtime_write_executed, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7DO-DASHBOARD-ROUTE-COMPOSITION-REVIEW-2: revocation keeps composition artifacts disabled", () => {
  const composition = composeVideoOrchestratorDashboardAccountPanel(INPUT);
  const review = createVideoOrchestratorDashboardRouteCompositionReview(composition);
  const report = createVideoOrchestratorDashboardRouteCompositionSafeReport(review, composition);

  assert.equal(revokeVideoOrchestratorDashboardComposedPanel(composition).composition_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRouteCompositionReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRouteCompositionSafeReport(report).safe_report_state, "revoked");
});
