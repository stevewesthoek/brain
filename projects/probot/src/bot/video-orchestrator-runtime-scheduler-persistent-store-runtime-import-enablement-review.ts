import type { RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-runtime-import-enablement-plan.js";

export type RuntimeSchedulerPersistentStoreRuntimeImportEnablementReviewState = "runtime_import_enablement_review_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreRuntimeImportEnablementReviewInput {
  review_id: string;
  operator_id: string;
  allow_review_only: true;
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

export interface RuntimeSchedulerPersistentStoreRuntimeImportEnablementReview {
  schema_version: "1.0";
  review_id: string;
  review_state: RuntimeSchedulerPersistentStoreRuntimeImportEnablementReviewState;
  review_only: true;
  source_plan_state: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan["plan_state"];
  adapter_interface_name: string;
  enablement_step_count: number;
  review_findings: string[];
  required_next_confirmation: string;
  implementation_boundary: string;
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
  validation: { complete: boolean; runtime_import_enablement_review_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreRuntimeImportEnablementReviewInput): boolean {
  return input.allow_review_only === true
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
    && input.review_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function planReady(plan: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "runtime_import_enablement_plan_ready"
    && plan.plan_only
    && plan.validation.complete
    && plan.validation.runtime_import_enablement_plan_ready
    && plan.enablement_steps.length > 0
    && plan.enablement_steps.every((step) => step.mode === "runtime_import_enablement_planning_only" && !step.runtime_imports_enabled && !step.file_modifications_enabled && !step.side_effects_enabled)
    && !plan.runtime_imports_enabled
    && !plan.file_write_enabled
    && !plan.database_write_enabled
    && !plan.live_scheduler_enabled
    && !plan.upload_execution_enabled
    && !plan.network_enabled
    && !plan.credential_access_enabled
    && !plan.media_read_enabled
    && !plan.git_add_executed
    && !plan.committed_now
    && !plan.pushed_now;
}

export function createRuntimeSchedulerPersistentStoreRuntimeImportEnablementReview(input: RuntimeSchedulerPersistentStoreRuntimeImportEnablementReviewInput, plan: RuntimeSchedulerPersistentStoreRuntimeImportEnablementPlan): RuntimeSchedulerPersistentStoreRuntimeImportEnablementReview {
  const ready = inputReady(input) && planReady(plan);
  return {
    schema_version: "1.0",
    review_id: safe(input.review_id, "runtime-scheduler-persistent-store-runtime-import-enablement-review"),
    review_state: ready ? "runtime_import_enablement_review_ready" : "blocked",
    review_only: true,
    source_plan_state: plan.plan_state,
    adapter_interface_name: safe(plan.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    enablement_step_count: ready ? plan.enablement_steps.length : 0,
    review_findings: ready ? [
      "Runtime import enablement plan remains documentation-only.",
      "Runtime imports, file modifications, and live scheduler execution remain disabled in the plan and in this review.",
      "Persistence, storage writes, platform dispatch, network, credentials, and media reads remain disabled.",
      "A future terminal handoff must preserve the separate explicit confirmation boundary before any runtime import enablement wiring.",
    ] : [],
    required_next_confirmation: ready ? "I approve runtime import enablement terminal handoff only, with no runtime imports, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Runtime import enablement review only; terminal handoff may summarize readiness, but runtime imports, file modifications, persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked runtime import enablement plan or unsafe review input before continuing.",
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
    validation: { complete: ready, runtime_import_enablement_review_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store runtime import enablement review input or plan was unsafe/incomplete."], warnings: ["Runtime import enablement review only; no runtime imports, file modifications, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreRuntimeImportEnablementReview(review: RuntimeSchedulerPersistentStoreRuntimeImportEnablementReview, reason?: string): RuntimeSchedulerPersistentStoreRuntimeImportEnablementReview {
  return { ...review, review_state: "revoked", enablement_step_count: 0, review_findings: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, runtime_import_enablement_review_ready: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler persistent-store runtime import enablement review was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreRuntimeImportEnablementReview(review: RuntimeSchedulerPersistentStoreRuntimeImportEnablementReview): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store runtime import enablement review",
    `State: ${review.review_state}`,
    `Adapter interface: ${review.adapter_interface_name}`,
    `Enablement step count: ${review.enablement_step_count}`,
    "Review findings:",
    ...(review.review_findings.length ? review.review_findings.map((item) => `- ${item}`) : ["- blocked"]),
    `Required next confirmation: ${review.required_next_confirmation}`,
    `Implementation boundary: ${review.implementation_boundary}`,
    `Runtime imports enabled: ${review.runtime_imports_enabled}`,
    `File writes enabled: ${review.file_write_enabled}`,
    `Database writes enabled: ${review.database_write_enabled}`,
    `Live scheduler enabled: ${review.live_scheduler_enabled}`,
  ].join("\n");
}
