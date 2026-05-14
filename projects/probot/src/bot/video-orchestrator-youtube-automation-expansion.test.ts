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
import { runYouTubeRepeatabilityImplementation, createYouTubeRepeatabilityImplementationReview, createYouTubeRepeatabilityImplementationSafeReport, type YouTubeRepeatabilityAttemptInput, type YouTubeRepeatabilityCheckAdapters } from "./video-orchestrator-youtube-repeatability-implementation.js";
import {
  runYouTubeAutomationExpansion,
  createYouTubeAutomationExpansionReview,
  createYouTubeAutomationExpansionSafeReport,
  revokeYouTubeAutomationExpansionResult,
  revokeYouTubeAutomationExpansionReview,
  revokeYouTubeAutomationExpansionSafeReport,
  type YouTubeAutomationExpansionAdapters,
  type YouTubeAutomationExpansionInput,
} from "./video-orchestrator-youtube-automation-expansion.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const PREFLIGHT_INPUT: YouTubeLivePreflightInput = { request_id: "youtube-live-preflight-request-001", project_id: "says-the-bible", render_plan_id: "render-plan-001", platform_account_id: "says-the-bible-youtube-account-1", account_reference_label: "youtube account ref", token_reference_label: "youtube token ref", media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4", expected_youtube_channel_id: "UC-safe-channel", allow_live_preflight: true, allow_youtube_network_call: true, allow_media_stat: true, allow_safe_summary_storage: true, upload_execution_enabled: false };
const UPLOAD_INPUT: YouTubeFirstControlledUploadInput = { request_id: "youtube-first-upload-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", render_plan_id: "render-plan-001", media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4", title: "Safe scheduled upload title", description: "Safe scheduled upload description", tags: ["safe", "test"], scheduled_publish_at: "2026-05-15T09:00:00.000Z", expected_channel_id: "UC-safe-channel", idempotency_key: "says-the-bible-youtube-render-plan-001", operator_approval_id: "operator-approval-first-upload-001", allow_media_read: true, allow_youtube_videos_insert: true, one_project_only: true, one_platform_account_only: true, one_render_artifact_only: true, one_upload_attempt_only: true, scheduled_first_private_fallback: true, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false };
const REPEAT_INPUT: YouTubeRepeatabilityAttemptInput = { request_id: "youtube-repeatability-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", render_plan_id: "render-plan-002", idempotency_key: "says-the-bible-youtube-render-plan-002", prior_first_upload_result_id: "youtube-first-upload-request-001", scheduled_window_id: "yt-window-001", operator_approval_id: "operator-repeatability-001", allow_repeatability_check: true, allow_repeat_upload_execution: false, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false };
const AUTOMATION_INPUT: YouTubeAutomationExpansionInput = { request_id: "youtube-automation-expansion-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", queue_id: "yt-single-account-queue-001", schedule_window_id: "yt-window-001", idempotency_scope: "says-the-bible-youtube-main", operator_approval_id: "operator-automation-expansion-001", allow_single_account_queue: true, allow_automation_expansion: true, allow_repeat_upload_execution: false, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false, multi_account_enabled: false, multi_platform_enabled: false };

function livePreflightAdapters(): YouTubeLivePreflightAdapters { return { accountProbe: { checkAccountReference: () => ({ account_reference_found: true, token_reference_found: true, token_status: "valid", safe_account_summary: "Account reference is connected." }) }, mediaProbe: { statMediaReference: () => ({ media_reference_found: true, byte_size: 1024, mime_type: "video/mp4", safe_media_summary: "Media reference stat passed." }) }, youtubeProbe: { checkChannelIdentity: () => ({ channel_found: true, channel_id_matches_expected: true, safe_channel_summary: "YouTube channel identity matched." }) }, summaryStore: { storeSafeSummary: () => ({ stored: true, storage_reference: "safe-summary://youtube-live-preflight/001", safe_storage_summary: "Safe summary stored." }) } }; }
function uploadAdapters(): YouTubeFirstControlledUploadAdapters { return { readMediaPayload: () => ({ media_reference_path: UPLOAD_INPUT.media_reference_path, byte_size: 2048, content_type: "video/mp4", media_read_performed: true, safe_summary: "Approved media artifact read for single upload." }), videosInsert: (request) => ({ attempted: true, uploaded: true, video_id: "yt-safe-video-001", scheduled_publish_at: request.metadata.publish_at, privacy_status: "private", safe_summary: "Single videos.insert upload attempt completed.", raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-first-upload/001", safe_summary: "First upload safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function repeatabilityAdapters(): YouTubeRepeatabilityCheckAdapters { return { checkIdempotency: () => ({ idempotency_key: REPEAT_INPUT.idempotency_key, duplicate_found: false, safe_summary: "No duplicate idempotency key found." }), checkScheduleWindow: () => ({ scheduled_window_id: REPEAT_INPUT.scheduled_window_id, window_open: true, safe_summary: "Schedule window is open." }), checkQuotaResume: () => ({ quota_available: true, retry_after: null, safe_summary: "Quota is available." }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-repeatability/001", safe_summary: "Repeatability safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function automationAdapters(overrides: Partial<YouTubeAutomationExpansionAdapters> = {}): YouTubeAutomationExpansionAdapters { return { listSingleAccountQueue: () => [{ queue_item_id: "queue-item-001", render_plan_id: "render-plan-002", idempotency_key: "idem-002", scheduled_window_id: "yt-window-001", safe_summary: "Queue item ready for future review.", upload_execution_enabled_now: false, upload_executed_now: false, bulk_upload_enabled_now: false, delete_enabled_now: false, unrelated_metadata_change_enabled_now: false }], checkQueueReadiness: () => ({ ready: true, safe_summary: "Queue ready for review.", blocking_reasons: [] }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-automation-expansion/001", safe_summary: "Automation expansion safe summary stored.", raw_payload_stored: false, raw_response_stored: false }), ...overrides }; }

async function readyRepeatabilityImplementationPair() {
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
  const repeatSafeReport = createYouTubeRepeatabilityAutomationSafeReport(repeatReview, repeatPlan);
  const repeatResult = await runYouTubeRepeatabilityImplementation(repeatSafeReport, REPEAT_INPUT, repeatabilityAdapters());
  const repeatImplReview = createYouTubeRepeatabilityImplementationReview(repeatResult);
  const repeatImplSafeReport = createYouTubeRepeatabilityImplementationSafeReport(repeatImplReview, repeatResult);
  return { repeatResult, repeatImplSafeReport };
}

test("VO-7CN-AUTOMATION-EXPANSION-1: checks single-account queue without executing automation", async () => {
  const { repeatResult, repeatImplSafeReport } = await readyRepeatabilityImplementationPair();
  const result = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, AUTOMATION_INPUT, automationAdapters(), { id: "youtube-automation-expansion-result-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(result.automation_state, "ready_for_single_account_queue_review");
  assert.equal(result.single_account_queue_checked, true);
  assert.equal(result.automation_expansion_checked, true);
  assert.equal(result.queue_items.length, 1);
  assert.equal(result.repeat_upload_executed, false);
  assert.equal(result.automation_execution_enabled, false);
  assert.equal(result.automation_executed, false);
  assert.equal(result.bulk_uploads_enabled, false);
  assert.equal(result.bulk_uploads_executed, false);
  assert.equal(result.deletes_enabled, false);
  assert.equal(result.deletes_executed, false);
  assert.equal(result.unrelated_metadata_changes_enabled, false);
  assert.equal(result.unrelated_metadata_changed, false);
  assert.equal(result.multi_account_enabled, false);
  assert.equal(result.multi_platform_enabled, false);
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
  assert.equal(result.safe_store_result?.stored, true);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_multi_account_platform_review, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CN-AUTOMATION-EXPANSION-2: unsafe input blocks before adapters", async () => {
  const { repeatResult, repeatImplSafeReport } = await readyRepeatabilityImplementationPair();
  let called = false;
  const result = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, { ...AUTOMATION_INPUT, bulk_uploads_enabled: true as false }, automationAdapters({ listSingleAccountQueue: () => { called = true; return []; } }));
  assert.equal(called, false);
  assert.equal(result.automation_state, "blocked");
  assert.equal(result.single_account_queue_checked, false);
  assert.equal(result.bulk_uploads_executed, false);
  assert.equal(result.validation.complete, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CN-AUTOMATION-EXPANSION-3: queue readiness block prevents next phase", async () => {
  const { repeatResult, repeatImplSafeReport } = await readyRepeatabilityImplementationPair();
  const result = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, AUTOMATION_INPUT, automationAdapters({ checkQueueReadiness: () => ({ ready: false, safe_summary: "Queue blocked.", blocking_reasons: ["Schedule cadence not ready."] }) }));
  assert.equal(result.automation_state, "blocked");
  assert.equal(result.validation.complete, false);
  assert.equal(result.validation.blocking_reasons.includes("Schedule cadence not ready."), true);
  assert.equal(result.automation_executed, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CO-AUTOMATION-REVIEW-1: review and safe report require confirmation before multi-account/platform expansion", async () => {
  const { repeatResult, repeatImplSafeReport } = await readyRepeatabilityImplementationPair();
  const result = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, AUTOMATION_INPUT, automationAdapters());
  const review = createYouTubeAutomationExpansionReview(result, { id: "youtube-automation-expansion-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeAutomationExpansionSafeReport(review, result, { id: "youtube-automation-expansion-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.single_account_queue_checked, true);
  assert.equal(review.automation_execution_enabled, false);
  assert.equal(review.repeat_upload_executed, false);
  assert.equal(review.bulk_uploads_executed, false);
  assert.equal(review.deletes_executed, false);
  assert.equal(review.unrelated_metadata_changed, false);
  assert.equal(review.multi_account_enabled, false);
  assert.equal(review.multi_platform_enabled, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);
  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_multi_account_platform_expansion");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.single_account_queue_checked, true);
  assert.equal(report.automation_execution_enabled, false);
  assert.equal(report.repeat_upload_executed, false);
  assert.equal(report.bulk_uploads_executed, false);
  assert.equal(report.deletes_executed, false);
  assert.equal(report.unrelated_metadata_changed, false);
  assert.equal(report.multi_account_enabled, false);
  assert.equal(report.multi_platform_enabled, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CO-AUTOMATION-REVIEW-2: revocation keeps automation expansion artifacts disabled", async () => {
  const { repeatResult, repeatImplSafeReport } = await readyRepeatabilityImplementationPair();
  const result = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, AUTOMATION_INPUT, automationAdapters());
  const review = createYouTubeAutomationExpansionReview(result);
  const report = createYouTubeAutomationExpansionSafeReport(review, result);
  assert.equal(revokeYouTubeAutomationExpansionResult(result).automation_state, "revoked");
  assert.equal(revokeYouTubeAutomationExpansionReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeAutomationExpansionSafeReport(report).safe_report_state, "revoked");
});
