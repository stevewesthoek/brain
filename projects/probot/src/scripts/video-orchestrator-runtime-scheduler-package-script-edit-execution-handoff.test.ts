import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditExecutionHandoff, renderRuntimeSchedulerPackageScriptEditExecutionHandoff, revokeRuntimeSchedulerPackageScriptEditExecutionHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.js";
import type { RuntimeSchedulerPackageScriptEditReadinessManifest } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-manifest.js";

const SAFE_MANIFEST: RuntimeSchedulerPackageScriptEditReadinessManifest = {
  schema_version: "1.0",
  manifest_id: "runtime-scheduler-package-script-edit-readiness-manifest-001",
  manifest_state: "ready_for_separate_execution_approval",
  manifest_only: true,
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  copy_paste_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  readiness_items: [
    "Final approval packet is complete.",
    "The only future changed path is projects/probot/package.json.",
    "The runtime scheduler command remains summary-only.",
    "Validation requires typecheck, secret scan, staged-path verification, post-commit typecheck, log, and status checks.",
  ],
  blocking_boundaries: [
    "No package.json edit is performed by this manifest.",
    "No live scheduler activation is performed by this manifest.",
    "No upload, network, credential, media-read, or persistent scheduler-write behavior is enabled.",
    "Git add, commit, and push remain separate verified steps.",
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
  validation: { complete: true, ready_for_separate_execution_approval: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  handoff_id: "runtime-scheduler-package-script-edit-execution-handoff-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-execution-handoff-001",
  allow_handoff_only: true,
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

test("VO-7HJ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-HANDOFF-1: creates execution handoff without side effects", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditExecutionHandoff(SAFE_INPUT, SAFE_MANIFEST);

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "ready_for_operator_execution_decision");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.package_json_path, "projects/probot/package.json");
  assert.equal(handoff.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(handoff.operator_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(handoff.execution_scope.length, 3);
  assert.equal(handoff.forbidden_actions.includes("live scheduler activation"), true);
  assert.equal(handoff.package_json_edited, false);
  assert.equal(handoff.live_scheduler_enabled, false);
  assert.equal(handoff.upload_execution_enabled, false);
  assert.equal(handoff.network_enabled, false);
  assert.equal(handoff.credential_access_enabled, false);
  assert.equal(handoff.media_read_enabled, false);
  assert.equal(handoff.file_write_enabled, false);
  assert.equal(handoff.git_add_executed, false);
  assert.equal(handoff.committed_now, false);
  assert.equal(handoff.pushed_now, false);
  assert.equal(handoff.validation.complete, true);
});

test("VO-7HK-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-HANDOFF-REVIEW-1: unsafe flags block handoff", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditExecutionHandoff({ ...SAFE_INPUT, allow_file_write: true as false }, SAFE_MANIFEST);

  assert.equal(handoff.handoff_state, "blocked");
  assert.deepEqual(handoff.execution_scope, []);
  assert.equal(handoff.file_write_enabled, false);
  assert.equal(handoff.validation.complete, false);
});

test("VO-7HK-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-HANDOFF-REVIEW-2: renderer and revocation are safe", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditExecutionHandoff(SAFE_INPUT, SAFE_MANIFEST);
  const rendered = renderRuntimeSchedulerPackageScriptEditExecutionHandoff(handoff);
  const revoked = revokeRuntimeSchedulerPackageScriptEditExecutionHandoff(handoff);

  assert.equal(rendered.includes("package script edit execution handoff"), true);
  assert.equal(rendered.includes("Execution scope"), true);
  assert.equal(rendered.includes("Forbidden actions"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.handoff_state, "revoked");
  assert.deepEqual(revoked.execution_scope, []);
  assert.equal(revoked.validation.complete, false);
});
