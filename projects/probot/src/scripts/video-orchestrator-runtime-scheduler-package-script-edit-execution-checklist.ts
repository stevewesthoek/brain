import type { RuntimeSchedulerPackageScriptEditCommitPlan } from "./video-orchestrator-runtime-scheduler-package-script-edit-commit-plan.js";

export type RuntimeSchedulerPackageScriptEditExecutionChecklistState = "ready_for_explicit_execution_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditExecutionChecklistInput {
  checklist_id: string;
  operator_id: string;
  allow_checklist_only: true;
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

export interface RuntimeSchedulerPackageScriptEditExecutionChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  evidence: string;
}

export interface RuntimeSchedulerPackageScriptEditExecutionChecklist {
  schema_version: "1.0";
  checklist_id: string;
  checklist_state: RuntimeSchedulerPackageScriptEditExecutionChecklistState;
  checklist_only: true;
  package_json_path: string;
  commit_message: string;
  items: RuntimeSchedulerPackageScriptEditExecutionChecklistItem[];
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
  validation: { complete: boolean; ready_for_explicit_execution_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 360) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditExecutionChecklistInput): boolean {
  return input.allow_checklist_only === true
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
    && input.checklist_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function planReady(plan: RuntimeSchedulerPackageScriptEditCommitPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "commit_plan_ready"
    && plan.plan_only
    && plan.validation.complete
    && plan.validation.commit_plan_ready
    && plan.package_json_path === "projects/probot/package.json"
    && plan.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && plan.intended_paths.length === 1
    && plan.intended_paths[0] === "projects/probot/package.json"
    && !plan.package_json_edited
    && !plan.live_scheduler_enabled
    && !plan.upload_execution_enabled
    && !plan.network_enabled
    && !plan.credential_access_enabled
    && !plan.media_read_enabled
    && !plan.file_write_enabled
    && !plan.git_add_executed
    && !plan.committed_now
    && !plan.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditExecutionChecklist(input: RuntimeSchedulerPackageScriptEditExecutionChecklistInput, plan: RuntimeSchedulerPackageScriptEditCommitPlan): RuntimeSchedulerPackageScriptEditExecutionChecklist {
  const inputOk = inputReady(input);
  const planOk = planReady(plan);
  const items: RuntimeSchedulerPackageScriptEditExecutionChecklistItem[] = [
    { id: "input", label: "Checklist input is safe", complete: inputOk, evidence: inputOk ? "All runtime/write/git toggles are disabled." : "Input is unsafe or incomplete." },
    { id: "plan", label: "Commit plan is scoped", complete: planOk, evidence: planOk ? "Only projects/probot/package.json is intended." : "Plan is blocked, revoked, or not scoped to the package script edit." },
    { id: "validation", label: "Validation is defined", complete: plan.validation_before_commit.length > 0 && plan.validation_after_commit.length > 0, evidence: "Typecheck, secret scan, staged-set check, log, and status checks are required." },
  ];
  const ready = items.every((item) => item.complete);
  return {
    schema_version: "1.0",
    checklist_id: safe(input.checklist_id, "runtime-scheduler-package-script-edit-execution-checklist"),
    checklist_state: ready ? "ready_for_explicit_execution_review" : "blocked",
    checklist_only: true,
    package_json_path: safe(plan.package_json_path, "projects/probot/package.json"),
    commit_message: safe(plan.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    items,
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
    required_confirmation: ready ? "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    validation: { complete: ready, ready_for_explicit_execution_review: ready, blocking_reasons: ready ? [] : ["Package script edit execution checklist input or commit plan was unsafe/incomplete."], warnings: ["Checklist only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditExecutionChecklist(checklist: RuntimeSchedulerPackageScriptEditExecutionChecklist, reason?: string): RuntimeSchedulerPackageScriptEditExecutionChecklist {
  return { ...checklist, checklist_state: "revoked", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_explicit_execution_review: false, blocking_reasons: checklist.validation.blocking_reasons, warnings: [...checklist.validation.warnings, safe(reason, "Package script edit execution checklist was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditExecutionChecklist(checklist: RuntimeSchedulerPackageScriptEditExecutionChecklist): string {
  const items = checklist.items.map((item) => `- ${item.label}: ${item.complete ? "complete" : "blocked"} (${item.evidence})`).join("\n");
  return [
    "Video Orchestrator runtime scheduler package script edit execution checklist",
    `State: ${checklist.checklist_state}`,
    `Path: ${checklist.package_json_path}`,
    `Commit message: ${checklist.commit_message}`,
    items,
    `package.json edited: ${checklist.package_json_edited}`,
    `Committed now: ${checklist.committed_now}`,
    `Pushed now: ${checklist.pushed_now}`,
  ].join("\n");
}
