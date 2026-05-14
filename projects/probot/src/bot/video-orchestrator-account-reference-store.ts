import type { SafeVideoOrchestratorAccountReferenceEntry, VideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";

export type VideoOrchestratorAccountReferenceStoreState = "ready_for_operator_review" | "blocked" | "revoked";
export type VideoOrchestratorAccountReferenceStoreReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorAccountReferenceStoreSafeReportState = "complete" | "requires_operator_confirmation_for_file_write_or_git_staging" | "blocked" | "revoked";

export interface VideoOrchestratorAccountReferenceStoreInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  store_id: string;
  proposed_path: string;
  allow_artifact_build_only: true;
  allow_file_write: false;
  allow_env_write: false;
  allow_keychain_write: false;
  allow_sensitive_value_storage: false;
  allow_oauth_exchange: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorAccountReferenceStoreArtifactEntry {
  reference_id: string;
  project_id: string;
  platform: SafeVideoOrchestratorAccountReferenceEntry["platform"];
  account_id: string;
  account_label: string;
  reference_label: string;
  auth_mode: SafeVideoOrchestratorAccountReferenceEntry["auth_mode"];
  auth_status: SafeVideoOrchestratorAccountReferenceEntry["auth_status"];
  reference_target: SafeVideoOrchestratorAccountReferenceEntry["reference_target"];
  reference_name: string;
  setup: {
    oauth_connect_url: string | null;
    api_key_setup_url: string | null;
    manual_setup_summary: string | null;
  };
  enabled: boolean;
  next_action: string;
}

export interface VideoOrchestratorAccountReferenceStoreArtifact {
  schema_version: "1.0";
  store_id: string;
  project_id: string;
  generated_at: string;
  proposed_path: string;
  reference_only: true;
  entries: VideoOrchestratorAccountReferenceStoreArtifactEntry[];
  safety: {
    sensitive_values_included: false;
    sensitive_read_performed: false;
    sensitive_write_performed: false;
    oauth_exchange_executed: false;
    env_written: false;
    file_written: false;
  };
}

export interface VideoOrchestratorAccountReferenceStoreBuildResult {
  schema_version: "1.0";
  store_build_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  store_state: VideoOrchestratorAccountReferenceStoreState;
  artifact: VideoOrchestratorAccountReferenceStoreArtifact | null;
  artifact_json_preview: string;
  artifact_build_only: true;
  file_write_enabled: false;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_store_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "buildVideoOrchestratorAccountReferenceStoreArtifact" | "revokeVideoOrchestratorAccountReferenceStoreBuildResult" };
}

export interface VideoOrchestratorAccountReferenceStoreReview {
  schema_version: "1.0";
  store_review_id: string;
  store_build_result_id: string;
  created_at: string;
  review_state: VideoOrchestratorAccountReferenceStoreReviewState;
  review_only: true;
  artifact_entry_count: number;
  artifact_build_only: true;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountReferenceStoreReview" | "revokeVideoOrchestratorAccountReferenceStoreReview"; source_result_id: string };
}

export interface VideoOrchestratorAccountReferenceStoreSafeReport {
  schema_version: "1.0";
  store_safe_report_id: string;
  store_review_id: string;
  store_build_result_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorAccountReferenceStoreSafeReportState;
  safe_report_only: true;
  artifact_entry_count: number;
  artifact_build_only: true;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountReferenceStoreSafeReport" | "revokeVideoOrchestratorAccountReferenceStoreSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function safePath(value: string): string {
  const path = safe(value, "operations/runbooks/video-orchestrator-account-reference-registry.example.json");
  if (path.startsWith("/") || path.includes("..") || path.includes(".env") || path.includes("node_modules/") || path.includes(".git/") || path.includes("secrets")) return "blocked-path";
  return path;
}

function inputReady(input: VideoOrchestratorAccountReferenceStoreInput): boolean {
  return input.allow_artifact_build_only === true
    && input.allow_file_write === false
    && input.allow_env_write === false
    && input.allow_keychain_write === false
    && input.allow_sensitive_value_storage === false
    && input.allow_oauth_exchange === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.store_id.trim().length > 0
    && safePath(input.proposed_path) !== "blocked-path";
}

function modelReady(model: VideoOrchestratorAccountReferenceRegistryModel): boolean {
  return model.schema_version === "1.0"
    && model.safety.reference_only
    && !model.safety.sensitive_values_rendered
    && !model.safety.sensitive_read_performed
    && !model.safety.sensitive_write_performed
    && !model.safety.oauth_exchange_executed
    && !model.safety.env_written
    && !model.safety.files_written;
}

function entryToArtifact(entry: SafeVideoOrchestratorAccountReferenceEntry): VideoOrchestratorAccountReferenceStoreArtifactEntry {
  return {
    reference_id: entry.reference_id,
    project_id: entry.project_id,
    platform: entry.platform,
    account_id: entry.account_id,
    account_label: entry.account_label,
    reference_label: entry.reference_label,
    auth_mode: entry.auth_mode,
    auth_status: entry.sensitive_value_present_in_input ? "needs_setup" : entry.auth_status,
    reference_target: entry.reference_target,
    reference_name: entry.reference_name,
    setup: { oauth_connect_url: entry.oauth_connect_url, api_key_setup_url: entry.api_key_setup_url, manual_setup_summary: entry.manual_setup_summary },
    enabled: entry.enabled,
    next_action: entry.next_action,
  };
}

function hasSensitiveShape(json: string): boolean {
  return /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization[_-]?code|raw[_-]?reference)\b/i.test(json)
    || json.includes("[TOKEN")
    || json.includes("[API_KEY")
    || json.includes("[CLIENT_SECRET")
    || json.toLowerCase().includes("keychain://");
}

