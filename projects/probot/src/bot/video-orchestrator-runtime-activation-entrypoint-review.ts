import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { VideoOrchestratorRuntimeActivationResult } from "./video-orchestrator-runtime-activation-entrypoint.js";

export type VideoOrchestratorRuntimeActivationEntrypointReviewState = "ready_for_operator_review" | "approved_for_safe_report" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeActivationEntrypointSafeReportState = "complete" | "approved_for_future_disabled_dry_run_invocation_design" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeActivationEntrypointCheckState = "passed" | "blocked";

export interface VideoOrchestratorRuntimeActivationEntrypointReviewCheck {
  check_id: string;
  check_kind: string;
  check_state: VideoOrchestratorRuntimeActivationEntrypointCheckState;
  safe_summary: string;
  runtime_invoked: false;
  upload_executed: false;
  ready_for_real_upload_now: false;
}

export interface VideoOrchestratorRuntimeActivationEntrypointReview {
  schema_version: "1.0";
  runtime_activation_entrypoint_review_id: string;
  source_request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  created_at: string;
  review_state: VideoOrchestratorRuntimeActivationEntrypointReviewState;
  review_only: true;
  production_imports_added: false;
  automatic_invocation_added: false;
  runtime_invoked: false;
  upload_executed: false;
  platform_api_called: false;
  network_called: false;
  credentials_accessed: false;
  media_read: false;
  review_checks: VideoOrchestratorRuntimeActivationEntrypointReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorRuntimeActivationEntrypointReview" | "revokeVideoOrchestratorRuntimeActivationEntrypointReview"; source_request_id: string };
}

export interface VideoOrchestratorRuntimeActivationEntrypointSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  runtime_invoked: false;
  upload_executed: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  ready_for_real_upload_now: false;
}

export interface VideoOrchestratorRuntimeActivationEntrypointSafeReport {
  schema_version: "1.0";
  runtime_activation_entrypoint_safe_report_id: string;
  runtime_activation_entrypoint_review_id: string;
  source_request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  created_at: string;
  safe_report_state: VideoOrchestratorRuntimeActivationEntrypointSafeReportState;
  safe_report_only: true;
  production_imports_added: false;
  automatic_invocation_added: false;
  runtime_invoked: false;
  upload_executed: false;
  platform_api_called: false;
  network_called: false;
  credentials_accessed: false;
  media_read: false;
  safe_report_sections: VideoOrchestratorRuntimeActivationEntrypointSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorRuntimeActivationEntrypointSafeReport" | "revokeVideoOrchestratorRuntimeActivationEntrypointSafeReport"; source_review_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  runtime_enabled: false,
  runtime_executed: false,
  upload_allowed: false,
  upload_execution_enabled: false,
  platform_api_calls_allowed: false,
  network_calls_allowed: false,
  credentials_accessed: false,
  token_accessed: false,
  keychain_accessed: false,
  env_accessed: false,
  media_file_read: false,
  file_mutation_allowed: false,
  dependencies_added: false,
  package_metadata_changed: false,
};

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function resultReady(result: VideoOrchestratorRuntimeActivationResult): boolean {
  return result.entrypoint_state === "disabled"
    && result.validation.complete
    && !result.validation.ready_for_next_phase
    && !result.validation.ready_for_real_upload
    && result.runtime_entrypoint_defined
    && !result.runtime_invoked
    && !result.upload_executed
    && !result.platform_api_called
    && !result.network_called
    && !result.credentials_accessed
    && !result.token_accessed
    && !result.keychain_accessed
    && !result.env_accessed
    && !result.media_read
    && !result.contains_runtime_callable
    && !result.contains_raw_payload
    && !result.contains_raw_response
    && !result.contains_secret_material
    && Object.values(result.execution_boundary).every((value) => value === false);
}

function reviewReady(review: VideoOrchestratorRuntimeActivationEntrypointReview): boolean {
  return review.review_state === "approved_for_safe_report"
    && review.validation.complete
    && review.validation.ready_for_next_phase
    && !review.validation.ready_for_real_upload
    && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_invoked && !check.upload_executed && !check.ready_for_real_upload_now);
}

function reviewChecks(passed: boolean): VideoOrchestratorRuntimeActivationEntrypointReviewCheck[] {
  return ["entrypoint", "runtime", "upload", "credentials", "media", "production-imports"].map((kind) => ({
    check_id: `runtime-entrypoint-review-${kind}`,
    check_kind: kind,
    check_state: passed ? "passed" : "blocked",
    safe_summary: kind === "runtime" ? "Runtime invocation remains disabled." : kind === "upload" ? "Upload execution remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : kind === "media" ? "Media reads remain disabled." : kind === "production-imports" ? "No production imports are added." : "Disabled runtime entrypoint reviewed only.",
    runtime_invoked: false,
    upload_executed: false,
    ready_for_real_upload_now: false,
  }));
}

