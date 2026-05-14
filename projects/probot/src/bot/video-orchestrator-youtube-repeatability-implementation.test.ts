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
import { createYouTubeRepeatabilityAutomationPlan, createYouTubeRepeatabilityAutomationPlanReview, createYouTubeRepeatabilityAutomationSafeReport } from "./video-orchestrator-youtube-repeatability-automation-plan.js";
import {
  runYouTubeRepeatabilityImplementation,
  createYouTubeRepeatabilityImplementationReview,
  createYouTubeRepeatabilityImplementationSafeReport,
  revokeYouTubeRepeatabilityImplementationResult,
  revokeYouTubeRepeatabilityImplementationReview,
  revokeYouTubeRepeatabilityImplementationSafeReport,
  type YouTubeRepeatabilityAttemptInput,
  type YouTubeRepeatabilityCheckAdapters,
} from "./video-orchestrator-youtube-repeatability-implementation.js";

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

const REPEAT_INPUT: YouTubeRepeatabilityAttemptInput = {
  request_id: "youtube-repeatability-request-001",
  project_id: "says-the-bible",
  platform_account_id: "says-the-bible-youtube-account-1",
  render_plan_id: "render-plan-002",
  idempotency_key: "says-the-bible-youtube-render-plan-002",
  prior_first_upload_result_id: "youtube-first-upload-request-001",
  scheduled_window_id: "yt-window-001",
  operator_approval_id: "operator-repeatability-001",
  allow_repeatability_check: true,
  allow_repeat_upload_execution: false,
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

function repeatabilityAdapters(overrides: Partial<YouTubeRepeatabilityCheckAdapters> = {}): YouTubeRepeatabilityCheckAdapters {
  return {
    checkIdempotency: () => ({ idempotency_key: REPEAT_INPUT.idempotency_key, duplicate_found: false, safe_summary: "No duplicate idempotency key found." }),
    checkScheduleWindow: () => ({ scheduled_window_id: REPEAT_INPUT.scheduled_window_id, window_open: true, safe_summary: "Schedule window is open." }),
    checkQuotaResume: () => ({ quota_available: true, retry_after: null, safe_summary: "Quota is available." }),
    storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-repeatability/001", safe_summary: "Repeatability safe summary stored.", raw_payload_stored: false, raw_response_stored: false }),
    ...overrides,
  };
}

async function readyRepeatabilitySafeReport() {
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
  const repeatPlan = createYouTubeRepeatabilityAutomationPlan(firstUploadReport, firstUploadResult);
  const repeatReview = createYouTubeRepeatabilityAutomationPlanReview(repeatPlan);
  return createYouTubeRepeatabilityAutomationSafeReport(repeatReview, repeatPlan);
}

test("VO-7CL-REPEATABILITY-IMPLEMENTATION-1: checks repeatability readiness without executing uploads", async () => {
  const report = await readyRepeatabilitySafeReport();
  const result = await runYouTubeRepeatabilityImplementation(report, REPEAT_INPUT, repeatabilityAdapters(), { id: "youtube-repeatability-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.repeatability_state, "ready_for_repeat_attempt_review");
  assert.equal(result.repeatability_check_executed, true);
  assert.equal(result.repeat_upload_execution_enabled, false);
  assert.equal(result.repeat_upload_executed, false);
  assert.equal(result.automation_enabled, false);
  assert.equal(result.bulk_uploads_enabled, false);
  assert.equal(result.bulk_uploads_executed, false);
  assert.equal(result.deletes_enabled, false);
  assert.equal(result.deletes_executed, false);
  assert.equal(result.unrelated_metadata_changes_enabled, false);
  assert.equal(result.unrelated_metadata_changed, false);
  assert.equal(result.duplicate_found, false);
  assert.equal(result.schedule_window_open, true);
  assert.equal(result.quota_available, true);
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
  assert.equal(result.safe_store_result?.stored, true);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_automation_expansion_review, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CL-REPEATABILITY-IMPLEMENTATION-2: duplicate idempotency blocks readiness", async () => {
  const report = await readyRepeatabilitySafeReport();
  const result = await runYouTubeRepeatabilityImplementation(report, REPEAT_INPUT, repeatabilityAdapters({ checkIdempotency: () => ({ idempotency_key: REPEAT_INPUT.idempotency_key, duplicate_found: true, safe_summary: "Duplicate found." }) }));

  assert.equal(result.repeatability_state, "blocked");
  assert.equal(result.duplicate_found, true);
  assert.equal(result.repeat_upload_executed, false);
  assert.equal(result.validation.complete, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CL-REPEATABILITY-IMPLEMENTATION-3: safety input violations block before adapters", async () => {
  const report = await readyRepeatabilitySafeReport();
  let called = false;
  const result = await runYouTubeRepeatabilityImplementation(report, { ...REPEAT_INPUT, allow_repeat_upload_execution: true as false }, repeatabilityAdapters({ checkIdempotency: () => { called = true; return { idempotency_key: REPEAT_INPUT.idempotency_key, duplicate_found: false, safe_summary: "should not run" }; } }));

  assert.equal(called, false);
  assert.equal(result.repeatability_state, "blocked");
  assert.equal(result.repeatability_check_executed, false);
  assert.equal(result.repeat_upload_executed, false);
  assert.equal(result.validation.complete, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CM-REPEATABILITY-REVIEW-1: review and safe report require confirmation before automation expansion", async () => {
  const report = await readyRepeatabilitySafeReport();
  const result = await runYouTubeRepeatabilityImplementation(report, REPEAT_INPUT, repeatabilityAdapters());
  const review = createYouTubeRepeatabilityImplementationReview(result, { id: "youtube-repeatability-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const safeReport = createYouTubeRepeatabilityImplementationSafeReport(review, result, { id: "youtube-repeatability-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.repeatability_check_executed, true);
  assert.equal(review.repeat_upload_executed, false);
  assert.equal(review.automation_enabled, false);
  assert.equal(review.bulk_uploads_executed, false);
  assert.equal(review.deletes_executed, false);
  assert.equal(review.unrelated_metadata_changed, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(safeReport.safe_report_state, "requires_operator_confirmation_for_automation_expansion");
  assert.equal(safeReport.safe_report_only, true);
  assert.equal(safeReport.repeatability_check_executed, true);
  assert.equal(safeReport.repeat_upload_executed, false);
  assert.equal(safeReport.automation_enabled, false);
  assert.equal(safeReport.bulk_uploads_executed, false);
  assert.equal(safeReport.deletes_executed, false);
  assert.equal(safeReport.unrelated_metadata_changed, false);
  assert.equal(safeReport.ready_for_real_upload, false);
  assert.equal(safeReport.validation.ready_for_next_phase, false);
  assertDisabledBoundary(safeReport.execution_boundary);
});

test("VO-7CM-REPEATABILITY-REVIEW-2: revocation keeps repeatability implementation artifacts disabled", async () => {
  const report = await readyRepeatabilitySafeReport();
  const result = await runYouTubeRepeatabilityImplementation(report, REPEAT_INPUT, repeatabilityAdapters());
  const review = createYouTubeRepeatabilityImplementationReview(result);
  const safeReport = createYouTubeRepeatabilityImplementationSafeReport(review, result);

  assert.equal(revokeYouTubeRepeatabilityImplementationResult(result).repeatability_state, "revoked");
  assert.equal(revokeYouTubeRepeatabilityImplementationReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeRepeatabilityImplementationSafeReport(safeReport).safe_report_state, "revoked");
});
