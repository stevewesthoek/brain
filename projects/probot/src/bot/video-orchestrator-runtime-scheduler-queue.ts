import type { VideoOrchestratorScheduleResumeDecision, VideoOrchestratorScheduleResumePlan } from "./video-orchestrator-platform-scheduler-resume.js";

export type VideoOrchestratorRuntimeSchedulerQueueState = "ready_for_operator_review" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeSchedulerQueueReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeSchedulerQueueSafeReportState = "complete" | "requires_operator_confirmation_for_live_scheduler_or_git_staging" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeSchedulerQueueItemState = "queued_dry_run" | "deferred" | "manual_fallback" | "blocked";

export interface VideoOrchestratorRuntimeSchedulerQueueInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  queue_id: string;
  allow_dry_run_queue_only: true;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorRuntimeSchedulerQueueItem {
  queue_item_id: string;
  project_id: string;
  platform: VideoOrchestratorScheduleResumeDecision["platform"];
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  state: VideoOrchestratorRuntimeSchedulerQueueItemState;
  source_action: VideoOrchestratorScheduleResumeDecision["action"];
  adapter_id: string | null;
  resume_supported: boolean;
  previous_attempt_count: number;
  next_action: string;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
}

export interface VideoOrchestratorRuntimeSchedulerQueueBuildResult {
  schema_version: "1.0";
  queue_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  queue_state: VideoOrchestratorRuntimeSchedulerQueueState;
  queue_id: string;
  items: VideoOrchestratorRuntimeSchedulerQueueItem[];
  summary: {
    item_count: number;
    queued_dry_run_count: number;
    deferred_count: number;
    manual_fallback_count: number;
    blocked_count: number;
    resume_supported_count: number;
  };
  safety: {
    dry_run_queue_only: true;
    live_scheduler_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
  validation: { complete: boolean; ready_for_queue_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface VideoOrchestratorRuntimeSchedulerQueueReview {
  schema_version: "1.0";
  queue_review_id: string;
  queue_result_id: string;
  created_at: string;
  review_state: VideoOrchestratorRuntimeSchedulerQueueReviewState;
  review_only: true;
  item_count: number;
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

export interface VideoOrchestratorRuntimeSchedulerQueueSafeReport {
  schema_version: "1.0";
  queue_safe_report_id: string;
  queue_review_id: string;
  queue_result_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorRuntimeSchedulerQueueSafeReportState;
  safe_report_only: true;
  item_count: number;
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
  return text ? text.slice(0, 160) : fallback;
}

function inputReady(input: VideoOrchestratorRuntimeSchedulerQueueInput): boolean {
  return input.allow_dry_run_queue_only === true
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.queue_id.trim().length > 0;
}

function planReady(plan: VideoOrchestratorScheduleResumePlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "ready_for_operator_review"
    && plan.validation.complete
    && plan.validation.ready_for_scheduler_review
    && plan.safety.contract_only
    && !plan.safety.runtime_schedule_executed
    && !plan.safety.upload_executed
    && !plan.safety.network_calls_made
    && !plan.safety.credential_accessed
    && !plan.safety.media_read_performed
    && !plan.safety.files_written
    && !plan.safety.git_add_executed
    && !plan.safety.committed_now
    && !plan.safety.pushed_now;
}

function queueStateForDecision(decision: VideoOrchestratorScheduleResumeDecision): VideoOrchestratorRuntimeSchedulerQueueItemState {
  if (decision.action === "schedule") return "queued_dry_run";
  if (decision.action === "defer") return "deferred";
  if (decision.action === "manual_fallback") return "manual_fallback";
  return "blocked";
}

function toQueueItem(decision: VideoOrchestratorScheduleResumeDecision): VideoOrchestratorRuntimeSchedulerQueueItem {
  const state = queueStateForDecision(decision);
  const suffix = state === "queued_dry_run" && decision.previous_attempt_count > 0 ? " Resume metadata preserved for a future live scheduler." : "";
  return {
    queue_item_id: `${safe(decision.project_id, "project")}-${safe(decision.platform, "platform")}-${safe(decision.content_id, "content")}`,
    project_id: safe(decision.project_id, "project"),
    platform: decision.platform,
    account_id: safe(decision.account_id, "account"),
    content_id: safe(decision.content_id, "content"),
    desired_publish_at: safe(decision.desired_publish_at, "1970-01-01T00:00:00.000Z"),
    state,
    source_action: decision.action,
    adapter_id: decision.adapter_id,
    resume_supported: decision.resume_supported,
    previous_attempt_count: decision.previous_attempt_count,
    next_action: `${decision.next_action}${suffix}`,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
  };
}

export function buildVideoOrchestratorRuntimeSchedulerQueue(input: VideoOrchestratorRuntimeSchedulerQueueInput, plan: VideoOrchestratorScheduleResumePlan, options: { id?: string; created_at?: string } = {}): VideoOrchestratorRuntimeSchedulerQueueBuildResult {
  const ready = inputReady(input) && planReady(plan);
  const items = ready ? plan.decisions.map(toQueueItem) : [];
  return {
    schema_version: "1.0",
    queue_result_id: safe(options.id, `runtime-scheduler-queue-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    queue_state: ready ? "ready_for_operator_review" : "blocked",
    queue_id: safe(input.queue_id, "runtime-scheduler-queue"),
    items,
    summary: {
      item_count: items.length,
      queued_dry_run_count: items.filter((item) => item.state === "queued_dry_run").length,
      deferred_count: items.filter((item) => item.state === "deferred").length,
      manual_fallback_count: items.filter((item) => item.state === "manual_fallback").length,
      blocked_count: items.filter((item) => item.state === "blocked").length,
      resume_supported_count: items.filter((item) => item.resume_supported).length,
    },
    safety: { dry_run_queue_only: true, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
    validation: { complete: ready, ready_for_queue_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler queue input or schedule/resume plan was not safe for dry-run queue construction."], warnings: ["Dry-run queue only; no live scheduler, upload, network, credential, media, file, or git behavior is enabled."] },
  };
}

function resultReady(result: VideoOrchestratorRuntimeSchedulerQueueBuildResult): boolean {
  return result.queue_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_queue_review && result.safety.dry_run_queue_only && !result.safety.live_scheduler_executed && !result.safety.upload_executed && !result.safety.network_calls_made && !result.safety.credential_accessed && !result.safety.media_read_performed && !result.safety.files_written && !result.safety.git_add_executed && !result.safety.committed_now && !result.safety.pushed_now;
}

export function createVideoOrchestratorRuntimeSchedulerQueueReview(result: VideoOrchestratorRuntimeSchedulerQueueBuildResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorRuntimeSchedulerQueueReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", queue_review_id: safe(options.id, "runtime-scheduler-queue-review-001"), queue_result_id: result.queue_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, item_count: result.summary.item_count, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Runtime scheduler queue result was not ready for review."], warnings: ["Review does not approve live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createVideoOrchestratorRuntimeSchedulerQueueSafeReport(review: VideoOrchestratorRuntimeSchedulerQueueReview, result: VideoOrchestratorRuntimeSchedulerQueueBuildResult, options: { id?: string; created_at?: string; requestLiveSchedulerOrGitStaging?: boolean } = {}): VideoOrchestratorRuntimeSchedulerQueueSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestLiveSchedulerOrGitStaging !== false;
  return { schema_version: "1.0", queue_safe_report_id: safe(options.id, "runtime-scheduler-queue-safe-report-001"), queue_review_id: review.queue_review_id, queue_result_id: result.queue_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_live_scheduler_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, item_count: result.summary.item_count, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before live scheduler implementation or git staging."] : ["Runtime scheduler queue review was not ready for safe report."], warnings: ["Stop before live scheduler implementation, staging, commits, or pushes unless separately approved."] } };
}

export function revokeVideoOrchestratorRuntimeSchedulerQueue(result: VideoOrchestratorRuntimeSchedulerQueueBuildResult, reason?: string): VideoOrchestratorRuntimeSchedulerQueueBuildResult { return { ...result, queue_state: "revoked", items: [], validation: { complete: false, ready_for_queue_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Runtime scheduler queue was revoked.")] } }; }
export function revokeVideoOrchestratorRuntimeSchedulerQueueReview(review: VideoOrchestratorRuntimeSchedulerQueueReview, reason?: string): VideoOrchestratorRuntimeSchedulerQueueReview { return { ...review, review_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler queue review was revoked.")] } }; }
export function revokeVideoOrchestratorRuntimeSchedulerQueueSafeReport(report: VideoOrchestratorRuntimeSchedulerQueueSafeReport, reason?: string): VideoOrchestratorRuntimeSchedulerQueueSafeReport { return { ...report, safe_report_state: "revoked", item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Runtime scheduler queue safe report was revoked.")] } }; }