function safeReportSections(): VideoOrchestratorRuntimeActivationEntrypointSafeReportSection[] {
  return ["entrypoint", "review", "runtime", "upload", "credentials", "media"].map((kind) => ({
    section_id: `runtime-entrypoint-safe-report-${kind}`,
    section_kind: kind,
    safe_summary: kind === "runtime" ? "Runtime invocation remains disabled." : kind === "upload" ? "Upload execution remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : kind === "media" ? "Media reads remain disabled." : kind === "review" ? "Disabled runtime entrypoint review summarized only." : "Disabled runtime entrypoint summarized only.",
    runtime_invoked: false,
    upload_executed: false,
    contains_runtime_callable: false,
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
    ready_for_real_upload_now: false,
  }));
}

export function createVideoOrchestratorRuntimeActivationEntrypointReview(
  result: VideoOrchestratorRuntimeActivationResult,
  options: { id?: string; created_at?: string; requestSafeReport?: boolean } = {},
): VideoOrchestratorRuntimeActivationEntrypointReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestSafeReport !== false;
  return {
    schema_version: "1.0",
    runtime_activation_entrypoint_review_id: safe(options.id, "runtime-activation-entrypoint-review-001"),
    source_request_id: result.request_id,
    project_id: result.project_id,
    render_plan_id: result.render_plan_id,
    platform: result.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_state: readyForNext ? "approved_for_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    review_only: true,
    production_imports_added: false,
    automatic_invocation_added: false,
    runtime_invoked: false,
    upload_executed: false,
    platform_api_called: false,
    network_called: false,
    credentials_accessed: false,
    media_read: false,
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Disabled runtime activation entrypoint result was not ready for review."], warnings: [] },
    provenance: { generated_by: "createVideoOrchestratorRuntimeActivationEntrypointReview", source_request_id: result.request_id },
  };
}

export function createVideoOrchestratorRuntimeActivationEntrypointSafeReport(
  review: VideoOrchestratorRuntimeActivationEntrypointReview,
  options: { id?: string; created_at?: string; requestFutureDisabledDryRunInvocationDesign?: boolean } = {},
): VideoOrchestratorRuntimeActivationEntrypointSafeReport {
  const ready = reviewReady(review);
  const readyForNext = ready && options.requestFutureDisabledDryRunInvocationDesign !== false;
  return {
    schema_version: "1.0",
    runtime_activation_entrypoint_safe_report_id: safe(options.id, "runtime-activation-entrypoint-safe-report-001"),
    runtime_activation_entrypoint_review_id: review.runtime_activation_entrypoint_review_id,
    source_request_id: review.source_request_id,
    project_id: review.project_id,
    render_plan_id: review.render_plan_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_disabled_dry_run_invocation_design" : ready ? "complete" : "blocked",
    safe_report_only: true,
    production_imports_added: false,
    automatic_invocation_added: false,
    runtime_invoked: false,
    upload_executed: false,
    platform_api_called: false,
    network_called: false,
    credentials_accessed: false,
    media_read: false,
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Disabled runtime activation entrypoint review was not ready for safe report."], warnings: [] },
    provenance: { generated_by: "createVideoOrchestratorRuntimeActivationEntrypointSafeReport", source_review_id: review.runtime_activation_entrypoint_review_id },
  };
}

export function revokeVideoOrchestratorRuntimeActivationEntrypointReview(
  review: VideoOrchestratorRuntimeActivationEntrypointReview,
  reason?: string,
): VideoOrchestratorRuntimeActivationEntrypointReview {
  return { ...review, review_state: "revoked", review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Disabled runtime entrypoint review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorRuntimeActivationEntrypointReview" } };
}

export function revokeVideoOrchestratorRuntimeActivationEntrypointSafeReport(
  report: VideoOrchestratorRuntimeActivationEntrypointSafeReport,
  reason?: string,
): VideoOrchestratorRuntimeActivationEntrypointSafeReport {
  return { ...report, safe_report_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: report.validation.blocking_reasons, warnings: [...report.validation.warnings, safe(reason, "Disabled runtime entrypoint safe report was revoked.")] }, provenance: { ...report.provenance, generated_by: "revokeVideoOrchestratorRuntimeActivationEntrypointSafeReport" } };
}