export function buildVideoOrchestratorAccountReferenceStoreArtifact(input: VideoOrchestratorAccountReferenceStoreInput, model: VideoOrchestratorAccountReferenceRegistryModel, options: { id?: string; created_at?: string } = {}): VideoOrchestratorAccountReferenceStoreBuildResult {
  const generatedAt = safe(options.created_at, "1970-01-01T00:00:00.000Z");
  const readyBase = inputReady(input) && modelReady(model);
  const artifact: VideoOrchestratorAccountReferenceStoreArtifact | null = readyBase ? {
    schema_version: "1.0",
    store_id: safe(input.store_id, "account-reference-store"),
    project_id: safe(input.project_id, "project"),
    generated_at: generatedAt,
    proposed_path: safePath(input.proposed_path),
    reference_only: true,
    entries: model.entries.map(entryToArtifact),
    safety: { sensitive_values_included: false, sensitive_read_performed: false, sensitive_write_performed: false, oauth_exchange_executed: false, env_written: false, file_written: false },
  } : null;
  const preview = artifact ? JSON.stringify(artifact, null, 2) : "";
  const ready = readyBase && artifact !== null && !hasSensitiveShape(preview);
  return {
    schema_version: "1.0",
    store_build_result_id: safe(options.id, `account-reference-store-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: generatedAt,
    store_state: ready ? "ready_for_operator_review" : "blocked",
    artifact: ready ? artifact : null,
    artifact_json_preview: ready ? preview : "",
    artifact_build_only: true,
    file_write_enabled: false,
    file_written_now: false,
    env_write_enabled: false,
    keychain_write_enabled: false,
    sensitive_value_storage_enabled: false,
    oauth_exchange_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_store_review: ready, blocking_reasons: ready ? [] : ["Account-reference store artifact input/model produced an unsafe or incomplete artifact."], warnings: ["Artifact build only; no file, env, Keychain, OAuth, git, or sensitive value persistence is performed."] },
    provenance: { generated_by: "buildVideoOrchestratorAccountReferenceStoreArtifact" },
  };
}

function resultReady(result: VideoOrchestratorAccountReferenceStoreBuildResult): boolean {
  return result.store_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_store_review && result.artifact !== null && result.artifact.reference_only && result.artifact_build_only && !result.file_written_now && !result.file_write_enabled && !result.env_write_enabled && !result.keychain_write_enabled && !result.sensitive_value_storage_enabled && !result.oauth_exchange_enabled && !result.git_add_executed && !result.committed_now && !result.pushed_now;
}

export function createVideoOrchestratorAccountReferenceStoreReview(result: VideoOrchestratorAccountReferenceStoreBuildResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorAccountReferenceStoreReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", store_review_id: safe(options.id, "account-reference-store-review-001"), store_build_result_id: result.store_build_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, artifact_entry_count: result.artifact?.entries.length ?? 0, artifact_build_only: true, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Account-reference store artifact was not ready for review."], warnings: ["Review does not approve file writes, env writes, Keychain writes, OAuth exchange, staging, commits, or pushes."] }, provenance: { generated_by: "createVideoOrchestratorAccountReferenceStoreReview", source_result_id: result.store_build_result_id } };
}

export function createVideoOrchestratorAccountReferenceStoreSafeReport(review: VideoOrchestratorAccountReferenceStoreReview, result: VideoOrchestratorAccountReferenceStoreBuildResult, options: { id?: string; created_at?: string; requestFileWriteOrGitStaging?: boolean } = {}): VideoOrchestratorAccountReferenceStoreSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestFileWriteOrGitStaging !== false;
  return { schema_version: "1.0", store_safe_report_id: safe(options.id, "account-reference-store-safe-report-001"), store_review_id: review.store_review_id, store_build_result_id: result.store_build_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_file_write_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, artifact_entry_count: result.artifact?.entries.length ?? 0, artifact_build_only: true, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before writing a reference-only store artifact or git staging."] : ["Account-reference store review was not ready for safe report."], warnings: ["Stop before file writes, staging, commits, or pushes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorAccountReferenceStoreSafeReport", source_review_id: review.store_review_id } };
}

export function revokeVideoOrchestratorAccountReferenceStoreBuildResult(result: VideoOrchestratorAccountReferenceStoreBuildResult, reason?: string): VideoOrchestratorAccountReferenceStoreBuildResult { return { ...result, store_state: "revoked", artifact: null, artifact_json_preview: "", file_write_enabled: false, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_store_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Account-reference store build result was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorAccountReferenceStoreBuildResult" } }; }
export function revokeVideoOrchestratorAccountReferenceStoreReview(review: VideoOrchestratorAccountReferenceStoreReview, reason?: string): VideoOrchestratorAccountReferenceStoreReview { return { ...review, review_state: "revoked", artifact_entry_count: 0, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Account-reference store review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorAccountReferenceStoreReview" } }; }
export function revokeVideoOrchestratorAccountReferenceStoreSafeReport(report: VideoOrchestratorAccountReferenceStoreSafeReport, reason?: string): VideoOrchestratorAccountReferenceStoreSafeReport { return { ...report, safe_report_state: "revoked", artifact_entry_count: 0, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Account-reference store safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorAccountReferenceStoreSafeReport" } }; }
