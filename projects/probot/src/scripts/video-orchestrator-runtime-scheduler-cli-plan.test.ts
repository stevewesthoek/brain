import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerCliPlan, createRuntimeSchedulerCliSafeInput } from "./video-orchestrator-runtime-scheduler-cli-plan.js";

test("VO-7FB-RUNTIME-SCHEDULER-CLI-PLAN-1: composes text command plan safely", () => {
  const result = createRuntimeSchedulerCliPlan(createRuntimeSchedulerCliSafeInput(["queue", "--project=says-the-bible", "--filter=queued_dry_run"]));

  assert.equal(result.schema_version, "1.0");
  assert.equal(result.cli_plan_only, true);
  assert.equal(result.exit_code, 0);
  assert.equal(result.command_plan.command, "queue");
  assert.equal(result.command_plan.project_id, "says-the-bible");
  assert.equal(result.command_plan.filter, "queued_dry_run");
  assert.equal(result.rendered_text.includes("Video Orchestrator runtime scheduler command plan"), true);
  assert.equal(result.safety.live_scheduler_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
  assert.equal(result.safety.media_read_performed, false);
  assert.equal(result.safety.files_written, false);
  assert.equal(result.safety.git_add_executed, false);
  assert.equal(result.safety.committed_now, false);
  assert.equal(result.safety.pushed_now, false);
});

test("VO-7FB-RUNTIME-SCHEDULER-CLI-PLAN-2: composes JSON command plan safely", () => {
  const result = createRuntimeSchedulerCliPlan(createRuntimeSchedulerCliSafeInput(["summary", "--project=says-the-bible", "--output=json"]));
  const parsed = JSON.parse(result.rendered_text);

  assert.equal(result.exit_code, 0);
  assert.equal(parsed.command, "summary");
  assert.equal(parsed.project_id, "says-the-bible");
  assert.equal(parsed.safety.live_scheduler_enabled, false);
  assert.equal(parsed.safety.upload_execution_enabled, false);
  assert.equal(parsed.safety.network_enabled, false);
  assert.equal(parsed.safety.credential_access_enabled, false);
});

test("VO-7FC-RUNTIME-SCHEDULER-CLI-PLAN-REVIEW-1: invalid command returns help and nonzero code without side effects", () => {
  const result = createRuntimeSchedulerCliPlan(createRuntimeSchedulerCliSafeInput(["run-live"]));

  assert.equal(result.exit_code, 2);
  assert.equal(result.command_plan.command, "unknown");
  assert.equal(result.rendered_text.includes("Video Orchestrator runtime scheduler commands"), true);
  assert.equal(result.safety.live_scheduler_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
  assert.equal(result.safety.files_written, false);
});

test("VO-7FC-RUNTIME-SCHEDULER-CLI-PLAN-REVIEW-2: unsafe permissions keep execution disabled", () => {
  const result = createRuntimeSchedulerCliPlan({ ...createRuntimeSchedulerCliSafeInput(["summary"]), allow_live_scheduler: true as false });

  assert.equal(result.exit_code, 2);
  assert.equal(result.safety.live_scheduler_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
});
