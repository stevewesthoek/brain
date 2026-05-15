import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditTerminalHandoff, renderRuntimeSchedulerPackageScriptEditTerminalHandoff, revokeRuntimeSchedulerPackageScriptEditTerminalHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-terminal-handoff.js";
import type { RuntimeSchedulerPackageScriptEditDecisionSummary } from "./video-orchestrator-runtime-scheduler-package-script-edit-decision-summary.js";

const SAFE_SUMMARY: RuntimeSchedulerPackageScriptEditDecisionSummary = {
  schema_version: "1.0",
  summary_id: "runtime-scheduler-package-script-edit-decision-summary-001",
  summary_state: "decision_summary_ready",
  summary_only: true,
  source_ledger_state: "decision_ledger_ready",
  decision: "approve_scoped_package_json_edit",
  package_json_path: "projects/probot/package.json",
  allowed_future_change: "Add only the probot:video:runtime-scheduler script entry to projects/probot/package.json.",
  final_boundary: "The preparation chain is complete; the next action must be a separate explicitly approved package.json edit, scoped only to adding probot:video:runtime-scheduler.",
  required_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  summary_items: [
    "Decision ledger is complete and side-effect-free.",
    "No package.json edit has been performed by the preparation chain.",
    "The future allowed change remains limited to the runtime scheduler package script entry.",
    "Runtime activation, uploads, network calls, credentials, media reads, file writes, git add, commit, and push remain disabled here.",
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
  validation: { complete: true, decision_summary_ready: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  handoff_id: "runtime-scheduler-package-script-edit-terminal-handoff-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-terminal-handoff-001",
  allow_handoff_only: true,
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

test("VO-7IE-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-TERMINAL-HANDOFF-1: creates terminal handoff without side effects", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditTerminalHandoff(SAFE_INPUT, SAFE_SUMMARY);

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "terminal_handoff_ready");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.source_summary_state, "decision_summary_ready");
  assert.equal(handoff.decision, "approve_scoped_package_json_edit");
  assert.equal(handoff.package_json_path, "projects/probot/package.json");
  assert.equal(handoff.allowed_future_change.includes("probot:video:runtime-scheduler"), true);
  assert.equal(handoff.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(handoff.handoff_notes.length, 3);
  assert.equal(handoff.package_json_edited, false);
  assert.equal(handoff.live_scheduler_enabled, false);
  assert.equal(handoff.upload_execution_enabled, false);
  assert.equal(handoff.network_enabled, false);
  assert.equal(handoff.credential_access_enabled, false);
  assert.equal(handoff.media_read_enabled, false);
  assert.equal(handoff.file_write_enabled, false);
  assert.equal(handoff.git_add_executed, false);
  assert.equal(handoff.committed_now, false);
  assert.equal(handoff.pushed_now, false);
  assert.equal(handoff.validation.complete, true);
});

test("VO-7IF-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-TERMINAL-HANDOFF-REVIEW-1: unsafe flags block handoff", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditTerminalHandoff({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_SUMMARY);

  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.allowed_future_change, "none");
  assert.equal(handoff.required_confirmation, "No confirmation available while blocked.");
  assert.equal(handoff.package_json_edited, false);
  assert.equal(handoff.validation.complete, false);
});

test("VO-7IF-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-TERMINAL-HANDOFF-REVIEW-2: renderer and revocation are safe", () => {
  const handoff = createRuntimeSchedulerPackageScriptEditTerminalHandoff(SAFE_INPUT, SAFE_SUMMARY);
  const rendered = renderRuntimeSchedulerPackageScriptEditTerminalHandoff(handoff);
  const revoked = revokeRuntimeSchedulerPackageScriptEditTerminalHandoff(handoff);

  assert.equal(rendered.includes("package script edit terminal handoff"), true);
  assert.equal(rendered.includes("Handoff notes"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.handoff_state, "revoked");
  assert.equal(revoked.allowed_future_change, "none");
  assert.equal(revoked.validation.complete, false);
});
