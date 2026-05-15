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
import { createRuntimeSchedulerDecisionPacket } from "./video-orchestrator-runtime-scheduler-decision-packet.js";
import { createRuntimeSchedulerManualApprovalChecklist } from "./video-orchestrator-runtime-scheduler-manual-approval-checklist.js";
import { createRuntimeSchedulerApprovalOutcome } from "./video-orchestrator-runtime-scheduler-approval-outcome.js";
import { createRuntimeSchedulerOutcomeCloseout } from "./video-orchestrator-runtime-scheduler-outcome-closeout.js";
import { createRuntimeSchedulerOutcomeLedgerEntry } from "./video-orchestrator-runtime-scheduler-outcome-ledger.js";
import { createRuntimeSchedulerLedgerReview } from "./video-orchestrator-runtime-scheduler-ledger-review.js";
import { createRuntimeSchedulerReviewCloseout } from "./video-orchestrator-runtime-scheduler-review-closeout.js";
import {
  createRuntimeSchedulerReviewLedgerEntry,
  renderRuntimeSchedulerReviewLedgerEntry,
  revokeRuntimeSchedulerReviewLedgerEntry,
} from "./video-orchestrator-runtime-scheduler-review-ledger.js";

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
  source_commit_hint: "18a3027a",
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

const MANUAL_CHECKLIST_INPUT = {
  checklist_id: "runtime-scheduler-manual-approval-checklist-001",
  operator_id: "operator-runtime-scheduler-manual-checklist-001",
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

const OUTCOME_INPUT = {
  outcome_id: "runtime-scheduler-approval-outcome-001",
  operator_id: "operator-runtime-scheduler-outcome-001",
  decision: "approved_for_package_script_planning",
  rationale: "Operator wants package script planning next, without package.json edits yet.",
  allow_outcome_only: true,
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

const CLOSEOUT_INPUT = {
  closeout_id: "runtime-scheduler-outcome-closeout-001",
  operator_id: "operator-runtime-scheduler-closeout-001",
  allow_closeout_only: true,
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

const LEDGER_INPUT = {
  ledger_id: "runtime-scheduler-outcome-ledger-001",
  operator_id: "operator-runtime-scheduler-ledger-001",
  recorded_at: "2026-05-15T08:30:00.000Z",
  allow_ledger_only: true,
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

const REVIEW_INPUT = {
  review_id: "runtime-scheduler-ledger-review-001",
  operator_id: "operator-runtime-scheduler-ledger-review-001",
  allow_review_only: true,
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

const REVIEW_CLOSEOUT_INPUT = {
  closeout_id: "runtime-scheduler-review-closeout-001",
  operator_id: "operator-runtime-scheduler-review-closeout-001",
  allow_closeout_only: true,
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

const REVIEW_LEDGER_INPUT = {
  ledger_id: "runtime-scheduler-review-ledger-001",
  operator_id: "operator-runtime-scheduler-review-ledger-001",
  recorded_at: "2026-05-15T08:45:00.000Z",
  allow_ledger_only: true,
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

function closeout() {
  const plan = createRuntimeSchedulerPackageScriptPlan(PLAN_INPUT);
  const gate = createRuntimeSchedulerPackageScriptApprovalGate(APPROVAL_INPUT, plan);
  const releaseChecklist = createRuntimeSchedulerReleaseChecklist(CHECKLIST_INPUT, gate, createRuntimeSchedulerSmokeMatrix());
  const handoff = createRuntimeSchedulerReleaseHandoff(HANDOFF_INPUT, releaseChecklist);
  const archive = createRuntimeSchedulerReleaseArchive(ARCHIVE_INPUT, handoff);
  const summary = createRuntimeSchedulerTerminalSummary(SUMMARY_INPUT, archive);
  const advisory = createRuntimeSchedulerNextStepAdvisory(ADVISORY_INPUT, createRuntimeSchedulerLifecycleManifest(), summary);
  const prompt = createRuntimeSchedulerApprovalPrompt(PROMPT_INPUT, advisory);
  const packet = createRuntimeSchedulerDecisionPacket(PACKET_INPUT, advisory, prompt);
  const checklist = createRuntimeSchedulerManualApprovalChecklist(MANUAL_CHECKLIST_INPUT, packet);
  const outcome = createRuntimeSchedulerApprovalOutcome(OUTCOME_INPUT, checklist);
  const outcomeCloseout = createRuntimeSchedulerOutcomeCloseout(CLOSEOUT_INPUT, outcome);
  const ledger = createRuntimeSchedulerOutcomeLedgerEntry(LEDGER_INPUT, outcomeCloseout);
  const review = createRuntimeSchedulerLedgerReview(REVIEW_INPUT, ledger);
  return createRuntimeSchedulerReviewCloseout(REVIEW_CLOSEOUT_INPUT, review);
}

test("VO-7GN-RUNTIME-SCHEDULER-REVIEW-LEDGER-1: creates review ledger entry from closeout without side effects", () => {
  const entry = createRuntimeSchedulerReviewLedgerEntry(REVIEW_LEDGER_INPUT, closeout());

  assert.equal(entry.schema_version, "1.0");
  assert.equal(entry.ledger_state, "review_ledger_entry_ready");
  assert.equal(entry.ledger_only, true);
  assert.equal(entry.recorded_at, "2026-05-15T08:45:00.000Z");
  assert.equal(entry.decision, "approved_for_package_script_planning");
  assert.equal(entry.source_closeout_state, "closed_for_operator_boundary");
  assert.equal(entry.package_json_edited, false);
  assert.equal(entry.live_scheduler_enabled, false);
  assert.equal(entry.upload_execution_enabled, false);
  assert.equal(entry.network_enabled, false);
  assert.equal(entry.credential_access_enabled, false);
  assert.equal(entry.media_read_enabled, false);
  assert.equal(entry.file_write_enabled, false);
  assert.equal(entry.git_add_executed, false);
  assert.equal(entry.committed_now, false);
  assert.equal(entry.pushed_now, false);
  assert.equal(entry.validation.complete, true);
  assert.equal(entry.validation.review_ledger_entry_ready, true);
});

test("VO-7GO-RUNTIME-SCHEDULER-REVIEW-LEDGER-REVIEW-1: unsafe flags block review ledger", () => {
  const entry = createRuntimeSchedulerReviewLedgerEntry({ ...REVIEW_LEDGER_INPUT, allow_upload_execution: true as false }, closeout());

  assert.equal(entry.ledger_state, "blocked");
  assert.equal(entry.upload_execution_enabled, false);
  assert.equal(entry.validation.complete, false);
});

test("VO-7GO-RUNTIME-SCHEDULER-REVIEW-LEDGER-REVIEW-2: renderer and revocation are safe", () => {
  const entry = createRuntimeSchedulerReviewLedgerEntry(REVIEW_LEDGER_INPUT, closeout());
  const rendered = renderRuntimeSchedulerReviewLedgerEntry(entry);
  const revoked = revokeRuntimeSchedulerReviewLedgerEntry(entry);

  assert.equal(rendered.includes("runtime scheduler review ledger entry"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.ledger_state, "revoked");
  assert.equal(revoked.validation.complete, false);
});
