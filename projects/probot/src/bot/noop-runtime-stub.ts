import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RealRuntimeStubBoundaryContract, RealRuntimeStubBoundaryDryRunReport } from "./real-runtime-stub-boundary.js";

export type NoopRuntimeStubState = "draft" | "created" | "ready_for_operator_review" | "approved_for_future_noop_runtime_stub_review" | "rejected" | "revoked" | "blocked";
export type NoopRuntimeStubReviewState = "draft" | "ready_for_operator_review" | "approved_for_future_noop_runtime_stub_safe_report" | "rejected" | "revoked" | "blocked";
export type NoopRuntimeStubSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_store" | "rejected" | "revoked" | "blocked";
export type NoopRuntimeStubReviewItemState = "passed" | "failed" | "blocked" | "deferred";

export interface NoopRuntimeStubItem {
  item_id: string;
  item_kind: string;
  safe_summary: string;
  implemented_now: false;
  runtime_executed_now: false;
}

export interface NoopRuntimeStubReviewItem {
  item_id: string;
  item_kind: string;
  review_state: NoopRuntimeStubReviewItemState;
  safe_summary: string;
  implemented_now: false;
  runtime_executed_now: false;
}

export interface NoopRuntimeStubSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface NoopRuntimeStub {
  schema_version: "1.0";
  noop_runtime_stub_id: string;
  real_runtime_stub_boundary_dry_run_report_id: string;
  real_runtime_stub_boundary_contract_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  stub_state: NoopRuntimeStubState;
  required_artifacts: {
    real_runtime_stub_boundary_dry_run_report_validated: true;
    real_runtime_stub_boundary_contract_validated: true;
  };
  stub_scope: ControlledRuntimeActivationScope;
  stub_controls: {
    noop_stub_only: true;
    runtime_invocation_disabled: true;
    network_client_absent: true;
    platform_adapter_absent: true;
    credential_provider_absent: true;
    media_resolver_absent: true;
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    real_upload_still_blocked: true;
  };
  stub_items: NoopRuntimeStubItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createNoopRuntimeStub" | "revokeNoopRuntimeStub";
    source_real_runtime_stub_boundary_dry_run_report_id: string;
    source_render_plan_id: string;
  };
}

export interface NoopRuntimeStubReview {
  schema_version: "1.0";
  noop_runtime_stub_review_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  stub_review_state: NoopRuntimeStubReviewState;
  required_artifacts: { noop_runtime_stub_validated: true };
  review_scope: ControlledRuntimeActivationScope;
  review_controls: {
    review_only: true;
    noop_stub_reviewed: true;
    runtime_invocation_disabled: true;
    network_client_absent: true;
    platform_adapter_absent: true;
    credential_provider_absent: true;
    media_resolver_absent: true;
    real_upload_still_blocked: true;
  };
  review_items: NoopRuntimeStubReviewItem[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createNoopRuntimeStubReview" | "revokeNoopRuntimeStubReview";
    source_noop_runtime_stub_id: string;
    source_render_plan_id: string;
  };
}

export interface NoopRuntimeStubSafeReport {
  schema_version: "1.0";
  noop_runtime_stub_safe_report_id: string;
  noop_runtime_stub_review_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: NoopRuntimeStubSafeReportState;
  required_artifacts: {
    noop_runtime_stub_review_validated: true;
    noop_runtime_stub_validated: true;
  };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: NoopRuntimeStubSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: {
    generated_by: "createNoopRuntimeStubSafeReport" | "revokeNoopRuntimeStubSafeReport";
    source_noop_runtime_stub_review_id: string;
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

const ITEMS: Array<{ id: string; kind: string }> = [
  { id: "kill-switch", kind: "kill_switch" },
  { id: "single-upload", kind: "single_upload_limit" },
  { id: "credential", kind: "credential_boundary" },
  { id: "network", kind: "network_boundary" },
  { id: "media", kind: "media_boundary" },
];

const REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "boundaries", kind: "boundaries", summary: "No-op runtime stub safe report only." },
  { id: "controls", kind: "controls", summary: "No-op runtime stub safe report only." },
  { id: "review", kind: "review", summary: "No-op runtime stub safe report only." },
  { id: "status", kind: "status", summary: "Real upload remains disabled." },
];

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

function boundaryDryRunReady(report: RealRuntimeStubBoundaryDryRunReport): boolean {
  return report.dry_run_report_state === "approved_for_future_noop_runtime_stub" && report.validation.complete && report.validation.ready_for_next_phase && !report.validation.ready_for_real_upload && !report.validation.real_upload_enabled && !report.validation.upload_allowed && !report.validation.network_calls_allowed && !report.validation.platform_api_calls_allowed && !report.validation.credentials_accessed && !report.validation.media_file_read && report.dry_run_results.length >= 5 && report.dry_run_results.every((result) => result.result_state === "passed" && !result.implemented_now && !result.runtime_executed_now);
}

