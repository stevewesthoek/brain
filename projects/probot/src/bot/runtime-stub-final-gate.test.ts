import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubFinalGate,
  createRuntimeStubFinalGateReview,
  createRuntimeStubFinalGateSafeReport,
  revokeRuntimeStubFinalGate,
  revokeRuntimeStubFinalGateReview,
  revokeRuntimeStubFinalGateSafeReport,
} from "./runtime-stub-final-gate.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubReleaseCandidate, RuntimeStubReleaseCandidateSafeReport } from "./runtime-stub-release-candidate.js";

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

function readyCandidate(): RuntimeStubReleaseCandidate {
  return {
    schema_version: "1.0",
    runtime_stub_release_candidate_id: "runtime-stub-release-candidate-001",
    runtime_stub_manifest_index_safe_report_id: "runtime-stub-manifest-index-safe-report-001",
    runtime_stub_manifest_id: "runtime-stub-manifest-001",
    runtime_stub_store_id: "runtime-stub-store-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    release_candidate_state: "approved_for_future_release_candidate_review",
    required_artifacts: { runtime_stub_manifest_index_safe_report_validated: true, runtime_stub_manifest_validated: true },
    candidate_scope: {
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
    candidate_controls: {
      release_candidate_only: true,
      summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    candidate_entries: [
      { entry_id: "release-candidate-manifest", entry_kind: "manifest", artifact_id: "runtime-stub-manifest-001", safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
      { entry_id: "release-candidate-index", entry_kind: "index_contract", artifact_id: "runtime-stub-index-contract-001", safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
      { entry_id: "release-candidate-report", entry_kind: "safe_report", artifact_id: "runtime-stub-manifest-index-safe-report-001", safe_summary: "Release candidate summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false, released_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubReleaseCandidate", source_runtime_stub_manifest_index_safe_report_id: "runtime-stub-manifest-index-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyCandidateSafeReport(): RuntimeStubReleaseCandidateSafeReport {
  return {
    schema_version: "1.0",
    runtime_stub_release_candidate_safe_report_id: "runtime-stub-release-candidate-safe-report-001",
    runtime_stub_release_candidate_review_id: "runtime-stub-release-candidate-review-001",
    runtime_stub_release_candidate_id: "runtime-stub-release-candidate-001",
    runtime_stub_manifest_id: "runtime-stub-manifest-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_stub_final_gate",
    required_artifacts: { runtime_stub_release_candidate_review_validated: true, runtime_stub_release_candidate_validated: true },
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
      { section_id: "release-safe-report-candidate", section_kind: "candidate", safe_summary: "Release candidate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "release-safe-report-review", section_kind: "review", safe_summary: "Release candidate safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "release-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "release-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubReleaseCandidateSafeReport", source_runtime_stub_release_candidate_review_id: "runtime-stub-release-candidate-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedCandidate(): RuntimeStubReleaseCandidate {
  return { ...readyCandidate(), release_candidate_state: "blocked", validation: { ...readyCandidate().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Candidate blocked."] } };
}

function blockedCandidateSafeReport(): RuntimeStubReleaseCandidateSafeReport {
  return { ...readyCandidateSafeReport(), safe_report_state: "blocked", validation: { ...readyCandidateSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Candidate safe report blocked."] } };
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

test("VO-7AV-FINAL-GATE-1: final gate passes checks without opening or runtime execution", () => {
  const gate = createRuntimeStubFinalGate(readyCandidateSafeReport(), readyCandidate(), { id: "runtime-stub-final-gate-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(gate.schema_version, "1.0");
  assert.equal(gate.final_gate_state, "approved_for_future_final_gate_review");
  assert.equal(gate.gate_scope.artifact_only, true);
  assert.equal(gate.gate_controls.final_gate_only, true);
  assert.equal(gate.gate_controls.summary_only, true);
  assert.equal(gate.gate_controls.contains_runtime_callable, false);
  assert.equal(gate.gate_controls.contains_raw_payload, false);
  assert.equal(gate.gate_controls.contains_raw_response, false);
  assert.equal(gate.gate_controls.contains_secret_material, false);
  assert.equal(gate.gate_controls.runtime_invocation_disabled, true);
  assert.equal(gate.gate_checks.length, 4);
  assert.equal(gate.gate_checks.every((check) => check.check_state === "passed" && check.opened_now === false && check.runtime_executed_now === false), true);
  assertDisabledBoundary(gate.execution_boundary);
});

test("VO-7AV-FINAL-GATE-2: blocked release candidate inputs block final gate", () => {
  const gate = createRuntimeStubFinalGate(blockedCandidateSafeReport(), blockedCandidate());

  assert.equal(gate.final_gate_state, "blocked");
  assert.equal(gate.validation.complete, false);
  assert.equal(gate.validation.ready_for_next_phase, false);
  assert.equal(gate.validation.blocking_reasons.length > 0, true);
  assert.equal(gate.gate_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(gate.execution_boundary);
});

test("VO-7AV-FINAL-GATE-3: final gate review passes checks without opening or runtime execution", () => {
  const candidate = readyCandidate();
  const gate = createRuntimeStubFinalGate(readyCandidateSafeReport(), candidate);
  const review = createRuntimeStubFinalGateReview(gate, candidate, { id: "runtime-stub-final-gate-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.final_gate_review_state, "approved_for_future_final_gate_safe_report");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.final_gate_reviewed, true);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.review_state === "passed" && check.opened_now === false && check.runtime_executed_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AV-FINAL-GATE-4: blocked final gate blocks review", () => {
  const candidate = blockedCandidate();
  const gate = createRuntimeStubFinalGate(blockedCandidateSafeReport(), candidate);
  const review = createRuntimeStubFinalGateReview(gate, candidate);

  assert.equal(review.final_gate_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AV-FINAL-GATE-5: final gate safe report contains no callable, payload, response, or secrets", () => {
  const candidate = readyCandidate();
  const gate = createRuntimeStubFinalGate(readyCandidateSafeReport(), candidate);
  const review = createRuntimeStubFinalGateReview(gate, candidate);
  const report = createRuntimeStubFinalGateSafeReport(review, gate, { id: "runtime-stub-final-gate-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_stub_completion_summary");
  assert.equal(report.report_scope.artifact_only, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AV-FINAL-GATE-6: blocked final gate review blocks safe report", () => {
  const candidate = blockedCandidate();
  const gate = createRuntimeStubFinalGate(blockedCandidateSafeReport(), candidate);
  const review = createRuntimeStubFinalGateReview(gate, candidate);
  const report = createRuntimeStubFinalGateSafeReport(review, gate);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7AV-SAFETY-7: unsafe strings are sanitized from final gate artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const candidate = readyCandidate();
  const gate = createRuntimeStubFinalGate(readyCandidateSafeReport(), candidate, { id: unsafe, created_at: unsafe });
  const review = createRuntimeStubFinalGateReview(gate, candidate, { id: unsafe, created_at: unsafe });
  const report = createRuntimeStubFinalGateSafeReport(review, gate, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ gate, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AV-SAFETY-8: revocation keeps final gate artifacts disabled", () => {
  const candidate = readyCandidate();
  const gate = createRuntimeStubFinalGate(readyCandidateSafeReport(), candidate);
  const review = createRuntimeStubFinalGateReview(gate, candidate);
  const report = createRuntimeStubFinalGateSafeReport(review, gate);
  const revokedGate = revokeRuntimeStubFinalGate(gate, "Operator revoked final gate.");
  const revokedReview = revokeRuntimeStubFinalGateReview(review, "Operator revoked final gate review.");
  const revokedReport = revokeRuntimeStubFinalGateSafeReport(report, "Operator revoked final gate safe report.");

  assert.equal(revokedGate.final_gate_state, "revoked");
  assert.equal(revokedGate.validation.complete, false);
  assert.equal(revokedGate.validation.ready_for_next_phase, false);
  assert.equal(revokedGate.gate_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedGate.provenance.generated_by, "revokeRuntimeStubFinalGate");
  assertDisabledBoundary(revokedGate.execution_boundary);

  assert.equal(revokedReview.final_gate_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeStubFinalGateReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeStubFinalGateSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
