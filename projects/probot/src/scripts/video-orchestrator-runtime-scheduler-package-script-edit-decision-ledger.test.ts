import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditDecisionLedger, renderRuntimeSchedulerPackageScriptEditDecisionLedger, revokeRuntimeSchedulerPackageScriptEditDecisionLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-ledger.js";
import type { RuntimeSchedulerPackageScriptEditDecisionCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPackageScriptEditDecisionCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-package-script-edit-decision-closeout-001",
  closeout_state: "closed_for_separate_package_json_edit_action",
  closeout_only: true,
  source_packet_state: "ready_for_operator_decision",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
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
  validation: { complete: true, closeout_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  ledger_id: "runtime-scheduler-package-script-edit-decision-ledger-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-decision-ledger-001",
  recorded_at: "2026-05-15T11:45:00.000Z",
  allow_ledger_only: true,
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

test("VO-7IA-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-LEDGER-1: records decision ledger without side effects", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditDecisionLedger(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(ledger.schema_version, "1.0");
  assert.equal(ledger.ledger_state, "decision_ledger_ready");
  assert.equal(ledger.ledger_only, true);
  assert.equal(ledger.recorded_at, "2026-05-15T11:45:00.000Z");
  assert.equal(ledger.source_closeout_state, "closed_for_separate_package_json_edit_action");
  assert.equal(ledger.decision, "approve_scoped_package_json_edit");
  assert.equal(ledger.package_json_path, "projects/probot/package.json");
  assert.equal(ledger.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(ledger.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(ledger.package_json_edited, false);
  assert.equal(ledger.live_scheduler_enabled, false);
  assert.equal(ledger.upload_execution_enabled, false);
  assert.equal(ledger.network_enabled, false);
  assert.equal(ledger.credential_access_enabled, false);
  assert.equal(ledger.media_read_enabled, false);
  assert.equal(ledger.file_write_enabled, false);
  assert.equal(ledger.git_add_executed, false);
  assert.equal(ledger.committed_now, false);
  assert.equal(ledger.pushed_now, false);
  assert.equal(ledger.validation.complete, true);
});

test("VO-7IB-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-LEDGER-REVIEW-1: unsafe flags block ledger", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditDecisionLedger({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_CLOSEOUT);

  assert.equal(ledger.ledger_state, "blocked");
  assert.equal(ledger.allowed_future_change, "none");
  assert.equal(ledger.required_confirmation, "No confirmation available while blocked.");
  assert.equal(ledger.package_json_edited, false);
  assert.equal(ledger.validation.complete, false);
});

test("VO-7IB-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-DECISION-LEDGER-REVIEW-2: renderer and revocation are safe", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditDecisionLedger(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPackageScriptEditDecisionLedger(ledger);
  const revoked = revokeRuntimeSchedulerPackageScriptEditDecisionLedger(ledger);

  assert.equal(rendered.includes("package script edit decision ledger"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.ledger_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
