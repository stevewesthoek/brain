import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan, renderRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan, revokeRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-activation-plan.js";
import type { RuntimeSchedulerPersistentStoreRuntimeImportEnablementDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-enablement-decision-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPersistentStoreRuntimeImportEnablementDecisionCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-persistent-store-runtime-import-enablement-decision-closeout-001",
  closeout_state: "decision_closeout_ready",
  closeout_only: true,
  source_decision_state: "operator_decision_ready",
  decision: "approve_future_runtime_import_activation_plan",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  enablement_step_count: 2,
  allowed_future_scope_count: 1,
  closeout_items: ["Operator approved future runtime import activation planning artifacts only."],
  next_boundary: "Future runtime import activation planning may proceed in side-effect-free artifacts only.",
  runtime_imports_enabled: false,
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
  validation: { complete: true, decision_closeout_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  plan_id: "runtime-scheduler-persistent-store-runtime-import-activation-plan-001",
  operator_id: "operator-runtime-scheduler-runtime-import-activation-plan-001",
  allow_plan_only: true,
  allow_runtime_imports: false,
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

test("VO-7KH-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-ACTIVATION-PLAN-1: creates plan without side effects", () => {
  const plan = createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "runtime_import_activation_plan_ready");
  assert.equal(plan.plan_only, true);
  assert.equal(plan.source_closeout_state, "decision_closeout_ready");
  assert.equal(plan.source_decision, "approve_future_runtime_import_activation_plan");
  assert.equal(plan.enablement_step_count, 2);
  assert.equal(plan.allowed_future_scope_count, 1);
  assert.equal(plan.activation_steps.length, 4);
  assert.equal(plan.activation_steps.every((step) => step.runtime_imports_enabled === false), true);
  assert.equal(plan.activation_steps.every((step) => step.file_modifications_enabled === false), true);
  assert.equal(plan.activation_steps.every((step) => step.side_effects_enabled === false), true);
  assert.equal(plan.runtime_imports_enabled, false);
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

test("VO-7KI-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-ACTIVATION-PLAN-REVIEW-1: defer and reject closeouts block plan", () => {
  const defer = createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "defer", allowed_future_scope_count: 0 });
  const reject = createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "reject", allowed_future_scope_count: 0 });

  assert.equal(defer.plan_state, "blocked");
  assert.equal(defer.activation_steps.length, 0);
  assert.equal(reject.plan_state, "blocked");
  assert.equal(reject.enablement_step_count, 0);
});

test("VO-7KI-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-ACTIVATION-PLAN-REVIEW-2: unsafe input blocks plan", () => {
  const plan = createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan({ ...SAFE_INPUT, allow_runtime_imports: true as false }, SAFE_CLOSEOUT);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.runtime_imports_enabled, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7KI-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-ACTIVATION-PLAN-REVIEW-3: renderer and revocation are safe", () => {
  const plan = createRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(plan);
  const revoked = revokeRuntimeSchedulerPersistentStoreRuntimeImportActivationPlan(plan);

  assert.equal(rendered.includes("runtime import activation plan"), true);
  assert.equal(rendered.includes("runtime_imports=false"), true);
  assert.equal(rendered.includes("file_modifications=false"), true);
  assert.equal(rendered.includes("side_effects=false"), true);
  assert.equal(rendered.includes("Runtime imports enabled: false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.plan_state, "revoked");
  assert.equal(revoked.activation_steps.length, 0);
  assert.equal(revoked.validation.complete, false);
});
