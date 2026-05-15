import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreFixture, renderRuntimeSchedulerPersistentStoreFixture, revokeRuntimeSchedulerPersistentStoreFixture } from "./video-orchestrator-runtime-scheduler-persistent-store-fixture.js";
import type { RuntimeSchedulerPersistentStoreAdapterSkeleton } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-skeleton.js";

const SAFE_SKELETON: RuntimeSchedulerPersistentStoreAdapterSkeleton = {
  schema_version: "1.0",
  skeleton_id: "runtime-scheduler-persistent-store-adapter-skeleton-001",
  skeleton_state: "skeleton_ready_for_review",
  skeleton_only: true,
  source_plan_state: "adapter_plan_ready",
  adapter_name: "runtime-scheduler-repo-json-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  store_namespace: "video-orchestrator/runtime-scheduler",
  operations: [
    { operation: "load_queue", mode: "dry_run_descriptor_only", persistence_enabled: false },
    { operation: "save_queue", mode: "dry_run_descriptor_only", persistence_enabled: false },
    { operation: "append_event", mode: "dry_run_descriptor_only", persistence_enabled: false },
    { operation: "mark_published", mode: "dry_run_descriptor_only", persistence_enabled: false },
    { operation: "mark_failed", mode: "dry_run_descriptor_only", persistence_enabled: false },
    { operation: "list_due_items", mode: "dry_run_descriptor_only", persistence_enabled: false },
  ],
  dry_run_snapshot_supported: true,
  required_next_confirmation: "I approve implementing dry-run persistent scheduler store adapter fixtures only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Skeleton only; fixture wiring may be prepared next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, skeleton_ready_for_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  fixture_id: "runtime-scheduler-persistent-store-fixture-001",
  operator_id: "operator-runtime-scheduler-persistent-store-fixture-001",
  snapshot_label: "runtime-scheduler-dry-run-snapshot-001",
  allow_fixture_only: true,
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

test("VO-7JC-RUNTIME-SCHEDULER-PERSISTENT-STORE-FIXTURE-1: creates dry-run fixture without side effects", () => {
  const fixture = createRuntimeSchedulerPersistentStoreFixture(SAFE_INPUT, SAFE_SKELETON);

  assert.equal(fixture.schema_version, "1.0");
  assert.equal(fixture.fixture_state, "fixture_ready_for_review");
  assert.equal(fixture.fixture_only, true);
  assert.equal(fixture.source_skeleton_state, "skeleton_ready_for_review");
  assert.equal(fixture.snapshot_label, "runtime-scheduler-dry-run-snapshot-001");
  assert.equal(fixture.adapter_name, "runtime-scheduler-repo-json-adapter");
  assert.equal(fixture.store_kind, "repo_json");
  assert.equal(fixture.operations.length, 6);
  assert.equal(fixture.operations.every((item) => item.dry_run_status === "described_not_executed"), true);
  assert.equal(fixture.operations.every((item) => item.persistence_enabled === false), true);
  assert.equal(fixture.dry_run_snapshot_created, true);
  assert.equal(fixture.required_next_confirmation.includes("I approve dry-run persistent scheduler store fixture validation only"), true);
  assert.equal(fixture.implementation_boundary.includes("Fixture only"), true);
  assert.equal(fixture.file_write_enabled, false);
  assert.equal(fixture.database_write_enabled, false);
  assert.equal(fixture.live_scheduler_enabled, false);
  assert.equal(fixture.upload_execution_enabled, false);
  assert.equal(fixture.network_enabled, false);
  assert.equal(fixture.credential_access_enabled, false);
  assert.equal(fixture.media_read_enabled, false);
  assert.equal(fixture.git_add_executed, false);
  assert.equal(fixture.committed_now, false);
  assert.equal(fixture.pushed_now, false);
  assert.equal(fixture.validation.complete, true);
});

test("VO-7JD-RUNTIME-SCHEDULER-PERSISTENT-STORE-FIXTURE-2: unsafe flags block fixture", () => {
  const fixture = createRuntimeSchedulerPersistentStoreFixture({ ...SAFE_INPUT, allow_database_write: true as false }, SAFE_SKELETON);

  assert.equal(fixture.fixture_state, "blocked");
  assert.deepEqual(fixture.operations, []);
  assert.equal(fixture.required_next_confirmation, "No confirmation available while blocked.");
  assert.equal(fixture.database_write_enabled, false);
  assert.equal(fixture.validation.complete, false);
});

test("VO-7JE-RUNTIME-SCHEDULER-PERSISTENT-STORE-FIXTURE-REVIEW-1: unsafe skeleton blocks fixture", () => {
  const fixture = createRuntimeSchedulerPersistentStoreFixture(SAFE_INPUT, { ...SAFE_SKELETON, skeleton_state: "blocked", validation: { complete: false, skeleton_ready_for_review: false, blocking_reasons: ["blocked"], warnings: [] } });

  assert.equal(fixture.fixture_state, "blocked");
  assert.equal(fixture.source_skeleton_state, "blocked");
  assert.equal(fixture.file_write_enabled, false);
  assert.equal(fixture.database_write_enabled, false);
  assert.equal(fixture.live_scheduler_enabled, false);
  assert.equal(fixture.validation.complete, false);
});

test("VO-7JE-RUNTIME-SCHEDULER-PERSISTENT-STORE-FIXTURE-REVIEW-2: renderer and revocation are safe", () => {
  const fixture = createRuntimeSchedulerPersistentStoreFixture(SAFE_INPUT, SAFE_SKELETON);
  const rendered = renderRuntimeSchedulerPersistentStoreFixture(fixture);
  const revoked = revokeRuntimeSchedulerPersistentStoreFixture(fixture);

  assert.equal(rendered.includes("persistent-store fixture"), true);
  assert.equal(rendered.includes("described_not_executed"), true);
  assert.equal(rendered.includes("persistence=false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.fixture_state, "revoked");
  assert.deepEqual(revoked.operations, []);
  assert.equal(revoked.validation.complete, false);
});
