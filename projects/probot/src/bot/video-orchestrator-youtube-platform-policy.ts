import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { SaysTheBibleMigrationBridgeDesign, SaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";

export type YouTubePolicyDesignState = "created" | "approved_for_credential_oauth_ui_design" | "blocked" | "revoked";
export type YouTubePolicyReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type YouTubePolicySafeReportState = "complete" | "approved_for_credential_oauth_ui_design" | "blocked" | "revoked";
export type YouTubeUploadAttemptState = "planned" | "preflighted" | "queued" | "uploading" | "uploaded" | "scheduled" | "blocked" | "retryable" | "failed" | "canceled";
export type YouTubePolicyConstraintKind = "scheduling" | "quota" | "resume" | "idempotency" | "privacy" | "rate_limit" | "duplicate_prevention" | "verification";

export interface YouTubePolicyConstraint {
  constraint_id: string;
  constraint_kind: YouTubePolicyConstraintKind;
  safe_summary: string;
  enforced_now: false;
  network_called_now: false;
  platform_api_called_now: false;
  credential_accessed_now: false;
  media_read_now: false;
  upload_executed_now: false;
}

export interface YouTubePlatformPolicyDesign {
  schema_version: "1.0";
  youtube_policy_design_id: string;
  says_the_bible_mapping_safe_report_id: string;
  says_the_bible_mapping_design_id: string;
  created_at: string;
  policy_state: YouTubePolicyDesignState;
  policy_only: true;
  target_platform: "youtube";
  default_publish_mode: "scheduled_first_private_fallback";
  first_upload_attempt_limit: 1;
  upload_quota_units_per_video_insert: 100;
  scheduling_requires_private_status: true;
  unverified_api_project_private_restriction_noted: true;
  idempotency_required: true;
  resume_after_limit_window: true;
  duplicate_prevention_required: true;
  network_calls_enabled: false;
  platform_api_calls_enabled: false;
  credential_access_enabled: false;
  media_reads_enabled: false;
  upload_execution_enabled: false;
  policy_constraints: YouTubePolicyConstraint[];
  upload_attempt_states: YouTubeUploadAttemptState[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePlatformPolicyDesign" | "revokeYouTubePlatformPolicyDesign"; source_mapping_safe_report_id: string; official_docs_checked: true };
}

export interface YouTubePlatformPolicyReview {
  schema_version: "1.0";
  youtube_policy_review_id: string;
  youtube_policy_design_id: string;
  created_at: string;
  review_state: YouTubePolicyReviewState;
  review_only: true;
  reviewed_constraint_ids: string[];
  network_calls_enabled: false;
  platform_api_calls_enabled: false;
  credential_access_enabled: false;
  media_reads_enabled: false;
  upload_execution_enabled: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePlatformPolicyReview" | "revokeYouTubePlatformPolicyReview"; source_policy_design_id: string };
}

export interface YouTubePlatformPolicySafeReport {
  schema_version: "1.0";
  youtube_policy_safe_report_id: string;
  youtube_policy_review_id: string;
  youtube_policy_design_id: string;
  created_at: string;
  safe_report_state: YouTubePolicySafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  network_calls_enabled: false;
  platform_api_calls_enabled: false;
  credential_access_enabled: false;
  media_reads_enabled: false;
  upload_execution_enabled: false;
  ready_for_real_upload: false;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createYouTubePlatformPolicySafeReport" | "revokeYouTubePlatformPolicySafeReport"; source_policy_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function mappingReady(report: SaysTheBibleMigrationBridgeSafeReport, design: SaysTheBibleMigrationBridgeDesign): boolean {
  return report.safe_report_state === "approved_for_youtube_platform_policy_design"
    && report.validation.complete
    && report.validation.ready_for_next_phase
    && !report.validation.ready_for_real_upload
    && !report.legacy_repo_modified_now
    && !report.legacy_pipeline_called_now
    && !report.credentials_copied_now
    && !report.media_read_now
    && !report.network_called_now
    && !report.platform_api_called_now
    && !report.upload_executed_now
    && !report.migration_bridge_enabled_now
    && design.mapping_state === "approved_for_youtube_policy_design"
    && design.target_platform === "youtube"
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(design.execution_boundary).every((value) => value === false);
}

function policyReady(policy: YouTubePlatformPolicyDesign): boolean {
  return policy.policy_state === "approved_for_credential_oauth_ui_design"
    && policy.validation.complete
    && policy.validation.ready_for_next_phase
    && policy.default_publish_mode === "scheduled_first_private_fallback"
    && policy.first_upload_attempt_limit === 1
    && policy.upload_quota_units_per_video_insert === 100
    && policy.scheduling_requires_private_status
    && policy.unverified_api_project_private_restriction_noted
    && policy.idempotency_required
    && policy.resume_after_limit_window
    && policy.duplicate_prevention_required
    && !policy.network_calls_enabled
    && !policy.platform_api_calls_enabled
    && !policy.credential_access_enabled
    && !policy.media_reads_enabled
    && !policy.upload_execution_enabled
    && policy.policy_constraints.length >= 8
    && policy.policy_constraints.every((constraint) => !constraint.enforced_now && !constraint.network_called_now && !constraint.platform_api_called_now && !constraint.credential_accessed_now && !constraint.media_read_now && !constraint.upload_executed_now)
    && Object.values(policy.execution_boundary).every((value) => value === false);
}

function reviewReady(review: YouTubePlatformPolicyReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && review.reviewed_constraint_ids.length >= 8
    && !review.network_calls_enabled
    && !review.platform_api_calls_enabled
    && !review.credential_access_enabled
    && !review.media_reads_enabled
    && !review.upload_execution_enabled
    && Object.values(review.execution_boundary).every((value) => value === false);
}

function constraints(): YouTubePolicyConstraint[] {
  return [
    ["scheduling", "Scheduled upload is the preferred default; YouTube scheduling is represented as private upload with publish time when supported."],
    ["privacy", "If scheduling is unavailable or unsafe, private/draft fallback is preferred over public upload."],
    ["quota", "A videos.insert upload is budgeted as 100 quota units per current official documentation and legacy pipeline notes."],
    ["rate_limit", "Quota, daily limit, and rate-limit failures become blocked/retryable states instead of repeated immediate attempts."],
    ["resume", "If a limit window is hit, the next scheduled job may resume from the saved attempt state."],
    ["idempotency", "One render plan, project, platform, and account should map to one idempotency key."],
    ["duplicate_prevention", "Duplicate upload attempts are blocked unless explicitly overridden by a future operator action."],
    ["verification", "Post-upload verification should use redacted status summaries and never store raw platform responses."],
  ].map(([constraint_kind, safe_summary]) => ({
    constraint_id: `youtube-policy-${constraint_kind}`,
    constraint_kind: constraint_kind as YouTubePolicyConstraintKind,
    safe_summary: safe(safe_summary, "YouTube policy constraint."),
    enforced_now: false,
    network_called_now: false,
    platform_api_called_now: false,
    credential_accessed_now: false,
    media_read_now: false,
    upload_executed_now: false,
  }));
}

export function createYouTubePlatformPolicyDesign(report: SaysTheBibleMigrationBridgeSafeReport, mappingDesign: SaysTheBibleMigrationBridgeDesign, options: { id?: string; created_at?: string; requestCredentialOauthUiDesign?: boolean } = {}): YouTubePlatformPolicyDesign {
  const ready = mappingReady(report, mappingDesign);
  const readyForNext = ready && options.requestCredentialOauthUiDesign !== false;
  return {
    schema_version: "1.0",
    youtube_policy_design_id: safe(options.id, "youtube-platform-policy-design-001"),
    says_the_bible_mapping_safe_report_id: report.says_the_bible_mapping_safe_report_id,
    says_the_bible_mapping_design_id: mappingDesign.says_the_bible_mapping_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    policy_state: readyForNext ? "approved_for_credential_oauth_ui_design" : ready ? "created" : "blocked",
    policy_only: true,
    target_platform: "youtube",
    default_publish_mode: "scheduled_first_private_fallback",
    first_upload_attempt_limit: 1,
    upload_quota_units_per_video_insert: 100,
    scheduling_requires_private_status: true,
    unverified_api_project_private_restriction_noted: true,
    idempotency_required: true,
    resume_after_limit_window: true,
    duplicate_prevention_required: true,
    network_calls_enabled: false,
    platform_api_calls_enabled: false,
    credential_access_enabled: false,
    media_reads_enabled: false,
    upload_execution_enabled: false,
    policy_constraints: constraints(),
    upload_attempt_states: ["planned", "preflighted", "queued", "uploading", "uploaded", "scheduled", "blocked", "retryable", "failed", "canceled"],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Says the Bible mapping safe report was not ready for YouTube platform policy design."], warnings: ["Policy design only; no YouTube API calls or upload execution are enabled."] },
    provenance: { generated_by: "createYouTubePlatformPolicyDesign", source_mapping_safe_report_id: report.says_the_bible_mapping_safe_report_id, official_docs_checked: true },
  };
}

export function createYouTubePlatformPolicyReview(policy: YouTubePlatformPolicyDesign, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): YouTubePlatformPolicyReview {
  const ready = policyReady(policy);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    youtube_policy_review_id: safe(options.id, "youtube-platform-policy-review-001"),
    youtube_policy_design_id: policy.youtube_policy_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    reviewed_constraint_ids: policy.policy_constraints.map((constraint) => constraint.constraint_id),
    network_calls_enabled: false,
    platform_api_calls_enabled: false,
    credential_access_enabled: false,
    media_reads_enabled: false,
    upload_execution_enabled: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube platform policy design was not ready for review."], warnings: [] },
    provenance: { generated_by: "createYouTubePlatformPolicyReview", source_policy_design_id: policy.youtube_policy_design_id },
  };
}

export function createYouTubePlatformPolicySafeReport(review: YouTubePlatformPolicyReview, policy: YouTubePlatformPolicyDesign, options: { id?: string; created_at?: string; requestCredentialOauthUiDesign?: boolean } = {}): YouTubePlatformPolicySafeReport {
  const ready = reviewReady(review) && policyReady(policy);
  const readyForNext = ready && options.requestCredentialOauthUiDesign !== false;
  return {
    schema_version: "1.0",
    youtube_policy_safe_report_id: safe(options.id, "youtube-platform-policy-safe-report-001"),
    youtube_policy_review_id: review.youtube_policy_review_id,
    youtube_policy_design_id: policy.youtube_policy_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_credential_oauth_ui_design" : ready ? "complete" : "blocked",
    safe_report_only: true,
    summary_sections: ["scheduled-first default", "private fallback", "quota policy", "resume policy", "idempotency", "duplicate prevention", "verification", "no upload execution"],
    network_calls_enabled: false,
    platform_api_calls_enabled: false,
    credential_access_enabled: false,
    media_reads_enabled: false,
    upload_execution_enabled: false,
    ready_for_real_upload: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["YouTube platform policy review was not ready for safe report."], warnings: ["Future OAuth/credential UI design remains separate from live credential access."] },
    provenance: { generated_by: "createYouTubePlatformPolicySafeReport", source_policy_review_id: review.youtube_policy_review_id },
  };
}

export function revokeYouTubePlatformPolicyDesign(policy: YouTubePlatformPolicyDesign, reason?: string): YouTubePlatformPolicyDesign {
  return { ...policy, policy_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: policy.validation.blocking_reasons, warnings: [...policy.validation.warnings, safe(reason, "YouTube platform policy design was revoked.")] }, provenance: { ...policy.provenance, generated_by: "revokeYouTubePlatformPolicyDesign" } };
}
export function revokeYouTubePlatformPolicyReview(review: YouTubePlatformPolicyReview, reason?: string): YouTubePlatformPolicyReview {
  return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "YouTube platform policy review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeYouTubePlatformPolicyReview" } };
}
export function revokeYouTubePlatformPolicySafeReport(report: YouTubePlatformPolicySafeReport, reason?: string): YouTubePlatformPolicySafeReport {
  return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "YouTube platform policy safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeYouTubePlatformPolicySafeReport" } };
}
