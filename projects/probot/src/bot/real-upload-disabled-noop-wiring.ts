export type DisabledNoopActivationResultState = "disabled_noop_activation_recorded" | "blocked" | "revoked";
export type NoopWiringSmokeTestState = "passed_noop_disabled" | "blocked" | "revoked";

export interface RealUploadDisabledNoopWiringActivationPlanRef {
  real_upload_disabled_noop_wiring_activation_plan_id: string;
  real_upload_noop_wiring_readiness_review_id: string;
  real_upload_noop_wiring_contract_tests_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
}

export interface RealUploadDisabledNoopWiringActivationResult {
  schema_version: "1.0";
  real_upload_disabled_noop_wiring_activation_result_id: string;
  real_upload_disabled_noop_wiring_activation_plan_id: string;
  real_upload_noop_wiring_readiness_review_id: string;
  real_upload_noop_wiring_contract_tests_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  activation_result_state: DisabledNoopActivationResultState;
  required_artifacts: {
    real_upload_disabled_noop_wiring_activation_plan_validated: true;
    real_upload_noop_wiring_readiness_review_validated: true;
    real_upload_noop_wiring_contract_tests_validated: true;
  };
  activation_scope: {
    disabled_noop_activation_only: true;
    activation_recorded: boolean;
    activation_applied_to_runtime: false;
    runtime_feature_flag_created: false;
    runtime_feature_flag_enabled: false;
    production_imports_applied: false;
    automatic_invocation_enabled: false;
    live_execution_path_changed: false;
    upload_execution_path_changed: false;
    real_upload_requested: false;
  };
  disabled_activation_summary: {
    disabled_by_default: true;
    operator_activation_required: true;
    kill_switch_available: true;
    noop_wiring_available_for_future_tests: boolean;
    safe_summary: string;
    blocking_reasons: string[];
    warnings: string[];
  };
  kill_switch_status: {
    default_state_disabled: true;
    emergency_disable_supported: true;
    operator_reversible: true;
    credentials_required_for_disable: false;
    network_required_for_disable: false;
  };
  execution_boundary: DisabledNoopExecutionBoundary;
  validation: {
    disabled_noop_wiring_activation_complete: boolean;
    ready_for_future_noop_wiring_smoke_test: boolean;
    ready_for_real_upload: false;
    runtime_enabled: false;
    upload_allowed: false;
    network_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealUploadDisabledNoopWiringActivationResult" | "revokeRealUploadDisabledNoopWiringActivationResult";
    source_real_upload_disabled_noop_wiring_activation_plan_id: string;
    source_real_upload_noop_wiring_readiness_review_id: string;
    source_real_upload_noop_wiring_contract_tests_id: string;
    source_render_plan_id: string;
  };
}

export interface DisabledNoopExecutionBoundary {
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
  ready_for_real_upload: false;
}

export interface RealUploadNoopWiringSmokeTestResult {
  schema_version: "1.0";
  real_upload_noop_wiring_smoke_test_result_id: string;
  real_upload_disabled_noop_wiring_activation_result_id: string;
  real_upload_disabled_noop_wiring_activation_plan_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  smoke_test_state: NoopWiringSmokeTestState;
  required_artifacts: {
    real_upload_disabled_noop_wiring_activation_result_validated: true;
    real_upload_disabled_noop_wiring_activation_plan_validated: true;
  };
  smoke_test_scope: {
    noop_smoke_test_only: true;
    runtime_invoked: false;
    production_path_invoked: false;
    upload_invoked: false;
    network_invoked: false;
    platform_api_invoked: false;
    credentials_accessed: false;
    media_file_read: false;
    file_mutation_allowed: false;
  };
  noop_wiring_checks: NoopWiringSmokeTestCheck[];
  execution_boundary: DisabledNoopExecutionBoundary;
  validation: {
    noop_wiring_smoke_test_complete: boolean;
    ready_for_future_real_upload_readiness_gate_v2: boolean;
    ready_for_real_upload: false;
    runtime_enabled: false;
    upload_allowed: false;
    network_calls_allowed: false;
    credentials_accessed: false;
    media_file_read: false;
    blocking_reasons: string[];
    warnings: string[];
  };
  provenance: {
    generated_by: "createRealUploadNoopWiringSmokeTestResult" | "revokeRealUploadNoopWiringSmokeTestResult";
    source_real_upload_disabled_noop_wiring_activation_result_id: string;
    source_real_upload_disabled_noop_wiring_activation_plan_id: string;
    source_render_plan_id: string;
  };
}

export interface NoopWiringSmokeTestCheck {
  check_id: string;
  check_kind: string;
  check_state: "passed" | "blocked" | "deferred";
  safe_summary: string;
  runtime_invoked: false;
  upload_invoked: false;
  network_invoked: false;
  credential_invoked: false;
  media_read_invoked: false;
  file_mutation_invoked: false;
  blocking_reasons: string[];
  warnings: string[];
}

const DISABLED_BOUNDARY: DisabledNoopExecutionBoundary = {
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
  ready_for_real_upload: false,
};

