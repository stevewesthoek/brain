import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessArchiveSummary, renderRuntimeSchedulerPackageScriptEditReadinessArchiveSummary, revokeRuntimeSchedulerPackageScriptEditReadinessArchiveSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-summary.js";
import type { RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPackageScriptEditReadinessArchiveCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-package-script-edit-readiness-archive-closeout-001",
  closeout_state: "readiness_archive_closed",
  closeout_only: true,
  closed_at: "2026-05-15T12:35:00.000Z",
  source_archive_state: "readiness_archive_ready",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  closeout_notes: [
    "Readiness archive has been closed for operator review.",
    "No package.json edit was performed by this closeout.",
    "The next executable action remains a separate explicit approval scoped only to one package script entry.",
    "Runtime activation, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled here.",
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
  validation: { complete: true, readiness_archive_closed: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  summary_id: "runtime-scheduler-package-script-edit-readiness-archive-summary-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-archive-summary-001",
  summarized_at: "2026-05-15T12:45:00.000Z",
  allow_summary_only: true,
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

test("VO-7IM-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-SUMMARY-1: summarizes readiness archive without side effects", () => {
  const summary = createRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_state, "readiness_archive_summary_ready");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.summarized_at, "2026-05-15T12:45:00.000Z");
  assert.equal(summary.source_closeout_state, "readiness_archive_closed");
  assert.equal(summary.decision, "approve_scoped_package_json_edit");
  assert.equal(summary.package_json_path, "projects/probot/package.json");
  assert.equal(summary.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(summary.summary_notes.length, 4);
  assert.equal(summary.package_json_edited, false);
  assert.equal(summary.live_scheduler_enabled, false);
  assert.equal(summary.upload_execution_enabled, false);
  assert.equal(summary.network_enabled, false);
  assert.equal(summary.credential_access_enabled, false);
  assert.equal(summary.media_read_enabled, false);
  assert.equal(summary.file_write_enabled, false);
  assert.equal(summary.git_add_executed, false);
  assert.equal(summary.committed_now, false);
  assert.equal(summary.pushed_now, false);
  assert.equal(summary.validation.complete, true);
});

test("VO-7IN-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-SUMMARY-REVIEW-1: unsafe flags block summary", () => {
  const summary = createRuntimeSchedulerPackageScriptEditReadinessArchiveSummary({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_CLOSEOUT);

  assert.equal(summary.summary_state, "blocked");
  assert.equal(summary.allowed_future_change, "none");
  assert.equal(summary.required_confirmation, "No confirmation available while blocked.");
  assert.equal(summary.package_json_edited, false);
  assert.equal(summary.validation.complete, false);
});

test("VO-7IN-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-SUMMARY-REVIEW-2: renderer and revocation are safe", () => {
  const summary = createRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(summary);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessArchiveSummary(summary);

  assert.equal(rendered.includes("package script edit readiness archive summary"), true);
  assert.equal(rendered.includes("Summary notes"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.summary_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
