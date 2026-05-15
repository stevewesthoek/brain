import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPersistentStoreApprovalPacket, renderRuntimeSchedulerPersistentStoreApprovalPacket, revokeRuntimeSchedulerPersistentStoreApprovalPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-approval.js";
import type { RuntimeSchedulerStoreReadinessSafeReport } from "./video-orchestrator-runtime-scheduler-store-readiness.js";

const SAFE_REPORT: RuntimeSchedulerStoreReadinessSafeReport = {
  schema_version: "1.0",
  safe_report_id: "runtime-scheduler-store-readiness-safe-report-001",
  review_id: "runtime-scheduler-store-readiness-review-001",
  readiness_id: "runtime-scheduler-store-readiness-001",
  created_at: "2026-05-15T14:20:00.000Z",
  safe_report_state: "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging",
  safe_report_only: true,
  source_item_count: 2,
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
  validation: { complete: true, ready_for_next_phase: false, blocking_reasons: ["Explicit confirmation required before persistent store implementation or git staging."], warnings: [] },
};

const SAFE_INPUT = {
  approval_id: "runtime-scheduler-persistent-store-approval-001",
  operator_id: "operator-runtime-scheduler-persistent-store-001",
  requested_decision: "approve_persistent_store_planning",
  proposed_store_kind: "repo_json",
  proposed_path_or_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  allow_approval_packet_only: true,
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

test("VO-7IQ-RUNTIME-SCHEDULER-PERSISTENT-STORE-APPROVAL-1: creates approval packet without side effects", () => {
  const packet = createRuntimeSchedulerPersistentStoreApprovalPacket(SAFE_INPUT, SAFE_REPORT);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.approval_state, "ready_for_operator_confirmation");
  assert.equal(packet.approval_packet_only, true);
  assert.equal(packet.decision, "approve_persistent_store_planning");
  assert.equal(packet.proposed_store_kind, "repo_json");
  assert.equal(packet.proposed_path_or_reference, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  assert.equal(packet.source_item_count, 2);
  assert.equal(packet.required_confirmation.includes("I approve persistent scheduler store implementation planning only"), true);
  assert.equal(packet.next_boundary.includes("actual writes"), true);
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

test("VO-7IR-RUNTIME-SCHEDULER-PERSISTENT-STORE-APPROVAL-2: supports defer and reject boundaries", () => {
  const deferred = createRuntimeSchedulerPersistentStoreApprovalPacket({ ...SAFE_INPUT, requested_decision: "defer" }, SAFE_REPORT);
  const rejected = createRuntimeSchedulerPersistentStoreApprovalPacket({ ...SAFE_INPUT, requested_decision: "reject" }, SAFE_REPORT);

  assert.equal(deferred.next_boundary.includes("memory-store/readiness mode"), true);
  assert.equal(rejected.next_boundary.includes("do not implement"), true);
  assert.equal(deferred.file_write_enabled, false);
  assert.equal(rejected.database_write_enabled, false);
});

test("VO-7IS-RUNTIME-SCHEDULER-PERSISTENT-STORE-APPROVAL-REVIEW-1: unsafe inputs block packet", () => {
  const packet = createRuntimeSchedulerPersistentStoreApprovalPacket({ ...SAFE_INPUT, proposed_path_or_reference: ".env", allow_file_write: true as false }, SAFE_REPORT);

  assert.equal(packet.approval_state, "blocked");
  assert.equal(packet.proposed_path_or_reference, "blocked-reference");
  assert.equal(packet.source_item_count, 0);
  assert.equal(packet.required_confirmation, "No confirmation available while blocked.");
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7IS-RUNTIME-SCHEDULER-PERSISTENT-STORE-APPROVAL-REVIEW-2: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPersistentStoreApprovalPacket(SAFE_INPUT, SAFE_REPORT);
  const rendered = renderRuntimeSchedulerPersistentStoreApprovalPacket(packet);
  const revoked = revokeRuntimeSchedulerPersistentStoreApprovalPacket(packet);

  assert.equal(rendered.includes("persistent-store approval packet"), true);
  assert.equal(rendered.includes("File writes enabled: false"), true);
  assert.equal(rendered.includes("Database writes enabled: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.approval_state, "revoked");
  assert.equal(revoked.required_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
