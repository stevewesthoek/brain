export interface RuntimeSchedulerPackageScriptPlanInput {
  package_name: string;
  script_name: string;
  command: string;
  allow_plan_only: true;
  allow_package_json_edit: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPackageScriptPlan {
  schema_version: "1.0";
  plan_only: true;
  package_name: string;
  script_name: string;
  command: string;
  proposed_package_json_entry: Record<string, string>;
  package_json_edited: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function safeScriptName(value: string): string {
  const text = safe(value, "probot:video:runtime-scheduler");
  return /^[a-z0-9:_-]+$/i.test(text) ? text : "blocked-script-name";
}

function safeCommand(value: string): string {
  const text = safe(value, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  if (/[;&|`$]/.test(text) || text.includes("..") || text.includes(".env") || text.toLowerCase().includes("secret")) return "blocked-command";
  return text;
}

export function createRuntimeSchedulerPackageScriptPlan(input: RuntimeSchedulerPackageScriptPlanInput): RuntimeSchedulerPackageScriptPlan {
  const scriptName = safeScriptName(input.script_name);
  const command = safeCommand(input.command);
  const ready = input.allow_plan_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && safe(input.package_name, "").length > 0
    && scriptName !== "blocked-script-name"
    && command !== "blocked-command";
  return {
    schema_version: "1.0",
    plan_only: true,
    package_name: safe(input.package_name, "package"),
    script_name: scriptName,
    command,
    proposed_package_json_entry: ready ? { [scriptName]: command } : {},
    package_json_edited: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, blocking_reasons: ready ? [] : ["Package script plan input was unsafe or incomplete."], warnings: ["Plan only; package.json is not edited and no live scheduler/upload/network/credential/media/git behavior is enabled."] },
  };
}

export function renderRuntimeSchedulerPackageScriptPlan(plan: RuntimeSchedulerPackageScriptPlan): string {
  const entry = JSON.stringify(plan.proposed_package_json_entry, null, 2);
  return [
    "Video Orchestrator runtime scheduler package script plan",
    `Package: ${plan.package_name}`,
    `Script: ${plan.script_name}`,
    `Command: ${plan.command}`,
    `package.json edited: ${plan.package_json_edited}`,
    "Proposed scripts entry:",
    entry,
    "Manual boundary: package metadata changes require separate explicit approval.",
  ].join("\n");
}
