import type { RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan } from "./video-orchestrator-runtime-scheduler-persistent-store-pure-scaffold-integration-plan.js";

export type RuntimeSchedulerPersistentStorePureScaffoldIntegrationReviewState = "integration_review_ready" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationReviewInput {
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

export interface RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview {
  schema_version: "1.0";
  review_id: string;
  review_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReviewState;
  review_only: true;
  source_plan_state: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan["plan_state"];
  adapter_interface_name: string;
  integration_step_count: number;
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
  validation: { complete: boolean; integration_review_ready: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 260) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReviewInput): boolean {
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

function planReady(plan: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan): boolean {
  return plan.schema_version === "1.0"
    && plan.plan_state === "integration_plan_ready"
    && plan.integration_plan_only
    && plan.validation.complete
    && plan.validation.integration_plan_ready
    && plan.integration_steps.length > 0
    && plan.integration_steps.every((step) => step.integration_mode === "planning_only" && !step.side_effects_enabled)
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

export function createRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(input: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReviewInput, plan: RuntimeSchedulerPersistentStorePureScaffoldIntegrationPlan): RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview {
  const ready = inputReady(input) && planReady(plan);
  return {
    schema_version: "1.0",
    review_id: safe(input.review_id, "runtime-scheduler-persistent-store-pure-scaffold-integration-review"),
    review_state: ready ? "integration_review_ready" : "blocked",
    review_only: true,
    source_plan_state: plan.plan_state,
    adapter_interface_name: safe(plan.adapter_interface_name, "RuntimeSchedulerPersistentStoreAdapter"),
    integration_step_count: ready ? plan.integration_steps.length : 0,
    review_findings: ready ? [
      "Integration plan is documentation-only and does not import pure scaffold helpers into live paths.",
      "Integration plan preserves storage-write and database-write boundaries.",
      "Integration plan keeps live scheduler execution and platform dispatch disabled.",
      "Integration plan requires a separate explicit boundary before executable call-site wiring.",
    ] : [],
    required_next_confirmation: ready ? "I approve pure scaffold integration terminal handoff only, with no live path imports, file writes, database writes, live scheduler activation, platform dispatch, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Integration review only; terminal handoff may summarize readiness, but executable persistence, storage writes, live scheduling, platform dispatch, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked integration plan or unsafe review input before continuing.",
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
    validation: { complete: ready, integration_review_ready: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store pure scaffold integration review input or plan was unsafe/incomplete."], warnings: ["Integration review only; no live path imports, persistent writes, database writes, live scheduling, platform dispatch, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(review: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview, reason?: string): RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview {
  return { ...review, review_state: "revoked", integration_step_count: 0, review_findings: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, integration_review_ready: false, blocking_reasons: review.validation.blocking_reasons, warnings: [...review.validation.warnings, safe(reason, "Runtime scheduler persistent-store pure scaffold integration review was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStorePureScaffoldIntegrationReview(review: RuntimeSchedulerPersistentStorePureScaffoldIntegrationReview): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store pure scaffold integration review",
    `State: ${review.review_state}`,
    `Adapter interface: ${review.adapter_interface_name}`,
    `Integration step count: ${review.integration_step_count}`,
    "Review findings:",
    ...(review.review_findings.length ? review.review_findings.map((item) => `- ${item}`) : ["- blocked"]),
    `Required next confirmation: ${review.required_next_confirmation}`,
    `Implementation boundary: ${review.implementation_boundary}`,
    `File writes enabled: ${review.file_write_enabled}`,
    `Database writes enabled: ${review.database_write_enabled}`,
    `Live scheduler enabled: ${review.live_scheduler_enabled}`,
  ].join("\n");
}
