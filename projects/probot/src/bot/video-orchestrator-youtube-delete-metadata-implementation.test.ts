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
import { runYouTubeAutomationExpansion, createYouTubeAutomationExpansionReview, createYouTubeAutomationExpansionSafeReport, type YouTubeAutomationExpansionAdapters, type YouTubeAutomationExpansionInput } from "./video-orchestrator-youtube-automation-expansion.js";
import { runYouTubeMultiAccountPlatformExpansion, createYouTubeMultiAccountPlatformExpansionReview, createYouTubeMultiAccountPlatformExpansionSafeReport, type YouTubeMultiAccountPlatformExpansionAdapters, type YouTubeMultiAccountPlatformExpansionInput } from "./video-orchestrator-youtube-multi-account-platform-expansion.js";
import { runYouTubeBulkExecutionBoundary, createYouTubeBulkExecutionBoundaryReview, createYouTubeBulkExecutionBoundarySafeReport, type YouTubeBulkExecutionBoundaryAdapters, type YouTubeBulkExecutionBoundaryControlKind, type YouTubeBulkExecutionBoundaryInput } from "./video-orchestrator-youtube-bulk-execution-boundary.js";
import { runYouTubeControlledBulkExecution, createYouTubeControlledBulkExecutionReview, createYouTubeControlledBulkExecutionSafeReport, type YouTubeControlledBulkExecutionAdapters, type YouTubeControlledBulkExecutionInput } from "./video-orchestrator-youtube-controlled-bulk-execution.js";
import { createYouTubeDeleteMetadataBoundaryPlan, createYouTubeDeleteMetadataBoundaryPlanReview, createYouTubeDeleteMetadataBoundarySafeReport, type YouTubeDeleteMetadataBoundaryInput } from "./video-orchestrator-youtube-delete-metadata-boundary-plan.js";
import {
  runYouTubeDeleteMetadataImplementation,
  createYouTubeDeleteMetadataImplementationReview,
  createYouTubeDeleteMetadataImplementationSafeReport,
  revokeYouTubeDeleteMetadataImplementationResult,
  revokeYouTubeDeleteMetadataImplementationReview,
  revokeYouTubeDeleteMetadataImplementationSafeReport,
  type YouTubeDeleteMetadataImplementationAdapters,
  type YouTubeDeleteMetadataImplementationInput,
} from "./video-orchestrator-youtube-delete-metadata-implementation.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }

