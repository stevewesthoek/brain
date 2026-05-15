import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreValidationPacket, renderRuntimeSchedulerPersistentStoreValidationPacket, revokeRuntimeSchedulerPersistentStoreValidationPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-validation.js";
import type { RuntimeSchedulerPersistentStoreFixture } from "./video-orchestrator-runtime-scheduler-persistent-store-fixture.js";

const SAFE_FIXTURE: RuntimeSchedulerPersistentStoreFixture = {
  schema_version: "1.0",
  fixture_id: "runtime-scheduler-persistent-store-fixture-001",
  fixture_state: "fixture_ready_for_review",
  fixture_only: true,
  source_skeleton_state: "skeleton_ready_for_review",
  snapshot_label: "runtime-scheduler-dry-run-snapshot-001",
  adapter_name: "runtime-scheduler-repo-json-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  store_namespace: "video-orchestrator/runtime-scheduler",
  operations: [
    { operation: "load_queue", dry_run_status: "described_not_executed", persistence_enabled: false },
    { operation: "save_queue", dry_run_status: "described_not_executed", persistence_enabled: false },
    { operation: "append_event", dry_run_status: "described_not_executed", persistence_enabled: false },
    { operation: "mark_published", dry_run_status: "described_not_executed", persistence_enabled: false },
    { operation: "mark_failed", dry_run_status: "described_not_executed", persistence_enabled: false },
    { operation: "list_due_items", dry_run_status: "described_not_executed", persistence_enabled: false },
  ],
  dry_run_snapshot_created: true,
  required_next_confirmation: "I approve dry-run persistent scheduler store fixture validation only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Fixture only; validation may be reviewed next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, fixture_ready_for_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  validation_id: "runtime-scheduler-persistent-store-validation-001",
  operator_id: "operator-runtime-scheduler-persistent-store-validation-001",
  expected_operation_count: 6,
  allow_validation_only: true,
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

test("VO-7JF-RUNTIME-SCHEDULER-PERSISTENT-STORE-VALIDATION-1: creates validation packet without side effects", () => {
  const packet = createRuntimeSchedulerPersistentStoreValidationPacket(SAFE_INPUT, SAFE_FIXTURE);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.validation_state, "validation_ready_for_review");
  assert.equal(packet.validation_only, true);
  assert.equal(packet.source_fixture_state, "fixture_ready_for_review");
  assert.equal(packet.fixture_id, "runtime-scheduler-persistent-store-fixture-001");
  assert.equal(packet.adapter_name, "runtime-scheduler-repo-json-adapter");
  assert.equal(packet.store_kind, "repo_json");
  assert.equal(packet.operation_count, 6);
  assert.equal(packet.checks.length, 8);
  assert.equal(packet.checks.every((check) => check.status === "passed"), true);
  assert.equal(packet.required_next_confirmation.includes("I approve persistent scheduler store implementation planning review only"), true);
  assert.equal(packet.implementation_boundary.includes("Validation only"), true);
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.database_write_enabled, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.upload_execution_enabled, false);
  assert.equal(packet.network_enabled, false);
  assert.equal(packet.credential_access_enabled, false);
  assert.equal(packet.media_read_enabled, false);
  assert.equal(packet.git_add_executed, false);
  assert.equal(packet.committed_now, false);
  assert.equal(packet.pushed_now, false);
  assert.equal(packet.validation.complete, true);
});

test("VO-7JG-RUNTIME-SCHEDULER-PERSISTENT-STORE-VALIDATION-2: expected count mismatch blocks validation", () => {
  const packet = createRuntimeSchedulerPersistentStoreValidationPacket({ ...SAFE_INPUT, expected_operation_count: 5 }, SAFE_FIXTURE);

  assert.equal(packet.validation_state, "blocked");
  assert.equal(packet.operation_count, 0);
  assert.equal(packet.checks.length, 1);
  assert.equal(packet.checks[0]?.status, "blocked");
  assert.equal(packet.required_next_confirmation, "No confirmation available while blocked.");
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7JH-RUNTIME-SCHEDULER-PERSISTENT-STORE-VALIDATION-REVIEW-1: unsafe fixture blocks validation", () => {
  const packet = createRuntimeSchedulerPersistentStoreValidationPacket(SAFE_INPUT, { ...SAFE_FIXTURE, fixture_state: "blocked", validation: { complete: false, fixture_ready_for_review: false, blocking_reasons: ["blocked"], warnings: [] } });

  assert.equal(packet.validation_state, "blocked");
  assert.equal(packet.source_fixture_state, "blocked");
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.database_write_enabled, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7JH-RUNTIME-SCHEDULER-PERSISTENT-STORE-VALIDATION-REVIEW-2: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPersistentStoreValidationPacket(SAFE_INPUT, SAFE_FIXTURE);
  const rendered = renderRuntimeSchedulerPersistentStoreValidationPacket(packet);
  const revoked = revokeRuntimeSchedulerPersistentStoreValidationPacket(packet);

  assert.equal(rendered.includes("persistent-store validation packet"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.validation_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.deepEqual(revoked.checks, []);
  assert.equal(revoked.validation.complete, false);
});
