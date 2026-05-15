import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditAuditCloseout, renderRuntimeSchedulerPackageScriptEditAuditCloseout, revokeRuntimeSchedulerPackageScriptEditAuditCloseout } from "./video-orchestrator-runtime-scheduler-package-script-edit-audit-closeout.js";
import type { RuntimeSchedulerPackageScriptEditExecutionAudit } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-audit.js";

const SAFE_AUDIT: RuntimeSchedulerPackageScriptEditExecutionAudit = {
  schema_version: "1.0",
  audit_id: "runtime-scheduler-package-script-edit-execution-audit-001",
  audit_state: "audit_ready_for_operator_review",
  audit_only: true,
  source_handoff_state: "ready_for_operator_execution_decision",
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  operator_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  audit_findings: [
    "Execution handoff is complete and scoped.",
    "The future edit target is limited to projects/probot/package.json.",
    "The runtime scheduler command remains summary-only.",
    "This audit did not perform package metadata edits, runtime activation, staging, commits, or pushes.",
  ],
  forbidden_actions: [
    "live scheduler activation",
    "uploads",
    "network calls",
    "credential access",
    "media reads",
    "persistent scheduler writes",
    "unrelated package metadata changes",
    "commits or pushes without separate verified git flow",
  ],
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
  validation: { complete: true, audit_ready_for_operator_review: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  closeout_id: "runtime-scheduler-package-script-edit-audit-closeout-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-audit-closeout-001",
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

test("VO-7HN-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-AUDIT-CLOSEOUT-1: closes audit at explicit package edit boundary", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditAuditCloseout(SAFE_INPUT, SAFE_AUDIT);

  assert.equal(closeout.schema_version, "1.0");
  assert.equal(closeout.closeout_state, "closed_for_explicit_package_json_edit_boundary");
  assert.equal(closeout.closeout_only, true);
  assert.equal(closeout.source_audit_state, "audit_ready_for_operator_review");
  assert.equal(closeout.package_json_path, "projects/probot/package.json");
  assert.equal(closeout.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(closeout.required_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(closeout.final_boundary.includes("Preparation is complete"), true);
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.live_scheduler_enabled, false);
  assert.equal(closeout.upload_execution_enabled, false);
  assert.equal(closeout.network_enabled, false);
  assert.equal(closeout.credential_access_enabled, false);
  assert.equal(closeout.media_read_enabled, false);
  assert.equal(closeout.file_write_enabled, false);
  assert.equal(closeout.git_add_executed, false);
  assert.equal(closeout.committed_now, false);
  assert.equal(closeout.pushed_now, false);
  assert.equal(closeout.validation.complete, true);
});

test("VO-7HO-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-AUDIT-CLOSEOUT-REVIEW-1: unsafe flags block closeout", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditAuditCloseout({ ...SAFE_INPUT, allow_package_json_edit: true as false }, SAFE_AUDIT);

  assert.equal(closeout.closeout_state, "blocked");
  assert.equal(closeout.required_confirmation, "No confirmation available while blocked.");
  assert.equal(closeout.package_json_edited, false);
  assert.equal(closeout.validation.complete, false);
});

test("VO-7HO-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-AUDIT-CLOSEOUT-REVIEW-2: renderer and revocation are safe", () => {
  const closeout = createRuntimeSchedulerPackageScriptEditAuditCloseout(SAFE_INPUT, SAFE_AUDIT);
  const rendered = renderRuntimeSchedulerPackageScriptEditAuditCloseout(closeout);
  const revoked = revokeRuntimeSchedulerPackageScriptEditAuditCloseout(closeout);

  assert.equal(rendered.includes("package script edit audit closeout"), true);
  assert.equal(rendered.includes("Final boundary"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Live scheduler enabled: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.closeout_state, "revoked");
  assert.equal(revoked.required_confirmation, "No confirmation available while revoked.");
  assert.equal(revoked.validation.complete, false);
});
