import { test } from "node:test";
import assert from "node:assert";
import { runRuntimeSchedulerBridge, type RuntimeSchedulerBridgeInput } from "./video-orchestrator-runtime-scheduler-bridge.js";

const SAFE_INPUT: RuntimeSchedulerBridgeInput = {
  command: "summary",
  allow_bridge_only: true,
  allow_runtime_schedule: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_file_write: false,
};

test("VO-7EX-RUNTIME-SCHEDULER-BRIDGE-1: summary command is read-only and side-effect free", () => {
  const result = runRuntimeSchedulerBridge(SAFE_INPUT);

  assert.equal(result.schema_version, "1.0");
  assert.equal(result.bridge_only, true);
  assert.equal(result.command, "summary");
  assert.equal(result.exit_code, 0);
  assert.equal(result.output.includes("Video Orchestrator Runtime Scheduler Summary"), true);
  assert.equal(result.summary.summary_only, true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
  assert.equal(result.safety.media_read_performed, false);
  assert.equal(result.safety.files_written, false);
  assert.equal(result.safety.env_written, false);
});

test("VO-7EX-RUNTIME-SCHEDULER-BRIDGE-2: status aliases summary without side effects", () => {
  const result = runRuntimeSchedulerBridge({ ...SAFE_INPUT, command: "status" });

  assert.equal(result.command, "status");
  assert.equal(result.exit_code, 0);
  assert.equal(result.output.includes("Video Orchestrator Runtime Scheduler Summary"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
});

test("VO-7EX-RUNTIME-SCHEDULER-BRIDGE-3: help command stays read-only", () => {
  const result = runRuntimeSchedulerBridge({ ...SAFE_INPUT, command: "help" });

  assert.equal(result.command, "help");
  assert.equal(result.exit_code, 0);
  assert.equal(result.output.includes("Commands:"), true);
  assert.equal(result.output.includes("does not schedule"), true);
  assert.equal(result.safety.files_written, false);
});

test("VO-7EY-RUNTIME-SCHEDULER-BRIDGE-REVIEW-1: unsafe runtime permission blocks bridge", () => {
  const result = runRuntimeSchedulerBridge({ ...SAFE_INPUT, allow_runtime_schedule: true as false });

  assert.equal(result.command, "summary");
  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("blocked"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
  assert.equal(result.safety.media_read_performed, false);
  assert.equal(result.safety.files_written, false);
});

test("VO-7EY-RUNTIME-SCHEDULER-BRIDGE-REVIEW-2: unknown command returns help with nonzero exit", () => {
  const result = runRuntimeSchedulerBridge({ ...SAFE_INPUT, command: "run-now" });

  assert.equal(result.command, "unknown");
  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("Unknown command"), true);
  assert.equal(result.output.includes("does not schedule"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.files_written, false);
});
