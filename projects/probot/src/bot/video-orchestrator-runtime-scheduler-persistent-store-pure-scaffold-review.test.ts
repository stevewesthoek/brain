import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldReview, renderRuntimeSchedulerPersistentStorePureScaffoldReview, revokeRuntimeSchedulerPersistentStorePureScaffoldReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-review.js";
import type { RuntimeSchedulerPersistentStorePureScaffold } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold.js";

const SAFE_SCAFFOLD: RuntimeSchedulerPersistentStorePureScaffold = {
  schema_version: "1.0",
  scaffold_id: "runtime-scheduler-persistent-store-pure-scaffold-001",
  scaffold_state: "pure_scaffold_ready",
  pure_scaffold_only: true,
  source_plan_state: "scaffold_plan_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  supported_operations: ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"],
  scaffold_exports: [
    "validateRuntimeSchedulerPersistentStoreSnapshot",
    "markRuntimeSchedulerPersistentStoreItemPublished",
    "markRuntimeSchedulerPersistentStoreItemFailed",
    "listDueRuntimeSchedulerPersistentStoreItems",
  ],
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
  validation: { complete: true, pure_scaffold_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  review_id: "runtime-scheduler-persistent-store-pure-scaffold-review-001",
  operator_id: "operator-runtime-scheduler-persistent-store-pure-scaffold-review-001",
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

test("VO-7GN-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-1: creates review without side effects", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldReview(SAFE_INPUT, SAFE_SCAFFOLD);

  assert.equal(review.schema_version, "1.0");
  assert.equal(review.review_state, "pure_scaffold_review_ready");
  assert.equal(review.review_only, true);
  assert.equal(review.source_scaffold_state, "pure_scaffold_ready");
  assert.equal(review.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter");
  assert.equal(review.supported_operation_count, 6);
  assert.equal(review.scaffold_export_count, 4);
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

test("VO-7GO-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-REVIEW-1: unsafe input blocks review", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldReview({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_SCAFFOLD);

  assert.equal(review.review_state, "blocked");
  assert.equal(review.supported_operation_count, 0);
  assert.equal(review.scaffold_export_count, 0);
  assert.equal(review.file_write_enabled, false);
  assert.equal(review.validation.complete, false);
});

test("VO-7GO-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-REVIEW-2: incomplete scaffold blocks review", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldReview(SAFE_INPUT, { ...SAFE_SCAFFOLD, scaffold_exports: [] });

  assert.equal(review.review_state, "blocked");
  assert.equal(review.review_findings.length, 0);
  assert.equal(review.validation.complete, false);
});

test("VO-7GO-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-REVIEW-REVIEW-3: renderer and revocation are safe", () => {
  const review = createRuntimeSchedulerPersistentStorePureScaffoldReview(SAFE_INPUT, SAFE_SCAFFOLD);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldReview(review);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldReview(review);

  assert.equal(rendered.includes("persistent-store pure scaffold review"), true);
  assert.equal(rendered.includes("Supported operation count: 6"), true);
  assert.equal(rendered.includes("Scaffold export count: 4"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.review_state, "revoked");
  assert.equal(revoked.supported_operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
