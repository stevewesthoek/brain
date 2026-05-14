import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationSequenceSummary, RuntimeActivationSequenceSummarySafeReport } from "./runtime-activation-sequence-summary.js";

export type RuntimeActivationCompletionReportState = "draft" | "created" | "approved_for_future_completion_report_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCompletionReportReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_completion_report_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCompletionReportSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_final_handoff" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationCompletionReportCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationCompletionReportTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; completion_finalized_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationCompletionReportReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationCompletionReportCheckState; safe_summary: string; runtime_enabled_now: false; completion_finalized_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationCompletionReportSafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; completion_finalized_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationCompletionReport {
  schema_version: "1.0";
  runtime_activation_completion_report_id: string;
  runtime_activation_sequence_summary_safe_report_id: string;
  runtime_activation_sequence_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  completion_report_state: RuntimeActivationCompletionReportState;
  required_artifacts: { runtime_activation_sequence_summary_safe_report_validated: true; runtime_activation_sequence_summary_validated: true };
  completion_report_scope: ControlledRuntimeActivationScope;
  completion_report_controls: { completion_report_only: true; completion_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; completion_finalized_now: false; real_upload_still_blocked: true };
  completion_report_terms: RuntimeActivationCompletionReportTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCompletionReport" | "revokeRuntimeActivationCompletionReport"; source_runtime_activation_sequence_summary_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationCompletionReportReview {
  schema_version: "1.0";
  runtime_activation_completion_report_review_id: string;
  runtime_activation_completion_report_id: string;
  runtime_activation_sequence_summary_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  completion_report_review_state: RuntimeActivationCompletionReportReviewState;
  required_artifacts: { runtime_activation_completion_report_validated: true; runtime_activation_sequence_summary_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; completion_report_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; completion_finalized_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationCompletionReportReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCompletionReportReview" | "revokeRuntimeActivationCompletionReportReview"; source_runtime_activation_completion_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationCompletionReportSafeReport {
  schema_version: "1.0";
  runtime_activation_completion_report_safe_report_id: string;
  runtime_activation_completion_report_review_id: string;
  runtime_activation_completion_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationCompletionReportSafeReportState;
  required_artifacts: { runtime_activation_completion_report_review_validated: true; runtime_activation_completion_report_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; completion_report_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; completion_finalized_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationCompletionReportSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationCompletionReportSafeReport" | "revokeRuntimeActivationCompletionReportSafeReport"; source_runtime_activation_completion_report_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation completion report prerequisite was not validated.")))]; }

