import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { AccountUiFlowDesign, AccountUiFlowSafeReport } from "./video-orchestrator-account-ui-flow-design.js";

export type YouTubePreflightContractsState = "created" | "approved_for_preflight_review" | "blocked" | "revoked";
export type YouTubePreflightReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubePreflightSafeReportState = "complete" | "approved_for_live_preflight_boundary" | "blocked" | "revoked";
export type YouTubePreflightBoundaryKind = "account_reference" | "media_reference" | "network_operation" | "platform_method" | "schedule_policy" | "idempotency" | "single_attempt" | "redaction";

export interface YouTubePreflightBoundaryContract {
  boundary_id: string;
  boundary_kind: YouTubePreflightBoundaryKind;
  safe_summary: string;
  declared_only: true;
  live_checked_now: false;
  secret_accessed_now: false;
  token_accessed_now: false;
  env_accessed_now: false;
  keychain_accessed_now: false;
  media_read_now: false;
  network_called_now: false;
  platform_api_called_now: false;
  upload_executed_now: false;
  raw_payload_stored_now: false;
  raw_response_stored_now: false;
}

export interface YouTubePreflightContracts {
  schema_version: "1.0";
  youtube_preflight_contracts_id: string;
  account_ui_flow_safe_report_id: string;
  account_ui_flow_design_id: string;
  created_at: string;
  contracts_state: YouTubePreflightContractsState;
  contracts_only: true;
  target_platform: "youtube";
  intended_platform_method: "videos.insert";
  intended_publish_mode: "scheduled_first_private_fallback";
  first_upload_attempt_limit: 1;
  live_preflight_enabled_now: false;
  secret_access_enabled_now: false;
  token_access_enabled_now: false;
  env_access_enabled_now: false;
  keychain_access_enabled_now: false;
  media_read_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  raw_payload_storage_enabled_now: false;
  raw_response_storage_enabled_now: false;
  boundary_contracts: YouTubePreflightBoundaryContract[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePreflightContracts" | "revokeYouTubePreflightContracts"; source_account_ui_flow_safe_report_id: string };
}

export interface YouTubePreflightContractReview {
  schema_version: "1.0";
  youtube_preflight_review_id: string;
  youtube_preflight_contracts_id: string;
  created_at: string;
  review_state: YouTubePreflightReviewState;
  review_only: true;
  reviewed_boundary_ids: string[];
  live_preflight_enabled_now: false;
  secret_access_enabled_now: false;
  media_read_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePreflightContractReview" | "revokeYouTubePreflightContractReview"; source_contracts_id: string };
}

export interface YouTubePreflightContractSafeReport {
  schema_version: "1.0";
  youtube_preflight_safe_report_id: string;
  youtube_preflight_review_id: string;
  youtube_preflight_contracts_id: string;
  created_at: string;
  safe_report_state: YouTubePreflightSafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  live_preflight_enabled_now: false;
  secret_access_enabled_now: false;
  token_access_enabled_now: false;
  env_access_enabled_now: false;
  keychain_access_enabled_now: false;
  media_read_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  upload_execution_enabled_now: false;
  raw_payload_storage_enabled_now: false;
  raw_response_storage_enabled_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePreflightContractSafeReport" | "revokeYouTubePreflightContractSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function uiReady(report: AccountUiFlowSafeReport, design: AccountUiFlowDesign): boolean {
  return report.safe_report_state === "approved_for_youtube_preflight_contracts"
    && report.validation.complete
    && report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.routes_added_now
    && !report.components_added_now
    && !report.oauth_callbacks_added_now
    && !report.token_exchange_enabled_now
    && !report.secret_storage_enabled_now
    && !report.env_writes_enabled_now
    && !report.network_calls_enabled_now
    && !report.platform_api_calls_enabled_now
    && !report.secret_access_enabled_now
    && !report.media_reads_enabled_now
    && !report.upload_execution_enabled_now
    && design.design_state === "approved_for_youtube_preflight_contracts"
    && !design.routes_added_now
    && !design.components_added_now
    && !design.oauth_callbacks_added_now
    && !design.token_exchange_enabled_now
    && !design.secret_storage_enabled_now
    && !design.env_writes_enabled_now
    && !design.network_calls_enabled_now
    && !design.platform_api_calls_enabled_now
    && !design.secret_access_enabled_now
    && !design.media_reads_enabled_now
    && !design.upload_execution_enabled_now
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(design.execution_boundary).every((value) => value === false);
}

function contractsReady(contracts: YouTubePreflightContracts): boolean {
  return contracts.contracts_state === "approved_for_preflight_review"
    && contracts.validation.complete
    && contracts.validation.ready_for_next_phase
    && contracts.boundary_contracts.length >= 8
    && contracts.boundary_contracts.every((boundary) => boundary.declared_only && !boundary.live_checked_now && !boundary.secret_accessed_now && !boundary.token_accessed_now && !boundary.env_accessed_now && !boundary.keychain_accessed_now && !boundary.media_read_now && !boundary.network_called_now && !boundary.platform_api_called_now && !boundary.upload_executed_now && !boundary.raw_payload_stored_now && !boundary.raw_response_stored_now)
    && !contracts.live_preflight_enabled_now
    && !contracts.secret_access_enabled_now
    && !contracts.token_access_enabled_now
    && !contracts.env_access_enabled_now
    && !contracts.keychain_access_enabled_now
    && !contracts.media_read_enabled_now
    && !contracts.network_calls_enabled_now
    && !contracts.platform_api_calls_enabled_now
    && !contracts.upload_execution_enabled_now
    && !contracts.raw_payload_storage_enabled_now
    && !contracts.raw_response_storage_enabled_now
    && Object.values(contracts.execution_boundary).every((value) => value === false);
}

function reviewReady(review: YouTubePreflightContractReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && review.reviewed_boundary_ids.length >= 8
    && !review.live_preflight_enabled_now
    && !review.secret_access_enabled_now
    && !review.media_read_enabled_now
    && !review.network_calls_enabled_now
    && !review.platform_api_calls_enabled_now
    && !review.upload_execution_enabled_now
    && Object.values(review.execution_boundary).every((value) => value === false);
}

function boundaryContracts(): YouTubePreflightBoundaryContract[] {
  return [
    ["account_reference", "Account reference is a safe label only; no secret, token, env, keychain, or OAuth material is read."],
    ["media_reference", "Media reference is an approved generated artifact reference only; no media file is read now."],
    ["network_operation", "Network operation is declared as a future YouTube preflight/upload operation only; no network call is made."],
    ["platform_method", "Platform method is declared as future videos.insert for one controlled path only; no YouTube API is called."],
    ["schedule_policy", "Scheduled-first/private-fallback policy is declared only and not enforced at runtime now."],
    ["idempotency", "Idempotency key requirements are declared for one project/render/account/platform attempt only."],
    ["single_attempt", "First upload remains limited to one future attempt and is not enabled now."],
    ["redaction", "Future live preflight output must store redacted summaries only, never raw payloads or responses."],
  ].map(([boundary_kind, safe_summary]) => ({
    boundary_id: `youtube-preflight-${boundary_kind}`,
    boundary_kind: boundary_kind as YouTubePreflightBoundaryKind,
    safe_summary: safe(safe_summary, "YouTube preflight boundary."),
    declared_only: true,
    live_checked_now: false,
    secret_accessed_now: false,
    token_accessed_now: false,
    env_accessed_now: false,
    keychain_accessed_now: false,
    media_read_now: false,
    network_called_now: false,
    platform_api_called_now: false,
    upload_executed_now: false,
    raw_payload_stored_now: false,
    raw_response_stored_now: false,
  }));
}

export function createYouTubePreflightContracts(report: AccountUiFlowSafeReport, design: AccountUiFlowDesign, options: { id?: string; created_at?: string; requestPreflightReview?: boolean } = {}): YouTubePreflightContracts {
  const ready = uiReady(report, design);
  const readyForNext = ready && options.requestPreflightReview !== false;
  return {
    schema_version: "1.0",
    youtube_preflight_contracts_id: safe(options.id, "youtube-preflight-contracts-001"),
    account_ui_flow_safe_report_id: report.account_ui_flow_safe_report_id,
    account_ui_flow_design_id: design.account_ui_flow_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    contracts_state: readyForNext ? "approved_for_preflight_review" : ready ? "created" : "blocked",
    contracts_only: true,
    target_platform: "youtube",
    intended_platform_method: "videos.insert",
    intended_publish_mode: "scheduled_first_private_fallback",
    first_upload_attempt_limit: 1,
    live_preflight_enabled_now: false,
    secret_access_enabled_now: false,
    token_access_enabled_now: false,
    env_access_enabled_now: false,
    keychain_access_enabled_now: false,
    media_read_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    raw_payload_storage_enabled_now: false,
    raw_response_storage_enabled_now: false,
    boundary_contracts: boundaryContracts(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account UI flow safe report was not ready for YouTube preflight contracts."], warnings: ["Contracts only; live preflight remains disabled."] },
    provenance: { generated_by: "createYouTubePreflightContracts", source_account_ui_flow_safe_report_id: report.account_ui_flow_safe_report_id },
  };
}

export function createYouTubePreflightContractReview(contracts: YouTubePreflightContracts, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubePreflightContractReview {
  const ready = contractsReady(contracts);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    youtube_preflight_review_id: safe(options.id, "youtube-preflight-review-001"),
    youtube_preflight_contracts_id: contracts.youtube_preflight_contracts_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    reviewed_boundary_ids: contracts.boundary_contracts.map((boundary) => boundary.boundary_id),
    live_preflight_enabled_now: false,
    secret_access_enabled_now: false,
    media_read_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube preflight contracts were not ready for review."], warnings: [] },
    provenance: { generated_by: "createYouTubePreflightContractReview", source_contracts_id: contracts.youtube_preflight_contracts_id },
  };
}

export function createYouTubePreflightContractSafeReport(review: YouTubePreflightContractReview, contracts: YouTubePreflightContracts, options: { id?: string; created_at?: string; requestLivePreflightBoundary?: boolean } = {}): YouTubePreflightContractSafeReport {
  const ready = reviewReady(review) && contractsReady(contracts);
  const readyForNext = ready && options.requestLivePreflightBoundary !== false;
  return {
    schema_version: "1.0",
    youtube_preflight_safe_report_id: safe(options.id, "youtube-preflight-safe-report-001"),
    youtube_preflight_review_id: review.youtube_preflight_review_id,
    youtube_preflight_contracts_id: contracts.youtube_preflight_contracts_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_live_preflight_boundary" : ready ? "complete" : "blocked",
    safe_report_only: true,
    summary_sections: ["account reference", "media reference", "network operation", "platform method", "schedule policy", "idempotency", "single attempt", "redaction", "live preflight still disabled"],
    live_preflight_enabled_now: false,
    secret_access_enabled_now: false,
    token_access_enabled_now: false,
    env_access_enabled_now: false,
    keychain_access_enabled_now: false,
    media_read_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    upload_execution_enabled_now: false,
    raw_payload_storage_enabled_now: false,
    raw_response_storage_enabled_now: false,
    ready_for_real_upload: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube preflight contract review was not ready for safe report."], warnings: ["Next phase is a live preflight implementation boundary and must stop for explicit confirmation before secret, media, network, platform API, or upload behavior."] },
    provenance: { generated_by: "createYouTubePreflightContractSafeReport", source_review_id: review.youtube_preflight_review_id },
  };
}

export function revokeYouTubePreflightContracts(contracts: YouTubePreflightContracts, reason?: string): YouTubePreflightContracts { return { ...contracts, contracts_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: contracts.validation.blocking_reasons, warnings: [...contracts.validation.warnings, safe(reason, "YouTube preflight contracts were revoked.")] }, provenance: { ...contracts.provenance, generated_by: "revokeYouTubePreflightContracts" } }; }
export function revokeYouTubePreflightContractReview(review: YouTubePreflightContractReview, reason?: string): YouTubePreflightContractReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "YouTube preflight contract review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubePreflightContractReview" } }; }
export function revokeYouTubePreflightContractSafeReport(report: YouTubePreflightContractSafeReport, reason?: string): YouTubePreflightContractSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "YouTube preflight contract safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubePreflightContractSafeReport" } }; }
