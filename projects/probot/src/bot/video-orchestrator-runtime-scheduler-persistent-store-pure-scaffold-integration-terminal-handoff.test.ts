import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff, renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff, revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-terminal-handoff.js";
import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-review.js";

const SAFE_REVIEW: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview = {
  schema_version: "1.0",
  review_id: "runtime-scheduler-persistent-store-pure-scaffold-integration-review-001",
  review_state: "integration_review_ready",
  review_only: true,
  source_plan_state: "integration_plan_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  integration_step_count: 2,
  review_findings: ["Integration plan is documentation-only.", "Integration plan preserves write boundaries."],
  required_next_confirmation: "I approve pure scaffold integration terminal handoff only.",
  implementation_boundary: "Integration review only.",
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
  validation: { complete: true, integration_review_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  handoff_id: "runtime-scheduler-persistent-store-pure-scaffold-integration-terminal-handoff-001",
  operator_id: "operator-runtime-scheduler-pure-scaffold-integration-terminal-handoff-001",
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

test("VO-7GZ-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-TERMINAL-HANDOFF-1: creates terminal handoff without side effects", () => {
  const handoff = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(SAFE_INPUT, SAFE_REVIEW);

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "terminal_handoff_ready");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.source_review_state, "integration_review_ready");
  assert.equal(handoff.integration_step_count, 2);
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

test("VO-7HA-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-TERMINAL-HANDOFF-REVIEW-1: unsafe input or review blocks handoff", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_REVIEW);
  const unsafeReview = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(SAFE_INPUT, { ...SAFE_REVIEW, integration_step_count: 0 });

  assert.equal(unsafeInput.handoff_state, "blocked");
  assert.equal(unsafeInput.file_write_enabled, false);
  assert.equal(unsafeReview.handoff_state, "blocked");
  assert.equal(unsafeReview.terminal_notes.length, 0);
});

test("VO-7HA-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-INTEGRATION-TERMINAL-HANDOFF-REVIEW-2: renderer and revocation are safe", () => {
  const handoff = createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(SAFE_INPUT, SAFE_REVIEW);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(handoff);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(handoff);

  assert.equal(rendered.includes("pure scaffold integration terminal handoff"), true);
  assert.equal(rendered.includes("Integration step count: 2"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.handoff_state, "revoked");
  assert.equal(revoked.integration_step_count, 0);
  assert.equal(revoked.validation.complete, false);
});
