import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type {
  CandidateSafeReportSection,
  ControlledRuntimeImplementationCandidate,
  ControlledRuntimeImplementationCandidateSafeReport,
  ImplementationCandidateItem,
  ImplementationCandidateReviewItem,
} from "./controlled-runtime-implementation-candidate.js";

export type ControlledRuntimeImplementationFinalBoundaryState = "draft" | "ready_for_operator_review" | "approved_for_future_final_boundary_review" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationFinalBoundaryReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_final_boundary_safe_report" | "rejected" | "revoked" | "blocked";
export type ControlledRuntimeImplementationFinalBoundarySafeReportState = "draft" | "complete" | "approved_for_future_real_runtime_stub_boundary" | "rejected" | "revoked" | "blocked";
export type FinalBoundaryReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface FinalBoundaryItem {
  item_id: string;
  item_kind: string;
  safe_summary: string;
  implemented_now: false;
}

export interface FinalBoundaryReviewItem {
  item_id: string;
  item_kind: string;
  review_state: FinalBoundaryReviewItemState;
  safe_summary: string;
  implemented_now: false;
}

export interface FinalBoundarySafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface ControlledRuntimeImplementationFinalBoundary {
  schema_version: "1.0";
  controlled_runtime_implementation_final_boundary_id: string;
  controlled_runtime_implementation_candidate_safe_report_id: string;
  controlled_runtime_implementation_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_boundary_state: ControlledRuntimeImplementationFinalBoundaryState;
  required_artifacts: {
    controlled_runtime_implementation_candidate_safe_report_validated: true;
    controlled_runtime_implementation_candidate_validated: true;
  };
  boundary_scope: ControlledRuntimeActivationScope;
  boundary_controls: {
    final_boundary_only: true;
    safe_stub_only: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  boundary_items: FinalBoundaryItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationFinalBoundary" | "revokeControlledRuntimeImplementationFinalBoundary";
    source_controlled_runtime_implementation_candidate_safe_report_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationFinalBoundaryReview {
  schema_version: "1.0";
  controlled_runtime_implementation_final_boundary_review_id: string;
  controlled_runtime_implementation_final_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_boundary_review_state: ControlledRuntimeImplementationFinalBoundaryReviewState;
  required_artifacts: { controlled_runtime_implementation_final_boundary_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    final_boundary_reviewed: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  review_items: FinalBoundaryReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationFinalBoundaryReview" | "revokeControlledRuntimeImplementationFinalBoundaryReview";
    source_controlled_runtime_implementation_final_boundary_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRuntimeImplementationFinalBoundarySafeReport {
  schema_version: "1.0";
  controlled_runtime_implementation_final_boundary_safe_report_id: string;
  controlled_runtime_implementation_final_boundary_review_id: string;
  controlled_runtime_implementation_final_boundary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: ControlledRuntimeImplementationFinalBoundarySafeReportState;
  required_artifacts: {
    controlled_runtime_implementation_final_boundary_review_validated: true;
    controlled_runtime_implementation_final_boundary_validated: true;
  };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: FinalBoundarySafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createControlledRuntimeImplementationFinalBoundarySafeReport" | "revokeControlledRuntimeImplementationFinalBoundarySafeReport";
    source_controlled_runtime_implementation_final_boundary_review_id: string;
    source_render_plan_id: string;
  };
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

const ITEMS: Array<{ id: string; kind: string }> = [
  { id: "kill-switch", kind: "kill_switch" },
  { id: "single-upload", kind: "single_upload_limit" },
  { id: "credential", kind: "credential_boundary" },
  { id: "network", kind: "network_boundary" },
  { id: "media", kind: "media_boundary" },
];

const REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "boundaries", kind: "boundaries", summary: "Final boundary safe report only." },
  { id: "controls", kind: "controls", summary: "Final boundary safe report only." },
  { id: "review", kind: "review", summary: "Final boundary safe report only." },
  { id: "status", kind: "status", summary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return {
    artifact_only: true,
    future_next_phase_requested: futureNextPhaseRequested,
    real_upload_enabled_now: false,
    upload_execution_enabled_now: false,
    network_calls_enabled_now: false,
    platform_api_calls_enabled_now: false,
    credential_access_enabled_now: false,
    media_read_enabled_now: false,
    dependencies_requested: false,
    package_metadata_changes_requested: false,
  };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return {
    complete,
    ready_for_next_phase: readyForNextPhase,
    ready_for_real_upload: false,
    real_upload_enabled: false,
    upload_allowed: false,
    network_calls_allowed: false,
    platform_api_calls_allowed: false,
    credentials_accessed: false,
    media_file_read: false,
    blocking_reasons: blockingReasons,
    warnings,
  };
}

function candidateReady(candidate: ControlledRuntimeImplementationCandidate): boolean {
  return candidate.candidate_state === "approved_for_future_candidate_review" && candidate.validation.complete && candidate.validation.ready_for_next_phase && candidate.candidate_controls.safe_stub_only && candidate.candidate_controls.real_upload_still_blocked && candidate.candidate_items.length >= 5 && candidate.candidate_items.every((item: ImplementationCandidateItem) => item.implemented_now === false);
}

function candidateSafeReportReady(report: ControlledRuntimeImplementationCandidateSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_implementation_final_boundary" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section: CandidateSafeReportSection) => !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function finalBoundaryReady(boundary: ControlledRuntimeImplementationFinalBoundary): boolean {
  return boundary.final_boundary_state === "approved_for_future_final_boundary_review" && boundary.validation.complete && boundary.validation.ready_for_next_phase && boundary.boundary_controls.final_boundary_only && boundary.boundary_controls.safe_stub_only && boundary.boundary_controls.real_upload_still_blocked && boundary.boundary_items.length >= 5 && boundary.boundary_items.every((item) => item.implemented_now === false);
}

function finalBoundaryReviewReady(review: ControlledRuntimeImplementationFinalBoundaryReview): boolean {
  return review.final_boundary_review_state === "approved_for_future_final_boundary_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.final_boundary_reviewed && review.review_controls.real_upload_still_blocked && review.review_items.length >= 5 && review.review_items.every((item) => item.review_state === "passed" && item.implemented_now === false);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled runtime implementation final boundary prerequisite was not validated.")))];
}

