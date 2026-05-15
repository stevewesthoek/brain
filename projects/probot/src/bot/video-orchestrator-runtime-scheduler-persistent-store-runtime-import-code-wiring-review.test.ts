import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview, renderRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview, revokeRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-code-wiring-review.js";
import type { RuntimeSchedulerPersistentStoreRuntimeImportCodeWiringPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-code-wiring-plan.js";

const SAFE_PLAN: RuntimeSchedulerPersistentStoreRuntimeImportCodeWiringPlan = {
  schema_version: "1.0",
  plan_id: "runtime-scheduler-persistent-store-runtime-import-code-wiring-plan-001",
  plan_state: "runtime_import_code_wiring_plan_ready",
  plan_only: true,
  source_closeout_state: "decision_closeout_ready",
  source_decision: "approve_future_runtime_import_code_wiring_plan",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  implementation_step_count: 2,
  allowed_future_scope_count: 1,
  wiring_steps: [
    { step_id: "import-statement-location", label: "Document future import statement location.", mode: "code_wiring_planning_only", runtime_imports_enabled: false, side_effects_enabled: false },
    { step_id: "disabled-feature-gate", label: "Document disabled gate.", mode: "code_wiring_planning_only", runtime_imports_enabled: false, side_effects_enabled: false },
  ],
  explicit_non_goals: ["Do not add runtime imports or change live runtime files in this plan."],
  required_next_confirmation: "I approve runtime import code-wiring review only.",
  implementation_boundary: "Runtime import code-wiring plan only.",
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
  validation: { complete: true, runtime_import_code_wiring_plan_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  review_id: "runtime-scheduler-persistent-store-runtime-import-code-wiring-review-001",
  operator_id: "operator-runtime-scheduler-runtime-import-code-wiring-review-001",
  allow_review_only: true,
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

test("VO-7IL-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-CODE-WIRING-REVIEW-1: creates review without side effects", () => {
  const review = createRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview(SAFE_INPUT, SAFE_PLAN);

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.review_state, "runtime_import_code_wiring_review_ready");
  assert.equal(review.review_only, true);
  assert.equal(review.source_plan_state, "runtime_import_code_wiring_plan_ready");
  assert.equal(review.wiring_step_count, 2);
  assert.equal(review.review_findings.length, 4);
  assert.equal(review.runtime_imports_enabled, false);
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

test("VO-7IM-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-CODE-WIRING-REVIEW-REVIEW-1: unsafe input or plan blocks review", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview({ ...SAFE_INPUT, allow_runtime_imports: true as false }, SAFE_PLAN);
  const unsafePlan = createRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview(SAFE_INPUT, { ...SAFE_PLAN, runtime_imports_enabled: true as false });

  assert.equal(unsafeInput.review_state, "blocked");
  assert.equal(unsafeInput.runtime_imports_enabled, false);
  assert.equal(unsafePlan.review_state, "blocked");
  assert.equal(unsafePlan.review_findings.length, 0);
});

test("VO-7IM-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-CODE-WIRING-REVIEW-REVIEW-2: renderer and revocation are safe", () => {
  const review = createRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview(SAFE_INPUT, SAFE_PLAN);
  const rendered = renderRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview(review);
  const revoked = revokeRuntimeSchedulerPersistentStoreRuntimeImportCodeWiringReview(review);

  assert.equal(rendered.includes("runtime import code-wiring review"), true);
  assert.equal(rendered.includes("Runtime imports enabled: false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.review_state, "revoked");
  assert.equal(revoked.wiring_step_count, 0);
  assert.equal(revoked.validation.complete, false);
});
