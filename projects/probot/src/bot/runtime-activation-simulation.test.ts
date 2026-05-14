import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationSimulationContract,
  createRuntimeActivationSimulationReview,
  createRuntimeActivationSimulationSafeReport,
  revokeRuntimeActivationSimulationContract,
  revokeRuntimeActivationSimulationReview,
  revokeRuntimeActivationSimulationSafeReport,
} from "./runtime-activation-simulation.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationDryRunDesign, RuntimeActivationDryRunDesignSafeReport } from "./runtime-activation-dry-run-design.js";

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

function readyDryRunDesign(): RuntimeActivationDryRunDesign {
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_design_id: "runtime-activation-dry-run-design-001",
    runtime_activation_dry_run_safe_report_id: "runtime-activation-dry-run-safe-report-001",
    runtime_activation_dry_run_contract_id: "runtime-activation-dry-run-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    dry_run_design_state: "approved_for_future_dry_run_design_review",
    required_artifacts: { runtime_activation_dry_run_safe_report_validated: true, runtime_activation_dry_run_contract_validated: true },
    design_scope: {
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
    design_controls: {
      design_only: true,
      dry_run_design_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      dry_run_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    design_sections: [
      { section_id: "dry-run-design-scope", section_kind: "scope", safe_summary: "Dry-run design scope only; no runtime enabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { section_id: "dry-run-design-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { section_id: "dry-run-design-credentials", section_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { section_id: "dry-run-design-status", section_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationDryRunDesign", source_runtime_activation_dry_run_safe_report_id: "runtime-activation-dry-run-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readyDryRunDesignSafeReport(): RuntimeActivationDryRunDesignSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_dry_run_design_safe_report_id: "runtime-activation-dry-run-design-safe-report-001",
    runtime_activation_dry_run_design_review_id: "runtime-activation-dry-run-design-review-001",
    runtime_activation_dry_run_design_id: "runtime-activation-dry-run-design-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_simulation_contract",
    required_artifacts: { runtime_activation_dry_run_design_review_validated: true, runtime_activation_dry_run_design_validated: true },
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
      dry_run_design_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      dry_run_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "dry-run-design-safe-report-design", section_kind: "design", safe_summary: "Runtime activation dry-run design summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-design-safe-report-review", section_kind: "review", safe_summary: "Runtime activation dry-run design review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-design-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "dry-run-design-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, dry_run_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationDryRunDesignSafeReport", source_runtime_activation_dry_run_design_review_id: "runtime-activation-dry-run-design-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedDryRunDesign(): RuntimeActivationDryRunDesign {
  return { ...readyDryRunDesign(), dry_run_design_state: "blocked", validation: { ...readyDryRunDesign().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Dry-run design blocked."] } };
}

function blockedDryRunDesignSafeReport(): RuntimeActivationDryRunDesignSafeReport {
  return { ...readyDryRunDesignSafeReport(), safe_report_state: "blocked", validation: { ...readyDryRunDesignSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Dry-run design safe report blocked."] } };
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

test("VO-7BG-SIMULATION-1: runtime activation simulation contract is simulation-only and does not execute", () => {
  const contract = createRuntimeActivationSimulationContract(readyDryRunDesignSafeReport(), readyDryRunDesign(), { id: "runtime-activation-simulation-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.simulation_contract_state, "approved_for_future_simulation_review");
  assert.equal(contract.simulation_controls.simulation_contract_only, true);
  assert.equal(contract.simulation_controls.simulation_only, true);
  assert.equal(contract.simulation_controls.runtime_wiring_implemented, false);
  assert.equal(contract.simulation_controls.simulation_execution_disabled, true);
  assert.equal(contract.simulation_terms.length, 4);
  assert.equal(contract.simulation_terms.every((term) => term.runtime_enabled_now === false && term.simulation_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BG-SIMULATION-2: blocked dry-run design inputs block simulation contract", () => {
  const contract = createRuntimeActivationSimulationContract(blockedDryRunDesignSafeReport(), blockedDryRunDesign());

  assert.equal(contract.simulation_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BG-SIMULATION-3: runtime activation simulation review remains review-only and does not execute", () => {
  const safeReport = readyDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, readyDryRunDesign());
  const review = createRuntimeActivationSimulationReview(contract, safeReport, { id: "runtime-activation-simulation-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.simulation_review_state, "approved_for_future_simulation_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.simulation_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.simulation_execution_disabled, true);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.simulation_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BG-SIMULATION-4: blocked simulation contract blocks simulation review", () => {
  const safeReport = blockedDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, blockedDryRunDesign());
  const review = createRuntimeActivationSimulationReview(contract, safeReport);

  assert.equal(review.simulation_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BG-SIMULATION-5: simulation safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const safeReport = readyDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, readyDryRunDesign());
  const review = createRuntimeActivationSimulationReview(contract, safeReport);
  const report = createRuntimeActivationSimulationSafeReport(review, contract, { id: "runtime-activation-simulation-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_rehearsal_contract");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.simulation_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.simulation_execution_disabled, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.simulation_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BG-SIMULATION-6: blocked simulation review blocks safe report", () => {
  const safeReport = blockedDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, blockedDryRunDesign());
  const review = createRuntimeActivationSimulationReview(contract, safeReport);
  const report = createRuntimeActivationSimulationSafeReport(review, contract);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BG-SAFETY-7: unsafe strings are sanitized from simulation artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const safeReport = readyDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, readyDryRunDesign(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationSimulationReview(contract, safeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationSimulationSafeReport(review, contract, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ contract, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BG-SAFETY-8: revocation keeps simulation artifacts disabled", () => {
  const safeReport = readyDryRunDesignSafeReport();
  const contract = createRuntimeActivationSimulationContract(safeReport, readyDryRunDesign());
  const review = createRuntimeActivationSimulationReview(contract, safeReport);
  const report = createRuntimeActivationSimulationSafeReport(review, contract);
  const revokedContract = revokeRuntimeActivationSimulationContract(contract, "Operator revoked runtime activation simulation contract.");
  const revokedReview = revokeRuntimeActivationSimulationReview(review, "Operator revoked runtime activation simulation review.");
  const revokedReport = revokeRuntimeActivationSimulationSafeReport(report, "Operator revoked runtime activation simulation safe report.");

  assert.equal(revokedContract.simulation_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeActivationSimulationContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.simulation_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationSimulationReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationSimulationSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
