import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubArchive,
  createRuntimeStubArchiveReview,
  createRuntimeStubArchiveFinalSummary,
  revokeRuntimeStubArchive,
  revokeRuntimeStubArchiveReview,
  revokeRuntimeStubArchiveFinalSummary,
} from "./runtime-stub-archive.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubCloseout, RuntimeStubCloseoutSafeReport } from "./runtime-stub-closeout.js";

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

function readyCloseout(): RuntimeStubCloseout {
  return {
    schema_version: "1.0",
    runtime_stub_closeout_id: "runtime-stub-closeout-001",
    runtime_stub_completion_safe_report_id: "runtime-stub-completion-safe-report-001",
    runtime_stub_completion_summary_id: "runtime-stub-completion-summary-001",
    runtime_stub_final_gate_id: "runtime-stub-final-gate-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    closeout_state: "approved_for_future_closeout_review",
    required_artifacts: { runtime_stub_completion_safe_report_validated: true, runtime_stub_completion_summary_validated: true },
    closeout_scope: {
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
    closeout_controls: {
      closeout_only: true,
      summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    closeout_items: [
      { item_id: "closeout-completion", item_kind: "completion", item_state: "closed", safe_summary: "Completion summarized only.", closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "closeout-final-gate", item_kind: "final_gate", item_state: "closed", safe_summary: "Final gate summarized only.", closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "closeout-boundaries", item_kind: "boundaries", item_state: "closed", safe_summary: "Runtime invocation remains disabled.", closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "closeout-status", item_kind: "status", item_state: "closed", safe_summary: "Real upload remains disabled.", closed_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubCloseout", source_runtime_stub_completion_safe_report_id: "runtime-stub-completion-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyCloseoutSafeReport(): RuntimeStubCloseoutSafeReport {
  return {
    schema_version: "1.0",
    runtime_stub_closeout_safe_report_id: "runtime-stub-closeout-safe-report-001",
    runtime_stub_closeout_review_id: "runtime-stub-closeout-review-001",
    runtime_stub_closeout_id: "runtime-stub-closeout-001",
    runtime_stub_completion_summary_id: "runtime-stub-completion-summary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_stub_archive",
    required_artifacts: { runtime_stub_closeout_review_validated: true, runtime_stub_closeout_validated: true },
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
      { section_id: "closeout-safe-report-closeout", section_kind: "closeout", safe_summary: "Runtime stub closeout safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "closeout-safe-report-review", section_kind: "review", safe_summary: "Runtime stub closeout safe report only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "closeout-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
      { section_id: "closeout-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubCloseoutSafeReport", source_runtime_stub_closeout_review_id: "runtime-stub-closeout-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedCloseout(): RuntimeStubCloseout {
  return { ...readyCloseout(), closeout_state: "blocked", validation: { ...readyCloseout().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Closeout blocked."] } };
}

function blockedCloseoutSafeReport(): RuntimeStubCloseoutSafeReport {
  return { ...readyCloseoutSafeReport(), safe_report_state: "blocked", validation: { ...readyCloseoutSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Closeout safe report blocked."] } };
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

test("VO-7AY-ARCHIVE-1: archive records summary items without archiving now, runtime execution, or real-upload readiness", () => {
  const archive = createRuntimeStubArchive(readyCloseoutSafeReport(), readyCloseout(), { id: "runtime-stub-archive-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(archive.schema_version, "1.0");
  assert.equal(archive.archive_state, "approved_for_future_archive_review");
  assert.equal(archive.archive_scope.artifact_only, true);
  assert.equal(archive.archive_controls.archive_only, true);
  assert.equal(archive.archive_controls.summary_only, true);
  assert.equal(archive.archive_controls.contains_runtime_callable, false);
  assert.equal(archive.archive_controls.contains_raw_payload, false);
  assert.equal(archive.archive_controls.contains_raw_response, false);
  assert.equal(archive.archive_controls.contains_secret_material, false);
  assert.equal(archive.archive_controls.runtime_invocation_disabled, true);
  assert.equal(archive.archive_items.length, 4);
  assert.equal(archive.archive_items.every((item) => item.item_state === "archived" && item.archived_now === false && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(archive.execution_boundary);
});

test("VO-7AY-ARCHIVE-2: blocked closeout inputs block archive", () => {
  const archive = createRuntimeStubArchive(blockedCloseoutSafeReport(), blockedCloseout());

  assert.equal(archive.archive_state, "blocked");
  assert.equal(archive.validation.complete, false);
  assert.equal(archive.validation.ready_for_next_phase, false);
  assert.equal(archive.validation.blocking_reasons.length > 0, true);
  assert.equal(archive.archive_items.every((item) => item.item_state === "blocked"), true);
  assertDisabledBoundary(archive.execution_boundary);
});

test("VO-7AY-ARCHIVE-3: archive review passes without archiving now, runtime execution, or real-upload readiness", () => {
  const closeout = readyCloseout();
  const archive = createRuntimeStubArchive(readyCloseoutSafeReport(), closeout);
  const review = createRuntimeStubArchiveReview(archive, closeout, { id: "runtime-stub-archive-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.archive_review_state, "approved_for_future_archive_final_summary");
  assert.equal(review.review_scope.artifact_only, true);
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.archive_reviewed, true);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_items.length, 4);
  assert.equal(review.review_items.every((item) => item.review_state === "passed" && item.archived_now === false && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AY-ARCHIVE-4: blocked archive blocks review", () => {
  const closeout = blockedCloseout();
  const archive = createRuntimeStubArchive(blockedCloseoutSafeReport(), closeout);
  const review = createRuntimeStubArchiveReview(archive, closeout);

  assert.equal(review.archive_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_items.every((item) => item.review_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7AY-ARCHIVE-5: archive final summary completes sequence without real-upload readiness", () => {
  const closeout = readyCloseout();
  const archive = createRuntimeStubArchive(readyCloseoutSafeReport(), closeout);
  const review = createRuntimeStubArchiveReview(archive, closeout);
  const summary = createRuntimeStubArchiveFinalSummary(review, archive, { id: "runtime-stub-archive-final-summary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.final_summary_state, "runtime_stub_sequence_complete");
  assert.equal(summary.final_summary_scope.artifact_only, true);
  assert.equal(summary.final_summary_scope.future_next_phase_requested, false);
  assert.equal(summary.final_summary_controls.final_summary_only, true);
  assert.equal(summary.final_summary_controls.runtime_stub_sequence_only, true);
  assert.equal(summary.final_summary_controls.contains_runtime_callable, false);
  assert.equal(summary.final_summary_sections.length, 4);
  assert.equal(summary.final_summary_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false && section.ready_for_real_upload_now === false), true);
  assert.equal(summary.validation.ready_for_next_phase, false);
  assert.equal(summary.validation.ready_for_real_upload, false);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AY-ARCHIVE-6: blocked archive review blocks final summary", () => {
  const closeout = blockedCloseout();
  const archive = createRuntimeStubArchive(blockedCloseoutSafeReport(), closeout);
  const review = createRuntimeStubArchiveReview(archive, closeout);
  const summary = createRuntimeStubArchiveFinalSummary(review, archive);

  assert.equal(summary.final_summary_state, "blocked");
  assert.equal(summary.validation.complete, false);
  assert.equal(summary.validation.ready_for_next_phase, false);
  assert.equal(summary.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(summary.execution_boundary);
});

test("VO-7AY-SAFETY-7: unsafe strings are sanitized from archive artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const closeout = readyCloseout();
  const archive = createRuntimeStubArchive(readyCloseoutSafeReport(), closeout, { id: unsafe, created_at: unsafe });
  const review = createRuntimeStubArchiveReview(archive, closeout, { id: unsafe, created_at: unsafe });
  const summary = createRuntimeStubArchiveFinalSummary(review, archive, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ archive, review, summary });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7AY-SAFETY-8: revocation keeps archive artifacts disabled", () => {
  const closeout = readyCloseout();
  const archive = createRuntimeStubArchive(readyCloseoutSafeReport(), closeout);
  const review = createRuntimeStubArchiveReview(archive, closeout);
  const summary = createRuntimeStubArchiveFinalSummary(review, archive);
  const revokedArchive = revokeRuntimeStubArchive(archive, "Operator revoked archive.");
  const revokedReview = revokeRuntimeStubArchiveReview(review, "Operator revoked archive review.");
  const revokedSummary = revokeRuntimeStubArchiveFinalSummary(summary, "Operator revoked archive final summary.");

  assert.equal(revokedArchive.archive_state, "revoked");
  assert.equal(revokedArchive.validation.complete, false);
  assert.equal(revokedArchive.validation.ready_for_next_phase, false);
  assert.equal(revokedArchive.archive_items.every((item) => item.item_state === "blocked"), true);
  assert.equal(revokedArchive.provenance.generated_by, "revokeRuntimeStubArchive");
  assertDisabledBoundary(revokedArchive.execution_boundary);

  assert.equal(revokedReview.archive_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_items.every((item) => item.review_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeStubArchiveReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedSummary.final_summary_state, "revoked");
  assert.equal(revokedSummary.validation.complete, false);
  assert.equal(revokedSummary.validation.ready_for_next_phase, false);
  assert.equal(revokedSummary.provenance.generated_by, "revokeRuntimeStubArchiveFinalSummary");
  assertDisabledBoundary(revokedSummary.execution_boundary);
});