function sequenceSummarySafeReportReady(report: RuntimeActivationSequenceSummarySafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_completion_report" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.sequence_summary_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.summary_finalized_now && report.report_controls.real_upload_still_blocked;
}
function sequenceSummaryReady(summary: RuntimeActivationSequenceSummary): boolean {
  return summary.sequence_summary_state === "approved_for_future_sequence_summary_review" && summary.validation.complete && summary.validation.ready_for_next_phase && !summary.validation.ready_for_real_upload && summary.sequence_summary_controls.sequence_summary_only && summary.sequence_summary_controls.summary_record_only && !summary.sequence_summary_controls.summary_finalized_now && summary.sequence_summary_controls.real_upload_still_blocked;
}
function completionReady(report: RuntimeActivationCompletionReport): boolean { return report.completion_report_state === "approved_for_future_completion_report_review" && report.validation.complete && report.validation.ready_for_next_phase && report.completion_report_controls.completion_report_only && report.completion_report_controls.completion_record_only && !report.completion_report_controls.completion_finalized_now && report.completion_report_terms.length >= 4; }
function reviewReady(review: RuntimeActivationCompletionReportReview): boolean { return review.completion_report_review_state === "approved_for_future_completion_report_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.completion_finalized_now && !check.ready_for_real_upload_now); }

function terms(): RuntimeActivationCompletionReportTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `completion-report-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Completion report record scope only; no runtime enabled.", runtime_enabled_now: false, completion_finalized_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function checks(passed: boolean): RuntimeActivationCompletionReportReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `completion-report-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Completion report scope reviewed only.", runtime_enabled_now: false, completion_finalized_now: false, ready_for_real_upload_now: false })); }
function sections(): RuntimeActivationCompletionReportSafeReportSection[] { return ["completion", "review", "runtime", "status"].map((kind) => ({ section_id: `completion-report-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation completion report review summarized only." : "Runtime activation completion report summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, completion_finalized_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationCompletionReport(sequenceSummarySafeReport: RuntimeActivationSequenceSummarySafeReport, sequenceSummary: RuntimeActivationSequenceSummary, options: { id?: string; created_at?: string; requestFutureCompletionReportReview?: boolean } = {}): RuntimeActivationCompletionReport {
  const ready = sequenceSummarySafeReportReady(sequenceSummarySafeReport) && sequenceSummaryReady(sequenceSummary);
  const readyForNext = ready && options.requestFutureCompletionReportReview !== false;
  const reasons = blocking(ready, "Runtime activation sequence-summary safe report or summary was not ready for completion report.", [...sequenceSummarySafeReport.validation.blocking_reasons, ...sequenceSummary.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_completion_report_id: safe(options.id, "runtime-activation-completion-report-001"), runtime_activation_sequence_summary_safe_report_id: sequenceSummarySafeReport.runtime_activation_sequence_summary_safe_report_id, runtime_activation_sequence_summary_id: sequenceSummary.runtime_activation_sequence_summary_id, render_plan_id: sequenceSummarySafeReport.render_plan_id, project_id: sequenceSummarySafeReport.project_id, platform: sequenceSummarySafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), completion_report_state: readyForNext ? "approved_for_future_completion_report_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_sequence_summary_safe_report_validated: true, runtime_activation_sequence_summary_validated: true }, completion_report_scope: scope(readyForNext), completion_report_controls: { completion_report_only: true, completion_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, completion_finalized_now: false, real_upload_still_blocked: true }, completion_report_terms: terms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationCompletionReport", source_runtime_activation_sequence_summary_safe_report_id: sequenceSummarySafeReport.runtime_activation_sequence_summary_safe_report_id, source_render_plan_id: sequenceSummarySafeReport.render_plan_id } };
}
export function createRuntimeActivationCompletionReportReview(completionReport: RuntimeActivationCompletionReport, sequenceSummarySafeReport: RuntimeActivationSequenceSummarySafeReport, options: { id?: string; created_at?: string; requestFutureCompletionReportSafeReport?: boolean } = {}): RuntimeActivationCompletionReportReview {
  const ready = completionReady(completionReport) && sequenceSummarySafeReportReady(sequenceSummarySafeReport);
  const readyForNext = ready && options.requestFutureCompletionReportSafeReport !== false;
  const reasons = blocking(ready, "Runtime activation completion report or sequence-summary safe report was not ready for completion report review.", [...completionReport.validation.blocking_reasons, ...sequenceSummarySafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_completion_report_review_id: safe(options.id, "runtime-activation-completion-report-review-001"), runtime_activation_completion_report_id: completionReport.runtime_activation_completion_report_id, runtime_activation_sequence_summary_safe_report_id: completionReport.runtime_activation_sequence_summary_safe_report_id, render_plan_id: completionReport.render_plan_id, project_id: completionReport.project_id, platform: completionReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), completion_report_review_state: readyForNext ? "approved_for_future_completion_report_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_completion_report_validated: true, runtime_activation_sequence_summary_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, completion_report_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, completion_finalized_now: false, real_upload_still_blocked: true }, review_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationCompletionReportReview", source_runtime_activation_completion_report_id: completionReport.runtime_activation_completion_report_id, source_render_plan_id: completionReport.render_plan_id } };
}
export function createRuntimeActivationCompletionReportSafeReport(review: RuntimeActivationCompletionReportReview, completionReport: RuntimeActivationCompletionReport, options: { id?: string; created_at?: string; requestFutureRuntimeActivationFinalHandoff?: boolean } = {}): RuntimeActivationCompletionReportSafeReport {
  const ready = reviewReady(review) && completionReady(completionReport);
  const readyForNext = ready && options.requestFutureRuntimeActivationFinalHandoff !== false;
  const reasons = blocking(ready, "Runtime activation completion report review or completion report was not ready for completion safe report.", [...review.validation.blocking_reasons, ...completionReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_completion_report_safe_report_id: safe(options.id, "runtime-activation-completion-report-safe-report-001"), runtime_activation_completion_report_review_id: review.runtime_activation_completion_report_review_id, runtime_activation_completion_report_id: completionReport.runtime_activation_completion_report_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_future_runtime_activation_final_handoff" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_completion_report_review_validated: true, runtime_activation_completion_report_validated: true }, report_scope: scope(readyForNext), report_controls: { safe_report_only: true, completion_report_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, completion_finalized_now: false, real_upload_still_blocked: true }, safe_report_sections: sections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationCompletionReportSafeReport", source_runtime_activation_completion_report_review_id: review.runtime_activation_completion_report_review_id, source_render_plan_id: review.render_plan_id } };
}
export function revokeRuntimeActivationCompletionReport(report: RuntimeActivationCompletionReport, reason?: string): RuntimeActivationCompletionReport { const warning = sanitizeSafeSummary(reason, "Runtime activation completion report was revoked."); return { ...report, completion_report_state: "revoked", completion_report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationCompletionReport" } }; }
export function revokeRuntimeActivationCompletionReportReview(review: RuntimeActivationCompletionReportReview, reason?: string): RuntimeActivationCompletionReportReview { const warning = sanitizeSafeSummary(reason, "Runtime activation completion report review was revoked."); return { ...review, completion_report_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationCompletionReportReview" } }; }
export function revokeRuntimeActivationCompletionReportSafeReport(report: RuntimeActivationCompletionReportSafeReport, reason?: string): RuntimeActivationCompletionReportSafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation completion report safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationCompletionReportSafeReport" } }; }
