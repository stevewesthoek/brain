import type { RuntimeSchedulerNextStepAdvisory } from "./video-orchestrator-runtime-scheduler-next-step-advisory.js";

export type RuntimeSchedulerApprovalPromptState = "ready_for_operator_copy_paste" | "blocked" | "revoked";

export interface RuntimeSchedulerApprovalPromptInput {
  prompt_id: string;
  operator_id: string;
  allow_prompt_only: true;
  allow_package_json_edit: false;
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

export interface RuntimeSchedulerApprovalPrompt {
  schema_version: "1.0";
  prompt_id: string;
  prompt_state: RuntimeSchedulerApprovalPromptState;
  prompt_only: true;
  advisory_state: RuntimeSchedulerNextStepAdvisory["advisory_state"];
  requested_next_step: RuntimeSchedulerNextStepAdvisory["requested_next_step"];
  copy_paste_confirmation: string;
  package_json_edited: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; ready_for_operator_copy_paste: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerApprovalPromptInput): boolean {
  return input.allow_prompt_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.prompt_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function advisoryReady(advisory: RuntimeSchedulerNextStepAdvisory): boolean {
  return advisory.schema_version === "1.0"
    && advisory.advisory_state === "manual_action_required"
    && advisory.advisory_only
    && advisory.validation.complete
    && advisory.validation.manual_action_required
    && !advisory.package_json_edited
    && !advisory.live_scheduler_enabled
    && !advisory.upload_execution_enabled
    && !advisory.network_enabled
    && !advisory.credential_access_enabled
    && !advisory.media_read_enabled
    && !advisory.file_write_enabled
    && !advisory.git_add_executed
    && !advisory.committed_now
    && !advisory.pushed_now;
}

export function createRuntimeSchedulerApprovalPrompt(input: RuntimeSchedulerApprovalPromptInput, advisory: RuntimeSchedulerNextStepAdvisory): RuntimeSchedulerApprovalPrompt {
  const ready = inputReady(input) && advisoryReady(advisory);
  return {
    schema_version: "1.0",
    prompt_id: safe(input.prompt_id, "runtime-scheduler-approval-prompt"),
    prompt_state: ready ? "ready_for_operator_copy_paste" : "blocked",
    prompt_only: true,
    advisory_state: advisory.advisory_state,
    requested_next_step: advisory.requested_next_step,
    copy_paste_confirmation: ready ? advisory.required_confirmation : "No confirmation available while blocked.",
    package_json_edited: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, ready_for_operator_copy_paste: ready, blocking_reasons: ready ? [] : ["Runtime scheduler approval prompt input or advisory was unsafe/incomplete."], warnings: ["Prompt only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerApprovalPrompt(prompt: RuntimeSchedulerApprovalPrompt, reason?: string): RuntimeSchedulerApprovalPrompt {
  return { ...prompt, prompt_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_operator_copy_paste: false, blocking_reasons: prompt.validation.blocking_reasons, warnings: [...prompt.validation.warnings, safe(reason, "Runtime scheduler approval prompt was revoked.")] } };
}

export function renderRuntimeSchedulerApprovalPrompt(prompt: RuntimeSchedulerApprovalPrompt): string {
  return [
    "Video Orchestrator runtime scheduler approval prompt",
    `State: ${prompt.prompt_state}`,
    `Requested next step: ${prompt.requested_next_step}`,
    "Copy/paste confirmation:",
    prompt.copy_paste_confirmation,
    `package.json edited: ${prompt.package_json_edited}`,
    `Live scheduler enabled: ${prompt.live_scheduler_enabled}`,
  ].join("\n");
}
