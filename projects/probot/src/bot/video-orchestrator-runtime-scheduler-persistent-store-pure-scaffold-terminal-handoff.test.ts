import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff, renderRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff, revokeRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-terminal-handoff.js";
import type { RuntimeSchedulerPersistentStorePureScaffoldReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-review.js";

const SAFE_REVIEW: RuntimeSchedulerPersistentStorePureScaffoldReview = {
  schema_version: "1.0",
  review_id: "runtime-scheduler-persistent-store-pure-scaffold-review-001",
  review_state: "pure_scaffold_review_ready",
  review_only: true,
  source_scaffold_state: "pure_scaffold_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  supported_operation_count: 6,
  scaffold_export_count: 4,
  review_findings: [
    "Pure scaffold exposes required scheduler queue operation descriptors.",
    "Pure scaffold exposes snapshot validation and state transition helpers.",
    "Pure scaffold does not persist queue state or read runtime media.",
    "Pure scaffold remains outside live scheduler execution and platform dispatch.",
  ],
  required_next_confirmation: "I approve pure scaffold integration planning only.",
  implementation_boundary: "Pure scaffold review only.",
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
  validation: { complete: true, pure_scaffold_review_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  handoff_id: "runtime-scheduler-persistent-store-pure-scaffold-terminal-handoff-001",
  operator_id: "operator-runtime-scheduler-pure-scaffold-terminal-handoff-001",
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

test("VO-7GP-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-TERMINAL-HANDOFF-1: creates terminal handoff without side effects", () => {
  const handoff = createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(SAFE_INPUT, SAFE_REVIEW);

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "terminal_handoff_ready");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.source_review_state, "pure_scaffold_review_ready");
  assert.equal(handoff.supported_operation_count, 6);
  assert.equal(handoff.scaffold_export_count, 4);
  assert.equal(handoff.terminal_notes.length, 4);
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

test("VO-7GQ-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-TERMINAL-HANDOFF-REVIEW-1: unsafe input or review blocks handoff", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_REVIEW);
  const unsafeReview = createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(SAFE_INPUT, { ...SAFE_REVIEW, scaffold_export_count: 0 });

  assert.equal(unsafeInput.handoff_state, "blocked");
  assert.equal(unsafeInput.file_write_enabled, false);
  assert.equal(unsafeReview.handoff_state, "blocked");
  assert.equal(unsafeReview.terminal_notes.length, 0);
});

test("VO-7GQ-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-TERMINAL-HANDOFF-REVIEW-2: renderer and revocation are safe", () => {
  const handoff = createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(SAFE_INPUT, SAFE_REVIEW);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(handoff);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(handoff);

  assert.equal(rendered.includes("pure scaffold terminal handoff"), true);
  assert.equal(rendered.includes("Supported operation count: 6"), true);
  assert.equal(rendered.includes("Scaffold export count: 4"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.handoff_state, "revoked");
  assert.equal(revoked.supported_operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
