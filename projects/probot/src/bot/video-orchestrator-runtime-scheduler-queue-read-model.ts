import type { RuntimeSchedulerQueueStoreBuildResult, RuntimeSchedulerQueueStoredItem } from "./video-orchestrator-runtime-scheduler-queue-store.js";

export type RuntimeSchedulerQueueReadModelState = "ready_for_operator_review" | "blocked" | "revoked";
export type RuntimeSchedulerQueueReadModelReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type RuntimeSchedulerQueueReadModelSafeReportState = "complete" | "requires_operator_confirmation_for_dashboard_wiring_or_git_staging" | "blocked" | "revoked";
export type RuntimeSchedulerQueueReadFilter = "all" | "queued_dry_run" | "deferred" | "manual_fallback" | "blocked";

export interface RuntimeSchedulerQueueReadModelInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  filter: RuntimeSchedulerQueueReadFilter;
  allow_read_only: true;
  allow_store_mutation: false;
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

export interface RuntimeSchedulerQueueReadModelItem {
  queue_item_id: string;
  project_id: string;
  platform: RuntimeSchedulerQueueStoredItem["platform"];
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  state: RuntimeSchedulerQueueStoredItem["state"];
  previous_attempt_count: number;
  next_action: string;
}

export interface RuntimeSchedulerQueueReadModel {
  schema_version: "1.0";
  read_model_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  read_model_state: RuntimeSchedulerQueueReadModelState;
  filter: RuntimeSchedulerQueueReadFilter;
  source_store_id: string | null;
  items: RuntimeSchedulerQueueReadModelItem[];
  summary: {
    item_count: number;
    queued_dry_run_count: number;
    deferred_count: number;
    manual_fallback_count: number;
    blocked_count: number;
    retry_candidate_count: number;
  };
  safety: {
    read_only: true;
    store_mutated: false;
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
  validation: { complete: boolean; ready_for_read_model_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerQueueReadModelReview {
  schema_version: "1.0";
  review_id: string;
  read_model_id: string;
  created_at: string;
  review_state: RuntimeSchedulerQueueReadModelReviewState;
  review_only: true;
  item_count: number;
  store_mutated: false;
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

export interface RuntimeSchedulerQueueReadModelSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  read_model_id: string;
  created_at: string;
  safe_report_state: RuntimeSchedulerQueueReadModelSafeReportState;
  safe_report_only: true;
  item_count: number;
  store_mutated: false;
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

function inputReady(input: RuntimeSchedulerQueueReadModelInput): boolean {
  return input.allow_read_only === true
    && input.allow_store_mutation === false
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
    && input.operator_approval_id.trim().length > 0;
}

function storeReady(store: RuntimeSchedulerQueueStoreBuildResult): boolean {
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

function toReadModelItem(item: RuntimeSchedulerQueueStoredItem): RuntimeSchedulerQueueReadModelItem {
  return {
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

function applyFilter(items: RuntimeSchedulerQueueStoredItem[], filter: RuntimeSchedulerQueueReadFilter): RuntimeSchedulerQueueStoredItem[] {
  if (filter === "all") return [...items];
  return items.filter((item) => item.state === filter);
}

export function buildRuntimeSchedulerQueueReadModel(input: RuntimeSchedulerQueueReadModelInput, store: RuntimeSchedulerQueueStoreBuildResult, options: { id?: string; created_at?: string } = {}): RuntimeSchedulerQueueReadModel {
  const ready = inputReady(input) && storeReady(store);
  const items = ready ? applyFilter(store.items, input.filter).map(toReadModelItem) : [];
  return {
    schema_version: "1.0",
    read_model_id: safe(options.id, `runtime-scheduler-queue-read-model-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    read_model_state: ready ? "ready_for_operator_review" : "blocked",
    filter: input.filter,
    source_store_id: ready ? store.store_id : null,
    items,
    summary: {
      item_count: items.length,
      queued_dry_run_count: items.filter((item) => item.state === "queued_dry_run").length,
      deferred_count: items.filter((item) => item.state === "deferred").length,
      manual_fallback_count: items.filter((item) => item.state === "manual_fallback").length,
      blocked_count: items.filter((item) => item.state === "blocked").length,
      retry_candidate_count: items.filter((item) => item.previous_attempt_count > 0 && item.state === "queued_dry_run").length,
    },
    safety: { read_only: true, store_mutated: false, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false },
    validation: { complete: ready, ready_for_read_model_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler queue read model input or store was unsafe/incomplete."], warnings: ["Read-only model; no store mutation, persistent write, live scheduler, upload, network, credential, media, or git behavior is enabled."] },
  };
}

function readModelReady(model: RuntimeSchedulerQueueReadModel): boolean {
  return model.read_model_state === "ready_for_operator_review" && model.validation.complete && model.validation.ready_for_read_model_review && model.safety.read_only && !model.safety.store_mutated && !model.safety.file_written && !model.safety.database_written && !model.safety.live_scheduler_executed && !model.safety.upload_executed && !model.safety.network_calls_made && !model.safety.credential_accessed && !model.safety.media_read_performed && !model.safety.git_add_executed && !model.safety.committed_now && !model.safety.pushed_now;
}

export function createRuntimeSchedulerQueueReadModelReview(model: RuntimeSchedulerQueueReadModel, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): RuntimeSchedulerQueueReadModelReview {
  const ready = readModelReady(model);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "runtime-scheduler-queue-read-model-review-001"), read_model_id: model.read_model_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, item_count: model.summary.item_count, store_mutated: false, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Runtime scheduler queue read model was not ready for review."], warnings: ["Review does not approve dashboard wiring, persistent writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createRuntimeSchedulerQueueReadModelSafeReport(review: RuntimeSchedulerQueueReadModelReview, model: RuntimeSchedulerQueueReadModel, options: { id?: string; created_at?: string; requestDashboardWiringOrGitStaging?: boolean } = {}): RuntimeSchedulerQueueReadModelSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && readModelReady(model);
  const requiresConfirmation = ready && options.requestDashboardWiringOrGitStaging !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "runtime-scheduler-queue-read-model-safe-report-001"), review_id: review.review_id, read_model_id: model.read_model_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_dashboard_wiring_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, item_count: model.summary.item_count, store_mutated: false, file_written: false, database_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before dashboard wiring or git staging."] : ["Runtime scheduler queue read model review was not ready for safe report."], warnings: ["Stop before dashboard wiring, staging, commits, or pushes unless separately approved."] } };
}

export function revokeRuntimeSchedulerQueueReadModel(model: RuntimeSchedulerQueueReadModel, reason?: string): RuntimeSchedulerQueueReadModel { return { ...model, read_model_state: "revoked", items: [], source_store_id: null, validation: { complete: false, ready_for_read_model_review: false, blocking_reasons: model.validation.blocking_reasons, warnings: [...model.validation.warnings, safe(reason, "Runtime scheduler queue read model was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueReadModelReview(review: RuntimeSchedulerQueueReadModelReview, reason?: string): RuntimeSchedulerQueueReadModelReview { return { ...review, review_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler queue read model review was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueReadModelSafeReport(report: RuntimeSchedulerQueueReadModelSafeReport, reason?: string): RuntimeSchedulerQueueReadModelSafeReport { return { ...report, safe_report_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Runtime scheduler queue read model safe report was revoked.")] } }; }
