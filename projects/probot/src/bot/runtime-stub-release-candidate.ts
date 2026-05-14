import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubManifest, RuntimeStubManifestIndexSafeReport } from "./runtime-stub-manifest.js";

export type RuntimeStubReleaseCandidateState = "draft" | "created" | "ready_for_operator_review" | "approved_for_future_release_candidate_review" | "rejected" | "revoked" | "blocked";
export type RuntimeStubReleaseCandidateReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_release_candidate_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubReleaseCandidateSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_final_gate" | "rejected" | "revoked" | "blocked";
export type RuntimeStubReleaseReviewEntryState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubReleaseCandidateEntry {
  entry_id: string;
  entry_kind: string;
  artifact_id: string;
  safe_summary: string;
  runtime_callable_present: false;
  raw_payload_present: false;
  secret_material_present: false;
  released_now: false;
}

export interface RuntimeStubReleaseCandidateReviewEntry {
  entry_id: string;
  entry_kind: string;
  review_state: RuntimeStubReleaseReviewEntryState;
  safe_summary: string;
  runtime_callable_present: false;
  raw_payload_present: false;
  secret_material_present: false;
  released_now: false;
}

export interface RuntimeStubReleaseCandidateSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubReleaseCandidate {
  schema_version: "1.0";
  runtime_stub_release_candidate_id: string;
  runtime_stub_manifest_index_safe_report_id: string;
  runtime_stub_manifest_id: string;
  runtime_stub_store_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  release_candidate_state: RuntimeStubReleaseCandidateState;
  required_artifacts: {
    runtime_stub_manifest_index_safe_report_validated: true;
    runtime_stub_manifest_validated: true;
  };
  candidate_scope: ControlledRuntimeActivationScope;
  candidate_controls: {
    release_candidate_only: true;
    summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  candidate_entries: RuntimeStubReleaseCandidateEntry[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRuntimeStubReleaseCandidate" | "revokeRuntimeStubReleaseCandidate";
    source_runtime_stub_manifest_index_safe_report_id: string;
    source_render_plan_id: string;
  };
}

export interface RuntimeStubReleaseCandidateReview {
  schema_version: "1.0";
  runtime_stub_release_candidate_review_id: string;
  runtime_stub_release_candidate_id: string;
  runtime_stub_manifest_id: string;
  runtime_stub_store_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  release_candidate_review_state: RuntimeStubReleaseCandidateReviewState;
  required_artifacts: {
    runtime_stub_release_candidate_validated: true;
    runtime_stub_manifest_validated: true;
  };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    release_candidate_reviewed: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  review_entries: RuntimeStubReleaseCandidateReviewEntry[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRuntimeStubReleaseCandidateReview" | "revokeRuntimeStubReleaseCandidateReview";
    source_runtime_stub_release_candidate_id: string;
    source_render_plan_id: string;
  };
}

export interface RuntimeStubReleaseCandidateSafeReport {
  schema_version: "1.0";
  runtime_stub_release_candidate_safe_report_id: string;
  runtime_stub_release_candidate_review_id: string;
  runtime_stub_release_candidate_id: string;
  runtime_stub_manifest_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubReleaseCandidateSafeReportState;
  required_artifacts: {
    runtime_stub_release_candidate_review_validated: true;
    runtime_stub_release_candidate_validated: true;
  };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubReleaseCandidateSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createRuntimeStubReleaseCandidateSafeReport" | "revokeRuntimeStubReleaseCandidateSafeReport";
    source_runtime_stub_release_candidate_review_id: string;
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

function manifestReady(manifest: RuntimeStubManifest): boolean {
  return manifest.manifest_state === "approved_for_future_index_contract" &&
    manifest.validation.complete &&
    manifest.validation.ready_for_next_phase &&
    manifest.manifest_controls.manifest_only &&
    manifest.manifest_controls.indexes_summary_only &&
    !manifest.manifest_controls.contains_runtime_callable &&
    !manifest.manifest_controls.contains_raw_payload &&
    !manifest.manifest_controls.contains_raw_response &&
    !manifest.manifest_controls.contains_secret_material &&
    manifest.manifest_controls.runtime_invocation_disabled &&
    manifest.manifest_controls.real_upload_still_blocked &&
    manifest.manifest_entries.length >= 3 &&
    manifest.manifest_entries.every((entry) => !entry.runtime_callable_present && !entry.raw_payload_present && !entry.secret_material_present);
}

function manifestIndexSafeReportReady(report: RuntimeStubManifestIndexSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_release_candidate" &&
    report.validation.complete &&
    report.validation.ready_for_next_phase &&
    report.safe_report_sections.length >= 4 &&
    report.safe_report_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function candidateReady(candidate: RuntimeStubReleaseCandidate): boolean {
  return candidate.release_candidate_state === "approved_for_future_release_candidate_review" &&
    candidate.validation.complete &&
    candidate.validation.ready_for_next_phase &&
    candidate.candidate_controls.release_candidate_only &&
    candidate.candidate_controls.summary_only &&
    !candidate.candidate_controls.contains_runtime_callable &&
    !candidate.candidate_controls.contains_raw_payload &&
    !candidate.candidate_controls.contains_raw_response &&
    !candidate.candidate_controls.contains_secret_material &&
    candidate.candidate_controls.runtime_invocation_disabled &&
    candidate.candidate_controls.real_upload_still_blocked &&
    candidate.candidate_entries.length >= 3 &&
    candidate.candidate_entries.every((entry) => !entry.runtime_callable_present && !entry.raw_payload_present && !entry.secret_material_present && !entry.released_now);
}

function reviewReady(review: RuntimeStubReleaseCandidateReview): boolean {
  return review.release_candidate_review_state === "approved_for_future_release_candidate_safe_report" &&
    review.validation.complete &&
    review.validation.ready_for_next_phase &&
    review.review_controls.review_only &&
    review.review_controls.release_candidate_reviewed &&
    !review.review_controls.contains_runtime_callable &&
    !review.review_controls.contains_raw_payload &&
    !review.review_controls.contains_raw_response &&
    !review.review_controls.contains_secret_material &&
    review.review_controls.runtime_invocation_disabled &&
    review.review_controls.real_upload_still_blocked &&
    review.review_entries.length >= 3 &&
    review.review_entries.every((entry) => entry.review_state === "passed" && !entry.runtime_callable_present && !entry.raw_payload_present && !entry.secret_material_present && !entry.released_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub release candidate prerequisite was not validated.")))];
}

function candidateEntries(manifest: RuntimeStubManifest, report: RuntimeStubManifestIndexSafeReport): RuntimeStubReleaseCandidateEntry[] {
  return [
    { entry_id: "release-candidate-manifest", entry_kind: "manifest", artifact_id: manifest.runtime_stub_manifest_id, safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
    { entry_id: "release-candidate-index", entry_kind: "index_contract", artifact_id: report.runtime_stub_index_contract_id, safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
    { entry_id: "release-candidate-report", entry_kind: "safe_report", artifact_id: report.runtime_stub_manifest_index_safe_report_id, safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
  ];
}

function reviewEntries(passed: boolean): RuntimeStubReleaseCandidateReviewEntry[] {
  return ["manifest", "index_contract", "safe_report"].map((kind) => ({
    entry_id: `release-review-${kind.replace("_", "-")}`,
    entry_kind: kind,
    review_state: passed ? "passed" : "blocked",
    safe_summary: "Release candidate review only.",
    runtime_callable_present: false,
    raw_payload_present: false,
    secret_material_present: false,
    released_now: false,
  }));
}

function safeReportSections(): RuntimeStubReleaseCandidateSafeReportSection[] {
  return [
    { section_id: "release-safe-report-candidate", section_kind: "candidate", safe_summary: "Release candidate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "release-safe-report-review", section_kind: "review", safe_summary: "Release candidate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "release-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    { section_id: "release-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
  ];
}

export function createRuntimeStubReleaseCandidate(
  manifestIndexSafeReport: RuntimeStubManifestIndexSafeReport,
  manifest: RuntimeStubManifest,
  options: { id?: string; created_at?: string; requestFutureReleaseCandidateReview?: boolean } = {},
): RuntimeStubReleaseCandidate {
  const ready = manifestIndexSafeReportReady(manifestIndexSafeReport) && manifestReady(manifest);
  const requestReview = options.requestFutureReleaseCandidateReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Runtime stub manifest/index safe report or manifest was not ready for release candidate.", [...manifestIndexSafeReport.validation.blocking_reasons, ...manifest.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_release_candidate_id: safe(options.id, "runtime-stub-release-candidate-001"),
    runtime_stub_manifest_index_safe_report_id: manifestIndexSafeReport.runtime_stub_manifest_index_safe_report_id,
    runtime_stub_manifest_id: manifest.runtime_stub_manifest_id,
    runtime_stub_store_id: manifest.runtime_stub_store_id,
    render_plan_id: manifestIndexSafeReport.render_plan_id,
    project_id: manifestIndexSafeReport.project_id,
    platform: manifestIndexSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    release_candidate_state: readyForNext ? "approved_for_future_release_candidate_review" : ready ? "created" : "blocked",
    required_artifacts: { runtime_stub_manifest_index_safe_report_validated: true, runtime_stub_manifest_validated: true },
    candidate_scope: scope(readyForNext),
    candidate_controls: { release_candidate_only: true, summary_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    candidate_entries: candidateEntries(manifest, manifestIndexSafeReport),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubReleaseCandidate", source_runtime_stub_manifest_index_safe_report_id: manifestIndexSafeReport.runtime_stub_manifest_index_safe_report_id, source_render_plan_id: manifestIndexSafeReport.render_plan_id },
  };
}

export function createRuntimeStubReleaseCandidateReview(
  candidate: RuntimeStubReleaseCandidate,
  manifest: RuntimeStubManifest,
  options: { id?: string; created_at?: string; requestFutureReleaseCandidateSafeReport?: boolean } = {},
): RuntimeStubReleaseCandidateReview {
  const ready = candidateReady(candidate) && manifestReady(manifest);
  const requestReport = options.requestFutureReleaseCandidateSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub release candidate or manifest was not ready for release candidate review.", [...candidate.validation.blocking_reasons, ...manifest.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_release_candidate_review_id: safe(options.id, "runtime-stub-release-candidate-review-001"),
    runtime_stub_release_candidate_id: candidate.runtime_stub_release_candidate_id,
    runtime_stub_manifest_id: candidate.runtime_stub_manifest_id,
    runtime_stub_store_id: candidate.runtime_stub_store_id,
    render_plan_id: candidate.render_plan_id,
    project_id: candidate.project_id,
    platform: candidate.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    release_candidate_review_state: readyForNext ? "approved_for_future_release_candidate_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_release_candidate_validated: true, runtime_stub_manifest_validated: true },
    review_scope: scope(readyForNext),
    review_controls: { review_only: true, release_candidate_reviewed: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    review_entries: reviewEntries(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubReleaseCandidateReview", source_runtime_stub_release_candidate_id: candidate.runtime_stub_release_candidate_id, source_render_plan_id: candidate.render_plan_id },
  };
}

export function createRuntimeStubReleaseCandidateSafeReport(
  review: RuntimeStubReleaseCandidateReview,
  candidate: RuntimeStubReleaseCandidate,
  options: { id?: string; created_at?: string; requestFutureRuntimeStubFinalGate?: boolean } = {},
): RuntimeStubReleaseCandidateSafeReport {
  const ready = reviewReady(review) && candidateReady(candidate);
  const requestFinalGate = options.requestFutureRuntimeStubFinalGate !== false;
  const complete = ready;
  const readyForNext = complete && requestFinalGate;
  const reasons = blocking(ready, "Runtime stub release candidate review or candidate was not ready for safe report.", [...review.validation.blocking_reasons, ...candidate.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_release_candidate_safe_report_id: safe(options.id, "runtime-stub-release-candidate-safe-report-001"),
    runtime_stub_release_candidate_review_id: review.runtime_stub_release_candidate_review_id,
    runtime_stub_release_candidate_id: candidate.runtime_stub_release_candidate_id,
    runtime_stub_manifest_id: candidate.runtime_stub_manifest_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_final_gate" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_release_candidate_review_validated: true, runtime_stub_release_candidate_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubReleaseCandidateSafeReport", source_runtime_stub_release_candidate_review_id: review.runtime_stub_release_candidate_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeRuntimeStubReleaseCandidate(candidate: RuntimeStubReleaseCandidate, reason?: string): RuntimeStubReleaseCandidate {
  const warning = sanitizeSafeSummary(reason, "Runtime stub release candidate was revoked.");
  return { ...candidate, release_candidate_state: "revoked", candidate_scope: scope(false), validation: validation(false, false, candidate.validation.blocking_reasons, [...candidate.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...candidate.provenance, generated_by: "revokeRuntimeStubReleaseCandidate" } };
}

export function revokeRuntimeStubReleaseCandidateReview(review: RuntimeStubReleaseCandidateReview, reason?: string): RuntimeStubReleaseCandidateReview {
  const warning = sanitizeSafeSummary(reason, "Runtime stub release candidate review was revoked.");
  return { ...review, release_candidate_review_state: "revoked", review_scope: scope(false), review_entries: review.review_entries.map((entry) => ({ ...entry, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeRuntimeStubReleaseCandidateReview" } };
}

export function revokeRuntimeStubReleaseCandidateSafeReport(report: RuntimeStubReleaseCandidateSafeReport, reason?: string): RuntimeStubReleaseCandidateSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub release candidate safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubReleaseCandidateSafeReport" } };
}
