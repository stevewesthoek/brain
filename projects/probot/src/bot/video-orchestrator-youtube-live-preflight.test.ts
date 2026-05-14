import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import { createYouTubePlatformPolicyDesign, createYouTubePlatformPolicyReview, createYouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";
import { createAccountUiFlowDesign, createAccountUiFlowReview, createAccountUiFlowSafeReport } from "./video-orchestrator-account-ui-flow-design.js";
import { createYouTubePreflightContracts, createYouTubePreflightContractReview, createYouTubePreflightContractSafeReport } from "./video-orchestrator-youtube-preflight-contracts.js";
import { createYouTubeLivePreflightBoundary, createYouTubeLivePreflightBoundaryReview } from "./video-orchestrator-youtube-live-preflight-boundary.js";
import { createYouTubeLivePreflightImplementationPlan, createYouTubeLivePreflightImplementationPlanReview, createYouTubeLivePreflightImplementationPlanSafeReport } from "./video-orchestrator-youtube-live-preflight-plan.js";
import {
  runYouTubeLivePreflight,
  createYouTubeLivePreflightReview,
  createYouTubeLivePreflightSafeReport,
  createYouTubeFirstControlledUploadBoundary,
  revokeYouTubeLivePreflightResult,
  revokeYouTubeLivePreflightReview,
  revokeYouTubeLivePreflightSafeReport,
  revokeYouTubeFirstControlledUploadBoundary,
  type YouTubeLivePreflightAdapters,
  type YouTubeLivePreflightInput,
} from "./video-orchestrator-youtube-live-preflight.js";

function assertBoundaryForLivePreflight(boundary: DisabledEnablementBoundary) {
  assert.equal(boundary.ready_for_real_upload, false);
  assert.equal(boundary.real_upload_enabled, false);
  assert.equal(boundary.runtime_enabled, false);
  assert.equal(boundary.runtime_executed, false);
  assert.equal(boundary.upload_allowed, false);
  assert.equal(boundary.upload_execution_enabled, false);
  assert.equal(boundary.media_file_read, false);
  assert.equal(boundary.file_mutation_allowed, false);
  assert.equal(boundary.dependencies_added, false);
  assert.equal(boundary.package_metadata_changed, false);
}
function readyPlanPair() {
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
  const plan = createYouTubeLivePreflightImplementationPlan(boundary, boundaryReview);
  const planReview = createYouTubeLivePreflightImplementationPlanReview(plan);
  const planSafeReport = createYouTubeLivePreflightImplementationPlanSafeReport(planReview, plan);
  return { plan, planSafeReport };
}
const INPUT: YouTubeLivePreflightInput = {
  request_id: "youtube-live-preflight-request-001",
  project_id: "says-the-bible",
  render_plan_id: "render-plan-001",
  platform_account_id: "says-the-bible-youtube-account-1",
  account_reference_label: "youtube account ref",
  token_reference_label: "youtube token ref",
  media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4",
  expected_youtube_channel_id: "UC-safe-channel",
  allow_live_preflight: true,
  allow_youtube_network_call: true,
  allow_media_stat: true,
  allow_safe_summary_storage: true,
  upload_execution_enabled: false,
};
function adapters(): YouTubeLivePreflightAdapters {
  return {
    accountProbe: { checkAccountReference: () => ({ account_reference_found: true, token_reference_found: true, token_status: "valid", safe_account_summary: "Account reference is connected." }) },
    mediaProbe: { statMediaReference: () => ({ media_reference_found: true, byte_size: 1024, mime_type: "video/mp4", safe_media_summary: "Media reference stat passed." }) },
    youtubeProbe: { checkChannelIdentity: () => ({ channel_found: true, channel_id_matches_expected: true, safe_channel_summary: "YouTube channel identity matched." }) },
    summaryStore: { storeSafeSummary: () => ({ stored: true, storage_reference: "safe-summary://youtube-live-preflight/001", safe_storage_summary: "Safe summary stored." }) },
  };
}

test("VO-7CF-LIVE-PREFLIGHT-1: live preflight uses injected adapters and never executes upload", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const result = await runYouTubeLivePreflight(planSafeReport, plan, INPUT, adapters(), { id: "youtube-live-preflight-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.preflight_state, "completed");
  assert.equal(result.live_preflight_executed, true);
  assert.equal(result.account_reference_checked, true);
  assert.equal(result.token_status_checked, true);
  assert.equal(result.media_stat_performed, true);
  assert.equal(result.youtube_channel_identity_checked, true);
  assert.equal(result.youtube_network_called, true);
  assert.equal(result.safe_summary_stored, true);
  assert.equal(result.upload_execution_enabled, false);
  assert.equal(result.upload_executed, false);
  assert.equal(result.real_upload_enabled, false);
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
  assert.equal(result.secret_material_exposed, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_next_phase, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assert.equal(result.checks.every((check) => check.check_state === "passed" && !check.secret_material_exposed && !check.raw_payload_stored && !check.raw_response_stored && !check.upload_executed), true);
  assertBoundaryForLivePreflight(result.execution_boundary);
});

test("VO-7CF-LIVE-PREFLIGHT-2: blocked input prevents adapter preflight", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const blocked = await runYouTubeLivePreflight(planSafeReport, plan, { ...INPUT, allow_youtube_network_call: false as true }, adapters());

  assert.equal(blocked.preflight_state, "blocked");
  assert.equal(blocked.live_preflight_executed, false);
  assert.equal(blocked.youtube_network_called, false);
  assert.equal(blocked.upload_executed, false);
  assert.equal(blocked.validation.complete, false);
  assert.equal(blocked.checks.every((check) => check.check_state === "blocked"), true);
  assertBoundaryForLivePreflight(blocked.execution_boundary);
});

test("VO-7CF-LIVE-PREFLIGHT-3: unsafe adapter output is sanitized", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const unsafeAdapters: YouTubeLivePreflightAdapters = {
    accountProbe: { checkAccountReference: () => ({ account_reference_found: true, token_reference_found: true, token_status: "valid", safe_account_summary: unsafe }) },
    mediaProbe: { statMediaReference: () => ({ media_reference_found: true, byte_size: 1024, mime_type: unsafe, safe_media_summary: unsafe }) },
    youtubeProbe: { checkChannelIdentity: () => ({ channel_found: true, channel_id_matches_expected: true, safe_channel_summary: unsafe }) },
    summaryStore: { storeSafeSummary: () => ({ stored: true, storage_reference: unsafe, safe_storage_summary: unsafe }) },
  };
  const result = await runYouTubeLivePreflight(planSafeReport, plan, { ...INPUT, request_id: unsafe, project_id: unsafe, render_plan_id: unsafe, platform_account_id: unsafe }, unsafeAdapters);
  const serialized = JSON.stringify(result);

  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) {
    assert.equal(serialized.includes(blocked), false);
  }
  assert.equal(result.upload_executed, false);
});

