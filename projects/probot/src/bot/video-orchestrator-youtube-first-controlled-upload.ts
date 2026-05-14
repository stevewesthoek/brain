import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeFirstControlledUploadBoundary } from "./video-orchestrator-youtube-live-preflight.js";

export type YouTubeFirstControlledUploadState = "scheduled" | "private_fallback" | "blocked" | "revoked";
export type YouTubeFirstControlledUploadReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeFirstControlledUploadSafeReportState = "complete" | "requires_operator_review_for_repeatability" | "blocked" | "revoked";
export type YouTubeUploadPrivacyStatus = "private";
export type YouTubeUploadAttemptKind = "single_videos_insert_attempt";

export interface YouTubeFirstControlledUploadInput {
  request_id: string;
  project_id: string;
  platform_account_id: string;
  render_plan_id: string;
  media_reference_path: string;
  title: string;
  description: string;
  tags: string[];
  scheduled_publish_at?: string;
  expected_channel_id: string;
  idempotency_key: string;
  operator_approval_id: string;
  allow_media_read: true;
  allow_youtube_videos_insert: true;
  one_project_only: true;
  one_platform_account_only: true;
  one_render_artifact_only: true;
  one_upload_attempt_only: true;
  scheduled_first_private_fallback: true;
  bulk_uploads_enabled: false;
  deletes_enabled: false;
  unrelated_metadata_changes_enabled: false;
}

export interface YouTubeUploadMediaPayload {
  media_reference_path: string;
  byte_size: number;
  content_type: string;
  media_read_performed: boolean;
  safe_summary: string;
}

export interface YouTubeUploadMetadataPayload {
  title: string;
  description: string;
  tags: string[];
  privacy_status: YouTubeUploadPrivacyStatus;
  publish_at: string | null;
  made_for_kids: false;
  safe_summary: string;
}

export interface YouTubeVideosInsertRequestSummary {
  attempt_kind: YouTubeUploadAttemptKind;
  idempotency_key: string;
  channel_id: string;
  media: YouTubeUploadMediaPayload;
  metadata: YouTubeUploadMetadataPayload;
  raw_payload_stored: false;
  deletes_enabled: false;
  unrelated_metadata_changes_enabled: false;
  bulk_uploads_enabled: false;
}

export interface YouTubeVideosInsertResultSummary {
  attempted: boolean;
  uploaded: boolean;
  video_id: string | null;
  scheduled_publish_at: string | null;
  privacy_status: YouTubeUploadPrivacyStatus;
  safe_summary: string;
  raw_response_stored: false;
  delete_performed: false;
  unrelated_metadata_changed: false;
  bulk_upload_performed: false;
}

export interface YouTubeFirstControlledUploadAdapters {
  readMediaPayload(input: YouTubeFirstControlledUploadInput): Promise<YouTubeUploadMediaPayload> | YouTubeUploadMediaPayload;
  videosInsert(request: YouTubeVideosInsertRequestSummary): Promise<YouTubeVideosInsertResultSummary> | YouTubeVideosInsertResultSummary;
  storeSafeSummary?(result: YouTubeFirstControlledUploadResult): Promise<{ stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false }> | { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false };
}

export interface YouTubeFirstControlledUploadResult {
  schema_version: "1.0";
  first_upload_result_id: string;
  first_upload_boundary_id: string;
  request_id: string;
  project_id: string;
  platform: "youtube";
  platform_account_id: string;
  render_plan_id: string;
  created_at: string;
  upload_state: YouTubeFirstControlledUploadState;
  attempt_kind: YouTubeUploadAttemptKind;
  media_read_performed: boolean;
  videos_insert_called: boolean;
  upload_attempted: boolean;
  upload_executed: boolean;
  uploaded_video_id: string | null;
  scheduled_publish_at: string | null;
  privacy_status: YouTubeUploadPrivacyStatus;
  one_project_only: true;
  one_platform_account_only: true;
  one_render_artifact_only: true;
  one_upload_attempt_only: true;
  scheduled_first_private_fallback: true;
  bulk_uploads_enabled: false;
  bulk_upload_performed: false;
  deletes_enabled: false;
  delete_performed: false;
  unrelated_metadata_changes_enabled: false;
  unrelated_metadata_changed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  request_summary: YouTubeVideosInsertRequestSummary | null;
  upload_result_summary: YouTubeVideosInsertResultSummary | null;
  safe_store_result: { stored: boolean; storage_key: string; safe_summary: string; raw_payload_stored: false; raw_response_stored: false } | null;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_repeatability_review: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeFirstControlledUpload" | "revokeYouTubeFirstControlledUploadResult"; source_boundary_id: string };
}

