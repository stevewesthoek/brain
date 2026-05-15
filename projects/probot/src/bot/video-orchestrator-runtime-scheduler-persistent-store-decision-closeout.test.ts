import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreDecisionCloseout, renderRuntimeSchedulerPersistentStoreDecisionCloseout, revokeRuntimeSchedulerPersistentStoreDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-decision-closeout.js";
import type { RuntimeSchedulerPersistentStoreOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-operator-decision-packet.js";

const SAFE_PACKET: RuntimeSchedulerPersistentStoreOperatorDecisionPacket = {
  schema_version: "1.0",
  decision_id: "runtime-scheduler-persistent-store-operator-decision-001",
  decision_state: "operator_decision_ready",
  decision_packet_only: true,
  source_handoff_state: "terminal_handoff_ready",
  decision: "approve_future_implementation_planning",
  decision_note: "Proceed with side-effect-free design artifacts only.",
  adapter_name: "runtime-scheduler-json-queue-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  next_boundary: "Future implementation planning may proceed in side-effect-free design artifacts only; file writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, and pushes remain separate explicit boundaries.",
  allowed_future_scope: [
    "Prepare implementation design notes only.",
    "Describe adapter write boundaries without enabling writes.",
    "Keep live scheduler activation and platform dispatch disabled.",
    "Require a new explicit confirmation before any executable persistence behavior is introduced.",
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
  validation: { complete: true, operator_decision_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  closeout_id: "runtime-scheduler-persistent-store-decision-closeout-001",
  operator_id: "operator-runtime-scheduler-persistent-store-decision-closeout-001",
  allow_closeout_only: true,
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

test("VO-7GF-RUNTIME-SCHEDULER-PERSISTENT-STORE-DECISION-CLOSEOUT-1: creates closeout without side effects", () => {
  const closeout = createRuntimeSchedulerPersistentStoreDecisionCloseout(SAFE_INPUT, SAFE_PACKET);

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "decision_closeout_ready");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.source_decision_state, "operator_decision_ready");
  assert.equal(closeout.decision, "approve_future_implementation_planning");
  assert.equal(closeout.adapter_name, "runtime-scheduler-json-queue-adapter");
  assert.equal(closeout.store_kind, "repo_json");
  assert.equal(closeout.operation_count, 6);
  assert.equal(closeout.allowed_future_scope_count, 4);
  assert.equal(closeout.closeout_items.length, 3);
  assert.equal(closeout.file_write_enabled, false);
  assert.equal(closeout.database_write_enabled, false);
  assert.equal(closeout.live_scheduler_enabled, false);
  assert.equal(closeout.upload_execution_enabled, false);
  assert.equal(closeout.network_enabled, false);
  assert.equal(closeout.credential_access_enabled, false);
  assert.equal(closeout.media_read_enabled, false);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
  assert.equal(closeout.validation.complete, true);
});

test("VO-7GG-RUNTIME-SCHEDULER-PERSISTENT-STORE-DECISION-CLOSEOUT-REVIEW-1: defer and reject close out without future scope", () => {
  const defer = createRuntimeSchedulerPersistentStoreDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, decision: "defer", allowed_future_scope: [], next_boundary: "Persistent scheduler store implementation remains deferred; continue with terminal handoff records only." });
  const reject = createRuntimeSchedulerPersistentStoreDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, decision: "reject", allowed_future_scope: [], next_boundary: "Persistent scheduler store implementation is rejected; do not proceed with implementation planning until a new approval chain is created." });

  assert.equal(defer.closeout_state, "decision_closeout_ready");
  assert.equal(defer.allowed_future_scope_count, 0);
  assert.equal(defer.closeout_items.some((item) => item.includes("deferred")), true);
  assert.equal(reject.closeout_state, "decision_closeout_ready");
  assert.equal(reject.allowed_future_scope_count, 0);
  assert.equal(reject.closeout_items.some((item) => item.includes("rejected")), true);
});

test("VO-7GG-RUNTIME-SCHEDULER-PERSISTENT-STORE-DECISION-CLOSEOUT-REVIEW-2: unsafe flags block closeout", () => {
  const closeout = createRuntimeSchedulerPersistentStoreDecisionCloseout({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_PACKET);

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.operation_count, 0);
  assert.equal(closeout.allowed_future_scope_count, 0);
  assert.equal(closeout.file_write_enabled, false);
  assert.equal(closeout.validation.complete, false);
});

test("VO-7GG-RUNTIME-SCHEDULER-PERSISTENT-STORE-DECISION-CLOSEOUT-REVIEW-3: renderer and revocation are safe", () => {
  const closeout = createRuntimeSchedulerPersistentStoreDecisionCloseout(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPersistentStoreDecisionCloseout(closeout);
  const revoked = revokeRuntimeSchedulerPersistentStoreDecisionCloseout(closeout);

  assert.equal(rendered.includes("persistent-store decision closeout"), true);
  assert.equal(rendered.includes("Decision: approve_future_implementation_planning"), true);
  assert.equal(rendered.includes("Allowed future scope count: 4"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.closeout_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
