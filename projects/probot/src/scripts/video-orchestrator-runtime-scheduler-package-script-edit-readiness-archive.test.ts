import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessArchive, renderRuntimeSchedulerPackageScriptEditReadinessArchive, revokeRuntimeSchedulerPackageScriptEditReadinessArchive } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive.js";
import type { RuntimeSchedulerPackageScriptEditReadinessReceipt } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-receipt.js";

const SAFE_RECEIPT: RuntimeSchedulerPackageScriptEditReadinessReceipt = {
  schema_version: "1.0",
  receipt_id: "runtime-scheduler-package-script-edit-readiness-receipt-001",
  receipt_state: "readiness_receipt_ready",
  receipt_only: true,
  issued_at: "2026-05-15T12:15:00.000Z",
  source_handoff_state: "terminal_handoff_ready",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  package_json_edited: false,
  live_scheduler_enabled: false,
  upload_execution_enabled: false,
  network_enabled: false,
  credential_access_enabled: false,
  media_read_enabled: false,
  file_write_enabled: false,
  git_add_executed: false,
  committed_now: false,
  pushed_now: false,
  validation: { complete: true, readiness_receipt_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  archive_id: "runtime-scheduler-package-script-edit-readiness-archive-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-archive-001",
  archived_at: "2026-05-15T12:25:00.000Z",
  allow_archive_only: true,
  allow_package_json_edit: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_file_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

test("VO-7II-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-1: creates readiness archive without side effects", () => {
  const archive = createRuntimeSchedulerPackageScriptEditReadinessArchive(SAFE_INPUT, SAFE_RECEIPT);

  assert.equal(archive.schema_version, "1.0");
  assert.equal(archive.archive_state, "readiness_archive_ready");
  assert.equal(archive.archive_only, true);
  assert.equal(archive.archived_at, "2026-05-15T12:25:00.000Z");
  assert.equal(archive.source_receipt_state, "readiness_receipt_ready");
  assert.equal(archive.decision, "approve_scoped_package_json_edit");
  assert.equal(archive.package_json_path, "projects/probot/package.json");
  assert.equal(archive.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(archive.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(archive.immutable_notes.length, 3);
  assert.equal(archive.package_json_edited, false);
  assert.equal(archive.live_scheduler_enabled, false);
  assert.equal(archive.upload_execution_enabled, false);
  assert.equal(archive.network_enabled, false);
  assert.equal(archive.credential_access_enabled, false);
  assert.equal(archive.media_read_enabled, false);
  assert.equal(archive.file_write_enabled, false);
  assert.equal(archive.git_add_executed, false);
  assert.equal(archive.committed_now, false);
  assert.equal(archive.pushed_now, false);
  assert.equal(archive.validation.complete, true);
});

test("VO-7IJ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-REVIEW-1: unsafe flags block archive", () => {
  const archive = createRuntimeSchedulerPackageScriptEditReadinessArchive({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_RECEIPT);

  assert.equal(archive.archive_state, "blocked");
  assert.equal(archive.allowed_future_change, "none");
  assert.equal(archive.required_confirmation, "No confirmation available while blocked.");
  assert.equal(archive.package_json_edited, false);
  assert.equal(archive.validation.complete, false);
});

test("VO-7IJ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-REVIEW-2: renderer and revocation are safe", () => {
  const archive = createRuntimeSchedulerPackageScriptEditReadinessArchive(SAFE_INPUT, SAFE_RECEIPT);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessArchive(archive);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessArchive(archive);

  assert.equal(rendered.includes("package script edit readiness archive"), true);
  assert.equal(rendered.includes("Immutable notes"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.archive_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