export interface YouTubeFirstControlledUploadReview {
  schema_version: "1.0";
  first_upload_review_id: string;
  first_upload_result_id: string;
  created_at: string;
  review_state: YouTubeFirstControlledUploadReviewState;
  review_only: true;
  upload_executed: boolean;
  one_upload_attempt_only: true;
  bulk_upload_performed: false;
  delete_performed: false;
  unrelated_metadata_changed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeFirstControlledUploadReview" | "revokeYouTubeFirstControlledUploadReview"; source_result_id: string };
}

export interface YouTubeFirstControlledUploadSafeReport {
  schema_version: "1.0";
  first_upload_safe_report_id: string;
  first_upload_review_id: string;
  first_upload_result_id: string;
  created_at: string;
  safe_report_state: YouTubeFirstControlledUploadSafeReportState;
  safe_report_only: true;
  upload_executed: boolean;
  uploaded_video_id: string | null;
  scheduled_publish_at: string | null;
  privacy_status: YouTubeUploadPrivacyStatus;
  one_upload_attempt_only: true;
  bulk_upload_performed: false;
  delete_performed: false;
  unrelated_metadata_changed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeFirstControlledUploadSafeReport" | "revokeYouTubeFirstControlledUploadSafeReport"; source_review_id: string };
}

const UPLOAD_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
const BLOCKED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeList(values: string[]): string[] { return values.map((value) => safe(value, "tag")).filter((value) => value.length > 0).slice(0, 25); }
function safeSize(value: number): number { return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0; }

function boundaryReady(boundary: YouTubeFirstControlledUploadBoundary): boolean {
  return boundary.boundary_state === "requires_operator_confirmation"
    && boundary.validation.complete
    && !boundary.validation.ready_for_next_phase
    && boundary.explicit_operator_confirmation_required
    && boundary.single_upload_attempt_only
    && boundary.scheduled_first_private_fallback
    && !boundary.upload_execution_enabled_now
    && !boundary.upload_executed_now
    && !boundary.real_upload_enabled_now
    && !boundary.raw_payload_storage_enabled_now
    && !boundary.raw_response_storage_enabled_now;
}

function inputReady(input: YouTubeFirstControlledUploadInput): boolean {
  return input.allow_media_read === true
    && input.allow_youtube_videos_insert === true
    && input.one_project_only === true
    && input.one_platform_account_only === true
    && input.one_render_artifact_only === true
    && input.one_upload_attempt_only === true
    && input.scheduled_first_private_fallback === true
    && input.bulk_uploads_enabled === false
    && input.deletes_enabled === false
    && input.unrelated_metadata_changes_enabled === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.platform_account_id.trim().length > 0
    && input.render_plan_id.trim().length > 0
    && input.media_reference_path.trim().length > 0
    && input.title.trim().length > 0
    && input.expected_channel_id.trim().length > 0
    && input.idempotency_key.trim().length > 0
    && input.operator_approval_id.trim().length > 0;
}

function sanitizeMedia(media: YouTubeUploadMediaPayload): YouTubeUploadMediaPayload {
  return { media_reference_path: safe(media.media_reference_path, "media-reference"), byte_size: safeSize(media.byte_size), content_type: safe(media.content_type, "application/octet-stream"), media_read_performed: media.media_read_performed === true, safe_summary: safe(media.safe_summary, "Media payload prepared.") };
}

function metadata(input: YouTubeFirstControlledUploadInput): YouTubeUploadMetadataPayload {
  const publishAt = input.scheduled_publish_at ? safe(input.scheduled_publish_at, "scheduled-publish-at") : null;
  return { title: safe(input.title, "YouTube upload title"), description: safe(input.description, "YouTube upload description"), tags: safeList(input.tags), privacy_status: "private", publish_at: publishAt, made_for_kids: false, safe_summary: publishAt ? "Scheduled private YouTube metadata prepared." : "Private fallback YouTube metadata prepared." };
}

function requestSummary(input: YouTubeFirstControlledUploadInput, media: YouTubeUploadMediaPayload): YouTubeVideosInsertRequestSummary {
  return { attempt_kind: "single_videos_insert_attempt", idempotency_key: safe(input.idempotency_key, "idempotency-key"), channel_id: safe(input.expected_channel_id, "channel"), media, metadata: metadata(input), raw_payload_stored: false, deletes_enabled: false, unrelated_metadata_changes_enabled: false, bulk_uploads_enabled: false };
}

