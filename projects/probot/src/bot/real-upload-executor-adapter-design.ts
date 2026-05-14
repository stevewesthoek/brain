import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadReadinessGateV2 } from "./real-upload-readiness-gate-v2.js";

export type RealUploadExecutorAdapterDesignState =
  | "draft"
  | "blocked"
  | "ready_for_operator_review"
  | "approved_for_future_executor_contracts"
  | "rejected"
  | "revoked";

export type RealUploadExecutorAdapterDesignMode =
  | "real_upload_executor_adapter_design_only"
  | "operator_review_real_upload_executor_adapter_design";

export type PlannedAdapterModuleKind =
  | "credential_boundary_adapter_design"
  | "media_read_boundary_adapter_design"
  | "payload_builder_adapter_design"
  | "platform_client_adapter_design"
  | "network_boundary_adapter_design"
  | "response_redaction_adapter_design"
  | "executor_orchestration_adapter_design";

export interface RealUploadExecutorAdapterDesignOperatorReviewInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_design_only?: boolean;
  understands_no_adapter_code_created?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_platform_api_calls?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_media_reads?: boolean;
  understands_future_executor_contracts_required?: boolean;
  decision_note_summary?: string;
}

export interface PlannedAdapterModuleDesign {
  module_id: string;
  module_kind: PlannedAdapterModuleKind;
  safe_summary: string;
  code_created: false;
  runtime_enabled: false;
  upload_enabled: false;
  network_enabled: false;
  platform_api_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface RealUploadExecutorAdapterDesignExecutionBoundary {
  ready_for_real_upload: false;
  real_upload_enabled: false;
  adapter_code_created: false;
  runtime_enabled: false;
  runtime_executed: false;
  upload_allowed: false;
  upload_execution_enabled: false;
  platform_api_calls_allowed: false;
  network_calls_allowed: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_accessed: false;
  media_file_read: false;
  file_mutation_allowed: false;
  dependencies_added: false;
  package_metadata_changed: false;
}

export interface RealUploadExecutorAdapterDesign {
  schema_version: "1.0";
  real_upload_executor_adapter_design_id: string;
  real_upload_readiness_gate_v2_id: string;
  real_upload_noop_wiring_smoke_test_result_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  executor_adapter_design_state: RealUploadExecutorAdapterDesignState;
  executor_adapter_design_mode: RealUploadExecutorAdapterDesignMode;
  required_artifacts: {
    real_upload_readiness_gate_v2_validated: true;
    real_upload_noop_wiring_smoke_test_result_validated: true;
  };
  design_scope: {
    future_executor_contracts_requested: boolean;
    executor_adapter_design_only: true;
    adapter_code_created: false;
    runtime_adapter_enabled: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  adapter_boundaries: {
    credential_boundary_required: true;
    network_boundary_required: true;
    platform_api_boundary_required: true;
    media_read_boundary_required: true;
    payload_contract_required: true;
    response_redaction_required: true;
    dry_run_first_required: true;
    real_upload_still_blocked: true;
  };
  planned_adapter_modules: PlannedAdapterModuleDesign[];
  operator_review: Required<RealUploadExecutorAdapterDesignOperatorReviewInput>;
  execution_boundary: RealUploadExecutorAdapterDesignExecutionBoundary;
  validation: {
    executor_adapter_design_complete: boolean;
    ready_for_future_executor_contracts: boolean;
    ready_for_real_upload: false;
    real_upload_enabled: false;
    adapter_code_created: false;
    upload_allowed: false;
    network_calls_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealUploadExecutorAdapterDesign" | "revokeRealUploadExecutorAdapterDesign";
    source_real_upload_readiness_gate_v2_id: string;
    source_real_upload_noop_wiring_smoke_test_result_id: string;
    source_render_plan_id: string;
  };
}

const DISABLED_EXECUTOR_ADAPTER_BOUNDARY: RealUploadExecutorAdapterDesignExecutionBoundary = {
  ready_for_real_upload: false,
  real_upload_enabled: false,
  adapter_code_created: false,
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

const MODULES: Array<{ module_id: string; module_kind: PlannedAdapterModuleKind; summary: string }> = [
  { module_id: "adapter-module-credential-boundary", module_kind: "credential_boundary_adapter_design", summary: "Credential boundary design only." },
  { module_id: "adapter-module-media-read-boundary", module_kind: "media_read_boundary_adapter_design", summary: "Media read boundary design only." },
  { module_id: "adapter-module-payload-builder", module_kind: "payload_builder_adapter_design", summary: "Payload builder contract design only." },
  { module_id: "adapter-module-platform-client", module_kind: "platform_client_adapter_design", summary: "Platform client boundary design only." },
  { module_id: "adapter-module-network-boundary", module_kind: "network_boundary_adapter_design", summary: "Network boundary design only." },
  { module_id: "adapter-module-response-redaction", module_kind: "response_redaction_adapter_design", summary: "Response redaction design only." },
  { module_id: "adapter-module-executor-orchestration", module_kind: "executor_orchestration_adapter_design", summary: "Executor orchestration design only." },
];

function safeValue(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function normalizeOperatorReview(input: RealUploadExecutorAdapterDesignOperatorReviewInput = {}): Required<RealUploadExecutorAdapterDesignOperatorReviewInput> {
  return {
    reviewed_by_label: safeValue(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_design_only: input.understands_design_only === true,
    understands_no_adapter_code_created: input.understands_no_adapter_code_created === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_future_executor_contracts_required: input.understands_future_executor_contracts_required === true,
    decision_note_summary: safeValue(input.decision_note_summary, "Executor adapter design only. Real upload remains disabled."),
  };
}

function isOperatorReviewComplete(review: Required<RealUploadExecutorAdapterDesignOperatorReviewInput>): boolean {
  return (
    review.checklist_acknowledged &&
    review.understands_design_only &&
    review.understands_no_adapter_code_created &&
    review.understands_real_upload_not_enabled &&
    review.understands_no_network_calls &&
    review.understands_no_platform_api_calls &&
    review.understands_no_credentials_accessed &&
    review.understands_no_media_reads &&
    review.understands_future_executor_contracts_required
  );
}

function isGateReady(gate: RealUploadReadinessGateV2): boolean {
  return (
    (gate.readiness_gate_state === "ready_for_operator_review" || gate.readiness_gate_state === "approved_for_future_real_upload_executor_adapter_design") &&
    gate.validation.readiness_gate_v2_complete === true &&
    gate.validation.ready_for_future_real_upload_executor_adapter_design === true &&
    gate.validation.ready_for_real_upload === false &&
    gate.validation.real_upload_enabled === false &&
    gate.validation.upload_allowed === false &&
    gate.validation.network_calls_allowed === false &&
    gate.validation.platform_api_calls_allowed === false &&
    gate.validation.credentials_accessed === false &&
    gate.validation.media_file_read === false &&
    gate.execution_boundary.real_upload_enabled === false &&
    gate.execution_boundary.upload_allowed === false &&
    gate.execution_boundary.network_calls_allowed === false &&
    gate.execution_boundary.platform_api_calls_allowed === false &&
    gate.execution_boundary.credentials_accessed === false &&
    gate.execution_boundary.media_file_read === false
  );
}

function getGateBlockingReasons(gate: RealUploadReadinessGateV2): string[] {
  const reasons = [...gate.validation.blocking_reasons, ...gate.noop_wiring_review.blocking_reasons];
  if (!isGateReady(gate)) reasons.push("Readiness gate v2 was not ready for executor adapter design.");
  return [...new Set(reasons.map((reason) => sanitizeSafeSummary(reason, "Readiness gate v2 prerequisite was not validated.")))];
}

function createPlannedAdapterModules(blockingReasons: string[]): PlannedAdapterModuleDesign[] {
  return MODULES.map((module) => ({
    module_id: sanitizeSafeSummary(module.module_id, "adapter-module-design"),
    module_kind: module.module_kind,
    safe_summary: sanitizeSafeSummary(module.summary, "Adapter module design only."),
    code_created: false,
    runtime_enabled: false,
    upload_enabled: false,
    network_enabled: false,
    platform_api_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    blocking_reasons: blockingReasons,
    warnings: [],
  }));
}

export function createRealUploadExecutorAdapterDesign(
  readinessGate: RealUploadReadinessGateV2,
  options: {
    id?: string;
    created_at?: string;
    mode?: RealUploadExecutorAdapterDesignMode;
    requestFutureExecutorContracts?: boolean;
    operatorReview?: RealUploadExecutorAdapterDesignOperatorReviewInput;
  } = {},
): RealUploadExecutorAdapterDesign {
  const gateReady = isGateReady(readinessGate);
  const blockingReasons = getGateBlockingReasons(readinessGate);
  const operatorReview = normalizeOperatorReview(options.operatorReview);
  const operatorReady = isOperatorReviewComplete(operatorReview);
  const mode = options.mode ?? "real_upload_executor_adapter_design_only";
  const requestFutureContracts = options.requestFutureExecutorContracts !== false;

  let state: RealUploadExecutorAdapterDesignState = "blocked";
  if (gateReady && mode === "operator_review_real_upload_executor_adapter_design" && operatorReady && requestFutureContracts) {
    state = "approved_for_future_executor_contracts";
  } else if (gateReady) {
    state = "ready_for_operator_review";
  }

  const complete = gateReady && state !== "blocked";
  const readyForFutureContracts = complete && requestFutureContracts;
  const designBlockingReasons = gateReady ? [] : blockingReasons;

  return {
    schema_version: "1.0",
    real_upload_executor_adapter_design_id: safeValue(options.id, "real-upload-executor-adapter-design-001"),
    real_upload_readiness_gate_v2_id: readinessGate.real_upload_readiness_gate_v2_id,
    real_upload_noop_wiring_smoke_test_result_id: readinessGate.real_upload_noop_wiring_smoke_test_result_id,
    render_plan_id: readinessGate.render_plan_id,
    project_id: readinessGate.project_id,
    platform: readinessGate.platform,
    created_at: safeValue(options.created_at, "1970-01-01T00:00:00.000Z"),
    executor_adapter_design_state: state,
    executor_adapter_design_mode: mode,
    required_artifacts: {
      real_upload_readiness_gate_v2_validated: true,
      real_upload_noop_wiring_smoke_test_result_validated: true,
    },
    design_scope: {
      future_executor_contracts_requested: requestFutureContracts,
      executor_adapter_design_only: true,
      adapter_code_created: false,
      runtime_adapter_enabled: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    adapter_boundaries: {
      credential_boundary_required: true,
      network_boundary_required: true,
      platform_api_boundary_required: true,
      media_read_boundary_required: true,
      payload_contract_required: true,
      response_redaction_required: true,
      dry_run_first_required: true,
      real_upload_still_blocked: true,
    },
    planned_adapter_modules: createPlannedAdapterModules(designBlockingReasons),
    operator_review: operatorReview,
    execution_boundary: { ...DISABLED_EXECUTOR_ADAPTER_BOUNDARY },
    validation: {
      executor_adapter_design_complete: complete,
      ready_for_future_executor_contracts: readyForFutureContracts,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      adapter_code_created: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: designBlockingReasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createRealUploadExecutorAdapterDesign",
      source_real_upload_readiness_gate_v2_id: readinessGate.real_upload_readiness_gate_v2_id,
      source_real_upload_noop_wiring_smoke_test_result_id: readinessGate.real_upload_noop_wiring_smoke_test_result_id,
      source_render_plan_id: readinessGate.render_plan_id,
    },
  };
}

export function rejectRealUploadExecutorAdapterDesign(
  design: RealUploadExecutorAdapterDesign,
  reason?: string,
): RealUploadExecutorAdapterDesign {
  const warning = sanitizeSafeSummary(reason, "Executor adapter design was rejected.");
  return {
    ...design,
    executor_adapter_design_state: "rejected",
    validation: {
      ...design.validation,
      executor_adapter_design_complete: false,
      ready_for_future_executor_contracts: false,
      warnings: [...design.validation.warnings, warning],
    },
    execution_boundary: { ...DISABLED_EXECUTOR_ADAPTER_BOUNDARY },
  };
}

export function revokeRealUploadExecutorAdapterDesign(
  design: RealUploadExecutorAdapterDesign,
  reason?: string,
): RealUploadExecutorAdapterDesign {
  const warning = sanitizeSafeSummary(reason, "Executor adapter design was revoked.");
  return {
    ...design,
    executor_adapter_design_state: "revoked",
    validation: {
      ...design.validation,
      executor_adapter_design_complete: false,
      ready_for_future_executor_contracts: false,
      warnings: [...design.validation.warnings, warning],
    },
    execution_boundary: { ...DISABLED_EXECUTOR_ADAPTER_BOUNDARY },
    provenance: {
      ...design.provenance,
      generated_by: "revokeRealUploadExecutorAdapterDesign",
    },
  };
}
