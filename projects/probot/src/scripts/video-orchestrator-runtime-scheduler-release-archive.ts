import type { RuntimeSchedulerReleaseHandoff } from "./video-orchestrator-runtime-scheduler-release-handoff.js";

export type RuntimeSchedulerReleaseArchiveState = "archived_for_manual_follow_up" | "blocked" | "revoked";

export interface RuntimeSchedulerReleaseArchiveInput {
  archive_id: string;
  operator_id: string;
  source_commit_hint: string;
  allow_archive_only: true;
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

export interface RuntimeSchedulerReleaseArchive {
  schema_version: "1.0";
  archive_id: string;
  archive_state: RuntimeSchedulerReleaseArchiveState;
  archive_only: true;
  source_commit_hint: string;
  handoff_state: RuntimeSchedulerReleaseHandoff["handoff_state"];
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
  manual_follow_up: string[];
  validation: { complete: boolean; archived_for_manual_follow_up: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerReleaseArchiveInput): boolean {
  return input.allow_archive_only === true
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
    && input.archive_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.source_commit_hint.trim().length > 0;
}

function handoffReady(handoff: RuntimeSchedulerReleaseHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "ready_for_operator_handoff"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.ready_for_operator_handoff
    && !handoff.package_json_edited
    && !handoff.live_scheduler_enabled
    && !handoff.upload_execution_enabled
    && !handoff.network_enabled
    && !handoff.credential_access_enabled
    && !handoff.media_read_enabled
    && !handoff.file_write_enabled
    && !handoff.git_add_executed
    && !handoff.committed_now
    && !handoff.pushed_now;
}

export function createRuntimeSchedulerReleaseArchive(input: RuntimeSchedulerReleaseArchiveInput, handoff: RuntimeSchedulerReleaseHandoff): RuntimeSchedulerReleaseArchive {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    archive_id: safe(input.archive_id, "runtime-scheduler-release-archive"),
    archive_state: ready ? "archived_for_manual_follow_up" : "blocked",
    archive_only: true,
    source_commit_hint: safe(input.source_commit_hint, "commit-not-recorded"),
    handoff_state: handoff.handoff_state,
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
    manual_follow_up: ready ? [
      "Review the runtime scheduler release handoff.",
      "Explicitly approve package metadata edits before adding package.json scripts.",
      "Explicitly approve live scheduler activation before enabling runtime scheduling.",
    ] : ["Resolve blocked release handoff or unsafe archive input before continuing."],
    validation: { complete: ready, archived_for_manual_follow_up: ready, blocking_reasons: ready ? [] : ["Runtime scheduler release archive input or handoff was unsafe/incomplete."], warnings: ["Archive only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerReleaseArchive(archive: RuntimeSchedulerReleaseArchive, reason?: string): RuntimeSchedulerReleaseArchive {
  return { ...archive, archive_state: "revoked", validation: { complete: false, archived_for_manual_follow_up: false, blocking_reasons: archive.validation.blocking_reasons, warnings: [...archive.validation.warnings, safe(reason, "Runtime scheduler release archive was revoked.")] } };
}

export function renderRuntimeSchedulerReleaseArchive(archive: RuntimeSchedulerReleaseArchive): string {
  return [
    "Video Orchestrator runtime scheduler release archive",
    `State: ${archive.archive_state}`,
    `Source commit hint: ${archive.source_commit_hint}`,
    `Handoff state: ${archive.handoff_state}`,
    `package.json edited: ${archive.package_json_edited}`,
    `Live scheduler enabled: ${archive.live_scheduler_enabled}`,
    "Manual follow-up:",
    ...archive.manual_follow_up.map((item) => `- ${item}`),
  ].join("\n");
}
