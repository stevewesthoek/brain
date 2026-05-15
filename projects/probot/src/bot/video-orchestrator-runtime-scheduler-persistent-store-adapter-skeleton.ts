import type { RuntimeSchedulerPersistentStoreAdapterPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-plan.js";
import type { RuntimeSchedulerPersistentStoreOperation } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

export type RuntimeSchedulerPersistentStoreAdapterSkeletonState = "skeleton_ready_for_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreAdapterSkeletonInput {
  skeleton_id: string;
  operator_id: string;
  allow_skeleton_only: true;
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

export interface RuntimeSchedulerPersistentStoreAdapterSkeletonOperation {
  operation: RuntimeSchedulerPersistentStoreOperation;
  mode: "dry_run_descriptor_only";
  persistence_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreAdapterSkeleton {
  schema_version: "1.0";
  skeleton_id: string;
  skeleton_state: RuntimeSchedulerPersistentStoreAdapterSkeletonState;
  skeleton_only: true;
  source_plan_state: RuntimeSchedulerPersistentStoreAdapterPlan["plan_state"];
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreAdapterPlan["store_kind"];
  store_reference: string;
  store_namespace: string;
  operations: RuntimeSchedulerPersistentStoreAdapterSkeletonOperation[];
  dry_run_snapshot_supported: boolean;
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
  validation: { complete: boolean; skeleton_ready_for_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreAdapterSkeletonInput): boolean {
  return input.allow_skeleton_only === true
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
    && input.skeleton_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function planReady(plan: RuntimeSchedulerPersistentStoreAdapterPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "adapter_plan_ready"
    && plan.plan_only
    && plan.validation.complete
    && plan.validation.adapter_plan_ready
    && plan.operations.length >= 6
    && plan.capabilities.includes("dry_run_snapshot")
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

function toSkeletonOperation(operation: RuntimeSchedulerPersistentStoreOperation): RuntimeSchedulerPersistentStoreAdapterSkeletonOperation {
  return { operation, mode: "dry_run_descriptor_only", persistence_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreAdapterSkeleton(input: RuntimeSchedulerPersistentStoreAdapterSkeletonInput, plan: RuntimeSchedulerPersistentStoreAdapterPlan): RuntimeSchedulerPersistentStoreAdapterSkeleton {
  const ready = inputReady(input) && planReady(plan);
  return {
    schema_version: "1.0",
    skeleton_id: safe(input.skeleton_id, "runtime-scheduler-persistent-store-adapter-skeleton"),
    skeleton_state: ready ? "skeleton_ready_for_review" : "blocked",
    skeleton_only: true,
    source_plan_state: plan.plan_state,
    adapter_name: safe(plan.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: plan.store_kind,
    store_reference: safe(plan.store_reference, "blocked-reference"),
    store_namespace: safe(plan.store_namespace, "runtime-scheduler"),
    operations: ready ? plan.operations.map(toSkeletonOperation) : [],
    dry_run_snapshot_supported: ready && plan.capabilities.includes("dry_run_snapshot"),
    required_next_confirmation: ready ? "I approve implementing dry-run persistent scheduler store adapter fixtures only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Skeleton only; fixture wiring may be prepared next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked adapter plan or unsafe skeleton input before continuing.",
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
    validation: { complete: ready, skeleton_ready_for_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store adapter skeleton input or plan was unsafe/incomplete."], warnings: ["Adapter skeleton only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreAdapterSkeleton(skeleton: RuntimeSchedulerPersistentStoreAdapterSkeleton, reason?: string): RuntimeSchedulerPersistentStoreAdapterSkeleton {
  return { ...skeleton, skeleton_state: "revoked", operations: [], dry_run_snapshot_supported: false, required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, skeleton_ready_for_review: false, blocking_reasons: skeleton.validation.blocking_reasons, warnings: [...skeleton.validation.warnings, safe(reason, "Runtime scheduler persistent-store adapter skeleton was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreAdapterSkeleton(skeleton: RuntimeSchedulerPersistentStoreAdapterSkeleton): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store adapter skeleton",
    `State: ${skeleton.skeleton_state}`,
    `Adapter: ${skeleton.adapter_name}`,
    `Store kind: ${skeleton.store_kind}`,
    `Store reference: ${skeleton.store_reference}`,
    `Namespace: ${skeleton.store_namespace}`,
    "Operations:",
    ...(skeleton.operations.length ? skeleton.operations.map((item) => `- ${item.operation}: ${item.mode}; persistence=${item.persistence_enabled}`) : ["- blocked"]),
    `Dry-run snapshot supported: ${skeleton.dry_run_snapshot_supported}`,
    `Required next confirmation: ${skeleton.required_next_confirmation}`,
    `Implementation boundary: ${skeleton.implementation_boundary}`,
    `File writes enabled: ${skeleton.file_write_enabled}`,
    `Database writes enabled: ${skeleton.database_write_enabled}`,
    `Live scheduler enabled: ${skeleton.live_scheduler_enabled}`,
  ].join("\n");
}
