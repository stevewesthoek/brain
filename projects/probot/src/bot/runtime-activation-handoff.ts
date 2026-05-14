import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationArchive, RuntimeActivationArchiveSafeReport } from "./runtime-activation-archive.js";

export type RuntimeActivationHandoffState = "draft" | "created" | "approved_for_future_handoff_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationHandoffReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_handoff_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationHandoffSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_sequence_summary" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationHandoffCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationHandoffTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; handoff_executed_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationHandoffReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationHandoffCheckState; safe_summary: string; runtime_enabled_now: false; handoff_executed_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationHandoffSafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; handoff_executed_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationHandoff {
  schema_version: "1.0";
  runtime_activation_handoff_id: string;
  runtime_activation_archive_safe_report_id: string;
  runtime_activation_archive_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  handoff_state: RuntimeActivationHandoffState;
  required_artifacts: { runtime_activation_archive_safe_report_validated: true; runtime_activation_archive_validated: true };
  handoff_scope: ControlledRuntimeActivationScope;
  handoff_controls: { handoff_only: true; handoff_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; handoff_executed_now: false; real_upload_still_blocked: true };
  handoff_terms: RuntimeActivationHandoffTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationHandoff" | "revokeRuntimeActivationHandoff"; source_runtime_activation_archive_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationHandoffReview {
  schema_version: "1.0";
  runtime_activation_handoff_review_id: string;
  runtime_activation_handoff_id: string;
  runtime_activation_archive_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  handoff_review_state: RuntimeActivationHandoffReviewState;
  required_artifacts: { runtime_activation_handoff_validated: true; runtime_activation_archive_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; handoff_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; handoff_executed_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationHandoffReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationHandoffReview" | "revokeRuntimeActivationHandoffReview"; source_runtime_activation_handoff_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationHandoffSafeReport {
  schema_version: "1.0";
  runtime_activation_handoff_safe_report_id: string;
  runtime_activation_handoff_review_id: string;
  runtime_activation_handoff_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationHandoffSafeReportState;
  required_artifacts: { runtime_activation_handoff_review_validated: true; runtime_activation_handoff_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; handoff_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; handoff_executed_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationHandoffSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationHandoffSafeReport" | "revokeRuntimeActivationHandoffSafeReport"; source_runtime_activation_handoff_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation handoff prerequisite was not validated.")))]; }

