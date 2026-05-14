import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import { createRuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import { createRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";
import { createRuntimeSchedulerReleaseChecklist } from "./video-orchestrator-runtime-scheduler-release-checklist.js";
import { createRuntimeSchedulerReleaseHandoff } from "./video-orchestrator-runtime-scheduler-release-handoff.js";
import {
  createRuntimeSchedulerReleaseArchive,
  renderRuntimeSchedulerReleaseArchive,
  revokeRuntimeSchedulerReleaseArchive,
} from "./video-orchestrator-runtime-scheduler-release-archive.js";

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
  source_commit_hint: "b086ae9b",
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

function handoff() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
  return createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist);
}

test("VO-7FP-RUNTIME-SCHEDULER-RELEASE-ARCHIVE-1: archives release handoff for manual follow-up", () => {
  const archive = createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff());

  assert.equal(archive.schema_version, "1.0");
  assert.equal(archive.archive_state, "archived_for_manual_follow_up");
  assert.equal(archive.archive_only, true);
  assert.equal(archive.source_commit_hint, "b086ae9b");
  assert.equal(archive.handoff_state, "ready_for_operator_handoff");
  assert.equal(archive.package_json_edited, false);
  assert.equal(archive.live_scheduler_enabled, false);
  assert.equal(archive.upload_execution_enabled, false);
  assert.equal(archive.network_enabled, false);
  assert.equal(archive.credential_access_enabled, false);
  assert.equal(archive.media_read_enabled, false);
  assert.equal(archive.file_write_enabled, false);
  assert.equal(archive.git_add_executed, false);
  assert.equal(archive.committed_now, false);
  assert.equal(archive.pushed_now, false);
  assert.equal(archive.manual_follow_up.length, 3);
  assert.equal(archive.validation.complete, true);
  assert.equal(archive.validation.archived_for_manual_follow_up, true);
});

test("VO-7FP-RUNTIME-SCHEDULER-RELEASE-ARCHIVE-2: unsafe archive flags block archive", () => {
  const archive = createRuntimeSchedulerReleaseArchive({ ...ARCHIVE_INPUT, allow_live_scheduler: true as false }, handoff());

  assert.equal(archive.archive_state, "blocked");
  assert.equal(archive.package_json_edited, false);
  assert.equal(archive.live_scheduler_enabled, false);
  assert.equal(archive.validation.complete, false);
});

test("VO-7FQ-RUNTIME-SCHEDULER-RELEASE-ARCHIVE-REVIEW-1: renderer is safe and explicit", () => {
  const text = renderRuntimeSchedulerReleaseArchive(createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff()));

  assert.equal(text.includes("runtime scheduler release archive"), true);
  assert.equal(text.includes("Source commit hint: b086ae9b"), true);
  assert.equal(text.includes("package.json edited: false"), true);
  assert.equal(text.includes("Live scheduler enabled: false"), true);
  assert.equal(text.includes("Explicitly approve package metadata edits"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});

test("VO-7FQ-RUNTIME-SCHEDULER-RELEASE-ARCHIVE-REVIEW-2: revocation blocks archive", () => {
  const archive = createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff());
  const revoked = revokeRuntimeSchedulerReleaseArchive(archive);

  assert.equal(revoked.archive_state, "revoked");
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.archived_for_manual_follow_up, false);
});
