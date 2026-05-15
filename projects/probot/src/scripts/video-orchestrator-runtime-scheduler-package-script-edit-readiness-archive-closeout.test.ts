import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout, renderRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout, revokeRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-closeout.js";
import type { RuntimeSchedulerPackageScriptEditReadinessArchive } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive.js";

const SAFE_ARCHIVE: RuntimeSchedulerPackageScriptEditReadinessArchive = {
  schema_version: "1.0",
  archive_id: "runtime-scheduler-package-script-edit-readiness-archive-001",
  archive_state: "readiness_archive_ready",
  archive_only: true,
  archived_at: "2026-05-15T12:25:00.000Z",
  source_receipt_state: "readiness_receipt_ready",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  immutable_notes: [
    "Archive is informational only and performs no package.json edit.",
    "Future execution remains limited to one scripts entry in projects/probot/package.json.",
    "Live runtime behavior, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled by this module.",
  ],
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
  validation: { complete: true, readiness_archive_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  closeout_id: "runtime-scheduler-package-script-edit-readiness-archive-closeout-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-archive-closeout-001",
  closed_at: "2026-05-15T12:35:00.000Z",
  allow_closeout_only: true,
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

test("VO-7IK-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-CLOSEOUT-1: closes readiness archive without side effects", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(SAFE_INPUT, SAFE_ARCHIVE);

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "readiness_archive_closed");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.closed_at, "2026-05-15T12:35:00.000Z");
  assert.equal(closeout.source_archive_state, "readiness_archive_ready");
  assert.equal(closeout.decision, "approve_scoped_package_json_edit");
  assert.equal(closeout.package_json_path, "projects/probot/package.json");
  assert.equal(closeout.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(closeout.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(closeout.closeout_notes.length, 4);
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.live_scheduler_enabled, false);
  assert.equal(closeout.upload_execution_enabled, false);
  assert.equal(closeout.network_enabled, false);
  assert.equal(closeout.credential_access_enabled, false);
  assert.equal(closeout.media_read_enabled, false);
  assert.equal(closeout.file_write_enabled, false);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
  assert.equal(closeout.validation.complete, true);
});

test("VO-7IL-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-CLOSEOUT-REVIEW-1: unsafe flags block closeout", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_ARCHIVE);

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.allowed_future_change, "none");
  assert.equal(closeout.required_confirmation, "No confirmation available while blocked.");
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.validation.complete, false);
});

test("VO-7IL-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-CLOSEOUT-REVIEW-2: renderer and revocation are safe", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(SAFE_INPUT, SAFE_ARCHIVE);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(closeout);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessArchiveCloseout(closeout);

  assert.equal(rendered.includes("package script edit readiness archive closeout"), true);
  assert.equal(rendered.includes("Closeout notes"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.closeout_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
