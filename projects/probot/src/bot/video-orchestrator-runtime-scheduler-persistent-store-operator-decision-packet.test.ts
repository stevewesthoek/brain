import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreOperatorDecisionPacket, renderRuntimeSchedulerPersistentStoreOperatorDecisionPacket, revokeRuntimeSchedulerPersistentStoreOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-operator-decision-packet.js";
import type { RuntimeSchedulerPersistentStoreTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-terminal-handoff.js";

const SAFE_HANDOFF: RuntimeSchedulerPersistentStoreTerminalHandoff = {
  schema_version: "1.0",
  handoff_id: "runtime-scheduler-persistent-store-terminal-handoff-001",
  handoff_state: "terminal_handoff_ready",
  handoff_only: true,
  source_summary_state: "review_summary_ready",
  fixture_id: "runtime-scheduler-persistent-store-fixture-001",
  adapter_name: "runtime-scheduler-json-queue-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  passed_check_count: 8,
  required_operator_decision: "Approve, defer, or reject future persistent scheduler store implementation in a separate explicit step.",
  terminal_boundary: "Terminal handoff only; actual persistent-store implementation, migrations, file or database writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
  handoff_notes: [
    "Persistent-store planning has reached terminal handoff readiness.",
    "The reviewed adapter chain remains descriptor-only and has not persisted scheduler queue state.",
    "Future implementation must be separately approved before any file or database write path is enabled.",
    "Live scheduler activation and platform dispatch remain disabled by this handoff.",
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
  validation: { complete: true, terminal_handoff_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  decision_id: "runtime-scheduler-persistent-store-operator-decision-001",
  operator_id: "operator-runtime-scheduler-persistent-store-decision-001",
  decision: "approve_future_implementation_planning",
  decision_note: "Proceed with side-effect-free design artifacts only.",
  allow_decision_packet_only: true,
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

test("VO-7GD-RUNTIME-SCHEDULER-PERSISTENT-STORE-OPERATOR-DECISION-PACKET-1: creates operator decision packet without side effects", () => {
  const packet = createRuntimeSchedulerPersistentStoreOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.decision_state, "operator_decision_ready");
  assert.equal(packet.decision_packet_only, true);
  assert.equal(packet.source_handoff_state, "terminal_handoff_ready");
  assert.equal(packet.decision, "approve_future_implementation_planning");
  assert.equal(packet.adapter_name, "runtime-scheduler-json-queue-adapter");
  assert.equal(packet.store_kind, "repo_json");
  assert.equal(packet.operation_count, 6);
  assert.equal(packet.allowed_future_scope.length, 4);
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.database_write_enabled, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.upload_execution_enabled, false);
  assert.equal(packet.network_enabled, false);
  assert.equal(packet.credential_access_enabled, false);
  assert.equal(packet.media_read_enabled, false);
  assert.equal(packet.git_add_executed, false);
  assert.equal(packet.committed_now, false);
  assert.equal(packet.pushed_now, false);
  assert.equal(packet.validation.complete, true);
});

test("VO-7GE-RUNTIME-SCHEDULER-PERSISTENT-STORE-OPERATOR-DECISION-PACKET-REVIEW-1: defer and reject have no future scope", () => {
  const defer = createRuntimeSchedulerPersistentStoreOperatorDecisionPacket({ ...SAFE_INPUT, decision: "defer" }, SAFE_HANDOFF);
  const reject = createRuntimeSchedulerPersistentStoreOperatorDecisionPacket({ ...SAFE_INPUT, decision: "reject" }, SAFE_HANDOFF);

  assert.equal(defer.decision_state, "operator_decision_ready");
  assert.deepEqual(defer.allowed_future_scope, []);
  assert.equal(defer.next_boundary.includes("deferred"), true);
  assert.equal(reject.decision_state, "operator_decision_ready");
  assert.deepEqual(reject.allowed_future_scope, []);
  assert.equal(reject.next_boundary.includes("rejected"), true);
});

test("VO-7GE-RUNTIME-SCHEDULER-PERSISTENT-STORE-OPERATOR-DECISION-PACKET-REVIEW-2: unsafe flags block packet", () => {
  const packet = createRuntimeSchedulerPersistentStoreOperatorDecisionPacket({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_HANDOFF);

  assert.equal(packet.decision_state, "blocked");
  assert.equal(packet.operation_count, 0);
  assert.deepEqual(packet.allowed_future_scope, []);
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7GE-RUNTIME-SCHEDULER-PERSISTENT-STORE-OPERATOR-DECISION-PACKET-REVIEW-3: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPersistentStoreOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);
  const rendered = renderRuntimeSchedulerPersistentStoreOperatorDecisionPacket(packet);
  const revoked = revokeRuntimeSchedulerPersistentStoreOperatorDecisionPacket(packet);

  assert.equal(rendered.includes("persistent-store operator decision packet"), true);
  assert.equal(rendered.includes("Decision: approve_future_implementation_planning"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.decision_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
