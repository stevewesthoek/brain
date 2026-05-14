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
import {
  runYouTubeFirstControlledUpload,
  createYouTubeFirstControlledUploadReview,
  createYouTubeFirstControlledUploadSafeReport,
  revokeYouTubeFirstControlledUploadResult,
  revokeYouTubeFirstControlledUploadReview,
  revokeYouTubeFirstControlledUploadSafeReport,
  type YouTubeFirstControlledUploadAdapters,
  type YouTubeFirstControlledUploadInput,
} from "./video-orchestrator-youtube-first-controlled-upload.js";

function assertUploadBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

function assertBlockedBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

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

async function readyBoundary() {
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
  const plan = createYouTubeLivePreflightImplementationPlan(liveBoundary, liveBoundaryReview);
  const planReview = createYouTubeLivePreflightImplementationPlanReview(plan);
  const planSafeReport = createYouTubeLivePreflightImplementationPlanSafeReport(planReview, plan);
  const liveResult = await runYouTubeLivePreflight(planSafeReport, plan, PREFLIGHT_INPUT, livePreflightAdapters());
  const liveReview = createYouTubeLivePreflightReview(liveResult);
  const liveReport = createYouTubeLivePreflightSafeReport(liveReview, liveResult);
  return createYouTubeFirstControlledUploadBoundary(liveReport);
}

