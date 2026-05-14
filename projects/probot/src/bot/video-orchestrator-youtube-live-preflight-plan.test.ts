import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import { createYouTubePlatformPolicyDesign, createYouTubePlatformPolicyReview, createYouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";
import { createAccountUiFlowDesign, createAccountUiFlowReview, createAccountUiFlowSafeReport } from "./video-orchestrator-account-ui-flow-design.js";
import { createYouTubePreflightContracts, createYouTubePreflightContractReview, createYouTubePreflightContractSafeReport } from "./video-orchestrator-youtube-preflight-contracts.js";
import { createYouTubeLivePreflightBoundary, createYouTubeLivePreflightBoundaryReview } from "./video-orchestrator-youtube-live-preflight-boundary.js";
import {
  createYouTubeLivePreflightImplementationPlan,
  createYouTubeLivePreflightImplementationPlanReview,
  createYouTubeLivePreflightImplementationPlanSafeReport,
  revokeYouTubeLivePreflightImplementationPlan,
  revokeYouTubeLivePreflightImplementationPlanReview,
  revokeYouTubeLivePreflightImplementationPlanSafeReport,
} from "./video-orchestrator-youtube-live-preflight-plan.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }
function readyBoundaryPair() {
  const accountDesign = createVideoOrchestratorAccountModelDesign();
  const accountReview = createVideoOrchestratorAccountModelReview(accountDesign);
  const accountSafeReport = createVideoOrchestratorAccountModelSafeReport(accountReview, accountDesign);
  const mapping = createSaysTheBibleMigrationBridgeDesign(accountSafeReport, accountDesign);
  const mappingReview = createSaysTheBibleMigrationBridgeReview(mapping);
  const mappingSafeReport = createSaysTheBibleMigrationBridgeSafeReport(mappingReview, mapping);
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping);
  const policyReview = createYouTubePlatformPolicyReview(policy);
  const policySafeReport = createYouTubePlatformPolicySafeReport(policyReview, policy);
  const uiDesign = createAccountUiFlowDesign(policySafeReport, policy);
  const uiReview = createAccountUiFlowReview(uiDesign);
  const uiSafeReport = createAccountUiFlowSafeReport(uiReview, uiDesign);
  const contracts = createYouTubePreflightContracts(uiSafeReport, uiDesign);
  const preflightReview = createYouTubePreflightContractReview(contracts);
  const preflightSafeReport = createYouTubePreflightContractSafeReport(preflightReview, contracts);
  const boundary = createYouTubeLivePreflightBoundary(preflightSafeReport, contracts);
  const boundaryReview = createYouTubeLivePreflightBoundaryReview(boundary);
  return { boundary, boundaryReview };
}

test("VO-7CE-LIVE-PREFLIGHT-PLAN-1: creates planning-only live preflight implementation plan", () => {
  const { boundary, boundaryReview } = readyBoundaryPair();
  const plan = createYouTubeLivePreflightImplementationPlan(boundary, boundaryReview, { id: "youtube-live-preflight-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "approved_for_future_live_preflight_implementation");
  assert.equal(plan.planning_only, true);
  assert.equal(plan.explicit_operator_confirmation_required_for_implementation, true);
  assert.equal(plan.exact_files_planned_now, true);
  assert.equal(plan.live_preflight_implemented_now, false);
  assert.equal(plan.live_preflight_executed_now, false);
  assert.equal(plan.secret_access_enabled_now, false);
  assert.equal(plan.token_access_enabled_now, false);
  assert.equal(plan.env_access_enabled_now, false);
  assert.equal(plan.keychain_access_enabled_now, false);
  assert.equal(plan.media_stat_enabled_now, false);
  assert.equal(plan.media_read_enabled_now, false);
  assert.equal(plan.network_calls_enabled_now, false);
  assert.equal(plan.platform_api_calls_enabled_now, false);
  assert.equal(plan.upload_execution_enabled_now, false);
  assert.equal(plan.package_metadata_changed_now, false);
  assert.equal(plan.dependency_changes_now, false);
  assert.equal(plan.plan_items.length, 12);
  assert.equal(plan.plan_items.some((item) => item.future_target_path === "projects/probot/src/bot/video-orchestrator-youtube-live-preflight.ts"), true);
  assert.equal(plan.plan_items.every((item) => item.designed_now && !item.implemented_now && !item.live_preflight_executed_now && !item.secret_accessed_now && !item.token_accessed_now && !item.env_accessed_now && !item.keychain_accessed_now && !item.media_stat_performed_now && !item.media_read_performed_now && !item.network_called_now && !item.platform_api_called_now && !item.upload_executed_now && !item.raw_payload_stored_now && !item.raw_response_stored_now && item.requires_future_confirmation), true);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7CE-LIVE-PREFLIGHT-PLAN-2: blocked boundary blocks plan", () => {
  const { boundary, boundaryReview } = readyBoundaryPair();
  const blockedBoundary = { ...boundary, boundary_state: "blocked" as const, validation: { ...boundary.validation, complete: false } };
  const plan = createYouTubeLivePreflightImplementationPlan(blockedBoundary, boundaryReview);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.validation.ready_for_next_phase, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7CE-LIVE-PREFLIGHT-PLAN-3: review and safe report require future implementation confirmation", () => {
  const { boundary, boundaryReview } = readyBoundaryPair();
  const plan = createYouTubeLivePreflightImplementationPlan(boundary, boundaryReview);
  const review = createYouTubeLivePreflightImplementationPlanReview(plan, { id: "youtube-live-preflight-plan-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeLivePreflightImplementationPlanSafeReport(review, plan, { id: "youtube-live-preflight-plan-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.reviewed_item_ids.length, 12);
  assert.equal(review.live_preflight_implemented_now, false);
  assert.equal(review.live_preflight_executed_now, false);
  assert.equal(review.secret_access_enabled_now, false);
  assert.equal(review.media_stat_enabled_now, false);
  assert.equal(review.media_read_enabled_now, false);
  assert.equal(review.network_calls_enabled_now, false);
  assert.equal(review.platform_api_calls_enabled_now, false);
  assert.equal(review.upload_execution_enabled_now, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_live_preflight_implementation");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.explicit_operator_confirmation_required_for_implementation, true);
  assert.equal(report.live_preflight_implemented_now, false);
  assert.equal(report.live_preflight_executed_now, false);
  assert.equal(report.secret_access_enabled_now, false);
  assert.equal(report.token_access_enabled_now, false);
  assert.equal(report.env_access_enabled_now, false);
  assert.equal(report.keychain_access_enabled_now, false);
  assert.equal(report.media_stat_enabled_now, false);
  assert.equal(report.media_read_enabled_now, false);
  assert.equal(report.network_calls_enabled_now, false);
  assert.equal(report.platform_api_calls_enabled_now, false);
  assert.equal(report.upload_execution_enabled_now, false);
  assert.equal(report.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CE-LIVE-PREFLIGHT-PLAN-4: revocation keeps planning artifacts disabled", () => {
  const { boundary, boundaryReview } = readyBoundaryPair();
  const plan = createYouTubeLivePreflightImplementationPlan(boundary, boundaryReview);
  const review = createYouTubeLivePreflightImplementationPlanReview(plan);
  const report = createYouTubeLivePreflightImplementationPlanSafeReport(review, plan);

  assert.equal(revokeYouTubeLivePreflightImplementationPlan(plan).plan_state, "revoked");
  assert.equal(revokeYouTubeLivePreflightImplementationPlanReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeLivePreflightImplementationPlanSafeReport(report).safe_report_state, "revoked");
});
