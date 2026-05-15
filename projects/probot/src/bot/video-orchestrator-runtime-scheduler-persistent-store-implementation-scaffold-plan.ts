import type { RuntimeSchedulerPersistentStoreImplementationDesign } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-design.js";

export type RuntimeSchedulerPersistentStoreImplementationScaffoldPlanState = "scaffold_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreImplementationScaffoldPlanInput {
  plan_id: string;
  operator_id: string;
  allow_scaffold_plan_only: true;
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

export interface RuntimeSchedulerPersistentStoreImplementationScaffoldStep {
  step_id: string;
  label: string;
  mode: "type_and_pure_function_scaffold_only";
  runtime_side_effects_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreImplementationScaffoldPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStoreImplementationScaffoldPlanState;
  scaffold_plan_only: true;
  source_design_state: RuntimeSchedulerPersistentStoreImplementationDesign["design_state"];
  adapter_interface_name: string;
  store_kind: RuntimeSchedulerPersistentStoreImplementationDesign["store_kind"];
  store_reference: string;
  operation_count: number;
  scaffold_steps: RuntimeSchedulerPersistentStoreImplementationScaffoldStep[];
  explicit_non_goals: string[];
  required_next_confirmation: string;
  implementation_boundary: string;
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
  validation: { complete: boolean; scaffold_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreImplementationScaffoldPlanInput): boolean {
  return input.allow_scaffold_plan_only === true
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

function designReady(design: RuntimeSchedulerPersistentStoreImplementationDesign): boolean {
  return design.schema_version === "1.0"
    && design.design_state === "implementation_design_ready"
    && design.design_only
    && design.validation.complete
    && design.validation.implementation_design_ready
    && design.operation_count > 0
    && design.design_sections.length > 0
    && design.explicit_non_goals.length > 0
    && !design.file_write_enabled
    && !design.database_write_enabled
    && !design.live_scheduler_enabled
    && !design.upload_execution_enabled
    && !design.network_enabled
    && !design.credential_access_enabled
    && !design.media_read_enabled
    && !design.git_add_executed
    && !design.committed_now
    && !design.pushed_now;
}

function step(step_id: string, label: string): RuntimeSchedulerPersistentStoreImplementationScaffoldStep {
  return { step_id, label, mode: "type_and_pure_function_scaffold_only", runtime_side_effects_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(input: RuntimeSchedulerPersistentStoreImplementationScaffoldPlanInput, design: RuntimeSchedulerPersistentStoreImplementationDesign): RuntimeSchedulerPersistentStoreImplementationScaffoldPlan {
  const ready = inputReady(input) && designReady(design);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-implementation-scaffold-plan"),
    plan_state: ready ? "scaffold_plan_ready" : "blocked",
    scaffold_plan_only: true,
    source_design_state: design.design_state,
    adapter_interface_name: safe(design.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    store_kind: design.store_kind,
    store_reference: safe(design.store_reference, "blocked-reference"),
    operation_count: ready ? design.operation_count : 0,
    scaffold_steps: ready ? [
      step("types", "Define adapter input/output types for each approved scheduler queue operation."),
      step("validators", "Define pure validators for queue snapshots and event records."),
      step("transitions", "Define pure published and failed state transition helpers."),
      step("dry-run", "Define dry-run snapshot helpers that do not touch storage."),
      step("review", "Expose renderable review output for operator approval before executable persistence exists."),
    ] : [],
    explicit_non_goals: [
      "Do not implement file or database persistence in this scaffold plan.",
      "Do not wire the scaffold into live scheduler execution in this scaffold plan.",
      "Do not add platform dispatch, network, credential, media-read, staging, commit, or push behavior in this scaffold plan.",
    ],
    required_next_confirmation: ready ? "I approve creating a pure persistent scheduler store scaffold only, with no file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Scaffold plan only; a future scaffold may add type definitions and pure helpers, but executable persistence, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked implementation design or unsafe scaffold-plan input before continuing.",
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
    validation: { complete: ready, scaffold_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store implementation scaffold plan input or design was unsafe/incomplete."], warnings: ["Scaffold plan only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(plan: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan, reason?: string): RuntimeSchedulerPersistentStoreImplementationScaffoldPlan {
  return { ...plan, plan_state: "revoked", operation_count: 0, scaffold_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, scaffold_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store implementation scaffold plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(plan: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store implementation scaffold plan",
    `State: ${plan.plan_state}`,
    `Adapter interface: ${plan.adapter_interface_name}`,
    `Store kind: ${plan.store_kind}`,
    `Store reference: ${plan.store_reference}`,
    `Operation count: ${plan.operation_count}`,
    "Scaffold steps:",
    ...(plan.scaffold_steps.length ? plan.scaffold_steps.map((item) => `- ${item.step_id}: ${item.label}; side_effects=${item.runtime_side_effects_enabled}`) : ["- blocked"]),
    "Explicit non-goals:",
    ...plan.explicit_non_goals.map((item) => `- ${item}`),
    `Required next confirmation: ${plan.required_next_confirmation}`,
    `Implementation boundary: ${plan.implementation_boundary}`,
    `File writes enabled: ${plan.file_write_enabled}`,
    `Database writes enabled: ${plan.database_write_enabled}`,
    `Live scheduler enabled: ${plan.live_scheduler_enabled}`,
  ].join("\n");
}
