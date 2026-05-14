import type { RuntimeSchedulerReleaseArchive } from "./video-orchestrator-runtime-scheduler-release-archive.js";

export type RuntimeSchedulerTerminalSummaryState = "manual_follow_up_required" | "blocked" | "revoked";

export interface RuntimeSchedulerTerminalSummaryInput {
  summary_id: string;
  operator_id: string;
  allow_summary_only: true;
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

export interface RuntimeSchedulerTerminalSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerTerminalSummaryState;
  summary_only: true;
  source_archive_state: RuntimeSchedulerReleaseArchive["archive_state"];
  source_commit_hint: string;
  manual_follow_up_count: number;
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
  final_boundary: string;
  validation: { complete: boolean; manual_follow_up_required: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerTerminalSummaryInput): boolean {
  return input.allow_summary_only === true
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
    && input.summary_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function archiveReady(archive: RuntimeSchedulerReleaseArchive): boolean {
  return archive.schema_version === "1.0"
    && archive.archive_state === "archived_for_manual_follow_up"
    && archive.archive_only
    && archive.validation.complete
    && archive.validation.archived_for_manual_follow_up
    && !archive.package_json_edited
    && !archive.live_scheduler_enabled
    && !archive.upload_execution_enabled
    && !archive.network_enabled
    && !archive.credential_access_enabled
    && !archive.media_read_enabled
    && !archive.file_write_enabled
    && !archive.git_add_executed
    && !archive.committed_now
    && !archive.pushed_now;
}

export function createRuntimeSchedulerTerminalSummary(input: RuntimeSchedulerTerminalSummaryInput, archive: RuntimeSchedulerReleaseArchive): RuntimeSchedulerTerminalSummary {
  const ready = inputReady(input) && archiveReady(archive);
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-terminal-summary"),
    summary_state: ready ? "manual_follow_up_required" : "blocked",
    summary_only: true,
    source_archive_state: archive.archive_state,
    source_commit_hint: safe(archive.source_commit_hint, "commit-not-recorded"),
    manual_follow_up_count: ready ? archive.manual_follow_up.length : 0,
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
    final_boundary: ready ? "Stop before package.json edits, persistent scheduler writes, live scheduler activation, uploads, network calls, credential access, or media reads." : "Resolve blocked archive or unsafe summary input before continuing.",
    validation: { complete: ready, manual_follow_up_required: ready, blocking_reasons: ready ? [] : ["Runtime scheduler terminal summary input or source archive was unsafe/incomplete."], warnings: ["Terminal summary only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerTerminalSummary(summary: RuntimeSchedulerTerminalSummary, reason?: string): RuntimeSchedulerTerminalSummary {
  return { ...summary, summary_state: "revoked", manual_follow_up_count: 0, validation: { complete: false, manual_follow_up_required: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Runtime scheduler terminal summary was revoked.")] } };
}

export function renderRuntimeSchedulerTerminalSummary(summary: RuntimeSchedulerTerminalSummary): string {
  return [
    "Video Orchestrator runtime scheduler terminal summary",
    `State: ${summary.summary_state}`,
    `Archive state: ${summary.source_archive_state}`,
    `Source commit hint: ${summary.source_commit_hint}`,
    `Manual follow-up count: ${summary.manual_follow_up_count}`,
    `package.json edited: ${summary.package_json_edited}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
    `Final boundary: ${summary.final_boundary}`,
  ].join("\n");
}
