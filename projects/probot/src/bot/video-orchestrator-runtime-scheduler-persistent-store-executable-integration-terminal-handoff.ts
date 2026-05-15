import type { RuntimeSchedulerPersistentStoreExecutableIntegrationReview } from "./video-orchestrator-runtime-scheduler-persistent-store-executable-integration-review.js";

export type RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoffInput {
  handoff_id: string;
  operator_id: string;
  allow_handoff_only: true;
  allow_runtime_imports: false;
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

export interface RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoffState;
  handoff_only: true;
  source_review_state: RuntimeSchedulerPersistentStoreExecutableIntegrationReview["review_state"];
  adapter_interface_name: string;
  plan_step_count: number;
  terminal_notes: string[];
  required_operator_decision: string;
  terminal_boundary: string;
  runtime_imports_enabled: false;
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

function inputReady(input: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoffInput): boolean {
  return input.allow_handoff_only === true
    && input.allow_runtime_imports === false
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

function reviewReady(review: RuntimeSchedulerPersistentStoreExecutableIntegrationReview): boolean {
  return review.schema_version === "1.0"
    && review.review_state === "executable_integration_review_ready"
    && review.review_only
    && review.validation.complete
    && review.validation.executable_integration_review_ready
    && review.plan_step_count > 0
    && review.review_findings.length > 0
    && !review.runtime_imports_enabled
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

export function createRuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff(input: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoffInput, review: RuntimeSchedulerPersistentStoreExecutableIntegrationReview): RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff {
  const ready = inputReady(input) && reviewReady(review);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-persistent-store-executable-integration-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_review_state: review.review_state,
    adapter_interface_name: safe(review.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    plan_step_count: ready ? review.plan_step_count : 0,
    terminal_notes: ready ? [
      "Executable integration review has reached terminal handoff readiness.",
      "Runtime imports are still disabled and no live runtime path was wired.",
      "Storage writes, scheduler execution, platform dispatch, network, credentials, and media reads remain disabled.",
      "Future executable integration implementation requires separate explicit confirmation.",
    ] : [],
    required_operator_decision: ready ? "Approve, defer, or reject future executable integration implementation in a separate explicit step." : "No operator decision available while blocked.",
    terminal_boundary: ready ? "Terminal handoff only; runtime imports, executable integration, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked executable integration review or unsafe terminal handoff input before continuing.",
    runtime_imports_enabled: false,
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
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store executable integration terminal handoff input or review was unsafe/incomplete."], warnings: ["Terminal handoff only; no runtime imports, executable integration, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff, reason?: string): RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", plan_step_count: 0, terminal_notes: [], required_operator_decision: "No operator decision available while revoked.", validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler persistent-store executable integration terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreExecutableIntegrationTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store executable integration terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Adapter interface: ${handoff.adapter_interface_name}`,
    `Plan step count: ${handoff.plan_step_count}`,
    "Terminal notes:",
    ...(handoff.terminal_notes.length ? handoff.terminal_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `Required operator decision: ${handoff.required_operator_decision}`,
    `Terminal boundary: ${handoff.terminal_boundary}`,
    `Runtime imports enabled: ${handoff.runtime_imports_enabled}`,
    `File writes enabled: ${handoff.file_write_enabled}`,
    `Database writes enabled: ${handoff.database_write_enabled}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
  ].join("\n");
}
