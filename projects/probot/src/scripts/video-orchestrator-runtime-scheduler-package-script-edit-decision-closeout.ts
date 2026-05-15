import type { RuntimeSchedulerPackageScriptEditOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-operator-decision-packet.js";

export type RuntimeSchedulerPackageScriptEditDecisionCloseoutState = "closed_for_separate_package_json_edit_action" | "closed_deferred" | "closed_rejected" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditDecisionCloseoutInput {
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

export interface RuntimeSchedulerPackageScriptEditDecisionCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerPackageScriptEditDecisionCloseoutState;
  closeout_only: true;
  source_packet_state: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket["packet_state"];
  decision: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket["requested_decision"];
  package_json_path: string;
  allowed_future_change: string;
  required_confirmation: string;
  final_boundary: string;
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
  validation: { complete: boolean; closeout_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 460) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditDecisionCloseoutInput): boolean {
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

function packetReady(packet: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.packet_state === "ready_for_operator_decision"
    && packet.packet_only
    && packet.validation.complete
    && packet.validation.ready_for_operator_decision
    && packet.package_json_path === "projects/probot/package.json"
    && !packet.package_json_edited
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.file_write_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

function stateFor(decision: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket["requested_decision"]): RuntimeSchedulerPackageScriptEditDecisionCloseoutState {
  if (decision === "approve_scoped_package_json_edit") return "closed_for_separate_package_json_edit_action";
  if (decision === "defer") return "closed_deferred";
  return "closed_rejected";
}

export function createRuntimeSchedulerPackageScriptEditDecisionCloseout(input: RuntimeSchedulerPackageScriptEditDecisionCloseoutInput, packet: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket): RuntimeSchedulerPackageScriptEditDecisionCloseout {
  const ready = inputReady(input) && packetReady(packet);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-package-script-edit-decision-closeout"),
    closeout_state: ready ? stateFor(packet.requested_decision) : "blocked",
    closeout_only: true,
    source_packet_state: packet.packet_state,
    decision: packet.requested_decision,
    package_json_path: safe(packet.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? packet.allowed_future_change : "none",
    required_confirmation: ready ? packet.required_confirmation : "No confirmation available while blocked.",
    final_boundary: ready ? packet.next_boundary : "Resolve blocked operator decision packet or unsafe closeout input before continuing.",
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
    validation: { complete: ready, closeout_ready: ready, blocking_reasons: ready ? [] : ["Package script edit decision closeout input or decision packet was unsafe/incomplete."], warnings: ["Decision closeout only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditDecisionCloseout(closeout: RuntimeSchedulerPackageScriptEditDecisionCloseout, reason?: string): RuntimeSchedulerPackageScriptEditDecisionCloseout {
  return { ...closeout, closeout_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, closeout_ready: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Package script edit decision closeout was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditDecisionCloseout(closeout: RuntimeSchedulerPackageScriptEditDecisionCloseout): string {
  return [
    "Video Orchestrator runtime scheduler package script edit decision closeout",
    `State: ${closeout.closeout_state}`,
    `Decision: ${closeout.decision}`,
    `Path: ${closeout.package_json_path}`,
    `Allowed future change: ${closeout.allowed_future_change}`,
    `Final boundary: ${closeout.final_boundary}`,
    `package.json edited: ${closeout.package_json_edited}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
    `Committed now: ${closeout.committed_now}`,
    `Pushed now: ${closeout.pushed_now}`,
  ].join("\n");
}
