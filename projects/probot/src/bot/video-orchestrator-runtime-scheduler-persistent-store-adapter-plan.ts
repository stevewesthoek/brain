import type { RuntimeSchedulerPersistentStoreContract, RuntimeSchedulerPersistentStoreOperation } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

export type RuntimeSchedulerPersistentStoreAdapterPlanState = "adapter_plan_ready" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreAdapterCapability = "atomic_load_save" | "append_only_events" | "idempotent_state_transitions" | "due_item_query" | "schema_validation" | "dry_run_snapshot";

export interface RuntimeSchedulerPersistentStoreAdapterPlanInput {
  plan_id: string;
  operator_id: string;
  adapter_name: string;
  capabilities: readonly RuntimeSchedulerPersistentStoreAdapterCapability[];
  allow_plan_only: true;
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

export interface RuntimeSchedulerPersistentStoreAdapterPlan {
  schema_version: "1.0";
  plan_id: string;
  plan_state: RuntimeSchedulerPersistentStoreAdapterPlanState;
  plan_only: true;
  source_contract_state: RuntimeSchedulerPersistentStoreContract["contract_state"];
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreContract["store_kind"];
  store_reference: string;
  store_namespace: string;
  operations: RuntimeSchedulerPersistentStoreOperation[];
  capabilities: RuntimeSchedulerPersistentStoreAdapterCapability[];
  implementation_steps: string[];
  validation_steps: string[];
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
  validation: { complete: boolean; adapter_plan_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

const REQUIRED_CAPABILITIES: RuntimeSchedulerPersistentStoreAdapterCapability[] = ["atomic_load_save", "append_only_events", "idempotent_state_transitions", "due_item_query", "schema_validation", "dry_run_snapshot"];

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function uniqueCapabilities(capabilities: readonly RuntimeSchedulerPersistentStoreAdapterCapability[]): RuntimeSchedulerPersistentStoreAdapterCapability[] {
  return [...new Set(capabilities)];
}

function hasRequiredCapabilities(capabilities: readonly RuntimeSchedulerPersistentStoreAdapterCapability[]): boolean {
  const set = new Set(capabilities);
  return REQUIRED_CAPABILITIES.every((capability) => set.has(capability));
}

function inputReady(input: RuntimeSchedulerPersistentStoreAdapterPlanInput): boolean {
  return input.allow_plan_only === true
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
    && input.operator_id.trim().length > 0
    && input.adapter_name.trim().length > 0
    && hasRequiredCapabilities(input.capabilities);
}

function contractReady(contract: RuntimeSchedulerPersistentStoreContract): boolean {
  return contract.schema_version === "1.0"
    && contract.contract_state === "contract_ready_for_review"
    && contract.contract_only
    && contract.validation.complete
    && contract.validation.contract_ready_for_review
    && contract.operations.length >= 6
    && !contract.file_write_enabled
    && !contract.database_write_enabled
    && !contract.live_scheduler_enabled
    && !contract.upload_execution_enabled
    && !contract.network_enabled
    && !contract.credential_access_enabled
    && !contract.media_read_enabled
    && !contract.git_add_executed
    && !contract.committed_now
    && !contract.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreAdapterPlan(input: RuntimeSchedulerPersistentStoreAdapterPlanInput, contract: RuntimeSchedulerPersistentStoreContract): RuntimeSchedulerPersistentStoreAdapterPlan {
  const capabilities = uniqueCapabilities(input.capabilities);
  const ready = inputReady(input) && contractReady(contract);
  return {
    schema_version: "1.0",
    plan_id: safe(input.plan_id, "runtime-scheduler-persistent-store-adapter-plan"),
    plan_state: ready ? "adapter_plan_ready" : "blocked",
    plan_only: true,
    source_contract_state: contract.contract_state,
    adapter_name: safe(input.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: contract.store_kind,
    store_reference: safe(contract.store_reference, "blocked-reference"),
    store_namespace: safe(contract.store_namespace, "runtime-scheduler"),
    operations: ready ? contract.operations : [],
    capabilities: ready ? capabilities : [],
    implementation_steps: ready ? [
      "Define a store adapter interface that implements the approved queue operations.",
      "Keep adapter construction side-effect-free until explicit write approval is granted.",
      "Validate queue snapshots and event records before any future persistence boundary.",
      "Preserve idempotent item state transitions for published and failed outcomes.",
    ] : [],
    validation_steps: ready ? [
      "Typecheck the adapter contract and fixtures.",
      "Run dry-run snapshot tests without file or database writes.",
      "Verify no upload, network, credential, media-read, staging, commit, or push behavior is enabled.",
    ] : [],
    required_next_confirmation: ready ? "I approve implementing the persistent scheduler store adapter skeleton only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Adapter plan only; skeleton implementation may be prepared next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked contract or unsafe adapter plan input before continuing.",
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
    validation: { complete: ready, adapter_plan_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store adapter plan input or contract was unsafe/incomplete."], warnings: ["Adapter plan only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreAdapterPlan(plan: RuntimeSchedulerPersistentStoreAdapterPlan, reason?: string): RuntimeSchedulerPersistentStoreAdapterPlan {
  return { ...plan, plan_state: "revoked", operations: [], capabilities: [], implementation_steps: [], validation_steps: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, adapter_plan_ready: false, blocking_reasons: plan.validation.blocking_reasons, warnings: [...plan.validation.warnings, safe(reason, "Runtime scheduler persistent-store adapter plan was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreAdapterPlan(plan: RuntimeSchedulerPersistentStoreAdapterPlan): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store adapter plan",
    `State: ${plan.plan_state}`,
    `Adapter: ${plan.adapter_name}`,
    `Store kind: ${plan.store_kind}`,
    `Store reference: ${plan.store_reference}`,
    `Namespace: ${plan.store_namespace}`,
    "Capabilities:",
    ...(plan.capabilities.length ? plan.capabilities.map((capability) => `- ${capability}`) : ["- blocked"]),
    "Implementation steps:",
    ...(plan.implementation_steps.length ? plan.implementation_steps.map((step) => `- ${step}`) : ["- blocked"]),
    `Required next confirmation: ${plan.required_next_confirmation}`,
    `Implementation boundary: ${plan.implementation_boundary}`,
    `File writes enabled: ${plan.file_write_enabled}`,
    `Database writes enabled: ${plan.database_write_enabled}`,
    `Live scheduler enabled: ${plan.live_scheduler_enabled}`,
  ].join("\n");
}
