import type { OAuthClientConfig, SafeDashboardAccount } from "./video-orchestrator-dashboard.js";

export type VideoOrchestratorDashboardRouteHandlerWiringState = "ready_for_precise_patch" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRouteHandlerWiringReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRouteHandlerWiringSafeReportState = "complete" | "requires_operator_confirmation_for_precise_dashboard_patch_or_git_staging" | "blocked" | "revoked";

export interface VideoOrchestratorDashboardRouteHandlerWiringInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  target_helper: "renderAccountsAndCredentialsPanel";
  target_status_field: "account_ui_html";
  allow_plan_only: true;
  allow_blind_patch: false;
  allow_secret_access: false;
  allow_oauth_exchange: false;
  allow_runtime_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorDashboardRouteHandlerCallShape {
  helper_name: "renderAccountsAndCredentialsPanel";
  required_arguments: ["accounts", "oauth_client_config", "account_ui_html"];
  accounts_type: "SafeDashboardAccount[]";
  oauth_client_config_type: "OAuthClientConfig";
  account_ui_html_type: "string";
  safe_summary: string;
}

export interface VideoOrchestratorDashboardRouteHandlerWiringPlan {
  schema_version: "1.0";
  route_handler_wiring_plan_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  wiring_state: VideoOrchestratorDashboardRouteHandlerWiringState;
  call_shape: VideoOrchestratorDashboardRouteHandlerCallShape;
  example_accounts_count: number;
  oauth_configured: boolean;
  account_ui_html_available: boolean;
  blind_patch_allowed: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_precise_patch_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringPlan" | "revokeVideoOrchestratorDashboardRouteHandlerWiringPlan" };
}

export interface VideoOrchestratorDashboardRouteHandlerWiringReview {
  schema_version: "1.0";
  route_handler_wiring_review_id: string;
  route_handler_wiring_plan_id: string;
  created_at: string;
  review_state: VideoOrchestratorDashboardRouteHandlerWiringReviewState;
  review_only: true;
  ready_for_precise_patch: boolean;
  blind_patch_allowed: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringReview" | "revokeVideoOrchestratorDashboardRouteHandlerWiringReview"; source_plan_id: string };
}

export interface VideoOrchestratorDashboardRouteHandlerWiringSafeReport {
  schema_version: "1.0";
  route_handler_wiring_safe_report_id: string;
  route_handler_wiring_review_id: string;
  route_handler_wiring_plan_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorDashboardRouteHandlerWiringSafeReportState;
  safe_report_only: true;
  ready_for_precise_patch: boolean;
  blind_patch_allowed: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringSafeReport" | "revokeVideoOrchestratorDashboardRouteHandlerWiringSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text : fallback;
}

function inputReady(input: VideoOrchestratorDashboardRouteHandlerWiringInput): boolean {
  return input.target_helper === "renderAccountsAndCredentialsPanel"
    && input.target_status_field === "account_ui_html"
    && input.allow_plan_only === true
    && input.allow_blind_patch === false
    && input.allow_secret_access === false
    && input.allow_oauth_exchange === false
    && input.allow_runtime_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0;
}

function accountUiHtmlReady(value: string): boolean {
  return value.includes("Video Orchestrator Accounts")
    && !value.includes("[CREDENTIAL_REFERENCE]")
    && !value.includes("[CLIENT_SECRET]")
    && !value.includes("[TOKEN]")
    && !value.toLowerCase().includes("keychain://");
}

