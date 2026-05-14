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
import { runYouTubeLivePreflight, createYouTubeLivePreflightReview, createYouTubeLivePreflightSafeReport, createYouTubeFirstControlledUploadBoundary, type YouTubeLivePreflightAdapters, type YouTubeLivePreflightInput } from "./video-orchestrator-youtube-live-preflight.js";
import { runYouTubeFirstControlledUpload, createYouTubeFirstControlledUploadReview, createYouTubeFirstControlledUploadSafeReport, type YouTubeFirstControlledUploadAdapters, type YouTubeFirstControlledUploadInput } from "./video-orchestrator-youtube-first-controlled-upload.js";
import {
  createYouTubeRepeatabilityAutomationPlan,
  createYouTubeRepeatabilityAutomationPlanReview,
  createYouTubeRepeatabilityAutomationSafeReport,
  revokeYouTubeRepeatabilityAutomationPlan,
  revokeYouTubeRepeatabilityAutomationPlanReview,
  revokeYouTubeRepeatabilityAutomationSafeReport,
} from "./video-orchestrator-youtube-repeatability-automation-plan.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const PREFLIGHT_INPUT: YouTubeLivePreflightInput = {
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

const UPLOAD_INPUT: YouTubeFirstControlledUploadInput = {
  request_id: "youtube-first-upload-request-001",
  project_id: "says-the-bible",
  platform_account_id: "says-the-bible-youtube-account-1",
  render_plan_id: "render-plan-001",
  media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4",
  title: "Safe scheduled upload title",
  description: "Safe scheduled upload description",
  tags: ["safe", "test"],
  scheduled_publish_at: "2026-05-15T09:00:00.000Z",
  expected_channel_id: "UC-safe-channel",
  idempotency_key: "says-the-bible-youtube-render-plan-001",
  operator_approval_id: "operator-approval-first-upload-001",
  allow_media_read: true,
  allow_youtube_videos_insert: true,
  one_project_only: true,
  one_platform_account_only: true,
  one_render_artifact_only: true,
  one_upload_attempt_only: true,
  scheduled_first_private_fallback: true,
  bulk_uploads_enabled: false,
  deletes_enabled: false,
  unrelated_metadata_changes_enabled: false,
};

function livePreflightAdapters(): YouTubeLivePreflightAdapters {
  return {
    accountProbe: { checkAccountReference: () => ({ account_reference_found: true, token_reference_found: true, token_status: "valid", safe_account_summary: "Account reference is connected." }) },
    mediaProbe: { statMediaReference: () => ({ media_reference_found: true, byte_size: 1024, mime_type: "video/mp4", safe_media_summary: "Media reference stat passed." }) },
    youtubeProbe: { checkChannelIdentity: () => ({ channel_found: true, channel_id_matches_expected: true, safe_channel_summary: "YouTube channel identity matched." }) },
    summaryStore: { storeSafeSummary: () => ({ stored: true, storage_reference: "safe-summary://youtube-live-preflight/001", safe_storage_summary: "Safe summary stored." }) },
  };
}

function uploadAdapters(): YouTubeFirstControlledUploadAdapters {
  return {
    readMediaPayload: () => ({ media_reference_path: UPLOAD_INPUT.media_reference_path, byte_size: 2048, content_type: "video/mp4", media_read_performed: true, safe_summary: "Approved media artifact read for single upload." }),
    videosInsert: (request) => ({ attempted: true, uploaded: true, video_id: "yt-safe-video-001", scheduled_publish_at: request.metadata.publish_at, privacy_status: "private", safe_summary: "Single videos.insert upload attempt completed.", raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false }),
    storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-first-upload/001", safe_summary: "First upload safe summary stored.", raw_payload_stored: false, raw_response_stored: false }),
  };
}

async function readyFirstUploadPair() {
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
  const liveBoundary = createYouTubeLivePreflightBoundary(preflightSafeReport, contracts);
  const liveBoundaryReview = createYouTubeLivePreflightBoundaryReview(liveBoundary);
  const livePlan = createYouTubeLivePreflightImplementationPlan(liveBoundary, liveBoundaryReview);
  const livePlanReview = createYouTubeLivePreflightImplementationPlanReview(livePlan);
  const livePlanSafeReport = createYouTubeLivePreflightImplementationPlanSafeReport(livePlanReview, livePlan);
  const liveResult = await runYouTubeLivePreflight(livePlanSafeReport, livePlan, PREFLIGHT_INPUT, livePreflightAdapters());
  const liveReview = createYouTubeLivePreflightReview(liveResult);
  const liveReport = createYouTubeLivePreflightSafeReport(liveReview, liveResult);
  const firstBoundary = createYouTubeFirstControlledUploadBoundary(liveReport);
  const firstUploadResult = await runYouTubeFirstControlledUpload(firstBoundary, UPLOAD_INPUT, uploadAdapters());
  const firstUploadReview = createYouTubeFirstControlledUploadReview(firstUploadResult);
  const firstUploadReport = createYouTubeFirstControlledUploadSafeReport(firstUploadReview, firstUploadResult);
  return { firstUploadResult, firstUploadReport };
}

