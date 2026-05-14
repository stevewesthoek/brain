import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import { createYouTubePlatformPolicyDesign, createYouTubePlatformPolicyReview, createYouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";
import {
  createAccountUiFlowDesign,
  createAccountUiFlowReview,
  createAccountUiFlowSafeReport,
  revokeAccountUiFlowDesign,
  revokeAccountUiFlowReview,
  revokeAccountUiFlowSafeReport,
} from "./video-orchestrator-account-ui-flow-design.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }
function readyPolicyPair() {
  const accountDesign = createVideoOrchestratorAccountModelDesign();
  const accountReview = createVideoOrchestratorAccountModelReview(accountDesign);
  const accountSafeReport = createVideoOrchestratorAccountModelSafeReport(accountReview, accountDesign);
  const mapping = createSaysTheBibleMigrationBridgeDesign(accountSafeReport, accountDesign);
  const mappingReview = createSaysTheBibleMigrationBridgeReview(mapping);
  const mappingSafeReport = createSaysTheBibleMigrationBridgeSafeReport(mappingReview, mapping);
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping);
  const policyReview = createYouTubePlatformPolicyReview(policy);
  const policySafeReport = createYouTubePlatformPolicySafeReport(policyReview, policy);
  return { policy, policySafeReport };
}

test("VO-7CA-ACCOUNT-UI-1: account UI flow design is design-only", () => {
  const { policy, policySafeReport } = readyPolicyPair();
  const design = createAccountUiFlowDesign(policySafeReport, policy, { id: "account-ui-flow-design-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(design.design_state, "approved_for_youtube_preflight_contracts");
  assert.equal(design.design_only, true);
  assert.equal(design.dashboard_ui_design_only, true);
  assert.equal(design.target_platform, "youtube");
  assert.equal(design.oauth_preferred, true);
  assert.equal(design.manual_api_setup_deep_link_allowed, true);
  assert.equal(design.routes_added_now, false);
  assert.equal(design.components_added_now, false);
  assert.equal(design.oauth_callbacks_added_now, false);
  assert.equal(design.token_exchange_enabled_now, false);
  assert.equal(design.secret_storage_enabled_now, false);
  assert.equal(design.env_writes_enabled_now, false);
  assert.equal(design.network_calls_enabled_now, false);
  assert.equal(design.platform_api_calls_enabled_now, false);
  assert.equal(design.secret_access_enabled_now, false);
  assert.equal(design.media_reads_enabled_now, false);
  assert.equal(design.upload_execution_enabled_now, false);
  assert.equal(design.ui_sections.length, 7);
  assert.equal(design.connection_states.length, 8);
  assert.equal(design.ui_sections.every((section) => !section.implemented_now && !section.route_added_now && !section.component_added_now && !section.secret_displayed_now && !section.token_exchange_enabled_now && !section.env_write_enabled_now), true);
  assert.equal(design.connection_states.every((state) => !state.exposes_secret && !state.starts_oauth_now && !state.reads_token_now && !state.writes_token_now && !state.env_write_enabled_now), true);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7CA-ACCOUNT-UI-2: blocked policy blocks account UI design", () => {
  const { policy, policySafeReport } = readyPolicyPair();
  const blockedReport = { ...policySafeReport, safe_report_state: "blocked" as const, validation: { ...policySafeReport.validation, complete: false, ready_for_next_phase: false } };
  const design = createAccountUiFlowDesign(blockedReport, policy);
  assert.equal(design.design_state, "blocked");
  assert.equal(design.validation.complete, false);
  assert.equal(design.validation.ready_for_next_phase, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7CA-ACCOUNT-UI-3: review and safe report remain inert", () => {
  const { policy, policySafeReport } = readyPolicyPair();
  const design = createAccountUiFlowDesign(policySafeReport, policy);
  const review = createAccountUiFlowReview(design, { id: "account-ui-flow-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createAccountUiFlowSafeReport(review, design, { id: "account-ui-flow-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.routes_added_now, false);
  assert.equal(review.components_added_now, false);
  assert.equal(review.oauth_callbacks_added_now, false);
  assert.equal(review.token_exchange_enabled_now, false);
  assert.equal(review.secret_storage_enabled_now, false);
  assert.equal(review.upload_execution_enabled_now, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_youtube_preflight_contracts");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.routes_added_now, false);
  assert.equal(report.components_added_now, false);
  assert.equal(report.oauth_callbacks_added_now, false);
  assert.equal(report.token_exchange_enabled_now, false);
  assert.equal(report.secret_storage_enabled_now, false);
  assert.equal(report.env_writes_enabled_now, false);
  assert.equal(report.network_calls_enabled_now, false);
  assert.equal(report.platform_api_calls_enabled_now, false);
  assert.equal(report.secret_access_enabled_now, false);
  assert.equal(report.media_reads_enabled_now, false);
  assert.equal(report.upload_execution_enabled_now, false);
  assert.equal(report.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CA-ACCOUNT-UI-4: revocation keeps UI flow artifacts disabled", () => {
  const { policy, policySafeReport } = readyPolicyPair();
  const design = createAccountUiFlowDesign(policySafeReport, policy);
  const review = createAccountUiFlowReview(design);
  const report = createAccountUiFlowSafeReport(review, design);

  assert.equal(revokeAccountUiFlowDesign(design).design_state, "revoked");
  assert.equal(revokeAccountUiFlowReview(review).review_state, "revoked");
  assert.equal(revokeAccountUiFlowSafeReport(report).safe_report_state, "revoked");
});
