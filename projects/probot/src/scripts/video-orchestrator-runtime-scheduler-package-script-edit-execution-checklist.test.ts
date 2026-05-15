import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditExecutionChecklist, renderRuntimeSchedulerPackageScriptEditExecutionChecklist, revokeRuntimeSchedulerPackageScriptEditExecutionChecklist } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-checklist.js";
import type { RuntimeSchedulerPackageScriptEditCommitPlan } from "./video-orchestrator-runtime-scheduler-package-script-edit-commit-plan.js";

const SAFE_PLAN: RuntimeSchedulerPackageScriptEditCommitPlan = {
  schema_version: "1.0",
  plan_id: "runtime-scheduler-package-script-edit-commit-plan-001",
  plan_state: "commit_plan_ready",
  plan_only: true,
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  intended_paths: ["projects/probot/package.json"],
  validation_before_commit: ["npm run typecheck", "security_scan_paths projects/probot/package.json", "git diff --cached --name-only"],
  validation_after_commit: ["npm run typecheck", "git log -1 --oneline", "git status --short"],
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
  validation: { complete: true, commit_plan_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  checklist_id: "runtime-scheduler-package-script-edit-execution-checklist-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-execution-checklist-001",
  allow_checklist_only: true,
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

test("VO-7HD-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-CHECKLIST-1: creates execution checklist without side effects", () => {
  const checklist = createRuntimeSchedulerPackageScriptEditExecutionChecklist(SAFE_INPUT, SAFE_PLAN);

  assert.equal(checklist.schema_version, "1.0");
  assert.equal(checklist.checklist_state, "ready_for_explicit_execution_review");
  assert.equal(checklist.checklist_only, true);
  assert.equal(checklist.package_json_path, "projects/probot/package.json");
  assert.equal(checklist.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(checklist.items.length, 3);
  assert.equal(checklist.items.every((item) => item.complete), true);
  assert.equal(checklist.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(checklist.package_json_edited, false);
  assert.equal(checklist.live_scheduler_enabled, false);
  assert.equal(checklist.upload_execution_enabled, false);
  assert.equal(checklist.network_enabled, false);
  assert.equal(checklist.credential_access_enabled, false);
  assert.equal(checklist.media_read_enabled, false);
  assert.equal(checklist.file_write_enabled, false);
  assert.equal(checklist.git_add_executed, false);
  assert.equal(checklist.committed_now, false);
  assert.equal(checklist.pushed_now, false);
  assert.equal(checklist.validation.complete, true);
});

test("VO-7HE-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-CHECKLIST-REVIEW-1: unsafe flags block checklist", () => {
  const checklist = createRuntimeSchedulerPackageScriptEditExecutionChecklist({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_PLAN);

  assert.equal(checklist.checklist_state, "blocked");
  assert.equal(checklist.required_confirmation, "No confirmation available while blocked.");
  assert.equal(checklist.package_json_edited, false);
  assert.equal(checklist.validation.complete, false);
});

test("VO-7HE-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-CHECKLIST-REVIEW-2: renderer and revocation are safe", () => {
  const checklist = createRuntimeSchedulerPackageScriptEditExecutionChecklist(SAFE_INPUT, SAFE_PLAN);
  const rendered = renderRuntimeSchedulerPackageScriptEditExecutionChecklist(checklist);
  const revoked = revokeRuntimeSchedulerPackageScriptEditExecutionChecklist(checklist);

  assert.equal(rendered.includes("package script edit execution checklist"), true);
  assert.equal(rendered.includes("Path: projects/probot/package.json"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.checklist_state, "revoked");
  assert.equal(revoked.required_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
