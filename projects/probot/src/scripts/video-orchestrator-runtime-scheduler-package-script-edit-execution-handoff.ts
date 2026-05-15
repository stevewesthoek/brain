import type { RuntimeSchedulerPackageScriptEditReadinessManifest } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-manifest.js";

export type RuntimeSchedulerPackageScriptEditExecutionHandoffState = "ready_for_operator_execution_decision" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditExecutionHandoffInput {
  handoff_id: string;
  operator_id: string;
  allow_handoff_only: true;
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

export interface RuntimeSchedulerPackageScriptEditExecutionHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPackageScriptEditExecutionHandoffState;
  handoff_only: true;
  package_json_path: string;
  commit_message: string;
  operator_confirmation: string;
  execution_scope: string[];
  forbidden_actions: string[];
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
  validation: { complete: boolean; ready_for_operator_execution_decision: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 420) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditExecutionHandoffInput): boolean {
  return input.allow_handoff_only === true
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
    && input.handoff_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function manifestReady(manifest: RuntimeSchedulerPackageScriptEditReadinessManifest): boolean {
  return manifest.schema_version === "1.0"
    && manifest.manifest_state === "ready_for_separate_execution_approval"
    && manifest.manifest_only
    && manifest.validation.complete
    && manifest.validation.ready_for_separate_execution_approval
    && manifest.package_json_path === "projects/probot/package.json"
    && manifest.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && manifest.copy_paste_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && manifest.readiness_items.length > 0
    && manifest.blocking_boundaries.length > 0
    && !manifest.package_json_edited
    && !manifest.live_scheduler_enabled
    && !manifest.upload_execution_enabled
    && !manifest.network_enabled
    && !manifest.credential_access_enabled
    && !manifest.media_read_enabled
    && !manifest.file_write_enabled
    && !manifest.git_add_executed
    && !manifest.committed_now
    && !manifest.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditExecutionHandoff(input: RuntimeSchedulerPackageScriptEditExecutionHandoffInput, manifest: RuntimeSchedulerPackageScriptEditReadinessManifest): RuntimeSchedulerPackageScriptEditExecutionHandoff {
  const ready = inputReady(input) && manifestReady(manifest);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-package-script-edit-execution-handoff"),
    handoff_state: ready ? "ready_for_operator_execution_decision" : "blocked",
    handoff_only: true,
    package_json_path: safe(manifest.package_json_path, "projects/probot/package.json"),
    commit_message: safe(manifest.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    operator_confirmation: ready ? manifest.copy_paste_confirmation : "No confirmation available while blocked.",
    execution_scope: ready ? [
      "Future execution may edit only projects/probot/package.json.",
      "Future execution may add only probot:video:runtime-scheduler to scripts.",
      "Future execution must keep the command as tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary.",
    ] : [],
    forbidden_actions: [
      "live scheduler activation",
      "uploads",
      "network calls",
      "credential access",
      "media reads",
      "persistent scheduler writes",
      "unrelated package metadata changes",
      "commits or pushes without separate verified git flow",
    ],
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
    validation: { complete: ready, ready_for_operator_execution_decision: ready, blocking_reasons: ready ? [] : ["Package script edit execution handoff input or readiness manifest was unsafe/incomplete."], warnings: ["Execution handoff only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditExecutionHandoff(handoff: RuntimeSchedulerPackageScriptEditExecutionHandoff, reason?: string): RuntimeSchedulerPackageScriptEditExecutionHandoff {
  return { ...handoff, handoff_state: "revoked", operator_confirmation: "No confirmation available while revoked.", execution_scope: [], validation: { complete: false, ready_for_operator_execution_decision: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Package script edit execution handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditExecutionHandoff(handoff: RuntimeSchedulerPackageScriptEditExecutionHandoff): string {
  return [
    "Video Orchestrator runtime scheduler package script edit execution handoff",
    `State: ${handoff.handoff_state}`,
    `Path: ${handoff.package_json_path}`,
    `Commit message: ${handoff.commit_message}`,
    "Operator confirmation:",
    handoff.operator_confirmation,
    "Execution scope:",
    ...(handoff.execution_scope.length ? handoff.execution_scope.map((item) => `- ${item}`) : ["- blocked"]),
    "Forbidden actions:",
    ...handoff.forbidden_actions.map((item) => `- ${item}`),
    `package.json edited: ${handoff.package_json_edited}`,
    `Committed now: ${handoff.committed_now}`,
    `Pushed now: ${handoff.pushed_now}`,
  ].join("\n");
}
