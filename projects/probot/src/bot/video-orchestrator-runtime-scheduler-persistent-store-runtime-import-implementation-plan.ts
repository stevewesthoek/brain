import type { RuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-decision-closeout.js";

export type RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlanState = "runtime_import_implementation_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlanInput {
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

export interface RuntimeSchedulerPersistentStoreRuntimeImportImplementationStep {
  step_id: string;
  label: string;
  mode: "implementation_planning_only";
  runtime_imports_enabled: false;
  side_effects_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlanState;
  plan_only: true;
  source_closeout_state: RuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout["closeout_state"];
  source_decision: RuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout["decision"];
  adapter_interface_name: string;
  import_plan_step_count: number;
  allowed_future_scope_count: number;
  implementation_steps: RuntimeSchedulerPersistentStoreRuntimeImportImplementationStep[];
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
  validation: { complete: boolean; runtime_import_implementation_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlanInput): boolean {
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

function closeoutReady(closeout: RuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "decision_closeout_ready"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.decision_closeout_ready
    && closeout.decision === "approve_future_runtime_import_implementation_plan"
    && closeout.import_plan_step_count > 0
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

function step(step_id: string, label: string): RuntimeSchedulerPersistentStoreRuntimeImportImplementationStep {
  return { step_id, label, mode: "implementation_planning_only", runtime_imports_enabled: false, side_effects_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan(input: RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlanInput, closeout: RuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout): RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-runtime-import-implementation-plan"),
    plan_state: ready ? "runtime_import_implementation_plan_ready" : "blocked",
    plan_only: true,
    source_closeout_state: closeout.closeout_state,
    source_decision: closeout.decision,
    adapter_interface_name: safe(closeout.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    import_plan_step_count: ready ? closeout.import_plan_step_count : 0,
    allowed_future_scope_count: ready ? closeout.allowed_future_scope_count : 0,
    implementation_steps: ready ? [
      step("runtime-import-patch-outline", "Document the exact future import patch shape without modifying runtime files."),
      step("disabled-gate-outline", "Document disabled-by-default feature gate checks required before import use."),
      step("adapter-call-outline", "Document future adapter call boundaries without enabling persistence."),
      step("test-scope-outline", "Document required tests before any executable runtime import can be introduced."),
    ] : [],
    explicit_non_goals: [
      "Do not add runtime imports or modify live scheduler files in this plan.",
      "Do not implement file/database persistence or storage mutation in this plan.",
      "Do not enable live scheduler execution, platform dispatch, network calls, credentials, media reads, staging, commits, or pushes in this plan.",
    ],
    required_next_confirmation: ready ? "I approve runtime import implementation review only, with no runtime imports, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Runtime import implementation plan only; future review may assess readiness, but runtime imports, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked runtime import decision closeout or unsafe implementation-plan input before continuing.",
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
    validation: { complete: ready, runtime_import_implementation_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store runtime import implementation plan input or decision closeout was unsafe/incomplete."], warnings: ["Runtime import implementation plan only; no runtime imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan(plan: RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan, reason?: string): RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan {
  return { ...plan, plan_state: "revoked", import_plan_step_count: 0, allowed_future_scope_count: 0, implementation_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, runtime_import_implementation_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store runtime import implementation plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan(plan: RuntimeSchedulerPersistentStoreRuntimeImportImplementationPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store runtime import implementation plan",
    `State: ${plan.plan_state}`,
    `Decision: ${plan.source_decision}`,
    `Adapter interface: ${plan.adapter_interface_name}`,
    `Import plan step count: ${plan.import_plan_step_count}`,
    `Allowed future scope count: ${plan.allowed_future_scope_count}`,
    "Implementation steps:",
    ...(plan.implementation_steps.length ? plan.implementation_steps.map((item) => `- ${item.step_id}: ${item.label}; runtime_imports=${item.runtime_imports_enabled}; side_effects=${item.side_effects_enabled}`) : ["- blocked"]),
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
