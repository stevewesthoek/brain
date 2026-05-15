import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket, renderRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket, revokeRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-patch-operator-decision-packet.js";
import type { RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-patch-terminal-handoff.js";

const SAFE_HANDOFF: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff = {
  schema_version: "1.0",
  handoff_id: "runtime-scheduler-persistent-store-runtime-import-patch-terminal-handoff-001",
  handoff_state: "terminal_handoff_ready",
  handoff_only: true,
  source_review_state: "runtime_import_patch_review_ready",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  patch_step_count: 2,
  terminal_notes: ["Runtime import patch review has reached terminal handoff readiness."],
  required_operator_decision: "Approve, defer, or reject future runtime import patch application.",
  terminal_boundary: "Terminal handoff only.",
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
  validation: { complete: true, terminal_handoff_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  decision_id: "runtime-scheduler-persistent-store-runtime-import-patch-operator-decision-001",
  operator_id: "operator-runtime-scheduler-runtime-import-patch-decision-001",
  decision: "approve_future_runtime_import_patch_application_plan",
  decision_note: "Proceed with side-effect-free runtime import patch application planning only.",
  allow_decision_packet_only: true,
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

test("VO-7IZ-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-PATCH-OPERATOR-DECISION-1: creates decision packet without side effects", () => {
  const packet = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.decision_state, "operator_decision_ready");
  assert.equal(packet.decision_packet_only, true);
  assert.equal(packet.source_handoff_state, "terminal_handoff_ready");
  assert.equal(packet.decision, "approve_future_runtime_import_patch_application_plan");
  assert.equal(packet.patch_step_count, 2);
  assert.equal(packet.allowed_future_scope.length, 4);
  assert.equal(packet.runtime_imports_enabled, false);
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

test("VO-7JA-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-PATCH-OPERATOR-DECISION-REVIEW-1: defer and reject have no future scope", () => {
  const defer = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket({ ...SAFE_INPUT, decision: "defer" }, SAFE_HANDOFF);
  const reject = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket({ ...SAFE_INPUT, decision: "reject" }, SAFE_HANDOFF);

  assert.equal(defer.decision_state, "operator_decision_ready");
  assert.deepEqual(defer.allowed_future_scope, []);
  assert.equal(defer.next_boundary.includes("deferred"), true);
  assert.equal(reject.decision_state, "operator_decision_ready");
  assert.deepEqual(reject.allowed_future_scope, []);
  assert.equal(reject.next_boundary.includes("rejected"), true);
});

test("VO-7JA-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-PATCH-OPERATOR-DECISION-REVIEW-2: unsafe input or handoff blocks decision", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket({ ...SAFE_INPUT, allow_runtime_imports: true as false }, SAFE_HANDOFF);
  const unsafeHandoff = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket(SAFE_INPUT, { ...SAFE_HANDOFF, patch_step_count: 0 });

  assert.equal(unsafeInput.decision_state, "blocked");
  assert.equal(unsafeInput.runtime_imports_enabled, false);
  assert.equal(unsafeHandoff.decision_state, "blocked");
  assert.deepEqual(unsafeHandoff.allowed_future_scope, []);
});

test("VO-7JA-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-PATCH-OPERATOR-DECISION-REVIEW-3: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket(SAFE_INPUT, SAFE_HANDOFF);
  const rendered = renderRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket(packet);
  const revoked = revokeRuntimeSchedulerPersistentStoreRuntimeImportPatchOperatorDecisionPacket(packet);

  assert.equal(rendered.includes("runtime import patch operator decision packet"), true);
  assert.equal(rendered.includes("Decision: approve_future_runtime_import_patch_application_plan"), true);
  assert.equal(rendered.includes("Runtime imports enabled: false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.decision_state, "revoked");
  assert.equal(revoked.patch_step_count, 0);
  assert.equal(revoked.validation.complete, false);
});
