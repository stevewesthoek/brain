import type { RuntimeSchedulerPersistentStoreAdapterSkeleton } from "./video-orchestrator-runtime-scheduler-persistent-store-adapter-skeleton.js";
import type { RuntimeSchedulerPersistentStoreOperation } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

export type RuntimeSchedulerPersistentStoreFixtureState = "fixture_ready_for_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreFixtureInput {
  fixture_id: string;
  operator_id: string;
  snapshot_label: string;
  allow_fixture_only: true;
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

export interface RuntimeSchedulerPersistentStoreFixtureOperation {
  operation: RuntimeSchedulerPersistentStoreOperation;
  dry_run_status: "described_not_executed";
  persistence_enabled: false;
}

export interface RuntimeSchedulerPersistentStoreFixture {
  schema_version: "1.0";
  fixture_id: string;
  fixture_state: RuntimeSchedulerPersistentStoreFixtureState;
  fixture_only: true;
  source_skeleton_state: RuntimeSchedulerPersistentStoreAdapterSkeleton["skeleton_state"];
  snapshot_label: string;
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreAdapterSkeleton["store_kind"];
  store_reference: string;
  store_namespace: string;
  operations: RuntimeSchedulerPersistentStoreFixtureOperation[];
  dry_run_snapshot_created: true;
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
  validation: { complete: boolean; fixture_ready_for_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreFixtureInput): boolean {
  return input.allow_fixture_only === true
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
    && input.fixture_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.snapshot_label.trim().length > 0;
}

function skeletonReady(skeleton: RuntimeSchedulerPersistentStoreAdapterSkeleton): boolean {
  return skeleton.schema_version === "1.0"
    && skeleton.skeleton_state === "skeleton_ready_for_review"
    && skeleton.skeleton_only
    && skeleton.validation.complete
    && skeleton.validation.skeleton_ready_for_review
    && skeleton.operations.length >= 6
    && skeleton.operations.every((operation) => operation.mode === "dry_run_descriptor_only" && !operation.persistence_enabled)
    && skeleton.dry_run_snapshot_supported
    && !skeleton.file_write_enabled
    && !skeleton.database_write_enabled
    && !skeleton.live_scheduler_enabled
    && !skeleton.upload_execution_enabled
    && !skeleton.network_enabled
    && !skeleton.credential_access_enabled
    && !skeleton.media_read_enabled
    && !skeleton.git_add_executed
    && !skeleton.committed_now
    && !skeleton.pushed_now;
}

function toFixtureOperation(operation: RuntimeSchedulerPersistentStoreAdapterSkeleton["operations"][number]): RuntimeSchedulerPersistentStoreFixtureOperation {
  return { operation: operation.operation, dry_run_status: "described_not_executed", persistence_enabled: false };
}

export function createRuntimeSchedulerPersistentStoreFixture(input: RuntimeSchedulerPersistentStoreFixtureInput, skeleton: RuntimeSchedulerPersistentStoreAdapterSkeleton): RuntimeSchedulerPersistentStoreFixture {
  const ready = inputReady(input) && skeletonReady(skeleton);
  return {
    schema_version: "1.0",
    fixture_id: safe(input.fixture_id, "runtime-scheduler-persistent-store-fixture"),
    fixture_state: ready ? "fixture_ready_for_review" : "blocked",
    fixture_only: true,
    source_skeleton_state: skeleton.skeleton_state,
    snapshot_label: safe(input.snapshot_label, "runtime-scheduler-dry-run-snapshot"),
    adapter_name: safe(skeleton.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: skeleton.store_kind,
    store_reference: safe(skeleton.store_reference, "blocked-reference"),
    store_namespace: safe(skeleton.store_namespace, "runtime-scheduler"),
    operations: ready ? skeleton.operations.map(toFixtureOperation) : [],
    dry_run_snapshot_created: true,
    required_next_confirmation: ready ? "I approve dry-run persistent scheduler store fixture validation only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Fixture only; validation may be reviewed next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked adapter skeleton or unsafe fixture input before continuing.",
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
    validation: { complete: ready, fixture_ready_for_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store fixture input or adapter skeleton was unsafe/incomplete."], warnings: ["Fixture only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreFixture(fixture: RuntimeSchedulerPersistentStoreFixture, reason?: string): RuntimeSchedulerPersistentStoreFixture {
  return { ...fixture, fixture_state: "revoked", operations: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, fixture_ready_for_review: false, blocking_reasons: fixture.validation.blocking_reasons, warnings: [...fixture.validation.warnings, safe(reason, "Runtime scheduler persistent-store fixture was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreFixture(fixture: RuntimeSchedulerPersistentStoreFixture): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store fixture",
    `State: ${fixture.fixture_state}`,
    `Snapshot: ${fixture.snapshot_label}`,
    `Adapter: ${fixture.adapter_name}`,
    `Store kind: ${fixture.store_kind}`,
    `Store reference: ${fixture.store_reference}`,
    "Operations:",
    ...(fixture.operations.length ? fixture.operations.map((item) => `- ${item.operation}: ${item.dry_run_status}; persistence=${item.persistence_enabled}`) : ["- blocked"]),
    `Required next confirmation: ${fixture.required_next_confirmation}`,
    `Implementation boundary: ${fixture.implementation_boundary}`,
    `File writes enabled: ${fixture.file_write_enabled}`,
    `Database writes enabled: ${fixture.database_write_enabled}`,
    `Live scheduler enabled: ${fixture.live_scheduler_enabled}`,
  ].join("\n");
}