function sanitizeUploadResult(result: YouTubeVideosInsertResultSummary): YouTubeVideosInsertResultSummary {
  return { attempted: result.attempted === true, uploaded: result.uploaded === true, video_id: result.video_id ? safe(result.video_id, "youtube-video") : null, scheduled_publish_at: result.scheduled_publish_at ? safe(result.scheduled_publish_at, "scheduled-publish-at") : null, privacy_status: "private", safe_summary: safe(result.safe_summary, "YouTube videos.insert attempt completed."), raw_response_stored: false, delete_performed: false, unrelated_metadata_changed: false, bulk_upload_performed: false };
}

function blocked(boundary: YouTubeFirstControlledUploadBoundary, input: YouTubeFirstControlledUploadInput, createdAt: string, reasons: string[]): YouTubeFirstControlledUploadResult {
  return { schema_version: "1.0", first_upload_result_id: safe(`youtube-first-upload-${input.request_id}`, "youtube-first-upload-result"), first_upload_boundary_id: boundary.first_upload_boundary_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), platform: "youtube", platform_account_id: safe(input.platform_account_id, "platform-account"), render_plan_id: safe(input.render_plan_id, "render-plan"), created_at: safe(createdAt, "1970-01-01T00:00:00.000Z"), upload_state: "blocked", attempt_kind: "single_videos_insert_attempt", media_read_performed: false, videos_insert_called: false, upload_attempted: false, upload_executed: false, uploaded_video_id: null, scheduled_publish_at: null, privacy_status: "private", one_project_only: true, one_platform_account_only: true, one_render_artifact_only: true, one_upload_attempt_only: true, scheduled_first_private_fallback: true, bulk_uploads_enabled: false, bulk_upload_performed: false, deletes_enabled: false, delete_performed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false, request_summary: null, upload_result_summary: null, safe_store_result: null, execution_boundary: { ...BLOCKED_BOUNDARY }, validation: { complete: false, ready_for_repeatability_review: false, ready_for_real_upload: false, blocking_reasons: reasons.map((reason) => safe(reason, "First controlled upload blocked.")), warnings: [] }, provenance: { generated_by: "runYouTubeFirstControlledUpload", source_boundary_id: boundary.first_upload_boundary_id } };
}

export async function runYouTubeFirstControlledUpload(boundary: YouTubeFirstControlledUploadBoundary, input: YouTubeFirstControlledUploadInput, adapters: YouTubeFirstControlledUploadAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeFirstControlledUploadResult> {
  const createdAt = safe(options.created_at, new Date(0).toISOString());
  if (!boundaryReady(boundary)) return blocked(boundary, input, createdAt, ["First controlled upload boundary is not ready."]);
  if (!inputReady(input)) return blocked(boundary, input, createdAt, ["First controlled upload input violates one-project/account/render/attempt or safety constraints."]);

  const media = sanitizeMedia(await adapters.readMediaPayload(input));
  if (!media.media_read_performed || media.byte_size <= 0) return blocked(boundary, input, createdAt, ["Media payload creation did not read a usable approved artifact."]);
  const request = requestSummary(input, media);
  const uploadResult = sanitizeUploadResult(await adapters.videosInsert(request));
  const uploadSucceeded = uploadResult.attempted && uploadResult.uploaded && !!uploadResult.video_id && !uploadResult.delete_performed && !uploadResult.unrelated_metadata_changed && !uploadResult.bulk_upload_performed;

  const result: YouTubeFirstControlledUploadResult = { schema_version: "1.0", first_upload_result_id: safe(options.id, `youtube-first-upload-${input.request_id}`), first_upload_boundary_id: boundary.first_upload_boundary_id, request_id: safe(input.request_id, "request"), project_id: safe(input.project_id, "project"), platform: "youtube", platform_account_id: safe(input.platform_account_id, "platform-account"), render_plan_id: safe(input.render_plan_id, "render-plan"), created_at: createdAt, upload_state: uploadSucceeded ? (uploadResult.scheduled_publish_at ? "scheduled" : "private_fallback") : "blocked", attempt_kind: "single_videos_insert_attempt", media_read_performed: media.media_read_performed, videos_insert_called: true, upload_attempted: uploadResult.attempted, upload_executed: uploadResult.uploaded, uploaded_video_id: uploadResult.video_id, scheduled_publish_at: uploadResult.scheduled_publish_at, privacy_status: "private", one_project_only: true, one_platform_account_only: true, one_render_artifact_only: true, one_upload_attempt_only: true, scheduled_first_private_fallback: true, bulk_uploads_enabled: false, bulk_upload_performed: false, deletes_enabled: false, delete_performed: false, unrelated_metadata_changes_enabled: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false, request_summary: request, upload_result_summary: uploadResult, safe_store_result: null, execution_boundary: { ...UPLOAD_BOUNDARY }, validation: { complete: uploadSucceeded, ready_for_repeatability_review: uploadSucceeded, ready_for_real_upload: false, blocking_reasons: uploadSucceeded ? [] : ["First controlled YouTube upload attempt did not complete successfully."], warnings: ["First controlled upload path is single-attempt only and does not approve bulk automation."] }, provenance: { generated_by: "runYouTubeFirstControlledUpload", source_boundary_id: boundary.first_upload_boundary_id } };

  if (adapters.storeSafeSummary) {
    const stored = await adapters.storeSafeSummary(result);
    result.safe_store_result = { stored: stored.stored === true, storage_key: safe(stored.storage_key, "youtube-first-upload-safe-summary"), safe_summary: safe(stored.safe_summary, "First controlled upload safe summary stored."), raw_payload_stored: false, raw_response_stored: false };
    if (!result.safe_store_result.stored) {
      result.upload_state = "blocked";
      result.validation.complete = false;
      result.validation.ready_for_repeatability_review = false;
      result.validation.blocking_reasons = [...result.validation.blocking_reasons, "Safe summary storage did not complete."];
    }
  }
  return result;
}

function resultReady(result: YouTubeFirstControlledUploadResult): boolean {
  return (result.upload_state === "scheduled" || result.upload_state === "private_fallback") && result.validation.complete && result.validation.ready_for_repeatability_review && !result.validation.ready_for_real_upload && result.media_read_performed && result.videos_insert_called && result.upload_attempted && result.upload_executed && !!result.uploaded_video_id && result.one_upload_attempt_only && !result.bulk_upload_performed && !result.delete_performed && !result.unrelated_metadata_changed && !result.raw_payload_stored && !result.raw_response_stored;
}

export function createYouTubeFirstControlledUploadReview(result: YouTubeFirstControlledUploadResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeFirstControlledUploadReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", first_upload_review_id: safe(options.id, "youtube-first-controlled-upload-review-001"), first_upload_result_id: result.first_upload_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, upload_executed: result.upload_executed, one_upload_attempt_only: true, bulk_upload_performed: false, delete_performed: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false, ready_for_real_upload: false, execution_boundary: { ...UPLOAD_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["First controlled upload result was not ready for review."], warnings: ["Review does not approve repeat uploads or automation."] }, provenance: { generated_by: "createYouTubeFirstControlledUploadReview", source_result_id: result.first_upload_result_id } };
}

export function createYouTubeFirstControlledUploadSafeReport(review: YouTubeFirstControlledUploadReview, result: YouTubeFirstControlledUploadResult, options: { id?: string; created_at?: string; requestRepeatabilityReview?: boolean } = {}): YouTubeFirstControlledUploadSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const needsReview = ready && options.requestRepeatabilityReview !== false;
  return { schema_version: "1.0", first_upload_safe_report_id: safe(options.id, "youtube-first-controlled-upload-safe-report-001"), first_upload_review_id: review.first_upload_review_id, first_upload_result_id: result.first_upload_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: needsReview ? "requires_operator_review_for_repeatability" : ready ? "complete" : "blocked", safe_report_only: true, upload_executed: result.upload_executed, uploaded_video_id: result.uploaded_video_id, scheduled_publish_at: result.scheduled_publish_at, privacy_status: "private", one_upload_attempt_only: true, bulk_upload_performed: false, delete_performed: false, unrelated_metadata_changed: false, raw_payload_stored: false, raw_response_stored: false, ready_for_real_upload: false, execution_boundary: { ...UPLOAD_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Operator review required before repeatability or automation work."] : ["First controlled upload review was not ready for safe report."], warnings: ["Stop before repeat upload, automation, bulk scheduling, deletes, or unrelated metadata updates."] }, provenance: { generated_by: "createYouTubeFirstControlledUploadSafeReport", source_review_id: review.first_upload_review_id } };
}

export function revokeYouTubeFirstControlledUploadResult(result: YouTubeFirstControlledUploadResult, reason?: string): YouTubeFirstControlledUploadResult { return { ...result, upload_state: "revoked", execution_boundary: { ...BLOCKED_BOUNDARY }, validation: { complete: false, ready_for_repeatability_review: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "First controlled upload result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeFirstControlledUploadResult" } }; }
export function revokeYouTubeFirstControlledUploadReview(review: YouTubeFirstControlledUploadReview, reason?: string): YouTubeFirstControlledUploadReview { return { ...review, review_state: "revoked", execution_boundary: { ...BLOCKED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "First controlled upload review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeFirstControlledUploadReview" } }; }
export function revokeYouTubeFirstControlledUploadSafeReport(report: YouTubeFirstControlledUploadSafeReport, reason?: string): YouTubeFirstControlledUploadSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...BLOCKED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "First controlled upload safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeFirstControlledUploadSafeReport" } }; }
