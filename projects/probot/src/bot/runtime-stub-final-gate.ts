import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubReleaseCandidate, RuntimeStubReleaseCandidateSafeReport } from "./runtime-stub-release-candidate.js";

export type RuntimeStubFinalGateState = "draft" | "ready_for_operator_review" | "approved_for_future_final_gate_review" | "rejected" | "revoked" | "blocked";
export type RuntimeStubFinalGateReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_final_gate_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubFinalGateSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_completion_summary" | "rejected" | "revoked" | "blocked";
export type RuntimeStubFinalGateCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubFinalGateCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeStubFinalGateCheckState;
  safe_summary: string;
  opened_now: false;
  runtime_executed_now: false;
}

export interface RuntimeStubFinalGateReviewCheck {
  check_id: string;
  check_kind: string;
  review_state: RuntimeStubFinalGateCheckState;
  safe_summary: string;
  opened_now: false;
  runtime_executed_now: false;
}

export interface RuntimeStubFinalGateSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubFinalGate {
  schema_version: "1.0";
  runtime_stub_final_gate_id: string;
  runtime_stub_release_candidate_safe_report_id: string;
  runtime_stub_release_candidate_id: string;
  runtime_stub_manifest_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_gate_state: RuntimeStubFinalGateState;
  required_artifacts: { runtime_stub_release_candidate_safe_report_validated: true; runtime_stub_release_candidate_validated: true };
  gate_scope: ControlledRuntimeActivationScope;
  gate_controls: {
    final_gate_only: true;
    summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  gate_checks: RuntimeStubFinalGateCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubFinalGate" | "revokeRuntimeStubFinalGate"; source_runtime_stub_release_candidate_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubFinalGateReview {
  schema_version: "1.0";
  runtime_stub_final_gate_review_id: string;
  runtime_stub_final_gate_id: string;
  runtime_stub_release_candidate_id: string;
  runtime_stub_manifest_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  final_gate_review_state: RuntimeStubFinalGateReviewState;
  required_artifacts: { runtime_stub_final_gate_validated: true; runtime_stub_release_candidate_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    final_gate_reviewed: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_checks: RuntimeStubFinalGateReviewCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubFinalGateReview" | "revokeRuntimeStubFinalGateReview"; source_runtime_stub_final_gate_id: string; source_render_plan_id: string };
}

export interface RuntimeStubFinalGateSafeReport {
  schema_version: "1.0";
  runtime_stub_final_gate_safe_report_id: string;
  runtime_stub_final_gate_review_id: string;
  runtime_stub_final_gate_id: string;
  runtime_stub_release_candidate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubFinalGateSafeReportState;
  required_artifacts: { runtime_stub_final_gate_review_validated: true; runtime_stub_final_gate_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubFinalGateSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubFinalGateSafeReport" | "revokeRuntimeStubFinalGateSafeReport"; source_runtime_stub_final_gate_review_id: string; source_render_plan_id: string };
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

const CHECKS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "candidate", kind: "candidate", summary: "Final gate check only." },
  { id: "review", kind: "review", summary: "Final gate check only." },
  { id: "boundaries", kind: "boundaries", summary: "Runtime invocation remains disabled." },
  { id: "status", kind: "status", summary: "Real upload remains disabled." },
];

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}

function candidateReady(candidate: RuntimeStubReleaseCandidate): boolean {
  return candidate.release_candidate_state === "approved_for_future_release_candidate_review" && candidate.validation.complete && candidate.validation.ready_for_next_phase && candidate.candidate_controls.release_candidate_only && candidate.candidate_controls.summary_only && !candidate.candidate_controls.contains_runtime_callable && !candidate.candidate_controls.contains_raw_payload && !candidate.candidate_controls.contains_raw_response && !candidate.candidate_controls.contains_secret_material && candidate.candidate_controls.runtime_invocation_disabled && candidate.candidate_controls.real_upload_still_blocked && candidate.candidate_entries.every((entry) => !entry.runtime_callable_present && !entry.raw_payload_present && !entry.secret_material_present && !entry.released_now);
}

function candidateSafeReportReady(report: RuntimeStubReleaseCandidateSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_final_gate" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function gateReady(gate: RuntimeStubFinalGate): boolean {
  return gate.final_gate_state === "approved_for_future_final_gate_review" && gate.validation.complete && gate.validation.ready_for_next_phase && gate.gate_controls.final_gate_only && gate.gate_controls.summary_only && !gate.gate_controls.contains_runtime_callable && !gate.gate_controls.contains_raw_payload && !gate.gate_controls.contains_raw_response && !gate.gate_controls.contains_secret_material && gate.gate_controls.runtime_invocation_disabled && gate.gate_controls.real_upload_still_blocked && gate.gate_checks.length >= 4 && gate.gate_checks.every((check) => check.check_state === "passed" && !check.opened_now && !check.runtime_executed_now);
}

function reviewReady(review: RuntimeStubFinalGateReview): boolean {
  return review.final_gate_review_state === "approved_for_future_final_gate_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.final_gate_reviewed && !review.review_controls.contains_runtime_callable && !review.review_controls.contains_raw_payload && !review.review_controls.contains_raw_response && !review.review_controls.contains_secret_material && review.review_controls.runtime_invocation_disabled && review.review_controls.real_upload_still_blocked && review.review_checks.length >= 4 && review.review_checks.every((check) => check.review_state === "passed" && !check.opened_now && !check.runtime_executed_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub final gate prerequisite was not validated.")))];
}

function gateChecks(passed: boolean): RuntimeStubFinalGateCheck[] {
  return CHECKS.map((check) => ({ check_id: `final-gate-${sanitizeSafeSummary(check.id, "check")}`, check_kind: sanitizeSafeSummary(check.kind, "gate_check"), check_state: passed ? "passed" : "blocked", safe_summary: sanitizeSafeSummary(check.summary, "Final gate check only."), opened_now: false, runtime_executed_now: false }));
}

function reviewChecks(passed: boolean): RuntimeStubFinalGateReviewCheck[] {
  return CHECKS.map((check) => ({ check_id: `final-gate-review-${sanitizeSafeSummary(check.id, "check")}`, check_kind: sanitizeSafeSummary(check.kind, "gate_review_check"), review_state: passed ? "passed" : "blocked", safe_summary: check.id === "review" ? "Final gate review only." : sanitizeSafeSummary(check.summary, "Final gate review only."), opened_now: false, runtime_executed_now: false }));
}

function safeReportSections(): RuntimeStubFinalGateSafeReportSection[] {
  return [
    { section_id: "final-gate-safe-report-gate", section_kind: "gate", safe_summary: "Final gate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "final-gate-safe-report-review", section_kind: "review", safe_summary: "Final gate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "final-gate-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "final-gate-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
  ];
}

export function createRuntimeStubFinalGate(releaseCandidateSafeReport: RuntimeStubReleaseCandidateSafeReport, releaseCandidate: RuntimeStubReleaseCandidate, options: { id?: string; created_at?: string; requestFutureFinalGateReview?: boolean } = {}): RuntimeStubFinalGate {
  const ready = candidateSafeReportReady(releaseCandidateSafeReport) && candidateReady(releaseCandidate);
  const requestReview = options.requestFutureFinalGateReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub release candidate safe report or candidate was not ready for final gate.", [...releaseCandidateSafeReport.validation.blocking_reasons, ...releaseCandidate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_final_gate_id: safe(options.id, "runtime-stub-final-gate-001"),
    runtime_stub_release_candidate_safe_report_id: releaseCandidateSafeReport.runtime_stub_release_candidate_safe_report_id,
    runtime_stub_release_candidate_id: releaseCandidate.runtime_stub_release_candidate_id,
    runtime_stub_manifest_id: releaseCandidate.runtime_stub_manifest_id,
    render_plan_id: releaseCandidateSafeReport.render_plan_id,
    project_id: releaseCandidateSafeReport.project_id,
    platform: releaseCandidateSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_gate_state: readyForNext ? "approved_for_future_final_gate_review" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_release_candidate_safe_report_validated: true, runtime_stub_release_candidate_validated: true },
    gate_scope: scope(readyForNext),
    gate_controls: { final_gate_only: true, summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    gate_checks: gateChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubFinalGate", source_runtime_stub_release_candidate_safe_report_id: releaseCandidateSafeReport.runtime_stub_release_candidate_safe_report_id, source_render_plan_id: releaseCandidateSafeReport.render_plan_id },
  };
}

export function createRuntimeStubFinalGateReview(finalGate: RuntimeStubFinalGate, releaseCandidate: RuntimeStubReleaseCandidate, options: { id?: string; created_at?: string; requestFutureFinalGateSafeReport?: boolean } = {}): RuntimeStubFinalGateReview {
  const ready = gateReady(finalGate) && candidateReady(releaseCandidate);
  const requestReport = options.requestFutureFinalGateSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub final gate or release candidate was not ready for final gate review.", [...finalGate.validation.blocking_reasons, ...releaseCandidate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_final_gate_review_id: safe(options.id, "runtime-stub-final-gate-review-001"),
    runtime_stub_final_gate_id: finalGate.runtime_stub_final_gate_id,
    runtime_stub_release_candidate_id: releaseCandidate.runtime_stub_release_candidate_id,
    runtime_stub_manifest_id: releaseCandidate.runtime_stub_manifest_id,
    render_plan_id: finalGate.render_plan_id,
    project_id: finalGate.project_id,
    platform: finalGate.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    final_gate_review_state: readyForNext ? "approved_for_future_final_gate_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_final_gate_validated: true, runtime_stub_release_candidate_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, final_gate_reviewed: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_checks: reviewChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubFinalGateReview", source_runtime_stub_final_gate_id: finalGate.runtime_stub_final_gate_id, source_render_plan_id: finalGate.render_plan_id },
  };
}

export function createRuntimeStubFinalGateSafeReport(finalGateReview: RuntimeStubFinalGateReview, finalGate: RuntimeStubFinalGate, options: { id?: string; created_at?: string; requestFutureRuntimeStubCompletionSummary?: boolean } = {}): RuntimeStubFinalGateSafeReport {
  const ready = reviewReady(finalGateReview) && gateReady(finalGate);
  const requestCompletion = options.requestFutureRuntimeStubCompletionSummary !== false;
  const complete = ready;
  const readyForNext = complete && requestCompletion;
  const reasons = blocking(ready, "Runtime stub final gate review or final gate was not ready for final gate safe report.", [...finalGateReview.validation.blocking_reasons, ...finalGate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_final_gate_safe_report_id: safe(options.id, "runtime-stub-final-gate-safe-report-001"),
    runtime_stub_final_gate_review_id: finalGateReview.runtime_stub_final_gate_review_id,
    runtime_stub_final_gate_id: finalGate.runtime_stub_final_gate_id,
    runtime_stub_release_candidate_id: finalGate.runtime_stub_release_candidate_id,
    render_plan_id: finalGateReview.render_plan_id,
    project_id: finalGateReview.project_id,
    platform: finalGateReview.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_completion_summary" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_final_gate_review_validated: true, runtime_stub_final_gate_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubFinalGateSafeReport", source_runtime_stub_final_gate_review_id: finalGateReview.runtime_stub_final_gate_review_id, source_render_plan_id: finalGateReview.render_plan_id },
  };
}

export function revokeRuntimeStubFinalGate(finalGate: RuntimeStubFinalGate, reason?: string): RuntimeStubFinalGate {
  const warning = sanitizeSafeSummary(reason, "Runtime stub final gate was revoked.");
  return { ...finalGate, final_gate_state: "revoked", gate_scope: scope(false), gate_checks: finalGate.gate_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, finalGate.validation.blocking_reasons, [...finalGate.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...finalGate.provenance, generated_by: "revokeRuntimeStubFinalGate" } };
}

export function revokeRuntimeStubFinalGateReview(review: RuntimeStubFinalGateReview, reason?: string): RuntimeStubFinalGateReview {
  const warning = sanitizeSafeSummary(reason, "Runtime stub final gate review was revoked.");
  return { ...review, final_gate_review_state: "revoked", review_scope: scope(false), review_checks: review.review_checks.map((check) => ({ ...check, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeStubFinalGateReview" } };
}

export function revokeRuntimeStubFinalGateSafeReport(report: RuntimeStubFinalGateSafeReport, reason?: string): RuntimeStubFinalGateSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub final gate safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubFinalGateSafeReport" } };
}
