import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreTerminalHandoff, renderRuntimeSchedulerPersistentStoreTerminalHandoff, revokeRuntimeSchedulerPersistentStoreTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-terminal-handoff.js";
import type { RuntimeSchedulerPersistentStoreReviewSummary } from "./video-orchestrator-runtime-scheduler-persistent-store-review-summary.js";

const SAFE_SUMMARY: RuntimeSchedulerPersistentStoreReviewSummary = {
  schema_version: "1.0",
  summary_id: "runtime-scheduler-persistent-store-review-summary-001",
  summary_state: "review_summary_ready",
  summary_only: true,
  source_validation_state: "validation_ready_for_review",
  fixture_id: "runtime-scheduler-persistent-store-fixture-001",
  adapter_name: "runtime-scheduler-json-queue-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  passed_check_count: 8,
  blocked_check_count: 0,
  review_items: [
    "Persistent-store planning chain is complete through validation review.",
    "The adapter remains descriptor-only and has not performed file or database writes.",
    "A future executable adapter implementation still requires separate explicit confirmation.",
    "Live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, and pushes remain disabled here.",
  ],
  required_next_confirmation: "I approve persistent scheduler store implementation design review only, with no file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed.",
  implementation_boundary: "Review summary only; actual persistent-store implementation, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, review_summary_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  handoff_id: "runtime-scheduler-persistent-store-terminal-handoff-001",
  operator_id: "operator-runtime-scheduler-persistent-store-terminal-handoff-001",
  allow_handoff_only: true,
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

test("VO-7GB-RUNTIME-SCHEDULER-PERSISTENT-STORE-TERMINAL-HANDOFF-1: creates terminal handoff without side effects", () => {
  const handoff = createRuntimeSchedulerPersistentStoreTerminalHandoff(SAFE_INPUT, SAFE_SUMMARY);

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "terminal_handoff_ready");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.source_summary_state, "review_summary_ready");
  assert.equal(handoff.fixture_id, "runtime-scheduler-persistent-store-fixture-001");
  assert.equal(handoff.adapter_name, "runtime-scheduler-json-queue-adapter");
  assert.equal(handoff.store_kind, "repo_json");
  assert.equal(handoff.operation_count, 6);
  assert.equal(handoff.passed_check_count, 8);
  assert.equal(handoff.required_operator_decision.includes("Approve, defer, or reject"), true);
  assert.equal(handoff.handoff_notes.length, 4);
  assert.equal(handoff.file_write_enabled, false);
  assert.equal(handoff.database_write_enabled, false);
  assert.equal(handoff.live_scheduler_enabled, false);
  assert.equal(handoff.upload_execution_enabled, false);
  assert.equal(handoff.network_enabled, false);
  assert.equal(handoff.credential_access_enabled, false);
  assert.equal(handoff.media_read_enabled, false);
  assert.equal(handoff.git_add_executed, false);
  assert.equal(handoff.committed_now, false);
  assert.equal(handoff.pushed_now, false);
  assert.equal(handoff.validation.complete, true);
});

test("VO-7GC-RUNTIME-SCHEDULER-PERSISTENT-STORE-TERMINAL-HANDOFF-REVIEW-1: unsafe flags block handoff", () => {
  const handoff = createRuntimeSchedulerPersistentStoreTerminalHandoff({ ...SAFE_INPUT, allow_database_write: true as false }, SAFE_SUMMARY);

  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.operation_count, 0);
  assert.equal(handoff.passed_check_count, 0);
  assert.equal(handoff.database_write_enabled, false);
  assert.equal(handoff.validation.complete, false);
});

test("VO-7GC-RUNTIME-SCHEDULER-PERSISTENT-STORE-TERMINAL-HANDOFF-REVIEW-2: blocked review summary blocks handoff", () => {
  const handoff = createRuntimeSchedulerPersistentStoreTerminalHandoff(SAFE_INPUT, { ...SAFE_SUMMARY, blocked_check_count: 1 });

  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.handoff_notes.length, 0);
  assert.equal(handoff.validation.complete, false);
});

test("VO-7GC-RUNTIME-SCHEDULER-PERSISTENT-STORE-TERMINAL-HANDOFF-REVIEW-3: renderer and revocation are safe", () => {
  const handoff = createRuntimeSchedulerPersistentStoreTerminalHandoff(SAFE_INPUT, SAFE_SUMMARY);
  const rendered = renderRuntimeSchedulerPersistentStoreTerminalHandoff(handoff);
  const revoked = revokeRuntimeSchedulerPersistentStoreTerminalHandoff(handoff);

  assert.equal(rendered.includes("persistent-store terminal handoff"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("Passed checks: 8"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.handoff_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
