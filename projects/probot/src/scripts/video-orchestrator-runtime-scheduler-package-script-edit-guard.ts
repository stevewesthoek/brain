import type { RuntimeSchedulerPackageScriptEditPlanPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-plan-packet.js";

export type RuntimeSchedulerPackageScriptEditGuardState = "guard_ready_for_explicit_edit" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditGuardInput {
  guard_id: string;
  operator_id: string;
  allow_guard_only: true;
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

export interface RuntimeSchedulerPackageScriptEditGuard {
  schema_version: "1.0";
  guard_id: string;
  guard_state: RuntimeSchedulerPackageScriptEditGuardState;
  guard_only: true;
  package_json_path: string;
  allowed_script_name: string;
  allowed_script_command: string;
  allowed_changed_paths: string[];
  blocked_capabilities: string[];
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
  validation: { complete: boolean; guard_ready_for_explicit_edit: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditGuardInput): boolean {
  return input.allow_guard_only === true
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
    && input.guard_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function packetReady(packet: RuntimeSchedulerPackageScriptEditPlanPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.packet_state === "ready_for_guarded_edit_review"
    && packet.packet_only
    && packet.validation.complete
    && packet.validation.ready_for_guarded_edit_review
    && packet.package_json_path === "projects/probot/package.json"
    && packet.script_name === "probot:video:runtime-scheduler"
    && packet.script_command === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"
    && packet.implementation_steps.length > 0
    && packet.validation_steps.length > 0
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

export function createRuntimeSchedulerPackageScriptEditGuard(input: RuntimeSchedulerPackageScriptEditGuardInput, packet: RuntimeSchedulerPackageScriptEditPlanPacket): RuntimeSchedulerPackageScriptEditGuard {
  const ready = inputReady(input) && packetReady(packet);
  return {
    schema_version: "1.0",
    guard_id: safe(input.guard_id, "runtime-scheduler-package-script-edit-guard"),
    guard_state: ready ? "guard_ready_for_explicit_edit" : "blocked",
    guard_only: true,
    package_json_path: safe(packet.package_json_path, "projects/probot/package.json"),
    allowed_script_name: safe(packet.script_name, "probot:video:runtime-scheduler"),
    allowed_script_command: safe(packet.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"),
    allowed_changed_paths: ready ? ["projects/probot/package.json"] : [],
    blocked_capabilities: ["live_scheduler", "uploads", "network_calls", "credential_access", "media_reads", "persistent_scheduler_writes", "unrelated_package_metadata_changes"],
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
    validation: { complete: ready, guard_ready_for_explicit_edit: ready, blocking_reasons: ready ? [] : ["Package script edit guard input or plan packet was unsafe/incomplete."], warnings: ["Guard only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditGuard(guard: RuntimeSchedulerPackageScriptEditGuard, reason?: string): RuntimeSchedulerPackageScriptEditGuard {
  return { ...guard, guard_state: "revoked", allowed_changed_paths: [], validation: { complete: false, guard_ready_for_explicit_edit: false, blocking_reasons: guard.validation.blocking_reasons, warnings: [...guard.validation.warnings, safe(reason, "Package script edit guard was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditGuard(guard: RuntimeSchedulerPackageScriptEditGuard): string {
  return [
    "Video Orchestrator runtime scheduler package script edit guard",
    `State: ${guard.guard_state}`,
    `Path: ${guard.package_json_path}`,
    `Allowed script: ${guard.allowed_script_name}`,
    `Allowed command: ${guard.allowed_script_command}`,
    `Allowed changed paths: ${guard.allowed_changed_paths.join(", ") || "none"}`,
    `Blocked capabilities: ${guard.blocked_capabilities.join(", ")}`,
    `package.json edited: ${guard.package_json_edited}`,
    `Live scheduler enabled: ${guard.live_scheduler_enabled}`,
  ].join("\n");
}