test("VO-7CH-FIRST-UPLOAD-1: first controlled upload executes exactly one scheduled videos.insert path", async () => {
  const boundary = await readyBoundary();
  const result = await runYouTubeFirstControlledUpload(boundary, UPLOAD_INPUT, uploadAdapters(), { id: "youtube-first-upload-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.upload_state, "scheduled");
  assert.equal(result.attempt_kind, "single_videos_insert_attempt");
  assert.equal(result.media_read_performed, true);
  assert.equal(result.videos_insert_called, true);
  assert.equal(result.upload_attempted, true);
  assert.equal(result.upload_executed, true);
  assert.equal(result.uploaded_video_id, "yt-safe-video-001");
  assert.equal(result.scheduled_publish_at, "2026-05-15T09:00:00.000Z");
  assert.equal(result.privacy_status, "private");
  assert.equal(result.one_project_only, true);
  assert.equal(result.one_platform_account_only, true);
  assert.equal(result.one_render_artifact_only, true);
  assert.equal(result.one_upload_attempt_only, true);
  assert.equal(result.scheduled_first_private_fallback, true);
  assert.equal(result.bulk_uploads_enabled, false);
  assert.equal(result.bulk_upload_performed, false);
  assert.equal(result.deletes_enabled, false);
  assert.equal(result.delete_performed, false);
  assert.equal(result.unrelated_metadata_changes_enabled, false);
  assert.equal(result.unrelated_metadata_changed, false);
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
  assert.equal(result.request_summary?.metadata.privacy_status, "private");
  assert.equal(result.request_summary?.metadata.publish_at, "2026-05-15T09:00:00.000Z");
  assert.equal(result.request_summary?.bulk_uploads_enabled, false);
  assert.equal(result.request_summary?.deletes_enabled, false);
  assert.equal(result.request_summary?.unrelated_metadata_changes_enabled, false);
  assert.equal(result.safe_store_result?.stored, true);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_repeatability_review, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assertUploadBoundary(result.execution_boundary);
});

test("VO-7CH-FIRST-UPLOAD-2: private fallback works when no schedule is supplied", async () => {
  const boundary = await readyBoundary();
  const { scheduled_publish_at: _scheduledPublishAt, ...privateFallbackInput } = UPLOAD_INPUT;
  const result = await runYouTubeFirstControlledUpload(boundary, privateFallbackInput, uploadAdapters());

  assert.equal(result.upload_state, "private_fallback");
  assert.equal(result.scheduled_publish_at, null);
  assert.equal(result.privacy_status, "private");
  assert.equal(result.upload_executed, true);
  assert.equal(result.validation.complete, true);
});

test("VO-7CH-FIRST-UPLOAD-3: safety constraint violations block before upload adapter", async () => {
  const boundary = await readyBoundary();
  let called = false;
  const result = await runYouTubeFirstControlledUpload(boundary, { ...UPLOAD_INPUT, bulk_uploads_enabled: true as false }, { ...uploadAdapters(), videosInsert: () => { called = true; return { attempted: true, uploaded: true, video_id: "should-not", scheduled_publish_at: null, privacy_status: "private", safe_summary: "should not run", raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false }; } });

  assert.equal(called, false);
  assert.equal(result.upload_state, "blocked");
  assert.equal(result.media_read_performed, false);
  assert.equal(result.videos_insert_called, false);
  assert.equal(result.upload_executed, false);
  assert.equal(result.validation.complete, false);
  assertBlockedBoundary(result.execution_boundary);
});

test("VO-7CH-FIRST-UPLOAD-4: unsafe adapter output is sanitized and raw values are not stored", async () => {
  const boundary = await readyBoundary();
  const unsafe = "../unsafe https://example.com access_token client_secret fetch(";
  const result = await runYouTubeFirstControlledUpload(boundary, { ...UPLOAD_INPUT, request_id: unsafe, project_id: unsafe, render_plan_id: unsafe, title: unsafe, description: unsafe, tags: [unsafe] }, {
    readMediaPayload: () => ({ media_reference_path: unsafe, byte_size: 2048, content_type: unsafe, media_read_performed: true, safe_summary: unsafe }),
    videosInsert: () => ({ attempted: true, uploaded: true, video_id: unsafe, scheduled_publish_at: unsafe, privacy_status: "private", safe_summary: unsafe, raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false }),
    storeSafeSummary: () => ({ stored: true, storage_key: unsafe, safe_summary: unsafe, raw_payload_stored: false, raw_response_stored: false }),
  });
  const serialized = JSON.stringify(result);

  for (const blocked of ["https://example.com", "access_token", "client_secret", "fetch(", "../unsafe"]) {
    assert.equal(serialized.includes(blocked), false);
  }
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
});

test("VO-7CI-FIRST-UPLOAD-REVIEW-1: review and safe report require operator review before repeatability", async () => {
  const boundary = await readyBoundary();
  const result = await runYouTubeFirstControlledUpload(boundary, UPLOAD_INPUT, uploadAdapters());
  const review = createYouTubeFirstControlledUploadReview(result, { id: "youtube-first-upload-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeFirstControlledUploadSafeReport(review, result, { id: "youtube-first-upload-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.upload_executed, true);
  assert.equal(review.one_upload_attempt_only, true);
  assert.equal(review.bulk_upload_performed, false);
  assert.equal(review.delete_performed, false);
  assert.equal(review.unrelated_metadata_changed, false);
  assert.equal(review.raw_payload_stored, false);
  assert.equal(review.raw_response_stored, false);
  assert.equal(review.ready_for_real_upload, false);
  assertUploadBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "requires_operator_review_for_repeatability");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.upload_executed, true);
  assert.equal(report.uploaded_video_id, "yt-safe-video-001");
  assert.equal(report.one_upload_attempt_only, true);
  assert.equal(report.bulk_upload_performed, false);
  assert.equal(report.delete_performed, false);
  assert.equal(report.unrelated_metadata_changed, false);
  assert.equal(report.raw_payload_stored, false);
  assert.equal(report.raw_response_stored, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertUploadBoundary(report.execution_boundary);
});

test("VO-7CI-FIRST-UPLOAD-REVIEW-2: revocation keeps first upload artifacts non-repeatable", async () => {
  const boundary = await readyBoundary();
  const result = await runYouTubeFirstControlledUpload(boundary, UPLOAD_INPUT, uploadAdapters());
  const review = createYouTubeFirstControlledUploadReview(result);
  const report = createYouTubeFirstControlledUploadSafeReport(review, result);

  const revokedResult = revokeYouTubeFirstControlledUploadResult(result, "Operator revoked first upload result.");
  const revokedReview = revokeYouTubeFirstControlledUploadReview(review, "Operator revoked first upload review.");
  const revokedReport = revokeYouTubeFirstControlledUploadSafeReport(report, "Operator revoked first upload safe report.");

  assert.equal(revokedResult.upload_state, "revoked");
  assert.equal(revokedResult.validation.complete, false);
  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assertBlockedBoundary(revokedResult.execution_boundary);
  assertBlockedBoundary(revokedReview.execution_boundary);
  assertBlockedBoundary(revokedReport.execution_boundary);
});
