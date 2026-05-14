import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import type { ControlledRuntimeActivationScope, ControlledRuntimeActivationValidation } from "./controlled-runtime-activation.js";
import type { RuntimeStubStore, RuntimeStubStoreRetrievalSafeReport, RuntimeStubStoreRetrievalSafeReportSection } from "./runtime-stub-store.js";

export type RuntimeStubManifestState = "draft" | "created" | "ready_for_operator_review" | "approved_for_future_index_contract" | "rejected" | "revoked" | "blocked";
export type RuntimeStubIndexContractState = "draft" | "ready_for_operator_review" | "approved_for_future_manifest_index_safe_report" | "rejected" | "revoked" | "blocked";
export type RuntimeStubManifestIndexSafeReportState = "draft" | "complete" | "approved_for_future_runtime_stub_release_candidate" | "rejected" | "revoked" | "blocked";

export interface RuntimeStubManifestEntry {
  entry_id: string;
  entry_kind: string;
  artifact_id: string;
  safe_summary: string;
  runtime_callable_present: false;
  raw_payload_present: false;
  secret_material_present: false;
}

export interface RuntimeStubIndexEntry {
  entry_id: string;
  entry_kind: string;
  artifact_id: string;
  safe_summary: string;
  indexed_now: false;
  runtime_executed_now: false;
}

export interface RuntimeStubManifestIndexSafeReportSection {
  section_id: string;
  section_kind: string;
  safe_summary: string;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
}

