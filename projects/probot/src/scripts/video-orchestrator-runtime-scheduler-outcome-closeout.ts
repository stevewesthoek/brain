import type { RuntimeSchedulerApprovalOutcome } from "./video-orchestrator-runtime-scheduler-approval-outcome.js";

export type RuntimeSchedulerOutcomeCloseoutState = "closed_for_manual_boundary" | "blocked" | "revoked";

export interface RuntimeSchedulerOutcomeCloseoutInput {
  closeout_id: string;
  operator_id: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerOutcomeCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerOutcomeCloseoutState;
  closeout_only: true;
  decision: RuntimeSchedulerApprovalOutcome["decision"];
  source_outcome_state: RuntimeSchedulerApprovalOutcome["outcome_state"];
  next_manual_boundary: string;
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
  final_status: string;
  validation: { complete: boolean; closed_for_manual_boundary: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 300) : fallback;
}

function inputReady(input: RuntimeSchedulerOutcomeCloseoutInput): boolean {
  return input.allow_closeout_only === true
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
    && input.closeout_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function outcomeReady(outcome: RuntimeSchedulerApprovalOutcome): boolean {
  return outcome.schema_version === "1.0"
    && outcome.outcome_state === "recorded_for_manual_follow_up"
    && outcome.outcome_only
    && outcome.validation.complete
    && outcome.validation.recorded_for_manual_follow_up
    && !outcome.package_json_edited
    && !outcome.live_scheduler_enabled
    && !outcome.upload_execution_enabled
    && !outcome.network_enabled
    && !outcome.credential_access_enabled
    && !outcome.media_read_enabled
    && !outcome.file_write_enabled
    && !outcome.git_add_executed
    && !outcome.committed_now
    && !outcome.pushed_now;
}

function statusFor(outcome: RuntimeSchedulerApprovalOutcome): string {
  if (outcome.decision === "approved_for_package_script_planning") return "Approval recorded for package-script planning only; package.json edits remain a separate guarded action.";
  if (outcome.decision === "deferred") return "Runtime scheduler decision deferred; no package metadata or runtime changes should proceed.";
  return "Runtime scheduler package-script path rejected; keep runtime scheduler disabled.";
}

export function createRuntimeSchedulerOutcomeCloseout(input: RuntimeSchedulerOutcomeCloseoutInput, outcome: RuntimeSchedulerApprovalOutcome): RuntimeSchedulerOutcomeCloseout {
  const ready = inputReady(input) && outcomeReady(outcome);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-outcome-closeout"),
    closeout_state: ready ? "closed_for_manual_boundary" : "blocked",
    closeout_only: true,
    decision: outcome.decision,
    source_outcome_state: outcome.outcome_state,
    next_manual_boundary: ready ? outcome.next_manual_boundary : "Resolve blocked approval outcome or unsafe closeout input before continuing.",
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
    final_status: ready ? statusFor(outcome) : "Blocked before closeout.",
    validation: { complete: ready, closed_for_manual_boundary: ready, blocking_reasons: ready ? [] : ["Runtime scheduler outcome closeout input or approval outcome was unsafe/incomplete."], warnings: ["Closeout only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerOutcomeCloseout(closeout: RuntimeSchedulerOutcomeCloseout, reason?: string): RuntimeSchedulerOutcomeCloseout {
  return { ...closeout, closeout_state: "revoked", final_status: "Revoked.", validation: { complete: false, closed_for_manual_boundary: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Runtime scheduler outcome closeout was revoked.")] } };
}

export function renderRuntimeSchedulerOutcomeCloseout(closeout: RuntimeSchedulerOutcomeCloseout): string {
  return [
    "Video Orchestrator runtime scheduler outcome closeout",
    `State: ${closeout.closeout_state}`,
    `Decision: ${closeout.decision}`,
    `Source outcome state: ${closeout.source_outcome_state}`,
    `package.json edited: ${closeout.package_json_edited}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
    `Final status: ${closeout.final_status}`,
    `Next manual boundary: ${closeout.next_manual_boundary}`,
  ].join("\n");
}
