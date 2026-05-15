import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket, renderRuntimeSchedulerPackageScriptEditOperatorDecisionPacket, revokeRuntimeSchedulerPackageScriptEditOperatorDecisionPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-operator-decision-packet.js";
import type { RuntimeSchedulerPackageScriptEditBoundaryReport } from "./video-orchestrator-runtime-scheduler-package-script-edit-boundary-report.js";

const SAFE_REPORT: RuntimeSchedulerPackageScriptEditBoundaryReport = {
  schema_version: "1.0",
  report_id: "runtime-scheduler-package-script-edit-boundary-report-001",
  report_state: "boundary_report_ready",
  report_only: true,
  source_summary_state: "prep_summary_ready",
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  next_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  disallowed_future_changes: [
    "package metadata unrelated to scripts",
    "live scheduler activation",
    "upload execution",
    "network calls",
    "credential access",
    "media reads",
    "persistent scheduler writes",
    "git add, commit, or push without separate verification",
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
  validation: { complete: true, boundary_report_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  packet_id: "runtime-scheduler-package-script-edit-operator-decision-packet-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-decision-001",
  requested_decision: "approve_scoped_package_json_edit",
  rationale: "Operator wants the scoped package script edit next.",
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

test("VO-7HV-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-OPERATOR-DECISION-PACKET-1: creates operator decision packet without side effects", () => {
  const packet = createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(SAFE_INPUT, SAFE_REPORT);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.packet_state, "ready_for_operator_decision");
  assert.equal(packet.packet_only, true);
  assert.equal(packet.requested_decision, "approve_scoped_package_json_edit");
  assert.equal(packet.package_json_path, "projects/probot/package.json");
  assert.equal(packet.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(packet.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(packet.disallowed_future_changes.includes("live scheduler activation"), true);
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

test("VO-7HV-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-OPERATOR-DECISION-PACKET-2: records defer and reject boundaries", () => {
  const deferred = createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket({ ...SAFE_INPUT, requested_decision: "defer", rationale: "Pause." }, SAFE_REPORT);
  const rejected = createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket({ ...SAFE_INPUT, requested_decision: "reject", rationale: "Do not proceed." }, SAFE_REPORT);

  assert.equal(deferred.next_boundary.includes("deferred"), true);
  assert.equal(rejected.next_boundary.includes("rejected"), true);
  assert.equal(deferred.package_json_edited, false);
  assert.equal(rejected.live_scheduler_enabled, false);
});

test("VO-7HW-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-OPERATOR-DECISION-PACKET-REVIEW-1: unsafe flags block packet", () => {
  const packet = createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_REPORT);

  assert.equal(packet.packet_state, "blocked");
  assert.equal(packet.allowed_future_change, "none");
  assert.equal(packet.required_confirmation, "No confirmation available while blocked.");
  assert.equal(packet.package_json_edited, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7HW-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-OPERATOR-DECISION-PACKET-REVIEW-2: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(SAFE_INPUT, SAFE_REPORT);
  const rendered = renderRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(packet);
  const revoked = revokeRuntimeSchedulerPackageScriptEditOperatorDecisionPacket(packet);

  assert.equal(rendered.includes("package script edit operator decision packet"), true);
  assert.equal(rendered.includes("Required confirmation"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.packet_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
