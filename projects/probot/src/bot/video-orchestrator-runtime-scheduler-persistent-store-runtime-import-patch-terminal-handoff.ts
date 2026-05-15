import type { RuntimeSchedulerPersistentStoreRuntimeImportPatchReview } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-patch-review.js";

export type RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoffInput {
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

export interface RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoffState;
  handoff_only: true;
  source_review_state: RuntimeSchedulerPersistentStoreRuntimeImportPatchReview["review_state"];
  adapter_interface_name: string;
  patch_step_count: number;
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

function inputReady(input: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoffInput): boolean {
  return input.allow_handoff_only === true && input.allow_runtime_imports === false && input.allow_file_write === false && input.allow_database_write === false && input.allow_live_scheduler === false && input.allow_upload_execution === false && input.allow_network === false && input.allow_credential_access === false && input.allow_media_read === false && input.allow_git_add === false && input.allow_commit === false && input.allow_push === false && input.handoff_id.trim().length > 0 && input.operator_id.trim().length > 0;
}

function reviewReady(review: RuntimeSchedulerPersistentStoreRuntimeImportPatchReview): boolean {
  return review.schema_version === "1.0" && review.review_state === "runtime_import_patch_review_ready" && review.review_only && review.validation.complete && review.validation.runtime_import_patch_review_ready && review.patch_step_count > 0 && review.review_findings.length > 0 && !review.runtime_imports_enabled && !review.file_write_enabled && !review.database_write_enabled && !review.live_scheduler_enabled && !review.upload_execution_enabled && !review.network_enabled && !review.credential_access_enabled && !review.media_read_enabled && !review.git_add_executed && !review.committed_now && !review.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff(input: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoffInput, review: RuntimeSchedulerPersistentStoreRuntimeImportPatchReview): RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff {
  const ready = inputReady(input) && reviewReady(review);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-persistent-store-runtime-import-patch-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_review_state: review.review_state,
    adapter_interface_name: safe(review.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    patch_step_count: ready ? review.patch_step_count : 0,
    terminal_notes: ready ? [
      "Runtime import patch review has reached terminal handoff readiness.",
      "Runtime imports and file modifications are still disabled.",
      "Persistence, storage writes, live scheduler execution, platform dispatch, network, credentials, and media reads remain disabled.",
      "Future runtime import patch application requires a separate explicit operator decision.",
    ] : [],
    required_operator_decision: ready ? "Approve, defer, or reject future runtime import patch application in a separate explicit step." : "No operator decision available while blocked.",
    terminal_boundary: ready ? "Terminal handoff only; runtime imports, file modifications, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked runtime import patch review or unsafe terminal handoff input before continuing.",
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
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store runtime import patch terminal handoff input or review was unsafe/incomplete."], warnings: ["Terminal handoff only; no runtime imports, file modifications, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff, reason?: string): RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", patch_step_count: 0, terminal_notes: [], required_operator_decision: "No operator decision available while revoked.", validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler persistent-store runtime import patch terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff(handoff: RuntimeSchedulerPersistentStoreRuntimeImportPatchTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store runtime import patch terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Adapter interface: ${handoff.adapter_interface_name}`,
    `Patch step count: ${handoff.patch_step_count}`,
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
