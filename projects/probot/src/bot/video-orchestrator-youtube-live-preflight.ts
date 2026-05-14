import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubeLivePreflightImplementationPlan, YouTubeLivePreflightImplementationPlanSafeReport } from "./video-orchestrator-youtube-live-preflight-plan.js";

export type YouTubeLivePreflightState = "completed" | "blocked" | "revoked";
export type YouTubeLivePreflightCheckState = "passed" | "blocked" | "failed" | "skipped";
export type YouTubeLivePreflightCheckKind = "account_reference" | "token_status" | "media_stat" | "youtube_channel_identity" | "youtube_network" | "safe_summary_storage" | "upload_guard";

export interface YouTubeLivePreflightInput {
  request_id: string;
  project_id: string;
  render_plan_id: string;
  platform_account_id: string;
  account_reference_label: string;
  token_reference_label: string;
  media_reference_path: string;
  expected_youtube_channel_id?: string;
  allow_live_preflight: true;
  allow_youtube_network_call: true;
  allow_media_stat: true;
  allow_safe_summary_storage: true;
  upload_execution_enabled: false;
}

export interface YouTubeLivePreflightAccountStatus {
  account_reference_found: boolean;
  token_reference_found: boolean;
  token_status: "valid" | "expired" | "revoked" | "missing" | "unknown";
  safe_account_summary: string;
}

export interface YouTubeLivePreflightMediaStat {
  media_reference_found: boolean;
  byte_size: number | null;
  mime_type: string | null;
  safe_media_summary: string;
}

export interface YouTubeLivePreflightChannelIdentity {
  channel_found: boolean;
  channel_id_matches_expected: boolean | null;
  safe_channel_summary: string;
}

export interface YouTubeLivePreflightStoredSummary {
  stored: boolean;
  storage_reference: string | null;
  safe_storage_summary: string;
}

export interface YouTubeLivePreflightCheck {
  check_id: string;
  check_kind: YouTubeLivePreflightCheckKind;
  check_state: YouTubeLivePreflightCheckState;
  safe_summary: string;
  secret_material_exposed: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  upload_executed: false;
}

export interface YouTubeLivePreflightResult {
  schema_version: "1.0";
  live_preflight_result_id: string;
  live_preflight_plan_safe_report_id: string;
  live_preflight_plan_id: string;
  request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: "youtube";
  platform_account_id: string;
  created_at: string;
  preflight_state: YouTubeLivePreflightState;
  live_preflight_executed: boolean;
  account_reference_checked: boolean;
  token_status_checked: boolean;
  media_stat_performed: boolean;
  youtube_channel_identity_checked: boolean;
  youtube_network_called: boolean;
  safe_summary_stored: boolean;
  upload_execution_enabled: false;
  upload_executed: false;
  real_upload_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  secret_material_exposed: false;
  account_status: YouTubeLivePreflightAccountStatus;
  media_stat: YouTubeLivePreflightMediaStat;
  channel_identity: YouTubeLivePreflightChannelIdentity;
  stored_summary: YouTubeLivePreflightStoredSummary;
  checks: YouTubeLivePreflightCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "runYouTubeLivePreflight" | "revokeYouTubeLivePreflightResult"; source_plan_safe_report_id: string };
}

export interface YouTubeLivePreflightAccountProbe {
  checkAccountReference(input: { project_id: string; platform_account_id: string; account_reference_label: string; token_reference_label: string }): Promise<YouTubeLivePreflightAccountStatus> | YouTubeLivePreflightAccountStatus;
}

export interface YouTubeLivePreflightMediaProbe {
  statMediaReference(input: { project_id: string; render_plan_id: string; media_reference_path: string }): Promise<YouTubeLivePreflightMediaStat> | YouTubeLivePreflightMediaStat;
}

export interface YouTubeLivePreflightYouTubeProbe {
  checkChannelIdentity(input: { platform_account_id: string; expected_youtube_channel_id?: string }): Promise<YouTubeLivePreflightChannelIdentity> | YouTubeLivePreflightChannelIdentity;
}

export interface YouTubeLivePreflightSummaryStore {
  storeSafeSummary(input: { request_id: string; project_id: string; render_plan_id: string; safe_summary: string }): Promise<YouTubeLivePreflightStoredSummary> | YouTubeLivePreflightStoredSummary;
}

