import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeActivationRehearsalContract,
  createRuntimeActivationRehearsalReview,
  createRuntimeActivationRehearsalSafeReport,
  revokeRuntimeActivationRehearsalContract,
  revokeRuntimeActivationRehearsalReview,
  revokeRuntimeActivationRehearsalSafeReport,
} from "./runtime-activation-rehearsal.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { RuntimeActivationSimulationContract, RuntimeActivationSimulationSafeReport } from "./runtime-activation-simulation.js";

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

function readySimulationContract(): RuntimeActivationSimulationContract {
  return {
    schema_version: "1.0",
    runtime_activation_simulation_contract_id: "runtime-activation-simulation-contract-001",
    runtime_activation_dry_run_design_safe_report_id: "runtime-activation-dry-run-design-safe-report-001",
    runtime_activation_dry_run_design_id: "runtime-activation-dry-run-design-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    simulation_contract_state: "approved_for_future_simulation_review",
    required_artifacts: { runtime_activation_dry_run_design_safe_report_validated: true, runtime_activation_dry_run_design_validated: true },
    simulation_scope: {
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
    simulation_controls: {
      simulation_contract_only: true,
      simulation_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      simulation_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    simulation_terms: [
      { term_id: "simulation-contract-scope", term_kind: "scope", safe_summary: "Simulation contract scope only; no runtime enabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "simulation-contract-boundaries", term_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "simulation-contract-credentials", term_kind: "credentials", safe_summary: "Credentials remain inaccessible.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
      { term_id: "simulation-contract-status", term_kind: "status", safe_summary: "Real upload remains disabled.", runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false, contains_runtime_callable: false, contains_raw_payload: false, contains_secret_material: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationSimulationContract", source_runtime_activation_dry_run_design_safe_report_id: "runtime-activation-dry-run-design-safe-report-001", source_render_plan_id: "render-plan-001" },
  };
}

function readySimulationSafeReport(): RuntimeActivationSimulationSafeReport {
  return {
    schema_version: "1.0",
    runtime_activation_simulation_safe_report_id: "runtime-activation-simulation-safe-report-001",
    runtime_activation_simulation_review_id: "runtime-activation-simulation-review-001",
    runtime_activation_simulation_contract_id: "runtime-activation-simulation-contract-001",
    render_plan_id: "render-plan-001",
    project_id: "project-001",
    platform: "youtube",
    created_at: "2026-05-14T00:00:00.000Z",
    safe_report_state: "approved_for_future_runtime_activation_rehearsal_contract",
    required_artifacts: { runtime_activation_simulation_review_validated: true, runtime_activation_simulation_contract_validated: true },
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
      simulation_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_wiring_implemented: false,
      runtime_invocation_disabled: true,
      simulation_execution_disabled: true,
      real_upload_still_blocked: true,
    },
    safe_report_sections: [
      { section_id: "simulation-safe-report-contract", section_kind: "contract", safe_summary: "Runtime activation simulation contract summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "simulation-safe-report-review", section_kind: "review", safe_summary: "Runtime activation simulation review summarized only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "simulation-safe-report-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
      { section_id: "simulation-safe-report-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_enabled_now: false, simulation_executed_now: false, ready_for_real_upload_now: false },
    ],
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete: true, ready_for_next_phase: true, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: [], warnings: [] },
    provenance: { generated_by: "createRuntimeActivationSimulationSafeReport", source_runtime_activation_simulation_review_id: "runtime-activation-simulation-review-001", source_render_plan_id: "render-plan-001" },
  };
}

function blockedSimulationContract(): RuntimeActivationSimulationContract {
  return { ...readySimulationContract(), simulation_contract_state: "blocked", validation: { ...readySimulationContract().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Simulation contract blocked."] } };
}

function blockedSimulationSafeReport(): RuntimeActivationSimulationSafeReport {
  return { ...readySimulationSafeReport(), safe_report_state: "blocked", validation: { ...readySimulationSafeReport().validation, complete: false, ready_for_next_phase: false, blocking_reasons: ["Simulation safe report blocked."] } };
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

test("VO-7BH-REHEARSAL-1: runtime activation rehearsal contract is rehearsal-only and does not execute", () => {
  const contract = createRuntimeActivationRehearsalContract(readySimulationSafeReport(), readySimulationContract(), { id: "runtime-activation-rehearsal-contract-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.rehearsal_contract_state, "approved_for_future_rehearsal_review");
  assert.equal(contract.rehearsal_controls.rehearsal_contract_only, true);
  assert.equal(contract.rehearsal_controls.rehearsal_only, true);
  assert.equal(contract.rehearsal_controls.runtime_wiring_implemented, false);
  assert.equal(contract.rehearsal_controls.rehearsal_execution_disabled, true);
  assert.equal(contract.rehearsal_terms.length, 4);
  assert.equal(contract.rehearsal_terms.every((term) => term.runtime_enabled_now === false && term.rehearsal_executed_now === false && term.ready_for_real_upload_now === false && term.contains_runtime_callable === false && term.contains_raw_payload === false && term.contains_secret_material === false), true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BH-REHEARSAL-2: blocked simulation inputs block rehearsal contract", () => {
  const contract = createRuntimeActivationRehearsalContract(blockedSimulationSafeReport(), blockedSimulationContract());

  assert.equal(contract.rehearsal_contract_state, "blocked");
  assert.equal(contract.validation.complete, false);
  assert.equal(contract.validation.ready_for_next_phase, false);
  assert.equal(contract.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(contract.execution_boundary);
});

test("VO-7BH-REHEARSAL-3: runtime activation rehearsal review remains review-only and does not execute", () => {
  const simulationSafeReport = readySimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, readySimulationContract());
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport, { id: "runtime-activation-rehearsal-review-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.rehearsal_review_state, "approved_for_future_rehearsal_safe_report");
  assert.equal(review.review_controls.review_only, true);
  assert.equal(review.review_controls.rehearsal_review_only, true);
  assert.equal(review.review_controls.runtime_wiring_implemented, false);
  assert.equal(review.review_controls.rehearsal_execution_disabled, true);
  assert.equal(review.review_checks.length, 4);
  assert.equal(review.review_checks.every((check) => check.check_state === "passed" && check.runtime_enabled_now === false && check.rehearsal_executed_now === false && check.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BH-REHEARSAL-4: blocked rehearsal contract blocks rehearsal review", () => {
  const simulationSafeReport = blockedSimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, blockedSimulationContract());
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport);

  assert.equal(review.rehearsal_review_state, "blocked");
  assert.equal(review.validation.complete, false);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.review_checks.every((check) => check.check_state === "blocked"), true);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7BH-REHEARSAL-5: rehearsal safe report contains no callable, payload, response, or secrets and does not execute", () => {
  const simulationSafeReport = readySimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, readySimulationContract());
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport);
  const report = createRuntimeActivationRehearsalSafeReport(review, contract, { id: "runtime-activation-rehearsal-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.safe_report_state, "approved_for_future_runtime_activation_final_boundary");
  assert.equal(report.report_controls.safe_report_only, true);
  assert.equal(report.report_controls.rehearsal_only, true);
  assert.equal(report.report_controls.runtime_wiring_implemented, false);
  assert.equal(report.report_controls.rehearsal_execution_disabled, true);
  assert.equal(report.safe_report_sections.length, 4);
  assert.equal(report.safe_report_sections.every((section) => section.contains_runtime_callable === false && section.contains_raw_payload === false && section.contains_raw_response === false && section.contains_secret_material === false), true);
  assert.equal(report.safe_report_sections.every((section) => section.runtime_enabled_now === false && section.rehearsal_executed_now === false && section.ready_for_real_upload_now === false), true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BH-REHEARSAL-6: blocked rehearsal review blocks safe report", () => {
  const simulationSafeReport = blockedSimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, blockedSimulationContract());
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport);
  const report = createRuntimeActivationRehearsalSafeReport(review, contract);

  assert.equal(report.safe_report_state, "blocked");
  assert.equal(report.validation.complete, false);
  assert.equal(report.validation.ready_for_next_phase, false);
  assert.equal(report.validation.blocking_reasons.length > 0, true);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BH-SAFETY-7: unsafe strings are sanitized from rehearsal artifacts", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const simulationSafeReport = readySimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, readySimulationContract(), { id: unsafe, created_at: unsafe });
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport, { id: unsafe, created_at: unsafe });
  const report = createRuntimeActivationRehearsalSafeReport(review, contract, { id: unsafe, created_at: unsafe });

  const serialized = JSON.stringify({ contract, review, report });
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("client_secret"), false);
  assert.equal(serialized.includes("videos.insert"), false);
  assert.equal(serialized.includes("fetch("), false);
  assert.equal(serialized.includes("../unsafe"), false);
});

test("VO-7BH-SAFETY-8: revocation keeps rehearsal artifacts disabled", () => {
  const simulationSafeReport = readySimulationSafeReport();
  const contract = createRuntimeActivationRehearsalContract(simulationSafeReport, readySimulationContract());
  const review = createRuntimeActivationRehearsalReview(contract, simulationSafeReport);
  const report = createRuntimeActivationRehearsalSafeReport(review, contract);
  const revokedContract = revokeRuntimeActivationRehearsalContract(contract, "Operator revoked runtime activation rehearsal contract.");
  const revokedReview = revokeRuntimeActivationRehearsalReview(review, "Operator revoked runtime activation rehearsal review.");
  const revokedReport = revokeRuntimeActivationRehearsalSafeReport(report, "Operator revoked runtime activation rehearsal safe report.");

  assert.equal(revokedContract.rehearsal_contract_state, "revoked");
  assert.equal(revokedContract.validation.complete, false);
  assert.equal(revokedContract.validation.ready_for_next_phase, false);
  assert.equal(revokedContract.provenance.generated_by, "revokeRuntimeActivationRehearsalContract");
  assertDisabledBoundary(revokedContract.execution_boundary);

  assert.equal(revokedReview.rehearsal_review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReview.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_checks.every((check) => check.check_state === "blocked"), true);
  assert.equal(revokedReview.provenance.generated_by, "revokeRuntimeActivationRehearsalReview");
  assertDisabledBoundary(revokedReview.execution_boundary);

  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assert.equal(revokedReport.validation.ready_for_next_phase, false);
  assert.equal(revokedReport.provenance.generated_by, "revokeRuntimeActivationRehearsalSafeReport");
  assertDisabledBoundary(revokedReport.execution_boundary);
});
