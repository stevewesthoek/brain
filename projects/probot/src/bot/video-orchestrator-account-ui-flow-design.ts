import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { YouTubePlatformPolicyDesign, YouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";

export type AccountUiFlowDesignState = "created" | "approved_for_youtube_preflight_contracts" | "blocked" | "revoked";
export type AccountUiFlowReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type AccountUiFlowSafeReportState = "complete" | "approved_for_youtube_preflight_contracts" | "blocked" | "revoked";
export type AccountConnectionState = "disconnected" | "setup_required" | "auth_started" | "connected" | "expired" | "revoked" | "invalid_scope" | "blocked";
export type AccountUiSectionKind = "projects" | "platform_accounts" | "credential_health" | "oauth_connect" | "api_setup_instructions" | "account_limits" | "upload_gates";

export interface AccountUiSectionDesign {
  section_id: string;
  section_kind: AccountUiSectionKind;
  safe_summary: string;
  implemented_now: false;
  route_added_now: false;
  component_added_now: false;
  secret_displayed_now: false;
  token_exchange_enabled_now: false;
  env_write_enabled_now: false;
}

export interface AccountConnectionStateDesign {
  state: AccountConnectionState;
  safe_summary: string;
  exposes_secret: false;
  starts_oauth_now: false;
  reads_token_now: false;
  writes_token_now: false;
  env_write_enabled_now: false;
}

export interface AccountUiFlowDesign {
  schema_version: "1.0";
  account_ui_flow_design_id: string;
  youtube_policy_safe_report_id: string;
  youtube_policy_design_id: string;
  created_at: string;
  design_state: AccountUiFlowDesignState;
  design_only: true;
  dashboard_ui_design_only: true;
  target_platform: "youtube";
  oauth_preferred: true;
  manual_api_setup_deep_link_allowed: true;
  routes_added_now: false;
  components_added_now: false;
  oauth_callbacks_added_now: false;
  token_exchange_enabled_now: false;
  secret_storage_enabled_now: false;
  env_writes_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  secret_access_enabled_now: false;
  media_reads_enabled_now: false;
  upload_execution_enabled_now: false;
  ui_sections: AccountUiSectionDesign[];
  connection_states: AccountConnectionStateDesign[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createAccountUiFlowDesign" | "revokeAccountUiFlowDesign"; source_youtube_policy_safe_report_id: string };
}

export interface AccountUiFlowReview {
  schema_version: "1.0";
  account_ui_flow_review_id: string;
  account_ui_flow_design_id: string;
  created_at: string;
  review_state: AccountUiFlowReviewState;
  review_only: true;
  reviewed_section_ids: string[];
  routes_added_now: false;
  components_added_now: false;
  oauth_callbacks_added_now: false;
  token_exchange_enabled_now: false;
  secret_storage_enabled_now: false;
  upload_execution_enabled_now: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createAccountUiFlowReview" | "revokeAccountUiFlowReview"; source_design_id: string };
}

export interface AccountUiFlowSafeReport {
  schema_version: "1.0";
  account_ui_flow_safe_report_id: string;
  account_ui_flow_review_id: string;
  account_ui_flow_design_id: string;
  created_at: string;
  safe_report_state: AccountUiFlowSafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  routes_added_now: false;
  components_added_now: false;
  oauth_callbacks_added_now: false;
  token_exchange_enabled_now: false;
  secret_storage_enabled_now: false;
  env_writes_enabled_now: false;
  network_calls_enabled_now: false;
  platform_api_calls_enabled_now: false;
  secret_access_enabled_now: false;
  media_reads_enabled_now: false;
  upload_execution_enabled_now: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createAccountUiFlowSafeReport" | "revokeAccountUiFlowSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function policyReady(report: YouTubePlatformPolicySafeReport, policy: YouTubePlatformPolicyDesign): boolean {
  return report.safe_report_state === "approved_for_credential_oauth_ui_design"
    && report.validation.complete
    && report.validation.ready_for_next_phase
    && !report.ready_for_real_upload
    && !report.network_calls_enabled
    && !report.platform_api_calls_enabled
    && !report.credential_access_enabled
    && !report.media_reads_enabled
    && !report.upload_execution_enabled
    && policy.policy_state === "approved_for_credential_oauth_ui_design"
    && policy.target_platform === "youtube"
    && !policy.network_calls_enabled
    && !policy.platform_api_calls_enabled
    && !policy.credential_access_enabled
    && !policy.media_reads_enabled
    && !policy.upload_execution_enabled
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(policy.execution_boundary).every((value) => value === false);
}

function designReady(design: AccountUiFlowDesign): boolean {
  return design.design_state === "approved_for_youtube_preflight_contracts"
    && design.validation.complete
    && design.validation.ready_for_next_phase
    && design.ui_sections.length >= 7
    && design.connection_states.length >= 8
    && design.ui_sections.every((section) => !section.implemented_now && !section.route_added_now && !section.component_added_now && !section.secret_displayed_now && !section.token_exchange_enabled_now && !section.env_write_enabled_now)
    && design.connection_states.every((state) => !state.exposes_secret && !state.starts_oauth_now && !state.reads_token_now && !state.writes_token_now && !state.env_write_enabled_now)
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
    && Object.values(design.execution_boundary).every((value) => value === false);
}

function reviewReady(review: AccountUiFlowReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && review.reviewed_section_ids.length >= 7
    && !review.routes_added_now
    && !review.components_added_now
    && !review.oauth_callbacks_added_now
    && !review.token_exchange_enabled_now
    && !review.secret_storage_enabled_now
    && !review.upload_execution_enabled_now
    && Object.values(review.execution_boundary).every((value) => value === false);
}

function sections(): AccountUiSectionDesign[] {
  return [
    ["projects", "Projects dashboard lists production units and their platform account groups."],
    ["platform_accounts", "Platform accounts dashboard groups accounts per project and platform."],
    ["credential_health", "Connection health displays redacted account status only."],
    ["oauth_connect", "OAuth Connect is designed as a future button flow; no OAuth starts now."],
    ["api_setup_instructions", "Manual setup instructions may show platform developer-console deep links and short checklists."],
    ["account_limits", "Account limits summarize platform cadence, quota, and resume policy without enforcing now."],
    ["upload_gates", "Upload gates display global, project, account, and first-upload approval states."],
  ].map(([section_kind, safe_summary]) => ({ section_id: `account-ui-${section_kind}`, section_kind: section_kind as AccountUiSectionKind, safe_summary: safe(safe_summary, "Account UI section."), implemented_now: false, route_added_now: false, component_added_now: false, secret_displayed_now: false, token_exchange_enabled_now: false, env_write_enabled_now: false }));
}

function connectionStates(): AccountConnectionStateDesign[] {
  return ["disconnected", "setup_required", "auth_started", "connected", "expired", "revoked", "invalid_scope", "blocked"].map((state) => ({ state: state as AccountConnectionState, safe_summary: safe(`Connection state ${state} is displayed as a redacted UI status only.`, "Connection state."), exposes_secret: false, starts_oauth_now: false, reads_token_now: false, writes_token_now: false, env_write_enabled_now: false }));
}

export function createAccountUiFlowDesign(report: YouTubePlatformPolicySafeReport, policy: YouTubePlatformPolicyDesign, options: { id?: string; created_at?: string; requestYoutubePreflightContracts?: boolean } = {}): AccountUiFlowDesign {
  const ready = policyReady(report, policy);
  const readyForNext = ready && options.requestYoutubePreflightContracts !== false;
  return {
    schema_version: "1.0", account_ui_flow_design_id: safe(options.id, "account-ui-flow-design-001"), youtube_policy_safe_report_id: report.youtube_policy_safe_report_id, youtube_policy_design_id: policy.youtube_policy_design_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), design_state: readyForNext ? "approved_for_youtube_preflight_contracts" : ready ? "created" : "blocked", design_only: true, dashboard_ui_design_only: true, target_platform: "youtube", oauth_preferred: true, manual_api_setup_deep_link_allowed: true, routes_added_now: false, components_added_now: false, oauth_callbacks_added_now: false, token_exchange_enabled_now: false, secret_storage_enabled_now: false, env_writes_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, secret_access_enabled_now: false, media_reads_enabled_now: false, upload_execution_enabled_now: false, ui_sections: sections(), connection_states: connectionStates(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube platform policy safe report was not ready for account UI flow design."], warnings: ["UI design only; no dashboard route, OAuth callback, token exchange, secret storage, or env write is implemented."] }, provenance: { generated_by: "createAccountUiFlowDesign", source_youtube_policy_safe_report_id: report.youtube_policy_safe_report_id },
  };
}

export function createAccountUiFlowReview(design: AccountUiFlowDesign, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): AccountUiFlowReview {
  const ready = designReady(design);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", account_ui_flow_review_id: safe(options.id, "account-ui-flow-review-001"), account_ui_flow_design_id: design.account_ui_flow_design_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked", review_only: true, reviewed_section_ids: design.ui_sections.map((section) => section.section_id), routes_added_now: false, components_added_now: false, oauth_callbacks_added_now: false, token_exchange_enabled_now: false, secret_storage_enabled_now: false, upload_execution_enabled_now: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account UI flow design was not ready for review."], warnings: [] }, provenance: { generated_by: "createAccountUiFlowReview", source_design_id: design.account_ui_flow_design_id } };
}

export function createAccountUiFlowSafeReport(review: AccountUiFlowReview, design: AccountUiFlowDesign, options: { id?: string; created_at?: string; requestYoutubePreflightContracts?: boolean } = {}): AccountUiFlowSafeReport {
  const ready = reviewReady(review) && designReady(design);
  const readyForNext = ready && options.requestYoutubePreflightContracts !== false;
  return { schema_version: "1.0", account_ui_flow_safe_report_id: safe(options.id, "account-ui-flow-safe-report-001"), account_ui_flow_review_id: review.account_ui_flow_review_id, account_ui_flow_design_id: design.account_ui_flow_design_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_youtube_preflight_contracts" : ready ? "complete" : "blocked", safe_report_only: true, summary_sections: ["projects", "platform accounts", "connection health", "OAuth connect", "API setup instructions", "account limits", "upload gates", "secret boundaries"], routes_added_now: false, components_added_now: false, oauth_callbacks_added_now: false, token_exchange_enabled_now: false, secret_storage_enabled_now: false, env_writes_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, secret_access_enabled_now: false, media_reads_enabled_now: false, upload_execution_enabled_now: false, ready_for_real_upload: false, execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account UI flow review was not ready for safe report."], warnings: ["Future preflight contracts remain separate from live OAuth, secret, media, network, or upload behavior."] }, provenance: { generated_by: "createAccountUiFlowSafeReport", source_review_id: review.account_ui_flow_review_id } };
}

export function revokeAccountUiFlowDesign(design: AccountUiFlowDesign, reason?: string): AccountUiFlowDesign { return { ...design, design_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: design.validation.blocking_reasons, warnings: [...design.validation.warnings, safe(reason, "Account UI flow design was revoked.")] }, provenance: { ...design.provenance, generated_by: "revokeAccountUiFlowDesign" } }; }
export function revokeAccountUiFlowReview(review: AccountUiFlowReview, reason?: string): AccountUiFlowReview { return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Account UI flow review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeAccountUiFlowReview" } }; }
export function revokeAccountUiFlowSafeReport(report: AccountUiFlowSafeReport, reason?: string): AccountUiFlowSafeReport { return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Account UI flow safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeAccountUiFlowSafeReport" } }; }
