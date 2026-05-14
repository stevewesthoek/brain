import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerCommandPlan } from "./video-orchestrator-runtime-scheduler-command-plan.js";
import { renderRuntimeSchedulerCommandPlan, renderRuntimeSchedulerCommandPlanJson } from "./video-orchestrator-runtime-scheduler-command-renderer.js";

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

test("VO-7EZ-RUNTIME-SCHEDULER-COMMAND-RENDERER-1: renders valid plan without side effects", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["queue", "--project=says-the-bible", "--filter=queued_dry_run"], ...SAFE_FLAGS });
  const rendered = renderRuntimeSchedulerCommandPlan(plan);

  assert.equal(rendered.schema_version, "1.0");
  assert.equal(rendered.render_only, true);
  assert.equal(rendered.text.includes("Video Orchestrator runtime scheduler command plan"), true);
  assert.equal(rendered.text.includes("Command: queue"), true);
  assert.equal(rendered.text.includes("Project: says-the-bible"), true);
  assert.equal(rendered.text.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.safety.live_scheduler_executed, false);
  assert.equal(rendered.safety.upload_executed, false);
  assert.equal(rendered.safety.network_calls_made, false);
  assert.equal(rendered.safety.credential_accessed, false);
  assert.equal(rendered.safety.media_read_performed, false);
  assert.equal(rendered.safety.files_written, false);
  assert.equal(rendered.safety.git_add_executed, false);
  assert.equal(rendered.safety.committed_now, false);
  assert.equal(rendered.safety.pushed_now, false);
});

test("VO-7EZ-RUNTIME-SCHEDULER-COMMAND-RENDERER-2: blocked plan renders help", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["run-live"], ...SAFE_FLAGS });
  const rendered = renderRuntimeSchedulerCommandPlan(plan);

  assert.equal(plan.validation.complete, false);
  assert.equal(rendered.text.includes("Video Orchestrator runtime scheduler commands"), true);
  assert.equal(rendered.text.includes("planning/display commands only"), true);
  assert.equal(rendered.safety.live_scheduler_executed, false);
});

test("VO-7FA-RUNTIME-SCHEDULER-COMMAND-RENDERER-REVIEW-1: JSON render is safe", () => {
  const plan = createRuntimeSchedulerCommandPlan({ argv: ["summary", "--project=says-the-bible", "--output=json"], ...SAFE_FLAGS });
  const rendered = renderRuntimeSchedulerCommandPlanJson(plan);
  const parsed = JSON.parse(rendered.text);

  assert.equal(parsed.command, "summary");
  assert.equal(parsed.project_id, "says-the-bible");
  assert.equal(parsed.safety.live_scheduler_enabled, false);
  assert.equal(parsed.safety.upload_execution_enabled, false);
  assert.equal(parsed.safety.network_enabled, false);
  assert.equal(parsed.safety.credential_access_enabled, false);
  assert.equal(rendered.text.includes("access_token"), false);
  assert.equal(rendered.text.includes("client_secret"), false);
  assert.equal(rendered.text.includes("api_key"), false);
  assert.equal(rendered.safety.files_written, false);
});
