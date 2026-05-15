import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan, renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan, revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-plan.js";
import type { RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-decision-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPersistentStorePureScaffoldDecisionCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-persistent-store-pure-scaffold-decision-closeout-001",
  closeout_state: "decision_closeout_ready",
  closeout_only: true,
  source_decision_state: "operator_decision_ready",
  decision: "approve_future_integration_planning",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  supported_operation_count: 6,
  scaffold_export_count: 4,
  allowed_future_scope_count: 1,
  closeout_items: ["Operator approved future pure scaffold integration planning artifacts only."],
  next_boundary: "Future pure scaffold integration planning may proceed in side-effect-free artifacts only.",
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
  plan_id: "runtime-scheduler-persistent-store-pure-scaffold-integration-plan-001",
  operator_id: "operator-runtime-scheduler-pure-scaffold-integration-plan-001",
  allow_integration_plan_only: true,
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

test("VO-7GV-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-PLAN-1: creates integration plan without side effects", () => {
  const plan = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "integration_plan_ready");
  assert.equal(plan.integration_plan_only, true);
  assert.equal(plan.source_closeout_state, "decision_closeout_ready");
  assert.equal(plan.source_decision, "approve_future_integration_planning");
  assert.equal(plan.supported_operation_count, 6);
  assert.equal(plan.scaffold_export_count, 4);
  assert.equal(plan.integration_steps.length, 4);
  assert.equal(plan.integration_steps.every((step) => step.integration_mode === "planning_only"), true);
  assert.equal(plan.integration_steps.every((step) => step.side_effects_enabled === false), true);
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

test("VO-7GW-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-PLAN-REVIEW-1: defer and reject closeouts block integration plan", () => {
  const defer = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "defer", allowed_future_scope_count: 0 });
  const reject = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "reject", allowed_future_scope_count: 0 });

  assert.equal(defer.plan_state, "blocked");
  assert.equal(defer.integration_steps.length, 0);
  assert.equal(reject.plan_state, "blocked");
  assert.equal(reject.supported_operation_count, 0);
});

test("VO-7GW-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-PLAN-REVIEW-2: unsafe input blocks integration plan", () => {
  const plan = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_CLOSEOUT);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7GW-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-PLAN-REVIEW-3: renderer and revocation are safe", () => {
  const plan = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(plan);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan(plan);

  assert.equal(rendered.includes("pure scaffold integration plan"), true);
  assert.equal(rendered.includes("side_effects=false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.plan_state, "revoked");
  assert.equal(revoked.integration_steps.length, 0);
  assert.equal(revoked.validation.complete, false);
});
