import type { VideoOrchestratorDashboardAccountUiModel } from "./video-orchestrator-dashboard-account-ui.js";

export type VideoOrchestratorDashboardRuntimeWiringState = "wired_to_status_helper" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRuntimeWiringReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRuntimeWiringSafeReportState = "complete" | "requires_operator_confirmation_for_route_composition_patch" | "blocked" | "revoked";

export interface VideoOrchestratorDashboardRuntimeWiringInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  route_surface: "account_center_status";
  allow_status_helper_wiring: true;
  allow_route_composition_patch: false;
  allow_secret_access: false;
  allow_oauth_exchange: false;
  allow_file_runtime_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorDashboardRuntimeWiringResult {
  schema_version: "1.0";
  runtime_wiring_result_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  wiring_state: VideoOrchestratorDashboardRuntimeWiringState;
  route_surface: "account_center_status";
  account_ui_html_available: boolean;
  model_summary: VideoOrchestratorDashboardAccountUiModel["summary"];
  read_only: true;
  route_composition_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  file_runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_route_composition_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringResult" | "revokeVideoOrchestratorDashboardRuntimeWiringResult" };
}

export interface VideoOrchestratorDashboardRuntimeWiringReview {
  schema_version: "1.0";
  runtime_wiring_review_id: string;
  runtime_wiring_result_id: string;
  created_at: string;
  review_state: VideoOrchestratorDashboardRuntimeWiringReviewState;
  review_only: true;
  account_ui_html_available: boolean;
  route_composition_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  file_runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringReview" | "revokeVideoOrchestratorDashboardRuntimeWiringReview"; source_result_id: string };
}

export interface VideoOrchestratorDashboardRuntimeWiringSafeReport {
  schema_version: "1.0";
  runtime_wiring_safe_report_id: string;
  runtime_wiring_review_id: string;
  runtime_wiring_result_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorDashboardRuntimeWiringSafeReportState;
  safe_report_only: true;
  account_ui_html_available: boolean;
  route_composition_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  file_runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringSafeReport" | "revokeVideoOrchestratorDashboardRuntimeWiringSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").trim();
  return text ? text.replace(/[<>]/g, "") : fallback;
}

function inputReady(input: VideoOrchestratorDashboardRuntimeWiringInput): boolean {
  return input.route_surface === "account_center_status"
    && input.allow_status_helper_wiring === true
    && input.allow_route_composition_patch === false
    && input.allow_secret_access === false
    && input.allow_oauth_exchange === false
    && input.allow_file_runtime_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0;
}

function modelReady(model: VideoOrchestratorDashboardAccountUiModel, accountUiHtml: string): boolean {
  return model.schema_version === "1.0"
    && model.safety.read_only
    && !model.safety.secrets_rendered
    && !model.safety.oauth_exchange_executed
    && !model.safety.env_written
    && !model.safety.files_written
    && !model.safety.uploads_executed
    && accountUiHtml.includes("Video Orchestrator Accounts")
    && !accountUiHtml.includes("[CREDENTIAL_REFERENCE]")
    && !accountUiHtml.includes("[CLIENT_SECRET]")
    && !accountUiHtml.includes("[TOKEN]");
}

