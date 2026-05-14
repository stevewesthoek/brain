import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { NoopRuntimeStub, NoopRuntimeStubSafeReport, NoopRuntimeStubSafeReportSection } from "./noop-runtime-stub.js";

export type RuntimeStubStoreState = "draft" | "stored" | "ready_for_operator_review" | "approved_for_future_retrieval_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeStubRetrievalContractState = "draft" | "ready_for_operator_review" | "approved_for_future_store_retrieval_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubStoreRetrievalSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_manifest" | "rejected" | "revoked" | "blocked";

export interface StoredStubSummary {
  summary_only: true;
  noop_runtime_stub_id: string;
  runtime_callable_stored: false;
  raw_payload_stored: false;
  raw_response_stored: false;
  secret_material_stored: false;
}

export interface RuntimeStubRetrievalCheck {
  check_id: string;
  check_kind: string;
  safe_summary: string;
  retrieved_now: false;
  runtime_executed_now: false;
}

export interface RuntimeStubStoreRetrievalSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubStore {
  schema_version: "1.0";
  runtime_stub_store_id: string;
  noop_runtime_stub_safe_report_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  store_state: RuntimeStubStoreState;
  required_artifacts: { noop_runtime_stub_safe_report_validated: true; noop_runtime_stub_validated: true };
  store_scope: ControlledRuntimeActivationScope;
  store_controls: {
    store_artifact_only: true;
    stores_stub_summary_only: true;
    stores_runtime_callable: false;
    stores_raw_payload: false;
    stores_raw_response: false;
    stores_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  stored_stub_summary: StoredStubSummary;
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubStore" | "revokeRuntimeStubStore"; source_noop_runtime_stub_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubRetrievalContract {
  schema_version: "1.0";
  runtime_stub_retrieval_contract_id: string;
  runtime_stub_store_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  retrieval_contract_state: RuntimeStubRetrievalContractState;
  required_artifacts: { runtime_stub_store_validated: true; noop_runtime_stub_validated: true };
  retrieval_scope: ControlledRuntimeActivationScope;
  retrieval_controls: {
    retrieval_contract_only: true;
    retrieves_summary_only: true;
    runtime_callable_retrieved: false;
    raw_payload_retrieved: false;
    raw_response_retrieved: false;
    secret_material_retrieved: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  retrieval_checks: RuntimeStubRetrievalCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubRetrievalContract" | "revokeRuntimeStubRetrievalContract"; source_runtime_stub_store_id: string; source_render_plan_id: string };
}

export interface RuntimeStubStoreRetrievalSafeReport {
  schema_version: "1.0";
  runtime_stub_store_retrieval_safe_report_id: string;
  runtime_stub_retrieval_contract_id: string;
  runtime_stub_store_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubStoreRetrievalSafeReportState;
  required_artifacts: { runtime_stub_retrieval_contract_validated: true; runtime_stub_store_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubStoreRetrievalSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubStoreRetrievalSafeReport" | "revokeRuntimeStubStoreRetrievalSafeReport"; source_runtime_stub_retrieval_contract_id: string; source_render_plan_id: string };
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

const RETRIEVAL_CHECKS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "summary", kind: "summary_only", summary: "Retrieval contract only." },
  { id: "no-callable", kind: "runtime_callable_boundary", summary: "No runtime callable retrieved." },
  { id: "no-raw", kind: "raw_material_boundary", summary: "No raw payload or response retrieved." },
  { id: "no-secret", kind: "secret_boundary", summary: "No secret material retrieved." },
];

const REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "store", kind: "store", summary: "Store/retrieval safe report only." },
  { id: "retrieval", kind: "retrieval", summary: "Store/retrieval safe report only." },
  { id: "boundaries", kind: "boundaries", summary: "Runtime invocation remains disabled." },
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

function noopStubReady(stub: NoopRuntimeStub): boolean {
  return stub.stub_state === "approved_for_future_noop_runtime_stub_review" && stub.validation.complete && stub.validation.ready_for_next_phase && stub.stub_controls.noop_stub_only && stub.stub_controls.runtime_invocation_disabled && stub.stub_controls.network_client_absent && stub.stub_controls.platform_adapter_absent && stub.stub_controls.credential_provider_absent && stub.stub_controls.media_resolver_absent && stub.stub_controls.real_upload_still_blocked && stub.stub_items.every((item) => !item.implemented_now && !item.runtime_executed_now);
}

function noopSafeReportReady(report: NoopRuntimeStubSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_store" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section: NoopRuntimeStubSafeReportSection) => !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function storeReady(store: RuntimeStubStore): boolean {
  return store.store_state === "approved_for_future_retrieval_contract" && store.validation.complete && store.validation.ready_for_next_phase && store.store_controls.store_artifact_only && store.store_controls.stores_stub_summary_only && !store.store_controls.stores_runtime_callable && !store.store_controls.stores_raw_payload && !store.store_controls.stores_raw_response && !store.store_controls.stores_secret_material && store.store_controls.runtime_invocation_disabled && store.store_controls.real_upload_still_blocked && store.stored_stub_summary.summary_only && !store.stored_stub_summary.runtime_callable_stored && !store.stored_stub_summary.raw_payload_stored && !store.stored_stub_summary.raw_response_stored && !store.stored_stub_summary.secret_material_stored;
}

function retrievalContractReady(contract: RuntimeStubRetrievalContract): boolean {
  return contract.retrieval_contract_state === "approved_for_future_store_retrieval_safe_report" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.retrieval_controls.retrieval_contract_only && contract.retrieval_controls.retrieves_summary_only && !contract.retrieval_controls.runtime_callable_retrieved && !contract.retrieval_controls.raw_payload_retrieved && !contract.retrieval_controls.raw_response_retrieved && !contract.retrieval_controls.secret_material_retrieved && contract.retrieval_controls.runtime_invocation_disabled && contract.retrieval_controls.real_upload_still_blocked && contract.retrieval_checks.length >= 4 && contract.retrieval_checks.every((check) => !check.retrieved_now && !check.runtime_executed_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub store prerequisite was not validated.")))];
}

function retrievalChecks(): RuntimeStubRetrievalCheck[] {
  return RETRIEVAL_CHECKS.map((check) => ({
    check_id: `retrieval-${sanitizeSafeSummary(check.id, "check")}`,
    check_kind: sanitizeSafeSummary(check.kind, "retrieval_check"),
    safe_summary: sanitizeSafeSummary(check.summary, "Retrieval contract only."),
    retrieved_now: false,
    runtime_executed_now: false,
  }));
}

function safeReportSections(): RuntimeStubStoreRetrievalSafeReportSection[] {
  return REPORT_SECTIONS.map((section) => ({
    section_id: `store-retrieval-safe-report-${sanitizeSafeSummary(section.id, "section")}`,
    section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"),
    safe_summary: sanitizeSafeSummary(section.summary, "Store/retrieval safe report only."),
    contains_runtime_callable: false,
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
  }));
}

export function createRuntimeStubStore(
  noopSafeReport: NoopRuntimeStubSafeReport,
  noopStub: NoopRuntimeStub,
  options: { id?: string; created_at?: string; requestFutureRetrievalContract?: boolean } = {},
): RuntimeStubStore {
  const ready = noopSafeReportReady(noopSafeReport) && noopStubReady(noopStub);
  const requestRetrieval = options.requestFutureRetrievalContract !== false;
  const complete = ready;
  const readyForNext = complete && requestRetrieval;
  const reasons = blocking(ready, "No-op runtime stub safe report or stub was not ready for runtime stub store.", [...noopSafeReport.validation.blocking_reasons, ...noopStub.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_store_id: safe(options.id, "runtime-stub-store-001"),
    noop_runtime_stub_safe_report_id: noopSafeReport.noop_runtime_stub_safe_report_id,
    noop_runtime_stub_id: noopStub.noop_runtime_stub_id,
    render_plan_id: noopSafeReport.render_plan_id,
    project_id: noopSafeReport.project_id,
    platform: noopSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    store_state: readyForNext ? "approved_for_future_retrieval_contract" : ready ? "stored" : "blocked",
    required_artifacts: { noop_runtime_stub_safe_report_validated: true, noop_runtime_stub_validated: true },
    store_scope: scope(readyForNext),
    store_controls: {
      store_artifact_only: true,
      stores_stub_summary_only: true,
      stores_runtime_callable: false,
      stores_raw_payload: false,
      stores_raw_response: false,
      stores_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    stored_stub_summary: {
      summary_only: true,
      noop_runtime_stub_id: noopStub.noop_runtime_stub_id,
      runtime_callable_stored: false,
      raw_payload_stored: false,
      raw_response_stored: false,
      secret_material_stored: false,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubStore", source_noop_runtime_stub_safe_report_id: noopSafeReport.noop_runtime_stub_safe_report_id, source_render_plan_id: noopSafeReport.render_plan_id },
  };
}

export function createRuntimeStubRetrievalContract(
  store: RuntimeStubStore,
  noopStub: NoopRuntimeStub,
  options: { id?: string; created_at?: string; requestFutureStoreRetrievalSafeReport?: boolean } = {},
): RuntimeStubRetrievalContract {
  const ready = storeReady(store) && noopStubReady(noopStub);
  const requestReport = options.requestFutureStoreRetrievalSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub store or no-op runtime stub was not ready for retrieval contract.", [...store.validation.blocking_reasons, ...noopStub.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_retrieval_contract_id: safe(options.id, "runtime-stub-retrieval-contract-001"),
    runtime_stub_store_id: store.runtime_stub_store_id,
    noop_runtime_stub_id: noopStub.noop_runtime_stub_id,
    render_plan_id: store.render_plan_id,
    project_id: store.project_id,
    platform: store.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    retrieval_contract_state: readyForNext ? "approved_for_future_store_retrieval_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_store_validated: true, noop_runtime_stub_validated: true },
    retrieval_scope: scope(readyForNext),
    retrieval_controls: {
      retrieval_contract_only: true,
      retrieves_summary_only: true,
      runtime_callable_retrieved: false,
      raw_payload_retrieved: false,
      raw_response_retrieved: false,
      secret_material_retrieved: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    retrieval_checks: retrievalChecks(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubRetrievalContract", source_runtime_stub_store_id: store.runtime_stub_store_id, source_render_plan_id: store.render_plan_id },
  };
}

export function createRuntimeStubStoreRetrievalSafeReport(
  retrievalContract: RuntimeStubRetrievalContract,
  store: RuntimeStubStore,
  options: { id?: string; created_at?: string; requestFutureRuntimeStubManifest?: boolean } = {},
): RuntimeStubStoreRetrievalSafeReport {
  const ready = retrievalContractReady(retrievalContract) && storeReady(store);
  const requestManifest = options.requestFutureRuntimeStubManifest !== false;
  const complete = ready;
  const readyForNext = complete && requestManifest;
  const reasons = blocking(ready, "Runtime stub retrieval contract or store was not ready for store/retrieval safe report.", [...retrievalContract.validation.blocking_reasons, ...store.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_store_retrieval_safe_report_id: safe(options.id, "runtime-stub-store-retrieval-safe-report-001"),
    runtime_stub_retrieval_contract_id: retrievalContract.runtime_stub_retrieval_contract_id,
    runtime_stub_store_id: store.runtime_stub_store_id,
    noop_runtime_stub_id: store.noop_runtime_stub_id,
    render_plan_id: retrievalContract.render_plan_id,
    project_id: retrievalContract.project_id,
    platform: retrievalContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_manifest" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_retrieval_contract_validated: true, runtime_stub_store_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubStoreRetrievalSafeReport", source_runtime_stub_retrieval_contract_id: retrievalContract.runtime_stub_retrieval_contract_id, source_render_plan_id: retrievalContract.render_plan_id },
  };
}

export function revokeRuntimeStubStore(store: RuntimeStubStore, reason?: string): RuntimeStubStore {
  const warning = sanitizeSafeSummary(reason, "Runtime stub store was revoked.");
  return { ...store, store_state: "revoked", store_scope: scope(false), validation: validation(false, false, store.validation.blocking_reasons, [...store.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...store.provenance, generated_by: "revokeRuntimeStubStore" } };
}

export function revokeRuntimeStubRetrievalContract(contract: RuntimeStubRetrievalContract, reason?: string): RuntimeStubRetrievalContract {
  const warning = sanitizeSafeSummary(reason, "Runtime stub retrieval contract was revoked.");
  return { ...contract, retrieval_contract_state: "revoked", retrieval_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeStubRetrievalContract" } };
}

export function revokeRuntimeStubStoreRetrievalSafeReport(report: RuntimeStubStoreRetrievalSafeReport, reason?: string): RuntimeStubStoreRetrievalSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub store/retrieval safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubStoreRetrievalSafeReport" } };
}
