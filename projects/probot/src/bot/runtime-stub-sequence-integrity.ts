import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubArchive, RuntimeStubArchiveFinalSummary } from "./runtime-stub-archive.js";

export type RuntimeStubSequenceIntegrityAuditState = "draft" | "complete" | "approved_for_future_sequence_regression_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubSequenceRegressionReportState = "draft" | "passed" | "failed" | "blocked" | "approved_for_future_sequence_final_handoff" | "revoked";
export type RuntimeStubSequenceFinalHandoffState = "draft" | "complete" | "runtime_stub_sequence_handed_off" | "rejected" | "revoked" | "blocked";
export type RuntimeStubSequenceCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface RuntimeStubSequenceCheck {
  check_id: string;
  check_kind: string;
  check_state: RuntimeStubSequenceCheckState;
  safe_summary: string;
  runtime_executed_now: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubSequenceFinalHandoffSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  ready_for_real_upload_now: false;
}

export interface RuntimeStubSequenceIntegrityAudit {
  schema_version: "1.0";
  runtime_stub_sequence_integrity_audit_id: string;
  runtime_stub_archive_final_summary_id: string;
  runtime_stub_archive_id: string;
  runtime_stub_closeout_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  audit_state: RuntimeStubSequenceIntegrityAuditState;
  required_artifacts: { runtime_stub_archive_final_summary_validated: true; runtime_stub_archive_validated: true };
  audit_scope: ControlledRuntimeActivationScope;
  audit_controls: {
    audit_only: true;
    sequence_integrity_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  audit_checks: RuntimeStubSequenceCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubSequenceIntegrityAudit" | "revokeRuntimeStubSequenceIntegrityAudit"; source_runtime_stub_archive_final_summary_id: string; source_render_plan_id: string };
}

export interface RuntimeStubSequenceRegressionReport {
  schema_version: "1.0";
  runtime_stub_sequence_regression_report_id: string;
  runtime_stub_sequence_integrity_audit_id: string;
  runtime_stub_archive_final_summary_id: string;
  runtime_stub_archive_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  regression_report_state: RuntimeStubSequenceRegressionReportState;
  required_artifacts: { runtime_stub_sequence_integrity_audit_validated: true; runtime_stub_archive_final_summary_validated: true };
  regression_scope: ControlledRuntimeActivationScope;
  regression_controls: {
    regression_report_only: true;
    sequence_regression_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  regression_checks: RuntimeStubSequenceCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubSequenceRegressionReport" | "revokeRuntimeStubSequenceRegressionReport"; source_runtime_stub_sequence_integrity_audit_id: string; source_render_plan_id: string };
}

export interface RuntimeStubSequenceFinalHandoff {
  schema_version: "1.0";
  runtime_stub_sequence_final_handoff_id: string;
  runtime_stub_sequence_regression_report_id: string;
  runtime_stub_sequence_integrity_audit_id: string;
  runtime_stub_archive_final_summary_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  handoff_state: RuntimeStubSequenceFinalHandoffState;
  required_artifacts: { runtime_stub_sequence_regression_report_validated: true; runtime_stub_sequence_integrity_audit_validated: true };
  handoff_scope: ControlledRuntimeActivationScope;
  handoff_controls: {
    handoff_only: true;
    sequence_handoff_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  handoff_sections: RuntimeStubSequenceFinalHandoffSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubSequenceFinalHandoff" | "revokeRuntimeStubSequenceFinalHandoff"; source_runtime_stub_sequence_regression_report_id: string; source_render_plan_id: string };
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

const AUDIT_CHECKS = [
  ["boundary-chain", "boundary_chain", "Runtime stub boundary chain summarized only."],
  ["store-chain", "store_chain", "Store chain summarized only."],
  ["release-chain", "release_chain", "Release chain summarized only."],
  ["closeout-chain", "closeout_chain", "Closeout chain summarized only."],
  ["final-status", "status", "Real upload remains disabled."],
] as const;

const REGRESSION_CHECKS = [
  ["schema-chain", "schema_chain", "Schema chain summarized only."],
  ["example-chain", "example_chain", "Example chain summarized only."],
  ["validator-chain", "validator_chain", "Validator chain summarized only."],
  ["test-chain", "test_chain", "Test chain summarized only."],
  ["final-status", "status", "Real upload remains disabled."],
] as const;

function safe(value: string | undefined, fallback: string): string { return sanitizeSafeSummary(value, fallback); }

function scope(futureNextPhaseRequested: boolean): ControlledRuntimeActivationScope {
  return { artifact_only: true, future_next_phase_requested: futureNextPhaseRequested, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false };
}

function validation(complete: boolean, readyForNextPhase: boolean, blockingReasons: string[], warnings: string[] = []): ControlledRuntimeActivationValidation {
  return { complete, ready_for_next_phase: readyForNextPhase, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: blockingReasons, warnings };
}

function archiveReady(archive: RuntimeStubArchive): boolean {
  return archive.archive_state === "approved_for_future_archive_review" && archive.validation.complete && archive.validation.ready_for_next_phase && archive.archive_controls.archive_only && archive.archive_controls.summary_only && !archive.archive_controls.contains_runtime_callable && !archive.archive_controls.contains_raw_payload && !archive.archive_controls.contains_raw_response && !archive.archive_controls.contains_secret_material && archive.archive_controls.runtime_invocation_disabled && archive.archive_controls.real_upload_still_blocked && archive.archive_items.length >= 4 && archive.archive_items.every((item) => item.item_state === "archived" && !item.archived_now && !item.runtime_executed_now && !item.ready_for_real_upload_now);
}

function archiveFinalSummaryReady(summary: RuntimeStubArchiveFinalSummary): boolean {
  return summary.final_summary_state === "runtime_stub_sequence_complete" && summary.validation.complete && !summary.validation.ready_for_next_phase && !summary.validation.ready_for_real_upload && summary.final_summary_controls.final_summary_only && summary.final_summary_controls.runtime_stub_sequence_only && !summary.final_summary_controls.contains_runtime_callable && !summary.final_summary_controls.contains_raw_payload && !summary.final_summary_controls.contains_raw_response && !summary.final_summary_controls.contains_secret_material && summary.final_summary_controls.runtime_invocation_disabled && summary.final_summary_controls.real_upload_still_blocked && summary.final_summary_sections.length >= 4 && summary.final_summary_sections.every((section) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material && !section.ready_for_real_upload_now);
}

function auditReady(audit: RuntimeStubSequenceIntegrityAudit): boolean {
  return audit.audit_state === "approved_for_future_sequence_regression_report" && audit.validation.complete && audit.validation.ready_for_next_phase && audit.audit_controls.audit_only && audit.audit_controls.sequence_integrity_only && !audit.audit_controls.contains_runtime_callable && !audit.audit_controls.contains_raw_payload && !audit.audit_controls.contains_raw_response && !audit.audit_controls.contains_secret_material && audit.audit_controls.runtime_invocation_disabled && audit.audit_controls.real_upload_still_blocked && audit.audit_checks.length >= 5 && audit.audit_checks.every((check) => check.check_state === "passed" && !check.runtime_executed_now && !check.ready_for_real_upload_now);
}

function regressionReady(report: RuntimeStubSequenceRegressionReport): boolean {
  return report.regression_report_state === "approved_for_future_sequence_final_handoff" && report.validation.complete && report.validation.ready_for_next_phase && report.regression_controls.regression_report_only && report.regression_controls.sequence_regression_only && !report.regression_controls.contains_runtime_callable && !report.regression_controls.contains_raw_payload && !report.regression_controls.contains_raw_response && !report.regression_controls.contains_secret_material && report.regression_controls.runtime_invocation_disabled && report.regression_controls.real_upload_still_blocked && report.regression_checks.length >= 5 && report.regression_checks.every((check) => check.check_state === "passed" && !check.runtime_executed_now && !check.ready_for_real_upload_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub sequence integrity prerequisite was not validated.")))];
}

function checks(prefix: string, specs: readonly (readonly [string, string, string])[], passed: boolean): RuntimeStubSequenceCheck[] {
  return specs.map(([id, kind, summary]) => ({ check_id: `${prefix}-${sanitizeSafeSummary(id, "check")}`, check_kind: sanitizeSafeSummary(kind, "sequence_check"), check_state: passed ? "passed" : "blocked", safe_summary: sanitizeSafeSummary(summary, "Runtime stub sequence check only."), runtime_executed_now: false, ready_for_real_upload_now: false }));
}

function handoffSections(): RuntimeStubSequenceFinalHandoffSection[] {
  return [
    { section_id: "handoff-integrity-audit", section_kind: "integrity_audit", safe_summary: "Integrity audit handed off only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "handoff-regression-report", section_kind: "regression_report", safe_summary: "Regression report handed off only.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "handoff-boundaries", section_kind: "boundaries", safe_summary: "Runtime invocation remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
    { section_id: "handoff-status", section_kind: "status", safe_summary: "Real upload remains disabled.", contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, ready_for_real_upload_now: false },
  ];
}

export function createRuntimeStubSequenceIntegrityAudit(archiveFinalSummary: RuntimeStubArchiveFinalSummary, archive: RuntimeStubArchive, options: { id?: string; created_at?: string; requestFutureSequenceRegressionReport?: boolean } = {}): RuntimeStubSequenceIntegrityAudit {
  const ready = archiveFinalSummaryReady(archiveFinalSummary) && archiveReady(archive);
  const requestReport = options.requestFutureSequenceRegressionReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub archive final summary or archive was not ready for sequence integrity audit.", [...archiveFinalSummary.validation.blocking_reasons, ...archive.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_sequence_integrity_audit_id: safe(options.id, "runtime-stub-sequence-integrity-audit-001"),
    runtime_stub_archive_final_summary_id: archiveFinalSummary.runtime_stub_archive_final_summary_id,
    runtime_stub_archive_id: archive.runtime_stub_archive_id,
    runtime_stub_closeout_id: archive.runtime_stub_closeout_id,
    render_plan_id: archiveFinalSummary.render_plan_id,
    project_id: archiveFinalSummary.project_id,
    platform: archiveFinalSummary.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    audit_state: readyForNext ? "approved_for_future_sequence_regression_report" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_archive_final_summary_validated: true, runtime_stub_archive_validated: true },
    audit_scope: scope(readyForNext),
    audit_controls: { audit_only: true, sequence_integrity_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    audit_checks: checks("audit", AUDIT_CHECKS, ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubSequenceIntegrityAudit", source_runtime_stub_archive_final_summary_id: archiveFinalSummary.runtime_stub_archive_final_summary_id, source_render_plan_id: archiveFinalSummary.render_plan_id },
  };
}

export function createRuntimeStubSequenceRegressionReport(audit: RuntimeStubSequenceIntegrityAudit, archiveFinalSummary: RuntimeStubArchiveFinalSummary, options: { id?: string; created_at?: string; requestFutureSequenceFinalHandoff?: boolean } = {}): RuntimeStubSequenceRegressionReport {
  const ready = auditReady(audit) && archiveFinalSummaryReady(archiveFinalSummary);
  const requestHandoff = options.requestFutureSequenceFinalHandoff !== false;
  const complete = ready;
  const readyForNext = complete && requestHandoff;
  const reasons = blocking(ready, "Runtime stub sequence integrity audit or archive final summary was not ready for regression report.", [...audit.validation.blocking_reasons, ...archiveFinalSummary.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_sequence_regression_report_id: safe(options.id, "runtime-stub-sequence-regression-report-001"),
    runtime_stub_sequence_integrity_audit_id: audit.runtime_stub_sequence_integrity_audit_id,
    runtime_stub_archive_final_summary_id: archiveFinalSummary.runtime_stub_archive_final_summary_id,
    runtime_stub_archive_id: audit.runtime_stub_archive_id,
    render_plan_id: audit.render_plan_id,
    project_id: audit.project_id,
    platform: audit.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    regression_report_state: readyForNext ? "approved_for_future_sequence_final_handoff" : ready ? "passed" : "blocked",
    required_artifacts: { runtime_stub_sequence_integrity_audit_validated: true, runtime_stub_archive_final_summary_validated: true },
    regression_scope: scope(readyForNext),
    regression_controls: { regression_report_only: true, sequence_regression_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    regression_checks: checks("regression", REGRESSION_CHECKS, ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubSequenceRegressionReport", source_runtime_stub_sequence_integrity_audit_id: audit.runtime_stub_sequence_integrity_audit_id, source_render_plan_id: audit.render_plan_id },
  };
}

export function createRuntimeStubSequenceFinalHandoff(regressionReport: RuntimeStubSequenceRegressionReport, integrityAudit: RuntimeStubSequenceIntegrityAudit, options: { id?: string; created_at?: string } = {}): RuntimeStubSequenceFinalHandoff {
  const ready = regressionReady(regressionReport) && auditReady(integrityAudit);
  const reasons = blocking(ready, "Runtime stub sequence regression report or integrity audit was not ready for final handoff.", [...regressionReport.validation.blocking_reasons, ...integrityAudit.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_sequence_final_handoff_id: safe(options.id, "runtime-stub-sequence-final-handoff-001"),
    runtime_stub_sequence_regression_report_id: regressionReport.runtime_stub_sequence_regression_report_id,
    runtime_stub_sequence_integrity_audit_id: integrityAudit.runtime_stub_sequence_integrity_audit_id,
    runtime_stub_archive_final_summary_id: regressionReport.runtime_stub_archive_final_summary_id,
    render_plan_id: regressionReport.render_plan_id,
    project_id: regressionReport.project_id,
    platform: regressionReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    handoff_state: ready ? "runtime_stub_sequence_handed_off" : "blocked",
    required_artifacts: { runtime_stub_sequence_regression_report_validated: true, runtime_stub_sequence_integrity_audit_validated: true },
    handoff_scope: scope(false),
    handoff_controls: { handoff_only: true, sequence_handoff_only: true, contains_runtime_callable: false, contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false, runtime_invocation_disabled: true, real_upload_still_blocked: true },
    handoff_sections: handoffSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(ready, false, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubSequenceFinalHandoff", source_runtime_stub_sequence_regression_report_id: regressionReport.runtime_stub_sequence_regression_report_id, source_render_plan_id: regressionReport.render_plan_id },
  };
}

export function revokeRuntimeStubSequenceIntegrityAudit(audit: RuntimeStubSequenceIntegrityAudit, reason?: string): RuntimeStubSequenceIntegrityAudit {
  const warning = sanitizeSafeSummary(reason, "Runtime stub sequence integrity audit was revoked.");
  return { ...audit, audit_state: "revoked", audit_scope: scope(false), audit_checks: audit.audit_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, audit.validation.blocking_reasons, [...audit.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...audit.provenance, generated_by: "revokeRuntimeStubSequenceIntegrityAudit" } };
}

export function revokeRuntimeStubSequenceRegressionReport(report: RuntimeStubSequenceRegressionReport, reason?: string): RuntimeStubSequenceRegressionReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub sequence regression report was revoked.");
  return { ...report, regression_report_state: "revoked", regression_scope: scope(false), regression_checks: report.regression_checks.map((check) => ({ ...check, check_state: "blocked" })), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubSequenceRegressionReport" } };
}

export function revokeRuntimeStubSequenceFinalHandoff(handoff: RuntimeStubSequenceFinalHandoff, reason?: string): RuntimeStubSequenceFinalHandoff {
  const warning = sanitizeSafeSummary(reason, "Runtime stub sequence final handoff was revoked.");
  return { ...handoff, handoff_state: "revoked", handoff_scope: scope(false), validation: validation(false, false, handoff.validation.blocking_reasons, [...handoff.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...handoff.provenance, generated_by: "revokeRuntimeStubSequenceFinalHandoff" } };
}
