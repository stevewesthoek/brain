import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import {
  createRuntimeSchedulerPackageScriptApprovalGate,
  renderRuntimeSchedulerPackageScriptApprovalGate,
  revokeRuntimeSchedulerPackageScriptApprovalGate,
} from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";

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

test("VO-7FJ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-APPROVAL-1: gate requires explicit package metadata approval", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);

  assert.equal(gate.schema_version, "1.0");
  assert.equal(gate.approval_state, "ready_for_explicit_package_metadata_approval");
  assert.equal(gate.gate_only, true);
  assert.equal(gate.package_name, "probot");
  assert.equal(gate.script_name, "probot:video:runtime-scheduler");
  assert.equal(gate.command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  assert.equal(gate.package_json_edited, false);
  assert.equal(gate.explicit_package_metadata_approval_required, true);
  assert.equal(gate.live_scheduler_enabled, false);
  assert.equal(gate.upload_execution_enabled, false);
  assert.equal(gate.network_enabled, false);
  assert.equal(gate.credential_access_enabled, false);
  assert.equal(gate.media_read_enabled, false);
  assert.equal(gate.git_add_executed, false);
  assert.equal(gate.committed_now, false);
  assert.equal(gate.pushed_now, false);
  assert.equal(gate.validation.complete, true);
  assert.equal(gate.validation.ready_for_manual_approval, true);
});

test("VO-7FJ-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-APPROVAL-2: mismatched script blocks gate", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate({ ...APPROVAL_INPUT, reviewed_script_name: "probot:video:other" }, plan);

  assert.equal(gate.approval_state, "blocked");
  assert.equal(gate.command, null);
  assert.equal(gate.package_json_edited, false);
  assert.equal(gate.validation.complete, false);
  assert.equal(gate.validation.ready_for_manual_approval, false);
});

test("VO-7FK-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-APPROVAL-REVIEW-1: renderer is safe and explicit", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const rendered = renderRuntimeSchedulerPackageScriptApprovalGate(gate);

  assert.equal(rendered.includes("package script approval gate"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Explicit package metadata approval required: true"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
});

test("VO-7FK-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-APPROVAL-REVIEW-2: revocation disables command", () => {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const revoked = revokeRuntimeSchedulerPackageScriptApprovalGate(gate);

  assert.equal(revoked.approval_state, "revoked");
  assert.equal(revoked.command, null);
  assert.equal(revoked.package_json_edited, false);
  assert.equal(revoked.validation.complete, false);
});