export function createVideoOrchestratorDashboardRouteHandlerWiringPlan(input: VideoOrchestratorDashboardRouteHandlerWiringInput, accounts: SafeDashboardAccount[], oauthClientConfig: OAuthClientConfig, accountUiHtml: string, options: { id?: string; created_at?: string } = {}): VideoOrchestratorDashboardRouteHandlerWiringPlan {
  const ready = inputReady(input) && accountUiHtmlReady(accountUiHtml) && Array.isArray(accounts) && Boolean(oauthClientConfig);
  return {
    schema_version: "1.0",
    route_handler_wiring_plan_id: safe(options.id, `dashboard-route-handler-wiring-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    wiring_state: ready ? "ready_for_precise_patch" : "blocked",
    call_shape: { helper_name: "renderAccountsAndCredentialsPanel", required_arguments: ["accounts", "oauth_client_config", "account_ui_html"], accounts_type: "SafeDashboardAccount[]", oauth_client_config_type: "OAuthClientConfig", account_ui_html_type: "string", safe_summary: "Patch the precise existing render call to pass account_ui_html as the third argument." },
    example_accounts_count: accounts.length,
    oauth_configured: oauthClientConfig.configured,
    account_ui_html_available: accountUiHtmlReady(accountUiHtml),
    blind_patch_allowed: false,
    secret_accessed: false,
    oauth_exchange_executed: false,
    runtime_write_executed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_precise_patch_review: ready, blocking_reasons: ready ? [] : ["Route-handler wiring input or safe account UI HTML was not ready."], warnings: ["Plan only; do not blind-patch the large dashboard route tree without an exact verified callsite."] },
    provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringPlan" },
  };
}

function planReady(plan: VideoOrchestratorDashboardRouteHandlerWiringPlan): boolean {
  return plan.wiring_state === "ready_for_precise_patch" && plan.validation.complete && plan.validation.ready_for_precise_patch_review && plan.account_ui_html_available && !plan.blind_patch_allowed && !plan.secret_accessed && !plan.oauth_exchange_executed && !plan.runtime_write_executed && !plan.git_add_executed && !plan.committed_now && !plan.pushed_now;
}

export function createVideoOrchestratorDashboardRouteHandlerWiringReview(plan: VideoOrchestratorDashboardRouteHandlerWiringPlan, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorDashboardRouteHandlerWiringReview {
  const ready = planReady(plan);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", route_handler_wiring_review_id: safe(options.id, "dashboard-route-handler-wiring-review-001"), route_handler_wiring_plan_id: plan.route_handler_wiring_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, ready_for_precise_patch: ready, blind_patch_allowed: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Route-handler wiring plan was not ready for review."], warnings: ["Review does not approve blind patching, secret access, OAuth exchange, runtime writes, staging, commits, or pushes."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringReview", source_plan_id: plan.route_handler_wiring_plan_id } };
}

export function createVideoOrchestratorDashboardRouteHandlerWiringSafeReport(review: VideoOrchestratorDashboardRouteHandlerWiringReview, plan: VideoOrchestratorDashboardRouteHandlerWiringPlan, options: { id?: string; created_at?: string; requestPrecisePatchOrGitStaging?: boolean } = {}): VideoOrchestratorDashboardRouteHandlerWiringSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && planReady(plan);
  const requiresConfirmation = ready && options.requestPrecisePatchOrGitStaging !== false;
  return { schema_version: "1.0", route_handler_wiring_safe_report_id: safe(options.id, "dashboard-route-handler-wiring-safe-report-001"), route_handler_wiring_review_id: review.route_handler_wiring_review_id, route_handler_wiring_plan_id: plan.route_handler_wiring_plan_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_precise_dashboard_patch_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, ready_for_precise_patch: ready, blind_patch_allowed: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit operator confirmation required before precise dashboard route patch or git staging."] : ["Route-handler wiring review was not ready for safe report."], warnings: ["Stop before precise dashboard route patching, staging, commits, or pushes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRouteHandlerWiringSafeReport", source_review_id: review.route_handler_wiring_review_id } };
}

export function revokeVideoOrchestratorDashboardRouteHandlerWiringPlan(plan: VideoOrchestratorDashboardRouteHandlerWiringPlan, reason?: string): VideoOrchestratorDashboardRouteHandlerWiringPlan { return { ...plan, wiring_state: "revoked", blind_patch_allowed: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_precise_patch_review: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Route-handler wiring plan was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorDashboardRouteHandlerWiringPlan" } }; }
export function revokeVideoOrchestratorDashboardRouteHandlerWiringReview(review: VideoOrchestratorDashboardRouteHandlerWiringReview, reason?: string): VideoOrchestratorDashboardRouteHandlerWiringReview { return { ...review, review_state: "revoked", ready_for_precise_patch: false, blind_patch_allowed: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Route-handler wiring review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorDashboardRouteHandlerWiringReview" } }; }
export function revokeVideoOrchestratorDashboardRouteHandlerWiringSafeReport(report: VideoOrchestratorDashboardRouteHandlerWiringSafeReport, reason?: string): VideoOrchestratorDashboardRouteHandlerWiringSafeReport { return { ...report, safe_report_state: "revoked", ready_for_precise_patch: false, blind_patch_allowed: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Route-handler wiring safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorDashboardRouteHandlerWiringSafeReport" } }; }
