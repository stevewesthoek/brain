import type { RuntimeSchedulerPersistentStoreRuntimeImportExecutionDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-execution-decision-closeout.js";

export type RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanState = "runtime_import_enablement_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanInput {
  plan_id: string;
  operator_id: string;
  allow_plan_only: true;
  allow_runtime_imports: false;
  allow_file_write: false;
  allow_database_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanStep {
  step_id: string;
  label: string;
  mode: "runtime_import_enablement_planning_only";
  runtime_imports_enabled: false;
  file_modifications_enabled: false;
  side_effects_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanState;
  plan_only: true;
  source_closeout_state: RuntimeSchedulerPersistentStoreRuntimeImportExecutionDecisionCloseout["closeout_state"];
  source_decision: RuntimeSchedulerPersistentStoreRuntimeImportExecutionDecisionCloseout["decision"];
  adapter_interface_name: string;
  execution_step_count: number;
  allowed_future_scope_count: number;
  enablement_steps: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanStep[];
  explicit_non_goals: string[];
  required_next_confirmation: string;
  implementation_boundary: string;
  runtime_imports_enabled: false;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; runtime_import_enablement_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanInput): boolean {
  return input.allow_plan_only === true
    && input.allow_runtime_imports === false
    && input.allow_file_write === false
    && input.allow_database_write === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.plan_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function closeoutReady(closeout: RuntimeSchedulerPersistentStoreRuntimeImportExecutionDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "decision_closeout_ready"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.decision_closeout_ready
    && closeout.decision === "approve_future_runtime_import_enablement_plan"
    && closeout.execution_step_count > 0
    && closeout.allowed_future_scope_count > 0
    && closeout.closeout_items.length > 0
    && !closeout.runtime_imports_enabled
    && !closeout.file_write_enabled
    && !closeout.database_write_enabled
    && !closeout.live_scheduler_enabled
    && !closeout.upload_execution_enabled
    && !closeout.network_enabled
    && !closeout.credential_access_enabled
    && !closeout.media_read_enabled
    && !closeout.git_add_executed
    && !closeout.committed_now
    && !closeout.pushed_now;
}

function step(step_id: string, label: string): RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanStep {
  return { step_id, label, mode: "runtime_import_enablement_planning_only", runtime_imports_enabled: false, file_modifications_enabled: false, side_effects_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan(input: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlanInput, closeout: RuntimeSchedulerPersistentStoreRuntimeImportExecutionDecisionCloseout): RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-runtime-import-enablement-plan"),
    plan_state: ready ? "runtime_import_enablement_plan_ready" : "blocked",
    plan_only: true,
    source_closeout_state: closeout.closeout_state,
    source_decision: closeout.decision,
    adapter_interface_name: safe(closeout.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    execution_step_count: ready ? closeout.execution_step_count : 0,
    allowed_future_scope_count: ready ? closeout.allowed_future_scope_count : 0,
    enablement_steps: ready ? [
      step("enablement-flag-contract", "Plan future enablement flag contract without changing runtime files."),
      step("disabled-default-state", "Plan disabled-by-default import state before any execution can run."),
      step("operator-toggle-boundary", "Plan separate operator toggle boundary before enabling runtime imports."),
      step("rollback-preconditions", "Plan rollback preconditions before any enablement is introduced."),
    ] : [],
    explicit_non_goals: [
      "Do not enable runtime imports or live scheduler execution in this plan.",
      "Do not modify runtime files, write persistence, run database operations, dispatch platform transfers, call networks, access credentials, or read media in this plan.",
      "Do not stage, commit, or push executable runtime enablement changes in this plan.",
    ],
    required_next_confirmation: ready ? "I approve runtime import enablement review only, with no runtime imports, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Runtime import enablement plan only; future review may assess readiness, but actual runtime imports, file modifications, persistence, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked runtime import execution decision closeout or unsafe enablement-plan input before continuing.",
    runtime_imports_enabled: false,
    file_write_enabled: false,
    database_write_enabled: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, runtime_import_enablement_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store runtime import enablement plan input or decision closeout was unsafe/incomplete."], warnings: ["Runtime import enablement plan only; no runtime imports, file modifications, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan(plan: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan, reason?: string): RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan {
  return { ...plan, plan_state: "revoked", execution_step_count: 0, allowed_future_scope_count: 0, enablement_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, runtime_import_enablement_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store runtime import enablement plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan(plan: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store runtime import enablement plan",
    `State: ${plan.plan_state}`,
    `Decision: ${plan.source_decision}`,
    `Adapter interface: ${plan.adapter_interface_name}`,
    `Execution step count: ${plan.execution_step_count}`,
    `Allowed future scope count: ${plan.allowed_future_scope_count}`,
    "Enablement steps:",
    ...(plan.enablement_steps.length ? plan.enablement_steps.map((item) => `- ${item.step_id}: ${item.label}; runtime_imports=${item.runtime_imports_enabled}; file_modifications=${item.file_modifications_enabled}; side_effects=${item.side_effects_enabled}`) : ["- blocked"]),
    "Explicit non-goals:",
    ...plan.explicit_non_goals.map((item) => `- ${item}`),
    `Required next confirmation: ${plan.required_next_confirmation}`,
    `Implementation boundary: ${plan.implementation_boundary}`,
    `Runtime imports enabled: ${plan.runtime_imports_enabled}`,
    `File writes enabled: ${plan.file_write_enabled}`,
    `Database writes enabled: ${plan.database_write_enabled}`,
    `Live scheduler enabled: ${plan.live_scheduler_enabled}`,
  ].join("\n");
}
