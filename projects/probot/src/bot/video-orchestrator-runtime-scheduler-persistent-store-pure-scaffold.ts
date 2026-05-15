import type { RuntimeSchedulerPersistentStoreImplementationScaffoldPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-scaffold-plan.js";
import type { RuntimeSchedulerPersistentStoreOperation } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

export type RuntimeSchedulerPersistentStorePureScaffoldState = "pure_scaffold_ready" | "blocked" | "revoked";
export type RuntimeSchedulerPersistentStoreItemState = "queued" | "published" | "failed";

export interface RuntimeSchedulerPersistentStorePureScaffoldInput {
  scaffold_id: string;
  operator_id: string;
  allow_pure_scaffold_only: true;
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

export interface RuntimeSchedulerPersistentStoreQueueItem {
  id: string;
  state: RuntimeSchedulerPersistentStoreItemState;
  due_at: string;
  attempts: number;
  updated_at: string;
}

export interface RuntimeSchedulerPersistentStoreQueueSnapshot {
  schema_version: "1.0";
  items: RuntimeSchedulerPersistentStoreQueueItem[];
  events: RuntimeSchedulerPersistentStoreEvent[];
}

export interface RuntimeSchedulerPersistentStoreEvent {
  event_id: string;
  item_id: string;
  operation: RuntimeSchedulerPersistentStoreOperation;
  created_at: string;
  dry_run_only: true;
}

export interface RuntimeSchedulerPersistentStorePureScaffold {
  schema_version: "1.0";
  scaffold_id: string;
  scaffold_state: RuntimeSchedulerPersistentStorePureScaffoldState;
  pure_scaffold_only: true;
  source_plan_state: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan["plan_state"];
  adapter_interface_name: string;
  supported_operations: RuntimeSchedulerPersistentStoreOperation[];
  scaffold_exports: string[];
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
  validation: { complete: boolean; pure_scaffold_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

export interface RuntimeSchedulerPersistentStoreSnapshotValidationResult {
  valid: boolean;
  blocking_reasons: string[];
  item_count: number;
  event_count: number;
}

const REQUIRED_OPERATIONS: RuntimeSchedulerPersistentStoreOperation[] = ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"];
const SAFE_ID = /^[a-zA-Z0-9._:-]{1,120}$/;

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldInput): boolean {
  return input.allow_pure_scaffold_only === true
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
    && input.scaffold_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function planReady(plan: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "scaffold_plan_ready"
    && plan.scaffold_plan_only
    && plan.validation.complete
    && plan.validation.scaffold_plan_ready
    && plan.operation_count >= REQUIRED_OPERATIONS.length
    && plan.scaffold_steps.length > 0
    && plan.scaffold_steps.every((step) => step.mode === "type_and_pure_function_scaffold_only" && !step.runtime_side_effects_enabled)
    && !plan.file_write_enabled
    && !plan.database_write_enabled
    && !plan.live_scheduler_enabled
    && !plan.upload_execution_enabled
    && !plan.network_enabled
    && !plan.credential_access_enabled
    && !plan.media_read_enabled
    && !plan.git_add_executed
    && !plan.committed_now
    && !plan.pushed_now;
}

function isSafeId(value: string): boolean {
  return SAFE_ID.test(value) && !value.includes("..") && !value.includes("/") && !value.includes("\\");
}

function isIsoLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

export function validateRuntimeSchedulerPersistentStoreSnapshot(snapshot: RuntimeSchedulerPersistentStoreQueueSnapshot): RuntimeSchedulerPersistentStoreSnapshotValidationResult {
  const blocking_reasons: string[] = [];
  if (snapshot.schema_version !== "1.0") blocking_reasons.push("Snapshot schema_version must be 1.0.");
  if (!Array.isArray(snapshot.items)) blocking_reasons.push("Snapshot items must be an array.");
  if (!Array.isArray(snapshot.events)) blocking_reasons.push("Snapshot events must be an array.");

  for (const item of snapshot.items ?? []) {
    if (!isSafeId(item.id)) blocking_reasons.push("Snapshot contains an unsafe item id.");
    if (!["queued", "published", "failed"].includes(item.state)) blocking_reasons.push("Snapshot contains an invalid item state.");
    if (!Number.isInteger(item.attempts) || item.attempts < 0) blocking_reasons.push("Snapshot contains an invalid attempts count.");
    if (!isIsoLike(item.due_at) || !isIsoLike(item.updated_at)) blocking_reasons.push("Snapshot contains an invalid timestamp.");
  }

  for (const event of snapshot.events ?? []) {
    if (!isSafeId(event.event_id) || !isSafeId(event.item_id)) blocking_reasons.push("Snapshot contains an unsafe event id.");
    if (!REQUIRED_OPERATIONS.includes(event.operation)) blocking_reasons.push("Snapshot contains an unsupported operation.");
    if (!isIsoLike(event.created_at)) blocking_reasons.push("Snapshot contains an invalid event timestamp.");
    if (event.dry_run_only !== true) blocking_reasons.push("Snapshot event must remain dry-run only.");
  }

  return { valid: blocking_reasons.length === 0, blocking_reasons: [...new Set(blocking_reasons)], item_count: Array.isArray(snapshot.items) ? snapshot.items.length : 0, event_count: Array.isArray(snapshot.events) ? snapshot.events.length : 0 };
}

export function markRuntimeSchedulerPersistentStoreItemPublished(item: RuntimeSchedulerPersistentStoreQueueItem, updated_at: string): RuntimeSchedulerPersistentStoreQueueItem {
  return { ...item, state: "published", updated_at: safe(updated_at, item.updated_at) };
}

export function markRuntimeSchedulerPersistentStoreItemFailed(item: RuntimeSchedulerPersistentStoreQueueItem, updated_at: string): RuntimeSchedulerPersistentStoreQueueItem {
  return { ...item, state: "failed", attempts: item.attempts + 1, updated_at: safe(updated_at, item.updated_at) };
}

export function listDueRuntimeSchedulerPersistentStoreItems(snapshot: RuntimeSchedulerPersistentStoreQueueSnapshot, now: string): RuntimeSchedulerPersistentStoreQueueItem[] {
  return snapshot.items.filter((item) => item.state === "queued" && item.due_at <= now);
}

export function createRuntimeSchedulerPersistentStorePureScaffold(input: RuntimeSchedulerPersistentStorePureScaffoldInput, plan: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan): RuntimeSchedulerPersistentStorePureScaffold {
  const ready = inputReady(input) && planReady(plan);
  return {
    schema_version: "1.0",
    scaffold_id: safe(input.scaffold_id, "runtime-scheduler-persistent-store-pure-scaffold"),
    scaffold_state: ready ? "pure_scaffold_ready" : "blocked",
    pure_scaffold_only: true,
    source_plan_state: plan.plan_state,
    adapter_interface_name: safe(plan.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    supported_operations: ready ? [...REQUIRED_OPERATIONS] : [],
    scaffold_exports: ready ? [
      "validateRuntimeSchedulerPersistentStoreSnapshot",
      "markRuntimeSchedulerPersistentStoreItemPublished",
      "markRuntimeSchedulerPersistentStoreItemFailed",
      "listDueRuntimeSchedulerPersistentStoreItems",
    ] : [],
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
    validation: { complete: ready, pure_scaffold_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold input or scaffold plan was unsafe/incomplete."], warnings: ["Pure scaffold only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffold(scaffold: RuntimeSchedulerPersistentStorePureScaffold, reason?: string): RuntimeSchedulerPersistentStorePureScaffold {
  return { ...scaffold, scaffold_state: "revoked", supported_operations: [], scaffold_exports: [], validation: { complete: false, pure_scaffold_ready: false, blocking_reasons: scaffold.validation.blocking_reasons, warnings: [...scaffold.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffold(scaffold: RuntimeSchedulerPersistentStorePureScaffold): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold",
    `State: ${scaffold.scaffold_state}`,
    `Adapter interface: ${scaffold.adapter_interface_name}`,
    "Supported operations:",
    ...(scaffold.supported_operations.length ? scaffold.supported_operations.map((operation) => `- ${operation}`) : ["- blocked"]),
    "Scaffold exports:",
    ...(scaffold.scaffold_exports.length ? scaffold.scaffold_exports.map((item) => `- ${item}`) : ["- blocked"]),
    `File writes enabled: ${scaffold.file_write_enabled}`,
    `Database writes enabled: ${scaffold.database_write_enabled}`,
    `Live scheduler enabled: ${scaffold.live_scheduler_enabled}`,
  ].join("\n");
}
