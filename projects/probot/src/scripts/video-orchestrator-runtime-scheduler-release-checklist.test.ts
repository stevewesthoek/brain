import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import { createRuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import { createRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";
import {
  createRuntimeSchedulerReleaseChecklist,
  renderRuntimeSchedulerReleaseChecklist,
  revokeRuntimeSchedulerReleaseChecklist,
} from "./video-orchestrator-runtime-scheduler-release-checklist.js";

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

function gate() {
  return createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT));
}

test("VO-7FL-RUNTIME-SCHEDULER-RELEASE-CHECKLIST-1: creates manual release checklist from approval gate and smoke matrix", () => {
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate(), createRuntimeSchedulerSmokeMatrix());

  assert.equal(checklist.schema_version, "1.0");
  assert.equal(checklist.checklist_state, "ready_for_manual_release_review");
  assert.equal(checklist.checklist_only, true);
  assert.equal(checklist.items.length, 3);
  assert.equal(checklist.items.every((item) => item.complete), true);
  assert.equal(checklist.package_json_edited, true);
  assert.equal(checklist.live_scheduler_enabled, false);
  assert.equal(checklist.upload_execution_enabled, false);
  assert.equal(checklist.network_enabled, false);
  assert.equal(checklist.credential_access_enabled, false);
  assert.equal(checklist.media_read_enabled, false);
  assert.equal(checklist.file_write_enabled, false);
  assert.equal(checklist.git_add_executed, false);
  assert.equal(checklist.committed_now, false);
  assert.equal(checklist.pushed_now, false);
  assert.equal(checklist.validation.complete, true);
  assert.equal(checklist.validation.ready_for_manual_release_review, true);
});

test("VO-7FL-RUNTIME-SCHEDULER-RELEASE-CHECKLIST-2: mismatched script blocks checklist", () => {
  const checklist = createRuntimeSchedulerReleaseChecklist({ ...CHECKLIST_INPUT, expected_script_name: "probot:video:other" }, gate(), createRuntimeSchedulerSmokeMatrix());

  assert.equal(checklist.checklist_state, "blocked");
  assert.equal(checklist.items.some((item) => !item.complete), true);
  assert.equal(checklist.validation.complete, false);
  assert.equal(checklist.package_json_edited, false);
  assert.equal(checklist.live_scheduler_enabled, false);
});

test("VO-7FM-RUNTIME-SCHEDULER-RELEASE-CHECKLIST-REVIEW-1: rendered checklist is safe and explicit", () => {
  const text = renderRuntimeSchedulerReleaseChecklist(createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate(), createRuntimeSchedulerSmokeMatrix()));

  assert.equal(text.includes("runtime scheduler release checklist"), true);
  assert.equal(text.includes("package.json edited: true"), true);
  assert.equal(text.includes("Live scheduler enabled: false"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});

test("VO-7FM-RUNTIME-SCHEDULER-RELEASE-CHECKLIST-REVIEW-2: revocation blocks release checklist", () => {
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate(), createRuntimeSchedulerSmokeMatrix());
  const revoked = revokeRuntimeSchedulerReleaseChecklist(checklist);

  assert.equal(revoked.checklist_state, "revoked");
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.ready_for_manual_release_review, false);
});
