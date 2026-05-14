import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationHandoff, RuntimeActivationHandoffSafeReport } from "./runtime-activation-handoff.js";

export type RuntimeActivationSequenceSummaryState = "draft" | "created" | "approved_for_future_sequence_summary_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSequenceSummaryReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_sequence_summary_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSequenceSummarySafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_completion_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationSequenceSummaryCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationSequenceSummaryTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; summary_finalized_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationSequenceSummaryReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationSequenceSummaryCheckState; safe_summary: string; runtime_enabled_now: false; summary_finalized_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationSequenceSummarySafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; summary_finalized_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationSequenceSummary {
  schema_version: "1.0";
  runtime_activation_sequence_summary_id: string;
  runtime_activation_handoff_safe_report_id: string;
  runtime_activation_handoff_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  sequence_summary_state: RuntimeActivationSequenceSummaryState;
  required_artifacts: { runtime_activation_handoff_safe_report_validated: true; runtime_activation_handoff_validated: true };
  sequence_summary_scope: ControlledRuntimeActivationScope;
  sequence_summary_controls: { sequence_summary_only: true; summary_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; summary_finalized_now: false; real_upload_still_blocked: true };
  sequence_summary_terms: RuntimeActivationSequenceSummaryTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSequenceSummary" | "revokeRuntimeActivationSequenceSummary"; source_runtime_activation_handoff_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationSequenceSummaryReview {
  schema_version: "1.0";
  runtime_activation_sequence_summary_review_id: string;
  runtime_activation_sequence_summary_id: string;
  runtime_activation_handoff_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  sequence_summary_review_state: RuntimeActivationSequenceSummaryReviewState;
  required_artifacts: { runtime_activation_sequence_summary_validated: true; runtime_activation_handoff_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; sequence_summary_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; summary_finalized_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationSequenceSummaryReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSequenceSummaryReview" | "revokeRuntimeActivationSequenceSummaryReview"; source_runtime_activation_sequence_summary_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationSequenceSummarySafeReport {
  schema_version: "1.0";
  runtime_activation_sequence_summary_safe_report_id: string;
  runtime_activation_sequence_summary_review_id: string;
  runtime_activation_sequence_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationSequenceSummarySafeReportState;
  required_artifacts: { runtime_activation_sequence_summary_review_validated: true; runtime_activation_sequence_summary_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; sequence_summary_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; summary_finalized_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationSequenceSummarySafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationSequenceSummarySafeReport" | "revokeRuntimeActivationSequenceSummarySafeReport"; source_runtime_activation_sequence_summary_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation sequence summary prerequisite was not validated.")))]; }

