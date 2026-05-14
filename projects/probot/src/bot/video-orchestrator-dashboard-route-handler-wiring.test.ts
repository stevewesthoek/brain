import { test } from "node:test";
import assert from "node:assert";
import type { OAuthClientConfig, SafeDashboardAccount } from "./video-orchestrator-dashboard.js";
import { createVideoOrchestratorDashboardAccountUiModel, renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";
import {
  createVideoOrchestratorDashboardRouteHandlerWiringPlan,
  createVideoOrchestratorDashboardRouteHandlerWiringReview,
  createVideoOrchestratorDashboardRouteHandlerWiringSafeReport,
  revokeVideoOrchestratorDashboardRouteHandlerWiringPlan,
  revokeVideoOrchestratorDashboardRouteHandlerWiringReview,
  revokeVideoOrchestratorDashboardRouteHandlerWiringSafeReport,
  type VideoOrchestratorDashboardRouteHandlerWiringInput,
} from "./video-orchestrator-dashboard-route-handler-wiring.js";

const INPUT: VideoOrchestratorDashboardRouteHandlerWiringInput = {
  request_id: "dashboard-route-handler-wiring-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-dashboard-route-handler-wiring-001",
  target_helper: "renderAccountsAndCredentialsPanel",
  target_status_field: "account_ui_html",
  allow_plan_only: true,
  allow_blind_patch: false,
  allow_secret_access: false,
  allow_oauth_exchange: false,
  allow_runtime_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

const OAUTH_CONFIG: OAuthClientConfig = { client_id: "safe-client-id.apps.googleusercontent.com", configured: true, oauth_client_mode: "pkce_public_client", client_secret_configured: false };
const ACCOUNTS: SafeDashboardAccount[] = [{ account_id: "youtube-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, auth_mode: "oauth", status: "green", capabilities: { upload: true, status_check: true, refresh_supported: true, analytics: false, manual_fallback: true }, default_privacy: "private", allowed_privacy: ["private"], manual_fallback: true, notification_state: "dashboard", last_checked_at: null, next_action: "Ready.", warnings: [] }];

function safeAccountUiHtml(): string {
  const model = createVideoOrchestratorDashboardAccountUiModel([{ project_id: "says-the-bible", display_name: "Says the Bible", accounts: [{ account_id: "youtube-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected" }] }]);
  return renderVideoOrchestratorDashboardAccountUi(model);
}

test("VO-7DR-DASHBOARD-ROUTE-HANDLER-WIRING-1: plans precise helper call shape without blind patch", () => {
  const plan = createVideoOrchestratorDashboardRouteHandlerWiringPlan(INPUT, ACCOUNTS, OAUTH_CONFIG, safeAccountUiHtml(), { id: "dashboard-route-handler-wiring-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.wiring_state, "ready_for_precise_patch");
  assert.equal(plan.call_shape.helper_name, "renderAccountsAndCredentialsPanel");
  assert.deepEqual(plan.call_shape.required_arguments, ["accounts", "oauth_client_config", "account_ui_html"]);
  assert.equal(plan.example_accounts_count, 1);
  assert.equal(plan.oauth_configured, true);
  assert.equal(plan.account_ui_html_available, true);
  assert.equal(plan.blind_patch_allowed, false);
  assert.equal(plan.secret_accessed, false);
  assert.equal(plan.oauth_exchange_executed, false);
  assert.equal(plan.runtime_write_executed, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
  assert.equal(plan.validation.ready_for_precise_patch_review, true);
});

test("VO-7DR-DASHBOARD-ROUTE-HANDLER-WIRING-2: unsafe html blocks planning", () => {
  const plan = createVideoOrchestratorDashboardRouteHandlerWiringPlan(INPUT, ACCOUNTS, OAUTH_CONFIG, `${safeAccountUiHtml()} [TOKEN]`);

  assert.equal(plan.wiring_state, "blocked");
  assert.equal(plan.account_ui_html_available, false);
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.blind_patch_allowed, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
});

test("VO-7DS-DASHBOARD-ROUTE-HANDLER-WIRING-REVIEW-1: safe report requires confirmation before precise patch or staging", () => {
  const plan = createVideoOrchestratorDashboardRouteHandlerWiringPlan(INPUT, ACCOUNTS, OAUTH_CONFIG, safeAccountUiHtml());
  const review = createVideoOrchestratorDashboardRouteHandlerWiringReview(plan, { id: "dashboard-route-handler-wiring-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorDashboardRouteHandlerWiringSafeReport(review, plan, { id: "dashboard-route-handler-wiring-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.ready_for_precise_patch, true);
  assert.equal(review.blind_patch_allowed, false);
  assert.equal(review.secret_accessed, false);
  assert.equal(review.oauth_exchange_executed, false);
  assert.equal(review.runtime_write_executed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_precise_dashboard_patch_or_git_staging");
  assert.equal(report.ready_for_precise_patch, true);
  assert.equal(report.blind_patch_allowed, false);
  assert.equal(report.secret_accessed, false);
  assert.equal(report.oauth_exchange_executed, false);
  assert.equal(report.runtime_write_executed, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7DS-DASHBOARD-ROUTE-HANDLER-WIRING-REVIEW-2: revocation keeps route-handler artifacts disabled", () => {
  const plan = createVideoOrchestratorDashboardRouteHandlerWiringPlan(INPUT, ACCOUNTS, OAUTH_CONFIG, safeAccountUiHtml());
  const review = createVideoOrchestratorDashboardRouteHandlerWiringReview(plan);
  const report = createVideoOrchestratorDashboardRouteHandlerWiringSafeReport(review, plan);

  assert.equal(revokeVideoOrchestratorDashboardRouteHandlerWiringPlan(plan).wiring_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRouteHandlerWiringReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRouteHandlerWiringSafeReport(report).safe_report_state, "revoked");
});
