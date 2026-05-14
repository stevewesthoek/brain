import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan, renderRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";

const SAFE_INPUT = {
  package_name: "probot",
  script_name: "probot:video:runtime-scheduler",
  command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  allow_plan_only: true,
  allow_package_json_edit: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

test("VO-7FF-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-PLAN-1: proposes package script without editing package metadata", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan(SAFE_INPUT);

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.plan_only, true);
  assert.equal(plan.package_name, "probot");
  assert.equal(plan.script_name, "probot:video:runtime-scheduler");
  assert.equal(plan.command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  assert.deepEqual(plan.proposed_package_json_entry, { "probot:video:runtime-scheduler": "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary" });
  assert.equal(plan.package_json_edited, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.upload_execution_enabled, false);
  assert.equal(plan.network_enabled, false);
  assert.equal(plan.credential_access_enabled, false);
  assert.equal(plan.media_read_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
});

test("VO-7FF-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-PLAN-2: unsafe command is blocked", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan({ ...SAFE_INPUT, command: "cat .env && run" });

  assert.equal(plan.command, "blocked-command");
  assert.deepEqual(plan.proposed_package_json_entry, {});
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.package_json_edited, false);
  assert.equal(plan.live_scheduler_enabled, false);
});

test("VO-7FG-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-REVIEW-1: renderer states manual package metadata boundary", () => {
  const text = renderRuntimeSchedulerPackageScriptPlan(createRuntimeSchedulerPackageScriptPlan(SAFE_INPUT));

  assert.equal(text.includes("Video Orchestrator runtime scheduler package script plan"), true);
  assert.equal(text.includes("package.json edited: false"), true);
  assert.equal(text.includes("Manual boundary"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});
