import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview, renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview, revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-review.js";
import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-plan.js";

const SAFE_PLAN: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan = {
  schema_version: "1.0",
  plan_id: "runtime-scheduler-persistent-store-pure-scaffold-integration-plan-001",
  plan_state: "integration_plan_ready",
  integration_plan_only: true,
  source_closeout_state: "decision_closeout_ready",
  source_decision: "approve_future_integration_planning",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  supported_operation_count: 6,
  scaffold_export_count: 4,
  integration_steps: [
    { step_id: "adapter-boundary-map", label: "Map pure helpers to adapter boundaries.", integration_mode: "planning_only", side_effects_enabled: false },
    { step_id: "call-site-inventory", label: "Inventory future call sites as documentation only.", integration_mode: "planning_only", side_effects_enabled: false },
  ],
  explicit_non_goals: ["Do not import the pure scaffold into live scheduler execution in this plan."],
  required_next_confirmation: "I approve pure scaffold integration review only.",
  implementation_boundary: "Integration plan only.",
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
  validation: { complete: true, integration_plan_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  review_id: "runtime-scheduler-persistent-store-pure-scaffold-integration-review-001",
  operator_id: "operator-runtime-scheduler-pure-scaffold-integration-review-001",
  allow_review_only: true,
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

test("VO-7GX-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-REVIEW-1: creates review without side effects", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(SAFE_INPUT, SAFE_PLAN);

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.review_state, "integration_review_ready");
  assert.equal(review.review_only, true);
  assert.equal(review.source_plan_state, "integration_plan_ready");
  assert.equal(review.integration_step_count, 2);
  assert.equal(review.review_findings.length, 4);
  assert.equal(review.file_write_enabled, false);
  assert.equal(review.database_write_enabled, false);
  assert.equal(review.live_scheduler_enabled, false);
  assert.equal(review.upload_execution_enabled, false);
  assert.equal(review.network_enabled, false);
  assert.equal(review.credential_access_enabled, false);
  assert.equal(review.media_read_enabled, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);
  assert.equal(review.validation.complete, true);
});

test("VO-7GY-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-REVIEW-REVIEW-1: unsafe input or plan blocks review", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview({ ...SAFE_INPUT, allow_network: true as false }, SAFE_PLAN);
  const unsafePlan = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(SAFE_INPUT, { ...SAFE_PLAN, integration_steps: [{ ...SAFE_PLAN.integration_steps[0]!, side_effects_enabled: true as false }] });

  assert.equal(unsafeInput.review_state, "blocked");
  assert.equal(unsafeInput.network_enabled, false);
  assert.equal(unsafePlan.review_state, "blocked");
  assert.equal(unsafePlan.review_findings.length, 0);
});

test("VO-7GY-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-REVIEW-REVIEW-2: renderer and revocation are safe", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(SAFE_INPUT, SAFE_PLAN);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(review);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(review);

  assert.equal(rendered.includes("pure scaffold integration review"), true);
  assert.equal(rendered.includes("Integration step count: 2"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.review_state, "revoked");
  assert.equal(revoked.integration_step_count, 0);
  assert.equal(revoked.validation.complete, false);
});