test("VO-7CF-LIVE-PREFLIGHT-4: revocation disables live preflight result", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const result = await runYouTubeLivePreflight(planSafeReport, plan, INPUT, adapters());
  const revoked = revokeYouTubeLivePreflightResult(result, "Operator revoked live preflight result.");

  assert.equal(revoked.preflight_state, "revoked");
  assert.equal(revoked.upload_execution_enabled, false);
  assert.equal(revoked.upload_executed, false);
  assert.equal(revoked.real_upload_enabled, false);
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.ready_for_next_phase, false);
  assertBoundaryForLivePreflight(revoked.execution_boundary);
});


test("VO-7CG-LIVE-PREFLIGHT-REVIEW-1: review safe report and first upload boundary require confirmation", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const result = await runYouTubeLivePreflight(planSafeReport, plan, INPUT, adapters());
  const review = createYouTubeLivePreflightReview(result, { id: "youtube-live-preflight-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeLivePreflightSafeReport(review, result, { id: "youtube-live-preflight-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  const boundary = createYouTubeFirstControlledUploadBoundary(report, { id: "youtube-first-controlled-upload-boundary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.upload_execution_enabled, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.ready_for_real_upload, false);
  assertBoundaryForLivePreflight(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_first_upload_boundary");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.live_preflight_executed, true);
  assert.equal(report.upload_execution_enabled, false);
  assert.equal(report.upload_executed, false);
  assert.equal(report.real_upload_enabled, false);
  assert.equal(report.ready_for_real_upload, false);
  assertBoundaryForLivePreflight(report.execution_boundary);

  assert.equal(boundary.boundary_state, "requires_operator_confirmation");
  assert.equal(boundary.boundary_only, true);
  assert.equal(boundary.explicit_operator_confirmation_required, true);
  assert.equal(boundary.single_upload_attempt_only, true);
  assert.equal(boundary.scheduled_first_private_fallback, true);
  assert.equal(boundary.validation.ready_for_next_phase, false);
  assert.equal(boundary.upload_execution_enabled_now, false);
  assert.equal(boundary.upload_executed_now, false);
  assert.equal(boundary.real_upload_enabled_now, false);
  assertBoundaryForLivePreflight(boundary.execution_boundary);
});

test("VO-7CG-LIVE-PREFLIGHT-REVIEW-2: revocation keeps review safe report and boundary disabled", async () => {
  const { plan, planSafeReport } = readyPlanPair();
  const result = await runYouTubeLivePreflight(planSafeReport, plan, INPUT, adapters());
  const review = createYouTubeLivePreflightReview(result);
  const report = createYouTubeLivePreflightSafeReport(review, result);
  const boundary = createYouTubeFirstControlledUploadBoundary(report);

  assert.equal(revokeYouTubeLivePreflightReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeLivePreflightSafeReport(report).safe_report_state, "revoked");
  assert.equal(revokeYouTubeFirstControlledUploadBoundary(boundary).boundary_state, "revoked");
});