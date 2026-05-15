import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditPreflight } from "./video-orchestrator-runtime-scheduler-package-script-edit-preflight.js";
import { createRuntimeSchedulerPackageScriptEditApprovalPrompt, renderRuntimeSchedulerPackageScriptEditApprovalPrompt, revokeRuntimeSchedulerPackageScriptEditApprovalPrompt } from "./video-orchestrator-runtime-scheduler-package-script-edit-approval-prompt.js";
import type { RuntimeSchedulerFinalReviewSummary } from "./video-orchestrator-runtime-scheduler-final-review-summary.js";

const SAFE_SUMMARY: RuntimeSchedulerFinalReviewSummary = {
  schema_version: "1.0",
  summary_id: "runtime-scheduler-final-review-summary-001",
  summary_state: "manual_boundary_confirmed",
  summary_only: true,
  source_ledger_state: "review_ledger_entry_ready",
  decision: "approved_for_package_script_planning",
  final_status: "Approval recorded for package-script planning only; package.json edits remain a separate guarded action.",
  manual_boundary: "Package script implementation still requires a separate package.json edit action and scoped validation.",
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
  next_required_operator_action: "Provide a separate explicit approval before package.json edits, persistent scheduler writes, live scheduler activation, uploads, network calls, credential access, or media reads.",
  validation: { complete: true, manual_boundary_confirmed: true, blocking_reasons: [], warnings: [] },
};

const PREFLIGHT_INPUT = {
  preflight_id: "runtime-scheduler-package-script-edit-preflight-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-001",
  package_json_path: "projects/probot/package.json",
  script_name: "probot:video:runtime-scheduler",
  script_command: "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary",
  allow_preflight_only: true,
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
  prompt_id: "runtime-scheduler-package-script-edit-approval-prompt-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-prompt-001",
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

function safePreflight() {
  return createRuntimeSchedulerPackageScriptEditPreflight(PREFLIGHT_INPUT, SAFE_SUMMARY);
}

test("VO-7GT-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-APPROVAL-PROMPT-1: builds package edit confirmation prompt without side effects", () => {
  const prompt = createRuntimeSchedulerPackageScriptEditApprovalPrompt(PROMPT_INPUT, safePreflight());

  assert.equal(prompt.schema_version, "1.0");
  assert.equal(prompt.prompt_state, "ready_for_operator_copy_paste");
  assert.equal(prompt.prompt_only, true);
  assert.equal(prompt.package_json_path, "projects/probot/package.json");
  assert.equal(prompt.script_name, "probot:video:runtime-scheduler");
  assert.equal(prompt.script_command, "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary");
  assert.equal(prompt.copy_paste_confirmation.includes("I approve editing projects/probot/package.json"), true);
  assert.equal(prompt.package_json_edited, false);
  assert.equal(prompt.live_scheduler_enabled, false);
  assert.equal(prompt.upload_execution_enabled, false);
  assert.equal(prompt.network_enabled, false);
  assert.equal(prompt.credential_access_enabled, false);
  assert.equal(prompt.media_read_enabled, false);
  assert.equal(prompt.file_write_enabled, false);
  assert.equal(prompt.git_add_executed, false);
  assert.equal(prompt.committed_now, false);
  assert.equal(prompt.pushed_now, false);
  assert.equal(prompt.validation.complete, true);
});

test("VO-7GU-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-APPROVAL-PROMPT-REVIEW-1: unsafe flags block approval prompt", () => {
  const prompt = createRuntimeSchedulerPackageScriptEditApprovalPrompt({ ...PROMPT_INPUT, allow_package_json_edit: true as false }, safePreflight());

  assert.equal(prompt.prompt_state, "blocked");
  assert.equal(prompt.copy_paste_confirmation, "No confirmation available while blocked.");
  assert.equal(prompt.package_json_edited, false);
  assert.equal(prompt.validation.complete, false);
});

test("VO-7GU-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-APPROVAL-PROMPT-REVIEW-2: renderer and revocation are safe", () => {
  const prompt = createRuntimeSchedulerPackageScriptEditApprovalPrompt(PROMPT_INPUT, safePreflight());
  const rendered = renderRuntimeSchedulerPackageScriptEditApprovalPrompt(prompt);
  const revoked = revokeRuntimeSchedulerPackageScriptEditApprovalPrompt(prompt);

  assert.equal(rendered.includes("package script edit approval prompt"), true);
  assert.equal(rendered.includes("Copy/paste confirmation"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.prompt_state, "revoked");
  assert.equal(revoked.copy_paste_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
