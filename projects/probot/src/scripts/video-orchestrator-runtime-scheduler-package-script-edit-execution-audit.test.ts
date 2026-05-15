import { test } from "node:test";
import assert from "node:assert";
import { createRuntimeSchedulerPackageScriptEditExecutionAudit, renderRuntimeSchedulerPackageScriptEditExecutionAudit, revokeRuntimeSchedulerPackageScriptEditExecutionAudit } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-audit.js";
import type { RuntimeSchedulerPackageScriptEditExecutionHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.js";

const SAFE_HANDOFF: RuntimeSchedulerPackageScriptEditExecutionHandoff = {
  schema_version: "1.0",
  handoff_id: "runtime-scheduler-package-script-edit-execution-handoff-001",
  handoff_state: "ready_for_operator_execution_decision",
  handoff_only: true,
  package_json_path: "projects/probot/package.json",
  commit_message: "Add Video Orchestrator runtime scheduler package script",
  operator_confirmation: "I approve the scoped projects/probot/package.json script edit execution only, with no live scheduler activation, uploads, network calls, credential access, media reads, unrelated metadata changes, commits, or pushes unless separately confirmed.",
  execution_scope: [
    "Future execution may edit only projects/probot/package.json.",
    "Future execution may add only probot:video:runtime-scheduler to scripts.",
    "Future execution must keep the command as tsx src/scripts/video-orchestrator-runtime-scheduler.mjs summary.",
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
  validation: { complete: true, ready_for_operator_execution_decision: true, blocking_reasons: [], warnings: [] },
};

const SAFE_INPUT = {
  audit_id: "runtime-scheduler-package-script-edit-execution-audit-001",
  operator_id: "operator-runtime-scheduler-package-script-edit-execution-audit-001",
  allow_audit_only: true,
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

test("VO-7HL-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-AUDIT-1: creates execution audit without side effects", () => {
  const audit = createRuntimeSchedulerPackageScriptEditExecutionAudit(SAFE_INPUT, SAFE_HANDOFF);

  assert.equal(audit.schema_version, "1.0");
  assert.equal(audit.audit_state, "audit_ready_for_operator_review");
  assert.equal(audit.audit_only, true);
  assert.equal(audit.source_handoff_state, "ready_for_operator_execution_decision");
  assert.equal(audit.package_json_path, "projects/probot/package.json");
  assert.equal(audit.commit_message, "Add Video Orchestrator runtime scheduler package script");
  assert.equal(audit.operator_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only"), true);
  assert.equal(audit.audit_findings.length, 4);
  assert.equal(audit.forbidden_actions.includes("live scheduler activation"), true);
  assert.equal(audit.package_json_edited, false);
  assert.equal(audit.live_scheduler_enabled, false);
  assert.equal(audit.upload_execution_enabled, false);
  assert.equal(audit.network_enabled, false);
  assert.equal(audit.credential_access_enabled, false);
  assert.equal(audit.media_read_enabled, false);
  assert.equal(audit.file_write_enabled, false);
  assert.equal(audit.git_add_executed, false);
  assert.equal(audit.committed_now, false);
  assert.equal(audit.pushed_now, false);
  assert.equal(audit.validation.complete, true);
});

test("VO-7HM-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-AUDIT-REVIEW-1: unsafe flags block audit", () => {
  const audit = createRuntimeSchedulerPackageScriptEditExecutionAudit({ ...SAFE_INPUT, allow_commit: true as false }, SAFE_HANDOFF);

  assert.equal(audit.audit_state, "blocked");
  assert.deepEqual(audit.audit_findings, []);
  assert.equal(audit.committed_now, false);
  assert.equal(audit.validation.complete, false);
});

test("VO-7HM-RUNTIME-SCHEDULER-PACKAGE-SCRIPT-EDIT-EXECUTION-AUDIT-REVIEW-2: renderer and revocation are safe", () => {
  const audit = createRuntimeSchedulerPackageScriptEditExecutionAudit(SAFE_INPUT, SAFE_HANDOFF);
  const rendered = renderRuntimeSchedulerPackageScriptEditExecutionAudit(audit);
  const revoked = revokeRuntimeSchedulerPackageScriptEditExecutionAudit(audit);

  assert.equal(rendered.includes("package script edit execution audit"), true);
  assert.equal(rendered.includes("Audit findings"), true);
  assert.equal(rendered.includes("Forbidden actions"), true);
  assert.equal(rendered.includes("package.json edited: false"), true);
  assert.equal(rendered.includes("Committed now: false"), true);
  assert.equal(rendered.includes("Pushed now: false"), true);
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(revoked.audit_state, "revoked");
  assert.deepEqual(revoked.audit_findings, []);
  assert.equal(revoked.validation.complete, false);
});
