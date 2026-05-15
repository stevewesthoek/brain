import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreAdapterSkeleton, renderRuntimeSchedulerPersistentStoreAdapterSkeleton, revokeRuntimeSchedulerPersistentStoreAdapterSkeleton } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-skeleton.js";
import type { RuntimeSchedulerPersistentStoreAdapterPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-plan.js";

const SAFE_PLAN: RuntimeSchedulerPersistentStoreAdapterPlan = {
  schema_version: "1.0",
  plan_id: "runtime-scheduler-persistent-store-adapter-plan-001",
  plan_state: "adapter_plan_ready",
  plan_only: true,
  source_contract_state: "contract_ready_for_review",
  adapter_name: "runtime-scheduler-repo-json-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  store_namespace: "video-orchestrator/runtime-scheduler",
  operations: ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"],
  capabilities: ["atomic_load_save", "append_only_events", "idempotent_state_transitions", "due_item_query", "schema_validation", "dry_run_snapshot"],
  implementation_steps: ["Define a store adapter interface that implements the approved queue operations."],
  validation_steps: ["Typecheck the adapter contract and fixtures."],
  required_next_confirmation: "I approve implementing the persistent scheduler store adapter skeleton only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Adapter plan only; skeleton implementation may be prepared next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, adapter_plan_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  skeleton_id: "runtime-scheduler-persistent-store-adapter-skeleton-001",
  operator_id: "operator-runtime-scheduler-persistent-store-adapter-skeleton-001",
  allow_skeleton_only: true,
  allow_file_write: false,
  allow_database_write: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

test("VO-7IZ-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-SKELETON-1: creates skeleton without side effects", () => {
  const skeleton = createRuntimeSchedulerPersistentStoreAdapterSkeleton(SAFE_INPUT, SAFE_PLAN);

  assert.equal(skeleton.schema_version, "1.0");
  assert.equal(skeleton.skeleton_state, "skeleton_ready_for_review");
  assert.equal(skeleton.skeleton_only, true);
  assert.equal(skeleton.source_plan_state, "adapter_plan_ready");
  assert.equal(skeleton.adapter_name, "runtime-scheduler-repo-json-adapter");
  assert.equal(skeleton.store_kind, "repo_json");
  assert.equal(skeleton.operations.length, 6);
  assert.equal(skeleton.operations.every((item) => item.mode === "dry_run_descriptor_only"), true);
  assert.equal(skeleton.operations.every((item) => item.persistence_enabled === false), true);
  assert.equal(skeleton.dry_run_snapshot_supported, true);
  assert.equal(skeleton.required_next_confirmation.includes("I approve implementing dry-run persistent scheduler store adapter fixtures only"), true);
  assert.equal(skeleton.implementation_boundary.includes("Skeleton only"), true);
  assert.equal(skeleton.file_write_enabled, false);
  assert.equal(skeleton.database_write_enabled, false);
  assert.equal(skeleton.live_scheduler_enabled, false);
  assert.equal(skeleton.upload_execution_enabled, false);
  assert.equal(skeleton.network_enabled, false);
  assert.equal(skeleton.credential_access_enabled, false);
  assert.equal(skeleton.media_read_enabled, false);
  assert.equal(skeleton.git_add_executed, false);
  assert.equal(skeleton.committed_now, false);
  assert.equal(skeleton.pushed_now, false);
  assert.equal(skeleton.validation.complete, true);
});

test("VO-7JA-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-SKELETON-2: unsafe flags block skeleton", () => {
  const skeleton = createRuntimeSchedulerPersistentStoreAdapterSkeleton({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_PLAN);

  assert.equal(skeleton.skeleton_state, "blocked");
  assert.deepEqual(skeleton.operations, []);
  assert.equal(skeleton.dry_run_snapshot_supported, false);
  assert.equal(skeleton.required_next_confirmation, "No confirmation available while blocked.");
  assert.equal(skeleton.file_write_enabled, false);
  assert.equal(skeleton.validation.complete, false);
});

test("VO-7JB-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-SKELETON-REVIEW-1: unsafe plan blocks skeleton", () => {
  const skeleton = createRuntimeSchedulerPersistentStoreAdapterSkeleton(SAFE_INPUT, { ...SAFE_PLAN, plan_state: "blocked", validation: { complete: false, adapter_plan_ready: false, blocking_reasons: ["blocked"], warnings: [] } });

  assert.equal(skeleton.skeleton_state, "blocked");
  assert.equal(skeleton.source_plan_state, "blocked");
  assert.equal(skeleton.file_write_enabled, false);
  assert.equal(skeleton.database_write_enabled, false);
  assert.equal(skeleton.live_scheduler_enabled, false);
  assert.equal(skeleton.validation.complete, false);
});

test("VO-7JB-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-SKELETON-REVIEW-2: renderer and revocation are safe", () => {
  const skeleton = createRuntimeSchedulerPersistentStoreAdapterSkeleton(SAFE_INPUT, SAFE_PLAN);
  const rendered = renderRuntimeSchedulerPersistentStoreAdapterSkeleton(skeleton);
  const revoked = revokeRuntimeSchedulerPersistentStoreAdapterSkeleton(skeleton);

  assert.equal(rendered.includes("persistent-store adapter skeleton"), true);
  assert.equal(rendered.includes("dry_run_descriptor_only"), true);
  assert.equal(rendered.includes("persistence=false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.skeleton_state, "revoked");
  assert.deepEqual(revoked.operations, []);
  assert.equal(revoked.dry_run_snapshot_supported, false);
  assert.equal(revoked.validation.complete, false);
});
