import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

export type VideoOrchestratorPlatform = "youtube" | "tiktok" | "pinterest" | "instagram" | "facebook" | "linkedin" | "x" | "bluesky" | "custom";
export type VideoOrchestratorCredentialMode = "oauth_preferred" | "manual_api_key" | "rss_feed" | "browser_assisted" | "manual_only";
export type VideoOrchestratorConnectionState = "disconnected" | "setup_required" | "auth_started" | "connected" | "expired" | "revoked" | "invalid_scope" | "blocked";
export type VideoOrchestratorUploadGateState = "disabled" | "ready_for_preflight_design" | "blocked" | "revoked";
export type VideoOrchestratorAccountModelDesignState = "created" | "approved_for_legacy_mapping_design" | "blocked" | "revoked";
export type VideoOrchestratorAccountModelReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorAccountModelSafeReportState = "complete" | "approved_for_says_the_bible_mapping_design" | "blocked" | "revoked";

export interface VideoOrchestratorCredentialReferenceDesign {
  credential_reference_id: string;
  credential_mode: VideoOrchestratorCredentialMode;
  safe_label: string;
  oauth_preferred: boolean;
  manual_setup_deep_link: string | null;
  manual_setup_summary: string;
  raw_secret_present: false;
  token_present: false;
  env_written_now: false;
  oauth_started_now: false;
  token_exchange_enabled_now: false;
}

export interface VideoOrchestratorPlatformAccountDesign {
  platform_account_id: string;
  platform: VideoOrchestratorPlatform;
  account_label: string;
  credential_reference_id: string;
  connection_state: VideoOrchestratorConnectionState;
  upload_gate_state: VideoOrchestratorUploadGateState;
  scheduled_upload_supported: boolean;
  private_or_draft_fallback_supported: boolean;
  multiple_accounts_allowed: true;
  upload_execution_enabled_now: false;
  credential_access_enabled_now: false;
  network_access_enabled_now: false;
  platform_api_access_enabled_now: false;
}

export interface VideoOrchestratorProjectAccountDesign {
  project_id: string;
  project_label: string;
  platform_accounts: VideoOrchestratorPlatformAccountDesign[];
  shared_media_reuse_preferred: true;
  upload_execution_enabled_now: false;
  project_upload_gate_enabled_now: false;
}