const FALLBACK_SUMMARY = "Real upload disabled no-op wiring remains inert.";

function safeId(value: string, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return sanitizeSafeSummary(text || fallback, fallback);
}

export function sanitizeSafeSummary(summary?: string, fallback = FALLBACK_SUMMARY): string {
  if (typeof summary !== "string") return fallback;
  const text = summary.trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  const forbidden = [
    "://",
    "..",
    "stdout",
    "stderr",
    "process.env",
    "access_token",
    "refresh_token",
    "client_secret",
    "client_id",
    "code_verifier",
    "authorization_code",
    "bearer",
    "videos.insert",
    "youtube.videos().insert",
    "fetch(",
    "curl ",
    "token",
    "secret",
    "keychain://",
    "/users/",
    "\\users\\",
  ];
  if (forbidden.some((pattern) => lower.includes(pattern))) return fallback;
  return text.length > 180 ? text.slice(0, 180) : text;
}

function buildBlockingReasons(blocked: boolean): string[] {
  return blocked ? ["Required disabled no-op wiring prerequisite was not validated."] : [];
}

export function createRealUploadDisabledNoopWiringActivationResult(
  plan: RealUploadDisabledNoopWiringActivationPlanRef,
  options: { id?: string; created_at?: string; prerequisites_validated?: boolean; safe_summary?: string } = {},
): RealUploadDisabledNoopWiringActivationResult {
  const prerequisitesValidated = options.prerequisites_validated !== false;
  const state: DisabledNoopActivationResultState = prerequisitesValidated ? "disabled_noop_activation_recorded" : "blocked";
  const blockingReasons = buildBlockingReasons(!prerequisitesValidated);

  return {
    schema_version: "1.0",
    real_upload_disabled_noop_wiring_activation_result_id: safeId(options.id ?? "real-upload-disabled-noop-wiring-activation-result-001", "real-upload-disabled-noop-wiring-activation-result"),
    real_upload_disabled_noop_wiring_activation_plan_id: safeId(plan.real_upload_disabled_noop_wiring_activation_plan_id, "real-upload-disabled-noop-wiring-activation-plan"),
    real_upload_noop_wiring_readiness_review_id: safeId(plan.real_upload_noop_wiring_readiness_review_id, "real-upload-noop-wiring-readiness-review"),
    real_upload_noop_wiring_contract_tests_id: safeId(plan.real_upload_noop_wiring_contract_tests_id, "real-upload-noop-wiring-contract-tests"),
    render_plan_id: safeId(plan.render_plan_id, "render-plan"),
    project_id: safeId(plan.project_id, "project"),
    platform: safeId(plan.platform, "manual"),
    created_at: sanitizeSafeSummary(options.created_at, "1970-01-01T00:00:00.000Z"),
    activation_result_state: state,
    required_artifacts: {
      real_upload_disabled_noop_wiring_activation_plan_validated: true,
      real_upload_noop_wiring_readiness_review_validated: true,
      real_upload_noop_wiring_contract_tests_validated: true,
    },
    activation_scope: {
      disabled_noop_activation_only: true,
      activation_recorded: prerequisitesValidated,
      activation_applied_to_runtime: false,
      runtime_feature_flag_created: false,
      runtime_feature_flag_enabled: false,
      production_imports_applied: false,
      automatic_invocation_enabled: false,
      live_execution_path_changed: false,
      upload_execution_path_changed: false,
      real_upload_requested: false,
    },
    disabled_activation_summary: {
      disabled_by_default: true,
      operator_activation_required: true,
      kill_switch_available: true,
      noop_wiring_available_for_future_tests: prerequisitesValidated,
      safe_summary: sanitizeSafeSummary(options.safe_summary, "Disabled no-op wiring activation was recorded without runtime wiring."),
      blocking_reasons: blockingReasons,
      warnings: [],
    },
    kill_switch_status: {
      default_state_disabled: true,
      emergency_disable_supported: true,
      operator_reversible: true,
      credentials_required_for_disable: false,
      network_required_for_disable: false,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      disabled_noop_wiring_activation_complete: prerequisitesValidated,
      ready_for_future_noop_wiring_smoke_test: prerequisitesValidated,
      ready_for_real_upload: false,
      runtime_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: blockingReasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createRealUploadDisabledNoopWiringActivationResult",
      source_real_upload_disabled_noop_wiring_activation_plan_id: safeId(plan.real_upload_disabled_noop_wiring_activation_plan_id, "real-upload-disabled-noop-wiring-activation-plan"),
      source_real_upload_noop_wiring_readiness_review_id: safeId(plan.real_upload_noop_wiring_readiness_review_id, "real-upload-noop-wiring-readiness-review"),
      source_real_upload_noop_wiring_contract_tests_id: safeId(plan.real_upload_noop_wiring_contract_tests_id, "real-upload-noop-wiring-contract-tests"),
      source_render_plan_id: safeId(plan.render_plan_id, "render-plan"),
    },
  };
}

