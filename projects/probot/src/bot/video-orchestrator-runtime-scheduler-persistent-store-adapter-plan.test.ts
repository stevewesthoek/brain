import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreAdapterPlan, renderRuntimeSchedulerPersistentStoreAdapterPlan, revokeRuntimeSchedulerPersistentStoreAdapterPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-plan.js";
import type { RuntimeSchedulerPersistentStoreContract } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

const SAFE_CONTRACT: RuntimeSchedulerPersistentStoreContract = {
  schema_version: "1.0",
  contract_id: "runtime-scheduler-persistent-store-contract-001",
  contract_state: "contract_ready_for_review",
  contract_only: true,
  source_approval_state: "ready_for_operator_confirmation",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  store_namespace: "video-orchestrator/runtime-scheduler",
  operations: ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"],
  required_next_confirmation: "I approve implementing the persistent scheduler store adapter contract only, with no live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Contract only; adapter implementation may be planned next, but actual writes, migrations, live scheduling, uploads, network, credential access, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, contract_ready_for_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  plan_id: "runtime-scheduler-persistent-store-adapter-plan-001",
  operator_id: "operator-runtime-scheduler-persistent-store-adapter-plan-001",
  adapter_name: "runtime-scheduler-repo-json-adapter",
  capabilities: ["atomic_load_save", "append_only_events", "idempotent_state_transitions", "due_item_query", "schema_validation", "dry_run_snapshot"],
  allow_plan_only: true,
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

test("VO-7IW-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-PLAN-1: creates adapter plan without side effects", () => {
  const plan = createRuntimeSchedulerPersistentStoreAdapterPlan(SAFE_INPUT, SAFE_CONTRACT);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "adapter_plan_ready");
  assert.equal(plan.plan_only, true);
  assert.equal(plan.source_contract_state, "contract_ready_for_review");
  assert.equal(plan.adapter_name, "runtime-scheduler-repo-json-adapter");
  assert.equal(plan.store_kind, "repo_json");
  assert.equal(plan.store_reference, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  assert.equal(plan.operations.includes("load_queue"), true);
  assert.equal(plan.capabilities.includes("atomic_load_save"), true);
  assert.equal(plan.capabilities.includes("dry_run_snapshot"), true);
  assert.equal(plan.implementation_steps.length, 4);
  assert.equal(plan.validation_steps.length, 3);
  assert.equal(plan.required_next_confirmation.includes("I approve implementing the persistent scheduler store adapter skeleton only"), true);
  assert.equal(plan.implementation_boundary.includes("Adapter plan only"), true);
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.database_write_enabled, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.upload_execution_enabled, false);
  assert.equal(plan.network_enabled, false);
  assert.equal(plan.credential_access_enabled, false);
  assert.equal(plan.media_read_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
});

test("VO-7IX-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-PLAN-2: missing capabilities block plan", () => {
  const plan = createRuntimeSchedulerPersistentStoreAdapterPlan({ ...SAFE_INPUT, capabilities: ["atomic_load_save"] }, SAFE_CONTRACT);

  assert.equal(plan.plan_state, "blocked");
  assert.deepEqual(plan.capabilities, []);
  assert.deepEqual(plan.implementation_steps, []);
  assert.equal(plan.required_next_confirmation, "No confirmation available while blocked.");
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7IY-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-PLAN-REVIEW-1: unsafe contract blocks plan", () => {
  const plan = createRuntimeSchedulerPersistentStoreAdapterPlan(SAFE_INPUT, { ...SAFE_CONTRACT, contract_state: "blocked", validation: { complete: false, contract_ready_for_review: false, blocking_reasons: ["blocked"], warnings: [] } });

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.source_contract_state, "blocked");
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.database_write_enabled, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7IY-RUNTIME-SCHEDULER-PERSISTENT-STORE-ADAPTER-PLAN-REVIEW-2: renderer and revocation are safe", () => {
  const plan = createRuntimeSchedulerPersistentStoreAdapterPlan(SAFE_INPUT, SAFE_CONTRACT);
  const rendered = renderRuntimeSchedulerPersistentStoreAdapterPlan(plan);
  const revoked = revokeRuntimeSchedulerPersistentStoreAdapterPlan(plan);

  assert.equal(rendered.includes("persistent-store adapter plan"), true);
  assert.equal(rendered.includes("Capabilities"), true);
  assert.equal(rendered.includes("Implementation steps"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.plan_state, "revoked");
  assert.deepEqual(revoked.capabilities, []);
  assert.deepEqual(revoked.implementation_steps, []);
  assert.equal(revoked.validation.complete, false);
});
