import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditPrepSummary, renderRuntimeSchedulerPackageScriptEditPrepSummary, revokeRuntimeSchedulerPackageScriptEditPrepSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-summary.js";
import type { RuntimeSchedulerPackageScriptEditPrepLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-ledger.js";

const SAFE_LEDGER: RuntimeSchedulerPackageScriptEditPrepLedger = {
  schema_version: "1.0",
  ledger_id: "runtime-scheduler-package-script-edit-prep-ledger-001",
  ledger_state: "prep_ledger_ready",
  ledger_only: true,
  recorded_at: "2026-05-15T11:05:00.000Z",
  source_closeout_state: "closed_for_explicit_package_json_edit_boundary",
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  final_boundary: "Preparation is complete; the next step requires an explicit, separate package.json edit approval and must still avoid live scheduling, uploads, network calls, credential access, media reads, and unrelated metadata changes.",
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
  validation: { complete: true, prep_ledger_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  summary_id: "runtime-scheduler-package-script-edit-prep-summary-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-prep-summary-001",
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

test("VO-7HR-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-SUMMARY-1: creates prep summary without side effects", () => {
  const summary = createRuntimeSchedulerPackageScriptEditPrepSummary(SAFE_INPUT, SAFE_LEDGER);

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_state, "prep_summary_ready");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.source_ledger_state, "prep_ledger_ready");
  assert.equal(summary.package_json_path, "projects/probot/package.json");
  assert.equal(summary.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(summary.next_boundary.includes("separate explicitly approved package.json edit"), true);
  assert.equal(summary.ready_items.length, 4);
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

test("VO-7HS-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-SUMMARY-REVIEW-1: unsafe flags block summary", () => {
  const summary = createRuntimeSchedulerPackageScriptEditPrepSummary({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_LEDGER);

  assert.equal(summary.summary_state, "blocked");
  assert.deepEqual(summary.ready_items, []);
  assert.equal(summary.package_json_edited, false);
  assert.equal(summary.validation.complete, false);
});

test("VO-7HS-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-SUMMARY-REVIEW-2: renderer and revocation are safe", () => {
  const summary = createRuntimeSchedulerPackageScriptEditPrepSummary(SAFE_INPUT, SAFE_LEDGER);
  const rendered = renderRuntimeSchedulerPackageScriptEditPrepSummary(summary);
  const revoked = revokeRuntimeSchedulerPackageScriptEditPrepSummary(summary);

  assert.equal(rendered.includes("package script edit prep summary"), true);
  assert.equal(rendered.includes("Ready items"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.summary_state, "revoked");
  assert.deepEqual(revoked.ready_items, []);
  assert.equal(revoked.validation.complete, false);
});
