import type { VideoOrchestratorRuntimeSchedulerQueueBuildResult, VideoOrchestratorRuntimeSchedulerQueueItem } from "./video-orchestrator-runtime-scheduler-queue.js";

export type RuntimeSchedulerQueueArtifactState = "ready_for_operator_review" | "blocked" | "revoked";
export type RuntimeSchedulerQueueArtifactReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type RuntimeSchedulerQueueArtifactSafeReportState = "complete" | "requires_operator_confirmation_for_file_write_or_git_staging" | "blocked" | "revoked";

export interface RuntimeSchedulerQueueArtifactInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  artifact_id: string;
  proposed_path: string;
  allow_artifact_only: true;
  allow_file_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerQueueArtifactItem {
  queue_item_id: string;
  project_id: string;
  platform: VideoOrchestratorRuntimeSchedulerQueueItem["platform"];
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  state: VideoOrchestratorRuntimeSchedulerQueueItem["state"];
  adapter_id: string | null;
  resume_supported: boolean;
  previous_attempt_count: number;
  next_action: string;
}

export interface RuntimeSchedulerQueueArtifact {
  schema_version: "1.0";
  artifact_id: string;
  project_id: string;
  generated_at: string;
  proposed_path: string;
  dry_run_only: true;
  queue_result_id: string;
  items: RuntimeSchedulerQueueArtifactItem[];
  safety: {
    file_written: false;
    live_scheduler_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
  };
}

