import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeStubSequenceIndex,
  createRuntimeStubOperatorHandoffChecklist,
  createRuntimeStubNextPhaseDecisionRecord,
  revokeRuntimeStubSequenceIndex,
  revokeRuntimeStubOperatorHandoffChecklist,
  revokeRuntimeStubNextPhaseDecisionRecord,
} from "./runtime-stub-sequence-handoff.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubArchiveFinalSummary } from "./runtime-stub-archive.js";
import type { RuntimeStubSequenceFinalHandoff } from "./runtime-stub-sequence-integrity.js";

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

function readyArchiveFinalSummary(): RuntimeStubArchiveFinalSummary {
  return {
    schema_version: "1.0",
    runtime_stub_archive_final_summary_id: "runtime-stub-archive-final-summary-001",
    runtime_stub_archive_review_id: "runtime-stub-archive-review-001",
    runtime_stub_archive_id: "runtime-stub-archive-001",
    runtime_stub_closeout_id: "runtime-stub-closeout-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    final_summary_state: "runtime_stub_sequence_complete",
    required_artifacts: { runtime_stub_archive_review_validated: true, runtime_stub_archive_validated: true },
    final_summary_scope: {
      artifact_only: true,
      future_next_phase_requested: false,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    final_summary_controls: {
      final_summary_only: true,
      runtime_stub_sequence_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    final_summary_sections: [
      { section_id: "archive-final-summary-archive", section_kind: "archive", safe_summary: "Runtime stub archive summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-review", section_kind: "review", safe_summary: "Runtime stub archive review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "archive-final-summary-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: false, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubArchiveFinalSummary", source_runtime_stub_archive_review_id: "runtime-stub-archive-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyFinalHandoff(): RuntimeStubSequenceFinalHandoff {
  return {
    schema_version: "1.0",
    runtime_stub_sequence_final_handoff_id: "runtime-stub-sequence-final-handoff-001",
    runtime_stub_sequence_regression_report_id: "runtime-stub-sequence-regression-report-001",
    runtime_stub_sequence_integrity_audit_id: "runtime-stub-sequence-integrity-audit-001",
    runtime_stub_archive_final_summary_id: "runtime-stub-archive-final-summary-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    handoff_state: "runtime_stub_sequence_handed_off",
    required_artifacts: { runtime_stub_sequence_regression_report_validated: true, runtime_stub_sequence_integrity_audit_validated: true },
    handoff_scope: {
      artifact_only: true,
      future_next_phase_requested: false,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    handoff_controls: {
      handoff_only: true,
      sequence_handoff_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    handoff_sections: [
      { section_id: "handoff-integrity-audit", section_kind: "integrity_audit", safe_summary: "Integrity audit handed off only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "handoff-regression-report", section_kind: "regression_report", safe_summary: "Regression report handed off only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "handoff-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
      { section_id: "handoff-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: false, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubSequenceFinalHandoff", source_runtime_stub_sequence_regression_report_id: "runtime-stub-sequence-regression-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedArchiveFinalSummary(): RuntimeStubArchiveFinalSummary {
  return { ...readyArchiveFinalSummary(), final_summary_state: "blocked", validation: { ...readyArchiveFinalSummary().validation, complete: false, blocking_reasons: ["Archive final summary blocked."] } };
}

function blockedFinalHandoff(): RuntimeStubSequenceFinalHandoff {
  return { ...readyFinalHandoff(), handoff_state: "blocked", validation: { ...readyFinalHandoff().validation, complete: false, blocking_reasons: ["Final handoff blocked."] } };
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

test("VO-7BA-HANDOFF-1: sequence index summarizes artifacts without callables, raw payloads, secrets, or real-upload readiness", () => {
  const index = createRuntimeStubSequenceIndex(readyFinalHandoff(), readyArchiveFinalSummary(), { id: "runtime-stub-sequence-index-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(index.schema_version, "1.0");
  assert.equal(index.index_state, "approved_for_future_operator_handoff_checklist");
  assert.equal(index.index_scope.artifact_only, true);
  assert.equal(index.index_controls.index_only, true);
  assert.equal(index.index_controls.operator_summary_only, true);
  assert.equal(index.index_controls.contains_runtime_callable, false);
  assert.equal(index.indexed_artifacts.length, 6);
  assert.equal(index.indexed_artifacts.every((artifact) => artifact.contains_runtime_callable === false && artifact.contains_raw_payload === false && artifact.contains_secret_material === false && artifact.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(index.execution_boundary);
});

test("VO-7BA-HANDOFF-2: blocked final handoff inputs block sequence index", () => {
  const index = createRuntimeStubSequenceIndex(blockedFinalHandoff(), blockedArchiveFinalSummary());

  assert.equal(index.index_state, "blocked");
  assert.equal(index.validation.complete, false);
  assert.equal(index.validation.ready_for_next_phase, false);
  assert.equal(index.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(index.execution_boundary);
});

test("VO-7BA-HANDOFF-3: operator handoff checklist is checked without requiring action now", () => {
  const handoff = readyFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, readyArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff, { id: "runtime-stub-operator-handoff-checklist-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(checklist.schema_version, "1.0");
  assert.equal(checklist.checklist_state, "approved_for_future_next_phase_decision_record");
  assert.equal(checklist.checklist_scope.artifact_only, true);
  assert.equal(checklist.checklist_controls.checklist_only, true);
  assert.equal(checklist.checklist_controls.operator_handoff_only, true);
  assert.equal(checklist.checklist_controls.contains_runtime_callable, false);
  assert.equal(checklist.checklist_items.length, 5);
  assert.equal(checklist.checklist_items.every((item) => item.item_state === "checked" && item.operator_action_required_now === false && item.runtime_executed_now === false && item.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7BA-HANDOFF-4: blocked sequence index blocks operator handoff checklist", () => {
  const handoff = blockedFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, blockedArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff);

  assert.equal(checklist.checklist_state, "blocked");
  assert.equal(checklist.validation.complete, false);
  assert.equal(checklist.validation.ready_for_next_phase, false);
  assert.equal(checklist.checklist_items.every((item) => item.item_state === "blocked"), true);
  assertDisabledBoundary(checklist.execution_boundary);
});

test("VO-7BA-HANDOFF-5: next phase decision records future design without enabling runtime or real upload", () => {
  const handoff = readyFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, readyArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff);
  const decision = createRuntimeStubNextPhaseDecisionRecord(checklist, index, { id: "runtime-stub-next-phase-decision-record-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(decision.schema_version, "1.0");
  assert.equal(decision.decision_state, "approved_for_future_explicit_runtime_activation_design");
  assert.equal(decision.decision_scope.artifact_only, true);
  assert.equal(decision.decision_scope.future_next_phase_requested, true);
  assert.equal(decision.decision_controls.decision_record_only, true);
  assert.equal(decision.decision_controls.future_phase_only, true);
  assert.equal(decision.decision_options.length, 3);
  assert.equal(decision.decision_options.every((option) => option.would_enable_runtime_now === false && option.would_enable_real_upload_now === false), true);
  assert.equal(decision.selected_decision.decision_kind, "document_future_activation_design");
  assert.equal(decision.selected_decision.runtime_enabled_now, false);
  assert.equal(decision.selected_decision.ready_for_real_upload_now, false);
  assert.equal(decision.validation.ready_for_real_upload, false);
  assertDisabledBoundary(decision.execution_boundary);
});

test("VO-7BA-HANDOFF-6: defer decision is recorded without requesting a future next phase", () => {
  const handoff = readyFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, readyArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff);
  const decision = createRuntimeStubNextPhaseDecisionRecord(checklist, index, { decisionKind: "defer" });

  assert.equal(decision.decision_state, "deferred");
  assert.equal(decision.decision_scope.future_next_phase_requested, false);
  assert.equal(decision.selected_decision.decision_kind, "defer");
  assert.equal(decision.selected_decision.runtime_enabled_now, false);
  assert.equal(decision.selected_decision.ready_for_real_upload_now, false);
  assertDisabledBoundary(decision.execution_boundary);
});

test("VO-7BA-HANDOFF-7: blocked checklist blocks next phase decision record", () => {
  const handoff = blockedFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, blockedArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff);
  const decision = createRuntimeStubNextPhaseDecisionRecord(checklist, index);

  assert.equal(decision.decision_state, "blocked");
  assert.equal(decision.validation.complete, false);
  assert.equal(decision.validation.ready_for_next_phase, false);
  assert.equal(decision.selected_decision.decision_kind, "blocked");
  assertDisabledBoundary(decision.execution_boundary);
});

test("VO-7BA-SAFETY-8: unsafe strings are sanitized from handoff artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const handoff = readyFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, readyArchiveFinalSummary(), { id: unsafe, created_at: unsafe });
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff, { id: unsafe, created_at: unsafe });
  const decision = createRuntimeStubNextPhaseDecisionRecord(checklist, index, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ index, checklist, decision });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BA-SAFETY-9: revocation keeps handoff artifacts disabled", () => {
  const handoff = readyFinalHandoff();
  const index = createRuntimeStubSequenceIndex(handoff, readyArchiveFinalSummary());
  const checklist = createRuntimeStubOperatorHandoffChecklist(index, handoff);
  const decision = createRuntimeStubNextPhaseDecisionRecord(checklist, index);
  const revokedIndex = revokeRuntimeStubSequenceIndex(index, "Operator revoked sequence index.");
  const revokedChecklist = revokeRuntimeStubOperatorHandoffChecklist(checklist, "Operator revoked handoff checklist.");
  const revokedDecision = revokeRuntimeStubNextPhaseDecisionRecord(decision, "Operator revoked next phase decision record.");

  assert.equal(revokedIndex.index_state, "revoked");
  assert.equal(revokedIndex.validation.complete, false);
  assert.equal(revokedIndex.validation.ready_for_next_phase, false);
  assert.equal(revokedIndex.provenance.generated_by, "revokeRuntimeStubSequenceIndex");
  assertDisabledBoundary(revokedIndex.execution_boundary);

  assert.equal(revokedChecklist.checklist_state, "revoked");
  assert.equal(revokedChecklist.validation.complete, false);
  assert.equal(revokedChecklist.validation.ready_for_next_phase, false);
  assert.equal(revokedChecklist.checklist_items.every((item) => item.item_state === "blocked"), true);
  assert.equal(revokedChecklist.provenance.generated_by, "revokeRuntimeStubOperatorHandoffChecklist");
  assertDisabledBoundary(revokedChecklist.execution_boundary);

  assert.equal(revokedDecision.decision_state, "revoked");
  assert.equal(revokedDecision.validation.complete, false);
  assert.equal(revokedDecision.validation.ready_for_next_phase, false);
  assert.equal(revokedDecision.selected_decision.decision_kind, "blocked");
  assert.equal(revokedDecision.provenance.generated_by, "revokeRuntimeStubNextPhaseDecisionRecord");
  assertDisabledBoundary(revokedDecision.execution_boundary);
});