export function createVideoOrchestratorDashboardRuntimeWiringResult(input: VideoOrchestratorDashboardRuntimeWiringInput, model: VideoOrchestratorDashboardAccountUiModel, accountUiHtml: string, options: { id?: string; created_at?: string } = {}): VideoOrchestratorDashboardRuntimeWiringResult {
  const ready = inputReady(input) && modelReady(model, accountUiHtml);
  return {
    schema_version: "1.0",
    runtime_wiring_result_id: safe(options.id, `dashboard-runtime-wiring-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    wiring_state: ready ? "wired_to_status_helper" : "blocked",
    route_surface: "account_center_status",
    account_ui_html_available: ready,
    model_summary: model.summary,
    read_only: true,
    route_composition_patched: false,
    secret_accessed: false,
    oauth_exchange_executed: false,
    file_runtime_write_executed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_route_composition_review: ready, blocking_reasons: ready ? [] : ["Dashboard runtime wiring input or account UI model was not safe."], warnings: ["Status-helper wiring only; route composition patching, secrets, OAuth exchange, runtime writes, staging, commits, and pushes remain disabled."] },
    provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringResult" },
  };
}

function resultReady(result: VideoOrchestratorDashboardRuntimeWiringResult): boolean {
  return result.wiring_state === "wired_to_status_helper" && result.validation.complete && result.validation.ready_for_route_composition_review && result.account_ui_html_available && result.read_only && !result.route_composition_patched && !result.secret_accessed && !result.oauth_exchange_executed && !result.file_runtime_write_executed && !result.git_add_executed && !result.committed_now && !result.pushed_now;
}

export function createVideoOrchestratorDashboardRuntimeWiringReview(result: VideoOrchestratorDashboardRuntimeWiringResult, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorDashboardRuntimeWiringReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", runtime_wiring_review_id: safe(options.id, "dashboard-runtime-wiring-review-001"), runtime_wiring_result_id: result.runtime_wiring_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, account_ui_html_available: result.account_ui_html_available, route_composition_patched: false, secret_accessed: false, oauth_exchange_executed: false, file_runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Dashboard runtime wiring result was not ready for review."], warnings: ["Review does not approve route composition patching, secrets, OAuth exchange, runtime writes, staging, commits, or pushes."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringReview", source_result_id: result.runtime_wiring_result_id } };
}

export function createVideoOrchestratorDashboardRuntimeWiringSafeReport(review: VideoOrchestratorDashboardRuntimeWiringReview, result: VideoOrchestratorDashboardRuntimeWiringResult, options: { id?: string; created_at?: string; requestRouteCompositionPatch?: boolean } = {}): VideoOrchestratorDashboardRuntimeWiringSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && resultReady(result);
  const requiresConfirmation = ready && options.requestRouteCompositionPatch !== false;
  return { schema_version: "1.0", runtime_wiring_safe_report_id: safe(options.id, "dashboard-runtime-wiring-safe-report-001"), runtime_wiring_review_id: review.runtime_wiring_review_id, runtime_wiring_result_id: result.runtime_wiring_result_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_route_composition_patch" : ready ? "complete" : "blocked", safe_report_only: true, account_ui_html_available: result.account_ui_html_available, route_composition_patched: false, secret_accessed: false, oauth_exchange_executed: false, file_runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit operator confirmation required before route composition patching."] : ["Dashboard runtime wiring review was not ready for safe report."], warnings: ["Stop before route composition patching, secrets, OAuth exchange, runtime writes, staging, commits, or pushes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRuntimeWiringSafeReport", source_review_id: review.runtime_wiring_review_id } };
}

export function revokeVideoOrchestratorDashboardRuntimeWiringResult(result: VideoOrchestratorDashboardRuntimeWiringResult, reason?: string): VideoOrchestratorDashboardRuntimeWiringResult { return { ...result, wiring_state: "revoked", account_ui_html_available: false, route_composition_patched: false, secret_accessed: false, oauth_exchange_executed: false, file_runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_route_composition_review: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Dashboard runtime wiring result was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorDashboardRuntimeWiringResult" } }; }
export function revokeVideoOrchestratorDashboardRuntimeWiringReview(review: VideoOrchestratorDashboardRuntimeWiringReview, reason?: string): VideoOrchestratorDashboardRuntimeWiringReview { return { ...review, review_state: "revoked", account_ui_html_available: false, route_composition_patched: false, secret_accessed: false, oauth_exchange_executed: false, file_runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Dashboard runtime wiring review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorDashboardRuntimeWiringReview" } }; }
export function revokeVideoOrchestratorDashboardRuntimeWiringSafeReport(report: VideoOrchestratorDashboardRuntimeWiringSafeReport, reason?: string): VideoOrchestratorDashboardRuntimeWiringSafeReport { return { ...report, safe_report_state: "revoked", account_ui_html_available: false, route_composition_patched: false, secret_accessed: false, oauth_exchange_executed: false, file_runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Dashboard runtime wiring safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorDashboardRuntimeWiringSafeReport" } }; }
