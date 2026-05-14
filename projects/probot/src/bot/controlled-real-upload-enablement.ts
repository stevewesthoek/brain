import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadEnablementReviewGate, RealUploadEnablementSafetyPlan, DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";

export type ControlledRealUploadEnablementState = "draft" | "ready_for_operator_review" | "approved_for_future_enablement_preflight" | "rejected" | "revoked" | "blocked";
export type ControlledRealUploadEnablementPreflightState = "draft" | "passed" | "failed" | "blocked" | "revoked";
export type ControlledRealUploadPreflightCheckState = "passed" | "failed" | "blocked" | "deferred";

export interface ControlledRealUploadEnablement {
  schema_version: "1.0";
  controlled_real_upload_enablement_id: string;
  real_upload_enablement_review_gate_id: string;
  real_upload_enablement_safety_plan_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  enablement_state: ControlledRealUploadEnablementState;
  required_artifacts: {
    real_upload_enablement_review_gate_validated: true;
    real_upload_enablement_safety_plan_validated: true;
  };
  enablement_scope: {
    controlled_enablement_artifact_only: true;
    future_enablement_preflight_requested: boolean;
    real_upload_enabled_now: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  controlled_enablement_controls: {
    single_upload_limit: 1;
    operator_kill_switch_required: true;
    dry_run_first_required: true;
    separate_runtime_activation_required: true;
    safe_reporting_required: true;
    real_upload_still_blocked: true;
  };
  execution_boundary: DisabledEnablementBoundary;
  validation: {
    complete: boolean;
    ready_for_next_phase: boolean;
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
    generated_by: "createControlledRealUploadEnablement" | "revokeControlledRealUploadEnablement";
    source_real_upload_enablement_review_gate_id: string;
    source_render_plan_id: string;
  };
}

export interface ControlledRealUploadEnablementPreflightCheck {
  check_id: string;
  check_kind: string;
  check_state: ControlledRealUploadPreflightCheckState;
  safe_summary: string;
  enabled_now: false;
}

export interface ControlledRealUploadEnablementPreflightResult {
  schema_version: "1.0";
  controlled_real_upload_enablement_preflight_result_id: string;
  controlled_real_upload_enablement_id: string;
  real_upload_enablement_review_gate_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  preflight_state: ControlledRealUploadEnablementPreflightState;
  required_artifacts: {
    controlled_real_upload_enablement_validated: true;
    real_upload_enablement_review_gate_validated: true;
  };
  preflight_scope: {
    preflight_only: true;
    future_runtime_activation_artifact_requested: boolean;
    real_upload_enabled_now: false;
    upload_execution_enabled_now: false;
    network_calls_enabled_now: false;
    platform_api_calls_enabled_now: false;
    credential_access_enabled_now: false;
    media_read_enabled_now: false;
    dependencies_requested: false;
    package_metadata_changes_requested: false;
  };
  preflight_checks: ControlledRealUploadEnablementPreflightCheck[];
  execution_boundary: DisabledEnablementBoundary;
  validation: {
    complete: boolean;
    ready_for_next_phase: boolean;
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
    generated_by: "createControlledRealUploadEnablementPreflightResult" | "revokeControlledRealUploadEnablementPreflightResult";
    source_controlled_real_upload_enablement_id: string;
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

const PREFLIGHT_CHECKS: Array<{ id: string; kind: string; summary: string }> = [
  { id: "kill-switch", kind: "kill_switch", summary: "Kill switch planned only." },
  { id: "single-upload", kind: "single_upload_limit", summary: "Single upload limit planned only." },
  { id: "credential", kind: "credential_boundary", summary: "Credential boundary planned only." },
  { id: "network", kind: "network_boundary", summary: "Network boundary planned only." },
  { id: "media", kind: "media_boundary", summary: "Media boundary planned only." },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function reviewGateReady(gate: RealUploadEnablementReviewGate): boolean {
  return (
    gate.review_gate_state === "approved_for_future_controlled_enablement_artifact" &&
    gate.validation.complete === true &&
    gate.validation.ready_for_next_phase === true &&
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

function safetyPlanReady(plan: RealUploadEnablementSafetyPlan): boolean {
  return (
    plan.safety_plan_state === "approved_for_future_enablement_review_gate" &&
    plan.validation.complete === true &&
    plan.validation.ready_for_next_phase === true &&
    plan.planned_enablement_controls.operator_kill_switch_required === true &&
    plan.planned_enablement_controls.single_upload_limit_required === true &&
    plan.planned_enablement_controls.real_upload_still_blocked === true &&
    plan.planned_runtime_boundaries.length >= 5 &&
    plan.planned_runtime_boundaries.every((boundary) => boundary.enabled_now === false)
  );
}

function controlledEnablementReady(enablement: ControlledRealUploadEnablement): boolean {
  return (
    enablement.enablement_state === "approved_for_future_enablement_preflight" &&
    enablement.validation.complete === true &&
    enablement.validation.ready_for_next_phase === true &&
    enablement.validation.ready_for_real_upload === false &&
    enablement.validation.real_upload_enabled === false &&
    enablement.validation.upload_allowed === false &&
    enablement.validation.network_calls_allowed === false &&
    enablement.validation.platform_api_calls_allowed === false &&
    enablement.validation.credentials_accessed === false &&
    enablement.validation.media_file_read === false &&
    enablement.controlled_enablement_controls.single_upload_limit === 1 &&
    enablement.controlled_enablement_controls.operator_kill_switch_required === true &&
    enablement.controlled_enablement_controls.real_upload_still_blocked === true
  );
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Controlled enablement prerequisite was not validated.")))];
}

function makePreflightChecks(passed: boolean): ControlledRealUploadEnablementPreflightCheck[] {
  return PREFLIGHT_CHECKS.map((check) => ({
    check_id: `preflight-${sanitizeSafeSummary(check.id, "check")}`,
    check_kind: sanitizeSafeSummary(check.kind, "controlled_preflight_check"),
    check_state: passed ? "passed" : "blocked",
    safe_summary: sanitizeSafeSummary(check.summary, "Controlled preflight check only."),
    enabled_now: false,
  }));
}

export function createControlledRealUploadEnablement(
  reviewGate: RealUploadEnablementReviewGate,
  safetyPlan: RealUploadEnablementSafetyPlan,
  options: { id?: string; created_at?: string; requestFutureEnablementPreflight?: boolean } = {},
): ControlledRealUploadEnablement {
  const ready = reviewGateReady(reviewGate) && safetyPlanReady(safetyPlan);
  const requestPreflight = options.requestFutureEnablementPreflight !== false;
  const complete = ready;
  const readyForNext = complete && requestPreflight;
  const reasons = blocking(ready, "Enablement review gate or safety plan was not ready for controlled enablement.", [...reviewGate.validation.blocking_reasons, ...safetyPlan.validation.blocking_reasons]);

  return {
    schema_version: "1.0",
    controlled_real_upload_enablement_id: safe(options.id, "controlled-real-upload-enablement-001"),
    real_upload_enablement_review_gate_id: reviewGate.real_upload_enablement_review_gate_id,
    real_upload_enablement_safety_plan_id: safetyPlan.real_upload_enablement_safety_plan_id,
    render_plan_id: reviewGate.render_plan_id,
    project_id: reviewGate.project_id,
    platform: reviewGate.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    enablement_state: readyForNext ? "approved_for_future_enablement_preflight" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: {
      real_upload_enablement_review_gate_validated: true,
      real_upload_enablement_safety_plan_validated: true,
    },
    enablement_scope: {
      controlled_enablement_artifact_only: true,
      future_enablement_preflight_requested: readyForNext,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    controlled_enablement_controls: {
      single_upload_limit: 1,
      operator_kill_switch_required: true,
      dry_run_first_required: true,
      separate_runtime_activation_required: true,
      safe_reporting_required: true,
      real_upload_still_blocked: true,
    },
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete,
      ready_for_next_phase: readyForNext,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: reasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createControlledRealUploadEnablement",
      source_real_upload_enablement_review_gate_id: reviewGate.real_upload_enablement_review_gate_id,
      source_render_plan_id: reviewGate.render_plan_id,
    },
  };
}

export function createControlledRealUploadEnablementPreflightResult(
  enablement: ControlledRealUploadEnablement,
  options: { id?: string; created_at?: string; requestFutureRuntimeActivationArtifact?: boolean } = {},
): ControlledRealUploadEnablementPreflightResult {
  const ready = controlledEnablementReady(enablement);
  const requestRuntimeActivationArtifact = options.requestFutureRuntimeActivationArtifact !== false;
  const complete = ready;
  const readyForNext = complete && requestRuntimeActivationArtifact;
  const reasons = blocking(ready, "Controlled real upload enablement was not ready for preflight.", enablement.validation.blocking_reasons);

  return {
    schema_version: "1.0",
    controlled_real_upload_enablement_preflight_result_id: safe(options.id, "controlled-real-upload-enablement-preflight-result-001"),
    controlled_real_upload_enablement_id: enablement.controlled_real_upload_enablement_id,
    real_upload_enablement_review_gate_id: enablement.real_upload_enablement_review_gate_id,
    render_plan_id: enablement.render_plan_id,
    project_id: enablement.project_id,
    platform: enablement.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    preflight_state: ready ? "passed" : "blocked",
    required_artifacts: {
      controlled_real_upload_enablement_validated: true,
      real_upload_enablement_review_gate_validated: true,
    },
    preflight_scope: {
      preflight_only: true,
      future_runtime_activation_artifact_requested: readyForNext,
      real_upload_enabled_now: false,
      upload_execution_enabled_now: false,
      network_calls_enabled_now: false,
      platform_api_calls_enabled_now: false,
      credential_access_enabled_now: false,
      media_read_enabled_now: false,
      dependencies_requested: false,
      package_metadata_changes_requested: false,
    },
    preflight_checks: makePreflightChecks(ready),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: {
      complete,
      ready_for_next_phase: readyForNext,
      ready_for_real_upload: false,
      real_upload_enabled: false,
      upload_allowed: false,
      network_calls_allowed: false,
      platform_api_calls_allowed: false,
      credentials_accessed: false,
      media_file_read: false,
      blocking_reasons: reasons,
      warnings: [],
    },
    provenance: {
      generated_by: "createControlledRealUploadEnablementPreflightResult",
      source_controlled_real_upload_enablement_id: enablement.controlled_real_upload_enablement_id,
      source_render_plan_id: enablement.render_plan_id,
    },
  };
}

export function revokeControlledRealUploadEnablement(enablement: ControlledRealUploadEnablement, reason?: string): ControlledRealUploadEnablement {
  const warning = sanitizeSafeSummary(reason, "Controlled real upload enablement was revoked.");
  return {
    ...enablement,
    enablement_state: "revoked",
    enablement_scope: { ...enablement.enablement_scope, future_enablement_preflight_requested: false },
    validation: { ...enablement.validation, complete: false, ready_for_next_phase: false, warnings: [...enablement.validation.warnings, warning] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...enablement.provenance, generated_by: "revokeControlledRealUploadEnablement" },
  };
}

export function revokeControlledRealUploadEnablementPreflightResult(
  result: ControlledRealUploadEnablementPreflightResult,
  reason?: string,
): ControlledRealUploadEnablementPreflightResult {
  const warning = sanitizeSafeSummary(reason, "Controlled real upload enablement preflight result was revoked.");
  return {
    ...result,
    preflight_state: "revoked",
    preflight_scope: { ...result.preflight_scope, future_runtime_activation_artifact_requested: false },
    preflight_checks: result.preflight_checks.map((check) => ({ ...check, check_state: "blocked" })),
    validation: { ...result.validation, complete: false, ready_for_next_phase: false, warnings: [...result.validation.warnings, warning] },
    execution_boundary: { ...DISABLED_BOUNDARY },
    provenance: { ...result.provenance, generated_by: "revokeControlledRealUploadEnablementPreflightResult" },
  };
}
