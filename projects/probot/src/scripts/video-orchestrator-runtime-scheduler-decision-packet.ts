import type { RuntimeSchedulerNextStepAdvisory } from "./video-orchestrator-runtime-scheduler-next-step-advisory.js";
import type { RuntimeSchedulerApprovalPrompt } from "./video-orchestrator-runtime-scheduler-approval-prompt.js";

export type RuntimeSchedulerDecisionPacketState = "ready_for_operator_decision" | "blocked" | "revoked";

export interface RuntimeSchedulerDecisionPacketInput {
  packet_id: string;
  operator_id: string;
  allow_packet_only: true;
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

export interface RuntimeSchedulerDecisionPacket {
  schema_version: "1.0";
  packet_id: string;
  packet_state: RuntimeSchedulerDecisionPacketState;
  packet_only: true;
  requested_next_step: RuntimeSchedulerNextStepAdvisory["requested_next_step"];
  recommendation: string;
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
  validation: { complete: boolean; ready_for_operator_decision: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 280) : fallback;
}

function inputReady(input: RuntimeSchedulerDecisionPacketInput): boolean {
  return input.allow_packet_only === true
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
    && input.packet_id.trim().length > 0
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

function promptReady(prompt: RuntimeSchedulerApprovalPrompt, advisory: RuntimeSchedulerNextStepAdvisory): boolean {
  return prompt.schema_version === "1.0"
    && prompt.prompt_state === "ready_for_operator_copy_paste"
    && prompt.prompt_only
    && prompt.advisory_state === advisory.advisory_state
    && prompt.requested_next_step === advisory.requested_next_step
    && prompt.copy_paste_confirmation === advisory.required_confirmation
    && prompt.validation.complete
    && prompt.validation.ready_for_operator_copy_paste
    && !prompt.package_json_edited
    && !prompt.live_scheduler_enabled
    && !prompt.upload_execution_enabled
    && !prompt.network_enabled
    && !prompt.credential_access_enabled
    && !prompt.media_read_enabled
    && !prompt.file_write_enabled
    && !prompt.git_add_executed
    && !prompt.committed_now
    && !prompt.pushed_now;
}

export function createRuntimeSchedulerDecisionPacket(input: RuntimeSchedulerDecisionPacketInput, advisory: RuntimeSchedulerNextStepAdvisory, prompt: RuntimeSchedulerApprovalPrompt): RuntimeSchedulerDecisionPacket {
  const ready = inputReady(input) && advisoryReady(advisory) && promptReady(prompt, advisory);
  return {
    schema_version: "1.0",
    packet_id: safe(input.packet_id, "runtime-scheduler-decision-packet"),
    packet_state: ready ? "ready_for_operator_decision" : "blocked",
    packet_only: true,
    requested_next_step: advisory.requested_next_step,
    recommendation: ready ? advisory.recommendation : "Resolve blocked advisory or approval prompt before continuing.",
    copy_paste_confirmation: ready ? prompt.copy_paste_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, ready_for_operator_decision: ready, blocking_reasons: ready ? [] : ["Runtime scheduler decision packet input, advisory, or approval prompt was unsafe/incomplete."], warnings: ["Decision packet only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerDecisionPacket(packet: RuntimeSchedulerDecisionPacket, reason?: string): RuntimeSchedulerDecisionPacket {
  return { ...packet, packet_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_operator_decision: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler decision packet was revoked.")] } };
}

export function renderRuntimeSchedulerDecisionPacket(packet: RuntimeSchedulerDecisionPacket): string {
  return [
    "Video Orchestrator runtime scheduler decision packet",
    `State: ${packet.packet_state}`,
    `Requested next step: ${packet.requested_next_step}`,
    `Recommendation: ${packet.recommendation}`,
    "Copy/paste confirmation:",
    packet.copy_paste_confirmation,
    `package.json edited: ${packet.package_json_edited}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
