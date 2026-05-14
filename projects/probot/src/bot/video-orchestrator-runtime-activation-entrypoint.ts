import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

export type VideoOrchestratorRuntimeActivationEntrypointState = "disabled" | "blocked" | "revoked";

export interface VideoOrchestratorRuntimeActivationInput {
  request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  operator_approval_id: string;
  dry_run: true;
  runtime_enabled: false;
}

export interface VideoOrchestratorRuntimeActivationResult {
  schema_version: "1.0";
  request_id: string;
  project_id: string;
  render_plan_id: string;
  platform: string;
  operator_approval_id: string;
  entrypoint_state: VideoOrchestratorRuntimeActivationEntrypointState;
  runtime_entrypoint_defined: true;
  runtime_invoked: false;
  upload_executed: false;
  platform_api_called: false;
  network_called: false;
  credentials_accessed: false;
  token_accessed: false;
  keychain_accessed: false;
  env_accessed: false;
  media_read: false;
  contains_runtime_callable: false;
  contains_raw_payload: false;
  contains_raw_response: false;
  contains_secret_material: false;
  safe_summary: string;
  execution_boundary: DisabledEnablementBoundary;
  validation: {
    complete: boolean;
    ready_for_next_phase: false;
    ready_for_real_upload: false;
    blocking_reasons: string[];
    warnings: string[];
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

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function isSafeInput(input: VideoOrchestratorRuntimeActivationInput): boolean {
  return input.dry_run === true && input.runtime_enabled === false;
}

export function createDisabledVideoOrchestratorRuntimeActivationResult(
  input: VideoOrchestratorRuntimeActivationInput,
  options: { safe_summary?: string; warnings?: string[] } = {},
): VideoOrchestratorRuntimeActivationResult {
  const valid = isSafeInput(input);
  const blockingReasons = valid ? [] : ["Runtime activation input must remain dry-run and runtime-disabled."];
  return {
    schema_version: "1.0",
    request_id: safe(input.request_id, "runtime-activation-request"),
    project_id: safe(input.project_id, "project"),
    render_plan_id: safe(input.render_plan_id, "render-plan"),
    platform: safe(input.platform, "platform"),
    operator_approval_id: safe(input.operator_approval_id, "operator-approval"),
    entrypoint_state: valid ? "disabled" : "blocked",
    runtime_entrypoint_defined: true,
    runtime_invoked: false,
    upload_executed: false,
    platform_api_called: false,
    network_called: false,
    credentials_accessed: false,
    token_accessed: false,
    keychain_accessed: false,
    env_accessed: false,
    media_read: false,
    contains_runtime_callable: false,
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
    safe_summary: safe(options.safe_summary, "Runtime activation entrypoint is defined but disabled; no runtime or upload behavior executed."),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete: valid,
      ready_for_next_phase: false,
      ready_for_real_upload: false,
      blocking_reasons: blockingReasons,
      warnings: (options.warnings ?? []).map((warning) => safe(warning, "Runtime activation warning redacted.")),
    },
  };
}

export function revokeDisabledVideoOrchestratorRuntimeActivationResult(
  result: VideoOrchestratorRuntimeActivationResult,
  reason?: string,
): VideoOrchestratorRuntimeActivationResult {
  return {
    ...result,
    entrypoint_state: "revoked",
    runtime_invoked: false,
    upload_executed: false,
    platform_api_called: false,
    network_called: false,
    credentials_accessed: false,
    token_accessed: false,
    keychain_accessed: false,
    env_accessed: false,
    media_read: false,
    contains_runtime_callable: false,
    contains_raw_payload: false,
    contains_raw_response: false,
    contains_secret_material: false,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete: false,
      ready_for_next_phase: false,
      ready_for_real_upload: false,
      blocking_reasons: result.validation.blocking_reasons,
      warnings: [...result.validation.warnings, safe(reason, "Runtime activation entrypoint result was revoked.")],
    },
  };
}
