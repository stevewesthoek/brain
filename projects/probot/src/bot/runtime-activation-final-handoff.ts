import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationCompletionReport, RuntimeActivationCompletionReportSafeReport } from "./runtime-activation-completion-report.js";

export type RuntimeActivationFinalHandoffState = "draft" | "created" | "approved_for_future_final_handoff_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalHandoffReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_final_handoff_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalHandoffSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_terminal_summary" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationFinalHandoffCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationFinalHandoffTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; final_handoff_executed_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationFinalHandoffReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationFinalHandoffCheckState; safe_summary: string; runtime_enabled_now: false; final_handoff_executed_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationFinalHandoffSafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; final_handoff_executed_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationFinalHandoff {
  schema_version: "1.0";
  runtime_activation_final_handoff_id: string;
  runtime_activation_completion_report_safe_report_id: string;
  runtime_activation_completion_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_handoff_state: RuntimeActivationFinalHandoffState;
  required_artifacts: { runtime_activation_completion_report_safe_report_validated: true; runtime_activation_completion_report_validated: true };
  final_handoff_scope: ControlledRuntimeActivationScope;
  final_handoff_controls: { final_handoff_only: true; final_handoff_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; final_handoff_executed_now: false; real_upload_still_blocked: true };
  final_handoff_terms: RuntimeActivationFinalHandoffTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalHandoff" | "revokeRuntimeActivationFinalHandoff"; source_runtime_activation_completion_report_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationFinalHandoffReview {
  schema_version: "1.0";
  runtime_activation_final_handoff_review_id: string;
  runtime_activation_final_handoff_id: string;
  runtime_activation_completion_report_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_handoff_review_state: RuntimeActivationFinalHandoffReviewState;
  required_artifacts: { runtime_activation_final_handoff_validated: true; runtime_activation_completion_report_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; final_handoff_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; final_handoff_executed_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationFinalHandoffReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalHandoffReview" | "revokeRuntimeActivationFinalHandoffReview"; source_runtime_activation_final_handoff_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationFinalHandoffSafeReport {
  schema_version: "1.0";
  runtime_activation_final_handoff_safe_report_id: string;
  runtime_activation_final_handoff_review_id: string;
  runtime_activation_final_handoff_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationFinalHandoffSafeReportState;
  required_artifacts: { runtime_activation_final_handoff_review_validated: true; runtime_activation_final_handoff_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; final_handoff_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; final_handoff_executed_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationFinalHandoffSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationFinalHandoffSafeReport" | "revokeRuntimeActivationFinalHandoffSafeReport"; source_runtime_activation_final_handoff_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation final handoff prerequisite was not validated.")))]; }

