import type { RuntimeSchedulerPackageScriptEditGuard } from "./video-orchestrator-runtime-scheduler-package-script-edit-guard.js";

export type RuntimeSchedulerPackageScriptEditDryRunState = "dry_run_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditDryRunInput {
  dry_run_id: string;
  operator_id: string;
  allow_dry_run_only: true;
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

export interface RuntimeSchedulerPackageScriptEditDryRun {
  schema_version: "1.0";
  dry_run_id: string;
  dry_run_state: RuntimeSchedulerPackageScriptEditDryRunState;
  dry_run_only: true;
  package_json_path: string;
  proposed_scripts_entry: Record<string, string>;
  expected_changed_paths: string[];
  expected_validation_commands: string[];
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
  validation: { complete: boolean; dry_run_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditDryRunInput): boolean {
  return input.allow_dry_run_only === true
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
    && input.dry_run_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function guardReady(guard: RuntimeSchedulerPackageScriptEditGuard): boolean {
  return guard.schema_version === "1.0"
    && guard.guard_state === "guard_ready_for_explicit_edit"
    && guard.guard_only
    && guard.validation.complete
    && guard.validation.guard_ready_for_explicit_edit
    && guard.package_json_path === "projects/probot/package.json"
    && guard.allowed_script_name === "probot:video:runtime-scheduler"
    && guard.allowed_script_command === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"
    && guard.allowed_changed_paths.length === 1
    && guard.allowed_changed_paths[0] === "projects/probot/package.json"
    && !guard.package_json_edited
    && !guard.live_scheduler_enabled
    && !guard.upload_execution_enabled
    && !guard.network_enabled
    && !guard.credential_access_enabled
    && !guard.media_read_enabled
    && !guard.file_write_enabled
    && !guard.git_add_executed
    && !guard.committed_now
    && !guard.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditDryRun(input: RuntimeSchedulerPackageScriptEditDryRunInput, guard: RuntimeSchedulerPackageScriptEditGuard): RuntimeSchedulerPackageScriptEditDryRun {
  const ready = inputReady(input) && guardReady(guard);
  return {
    schema_version: "1.0",
    dry_run_id: safe(input.dry_run_id, "runtime-scheduler-package-script-edit-dry-run"),
    dry_run_state: ready ? "dry_run_ready" : "blocked",
    dry_run_only: true,
    package_json_path: safe(guard.package_json_path, "projects/probot/package.json"),
    proposed_scripts_entry: ready ? { [guard.allowed_script_name]: guard.allowed_script_command } : {},
    expected_changed_paths: ready ? ["projects/probot/package.json"] : [],
    expected_validation_commands: ready ? ["npm run typecheck", "security_scan_paths projects/probot/package.json", "git diff --cached --name-only"] : [],
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
    validation: { complete: ready, dry_run_ready: ready, blocking_reasons: ready ? [] : ["Package script edit dry-run input or guard was unsafe/incomplete."], warnings: ["Dry-run only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditDryRun(dryRun: RuntimeSchedulerPackageScriptEditDryRun, reason?: string): RuntimeSchedulerPackageScriptEditDryRun {
  return { ...dryRun, dry_run_state: "revoked", proposed_scripts_entry: {}, expected_changed_paths: [], expected_validation_commands: [], validation: { complete: false, dry_run_ready: false, blocking_reasons: dryRun.validation.blocking_reasons, warnings: [...dryRun.validation.warnings, safe(reason, "Package script edit dry-run was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditDryRun(dryRun: RuntimeSchedulerPackageScriptEditDryRun): string {
  return [
    "Video Orchestrator runtime scheduler package script edit dry-run",
    `State: ${dryRun.dry_run_state}`,
    `Path: ${dryRun.package_json_path}`,
    `Proposed scripts entry: ${JSON.stringify(dryRun.proposed_scripts_entry)}`,
    `Expected changed paths: ${dryRun.expected_changed_paths.join(", ") || "none"}`,
    `package.json edited: ${dryRun.package_json_edited}`,
    `Live scheduler enabled: ${dryRun.live_scheduler_enabled}`,
  ].join("\n");
}
