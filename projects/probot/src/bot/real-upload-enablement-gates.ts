import { sanitizeSafeSummary } from "./real-upload-disabled-noop-wiring.js";
import type { RealUploadFinalOperatorChecklist } from "./real-upload-final-operator-checklist.js";

export type EnablementRequestState = "draft" | "ready_for_operator_review" | "approved_for_future_enablement_safety_plan" | "rejected" | "revoked" | "blocked";
export type EnablementSafetyPlanState = "draft" | "ready_for_operator_review" | "approved_for_future_enablement_review_gate" | "rejected" | "revoked" | "blocked";
export type EnablementReviewGateState = "draft" | "ready_for_operator_review" | "approved_for_future_controlled_enablement_artifact" | "rejected" | "revoked" | "blocked";

export interface DisabledEnablementBoundary {
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

export interface EnablementRequestAcknowledgementsInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_request_only?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_future_safety_plan_required?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_media_reads?: boolean;
  understands_no_platform_api_calls?: boolean;
  decision_note_summary?: string;
}

export interface EnablementReviewGateAcknowledgementsInput {
  reviewed_by_label?: string;
  checklist_acknowledged?: boolean;
  understands_review_gate_only?: boolean;
  understands_real_upload_not_enabled?: boolean;
  understands_future_controlled_enablement_artifact_required?: boolean;
  understands_no_credentials_accessed?: boolean;
  understands_no_network_calls?: boolean;
  understands_no_media_reads?: boolean;
  understands_no_platform_api_calls?: boolean;
  decision_note_summary?: string;
}

export interface PlannedRuntimeBoundary {
  boundary_id: string;
  boundary_kind: string;
  safe_summary: string;
  enabled_now: false;
}

export interface RealUploadEnablementRequest {
  schema_version: "1.0";
  real_upload_enablement_request_id: string;
  real_upload_final_operator_checklist_id: string;
  real_upload_dry_run_adapter_contract_tests_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  enablement_request_state: EnablementRequestState;
  required_artifacts: { real_upload_final_operator_checklist_validated: true; real_upload_dry_run_adapter_contract_tests_validated: true };
  request_scope: { enablement_request_only: true; future_enablement_safety_plan_requested: boolean; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  requested_boundaries: { explicit_credential_boundary_requested: true; explicit_network_boundary_requested: true; explicit_media_read_boundary_requested: true; explicit_platform_api_boundary_requested: true; explicit_kill_switch_requested: true; separate_activation_commit_required: true; real_upload_still_blocked: true };
  operator_acknowledgements: Required<EnablementRequestAcknowledgementsInput>;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; real_upload_enabled: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadEnablementRequest" | "revokeRealUploadEnablementRequest"; source_real_upload_final_operator_checklist_id: string; source_render_plan_id: string };
}

export interface RealUploadEnablementSafetyPlan {
  schema_version: "1.0";
  real_upload_enablement_safety_plan_id: string;
  real_upload_enablement_request_id: string;
  real_upload_final_operator_checklist_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  safety_plan_state: EnablementSafetyPlanState;
  required_artifacts: { real_upload_enablement_request_validated: true; real_upload_final_operator_checklist_validated: true };
  plan_scope: { safety_plan_only: true; future_enablement_review_gate_requested: boolean; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  planned_enablement_controls: { separate_activation_commit_required: true; operator_kill_switch_required: true; dry_run_first_required: true; single_upload_limit_required: true; safe_reporting_required: true; real_upload_still_blocked: true };
  planned_runtime_boundaries: PlannedRuntimeBoundary[];
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; real_upload_enabled: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadEnablementSafetyPlan" | "revokeRealUploadEnablementSafetyPlan"; source_real_upload_enablement_request_id: string; source_render_plan_id: string };
}

export interface RealUploadEnablementReviewGate {
  schema_version: "1.0";
  real_upload_enablement_review_gate_id: string;
  real_upload_enablement_safety_plan_id: string;
  real_upload_enablement_request_id: string;
  render_plan_id: string;
  project_id: string;
  platform: string;
  created_at: string;
  review_gate_state: EnablementReviewGateState;
  required_artifacts: { real_upload_enablement_safety_plan_validated: true; real_upload_enablement_request_validated: true };
  review_scope: { review_gate_only: true; future_controlled_enablement_artifact_requested: boolean; real_upload_enabled_now: false; upload_execution_enabled_now: false; network_calls_enabled_now: false; platform_api_calls_enabled_now: false; credential_access_enabled_now: false; media_read_enabled_now: false; dependencies_requested: false; package_metadata_changes_requested: false };
  review_findings: { safety_plan_complete: boolean; enablement_request_complete: boolean; kill_switch_planned: true; single_upload_limit_planned: true; real_upload_still_blocked: true; blocking_reasons: string[]; warnings: string[] };
  operator_acknowledgements: Required<EnablementReviewGateAcknowledgementsInput>;
  execution_boundary: DisabledEnablementBoundary;
  validation: { complete: boolean; ready_for_next_phase: boolean; ready_for_real_upload: false; real_upload_enabled: false; upload_allowed: false; network_calls_allowed: false; platform_api_calls_allowed: false; credentials_accessed: false; media_file_read: false; blocking_reasons: string[]; warnings: string[] };
  provenance: { generated_by: "createRealUploadEnablementReviewGate" | "revokeRealUploadEnablementReviewGate"; source_real_upload_enablement_safety_plan_id: string; source_render_plan_id: string };
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

const PLANNED_BOUNDARIES: PlannedRuntimeBoundary[] = [
  { boundary_id: "boundary-credential", boundary_kind: "credential", safe_summary: "Credential boundary planned only.", enabled_now: false },
  { boundary_id: "boundary-network", boundary_kind: "network", safe_summary: "Network boundary planned only.", enabled_now: false },
  { boundary_id: "boundary-platform-api", boundary_kind: "platform_api", safe_summary: "Platform API boundary planned only.", enabled_now: false },
  { boundary_id: "boundary-media", boundary_kind: "media_read", safe_summary: "Media read boundary planned only.", enabled_now: false },
  { boundary_id: "boundary-kill-switch", boundary_kind: "kill_switch", safe_summary: "Kill switch planned only.", enabled_now: false },
];

function safe(value: string | undefined, fallback: string): string {
  return sanitizeSafeSummary(value, fallback);
}

function normalizeRequestAck(input: EnablementRequestAcknowledgementsInput = {}): Required<EnablementRequestAcknowledgementsInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_request_only: input.understands_request_only === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_future_safety_plan_required: input.understands_future_safety_plan_required === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    decision_note_summary: safe(input.decision_note_summary, "Enablement request only. Real upload remains disabled."),
  };
}

function normalizeReviewAck(input: EnablementReviewGateAcknowledgementsInput = {}): Required<EnablementReviewGateAcknowledgementsInput> {
  return {
    reviewed_by_label: safe(input.reviewed_by_label, "operator-review-pending"),
    checklist_acknowledged: input.checklist_acknowledged === true,
    understands_review_gate_only: input.understands_review_gate_only === true,
    understands_real_upload_not_enabled: input.understands_real_upload_not_enabled === true,
    understands_future_controlled_enablement_artifact_required: input.understands_future_controlled_enablement_artifact_required === true,
    understands_no_credentials_accessed: input.understands_no_credentials_accessed === true,
    understands_no_network_calls: input.understands_no_network_calls === true,
    understands_no_media_reads: input.understands_no_media_reads === true,
    understands_no_platform_api_calls: input.understands_no_platform_api_calls === true,
    decision_note_summary: safe(input.decision_note_summary, "Review gate only. Real upload remains disabled."),
  };
}

function requestAckComplete(ack: Required<EnablementRequestAcknowledgementsInput>): boolean {
  return ack.checklist_acknowledged && ack.understands_request_only && ack.understands_real_upload_not_enabled && ack.understands_future_safety_plan_required && ack.understands_no_credentials_accessed && ack.understands_no_network_calls && ack.understands_no_media_reads && ack.understands_no_platform_api_calls;
}

function reviewAckComplete(ack: Required<EnablementReviewGateAcknowledgementsInput>): boolean {
  return ack.checklist_acknowledged && ack.understands_review_gate_only && ack.understands_real_upload_not_enabled && ack.understands_future_controlled_enablement_artifact_required && ack.understands_no_credentials_accessed && ack.understands_no_network_calls && ack.understands_no_media_reads && ack.understands_no_platform_api_calls;
}

function checklistReady(checklist: RealUploadFinalOperatorChecklist): boolean {
  return checklist.final_checklist_state === "approved_for_future_real_upload_enablement_request" && checklist.validation.complete && checklist.validation.ready_for_next_phase && !checklist.validation.ready_for_real_upload && !checklist.validation.real_upload_enabled && !checklist.validation.upload_allowed && !checklist.validation.network_calls_allowed && !checklist.validation.platform_api_calls_allowed && !checklist.validation.credentials_accessed && !checklist.validation.media_file_read;
}

function requestReady(request: RealUploadEnablementRequest): boolean {
  return request.enablement_request_state === "approved_for_future_enablement_safety_plan" && request.validation.complete && request.validation.ready_for_next_phase && !request.validation.ready_for_real_upload && !request.validation.real_upload_enabled && !request.validation.upload_allowed && !request.validation.network_calls_allowed && !request.validation.platform_api_calls_allowed && !request.validation.credentials_accessed && !request.validation.media_file_read;
}

function safetyPlanReady(plan: RealUploadEnablementSafetyPlan): boolean {
  return plan.safety_plan_state === "approved_for_future_enablement_review_gate" && plan.validation.complete && plan.validation.ready_for_next_phase && plan.planned_runtime_boundaries.length >= 5 && plan.planned_runtime_boundaries.every((boundary) => boundary.enabled_now === false);
}

function blocking(ready: boolean, message: string, upstream: string[] = []): string[] {
  if (ready) return [];
  return [...new Set([...upstream, message].map((reason) => sanitizeSafeSummary(reason, "Enablement prerequisite was not validated.")))];
}

export function createRealUploadEnablementRequest(
  checklist: RealUploadFinalOperatorChecklist,
  options: { id?: string; created_at?: string; acknowledgements?: EnablementRequestAcknowledgementsInput; requestFutureSafetyPlan?: boolean } = {},
): RealUploadEnablementRequest {
  const ready = checklistReady(checklist);
  const ack = normalizeRequestAck(options.acknowledgements);
  const ackReady = requestAckComplete(ack);
  const requestSafetyPlan = options.requestFutureSafetyPlan !== false;
  const complete = ready && ackReady;
  const readyForNext = complete && requestSafetyPlan;
  const reasons = blocking(ready, "Final operator checklist was not ready for enablement request.", checklist.validation.blocking_reasons);
  let state: EnablementRequestState = "blocked";
  if (ready && ackReady && requestSafetyPlan) state = "approved_for_future_enablement_safety_plan";
  else if (ready) state = "ready_for_operator_review";

  return {
    schema_version: "1.0",
    real_upload_enablement_request_id: safe(options.id, "real-upload-enablement-request-001"),
    real_upload_final_operator_checklist_id: checklist.real_upload_final_operator_checklist_id,
    real_upload_dry_run_adapter_contract_tests_id: checklist.real_upload_dry_run_adapter_contract_tests_id,
    render_plan_id: checklist.render_plan_id,
    project_id: checklist.project_id,
    platform: checklist.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    enablement_request_state: state,
    required_artifacts: { real_upload_final_operator_checklist_validated: true, real_upload_dry_run_adapter_contract_tests_validated: true },
    request_scope: { enablement_request_only: true, future_enablement_safety_plan_requested: readyForNext, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    requested_boundaries: { explicit_credential_boundary_requested: true, explicit_network_boundary_requested: true, explicit_media_read_boundary_requested: true, explicit_platform_api_boundary_requested: true, explicit_kill_switch_requested: true, separate_activation_commit_required: true, real_upload_still_blocked: true },
    operator_acknowledgements: ack,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete, ready_for_next_phase: readyForNext, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: ready ? [] : reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadEnablementRequest", source_real_upload_final_operator_checklist_id: checklist.real_upload_final_operator_checklist_id, source_render_plan_id: checklist.render_plan_id },
  };
}

export function createRealUploadEnablementSafetyPlan(
  request: RealUploadEnablementRequest,
  options: { id?: string; created_at?: string; requestFutureReviewGate?: boolean } = {},
): RealUploadEnablementSafetyPlan {
  const ready = requestReady(request);
  const requestReviewGate = options.requestFutureReviewGate !== false;
  const complete = ready;
  const readyForNext = complete && requestReviewGate;
  const reasons = blocking(ready, "Enablement request was not ready for safety plan.", request.validation.blocking_reasons);
  return {
    schema_version: "1.0",
    real_upload_enablement_safety_plan_id: safe(options.id, "real-upload-enablement-safety-plan-001"),
    real_upload_enablement_request_id: request.real_upload_enablement_request_id,
    real_upload_final_operator_checklist_id: request.real_upload_final_operator_checklist_id,
    render_plan_id: request.render_plan_id,
    project_id: request.project_id,
    platform: request.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    safety_plan_state: readyForNext ? "approved_for_future_enablement_review_gate" : ready ? "ready_for_operator_review" : "blocked",
    required_artifacts: { real_upload_enablement_request_validated: true, real_upload_final_operator_checklist_validated: true },
    plan_scope: { safety_plan_only: true, future_enablement_review_gate_requested: readyForNext, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    planned_enablement_controls: { separate_activation_commit_required: true, operator_kill_switch_required: true, dry_run_first_required: true, single_upload_limit_required: true, safe_reporting_required: true, real_upload_still_blocked: true },
    planned_runtime_boundaries: PLANNED_BOUNDARIES.map((boundary) => ({ ...boundary })),
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete, ready_for_next_phase: readyForNext, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: ready ? [] : reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadEnablementSafetyPlan", source_real_upload_enablement_request_id: request.real_upload_enablement_request_id, source_render_plan_id: request.render_plan_id },
  };
}

export function createRealUploadEnablementReviewGate(
  safetyPlan: RealUploadEnablementSafetyPlan,
  request: RealUploadEnablementRequest,
  options: { id?: string; created_at?: string; acknowledgements?: EnablementReviewGateAcknowledgementsInput; requestFutureControlledEnablementArtifact?: boolean } = {},
): RealUploadEnablementReviewGate {
  const planReady = safetyPlanReady(safetyPlan);
  const reqReady = requestReady(request);
  const ack = normalizeReviewAck(options.acknowledgements);
  const ackReady = reviewAckComplete(ack);
  const requestControlledArtifact = options.requestFutureControlledEnablementArtifact !== false;
  const complete = planReady && reqReady && ackReady;
  const readyForNext = complete && requestControlledArtifact;
  const reasons = blocking(planReady && reqReady, "Enablement safety plan or request was not ready for review gate.", [...safetyPlan.validation.blocking_reasons, ...request.validation.blocking_reasons]);
  let state: EnablementReviewGateState = "blocked";
  if (planReady && reqReady && ackReady && requestControlledArtifact) state = "approved_for_future_controlled_enablement_artifact";
  else if (planReady && reqReady) state = "ready_for_operator_review";

  return {
    schema_version: "1.0",
    real_upload_enablement_review_gate_id: safe(options.id, "real-upload-enablement-review-gate-001"),
    real_upload_enablement_safety_plan_id: safetyPlan.real_upload_enablement_safety_plan_id,
    real_upload_enablement_request_id: request.real_upload_enablement_request_id,
    render_plan_id: safetyPlan.render_plan_id,
    project_id: safetyPlan.project_id,
    platform: safetyPlan.platform,
    created_at: safe(options.created_at, "1970-01-01T00:00:00.000Z"),
    review_gate_state: state,
    required_artifacts: { real_upload_enablement_safety_plan_validated: true, real_upload_enablement_request_validated: true },
    review_scope: { review_gate_only: true, future_controlled_enablement_artifact_requested: readyForNext, real_upload_enabled_now: false, upload_execution_enabled_now: false, network_calls_enabled_now: false, platform_api_calls_enabled_now: false, credential_access_enabled_now: false, media_read_enabled_now: false, dependencies_requested: false, package_metadata_changes_requested: false },
    review_findings: { safety_plan_complete: planReady, enablement_request_complete: reqReady, kill_switch_planned: true, single_upload_limit_planned: true, real_upload_still_blocked: true, blocking_reasons: reasons, warnings: [] },
    operator_acknowledgements: ack,
    execution_boundary: { ...DISABLED_BOUNDARY },
    validation: { complete, ready_for_next_phase: readyForNext, ready_for_real_upload: false, real_upload_enabled: false, upload_allowed: false, network_calls_allowed: false, platform_api_calls_allowed: false, credentials_accessed: false, media_file_read: false, blocking_reasons: reasons, warnings: [] },
    provenance: { generated_by: "createRealUploadEnablementReviewGate", source_real_upload_enablement_safety_plan_id: safetyPlan.real_upload_enablement_safety_plan_id, source_render_plan_id: safetyPlan.render_plan_id },
  };
}

export function revokeRealUploadEnablementRequest(request: RealUploadEnablementRequest, reason?: string): RealUploadEnablementRequest {
  const warning = sanitizeSafeSummary(reason, "Enablement request was revoked.");
  return { ...request, enablement_request_state: "revoked", request_scope: { ...request.request_scope, future_enablement_safety_plan_requested: false }, validation: { ...request.validation, complete: false, ready_for_next_phase: false, warnings: [...request.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...request.provenance, generated_by: "revokeRealUploadEnablementRequest" } };
}

export function revokeRealUploadEnablementSafetyPlan(plan: RealUploadEnablementSafetyPlan, reason?: string): RealUploadEnablementSafetyPlan {
  const warning = sanitizeSafeSummary(reason, "Enablement safety plan was revoked.");
  return { ...plan, safety_plan_state: "revoked", plan_scope: { ...plan.plan_scope, future_enablement_review_gate_requested: false }, validation: { ...plan.validation, complete: false, ready_for_next_phase: false, warnings: [...plan.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...plan.provenance, generated_by: "revokeRealUploadEnablementSafetyPlan" } };
}

export function revokeRealUploadEnablementReviewGate(gate: RealUploadEnablementReviewGate, reason?: string): RealUploadEnablementReviewGate {
  const warning = sanitizeSafeSummary(reason, "Enablement review gate was revoked.");
  return { ...gate, review_gate_state: "revoked", review_scope: { ...gate.review_scope, future_controlled_enablement_artifact_requested: false }, validation: { ...gate.validation, complete: false, ready_for_next_phase: false, warnings: [...gate.validation.warnings, warning] }, execution_boundary: { ...DISABLED_BOUNDARY }, provenance: { ...gate.provenance, generated_by: "revokeRealUploadEnablementReviewGate" } };
}
