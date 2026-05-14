import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerCommandPlan, renderRuntimeSchedulerCommandPlanHelp } from "./video-orchestrator-runtime-scheduler-command-plan.js";

const SAFE_FLAGS = {
  allow_plan_only: true,
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

test("VO-7EX-RUNTIME-SCHEDULER-COMMAND-PLAN-1: plans summary command without side effects", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["summary", "--project", "says-the-bible", "--output=json"], ...SAFE_FLAGS });

  assert.equal(plan.schema_version, "1.0");
  assert.equal(plan.command, "summary");
  assert.equal(plan.action, "render_summary");
  assert.equal(plan.project_id, "says-the-bible");
  assert.equal(plan.output, "json");
  assert.equal(plan.plan_only, true);
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

test("VO-7EX-RUNTIME-SCHEDULER-COMMAND-PLAN-2: plans filtered read-model command", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["read-model", "--filter", "queued_dry_run", "--project-id=says-the-bible"], ...SAFE_FLAGS });

  assert.equal(plan.command, "read-model");
  assert.equal(plan.action, "show_read_model");
  assert.equal(plan.filter, "queued_dry_run");
  assert.equal(plan.project_id, "says-the-bible");
  assert.equal(plan.validation.complete, true);
});

test("VO-7EX-RUNTIME-SCHEDULER-COMMAND-PLAN-3: unknown command is help-only and blocked", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["run-live"], ...SAFE_FLAGS });

  assert.equal(plan.command, "unknown");
  assert.equal(plan.action, "show_help");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.upload_execution_enabled, false);
  assert.equal(plan.network_enabled, false);
});

test("VO-7EY-RUNTIME-SCHEDULER-COMMAND-PLAN-REVIEW-1: unsafe permissions block plan", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["queue"], ...SAFE_FLAGS, allow_live_scheduler: true as false });

  assert.equal(plan.command, "queue");
  assert.equal(plan.action, "show_queue");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.live_scheduler_enabled, false);
  assert.equal(plan.upload_execution_enabled, false);
  assert.equal(plan.credential_access_enabled, false);
});

test("VO-7EY-RUNTIME-SCHEDULER-COMMAND-PLAN-REVIEW-2: help text is safe and explicit", () => {
  const help = renderRuntimeSchedulerCommandPlanHelp();

  assert.equal(help.includes("summary"), true);
  assert.equal(help.includes("activation-gate"), true);
  assert.equal(help.includes("planning/display commands only"), true);
  assert.equal(help.includes("access_token"), false);
  assert.equal(help.includes("client_secret"), false);
  assert.equal(help.includes("api_key"), false);
});
