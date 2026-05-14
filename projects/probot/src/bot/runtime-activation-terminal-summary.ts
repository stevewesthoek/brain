import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationFinalHandoff, RuntimeActivationFinalHandoffSafeReport } from "./runtime-activation-final-handoff.js";

export type RuntimeActivationTerminalSummaryState = "draft" | "created" | "approved_for_future_terminal_summary_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationTerminalSummaryReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_terminal_summary_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationTerminalSummarySafeReportState = "draft" | "complete" | "terminal_boundary_reached" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationTerminalSummaryCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationTerminalSummaryTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; terminal_summary_finalized_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationTerminalSummaryReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationTerminalSummaryCheckState; safe_summary: string; runtime_enabled_now: false; terminal_summary_finalized_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationTerminalSummarySafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; terminal_summary_finalized_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationTerminalSummary {
  schema_version: "1.0";
  runtime_activation_terminal_summary_id: string;
  runtime_activation_final_handoff_safe_report_id: string;
  runtime_activation_final_handoff_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  terminal_summary_state: RuntimeActivationTerminalSummaryState;
  required_artifacts: { runtime_activation_final_handoff_safe_report_validated: true; runtime_activation_final_handoff_validated: true };
  terminal_summary_scope: ControlledRuntimeActivationScope;
  terminal_summary_controls: { terminal_summary_only: true; terminal_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; terminal_summary_finalized_now: false; real_upload_still_blocked: true };
  terminal_summary_terms: RuntimeActivationTerminalSummaryTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationTerminalSummary" | "revokeRuntimeActivationTerminalSummary"; source_runtime_activation_final_handoff_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationTerminalSummaryReview {
  schema_version: "1.0";
  runtime_activation_terminal_summary_review_id: string;
  runtime_activation_terminal_summary_id: string;
  runtime_activation_final_handoff_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  terminal_summary_review_state: RuntimeActivationTerminalSummaryReviewState;
  required_artifacts: { runtime_activation_terminal_summary_validated: true; runtime_activation_final_handoff_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; terminal_summary_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; terminal_summary_finalized_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationTerminalSummaryReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationTerminalSummaryReview" | "revokeRuntimeActivationTerminalSummaryReview"; source_runtime_activation_terminal_summary_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationTerminalSummarySafeReport {
  schema_version: "1.0";
  runtime_activation_terminal_summary_safe_report_id: string;
  runtime_activation_terminal_summary_review_id: string;
  runtime_activation_terminal_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationTerminalSummarySafeReportState;
  required_artifacts: { runtime_activation_terminal_summary_review_validated: true; runtime_activation_terminal_summary_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; terminal_summary_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; terminal_summary_finalized_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationTerminalSummarySafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationTerminalSummarySafeReport" | "revokeRuntimeActivationTerminalSummarySafeReport"; source_runtime_activation_terminal_summary_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation terminal summary prerequisite was not validated.")))]; }
