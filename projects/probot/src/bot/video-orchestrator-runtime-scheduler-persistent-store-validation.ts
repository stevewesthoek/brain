import type { RuntimeSchedulerPersistentStoreFixture } from "./video-orchestrator-runtime-scheduler-persistent-store-fixture.js";
import type { RuntimeSchedulerPersistentStoreOperation } from "./video-orchestrator-runtime-scheduler-persistent-store-contract.js";

export type RuntimeSchedulerPersistentStoreValidationState = "validation_ready_for_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPersistentStoreValidationInput {
  validation_id: string;
  operator_id: string;
  expected_operation_count: number;
  allow_validation_only: true;
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

export interface RuntimeSchedulerPersistentStoreValidationCheck {
  check_id: string;
  operation: RuntimeSchedulerPersistentStoreOperation | "fixture_integrity" | "safety_flags";
  status: "passed" | "blocked";
  details: string;
}

export interface RuntimeSchedulerPersistentStoreValidationPacket {
  schema_version: "1.0";
  validation_id: string;
  validation_state: RuntimeSchedulerPersistentStoreValidationState;
  validation_only: true;
  source_fixture_state: RuntimeSchedulerPersistentStoreFixture["fixture_state"];
  fixture_id: string;
  adapter_name: string;
  store_kind: RuntimeSchedulerPersistentStoreFixture["store_kind"];
  store_reference: string;
  operation_count: number;
  checks: RuntimeSchedulerPersistentStoreValidationCheck[];
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
  validation: { complete: boolean; validation_ready_for_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerPersistentStoreValidationInput): boolean {
  return input.allow_validation_only === true
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
    && input.validation_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && Number.isInteger(input.expected_operation_count)
    && input.expected_operation_count > 0;
}

function fixtureReady(fixture: RuntimeSchedulerPersistentStoreFixture, expectedOperationCount: number): boolean {
  return fixture.schema_version === "1.0"
    && fixture.fixture_state === "fixture_ready_for_review"
    && fixture.fixture_only
    && fixture.validation.complete
    && fixture.validation.fixture_ready_for_review
    && fixture.operations.length === expectedOperationCount
    && fixture.operations.length > 0
    && fixture.operations.every((operation) => operation.dry_run_status === "described_not_executed" && !operation.persistence_enabled)
    && fixture.dry_run_snapshot_created
    && !fixture.file_write_enabled
    && !fixture.database_write_enabled
    && !fixture.live_scheduler_enabled
    && !fixture.upload_execution_enabled
    && !fixture.network_enabled
    && !fixture.credential_access_enabled
    && !fixture.media_read_enabled
    && !fixture.git_add_executed
    && !fixture.committed_now
    && !fixture.pushed_now;
}

function buildChecks(fixture: RuntimeSchedulerPersistentStoreFixture, ready: boolean): RuntimeSchedulerPersistentStoreValidationCheck[] {
  if (!ready) return [{ check_id: "fixture-blocked", operation: "fixture_integrity", status: "blocked", details: "Fixture was not ready for validation." }];
  const operationChecks = fixture.operations.map((operation, index) => ({
    check_id: `operation-${index + 1}-${operation.operation}`,
    operation: operation.operation,
    status: "passed" as const,
    details: "Dry-run operation descriptor is present and not executed.",
  }));
  return [
    { check_id: "fixture-integrity", operation: "fixture_integrity", status: "passed", details: "Fixture is complete, dry-run only, and ready for review." },
    ...operationChecks,
    { check_id: "safety-flags", operation: "safety_flags", status: "passed", details: "No file writes, database writes, live scheduler, upload, network, credential, media, staging, commit, or push behavior is enabled." },
  ];
}

export function createRuntimeSchedulerPersistentStoreValidationPacket(input: RuntimeSchedulerPersistentStoreValidationInput, fixture: RuntimeSchedulerPersistentStoreFixture): RuntimeSchedulerPersistentStoreValidationPacket {
  const ready = inputReady(input) && fixtureReady(fixture, input.expected_operation_count);
  return {
    schema_version: "1.0",
    validation_id: safe(input.validation_id, "runtime-scheduler-persistent-store-validation"),
    validation_state: ready ? "validation_ready_for_review" : "blocked",
    validation_only: true,
    source_fixture_state: fixture.fixture_state,
    fixture_id: safe(fixture.fixture_id, "runtime-scheduler-persistent-store-fixture"),
    adapter_name: safe(fixture.adapter_name, "runtime-scheduler-persistent-store-adapter"),
    store_kind: fixture.store_kind,
    store_reference: safe(fixture.store_reference, "blocked-reference"),
    operation_count: ready ? fixture.operations.length : 0,
    checks: buildChecks(fixture, ready),
    required_next_confirmation: ready ? "I approve persistent scheduler store implementation planning review only, with no file writes, database writes, live scheduler activation, uploads, network calls, credential access, media reads, staging, commits, or pushes unless separately confirmed." : "No confirmation available while blocked.",
    implementation_boundary: ready ? "Validation only; implementation planning review may proceed next, but actual persistence writes, migrations, live scheduling, uploads, network, credentials, media reads, git staging, commits, and pushes remain separate explicit boundaries." : "Resolve blocked fixture or unsafe validation input before continuing.",
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
    validation: { complete: ready, validation_ready_for_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler persistent-store validation input or fixture was unsafe/incomplete."], warnings: ["Validation only; no persistent writes, database writes, live scheduling, uploads, network, credentials, media reads, staging, commits, or pushes are enabled."] },
  };
}

export function revokeRuntimeSchedulerPersistentStoreValidationPacket(packet: RuntimeSchedulerPersistentStoreValidationPacket, reason?: string): RuntimeSchedulerPersistentStoreValidationPacket {
  return { ...packet, validation_state: "revoked", operation_count: 0, checks: [], required_next_confirmation: "No confirmation available while revoked.", validation: { complete: false, validation_ready_for_review: false, blocking_reasons: packet.validation.blocking_reasons, warnings: [...packet.validation.warnings, safe(reason, "Runtime scheduler persistent-store validation packet was revoked.")] } };
}

export function renderRuntimeSchedulerPersistentStoreValidationPacket(packet: RuntimeSchedulerPersistentStoreValidationPacket): string {
  return [
    "Video Orchestrator runtime scheduler persistent-store validation packet",
    `State: ${packet.validation_state}`,
    `Fixture: ${packet.fixture_id}`,
    `Adapter: ${packet.adapter_name}`,
    `Store kind: ${packet.store_kind}`,
    `Store reference: ${packet.store_reference}`,
    `Operation count: ${packet.operation_count}`,
    "Checks:",
    ...(packet.checks.length ? packet.checks.map((check) => `- ${check.check_id}: ${check.status}; ${check.details}`) : ["- blocked"]),
    `Required next confirmation: ${packet.required_next_confirmation}`,
    `Implementation boundary: ${packet.implementation_boundary}`,
    `File writes enabled: ${packet.file_write_enabled}`,
    `Database writes enabled: ${packet.database_write_enabled}`,
    `Live scheduler enabled: ${packet.live_scheduler_enabled}`,
  ].join("\n");
}