const PREFLIGHT_INPUT: YouTubeLivePreflightInput = { request_id: "youtube-live-preflight-request-001", project_id: "says-the-bible", render_plan_id: "render-plan-001", platform_account_id: "says-the-bible-youtube-account-1", account_reference_label: "youtube account ref", token_reference_label: "youtube token ref", media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4", expected_youtube_channel_id: "UC-safe-channel", allow_live_preflight: true, allow_youtube_network_call: true, allow_media_stat: true, allow_safe_summary_storage: true, upload_execution_enabled: false };
const UPLOAD_INPUT: YouTubeFirstControlledUploadInput = { request_id: "youtube-first-upload-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", render_plan_id: "render-plan-001", media_reference_path: "generated-assets/says-the-bible/render-plan-001/final-video.mp4", title: "Safe scheduled upload title", description: "Safe scheduled upload description", tags: ["safe", "test"], scheduled_publish_at: "2026-05-15T09:00:00.000Z", expected_channel_id: "UC-safe-channel", idempotency_key: "says-the-bible-youtube-render-plan-001", operator_approval_id: "operator-approval-first-upload-001", allow_media_read: true, allow_youtube_videos_insert: true, one_project_only: true, one_platform_account_only: true, one_render_artifact_only: true, one_upload_attempt_only: true, scheduled_first_private_fallback: true, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false };
const REPEAT_INPUT: YouTubeRepeatabilityAttemptInput = { request_id: "youtube-repeatability-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", render_plan_id: "render-plan-002", idempotency_key: "says-the-bible-youtube-render-plan-002", prior_first_upload_result_id: "youtube-first-upload-request-001", scheduled_window_id: "yt-window-001", operator_approval_id: "operator-repeatability-001", allow_repeatability_check: true, allow_repeat_upload_execution: false, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false };
const AUTOMATION_INPUT: YouTubeAutomationExpansionInput = { request_id: "youtube-automation-expansion-request-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", queue_id: "yt-single-account-queue-001", schedule_window_id: "yt-window-001", idempotency_scope: "says-the-bible-youtube-main", operator_approval_id: "operator-automation-expansion-001", allow_single_account_queue: true, allow_automation_expansion: true, allow_repeat_upload_execution: false, bulk_uploads_enabled: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false, multi_account_enabled: false, multi_platform_enabled: false };
const MULTI_INPUT: YouTubeMultiAccountPlatformExpansionInput = { request_id: "youtube-multi-account-platform-request-001", project_id: "says-the-bible", operator_approval_id: "operator-multi-account-platform-001", account_scope_id: "multi-account-scope-001", platform_scope_id: "multi-platform-scope-001", allow_multi_account: true, allow_multi_platform: true, allow_bulk_uploads: false, allow_deletes: false, allow_unrelated_metadata_changes: false, allow_upload_execution: false };
const BULK_BOUNDARY_INPUT: YouTubeBulkExecutionBoundaryInput = { request_id: "youtube-bulk-boundary-request-001", project_id: "says-the-bible", operator_approval_id: "operator-bulk-boundary-001", bulk_boundary_scope_id: "bulk-boundary-scope-001", max_items_per_batch: 3, allow_boundary_planning: true, allow_actual_bulk_uploads: false, allow_deletes: false, allow_unrelated_metadata_changes: false, allow_commits: false, allow_pushes: false };
const CONTROLLED_INPUT: YouTubeControlledBulkExecutionInput = { request_id: "youtube-controlled-bulk-request-001", project_id: "says-the-bible", operator_approval_id: "operator-controlled-bulk-001", bulk_execution_scope_id: "controlled-bulk-scope-001", max_items_to_execute: 1, allow_controlled_bulk_execution: true, allow_deletes: false, allow_unrelated_metadata_changes: false, allow_commits: false, allow_pushes: false };
const BOUNDARY_INPUT: YouTubeDeleteMetadataBoundaryInput = { request_id: "youtube-delete-metadata-boundary-request-001", project_id: "says-the-bible", operator_approval_id: "operator-delete-metadata-boundary-001", boundary_scope_id: "delete-metadata-boundary-scope-001", allow_planning_only: true, allow_actual_deletes: false, allow_unrelated_metadata_changes: false, allow_commits: false, allow_pushes: false };
const IMPLEMENTATION_INPUT: YouTubeDeleteMetadataImplementationInput = { request_id: "youtube-delete-metadata-implementation-request-001", project_id: "says-the-bible", operator_approval_id: "operator-delete-metadata-implementation-001", implementation_scope_id: "delete-metadata-implementation-scope-001", allow_implementation_checks: true, allow_actual_deletes: false, allow_unrelated_metadata_changes: false, allow_commits: false, allow_pushes: false };

function livePreflightAdapters(): YouTubeLivePreflightAdapters { return { accountProbe: { checkAccountReference: () => ({ account_reference_found: true, token_reference_found: true, token_status: "valid", safe_account_summary: "Account reference is connected." }) }, mediaProbe: { statMediaReference: () => ({ media_reference_found: true, byte_size: 1024, mime_type: "video/mp4", safe_media_summary: "Media reference stat passed." }) }, youtubeProbe: { checkChannelIdentity: () => ({ channel_found: true, channel_id_matches_expected: true, safe_channel_summary: "YouTube channel identity matched." }) }, summaryStore: { storeSafeSummary: () => ({ stored: true, storage_reference: "safe-summary://youtube-live-preflight/001", safe_storage_summary: "Safe summary stored." }) } }; }
function uploadAdapters(): YouTubeFirstControlledUploadAdapters { return { readMediaPayload: () => ({ media_reference_path: UPLOAD_INPUT.media_reference_path, byte_size: 2048, content_type: "video/mp4", media_read_performed: true, safe_summary: "Approved media artifact read for single upload." }), videosInsert: (request) => ({ attempted: true, uploaded: true, video_id: "yt-safe-video-001", scheduled_publish_at: request.metadata.publish_at, privacy_status: "private", safe_summary: "Single videos.insert upload attempt completed.", raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-first-upload/001", safe_summary: "First upload safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function repeatabilityAdapters(): YouTubeRepeatabilityCheckAdapters { return { checkIdempotency: () => ({ idempotency_key: REPEAT_INPUT.idempotency_key, duplicate_found: false, safe_summary: "No duplicate idempotency key found." }), checkScheduleWindow: () => ({ scheduled_window_id: REPEAT_INPUT.scheduled_window_id, window_open: true, safe_summary: "Schedule window is open." }), checkQuotaResume: () => ({ quota_available: true, retry_after: null, safe_summary: "Quota is available." }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-repeatability/001", safe_summary: "Repeatability safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function automationAdapters(): YouTubeAutomationExpansionAdapters { return { listSingleAccountQueue: () => [{ queue_item_id: "queue-item-001", render_plan_id: "render-plan-002", idempotency_key: "idem-002", scheduled_window_id: "yt-window-001", safe_summary: "Queue item ready for future review.", upload_execution_enabled_now: false, upload_executed_now: false, bulk_upload_enabled_now: false, delete_enabled_now: false, unrelated_metadata_change_enabled_now: false }], checkQueueReadiness: () => ({ ready: true, safe_summary: "Queue ready for review.", blocking_reasons: [] }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-automation-expansion/001", safe_summary: "Automation expansion safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function multiAdapters(): YouTubeMultiAccountPlatformExpansionAdapters { return { listAccountPlatformQueues: () => [{ queue_id: "youtube-account-1-queue", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", platform: "youtube", queue_item_count: 1, safe_summary: "YouTube account queue ready.", upload_execution_enabled_now: false, bulk_upload_enabled_now: false, delete_enabled_now: false, unrelated_metadata_change_enabled_now: false }], checkExpansionReadiness: () => ({ ready: true, safe_summary: "Multi-account/platform queues ready for review.", blocking_reasons: [] }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-multi-account-platform/001", safe_summary: "Multi-account/platform safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function bulkControls() { const kinds: YouTubeBulkExecutionBoundaryControlKind[] = ["batch_size", "cadence", "quota", "idempotency", "duplicate_prevention", "account_partition", "platform_partition", "delete_guard", "metadata_guard", "manual_pause", "rollback"]; return kinds.map((kind) => ({ control_id: `bulk-control-${kind}`, control_kind: kind, safe_summary: `Bulk boundary control ${kind}.`, planned_now: true as const, implemented_now: true, actual_bulk_upload_enabled_now: false as const, actual_bulk_upload_executed_now: false as const, delete_enabled_now: false as const, delete_executed_now: false as const, unrelated_metadata_change_enabled_now: false as const, unrelated_metadata_changed_now: false as const, commit_enabled_now: false as const, push_enabled_now: false as const })); }
function bulkBoundaryAdapters(): YouTubeBulkExecutionBoundaryAdapters { return { planBoundaryControls: () => bulkControls(), checkBoundaryReadiness: () => ({ ready: true, safe_summary: "Bulk boundary controls ready for review.", blocking_reasons: [] }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-bulk-boundary/001", safe_summary: "Bulk boundary safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function controlledBulkAdapters(): YouTubeControlledBulkExecutionAdapters { return { listApprovedBulkItems: () => [{ queue_item_id: "controlled-item-001", project_id: "says-the-bible", platform_account_id: "says-the-bible-youtube-account-1", platform: "youtube", render_plan_id: "render-plan-003", idempotency_key: "idem-003", safe_summary: "Approved controlled bulk item 1.", delete_enabled_now: false, unrelated_metadata_change_enabled_now: false }], executeSingleApprovedItem: (item) => ({ queue_item_id: item.queue_item_id, attempted: true, uploaded: true, skipped: false, uploaded_video_id: `${item.queue_item_id}-video`, scheduled_publish_at: "2026-05-16T09:00:00.000Z", privacy_status: "private", safe_summary: "Controlled item uploaded safely.", delete_performed: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-controlled-bulk/001", safe_summary: "Controlled bulk safe summary stored.", raw_payload_stored: false, raw_response_stored: false }) }; }
function implementationAdapters(overrides: Partial<YouTubeDeleteMetadataImplementationAdapters> = {}): YouTubeDeleteMetadataImplementationAdapters { return { listPlannedIntents: () => [{ intent_id: "intent-delete-review-only-001", target_kind: "video", target_reference_id: "controlled-item-001-video", safe_summary: "Delete intent is reviewed but not executable.", actual_delete_enabled_now: false, actual_delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false }, { intent_id: "intent-metadata-review-only-001", target_kind: "metadata_field", target_reference_id: "controlled-item-001-title", safe_summary: "Metadata intent is reviewed but not executable.", actual_delete_enabled_now: false, actual_delete_executed_now: false, unrelated_metadata_change_enabled_now: false, unrelated_metadata_changed_now: false }], checkImplementationReadiness: () => ({ ready: true, safe_summary: "Delete metadata implementation checks are ready for review.", blocking_reasons: [] }), storeSafeSummary: () => ({ stored: true, storage_key: "safe-summary://youtube-delete-metadata-implementation/001", safe_summary: "Delete metadata implementation safe summary stored.", raw_payload_stored: false, raw_response_stored: false }), ...overrides }; }

async function readyBoundaryPair() {
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
  const automationResult = await runYouTubeAutomationExpansion(repeatImplSafeReport, repeatResult, AUTOMATION_INPUT, automationAdapters());
  const automationReview = createYouTubeAutomationExpansionReview(automationResult);
  const automationReport = createYouTubeAutomationExpansionSafeReport(automationReview, automationResult);
  const multiResult = await runYouTubeMultiAccountPlatformExpansion(automationReport, automationResult, MULTI_INPUT, multiAdapters());
  const multiReview = createYouTubeMultiAccountPlatformExpansionReview(multiResult);
  const multiReport = createYouTubeMultiAccountPlatformExpansionSafeReport(multiReview, multiResult);
  const bulkBoundaryResult = await runYouTubeBulkExecutionBoundary(multiReport, multiResult, BULK_BOUNDARY_INPUT, bulkBoundaryAdapters());
  const bulkBoundaryReview = createYouTubeBulkExecutionBoundaryReview(bulkBoundaryResult);
  const bulkBoundaryReport = createYouTubeBulkExecutionBoundarySafeReport(bulkBoundaryReview, bulkBoundaryResult);
  const controlledResult = await runYouTubeControlledBulkExecution(bulkBoundaryReport, bulkBoundaryResult, CONTROLLED_INPUT, controlledBulkAdapters());
  const controlledReview = createYouTubeControlledBulkExecutionReview(controlledResult);
  const controlledReport = createYouTubeControlledBulkExecutionSafeReport(controlledReview, controlledResult);
  const boundaryPlan = createYouTubeDeleteMetadataBoundaryPlan(controlledReport, controlledResult, BOUNDARY_INPUT);
  const boundaryReview = createYouTubeDeleteMetadataBoundaryPlanReview(boundaryPlan);
  const boundaryReport = createYouTubeDeleteMetadataBoundarySafeReport(boundaryReview, boundaryPlan);
  return { boundaryPlan, boundaryReport };
}

test("VO-7CX-DELETE-METADATA-IMPLEMENTATION-1: runs implementation checks without actual delete or metadata mutation", async () => {
  const { boundaryPlan, boundaryReport } = await readyBoundaryPair();
  const result = await runYouTubeDeleteMetadataImplementation(boundaryReport, boundaryPlan, IMPLEMENTATION_INPUT, implementationAdapters(), { id: "youtube-delete-metadata-implementation-result-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(result.implementation_state, "ready_for_operator_review");
  assert.equal(result.implementation_checks_executed, true);
  assert.equal(result.planned_intents.length, 2);
  assert.equal(result.actual_deletes_enabled, false);
  assert.equal(result.actual_deletes_executed, false);
  assert.equal(result.unrelated_metadata_changes_enabled, false);
  assert.equal(result.unrelated_metadata_changed, false);
  assert.equal(result.commits_enabled, false);
  assert.equal(result.pushes_enabled, false);
  assert.equal(result.raw_payload_stored, false);
  assert.equal(result.raw_response_stored, false);
  assert.equal(result.safe_store_result?.stored, true);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_commit_push_boundary_review, true);
  assert.equal(result.validation.ready_for_real_upload, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CX-DELETE-METADATA-IMPLEMENTATION-2: unsafe input blocks before adapters", async () => {
  const { boundaryPlan, boundaryReport } = await readyBoundaryPair();
  let called = false;
  const result = await runYouTubeDeleteMetadataImplementation(boundaryReport, boundaryPlan, { ...IMPLEMENTATION_INPUT, allow_actual_deletes: true as false }, implementationAdapters({ listPlannedIntents: () => { called = true; return []; } }));
  assert.equal(called, false);
  assert.equal(result.implementation_state, "blocked");
  assert.equal(result.implementation_checks_executed, false);
  assert.equal(result.actual_deletes_executed, false);
  assert.equal(result.validation.complete, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CX-DELETE-METADATA-IMPLEMENTATION-3: readiness block prevents commit/push boundary", async () => {
  const { boundaryPlan, boundaryReport } = await readyBoundaryPair();
  const result = await runYouTubeDeleteMetadataImplementation(boundaryReport, boundaryPlan, IMPLEMENTATION_INPUT, implementationAdapters({ checkImplementationReadiness: () => ({ ready: false, safe_summary: "Implementation checks blocked.", blocking_reasons: ["Operator dry-run evidence missing."] }) }));
  assert.equal(result.implementation_state, "blocked");
  assert.equal(result.validation.complete, false);
  assert.equal(result.validation.blocking_reasons.includes("Operator dry-run evidence missing."), true);
  assert.equal(result.actual_deletes_executed, false);
  assertDisabledBoundary(result.execution_boundary);
});

test("VO-7CY-DELETE-METADATA-REVIEW-1: review and safe report require confirmation before commit/push boundary", async () => {
  const { boundaryPlan, boundaryReport } = await readyBoundaryPair();
  const result = await runYouTubeDeleteMetadataImplementation(boundaryReport, boundaryPlan, IMPLEMENTATION_INPUT, implementationAdapters());
  const review = createYouTubeDeleteMetadataImplementationReview(result, { id: "youtube-delete-metadata-implementation-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubeDeleteMetadataImplementationSafeReport(review, result, { id: "youtube-delete-metadata-implementation-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });
  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.implementation_checks_executed, true);
  assert.equal(review.actual_deletes_executed, false);
  assert.equal(review.unrelated_metadata_changed, false);
  assert.equal(review.commits_enabled, false);
  assert.equal(review.pushes_enabled, false);
  assert.equal(review.ready_for_real_upload, false);
  assertDisabledBoundary(review.execution_boundary);
  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_commit_push_boundary");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.implementation_checks_executed, true);
  assert.equal(report.actual_deletes_executed, false);
  assert.equal(report.unrelated_metadata_changed, false);
  assert.equal(report.commits_enabled, false);
  assert.equal(report.pushes_enabled, false);
  assert.equal(report.ready_for_real_upload, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CY-DELETE-METADATA-REVIEW-2: revocation keeps implementation artifacts disabled", async () => {
  const { boundaryPlan, boundaryReport } = await readyBoundaryPair();
  const result = await runYouTubeDeleteMetadataImplementation(boundaryReport, boundaryPlan, IMPLEMENTATION_INPUT, implementationAdapters());
  const review = createYouTubeDeleteMetadataImplementationReview(result);
  const report = createYouTubeDeleteMetadataImplementationSafeReport(review, result);
  assert.equal(revokeYouTubeDeleteMetadataImplementationResult(result).implementation_state, "revoked");
  assert.equal(revokeYouTubeDeleteMetadataImplementationReview(review).review_state, "revoked");
  assert.equal(revokeYouTubeDeleteMetadataImplementationSafeReport(report).safe_report_state, "revoked");
});
