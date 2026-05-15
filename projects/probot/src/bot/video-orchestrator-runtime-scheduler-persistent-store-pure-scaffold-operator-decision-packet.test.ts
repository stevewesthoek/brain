import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket, renderRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket, revokeRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-operator-decision-packet.js";
import type { RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-terminal-handoff.js";

const SAFE_HANDOFF: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff = {
  schema_version: "1.0",
  handoff_id: "runtime-scheduler-persistent-store-pure-scaffold-terminal-handoff-001",
  handoff_state: "terminal_handoff_ready",
  handoff_only: true,
  source_review_state: "pure_scaffold_review_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  supported_operation_count: 6,
  scaffold_export_count: 4,
  terminal_notes: [
    "Pure scaffold review has reached terminal handoff readiness.",
    "The scaffold remains pure and has not persisted scheduler queue state.",
    "Integration planning still requires a separate explicit operator decision.",
    "Live scheduler activation and platform dispatch remain disabled by this handoff.",
  ],
  required_operator_decision: "Approve, defer, or reject future pure scaffold integration planning in a separate explicit step.",
  terminal_boundary: "Terminal handoff only; executable persistence, storage writes, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries.",
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
  decision_id: "runtime-scheduler-persistent-store-pure-scaffold-operator-decision-001",
  operator_id: "operator-runtime-scheduler-persistent-store-pure-scaffold-decision-001",
  decision: "approve_future_integration_planning",
  decision_note: "Proceed with side-effect-free integration planning only.",
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

test("VO-7GR-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-OPERATOR-DECISION-1: creates operator decision without side effects", () => {
  const packet = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.decision_state, "operator_decision_ready");
  assert.equal(packet.decision_packet_only, true);
  assert.equal(packet.source_handoff_state, "terminal_handoff_ready");
  assert.equal(packet.decision, "approve_future_integration_planning");
  assert.equal(packet.supported_operation_count, 6);
  assert.equal(packet.scaffold_export_count, 4);
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

test("VO-7GS-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-OPERATOR-DECISION-REVIEW-1: defer and reject have no future scope", () => {
  const defer = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket({ ...SAFE_INPUT, decision: "defer" }, SAFE_HANDOFF);
  const reject = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket({ ...SAFE_INPUT, decision: "reject" }, SAFE_HANDOFF);

  assert.equal(defer.decision_state, "operator_decision_ready");
  assert.deepEqual(defer.allowed_future_scope, []);
  assert.equal(defer.next_boundary.includes("deferred"), true);
  assert.equal(reject.decision_state, "operator_decision_ready");
  assert.deepEqual(reject.allowed_future_scope, []);
  assert.equal(reject.next_boundary.includes("rejected"), true);
});

test("VO-7GS-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-OPERATOR-DECISION-REVIEW-2: unsafe inputs block decision", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket({ ...SAFE_INPUT, allow_network: true as false }, SAFE_HANDOFF);
  const unsafeHandoff = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket(SAFE_INPUT, { ...SAFE_HANDOFF, scaffold_export_count: 0 });

  assert.equal(unsafeInput.decision_state, "blocked");
  assert.equal(unsafeInput.network_enabled, false);
  assert.equal(unsafeHandoff.decision_state, "blocked");
  assert.deepEqual(unsafeHandoff.allowed_future_scope, []);
});

test("VO-7GS-RUNTIME-SCHEDULER-PERSISTENT-STORE-PURE-SCAFFOLD-OPERATOR-DECISION-REVIEW-3: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);
  const rendered = renderRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket(packet);
  const revoked = revokeRuntimeSchedulerPersistentStorePureScaffoldOperatorDecisionPacket(packet);

  assert.equal(rendered.includes("pure scaffold operator decision packet"), true);
  assert.equal(rendered.includes("Decision: approve_future_integration_planning"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.decision_state, "revoked");
  assert.equal(revoked.supported_operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
