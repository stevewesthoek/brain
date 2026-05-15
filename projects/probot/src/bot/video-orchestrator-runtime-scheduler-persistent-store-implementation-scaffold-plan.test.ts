import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan, renderRuntimeSchedulerPersistentStoreImplementationScaffoldPlan, revokeRuntimeSchedulerPersistentStoreImplementationScaffoldPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-scaffold-plan.js";
import type { RuntimeSchedulerPersistentStoreImplementationDesign } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-design.js";

const SAFE_DESIGN: RuntimeSchedulerPersistentStoreImplementationDesign = {
  schema_version: "1.0",
  design_id: "runtime-scheduler-persistent-store-implementation-design-001",
  design_state: "implementation_design_ready",
  design_only: true,
  source_closeout_state: "decision_closeout_ready",
  source_decision: "approve_future_implementation_planning",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  design_sections: [
    "Adapter contract boundaries for queue load, save, event append, published marking, failed marking, and due-item listing.",
    "Validation boundary that checks snapshot shape before any future persistence operation is approved.",
    "Idempotency boundary that keeps published and failed state transitions deterministic.",
    "Dry-run snapshot boundary that can be reviewed without touching storage.",
  ],
  explicit_non_goals: [
    "No file or database writes are enabled by this design packet.",
    "No live scheduler activation is enabled by this design packet.",
    "No platform dispatch, network call, credential access, media read, staging, commit, or push is enabled by this design packet.",
  ],
  required_next_confirmation: "I approve implementation scaffold planning only for the persistent scheduler store adapter, with no file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Implementation design only; a future scaffold may define types and pure functions, but persistence writes, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, implementation_design_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  plan_id: "runtime-scheduler-persistent-store-implementation-scaffold-plan-001",
  operator_id: "operator-runtime-scheduler-persistent-store-implementation-scaffold-plan-001",
  allow_scaffold_plan_only: true,
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

test("VO-7GJ-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-SCAFFOLD-PLAN-1: creates scaffold plan without side effects", () => {
  const plan = createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(SAFE_INPUT, SAFE_DESIGN);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "scaffold_plan_ready");
  assert.equal(plan.scaffold_plan_only, true);
  assert.equal(plan.source_design_state, "implementation_design_ready");
  assert.equal(plan.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter");
  assert.equal(plan.store_kind, "repo_json");
  assert.equal(plan.operation_count, 6);
  assert.equal(plan.scaffold_steps.length, 5);
  assert.equal(plan.scaffold_steps.every((step) => step.mode === "type_and_pure_function_scaffold_only"), true);
  assert.equal(plan.scaffold_steps.every((step) => step.runtime_side_effects_enabled === false), true);
  assert.equal(plan.explicit_non_goals.length, 3);
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

test("VO-7GK-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-SCAFFOLD-PLAN-REVIEW-1: blocked design blocks scaffold plan", () => {
  const plan = createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(SAFE_INPUT, { ...SAFE_DESIGN, design_state: "blocked", validation: { complete: false, implementation_design_ready: false, blocking_reasons: ["blocked"], warnings: [] } });

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.operation_count, 0);
  assert.equal(plan.scaffold_steps.length, 0);
  assert.equal(plan.validation.complete, false);
});

test("VO-7GK-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-SCAFFOLD-PLAN-REVIEW-2: unsafe flags block scaffold plan", () => {
  const plan = createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_DESIGN);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.operation_count, 0);
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7GK-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-SCAFFOLD-PLAN-REVIEW-3: renderer and revocation are safe", () => {
  const plan = createRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(SAFE_INPUT, SAFE_DESIGN);
  const rendered = renderRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(plan);
  const revoked = revokeRuntimeSchedulerPersistentStoreImplementationScaffoldPlan(plan);

  assert.equal(rendered.includes("persistent-store implementation scaffold plan"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("side_effects=false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.plan_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
