import type { RuntimeSchedulerBridgeCommand, RuntimeSchedulerBridgeInput } from "./video-orchestrator-runtime-scheduler-bridge.js";

export interface RuntimeSchedulerBridgeParsedArgs {
  schema_version: "1.0";
  command: RuntimeSchedulerBridgeCommand;
  input: RuntimeSchedulerBridgeInput;
  warnings: string[];
  safety: {
    parser_only: true;
    runtime_schedule_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
  };
}

function normalizeCommand(value: string | undefined): RuntimeSchedulerBridgeCommand {
  const text = String(value ?? "summary").trim().toLowerCase();
  if (text === "summary" || text === "status" || text === "help") return text;
  return "unknown";
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const text = value.trim().toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return fallback;
}

function readFlag(argv: string[], key: string): string | undefined {
  const prefix = `--${key}=`;
  const direct = argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = argv.indexOf(`--${key}`);
  if (index >= 0) {
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) return next;
    return "true";
  }
  return undefined;
}

export function parseRuntimeSchedulerBridgeArgs(argv: string[]): RuntimeSchedulerBridgeParsedArgs {
  const positional = argv.find((arg) => !arg.startsWith("--"));
  const command = normalizeCommand(readFlag(argv, "command") ?? positional);
  const allowRuntimeSchedule = parseBoolean(readFlag(argv, "allow-runtime-schedule"), false);
  const allowUploadExecution = parseBoolean(readFlag(argv, "allow-upload-execution"), false);
  const allowNetwork = parseBoolean(readFlag(argv, "allow-network"), false);
  const allowCredentialAccess = parseBoolean(readFlag(argv, "allow-credential-access"), false);
  const allowMediaRead = parseBoolean(readFlag(argv, "allow-media-read"), false);
  const allowFileWrite = parseBoolean(readFlag(argv, "allow-file-write"), false);
  const warnings: string[] = [];
  if (command === "unknown") warnings.push("Unknown command; bridge will render help with a nonzero exit code.");
  if (allowRuntimeSchedule || allowUploadExecution || allowNetwork || allowCredentialAccess || allowMediaRead || allowFileWrite) {
    warnings.push("Unsafe runtime flags were requested; bridge input will be marked unsafe and blocked by the bridge.");
  }
  return {
    schema_version: "1.0",
    command,
    input: {
      command,
      allow_bridge_only: true,
      allow_runtime_schedule: allowRuntimeSchedule as false,
      allow_upload_execution: allowUploadExecution as false,
      allow_network: allowNetwork as false,
      allow_credential_access: allowCredentialAccess as false,
      allow_media_read: allowMediaRead as false,
      allow_file_write: allowFileWrite as false,
    },
    warnings,
    safety: { parser_only: true, runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false },
  };
}