function finalHandoffSafeReportReady(report: RuntimeActivationFinalHandoffSafeReport): boolean { return report.safe_report_state === "approved_for_future_runtime_activation_terminal_summary" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.final_handoff_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.final_handoff_executed_now && report.report_controls.real_upload_still_blocked; }
function finalHandoffReady(handoff: RuntimeActivationFinalHandoff): boolean { return handoff.final_handoff_state === "approved_for_future_final_handoff_review" && handoff.validation.complete && handoff.validation.ready_for_next_phase && !handoff.validation.ready_for_real_upload && handoff.final_handoff_controls.final_handoff_only && handoff.final_handoff_controls.final_handoff_record_only && !handoff.final_handoff_controls.final_handoff_executed_now && handoff.final_handoff_controls.real_upload_still_blocked; }
function summaryReady(summary: RuntimeActivationTerminalSummary): boolean { return summary.terminal_summary_state === "approved_for_future_terminal_summary_review" && summary.validation.complete && summary.validation.ready_for_next_phase && summary.terminal_summary_controls.terminal_summary_only && summary.terminal_summary_controls.terminal_record_only && !summary.terminal_summary_controls.terminal_summary_finalized_now && summary.terminal_summary_terms.length >= 4; }
function reviewReady(review: RuntimeActivationTerminalSummaryReview): boolean { return review.terminal_summary_review_state === "approved_for_future_terminal_summary_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.terminal_summary_finalized_now && !check.ready_for_real_upload_now); }
function terms(): RuntimeActivationTerminalSummaryTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `terminal-summary-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Terminal summary record scope only; no runtime enabled.", runtime_enabled_now: false, terminal_summary_finalized_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function checks(passed: boolean): RuntimeActivationTerminalSummaryReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `terminal-summary-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Terminal summary scope reviewed only.", runtime_enabled_now: false, terminal_summary_finalized_now: false, ready_for_real_upload_now: false })); }
function sections(): RuntimeActivationTerminalSummarySafeReportSection[] { return ["summary", "review", "runtime", "status"].map((kind) => ({ section_id: `terminal-summary-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation terminal summary review summarized only." : "Runtime activation terminal summary summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, terminal_summary_finalized_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationTerminalSummary(finalHandoffSafeReport: RuntimeActivationFinalHandoffSafeReport, finalHandoff: RuntimeActivationFinalHandoff, options: { id?: string; created_at?: string; requestFutureTerminalSummaryReview?: boolean } = {}): RuntimeActivationTerminalSummary {
  const ready = finalHandoffSafeReportReady(finalHandoffSafeReport) && finalHandoffReady(finalHandoff);
  const readyForNext = ready && options.requestFutureTerminalSummaryReview !== false;
  const reasons = blocking(ready, "Runtime activation final-handoff safe report or final handoff was not ready for terminal summary.", [...finalHandoffSafeReport.validation.blocking_reasons, ...finalHandoff.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_terminal_summary_id: safe(options.id, "runtime-activation-terminal-summary-001"), runtime_activation_final_handoff_safe_report_id: finalHandoffSafeReport.runtime_activation_final_handoff_safe_report_id, runtime_activation_final_handoff_id: finalHandoff.runtime_activation_final_handoff_id, render_plan_id: finalHandoffSafeReport.render_plan_id, project_id: finalHandoffSafeReport.project_id, platform: finalHandoffSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), terminal_summary_state: readyForNext ? "approved_for_future_terminal_summary_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_final_handoff_safe_report_validated: true, runtime_activation_final_handoff_validated: true }, terminal_summary_scope: scope(readyForNext), terminal_summary_controls: { terminal_summary_only: true, terminal_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, terminal_summary_finalized_now: false, real_upload_still_blocked: true }, terminal_summary_terms: terms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationTerminalSummary", source_runtime_activation_final_handoff_safe_report_id: finalHandoffSafeReport.runtime_activation_final_handoff_safe_report_id, source_render_plan_id: finalHandoffSafeReport.render_plan_id } };
}
export function createRuntimeActivationTerminalSummaryReview(summary: RuntimeActivationTerminalSummary, finalHandoffSafeReport: RuntimeActivationFinalHandoffSafeReport, options: { id?: string; created_at?: string; requestFutureTerminalSummarySafeReport?: boolean } = {}): RuntimeActivationTerminalSummaryReview {
  const ready = summaryReady(summary) && finalHandoffSafeReportReady(finalHandoffSafeReport);
  const readyForNext = ready && options.requestFutureTerminalSummarySafeReport !== false;
  const reasons = blocking(ready, "Runtime activation terminal summary or final-handoff safe report was not ready for terminal summary review.", [...summary.validation.blocking_reasons, ...finalHandoffSafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_terminal_summary_review_id: safe(options.id, "runtime-activation-terminal-summary-review-001"), runtime_activation_terminal_summary_id: summary.runtime_activation_terminal_summary_id, runtime_activation_final_handoff_safe_report_id: summary.runtime_activation_final_handoff_safe_report_id, render_plan_id: summary.render_plan_id, project_id: summary.project_id, platform: summary.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), terminal_summary_review_state: readyForNext ? "approved_for_future_terminal_summary_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_terminal_summary_validated: true, runtime_activation_final_handoff_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, terminal_summary_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, terminal_summary_finalized_now: false, real_upload_still_blocked: true }, review_checks: checks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationTerminalSummaryReview", source_runtime_activation_terminal_summary_id: summary.runtime_activation_terminal_summary_id, source_render_plan_id: summary.render_plan_id } };
}
export function createRuntimeActivationTerminalSummarySafeReport(review: RuntimeActivationTerminalSummaryReview, summary: RuntimeActivationTerminalSummary, options: { id?: string; created_at?: string; requestTerminalBoundaryReached?: boolean } = {}): RuntimeActivationTerminalSummarySafeReport {
  const ready = reviewReady(review) && summaryReady(summary);
  const readyForNext = ready && options.requestTerminalBoundaryReached !== false;
  const reasons = blocking(ready, "Runtime activation terminal summary review or summary was not ready for terminal safe report.", [...review.validation.blocking_reasons, ...summary.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_terminal_summary_safe_report_id: safe(options.id, "runtime-activation-terminal-summary-safe-report-001"), runtime_activation_terminal_summary_review_id: review.runtime_activation_terminal_summary_review_id, runtime_activation_terminal_summary_id: summary.runtime_activation_terminal_summary_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "terminal_boundary_reached" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_terminal_summary_review_validated: true, runtime_activation_terminal_summary_validated: true }, report_scope: scope(false), report_controls: { safe_report_only: true, terminal_summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, terminal_summary_finalized_now: false, real_upload_still_blocked: true }, safe_report_sections: sections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, false, ready ? [] : reasons, readyForNext ? ["Runtime activation terminal boundary reached without enabling runtime or real upload."] : []), provenance: { generated_by: "createRuntimeActivationTerminalSummarySafeReport", source_runtime_activation_terminal_summary_review_id: review.runtime_activation_terminal_summary_review_id, source_render_plan_id: review.render_plan_id } };
}
export function revokeRuntimeActivationTerminalSummary(summary: RuntimeActivationTerminalSummary, reason?: string): RuntimeActivationTerminalSummary { const warning = sanitizeSafeSummary(reason, "Runtime activation terminal summary was revoked."); return { ...summary, terminal_summary_state: "revoked", terminal_summary_scope: scope(false), validation: validation(false, false, summary.validation.blocking_reasons, [...summary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...summary.provenance, generated_by: "revokeRuntimeActivationTerminalSummary" } }; }
export function revokeRuntimeActivationTerminalSummaryReview(review: RuntimeActivationTerminalSummaryReview, reason?: string): RuntimeActivationTerminalSummaryReview { const warning = sanitizeSafeSummary(reason, "Runtime activation terminal summary review was revoked."); return { ...review, terminal_summary_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationTerminalSummaryReview" } }; }
export function revokeRuntimeActivationTerminalSummarySafeReport(report: RuntimeActivationTerminalSummarySafeReport, reason?: string): RuntimeActivationTerminalSummarySafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation terminal summary safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationTerminalSummarySafeReport" } }; }
