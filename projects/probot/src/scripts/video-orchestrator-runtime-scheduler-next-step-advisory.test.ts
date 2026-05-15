import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptPlan } from "./video-orchestrator-runtime-scheduler-package-script-plan.js";
import { createRuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import { createRuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";
import { createRuntimeSchedulerReleaseChecklist } from "./video-orchestrator-runtime-scheduler-release-checklist.js";
import { createRuntimeSchedulerReleaseHandoff } from "./video-orchestrator-runtime-scheduler-release-handoff.js";
import { createRuntimeSchedulerReleaseArchive } from "./video-orchestrator-runtime-scheduler-release-archive.js";
import { createRuntimeSchedulerTerminalSummary } from "./video-orchestrator-runtime-scheduler-terminal-summary.js";
import { createRuntimeSchedulerLifecycleManifest } from "./video-orchestrator-runtime-scheduler-lifecycle-manifest.js";
import {
  createRuntimeSchedulerNextStepAdvisory,
  renderRuntimeSchedulerNextStepAdvisory,
  revokeRuntimeSchedulerNextStepAdvisory,
} from "./video-orchestrator-runtime-scheduler-next-step-advisory.js";

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
  source_commit_hint: "510f245f",
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

const ADVISORY_INPUT = {
  advisory_id: "runtime-scheduler-next-step-advisory-001",
  operator_id: "operator-runtime-scheduler-next-step-001",
  requested_next_step: "approve_package_script",
  allow_advisory_only: true,
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

function terminalSummary() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist);
  const archive = createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff);
  return createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive);
}

test("VO-7FV-RUNTIME-SCHEDULER-NEXT-STEP-ADVISORY-1: recognizes installed package script without side effects", () => {
  const advisory = createRuntimeSchedulerNextStepAdvisory(ADVISORY_INPUT, createRuntimeSchedulerLifecycleManifest(), terminalSummary());

  assert.equal(advisory.schema_version, "1.0");
  assert.equal(advisory.advisory_state, "manual_action_required");
  assert.equal(advisory.advisory_only, true);
  assert.equal(advisory.requested_next_step, "approve_package_script");
  assert.equal(advisory.recommendation.includes("package script is already installed"), true);
  assert.equal(advisory.required_confirmation.includes("No package script edit approval needed"), true);
  assert.equal(advisory.package_json_edited, true);
  assert.equal(advisory.live_scheduler_enabled, false);
  assert.equal(advisory.upload_execution_enabled, false);
  assert.equal(advisory.network_enabled, false);
  assert.equal(advisory.credential_access_enabled, false);
  assert.equal(advisory.media_read_enabled, false);
  assert.equal(advisory.file_write_enabled, false);
  assert.equal(advisory.git_add_executed, false);
  assert.equal(advisory.committed_now, false);
  assert.equal(advisory.pushed_now, false);
  assert.equal(advisory.validation.complete, true);
  assert.equal(advisory.validation.manual_action_required, true);
});

test("VO-7FV-RUNTIME-SCHEDULER-NEXT-STEP-ADVISORY-2: supports other safe next-step recommendations", () => {
  const persistent = createRuntimeSchedulerNextStepAdvisory({ ...ADVISORY_INPUT, requested_next_step: "approve_persistent_store" }, createRuntimeSchedulerLifecycleManifest(), terminalSummary());
  const live = createRuntimeSchedulerNextStepAdvisory({ ...ADVISORY_INPUT, requested_next_step: "approve_live_scheduler" }, createRuntimeSchedulerLifecycleManifest(), terminalSummary());
  const disabled = createRuntimeSchedulerNextStepAdvisory({ ...ADVISORY_INPUT, requested_next_step: "keep_disabled" }, createRuntimeSchedulerLifecycleManifest(), terminalSummary());

  assert.equal(persistent.recommendation.includes("persistent scheduler store"), true);
  assert.equal(live.recommendation.includes("Keep live scheduler disabled"), true);
  assert.equal(disabled.recommendation.includes("Keep the runtime scheduler disabled"), true);
});

test("VO-7FW-RUNTIME-SCHEDULER-NEXT-STEP-ADVISORY-REVIEW-1: unsafe flags block advisory", () => {
  const advisory = createRuntimeSchedulerNextStepAdvisory({ ...ADVISORY_INPUT, allow_package_json_edit: true as false }, createRuntimeSchedulerLifecycleManifest(), terminalSummary());

  assert.equal(advisory.advisory_state, "blocked");
  assert.equal(advisory.package_json_edited, false);
  assert.equal(advisory.live_scheduler_enabled, false);
  assert.equal(advisory.validation.complete, false);
});

test("VO-7FW-RUNTIME-SCHEDULER-NEXT-STEP-ADVISORY-REVIEW-2: renderer and revocation are safe", () => {
  const advisory = createRuntimeSchedulerNextStepAdvisory(ADVISORY_INPUT, createRuntimeSchedulerLifecycleManifest(), terminalSummary());
  const rendered = renderRuntimeSchedulerNextStepAdvisory(advisory);
  const revoked = revokeRuntimeSchedulerNextStepAdvisory(advisory);

  assert.equal(rendered.includes("runtime scheduler next-step advisory"), true);
  assert.equal(rendered.includes("package.json edited: true"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.advisory_state, "revoked");
  assert.equal(revoked.validation.complete, false);
});
