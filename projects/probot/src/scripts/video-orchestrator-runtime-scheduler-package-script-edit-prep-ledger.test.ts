import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditPrepLedger, renderRuntimeSchedulerPackageScriptEditPrepLedger, revokeRuntimeSchedulerPackageScriptEditPrepLedger } from "./video-orchestrator-runtime-scheduler-package-script-edit-prep-ledger.js";
import type { RuntimeSchedulerPackageScriptEditAuditCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-audit-closeout.js";

const SAFE_CLOSEOUT: RuntimeSchedulerPackageScriptEditAuditCloseout = {
  schema_version: "1.0",
  closeout_id: "runtime-scheduler-package-script-edit-audit-closeout-001",
  closeout_state: "closed_for_explicit_package_json_edit_boundary",
  closeout_only: true,
  source_audit_state: "audit_ready_for_operator_review",
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
  validation: { complete: true, closed_for_explicit_package_json_edit_boundary: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  ledger_id: "runtime-scheduler-package-script-edit-prep-ledger-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-prep-ledger-001",
  recorded_at: "2026-05-15T11:05:00.000Z",
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

test("VO-7HP-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-LEDGER-1: records prep ledger without side effects", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditPrepLedger(SAFE_INPUT, SAFE_CLOSEOUT);

  assert.equal(ledger.schema_version, "1.0");
  assert.equal(ledger.ledger_state, "prep_ledger_ready");
  assert.equal(ledger.ledger_only, true);
  assert.equal(ledger.recorded_at, "2026-05-15T11:05:00.000Z");
  assert.equal(ledger.source_closeout_state, "closed_for_explicit_package_json_edit_boundary");
  assert.equal(ledger.package_json_path, "projects/probot/package.json");
  assert.equal(ledger.commit_message, "Add Video Orchestrator runtime scheduler package script");
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

test("VO-7HQ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-LEDGER-REVIEW-1: unsafe flags block ledger", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditPrepLedger({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_CLOSEOUT);

  assert.equal(ledger.ledger_state, "blocked");
  assert.equal(ledger.required_confirmation, "No confirmation available while blocked.");
  assert.equal(ledger.package_json_edited, false);
  assert.equal(ledger.validation.complete, false);
});

test("VO-7HQ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREP-LEDGER-REVIEW-2: renderer and revocation are safe", () => {
  const ledger = createRuntimeSchedulerPackageScriptEditPrepLedger(SAFE_INPUT, SAFE_CLOSEOUT);
  const rendered = renderRuntimeSchedulerPackageScriptEditPrepLedger(ledger);
  const revoked = revokeRuntimeSchedulerPackageScriptEditPrepLedger(ledger);

  assert.equal(rendered.includes("package script edit prep ledger"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.ledger_state, "revoked");
  assert.equal(revoked.required_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
