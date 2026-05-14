import { test } from "node:test";
import assert from "node:assert";
import { parseRuntimeSchedulerBridgeArgs } from "./video-orchestrator-runtime-scheduler-bridge-args.js";
import { runRuntimeSchedulerBridge } from "./video-orchestrator-runtime-scheduler-bridge.js";

test("VO-7EZ-RUNTIME-SCHEDULER-BRIDGE-ARGS-1: parses positional summary command safely", () => {
  const parsed = parseRuntimeSchedulerBridgeArgs(["summary"]);

  assert.equal(parsed.schema_version, "1.0");
  assert.equal(parsed.command, "summary");
  assert.equal(parsed.input.command, "summary");
  assert.equal(parsed.input.allow_bridge_only, true);
  assert.equal(parsed.input.allow_runtime_schedule, false);
  assert.equal(parsed.input.allow_upload_execution, false);
  assert.equal(parsed.input.allow_network, false);
  assert.equal(parsed.input.allow_credential_access, false);
  assert.equal(parsed.input.allow_media_read, false);
  assert.equal(parsed.input.allow_file_write, false);
  assert.equal(parsed.safety.parser_only, true);
  assert.equal(parsed.safety.runtime_schedule_executed, false);
  assert.equal(parsed.safety.upload_executed, false);
  assert.equal(parsed.safety.network_calls_made, false);
  assert.equal(parsed.safety.credential_accessed, false);
  assert.equal(parsed.safety.media_read_performed, false);
  assert.equal(parsed.safety.files_written, false);
});

test("VO-7EZ-RUNTIME-SCHEDULER-BRIDGE-ARGS-2: parses command flag and can feed bridge", () => {
  const parsed = parseRuntimeSchedulerBridgeArgs(["--command=status"]);
  const result = runRuntimeSchedulerBridge(parsed.input);

  assert.equal(parsed.command, "status");
  assert.equal(result.command, "status");
  assert.equal(result.exit_code, 0);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
});

test("VO-7FA-RUNTIME-SCHEDULER-BRIDGE-ARGS-REVIEW-1: unsafe runtime flags warn and bridge blocks", () => {
  const parsed = parseRuntimeSchedulerBridgeArgs(["summary", "--allow-runtime-schedule=true", "--allow-network", "true"]);
  const result = runRuntimeSchedulerBridge(parsed.input);

  assert.equal(parsed.warnings.length, 1);
  assert.equal(parsed.warnings[0]?.includes("Unsafe runtime flags"), true);
  assert.equal(parsed.input.allow_runtime_schedule, true);
  assert.equal(parsed.input.allow_network, true);
  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("blocked"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.network_calls_made, false);
});

test("VO-7FA-RUNTIME-SCHEDULER-BRIDGE-ARGS-REVIEW-2: unknown command warns and stays side-effect free", () => {
  const parsed = parseRuntimeSchedulerBridgeArgs(["run-now"]);
  const result = runRuntimeSchedulerBridge(parsed.input);

  assert.equal(parsed.command, "unknown");
  assert.equal(parsed.warnings[0]?.includes("Unknown command"), true);
  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("Unknown command"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.files_written, false);
});
