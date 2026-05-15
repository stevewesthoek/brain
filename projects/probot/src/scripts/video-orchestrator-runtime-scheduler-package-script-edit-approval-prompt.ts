import type { RuntimeSchedulerPackageScriptEditPreflight } from "./video-orchestrator-runtime-scheduler-package-script-edit-preflight.js";

export type RuntimeSchedulerPackageScriptEditApprovalPromptState = "ready_for_operator_copy_paste" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditApprovalPromptInput {
  prompt_id: string;
  operator_id: string;
  allow_prompt_only: true;
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

export interface RuntimeSchedulerPackageScriptEditApprovalPrompt {
  schema_version: "1.0";
  prompt_id: string;
  prompt_state: RuntimeSchedulerPackageScriptEditApprovalPromptState;
  prompt_only: true;
  source_preflight_state: RuntimeSchedulerPackageScriptEditPreflight["preflight_state"];
  package_json_path: string;
  script_name: string;
  script_command: string;
  copy_paste_confirmation: string;
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
  validation: { complete: boolean; ready_for_operator_copy_paste: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditApprovalPromptInput): boolean {
  return input.allow_prompt_only === true
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
    && input.prompt_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function preflightReady(preflight: RuntimeSchedulerPackageScriptEditPreflight): boolean {
  return preflight.schema_version === "1.0"
    && preflight.preflight_state === "ready_for_explicit_package_json_edit_approval"
    && preflight.preflight_only
    && preflight.validation.complete
    && preflight.validation.ready_for_explicit_package_json_edit_approval
    && preflight.package_json_path === "projects/probot/package.json"
    && preflight.script_name === "probot:video:runtime-scheduler"
    && preflight.script_command === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"
    && !preflight.package_json_edited
    && !preflight.live_scheduler_enabled
    && !preflight.upload_execution_enabled
    && !preflight.network_enabled
    && !preflight.credential_access_enabled
    && !preflight.media_read_enabled
    && !preflight.file_write_enabled
    && !preflight.git_add_executed
    && !preflight.committed_now
    && !preflight.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditApprovalPrompt(input: RuntimeSchedulerPackageScriptEditApprovalPromptInput, preflight: RuntimeSchedulerPackageScriptEditPreflight): RuntimeSchedulerPackageScriptEditApprovalPrompt {
  const ready = inputReady(input) && preflightReady(preflight);
  return {
    schema_version: "1.0",
    prompt_id: safe(input.prompt_id, "runtime-scheduler-package-script-edit-approval-prompt"),
    prompt_state: ready ? "ready_for_operator_copy_paste" : "blocked",
    prompt_only: true,
    source_preflight_state: preflight.preflight_state,
    package_json_path: safe(preflight.package_json_path, "projects/probot/package.json"),
    script_name: safe(preflight.script_name, "probot:video:runtime-scheduler"),
    script_command: safe(preflight.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"),
    copy_paste_confirmation: ready ? preflight.required_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, ready_for_operator_copy_paste: ready, blocking_reasons: ready ? [] : ["Package script edit approval prompt input or preflight was unsafe/incomplete."], warnings: ["Prompt only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditApprovalPrompt(prompt: RuntimeSchedulerPackageScriptEditApprovalPrompt, reason?: string): RuntimeSchedulerPackageScriptEditApprovalPrompt {
  return { ...prompt, prompt_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_operator_copy_paste: false, blocking_reasons: prompt.validation.blocking_reasons, warnings: [...prompt.validation.warnings, safe(reason, "Package script edit approval prompt was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditApprovalPrompt(prompt: RuntimeSchedulerPackageScriptEditApprovalPrompt): string {
  return [
    "Video Orchestrator runtime scheduler package script edit approval prompt",
    `State: ${prompt.prompt_state}`,
    `Path: ${prompt.package_json_path}`,
    `Script: ${prompt.script_name}`,
    `Command: ${prompt.script_command}`,
    "Copy/paste confirmation:",
    prompt.copy_paste_confirmation,
    `package.json edited: ${prompt.package_json_edited}`,
    `Live scheduler enabled: ${prompt.live_scheduler_enabled}`,
  ].join("\n");
}
