import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { VideoOrchestratorRuntimeDryRunInvocationDesign, VideoOrchestratorRuntimeDryRunInvocationDesignSafeReport } from "./video-orchestrator-runtime-dry-run-invocation-design.js";

export type VideoOrchestratorRuntimeDryRunInvocationResultState = "disabled_result_created" | "approved_for_future_disabled_runtime_wiring_closeout" | "blocked" | "revoked";
export type VideoOrchestratorRuntimeDryRunInvocationResultReviewState = "ready_for_operator_review" | "approved_for_future_disabled_runtime_wiring_closeout" | "blocked" | "revoked";

export interface VideoOrchestratorRuntimeDryRunInvocationResultCheck {
  check_id: string;
  check_kind: string;
  check_state: "passed" | "blocked";
  safe_summary: string;
  dry_run_invoked_now: false;
  runtime_invoked_now: false;
  upload_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface VideoOrchestratorRuntimeDryRunInvocationResult {
  schema_version: "1.0";
  runtime_dry_run_invocation_result_id: string;
  runtime_dry_run_invocation_design_safe_report_id: string;
  runtime_dry_run_invocation_design_id: string;
  source_request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  created_at: string;
  result_state: VideoOrchestratorRuntimeDryRunInvocationResultState;
  disabled_result_only: true;
  production_imports_added: false;
  automatic_invocation_added: false;
  dry_run_invoked_now: false;
  runtime_invoked_now: false;
  upload_executed_now: false;
  platform_api_called: false;
  network_called: false;
  credentials_accessed: false;
  media_read: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  result_checks: VideoOrchestratorRuntimeDryRunInvocationResultCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorRuntimeDryRunInvocationResult" | "revokeVideoOrchestratorRuntimeDryRunInvocationResult"; source_safe_report_id: string };
}

export interface VideoOrchestratorRuntimeDryRunInvocationResultReview {
  schema_version: "1.0";
  runtime_dry_run_invocation_result_review_id: string;
  runtime_dry_run_invocation_result_id: string;
  source_request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  created_at: string;
  review_state: VideoOrchestratorRuntimeDryRunInvocationResultReviewState;
  review_only: true;
  dry_run_invoked_now: false;
  runtime_invoked_now: false;
  upload_executed_now: false;
  platform_api_called: false;
  network_called: false;
  credentials_accessed: false;
  media_read: false;
  review_checks: VideoOrchestratorRuntimeDryRunInvocationResultCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createVideoOrchestratorRuntimeDryRunInvocationResultReview" | "revokeVideoOrchestratorRuntimeDryRunInvocationResultReview"; source_result_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function safeReportReady(report: VideoOrchestratorRuntimeDryRunInvocationDesignSafeReport): boolean { return report.safe_report_state === "approved_for_future_disabled_dry_run_invocation_result" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.safe_report_only && !report.production_imports_added && !report.automatic_invocation_added && !report.dry_run_invoked_now && !report.runtime_invoked_now && !report.upload_executed_now && !report.platform_api_called && !report.network_called && !report.credentials_accessed && !report.media_read && Object.values(report.execution_boundary).every((value) => value === false); }
function designReady(design: VideoOrchestratorRuntimeDryRunInvocationDesign): boolean { return design.design_state === "approved_for_future_disabled_dry_run_invocation_review" && design.validation.complete && design.validation.ready_for_next_phase && !design.dry_run_invoked_now && !design.runtime_invoked_now && !design.upload_executed_now && Object.values(design.execution_boundary).every((value) => value === false); }
function resultReady(result: VideoOrchestratorRuntimeDryRunInvocationResult): boolean { return result.result_state === "approved_for_future_disabled_runtime_wiring_closeout" && result.validation.complete && result.validation.ready_for_next_phase && !result.dry_run_invoked_now && !result.runtime_invoked_now && !result.upload_executed_now && result.result_checks.every((check) => check.check_state === "passed"); }
function checks(passed: boolean): VideoOrchestratorRuntimeDryRunInvocationResultCheck[] { return ["dry-run", "runtime", "upload", "network", "credentials", "media"].map((kind) => ({ check_id: `disabled-dry-run-invocation-result-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "dry-run" ? "Dry-run invocation remains unexecuted." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "upload" ? "Upload execution remains disabled." : kind === "network" ? "Network remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Media reads remain disabled.", dry_run_invoked_now: false, runtime_invoked_now: false, upload_executed_now: false, ready_for_real_upload_now: false })); }

export function createVideoOrchestratorRuntimeDryRunInvocationResult(designSafeReport: VideoOrchestratorRuntimeDryRunInvocationDesignSafeReport, design: VideoOrchestratorRuntimeDryRunInvocationDesign, options: { id?: string; created_at?: string; requestFutureRuntimeWiringCloseout?: boolean } = {}): VideoOrchestratorRuntimeDryRunInvocationResult {
  const ready = safeReportReady(designSafeReport) && designReady(design);
  const readyForNext = ready && options.requestFutureRuntimeWiringCloseout !== false;
  return { schema_version: "1.0", runtime_dry_run_invocation_result_id: safe(options.id, "runtime-dry-run-invocation-result-001"), runtime_dry_run_invocation_design_safe_report_id: designSafeReport.runtime_dry_run_invocation_design_safe_report_id, runtime_dry_run_invocation_design_id: design.runtime_dry_run_invocation_design_id, source_request_id: designSafeReport.source_request_id, project_id: designSafeReport.project_id, render_plan_id: designSafeReport.render_plan_id, platform: designSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), result_state: readyForNext ? "approved_for_future_disabled_runtime_wiring_closeout" : ready ? "disabled_result_created" : "blocked", disabled_result_only: true, production_imports_added: false, automatic_invocation_added: false, dry_run_invoked_now: false, runtime_invoked_now: false, upload_executed_now: false, platform_api_called: false, network_called: false, credentials_accessed: false, media_read: false, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, result_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Disabled dry-run invocation design safe report was not ready for disabled result."], warnings: [] }, provenance: { generated_by: "createVideoOrchestratorRuntimeDryRunInvocationResult", source_safe_report_id: designSafeReport.runtime_dry_run_invocation_design_safe_report_id } };
}
export function createVideoOrchestratorRuntimeDryRunInvocationResultReview(result: VideoOrchestratorRuntimeDryRunInvocationResult, options: { id?: string; created_at?: string; requestFutureRuntimeWiringCloseout?: boolean } = {}): VideoOrchestratorRuntimeDryRunInvocationResultReview {
  const ready = resultReady(result);
  const readyForNext = ready && options.requestFutureRuntimeWiringCloseout !== false;
  return { schema_version: "1.0", runtime_dry_run_invocation_result_review_id: safe(options.id, "runtime-dry-run-invocation-result-review-001"), runtime_dry_run_invocation_result_id: result.runtime_dry_run_invocation_result_id, source_request_id: result.source_request_id, project_id: result.project_id, render_plan_id: result.render_plan_id, platform: result.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), review_state: readyForNext ? "approved_for_future_disabled_runtime_wiring_closeout" : ready ? "ready_for_operator_review" : "blocked", review_only: true, dry_run_invoked_now: false, runtime_invoked_now: false, upload_executed_now: false, platform_api_called: false, network_called: false, credentials_accessed: false, media_read: false, review_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: ready, ready_for_next_phase: readyForNext, ready_for_real_upload: false, blocking_reasons: ready ? [] : ["Disabled dry-run invocation result was not ready for review."], warnings: [] }, provenance: { generated_by: "createVideoOrchestratorRuntimeDryRunInvocationResultReview", source_result_id: result.runtime_dry_run_invocation_result_id } };
}
export function revokeVideoOrchestratorRuntimeDryRunInvocationResult(result: VideoOrchestratorRuntimeDryRunInvocationResult, reason?: string): VideoOrchestratorRuntimeDryRunInvocationResult { return { ...result, result_state: "revoked", execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: result.validation.blocking_reasons, warnings: [...result.validation.warnings, safe(reason, "Disabled dry-run invocation result was revoked.")] }, provenance: { ...result.provenance, generated_by: "revokeVideoOrchestratorRuntimeDryRunInvocationResult" } }; }
export function revokeVideoOrchestratorRuntimeDryRunInvocationResultReview(review: VideoOrchestratorRuntimeDryRunInvocationResultReview, reason?: string): VideoOrchestratorRuntimeDryRunInvocationResultReview { return { ...review, review_state: "revoked", review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), execution_boundary: { ...DISABLED_BOUNDARY }, validation: { complete: false, ready_for_next_phase: false, ready_for_real_upload: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Disabled dry-run invocation result review was revoked.")] }, provenance: { ...review.provenance, generated_by: "revokeVideoOrchestratorRuntimeDryRunInvocationResultReview" } }; }
