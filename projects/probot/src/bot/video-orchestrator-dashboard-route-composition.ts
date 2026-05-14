import { redactVideoOrchestratorText } from "./video-orchestrator-dashboard.js";

export type VideoOrchestratorDashboardRouteCompositionState = "ready_for_render_insertion" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRouteCompositionReviewState = "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorDashboardRouteCompositionSafeReportState = "complete" | "requires_operator_confirmation_for_render_tree_patch_or_git_staging" | "blocked" | "revoked";

export interface VideoOrchestratorDashboardRouteCompositionInput {
  request_id: string;
  project_id: string;
  operator_approval_id: string;
  route_surface: "dashboard_html" | "account_center_status";
  account_ui_html: string;
  allow_composition_helper_only: true;
  allow_render_tree_patch: false;
  allow_secret_access: false;
  allow_oauth_exchange: false;
  allow_runtime_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface VideoOrchestratorDashboardComposedPanel {
  schema_version: "1.0";
  composition_id: string;
  request_id: string;
  project_id: string;
  created_at: string;
  composition_state: VideoOrchestratorDashboardRouteCompositionState;
  route_surface: "dashboard_html" | "account_center_status";
  html: string;
  account_ui_included: boolean;
  render_tree_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_render_tree_patch_review: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "composeVideoOrchestratorDashboardAccountPanel" | "revokeVideoOrchestratorDashboardComposedPanel" };
}

export interface VideoOrchestratorDashboardRouteCompositionReview {
  schema_version: "1.0";
  composition_review_id: string;
  composition_id: string;
  created_at: string;
  review_state: VideoOrchestratorDashboardRouteCompositionReviewState;
  review_only: true;
  account_ui_included: boolean;
  render_tree_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: boolean; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRouteCompositionReview" | "revokeVideoOrchestratorDashboardRouteCompositionReview"; source_composition_id: string };
}

export interface VideoOrchestratorDashboardRouteCompositionSafeReport {
  schema_version: "1.0";
  composition_safe_report_id: string;
  composition_review_id: string;
  composition_id: string;
  created_at: string;
  safe_report_state: VideoOrchestratorDashboardRouteCompositionSafeReportState;
  safe_report_only: true;
  account_ui_included: boolean;
  render_tree_patched: false;
  secret_accessed: false;
  oauth_exchange_executed: false;
  runtime_write_executed: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_next_phase: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorDashboardRouteCompositionSafeReport" | "revokeVideoOrchestratorDashboardRouteCompositionSafeReport"; source_review_id: string };
}

function safe(value: string | undefined, fallback: string): string {
  const text = (redactVideoOrchestratorText(value ?? "") ?? "").trim();
  return text ? text : fallback;
}

function inputReady(input: VideoOrchestratorDashboardRouteCompositionInput): boolean {
  return input.allow_composition_helper_only === true
    && input.allow_render_tree_patch === false
    && input.allow_secret_access === false
    && input.allow_oauth_exchange === false
    && input.allow_runtime_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.request_id.trim().length > 0
    && input.project_id.trim().length > 0
    && input.operator_approval_id.trim().length > 0
    && input.account_ui_html.includes("Video Orchestrator Accounts")
    && !input.account_ui_html.includes("[CREDENTIAL_REFERENCE]")
    && !input.account_ui_html.includes("[CLIENT_SECRET]")
    && !input.account_ui_html.includes("[TOKEN]")
    && !input.account_ui_html.toLowerCase().includes("keychain://");
}

export function composeVideoOrchestratorDashboardAccountPanel(input: VideoOrchestratorDashboardRouteCompositionInput, options: { id?: string; created_at?: string } = {}): VideoOrchestratorDashboardComposedPanel {
  const ready = inputReady(input);
  const safeHtml = ready ? input.account_ui_html : "";
  return {
    schema_version: "1.0",
    composition_id: safe(options.id, `dashboard-route-composition-${input.request_id}`),
    request_id: safe(input.request_id, "request"),
    project_id: safe(input.project_id, "project"),
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    composition_state: ready ? "ready_for_render_insertion" : "blocked",
    route_surface: input.route_surface,
    html: safeHtml,
    account_ui_included: ready,
    render_tree_patched: false,
    secret_accessed: false,
    oauth_exchange_executed: false,
    runtime_write_executed: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_render_tree_patch_review: ready, blocking_reasons: ready ? [] : ["Dashboard account UI HTML or composition permissions were not safe."], warnings: ["Composition helper only; final render tree patching, secret access, OAuth exchange, runtime writes, staging, commits, and pushes remain disabled."] },
    provenance: { generated_by: "composeVideoOrchestratorDashboardAccountPanel" },
  };
}

