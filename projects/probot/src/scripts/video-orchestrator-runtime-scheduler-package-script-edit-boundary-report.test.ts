import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditBoundaryReport, renderRuntimeSchedulerPackageScriptEditBoundaryReport, revokeRuntimeSchedulerPackageScriptEditBoundaryReport } from "./video-orchestrator-runtime-scheduler-package-script-edit-boundary-report.js";
import type { RuntimeSchedulerPackageScriptEditPrepSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-summary.js";

const SAFE_SUMMARY: RuntimeSchedulerPackageScriptEditPrepSummary = {
  schema_version: "1.0",
  summary_id: "runtime-scheduler-package-script-edit-prep-summary-001",
  summary_state: "prep_summary_ready",
  summary_only: true,
  source_ledger_state: "prep_ledger_ready",
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  next_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  ready_items: [
    "Audit closeout is recorded in the prep ledger.",
    "The package.json edit remains unperformed.",
    "The future edit is constrained to one scripts entry.",
    "Live scheduling, uploads, network calls, credentials, media reads, unrelated metadata changes, commits, and pushes remain blocked without separate scope.",
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
  validation: { complete: true, prep_summary_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  report_id: "runtime-scheduler-package-script-edit-boundary-report-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-boundary-report-001",
  allow_report_only: true,
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

test("VO-7HT-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-BOUNDARY-REPORT-1: creates boundary report without side effects", () => {
  const report = createRuntimeSchedulerPackageScriptEditBoundaryReport(SAFE_INPUT, SAFE_SUMMARY);

  assert.equal(report.schema_version, "1.0");
  assert.equal(report.report_state, "boundary_report_ready");
  assert.equal(report.report_only, true);
  assert.equal(report.source_summary_state, "prep_summary_ready");
  assert.equal(report.package_json_path, "projects/probot/package.json");
  assert.equal(report.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(report.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(report.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(report.disallowed_future_changes.includes("live scheduler activation"), true);
  assert.equal(report.package_json_edited, false);
  assert.equal(report.live_scheduler_enabled, false);
  assert.equal(report.upload_execution_enabled, false);
  assert.equal(report.network_enabled, false);
  assert.equal(report.credential_access_enabled, false);
  assert.equal(report.media_read_enabled, false);
  assert.equal(report.file_write_enabled, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.complete, true);
});

test("VO-7HU-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-BOUNDARY-REPORT-REVIEW-1: unsafe flags block report", () => {
  const report = createRuntimeSchedulerPackageScriptEditBoundaryReport({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_SUMMARY);

  assert.equal(report.report_state, "blocked");
  assert.equal(report.allowed_future_change, "none");
  assert.deepEqual(report.disallowed_future_changes, []);
  assert.equal(report.package_json_edited, false);
  assert.equal(report.validation.complete, false);
});

test("VO-7HU-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-BOUNDARY-REPORT-REVIEW-2: renderer and revocation are safe", () => {
  const report = createRuntimeSchedulerPackageScriptEditBoundaryReport(SAFE_INPUT, SAFE_SUMMARY);
  const rendered = renderRuntimeSchedulerPackageScriptEditBoundaryReport(report);
  const revoked = revokeRuntimeSchedulerPackageScriptEditBoundaryReport(report);

  assert.equal(rendered.includes("package script edit boundary report"), true);
  assert.equal(rendered.includes("Allowed future change"), true);
  assert.equal(rendered.includes("Disallowed future changes"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.report_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