export interface VideoOrchestratorAccountModelDesign {
  schema_version: "1.0";
  account_model_design_id: string;
  created_at: string;
  design_state: VideoOrchestratorAccountModelDesignState;
  design_only: true;
  dashboard_ui_design_only: true;
  database_migrations_added: false;
  oauth_callbacks_added: false;
  secret_storage_added: false;
  env_writes_enabled: false;
  upload_execution_enabled: false;
  network_calls_enabled: false;
  platform_api_calls_enabled: false;
  credential_access_enabled: false;
  media_reads_enabled: false;
  projects: VideoOrchestratorProjectAccountDesign[];
  credential_references: VideoOrchestratorCredentialReferenceDesign[];
  dashboard_sections: string[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountModelDesign" | "revokeVideoOrchestratorAccountModelDesign"; source_phase: "VO-7BX" };
}

export interface VideoOrchestratorAccountModelReview {
  schema_version: "1.0";
  account_model_review_id: string;
  account_model_design_id: string;
  created_at: string;
  review_state: VideoOrchestratorAccountModelReviewState;
  review_only: true;
  reviewed_sections: string[];
  database_migrations_added: false;
  oauth_callbacks_added: false;
  secret_storage_added: false;
  upload_execution_enabled: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  execution_boundary: DisabledEnablementBoundary;
  provenance: { generated_by: "createVideoOrchestratorAccountModelReview" | "revokeVideoOrchestratorAccountModelReview"; source_design_id: string };
}

export interface VideoOrchestratorAccountModelSafeReport {
  schema_version: "1.0";
  account_model_safe_report_id: string;
  account_model_review_id: string;
  account_model_design_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorAccountModelSafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  database_migrations_added: false;
  oauth_callbacks_added: false;
  secret_storage_added: false;
  upload_execution_enabled: false;
  network_calls_enabled: false;
  platform_api_calls_enabled: false;
  credential_access_enabled: false;
  media_reads_enabled: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  execution_boundary: DisabledEnablementBoundary;
  provenance: { generated_by: "createVideoOrchestratorAccountModelSafeReport" | "revokeVideoOrchestratorAccountModelSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  runtime_enabled: false,
  runtime_executed: false,
  upload_allowed: false,
  upload_execution_enabled: false,
  platform_api_calls_allowed: false,
  network_calls_allowed: false,
  credentials_accessed: false,
  token_accessed: false,
  keychain_accessed: false,
  env_accessed: false,
  media_file_read: false,
  file_mutation_allowed: false,
  dependencies_added: false,
  package_metadata_changed: false,
};

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function sanitizeDeepLink(value: string | undefined): string | null {
  const sanitized = sanitizeSafeSummary(value, "");
  if (!sanitized) return null;
  if (!/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9._~:/?#\[\]@!$&'()*+,;=-]*)?$/i.test(sanitized)) return null;
  return sanitized;
}

function makeCredentialReference(platform: VideoOrchestratorPlatform): VideoOrchestratorCredentialReferenceDesign {
  const mode: VideoOrchestratorCredentialMode = platform === "pinterest" ? "rss_feed" : platform === "youtube" ? "oauth_preferred" : "oauth_preferred";
  return {
    credential_reference_id: `${platform}-credential-reference-main`,
    credential_mode: mode,
    safe_label: `${platform} main credential reference`,
    oauth_preferred: mode === "oauth_preferred",
    manual_setup_deep_link: platform === "youtube" ? "https://console.cloud.google.com/apis/credentials" : null,
    manual_setup_summary: platform === "youtube" ? "Create a Google Cloud OAuth app, enable YouTube Data API v3, and use the Video Orchestrator callback URL when implemented." : "Use the platform setup instructions when implemented.",
    raw_secret_present: false,
    token_present: false,
    env_written_now: false,
    oauth_started_now: false,
    token_exchange_enabled_now: false,
  };
}

function makePlatformAccount(projectId: string, platform: VideoOrchestratorPlatform, index: number): VideoOrchestratorPlatformAccountDesign {
  return {
    platform_account_id: `${safe(projectId, "project")}-${platform}-account-${index}`,
    platform,
    account_label: `${platform} account ${index}`,
    credential_reference_id: `${platform}-credential-reference-main`,
    connection_state: "setup_required",
    upload_gate_state: "disabled",
    scheduled_upload_supported: platform === "youtube",
    private_or_draft_fallback_supported: true,
    multiple_accounts_allowed: true,
    upload_execution_enabled_now: false,
    credential_access_enabled_now: false,
    network_access_enabled_now: false,
    platform_api_access_enabled_now: false,
  };
}

function designReady(design: VideoOrchestratorAccountModelDesign): boolean {
  const hasProjects = design.projects.length > 0;
  const hasAccounts = design.projects.every((project) => project.platform_accounts.length > 0);
  const allDisabled = !design.database_migrations_added && !design.oauth_callbacks_added && !design.secret_storage_added && !design.env_writes_enabled && !design.upload_execution_enabled && !design.network_calls_enabled && !design.platform_api_calls_enabled && !design.credential_access_enabled && !design.media_reads_enabled;
  const accountBoundariesDisabled = design.projects.every((project) => !project.upload_execution_enabled_now && !project.project_upload_gate_enabled_now && project.platform_accounts.every((account) => !account.upload_execution_enabled_now && !account.credential_access_enabled_now && !account.network_access_enabled_now && !account.platform_api_access_enabled_now));
  return design.design_state === "approved_for_legacy_mapping_design" && design.validation.complete && design.validation.ready_for_next_phase && hasProjects && hasAccounts && allDisabled && accountBoundariesDisabled && Object.values(design.execution_boundary).every((value) => value === false);
}

function reviewReady(review: VideoOrchestratorAccountModelReview): boolean {
  return review.review_state === "approved_for_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && !review.validation.ready_for_real_upload && review.reviewed_sections.length >= 5 && Object.values(review.execution_boundary).every((value) => value === false);
}

export function createVideoOrchestratorAccountModelDesign(options: {
  id?: string;
  created_at?: string;
  projects?: Array<{ project_id: string; project_label: string; platforms: VideoOrchestratorPlatform[] }>;
  requestLegacyMappingDesign?: boolean;
} = {}): VideoOrchestratorAccountModelDesign {
  const requestedProjects = options.projects && options.projects.length > 0
    ? options.projects
    : [{ project_id: "says-the-bible", project_label: "Says the Bible", platforms: ["youtube", "pinterest", "facebook"] as VideoOrchestratorPlatform[] }];
  const projects: VideoOrchestratorProjectAccountDesign[] = requestedProjects.map((project) => ({
    project_id: safe(project.project_id, "project"),
    project_label: safe(project.project_label, "Project"),
    platform_accounts: project.platforms.map((platform, index) => makePlatformAccount(project.project_id, platform, index + 1)),
    shared_media_reuse_preferred: true,
    upload_execution_enabled_now: false,
    project_upload_gate_enabled_now: false,
  }));
  const credentialPlatforms = [...new Set(projects.flatMap((project) => project.platform_accounts.map((account) => account.platform)))];
  const credential_references = credentialPlatforms.map(makeCredentialReference).map((reference) => ({
    ...reference,
    credential_reference_id: safe(reference.credential_reference_id, "credential-reference"),
    safe_label: safe(reference.safe_label, "credential reference"),
    manual_setup_deep_link: sanitizeDeepLink(reference.manual_setup_deep_link ?? undefined),
    manual_setup_summary: safe(reference.manual_setup_summary, "Manual setup instructions pending."),
  }));
  const ready = projects.length > 0 && projects.every((project) => project.platform_accounts.length > 0);
  const readyForNext = ready && options.requestLegacyMappingDesign !== false;
  return {
    schema_version: "1.0",
    account_model_design_id: safe(options.id, "video-orchestrator-account-model-design-001"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    design_state: readyForNext ? "approved_for_legacy_mapping_design" : ready ? "created" : "blocked",
    design_only: true,
    dashboard_ui_design_only: true,
    database_migrations_added: false,
    oauth_callbacks_added: false,
    secret_storage_added: false,
    env_writes_enabled: false,
    upload_execution_enabled: false,
    network_calls_enabled: false,
    platform_api_calls_enabled: false,
    credential_access_enabled: false,
    media_reads_enabled: false,
    projects,
    credential_references,
    dashboard_sections: [
      "Projects",
      "Platform Accounts",
      "Credential Health",
      "OAuth Connect",
      "API Setup Instructions",
      "Account Limits",
      "Upload Gates",
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["At least one project with at least one platform account is required."], warnings: [] },
    provenance: { generated_by: "createVideoOrchestratorAccountModelDesign", source_phase: "VO-7BX" },
  };
}

export function createVideoOrchestratorAccountModelReview(design: VideoOrchestratorAccountModelDesign, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorAccountModelReview {
  const ready = designReady(design);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    account_model_review_id: safe(options.id, "video-orchestrator-account-model-review-001"),
    account_model_design_id: design.account_model_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    reviewed_sections: ["projects", "platform_accounts", "credential_references", "dashboard_sections", "upload_gates", "secret_boundaries"],
    database_migrations_added: false,
    oauth_callbacks_added: false,
    secret_storage_added: false,
    upload_execution_enabled: false,
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account model design was not ready for review."], warnings: [] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { generated_by: "createVideoOrchestratorAccountModelReview", source_design_id: design.account_model_design_id },
  };
}

export function createVideoOrchestratorAccountModelSafeReport(review: VideoOrchestratorAccountModelReview, design: VideoOrchestratorAccountModelDesign, options: { id?: string; created_at?: string; requestSaysTheBibleMappingDesign?: boolean } = {}): VideoOrchestratorAccountModelSafeReport {
  const ready = reviewReady(review) && designReady(design);
  const readyForNext = ready && options.requestSaysTheBibleMappingDesign !== false;
  return {
    schema_version: "1.0",
    account_model_safe_report_id: safe(options.id, "video-orchestrator-account-model-safe-report-001"),
    account_model_review_id: review.account_model_review_id,
    account_model_design_id: design.account_model_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_says_the_bible_mapping_design" : ready ? "complete" : "blocked",
    safe_report_only: true,
    summary_sections: ["project model", "platform account model", "credential reference model", "dashboard design", "upload gates", "secret boundaries"],
    database_migrations_added: false,
    oauth_callbacks_added: false,
    secret_storage_added: false,
    upload_execution_enabled: false,
    network_calls_enabled: false,
    platform_api_calls_enabled: false,
    credential_access_enabled: false,
    media_reads_enabled: false,
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account model review was not ready for safe report."], warnings: [] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { generated_by: "createVideoOrchestratorAccountModelSafeReport", source_review_id: review.account_model_review_id },
  };
}

export function revokeVideoOrchestratorAccountModelDesign(design: VideoOrchestratorAccountModelDesign, reason?: string): VideoOrchestratorAccountModelDesign {
  return { ...design, design_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: design.validation.blocking_reasons, warnings: [...design.validation.warnings, safe(reason, "Account model design was revoked.")] }, provenance: { ...design.provenance, generated_by: "revokeVideoOrchestratorAccountModelDesign" } };
}

export function revokeVideoOrchestratorAccountModelReview(review: VideoOrchestratorAccountModelReview, reason?: string): VideoOrchestratorAccountModelReview {
  return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Account model review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorAccountModelReview" } };
}

export function revokeVideoOrchestratorAccountModelSafeReport(report: VideoOrchestratorAccountModelSafeReport, reason?: string): VideoOrchestratorAccountModelSafeReport {
  return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Account model safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorAccountModelSafeReport" } };
}