function completionSafeReportReady(report: RuntimeActivationCompletionReportSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_final_handoff" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.completion_report_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.completion_finalized_now && report.report_controls.real_upload_still_blocked;
}
function completionReady(report: RuntimeActivationCompletionReport): boolean {
  return report.completion_report_state === "approved_for_future_completion_report_review" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.completion_report_controls.completion_report_only && report.completion_report_controls.completion_record_only && !report.completion_report_controls.completion_finalized_now && report.completion_report_controls.real_upload_still_blocked;
}
function handoffReady(handoff: RuntimeActivationFinalHandoff): boolean { return handoff.final_handoff_state === "approved_for_future_final_handoff_review" && handoff.validation.complete && handoff.validation.ready_for_next_phase && handoff.final_handoff_controls.final_handoff_only && handoff.final_handoff_controls.final_handoff_record_only && !handoff.final_handoff_controls.final_handoff_executed_now && handoff.final_handoff_terms.length >= 4; }
function reviewReady(review: RuntimeActivationFinalHandoffReview): boolean { return review.final_handoff_review_state === "approved_for_future_final_handoff_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.final_handoff_executed_now && !check.ready_for_real_upload_now); }

function terms(): RuntimeActivationFinalHandoffTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `final-handoff-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Final handoff record scope only; no runtime enabled.", runtime_enabled_now: false, final_handoff_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function checks(passed: boolean): RuntimeActivationFinalHandoffReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `final-handoff-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Final handoff scope reviewed only.", runtime_enabled_now: false, final_handoff_executed_now: false, ready_for_real_upload_now: false })); }
function sections(): RuntimeActivationFinalHandoffSafeReportSection[] { return ["handoff", "review", "runtime", "status"].map((kind) => ({ section_id: `final-handoff-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation final handoff review summarized only." : "Runtime activation final handoff summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, final_handoff_executed_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationFinalHandoff(completionSafeReport: RuntimeActivationCompletionReportSafeReport, completionReport: RuntimeActivationCompletionReport, options: { id?: string; created_at?: string; requestFutureFinalHandoffReview?: boolean } = {}): RuntimeActivationFinalHandoff {
  const ready = completionSafeReportReady(completionSafeReport) && completionReady(completionReport);
  const readyForNext = ready && options.requestFutureFinalHandoffReview !== false;
  const reasons = blocking(ready, "Runtime activation completion safe report or completion report was not ready for final handoff.", [...completionSafeReport.validation.blocking_reasons, ...completionReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_final_handoff_id: safe(options.id, "runtime-activation-final-handoff-001"), runtime_activation_completion_report_safe_report_id: completionSafeReport.runtime_activation_completion_report_safe_report_id, runtime_activation_completion_report_id: completionReport.runtime_activation_completion_report_id, render_plan_id: completionSafeReport.render_plan_id, project_id: completionSafeReport.project_id, platform: completionSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), final_handoff_state: readyForNext ? "approved_for_future_final_handoff_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_completion_report_safe_report_validated: true, runtime_activation_completion_report_validated: true }, final_handoff_scope: scope(readyForNext), final_handoff_controls: { final_handoff_only: true, final_handoff_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_handoff_executed_now: false, real_upload_still_blocked: true }, final_handoff_terms: terms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationFinalHandoff", source_runtime_activation_completion_report_safe_report_id: completionSafeReport.runtime_activation_completion_report_safe_report_id, source_render_plan_id: completionSafeReport.render_plan_id } };
}
export function createRuntimeActivationFinalHandoffReview(handoff: RuntimeActivationFinalHandoff, completionSafeReport: RuntimeActivationCompletionReportSafeReport, options: { id?: string; created_at?: string; requestFutureFinalHandoffSafeReport?: boolean } = {}): RuntimeActivationFinalHandoffReview {
  const ready = handoffReady(handoff) && completionSafeReportReady(completionSafeReport);
  const readyForNext = ready && options.requestFutureFinalHandoffSafeReport !== false;
  const reasons = blocking(ready, "Runtime activation final handoff or completion safe report was not ready for final handoff review.", [...handoff.validation.blocking_reasons, ...completionSafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_final_handoff_review_id: safe(options.id, "runtime-activation-final-handoff-review-001"), runtime_activation_final_handoff_id: handoff.runtime_activation_final_handoff_id, runtime_activation_completion_report_safe_report_id: handoff.runtime_activation_completion_report_safe_report_id, render_plan_id: handoff.render_plan_id, project_id: handoff.project_id, platform: handoff.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), final_handoff_review_state: readyForNext ? "approved_for_future_final_handoff_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_final_handoff_validated: true, runtime_activation_completion_report_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, final_handoff_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_handoff_executed_now: false, real_upload_still_blocked: true }, review_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationFinalHandoffReview", source_runtime_activation_final_handoff_id: handoff.runtime_activation_final_handoff_id, source_render_plan_id: handoff.render_plan_id } };
}
export function createRuntimeActivationFinalHandoffSafeReport(review: RuntimeActivationFinalHandoffReview, handoff: RuntimeActivationFinalHandoff, options: { id?: string; created_at?: string; requestFutureRuntimeActivationTerminalSummary?: boolean } = {}): RuntimeActivationFinalHandoffSafeReport {
  const ready = reviewReady(review) && handoffReady(handoff);
  const readyForNext = ready && options.requestFutureRuntimeActivationTerminalSummary !== false;
  const reasons = blocking(ready, "Runtime activation final handoff review or final handoff was not ready for final handoff safe report.", [...review.validation.blocking_reasons, ...handoff.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_final_handoff_safe_report_id: safe(options.id, "runtime-activation-final-handoff-safe-report-001"), runtime_activation_final_handoff_review_id: review.runtime_activation_final_handoff_review_id, runtime_activation_final_handoff_id: handoff.runtime_activation_final_handoff_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_future_runtime_activation_terminal_summary" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_final_handoff_review_validated: true, runtime_activation_final_handoff_validated: true }, report_scope: scope(readyForNext), report_controls: { safe_report_only: true, final_handoff_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, final_handoff_executed_now: false, real_upload_still_blocked: true }, safe_report_sections: sections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationFinalHandoffSafeReport", source_runtime_activation_final_handoff_review_id: review.runtime_activation_final_handoff_review_id, source_render_plan_id: review.render_plan_id } };
}
export function revokeRuntimeActivationFinalHandoff(handoff: RuntimeActivationFinalHandoff, reason?: string): RuntimeActivationFinalHandoff { const warning = sanitizeSafeSummary(reason, "Runtime activation final handoff was revoked."); return { ...handoff, final_handoff_state: "revoked", final_handoff_scope: scope(false), validation: validation(false, false, handoff.validation.blocking_reasons, [...handoff.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...handoff.provenance, generated_by: "revokeRuntimeActivationFinalHandoff" } }; }
export function revokeRuntimeActivationFinalHandoffReview(review: RuntimeActivationFinalHandoffReview, reason?: string): RuntimeActivationFinalHandoffReview { const warning = sanitizeSafeSummary(reason, "Runtime activation final handoff review was revoked."); return { ...review, final_handoff_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationFinalHandoffReview" } }; }
export function revokeRuntimeActivationFinalHandoffSafeReport(report: RuntimeActivationFinalHandoffSafeReport, reason?: string): RuntimeActivationFinalHandoffSafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation final handoff safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationFinalHandoffSafeReport" } }; }
