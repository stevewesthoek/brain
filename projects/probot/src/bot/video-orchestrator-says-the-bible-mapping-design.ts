import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { VideoOrchestratorAccountModelDesign, VideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";

export type SaysTheBibleMappingDesignState = "created" | "approved_for_youtube_policy_design" | "blocked" | "revoked";
export type SaysTheBibleMappingReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type SaysTheBibleMappingSafeReportState = "complete" | "approved_for_youtube_platform_policy_design" | "blocked" | "revoked";
export type SaysTheBibleLegacySurfaceKind = "youtube_upload" | "youtube_oauth" | "youtube_db_sync" | "youtube_thumbnail_sync" | "pipeline_docs" | "output_folder";
export type SaysTheBibleTargetAbstraction = "platform_adapter" | "credential_reference" | "upload_lifecycle" | "media_artifact" | "project_config" | "platform_policy";

export interface SaysTheBibleLegacySurfaceMapping {
  mapping_id: string;
  legacy_surface_kind: SaysTheBibleLegacySurfaceKind;
  legacy_safe_path_summary: string;
  target_abstraction: SaysTheBibleTargetAbstraction;
  migration_strategy: string;
  legacy_repo_modified_now: false;
  legacy_pipeline_called_now: false;
  credentials_copied_now: false;
  media_read_now: false;
  network_called_now: false;
  upload_executed_now: false;
}

export interface SaysTheBibleMigrationBridgeDesign {
  schema_version: "1.0";
  says_the_bible_mapping_design_id: string;
  account_model_safe_report_id: string;
  account_model_design_id: string;
  created_at: string;
  mapping_state: SaysTheBibleMappingDesignState;
  design_only: true;
  read_only_legacy_analysis_only: true;
  legacy_repo_modified_now: false;
  legacy_pipeline_called_now: false;
  credentials_copied_now: false;
  media_read_now: false;
  network_called_now: false;
  platform_api_called_now: false;
  upload_executed_now: false;
  migration_bridge_enabled_now: false;
  legacy_surfaces: SaysTheBibleLegacySurfaceMapping[];
  target_project_id: string;
  target_platform: "youtube";
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createSaysTheBibleMigrationBridgeDesign" | "revokeSaysTheBibleMigrationBridgeDesign"; source_account_model_safe_report_id: string };
}

export interface SaysTheBibleMigrationBridgeReview {
  schema_version: "1.0";
  says_the_bible_mapping_review_id: string;
  says_the_bible_mapping_design_id: string;
  created_at: string;
  review_state: SaysTheBibleMappingReviewState;
  review_only: true;
  reviewed_mapping_ids: string[];
  legacy_repo_modified_now: false;
  legacy_pipeline_called_now: false;
  upload_executed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  execution_boundary: DisabledEnablementBoundary;
  provenance: { generated_by: "createSaysTheBibleMigrationBridgeReview" | "revokeSaysTheBibleMigrationBridgeReview"; source_mapping_design_id: string };
}

export interface SaysTheBibleMigrationBridgeSafeReport {
  schema_version: "1.0";
  says_the_bible_mapping_safe_report_id: string;
  says_the_bible_mapping_review_id: string;
  says_the_bible_mapping_design_id: string;
  created_at: string;
  safe_report_state: SaysTheBibleMappingSafeReportState;
  safe_report_only: true;
  summary_sections: string[];
  legacy_repo_modified_now: false;
  legacy_pipeline_called_now: false;
  credentials_copied_now: false;
  media_read_now: false;
  network_called_now: false;
  platform_api_called_now: false;
  upload_executed_now: false;
  migration_bridge_enabled_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  execution_boundary: DisabledEnablementBoundary;
  provenance: { generated_by: "createSaysTheBibleMigrationBridgeSafeReport" | "revokeSaysTheBibleMigrationBridgeSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function accountModelReady(report: VideoOrchestratorAccountModelSafeReport, design: VideoOrchestratorAccountModelDesign): boolean {
  return report.safe_report_state === "approved_for_says_the_bible_mapping_design"
    && report.validation.complete
    && report.validation.ready_for_next_phase
    && !report.upload_execution_enabled
    && !report.network_calls_enabled
    && !report.platform_api_calls_enabled
    && !report.credential_access_enabled
    && !report.media_reads_enabled
    && design.design_state === "approved_for_legacy_mapping_design"
    && design.projects.some((project) => project.project_id === "says-the-bible" && project.platform_accounts.some((account) => account.platform === "youtube"))
    && Object.values(report.execution_boundary).every((value) => value === false)
    && Object.values(design.execution_boundary).every((value) => value === false);
}

function mappingReady(design: SaysTheBibleMigrationBridgeDesign): boolean {
  return design.mapping_state === "approved_for_youtube_policy_design"
    && design.validation.complete
    && design.validation.ready_for_next_phase
    && design.legacy_surfaces.length >= 6
    && design.legacy_surfaces.every((surface) => !surface.legacy_repo_modified_now && !surface.legacy_pipeline_called_now && !surface.credentials_copied_now && !surface.media_read_now && !surface.network_called_now && !surface.upload_executed_now)
    && !design.legacy_repo_modified_now
    && !design.legacy_pipeline_called_now
    && !design.credentials_copied_now
    && !design.media_read_now
    && !design.network_called_now
    && !design.platform_api_called_now
    && !design.upload_executed_now
    && !design.migration_bridge_enabled_now
    && Object.values(design.execution_boundary).every((value) => value === false);
}

function reviewReady(review: SaysTheBibleMigrationBridgeReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && review.reviewed_mapping_ids.length >= 6
    && !review.legacy_repo_modified_now
    && !review.legacy_pipeline_called_now
    && !review.upload_executed_now
    && Object.values(review.execution_boundary).every((value) => value === false);
}

function legacySurfaces(): SaysTheBibleLegacySurfaceMapping[] {
  return [
    ["youtube_upload", "scripts/pipeline/04-upload-youtube.mjs", "platform_adapter", "Extract reusable YouTube upload concepts into a future Video Orchestrator adapter; do not copy project-specific metadata or mutate legacy code."],
    ["youtube_oauth", "scripts/pipeline/setup-youtube-auth.mjs", "credential_reference", "Map the OAuth setup concept to a dashboard-managed credential reference and OAuth flow; do not copy token files."],
    ["youtube_db_sync", "scripts/pipeline/sync-youtube-db.mjs", "upload_lifecycle", "Map YouTube/DB reconciliation and resume concepts to a generic upload lifecycle state machine."],
    ["youtube_thumbnail_sync", "scripts/pipeline/youtube-sync-templates.mjs", "platform_policy", "Map thumbnail sync as a future platform policy capability, separate from first upload execution."],
    ["pipeline_docs", "docs/features/stb-pipeline-end-to-end.md", "project_config", "Map the legacy control tower model to a project configuration and migration checklist."],
    ["output_folder", "production/output/<slug>", "media_artifact", "Map per-episode output folders to approved render artifacts and media-boundary references without reading files now."],
  ].map(([legacy_surface_kind, legacy_safe_path_summary, target_abstraction, migration_strategy]) => ({
    mapping_id: `stb-${legacy_surface_kind}`,
    legacy_surface_kind: legacy_surface_kind as SaysTheBibleLegacySurfaceKind,
    legacy_safe_path_summary: safe(legacy_safe_path_summary, "legacy surface"),
    target_abstraction: target_abstraction as SaysTheBibleTargetAbstraction,
    migration_strategy: safe(migration_strategy, "Migration strategy pending."),
    legacy_repo_modified_now: false,
    legacy_pipeline_called_now: false,
    credentials_copied_now: false,
    media_read_now: false,
    network_called_now: false,
    upload_executed_now: false,
  }));
}

export function createSaysTheBibleMigrationBridgeDesign(report: VideoOrchestratorAccountModelSafeReport, accountDesign: VideoOrchestratorAccountModelDesign, options: { id?: string; created_at?: string; requestYoutubePolicyDesign?: boolean } = {}): SaysTheBibleMigrationBridgeDesign {
  const ready = accountModelReady(report, accountDesign);
  const readyForNext = ready && options.requestYoutubePolicyDesign !== false;
  return {
    schema_version: "1.0",
    says_the_bible_mapping_design_id: safe(options.id, "says-the-bible-mapping-design-001"),
    account_model_safe_report_id: report.account_model_safe_report_id,
    account_model_design_id: accountDesign.account_model_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    mapping_state: readyForNext ? "approved_for_youtube_policy_design" : ready ? "created" : "blocked",
    design_only: true,
    read_only_legacy_analysis_only: true,
    legacy_repo_modified_now: false,
    legacy_pipeline_called_now: false,
    credentials_copied_now: false,
    media_read_now: false,
    network_called_now: false,
    platform_api_called_now: false,
    upload_executed_now: false,
    migration_bridge_enabled_now: false,
    legacy_surfaces: legacySurfaces(),
    target_project_id: "says-the-bible",
    target_platform: "youtube",
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Account model safe report was not ready for Says the Bible mapping design."], warnings: ["Legacy repo remains unchanged during mapping design."] },
    provenance: { generated_by: "createSaysTheBibleMigrationBridgeDesign", source_account_model_safe_report_id: report.account_model_safe_report_id },
  };
}

export function createSaysTheBibleMigrationBridgeReview(design: SaysTheBibleMigrationBridgeDesign, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): SaysTheBibleMigrationBridgeReview {
  const ready = mappingReady(design);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    says_the_bible_mapping_review_id: safe(options.id, "says-the-bible-mapping-review-001"),
    says_the_bible_mapping_design_id: design.says_the_bible_mapping_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    reviewed_mapping_ids: design.legacy_surfaces.map((surface) => surface.mapping_id),
    legacy_repo_modified_now: false,
    legacy_pipeline_called_now: false,
    upload_executed_now: false,
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Says the Bible mapping design was not ready for review."], warnings: [] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { generated_by: "createSaysTheBibleMigrationBridgeReview", source_mapping_design_id: design.says_the_bible_mapping_design_id },
  };
}

export function createSaysTheBibleMigrationBridgeSafeReport(review: SaysTheBibleMigrationBridgeReview, design: SaysTheBibleMigrationBridgeDesign, options: { id?: string; created_at?: string; requestYoutubePlatformPolicyDesign?: boolean } = {}): SaysTheBibleMigrationBridgeSafeReport {
  const ready = reviewReady(review) && mappingReady(design);
  const readyForNext = ready && options.requestYoutubePlatformPolicyDesign !== false;
  return {
    schema_version: "1.0",
    says_the_bible_mapping_safe_report_id: safe(options.id, "says-the-bible-mapping-safe-report-001"),
    says_the_bible_mapping_review_id: review.says_the_bible_mapping_review_id,
    says_the_bible_mapping_design_id: design.says_the_bible_mapping_design_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_youtube_platform_policy_design" : ready ? "complete" : "blocked",
    safe_report_only: true,
    summary_sections: ["legacy surfaces", "target abstractions", "migration bridge", "unchanged legacy repo", "future youtube policy", "no upload execution"],
    legacy_repo_modified_now: false,
    legacy_pipeline_called_now: false,
    credentials_copied_now: false,
    media_read_now: false,
    network_called_now: false,
    platform_api_called_now: false,
    upload_executed_now: false,
    migration_bridge_enabled_now: false,
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Says the Bible mapping review was not ready for safe report."], warnings: ["Future migration bridge must be implemented in Video Orchestrator without mutating the legacy repo."] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { generated_by: "createSaysTheBibleMigrationBridgeSafeReport", source_review_id: review.says_the_bible_mapping_review_id },
  };
}

export function revokeSaysTheBibleMigrationBridgeDesign(design: SaysTheBibleMigrationBridgeDesign, reason?: string): SaysTheBibleMigrationBridgeDesign {
  return { ...design, mapping_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: design.validation.blocking_reasons, warnings: [...design.validation.warnings, safe(reason, "Says the Bible mapping design was revoked.")] }, provenance: { ...design.provenance, generated_by: "revokeSaysTheBibleMigrationBridgeDesign" } };
}

export function revokeSaysTheBibleMigrationBridgeReview(review: SaysTheBibleMigrationBridgeReview, reason?: string): SaysTheBibleMigrationBridgeReview {
  return { ...review, review_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Says the Bible mapping review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeSaysTheBibleMigrationBridgeReview" } };
}

export function revokeSaysTheBibleMigrationBridgeSafeReport(report: SaysTheBibleMigrationBridgeSafeReport, reason?: string): SaysTheBibleMigrationBridgeSafeReport {
  return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Says the Bible mapping safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeSaysTheBibleMigrationBridgeSafeReport" } };
}
