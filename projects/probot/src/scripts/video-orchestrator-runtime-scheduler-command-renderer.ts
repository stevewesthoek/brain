import type { RuntimeSchedulerCommandPlan } from "./video-orchestrator-runtime-scheduler-command-plan.js";
import { renderRuntimeSchedulerCommandPlanHelp } from "./video-orchestrator-runtime-scheduler-command-plan.js";

export interface RuntimeSchedulerCommandRenderResult {
  schema_version: "1.0";
  render_only: true;
  text: string;
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

function line(label: string, value: string | number | boolean): string {
  return `  - ${label}: ${String(value)}`;
}

export function renderRuntimeSchedulerCommandPlan(plan: RuntimeSchedulerCommandPlan): RuntimeSchedulerCommandRenderResult {
  const text = plan.validation.complete
    ? [
        "Video Orchestrator runtime scheduler command plan",
        line("Command", plan.command),
        line("Action", plan.action),
        line("Project", plan.project_id),
        line("Filter", plan.filter),
        line("Output", plan.output),
        line("Plan only", plan.plan_only),
        line("Live scheduler enabled", plan.live_scheduler_enabled),
        line("Uploads enabled", plan.upload_execution_enabled),
        line("Network enabled", plan.network_enabled),
        line("Credential access enabled", plan.credential_access_enabled),
      ].join("\n")
    : renderRuntimeSchedulerCommandPlanHelp();
  return {
    schema_version: "1.0",
    render_only: true,
    text,
    safety: { live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
  };
}

export function renderRuntimeSchedulerCommandPlanJson(plan: RuntimeSchedulerCommandPlan): RuntimeSchedulerCommandRenderResult {
  return {
    schema_version: "1.0",
    render_only: true,
    text: JSON.stringify({ command: plan.command, action: plan.action, project_id: plan.project_id, filter: plan.filter, output: plan.output, plan_only: plan.plan_only, validation: plan.validation, safety: { live_scheduler_enabled: plan.live_scheduler_enabled, upload_execution_enabled: plan.upload_execution_enabled, network_enabled: plan.network_enabled, credential_access_enabled: plan.credential_access_enabled, media_read_enabled: plan.media_read_enabled, file_write_enabled: plan.file_write_enabled } }, null, 2),
    safety: { live_scheduler_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
  };
}
