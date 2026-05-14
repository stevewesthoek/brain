import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubReleaseCandidate,
  createRuntimeStubReleaseCandidateReview,
  createRuntimeStubReleaseCandidateSafeReport,
  revokeRuntimeStubReleaseCandidate,
  revokeRuntimeStubReleaseCandidateReview,
  revokeRuntimeStubReleaseCandidateSafeReport,
} from "./runtime-stub-release-candidate.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubManifest, RuntimeStubManifestIndexSafeReport } from "./runtime-stub-manifest.js";

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

function readyManifest(): RuntimeStubManifest {
  return {
    schema_version: "1.0",
    runtime_stub_manifest_id: "runtime-stub-manifest-001",
    runtime_stub_store_retrieval_safe_report_id: "runtime-stub-store-retrieval-safe-report-001",
    runtime_stub_store_id: "runtime-stub-store-001",
    noop_runtime_stub_id: "noop-runtime-stub-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    manifest_state: "approved_for_future_index_contract",
    required_artifacts: { runtime_stub_store_retrieval_safe_report_validated: true, runtime_stub_store_validated: true },
    manifest_scope: {
      artifact_only: true,
      future_next_phase_requested: true,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    manifest_controls: {
      manifest_only: true,
      indexes_summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    manifest_entries: [
      { entry_id: "manifest-store", entry_kind: "store", artifact_id: "runtime-stub-store-001", safe_summary: "Store summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
      { entry_id: "manifest-index", entry_kind: "index_contract", artifact_id: "runtime-stub-index-contract-001", safe_summary: "Index summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
      { entry_id: "manifest-report", entry_kind: "safe_report", artifact_id: "runtime-stub-manifest-index-safe-report-001", safe_summary: "Safe report summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete: true,
      ready_for_next_phase: true,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: { generated_by: "createRuntimeStubManifest", source_runtime_stub_store_retrieval_safe_report_id: "runtime-stub-store-retrieval-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyManifestIndexSafeReport(): RuntimeStubManifestIndexSafeReport {
  return {
    schema_version: "1.0",
    runtime_stub_manifest_index_safe_report_id: "runtime-stub-manifest-index-safe-report-001",
    runtime_stub_index_contract_id: "runtime-stub-index-contract-001",
    runtime_stub_manifest_id: "runtime-stub-manifest-001",
    runtime_stub_store_id: "runtime-stub-store-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_stub_release_candidate",
    required_artifacts: { runtime_stub_index_contract_validated: true, runtime_stub_manifest_validated: true },
    report_scope: {
      artifact_only: true,
      future_next_phase_requested: true,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    safe_report_sections: [
      { section_id: "manifest-index-safe-report-manifest", section_kind: "manifest", safe_summary: "Manifest/index safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "manifest-index-safe-report-index", section_kind: "index", safe_summary: "Manifest/index safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "manifest-index-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "manifest-index-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete: true,
      ready_for_next_phase: true,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: [],
      warnings: [],
    },
    provenance: { generated_by: "createRuntimeStubManifestIndexSafeReport", source_runtime_stub_index_contract_id: "runtime-stub-index-contract-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedManifest(): RuntimeStubManifest {
  return {
    ...readyManifest(),
    manifest_state: "blocked",
    validation: { ...readyManifest().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Manifest blocked."] },
  };
}

function blockedManifestIndexSafeReport(): RuntimeStubManifestIndexSafeReport {
  return {
    ...readyManifestIndexSafeReport(),
    safe_report_state: "blocked",
    validation: { ...readyManifestIndexSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Manifest/index safe report blocked."] },
  };
}

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  assert.equal(boundary.ready_for_real_upload, false);
  assert.equal(boundary.real_upload_enabled, false);
  assert.equal(boundary.runtime_enabled, false);
  assert.equal(boundary.runtime_executed, false);
  assert.equal(boundary.upload_allowed, false);
  assert.equal(boundary.upload_execution_enabled, false);
  assert.equal(boundary.platform_api_calls_allowed, false);
  assert.equal(boundary.network_calls_allowed, false);
  assert.equal(boundary.credentials_accessed, false);
  assert.equal(boundary.token_accessed, false);
  assert.equal(boundary.keychain_accessed, false);
  assert.equal(boundary.env_accessed, false);
  assert.equal(boundary.media_file_read, false);
  assert.equal(boundary.file_mutation_allowed, false);
  assert.equal(boundary.dependencies_added, false);
  assert.equal(boundary.package_metadata_changed, false);
}

test("VO-7AU-RELEASE-1: release candidate remains summary-only and unreleased", () => {
  const candidate = createRuntimeStubReleaseCandidate(readyManifestIndexSafeReport(), readyManifest(), { id: "runtime-stub-release-candidate-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(candidate.schema_version, "1.0");
  assert.equal(candidate.release_candidate_state, "approved_for_future_release_candidate_review");
  assert.equal(candidate.candidate_scope.artifact_only, true);
  assert.equal(candidate.candidate_controls.release_candidate_only, true);
  assert.equal(candidate.candidate_controls.summary_only, true);
  assert.equal(candidate.candidate_controls.contains_runtime_callable, false);
  assert.equal(candidate.candidate_controls.contains_raw_payload, false);
  assert.equal(candidate.candidate_controls.contains_raw_response, false);
  assert.equal(candidate.candidate_controls.contains_secret_material, false);
  assert.equal(candidate.candidate_controls.runtime_invocation_disabled, true);
  assert.equal(candidate.candidate_entries.length, 3);
  assert.equal(candidate.candidate_entries.every((entry) => entry.released_now === false && entry.runtime_callable_present === false && entry.raw_payload_present === false && entry.secret_material_present === false), true);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AU-RELEASE-2: blocked manifest inputs block release candidate", () => {
  const candidate = createRuntimeStubReleaseCandidate(blockedManifestIndexSafeReport(), blockedManifest());

  assert.equal(candidate.release_candidate_state, "blocked");
  assert.equal(candidate.validation.complete, false);
  assert.equal(candidate.validation.ready_for_next_phase, false);
  assert.equal(candidate.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(candidate.execution_boundary);
});

test("VO-7AU-REVIEW-3: release candidate review passes without release execution", () => {
  const manifest = readyManifest();
  const candidate = createRuntimeStubReleaseCandidate(readyManifestIndexSafeReport(), manifest);
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest, { id: "runtime-stub-release-candidate-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.release_candidate_review_state, "approved_for_future_release_candidate_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.release_candidate_reviewed, true);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_entries.length, 3);
  assert.equal(review.review_entries.every((entry) => entry.review_state === "passed" && entry.released_now === false && entry.runtime_callable_present === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AU-REVIEW-4: blocked release candidate blocks review", () => {
  const manifest = blockedManifest();
  const candidate = createRuntimeStubReleaseCandidate(blockedManifestIndexSafeReport(), manifest);
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest);

  assert.equal(review.release_candidate_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_entries.every((entry) => entry.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AU-REPORT-5: release candidate safe report contains no callable, payload, response, or secrets", () => {
  const manifest = readyManifest();
  const candidate = createRuntimeStubReleaseCandidate(readyManifestIndexSafeReport(), manifest);
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest);
  const report = createRuntimeStubReleaseCandidateSafeReport(review, candidate, { id: "runtime-stub-release-candidate-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_final_gate");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AU-REPORT-6: blocked review blocks release candidate safe report", () => {
  const manifest = blockedManifest();
  const candidate = createRuntimeStubReleaseCandidate(blockedManifestIndexSafeReport(), manifest);
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest);
  const report = createRuntimeStubReleaseCandidateSafeReport(review, candidate);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AU-SAFETY-7: unsafe strings are sanitized from release candidate artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const manifest = readyManifest();
  const candidate = createRuntimeStubReleaseCandidate(readyManifestIndexSafeReport(), manifest, { id: unsafe, created_at: unsafe });
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubReleaseCandidateSafeReport(review, candidate, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ candidate, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AU-SAFETY-8: revocation keeps release candidate artifacts disabled", () => {
  const manifest = readyManifest();
  const candidate = createRuntimeStubReleaseCandidate(readyManifestIndexSafeReport(), manifest);
  const review = createRuntimeStubReleaseCandidateReview(candidate, manifest);
  const report = createRuntimeStubReleaseCandidateSafeReport(review, candidate);
  const revokedCandidate = revokeRuntimeStubReleaseCandidate(candidate, "Operator revoked release candidate.");
  const revokedReview = revokeRuntimeStubReleaseCandidateReview(review, "Operator revoked release candidate review.");
  const revokedReport = revokeRuntimeStubReleaseCandidateSafeReport(report, "Operator revoked release candidate safe report.");

  assert.equal(revokedCandidate.release_candidate_state, "revoked");
  assert.equal(revokedCandidate.validation.complete, false);
  assert.equal(revokedCandidate.validation.ready_for_next_phase, false);
  assert.equal(revokedCandidate.provenance.generated_by, "revokeRuntimeStubReleaseCandidate");
  assertDisabledBoundary(revokedCandidate.execution_boundary);

  assert.equal(revokedReview.release_candidate_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_entries.every((entry) => entry.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeStubReleaseCandidateReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubReleaseCandidateSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
