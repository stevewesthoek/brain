import type { RuntimeSchedulerDecisionPacket } from "./video-orchestrator-runtime-scheduler-decision-packet.js";

export type RuntimeSchedulerManualApprovalChecklistState = "ready_for_manual_review" | "blocked" | "revoked";

export interface RuntimeSchedulerManualApprovalChecklistInput {
  checklist_id: string;
  operator_id: string;
  allow_checklist_only: true;
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

export interface RuntimeSchedulerManualApprovalChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  evidence: string;
}

export interface RuntimeSchedulerManualApprovalChecklist {
  schema_version: "1.0";
  checklist_id: string;
  checklist_state: RuntimeSchedulerManualApprovalChecklistState;
  checklist_only: true;
  requested_next_step: RuntimeSchedulerDecisionPacket["requested_next_step"];
  items: RuntimeSchedulerManualApprovalChecklistItem[];
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
  validation: { complete: boolean; ready_for_manual_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 280) : fallback;
}

function inputReady(input: RuntimeSchedulerManualApprovalChecklistInput): boolean {
  return input.allow_checklist_only === true
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
    && input.checklist_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function packetReady(packet: RuntimeSchedulerDecisionPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.packet_state === "ready_for_operator_decision"
    && packet.packet_only
    && packet.validation.complete
    && packet.validation.ready_for_operator_decision
    && !packet.package_json_edited
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.file_write_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

export function createRuntimeSchedulerManualApprovalChecklist(input: RuntimeSchedulerManualApprovalChecklistInput, packet: RuntimeSchedulerDecisionPacket): RuntimeSchedulerManualApprovalChecklist {
  const inputOk = inputReady(input);
  const packetOk = packetReady(packet);
  const hasConfirmation = packet.copy_paste_confirmation.trim().length > 0 && !packet.copy_paste_confirmation.toLowerCase().includes("blocked") && !packet.copy_paste_confirmation.toLowerCase().includes("revoked");
  const items: RuntimeSchedulerManualApprovalChecklistItem[] = [
    { id: "input", label: "Checklist input is safe", complete: inputOk, evidence: inputOk ? "All runtime/write/git toggles are disabled." : "Checklist input is unsafe or incomplete." },
    { id: "packet", label: "Decision packet is ready", complete: packetOk, evidence: packetOk ? "Packet is ready for operator decision and has no side effects enabled." : "Packet is blocked, revoked, or unsafe." },
    { id: "confirmation", label: "Copy/paste confirmation is available", complete: hasConfirmation, evidence: hasConfirmation ? "Operator can copy/paste an explicit confirmation for the selected next step." : "No usable confirmation text is available." },
  ];
  const ready = items.every((item) => item.complete);
  return {
    schema_version: "1.0",
    checklist_id: safe(input.checklist_id, "runtime-scheduler-manual-approval-checklist"),
    checklist_state: ready ? "ready_for_manual_review" : "blocked",
    checklist_only: true,
    requested_next_step: packet.requested_next_step,
    items,
    copy_paste_confirmation: ready ? packet.copy_paste_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, ready_for_manual_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler manual approval checklist input or packet was unsafe/incomplete."], warnings: ["Checklist only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerManualApprovalChecklist(checklist: RuntimeSchedulerManualApprovalChecklist, reason?: string): RuntimeSchedulerManualApprovalChecklist {
  return { ...checklist, checklist_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", validation: { complete: false, ready_for_manual_review: false, blocking_reasons: checklist.validation.blocking_reasons, warnings: [...checklist.validation.warnings, safe(reason, "Runtime scheduler manual approval checklist was revoked.")] } };
}

export function renderRuntimeSchedulerManualApprovalChecklist(checklist: RuntimeSchedulerManualApprovalChecklist): string {
  const rows = checklist.items.map((item) => `- ${item.label}: ${item.complete ? "complete" : "blocked"} (${item.evidence})`).join("\n");
  return [
    "Video Orchestrator runtime scheduler manual approval checklist",
    `State: ${checklist.checklist_state}`,
    `Requested next step: ${checklist.requested_next_step}`,
    rows,
    "Copy/paste confirmation:",
    checklist.copy_paste_confirmation,
    `package.json edited: ${checklist.package_json_edited}`,
    `Live scheduler enabled: ${checklist.live_scheduler_enabled}`,
  ].join("\n");
}