export interface YouTubeLivePreflightAdapters {
  accountProbe: YouTubeLivePreflightAccountProbe;
  mediaProbe: YouTubeLivePreflightMediaProbe;
  youtubeProbe: YouTubeLivePreflightYouTubeProbe;
  summaryStore: YouTubeLivePreflightSummaryStore;
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeNumber(value: number | null | undefined): number | null { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
function safeBoolean(value: boolean | null | undefined): boolean | null { return typeof value === "boolean" ? value : null; }

function planReady(report: YouTubeLivePreflightImplementationPlanSafeReport, plan: YouTubeLivePreflightImplementationPlan): boolean {
  return report.safe_report_state === "requires_operator_confirmation_for_live_preflight_implementation"
    && report.validation.complete
    && !report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.live_preflight_implemented_now
    && !report.live_preflight_executed_now
    && !report.upload_execution_enabled_now
    && !report.raw_payload_storage_enabled_now
    && !report.raw_response_storage_enabled_now
    && !report.package_metadata_changed_now
    && !report.dependency_changes_now
    && plan.plan_state === "approved_for_future_live_preflight_implementation"
    && plan.validation.complete
    && plan.validation.ready_for_next_phase
    && plan.explicit_operator_confirmation_required_for_implementation
    && !plan.live_preflight_implemented_now
    && !plan.live_preflight_executed_now
    && !plan.upload_execution_enabled_now
    && !plan.package_metadata_changed_now
    && !plan.dependency_changes_now
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(plan.execution_boundary).every((value) => value === false);
}

function inputReady(input: YouTubeLivePreflightInput): boolean {
  return input.allow_live_preflight === true
    && input.allow_youtube_network_call === true
    && input.allow_media_stat === true
    && input.allow_safe_summary_storage === true
    && input.upload_execution_enabled === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.render_plan_id.trim().length > 0
    && input.platform_account_id.trim().length > 0
    && input.account_reference_label.trim().length > 0
    && input.token_reference_label.trim().length > 0
    && input.media_reference_path.trim().length > 0;
}

function sanitizeAccountStatus(status: YouTubeLivePreflightAccountStatus): YouTubeLivePreflightAccountStatus {
  const allowedTokenStatuses = new Set<YouTubeLivePreflightAccountStatus["token_status"]>(["valid", "expired", "revoked", "missing", "unknown"]);
  return {
    account_reference_found: Boolean(status.account_reference_found),
    token_reference_found: Boolean(status.token_reference_found),
    token_status: allowedTokenStatuses.has(status.token_status) ? status.token_status : "unknown",
    safe_account_summary: safe(status.safe_account_summary, "Account reference checked with redacted output."),
  };
}

function sanitizeMediaStat(stat: YouTubeLivePreflightMediaStat): YouTubeLivePreflightMediaStat {
  return {
    media_reference_found: Boolean(stat.media_reference_found),
    byte_size: safeNumber(stat.byte_size),
    mime_type: stat.mime_type ? safe(stat.mime_type, "application/octet-stream") : null,
    safe_media_summary: safe(stat.safe_media_summary, "Media reference stat checked with redacted output."),
  };
}

function sanitizeChannelIdentity(identity: YouTubeLivePreflightChannelIdentity): YouTubeLivePreflightChannelIdentity {
  return {
    channel_found: Boolean(identity.channel_found),
    channel_id_matches_expected: safeBoolean(identity.channel_id_matches_expected),
    safe_channel_summary: safe(identity.safe_channel_summary, "YouTube channel identity checked with redacted output."),
  };
}

function sanitizeStoredSummary(stored: YouTubeLivePreflightStoredSummary): YouTubeLivePreflightStoredSummary {
  return {
    stored: Boolean(stored.stored),
    storage_reference: stored.storage_reference ? safe(stored.storage_reference, "safe-summary-reference") : null,
    safe_storage_summary: safe(stored.safe_storage_summary, "Safe preflight summary storage checked."),
  };
}

function check(check_kind: YouTubeLivePreflightCheckKind, check_state: YouTubeLivePreflightCheckState, summary: string): YouTubeLivePreflightCheck {
  return { check_id: `youtube-live-preflight-${check_kind}`, check_kind, check_state, safe_summary: safe(summary, "YouTube live preflight check."), secret_material_exposed: false, raw_payload_stored: false, raw_response_stored: false, upload_executed: false };
}

export async function runYouTubeLivePreflight(report: YouTubeLivePreflightImplementationPlanSafeReport, plan: YouTubeLivePreflightImplementationPlan, input: YouTubeLivePreflightInput, adapters: YouTubeLivePreflightAdapters, options: { id?: string; created_at?: string } = {}): Promise<YouTubeLivePreflightResult> {
  const ready = planReady(report, plan) && inputReady(input);
  const blockingReasons = ready ? [] : ["YouTube live preflight prerequisites were not satisfied."];

  let accountStatus: YouTubeLivePreflightAccountStatus = { account_reference_found: false, token_reference_found: false, token_status: "unknown", safe_account_summary: "Account reference preflight was blocked." };
  let mediaStat: YouTubeLivePreflightMediaStat = { media_reference_found: false, byte_size: null, mime_type: null, safe_media_summary: "Media stat preflight was blocked." };
  let channelIdentity: YouTubeLivePreflightChannelIdentity = { channel_found: false, channel_id_matches_expected: null, safe_channel_summary: "YouTube channel identity preflight was blocked." };
  let storedSummary: YouTubeLivePreflightStoredSummary = { stored: false, storage_reference: null, safe_storage_summary: "Safe summary storage was blocked." };
  const checks: YouTubeLivePreflightCheck[] = [];

  if (ready) {
    accountStatus = sanitizeAccountStatus(await adapters.accountProbe.checkAccountReference({ project_id: input.project_id, platform_account_id: input.platform_account_id, account_reference_label: input.account_reference_label, token_reference_label: input.token_reference_label }));
    checks.push(check("account_reference", accountStatus.account_reference_found ? "passed" : "failed", accountStatus.safe_account_summary));
    checks.push(check("token_status", accountStatus.token_reference_found && accountStatus.token_status === "valid" ? "passed" : "failed", `Token status is ${accountStatus.token_status}.`));

    mediaStat = sanitizeMediaStat(await adapters.mediaProbe.statMediaReference({ project_id: input.project_id, render_plan_id: input.render_plan_id, media_reference_path: input.media_reference_path }));
    checks.push(check("media_stat", mediaStat.media_reference_found && mediaStat.byte_size !== null ? "passed" : "failed", mediaStat.safe_media_summary));

    const channelIdentityInput: { platform_account_id: string; expected_youtube_channel_id?: string } = { platform_account_id: input.platform_account_id };
    if (input.expected_youtube_channel_id) channelIdentityInput.expected_youtube_channel_id = input.expected_youtube_channel_id;
    channelIdentity = sanitizeChannelIdentity(await adapters.youtubeProbe.checkChannelIdentity(channelIdentityInput));
    checks.push(check("youtube_channel_identity", channelIdentity.channel_found && channelIdentity.channel_id_matches_expected !== false ? "passed" : "failed", channelIdentity.safe_channel_summary));
    checks.push(check("youtube_network", channelIdentity.channel_found ? "passed" : "failed", "YouTube-only network preflight completed through injected adapter."));
    checks.push(check("upload_guard", "passed", "Upload execution remained disabled during live preflight."));

    const safeSummary = `YouTube live preflight completed for project ${safe(input.project_id, "project")} and render plan ${safe(input.render_plan_id, "render-plan")}; upload execution remained disabled.`;
    storedSummary = sanitizeStoredSummary(await adapters.summaryStore.storeSafeSummary({ request_id: input.request_id, project_id: input.project_id, render_plan_id: input.render_plan_id, safe_summary: safeSummary }));
    checks.push(check("safe_summary_storage", storedSummary.stored ? "passed" : "failed", storedSummary.safe_storage_summary));
  } else {
    for (const kind of ["account_reference", "token_status", "media_stat", "youtube_channel_identity", "youtube_network", "safe_summary_storage", "upload_guard"] satisfies YouTubeLivePreflightCheckKind[]) checks.push(check(kind, "blocked", "YouTube live preflight check was blocked by prerequisites."));
  }

  const allPassed = checks.every((item) => item.check_state === "passed");
  return {
    schema_version: "1.0",
    live_preflight_result_id: safe(options.id, "youtube-live-preflight-result-001"),
    live_preflight_plan_safe_report_id: report.live_preflight_plan_safe_report_id,
    live_preflight_plan_id: plan.live_preflight_plan_id,
    request_id: safe(input.request_id, "youtube-live-preflight-request"),
    project_id: safe(input.project_id, "project"),
    render_plan_id: safe(input.render_plan_id, "render-plan"),
    platform: "youtube",
    platform_account_id: safe(input.platform_account_id, "platform-account"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    preflight_state: ready && allPassed ? "completed" : "blocked",
    live_preflight_executed: ready,
    account_reference_checked: ready,
    token_status_checked: ready,
    media_stat_performed: ready,
    youtube_channel_identity_checked: ready,
    youtube_network_called: ready,
    safe_summary_stored: ready && storedSummary.stored,
    upload_execution_enabled: false,
    upload_executed: false,
    real_upload_enabled: false,
    raw_payload_stored: false,
    raw_response_stored: false,
    secret_material_exposed: false,
    account_status: accountStatus,
    media_stat: mediaStat,
    channel_identity: channelIdentity,
    stored_summary: storedSummary,
    checks,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready && allPassed, ready_for_next_phase: ready && allPassed, ready_for_real_upload: false, blocking_reasons: ready && allPassed ? [] : blockingReasons, warnings: ["Live preflight may check redacted references, media stat, YouTube identity, YouTube-only network/API preflight, and safe-summary storage, but upload execution remains disabled."] },
    provenance: { generated_by: "runYouTubeLivePreflight", source_plan_safe_report_id: report.live_preflight_plan_safe_report_id },
  };
}

export function revokeYouTubeLivePreflightResult(result: YouTubeLivePreflightResult, reason?: string): YouTubeLivePreflightResult {
  return { ...result, preflight_state: "revoked", upload_execution_enabled: false, upload_executed: false, real_upload_enabled: false, raw_payload_stored: false, raw_response_stored: false, secret_material_exposed: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "YouTube live preflight result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeYouTubeLivePreflightResult" } };
}


export type YouTubeLivePreflightReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubeLivePreflightSafeReportState = "complete" | "approved_for_first_upload_boundary" | "blocked" | "revoked";
export type YouTubeFirstUploadBoundaryState = "requires_operator_confirmation" | "blocked" | "revoked";

export interface YouTubeLivePreflightReview {
  schema_version: "1.0";
  live_preflight_review_id: string;
  live_preflight_result_id: string;
  created_at: string;
  review_state: YouTubeLivePreflightReviewState;
  review_only: true;
  live_preflight_executed: boolean;
  upload_execution_enabled: false;
  upload_executed: false;
  ready_for_real_upload: false;
  reviewed_check_ids: string[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeLivePreflightReview" | "revokeYouTubeLivePreflightReview"; source_result_id: string };
}

export interface YouTubeLivePreflightSafeReport {
  schema_version: "1.0";
  live_preflight_safe_report_id: string;
  live_preflight_review_id: string;
  live_preflight_result_id: string;
  created_at: string;
  safe_report_state: YouTubeLivePreflightSafeReportState;
  safe_report_only: true;
  live_preflight_executed: boolean;
  account_reference_checked: boolean;
  token_status_checked: boolean;
  media_stat_performed: boolean;
  youtube_channel_identity_checked: boolean;
  youtube_network_called: boolean;
  safe_summary_stored: boolean;
  upload_execution_enabled: false;
  upload_executed: false;
  real_upload_enabled: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  secret_material_exposed: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeLivePreflightSafeReport" | "revokeYouTubeLivePreflightSafeReport"; source_review_id: string };
}

export interface YouTubeFirstControlledUploadBoundary {
  schema_version: "1.0";
  first_upload_boundary_id: string;
  live_preflight_safe_report_id: string;
  created_at: string;
  boundary_state: YouTubeFirstUploadBoundaryState;
  boundary_only: true;
  explicit_operator_confirmation_required: true;
  single_upload_attempt_only: true;
  scheduled_first_private_fallback: true;
  upload_execution_enabled_now: false;
  upload_executed_now: false;
  real_upload_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  media_read_enabled_now: false;
  raw_payload_storage_enabled_now: false;
  raw_response_storage_enabled_now: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeFirstControlledUploadBoundary" | "revokeYouTubeFirstControlledUploadBoundary"; source_safe_report_id: string };
}

function livePreflightResultReady(result: YouTubeLivePreflightResult): boolean {
  return result.preflight_state === "completed" && result.validation.complete && result.validation.ready_for_next_phase && !result.validation.ready_for_real_upload && result.live_preflight_executed && result.account_reference_checked && result.token_status_checked && result.media_stat_performed && result.youtube_channel_identity_checked && result.youtube_network_called && result.safe_summary_stored && !result.upload_execution_enabled && !result.upload_executed && !result.real_upload_enabled && !result.raw_payload_stored && !result.raw_response_stored && !result.secret_material_exposed;
}

function livePreflightReviewReady(review: YouTubeLivePreflightReview): boolean {
  return review.review_state === "approved_for_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && !review.ready_for_real_upload && !review.upload_execution_enabled && !review.upload_executed;
}

export function createYouTubeLivePreflightReview(result: YouTubeLivePreflightResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubeLivePreflightReview {
  const ready = livePreflightResultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", live_preflight_review_id: safe(options.id, "youtube-live-preflight-review-001"), live_preflight_result_id: result.live_preflight_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, live_preflight_executed: result.live_preflight_executed, upload_execution_enabled: false, upload_executed: false, ready_for_real_upload: false, reviewed_check_ids: result.checks.map((item) => item.check_id), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube live preflight result was not ready for review."], warnings: ["Review does not enable upload execution."] }, provenance: { generated_by: "createYouTubeLivePreflightReview", source_result_id: result.live_preflight_result_id } };
}

