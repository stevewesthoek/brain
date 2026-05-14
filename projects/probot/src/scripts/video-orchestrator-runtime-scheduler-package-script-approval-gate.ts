import type { RuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";

export type RuntimeSchedulerPackageScriptApprovalState = "ready_for_explicit_package_metadata_approval" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptApprovalInput {
  approval_id: string;
  operator_id: string;
  reviewed_package_name: string;
  reviewed_script_name: string;
  allow_gate_only: true;
  allow_package_json_edit: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPackageScriptApprovalGate {
  schema_version: "1.0";
  approval_gate_id: string;
  approval_state: RuntimeSchedulerPackageScriptApprovalState;
  gate_only: true;
  package_name: string;
  script_name: string;
  command: string | null;
  package_json_edited: false;
  explicit_package_metadata_approval_required: true;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_manual_approval: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptApprovalInput): boolean {
  return input.allow_gate_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.approval_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.reviewed_package_name.trim().length > 0
    && input.reviewed_script_name.trim().length > 0;
}

function planReady(plan: RuntimeSchedulerPackageScriptPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.validation.complete
    && plan.plan_only
    && !plan.package_json_edited
    && !plan.live_scheduler_enabled
    && !plan.upload_execution_enabled
    && !plan.network_enabled
    && !plan.credential_access_enabled
    && !plan.media_read_enabled
    && !plan.git_add_executed
    && !plan.committed_now
    && !plan.pushed_now;
}

export function createRuntimeSchedulerPackageScriptApprovalGate(input: RuntimeSchedulerPackageScriptApprovalInput, plan: RuntimeSchedulerPackageScriptPlan): RuntimeSchedulerPackageScriptApprovalGate {
  const namesMatch = input.reviewed_package_name === plan.package_name && input.reviewed_script_name === plan.script_name;
  const ready = inputReady(input) && planReady(plan) && namesMatch;
  return {
    schema_version: "1.0",
    approval_gate_id: safe(input.approval_id, "runtime-scheduler-package-script-approval"),
    approval_state: ready ? "ready_for_explicit_package_metadata_approval" : "blocked",
    gate_only: true,
    package_name: safe(plan.package_name, "package"),
    script_name: safe(plan.script_name, "script"),
    command: ready ? plan.command : null,
    package_json_edited: false,
    explicit_package_metadata_approval_required: true,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: {
      complete: ready,
      ready_for_manual_approval: ready,
      blocking_reasons: ready ? [] : ["Package script approval gate input did not match a safe package-script plan."],
      warnings: ["Gate only; package.json is not edited. Explicit package metadata approval is required before any package.json change."],
    },
  };
}

export function revokeRuntimeSchedulerPackageScriptApprovalGate(gate: RuntimeSchedulerPackageScriptApprovalGate, reason?: string): RuntimeSchedulerPackageScriptApprovalGate {
  return {
    ...gate,
    approval_state: "revoked",
    command: null,
    package_json_edited: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: false, ready_for_manual_approval: false, blocking_reasons: gate.validation.blocking_reasons, warnings: [...gate.validation.warnings, safe(reason, "Package script approval gate was revoked.")] },
  };
}

export function renderRuntimeSchedulerPackageScriptApprovalGate(gate: RuntimeSchedulerPackageScriptApprovalGate): string {
  return [
    "Video Orchestrator runtime scheduler package script approval gate",
    `State: ${gate.approval_state}`,
    `Package: ${gate.package_name}`,
    `Script: ${gate.script_name}`,
    `Command: ${gate.command ?? "blocked"}`,
    `package.json edited: ${gate.package_json_edited}`,
    `Explicit package metadata approval required: ${gate.explicit_package_metadata_approval_required}`,
  ].join("\n");
}
