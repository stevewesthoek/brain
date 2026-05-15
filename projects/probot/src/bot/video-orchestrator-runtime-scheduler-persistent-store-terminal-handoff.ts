import type { RuntimeSchedulerPersistentStoreReviewSummary } from "./video-orchestrator-runtime-scheduler-persistent-store-review-summary.js";

export type RuntimeSchedulerPersistentStoreTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreTerminalHandoffInput {
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

export interface RuntimeSchedulerPersistentStoreTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPersistentStoreTerminalHandoffState;
  handoff_only: true;
  source_summary_state: RuntimeSchedulerPersistentStoreReviewSummary["summary_state"];
  fixture_id: string;
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreReviewSummary["store_kind"];
  store_reference: string;
  operation_count: number;
  passed_check_count: number;
  required_operator_decision: string;
  terminal_boundary: string;
  handoff_notes: string[];
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

function inputReady(input: RuntimeSchedulerPersistentStoreTerminalHandoffInput): boolean {
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

function summaryReady(summary: RuntimeSchedulerPersistentStoreReviewSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "review_summary_ready"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.review_summary_ready
    && summary.operation_count > 0
    && summary.passed_check_count >= summary.operation_count
    && summary.blocked_check_count === 0
    && summary.review_items.length > 0
    && !summary.file_write_enabled
    && !summary.database_write_enabled
    && !summary.live_scheduler_enabled
    && !summary.upload_execution_enabled
    && !summary.network_enabled
    && !summary.credential_access_enabled
    && !summary.media_read_enabled
    && !summary.git_add_executed
    && !summary.committed_now
    && !summary.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreTerminalHandoff(input: RuntimeSchedulerPersistentStoreTerminalHandoffInput, summary: RuntimeSchedulerPersistentStoreReviewSummary): RuntimeSchedulerPersistentStoreTerminalHandoff {
  const ready = inputReady(input) && summaryReady(summary);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-persistent-store-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_summary_state: summary.summary_state,
    fixture_id: safe(summary.fixture_id, "runtime-scheduler-persistent-store-fixture"),
    adapter_name: safe(summary.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: summary.store_kind,
    store_reference: safe(summary.store_reference, "blocked-reference"),
    operation_count: ready ? summary.operation_count : 0,
    passed_check_count: ready ? summary.passed_check_count : 0,
    required_operator_decision: ready ? "Approve, defer, or reject future persistent scheduler store implementation in a separate explicit step." : "No operator decision available while blocked.",
    terminal_boundary: ready ? "Terminal handoff only; actual persistent-store implementation, migrations, file or database writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked review summary or unsafe terminal handoff input before continuing.",
    handoff_notes: ready ? [
      "Persistent-store planning has reached terminal handoff readiness.",
      "The reviewed adapter chain remains descriptor-only and has not persisted scheduler queue state.",
      "Future implementation must be separately approved before any file or database write path is enabled.",
      "Live scheduler activation and platform dispatch remain disabled by this handoff.",
    ] : [],
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
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store terminal handoff input or review summary was unsafe/incomplete."], warnings: ["Terminal handoff only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreTerminalHandoff, reason?: string): RuntimeSchedulerPersistentStoreTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", operation_count: 0, passed_check_count: 0, required_operator_decision: "No operator decision available while revoked.", handoff_notes: [], validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler persistent-store terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Fixture: ${handoff.fixture_id}`,
    `Adapter: ${handoff.adapter_name}`,
    `Store kind: ${handoff.store_kind}`,
    `Store reference: ${handoff.store_reference}`,
    `Operation count: ${handoff.operation_count}`,
    `Passed checks: ${handoff.passed_check_count}`,
    `Required operator decision: ${handoff.required_operator_decision}`,
    `Terminal boundary: ${handoff.terminal_boundary}`,
    "Handoff notes:",
    ...(handoff.handoff_notes.length ? handoff.handoff_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `File writes enabled: ${handoff.file_write_enabled}`,
    `Database writes enabled: ${handoff.database_write_enabled}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
  ].join("\n");
}