function boundaryItems(): FinalBoundaryItem[] {
  return ITEMS.map((item) => ({ item_id: `final-boundary-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "final_boundary_item"), safe_summary: "Final boundary item only.", implemented_now: false }));
}

function reviewItems(passed: boolean): FinalBoundaryReviewItem[] {
  return ITEMS.map((item) => ({ item_id: `review-final-boundary-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "final_boundary_review_item"), review_state: passed ? "passed" : "blocked", safe_summary: "Final boundary review only.", implemented_now: false }));
}

function safeReportSections(): FinalBoundarySafeReportSection[] {
  return REPORT_SECTIONS.map((section) => ({ section_id: `final-boundary-safe-report-${sanitizeSafeSummary(section.id, "section")}`, section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"), safe_summary: sanitizeSafeSummary(section.summary, "Final boundary safe report only."), contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false }));
}

export function createControlledRuntimeImplementationFinalBoundary(
  candidateSafeReport: ControlledRuntimeImplementationCandidateSafeReport,
  candidate: ControlledRuntimeImplementationCandidate,
  options: { id?: string; created_at?: string; requestFutureFinalBoundaryReview?: boolean } = {},
): ControlledRuntimeImplementationFinalBoundary {
  const ready = candidateSafeReportReady(candidateSafeReport) && candidateReady(candidate);
  const requestReview = options.requestFutureFinalBoundaryReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Implementation candidate safe report or candidate was not ready for final boundary.", [...candidateSafeReport.validation.blocking_reasons, ...candidate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_final_boundary_id: safe(options.id, "controlled-runtime-implementation-final-boundary-001"),
    controlled_runtime_implementation_candidate_safe_report_id: candidateSafeReport.controlled_runtime_implementation_candidate_safe_report_id,
    controlled_runtime_implementation_candidate_id: candidate.controlled_runtime_implementation_candidate_id,
    render_plan_id: candidateSafeReport.render_plan_id,
    project_id: candidateSafeReport.project_id,
    platform: candidateSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_boundary_state: readyForNext ? "approved_for_future_final_boundary_review" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_implementation_candidate_safe_report_validated: true, controlled_runtime_implementation_candidate_validated: true },
    boundary_scope: scope(readyForNext),
    boundary_controls: { final_boundary_only: true, safe_stub_only: true, single_upload_limit: 1, operator_kill_switch_required: true, real_upload_still_blocked: true },
    boundary_items: boundaryItems(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createControlledRuntimeImplementationFinalBoundary", source_controlled_runtime_implementation_candidate_safe_report_id: candidateSafeReport.controlled_runtime_implementation_candidate_safe_report_id, source_render_plan_id: candidateSafeReport.render_plan_id },
  };
}

export function createControlledRuntimeImplementationFinalBoundaryReview(
  boundary: ControlledRuntimeImplementationFinalBoundary,
  options: { id?: string; created_at?: string; requestFutureFinalBoundarySafeReport?: boolean } = {},
): ControlledRuntimeImplementationFinalBoundaryReview {
  const ready = finalBoundaryReady(boundary);
  const requestReport = options.requestFutureFinalBoundarySafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Implementation final boundary was not ready for final boundary review.", boundary.validation.blocking_reasons);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_final_boundary_review_id: safe(options.id, "controlled-runtime-implementation-final-boundary-review-001"),
    controlled_runtime_implementation_final_boundary_id: boundary.controlled_runtime_implementation_final_boundary_id,
    render_plan_id: boundary.render_plan_id,
    project_id: boundary.project_id,
    platform: boundary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_boundary_review_state: readyForNext ? "approved_for_future_final_boundary_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { controlled_runtime_implementation_final_boundary_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, final_boundary_reviewed: true, single_upload_limit: 1, operator_kill_switch_required: true, real_upload_still_blocked: true },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createControlledRuntimeImplementationFinalBoundaryReview", source_controlled_runtime_implementation_final_boundary_id: boundary.controlled_runtime_implementation_final_boundary_id, source_render_plan_id: boundary.render_plan_id },
  };
}

