import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubCloseout, RuntimeStubCloseoutSafeReport } from "./runtime-stub-closeout.js";

export type RuntimeStubArchiveState = "draft" | "archived" | "approved_for_future_archive_review" | "rejected" | "revoked" | "blocked";
export type RuntimeStubArchiveReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_archive_final_summary" | "rejected" | "revoked" | "blocked";
export type RuntimeStubArchiveFinalSummaryState = "draft" | "complete" | "runtime_stub_sequence_complete" | "rejected" | "revoked" | "blocked";
export type RuntimeStubArchiveItemState = "archived" | "blocked" | "deferred";
export type RuntimeStubArchiveReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubArchiveItem {
  item_id: string;
  item_kind: string;
  item_state: RuntimeStubArchiveItemState;
  safe_summary: string;
  archived_now: false;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubArchiveReviewItem {
  item_id: string;
  item_kind: string;
  review_state: RuntimeStubArchiveReviewItemState;
  safe_summary: string;
  archived_now: false;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubArchiveFinalSummarySection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubArchive {
  schema_version: "1.0";
  runtime_stub_archive_id: string;
  runtime_stub_closeout_safe_report_id: string;
  runtime_stub_closeout_id: string;
  runtime_stub_completion_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  archive_state: RuntimeStubArchiveState;
  required_artifacts: { runtime_stub_closeout_safe_report_validated: true; runtime_stub_closeout_validated: true };
  archive_scope: ControlledRuntimeActivationScope;
  archive_controls: {
    archive_only: true;
    summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  archive_items: RuntimeStubArchiveItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubArchive" | "revokeRuntimeStubArchive"; source_runtime_stub_closeout_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubArchiveReview {
  schema_version: "1.0";
  runtime_stub_archive_review_id: string;
  runtime_stub_archive_id: string;
  runtime_stub_closeout_id: string;
  runtime_stub_completion_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  archive_review_state: RuntimeStubArchiveReviewState;
  required_artifacts: { runtime_stub_archive_validated: true; runtime_stub_closeout_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    archive_reviewed: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_items: RuntimeStubArchiveReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubArchiveReview" | "revokeRuntimeStubArchiveReview"; source_runtime_stub_archive_id: string; source_render_plan_id: string };
}

export interface RuntimeStubArchiveFinalSummary {
  schema_version: "1.0";
  runtime_stub_archive_final_summary_id: string;
  runtime_stub_archive_review_id: string;
  runtime_stub_archive_id: string;
  runtime_stub_closeout_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_summary_state: RuntimeStubArchiveFinalSummaryState;
  required_artifacts: { runtime_stub_archive_review_validated: true; runtime_stub_archive_validated: true };
  final_summary_scope: ControlledRuntimeActivationScope;
  final_summary_controls: {
    final_summary_only: true;
    runtime_stub_sequence_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  final_summary_sections: RuntimeStubArchiveFinalSummarySection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubArchiveFinalSummary" | "revokeRuntimeStubArchiveFinalSummary"; source_runtime_stub_archive_review_id: string; source_render_plan_id: string };
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

const ITEMS: Array<{ id: string; kind: string; archiveSummary: string; reviewSummary: string }> = [
  { id: "closeout", kind: "closeout", archiveSummary: "Closeout summarized only.", reviewSummary: "Closeout archive reviewed only." },
  { id: "completion", kind: "completion", archiveSummary: "Completion summarized only.", reviewSummary: "Completion archive reviewed only." },
  { id: "boundaries", kind: "boundaries", archiveSummary: "Runtime invocation remains disabled.", reviewSummary: "Runtime invocation remains disabled." },
  { id: "status", kind: "status", archiveSummary: "Real upload remains disabled.", reviewSummary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}

function closeoutReady(closeout: RuntimeStubCloseout): boolean {
  return closeout.closeout_state === "approved_for_future_closeout_review" && closeout.validation.complete && closeout.validation.ready_for_next_phase && closeout.closeout_controls.closeout_only && closeout.closeout_controls.summary_only && !closeout.closeout_controls.contains_runtime_callable && !closeout.closeout_controls.contains_raw_payload && !closeout.closeout_controls.contains_raw_response && !closeout.closeout_controls.contains_secret_material && closeout.closeout_controls.runtime_invocation_disabled && closeout.closeout_controls.real_upload_still_blocked && closeout.closeout_items.length >= 4 && closeout.closeout_items.every((item) => item.item_state === "closed" && !item.closed_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function closeoutSafeReportReady(report: RuntimeStubCloseoutSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_archive" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function archiveReady(archive: RuntimeStubArchive): boolean {
  return archive.archive_state === "approved_for_future_archive_review" && archive.validation.complete && archive.validation.ready_for_next_phase && archive.archive_controls.archive_only && archive.archive_controls.summary_only && !archive.archive_controls.contains_runtime_callable && !archive.archive_controls.contains_raw_payload && !archive.archive_controls.contains_raw_response && !archive.archive_controls.contains_secret_material && archive.archive_controls.runtime_invocation_disabled && archive.archive_controls.real_upload_still_blocked && archive.archive_items.length >= 4 && archive.archive_items.every((item) => item.item_state === "archived" && !item.archived_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function archiveReviewReady(review: RuntimeStubArchiveReview): boolean {
  return review.archive_review_state === "approved_for_future_archive_final_summary" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.archive_reviewed && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_items.length >= 4 && review.review_items.every((item) => item.review_state === "passed" && !item.archived_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub archive prerequisite was not validated.")))];
}

function archiveItems(archived: boolean): RuntimeStubArchiveItem[] {
  return ITEMS.map((item) => ({ item_id: `archive-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "archive_item"), item_state: archived ? "archived" : "blocked", safe_summary: sanitizeSafeSummary(item.archiveSummary, "Runtime stub archive only."), archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function reviewItems(passed: boolean): RuntimeStubArchiveReviewItem[] {
  return ITEMS.map((item) => ({ item_id: `archive-review-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "archive_review_item"), review_state: passed ? "passed" : "blocked", safe_summary: sanitizeSafeSummary(item.reviewSummary, "Runtime stub archive review only."), archived_now: false, runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function finalSummarySections(): RuntimeStubArchiveFinalSummarySection[] {
  return [
    { section_id: "archive-final-summary-archive", section_kind: "archive", safe_summary: "Runtime stub archive summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "archive-final-summary-review", section_kind: "review", safe_summary: "Runtime stub archive review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "archive-final-summary-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "archive-final-summary-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeStubArchive(closeoutSafeReport: RuntimeStubCloseoutSafeReport, closeout: RuntimeStubCloseout, options: { id?: string; created_at?: string; requestFutureArchiveReview?: boolean } = {}): RuntimeStubArchive {
  const ready = closeoutSafeReportReady(closeoutSafeReport) && closeoutReady(closeout);
  const requestReview = options.requestFutureArchiveReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub closeout safe report or closeout was not ready for archive.", [...closeoutSafeReport.validation.blocking_reasons, ...closeout.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_archive_id: safe(options.id, "runtime-stub-archive-001"),
    runtime_stub_closeout_safe_report_id: closeoutSafeReport.runtime_stub_closeout_safe_report_id,
    runtime_stub_closeout_id: closeout.runtime_stub_closeout_id,
    runtime_stub_completion_summary_id: closeout.runtime_stub_completion_summary_id,
    render_plan_id: closeoutSafeReport.render_plan_id,
    project_id: closeoutSafeReport.project_id,
    platform: closeoutSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    archive_state: readyForNext ? "approved_for_future_archive_review" : ready ? "archived" : "blocked",
    required_artifacts: { runtime_stub_closeout_safe_report_validated: true, runtime_stub_closeout_validated: true },
    archive_scope: scope(readyForNext),
    archive_controls: { archive_only: true, summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    archive_items: archiveItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubArchive", source_runtime_stub_closeout_safe_report_id: closeoutSafeReport.runtime_stub_closeout_safe_report_id, source_render_plan_id: closeoutSafeReport.render_plan_id },
  };
}

export function createRuntimeStubArchiveReview(archive: RuntimeStubArchive, closeout: RuntimeStubCloseout, options: { id?: string; created_at?: string; requestFutureArchiveFinalSummary?: boolean } = {}): RuntimeStubArchiveReview {
  const ready = archiveReady(archive) && closeoutReady(closeout);
  const requestFinalSummary = options.requestFutureArchiveFinalSummary !== false;
  const complete = ready;
  const readyForNext = complete && requestFinalSummary;
  const reasons = blocking(ready, "Runtime stub archive or closeout was not ready for archive review.", [...archive.validation.blocking_reasons, ...closeout.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_archive_review_id: safe(options.id, "runtime-stub-archive-review-001"),
    runtime_stub_archive_id: archive.runtime_stub_archive_id,
    runtime_stub_closeout_id: closeout.runtime_stub_closeout_id,
    runtime_stub_completion_summary_id: closeout.runtime_stub_completion_summary_id,
    render_plan_id: archive.render_plan_id,
    project_id: archive.project_id,
    platform: archive.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    archive_review_state: readyForNext ? "approved_for_future_archive_final_summary" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_archive_validated: true, runtime_stub_closeout_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, archive_reviewed: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubArchiveReview", source_runtime_stub_archive_id: archive.runtime_stub_archive_id, source_render_plan_id: archive.render_plan_id },
  };
}

export function createRuntimeStubArchiveFinalSummary(review: RuntimeStubArchiveReview, archive: RuntimeStubArchive, options: { id?: string; created_at?: string } = {}): RuntimeStubArchiveFinalSummary {
  const ready = archiveReviewReady(review) && archiveReady(archive);
  const reasons = blocking(ready, "Runtime stub archive review or archive was not ready for final summary.", [...review.validation.blocking_reasons, ...archive.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_archive_final_summary_id: safe(options.id, "runtime-stub-archive-final-summary-001"),
    runtime_stub_archive_review_id: review.runtime_stub_archive_review_id,
    runtime_stub_archive_id: archive.runtime_stub_archive_id,
    runtime_stub_closeout_id: archive.runtime_stub_closeout_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_summary_state: ready ? "runtime_stub_sequence_complete" : "blocked",
    required_artifacts: { runtime_stub_archive_review_validated: true, runtime_stub_archive_validated: true },
    final_summary_scope: scope(false),
    final_summary_controls: { final_summary_only: true, runtime_stub_sequence_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    final_summary_sections: finalSummarySections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(ready, false, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubArchiveFinalSummary", source_runtime_stub_archive_review_id: review.runtime_stub_archive_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeStubArchive(archive: RuntimeStubArchive, reason?: string): RuntimeStubArchive {
  const warning = sanitizeSafeSummary(reason, "Runtime stub archive was revoked.");
  return { ...archive, archive_state: "revoked", archive_scope: scope(false), archive_items: archive.archive_items.map((item) => ({ ...item, item_state: "blocked" })), validation: validation(false, false, archive.validation.blocking_reasons, [...archive.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...archive.provenance, generated_by: "revokeRuntimeStubArchive" } };
}

export function revokeRuntimeStubArchiveReview(review: RuntimeStubArchiveReview, reason?: string): RuntimeStubArchiveReview {
  const warning = sanitizeSafeSummary(reason, "Runtime stub archive review was revoked.");
  return { ...review, archive_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeStubArchiveReview" } };
}

export function revokeRuntimeStubArchiveFinalSummary(summary: RuntimeStubArchiveFinalSummary, reason?: string): RuntimeStubArchiveFinalSummary {
  const warning = sanitizeSafeSummary(reason, "Runtime stub archive final summary was revoked.");
  return { ...summary, final_summary_state: "revoked", final_summary_scope: scope(false), validation: validation(false, false, summary.validation.blocking_reasons, [...summary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...summary.provenance, generated_by: "revokeRuntimeStubArchiveFinalSummary" } };
}