export function createYouTubeLivePreflightSafeReport(review: YouTubeLivePreflightReview, result: YouTubeLivePreflightResult, options: { id?: string; created_at?: string; requestFirstUploadBoundary?: boolean } = {}): YouTubeLivePreflightSafeReport {
  const ready = livePreflightReviewReady(review) && livePreflightResultReady(result);
  const readyForNext = ready && options.requestFirstUploadBoundary !== false;
  return { schema_version: "1.0", live_preflight_safe_report_id: safe(options.id, "youtube-live-preflight-safe-report-001"), live_preflight_review_id: review.live_preflight_review_id, live_preflight_result_id: result.live_preflight_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_first_upload_boundary" : ready ? "complete" : "blocked", safe_report_only: true, live_preflight_executed: result.live_preflight_executed, account_reference_checked: result.account_reference_checked, token_status_checked: result.token_status_checked, media_stat_performed: result.media_stat_performed, youtube_channel_identity_checked: result.youtube_channel_identity_checked, youtube_network_called: result.youtube_network_called, safe_summary_stored: result.safe_summary_stored, upload_execution_enabled: false, upload_executed: false, real_upload_enabled: false, raw_payload_stored: false, raw_response_stored: false, secret_material_exposed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube live preflight review was not ready for safe report."], warnings: ["Safe report can only approve a first upload boundary, not upload execution."] }, provenance: { generated_by: "createYouTubeLivePreflightSafeReport", source_review_id: review.live_preflight_review_id } };
}

