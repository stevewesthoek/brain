import type { RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-decision-closeout.js";

export type RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlanState = "integration_plan_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlanInput {
  plan_id: string;
  operator_id: string;
  allow_integration_plan_only: true;
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

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationStep {
  step_id: string;
  label: string;
  integration_mode: "planning_only";
  side_effects_enabled: false;
}

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlanState;
  integration_plan_only: true;
  source_closeout_state: RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout["closeout_state"];
  source_decision: RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout["decision"];
  adapter_interface_name: string;
  supported_operation_count: number;
  scaffold_export_count: number;
  integration_steps: RuntimeSchedulerPersistentStorePureScaffoldIntegrationStep[];
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
  validation: { complete: boolean; integration_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlanInput): boolean {
  return input.allow_integration_plan_only === true
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

function closeoutReady(closeout: RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "decision_closeout_ready"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.decision_closeout_ready
    && closeout.decision === "approve_future_integration_planning"
    && closeout.supported_operation_count >= 6
    && closeout.scaffold_export_count >= 4
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

function step(step_id: string, label: string): RuntimeSchedulerPersistentStorePureScaffoldIntegrationStep {
  return { step_id, label, integration_mode: "planning_only", side_effects_enabled: false };
}

export function createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlanInput, closeout: RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout): RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-pure-scaffold-integration-plan"),
    plan_state: ready ? "integration_plan_ready" : "blocked",
    integration_plan_only: true,
    source_closeout_state: closeout.closeout_state,
    source_decision: closeout.decision,
    adapter_interface_name: safe(closeout.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    supported_operation_count: ready ? closeout.supported_operation_count : 0,
    scaffold_export_count: ready ? closeout.scaffold_export_count : 0,
    integration_steps: ready ? [
      step("adapter-boundary-map", "Map pure scaffold helpers to adapter contract boundaries without wiring runtime call sites."),
      step("scheduler-readiness-map", "Describe how queue snapshot validation would guard future scheduler reads."),
      step("transition-review-map", "Describe how published and failed transitions remain deterministic before persistence exists."),
      step("call-site-inventory", "Inventory future call sites as documentation only, with no imports or runtime wiring."),
    ] : [],
    explicit_non_goals: [
      "Do not import the pure scaffold into live scheduler execution in this plan.",
      "Do not implement file or database persistence in this plan.",
      "Do not add platform dispatch, network, credential, media-read, staging, commit, or push behavior in this plan.",
    ],
    required_next_confirmation: ready ? "I approve pure scaffold integration review only, with no imports into live runtime paths, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Integration plan only; future review may summarize proposed call-site boundaries, but executable persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked pure scaffold decision closeout or unsafe integration-plan input before continuing.",
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
    validation: { complete: ready, integration_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold integration plan input or decision closeout was unsafe/incomplete."], warnings: ["Integration plan only; no imports into live runtime paths, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(plan: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan {
  return { ...plan, plan_state: "revoked", supported_operation_count: 0, scaffold_export_count: 0, integration_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, integration_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold integration plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(plan: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold integration plan",
    `State: ${plan.plan_state}`,
    `Decision: ${plan.source_decision}`,
    `Adapter interface: ${plan.adapter_interface_name}`,
    `Supported operation count: ${plan.supported_operation_count}`,
    `Scaffold export count: ${plan.scaffold_export_count}`,
    "Integration steps:",
    ...(plan.integration_steps.length ? plan.integration_steps.map((item) => `- ${item.step_id}: ${item.label}; side_effects=${item.side_effects_enabled}`) : ["- blocked"]),
    "Explicit non-goals:",
    ...plan.explicit_non_goals.map((item) => `- ${item}`),
    `Required next confirmation: ${plan.required_next_confirmation}`,
    `Implementation boundary: ${plan.implementation_boundary}`,
    `File writes enabled: ${plan.file_write_enabled}`,
    `Database writes enabled: ${plan.database_write_enabled}`,
    `Live scheduler enabled: ${plan.live_scheduler_enabled}`,
  ].join("\n");
}
