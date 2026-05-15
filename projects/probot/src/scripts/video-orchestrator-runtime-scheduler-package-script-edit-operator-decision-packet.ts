import type { RuntimeSchedulerPackageScriptEditBoundaryReport } from "./video-orchestrator-runtime-scheduler-package-script-edit-boundary-report.js";

export type RuntimeSchedulerPackageScriptEditOperatorDecision = "approve_scoped_package_json_edit" | "defer" | "reject";
export type RuntimeSchedulerPackageScriptEditOperatorDecisionPacketState = "ready_for_operator_decision" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditOperatorDecisionPacketInput {
  packet_id: string;
  operator_id: string;
  requested_decision: RuntimeSchedulerPackageScriptEditOperatorDecision;
  rationale: string;
  allow_packet_only: true;
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

export interface RuntimeSchedulerPackageScriptEditOperatorDecisionPacket {
  schema_version: "1.0";
  packet_id: string;
  packet_state: RuntimeSchedulerPackageScriptEditOperatorDecisionPacketState;
  packet_only: true;
  requested_decision: RuntimeSchedulerPackageScriptEditOperatorDecision;
  rationale: string;
  package_json_path: string;
  allowed_future_change: string;
  disallowed_future_changes: string[];
  required_confirmation: string;
  next_boundary: string;
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
  validation: { complete: boolean; ready_for_operator_decision: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 460) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditOperatorDecisionPacketInput): boolean {
  return input.allow_packet_only === true
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
    && input.packet_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.rationale.trim().length > 0;
}

function reportReady(report: RuntimeSchedulerPackageScriptEditBoundaryReport): boolean {
  return report.schema_version === "1.0"
    && report.report_state === "boundary_report_ready"
    && report.report_only
    && report.validation.complete
    && report.validation.boundary_report_ready
    && report.package_json_path === "projects/probot/package.json"
    && report.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && report.allowed_future_change.includes("probot:video:runtime-scheduler")
    && report.disallowed_future_changes.length > 0
    && !report.package_json_edited
    && !report.live_scheduler_enabled
    && !report.upload_execution_enabled
    && !report.network_enabled
    && !report.credential_access_enabled
    && !report.media_read_enabled
    && !report.file_write_enabled
    && !report.git_add_executed
    && !report.committed_now
    && !report.pushed_now;
}

function boundaryFor(decision: RuntimeSchedulerPackageScriptEditOperatorDecision, report: RuntimeSchedulerPackageScriptEditBoundaryReport): string {
  if (decision === "approve_scoped_package_json_edit") return report.next_boundary;
  if (decision === "defer") return "Package script edit remains deferred; no package.json change should be made until a new explicit approval is supplied.";
  return "Package script edit is rejected; keep package.json unchanged and runtime scheduler disabled.";
}

export function createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(input: RuntimeSchedulerPackageScriptEditOperatorDecisionPacketInput, report: RuntimeSchedulerPackageScriptEditBoundaryReport): RuntimeSchedulerPackageScriptEditOperatorDecisionPacket {
  const ready = inputReady(input) && reportReady(report);
  return {
    schema_version: "1.0",
    packet_id: safe(input.packet_id, "runtime-scheduler-package-script-edit-operator-decision-packet"),
    packet_state: ready ? "ready_for_operator_decision" : "blocked",
    packet_only: true,
    requested_decision: input.requested_decision,
    rationale: safe(input.rationale, "No rationale recorded."),
    package_json_path: safe(report.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? report.allowed_future_change : "none",
    disallowed_future_changes: ready ? report.disallowed_future_changes : [],
    required_confirmation: ready ? report.required_confirmation : "No confirmation available while blocked.",
    next_boundary: ready ? boundaryFor(input.requested_decision, report) : "Resolve blocked boundary report or unsafe decision packet input before continuing.",
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
    validation: { complete: ready, ready_for_operator_decision: ready, blocking_reasons: ready ? [] : ["Package script edit operator decision packet input or boundary report was unsafe/incomplete."], warnings: ["Decision packet only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(packet: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket, reason?: string): RuntimeSchedulerPackageScriptEditOperatorDecisionPacket {
  return { ...packet, packet_state: "revoked", allowed_future_change: "none", disallowed_future_changes: [], required_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_operator_decision: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Package script edit operator decision packet was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(packet: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket): string {
  return [
    "Video Orchestrator runtime scheduler package script edit operator decision packet",
    `State: ${packet.packet_state}`,
    `Decision: ${packet.requested_decision}`,
    `Path: ${packet.package_json_path}`,
    `Allowed future change: ${packet.allowed_future_change}`,
    `Next boundary: ${packet.next_boundary}`,
    "Required confirmation:",
    packet.required_confirmation,
    `package.json edited: ${packet.package_json_edited}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
    `Committed now: ${packet.committed_now}`,
    `Pushed now: ${packet.pushed_now}`,
  ].join("\n");
}
