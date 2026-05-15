import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditPlanPacket, renderRuntimeSchedulerPackageScriptEditPlanPacket, revokeRuntimeSchedulerPackageScriptEditPlanPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-plan-packet.js";
import type { RuntimeSchedulerPackageScriptEditApprovalPrompt } from "./video-orchestrator-runtime-scheduler-package-script-edit-approval-prompt.js";

const SAFE_PROMPT: RuntimeSchedulerPackageScriptEditApprovalPrompt = {
  schema_version: "1.0",
  prompt_id: "runtime-scheduler-package-script-edit-approval-prompt-001",
  prompt_state: "ready_for_operator_copy_paste",
  prompt_only: true,
  source_preflight_state: "ready_for_explicit_package_json_edit_approval",
  package_json_path: "projects/probot/package.json",
  script_name: "probot:video:runtime-scheduler",
  script_command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  copy_paste_confirmation: "I approve editing projects/probot/package.json to add only the probot:video:runtime-scheduler script, with no live scheduler activation, uploads, network calls, credential access, or media reads.",
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
  validation: { complete: true, ready_for_operator_copy_paste: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  packet_id: "runtime-scheduler-package-script-edit-plan-packet-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-plan-001",
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

test("VO-7GV-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PLAN-PACKET-1: creates guarded package edit plan without side effects", () => {
  const packet = createRuntimeSchedulerPackageScriptEditPlanPacket(SAFE_INPUT, SAFE_PROMPT);

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.packet_state, "ready_for_guarded_edit_review");
  assert.equal(packet.packet_only, true);
  assert.equal(packet.package_json_path, "projects/probot/package.json");
  assert.equal(packet.script_name, "probot:video:runtime-scheduler");
  assert.equal(packet.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  assert.equal(packet.implementation_steps.length, 3);
  assert.equal(packet.validation_steps.length, 3);
  assert.equal(packet.required_confirmation.includes("I approve editing projects/probot/package.json"), true);
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

test("VO-7GW-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PLAN-PACKET-REVIEW-1: unsafe flags block packet", () => {
  const packet = createRuntimeSchedulerPackageScriptEditPlanPacket({ ...SAFE_INPUT, allow_commit: true as false }, SAFE_PROMPT);

  assert.equal(packet.packet_state, "blocked");
  assert.deepEqual(packet.implementation_steps, []);
  assert.equal(packet.committed_now, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7GW-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PLAN-PACKET-REVIEW-2: renderer and revocation are safe", () => {
  const packet = createRuntimeSchedulerPackageScriptEditPlanPacket(SAFE_INPUT, SAFE_PROMPT);
  const rendered = renderRuntimeSchedulerPackageScriptEditPlanPacket(packet);
  const revoked = revokeRuntimeSchedulerPackageScriptEditPlanPacket(packet);

  assert.equal(rendered.includes("package script edit plan packet"), true);
  assert.equal(rendered.includes("Implementation steps"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.packet_state, "revoked");
  assert.deepEqual(revoked.implementation_steps, []);
  assert.equal(revoked.validation.complete, false);
});