test("VO-7CJ-REPEATABILITY-PLAN-1: creates repeatability/automation planning only", async () => {
  const { firstUploadResult, firstUploadReport } = await readyFirstUploadPair();
  const plan = createYouTubeRepeatabilityAutomationPlan(firstUploadReport, firstUploadResult, { id: "youtube-repeatability-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.plan_state, "approved_for_repeatability_design_review");
  assert.equal(plan.planning_only, true);
  assert.equal(plan.first_upload_reviewed, true);
  assert.equal(plan.repeatability_implementation_enabled_now, false);
  assert.equal(plan.automation_enabled_now, false);
  assert.equal(plan.repeat_upload_execution_enabled_now, false);
  assert.equal(plan.bulk_uploads_enabled_now, false);
  assert.equal(plan.deletes_enabled_now, false);
  assert.equal(plan.unrelated_metadata_changes_enabled_now, false);
  assert.equal(plan.upload_execution_enabled_now, false);
  assert.equal(plan.package_metadata_changed_now, false);
  assert.equal(plan.dependency_changes_now, false);
  assert.equal(plan.plan_items.length, 11);
  assert.equal(plan.plan_items.every((item) => item.planned_now && !item.implemented_now && !item.repeat_upload_executed_now && !item.bulk_upload_enabled_now && !item.delete_enabled_now && !item.unrelated_metadata_change_enabled_now && !item.upload_execution_enabled_now && item.requires_future_confirmation), true);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7CJ-REPEATABILITY-PLAN-2: blocked first upload report blocks planning", async () => {
  const { firstUploadResult, firstUploadReport } = await readyFirstUploadPair();
  const blockedReport = { ...firstUploadReport, safe_report_state: "blocked" as const, validation: { ...firstUploadReport.validation, complete: false } };
  const plan = createYouTubeRepeatabilityAutomationPlan(blockedReport, firstUploadResult);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.validation.ready_for_next_phase, false);
  assertDisabledBoundary(plan.execution_boundary);
});

test("VO-7CK-REPEATABILITY-REVIEW-1: review and safe report require confirmation before implementation", async () => {
  const { firstUploadResult, firstUploadReport } = await readyFirstUploadPair();
  const plan = createYouTubeRepeatabilityAutomationPlan(firstUploadReport, firstUploadResult);
  const review = createYouTubeRepeatabilityAutomationPlanReview(plan, { id: "youtube-repeatability-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeRepeatabilityAutomationSafeReport(review, plan, { id: "youtube-repeatability-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.repeatability_implementation_enabled_now, false);
  assert.equal(review.automation_enabled_now, false);
  assert.equal(review.repeat_upload_execution_enabled_now, false);
  assert.equal(review.bulk_uploads_enabled_now, false);
  assert.equal(review.deletes_enabled_now, false);
  assert.equal(review.unrelated_metadata_changes_enabled_now, false);
  assert.equal(review.upload_execution_enabled_now, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_repeatability_implementation");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.repeatability_implementation_enabled_now, false);
  assert.equal(report.automation_enabled_now, false);
  assert.equal(report.repeat_upload_execution_enabled_now, false);
  assert.equal(report.bulk_uploads_enabled_now, false);
  assert.equal(report.deletes_enabled_now, false);
  assert.equal(report.unrelated_metadata_changes_enabled_now, false);
  assert.equal(report.upload_execution_enabled_now, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CK-REPEATABILITY-REVIEW-2: revocation keeps repeatability planning artifacts disabled", async () => {
  const { firstUploadResult, firstUploadReport } = await readyFirstUploadPair();
  const plan = createYouTubeRepeatabilityAutomationPlan(firstUploadReport, firstUploadResult);
  const review = createYouTubeRepeatabilityAutomationPlanReview(plan);
  const report = createYouTubeRepeatabilityAutomationSafeReport(review, plan);

  assert.equal(revokeYouTubeRepeatabilityAutomationPlan(plan).plan_state, "revoked");
  assert.equal(revokeYouTubeRepeatabilityAutomationPlanReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeRepeatabilityAutomationSafeReport(report).safe_report_state, "revoked");
});
