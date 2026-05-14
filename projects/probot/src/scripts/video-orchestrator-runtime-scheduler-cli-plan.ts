import { createRuntimeSchedulerCommandPlan, type RuntimeSchedulerCommandPlanInput } from "./video-orchestrator-runtime-scheduler-command-plan.js";
import { renderRuntimeSchedulerCommandPlan, renderRuntimeSchedulerCommandPlanJson } from "./video-orchestrator-runtime-scheduler-command-renderer.js";

export interface RuntimeSchedulerCliPlanInput extends RuntimeSchedulerCommandPlanInput {
  allow_cli_plan_only: true;
}

export interface RuntimeSchedulerCliPlanResult {
  schema_version: "1.0";
  cli_plan_only: true;
  command_plan: ReturnType<typeof createRuntimeSchedulerCommandPlan>;
  rendered_text: string;
  exit_code: 0 | 2;
  safety: {
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

function inputReady(input: RuntimeSchedulerCliPlanInput): boolean {
  return input.allow_cli_plan_only === true
    && input.allow_plan_only === true
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

export function createRuntimeSchedulerCliPlan(input: RuntimeSchedulerCliPlanInput): RuntimeSchedulerCliPlanResult {
  const commandPlan = createRuntimeSchedulerCommandPlan(input);
  const ready = inputReady(input) && commandPlan.validation.complete;
  const rendered = commandPlan.output === "json" ? renderRuntimeSchedulerCommandPlanJson(commandPlan) : renderRuntimeSchedulerCommandPlan(commandPlan);
  return {
    schema_version: "1.0",
    cli_plan_only: true,
    command_plan: commandPlan,
    rendered_text: rendered.text,
    exit_code: ready ? 0 : 2,
    safety: { live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
  };
}

export function createRuntimeSchedulerCliSafeInput(argv: string[]): RuntimeSchedulerCliPlanInput {
  return {
    argv,
    allow_cli_plan_only: true,
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
  };
}
