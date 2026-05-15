import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt, renderRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt, revokeRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-terminal-receipt.js";
import type { RuntimeSchedulerPackageScriptEditReadinessArchiveSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-readiness-archive-summary.js";

const SAFE_SUMMARY: RuntimeSchedulerPackageScriptEditReadinessArchiveSummary = {
  schema_version: "1.0",
  summary_id: "runtime-scheduler-package-script-edit-readiness-archive-summary-001",
  summary_state: "readiness_archive_summary_ready",
  summary_only: true,
  summarized_at: "2026-05-15T12:45:00.000Z",
  source_closeout_state: "readiness_archive_closed",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  summary_notes: [
    "Readiness archive closeout is complete and summary-only.",
    "No package.json edit has been performed in this chain.",
    "Only the runtime scheduler package script entry is allowed in the future execution step.",
    "Runtime activation, uploads, network calls, credential access, media reads, file writes, staging, commits, and pushes remain disabled by this module.",
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
  validation: { complete: true, readiness_archive_summary_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  receipt_id: "runtime-scheduler-package-script-edit-readiness-archive-terminal-receipt-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-readiness-archive-terminal-receipt-001",
  issued_at: "2026-05-15T13:00:00.000Z",
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

test("VO-7IO-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-TERMINAL-RECEIPT-1: creates terminal receipt without side effects", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(SAFE_INPUT, SAFE_SUMMARY);

  assert.equal(receipt.schema_version, "1.0");
  assert.equal(receipt.receipt_state, "terminal_receipt_ready");
  assert.equal(receipt.receipt_only, true);
  assert.equal(receipt.issued_at, "2026-05-15T13:00:00.000Z");
  assert.equal(receipt.source_summary_state, "readiness_archive_summary_ready");
  assert.equal(receipt.decision, "approve_scoped_package_json_edit");
  assert.equal(receipt.package_json_path, "projects/probot/package.json");
  assert.equal(receipt.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(receipt.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(receipt.receipt_notes.length, 3);
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

test("VO-7IP-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-TERMINAL-RECEIPT-REVIEW-1: unsafe flags block receipt", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_SUMMARY);

  assert.equal(receipt.receipt_state, "blocked");
  assert.equal(receipt.allowed_future_change, "none");
  assert.equal(receipt.required_confirmation, "No confirmation available while blocked.");
  assert.equal(receipt.package_json_edited, false);
  assert.equal(receipt.validation.complete, false);
});

test("VO-7IP-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-READINESS-ARCHIVE-TERMINAL-RECEIPT-REVIEW-2: renderer and revocation are safe", () => {
  const receipt = createRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(SAFE_INPUT, SAFE_SUMMARY);
  const rendered = renderRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(receipt);
  const revoked = revokeRuntimeSchedulerPackageScriptEditReadinessArchiveTerminalReceipt(receipt);

  assert.equal(rendered.includes("package script edit readiness archive terminal receipt"), true);
  assert.equal(rendered.includes("Receipt notes"), true);
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
