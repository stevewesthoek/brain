import type { RuntimeSchedulerPersistentStoreValidationPacket } from "./video-orchestrator-runtime-scheduler-persistent-store-validation.js";

export type RuntimeSchedulerPersistentStoreReviewSummaryState = "review_summary_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreReviewSummaryInput {
  summary_id: string;
  operator_id: string;
  allow_summary_only: true;
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

export interface RuntimeSchedulerPersistentStoreReviewSummary {
  schema_version: "1.0";
  summary_id: string;
  summary_state: RuntimeSchedulerPersistentStoreReviewSummaryState;
  summary_only: true;
  source_validation_state: RuntimeSchedulerPersistentStoreValidationPacket["validation_state"];
  fixture_id: string;
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreValidationPacket["store_kind"];
  store_reference: string;
  operation_count: number;
  passed_check_count: number;
  blocked_check_count: number;
  review_items: string[];
  required_next_confirmation: string;
  implementation_boundary: string;
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
  validation: { complete: boolean; review_summary_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreReviewSummaryInput): boolean {
  return input.allow_summary_only === true
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
    && input.summary_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function packetReady(packet: RuntimeSchedulerPersistentStoreValidationPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.validation_state === "validation_ready_for_review"
    && packet.validation_only
    && packet.validation.complete
    && packet.validation.validation_ready_for_review
    && packet.operation_count > 0
    && packet.checks.length >= packet.operation_count
    && packet.checks.every((check) => check.status === "passed")
    && !packet.file_write_enabled
    && !packet.database_write_enabled
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreReviewSummary(input: RuntimeSchedulerPersistentStoreReviewSummaryInput, packet: RuntimeSchedulerPersistentStoreValidationPacket): RuntimeSchedulerPersistentStoreReviewSummary {
  const ready = inputReady(input) && packetReady(packet);
  const passedCheckCount = ready ? packet.checks.filter((check) => check.status === "passed").length : 0;
  const blockedCheckCount = ready ? packet.checks.filter((check) => check.status === "blocked").length : packet.checks.length;
  return {
    schema_version: "1.0",
    summary_id: safe(input.summary_id, "runtime-scheduler-persistent-store-review-summary"),
    summary_state: ready ? "review_summary_ready" : "blocked",
    summary_only: true,
    source_validation_state: packet.validation_state,
    fixture_id: safe(packet.fixture_id, "runtime-scheduler-persistent-store-fixture"),
    adapter_name: safe(packet.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: packet.store_kind,
    store_reference: safe(packet.store_reference, "blocked-reference"),
    operation_count: ready ? packet.operation_count : 0,
    passed_check_count: passedCheckCount,
    blocked_check_count: blockedCheckCount,
    review_items: ready ? [
      "Persistent-store planning chain is complete through validation review.",
      "The adapter remains descriptor-only and has not performed file or database writes.",
      "A future executable adapter implementation still requires separate explicit confirmation.",
      "Live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, and pushes remain disabled here.",
    ] : [],
    required_next_confirmation: ready ? "I approve persistent scheduler store implementation design review only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Review summary only; actual persistent-store implementation, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked validation packet or unsafe review summary input before continuing.",
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
    validation: { complete: ready, review_summary_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store review summary input or validation packet was unsafe/incomplete."], warnings: ["Review summary only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreReviewSummary(summary: RuntimeSchedulerPersistentStoreReviewSummary, reason?: string): RuntimeSchedulerPersistentStoreReviewSummary {
  return { ...summary, summary_state: "revoked", operation_count: 0, passed_check_count: 0, blocked_check_count: 0, review_items: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, review_summary_ready: false, blocking_reasons: summary.validation.blocking_reasons, warnings: [...summary.validation.warnings, safe(reason, "Runtime scheduler persistent-store review summary was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreReviewSummary(summary: RuntimeSchedulerPersistentStoreReviewSummary): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store review summary",
    `State: ${summary.summary_state}`,
    `Fixture: ${summary.fixture_id}`,
    `Adapter: ${summary.adapter_name}`,
    `Store kind: ${summary.store_kind}`,
    `Store reference: ${summary.store_reference}`,
    `Operation count: ${summary.operation_count}`,
    `Passed checks: ${summary.passed_check_count}`,
    `Blocked checks: ${summary.blocked_check_count}`,
    "Review items:",
    ...(summary.review_items.length ? summary.review_items.map((item) => `- ${item}`) : ["- blocked"]),
    `Required next confirmation: ${summary.required_next_confirmation}`,
    `Implementation boundary: ${summary.implementation_boundary}`,
    `File writes enabled: ${summary.file_write_enabled}`,
    `Database writes enabled: ${summary.database_write_enabled}`,
    `Live scheduler enabled: ${summary.live_scheduler_enabled}`,
  ].join("\n");
}
