import type { RuntimeSchedulerPackageScriptEditExecutionChecklist } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-checklist.js";

export type RuntimeSchedulerPackageScriptEditFinalApprovalPacketState = "ready_for_explicit_package_json_edit_confirmation" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditFinalApprovalPacketInput {
  packet_id: string;
  operator_id: string;
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

export interface RuntimeSchedulerPackageScriptEditFinalApprovalPacket {
  schema_version: "1.0";
  packet_id: string;
  packet_state: RuntimeSchedulerPackageScriptEditFinalApprovalPacketState;
  packet_only: true;
  package_json_path: string;
  commit_message: string;
  copy_paste_confirmation: string;
  final_boundaries: string[];
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
  validation: { complete: boolean; ready_for_explicit_package_json_edit_confirmation: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 400) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditFinalApprovalPacketInput): boolean {
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
    && input.operator_id.trim().length > 0;
}

function checklistReady(checklist: RuntimeSchedulerPackageScriptEditExecutionChecklist): boolean {
  return checklist.schema_version === "1.0"
    && checklist.checklist_state === "ready_for_explicit_execution_review"
    && checklist.checklist_only
    && checklist.validation.complete
    && checklist.validation.ready_for_explicit_execution_review
    && checklist.items.length > 0
    && checklist.items.every((item) => item.complete)
    && checklist.package_json_path === "projects/probot/package.json"
    && checklist.commit_message === "Add Video Orchestrator runtime scheduler package script"
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

export function createRuntimeSchedulerPackageScriptEditFinalApprovalPacket(input: RuntimeSchedulerPackageScriptEditFinalApprovalPacketInput, checklist: RuntimeSchedulerPackageScriptEditExecutionChecklist): RuntimeSchedulerPackageScriptEditFinalApprovalPacket {
  const ready = inputReady(input) && checklistReady(checklist);
  return {
    schema_version: "1.0",
    packet_id: safe(input.packet_id, "runtime-scheduler-package-script-edit-final-approval-packet"),
    packet_state: ready ? "ready_for_explicit_package_json_edit_confirmation" : "blocked",
    packet_only: true,
    package_json_path: safe(checklist.package_json_path, "projects/probot/package.json"),
    commit_message: safe(checklist.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    copy_paste_confirmation: ready ? checklist.required_confirmation : "No confirmation available while blocked.",
    final_boundaries: ready ? [
      "Only projects/probot/package.json may be edited in the future execution step.",
      "The only allowed script is probot:video:runtime-scheduler.",
      "Live scheduler activation remains disabled.",
      "Uploads, network calls, credential access, media reads, and persistent scheduler writes remain disabled.",
      "Commits and pushes still require their own verified scoped git flow.",
    ] : [],
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
    validation: { complete: ready, ready_for_explicit_package_json_edit_confirmation: ready, blocking_reasons: ready ? [] : ["Package script edit final approval packet input or execution checklist was unsafe/incomplete."], warnings: ["Final approval packet only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditFinalApprovalPacket(packet: RuntimeSchedulerPackageScriptEditFinalApprovalPacket, reason?: string): RuntimeSchedulerPackageScriptEditFinalApprovalPacket {
  return { ...packet, packet_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", final_boundaries: [], validation: { complete: false, ready_for_explicit_package_json_edit_confirmation: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Package script edit final approval packet was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditFinalApprovalPacket(packet: RuntimeSchedulerPackageScriptEditFinalApprovalPacket): string {
  const boundaries = packet.final_boundaries.map((item) => `- ${item}`).join("\n");
  return [
    "Video Orchestrator runtime scheduler package script edit final approval packet",
    `State: ${packet.packet_state}`,
    `Path: ${packet.package_json_path}`,
    `Commit message: ${packet.commit_message}`,
    "Copy/paste confirmation:",
    packet.copy_paste_confirmation,
    "Final boundaries:",
    boundaries || "- blocked",
    `package.json edited: ${packet.package_json_edited}`,
    `Committed now: ${packet.committed_now}`,
    `Pushed now: ${packet.pushed_now}`,
  ].join("\n");
}
