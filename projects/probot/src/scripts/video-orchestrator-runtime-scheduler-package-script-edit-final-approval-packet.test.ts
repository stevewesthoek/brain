import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditFinalApprovalPacket, renderRuntimeSchedulerPackageScriptEditFinalApprovalPacket, revokeRuntimeSchedulerPackageScriptEditFinalApprovalPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-final-approval-packet.js";
import type { RuntimeSchedulerPackageScriptEditExecutionChecklist } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-checklist.js";

const SAFE_CHECKLIST: RuntimeSchedulerPackageScriptEditExecutionChecklist = {
  schema_version: "1.0",
  checklist_id: "runtime-scheduler-package-script-edit-execution-checklist-001",
  checklist_state: "ready_for_explicit_execution_review",
  checklist_only: true,
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  items: [
    { id: "input", label: "Checklist input is safe", complete: true, evidence: "All runtime/write/git toggles are disabled." },
    { id: "plan", label: "Commit plan is scoped", complete: true, evidence: "Only projects/probot/package.json is intended." },
    { id: "validation", label: "Validation is defined", complete: true, evidence: "Typecheck, secret scan, staged-set check, log, and status checks are required." },
  ],
  package_json_edited: false,
  live_scheduler_enabled: false,
  upload_execution_enabled: false,
  network_enabled: false,
  credential_access_enabled: false,
  media_read_enabled: false,
  file_write_enabled: false,
  git_add_executed: false,
  committed_now: false,
  pushed_now: false,
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  validation: { complete: true, ready_for_explicit_execution_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  packet_id: "runtime-scheduler-package-script-edit-final-approval-packet-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-final-approval-001",
  allow_packet_only: true,
  allow_package_json_edit: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_file_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

test("VO-7HF-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-FINAL-APPROVAL-PACKET-1: builds final approval packet without side effects", () => {
  const packet = createRuntimeSchedulerPackageScriptEditFinalApprovalPacket(SAFE_INPUT, SAFE_CHECKLIST);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.packet_state, "ready_for_explicit_package_json_edit_confirmation");
  assert.equal(packet.packet_only, true);
  assert.equal(packet.package_json_path, "projects/probot/package.json");
  assert.equal(packet.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(packet.copy_paste_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(packet.final_boundaries.length, 5);
  assert.equal(packet.final_boundaries.some((item) => item.includes("Only projects/probot/package.json")), true);
  assert.equal(packet.package_json_edited, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.upload_execution_enabled, false);
  assert.equal(packet.network_enabled, false);
  assert.equal(packet.credential_access_enabled, false);
  assert.equal(packet.media_read_enabled, false);
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.git_add_executed, false);
  assert.equal(packet.committed_now, false);
  assert.equal(packet.pushed_now, false);
  assert.equal(packet.validation.complete, true);
});

test("VO-7HG-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-FINAL-APPROVAL-PACKET-REVIEW-1: unsafe flags block packet", () => {
  const packet = createRuntimeSchedulerPackageScriptEditFinalApprovalPacket({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_CHECKLIST);

  assert.equal(packet.packet_state, "blocked");
  assert.equal(packet.copy_paste_confirmation, "No confirmation available while blocked.");
  assert.deepEqual(packet.final_boundaries, []);
  assert.equal(packet.package_json_edited, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7HG-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-FINAL-APPROVAL-PACKET-REVIEW-2: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPackageScriptEditFinalApprovalPacket(SAFE_INPUT, SAFE_CHECKLIST);
  const rendered = renderRuntimeSchedulerPackageScriptEditFinalApprovalPacket(packet);
  const revoked = revokeRuntimeSchedulerPackageScriptEditFinalApprovalPacket(packet);

  assert.equal(rendered.includes("package script edit final approval packet"), true);
  assert.equal(rendered.includes("Final boundaries"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.packet_state, "revoked");
  assert.deepEqual(revoked.final_boundaries, []);
  assert.equal(revoked.validation.complete, false);
});
