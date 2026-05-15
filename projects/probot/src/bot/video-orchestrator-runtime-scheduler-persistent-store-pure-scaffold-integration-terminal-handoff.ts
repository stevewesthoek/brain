import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-review.js";

export type RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoffInput {
  handoff_id: string;
  operator_id: string;
  allow_handoff_only: true;
  allow_file_write: false;
  allow_database_write: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoffState;
  handoff_only: true;
  source_review_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview["review_state"];
  adapter_interface_name: string;
  integration_step_count: number;
  terminal_notes: string[];
  required_operator_decision: string;
  terminal_boundary: string;
  file_write_enabled: false;
  database_write_enabled: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; terminal_handoff_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoffInput): boolean {
  return input.allow_handoff_only === true
    && input.allow_file_write === false
    && input.allow_database_write === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.handoff_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function reviewReady(review: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview): boolean {
  return review.schema_version === "1.0"
    && review.review_state === "integration_review_ready"
    && review.review_only
    && review.validation.complete
    && review.validation.integration_review_ready
    && review.integration_step_count > 0
    && review.review_findings.length > 0
    && !review.file_write_enabled
    && !review.database_write_enabled
    && !review.live_scheduler_enabled
    && !review.upload_execution_enabled
    && !review.network_enabled
    && !review.credential_access_enabled
    && !review.media_read_enabled
    && !review.git_add_executed
    && !review.committed_now
    && !review.pushed_now;
}

export function createRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoffInput, review: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview): RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff {
  const ready = inputReady(input) && reviewReady(review);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-persistent-store-pure-scaffold-integration-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_review_state: review.review_state,
    adapter_interface_name: safe(review.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    integration_step_count: ready ? review.integration_step_count : 0,
    terminal_notes: ready ? [
      "Pure scaffold integration review has reached terminal handoff readiness.",
      "Integration remains documentation-only and does not import helpers into live runtime paths.",
      "Future executable call-site wiring still requires a separate explicit operator decision.",
      "Storage writes, live scheduling, platform dispatch, network, credentials, and media reads remain disabled.",
    ] : [],
    required_operator_decision: ready ? "Approve, defer, or reject future executable pure scaffold integration in a separate explicit step." : "No operator decision available while blocked.",
    terminal_boundary: ready ? "Terminal handoff only; executable integration, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked integration review or unsafe terminal handoff input before continuing.",
    file_write_enabled: false,
    database_write_enabled: false,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold integration terminal handoff input or review was unsafe/incomplete."], warnings: ["Terminal handoff only; no executable integration, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(handoff: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", integration_step_count: 0, terminal_notes: [], required_operator_decision: "No operator decision available while revoked.", validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold integration terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff(handoff: RuntimeSchedulerPersistentStorePureScaffoldIntegrationTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold integration terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Adapter interface: ${handoff.adapter_interface_name}`,
    `Integration step count: ${handoff.integration_step_count}`,
    "Terminal notes:",
    ...(handoff.terminal_notes.length ? handoff.terminal_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `Required operator decision: ${handoff.required_operator_decision}`,
    `Terminal boundary: ${handoff.terminal_boundary}`,
    `File writes enabled: ${handoff.file_write_enabled}`,
    `Database writes enabled: ${handoff.database_write_enabled}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
  ].join("\n");
}
