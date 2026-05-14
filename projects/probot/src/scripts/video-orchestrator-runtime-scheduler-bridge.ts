import type { RuntimeSchedulerSummaryResult } from "./video-orchestrator-runtime-scheduler-summary.js";
import { createRuntimeSchedulerSummary, renderRuntimeSchedulerSummary } from "./video-orchestrator-runtime-scheduler-summary.js";

export type RuntimeSchedulerBridgeCommand = "summary" | "status" | "help" | "unknown";

export interface RuntimeSchedulerBridgeInput {
  command?: string;
  allow_bridge_only: true;
  allow_runtime_schedule: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
}

export interface RuntimeSchedulerBridgeResult {
  schema_version: "1.0";
  bridge_only: true;
  command: RuntimeSchedulerBridgeCommand;
  exit_code: 0 | 2;
  output: string;
  summary: RuntimeSchedulerSummaryResult;
  safety: {
    runtime_schedule_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
    env_written: false;
  };
}

function normalizeCommand(command: string | undefined): RuntimeSchedulerBridgeCommand {
  const text = String(command ?? "summary").trim().toLowerCase();
  if (text === "summary" || text === "status" || text === "help") return text;
  return "unknown";
}

function inputReady(input: RuntimeSchedulerBridgeInput): boolean {
  return input.allow_bridge_only === true
    && input.allow_runtime_schedule === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false;
}

function helpText(): string {
  return [
    "Video Orchestrator Runtime Scheduler Bridge",
    "Commands:",
    "  summary  Render a side-effect-free runtime scheduler summary.",
    "  status   Alias for summary.",
    "  help     Show this help text.",
    "Safety:",
    "  This bridge does not schedule, upload, call network APIs, access credentials, read media, or write files.",
  ].join("\n");
}

export function runRuntimeSchedulerBridge(input: RuntimeSchedulerBridgeInput): RuntimeSchedulerBridgeResult {
  const command = normalizeCommand(input.command);
  const safe = inputReady(input);
  const summary = createRuntimeSchedulerSummary({});
  let output = "";
  let exitCode: 0 | 2 = 0;

  if (!safe) {
    output = "Runtime scheduler bridge blocked: unsafe runtime permissions were requested.";
    exitCode = 2;
  } else if (command === "help") {
    output = helpText();
  } else if (command === "summary" || command === "status") {
    output = renderRuntimeSchedulerSummary(summary);
  } else {
    output = `${helpText()}\n\nUnknown command.`;
    exitCode = 2;
  }

  return {
    schema_version: "1.0",
    bridge_only: true,
    command,
    exit_code: exitCode,
    output,
    summary,
    safety: { runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, env_written: false },
  };
}
