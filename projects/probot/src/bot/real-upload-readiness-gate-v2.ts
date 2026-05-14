import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadNoopWiringSmokeTestResult } from "./real-upload-disabled-noop-wiring.js";

export type RealUploadReadinessGateV2State =
  | "draft"
  | "blocked"
  | "ready_for_operator_review"
  | "approved_for_future_real_upload_executor_adapter_design"
  | "rejected"
  | "revoked";

export type RealUploadReadinessGateV2Mode =
  | "real_upload_readiness_gate_v2_only"
  | "operator_review_real_upload_readiness_gate_v2";

export interface RealUploadReadinessGateV2OperatorReviewInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_gate_only?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_platform_api_calls?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_media_reads?: boolean;
  understands_future_executor_adapter_design_required?: boolean;
  decision_note_summary?: string;
}

export interface RealUploadReadinessGateV2ExecutionBoundary {
  ready_for_real_upload: false;
  real_upload_enabled: false;
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

export interface RealUploadReadinessGateV2 {
  schema_version: "1.0";
  real_upload_readiness_gate_v2_id: string;
  real_upload_noop_wiring_smoke_test_result_id: string;
  real_upload_disabled_noop_wiring_activation_result_id: string;
  real_upload_disabled_noop_wiring_activation_plan_id: string;
  real_upload_noop_wiring_contract_tests_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  readiness_gate_state: RealUploadReadinessGateV2State;
  readiness_gate_mode: RealUploadReadinessGateV2Mode;
  required_artifacts: {
    real_upload_noop_wiring_smoke_test_result_validated: true;
    real_upload_disabled_noop_wiring_activation_result_validated: true;
    real_upload_disabled_noop_wiring_activation_plan_validated: true;
    real_upload_noop_wiring_contract_tests_validated: true;
  };
  gate_scope: {
    future_real_upload_executor_adapter_design_requested: boolean;
    readiness_gate_only: true;
    real_upload_enabled_now: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    runtime_wiring_changed_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  noop_wiring_review: {
    noop_wiring_smoke_test_complete: boolean;
    noop_wiring_remains_disabled: true;
    runtime_invoked: false;
    upload_invoked: false;
    network_invoked: false;
    platform_api_invoked: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  real_upload_remaining_gates: {
    executor_adapter_design_required: true;
    executor_contract_required: true;
    dry_run_adapter_required: true;
    credential_boundary_required: true;
    network_boundary_required: true;
    media_read_boundary_required: true;
    operator_final_checklist_required: true;
    real_upload_still_blocked: true;
    blocking_reasons: string[];
    warnings: string[];
  };
  operator_review: Required<RealUploadReadinessGateV2OperatorReviewInput>;
  execution_boundary: RealUploadReadinessGateV2ExecutionBoundary;
  validation: {
    readiness_gate_v2_complete: boolean;
    ready_for_future_real_upload_executor_adapter_design: boolean;
    ready_for_real_upload: false;
    real_upload_enabled: false;
    upload_allowed: false;
    network_calls_allowed: false;
    platform_api_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealUploadReadinessGateV2" | "revokeRealUploadReadinessGateV2";
    source_real_upload_noop_wiring_smoke_test_result_id: string;
    source_real_upload_disabled_noop_wiring_activation_result_id: string;
    source_real_upload_disabled_noop_wiring_activation_plan_id: string;
    source_render_plan_id: string;
  };
}

const DISABLED_REAL_UPLOAD_BOUNDARY: RealUploadReadinessGateV2ExecutionBoundary = {
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

const REMAINING_REAL_UPLOAD_BLOCKER =
  "Real upload remains blocked until executor adapter design, contracts, dry-run adapter, credential/network/media boundaries, and final operator checklist exist.";

function safeValue(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function getSmokeBlockingReasons(smokeTest: RealUploadNoopWiringSmokeTestResult): string[] {
  const reasons = [...smokeTest.validation.blocking_reasons];
  for (const check of smokeTest.noop_wiring_checks) {
    for (const reason of check.blocking_reasons) reasons.push(reason);
  }
  return [...new Set(reasons.map((reason) => sanitizeSafeSummary(reason, "Required smoke-test prerequisite was not validated.")))];
}

function isSmokeTestReady(smokeTest: RealUploadNoopWiringSmokeTestResult): boolean {
  return (
    smokeTest.smoke_test_state === "passed_noop_disabled" &&
    smokeTest.validation.noop_wiring_smoke_test_complete === true &&
    smokeTest.validation.ready_for_future_real_upload_readiness_gate_v2 === true &&
    smokeTest.validation.ready_for_real_upload === false &&
    smokeTest.smoke_test_scope.runtime_invoked === false &&
    smokeTest.smoke_test_scope.upload_invoked === false &&
    smokeTest.smoke_test_scope.network_invoked === false &&
    smokeTest.smoke_test_scope.platform_api_invoked === false &&
    smokeTest.smoke_test_scope.credentials_accessed === false &&
    smokeTest.smoke_test_scope.media_file_read === false &&
    smokeTest.smoke_test_scope.file_mutation_allowed === false
  );
}

function normalizeOperatorReview(input: RealUploadReadinessGateV2OperatorReviewInput = {}): Required<RealUploadReadinessGateV2OperatorReviewInput> {
  return {
    reviewed_by_label: safeValue(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_gate_only: input.understands_gate_only === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_future_executor_adapter_design_required: input.understands_future_executor_adapter_design_required === true,
    decision_note_summary: safeValue(input.decision_note_summary, "Readiness gate v2 only. Real upload remains disabled."),
  };
}

function isOperatorReviewComplete(review: Required<RealUploadReadinessGateV2OperatorReviewInput>): boolean {
  return (
    review.checklist_acknowledged &&
    review.understands_gate_only &&
    review.understands_real_upload_not_enabled &&
    review.understands_no_network_calls &&
    review.understands_no_platform_api_calls &&
    review.understands_no_credentials_accessed &&
    review.understands_no_media_reads &&
    review.understands_future_executor_adapter_design_required
  );
}

export function createRealUploadReadinessGateV2(
  smokeTest: RealUploadNoopWiringSmokeTestResult,
  options: {
    id?: string;
    created_at?: string;
    mode?: RealUploadReadinessGateV2Mode;
    requestFutureExecutorAdapterDesign?: boolean;
    operatorReview?: RealUploadReadinessGateV2OperatorReviewInput;
  } = {},
): RealUploadReadinessGateV2 {
  const smokeReady = isSmokeTestReady(smokeTest);
  const operatorReview = normalizeOperatorReview(options.operatorReview);
  const operatorReady = isOperatorReviewComplete(operatorReview);
  const mode = options.mode ?? "real_upload_readiness_gate_v2_only";
  const requestedFutureDesign = options.requestFutureExecutorAdapterDesign !== false;
  const blockingReasons = smokeReady ? [] : getSmokeBlockingReasons(smokeTest);

  let state: RealUploadReadinessGateV2State = "blocked";
  if (smokeReady && mode === "operator_review_real_upload_readiness_gate_v2" && operatorReady && requestedFutureDesign) {
    state = "approved_for_future_real_upload_executor_adapter_design";
  } else if (smokeReady) {
    state = "ready_for_operator_review";
  }

  const complete = smokeReady && state !== "blocked";
  const readyForFutureDesign = complete && requestedFutureDesign;

  return {
    schema_version: "1.0",
    real_upload_readiness_gate_v2_id: safeValue(options.id, "real-upload-readiness-gate-v2-001"),
    real_upload_noop_wiring_smoke_test_result_id: smokeTest.real_upload_noop_wiring_smoke_test_result_id,
    real_upload_disabled_noop_wiring_activation_result_id: smokeTest.real_upload_disabled_noop_wiring_activation_result_id,
    real_upload_disabled_noop_wiring_activation_plan_id: smokeTest.real_upload_disabled_noop_wiring_activation_plan_id,
    real_upload_noop_wiring_contract_tests_id: "real-upload-noop-wiring-contract-tests-001",
    render_plan_id: smokeTest.render_plan_id,
    project_id: smokeTest.project_id,
    platform: smokeTest.platform,
    created_at: safeValue(options.created_at, "1970-01-01T00:00:00.000Z"),
    readiness_gate_state: state,
    readiness_gate_mode: mode,
    required_artifacts: {
      real_upload_noop_wiring_smoke_test_result_validated: true,
      real_upload_disabled_noop_wiring_activation_result_validated: true,
      real_upload_disabled_noop_wiring_activation_plan_validated: true,
      real_upload_noop_wiring_contract_tests_validated: true,
    },
    gate_scope: {
      future_real_upload_executor_adapter_design_requested: requestedFutureDesign,
      readiness_gate_only: true,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      runtime_wiring_changed_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    noop_wiring_review: {
      noop_wiring_smoke_test_complete: smokeTest.validation.noop_wiring_smoke_test_complete,
      noop_wiring_remains_disabled: true,
      runtime_invoked: false,
      upload_invoked: false,
      network_invoked: false,
      platform_api_invoked: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: blockingReasons,
      warnings: smokeTest.validation.warnings.map((warning) => sanitizeSafeSummary(warning, "Smoke-test warning was sanitized.")),
    },
    real_upload_remaining_gates: {
      executor_adapter_design_required: true,
      executor_contract_required: true,
      dry_run_adapter_required: true,
      credential_boundary_required: true,
      network_boundary_required: true,
      media_read_boundary_required: true,
      operator_final_checklist_required: true,
      real_upload_still_blocked: true,
      blocking_reasons: [REMAINING_REAL_UPLOAD_BLOCKER],
      warnings: [],
    },
    operator_review: operatorReview,
    execution_boundary: { ...DISABLED_REAL_UPLOAD_BOUNDARY },
    validation: {
      readiness_gate_v2_complete: complete,
      ready_for_future_real_upload_executor_adapter_design: readyForFutureDesign,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: blockingReasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createRealUploadReadinessGateV2",
      source_real_upload_noop_wiring_smoke_test_result_id: smokeTest.real_upload_noop_wiring_smoke_test_result_id,
      source_real_upload_disabled_noop_wiring_activation_result_id: smokeTest.real_upload_disabled_noop_wiring_activation_result_id,
      source_real_upload_disabled_noop_wiring_activation_plan_id: smokeTest.real_upload_disabled_noop_wiring_activation_plan_id,
      source_render_plan_id: smokeTest.render_plan_id,
    },
  };
}

export function rejectRealUploadReadinessGateV2(gate: RealUploadReadinessGateV2, reason?: string): RealUploadReadinessGateV2 {
  const warning = sanitizeSafeSummary(reason, "Readiness gate v2 was rejected.");
  return {
    ...gate,
    readiness_gate_state: "rejected",
    validation: {
      ...gate.validation,
      readiness_gate_v2_complete: false,
      ready_for_future_real_upload_executor_adapter_design: false,
      warnings: [...gate.validation.warnings, warning],
    },
    real_upload_remaining_gates: {
      ...gate.real_upload_remaining_gates,
      warnings: [...gate.real_upload_remaining_gates.warnings, warning],
    },
    execution_boundary: { ...DISABLED_REAL_UPLOAD_BOUNDARY },
  };
}

export function revokeRealUploadReadinessGateV2(gate: RealUploadReadinessGateV2, reason?: string): RealUploadReadinessGateV2 {
  const warning = sanitizeSafeSummary(reason, "Readiness gate v2 was revoked.");
  return {
    ...gate,
    readiness_gate_state: "revoked",
    validation: {
      ...gate.validation,
      readiness_gate_v2_complete: false,
      ready_for_future_real_upload_executor_adapter_design: false,
      warnings: [...gate.validation.warnings, warning],
    },
    real_upload_remaining_gates: {
      ...gate.real_upload_remaining_gates,
      warnings: [...gate.real_upload_remaining_gates.warnings, warning],
    },
    execution_boundary: { ...DISABLED_REAL_UPLOAD_BOUNDARY },
    provenance: {
      ...gate.provenance,
      generated_by: "revokeRealUploadReadinessGateV2",
    },
  };
}