function handoffSafeReportReady(report: RuntimeActivationHandoffSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_sequence_summary" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.handoff_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.handoff_executed_now && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.handoff_executed_now && !section.ready_for_real_upload_now);
}
function handoffReady(handoff: RuntimeActivationHandoff): boolean {
  return handoff.handoff_state === "approved_for_future_handoff_review" && handoff.validation.complete && handoff.validation.ready_for_next_phase && !handoff.validation.ready_for_real_upload && handoff.handoff_controls.handoff_only && handoff.handoff_controls.handoff_record_only && !handoff.handoff_controls.contains_runtime_callable && !handoff.handoff_controls.contains_raw_payload && !handoff.handoff_controls.contains_raw_response && !handoff.handoff_controls.contains_secret_material && !handoff.handoff_controls.runtime_wiring_implemented && handoff.handoff_controls.runtime_invocation_disabled && !handoff.handoff_controls.handoff_executed_now && handoff.handoff_controls.real_upload_still_blocked && handoff.handoff_terms.every((term) => !term.runtime_enabled_now && !term.handoff_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function summaryReady(summary: RuntimeActivationSequenceSummary): boolean { return summary.sequence_summary_state === "approved_for_future_sequence_summary_review" && summary.validation.complete && summary.validation.ready_for_next_phase && summary.sequence_summary_controls.sequence_summary_only && summary.sequence_summary_controls.summary_record_only && !summary.sequence_summary_controls.summary_finalized_now && summary.sequence_summary_terms.length >= 4; }
function reviewReady(review: RuntimeActivationSequenceSummaryReview): boolean { return review.sequence_summary_review_state === "approved_for_future_sequence_summary_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.summary_finalized_now && !check.ready_for_real_upload_now); }

function terms(): RuntimeActivationSequenceSummaryTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `sequence-summary-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Sequence summary record scope only; no runtime enabled.", runtime_enabled_now: false, summary_finalized_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function checks(passed: boolean): RuntimeActivationSequenceSummaryReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `sequence-summary-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Sequence summary scope reviewed only.", runtime_enabled_now: false, summary_finalized_now: false, ready_for_real_upload_now: false })); }
function sections(): RuntimeActivationSequenceSummarySafeReportSection[] { return ["summary", "review", "runtime", "status"].map((kind) => ({ section_id: `sequence-summary-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation sequence summary review summarized only." : "Runtime activation sequence summary summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, summary_finalized_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationSequenceSummary(handoffSafeReport: RuntimeActivationHandoffSafeReport, handoff: RuntimeActivationHandoff, options: { id?: string; created_at?: string; requestFutureSequenceSummaryReview?: boolean } = {}): RuntimeActivationSequenceSummary {
  const ready = handoffSafeReportReady(handoffSafeReport) && handoffReady(handoff);
  const readyForNext = ready && options.requestFutureSequenceSummaryReview !== false;
  const reasons = blocking(ready, "Runtime activation handoff safe report or handoff was not ready for sequence summary.", [...handoffSafeReport.validation.blocking_reasons, ...handoff.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_sequence_summary_id: safe(options.id, "runtime-activation-sequence-summary-001"), runtime_activation_handoff_safe_report_id: handoffSafeReport.runtime_activation_handoff_safe_report_id, runtime_activation_handoff_id: handoff.runtime_activation_handoff_id, render_plan_id: handoffSafeReport.render_plan_id, project_id: handoffSafeReport.project_id, platform: handoffSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), sequence_summary_state: readyForNext ? "approved_for_future_sequence_summary_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_handoff_safe_report_validated: true, runtime_activation_handoff_validated: true }, sequence_summary_scope: scope(readyForNext), sequence_summary_controls: { sequence_summary_only: true, summary_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, summary_finalized_now: false, real_upload_still_blocked: true }, sequence_summary_terms: terms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationSequenceSummary", source_runtime_activation_handoff_safe_report_id: handoffSafeReport.runtime_activation_handoff_safe_report_id, source_render_plan_id: handoffSafeReport.render_plan_id } };
}
export function createRuntimeActivationSequenceSummaryReview(summary: RuntimeActivationSequenceSummary, handoffSafeReport: RuntimeActivationHandoffSafeReport, options: { id?: string; created_at?: string; requestFutureSequenceSummarySafeReport?: boolean } = {}): RuntimeActivationSequenceSummaryReview {
  const ready = summaryReady(summary) && handoffSafeReportReady(handoffSafeReport);
  const readyForNext = ready && options.requestFutureSequenceSummarySafeReport !== false;
  const reasons = blocking(ready, "Runtime activation sequence summary or handoff safe report was not ready for sequence summary review.", [...summary.validation.blocking_reasons, ...handoffSafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_sequence_summary_review_id: safe(options.id, "runtime-activation-sequence-summary-review-001"), runtime_activation_sequence_summary_id: summary.runtime_activation_sequence_summary_id, runtime_activation_handoff_safe_report_id: summary.runtime_activation_handoff_safe_report_id, render_plan_id: summary.render_plan_id, project_id: summary.project_id, platform: summary.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), sequence_summary_review_state: readyForNext ? "approved_for_future_sequence_summary_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_sequence_summary_validated: true, runtime_activation_handoff_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, sequence_summary_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, summary_finalized_now: false, real_upload_still_blocked: true }, review_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationSequenceSummaryReview", source_runtime_activation_sequence_summary_id: summary.runtime_activation_sequence_summary_id, source_render_plan_id: summary.render_plan_id } };
}
export function createRuntimeActivationSequenceSummarySafeReport(review: RuntimeActivationSequenceSummaryReview, summary: RuntimeActivationSequenceSummary, options: { id?: string; created_at?: string; requestFutureRuntimeActivationCompletionReport?: boolean } = {}): RuntimeActivationSequenceSummarySafeReport {
  const ready = reviewReady(review) && summaryReady(summary);
  const readyForNext = ready && options.requestFutureRuntimeActivationCompletionReport !== false;
  const reasons = blocking(ready, "Runtime activation sequence summary review or summary was not ready for sequence summary safe report.", [...review.validation.blocking_reasons, ...summary.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_sequence_summary_safe_report_id: safe(options.id, "runtime-activation-sequence-summary-safe-report-001"), runtime_activation_sequence_summary_review_id: review.runtime_activation_sequence_summary_review_id, runtime_activation_sequence_summary_id: summary.runtime_activation_sequence_summary_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_future_runtime_activation_completion_report" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_sequence_summary_review_validated: true, runtime_activation_sequence_summary_validated: true }, report_scope: scope(readyForNext), report_controls: { safe_report_only: true, sequence_summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, summary_finalized_now: false, real_upload_still_blocked: true }, safe_report_sections: sections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationSequenceSummarySafeReport", source_runtime_activation_sequence_summary_review_id: review.runtime_activation_sequence_summary_review_id, source_render_plan_id: review.render_plan_id } };
}
export function revokeRuntimeActivationSequenceSummary(summary: RuntimeActivationSequenceSummary, reason?: string): RuntimeActivationSequenceSummary { const warning = sanitizeSafeSummary(reason, "Runtime activation sequence summary was revoked."); return { ...summary, sequence_summary_state: "revoked", sequence_summary_scope: scope(false), validation: validation(false, false, summary.validation.blocking_reasons, [...summary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...summary.provenance, generated_by: "revokeRuntimeActivationSequenceSummary" } }; }
export function revokeRuntimeActivationSequenceSummaryReview(review: RuntimeActivationSequenceSummaryReview, reason?: string): RuntimeActivationSequenceSummaryReview { const warning = sanitizeSafeSummary(reason, "Runtime activation sequence summary review was revoked."); return { ...review, sequence_summary_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationSequenceSummaryReview" } }; }
export function revokeRuntimeActivationSequenceSummarySafeReport(report: RuntimeActivationSequenceSummarySafeReport, reason?: string): RuntimeActivationSequenceSummarySafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation sequence summary safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationSequenceSummarySafeReport" } }; }
