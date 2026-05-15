import type { RuntimeSchedulerFinalReviewSummary } from "./video-orchestrator-runtime-scheduler-final-review-summary.js";

export interface RuntimeSchedulerPackageScriptEditPreflightInput {
  preflight_id: string;
  operator_id: string;
  package_json_path: string;
  script_name: string;
  script_command: string;
  allow_preflight_only: true;
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

export type RuntimeSchedulerPackageScriptEditPreflightState = "ready_for_explicit_package_json_edit_approval" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditPreflight {
  schema_version: "1.0";
  preflight_id: string;
  preflight_state: RuntimeSchedulerPackageScriptEditPreflightState;
  preflight_only: true;
  package_json_path: string;
  script_name: string;
  script_command: string;
  proposed_scripts_entry: Record<string, string>;
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
  required_confirmation: string;
  validation: { complete: boolean; ready_for_explicit_package_json_edit_approval: boolean; blocking_reasons: string[]; warnings: string[] };
}

function clean(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function safePath(path: string): boolean {
  return path === "projects/probot/package.json";
}

function safeScriptName(name: string): boolean {
  return /^[a-z0-9:_-]+$/i.test(name) && name.length <= 80;
}

function safeCommand(command: string): boolean {
  return command === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary";
}

function inputReady(input: RuntimeSchedulerPackageScriptEditPreflightInput): boolean {
  return input.allow_preflight_only === true
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
    && input.preflight_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && safePath(input.package_json_path)
    && safeScriptName(input.script_name)
    && safeCommand(input.script_command);
}

function summaryReady(summary: RuntimeSchedulerFinalReviewSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "manual_boundary_confirmed"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.manual_boundary_confirmed
    && !summary.package_json_edited
    && !summary.live_scheduler_enabled
    && !summary.upload_execution_enabled
    && !summary.network_enabled
    && !summary.credential_access_enabled
    && !summary.media_read_enabled
    && !summary.file_write_enabled
    && !summary.git_add_executed
    && !summary.committed_now
    && !summary.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditPreflight(input: RuntimeSchedulerPackageScriptEditPreflightInput, summary: RuntimeSchedulerFinalReviewSummary): RuntimeSchedulerPackageScriptEditPreflight {
  const ready = inputReady(input) && summaryReady(summary);
  const scriptName = clean(input.script_name, "probot:video:runtime-scheduler");
  const scriptCommand = clean(input.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  return {
    schema_version: "1.0",
    preflight_id: clean(input.preflight_id, "runtime-scheduler-package-script-edit-preflight"),
    preflight_state: ready ? "ready_for_explicit_package_json_edit_approval" : "blocked",
    preflight_only: true,
    package_json_path: clean(input.package_json_path, "projects/probot/package.json"),
    script_name: scriptName,
    script_command: scriptCommand,
    proposed_scripts_entry: ready ? { [scriptName]: scriptCommand } : {},
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
    required_confirmation: ready ? "I approve editing projects/probot/package.json to add only the probot:video:runtime-scheduler script, with no live scheduler activation, uploads, network calls, credential access, or media reads." : "No confirmation available while blocked.",
    validation: { complete: ready, ready_for_explicit_package_json_edit_approval: ready, blocking_reasons: ready ? [] : ["Package script edit preflight input or final review summary was unsafe/incomplete."], warnings: ["Preflight only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditPreflight(preflight: RuntimeSchedulerPackageScriptEditPreflight, reason?: string): RuntimeSchedulerPackageScriptEditPreflight {
  return { ...preflight, preflight_state: "revoked", proposed_scripts_entry: {}, required_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_explicit_package_json_edit_approval: false, blocking_reasons: preflight.validation.blocking_reasons, warnings: [...preflight.validation.warnings, clean(reason, "Package script edit preflight was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditPreflight(preflight: RuntimeSchedulerPackageScriptEditPreflight): string {
  return [
    "Video Orchestrator runtime scheduler package script edit preflight",
    `State: ${preflight.preflight_state}`,
    `Path: ${preflight.package_json_path}`,
    `Script: ${preflight.script_name}`,
    `Command: ${preflight.script_command}`,
    `package.json edited: ${preflight.package_json_edited}`,
    `Live scheduler enabled: ${preflight.live_scheduler_enabled}`,
    "Required confirmation:",
    preflight.required_confirmation,
  ].join("\n");
}