function boundaryContractReady(contract: RealRuntimeStubBoundaryContract): boolean {
  return contract.stub_contract_state === "approved_for_future_stub_boundary_dry_run_report" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.stub_contract_controls.runtime_stub_only && contract.stub_contract_controls.no_op_runtime_required && !contract.stub_contract_controls.raw_payload_storage_allowed && !contract.stub_contract_controls.raw_response_storage_allowed && contract.stub_contract_controls.real_upload_still_blocked && contract.stub_contract_items.length >= 5 && contract.stub_contract_items.every((item) => !item.implemented_now && !item.runtime_executed_now);
}

function noopStubReady(stub: NoopRuntimeStub): boolean {
  return stub.stub_state === "approved_for_future_noop_runtime_stub_review" && stub.validation.complete && stub.validation.ready_for_next_phase && stub.stub_controls.noop_stub_only && stub.stub_controls.runtime_invocation_disabled && stub.stub_controls.network_client_absent && stub.stub_controls.platform_adapter_absent && stub.stub_controls.credential_provider_absent && stub.stub_controls.media_resolver_absent && stub.stub_controls.real_upload_still_blocked && stub.stub_items.length >= 5 && stub.stub_items.every((item) => !item.implemented_now && !item.runtime_executed_now);
}

function noopReviewReady(review: NoopRuntimeStubReview): boolean {
  return review.stub_review_state === "approved_for_future_noop_runtime_stub_safe_report" && review.validation.complete && review.validation.ready_for_next_phase && review.review_controls.review_only && review.review_controls.noop_stub_reviewed && review.review_controls.runtime_invocation_disabled && review.review_controls.network_client_absent && review.review_controls.platform_adapter_absent && review.review_controls.credential_provider_absent && review.review_controls.media_resolver_absent && review.review_controls.real_upload_still_blocked && review.review_items.length >= 5 && review.review_items.every((item) => item.review_state === "passed" && !item.implemented_now && !item.runtime_executed_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "No-op runtime stub prerequisite was not validated.")))];
}

