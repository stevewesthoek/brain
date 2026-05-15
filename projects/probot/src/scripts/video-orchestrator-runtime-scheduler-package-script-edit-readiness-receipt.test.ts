import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessReceipt, renderRuntimeSchedulerPackageScriptEditReadinessReceipt, revokeRuntimeSchedulerPackageScriptEditReadinessReceipt } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-receipt.js";
import type { RuntimeSchedulerPackageScriptEditTerminalHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.js";

const SAFE_HANDOFF: RuntimeSchedulerPackageScriptEditTerminalHandoff = {
  schema_version: "1.0",
  handoff_id: "runtime-scheduler-package-script-edit-terminal-handoff-001",
  handoff_state: "terminal_handoff_ready",
  handoff_only: true,
  source_summary_state: "decision_summary_ready",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  handoff_notes: [
    "This terminal handoff performs no package.json edit.",
    "The next executable step must be separately approved and scoped to one scripts entry only.",
    "Live scheduler activation, uploads, network calls, credential access, media reads, persistent writes, commits, and pushes remain disabled here.",
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
  validation: { complete: true, terminal_handoff_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  receipt_id: "runtime-scheduler-package-script-edit-readiness-receipt-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-receipt-001",
  issued_at: "2026-05-15T12:15:00.000Z",
  allow_receipt_only: true,
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

test("VO-7IG-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-RECEIPT-1: creates readiness receipt without side effects", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessReceipt(SAFE_INPUT, SAFE_HANDOFF);

  assert.equal(receipt.schema_version, "1.0");
  assert.equal(receipt.receipt_state, "readiness_receipt_ready");
  assert.equal(receipt.receipt_only, true);
  assert.equal(receipt.issued_at, "2026-05-15T12:15:00.000Z");
  assert.equal(receipt.source_handoff_state, "terminal_handoff_ready");
  assert.equal(receipt.decision, "approve_scoped_package_json_edit");
  assert.equal(receipt.package_json_path, "projects/probot/package.json");
  assert.equal(receipt.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(receipt.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(receipt.package_json_edited, false);
  assert.equal(receipt.live_scheduler_enabled, false);
  assert.equal(receipt.upload_execution_enabled, false);
  assert.equal(receipt.network_enabled, false);
  assert.equal(receipt.credential_access_enabled, false);
  assert.equal(receipt.media_read_enabled, false);
  assert.equal(receipt.file_write_enabled, false);
  assert.equal(receipt.git_add_executed, false);
  assert.equal(receipt.committed_now, false);
  assert.equal(receipt.pushed_now, false);
  assert.equal(receipt.validation.complete, true);
});

test("VO-7IH-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-RECEIPT-REVIEW-1: unsafe flags block receipt", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessReceipt({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_HANDOFF);

  assert.equal(receipt.receipt_state, "blocked");
  assert.equal(receipt.allowed_future_change, "none");
  assert.equal(receipt.required_confirmation, "No confirmation available while blocked.");
  assert.equal(receipt.package_json_edited, false);
  assert.equal(receipt.validation.complete, false);
});

test("VO-7IH-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-RECEIPT-REVIEW-2: renderer and revocation are safe", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessReceipt(SAFE_INPUT, SAFE_HANDOFF);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessReceipt(receipt);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessReceipt(receipt);

  assert.equal(rendered.includes("package script edit readiness receipt"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.receipt_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