export interface RuntimeStubManifest {
  schema_version: "1.0";
  runtime_stub_manifest_id: string;
  runtime_stub_store_retrieval_safe_report_id: string;
  runtime_stub_store_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  manifest_state: RuntimeStubManifestState;
  required_artifacts: { runtime_stub_store_retrieval_safe_report_validated: true; runtime_stub_store_validated: true };
  manifest_scope: ControlledRuntimeActivationScope;
  manifest_controls: {
    manifest_only: true;
    indexes_summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  manifest_entries: RuntimeStubManifestEntry[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubManifest" | "revokeRuntimeStubManifest"; source_runtime_stub_store_retrieval_safe_report_id: string; source_render_plan_id: string };
}

export interface RuntimeStubIndexContract {
  schema_version: "1.0";
  runtime_stub_index_contract_id: string;
  runtime_stub_manifest_id: string;
  runtime_stub_store_id: string;
  noop_runtime_stub_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  index_contract_state: RuntimeStubIndexContractState;
  required_artifacts: { runtime_stub_manifest_validated: true; runtime_stub_store_validated: true };
  index_scope: ControlledRuntimeActivationScope;
  index_controls: {
    index_contract_only: true;
    indexes_summary_only: true;
    contains_runtime_callable: false;
    contains_raw_payload: false;
    contains_raw_response: false;
    contains_secret_material: false;
    runtime_invocation_disabled: true;
    real_upload_still_blocked: true;
  };
  index_entries: RuntimeStubIndexEntry[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubIndexContract" | "revokeRuntimeStubIndexContract"; source_runtime_stub_manifest_id: string; source_render_plan_id: string };
}

export interface RuntimeStubManifestIndexSafeReport {
  schema_version: "1.0";
  runtime_stub_manifest_index_safe_report_id: string;
  runtime_stub_index_contract_id: string;
  runtime_stub_manifest_id: string;
  runtime_stub_store_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safe_report_state: RuntimeStubManifestIndexSafeReportState;
  required_artifacts: { runtime_stub_index_contract_validated: true; runtime_stub_manifest_validated: true };
  report_scope: ControlledRuntimeActivationScope;
  safe_report_sections: RuntimeStubManifestIndexSafeReportSection[];
  execution_boundary: DisabledEnablementBoundary;
  validation: ControlledRuntimeActivationValidation;
  provenance: { generated_by: "createRuntimeStubManifestIndexSafeReport" | "revokeRuntimeStubManifestIndexSafeReport"; source_runtime_stub_index_contract_id: string; source_render_plan_id: string };
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

const REPORT_SECTIONS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "manifest", kind: "manifest", summary: "Manifest/index safe report only." },
  { id: "index", kind: "index", summary: "Manifest/index safe report only." },
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

function storeReady(store: RuntimeStubStore): boolean {
  return store.store_state === "approved_for_future_retrieval_contract" && store.validation.complete && store.validation.ready_for_next_phase && store.store_controls.store_artifact_only && store.store_controls.stores_stub_summary_only && !store.store_controls.stores_runtime_callable && !store.store_controls.stores_raw_payload && !store.store_controls.stores_raw_response && !store.store_controls.stores_secret_material && store.store_controls.runtime_invocation_disabled && store.store_controls.real_upload_still_blocked && !store.stored_stub_summary.runtime_callable_stored && !store.stored_stub_summary.raw_payload_stored && !store.stored_stub_summary.raw_response_stored && !store.stored_stub_summary.secret_material_stored;
}

function storeRetrievalSafeReportReady(report: RuntimeStubStoreRetrievalSafeReport): boolean {
  return report.safe_report_state === "approved_for_future_runtime_stub_manifest" && report.validation.complete && report.validation.ready_for_next_phase && report.safe_report_sections.length >= 4 && report.safe_report_sections.every((section: RuntimeStubStoreRetrievalSafeReportSection) => !section.contains_runtime_callable && !section.contains_raw_payload && !section.contains_raw_response && !section.contains_secret_material);
}

function manifestReady(manifest: RuntimeStubManifest): boolean {
  return manifest.manifest_state === "approved_for_future_index_contract" && manifest.validation.complete && manifest.validation.ready_for_next_phase && manifest.manifest_controls.manifest_only && manifest.manifest_controls.indexes_summary_only && !manifest.manifest_controls.contains_runtime_callable && !manifest.manifest_controls.contains_raw_payload && !manifest.manifest_controls.contains_raw_response && !manifest.manifest_controls.contains_secret_material && manifest.manifest_controls.runtime_invocation_disabled && manifest.manifest_controls.real_upload_still_blocked && manifest.manifest_entries.length >= 3 && manifest.manifest_entries.every((entry) => !entry.runtime_callable_present && !entry.raw_payload_present && !entry.secret_material_present);
}

function indexContractReady(contract: RuntimeStubIndexContract): boolean {
  return contract.index_contract_state === "approved_for_future_manifest_index_safe_report" && contract.validation.complete && contract.validation.ready_for_next_phase && contract.index_controls.index_contract_only && contract.index_controls.indexes_summary_only && !contract.index_controls.contains_runtime_callable && !contract.index_controls.contains_raw_payload && !contract.index_controls.contains_raw_response && !contract.index_controls.contains_secret_material && contract.index_controls.runtime_invocation_disabled && contract.index_controls.real_upload_still_blocked && contract.index_entries.length >= 3 && contract.index_entries.every((entry) => !entry.indexed_now && !entry.runtime_executed_now);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Runtime stub manifest prerequisite was not validated.")))];
}

function manifestEntries(store: RuntimeStubStore, report: RuntimeStubStoreRetrievalSafeReport): RuntimeStubManifestEntry[] {
  return [
    { entry_id: "manifest-store", entry_kind: "store", artifact_id: store.runtime_stub_store_id, safe_summary: "Store summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
    { entry_id: "manifest-retrieval", entry_kind: "retrieval_contract", artifact_id: report.runtime_stub_retrieval_contract_id, safe_summary: "Retrieval summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
    { entry_id: "manifest-report", entry_kind: "safe_report", artifact_id: report.runtime_stub_store_retrieval_safe_report_id, safe_summary: "Safe report summary only.", runtime_callable_present: false, raw_payload_present: false, secret_material_present: false },
  ];
}

function indexEntries(manifest: RuntimeStubManifest, store: RuntimeStubStore): RuntimeStubIndexEntry[] {
  return [
    { entry_id: "index-store", entry_kind: "store", artifact_id: store.runtime_stub_store_id, safe_summary: "Index contract only.", indexed_now: false, runtime_executed_now: false },
    { entry_id: "index-manifest", entry_kind: "manifest", artifact_id: manifest.runtime_stub_manifest_id, safe_summary: "Index contract only.", indexed_now: false, runtime_executed_now: false },
    { entry_id: "index-report", entry_kind: "safe_report", artifact_id: manifest.runtime_stub_store_retrieval_safe_report_id, safe_summary: "Index contract only.", indexed_now: false, runtime_executed_now: false },
  ];
}

function safeReportSections(): RuntimeStubManifestIndexSafeReportSection[] {
  return REPORT_SECTIONS.map((section) => ({
    section_id: `manifest-index-safe-report-${sanitizeSafeSummary(section.id, "section")}`,
    section_kind: sanitizeSafeSummary(section.kind, "safe_report_section"),
    safe_summary: sanitizeSafeSummary(section.summary, "Manifest/index safe report only."),
    contains_runtime_callable: false,
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
  }));
}

export function createRuntimeStubManifest(
  storeRetrievalSafeReport: RuntimeStubStoreRetrievalSafeReport,
  store: RuntimeStubStore,
  options: { id?: string; created_at?: string; requestFutureIndexContract?: boolean } = {},
): RuntimeStubManifest {
  const ready = storeRetrievalSafeReportReady(storeRetrievalSafeReport) && storeReady(store);
  const requestIndex = options.requestFutureIndexContract !== false;
  const complete = ready;
  const readyForNext = complete && requestIndex;
  const reasons = blocking(ready, "Runtime stub store/retrieval safe report or store was not ready for manifest.", [...storeRetrievalSafeReport.validation.blocking_reasons, ...store.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_manifest_id: safe(options.id, "runtime-stub-manifest-001"),
    runtime_stub_store_retrieval_safe_report_id: storeRetrievalSafeReport.runtime_stub_store_retrieval_safe_report_id,
    runtime_stub_store_id: store.runtime_stub_store_id,
    noop_runtime_stub_id: store.noop_runtime_stub_id,
    render_plan_id: storeRetrievalSafeReport.render_plan_id,
    project_id: storeRetrievalSafeReport.project_id,
    platform: storeRetrievalSafeReport.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    manifest_state: readyForNext ? "approved_for_future_index_contract" : ready ? "created" : "blocked",
    required_artifacts: { runtime_stub_store_retrieval_safe_report_validated: true, runtime_stub_store_validated: true },
    manifest_scope: scope(readyForNext),
    manifest_controls: {
      manifest_only: true,
      indexes_summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    manifest_entries: manifestEntries(store, storeRetrievalSafeReport),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubManifest", source_runtime_stub_store_retrieval_safe_report_id: storeRetrievalSafeReport.runtime_stub_store_retrieval_safe_report_id, source_render_plan_id: storeRetrievalSafeReport.render_plan_id },
  };
}

export function createRuntimeStubIndexContract(
  manifest: RuntimeStubManifest,
  store: RuntimeStubStore,
  options: { id?: string; created_at?: string; requestFutureManifestIndexSafeReport?: boolean } = {},
): RuntimeStubIndexContract {
  const ready = manifestReady(manifest) && storeReady(store);
  const requestReport = options.requestFutureManifestIndexSafeReport !== false;
  const complete = ready;
  const readyForNext = complete && requestReport;
  const reasons = blocking(ready, "Runtime stub manifest or store was not ready for index contract.", [...manifest.validation.blocking_reasons, ...store.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_index_contract_id: safe(options.id, "runtime-stub-index-contract-001"),
    runtime_stub_manifest_id: manifest.runtime_stub_manifest_id,
    runtime_stub_store_id: store.runtime_stub_store_id,
    noop_runtime_stub_id: store.noop_runtime_stub_id,
    render_plan_id: manifest.render_plan_id,
    project_id: manifest.project_id,
    platform: manifest.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    index_contract_state: readyForNext ? "approved_for_future_manifest_index_safe_report" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { runtime_stub_manifest_validated: true, runtime_stub_store_validated: true },
    index_scope: scope(readyForNext),
    index_controls: {
      index_contract_only: true,
      indexes_summary_only: true,
      contains_runtime_callable: false,
      contains_raw_payload: false,
      contains_raw_response: false,
      contains_secret_material: false,
      runtime_invocation_disabled: true,
      real_upload_still_blocked: true,
    },
    index_entries: indexEntries(manifest, store),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubIndexContract", source_runtime_stub_manifest_id: manifest.runtime_stub_manifest_id, source_render_plan_id: manifest.render_plan_id },
  };
}

export function createRuntimeStubManifestIndexSafeReport(
  indexContract: RuntimeStubIndexContract,
  manifest: RuntimeStubManifest,
  options: { id?: string; created_at?: string; requestFutureRuntimeStubReleaseCandidate?: boolean } = {},
): RuntimeStubManifestIndexSafeReport {
  const ready = indexContractReady(indexContract) && manifestReady(manifest);
  const requestReleaseCandidate = options.requestFutureRuntimeStubReleaseCandidate !== false;
  const complete = ready;
  const readyForNext = complete && requestReleaseCandidate;
  const reasons = blocking(ready, "Runtime stub index contract or manifest was not ready for manifest/index safe report.", [...indexContract.validation.blocking_reasons, ...manifest.validation.blocking_reasons]);
  return {
    schema_version: "1.0",
    runtime_stub_manifest_index_safe_report_id: safe(options.id, "runtime-stub-manifest-index-safe-report-001"),
    runtime_stub_index_contract_id: indexContract.runtime_stub_index_contract_id,
    runtime_stub_manifest_id: manifest.runtime_stub_manifest_id,
    runtime_stub_store_id: manifest.runtime_stub_store_id,
    render_plan_id: indexContract.render_plan_id,
    project_id: indexContract.project_id,
    platform: indexContract.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safe_report_state: readyForNext ? "approved_for_future_runtime_stub_release_candidate" : ready ? "complete" : "blocked",
    required_artifacts: { runtime_stub_index_contract_validated: true, runtime_stub_manifest_validated: true },
    report_scope: scope(readyForNext),
    safe_report_sections: safeReportSections(),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: validation(complete, readyForNext, ready ? [] : reasons),
    provenance: { generated_by: "createRuntimeStubManifestIndexSafeReport", source_runtime_stub_index_contract_id: indexContract.runtime_stub_index_contract_id, source_render_plan_id: indexContract.render_plan_id },
  };
}

export function revokeRuntimeStubManifest(manifest: RuntimeStubManifest, reason?: string): RuntimeStubManifest {
  const warning = sanitizeSafeSummary(reason, "Runtime stub manifest was revoked.");
  return { ...manifest, manifest_state: "revoked", manifest_scope: scope(false), validation: validation(false, false, manifest.validation.blocking_reasons, [...manifest.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...manifest.provenance, generated_by: "revokeRuntimeStubManifest" } };
}

export function revokeRuntimeStubIndexContract(contract: RuntimeStubIndexContract, reason?: string): RuntimeStubIndexContract {
  const warning = sanitizeSafeSummary(reason, "Runtime stub index contract was revoked.");
  return { ...contract, index_contract_state: "revoked", index_scope: scope(false), validation: validation(false, false, contract.validation.blocking_reasons, [...contract.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...contract.provenance, generated_by: "revokeRuntimeStubIndexContract" } };
}

export function revokeRuntimeStubManifestIndexSafeReport(report: RuntimeStubManifestIndexSafeReport, reason?: string): RuntimeStubManifestIndexSafeReport {
  const warning = sanitizeSafeSummary(reason, "Runtime stub manifest/index safe report was revoked.");
  return { ...report, safe_report_state: "revoked", report_scope: scope(false), validation: validation(false, false, report.validation.blocking_reasons, [...report.validation.warnings, warning]), execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...report.provenance, generated_by: "revokeRuntimeStubManifestIndexSafeReport" } };
}
