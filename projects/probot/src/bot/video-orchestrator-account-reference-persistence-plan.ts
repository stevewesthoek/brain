import type { VideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";

export type VideoOrchestratorAccountReferencePersistencePlanState = "ready_for_operator_review" | "blocked" | "revoked";
export type VideoOrchestratorAccountReferencePersistenceReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorAccountReferencePersistenceSafeReportState = "complete" | "requires_operator_confirmation_for_persistence_implementation_or_git_staging" | "blocked" | "revoked";
export type VideoOrchestratorAccountReferencePersistenceTarget = "repo_local_json" | "dashboard_runtime_store" | "external_secret_store_reference";

export interface VideoOrchestratorAccountReferencePersistenceInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  persistence_target: VideoOrchestratorAccountReferencePersistenceTarget;
  proposed_path: string;
  allow_plan_only: true;
  allow_file_write: false;
  allow_env_write: false;
  allow_keychain_write: false;
  allow_sensitive_value_storage: false;
  allow_oauth_exchange: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorAccountReferencePersistencePlan {
  schema_version: "1.0";
  persistence_plan_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  plan_state: VideoOrchestratorAccountReferencePersistencePlanState;
  persistence_target: VideoOrchestratorAccountReferencePersistenceTarget;
  proposed_path: string;
  reference_count: number;
  rejected_sensitive_value_count: number;
  dry_run_only: true;
  file_write_enabled: false;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_persistence_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistencePlan" | "revokeVideoOrchestratorAccountReferencePersistencePlan" };
}

export interface VideoOrchestratorAccountReferencePersistenceReview {
  schema_version: "1.0";
  persistence_review_id: string;
  persistence_plan_id: string;
  created_at: string;
  review_state: VideoOrchestratorAccountReferencePersistenceReviewState;
  review_only: true;
  dry_run_only: true;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistenceReview" | "revokeVideoOrchestratorAccountReferencePersistenceReview"; source_plan_id: string };
}

export interface VideoOrchestratorAccountReferencePersistenceSafeReport {
  schema_version: "1.0";
  persistence_safe_report_id: string;
  persistence_review_id: string;
  persistence_plan_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorAccountReferencePersistenceSafeReportState;
  safe_report_only: true;
  dry_run_only: true;
  file_written_now: false;
  env_write_enabled: false;
  keychain_write_enabled: false;
  sensitive_value_storage_enabled: false;
  oauth_exchange_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistenceSafeReport" | "revokeVideoOrchestratorAccountReferencePersistenceSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function safePath(value: string): string {
  const path = safe(value, "operations/runbooks/video-orchestrator-account-reference-registry.example.json");
  if (path.startsWith("/") || path.includes("..") || path.includes(".env") || path.includes("node_modules/") || path.includes(".git/")) return "blocked-path";
  return path;
}

function inputReady(input: VideoOrchestratorAccountReferencePersistenceInput): boolean {
  return input.allow_plan_only === true
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

export function createVideoOrchestratorAccountReferencePersistencePlan(input: VideoOrchestratorAccountReferencePersistenceInput, model: VideoOrchestratorAccountReferenceRegistryModel, options: { id?: string; created_at?: string } = {}): VideoOrchestratorAccountReferencePersistencePlan {
  const ready = inputReady(input) && modelReady(model);
  return {
    schema_version: "1.0",
    persistence_plan_id: safe(options.id, `account-reference-persistence-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    plan_state: ready ? "ready_for_operator_review" : "blocked",
    persistence_target: input.persistence_target,
    proposed_path: safePath(input.proposed_path),
    reference_count: model.summary.reference_count,
    rejected_sensitive_value_count: model.summary.rejected_sensitive_value_count,
    dry_run_only: true,
    file_write_enabled: false,
    file_written_now: false,
    env_write_enabled: false,
    keychain_write_enabled: false,
    sensitive_value_storage_enabled: false,
    oauth_exchange_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_persistence_review: ready, blocking_reasons: ready ? [] : ["Account-reference persistence input or registry model was not safe for dry-run planning."], warnings: ["Dry-run only; no file, env, Keychain, OAuth, git, or sensitive value persistence is performed."] },
    provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistencePlan" },
  };
}

function planReady(plan: VideoOrchestratorAccountReferencePersistencePlan): boolean {
  return plan.plan_state === "ready_for_operator_review" && plan.validation.complete && plan.validation.ready_for_persistence_review && plan.dry_run_only && !plan.file_written_now && !plan.file_write_enabled && !plan.env_write_enabled && !plan.keychain_write_enabled && !plan.sensitive_value_storage_enabled && !plan.oauth_exchange_enabled && !plan.git_add_executed && !plan.committed_now && !plan.pushed_now;
}

export function createVideoOrchestratorAccountReferencePersistenceReview(plan: VideoOrchestratorAccountReferencePersistencePlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorAccountReferencePersistenceReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", persistence_review_id: safe(options.id, "account-reference-persistence-review-001"), persistence_plan_id: plan.persistence_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, dry_run_only: true, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Account-reference persistence plan was not ready for review."], warnings: ["Review does not approve persistence writes, env writes, Keychain writes, OAuth exchange, staging, commits, or pushes."] }, provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistenceReview", source_plan_id: plan.persistence_plan_id } };
}

export function createVideoOrchestratorAccountReferencePersistenceSafeReport(review: VideoOrchestratorAccountReferencePersistenceReview, plan: VideoOrchestratorAccountReferencePersistencePlan, options: { id?: string; created_at?: string; requestPersistenceImplementationOrGitStaging?: boolean } = {}): VideoOrchestratorAccountReferencePersistenceSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestPersistenceImplementationOrGitStaging !== false;
  return { schema_version: "1.0", persistence_safe_report_id: safe(options.id, "account-reference-persistence-safe-report-001"), persistence_review_id: review.persistence_review_id, persistence_plan_id: plan.persistence_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_persistence_implementation_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, dry_run_only: true, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit confirmation required before account-reference persistence implementation or git staging."] : ["Account-reference persistence review was not ready for safe report."], warnings: ["Stop before persistence implementation, staging, commits, or pushes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorAccountReferencePersistenceSafeReport", source_review_id: review.persistence_review_id } };
}

export function revokeVideoOrchestratorAccountReferencePersistencePlan(plan: VideoOrchestratorAccountReferencePersistencePlan, reason?: string): VideoOrchestratorAccountReferencePersistencePlan { return { ...plan, plan_state: "revoked", file_write_enabled: false, file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_persistence_review: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Account-reference persistence plan was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorAccountReferencePersistencePlan" } }; }
export function revokeVideoOrchestratorAccountReferencePersistenceReview(review: VideoOrchestratorAccountReferencePersistenceReview, reason?: string): VideoOrchestratorAccountReferencePersistenceReview { return { ...review, review_state: "revoked", file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Account-reference persistence review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorAccountReferencePersistenceReview" } }; }
export function revokeVideoOrchestratorAccountReferencePersistenceSafeReport(report: VideoOrchestratorAccountReferencePersistenceSafeReport, reason?: string): VideoOrchestratorAccountReferencePersistenceSafeReport { return { ...report, safe_report_state: "revoked", file_written_now: false, env_write_enabled: false, keychain_write_enabled: false, sensitive_value_storage_enabled: false, oauth_exchange_enabled: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Account-reference persistence safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorAccountReferencePersistenceSafeReport" } }; }
