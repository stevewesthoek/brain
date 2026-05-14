export type RuntimeSchedulerSmokeCommand = "summary" | "status" | "help" | "unknown" | "unsafe-flags";

export interface RuntimeSchedulerSmokeMatrixRow {
  id: string;
  command: RuntimeSchedulerSmokeCommand;
  argv: string[];
  expected_exit_code: 0 | 2;
  expected_output_contains: string[];
  expected_output_excludes: string[];
  live_scheduler_expected: false;
  upload_expected: false;
  network_expected: false;
  credential_access_expected: false;
  media_read_expected: false;
  file_write_expected: false;
}

export interface RuntimeSchedulerSmokeMatrix {
  schema_version: "1.0";
  matrix_only: true;
  rows: RuntimeSchedulerSmokeMatrixRow[];
  safety: {
    commands_executed: false;
    package_json_edited: false;
    live_scheduler_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
}

const SAFE_EXCLUDES = ["access_token", "refresh_token", "client_secret", "api_key", "[TOKEN", "[API_KEY", "keychain://"];

function row(id: string, command: RuntimeSchedulerSmokeCommand, argv: string[], expected_exit_code: 0 | 2, expected_output_contains: string[]): RuntimeSchedulerSmokeMatrixRow {
  return {
    id,
    command,
    argv,
    expected_exit_code,
    expected_output_contains,
    expected_output_excludes: SAFE_EXCLUDES,
    live_scheduler_expected: false,
    upload_expected: false,
    network_expected: false,
    credential_access_expected: false,
    media_read_expected: false,
    file_write_expected: false,
  };
}

export function createRuntimeSchedulerSmokeMatrix(): RuntimeSchedulerSmokeMatrix {
  return {
    schema_version: "1.0",
    matrix_only: true,
    rows: [
      row("runtime-scheduler-smoke-summary", "summary", ["summary"], 0, ["Video Orchestrator Runtime Scheduler Summary"]),
      row("runtime-scheduler-smoke-status", "status", ["status"], 0, ["Video Orchestrator Runtime Scheduler Summary"]),
      row("runtime-scheduler-smoke-help", "help", ["help"], 0, ["Video Orchestrator Runtime Scheduler Bridge", "Commands:"]),
      row("runtime-scheduler-smoke-unknown", "unknown", ["run-live"], 2, ["Unknown command", "does not schedule"]),
      row("runtime-scheduler-smoke-unsafe-flags", "unsafe-flags", ["summary", "--allow-runtime-schedule=true", "--allow-network=true"], 2, ["Unsafe runtime flags", "blocked"]),
    ],
    safety: { commands_executed: false, package_json_edited: false, live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
  };
}

export function renderRuntimeSchedulerSmokeMatrix(matrix: RuntimeSchedulerSmokeMatrix): string {
  const rows = matrix.rows.map((item) => `${item.id}: node src/scripts/video-orchestrator-runtime-scheduler.mjs ${item.argv.join(" ")} -> exit ${item.expected_exit_code}`).join("\n");
  return [
    "Video Orchestrator runtime scheduler smoke matrix",
    rows,
    "Safety: matrix only; commands are not executed by this module.",
  ].join("\n");
}
