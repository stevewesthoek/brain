import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditDecisionCloseout, renderRuntimeSchedulerPackageScriptEditDecisionCloseout, revokeRuntimeSchedulerPackageScriptEditDecisionCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-closeout.js";
import type { RuntimeSchedulerPackageScriptEditOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-operator-decision-packet.js";

const SAFE_PACKET: RuntimeSchedulerPackageScriptEditOperatorDecisionPacket = {
  schema_version: "1.0",
  packet_id: "runtime-scheduler-package-script-edit-operator-decision-packet-001",
  packet_state: "ready_for_operator_decision",
  packet_only: true,
  requested_decision: "approve_scoped_package_json_edit",
  rationale: "Operator wants the scoped package script edit next.",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  disallowed_future_changes: ["live scheduler activation", "upload execution", "network calls", "credential access"],
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  next_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
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
  validation: { complete: true, ready_for_operator_decision: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  closeout_id: "runtime-scheduler-package-script-edit-decision-closeout-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-decision-closeout-001",
  allow_closeout_only: true,
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

test("VO-7HX-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-CLOSEOUT-1: closes approved decision without side effects", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditDecisionCloseout(SAFE_INPUT, SAFE_PACKET);

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "closed_for_separate_package_json_edit_action");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.source_packet_state, "ready_for_operator_decision");
  assert.equal(closeout.decision, "approve_scoped_package_json_edit");
  assert.equal(closeout.package_json_path, "projects/probot/package.json");
  assert.equal(closeout.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(closeout.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.live_scheduler_enabled, false);
  assert.equal(closeout.upload_execution_enabled, false);
  assert.equal(closeout.network_enabled, false);
  assert.equal(closeout.credential_access_enabled, false);
  assert.equal(closeout.media_read_enabled, false);
  assert.equal(closeout.file_write_enabled, false);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
  assert.equal(closeout.validation.complete, true);
});

test("VO-7HY-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-CLOSEOUT-2: closes deferred and rejected decisions", () => {
  const deferred = createRuntimeSchedulerPackageScriptEditDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, requested_decision: "defer", next_boundary: "Package script edit remains deferred; no package.json change should be made until a new explicit approval is supplied." });
  const rejected = createRuntimeSchedulerPackageScriptEditDecisionCloseout(SAFE_INPUT, { ...SAFE_PACKET, requested_decision: "reject", next_boundary: "Package script edit is rejected; keep package.json unchanged and runtime scheduler disabled." });

  assert.equal(deferred.closeout_state, "closed_deferred");
  assert.equal(rejected.closeout_state, "closed_rejected");
  assert.equal(deferred.package_json_edited, false);
  assert.equal(rejected.live_scheduler_enabled, false);
});

test("VO-7HZ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-CLOSEOUT-REVIEW-1: unsafe flags block closeout", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditDecisionCloseout({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_PACKET);

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.allowed_future_change, "none");
  assert.equal(closeout.required_confirmation, "No confirmation available while blocked.");
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.validation.complete, false);
});

test("VO-7HZ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-CLOSEOUT-REVIEW-2: renderer and revocation are safe", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditDecisionCloseout(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPackageScriptEditDecisionCloseout(closeout);
  const revoked = revokeRuntimeSchedulerPackageScriptEditDecisionCloseout(closeout);

  assert.equal(rendered.includes("package script edit decision closeout"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.closeout_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
