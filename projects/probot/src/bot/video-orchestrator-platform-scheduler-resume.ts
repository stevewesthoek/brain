import type { SafeVideoOrchestratorPlatformAdapter, VideoOrchestratorPlatformAdapterRegistry, VideoOrchestratorPlatformId } from "./video-orchestrator-platform-adapter-registry.js";

export type VideoOrchestratorScheduleResumeState = "ready_for_operator_review" | "blocked" | "revoked";
export type VideoOrchestratorScheduleResumeReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorScheduleResumeSafeReportState = "complete" | "requires_operator_confirmation_for_runtime_scheduler_or_git_staging" | "blocked" | "revoked";
export type VideoOrchestratorScheduleResumeAction = "schedule" | "defer" | "manual_fallback" | "blocked";

export interface VideoOrchestratorScheduleResumeInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  platform: VideoOrchestratorPlatformId;
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  previous_attempt_count?: number;
  last_failure_reason?: string;
  allow_contract_only: true;
  allow_runtime_schedule: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorScheduleResumeDecision {
  decision_id: string;
  project_id: string;
  platform: VideoOrchestratorPlatformId;
  account_id: string;
  content_id: string;
  desired_publish_at: string;
  action: VideoOrchestratorScheduleResumeAction;
  adapter_id: string | null;
  resume_supported: boolean;
  scheduled_publish_supported: boolean;
  previous_attempt_count: number;
  next_action: string;
  runtime_schedule_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
}

