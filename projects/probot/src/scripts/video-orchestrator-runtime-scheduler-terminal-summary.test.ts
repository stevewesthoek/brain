import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import { createRuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import { createRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";
import { createRuntimeSchedulerReleaseChecklist } from "./video-orchestrator-runtime-scheduler-release-checklist.js";
import { createRuntimeSchedulerReleaseHandoff } from "./video-orchestrator-runtime-scheduler-release-handoff.js";
import { createRuntimeSchedulerReleaseArchive } from "./video-orchestrator-runtime-scheduler-release-archive.js";
import {
  createRuntimeSchedulerTerminalSummary,
  renderRuntimeSchedulerTerminalSummary,
  revokeRuntimeSchedulerTerminalSummary,
} from "./video-orchestrator-runtime-scheduler-terminal-summary.js";

const PLAN_INPUT = {
  package_name: "probot",
  script_name: "probot:video:runtime-scheduler",
  command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  allow_plan_only: true,
  allow_package_json_edit: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

const APPROVAL_INPUT = {
  approval_id: "runtime-scheduler-package-script-approval-001",
  operator_id: "operator-runtime-scheduler-package-script-001",
  reviewed_package_name: "probot",
  reviewed_script_name: "probot:video:runtime-scheduler",
  allow_gate_only: true,
  allow_package_json_edit: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
} as const;

const CHECKLIST_INPUT = {
  release_id: "runtime-scheduler-release-checklist-001",
  operator_id: "operator-runtime-scheduler-release-001",
  expected_script_name: "probot:video:runtime-scheduler",
  allow_checklist_only: true,
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

const HANDOFF_INPUT = {
  handoff_id: "runtime-scheduler-release-handoff-001",
  operator_id: "operator-runtime-scheduler-handoff-001",
  release_notes: "Runtime scheduler CLI is ready for manual release review.",
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

const ARCHIVE_INPUT = {
  archive_id: "runtime-scheduler-release-archive-001",
  operator_id: "operator-runtime-scheduler-archive-001",
  source_commit_hint: "6b6f3740",
  allow_archive_only: true,
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

const SUMMARY_INPUT = {
  summary_id: "runtime-scheduler-terminal-summary-001",
  operator_id: "operator-runtime-scheduler-terminal-summary-001",
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

function archive() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist);
  return createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff);
}

test("VO-7FR-RUNTIME-SCHEDULER-TERMINAL-SUMMARY-1: creates terminal manual-follow-up summary", () => {
  const summary = createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive());

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_state, "manual_follow_up_required");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.source_archive_state, "archived_for_manual_follow_up");
  assert.equal(summary.source_commit_hint, "6b6f3740");
  assert.equal(summary.manual_follow_up_count, 3);
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
  assert.equal(summary.validation.manual_follow_up_required, true);
});

test("VO-7FR-RUNTIME-SCHEDULER-TERMINAL-SUMMARY-2: unsafe summary flags block terminal summary", () => {
  const summary = createRuntimeSchedulerTerminalSummary({ ...SUMMARY_INPUT, allow_upload_execution: true as false }, archive());

  assert.equal(summary.summary_state, "blocked");
  assert.equal(summary.manual_follow_up_count, 0);
  assert.equal(summary.package_json_edited, false);
  assert.equal(summary.upload_execution_enabled, false);
  assert.equal(summary.validation.complete, false);
});

test("VO-7FS-RUNTIME-SCHEDULER-TERMINAL-SUMMARY-REVIEW-1: renderer is safe and explicit", () => {
  const text = renderRuntimeSchedulerTerminalSummary(createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive()));

  assert.equal(text.includes("runtime scheduler terminal summary"), true);
  assert.equal(text.includes("Source commit hint: 6b6f3740"), true);
  assert.equal(text.includes("package.json edited: false"), true);
  assert.equal(text.includes("Live scheduler enabled: false"), true);
  assert.equal(text.includes("Stop before package.json edits"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});

test("VO-7FS-RUNTIME-SCHEDULER-TERMINAL-SUMMARY-REVIEW-2: revocation blocks terminal summary", () => {
  const summary = createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive());
  const revoked = revokeRuntimeSchedulerTerminalSummary(summary);

  assert.equal(revoked.summary_state, "revoked");
  assert.equal(revoked.manual_follow_up_count, 0);
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.manual_follow_up_required, false);
});
