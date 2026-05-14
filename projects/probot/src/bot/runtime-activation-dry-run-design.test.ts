import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationDryRunDesign,
  createRuntimeActivationDryRunDesignReview,
  createRuntimeActivationDryRunDesignSafeReport,
  revokeRuntimeActivationDryRunDesign,
  revokeRuntimeActivationDryRunDesignReview,
  revokeRuntimeActivationDryRunDesignSafeReport,
} from "./runtime-activation-dry-run-design.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationDryRunContract, RuntimeActivationDryRunSafeReport } from "./runtime-activation-dry-run.js";

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

function readyDryRunContract(): RuntimeActivationDryRunContract {
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_contract_id: "runtime-activation-dry-run-contract-001",
    runtime_activation_readiness_safe_report_id: "runtime-activation-readiness-safe-report-001",
    runtime_activation_readiness_contract_id: "runtime-activation-readiness-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    dry_run_contract_state: "approved_for_future_dry_run_review",
    required_artifacts: { runtime_activation_readiness_safe_report_validated: true, runtime_activation_readiness_contract_validated: true },
    dry_run_scope: {
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
    dry_run_controls: {
      dry_run_contract_only: true,
      dry_run_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    dry_run_terms: [
      { term_id: "dry-run-contract-scope", term_kind: "scope", safe_summary: "Dry-run contract scope only; no runtime enabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "dry-run-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "dry-run-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "dry-run-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationDryRunContract", source_runtime_activation_readiness_safe_report_id: "runtime-activation-readiness-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyDryRunSafeReport(): RuntimeActivationDryRunSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_safe_report_id: "runtime-activation-dry-run-safe-report-001",
    runtime_activation_dry_run_review_id: "runtime-activation-dry-run-review-001",
    runtime_activation_dry_run_contract_id: "runtime-activation-dry-run-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_dry_run_design",
    required_artifacts: { runtime_activation_dry_run_review_validated: true, runtime_activation_dry_run_contract_validated: true },
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
    report_controls: {
      safe_report_only: true,
      dry_run_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "dry-run-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation dry-run contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-safe-report-review", section_kind: "review", safe_summary: "Runtime activation dry-run review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationDryRunSafeReport", source_runtime_activation_dry_run_review_id: "runtime-activation-dry-run-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedDryRunContract(): RuntimeActivationDryRunContract {
  return { ...readyDryRunContract(), dry_run_contract_state: "blocked", validation: { ...readyDryRunContract().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Dry-run contract blocked."] } };
}

function blockedDryRunSafeReport(): RuntimeActivationDryRunSafeReport {
  return { ...readyDryRunSafeReport(), safe_report_state: "blocked", validation: { ...readyDryRunSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Dry-run safe report blocked."] } };
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

test("VO-7BF-DRY-RUN-DESIGN-1: runtime activation dry-run design is design-only and does not execute", () => {
  const design = createRuntimeActivationDryRunDesign(readyDryRunSafeReport(), readyDryRunContract(), { id: "runtime-activation-dry-run-design-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(design.schema_version, "1.0");
  assert.equal(design.dry_run_design_state, "approved_for_future_dry_run_design_review");
  assert.equal(design.design_controls.design_only, true);
  assert.equal(design.design_controls.dry_run_design_only, true);
  assert.equal(design.design_controls.runtime_wiring_implemented, false);
  assert.equal(design.design_controls.dry_run_execution_disabled, true);
  assert.equal(design.design_sections.length, 4);
  assert.equal(design.design_sections.every((section) => section.runtime_enabled_now === false && section.dry_run_executed_now === false && section.ready_for_real_upload_now === false && section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_secret_material === false), true);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7BF-DRY-RUN-DESIGN-2: blocked dry-run inputs block dry-run design", () => {
  const design = createRuntimeActivationDryRunDesign(blockedDryRunSafeReport(), blockedDryRunContract());

  assert.equal(design.dry_run_design_state, "blocked");
  assert.equal(design.validation.complete, false);
  assert.equal(design.validation.ready_for_next_phase, false);
  assert.equal(design.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7BF-DRY-RUN-DESIGN-3: dry-run design review remains review-only and does not execute", () => {
  const safeReport = readyDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, readyDryRunContract());
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport, { id: "runtime-activation-dry-run-design-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.dry_run_design_review_state, "approved_for_future_dry_run_design_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.dry_run_design_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.dry_run_execution_disabled, true);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.dry_run_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BF-DRY-RUN-DESIGN-4: blocked dry-run design blocks design review", () => {
  const safeReport = blockedDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, blockedDryRunContract());
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport);

  assert.equal(review.dry_run_design_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BF-DRY-RUN-DESIGN-5: dry-run design safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const safeReport = readyDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, readyDryRunContract());
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport);
  const report = createRuntimeActivationDryRunDesignSafeReport(review, design, { id: "runtime-activation-dry-run-design-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_simulation_contract");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.dry_run_design_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.dry_run_execution_disabled, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.dry_run_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BF-DRY-RUN-DESIGN-6: blocked dry-run design review blocks safe report", () => {
  const safeReport = blockedDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, blockedDryRunContract());
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport);
  const report = createRuntimeActivationDryRunDesignSafeReport(review, design);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BF-SAFETY-7: unsafe strings are sanitized from dry-run design artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, readyDryRunContract(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationDryRunDesignSafeReport(review, design, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ design, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BF-SAFETY-8: revocation keeps dry-run design artifacts disabled", () => {
  const safeReport = readyDryRunSafeReport();
  const design = createRuntimeActivationDryRunDesign(safeReport, readyDryRunContract());
  const review = createRuntimeActivationDryRunDesignReview(design, safeReport);
  const report = createRuntimeActivationDryRunDesignSafeReport(review, design);
  const revokedDesign = revokeRuntimeActivationDryRunDesign(design, "Operator revoked runtime activation dry-run design.");
  const revokedReview = revokeRuntimeActivationDryRunDesignReview(review, "Operator revoked runtime activation dry-run design review.");
  const revokedReport = revokeRuntimeActivationDryRunDesignSafeReport(report, "Operator revoked runtime activation dry-run design safe report.");

  assert.equal(revokedDesign.dry_run_design_state, "revoked");
  assert.equal(revokedDesign.validation.complete, false);
  assert.equal(revokedDesign.validation.ready_for_next_phase, false);
  assert.equal(revokedDesign.provenance.generated_by, "revokeRuntimeActivationDryRunDesign");
  assertDisabledBoundary(revokedDesign.execution_boundary);

  assert.equal(revokedReview.dry_run_design_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationDryRunDesignReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationDryRunDesignSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
