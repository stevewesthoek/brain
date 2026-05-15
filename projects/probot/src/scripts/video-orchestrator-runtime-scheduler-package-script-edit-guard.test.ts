import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditGuard, renderRuntimeSchedulerPackageScriptEditGuard, revokeRuntimeSchedulerPackageScriptEditGuard } from "./video-orchestrator-runtime-scheduler-package-script-edit-guard.js";
import type { RuntimeSchedulerPackageScriptEditPlanPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-plan-packet.js";

const SAFE_PACKET: RuntimeSchedulerPackageScriptEditPlanPacket = {
  schema_version: "1.0",
  packet_id: "runtime-scheduler-package-script-edit-plan-packet-001",
  packet_state: "ready_for_guarded_edit_review",
  packet_only: true,
  package_json_path: "projects/probot/package.json",
  script_name: "probot:video:runtime-scheduler",
  script_command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  implementation_steps: ["Read package.json", "Add only the runtime scheduler script"],
  validation_steps: ["Run typecheck", "Scan package.json", "Verify staged set"],
  required_confirmation: "I approve editing projects/probot/package.json to add only the probot:video:runtime-scheduler script, with no live scheduler activation, uploads, network calls, credential access, or media reads.",
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
  validation: { complete: true, ready_for_guarded_edit_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  guard_id: "runtime-scheduler-package-script-edit-guard-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-guard-001",
  allow_guard_only: true,
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

test("VO-7GX-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-GUARD-1: creates package edit guard without side effects", () => {
  const guard = createRuntimeSchedulerPackageScriptEditGuard(SAFE_INPUT, SAFE_PACKET);

  assert.equal(guard.schema_version, "1.0");
  assert.equal(guard.guard_state, "guard_ready_for_explicit_edit");
  assert.equal(guard.guard_only, true);
  assert.deepEqual(guard.allowed_changed_paths, ["projects/probot/package.json"]);
  assert.equal(guard.allowed_script_name, "probot:video:runtime-scheduler");
  assert.equal(guard.allowed_script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  assert.equal(guard.blocked_capabilities.includes("live_scheduler"), true);
  assert.equal(guard.blocked_capabilities.includes("credential_access"), true);
  assert.equal(guard.package_json_edited, false);
  assert.equal(guard.live_scheduler_enabled, false);
  assert.equal(guard.upload_execution_enabled, false);
  assert.equal(guard.network_enabled, false);
  assert.equal(guard.credential_access_enabled, false);
  assert.equal(guard.media_read_enabled, false);
  assert.equal(guard.file_write_enabled, false);
  assert.equal(guard.git_add_executed, false);
  assert.equal(guard.committed_now, false);
  assert.equal(guard.pushed_now, false);
  assert.equal(guard.validation.complete, true);
});

test("VO-7GY-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-GUARD-REVIEW-1: unsafe guard flags block guard", () => {
  const guard = createRuntimeSchedulerPackageScriptEditGuard({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_PACKET);

  assert.equal(guard.guard_state, "blocked");
  assert.deepEqual(guard.allowed_changed_paths, []);
  assert.equal(guard.file_write_enabled, false);
  assert.equal(guard.validation.complete, false);
});

test("VO-7GY-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-GUARD-REVIEW-2: renderer and revocation are safe", () => {
  const guard = createRuntimeSchedulerPackageScriptEditGuard(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPackageScriptEditGuard(guard);
  const revoked = revokeRuntimeSchedulerPackageScriptEditGuard(guard);

  assert.equal(rendered.includes("package script edit guard"), true);
  assert.equal(rendered.includes("Allowed changed paths: projects/probot/package.json"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.guard_state, "revoked");
  assert.deepEqual(revoked.allowed_changed_paths, []);
  assert.equal(revoked.validation.complete, false);
});
