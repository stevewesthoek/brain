#!/usr/bin/env node
// Video Orchestrator runtime scheduler bridge CLI
// Side-effect-free bridge for inspecting the runtime scheduler state surfaces.
// Usage:
//   node src/scripts/video-orchestrator-runtime-scheduler.mjs summary
//   node src/scripts/video-orchestrator-runtime-scheduler.mjs status
//   node src/scripts/video-orchestrator-runtime-scheduler.mjs help

import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseRuntimeSchedulerBridgeArgs } from "./video-orchestrator-runtime-scheduler-bridge-args.ts";
import { runRuntimeSchedulerBridge } from "./video-orchestrator-runtime-scheduler-bridge.ts";

export function runRuntimeSchedulerBridgeCli(argv = process.argv.slice(2)) {
  const parsed = parseRuntimeSchedulerBridgeArgs(argv);
  const result = runRuntimeSchedulerBridge(parsed.input);
  const output = parsed.warnings.length > 0 ? `${parsed.warnings.join("\n")}\n${result.output}` : result.output;
  return {
    schema_version: "1.0",
    cli_only: true,
    output,
    exit_code: result.exit_code,
    safety: {
      runtime_schedule_executed: false,
      upload_executed: false,
      network_calls_made: false,
      credential_accessed: false,
      media_read_performed: false,
      files_written: false,
    },
  };
}

const __filename = fileURLToPath(import.meta.url);
const execArgv = process.argv[1];
const isDirectExecution = path.resolve(__filename) === path.resolve(execArgv);

if (isDirectExecution) {
  const result = runRuntimeSchedulerBridgeCli();
  if (result.output) console.log(result.output);
  process.exitCode = result.exit_code;
}
