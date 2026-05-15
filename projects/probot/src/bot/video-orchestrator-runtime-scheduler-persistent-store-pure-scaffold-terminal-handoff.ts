import type { RuntimeSchedulerPersistentStorePureScaffoldReview } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-review.js";

export type RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoffState = "terminal_handoff_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoffInput {
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

export interface RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff {
  schema_version: "1.0";
  handoff_id: string;
  handoff_state: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoffState;
  handoff_only: true;
  source_review_state: RuntimeSchedulerPersistentStorePureScaffoldReview["review_state"];
  adapter_interface_name: string;
  supported_operation_count: number;
  scaffold_export_count: number;
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

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoffInput): boolean {
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

function reviewReady(review: RuntimeSchedulerPersistentStorePureScaffoldReview): boolean {
  return review.schema_version === "1.0"
    && review.review_state === "pure_scaffold_review_ready"
    && review.review_only
    && review.validation.complete
    && review.validation.pure_scaffold_review_ready
    && review.supported_operation_count >= 6
    && review.scaffold_export_count >= 4
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

export function createRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(input: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoffInput, review: RuntimeSchedulerPersistentStorePureScaffoldReview): RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff {
  const ready = inputReady(input) && reviewReady(review);
  return {
    schema_version: "1.0",
    handoff_id: safe(input.handoff_id, "runtime-scheduler-persistent-store-pure-scaffold-terminal-handoff"),
    handoff_state: ready ? "terminal_handoff_ready" : "blocked",
    handoff_only: true,
    source_review_state: review.review_state,
    adapter_interface_name: safe(review.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    supported_operation_count: ready ? review.supported_operation_count : 0,
    scaffold_export_count: ready ? review.scaffold_export_count : 0,
    terminal_notes: ready ? [
      "Pure scaffold review has reached terminal handoff readiness.",
      "The scaffold remains pure and has not persisted scheduler queue state.",
      "Integration planning still requires a separate explicit operator decision.",
      "Live scheduler activation and platform dispatch remain disabled by this handoff.",
    ] : [],
    required_operator_decision: ready ? "Approve, defer, or reject future pure scaffold integration planning in a separate explicit step." : "No operator decision available while blocked.",
    terminal_boundary: ready ? "Terminal handoff only; executable persistence, storage writes, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked pure scaffold review or unsafe terminal handoff input before continuing.",
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
    validation: { complete: ready, terminal_handoff_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold terminal handoff input or review was unsafe/incomplete."], warnings: ["Terminal handoff only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(handoff: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff {
  return { ...handoff, handoff_state: "revoked", supported_operation_count: 0, scaffold_export_count: 0, terminal_notes: [], required_operator_decision: "No operator decision available while revoked.", validation: { complete: false, terminal_handoff_ready: false, blocking_reasons: handoff.validation.blocking_reasons, warnings: [...handoff.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold terminal handoff was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff(handoff: RuntimeSchedulerPersistentStorePureScaffoldTerminalHandoff): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold terminal handoff",
    `State: ${handoff.handoff_state}`,
    `Adapter interface: ${handoff.adapter_interface_name}`,
    `Supported operation count: ${handoff.supported_operation_count}`,
    `Scaffold export count: ${handoff.scaffold_export_count}`,
    "Terminal notes:",
    ...(handoff.terminal_notes.length ? handoff.terminal_notes.map((item) => `- ${item}`) : ["- blocked"]),
    `Required operator decision: ${handoff.required_operator_decision}`,
    `Terminal boundary: ${handoff.terminal_boundary}`,
    `File writes enabled: ${handoff.file_write_enabled}`,
    `Database writes enabled: ${handoff.database_write_enabled}`,
    `Live scheduler enabled: ${handoff.live_scheduler_enabled}`,
  ].join("\n");
}
