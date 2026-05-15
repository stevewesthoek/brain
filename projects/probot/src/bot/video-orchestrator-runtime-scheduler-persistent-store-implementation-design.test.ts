import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreImplementationDesign, renderRuntimeSchedulerPersistentStoreImplementationDesign, revokeRuntimeSchedulerPersistentStoreImplementationDesign } from "./video-orchestrator-runtime-scheduler-persistent-store-implementation-design.js";
import type { RuntimeSchedulerPersistentStoreDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-decision-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPersistentStoreDecisionCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-persistent-store-decision-closeout-001",
  closeout_state: "decision_closeout_ready",
  closeout_only: true,
  source_decision_state: "operator_decision_ready",
  decision: "approve_future_implementation_planning",
  adapter_name: "runtime-scheduler-json-queue-adapter",
  store_kind: "repo_json",
  store_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  operation_count: 6,
  allowed_future_scope_count: 4,
  closeout_items: [
    "Operator approved future implementation planning artifacts only.",
    "No executable persistent-store behavior is enabled by this closeout.",
    "Future implementation still requires a separate explicit boundary before writes are introduced.",
  ],
  next_boundary: "Future implementation planning may proceed in side-effect-free design artifacts only; file writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, decision_closeout_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  design_id: "runtime-scheduler-persistent-store-implementation-design-001",
  operator_id: "operator-runtime-scheduler-persistent-store-implementation-design-001",
  adapter_interface_name: "RuntimeSchedulerPersistentStoreAdapter",
  allow_design_only: true,
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

test("VO-7GH-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-DESIGN-1: creates design packet without side effects", () => {
  const design = createRuntimeSchedulerPersistentStoreImplementationDesign(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(design.schema_version, "1.0");
  assert.equal(design.design_state, "implementation_design_ready");
  assert.equal(design.design_only, true);
  assert.equal(design.source_closeout_state, "decision_closeout_ready");
  assert.equal(design.source_decision, "approve_future_implementation_planning");
  assert.equal(design.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter");
  assert.equal(design.store_kind, "repo_json");
  assert.equal(design.operation_count, 6);
  assert.equal(design.design_sections.length, 4);
  assert.equal(design.explicit_non_goals.length, 3);
  assert.equal(design.file_write_enabled, false);
  assert.equal(design.database_write_enabled, false);
  assert.equal(design.live_scheduler_enabled, false);
  assert.equal(design.upload_execution_enabled, false);
  assert.equal(design.network_enabled, false);
  assert.equal(design.credential_access_enabled, false);
  assert.equal(design.media_read_enabled, false);
  assert.equal(design.git_add_executed, false);
  assert.equal(design.committed_now, false);
  assert.equal(design.pushed_now, false);
  assert.equal(design.validation.complete, true);
});

test("VO-7GI-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-DESIGN-REVIEW-1: defer or reject closeouts block design", () => {
  const defer = createRuntimeSchedulerPersistentStoreImplementationDesign(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "defer", allowed_future_scope_count: 0 });
  const reject = createRuntimeSchedulerPersistentStoreImplementationDesign(SAFE_INPUT, { ...SAFE_CLOSEOUT, decision: "reject", allowed_future_scope_count: 0 });

  assert.equal(defer.design_state, "blocked");
  assert.equal(defer.operation_count, 0);
  assert.equal(reject.design_state, "blocked");
  assert.equal(reject.design_sections.length, 0);
});

test("VO-7GI-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-DESIGN-REVIEW-2: unsafe flags block design", () => {
  const design = createRuntimeSchedulerPersistentStoreImplementationDesign({ ...SAFE_INPUT, allow_database_write: true as false }, SAFE_CLOSEOUT);

  assert.equal(design.design_state, "blocked");
  assert.equal(design.operation_count, 0);
  assert.equal(design.database_write_enabled, false);
  assert.equal(design.validation.complete, false);
});

test("VO-7GI-RUNTIME-SCHEDULER-PERSISTENT-STORE-IMPLEMENTATION-DESIGN-REVIEW-3: renderer and revocation are safe", () => {
  const design = createRuntimeSchedulerPersistentStoreImplementationDesign(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPersistentStoreImplementationDesign(design);
  const revoked = revokeRuntimeSchedulerPersistentStoreImplementationDesign(design);

  assert.equal(rendered.includes("persistent-store implementation design"), true);
  assert.equal(rendered.includes("Adapter interface: RuntimeSchedulerPersistentStoreAdapter"), true);
  assert.equal(rendered.includes("Operation count: 6"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.design_state, "revoked");
  assert.equal(revoked.operation_count, 0);
  assert.equal(revoked.validation.complete, false);
});
