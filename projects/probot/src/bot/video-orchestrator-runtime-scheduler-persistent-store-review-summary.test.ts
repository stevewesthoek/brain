import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreReviewSummary, renderRuntimeSchedulerPersistentStoreReviewSummary, revokeRuntimeSchedulerPersistentStoreReviewSummary } from "./video-orchestrator-runtime-scheduler-persistent-store-review-summary.js";
import type { RuntimeSchedulerPersistentStoreValidationPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-validation.js";

const SAFE_VALIDATION: RuntimeSchedulerPersistentStoreValidationPacket = {
  schema_version: "1.0",
  validation_id: "runtime-scheduler-persistent-store-validation-001",
  validation_state: "validation_ready_for_review",
  validation_only: true,
  source_fixture_state: "fixture_ready_for_review",
  fixture_id: "runtime-scheduler-persistent-store-fixture-001",
  adapter_name: "runtime-scheduler-json-queue-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  checks: [
    { check_id: "fixture-integrity", operation: "fixture_integrity", status: "passed", details: "Fixture is complete, dry-run only, and ready for review." },
    { check_id: "operation-1-load_queue", operation: "load_queue", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "operation-2-save_queue", operation: "save_queue", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "operation-3-append_event", operation: "append_event", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "operation-4-mark_published", operation: "mark_published", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "operation-5-mark_failed", operation: "mark_failed", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "operation-6-list_due_items", operation: "list_due_items", status: "passed", details: "Dry-run operation descriptor is present and not executed." },
    { check_id: "safety-flags", operation: "safety_flags", status: "passed", details: "No file writes, database writes, live scheduler, platform dispatch, network, credential, media, staging, commit, or push behavior is enabled." },
  ],
  required_next_confirmation: "I approve persistent scheduler store implementation planning review only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Validation only; implementation planning review may proceed next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, validation_ready_for_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  summary_id: "runtime-scheduler-persistent-store-review-summary-001",
  operator_id: "operator-runtime-scheduler-persistent-store-review-summary-001",
  allow_summary_only: true,
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

test("VO-7FZ-RUNTIME-SCHEDULER-PERSISTENT-STORE-REVIEW-SUMMARY-1: creates review summary without side effects", () => {
  const summary = createRuntimeSchedulerPersistentStoreReviewSummary(SAFE_INPUT, SAFE_VALIDATION);

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_state, "review_summary_ready");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.source_validation_state, "validation_ready_for_review");
  assert.equal(summary.fixture_id, "runtime-scheduler-persistent-store-fixture-001");
  assert.equal(summary.adapter_name, "runtime-scheduler-json-queue-adapter");
  assert.equal(summary.store_kind, "repo_json");
  assert.equal(summary.operation_count, 6);
  assert.equal(summary.passed_check_count, 8);
  assert.equal(summary.blocked_check_count, 0);
  assert.equal(summary.review_items.length, 4);
  assert.equal(summary.file_write_enabled, false);
  assert.equal(summary.database_write_enabled, false);
  assert.equal(summary.live_scheduler_enabled, false);
  assert.equal(summary.upload_execution_enabled, false);
  assert.equal(summary.network_enabled, false);
  assert.equal(summary.credential_access_enabled, false);
  assert.equal(summary.media_read_enabled, false);
  assert.equal(summary.git_add_executed, false);
  assert.equal(summary.committed_now, false);
  assert.equal(summary.pushed_now, false);
  assert.equal(summary.validation.complete, true);
});

test("VO-7GA-RUNTIME-SCHEDULER-PERSISTENT-STORE-REVIEW-SUMMARY-REVIEW-1: unsafe flags block summary", () => {
  const summary = createRuntimeSchedulerPersistentStoreReviewSummary({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_VALIDATION);

  assert.equal(summary.summary_state, "blocked");
  assert.equal(summary.operation_count, 0);
  assert.equal(summary.passed_check_count, 0);
  assert.equal(summary.blocked_check_count, SAFE_VALIDATION.checks.length);
  assert.equal(summary.file_write_enabled, false);
  assert.equal(summary.validation.complete, false);
});

test("VO-7GA-RUNTIME-SCHEDULER-PERSISTENT-STORE-REVIEW-SUMMARY-REVIEW-2: blocked check in validation blocks summary", () => {
  const blocked = createRuntimeSchedulerPersistentStoreReviewSummary(SAFE_INPUT, {
    ...SAFE_VALIDATION,
    checks: [...SAFE_VALIDATION.checks.slice(0, -1), { check_id: "safety-flags", operation: "safety_flags", status: "blocked", details: "Safety flags were not clean." }],
  });

  assert.equal(blocked.summary_state, "blocked");
  assert.equal(blocked.review_items.length, 0);
  assert.equal(blocked.validation.complete, false);
});

test("VO-7GA-RUNTIME-SCHEDULER-PERSISTENT-STORE-REVIEW-SUMMARY-REVIEW-3: renderer and revocation are safe", () => {
  const summary = createRuntimeSchedulerPersistentStoreReviewSummary(SAFE_INPUT, SAFE_VALIDATION);
  const rendered = renderRuntimeSchedulerPersistentStoreReviewSummary(summary);
  const revoked = revokeRuntimeSchedulerPersistentStoreReviewSummary(summary);

  assert.equal(rendered.includes("persistent-store review summary"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("Passed checks: 8"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.summary_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
