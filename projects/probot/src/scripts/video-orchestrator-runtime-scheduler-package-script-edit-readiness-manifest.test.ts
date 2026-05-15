import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessManifest, renderRuntimeSchedulerPackageScriptEditReadinessManifest, revokeRuntimeSchedulerPackageScriptEditReadinessManifest } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-manifest.js";
import type { RuntimeSchedulerPackageScriptEditFinalApprovalPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-final-approval-packet.js";

const SAFE_PACKET: RuntimeSchedulerPackageScriptEditFinalApprovalPacket = {
  schema_version: "1.0",
  packet_id: "runtime-scheduler-package-script-edit-final-approval-packet-001",
  packet_state: "ready_for_explicit_package_json_edit_confirmation",
  packet_only: true,
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  copy_paste_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  final_boundaries: [
    "Only projects/probot/package.json may be edited in the future execution step.",
    "The only allowed script is probot:video:runtime-scheduler.",
    "Live scheduler activation remains disabled.",
    "Uploads, network calls, credential access, media reads, and persistent scheduler writes remain disabled.",
    "Commits and pushes still require their own verified scoped git flow.",
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
  validation: { complete: true, ready_for_explicit_package_json_edit_confirmation: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  manifest_id: "runtime-scheduler-package-script-edit-readiness-manifest-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-001",
  allow_manifest_only: true,
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

test("VO-7HH-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-MANIFEST-1: creates readiness manifest without side effects", () => {
  const manifest = createRuntimeSchedulerPackageScriptEditReadinessManifest(SAFE_INPUT, SAFE_PACKET);

  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.manifest_state, "ready_for_separate_execution_approval");
  assert.equal(manifest.manifest_only, true);
  assert.equal(manifest.package_json_path, "projects/probot/package.json");
  assert.equal(manifest.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(manifest.copy_paste_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(manifest.readiness_items.length, 4);
  assert.equal(manifest.blocking_boundaries.length, 4);
  assert.equal(manifest.package_json_edited, false);
  assert.equal(manifest.live_scheduler_enabled, false);
  assert.equal(manifest.upload_execution_enabled, false);
  assert.equal(manifest.network_enabled, false);
  assert.equal(manifest.credential_access_enabled, false);
  assert.equal(manifest.media_read_enabled, false);
  assert.equal(manifest.file_write_enabled, false);
  assert.equal(manifest.git_add_executed, false);
  assert.equal(manifest.committed_now, false);
  assert.equal(manifest.pushed_now, false);
  assert.equal(manifest.validation.complete, true);
});

test("VO-7HI-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-MANIFEST-REVIEW-1: unsafe flags block manifest", () => {
  const manifest = createRuntimeSchedulerPackageScriptEditReadinessManifest({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_PACKET);

  assert.equal(manifest.manifest_state, "blocked");
  assert.deepEqual(manifest.readiness_items, []);
  assert.equal(manifest.file_write_enabled, false);
  assert.equal(manifest.validation.complete, false);
});

test("VO-7HI-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-MANIFEST-REVIEW-2: renderer and revocation are safe", () => {
  const manifest = createRuntimeSchedulerPackageScriptEditReadinessManifest(SAFE_INPUT, SAFE_PACKET);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessManifest(manifest);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessManifest(manifest);

  assert.equal(rendered.includes("package script edit readiness manifest"), true);
  assert.equal(rendered.includes("Readiness items"), true);
  assert.equal(rendered.includes("Blocking boundaries"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.manifest_state, "revoked");
  assert.deepEqual(revoked.readiness_items, []);
  assert.equal(revoked.validation.complete, false);
});