export function createControlledRuntimeImplementationFinalBoundarySafeReport(
  review: ControlledRuntimeImplementationFinalBoundaryReview,
  boundary: ControlledRuntimeImplementationFinalBoundary,
  options: { id?: string; created_at?: string; requestFutureRealRuntimeStubBoundary?: boolean } = {},
): ControlledRuntimeImplementationFinalBoundarySafeReport {
  const ready = finalBoundaryReviewReady(review) && finalBoundaryReady(boundary);
  const requestStubBoundary = options.requestFutureRealRuntimeStubBoundary !== false;
  const complete = ready;
  const readyForNext = complete && requestStubBoundary;
  const reasons = blocking(ready, "Implementation final boundary review or boundary was not ready for final boundary safe report.", [...review.validation.blocking_reasons, ...boundary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    controlled_runtime_implementation_final_boundary_safe_report_id: safe(options.id, "controlled-runtime-implementation-final-boundary-safe-report-001"),
    controlled_runtime_implementation_final_boundary_review_id: review.controlled_runtime_implementation_final_boundary_review_id,
    controlled_runtime_implementation_final_boundary_id: boundary.controlled_runtime_implementation_final_boundary_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_real_runtime_stub_boundary" : ready ? "complete" : "blocked",
    required_artifacts: { controlled_runtime_implementation_final_boundary_review_validated: true, controlled_runtime_implementation_final_boundary_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createControlledRuntimeImplementationFinalBoundarySafeReport", source_controlled_runtime_implementation_final_boundary_review_id: review.controlled_runtime_implementation_final_boundary_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeControlledRuntimeImplementationFinalBoundary(boundary: ControlledRuntimeImplementationFinalBoundary, reason?: string): ControlledRuntimeImplementationFinalBoundary {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation final boundary was revoked.");
  return { ...boundary, final_boundary_state: "revoked", boundary_scope: scope(false), validation: validation(false, false, boundary.validation.blocking_reasons, [...boundary.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...boundary.provenance, generated_by: "revokeControlledRuntimeImplementationFinalBoundary" } };
}

export function revokeControlledRuntimeImplementationFinalBoundaryReview(review: ControlledRuntimeImplementationFinalBoundaryReview, reason?: string): ControlledRuntimeImplementationFinalBoundaryReview {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation final boundary review was revoked.");
  return { ...review, final_boundary_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeControlledRuntimeImplementationFinalBoundaryReview" } };
}

export function revokeControlledRuntimeImplementationFinalBoundarySafeReport(report: ControlledRuntimeImplementationFinalBoundarySafeReport, reason?: string): ControlledRuntimeImplementationFinalBoundarySafeReport {
  const warning = sanitizeSafeSummary(reason, "Controlled runtime implementation final boundary safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeControlledRuntimeImplementationFinalBoundarySafeReport" } };
}
