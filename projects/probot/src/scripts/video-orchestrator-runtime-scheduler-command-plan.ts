export type RuntimeSchedulerCommandName = "summary" | "queue" | "read-model" | "activation-gate" | "unknown";
export type RuntimeSchedulerCommandAction = "render_summary" | "show_queue" | "show_read_model" | "show_activation_gate" | "show_help";
export type RuntimeSchedulerCommandFilter = "all" | "queued_dry_run" | "deferred" | "manual_fallback" | "blocked";

export interface RuntimeSchedulerCommandPlanInput {
  argv: string[];
  allow_plan_only: true;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerCommandPlan {
  schema_version: "1.0";
  command: RuntimeSchedulerCommandName;
  action: RuntimeSchedulerCommandAction;
  filter: RuntimeSchedulerCommandFilter;
  project_id: string;
  output: "text" | "json";
  plan_only: true;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 120) : fallback;
}

function parseFlag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const eq = argv.find((arg) => arg.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) {
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) return next;
  }
  return undefined;
}

function normalizeCommand(value: string | undefined): RuntimeSchedulerCommandName {
  if (value === "summary" || value === "queue" || value === "read-model" || value === "activation-gate") return value;
  return value ? "unknown" : "summary";
}

function normalizeFilter(value: string | undefined): RuntimeSchedulerCommandFilter {
  if (value === "queued_dry_run" || value === "deferred" || value === "manual_fallback" || value === "blocked") return value;
  return "all";
}

function normalizeOutput(value: string | undefined): "text" | "json" {
  return value === "json" ? "json" : "text";
}

function actionFor(command: RuntimeSchedulerCommandName): RuntimeSchedulerCommandAction {
  if (command === "summary") return "render_summary";
  if (command === "queue") return "show_queue";
  if (command === "read-model") return "show_read_model";
  if (command === "activation-gate") return "show_activation_gate";
  return "show_help";
}

function inputReady(input: RuntimeSchedulerCommandPlanInput): boolean {
  return input.allow_plan_only === true
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false;
}

export function createRuntimeSchedulerCommandPlan(input: RuntimeSchedulerCommandPlanInput): RuntimeSchedulerCommandPlan {
  const command = normalizeCommand(input.argv[0]);
  const ready = inputReady(input) && command !== "unknown";
  return {
    schema_version: "1.0",
    command,
    action: actionFor(command),
    filter: normalizeFilter(parseFlag(input.argv, "filter")),
    project_id: safe(parseFlag(input.argv, "project") ?? parseFlag(input.argv, "project-id"), "default-project"),
    output: normalizeOutput(parseFlag(input.argv, "output")),
    plan_only: true,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, blocking_reasons: ready ? [] : ["Runtime scheduler command plan input was unsafe or command was unknown."], warnings: ["Command plan only; no runtime scheduler, upload, network, credential, media, file, or git behavior is enabled."] },
  };
}

export function renderRuntimeSchedulerCommandPlanHelp(): string {
  return [
    "Video Orchestrator runtime scheduler commands:",
    "  summary [--project <id>] [--output text|json]",
    "  queue [--project <id>] [--filter all|queued_dry_run|deferred|manual_fallback|blocked]",
    "  read-model [--project <id>] [--filter all|queued_dry_run|deferred|manual_fallback|blocked]",
    "  activation-gate [--project <id>]",
    "All commands are planning/display commands only unless a separate live scheduler implementation is explicitly approved.",
  ].join("\n");
}
