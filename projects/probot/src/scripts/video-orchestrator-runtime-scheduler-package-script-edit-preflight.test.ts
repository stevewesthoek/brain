import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditPreflight, renderRuntimeSchedulerPackageScriptEditPreflight, revokeRuntimeSchedulerPackageScriptEditPreflight } from "./video-orchestrator-runtime-scheduler-package-script-edit-preflight.js";
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

const SAFE_INPUT = {
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

test("VO-7GR-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREFLIGHT-1: prepares guarded package script edit without side effects", () => {
  const preflight = createRuntimeSchedulerPackageScriptEditPreflight(SAFE_INPUT, SAFE_SUMMARY);

  assert.equal(preflight.schema_version, "1.0");
  assert.equal(preflight.preflight_state, "ready_for_explicit_package_json_edit_approval");
  assert.equal(preflight.preflight_only, true);
  assert.deepEqual(preflight.proposed_scripts_entry, { "probot:video:runtime-scheduler": "tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary" });
  assert.equal(preflight.package_json_edited, false);
  assert.equal(preflight.live_scheduler_enabled, false);
  assert.equal(preflight.upload_execution_enabled, false);
  assert.equal(preflight.network_enabled, false);
  assert.equal(preflight.credential_access_enabled, false);
  assert.equal(preflight.media_read_enabled, false);
  assert.equal(preflight.file_write_enabled, false);
  assert.equal(preflight.git_add_executed, false);
  assert.equal(preflight.committed_now, false);
  assert.equal(preflight.pushed_now, false);
  assert.equal(preflight.required_confirmation.includes("I approve editing projects/probot/package.json"), true);
  assert.equal(preflight.validation.complete, true);
});

test("VO-7GS-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREFLIGHT-REVIEW-1: unsafe input blocks preflight", () => {
  const preflight = createRuntimeSchedulerPackageScriptEditPreflight({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_SUMMARY);

  assert.equal(preflight.preflight_state, "blocked");
  assert.deepEqual(preflight.proposed_scripts_entry, {});
  assert.equal(preflight.package_json_edited, false);
  assert.equal(preflight.validation.complete, false);
});

test("VO-7GS-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-PREFLIGHT-REVIEW-2: renderer and revocation are safe", () => {
  const preflight = createRuntimeSchedulerPackageScriptEditPreflight(SAFE_INPUT, SAFE_SUMMARY);
  const rendered = renderRuntimeSchedulerPackageScriptEditPreflight(preflight);
  const revoked = revokeRuntimeSchedulerPackageScriptEditPreflight(preflight);

  assert.equal(rendered.includes("package script edit preflight"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.preflight_state, "revoked");
  assert.deepEqual(revoked.proposed_scripts_entry, {});
  assert.equal(revoked.validation.complete, false);
});
