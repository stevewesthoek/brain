import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeActivationCloseout, RuntimeActivationCloseoutSafeReport } from "./runtime-activation-closeout.js";

export type RuntimeActivationArchiveState = "draft" | "created" | "approved_for_future_archive_review" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationArchiveReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_archive_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationArchiveSafeReportState = "draft" | "complete" | "approved_for_future_runtime_activation_handoff" | "rejected" | "revoked" | "blocked";
export type RuntimeActivationArchiveCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeActivationArchiveTerm { term_id: string; term_kind: string; safe_summary: string; runtime_enabled_now: false; archive_executed_now: false; ready_for_real_upload_now: false; contains_runtime_callable: false; contains_raw_payload: false; contains_secret_material: false; }
export interface RuntimeActivationArchiveReviewCheck { check_id: string; check_kind: string; check_state: RuntimeActivationArchiveCheckState; safe_summary: string; runtime_enabled_now: false; archive_executed_now: false; ready_for_real_upload_now: false; }
export interface RuntimeActivationArchiveSafeReportSection { section_id: string; section_kind: string; safe_summary: string; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_enabled_now: false; archive_executed_now: false; ready_for_real_upload_now: false; }

export interface RuntimeActivationArchive {
  schema_version: "1.0";
  runtime_activation_archive_id: string;
  runtime_activation_closeout_safe_report_id: string;
  runtime_activation_closeout_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  archive_state: RuntimeActivationArchiveState;
  required_artifacts: { runtime_activation_closeout_safe_report_validated: true; runtime_activation_closeout_validated: true };
  archive_scope: ControlledRuntimeActivationScope;
  archive_controls: { archive_only: true; archive_record_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; archive_executed_now: false; real_upload_still_blocked: true };
  archive_terms: RuntimeActivationArchiveTerm[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationArchive" | "revokeRuntimeActivationArchive"; source_runtime_activation_closeout_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationArchiveReview {
  schema_version: "1.0";
  runtime_activation_archive_review_id: string;
  runtime_activation_archive_id: string;
  runtime_activation_closeout_safe_report_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  archive_review_state: RuntimeActivationArchiveReviewState;
  required_artifacts: { runtime_activation_archive_validated: true; runtime_activation_closeout_safe_report_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: { review_only: true; archive_review_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; archive_executed_now: false; real_upload_still_blocked: true };
  review_checks: RuntimeActivationArchiveReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationArchiveReview" | "revokeRuntimeActivationArchiveReview"; source_runtime_activation_archive_id: string; source_render_plan_id: string };
}

export interface RuntimeActivationArchiveSafeReport {
  schema_version: "1.0";
  runtime_activation_archive_safe_report_id: string;
  runtime_activation_archive_review_id: string;
  runtime_activation_archive_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeActivationArchiveSafeReportState;
  required_artifacts: { runtime_activation_archive_review_validated: true; runtime_activation_archive_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  report_controls: { safe_report_only: true; archive_only: true; contains_runtime_callable: false; contains_raw_payload: false; contains_raw_response: false; contains_secret_material: false; runtime_wiring_implemented: false; runtime_invocation_disabled: true; archive_executed_now: false; real_upload_still_blocked: true };
  safe_report_sections: RuntimeActivationArchiveSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeActivationArchiveSafeReport" | "revokeRuntimeActivationArchiveSafeReport"; source_runtime_activation_archive_review_id: string; source_render_plan_id: string };
}

const DISABLED_BOUNDARY: DisabledEnablementBoundary = { ready_for_real_upload: false, real_upload_enabled: false, runtime_enabled: false, runtime_executed: false, upload_allowed: false, upload_execution_enabled: false, platform_api_calls_allowed: false, network_calls_allowed: false, credentials_accessed: false, token_accessed: false, keychain_accessed: false, env_accessed: false, media_file_read: false, file_mutation_allowed: false, dependencies_added: false, package_metadata_changed: false };
function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }
function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope { return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false }; }
function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation { return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings }; }
function blocking(ready: boolean, message: string, upstream: string[] = []): string[] { return ready ? [] : [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime activation archive prerequisite was not validated.")))]; }

function closeoutSafeReportReady(report: RuntimeActivationCloseoutSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_activation_archive" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && report.report_controls.safe_report_only && report.report_controls.closeout_only && !report.report_controls.contains_runtime_callable && !report.report_controls.contains_raw_payload && !report.report_controls.contains_raw_response && !report.report_controls.contains_secret_material && !report.report_controls.runtime_wiring_implemented && report.report_controls.runtime_invocation_disabled && !report.report_controls.closeout_executed_now && report.report_controls.real_upload_still_blocked && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.runtime_enabled_now && !section.closeout_executed_now && !section.ready_for_real_upload_now);
}
function closeoutReady(closeout: RuntimeActivationCloseout): boolean {
  return closeout.closeout_state === "approved_for_future_closeout_review" && closeout.validation.complete && closeout.validation.ready_for_next_phase && !closeout.validation.ready_for_real_upload && closeout.closeout_controls.closeout_only && closeout.closeout_controls.closeout_record_only && !closeout.closeout_controls.contains_runtime_callable && !closeout.closeout_controls.contains_raw_payload && !closeout.closeout_controls.contains_raw_response && !closeout.closeout_controls.contains_secret_material && !closeout.closeout_controls.runtime_wiring_implemented && closeout.closeout_controls.runtime_invocation_disabled && !closeout.closeout_controls.closeout_executed_now && closeout.closeout_controls.real_upload_still_blocked && closeout.closeout_terms.every((term) => !term.runtime_enabled_now && !term.closeout_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function archiveReady(archive: RuntimeActivationArchive): boolean {
  return archive.archive_state === "approved_for_future_archive_review" && archive.validation.complete && archive.validation.ready_for_next_phase && archive.archive_controls.archive_only && archive.archive_controls.archive_record_only && !archive.archive_controls.contains_runtime_callable && !archive.archive_controls.contains_raw_payload && !archive.archive_controls.contains_raw_response && !archive.archive_controls.contains_secret_material && !archive.archive_controls.runtime_wiring_implemented && archive.archive_controls.runtime_invocation_disabled && !archive.archive_controls.archive_executed_now && archive.archive_controls.real_upload_still_blocked && archive.archive_terms.length >= 4 && archive.archive_terms.every((term) => !term.runtime_enabled_now && !term.archive_executed_now && !term.ready_for_real_upload_now && !term.contains_runtime_callable && !term.contains_raw_payload && !term.contains_secret_material);
}
function archiveReviewReady(review: RuntimeActivationArchiveReview): boolean {
  return review.archive_review_state === "approved_for_future_archive_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.archive_review_only && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && !review.review_controls.runtime_wiring_implemented && review.review_controls.runtime_invocation_disabled && !review.review_controls.archive_executed_now && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.check_state === "passed" && !check.runtime_enabled_now && !check.archive_executed_now && !check.ready_for_real_upload_now);
}

function archiveTerms(): RuntimeActivationArchiveTerm[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ term_id: `archive-${kind}`, term_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Archive record scope only; no runtime enabled.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false })); }
function reviewChecks(passed: boolean): RuntimeActivationArchiveReviewCheck[] { return ["scope", "runtime", "credentials", "status"].map((kind) => ({ check_id: `archive-review-${kind}`, check_kind: kind, check_state: passed ? "passed" : "blocked", safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "credentials" ? "Credentials remain inaccessible." : "Archive scope reviewed only.", runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false })); }
function safeReportSections(): RuntimeActivationArchiveSafeReportSection[] { return ["archive", "review", "runtime", "status"].map((kind) => ({ section_id: `archive-safe-report-${kind}`, section_kind: kind, safe_summary: kind === "status" ? "Real upload remains disabled." : kind === "runtime" ? "Runtime invocation remains disabled." : kind === "review" ? "Runtime activation archive review summarized only." : "Runtime activation archive summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, archive_executed_now: false, ready_for_real_upload_now: false })); }

export function createRuntimeActivationArchive(closeoutSafeReport: RuntimeActivationCloseoutSafeReport, closeout: RuntimeActivationCloseout, options: { id?: string; created_at?: string; requestFutureArchiveReview?: boolean } = {}): RuntimeActivationArchive {
  const ready = closeoutSafeReportReady(closeoutSafeReport) && closeoutReady(closeout);
  const readyForNext = ready && options.requestFutureArchiveReview !== false;
  const reasons = blocking(ready, "Runtime activation closeout safe report or closeout was not ready for archive.", [...closeoutSafeReport.validation.blocking_reasons, ...closeout.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_archive_id: safe(options.id, "runtime-activation-archive-001"), runtime_activation_closeout_safe_report_id: closeoutSafeReport.runtime_activation_closeout_safe_report_id, runtime_activation_closeout_id: closeout.runtime_activation_closeout_id, render_plan_id: closeoutSafeReport.render_plan_id, project_id: closeoutSafeReport.project_id, platform: closeoutSafeReport.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), archive_state: readyForNext ? "approved_for_future_archive_review" : ready ? "created" : "blocked", required_artifacts: { runtime_activation_closeout_safe_report_validated: true, runtime_activation_closeout_validated: true }, archive_scope: scope(readyForNext), archive_controls: { archive_only: true, archive_record_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, archive_executed_now: false, real_upload_still_blocked: true }, archive_terms: archiveTerms(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationArchive", source_runtime_activation_closeout_safe_report_id: closeoutSafeReport.runtime_activation_closeout_safe_report_id, source_render_plan_id: closeoutSafeReport.render_plan_id } };
}

export function createRuntimeActivationArchiveReview(archive: RuntimeActivationArchive, closeoutSafeReport: RuntimeActivationCloseoutSafeReport, options: { id?: string; created_at?: string; requestFutureArchiveSafeReport?: boolean } = {}): RuntimeActivationArchiveReview {
  const ready = archiveReady(archive) && closeoutSafeReportReady(closeoutSafeReport);
  const readyForNext = ready && options.requestFutureArchiveSafeReport !== false;
  const reasons = blocking(ready, "Runtime activation archive or closeout safe report was not ready for archive review.", [...archive.validation.blocking_reasons, ...closeoutSafeReport.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_archive_review_id: safe(options.id, "runtime-activation-archive-review-001"), runtime_activation_archive_id: archive.runtime_activation_archive_id, runtime_activation_closeout_safe_report_id: archive.runtime_activation_closeout_safe_report_id, render_plan_id: archive.render_plan_id, project_id: archive.project_id, platform: archive.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), archive_review_state: readyForNext ? "approved_for_future_archive_safe_report" : ready ? "ready_for_operator_review" : "blocked", required_artifacts: { runtime_activation_archive_validated: true, runtime_activation_closeout_safe_report_validated: true }, review_scope: scope(readyForNext), review_controls: { review_only: true, archive_review_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, archive_executed_now: false, real_upload_still_blocked: true }, review_checks: reviewChecks(ready), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationArchiveReview", source_runtime_activation_archive_id: archive.runtime_activation_archive_id, source_render_plan_id: archive.render_plan_id } };
}

export function createRuntimeActivationArchiveSafeReport(review: RuntimeActivationArchiveReview, archive: RuntimeActivationArchive, options: { id?: string; created_at?: string; requestFutureRuntimeActivationHandoff?: boolean } = {}): RuntimeActivationArchiveSafeReport {
  const ready = archiveReviewReady(review) && archiveReady(archive);
  const readyForNext = ready && options.requestFutureRuntimeActivationHandoff !== false;
  const reasons = blocking(ready, "Runtime activation archive review or archive was not ready for archive safe report.", [...review.validation.blocking_reasons, ...archive.validation.blocking_reasons]);
  return { schema_version: "1.0", runtime_activation_archive_safe_report_id: safe(options.id, "runtime-activation-archive-safe-report-001"), runtime_activation_archive_review_id: review.runtime_activation_archive_review_id, runtime_activation_archive_id: archive.runtime_activation_archive_id, render_plan_id: review.render_plan_id, project_id: review.project_id, platform: review.platform, created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"), safe_report_state: readyForNext ? "approved_for_future_runtime_activation_handoff" : ready ? "complete" : "blocked", required_artifacts: { runtime_activation_archive_review_validated: true, runtime_activation_archive_validated: true }, report_scope: scope(readyForNext), report_controls: { safe_report_only: true, archive_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_wiring_implemented: false, runtime_invocation_disabled: true, archive_executed_now: false, real_upload_still_blocked: true }, safe_report_sections: safeReportSections(), execution_boundary: { ...DISABLED_BOUNDARY }, validation: validation(ready, readyForNext, ready ? [] : reasons), provenance: { generated_by: "createRuntimeActivationArchiveSafeReport", source_runtime_activation_archive_review_id: review.runtime_activation_archive_review_id, source_render_plan_id: review.render_plan_id } };
}

export function revokeRuntimeActivationArchive(archive: RuntimeActivationArchive, reason?: string): RuntimeActivationArchive { const warning = sanitizeSafeSummary(reason, "Runtime activation archive was revoked."); return { ...archive, archive_state: "revoked", archive_scope: scope(false), validation: validation(false, false, archive.validation.blocking_reasons, [...archive.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...archive.provenance, generated_by: "revokeRuntimeActivationArchive" } }; }
export function revokeRuntimeActivationArchiveReview(review: RuntimeActivationArchiveReview, reason?: string): RuntimeActivationArchiveReview { const warning = sanitizeSafeSummary(reason, "Runtime activation archive review was revoked."); return { ...review, archive_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeActivationArchiveReview" } }; }
export function revokeRuntimeActivationArchiveSafeReport(report: RuntimeActivationArchiveSafeReport, reason?: string): RuntimeActivationArchiveSafeReport { const warning = sanitizeSafeSummary(reason, "Runtime activation archive safe report was revoked."); return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeActivationArchiveSafeReport" } }; }
