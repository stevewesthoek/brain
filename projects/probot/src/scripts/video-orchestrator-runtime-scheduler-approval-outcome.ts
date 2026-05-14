import type { RuntimeSchedulerManualApprovalChecklist } from "./video-orchestrator-runtime-scheduler-manual-approval-checklist.js";

export type RuntimeSchedulerApprovalOutcomeDecision = "approved_for_package_script_planning" | "deferred" | "rejected";
export type RuntimeSchedulerApprovalOutcomeState = "recorded_for_manual_follow_up" | "blocked" | "revoked";

export interface RuntimeSchedulerApprovalOutcomeInput {
  outcome_id: string;
  operator_id: string;
  decision: RuntimeSchedulerApprovalOutcomeDecision;
  rationale: string;
  allow_outcome_only: true;
  allow_package_json_edit: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerApprovalOutcome {
  schema_version: "1.0";
  outcome_id: string;
  outcome_state: RuntimeSchedulerApprovalOutcomeState;
  outcome_only: true;
  decision: RuntimeSchedulerApprovalOutcomeDecision;
  rationale: string;
  source_checklist_state: RuntimeSchedulerManualApprovalChecklist["checklist_state"];
  copy_paste_confirmation: string | null;
  package_json_edited: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  next_manual_boundary: string;
  validation: { complete: boolean; recorded_for_manual_follow_up: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 300) : fallback;
}

function inputReady(input: RuntimeSchedulerApprovalOutcomeInput): boolean {
  return input.allow_outcome_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.outcome_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.rationale.trim().length > 0;
}

function checklistReady(checklist: RuntimeSchedulerManualApprovalChecklist): boolean {
  return checklist.schema_version === "1.0"
    && checklist.checklist_state === "ready_for_manual_review"
    && checklist.checklist_only
    && checklist.validation.complete
    && checklist.validation.ready_for_manual_review
    && !checklist.package_json_edited
    && !checklist.live_scheduler_enabled
    && !checklist.upload_execution_enabled
    && !checklist.network_enabled
    && !checklist.credential_access_enabled
    && !checklist.media_read_enabled
    && !checklist.file_write_enabled
    && !checklist.git_add_executed
    && !checklist.committed_now
    && !checklist.pushed_now;
}

function boundaryFor(decision: RuntimeSchedulerApprovalOutcomeDecision): string {
  if (decision === "approved_for_package_script_planning") return "Package script implementation still requires a separate package.json edit action and scoped validation.";
  if (decision === "deferred") return "No implementation should proceed until the operator provides a new explicit approval.";
  return "Runtime scheduler package script path is rejected; keep runtime scheduler disabled.";
}

export function createRuntimeSchedulerApprovalOutcome(input: RuntimeSchedulerApprovalOutcomeInput, checklist: RuntimeSchedulerManualApprovalChecklist): RuntimeSchedulerApprovalOutcome {
  const ready = inputReady(input) && checklistReady(checklist);
  return {
    schema_version: "1.0",
    outcome_id: safe(input.outcome_id, "runtime-scheduler-approval-outcome"),
    outcome_state: ready ? "recorded_for_manual_follow_up" : "blocked",
    outcome_only: true,
    decision: input.decision,
    rationale: safe(input.rationale, "No rationale recorded."),
    source_checklist_state: checklist.checklist_state,
    copy_paste_confirmation: ready ? checklist.copy_paste_confirmation : null,
    package_json_edited: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    next_manual_boundary: ready ? boundaryFor(input.decision) : "Resolve blocked manual approval checklist or unsafe outcome input before continuing.",
    validation: { complete: ready, recorded_for_manual_follow_up: ready, blocking_reasons: ready ? [] : ["Runtime scheduler approval outcome input or manual checklist was unsafe/incomplete."], warnings: ["Outcome only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerApprovalOutcome(outcome: RuntimeSchedulerApprovalOutcome, reason?: string): RuntimeSchedulerApprovalOutcome {
  return { ...outcome, outcome_state: "revoked", copy_paste_confirmation: null, validation: { complete: false, recorded_for_manual_follow_up: false, blocking_reasons: outcome.validation.blocking_reasons, warnings: [...outcome.validation.warnings, safe(reason, "Runtime scheduler approval outcome was revoked.")] } };
}

export function renderRuntimeSchedulerApprovalOutcome(outcome: RuntimeSchedulerApprovalOutcome): string {
  return [
    "Video Orchestrator runtime scheduler approval outcome",
    `State: ${outcome.outcome_state}`,
    `Decision: ${outcome.decision}`,
    `Rationale: ${outcome.rationale}`,
    `Source checklist state: ${outcome.source_checklist_state}`,
    `package.json edited: ${outcome.package_json_edited}`,
    `Live scheduler enabled: ${outcome.live_scheduler_enabled}`,
    `Next manual boundary: ${outcome.next_manual_boundary}`,
  ].join("\n");
}
