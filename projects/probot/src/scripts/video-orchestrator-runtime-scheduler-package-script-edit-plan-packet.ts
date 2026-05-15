import type { RuntimeSchedulerPackageScriptEditApprovalPrompt } from "./video-orchestrator-runtime-scheduler-package-script-edit-approval-prompt.js";

export type RuntimeSchedulerPackageScriptEditPlanPacketState = "ready_for_guarded_edit_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditPlanPacketInput {
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

export interface RuntimeSchedulerPackageScriptEditPlanPacket {
  schema_version: "1.0";
  packet_id: string;
  packet_state: RuntimeSchedulerPackageScriptEditPlanPacketState;
  packet_only: true;
  package_json_path: string;
  script_name: string;
  script_command: string;
  implementation_steps: string[];
  validation_steps: string[];
  required_confirmation: string;
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
  validation: { complete: boolean; ready_for_guarded_edit_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditPlanPacketInput): boolean {
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

function promptReady(prompt: RuntimeSchedulerPackageScriptEditApprovalPrompt): boolean {
  return prompt.schema_version === "1.0"
    && prompt.prompt_state === "ready_for_operator_copy_paste"
    && prompt.prompt_only
    && prompt.validation.complete
    && prompt.validation.ready_for_operator_copy_paste
    && prompt.package_json_path === "projects/probot/package.json"
    && prompt.script_name === "probot:video:runtime-scheduler"
    && prompt.script_command === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"
    && !prompt.package_json_edited
    && !prompt.live_scheduler_enabled
    && !prompt.upload_execution_enabled
    && !prompt.network_enabled
    && !prompt.credential_access_enabled
    && !prompt.media_read_enabled
    && !prompt.file_write_enabled
    && !prompt.git_add_executed
    && !prompt.committed_now
    && !prompt.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditPlanPacket(input: RuntimeSchedulerPackageScriptEditPlanPacketInput, prompt: RuntimeSchedulerPackageScriptEditApprovalPrompt): RuntimeSchedulerPackageScriptEditPlanPacket {
  const ready = inputReady(input) && promptReady(prompt);
  return {
    schema_version: "1.0",
    packet_id: safe(input.packet_id, "runtime-scheduler-package-script-edit-plan-packet"),
    packet_state: ready ? "ready_for_guarded_edit_review" : "blocked",
    packet_only: true,
    package_json_path: safe(prompt.package_json_path, "projects/probot/package.json"),
    script_name: safe(prompt.script_name, "probot:video:runtime-scheduler"),
    script_command: safe(prompt.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"),
    implementation_steps: ready ? [
      "Read projects/probot/package.json and locate the scripts object.",
      "Add only probot:video:runtime-scheduler with the command tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary.",
      "Do not enable live scheduler execution, uploads, network calls, credential access, media reads, or persistent scheduler writes.",
    ] : [],
    validation_steps: ready ? [
      "Run npm run typecheck in projects/probot.",
      "Run a forbidden-secret scan on projects/probot/package.json.",
      "Verify the staged set contains only projects/probot/package.json before any commit.",
    ] : [],
    required_confirmation: ready ? prompt.copy_paste_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, ready_for_guarded_edit_review: ready, blocking_reasons: ready ? [] : ["Package script edit plan packet input or approval prompt was unsafe/incomplete."], warnings: ["Plan packet only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditPlanPacket(packet: RuntimeSchedulerPackageScriptEditPlanPacket, reason?: string): RuntimeSchedulerPackageScriptEditPlanPacket {
  return { ...packet, packet_state: "revoked", implementation_steps: [], validation_steps: [], required_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_guarded_edit_review: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Package script edit plan packet was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditPlanPacket(packet: RuntimeSchedulerPackageScriptEditPlanPacket): string {
  const steps = packet.implementation_steps.map((step) => `- ${step}`).join("\n");
  const validations = packet.validation_steps.map((step) => `- ${step}`).join("\n");
  return [
    "Video Orchestrator runtime scheduler package script edit plan packet",
    `State: ${packet.packet_state}`,
    `Path: ${packet.package_json_path}`,
    `Script: ${packet.script_name}`,
    `Command: ${packet.script_command}`,
    "Implementation steps:",
    steps || "- blocked",
    "Validation steps:",
    validations || "- blocked",
    `package.json edited: ${packet.package_json_edited}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
