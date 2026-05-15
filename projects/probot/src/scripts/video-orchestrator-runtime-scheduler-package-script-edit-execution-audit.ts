import type { RuntimeSchedulerPackageScriptEditExecutionHandoff } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-handoff.js";

export type RuntimeSchedulerPackageScriptEditExecutionAuditState = "audit_ready_for_operator_review" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditExecutionAuditInput {
  audit_id: string;
  operator_id: string;
  allow_audit_only: true;
  allow_package_json_edit: false;
  allow_live_scheduler: false;
  allow_upload_execution: false;
  allow_network: false;
  allow_credential_access: false;
  allow_media_read: false;
  allow_file_write: false;
  allow_git_add: false;
  allow_commit: false;
  allow_push: false;
}

export interface RuntimeSchedulerPackageScriptEditExecutionAudit {
  schema_version: "1.0";
  audit_id: string;
  audit_state: RuntimeSchedulerPackageScriptEditExecutionAuditState;
  audit_only: true;
  source_handoff_state: RuntimeSchedulerPackageScriptEditExecutionHandoff["handoff_state"];
  package_json_path: string;
  commit_message: string;
  operator_confirmation: string;
  audit_findings: string[];
  forbidden_actions: string[];
  package_json_edited: false;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; audit_ready_for_operator_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 420) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditExecutionAuditInput): boolean {
  return input.allow_audit_only === true
    && input.allow_package_json_edit === false
    && input.allow_live_scheduler === false
    && input.allow_upload_execution === false
    && input.allow_network === false
    && input.allow_credential_access === false
    && input.allow_media_read === false
    && input.allow_file_write === false
    && input.allow_git_add === false
    && input.allow_commit === false
    && input.allow_push === false
    && input.audit_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function handoffReady(handoff: RuntimeSchedulerPackageScriptEditExecutionHandoff): boolean {
  return handoff.schema_version === "1.0"
    && handoff.handoff_state === "ready_for_operator_execution_decision"
    && handoff.handoff_only
    && handoff.validation.complete
    && handoff.validation.ready_for_operator_execution_decision
    && handoff.package_json_path === "projects/probot/package.json"
    && handoff.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && handoff.operator_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && handoff.execution_scope.length > 0
    && handoff.forbidden_actions.length > 0
    && !handoff.package_json_edited
    && !handoff.live_scheduler_enabled
    && !handoff.upload_execution_enabled
    && !handoff.network_enabled
    && !handoff.credential_access_enabled
    && !handoff.media_read_enabled
    && !handoff.file_write_enabled
    && !handoff.git_add_executed
    && !handoff.committed_now
    && !handoff.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditExecutionAudit(input: RuntimeSchedulerPackageScriptEditExecutionAuditInput, handoff: RuntimeSchedulerPackageScriptEditExecutionHandoff): RuntimeSchedulerPackageScriptEditExecutionAudit {
  const ready = inputReady(input) && handoffReady(handoff);
  return {
    schema_version: "1.0",
    audit_id: safe(input.audit_id, "runtime-scheduler-package-script-edit-execution-audit"),
    audit_state: ready ? "audit_ready_for_operator_review" : "blocked",
    audit_only: true,
    source_handoff_state: handoff.handoff_state,
    package_json_path: safe(handoff.package_json_path, "projects/probot/package.json"),
    commit_message: safe(handoff.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    operator_confirmation: ready ? handoff.operator_confirmation : "No confirmation available while blocked.",
    audit_findings: ready ? [
      "Execution handoff is complete and scoped.",
      "The future edit target is limited to projects/probot/package.json.",
      "The runtime scheduler command remains summary-only.",
      "This audit did not perform package metadata edits, runtime activation, staging, commits, or pushes.",
    ] : [],
    forbidden_actions: handoff.forbidden_actions,
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
    validation: { complete: ready, audit_ready_for_operator_review: ready, blocking_reasons: ready ? [] : ["Package script edit execution audit input or handoff was unsafe/incomplete."], warnings: ["Audit only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditExecutionAudit(audit: RuntimeSchedulerPackageScriptEditExecutionAudit, reason?: string): RuntimeSchedulerPackageScriptEditExecutionAudit {
  return { ...audit, audit_state: "revoked", operator_confirmation: "No confirmation available while revoked.", audit_findings: [], validation: { complete: false, audit_ready_for_operator_review: false, blocking_reasons: audit.validation.blocking_reasons, warnings: [...audit.validation.warnings, safe(reason, "Package script edit execution audit was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditExecutionAudit(audit: RuntimeSchedulerPackageScriptEditExecutionAudit): string {
  return [
    "Video Orchestrator runtime scheduler package script edit execution audit",
    `State: ${audit.audit_state}`,
    `Path: ${audit.package_json_path}`,
    `Commit message: ${audit.commit_message}`,
    "Audit findings:",
    ...(audit.audit_findings.length ? audit.audit_findings.map((item) => `- ${item}`) : ["- blocked"]),
    "Forbidden actions:",
    ...audit.forbidden_actions.map((item) => `- ${item}`),
    `package.json edited: ${audit.package_json_edited}`,
    `Committed now: ${audit.committed_now}`,
    `Pushed now: ${audit.pushed_now}`,
  ].join("\n");
}