export function createYouTubeFirstControlledUploadBoundary(report: YouTubeLivePreflightSafeReport, options: { id?: string; created_at?: string } = {}): YouTubeFirstControlledUploadBoundary {
  const ready = report.safe_report_state === "approved_for_first_upload_boundary" && report.validation.complete && report.validation.ready_for_next_phase && !report.ready_for_real_upload && !report.upload_execution_enabled && !report.upload_executed && !report.real_upload_enabled;
  return { schema_version: "1.0", first_upload_boundary_id: safe(options.id, "youtube-first-controlled-upload-boundary-001"), live_preflight_safe_report_id: report.live_preflight_safe_report_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), boundary_state: ready ? "requires_operator_confirmation" : "blocked", boundary_only: true, explicit_operator_confirmation_required: true, single_upload_attempt_only: true, scheduled_first_private_fallback: true, upload_execution_enabled_now: false, upload_executed_now: false, real_upload_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, media_read_enabled_now: false, raw_payload_storage_enabled_now: false, raw_response_storage_enabled_now: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before first controlled upload implementation."] : ["YouTube live preflight safe report was not ready for first upload boundary."], warnings: ["Stop here before upload execution, media read upload payload creation, or videos.insert execution."] }, provenance: { generated_by: "createYouTubeFirstControlledUploadBoundary", source_safe_report_id: report.live_preflight_safe_report_id } };
}

export function revokeYouTubeLivePreflightReview(review: YouTubeLivePreflightReview, reason?: string): YouTubeLivePreflightReview { return { ...review, review_state: "revoked", upload_execution_enabled: false, upload_executed: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "YouTube live preflight review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeLivePreflightReview" } }; }
export function revokeYouTubeLivePreflightSafeReport(report: YouTubeLivePreflightSafeReport, reason?: string): YouTubeLivePreflightSafeReport { return { ...report, safe_report_state: "revoked", upload_execution_enabled: false, upload_executed: false, real_upload_enabled: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "YouTube live preflight safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubeLivePreflightSafeReport" } }; }
export function revokeYouTubeFirstControlledUploadBoundary(boundary: YouTubeFirstControlledUploadBoundary, reason?: string): YouTubeFirstControlledUploadBoundary { return { ...boundary, boundary_state: "revoked", upload_execution_enabled_now: false, upload_executed_now: false, real_upload_enabled_now: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: boundary.validation.blocking_reasons, warnings: [...boundary.validation.warnings, safe(reason, "YouTube first controlled upload boundary was revoked.")] }, provenance: { ...boundary.provenance, generated_by: "revokeYouTubeFirstControlledUploadBoundary" } }; }