export function revokeRealUploadDisabledNoopWiringActivationResult(
  result: RealUploadDisabledNoopWiringActivationResult,
  reason?: string,
): RealUploadDisabledNoopWiringActivationResult {
  const warning = sanitizeSafeSummary(reason, "Disabled no-op activation result was revoked.");
  return {
    ...result,
    activation_result_state: "revoked",
    activation_scope: { ...result.activation_scope, activation_recorded: false },
    disabled_activation_summary: {
      ...result.disabled_activation_summary,
      noop_wiring_available_for_future_tests: false,
      warnings: [...result.disabled_activation_summary.warnings, warning],
    },
    validation: {
      ...result.validation,
      disabled_noop_wiring_activation_complete: false,
      ready_for_future_noop_wiring_smoke_test: false,
      warnings: [...result.validation.warnings, warning],
    },
    provenance: {
      ...result.provenance,
      generated_by: "revokeRealUploadDisabledNoopWiringActivationResult",
    },
  };
}

export function createRealUploadNoopWiringSmokeTestResult(
  activationResult: RealUploadDisabledNoopWiringActivationResult,
  options: { id?: string; created_at?: string; check_kinds?: string[]; safe_summary?: string } = {},
): RealUploadNoopWiringSmokeTestResult {
  const activationReady = activationResult.validation.ready_for_future_noop_wiring_smoke_test === true && activationResult.activation_result_state === "disabled_noop_activation_recorded";
  const blockingReasons = buildBlockingReasons(!activationReady);
  const checkKinds = options.check_kinds?.length ? options.check_kinds : ["disabled_import_boundary", "disabled_runtime_boundary", "disabled_upload_boundary", "safe_status_boundary"];

  return {
    schema_version: "1.0",
    real_upload_noop_wiring_smoke_test_result_id: safeId(options.id ?? "real-upload-noop-wiring-smoke-test-result-001", "real-upload-noop-wiring-smoke-test-result"),
    real_upload_disabled_noop_wiring_activation_result_id: activationResult.real_upload_disabled_noop_wiring_activation_result_id,
    real_upload_disabled_noop_wiring_activation_plan_id: activationResult.real_upload_disabled_noop_wiring_activation_plan_id,
    render_plan_id: activationResult.render_plan_id,
    project_id: activationResult.project_id,
    platform: activationResult.platform,
    created_at: sanitizeSafeSummary(options.created_at, "1970-01-01T00:00:00.000Z"),
    smoke_test_state: activationReady ? "passed_noop_disabled" : "blocked",
    required_artifacts: {
      real_upload_disabled_noop_wiring_activation_result_validated: true,
      real_upload_disabled_noop_wiring_activation_plan_validated: true,
    },
    smoke_test_scope: {
      noop_smoke_test_only: true,
      runtime_invoked: false,
      production_path_invoked: false,
      upload_invoked: false,
      network_invoked: false,
      platform_api_invoked: false,
      credentials_accessed: false,
      media_file_read: false,
      file_mutation_allowed: false,
    },
    noop_wiring_checks: checkKinds.map((kind, index) => ({
      check_id: `noop-wiring-check-${index + 1}`,
      check_kind: sanitizeSafeSummary(kind, "disabled_noop_boundary"),
      check_state: activationReady ? "passed" : "blocked",
      safe_summary: sanitizeSafeSummary(options.safe_summary, "No-op wiring boundary remains disabled and inert."),
      runtime_invoked: false,
      upload_invoked: false,
      network_invoked: false,
      credential_invoked: false,
      media_read_invoked: false,
      file_mutation_invoked: false,
      blocking_reasons: blockingReasons,
      warnings: [],
    })),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      noop_wiring_smoke_test_complete: activationReady,
      ready_for_future_real_upload_readiness_gate_v2: activationReady,
      ready_for_real_upload: false,
      runtime_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: blockingReasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createRealUploadNoopWiringSmokeTestResult",
      source_real_upload_disabled_noop_wiring_activation_result_id: activationResult.real_upload_disabled_noop_wiring_activation_result_id,
      source_real_upload_disabled_noop_wiring_activation_plan_id: activationResult.real_upload_disabled_noop_wiring_activation_plan_id,
      source_render_plan_id: activationResult.render_plan_id,
    },
  };
}

export function revokeRealUploadNoopWiringSmokeTestResult(
  result: RealUploadNoopWiringSmokeTestResult,
  reason?: string,
): RealUploadNoopWiringSmokeTestResult {
  const warning = sanitizeSafeSummary(reason, "No-op wiring smoke test result was revoked.");
  return {
    ...result,
    smoke_test_state: "revoked",
    noop_wiring_checks: result.noop_wiring_checks.map((check) => ({
      ...check,
      check_state: "blocked",
      warnings: [...check.warnings, warning],
    })),
    validation: {
      ...result.validation,
      noop_wiring_smoke_test_complete: false,
      ready_for_future_real_upload_readiness_gate_v2: false,
      warnings: [...result.validation.warnings, warning],
    },
    provenance: {
      ...result.provenance,
      generated_by: "revokeRealUploadNoopWiringSmokeTestResult",
    },
  };
}
