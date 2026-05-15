import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditDecisionSummary, renderRuntimeSchedulerPackageScriptEditDecisionSummary, revokeRuntimeSchedulerPackageScriptEditDecisionSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-summary.js";
import type { RuntimeSchedulerPackageScriptEditDecisionLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-ledger.js";

const SAFE_LEDGER: RuntimeSchedulerPackageScriptEditDecisionLedger = {
  schema_version: "1.0",
  ledger_id: "runtime-scheduler-package-script-edit-decision-ledger-001",
  ledger_state: "decision_ledger_ready",
  ledger_only: true,
  recorded_at: "2026-05-15T11:45:00.000Z",
  source_closeout_state: "closed_for_separate_package_json_edit_action",
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
  validation: { complete: true, decision_ledger_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  summary_id: "runtime-scheduler-package-script-edit-decision-summary-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-decision-summary-001",
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

test("VO-7IC-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-SUMMARY-1: creates decision summary without side effects", () => {
  const summary = createRuntimeSchedulerPackageScriptEditDecisionSummary(SAFE_INPUT, SAFE_LEDGER);

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_state, "decision_summary_ready");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.source_ledger_state, "decision_ledger_ready");
  assert.equal(summary.decision, "approve_scoped_package_json_edit");
  assert.equal(summary.package_json_path, "projects/probot/package.json");
  assert.equal(summary.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(summary.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(summary.summary_items.length, 4);
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

test("VO-7ID-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-SUMMARY-REVIEW-1: unsafe flags block summary", () => {
  const summary = createRuntimeSchedulerPackageScriptEditDecisionSummary({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_LEDGER);

  assert.equal(summary.summary_state, "blocked");
  assert.equal(summary.allowed_future_change, "none");
  assert.equal(summary.required_confirmation, "No confirmation available while blocked.");
  assert.equal(summary.package_json_edited, false);
  assert.equal(summary.validation.complete, false);
});

test("VO-7ID-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-SUMMARY-REVIEW-2: renderer and revocation are safe", () => {
  const summary = createRuntimeSchedulerPackageScriptEditDecisionSummary(SAFE_INPUT, SAFE_LEDGER);
  const rendered = renderRuntimeSchedulerPackageScriptEditDecisionSummary(summary);
  const revoked = revokeRuntimeSchedulerPackageScriptEditDecisionSummary(summary);

  assert.equal(rendered.includes("package script edit decision summary"), true);
  assert.equal(rendered.includes("Summary items"), true);
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
