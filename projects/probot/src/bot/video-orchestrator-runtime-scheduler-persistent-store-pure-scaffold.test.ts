import { test } from "node:test";
import assert from "node:assert";
import {
  createRuntimeSchedulerPersistentStorePureScaffold,
  listDueRuntimeSchedulerPersistentStoreItems,
  markRuntimeSchedulerPersistentStoreItemFailed,
  markRuntimeSchedulerPersistentStoreItemPublished,
  renderRuntimeSchedulerPersistentStorePureScaffold,
  revokeRuntimeSchedulerPersistentStorePureScaffold,
  validateRuntimeSchedulerPersistentStoreSnapshot,
  type RuntimeSchedulerPersistentStoreQueueSnapshot,
} from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold.js";
import type { RuntimeSchedulerPersistentStoreImplementationScaffoldPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-scaffold-plan.js";

const SAFE_PLAN: RuntimeSchedulerPersistentStoreImplementationScaffoldPlan = {
  schema_version: "1.0",
  plan_id: "runtime-scheduler-persistent-store-implementation-scaffold-plan-001",
  plan_state: "scaffold_plan_ready",
  scaffold_plan_only: true,
  source_design_state: "implementation_design_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  scaffold_steps: [
    { step_id: "types", label: "Define adapter input/output types.", mode: "type_and_pure_function_scaffold_only", runtime_side_effects_enabled: false },
    { step_id: "validators", label: "Define pure validators.", mode: "type_and_pure_function_scaffold_only", runtime_side_effects_enabled: false },
  ],
  explicit_non_goals: ["Do not implement file or database persistence in this scaffold plan."],
  required_next_confirmation: "I approve creating a pure persistent scheduler store scaffold only.",
  implementation_boundary: "Scaffold plan only.",
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
  validation: { complete: true, scaffold_plan_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  scaffold_id: "runtime-scheduler-persistent-store-pure-scaffold-001",
  operator_id: "operator-runtime-scheduler-persistent-store-pure-scaffold-001",
  allow_pure_scaffold_only: true,
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

const SAFE_SNAPSHOT: RuntimeSchedulerPersistentStoreQueueSnapshot = {
  schema_version: "1.0",
  items: [
    { id: "item-1", state: "queued", due_at: "2026-05-15T10:00:00Z", attempts: 0, updated_at: "2026-05-15T09:00:00Z" },
    { id: "item-2", state: "queued", due_at: "2026-05-16T10:00:00Z", attempts: 1, updated_at: "2026-05-15T09:00:00Z" },
  ],
  events: [
    { event_id: "event-1", item_id: "item-1", operation: "append_event", created_at: "2026-05-15T09:00:00Z", dry_run_only: true },
  ],
};

test("VO-7GL-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-1: creates pure scaffold without side effects", () => {
  const scaffold = createRuntimeSchedulerPersistentStorePureScaffold(SAFE_INPUT, SAFE_PLAN);

  assert.equal(scaffold.schema_version, "1.0");
  assert.equal(scaffold.scaffold_state, "pure_scaffold_ready");
  assert.equal(scaffold.pure_scaffold_only, true);
  assert.equal(scaffold.supported_operations.length, 6);
  assert.equal(scaffold.scaffold_exports.includes("validateRuntimeSchedulerPersistentStoreSnapshot"), true);
  assert.equal(scaffold.file_write_enabled, false);
  assert.equal(scaffold.database_write_enabled, false);
  assert.equal(scaffold.live_scheduler_enabled, false);
  assert.equal(scaffold.upload_execution_enabled, false);
  assert.equal(scaffold.network_enabled, false);
  assert.equal(scaffold.credential_access_enabled, false);
  assert.equal(scaffold.media_read_enabled, false);
  assert.equal(scaffold.git_add_executed, false);
  assert.equal(scaffold.committed_now, false);
  assert.equal(scaffold.pushed_now, false);
  assert.equal(scaffold.validation.complete, true);
});

test("VO-7GM-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-1: validates safe and unsafe snapshots", () => {
  const safe = validateRuntimeSchedulerPersistentStoreSnapshot(SAFE_SNAPSHOT);
  const unsafe = validateRuntimeSchedulerPersistentStoreSnapshot({
    ...SAFE_SNAPSHOT,
    items: [{ id: "../unsafe", state: "queued", due_at: "2026-05-15T10:00:00Z", attempts: -1, updated_at: "2026-05-15T09:00:00Z" }],
    events: [{ event_id: "event-1", item_id: "item-1", operation: "append_event", created_at: "2026-05-15T09:00:00Z", dry_run_only: false as true }],
  });

  assert.equal(safe.valid, true);
  assert.equal(safe.item_count, 2);
  assert.equal(safe.event_count, 1);
  assert.equal(unsafe.valid, false);
  assert.equal(unsafe.blocking_reasons.includes("Snapshot contains an unsafe item id."), true);
  assert.equal(unsafe.blocking_reasons.includes("Snapshot contains an invalid attempts count."), true);
  assert.equal(unsafe.blocking_reasons.includes("Snapshot event must remain dry-run only."), true);
});

test("VO-7GM-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-2: pure state helpers do not mutate inputs", () => {
  const item = SAFE_SNAPSHOT.items[0]!;
  const published = markRuntimeSchedulerPersistentStoreItemPublished(item, "2026-05-15T11:00:00Z");
  const failed = markRuntimeSchedulerPersistentStoreItemFailed(item, "2026-05-15T12:00:00Z");
  const due = listDueRuntimeSchedulerPersistentStoreItems(SAFE_SNAPSHOT, "2026-05-15T12:00:00Z");

  assert.equal(item.state, "queued");
  assert.equal(item.attempts, 0);
  assert.equal(published.state, "published");
  assert.equal(published.updated_at, "2026-05-15T11:00:00Z");
  assert.equal(failed.state, "failed");
  assert.equal(failed.attempts, 1);
  assert.equal(due.length, 1);
  assert.equal(due[0]!.id, "item-1");
});

test("VO-7GM-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-3: renderer and revocation are safe", () => {
  const scaffold = createRuntimeSchedulerPersistentStorePureScaffold(SAFE_INPUT, SAFE_PLAN);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffold(scaffold);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffold(scaffold);

  assert.equal(rendered.includes("persistent-store pure scaffold"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.scaffold_state, "revoked");
  assert.equal(revoked.supported_operations.length, 0);
  assert.equal(revoked.validation.complete, false);
});
