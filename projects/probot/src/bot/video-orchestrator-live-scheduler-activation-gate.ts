import type { RuntimeSchedulerQueueArtifactBuildResult } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";

export type LiveSchedulerActivationGateState = "blocked" | "ready_for_operator_review" | "revoked";
export type LiveSchedulerActivationReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type LiveSchedulerActivationSafeReportState = "requires_operator_confirmation_for_live_scheduler" | "complete" | "blocked" | "revoked";

export interface LiveSchedulerActivationGateInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  gate_id: string;
  allow_gate_only: true;
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

export interface LiveSchedulerActivationGateResult {
  schema_version: "1.0";
  gate_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  gate_state: LiveSchedulerActivationGateState;
  gate_id: string;
  artifact_result_id: string | null;
  artifact_item_count: number;
  eligible_dry_run_item_count: number;
  live_scheduler_allowed: false;
  live_scheduler_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  files_written: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  next_action: string;
  validation: { complete: boolean; ready_for_activation_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface LiveSchedulerActivationReview {
  schema_version: "1.0";
  review_id: string;
  gate_result_id: string;
  created_at: string;
  review_state: LiveSchedulerActivationReviewState;
  review_only: true;
  artifact_item_count: number;
  live_scheduler_allowed: false;
  live_scheduler_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_safe_report: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface LiveSchedulerActivationSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  gate_result_id: string;
  created_at: string;
  safe_report_state: LiveSchedulerActivationSafeReportState;
  safe_report_only: true;
  artifact_item_count: number;
  live_scheduler_allowed: false;
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

function inputReady(input: LiveSchedulerActivationGateInput): boolean {
  return input.allow_gate_only === true
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
    && input.gate_id.trim().length > 0;
}

function artifactReady(artifact: RuntimeSchedulerQueueArtifactBuildResult): boolean {
  return artifact.schema_version === "1.0"
    && artifact.artifact_state === "ready_for_operator_review"
    && artifact.validation.complete
    && artifact.validation.ready_for_artifact_review
    && artifact.artifact_only
    && artifact.artifact !== null
    && !artifact.file_written_now
    && !artifact.live_scheduler_executed
    && !artifact.upload_executed
    && !artifact.network_calls_made
    && !artifact.credential_accessed
    && !artifact.media_read_performed
    && !artifact.git_add_executed
    && !artifact.committed_now
    && !artifact.pushed_now;
}

function eligibleDryRunItems(artifact: RuntimeSchedulerQueueArtifactBuildResult): number {
  return artifact.artifact?.items.filter((item) => item.state === "queued_dry_run").length ?? 0;
}

export function createLiveSchedulerActivationGate(input: LiveSchedulerActivationGateInput, artifact: RuntimeSchedulerQueueArtifactBuildResult, options: { id?: string; created_at?: string } = {}): LiveSchedulerActivationGateResult {
  const ready = inputReady(input) && artifactReady(artifact);
  const eligible = ready ? eligibleDryRunItems(artifact) : 0;
  return {
    schema_version: "1.0",
    gate_result_id: safe(options.id, `live-scheduler-activation-gate-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    gate_state: ready ? "ready_for_operator_review" : "blocked",
    gate_id: safe(input.gate_id, "live-scheduler-activation-gate"),
    artifact_result_id: ready ? artifact.artifact_result_id : null,
    artifact_item_count: ready ? artifact.artifact?.items.length ?? 0 : 0,
    eligible_dry_run_item_count: eligible,
    live_scheduler_allowed: false,
    live_scheduler_executed: false,
    upload_executed: false,
    network_calls_made: false,
    credential_accessed: false,
    media_read_performed: false,
    files_written: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    next_action: ready ? "Review dry-run queue evidence before separately approving any live scheduler implementation." : "Fix blocked gate input or source artifact before live scheduler review.",
    validation: { complete: ready, ready_for_activation_review: ready, blocking_reasons: ready ? [] : ["Live scheduler activation gate input or source artifact was unsafe/incomplete."], warnings: ["Gate only; live scheduler, uploads, network, credentials, media reads, file writes, staging, commits, and pushes remain disabled."] },
  };
}

function gateReady(gate: LiveSchedulerActivationGateResult): boolean {
  return gate.gate_state === "ready_for_operator_review"
    && gate.validation.complete
    && gate.validation.ready_for_activation_review
    && !gate.live_scheduler_allowed
    && !gate.live_scheduler_executed
    && !gate.upload_executed
    && !gate.network_calls_made
    && !gate.credential_accessed
    && !gate.media_read_performed
    && !gate.files_written
    && !gate.git_add_executed
    && !gate.committed_now
    && !gate.pushed_now;
}

export function createLiveSchedulerActivationReview(gate: LiveSchedulerActivationGateResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): LiveSchedulerActivationReview {
  const ready = gateReady(gate);
  const readyForSafeReport = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    review_id: safe(options.id, "live-scheduler-activation-review-001"),
    gate_result_id: gate.gate_result_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForSafeReport ? "approved_for_safe_report" : "blocked",
    review_only: true,
    artifact_item_count: gate.artifact_item_count,
    live_scheduler_allowed: false,
    live_scheduler_executed: false,
    upload_executed: false,
    network_calls_made: false,
    credential_accessed: false,
    media_read_performed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_safe_report: readyForSafeReport, blocking_reasons: ready ? [] : ["Live scheduler activation gate was not ready for review."], warnings: ["Review does not approve live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] },
  };
}

export function createLiveSchedulerActivationSafeReport(review: LiveSchedulerActivationReview, gate: LiveSchedulerActivationGateResult, options: { id?: string; created_at?: string; requestLiveScheduler?: boolean } = {}): LiveSchedulerActivationSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && gateReady(gate);
  const requiresConfirmation = ready && options.requestLiveScheduler !== false;
  return {
    schema_version: "1.0",
    safe_report_id: safe(options.id, "live-scheduler-activation-safe-report-001"),
    review_id: review.review_id,
    gate_result_id: gate.gate_result_id,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_live_scheduler" : ready ? "complete" : "blocked",
    safe_report_only: true,
    artifact_item_count: gate.artifact_item_count,
    live_scheduler_allowed: false,
    live_scheduler_executed: false,
    upload_executed: false,
    network_calls_made: false,
    credential_accessed: false,
    media_read_performed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before live scheduler implementation."] : ["Live scheduler activation review was not ready for safe report."], warnings: ["Stop before live scheduler implementation unless separately approved."] },
  };
}

export function revokeLiveSchedulerActivationGate(gate: LiveSchedulerActivationGateResult, reason?: string): LiveSchedulerActivationGateResult { return { ...gate, gate_state: "revoked", artifact_result_id: null, artifact_item_count: 0, eligible_dry_run_item_count: 0, validation: { complete: false, ready_for_activation_review: false, blocking_reasons: gate.validation.blocking_reasons, warnings: [...gate.validation.warnings, safe(reason, "Live scheduler activation gate was revoked.")] } }; }
export function revokeLiveSchedulerActivationReview(review: LiveSchedulerActivationReview, reason?: string): LiveSchedulerActivationReview { return { ...review, review_state: "revoked", artifact_item_count: 0, validation: { complete: false, ready_for_safe_report: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Live scheduler activation review was revoked.")] } }; }
export function revokeLiveSchedulerActivationSafeReport(report: LiveSchedulerActivationSafeReport, reason?: string): LiveSchedulerActivationSafeReport { return { ...report, safe_report_state: "revoked", artifact_item_count: 0, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Live scheduler activation safe report was revoked.")] } }; }
