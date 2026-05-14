import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import { createRuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import { createRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";
import { createRuntimeSchedulerReleaseChecklist } from "./video-orchestrator-runtime-scheduler-release-checklist.js";
import {
  createRuntimeSchedulerReleaseHandoff,
  renderRuntimeSchedulerReleaseHandoff,
  revokeRuntimeSchedulerReleaseHandoff,
} from "./video-orchestrator-runtime-scheduler-release-handoff.js";

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

function checklist() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  return createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
}

test("VO-7FN-RUNTIME-SCHEDULER-RELEASE-HANDOFF-1: creates safe operator handoff from checklist", () => {
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist());

  assert.equal(handoff.schema_version, "1.0");
  assert.equal(handoff.handoff_state, "ready_for_operator_handoff");
  assert.equal(handoff.handoff_only, true);
  assert.equal(handoff.checklist_state, "ready_for_manual_release_review");
  assert.equal(handoff.checklist_item_count, 3);
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
  assert.equal(handoff.validation.ready_for_operator_handoff, true);
});

test("VO-7FN-RUNTIME-SCHEDULER-RELEASE-HANDOFF-2: unsafe handoff flags block handoff", () => {
  const handoff = createRuntimeSchedulerReleaseHandoff({ ...HANDOFF_INPUT, allow_package_json_edit: true as false }, checklist());

  assert.equal(handoff.handoff_state, "blocked");
  assert.equal(handoff.package_json_edited, false);
  assert.equal(handoff.live_scheduler_enabled, false);
  assert.equal(handoff.validation.complete, false);
});

test("VO-7FO-RUNTIME-SCHEDULER-RELEASE-HANDOFF-REVIEW-1: renderer is safe and explicit", () => {
  const text = renderRuntimeSchedulerReleaseHandoff(createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist()));

  assert.equal(text.includes("runtime scheduler release handoff"), true);
  assert.equal(text.includes("package.json edited: false"), true);
  assert.equal(text.includes("Live scheduler enabled: false"), true);
  assert.equal(text.includes("Next manual step"), true);
  assert.equal(text.includes("access_token"), false);
  assert.equal(text.includes("client_secret"), false);
  assert.equal(text.includes("api_key"), false);
});

test("VO-7FO-RUNTIME-SCHEDULER-RELEASE-HANDOFF-REVIEW-2: revocation blocks handoff", () => {
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist());
  const revoked = revokeRuntimeSchedulerReleaseHandoff(handoff);

  assert.equal(revoked.handoff_state, "revoked");
  assert.equal(revoked.validation.complete, false);
  assert.equal(revoked.validation.ready_for_operator_handoff, false);
});
