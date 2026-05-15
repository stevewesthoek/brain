import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreContract, renderRuntimeSchedulerPersistentStoreContract, revokeRuntimeSchedulerPersistentStoreContract } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";
import type { RuntimeSchedulerPersistentStoreApprovalPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-approval.js";

const SAFE_PACKET: RuntimeSchedulerPersistentStoreApprovalPacket = {
  schema_version: "1.0",
  approval_id: "runtime-scheduler-persistent-store-approval-001",
  approval_state: "ready_for_operator_confirmation",
  approval_packet_only: true,
  decision: "approve_persistent_store_planning",
  proposed_store_kind: "repo_json",
  proposed_path_or_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  source_safe_report_state: "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging",
  source_item_count: 2,
  required_confirmation: "I approve persistent scheduler store implementation planning only for repo_json at operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json, with no writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes until separately confirmed.",
  next_boundary: "Next step may plan the persistent store implementation contract only; actual writes, migrations, live scheduler activation, git staging, commits, and pushes remain separate explicit boundaries.",
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
  validation: { complete: true, ready_for_operator_confirmation: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  contract_id: "runtime-scheduler-persistent-store-contract-001",
  operator_id: "operator-runtime-scheduler-persistent-store-contract-001",
  store_namespace: "video-orchestrator/runtime-scheduler",
  operations: ["load_queue", "save_queue", "append_event", "mark_published", "mark_failed", "list_due_items"],
  allow_contract_only: true,
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

test("VO-7IT-RUNTIME-SCHEDULER-PERSISTENT-STORE-CONTRACT-1: creates contract without side effects", () => {
  const contract = createRuntimeSchedulerPersistentStoreContract(SAFE_INPUT, SAFE_PACKET);

  assert.equal(contract.schema_version, "1.0");
  assert.equal(contract.contract_state, "contract_ready_for_review");
  assert.equal(contract.contract_only, true);
  assert.equal(contract.source_approval_state, "ready_for_operator_confirmation");
  assert.equal(contract.store_kind, "repo_json");
  assert.equal(contract.store_reference, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  assert.equal(contract.store_namespace, "video-orchestrator/runtime-scheduler");
  assert.equal(contract.operations.includes("load_queue"), true);
  assert.equal(contract.operations.includes("save_queue"), true);
  assert.equal(contract.operations.includes("append_event"), true);
  assert.equal(contract.operations.includes("mark_published"), true);
  assert.equal(contract.operations.includes("mark_failed"), true);
  assert.equal(contract.operations.includes("list_due_items"), true);
  assert.equal(contract.required_next_confirmation.includes("I approve implementing the persistent scheduler store adapter contract only"), true);
  assert.equal(contract.implementation_boundary.includes("actual writes"), true);
  assert.equal(contract.file_write_enabled, false);
  assert.equal(contract.database_write_enabled, false);
  assert.equal(contract.live_scheduler_enabled, false);
  assert.equal(contract.upload_execution_enabled, false);
  assert.equal(contract.network_enabled, false);
  assert.equal(contract.credential_access_enabled, false);
  assert.equal(contract.media_read_enabled, false);
  assert.equal(contract.git_add_executed, false);
  assert.equal(contract.committed_now, false);
  assert.equal(contract.pushed_now, false);
  assert.equal(contract.validation.complete, true);
});

test("VO-7IU-RUNTIME-SCHEDULER-PERSISTENT-STORE-CONTRACT-2: missing operations block contract", () => {
  const contract = createRuntimeSchedulerPersistentStoreContract({ ...SAFE_INPUT, operations: ["load_queue", "save_queue"] }, SAFE_PACKET);

  assert.equal(contract.contract_state, "blocked");
  assert.deepEqual(contract.operations, []);
  assert.equal(contract.required_next_confirmation, "No confirmation available while blocked.");
  assert.equal(contract.file_write_enabled, false);
  assert.equal(contract.validation.complete, false);
});

test("VO-7IV-RUNTIME-SCHEDULER-PERSISTENT-STORE-CONTRACT-REVIEW-1: unsafe approval blocks contract", () => {
  const contract = createRuntimeSchedulerPersistentStoreContract(SAFE_INPUT, { ...SAFE_PACKET, decision: "defer" });

  assert.equal(contract.contract_state, "blocked");
  assert.equal(contract.source_approval_state, "ready_for_operator_confirmation");
  assert.equal(contract.file_write_enabled, false);
  assert.equal(contract.database_write_enabled, false);
  assert.equal(contract.live_scheduler_enabled, false);
  assert.equal(contract.validation.complete, false);
});

test("VO-7IV-RUNTIME-SCHEDULER-PERSISTENT-STORE-CONTRACT-REVIEW-2: renderer and revocation are safe", () => {
  const contract = createRuntimeSchedulerPersistentStoreContract(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPersistentStoreContract(contract);
  const revoked = revokeRuntimeSchedulerPersistentStoreContract(contract);

  assert.equal(rendered.includes("persistent-store contract"), true);
  assert.equal(rendered.includes("Operations"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.contract_state, "revoked");
  assert.deepEqual(revoked.operations, []);
  assert.equal(revoked.validation.complete, false);
});