function stubItems(): NoopRuntimeStubItem[] {
  return ITEMS.map((item) => ({ item_id: `noop-stub-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "noop_stub_item"), safe_summary: "No-op stub item only.", implemented_now: false, runtime_executed_now: false }));
}

function reviewItems(passed: boolean): NoopRuntimeStubReviewItem[] {
  return ITEMS.map((item) => ({ item_id: `review-noop-stub-${sanitizeSafeSummary(item.id, "item")}`, item_kind: sanitizeSafeSummary(item.kind, "noop_stub_review_item"), review_state: passed ? "passed" : "blocked", safe_summary: "No-op stub review only.", implemented_now: false, runtime_executed_now: false }));
}

function safeReportSections(): NoopRuntimeStubSafeReportSection[] {
  return REPORT_SECTIONS.map((section) => ({ section_id: `noop-safe-report-${sanitizeSafeSummary(section.id, "section")}`, section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"), safe_summary: sanitizeSafeSummary(section.summary, "No-op runtime stub safe report only."), contains_raw_payload: false, contains_raw_response: false, contains_secret_material: false }));
}

export function createNoopRuntimeStub(
  boundaryDryRunReport: RealRuntimeStubBoundaryDryRunReport,
  boundaryContract: RealRuntimeStubBoundaryContract,
  options: { id?: string; created_at?: string; requestFutureNoopRuntimeStubReview?: boolean } = {},
): NoopRuntimeStub {
  const ready = boundaryDryRunReady(boundaryDryRunReport) && boundaryContractReady(boundaryContract);
  const requestReview = options.requestFutureNoopRuntimeStubReview !== false;
  const complete = ready;
  const readyForNext = complete && requestReview;
  const reasons = blocking(ready, "Real runtime stub boundary dry-run report or contract was not ready for no-op runtime stub.", [...boundaryDryRunReport.validation.blocking_reasons, ...boundaryContract.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    noop_runtime_stub_id: safe(options.id, "noop-runtime-stub-001"),
    real_runtime_stub_boundary_dry_run_report_id: boundaryDryRunReport.real_runtime_stub_boundary_dry_run_report_id,
    real_runtime_stub_boundary_contract_id: boundaryContract.real_runtime_stub_boundary_contract_id,
    render_plan_id: boundaryDryRunReport.render_plan_id,
    project_id: boundaryDryRunReport.project_id,
    platform: boundaryDryRunReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    stub_state: readyForNext ? "approved_for_future_noop_runtime_stub_review" : ready ? "created" : "blocked",
    required_artifacts: { real_runtime_stub_boundary_dry_run_report_validated: true, real_runtime_stub_boundary_contract_validated: true },
    stub_scope: scope(readyForNext),
    stub_controls: {
      noop_stub_only: true,
      runtime_invocation_disabled: true,
      network_client_absent: true,
      platform_adapter_absent: true,
      credential_provider_absent: true,
      media_resolver_absent: true,
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      real_upload_still_blocked: true,
    },
    stub_items: stubItems(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createNoopRuntimeStub", source_real_runtime_stub_boundary_dry_run_report_id: boundaryDryRunReport.real_runtime_stub_boundary_dry_run_report_id, source_render_plan_id: boundaryDryRunReport.render_plan_id },
  };
}

export function createNoopRuntimeStubReview(
  stub: NoopRuntimeStub,
  options: { id?: string; created_at?: string; requestFutureNoopRuntimeStubSafeReport?: boolean } = {},
): NoopRuntimeStubReview {
  const ready = noopStubReady(stub);
  const requestReport = options.requestFutureNoopRuntimeStubSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "No-op runtime stub was not ready for review.", stub.validation.blocking_reasons);
  return {
    schema_version: "1.0",
    noop_runtime_stub_review_id: safe(options.id, "noop-runtime-stub-review-001"),
    noop_runtime_stub_id: stub.noop_runtime_stub_id,
    render_plan_id: stub.render_plan_id,
    project_id: stub.project_id,
    platform: stub.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    stub_review_state: readyForNext ? "approved_for_future_noop_runtime_stub_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { noop_runtime_stub_validated: true },
    review_scope: scope(readyForNext),
    review_controls: {
      review_only: true,
      noop_stub_reviewed: true,
      runtime_invocation_disabled: true,
      network_client_absent: true,
      platform_adapter_absent: true,
      credential_provider_absent: true,
      media_resolver_absent: true,
      real_upload_still_blocked: true,
    },
    review_items: reviewItems(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createNoopRuntimeStubReview", source_noop_runtime_stub_id: stub.noop_runtime_stub_id, source_render_plan_id: stub.render_plan_id },
  };
}

export function createNoopRuntimeStubSafeReport(
  review: NoopRuntimeStubReview,
  stub: NoopRuntimeStub,
  options: { id?: string; created_at?: string; requestFutureRuntimeStubStore?: boolean } = {},
): NoopRuntimeStubSafeReport {
  const ready = noopReviewReady(review) && noopStubReady(stub);
  const requestStore = options.requestFutureRuntimeStubStore !== false;
  const complete = ready;
  const readyForNext = complete && requestStore;
  const reasons = blocking(ready, "No-op runtime stub review or stub was not ready for safe report.", [...review.validation.blocking_reasons, ...stub.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    noop_runtime_stub_safe_report_id: safe(options.id, "noop-runtime-stub-safe-report-001"),
    noop_runtime_stub_review_id: review.noop_runtime_stub_review_id,
    noop_runtime_stub_id: stub.noop_runtime_stub_id,
    render_plan_id: review.render_plan_id,
    project_id: review.project_id,
    platform: review.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_store" : ready ? "complete" : "blocked",
    required_artifacts: { noop_runtime_stub_review_validated: true, noop_runtime_stub_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createNoopRuntimeStubSafeReport", source_noop_runtime_stub_review_id: review.noop_runtime_stub_review_id, source_render_plan_id: review.render_plan_id },
  };
}

export function revokeNoopRuntimeStub(stub: NoopRuntimeStub, reason?: string): NoopRuntimeStub {
  const warning = sanitizeSafeSummary(reason, "No-op runtime stub was revoked.");
  return { ...stub, stub_state: "revoked", stub_scope: scope(false), validation: validation(false, false, stub.validation.blocking_reasons, [...stub.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...stub.provenance, generated_by: "revokeNoopRuntimeStub" } };
}

export function revokeNoopRuntimeStubReview(review: NoopRuntimeStubReview, reason?: string): NoopRuntimeStubReview {
  const warning = sanitizeSafeSummary(reason, "No-op runtime stub review was revoked.");
  return { ...review, stub_review_state: "revoked", review_scope: scope(false), review_items: review.review_items.map((item) => ({ ...item, review_state: "blocked" })), validation: validation(false, false, review.validation.blocking_reasons, [...review.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...review.provenance, generated_by: "revokeNoopRuntimeStubReview" } };
}

export function revokeNoopRuntimeStubSafeReport(report: NoopRuntimeStubSafeReport, reason?: string): NoopRuntimeStubSafeReport {
  const warning = sanitizeSafeSummary(reason, "No-op runtime stub safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeNoopRuntimeStubSafeReport" } };
}
