import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubePreflightContracts, YouTubePreflightContractSafeReport } from "./video-orchestrator-youtube-preflight-contracts.js";

export type YouTubeLivePreflightBoundaryState = "created" | "requires_operator_confirmation" | "blocked" | "revoked";
export type YouTubeLivePreflightBoundaryReviewState = "ready_for_operator_review" | "requires_operator_confirmation" | "blocked" | "revoked";
export type YouTubeLivePreflightBoundaryControlKind = "allowed_files" | "secret_access" | "media_stat" | "media_read" | "network_call" | "platform_api_call" | "redaction" | "storage" | "rollback";

export interface YouTubeLivePreflightBoundaryControl {
  control_id: string;
  control_kind: YouTubeLivePreflightBoundaryControlKind;
  safe_summary: string;
  implemented_now: false;
  requires_future_confirmation: true;
  secret_access_enabled_now: false;
  media_read_enabled_now: false;
  network_call_enabled_now: false;
  platform_api_call_enabled_now: false;
  upload_execution_enabled_now: false;
}

export interface YouTubeLivePreflightBoundary {
  schema_version: "1.0";
  live_preflight_boundary_id: string;
  youtube_preflight_safe_report_id: string;
  youtube_preflight_contracts_id: string;
  created_at: string;
  boundary_state: YouTubeLivePreflightBoundaryState;
  boundary_only: true;
  explicit_operator_confirmation_required: true;
  live_preflight_implemented_now: false;
  live_preflight_enabled_now: false;
  exact_files_approved_now: false;
  secret_access_enabled_now: false;
  token_access_enabled_now: false;
  env_access_enabled_now: false;
  keychain_access_enabled_now: false;
  media_stat_enabled_now: false;
  media_read_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  raw_payload_storage_enabled_now: false;
  raw_response_storage_enabled_now: false;
  boundary_controls: YouTubeLivePreflightBoundaryControl[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeLivePreflightBoundary" | "revokeYouTubeLivePreflightBoundary"; source_preflight_safe_report_id: string };
}

export interface YouTubeLivePreflightBoundaryReview {
  schema_version: "1.0";
  live_preflight_boundary_review_id: string;
  live_preflight_boundary_id: string;
  created_at: string;
  review_state: YouTubeLivePreflightBoundaryReviewState;
  review_only: true;
  explicit_operator_confirmation_required: true;
  live_preflight_implemented_now: false;
  live_preflight_enabled_now: false;
  secret_access_enabled_now: false;
  media_read_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  reviewed_control_ids: string[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: false; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubeLivePreflightBoundaryReview" | "revokeYouTubeLivePreflightBoundaryReview"; source_boundary_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function safeReportReady(report: YouTubePreflightContractSafeReport, contracts: YouTubePreflightContracts): boolean {
  return report.safe_report_state === "approved_for_live_preflight_boundary"
    && report.validation.complete
    && report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.live_preflight_enabled_now
    && !report.secret_access_enabled_now
    && !report.token_access_enabled_now
    && !report.env_access_enabled_now
    && !report.keychain_access_enabled_now
    && !report.media_read_enabled_now
    && !report.network_calls_enabled_now
    && !report.platform_api_calls_enabled_now
    && !report.upload_execution_enabled_now
    && !report.raw_payload_storage_enabled_now
    && !report.raw_response_storage_enabled_now
    && contracts.contracts_state === "approved_for_preflight_review"
    && contracts.validation.complete
    && !contracts.live_preflight_enabled_now
    && !contracts.secret_access_enabled_now
    && !contracts.media_read_enabled_now
    && !contracts.network_calls_enabled_now
    && !contracts.platform_api_calls_enabled_now
    && !contracts.upload_execution_enabled_now
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(contracts.execution_boundary).every((value) => value === false);
}

function boundaryReady(boundary: YouTubeLivePreflightBoundary): boolean {
  return boundary.boundary_state === "requires_operator_confirmation"
    && boundary.validation.complete
    && !boundary.validation.ready_for_next_phase
    && boundary.explicit_operator_confirmation_required
    && boundary.boundary_controls.length >= 9
    && boundary.boundary_controls.every((control) => !control.implemented_now && control.requires_future_confirmation && !control.secret_access_enabled_now && !control.media_read_enabled_now && !control.network_call_enabled_now && !control.platform_api_call_enabled_now && !control.upload_execution_enabled_now)
    && !boundary.live_preflight_implemented_now
    && !boundary.live_preflight_enabled_now
    && !boundary.exact_files_approved_now
    && !boundary.secret_access_enabled_now
    && !boundary.token_access_enabled_now
    && !boundary.env_access_enabled_now
    && !boundary.keychain_access_enabled_now
    && !boundary.media_stat_enabled_now
    && !boundary.media_read_enabled_now
    && !boundary.network_calls_enabled_now
    && !boundary.platform_api_calls_enabled_now
    && !boundary.upload_execution_enabled_now
    && !boundary.raw_payload_storage_enabled_now
    && !boundary.raw_response_storage_enabled_now
    && Object.values(boundary.execution_boundary).every((value) => value === false);
}

function controls(): YouTubeLivePreflightBoundaryControl[] {
  return [
    ["allowed_files", "Future live preflight must name exact implementation files before writing."],
    ["secret_access", "Future secret access must be separately confirmed and redacted."],
    ["media_stat", "Future media stat checks must be limited to approved generated artifact references."],
    ["media_read", "Future media reads remain forbidden until separately approved."],
    ["network_call", "Future network calls must be limited to explicit YouTube preflight operations."],
    ["platform_api_call", "Future platform API calls must be limited to explicit YouTube preflight operations."],
    ["redaction", "Future live preflight output must redact account, token, raw response, and path-sensitive values."],
    ["storage", "Future live preflight storage must contain safe summaries only."],
    ["rollback", "Future live preflight implementation must be removable without affecting upload execution."],
  ].map(([control_kind, safe_summary]) => ({ control_id: `youtube-live-preflight-boundary-${control_kind}`, control_kind: control_kind as YouTubeLivePreflightBoundaryControlKind, safe_summary: safe(safe_summary, "Live preflight boundary control."), implemented_now: false, requires_future_confirmation: true, secret_access_enabled_now: false, media_read_enabled_now: false, network_call_enabled_now: false, platform_api_call_enabled_now: false, upload_execution_enabled_now: false }));
}

export function createYouTubeLivePreflightBoundary(report: YouTubePreflightContractSafeReport, contracts: YouTubePreflightContracts, options: { id?: string; created_at?: string } = {}): YouTubeLivePreflightBoundary {
  const ready = safeReportReady(report, contracts);
  return {
    schema_version: "1.0",
    live_preflight_boundary_id: safe(options.id, "youtube-live-preflight-boundary-001"),
    youtube_preflight_safe_report_id: report.youtube_preflight_safe_report_id,
    youtube_preflight_contracts_id: contracts.youtube_preflight_contracts_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    boundary_state: ready ? "requires_operator_confirmation" : "blocked",
    boundary_only: true,
    explicit_operator_confirmation_required: true,
    live_preflight_implemented_now: false,
    live_preflight_enabled_now: false,
    exact_files_approved_now: false,
    secret_access_enabled_now: false,
    token_access_enabled_now: false,
    env_access_enabled_now: false,
    keychain_access_enabled_now: false,
    media_stat_enabled_now: false,
    media_read_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    raw_payload_storage_enabled_now: false,
    raw_response_storage_enabled_now: false,
    boundary_controls: controls(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before live preflight implementation."] : ["YouTube preflight safe report was not ready for live preflight boundary."], warnings: ["Stop here before implementing secret, media, network, platform API, or live preflight behavior."] },
    provenance: { generated_by: "createYouTubeLivePreflightBoundary", source_preflight_safe_report_id: report.youtube_preflight_safe_report_id },
  };
}

export function createYouTubeLivePreflightBoundaryReview(boundary: YouTubeLivePreflightBoundary, options: { id?: string; created_at?: string } = {}): YouTubeLivePreflightBoundaryReview {
  const ready = boundaryReady(boundary);
  return {
    schema_version: "1.0",
    live_preflight_boundary_review_id: safe(options.id, "youtube-live-preflight-boundary-review-001"),
    live_preflight_boundary_id: boundary.live_preflight_boundary_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: ready ? "requires_operator_confirmation" : "blocked",
    review_only: true,
    explicit_operator_confirmation_required: true,
    live_preflight_implemented_now: false,
    live_preflight_enabled_now: false,
    secret_access_enabled_now: false,
    media_read_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    reviewed_control_ids: boundary.boundary_controls.map((control) => control.control_id),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: ready ? ["Explicit operator confirmation required before live preflight implementation."] : ["Live preflight boundary was not ready for review."], warnings: ["Review is boundary-only and does not approve live preflight execution."] },
    provenance: { generated_by: "createYouTubeLivePreflightBoundaryReview", source_boundary_id: boundary.live_preflight_boundary_id },
  };
}

export function revokeYouTubeLivePreflightBoundary(boundary: YouTubeLivePreflightBoundary, reason?: string): YouTubeLivePreflightBoundary { return { ...boundary, boundary_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: boundary.validation.blocking_reasons, warnings: [...boundary.validation.warnings, safe(reason, "YouTube live preflight boundary was revoked.")] }, provenance: { ...boundary.provenance, generated_by: "revokeYouTubeLivePreflightBoundary" } }; }
export function revokeYouTubeLivePreflightBoundaryReview(review: YouTubeLivePreflightBoundaryReview, reason?: string): YouTubeLivePreflightBoundaryReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "YouTube live preflight boundary review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubeLivePreflightBoundaryReview" } }; }