function archiveSafeReportReady(report: RuntimeActivationArchiveSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_handoff" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.archive_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.archive_executed_now && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.archive_executed_now && !section.ready_for_real_upload_now);
}
function archiveReady(archive: RuntimeActivationArchive): boolean {
  return archive.archive_state === "approved_for_future_archive_review" && archive.validation.complete && archive.validation.ready_for_next_phase && !archive.validation.ready_for_real_upload && archive.archive_controls.archive_only && archive.archive_controls.archive_record_only && !archive.archive_controls.contains_runtime_callable && !archive.archive_controls.contains_raw_payload && !archive.archive_controls.contains_raw_response && !archive.archive_controls.contains_secret_material && !archive.archive_controls.runtime_wiring_implemented && archive.archive_controls.runtime_invocation_disabled && !archive.archive_controls.archive_executed_now && archive.archive_controls.real_upload_still_blocked && archive.archive_terms.every((term) => !term.runtime_enabled_now && !term.archive_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function handoffReady(handoff: RuntimeActivationHandoff): boolean {
  return handoff.handoff_state === "approved_for_future_handoff_review" && handoff.validation.complete && handoff.validation.ready_for_next_phase && handoff.handoff_controls.handoff_only && handoff.handoff_controls.handoff_record_only && !handoff.handoff_controls.contains_runtime_callable && !handoff.handoff_controls.contains_raw_payload && !handoff.handoff_controls.contains_raw_response && !handoff.handoff_controls.contains_secret_material && !handoff.handoff_controls.runtime_wiring_implemented && handoff.handoff_controls.runtime_invocation_disabled && !handoff.handoff_controls.handoff_executed_now && handoff.handoff_controls.real_upload_still_blocked && handoff.handoff_terms.length >= 4 && handoff.handoff_terms.every((term) => !term.runtime_enabled_now && !term.handoff_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function handoffReviewReady(review: RuntimeActivationHandoffReview): boolean {
  return review.handoff_review_state === "approved_for_future_handoff_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.handoff_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && !review.review_controls.handoff_executed_now && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.handoff_executed_now && !check.ready_for_real_upload_now);
}

function handoffTerms(): RuntimeActivationHandoffTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `handoff-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Handoff record scope only; no runtime enabled.", runtime_enabled_now: false, handoff_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function reviewChecks(passed: boolean): RuntimeActivationHandoffReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `handoff-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Handoff scope reviewed only.", runtime_enabled_now: false, handoff_executed_now: false, ready_for_real_upload_now: false })); }
function safeReportSections(): RuntimeActivationHandoffSafeReportSection[] { return ["handoff", "review", "runtime", "status"].map((kind) => ({ section_id: `handoff-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation handoff review summarized only." : "Runtime activation handoff summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, handoff_executed_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationHandoff(archiveSafeReport: RuntimeActivationArchiveSafeReport, archive: RuntimeActivationArchive, options: { id?: string; created_at?: string; requestFutureHandoffReview?: boolean } = {}): RuntimeActivationHandoff {
  const ready = archiveSafeReportReady(archiveSafeReport) && archiveReady(archive);
  const readyForNext = ready && options.requestFutureHandoffReview !== false;
  const reasons = blocking(ready, "Runtime activation archive safe report or archive was not ready for handoff.", [...archiveSafeReport.validation.blocking_reasons, ...archive.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_handoff_id: safe(options.id, "runtime-activation-handoff-001"), runtime_activation_archive_safe_report_id: archiveSafeReport.runtime_activation_archive_safe_report_id, runtime_activation_archive_id: archive.runtime_activation_archive_id, render_plan_id: archiveSafeReport.render_plan_id, project_id: archiveSafeReport.project_id, platform: archiveSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), handoff_state: readyForNext ? "approved_for_future_handoff_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_archive_safe_report_validated: true, runtime_activation_archive_validated: true }, handoff_scope: scope(readyForNext), handoff_controls: { handoff_only: true, handoff_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, handoff_executed_now: false, real_upload_still_blocked: true }, handoff_terms: handoffTerms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationHandoff", source_runtime_activation_archive_safe_report_id: archiveSafeReport.runtime_activation_archive_safe_report_id, source_render_plan_id: archiveSafeReport.render_plan_id } };
}

export function createRuntimeActivationHandoffReview(handoff: RuntimeActivationHandoff, archiveSafeReport: RuntimeActivationArchiveSafeReport, options: { id?: string; created_at?: string; requestFutureHandoffSafeReport?: boolean } = {}): RuntimeActivationHandoffReview {
  const ready = handoffReady(handoff) && archiveSafeReportReady(archiveSafeReport);
  const readyForNext = ready && options.requestFutureHandoffSafeReport !== false;
  const reasons = blocking(ready, "Runtime activation handoff or archive safe report was not ready for handoff review.", [...handoff.validation.blocking_reasons, ...archiveSafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_handoff_review_id: safe(options.id, "runtime-activation-handoff-review-001"), runtime_activation_handoff_id: handoff.runtime_activation_handoff_id, runtime_activation_archive_safe_report_id: handoff.runtime_activation_archive_safe_report_id, render_plan_id: handoff.render_plan_id, project_id: handoff.project_id, platform: handoff.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), handoff_review_state: readyForNext ? "approved_for_future_handoff_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_handoff_validated: true, runtime_activation_archive_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, handoff_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, handoff_executed_now: false, real_upload_still_blocked: true }, review_checks: reviewChecks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationHandoffReview", source_runtime_activation_handoff_id: handoff.runtime_activation_handoff_id, source_render_plan_id: handoff.render_plan_id } };
}

export function createRuntimeActivationHandoffSafeReport(review: RuntimeActivationHandoffReview, handoff: RuntimeActivationHandoff, options: { id?: string; created_at?: string; requestFutureRuntimeActivationSequenceSummary?: boolean } = {}): RuntimeActivationHandoffSafeReport {
  const ready = handoffReviewReady(review) && handoffReady(handoff);
  const readyForNext = ready && options.requestFutureRuntimeActivationSequenceSummary !== false;
  const reasons = blocking(ready, "Runtime activation handoff review or handoff was not ready for handoff safe report.", [...review.validation.blocking_reasons, ...handoff.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_handoff_safe_report_id: safe(options.id, "runtime-activation-handoff-safe-report-001"), runtime_activation_handoff_review_id: review.runtime_activation_handoff_review_id, runtime_activation_handoff_id: handoff.runtime_activation_handoff_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_future_runtime_activation_sequence_summary" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_handoff_review_validated: true, runtime_activation_handoff_validated: true }, report_scope: scope(readyForNext), report_controls: { safe_report_only: true, handoff_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, handoff_executed_now: false, real_upload_still_blocked: true }, safe_report_sections: safeReportSections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationHandoffSafeReport", source_runtime_activation_handoff_review_id: review.runtime_activation_handoff_review_id, source_render_plan_id: review.render_plan_id } };
}

export function revokeRuntimeActivationHandoff(handoff: RuntimeActivationHandoff, reason?: string): RuntimeActivationHandoff { const warning = sanitizeSafeSummary(reason, "Runtime activation handoff was revoked."); return { ...handoff, handoff_state: "revoked", handoff_scope: scope(false), validation: validation(false, false, handoff.validation.blocking_reasons, [...handoff.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...handoff.provenance, generated_by: "revokeRuntimeActivationHandoff" } }; }
export function revokeRuntimeActivationHandoffReview(review: RuntimeActivationHandoffReview, reason?: string): RuntimeActivationHandoffReview { const warning = sanitizeSafeSummary(reason, "Runtime activation handoff review was revoked."); return { ...review, handoff_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationHandoffReview" } }; }
export function revokeRuntimeActivationHandoffSafeReport(report: RuntimeActivationHandoffSafeReport, reason?: string): RuntimeActivationHandoffSafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation handoff safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationHandoffSafeReport" } }; }
