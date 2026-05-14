import { test } from "node:test";
import assert from "node:assert";
import { parseRuntimeSchedulerBridgeArgs } from "./video-orchestrator-runtime-scheduler-bridge-args.js";
import { runRuntimeSchedulerBridge } from "./video-orchestrator-runtime-scheduler-bridge.js";

function renderCli(argv: string[]) {
  const parsed = parseRuntimeSchedulerBridgeArgs(argv);
  const result = runRuntimeSchedulerBridge(parsed.input);
  return {
    output: parsed.warnings.length > 0 ? `${parsed.warnings.join("\n")}\n${result.output}` : result.output,
    exit_code: result.exit_code,
    safety: result.safety,
  };
}

test("VO-7FD-RUNTIME-SCHEDULER-CLI-OUTPUT-1: summary CLI output remains side-effect free", () => {
  const result = renderCli(["summary"]);

  assert.equal(result.exit_code, 0);
  assert.equal(result.output.includes("Video Orchestrator Runtime Scheduler Summary"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.upload_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.credential_accessed, false);
  assert.equal(result.safety.media_read_performed, false);
  assert.equal(result.safety.files_written, false);
  assert.equal(result.safety.env_written, false);
});

test("VO-7FD-RUNTIME-SCHEDULER-CLI-OUTPUT-2: unsafe CLI flags warn and stay blocked", () => {
  const result = renderCli(["summary", "--allow-runtime-schedule=true", "--allow-network=true"]);

  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("Unsafe runtime flags"), true);
  assert.equal(result.output.includes("blocked"), true);
  assert.equal(result.safety.runtime_schedule_executed, false);
  assert.equal(result.safety.network_calls_made, false);
  assert.equal(result.safety.files_written, false);
});

test("VO-7FE-RUNTIME-SCHEDULER-CLI-OUTPUT-REVIEW-1: unknown CLI command renders safe help", () => {
  const result = renderCli(["run-live"]);

  assert.equal(result.exit_code, 2);
  assert.equal(result.output.includes("Unknown command"), true);
  assert.equal(result.output.includes("does not schedule"), true);
  assert.equal(result.output.includes("access_token"), false);
  assert.equal(result.output.includes("client_secret"), false);
  assert.equal(result.output.includes("api_key"), false);
});
