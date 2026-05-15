import type { RuntimeSchedulerPersistentStoreDecisionCloseout } from "./video-orchestrator-runtime-scheduler-persistent-store-decision-closeout.js";

export type RuntimeSchedulerPersistentStoreImplementationDesignState = "implementation_design_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreImplementationDesignInput {
  design_id: string;
  operator_id: string;
  adapter_interface_name: string;
  allow_design_only: true;
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

export interface RuntimeSchedulerPersistentStoreImplementationDesign {
  schema_version: "1.0";
  design_id: string;
  design_state: RuntimeSchedulerPersistentStoreImplementationDesignState;
  design_only: true;
  source_closeout_state: RuntimeSchedulerPersistentStoreDecisionCloseout["closeout_state"];
  source_decision: RuntimeSchedulerPersistentStoreDecisionCloseout["decision"];
  adapter_interface_name: string;
  store_kind: RuntimeSchedulerPersistentStoreDecisionCloseout["store_kind"];
  store_reference: string;
  operation_count: number;
  design_sections: string[];
  explicit_non_goals: string[];
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
  validation: { complete: boolean; implementation_design_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreImplementationDesignInput): boolean {
  return input.allow_design_only === true
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
    && input.design_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.adapter_interface_name.trim().length > 0;
}

function closeoutReady(closeout: RuntimeSchedulerPersistentStoreDecisionCloseout): boolean {
  return closeout.schema_version === "1.0"
    && closeout.closeout_state === "decision_closeout_ready"
    && closeout.closeout_only
    && closeout.validation.complete
    && closeout.validation.decision_closeout_ready
    && closeout.decision === "approve_future_implementation_planning"
    && closeout.operation_count > 0
    && closeout.allowed_future_scope_count > 0
    && closeout.closeout_items.length > 0
    && !closeout.file_write_enabled
    && !closeout.database_write_enabled
    && !closeout.live_scheduler_enabled
    && !closeout.upload_execution_enabled
    && !closeout.network_enabled
    && !closeout.credential_access_enabled
    && !closeout.media_read_enabled
    && !closeout.git_add_executed
    && !closeout.committed_now
    && !closeout.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreImplementationDesign(input: RuntimeSchedulerPersistentStoreImplementationDesignInput, closeout: RuntimeSchedulerPersistentStoreDecisionCloseout): RuntimeSchedulerPersistentStoreImplementationDesign {
  const ready = inputReady(input) && closeoutReady(closeout);
  return {
    schema_version: "1.0",
    design_id: safe(input.design_id, "runtime-scheduler-persistent-store-implementation-design"),
    design_state: ready ? "implementation_design_ready" : "blocked",
    design_only: true,
    source_closeout_state: closeout.closeout_state,
    source_decision: closeout.decision,
    adapter_interface_name: safe(input.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    store_kind: closeout.store_kind,
    store_reference: safe(closeout.store_reference, "blocked-reference"),
    operation_count: ready ? closeout.operation_count : 0,
    design_sections: ready ? [
      "Adapter contract boundaries for queue load, save, event append, published marking, failed marking, and due-item listing.",
      "Validation boundary that checks snapshot shape before any future persistence operation is approved.",
      "Idempotency boundary that keeps published and failed state transitions deterministic.",
      "Dry-run snapshot boundary that can be reviewed without touching storage.",
    ] : [],
    explicit_non_goals: [
      "No file or database writes are enabled by this design packet.",
      "No live scheduler activation is enabled by this design packet.",
      "No platform dispatch, network call, credential access, media read, staging, commit, or push is enabled by this design packet.",
    ],
    required_next_confirmation: ready ? "I approve implementation scaffold planning only for the persistent scheduler store adapter, with no file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Implementation design only; a future scaffold may define types and pure functions, but persistence writes, migrations, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked decision closeout or unsafe implementation design input before continuing.",
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
    validation: { complete: ready, implementation_design_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store implementation design input or decision closeout was unsafe/incomplete."], warnings: ["Implementation design only; no persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreImplementationDesign(design: RuntimeSchedulerPersistentStoreImplementationDesign, reason?: string): RuntimeSchedulerPersistentStoreImplementationDesign {
  return { ...design, design_state: "revoked", operation_count: 0, design_sections: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, implementation_design_ready: false, blocking_reasons: design.validation.blocking_reasons, warnings: [...design.validation.warnings, safe(reason, "Runtime scheduler persistent-store implementation design was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreImplementationDesign(design: RuntimeSchedulerPersistentStoreImplementationDesign): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store implementation design",
    `State: ${design.design_state}`,
    `Source decision: ${design.source_decision}`,
    `Adapter interface: ${design.adapter_interface_name}`,
    `Store kind: ${design.store_kind}`,
    `Store reference: ${design.store_reference}`,
    `Operation count: ${design.operation_count}`,
    "Design sections:",
    ...(design.design_sections.length ? design.design_sections.map((item) => `- ${item}`) : ["- blocked"]),
    "Explicit non-goals:",
    ...design.explicit_non_goals.map((item) => `- ${item}`),
    `Required next confirmation: ${design.required_next_confirmation}`,
    `Implementation boundary: ${design.implementation_boundary}`,
    `File writes enabled: ${design.file_write_enabled}`,
    `Database writes enabled: ${design.database_write_enabled}`,
    `Live scheduler enabled: ${design.live_scheduler_enabled}`,
  ].join("\n");
}
