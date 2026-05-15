import type { RuntimeSchedulerPackageScriptEditDryRun } from "./video-orchestrator-runtime-scheduler-package-script-edit-dry-run.js";

export type RuntimeSchedulerPackageScriptEditCommitPlanState = "commit_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditCommitPlanInput {
  plan_id: string;
  operator_id: string;
  allow_plan_only: true;
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

export interface RuntimeSchedulerPackageScriptEditCommitPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPackageScriptEditCommitPlanState;
  plan_only: true;
  package_json_path: string;
  commit_message: string;
  intended_paths: string[];
  validation_before_commit: string[];
  validation_after_commit: string[];
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
  validation: { complete: boolean; commit_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditCommitPlanInput): boolean {
  return input.allow_plan_only === true
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
    && input.plan_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function dryRunReady(dryRun: RuntimeSchedulerPackageScriptEditDryRun): boolean {
  return dryRun.schema_version === "1.0"
    && dryRun.dry_run_state === "dry_run_ready"
    && dryRun.dry_run_only
    && dryRun.validation.complete
    && dryRun.validation.dry_run_ready
    && dryRun.package_json_path === "projects/probot/package.json"
    && dryRun.expected_changed_paths.length === 1
    && dryRun.expected_changed_paths[0] === "projects/probot/package.json"
    && dryRun.proposed_scripts_entry["probot:video:runtime-scheduler"] === "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary"
    && !dryRun.package_json_edited
    && !dryRun.live_scheduler_enabled
    && !dryRun.upload_execution_enabled
    && !dryRun.network_enabled
    && !dryRun.credential_access_enabled
    && !dryRun.media_read_enabled
    && !dryRun.file_write_enabled
    && !dryRun.git_add_executed
    && !dryRun.committed_now
    && !dryRun.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditCommitPlan(input: RuntimeSchedulerPackageScriptEditCommitPlanInput, dryRun: RuntimeSchedulerPackageScriptEditDryRun): RuntimeSchedulerPackageScriptEditCommitPlan {
  const ready = inputReady(input) && dryRunReady(dryRun);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-package-script-edit-commit-plan"),
    plan_state: ready ? "commit_plan_ready" : "blocked",
    plan_only: true,
    package_json_path: safe(dryRun.package_json_path, "projects/probot/package.json"),
    commit_message: "Add Video Orchestrator runtime scheduler package script",
    intended_paths: ready ? ["projects/probot/package.json"] : [],
    validation_before_commit: ready ? ["npm run typecheck", "security_scan_paths projects/probot/package.json", "git diff --cached --name-only"] : [],
    validation_after_commit: ready ? ["npm run typecheck", "git log -1 --oneline", "git status --short"] : [],
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
    validation: { complete: ready, commit_plan_ready: ready, blocking_reasons: ready ? [] : ["Package script edit commit plan input or dry-run was unsafe/incomplete."], warnings: ["Commit plan only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditCommitPlan(plan: RuntimeSchedulerPackageScriptEditCommitPlan, reason?: string): RuntimeSchedulerPackageScriptEditCommitPlan {
  return { ...plan, plan_state: "revoked", intended_paths: [], validation_before_commit: [], validation_after_commit: [], validation: { complete: false, commit_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Package script edit commit plan was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditCommitPlan(plan: RuntimeSchedulerPackageScriptEditCommitPlan): string {
  return [
    "Video Orchestrator runtime scheduler package script edit commit plan",
    `State: ${plan.plan_state}`,
    `Path: ${plan.package_json_path}`,
    `Commit message: ${plan.commit_message}`,
    `Intended paths: ${plan.intended_paths.join(", ") || "none"}`,
    `package.json edited: ${plan.package_json_edited}`,
    `Committed now: ${plan.committed_now}`,
    `Pushed now: ${plan.pushed_now}`,
  ].join("\n");
}
