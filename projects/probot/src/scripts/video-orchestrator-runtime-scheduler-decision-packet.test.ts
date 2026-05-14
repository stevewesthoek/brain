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
import { createRuntimeSchedulerNextStepAdvisory } from "./video-orchestrator-runtime-scheduler-next-step-advisory.js";
import { createRuntimeSchedulerApprovalPrompt } from "./video-orchestrator-runtime-scheduler-approval-prompt.js";
import {
  createRuntimeSchedulerDecisionPacket,
  renderRuntimeSchedulerDecisionPacket,
  revokeRuntimeSchedulerDecisionPacket,
} from "./video-orchestrator-runtime-scheduler-decision-packet.js";

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
  source_commit_hint: "54318d29",
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

const PROMPT_INPUT = {
  prompt_id: "runtime-scheduler-approval-prompt-001",
  operator_id: "operator-runtime-scheduler-prompt-001",
  allow_prompt_only: true,
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

const PACKET_INPUT = {
  packet_id: "runtime-scheduler-decision-packet-001",
  operator_id: "operator-runtime-scheduler-decision-packet-001",
  allow_packet_only: true,
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

function advisory() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const checklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, checklist);
  const archive = createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff);
  const summary = createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive);
  return createRuntimeSchedulerNextStepAdvisory(ADVISORY_INPUT, createRuntimeSchedulerLifecycleManifest(), summary);
}

function prompt() {
  return createRuntimeSchedulerApprovalPrompt(PROMPT_INPUT, advisory());
}

test("VO-7FZ-RUNTIME-SCHEDULER-DECISION-PACKET-1: bundles advisory and prompt without side effects", () => {
  const next = advisory();
  const packet = createRuntimeSchedulerDecisionPacket(PACKET_INPUT, next, createRuntimeSchedulerApprovalPrompt(PROMPT_INPUT, next));

  assert.equal(packet.schema_version, "1.0");
  assert.equal(packet.packet_state, "ready_for_operator_decision");
  assert.equal(packet.packet_only, true);
  assert.equal(packet.requested_next_step, "approve_package_script");
  assert.equal(packet.recommendation.includes("package.json script edit"), true);
  assert.equal(packet.copy_paste_confirmation.includes("I approve editing projects/probot/package.json"), true);
  assert.equal(packet.package_json_edited, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.upload_execution_enabled, false);
  assert.equal(packet.network_enabled, false);
  assert.equal(packet.credential_access_enabled, false);
  assert.equal(packet.media_read_enabled, false);
  assert.equal(packet.file_write_enabled, false);
  assert.equal(packet.git_add_executed, false);
  assert.equal(packet.committed_now, false);
  assert.equal(packet.pushed_now, false);
  assert.equal(packet.validation.complete, true);
  assert.equal(packet.validation.ready_for_operator_decision, true);
});

test("VO-7GA-RUNTIME-SCHEDULER-DECISION-PACKET-REVIEW-1: unsafe packet flags block packet", () => {
  const packet = createRuntimeSchedulerDecisionPacket({ ...PACKET_INPUT, allow_commit: true as false }, advisory(), prompt());

  assert.equal(packet.packet_state, "blocked");
  assert.equal(packet.copy_paste_confirmation, "No confirmation available while blocked.");
  assert.equal(packet.package_json_edited, false);
  assert.equal(packet.live_scheduler_enabled, false);
  assert.equal(packet.validation.complete, false);
});

test("VO-7GA-RUNTIME-SCHEDULER-DECISION-PACKET-REVIEW-2: renderer and revocation are safe", () => {
  const next = advisory();
  const packet = createRuntimeSchedulerDecisionPacket(PACKET_INPUT, next, createRuntimeSchedulerApprovalPrompt(PROMPT_INPUT, next));
  const rendered = renderRuntimeSchedulerDecisionPacket(packet);
  const revoked = revokeRuntimeSchedulerDecisionPacket(packet);

  assert.equal(rendered.includes("runtime scheduler decision packet"), true);
  assert.equal(rendered.includes("Copy/paste confirmation"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.packet_state, "revoked");
  assert.equal(revoked.copy_paste_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
