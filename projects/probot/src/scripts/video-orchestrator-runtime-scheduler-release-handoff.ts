import type { RuntimeSchedulerReleaseChecklist } from "./video-orchestrator-runtime-scheduler-release-checklist.js";

export type RuntimeSchedulerReleaseHandoffState = "ready_for_operator_handoff" | "blocked" | "revoked";

export interface RuntimeSchedulerReleaseHandoffInput {
  handoff_id: string;
  operator_id: string;
  release_notes: string;
  allow_handoff_only: true;
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

export interface RuntimeSchedulerReleaseHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerReleaseHandoffState;
  handoff_only: true;
  release_notes: string;
  checklist_state: RuntimeSchedulerReleaseChecklist["checklist_state"];
  checklist_item_count: number;
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
  next_manual_step: string;
  validation: { complete: boolean; ready_for_operator_handoff: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerReleaseHandoffInput): boolean {
  return input.allow_handoff_only === true
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
    && input.handoff_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function checklistReady(checklist: RuntimeSchedulerReleaseChecklist): boolean {
  return checklist.schema_version === "1.0"
    && checklist.checklist_state === "ready_for_manual_release_review"
    && checklist.checklist_only
    && checklist.validation.complete
    && checklist.validation.ready_for_manual_release_review
    && !checklist.package_json_edited
    && !checklist.live_scheduler_enabled
    && !checklist.upload_execution_enabled
    && !checklist.network_enabled
    && !checklist.credential_access_enabled
    && !checklist.media_read_enabled
    && !checklist.file_write_enabled
    && !checklist.git_add_executed
    && !checklist.committed_now
    && !checklist.pushed_now;
}

export function createRuntimeSchedulerReleaseHandoff(input: RuntimeSchedulerReleaseHandoffInput, checklist: RuntimeSchedulerReleaseChecklist): RuntimeSchedulerReleaseHandoff {
  const ready = inputReady(input) && checklistReady(checklist);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-release-handoff"),
    handoff_state: ready ? "ready_for_operator_handoff" : "blocked",
    handoff_only: true,
    release_notes: safe(input.release_notes, "Runtime scheduler CLI is prepared for manual release review."),
    checklist_state: checklist.checklist_state,
    checklist_item_count: checklist.items.length,
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
    next_manual_step: ready ? "Review the release checklist, then explicitly approve package metadata edits before adding a package.json script." : "Resolve blocked checklist or unsafe handoff inputs before continuing.",
    validation: { complete: ready, ready_for_operator_handoff: ready, blocking_reasons: ready ? [] : ["Runtime scheduler release handoff input or checklist was unsafe/incomplete."], warnings: ["Handoff only; package.json edits and live scheduler activation remain blocked until separately approved."] },
  };
}

export function revokeRuntimeSchedulerReleaseHandoff(handoff: RuntimeSchedulerReleaseHandoff, reason?: string): RuntimeSchedulerReleaseHandoff {
  return { ...handoff, handoff_state: "revoked", validation: { complete: false, ready_for_operator_handoff: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler release handoff was revoked.")] } };
}

export function renderRuntimeSchedulerReleaseHandoff(handoff: RuntimeSchedulerReleaseHandoff): string {
  return [
    "Video Orchestrator runtime scheduler release handoff",
    `State: ${handoff.handoff_state}`,
    `Checklist state: ${handoff.checklist_state}`,
    `Checklist items: ${handoff.checklist_item_count}`,
    `package.json edited: ${handoff.package_json_edited}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
    `Next manual step: ${handoff.next_manual_step}`,
  ].join("\n");
}