function compositionReady(composition: VideoOrchestratorDashboardComposedPanel): boolean {
  return composition.composition_state === "ready_for_render_insertion"
    && composition.validation.complete
    && composition.validation.ready_for_render_tree_patch_review
    && composition.account_ui_included
    && composition.html.includes("Video Orchestrator Accounts")
    && !composition.render_tree_patched
    && !composition.secret_accessed
    && !composition.oauth_exchange_executed
    && !composition.runtime_write_executed
    && !composition.git_add_executed
    && !composition.committed_now
    && !composition.pushed_now;
}

export function createVideoOrchestratorDashboardRouteCompositionReview(composition: VideoOrchestratorDashboardComposedPanel, options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {}): VideoOrchestratorDashboardRouteCompositionReview {
  const ready = compositionReady(composition);
  const readyForNext = ready && options.requestSafeReport !== false;
  return { schema_version: "1.0", composition_review_id: safe(options.id, "dashboard-route-composition-review-001"), composition_id: composition.composition_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_safe_report" : "blocked", review_only: true, account_ui_included: composition.account_ui_included, render_tree_patched: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: readyForNext, blocking_reasons: ready ? [] : ["Dashboard route composition helper was not ready for review."], warnings: ["Review does not approve final render tree patching, secret access, OAuth exchange, runtime writes, staging, commits, or pushes."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRouteCompositionReview", source_composition_id: composition.composition_id } };
}

export function createVideoOrchestratorDashboardRouteCompositionSafeReport(review: VideoOrchestratorDashboardRouteCompositionReview, composition: VideoOrchestratorDashboardComposedPanel, options: { id?: string; created_at?: string; requestRenderTreePatchOrGitStaging?: boolean } = {}): VideoOrchestratorDashboardRouteCompositionSafeReport {
  const ready = review.review_state === "approved_for_safe_report" && review.validation.complete && compositionReady(composition);
  const requiresConfirmation = ready && options.requestRenderTreePatchOrGitStaging !== false;
  return { schema_version: "1.0", composition_safe_report_id: safe(options.id, "dashboard-route-composition-safe-report-001"), composition_review_id: review.composition_review_id, composition_id: composition.composition_id, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: requiresConfirmation ? "requires_operator_confirmation_for_render_tree_patch_or_git_staging" : ready ? "complete" : "blocked", safe_report_only: true, account_ui_included: composition.account_ui_included, render_tree_patched: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: ready, ready_for_next_phase: false, blocking_reasons: ready ? ["Explicit operator confirmation required before final render tree patching or git staging."] : ["Dashboard route composition review was not ready for safe report."], warnings: ["Stop before final dashboard render tree patching, staging, commits, or pushes unless separately approved."] }, provenance: { generated_by: "createVideoOrchestratorDashboardRouteCompositionSafeReport", source_review_id: review.composition_review_id } };
}

export function revokeVideoOrchestratorDashboardComposedPanel(composition: VideoOrchestratorDashboardComposedPanel, reason?: string): VideoOrchestratorDashboardComposedPanel { return { ...composition, composition_state: "revoked", html: "", account_ui_included: false, render_tree_patched: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_render_tree_patch_review: false, blocking_reasons: composition.validation.blocking_reasons, warnings: [...composition.validation.warnings, safe(reason, "Dashboard route composition was revoked.")] }, provenance: { generated_by: "revokeVideoOrchestratorDashboardComposedPanel" } }; }
export function revokeVideoOrchestratorDashboardRouteCompositionReview(review: VideoOrchestratorDashboardRouteCompositionReview, reason?: string): VideoOrchestratorDashboardRouteCompositionReview { return { ...review, review_state: "revoked", account_ui_included: false, render_tree_patched: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Dashboard route composition review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorDashboardRouteCompositionReview" } }; }
export function revokeVideoOrchestratorDashboardRouteCompositionSafeReport(report: VideoOrchestratorDashboardRouteCompositionSafeReport, reason?: string): VideoOrchestratorDashboardRouteCompositionSafeReport { return { ...report, safe_report_state: "revoked", account_ui_included: false, render_tree_patched: false, secret_accessed: false, oauth_exchange_executed: false, runtime_write_executed: false, git_add_executed: false, committed_now: false, pushed_now: false, validation: { complete: false, ready_for_next_phase: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Dashboard route composition safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorDashboardRouteCompositionSafeReport" } }; }
