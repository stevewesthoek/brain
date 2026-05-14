import { test } from "node:test";
import assert from "node:assert";
import {
  createExplicitRuntimeActivationDesignBoundary,
  createExplicitRuntimeActivationDesignReview,
  createExplicitRuntimeActivationDesignSafeReport,
  revokeExplicitRuntimeActivationDesignBoundary,
  revokeExplicitRuntimeActivationDesignReview,
  revokeExplicitRuntimeActivationDesignSafeReport,
} from "./explicit-runtime-activation-design.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeStubNextPhaseDecisionRecord, RuntimeStubOperatorHandoffChecklist } from "./runtime-stub-sequence-handoff.js";

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

function readyChecklist(): RuntimeStubOperatorHandoffChecklist {
  return {
    schema_version: "1.0",
    runtime_stub_operator_handoff_checklist_id: "runtime-stub-operator-handoff-checklist-001",
    runtime_stub_sequence_index_id: "runtime-stub-sequence-index-001",
    runtime_stub_sequence_final_handoff_id: "runtime-stub-sequence-final-handoff-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    checklist_state: "approved_for_future_next_phase_decision_record",
    required_artifacts: { runtime_stub_sequence_index_validated: true, runtime_stub_sequence_final_handoff_validated: true },
    checklist_scope: {
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
    checklist_controls: {
      checklist_only: true,
      operator_handoff_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    checklist_items: [
      { item_id: "check-index", item_kind: "index", item_state: "checked", safe_summary: "Sequence index available for operator review.", operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "check-final-handoff", item_kind: "final_handoff", item_state: "checked", safe_summary: "Final handoff available for operator review.", operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "check-boundaries", item_kind: "boundaries", item_state: "checked", safe_summary: "Runtime invocation remains disabled.", operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "check-real-upload", item_kind: "real_upload", item_state: "checked", safe_summary: "Real upload remains disabled.", operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
      { item_id: "check-next-phase", item_kind: "next_phase", item_state: "checked", safe_summary: "Future phase requires separate decision record.", operator_action_required_now: false, runtime_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubOperatorHandoffChecklist", source_runtime_stub_sequence_index_id: "runtime-stub-sequence-index-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyDecisionRecord(): RuntimeStubNextPhaseDecisionRecord {
  return {
    schema_version: "1.0",
    runtime_stub_next_phase_decision_record_id: "runtime-stub-next-phase-decision-record-001",
    runtime_stub_operator_handoff_checklist_id: "runtime-stub-operator-handoff-checklist-001",
    runtime_stub_sequence_index_id: "runtime-stub-sequence-index-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    decision_state: "approved_for_future_explicit_runtime_activation_design",
    required_artifacts: { runtime_stub_operator_handoff_checklist_validated: true, runtime_stub_sequence_index_validated: true },
    decision_scope: {
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
    decision_controls: {
      decision_record_only: true,
      future_phase_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    decision_options: [
      { option_id: "decision-defer", option_kind: "defer", safe_summary: "Defer future runtime activation design.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
      { option_id: "decision-document-future-design", option_kind: "document_future_activation_design", safe_summary: "Document a future explicit runtime activation design only.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
      { option_id: "decision-stop-track", option_kind: "stop_runtime_stub_track", safe_summary: "Stop the runtime stub track after handoff.", would_enable_runtime_now: false, would_enable_real_upload_now: false },
    ],
    selected_decision: { decision_id: "selected-document-future-design", decision_kind: "document_future_activation_design", safe_summary: "Proceed only to a future explicit activation design artifact. Do not enable runtime or real upload now.", runtime_enabled_now: false, ready_for_real_upload_now: false },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeStubNextPhaseDecisionRecord", source_runtime_stub_operator_handoff_checklist_id: "runtime-stub-operator-handoff-checklist-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedChecklist(): RuntimeStubOperatorHandoffChecklist {
  return { ...readyChecklist(), checklist_state: "blocked", validation: { ...readyChecklist().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Checklist blocked."] } };
}

function blockedDecisionRecord(): RuntimeStubNextPhaseDecisionRecord {
  return { ...readyDecisionRecord(), decision_state: "blocked", validation: { ...readyDecisionRecord().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Decision blocked."] }, selected_decision: { ...readyDecisionRecord().selected_decision, decision_kind: "blocked" } };
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

test("VO-7BB-DESIGN-1: explicit runtime activation design boundary is design-only", () => {
  const boundary = createExplicitRuntimeActivationDesignBoundary(readyDecisionRecord(), readyChecklist(), { id: "explicit-runtime-activation-design-boundary-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(boundary.schema_version, "1.0");
  assert.equal(boundary.design_boundary_state, "approved_for_future_design_review");
  assert.equal(boundary.design_controls.design_only, true);
  assert.equal(boundary.design_controls.activation_boundary_only, true);
  assert.equal(boundary.design_controls.runtime_wiring_implemented, false);
  assert.equal(boundary.design_controls.contains_runtime_callable, false);
  assert.equal(boundary.design_controls.contains_raw_payload, false);
  assert.equal(boundary.design_controls.contains_raw_response, false);
  assert.equal(boundary.design_controls.contains_secret_material, false);
  assert.equal(boundary.design_sections.length, 4);
  assert.equal(boundary.design_sections.every((section) => section.runtime_enabled_now === false && section.ready_for_real_upload_now === false && section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_secret_material === false), true);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7BB-DESIGN-2: blocked decision or checklist blocks design boundary", () => {
  const boundary = createExplicitRuntimeActivationDesignBoundary(blockedDecisionRecord(), blockedChecklist());

  assert.equal(boundary.design_boundary_state, "blocked");
  assert.equal(boundary.validation.complete, false);
  assert.equal(boundary.validation.ready_for_next_phase, false);
  assert.equal(boundary.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(boundary.execution_boundary);
});

test("VO-7BB-DESIGN-3: design review passes without runtime enablement", () => {
  const decision = readyDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, readyChecklist());
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision, { id: "explicit-runtime-activation-design-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.design_review_state, "approved_for_future_design_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.design_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.contains_runtime_callable, false);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BB-DESIGN-4: blocked design boundary blocks review", () => {
  const decision = blockedDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, blockedChecklist());
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision);

  assert.equal(review.design_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BB-DESIGN-5: design safe report contains no callable, payload, response, or secrets", () => {
  const decision = readyDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, readyChecklist());
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision);
  const report = createExplicitRuntimeActivationDesignSafeReport(review, boundary, { id: "explicit-runtime-activation-design-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_contract");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.activation_design_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_payload === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_raw_response === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BB-DESIGN-6: blocked design review blocks safe report", () => {
  const decision = blockedDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, blockedChecklist());
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision);
  const report = createExplicitRuntimeActivationDesignSafeReport(review, boundary);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BB-SAFETY-7: unsafe strings are sanitized from design artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const decision = readyDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, readyChecklist(), { id: unsafe, created_at: unsafe });
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision, { id: unsafe, created_at: unsafe });
  const report = createExplicitRuntimeActivationDesignSafeReport(review, boundary, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ boundary, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BB-SAFETY-8: revocation keeps design artifacts disabled", () => {
  const decision = readyDecisionRecord();
  const boundary = createExplicitRuntimeActivationDesignBoundary(decision, readyChecklist());
  const review = createExplicitRuntimeActivationDesignReview(boundary, decision);
  const report = createExplicitRuntimeActivationDesignSafeReport(review, boundary);
  const revokedBoundary = revokeExplicitRuntimeActivationDesignBoundary(boundary, "Operator revoked design boundary.");
  const revokedReview = revokeExplicitRuntimeActivationDesignReview(review, "Operator revoked design review.");
  const revokedReport = revokeExplicitRuntimeActivationDesignSafeReport(report, "Operator revoked design safe report.");

  assert.equal(revokedBoundary.design_boundary_state, "revoked");
  assert.equal(revokedBoundary.validation.complete, false);
  assert.equal(revokedBoundary.validation.ready_for_next_phase, false);
  assert.equal(revokedBoundary.provenance.generated_by, "revokeExplicitRuntimeActivationDesignBoundary");
  assertDisabledBoundary(revokedBoundary.execution_boundary);

  assert.equal(revokedReview.design_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeExplicitRuntimeActivationDesignReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeExplicitRuntimeActivationDesignSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