export interface RuntimeSchedulerQueueArtifactBuildResult {
  schema_version: "1.0";
  artifact_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  artifact_state: RuntimeSchedulerQueueArtifactState;
  artifact: RuntimeSchedulerQueueArtifact | null;
  artifact_json_preview: string;
  artifact_only: true;
  file_written_now: false;
  live_scheduler_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_artifact_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerQueueArtifactReview {
  schema_version: "1.0";
  review_id: string;
  artifact_result_id: string;
  created_at: string;
  review_state: RuntimeSchedulerQueueArtifactReviewState;
  review_only: true;
  artifact_item_count: number;
  file_written_now: false;
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

export interface RuntimeSchedulerQueueArtifactSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  artifact_result_id: string;
  created_at: string;
  safe_report_state: RuntimeSchedulerQueueArtifactSafeReportState;
  safe_report_only: true;
  artifact_item_count: number;
  file_written_now: false;
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

function safePath(path: string): string {
  const text = safe(path, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  if (text.startsWith("/") || text.includes("..") || text.includes(".env") || text.includes(".git/") || text.includes("node_modules/") || text.includes("secrets")) return "blocked-path";
  return text;
}

function inputReady(input: RuntimeSchedulerQueueArtifactInput): boolean {
  return input.allow_artifact_only === true
    && input.allow_file_write === false
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
    && input.artifact_id.trim().length > 0
    && safePath(input.proposed_path) !== "blocked-path";
}

function queueReady(queue: VideoOrchestratorRuntimeSchedulerQueueBuildResult): boolean {
  return queue.schema_version === "1.0"
    && queue.queue_state === "ready_for_operator_review"
    && queue.validation.complete
    && queue.validation.ready_for_queue_review
    && queue.safety.dry_run_queue_only
    && !queue.safety.live_scheduler_executed
    && !queue.safety.upload_executed
    && !queue.safety.network_calls_made
    && !queue.safety.credential_accessed
    && !queue.safety.media_read_performed
    && !queue.safety.files_written
    && !queue.safety.git_add_executed
    && !queue.safety.committed_now
    && !queue.safety.pushed_now;
}

function hasUnsafeJsonShape(json: string): boolean {
  return /\b(access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization[_-]?code|credential[_-]?reference)\b/i.test(json)
    || json.includes("[TOKEN")
    || json.includes("[API_KEY")
    || json.includes("[CLIENT_SECRET")
    || json.toLowerCase().includes("keychain://");
}

function toArtifactItem(item: VideoOrchestratorRuntimeSchedulerQueueItem): RuntimeSchedulerQueueArtifactItem {
  return {
    queue_item_id: item.queue_item_id,
    project_id: item.project_id,
    platform: item.platform,
    account_id: item.account_id,
    content_id: item.content_id,
    desired_publish_at: item.desired_publish_at,
    state: item.state,
    adapter_id: item.adapter_id,
    resume_supported: item.resume_supported,
    previous_attempt_count: item.previous_attempt_count,
    next_action: item.next_action,
  };
}

export function buildRuntimeSchedulerQueueArtifact(input: RuntimeSchedulerQueueArtifactInput, queue: VideoOrchestratorRuntimeSchedulerQueueBuildResult, options: { id?: string; created_at?: string } = {}): RuntimeSchedulerQueueArtifactBuildResult {
  const createdAt = safe(options.created_at, "1970-01-01T00:00:00.000Z");
  const readyBase = inputReady(input) && queueReady(queue);
  const artifact: RuntimeSchedulerQueueArtifact | null = readyBase ? {
    schema_version: "1.0",
    artifact_id: safe(input.artifact_id, "runtime-scheduler-queue-artifact"),
    project_id: safe(input.project_id, "project"),
    generated_at: createdAt,
    proposed_path: safePath(input.proposed_path),
    dry_run_only: true,
    queue_result_id: queue.queue_result_id,
    items: queue.items.map(toArtifactItem),
    safety: { file_written: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false },
  } : null;
  const preview = artifact ? JSON.stringify(artifact, null, 2) : "";
  const ready = readyBase && artifact !== null && !hasUnsafeJsonShape(preview);
  return {
    schema_version: "1.0",
    artifact_result_id: safe(options.id, `runtime-scheduler-queue-artifact-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: createdAt,
    artifact_state: ready ? "ready_for_operator_review" : "blocked",
    artifact: ready ? artifact : null,
    artifact_json_preview: ready ? preview : "",
    artifact_only: true,
    file_written_now: false,
    live_scheduler_executed: false,
    upload_executed: false,
    network_calls_made: false,
    credential_accessed: false,
    media_read_performed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_artifact_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler queue artifact input or source queue was unsafe/incomplete."], warnings: ["Artifact preview only; no file, live scheduler, upload, network, credential, media, or git behavior is enabled."] },
  };
}

function resultReady(result: RuntimeSchedulerQueueArtifactBuildResult): boolean {
  return result.artifact_state === "ready_for_operator_review" && result.validation.complete && result.validation.ready_for_artifact_review && result.artifact_only && result.artifact !== null && !result.file_written_now && !result.live_scheduler_executed && !result.upload_executed && !result.network_calls_made && !result.credential_accessed && !result.media_read_performed && !result.git_add_executed && !result.committed_now && !result.pushed_now;
}

export function createRuntimeSchedulerQueueArtifactReview(result: RuntimeSchedulerQueueArtifactBuildResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): RuntimeSchedulerQueueArtifactReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "runtime-scheduler-queue-artifact-review-001"), artifact_result_id: result.artifact_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, artifact_item_count: result.artifact?.items.length ?? 0, file_written_now: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Runtime scheduler queue artifact result was not ready for review."], warnings: ["Review does not approve file writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createRuntimeSchedulerQueueArtifactSafeReport(review: RuntimeSchedulerQueueArtifactReview, result: RuntimeSchedulerQueueArtifactBuildResult, options: { id?: string; created_at?: string; requestFileWriteOrGitStaging?: boolean } = {}): RuntimeSchedulerQueueArtifactSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestFileWriteOrGitStaging !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "runtime-scheduler-queue-artifact-safe-report-001"), review_id: review.review_id, artifact_result_id: result.artifact_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_file_write_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, artifact_item_count: result.artifact?.items.length ?? 0, file_written_now: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before file write or git staging."] : ["Runtime scheduler queue artifact review was not ready for safe report."], warnings: ["Stop before file writes, staging, commits, or pushes unless separately approved."] } };
}

export function revokeRuntimeSchedulerQueueArtifact(result: RuntimeSchedulerQueueArtifactBuildResult, reason?: string): RuntimeSchedulerQueueArtifactBuildResult { return { ...result, artifact_state: "revoked", artifact: null, artifact_json_preview: "", validation: { complete: false, ready_for_artifact_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Runtime scheduler queue artifact was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueArtifactReview(review: RuntimeSchedulerQueueArtifactReview, reason?: string): RuntimeSchedulerQueueArtifactReview { return { ...review, review_state: "revoked", artifact_item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler queue artifact review was revoked.")] } }; }
export function revokeRuntimeSchedulerQueueArtifactSafeReport(report: RuntimeSchedulerQueueArtifactSafeReport, reason?: string): RuntimeSchedulerQueueArtifactSafeReport { return { ...report, safe_report_state: "revoked", artifact_item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Runtime scheduler queue artifact safe report was revoked.")] } }; }
