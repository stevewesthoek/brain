import type { RuntimeSchedulerQueueStoreBuildResult } from "./video-orchestrator-runtime-scheduler-queue-store.js";

export type RuntimeSchedulerStoreReadinessState = "ready_for_operator_review" | "blocked" | "revoked";
export type RuntimeSchedulerStoreReadinessReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type RuntimeSchedulerStoreReadinessSafeReportState = "complete" | "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging" | "blocked" | "revoked";

export interface RuntimeSchedulerStoreReadinessInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  proposed_store_kind: "repo_json" | "sqlite" | "external_queue" | "dashboard_runtime_store";
  proposed_path_or_reference: string;
  allow_readiness_only: true;
  allow_file_write: false;
  allow_database_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerStoreReadinessResult {
  schema_version: "1.0";
  readiness_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  readiness_state: RuntimeSchedulerStoreReadinessState;
  proposed_store_kind: RuntimeSchedulerStoreReadinessInput["proposed_store_kind"];
  proposed_path_or_reference: string;
  source_store_result_id: string | null;
  source_item_count: number;
  readiness_only: true;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_readiness_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerStoreReadinessReview {
  schema_version: "1.0";
  review_id: string;
  readiness_id: string;
  created_at: string;
  review_state: RuntimeSchedulerStoreReadinessReviewState;
  review_only: true;
  source_item_count: number;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerStoreReadinessSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  readiness_id: string;
  created_at: string;
  safe_report_state: RuntimeSchedulerStoreReadinessSafeReportState;
  safe_report_only: true;
  source_item_count: number;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function safeReference(value: string): string {
  const text = safe(value, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  if (text.startsWith("/") || text.includes("..") || text.includes(".env") || text.includes(".git/") || text.includes("node_modules/") || text.includes("secrets")) return "blocked-reference";
  return text;
}

function inputReady(input: RuntimeSchedulerStoreReadinessInput): boolean {
  return input.allow_readiness_only === true
    && input.allow_file_write === false
    && input.allow_database_write === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && safeReference(input.proposed_path_or_reference) !== "blocked-reference";
}

function sourceStoreReady(store: RuntimeSchedulerQueueStoreBuildResult): boolean {
  return store.schema_version === "1.0"
    && store.store_state === "ready_for_operator_review"
    && store.validation.complete
    && store.validation.ready_for_store_review
    && store.safety.memory_store_only
    && !store.safety.file_written
    && !store.safety.database_written
    && !store.safety.live_scheduler_executed
    && !store.safety.upload_executed
    && !store.safety.network_calls_made
    && !store.safety.credential_accessed
    && !store.safety.media_read_performed
    && !store.safety.git_add_executed
    && !store.safety.committed_now
    && !store.safety.pushed_now;
}

export function createRuntimeSchedulerStoreReadiness(input: RuntimeSchedulerStoreReadinessInput, store: RuntimeSchedulerQueueStoreBuildResult, options: { id?: string; created_at?: string } = {}): RuntimeSchedulerStoreReadinessResult {
  const ready = inputReady(input) && sourceStoreReady(store);
  return {
    schema_version: "1.0",
    readiness_id: safe(options.id, `runtime-scheduler-store-readiness-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    readiness_state: ready ? "ready_for_operator_review" : "blocked",
    proposed_store_kind: input.proposed_store_kind,
    proposed_path_or_reference: safeReference(input.proposed_path_or_reference),
    source_store_result_id: ready ? store.store_result_id : null,
    source_item_count: ready ? store.summary.item_count : 0,
    readiness_only: true,
    file_write_enabled: false,
    database_write_enabled: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_readiness_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store readiness input or source memory store was unsafe/incomplete."], warnings: ["Readiness only; no persistent store, live scheduler, upload, network, credential, media, or git behavior is enabled."] },
  };
}

function readinessReady(result: RuntimeSchedulerStoreReadinessResult): boolean {
  return result.readiness_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_readiness_review && result.readiness_only && !result.file_write_enabled && !result.database_write_enabled && !result.live_scheduler_enabled && !result.upload_execution_enabled && !result.network_enabled && !result.credential_access_enabled && !result.media_read_enabled && !result.git_add_executed && !result.committed_now && !result.pushed_now;
}

export function createRuntimeSchedulerStoreReadinessReview(result: RuntimeSchedulerStoreReadinessResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): RuntimeSchedulerStoreReadinessReview {
  const ready = readinessReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "runtime-scheduler-store-readiness-review-001"), readiness_id: result.readiness_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, source_item_count: result.source_item_count, file_write_enabled: false, database_write_enabled: false, live_scheduler_enabled: false, upload_execution_enabled: false, network_enabled: false, credential_access_enabled: false, media_read_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Runtime scheduler store readiness result was not ready for review."], warnings: ["Review does not approve persistent writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createRuntimeSchedulerStoreReadinessSafeReport(review: RuntimeSchedulerStoreReadinessReview, result: RuntimeSchedulerStoreReadinessResult, options: { id?: string; created_at?: string; requestPersistentStoreImplementationOrGitStaging?: boolean } = {}): RuntimeSchedulerStoreReadinessSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && readinessReady(result);
  const requiresConfirmation = ready && options.requestPersistentStoreImplementationOrGitStaging !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "runtime-scheduler-store-readiness-safe-report-001"), review_id: review.review_id, readiness_id: result.readiness_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, source_item_count: result.source_item_count, file_write_enabled: false, database_write_enabled: false, live_scheduler_enabled: false, upload_execution_enabled: false, network_enabled: false, credential_access_enabled: false, media_read_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before persistent store implementation or git staging."] : ["Runtime scheduler store readiness review was not ready for safe report."], warnings: ["Stop before persistent store implementation, staging, commits, or pushes unless separately approved."] } };
}

export function revokeRuntimeSchedulerStoreReadiness(result: RuntimeSchedulerStoreReadinessResult, reason?: string): RuntimeSchedulerStoreReadinessResult { return { ...result, readiness_state: "revoked", source_store_result_id: null, source_item_count: 0, validation: { complete: false, ready_for_readiness_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Runtime scheduler store readiness was revoked.")] } }; }
export function revokeRuntimeSchedulerStoreReadinessReview(review: RuntimeSchedulerStoreReadinessReview, reason?: string): RuntimeSchedulerStoreReadinessReview { return { ...review, review_state: "revoked", source_item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler store readiness review was revoked.")] } }; }
export function revokeRuntimeSchedulerStoreReadinessSafeReport(report: RuntimeSchedulerStoreReadinessSafeReport, reason?: string): RuntimeSchedulerStoreReadinessSafeReport { return { ...report, safe_report_state: "revoked", source_item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Runtime scheduler store readiness safe report was revoked.")] } }; }
