import type { RuntimeSchedulerQueueArtifact, RuntimeSchedulerQueueArtifactBuildResult } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";

export type RuntimeSchedulerQueueStoreState = "ready_for_operator_review" | "blocked" | "revoked";
export type RuntimeSchedulerQueueStoreReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type RuntimeSchedulerQueueStoreSafeReportState = "complete" | "requires_operator_confirmation_for_persistent_store_or_git_staging" | "blocked" | "revoked";

export interface RuntimeSchedulerQueueStoreInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  store_id: string;
  allow_memory_store_only: true;
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

export interface RuntimeSchedulerQueueStoredItem {
  store_item_id: string;
  queue_item_id: string;
  project_id: string;
  platform: RuntimeSchedulerQueueArtifact["items"][number]["platform"];
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  state: RuntimeSchedulerQueueArtifact["items"][number]["state"];
  previous_attempt_count: number;
  next_action: string;
}

export interface RuntimeSchedulerQueueStoreBuildResult {
  schema_version: "1.0";
  store_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  store_state: RuntimeSchedulerQueueStoreState;
  store_id: string;
  source_artifact_id: string | null;
  items: RuntimeSchedulerQueueStoredItem[];
  summary: {
    item_count: number;
    queued_dry_run_count: number;
    deferred_count: number;
    manual_fallback_count: number;
    blocked_count: number;
  };
  safety: {
    memory_store_only: true;
    file_written: false;
    database_written: false;
    live_scheduler_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
  validation: { complete: boolean; ready_for_store_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerQueueStoreReview {
  schema_version: "1.0";
  review_id: string;
  store_result_id: string;
  created_at: string;
  review_state: RuntimeSchedulerQueueStoreReviewState;
  review_only: true;
  item_count: number;
  file_written: false;
  database_written: false;
  live_scheduler_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerQueueStoreSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  store_result_id: string;
  created_at: string;
  safe_report_state: RuntimeSchedulerQueueStoreSafeReportState;
  safe_report_only: true;
  item_count: number;
  file_written: false;
  database_written: false;
  live_scheduler_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function inputReady(input: RuntimeSchedulerQueueStoreInput): boolean {
  return input.allow_memory_store_only === true
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
    && input.store_id.trim().length > 0;
}

function artifactReady(result: RuntimeSchedulerQueueArtifactBuildResult): boolean {
  return result.schema_version === "1.0"
    && result.artifact_state === "ready_for_operator_review"
    && result.validation.complete
    && result.validation.ready_for_artifact_review
    && result.artifact_only
    && result.artifact !== null
    && !result.file_written_now
    && !result.live_scheduler_executed
    && !result.upload_executed
    && !result.network_calls_made
    && !result.credential_accessed
    && !result.media_read_performed
    && !result.git_add_executed
    && !result.committed_now
    && !result.pushed_now;
}

function toStoredItem(item: RuntimeSchedulerQueueArtifact["items"][number]): RuntimeSchedulerQueueStoredItem {
  return {
    store_item_id: `${item.queue_item_id}-memory-store`,
    queue_item_id: item.queue_item_id,
    project_id: item.project_id,
    platform: item.platform,
    account_id: item.account_id,
    content_id: item.content_id,
    desired_publish_at: item.desired_publish_at,
    state: item.state,
    previous_attempt_count: item.previous_attempt_count,
    next_action: item.next_action,
  };
}

export function buildRuntimeSchedulerQueueMemoryStore(input: RuntimeSchedulerQueueStoreInput, artifactResult: RuntimeSchedulerQueueArtifactBuildResult, options: { id?: string; created_at?: string } = {}): RuntimeSchedulerQueueStoreBuildResult {
  const ready = inputReady(input) && artifactReady(artifactResult);
  const items = ready && artifactResult.artifact ? artifactResult.artifact.items.map(toStoredItem) : [];
  return {
    schema_version: "1.0",
    store_result_id: safe(options.id, `runtime-scheduler-queue-store-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    store_state: ready ? "ready_for_operator_review" : "blocked",
    store_id: safe(input.store_id, "runtime-scheduler-queue-memory-store"),
    source_artifact_id: ready && artifactResult.artifact ? artifactResult.artifact.artifact_id : null,
    items,
    summary: {
      item_count: items.length,
      queued_dry_run_count: items.filter((item) => item.state === "queued_dry_run").length,
      deferred_count: items.filter((item) => item.state === "deferred").length,
      manual_fallback_count: items.filter((item) => item.state === "manual_fallback").length,
      blocked_count: items.filter((item) => item.state === "blocked").length,
    },
    safety: { memory_store_only: true, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false },
    validation: { complete: ready, ready_for_store_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler queue store input or source artifact was unsafe/incomplete."], warnings: ["Memory-store only; no persistent file, database, live scheduler, upload, network, credential, media, or git behavior is enabled."] },
  };
}

function storeReady(result: RuntimeSchedulerQueueStoreBuildResult): boolean {
  return result.store_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_store_review && result.safety.memory_store_only && !result.safety.file_written && !result.safety.database_written && !result.safety.live_scheduler_executed && !result.safety.upload_executed && !result.safety.network_calls_made && !result.safety.credential_accessed && !result.safety.media_read_performed && !result.safety.git_add_executed && !result.safety.committed_now && !result.safety.pushed_now;
}

export function createRuntimeSchedulerQueueStoreReview(result: RuntimeSchedulerQueueStoreBuildResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): RuntimeSchedulerQueueStoreReview {
  const ready = storeReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "runtime-scheduler-queue-store-review-001"), store_result_id: result.store_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, item_count: result.summary.item_count, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Runtime scheduler queue memory store was not ready for review."], warnings: ["Review does not approve persistent writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createRuntimeSchedulerQueueStoreSafeReport(review: RuntimeSchedulerQueueStoreReview, result: RuntimeSchedulerQueueStoreBuildResult, options: { id?: string; created_at?: string; requestPersistentStoreOrGitStaging?: boolean } = {}): RuntimeSchedulerQueueStoreSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && storeReady(result);
  const requiresConfirmation = ready && options.requestPersistentStoreOrGitStaging !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "runtime-scheduler-queue-store-safe-report-001"), review_id: review.review_id, store_result_id: result.store_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_persistent_store_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, item_count: result.summary.item_count, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before persistent store implementation or git staging."] : ["Runtime scheduler queue store review was not ready for safe report."], warnings: ["Stop before persistent writes, staging, commits, or pushes unless separately approved."] } };
}

export function revokeRuntimeSchedulerQueueMemoryStore(result: RuntimeSchedulerQueueStoreBuildResult, reason?: string): RuntimeSchedulerQueueStoreBuildResult { return { ...result, store_state: "revoked", items: [], source_artifact_id: null, validation: { complete: false, ready_for_store_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Runtime scheduler queue memory store was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueStoreReview(review: RuntimeSchedulerQueueStoreReview, reason?: string): RuntimeSchedulerQueueStoreReview { return { ...review, review_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler queue store review was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueStoreSafeReport(report: RuntimeSchedulerQueueStoreSafeReport, reason?: string): RuntimeSchedulerQueueStoreSafeReport { return { ...report, safe_report_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Runtime scheduler queue store safe report was revoked.")] } }; }
