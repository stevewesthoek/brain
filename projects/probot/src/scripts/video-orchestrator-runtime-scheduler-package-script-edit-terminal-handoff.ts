import type { RuntimeSchedulerPackageScriptEditDecisionSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-summary.js";

export type RuntimeSchedulerPackageScriptEditTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditTerminalHandoffInput {
  handoff_id: string;
  operator_id: string;
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

export interface RuntimeSchedulerPackageScriptEditTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPackageScriptEditTerminalHandoffState;
  handoff_only: true;
  source_summary_state: RuntimeSchedulerPackageScriptEditDecisionSummary["summary_state"];
  decision: RuntimeSchedulerPackageScriptEditDecisionSummary["decision"];
  package_json_path: string;
  allowed_future_change: string;
  final_boundary: string;
  required_confirmation: string;
  handoff_notes: string[];
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
  validation: { complete: boolean; terminal_handoff_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 520) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditTerminalHandoffInput): boolean {
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

function summaryReady(summary: RuntimeSchedulerPackageScriptEditDecisionSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "decision_summary_ready"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.decision_summary_ready
    && summary.package_json_path === "projects/probot/package.json"
    && summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && summary.allowed_future_change.includes("probot:video:runtime-scheduler")
    && summary.summary_items.length > 0
    && !summary.package_json_edited
    && !summary.live_scheduler_enabled
    && !summary.upload_execution_enabled
    && !summary.network_enabled
    && !summary.credential_access_enabled
    && !summary.media_read_enabled
    && !summary.file_write_enabled
    && !summary.git_add_executed
    && !summary.committed_now
    && !summary.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditTerminalHandoff(input: RuntimeSchedulerPackageScriptEditTerminalHandoffInput, summary: RuntimeSchedulerPackageScriptEditDecisionSummary): RuntimeSchedulerPackageScriptEditTerminalHandoff {
  const ready = inputReady(input) && summaryReady(summary);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-package-script-edit-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_summary_state: summary.summary_state,
    decision: summary.decision,
    package_json_path: safe(summary.package_json_path, "projects/probot/package.json"),
    allowed_future_change: ready ? summary.allowed_future_change : "none",
    final_boundary: ready ? summary.final_boundary : "Resolve blocked decision summary or unsafe terminal handoff input before continuing.",
    required_confirmation: ready ? summary.required_confirmation : "No confirmation available while blocked.",
    handoff_notes: ready ? [
      "This terminal handoff performs no package.json edit.",
      "The next executable step must be separately approved and scoped to one scripts entry only.",
      "Live scheduler activation, uploads, network calls, credential access, media reads, persistent writes, commits, and pushes remain disabled here.",
    ] : [],
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
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Package script edit terminal handoff input or decision summary was unsafe/incomplete."], warnings: ["Terminal handoff only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditTerminalHandoff(handoff: RuntimeSchedulerPackageScriptEditTerminalHandoff, reason?: string): RuntimeSchedulerPackageScriptEditTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", allowed_future_change: "none", required_confirmation: "No confirmation available while revoked.", handoff_notes: [], validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Package script edit terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditTerminalHandoff(handoff: RuntimeSchedulerPackageScriptEditTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler package script edit terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Decision: ${handoff.decision}`,
    `Path: ${handoff.package_json_path}`,
    `Allowed future change: ${handoff.allowed_future_change}`,
    `Final boundary: ${handoff.final_boundary}`,
    "Handoff notes:",
    ...(handoff.handoff_notes.length ? handoff.handoff_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `package.json edited: ${handoff.package_json_edited}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
    `Committed now: ${handoff.committed_now}`,
    `Pushed now: ${handoff.pushed_now}`,
  ].join("\n");
}
