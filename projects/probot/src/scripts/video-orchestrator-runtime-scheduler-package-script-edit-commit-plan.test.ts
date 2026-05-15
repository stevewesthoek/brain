import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditCommitPlan, renderRuntimeSchedulerPackageScriptEditCommitPlan, revokeRuntimeSchedulerPackageScriptEditCommitPlan } from "./video-orchestrator-runtime-scheduler-package-script-edit-commit-plan.js";
import type { RuntimeSchedulerPackageScriptEditDryRun } from "./video-orchestrator-runtime-scheduler-package-script-edit-dry-run.js";

const SAFE_DRY_RUN: RuntimeSchedulerPackageScriptEditDryRun = {
  schema_version: "1.0",
  dry_run_id: "runtime-scheduler-package-script-edit-dry-run-001",
  dry_run_state: "dry_run_ready",
  dry_run_only: true,
  package_json_path: "projects/probot/package.json",
  proposed_scripts_entry: { "probot:video:runtime-scheduler": "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary" },
  expected_changed_paths: ["projects/probot/package.json"],
  expected_validation_commands: ["npm run typecheck", "security_scan_paths projects/probot/package.json", "git diff --cached --name-only"],
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
  validation: { complete: true, dry_run_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  plan_id: "runtime-scheduler-package-script-edit-commit-plan-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-commit-plan-001",
  allow_plan_only: true,
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

test("VO-7HB-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-COMMIT-PLAN-1: creates commit plan without side effects", () => {
  const plan = createRuntimeSchedulerPackageScriptEditCommitPlan(SAFE_INPUT, SAFE_DRY_RUN);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_state, "commit_plan_ready");
  assert.equal(plan.plan_only, true);
  assert.equal(plan.package_json_path, "projects/probot/package.json");
  assert.equal(plan.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.deepEqual(plan.intended_paths, ["projects/probot/package.json"]);
  assert.equal(plan.validation_before_commit.includes("npm run typecheck"), true);
  assert.equal(plan.validation_after_commit.includes("git status --short"), true);
  assert.equal(plan.package_json_edited, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.upload_execution_enabled, false);
  assert.equal(plan.network_enabled, false);
  assert.equal(plan.credential_access_enabled, false);
  assert.equal(plan.media_read_enabled, false);
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
});

test("VO-7HC-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-COMMIT-PLAN-REVIEW-1: unsafe flags block commit plan", () => {
  const plan = createRuntimeSchedulerPackageScriptEditCommitPlan({ ...SAFE_INPUT, allow_commit: true as false }, SAFE_DRY_RUN);

  assert.equal(plan.plan_state, "blocked");
  assert.deepEqual(plan.intended_paths, []);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.validation.complete, false);
});

test("VO-7HC-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-COMMIT-PLAN-REVIEW-2: renderer and revocation are safe", () => {
  const plan = createRuntimeSchedulerPackageScriptEditCommitPlan(SAFE_INPUT, SAFE_DRY_RUN);
  const rendered = renderRuntimeSchedulerPackageScriptEditCommitPlan(plan);
  const revoked = revokeRuntimeSchedulerPackageScriptEditCommitPlan(plan);

  assert.equal(rendered.includes("package script edit commit plan"), true);
  assert.equal(rendered.includes("Intended paths: projects/probot/package.json"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.plan_state, "revoked");
  assert.deepEqual(revoked.intended_paths, []);
  assert.equal(revoked.validation.complete, false);
});
