import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-decision-closeout.js";

export type RuntimeSchedulerPersistentStoreExecutableIntegrationPlanState = "executable_integration_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationPlanInput {
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

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationPlanStep {
  step_id: string;
  label: string;
  mode: "planning_only";
  runtime_imports_enabled: false;
  side_effects_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStoreExecutableIntegrationPlanState;
  plan_only: true;
  source_closeout_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationDecisionCloseout["closeout_state"];
  source_decision: RuntimeSchedulerPersistentStorePureScaffoldIntegrationDecisionCloseout["decision"];
  adapter_interface_name: string;
  integration_step_count: number;
  allowed_future_scope_count: number;
  plan_steps: RuntimeSchedulerPersistentStoreExecutableIntegrationPlanStep[];
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
  validation: { complete: boolean; executable_integration_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreExecutableIntegrationPlanInput): boolean {
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

function closeoutReady(closeout: RuntimeSchedulerPersistentStorePureScaffoldIntegrationDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "decision_closeout_ready"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.decision_closeout_ready
    && closeout.decision === "approve_future_executable_integration_planning"
    && closeout.integration_step_count > 0
    && closeout.allowed_future_scope_count > 0
    && closeout.closeout_items.length > 0
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

function step(step_id: string, label: string): RuntimeSchedulerPersistentStoreExecutableIntegrationPlanStep {
  return { step_id, label, mode: "planning_only", runtime_imports_enabled: false, side_effects_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreExecutableIntegrationPlan(input: RuntimeSchedulerPersistentStoreExecutableIntegrationPlanInput, closeout: RuntimeSchedulerPersistentStorePureScaffoldIntegrationDecisionCloseout): RuntimeSchedulerPersistentStoreExecutableIntegrationPlan {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-executable-integration-plan"),
    plan_state: ready ? "executable_integration_plan_ready" : "blocked",
    plan_only: true,
    source_closeout_state: closeout.closeout_state,
    source_decision: closeout.decision,
    adapter_interface_name: safe(closeout.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    integration_step_count: ready ? closeout.integration_step_count : 0,
    allowed_future_scope_count: ready ? closeout.allowed_future_scope_count : 0,
    plan_steps: ready ? [
      step("guarded-import-map", "Document guarded import points without adding imports to live runtime files."),
      step("adapter-call-map", "Document future adapter calls for snapshot validation and state transitions."),
      step("write-gate-map", "Document explicit write gates required before any storage mutation can exist."),
      step("runtime-disable-map", "Document live scheduler and platform dispatch disablement checks required before wiring."),
    ] : [],
    explicit_non_goals: [
      "Do not add imports into live scheduler or bridge paths in this plan.",
      "Do not implement persistence, file writes, database writes, migrations, or runtime storage mutation in this plan.",
      "Do not enable live scheduler execution, platform dispatch, network calls, credentials, media reads, staging, commits, or pushes in this plan.",
    ],
    required_next_confirmation: ready ? "I approve executable integration design review only, with no runtime imports, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Executable integration plan only; future review may assess design readiness, but runtime imports, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked integration decision closeout or unsafe executable integration plan input before continuing.",
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
    validation: { complete: ready, executable_integration_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store executable integration plan input or decision closeout was unsafe/incomplete."], warnings: ["Executable integration plan only; no runtime imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreExecutableIntegrationPlan(plan: RuntimeSchedulerPersistentStoreExecutableIntegrationPlan, reason?: string): RuntimeSchedulerPersistentStoreExecutableIntegrationPlan {
  return { ...plan, plan_state: "revoked", integration_step_count: 0, allowed_future_scope_count: 0, plan_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, executable_integration_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store executable integration plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreExecutableIntegrationPlan(plan: RuntimeSchedulerPersistentStoreExecutableIntegrationPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store executable integration plan",
    `State: ${plan.plan_state}`,
    `Decision: ${plan.source_decision}`,
    `Adapter interface: ${plan.adapter_interface_name}`,
    `Integration step count: ${plan.integration_step_count}`,
    `Allowed future scope count: ${plan.allowed_future_scope_count}`,
    "Plan steps:",
    ...(plan.plan_steps.length ? plan.plan_steps.map((item) => `- ${item.step_id}: ${item.label}; runtime_imports=${item.runtime_imports_enabled}; side_effects=${item.side_effects_enabled}`) : ["- blocked"]),
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
