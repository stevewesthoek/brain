import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditDryRun, renderRuntimeSchedulerPackageScriptEditDryRun, revokeRuntimeSchedulerPackageScriptEditDryRun } from "./video-orchestrator-runtime-scheduler-package-script-edit-dry-run.js";
import type { RuntimeSchedulerPackageScriptEditGuard } from "./video-orchestrator-runtime-scheduler-package-script-edit-guard.js";

const SAFE_GUARD: RuntimeSchedulerPackageScriptEditGuard = {
  schema_version: "1.0",
  guard_id: "runtime-scheduler-package-script-edit-guard-001",
  guard_state: "guard_ready_for_explicit_edit",
  guard_only: true,
  package_json_path: "projects/probot/package.json",
  allowed_script_name: "probot:video:runtime-scheduler",
  allowed_script_command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  allowed_changed_paths: ["projects/probot/package.json"],
  blocked_capabilities: ["live_scheduler", "uploads", "network_calls", "credential_access", "media_reads", "persistent_scheduler_writes", "unrelated_package_metadata_changes"],
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
  validation: { complete: true, guard_ready_for_explicit_edit: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  dry_run_id: "runtime-scheduler-package-script-edit-dry-run-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-dry-run-001",
  allow_dry_run_only: true,
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

test("VO-7GZ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DRY-RUN-1: creates dry-run summary without side effects", () => {
  const dryRun = createRuntimeSchedulerPackageScriptEditDryRun(SAFE_INPUT, SAFE_GUARD);

  assert.equal(dryRun.schema_version, "1.0");
  assert.equal(dryRun.dry_run_state, "dry_run_ready");
  assert.equal(dryRun.dry_run_only, true);
  assert.equal(dryRun.package_json_path, "projects/probot/package.json");
  assert.deepEqual(dryRun.proposed_scripts_entry, { "probot:video:runtime-scheduler": "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary" });
  assert.deepEqual(dryRun.expected_changed_paths, ["projects/probot/package.json"]);
  assert.equal(dryRun.expected_validation_commands.includes("npm run typecheck"), true);
  assert.equal(dryRun.package_json_edited, false);
  assert.equal(dryRun.live_scheduler_enabled, false);
  assert.equal(dryRun.upload_execution_enabled, false);
  assert.equal(dryRun.network_enabled, false);
  assert.equal(dryRun.credential_access_enabled, false);
  assert.equal(dryRun.media_read_enabled, false);
  assert.equal(dryRun.file_write_enabled, false);
  assert.equal(dryRun.git_add_executed, false);
  assert.equal(dryRun.committed_now, false);
  assert.equal(dryRun.pushed_now, false);
  assert.equal(dryRun.validation.complete, true);
});

test("VO-7HA-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DRY-RUN-REVIEW-1: unsafe flags block dry-run", () => {
  const dryRun = createRuntimeSchedulerPackageScriptEditDryRun({ ...SAFE_INPUT, allow_git_add: true as false }, SAFE_GUARD);

  assert.equal(dryRun.dry_run_state, "blocked");
  assert.deepEqual(dryRun.proposed_scripts_entry, {});
  assert.equal(dryRun.git_add_executed, false);
  assert.equal(dryRun.validation.complete, false);
});

test("VO-7HA-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DRY-RUN-REVIEW-2: renderer and revocation are safe", () => {
  const dryRun = createRuntimeSchedulerPackageScriptEditDryRun(SAFE_INPUT, SAFE_GUARD);
  const rendered = renderRuntimeSchedulerPackageScriptEditDryRun(dryRun);
  const revoked = revokeRuntimeSchedulerPackageScriptEditDryRun(dryRun);

  assert.equal(rendered.includes("package script edit dry-run"), true);
  assert.equal(rendered.includes("Expected changed paths: projects/probot/package.json"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.dry_run_state, "revoked");
  assert.deepEqual(revoked.expected_changed_paths, []);
  assert.equal(revoked.validation.complete, false);
});