export interface VideoOrchestratorScheduleResumePlan {
  schema_version: "1.0";
  plan_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  plan_state: VideoOrchestratorScheduleResumeState;
  decisions: VideoOrchestratorScheduleResumeDecision[];
  summary: {
    decision_count: number;
    schedule_count: number;
    defer_count: number;
    manual_fallback_count: number;
    blocked_count: number;
    resume_supported_count: number;
  };
  safety: {
    contract_only: true;
    runtime_schedule_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
  validation: { complete: boolean; ready_for_scheduler_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface VideoOrchestratorScheduleResumeReview {
  schema_version: "1.0";
  review_id: string;
  plan_id: string;
  created_at: string;
  review_state: VideoOrchestratorScheduleResumeReviewState;
  review_only: true;
  decision_count: number;
  runtime_schedule_executed: false;
  upload_executed: false;
  network_calls_made: false;
  credential_accessed: false;
  media_read_performed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface VideoOrchestratorScheduleResumeSafeReport {
  schema_version: "1.0";
  safe_report_id: string;
  review_id: string;
  plan_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorScheduleResumeSafeReportState;
  safe_report_only: true;
  decision_count: number;
  runtime_schedule_executed: false;
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

function inputReady(input: VideoOrchestratorScheduleResumeInput): boolean {
  return input.allow_contract_only === true
    && input.allow_runtime_schedule === false
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
    && input.account_id.trim().length > 0
    && input.content_id.trim().length > 0
    && !Number.isNaN(Date.parse(input.desired_publish_at));
}

function registryReady(registry: VideoOrchestratorPlatformAdapterRegistry): boolean {
  return registry.schema_version === "1.0"
    && registry.safety.contract_only
    && !registry.safety.upload_executed
    && !registry.safety.network_calls_made
    && !registry.safety.credential_accessed
    && !registry.safety.media_read_performed
    && !registry.safety.runtime_wiring_applied
    && !registry.safety.files_written;
}

function findAdapter(registry: VideoOrchestratorPlatformAdapterRegistry, platform: VideoOrchestratorPlatformId): SafeVideoOrchestratorPlatformAdapter | null {
  return registry.adapters.find((adapter) => adapter.platform === platform) ?? null;
}

function decide(input: VideoOrchestratorScheduleResumeInput, registry: VideoOrchestratorPlatformAdapterRegistry): VideoOrchestratorScheduleResumeDecision {
  const adapter = findAdapter(registry, input.platform);
  const previousAttemptCount = Math.max(0, Number(input.previous_attempt_count ?? 0));
  let action: VideoOrchestratorScheduleResumeAction = "blocked";
  let nextAction = "No safe platform adapter is available.";
  if (adapter) {
    if (adapter.status === "manual_only" || adapter.mode === "manual") {
      action = "manual_fallback";
      nextAction = "Create manual export package and let operator publish outside runtime automation.";
    } else if (adapter.status === "supported" && adapter.supports_scheduled_publish && adapter.supports_resume) {
      action = "schedule";
      nextAction = "Eligible for future runtime scheduler implementation after explicit approval.";
    } else if (adapter.status === "supported" || adapter.status === "partial") {
      action = "defer";
      nextAction = "Defer until scheduling/resume boundaries are complete for this adapter.";
    } else {
      action = "blocked";
      nextAction = "Adapter is blocked, disabled, or unknown.";
    }
  }
  return {
    decision_id: `${safe(input.project_id, "project")}-${safe(input.platform, "platform")}-${safe(input.content_id, "content")}`,
    project_id: safe(input.project_id, "project"),
    platform: input.platform,
    account_id: safe(input.account_id, "account"),
    content_id: safe(input.content_id, "content"),
    desired_publish_at: safe(input.desired_publish_at, "1970-01-01T00:00:00.000Z"),
    action,
    adapter_id: adapter?.adapter_id ?? null,
    resume_supported: Boolean(adapter?.supports_resume),
    scheduled_publish_supported: Boolean(adapter?.supports_scheduled_publish),
    previous_attempt_count: previousAttemptCount,
    next_action: previousAttemptCount > 0 && action === "schedule" ? "Resume eligible after previous attempt; still requires explicit runtime scheduler approval." : nextAction,
    runtime_schedule_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
  };
}

export function createVideoOrchestratorScheduleResumePlan(inputs: VideoOrchestratorScheduleResumeInput[], registry: VideoOrchestratorPlatformAdapterRegistry, options: { id?: string; created_at?: string } = {}): VideoOrchestratorScheduleResumePlan {
  const readyInputs = inputs.every(inputReady);
  const readyRegistry = registryReady(registry);
  const decisions = readyRegistry ? inputs.map((input) => decide(input, registry)) : [];
  const complete = readyInputs && readyRegistry && decisions.length > 0;
  return {
    schema_version: "1.0",
    plan_id: safe(options.id, "schedule-resume-plan-001"),
    request_id: safe(inputs[0]?.request_id, "request"),
    project_id: safe(inputs[0]?.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    plan_state: complete ? "ready_for_operator_review" : "blocked",
    decisions,
    summary: {
      decision_count: decisions.length,
      schedule_count: decisions.filter((decision) => decision.action === "schedule").length,
      defer_count: decisions.filter((decision) => decision.action === "defer").length,
      manual_fallback_count: decisions.filter((decision) => decision.action === "manual_fallback").length,
      blocked_count: decisions.filter((decision) => decision.action === "blocked").length,
      resume_supported_count: decisions.filter((decision) => decision.resume_supported).length,
    },
    safety: { contract_only: true, runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
    validation: { complete, ready_for_scheduler_review: complete, blocking_reasons: complete ? [] : ["Schedule/resume inputs or adapter registry were not safe for contract-only planning."], warnings: ["Contract-only scheduler/resume plan; no runtime schedule, upload, network, credential, media, file, or git behavior is enabled."] },
  };
}

function planReady(plan: VideoOrchestratorScheduleResumePlan): boolean {
  return plan.plan_state === "ready_for_operator_review" && plan.validation.complete && plan.validation.ready_for_scheduler_review && plan.safety.contract_only && !plan.safety.runtime_schedule_executed && !plan.safety.upload_executed && !plan.safety.network_calls_made && !plan.safety.credential_accessed && !plan.safety.media_read_performed && !plan.safety.files_written && !plan.safety.git_add_executed && !plan.safety.committed_now && !plan.safety.pushed_now;
}

export function createVideoOrchestratorScheduleResumeReview(plan: VideoOrchestratorScheduleResumePlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorScheduleResumeReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", review_id: safe(options.id, "schedule-resume-review-001"), plan_id: plan.plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, decision_count: plan.summary.decision_count, runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Schedule/resume plan was not ready for review."], warnings: ["Review does not approve runtime scheduling, uploads, network, credentials, media reads, staging, commits, or pushes."] } };
}

export function createVideoOrchestratorScheduleResumeSafeReport(review: VideoOrchestratorScheduleResumeReview, plan: VideoOrchestratorScheduleResumePlan, options: { id?: string; created_at?: string; requestRuntimeSchedulerOrGitStaging?: boolean } = {}): VideoOrchestratorScheduleResumeSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestRuntimeSchedulerOrGitStaging !== false;
  return { schema_version: "1.0", safe_report_id: safe(options.id, "schedule-resume-safe-report-001"), review_id: review.review_id, plan_id: plan.plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_runtime_scheduler_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, decision_count: plan.summary.decision_count, runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before runtime scheduler implementation or git staging."] : ["Schedule/resume review was not ready for safe report."], warnings: ["Stop before runtime scheduler implementation, staging, commits, or pushes unless separately approved."] } };
}

export function revokeVideoOrchestratorScheduleResumePlan(plan: VideoOrchestratorScheduleResumePlan, reason?: string): VideoOrchestratorScheduleResumePlan { return { ...plan, plan_state: "revoked", validation: { complete: false, ready_for_scheduler_review: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Schedule/resume plan was revoked.")] } }; }
export function revokeVideoOrchestratorScheduleResumeReview(review: VideoOrchestratorScheduleResumeReview, reason?: string): VideoOrchestratorScheduleResumeReview { return { ...review, review_state: "revoked", validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Schedule/resume review was revoked.")] } }; }
export function revokeVideoOrchestratorScheduleResumeSafeReport(report: VideoOrchestratorScheduleResumeSafeReport, reason?: string): VideoOrchestratorScheduleResumeSafeReport { return { ...report, safe_report_state: "revoked", validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Schedule/resume safe report was revoked.")] } }; }
