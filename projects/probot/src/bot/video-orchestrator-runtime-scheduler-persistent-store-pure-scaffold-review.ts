import type { RuntimeSchedulerPersistentStorePureScaffold } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold.js";

export type RuntimeSchedulerPersistentStorePureScaffoldReviewState = "pure_scaffold_review_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStorePureScaffoldReviewInput {
  review_id: string;
  operator_id: string;
  allow_review_only: true;
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

export interface RuntimeSchedulerPersistentStorePureScaffoldReview {
  schema_version: "1.0";
  review_id: string;
  review_state: RuntimeSchedulerPersistentStorePureScaffoldReviewState;
  review_only: true;
  source_scaffold_state: RuntimeSchedulerPersistentStorePureScaffold["scaffold_state"];
  adapter_interface_name: string;
  supported_operation_count: number;
  scaffold_export_count: number;
  review_findings: string[];
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
  validation: { complete: boolean; pure_scaffold_review_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldReviewInput): boolean {
  return input.allow_review_only === true
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
    && input.review_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function scaffoldReady(scaffold: RuntimeSchedulerPersistentStorePureScaffold): boolean {
  return scaffold.schema_version === "1.0"
    && scaffold.scaffold_state === "pure_scaffold_ready"
    && scaffold.pure_scaffold_only
    && scaffold.validation.complete
    && scaffold.validation.pure_scaffold_ready
    && scaffold.supported_operations.length >= 6
    && scaffold.scaffold_exports.length >= 4
    && !scaffold.file_write_enabled
    && !scaffold.database_write_enabled
    && !scaffold.live_scheduler_enabled
    && !scaffold.upload_execution_enabled
    && !scaffold.network_enabled
    && !scaffold.credential_access_enabled
    && !scaffold.media_read_enabled
    && !scaffold.git_add_executed
    && !scaffold.committed_now
    && !scaffold.pushed_now;
}

export function createRuntimeSchedulerPersistentStorePureScaffoldReview(input: RuntimeSchedulerPersistentStorePureScaffoldReviewInput, scaffold: RuntimeSchedulerPersistentStorePureScaffold): RuntimeSchedulerPersistentStorePureScaffoldReview {
  const ready = inputReady(input) && scaffoldReady(scaffold);
  return {
    schema_version: "1.0",
    review_id: safe(input.review_id, "runtime-scheduler-persistent-store-pure-scaffold-review"),
    review_state: ready ? "pure_scaffold_review_ready" : "blocked",
    review_only: true,
    source_scaffold_state: scaffold.scaffold_state,
    adapter_interface_name: safe(scaffold.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    supported_operation_count: ready ? scaffold.supported_operations.length : 0,
    scaffold_export_count: ready ? scaffold.scaffold_exports.length : 0,
    review_findings: ready ? [
      "Pure scaffold exposes required scheduler queue operation descriptors.",
      "Pure scaffold exposes snapshot validation and state transition helpers.",
      "Pure scaffold does not persist queue state or read runtime media.",
      "Pure scaffold remains outside live scheduler execution and platform dispatch.",
    ] : [],
    required_next_confirmation: ready ? "I approve pure scaffold integration planning only, with no file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Pure scaffold review only; integration planning may describe call sites, but executable persistence, storage writes, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked pure scaffold or unsafe review input before continuing.",
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
    validation: { complete: ready, pure_scaffold_review_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold review input or scaffold was unsafe/incomplete."], warnings: ["Pure scaffold review only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldReview(review: RuntimeSchedulerPersistentStorePureScaffoldReview, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldReview {
  return { ...review, review_state: "revoked", supported_operation_count: 0, scaffold_export_count: 0, review_findings: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, pure_scaffold_review_ready: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold review was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldReview(review: RuntimeSchedulerPersistentStorePureScaffoldReview): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold review",
    `State: ${review.review_state}`,
    `Adapter interface: ${review.adapter_interface_name}`,
    `Supported operation count: ${review.supported_operation_count}`,
    `Scaffold export count: ${review.scaffold_export_count}`,
    "Review findings:",
    ...(review.review_findings.length ? review.review_findings.map((item) => `- ${item}`) : ["- blocked"]),
    `Required next confirmation: ${review.required_next_confirmation}`,
    `Implementation boundary: ${review.implementation_boundary}`,
    `File writes enabled: ${review.file_write_enabled}`,
    `Database writes enabled: ${review.database_write_enabled}`,
    `Live scheduler enabled: ${review.live_scheduler_enabled}`,
  ].join("\n");
}
