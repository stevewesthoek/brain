import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorDashboardAccountUiModel, renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";
import {
  createVideoOrchestratorDashboardRuntimeWiringResult,
  createVideoOrchestratorDashboardRuntimeWiringReview,
  createVideoOrchestratorDashboardRuntimeWiringSafeReport,
  revokeVideoOrchestratorDashboardRuntimeWiringResult,
  revokeVideoOrchestratorDashboardRuntimeWiringReview,
  revokeVideoOrchestratorDashboardRuntimeWiringSafeReport,
  type VideoOrchestratorDashboardRuntimeWiringInput,
} from "./video-orchestrator-dashboard-runtime-wiring.js";

const INPUT: VideoOrchestratorDashboardRuntimeWiringInput = {
  request_id: "dashboard-runtime-wiring-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-dashboard-runtime-wiring-001",
  route_surface: "account_center_status",
  allow_status_helper_wiring: true,
  allow_route_composition_patch: false,
  allow_secret_access: false,
  allow_oauth_exchange: false,
  allow_file_runtime_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

function modelAndHtml() {
  const model = createVideoOrchestratorDashboardAccountUiModel([
    { project_id: "says-the-bible", display_name: "Says the Bible", accounts: [{ account_id: "yt-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected" }] },
  ]);
  return { model, html: renderVideoOrchestratorDashboardAccountUi(model) };
}

test("VO-7DL-DASHBOARD-RUNTIME-WIRING-1: records status-helper wiring without route composition patch", () => {
  const { model, html } = modelAndHtml();
  const result = createVideoOrchestratorDashboardRuntimeWiringResult(INPUT, model, html, { id: "dashboard-runtime-wiring-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.wiring_state, "wired_to_status_helper");
  assert.equal(result.route_surface, "account_center_status");
  assert.equal(result.account_ui_html_available, true);
  assert.equal(result.model_summary.project_count, 1);
  assert.equal(result.model_summary.account_count, 1);
  assert.equal(result.read_only, true);
  assert.equal(result.route_composition_patched, false);
  assert.equal(result.secret_accessed, false);
  assert.equal(result.oauth_exchange_executed, false);
  assert.equal(result.file_runtime_write_executed, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_route_composition_review, true);
});

test("VO-7DL-DASHBOARD-RUNTIME-WIRING-2: unsafe permission blocks wiring", () => {
  const { model, html } = modelAndHtml();
  const result = createVideoOrchestratorDashboardRuntimeWiringResult({ ...INPUT, allow_oauth_exchange: true as false }, model, html);

  assert.equal(result.wiring_state, "blocked");
  assert.equal(result.account_ui_html_available, false);
  assert.equal(result.validation.complete, false);
  assert.equal(result.oauth_exchange_executed, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
});

test("VO-7DM-DASHBOARD-RUNTIME-WIRING-REVIEW-1: safe report requires confirmation before route composition patch", () => {
  const { model, html } = modelAndHtml();
  const result = createVideoOrchestratorDashboardRuntimeWiringResult(INPUT, model, html);
  const review = createVideoOrchestratorDashboardRuntimeWiringReview(result, { id: "dashboard-runtime-wiring-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorDashboardRuntimeWiringSafeReport(review, result, { id: "dashboard-runtime-wiring-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.account_ui_html_available, true);
  assert.equal(review.route_composition_patched, false);
  assert.equal(review.secret_accessed, false);
  assert.equal(review.oauth_exchange_executed, false);
  assert.equal(review.file_runtime_write_executed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_route_composition_patch");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.account_ui_html_available, true);
  assert.equal(report.route_composition_patched, false);
  assert.equal(report.secret_accessed, false);
  assert.equal(report.oauth_exchange_executed, false);
  assert.equal(report.file_runtime_write_executed, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7DM-DASHBOARD-RUNTIME-WIRING-REVIEW-2: revocation keeps wiring artifacts disabled", () => {
  const { model, html } = modelAndHtml();
  const result = createVideoOrchestratorDashboardRuntimeWiringResult(INPUT, model, html);
  const review = createVideoOrchestratorDashboardRuntimeWiringReview(result);
  const report = createVideoOrchestratorDashboardRuntimeWiringSafeReport(review, result);

  assert.equal(revokeVideoOrchestratorDashboardRuntimeWiringResult(result).wiring_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRuntimeWiringReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorDashboardRuntimeWiringSafeReport(report).safe_report_state, "revoked");
});
