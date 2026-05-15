import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout, renderRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout, revokeRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-decision-closeout.js";
import type { RuntimeSchedulerPersistentStoreRuntimeImportOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-operator-decision-packet.js";

const SAFE_PACKET: RuntimeSchedulerPersistentStoreRuntimeImportOperatorDecisionPacket = {
  schema_version: "1.0",
  decision_id: "runtime-scheduler-persistent-store-runtime-import-operator-decision-001",
  decision_state: "operator_decision_ready",
  decision_packet_only: true,
  source_handoff_state: "terminal_handoff_ready",
  decision: "approve_future_runtime_import_implementation_plan",
  decision_note: "Proceed with side-effect-free runtime import implementation planning only.",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  import_plan_step_count: 2,
  allowed_future_scope: ["Prepare runtime import implementation planning artifacts only."],
  next_boundary: "Future runtime import implementation planning may proceed in side-effect-free artifacts only.",
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
  validation: { complete: true, operator_decision_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  closeout_id: "runtime-scheduler-persistent-store-runtime-import-decision-closeout-001",
  operator_id: "operator-runtime-scheduler-runtime-import-decision-closeout-001",
  allow_closeout_only: true,
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

test("VO-7HX-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-DECISION-CLOSEOUT-1: creates closeout without side effects", () => {
  const closeout = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(SAFE_INPUT, SAFE_PACKET);

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "decision_closeout_ready");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.source_decision_state, "operator_decision_ready");
  assert.equal(closeout.decision, "approve_future_runtime_import_implementation_plan");
  assert.equal(closeout.import_plan_step_count, 2);
  assert.equal(closeout.allowed_future_scope_count, 1);
  assert.equal(closeout.closeout_items.length, 3);
  assert.equal(closeout.runtime_imports_enabled, false);
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

test("VO-7HY-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-DECISION-CLOSEOUT-REVIEW-1: defer and reject close out without future scope", () => {
  const defer = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, decision: "defer", allowed_future_scope: [] });
  const reject = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, decision: "reject", allowed_future_scope: [] });

  assert.equal(defer.closeout_state, "decision_closeout_ready");
  assert.equal(defer.allowed_future_scope_count, 0);
  assert.equal(defer.closeout_items.some((item) => item.includes("deferred")), true);
  assert.equal(reject.closeout_state, "decision_closeout_ready");
  assert.equal(reject.allowed_future_scope_count, 0);
  assert.equal(reject.closeout_items.some((item) => item.includes("rejected")), true);
});

test("VO-7HY-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-DECISION-CLOSEOUT-REVIEW-2: unsafe input or packet blocks closeout", () => {
  const unsafeInput = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout({ ...SAFE_INPUT, allow_runtime_imports: true as false }, SAFE_PACKET);
  const unsafePacket = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, import_plan_step_count: 0 });

  assert.equal(unsafeInput.closeout_state, "blocked");
  assert.equal(unsafeInput.runtime_imports_enabled, false);
  assert.equal(unsafePacket.closeout_state, "blocked");
  assert.equal(unsafePacket.closeout_items.length, 0);
});

test("VO-7HY-RUNTIME-SCHEDULER-PERSISTENT-STORE-RUNTIME-IMPORT-DECISION-CLOSEOUT-REVIEW-3: renderer and revocation are safe", () => {
  const closeout = createRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(closeout);
  const revoked = revokeRuntimeSchedulerPersistentStoreRuntimeImportDecisionCloseout(closeout);

  assert.equal(rendered.includes("runtime import decision closeout"), true);
  assert.equal(rendered.includes("Decision: approve_future_runtime_import_implementation_plan"), true);
  assert.equal(rendered.includes("Runtime imports enabled: false"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.closeout_state, "revoked");
  assert.equal(revoked.import_plan_step_count, 0);
  assert.equal(revoked.validation.complete, false);
});
