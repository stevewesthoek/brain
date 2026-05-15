import type { RuntimeSchedulerPackageScriptEditExecutionAudit } from "./video-orchestrator-runtime-scheduler-package-script-edit-execution-audit.js";

export type RuntimeSchedulerPackageScriptEditAuditCloseoutState = "closed_for_explicit_package_json_edit_boundary" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditAuditCloseoutInput {
  closeout_id: string;
  operator_id: string;
  allow_closeout_only: true;
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

export interface RuntimeSchedulerPackageScriptEditAuditCloseout {
  schema_version: "1.0";
  closeout_id: string;
  closeout_state: RuntimeSchedulerPackageScriptEditAuditCloseoutState;
  closeout_only: true;
  source_audit_state: RuntimeSchedulerPackageScriptEditExecutionAudit["audit_state"];
  package_json_path: string;
  commit_message: string;
  final_boundary: string;
  required_confirmation: string;
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
  validation: { complete: boolean; closed_for_explicit_package_json_edit_boundary: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 420) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditAuditCloseoutInput): boolean {
  return input.allow_closeout_only === true
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
    && input.closeout_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function auditReady(audit: RuntimeSchedulerPackageScriptEditExecutionAudit): boolean {
  return audit.schema_version === "1.0"
    && audit.audit_state === "audit_ready_for_operator_review"
    && audit.audit_only
    && audit.validation.complete
    && audit.validation.audit_ready_for_operator_review
    && audit.package_json_path === "projects/probot/package.json"
    && audit.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && audit.operator_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && audit.audit_findings.length > 0
    && audit.forbidden_actions.length > 0
    && !audit.package_json_edited
    && !audit.live_scheduler_enabled
    && !audit.upload_execution_enabled
    && !audit.network_enabled
    && !audit.credential_access_enabled
    && !audit.media_read_enabled
    && !audit.file_write_enabled
    && !audit.git_add_executed
    && !audit.committed_now
    && !audit.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditAuditCloseout(input: RuntimeSchedulerPackageScriptEditAuditCloseoutInput, audit: RuntimeSchedulerPackageScriptEditExecutionAudit): RuntimeSchedulerPackageScriptEditAuditCloseout {
  const ready = inputReady(input) && auditReady(audit);
  return {
    schema_version: "1.0",
    closeout_id: safe(input.closeout_id, "runtime-scheduler-package-script-edit-audit-closeout"),
    closeout_state: ready ? "closed_for_explicit_package_json_edit_boundary" : "blocked",
    closeout_only: true,
    source_audit_state: audit.audit_state,
    package_json_path: safe(audit.package_json_path, "projects/probot/package.json"),
    commit_message: safe(audit.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    final_boundary: ready ? "Preparation is complete; the next step requires an explicit, separate package.json edit approval and must still avoid live scheduling, uploads, network calls, credential access, media reads, and unrelated metadata changes." : "Resolve blocked execution audit or unsafe closeout input before continuing.",
    required_confirmation: ready ? audit.operator_confirmation : "No confirmation available while blocked.",
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
    validation: { complete: ready, closed_for_explicit_package_json_edit_boundary: ready, blocking_reasons: ready ? [] : ["Package script edit audit closeout input or execution audit was unsafe/incomplete."], warnings: ["Closeout only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditAuditCloseout(closeout: RuntimeSchedulerPackageScriptEditAuditCloseout, reason?: string): RuntimeSchedulerPackageScriptEditAuditCloseout {
  return { ...closeout, closeout_state: "revoked", required_confirmation: "No confirmation available while revoked.", validation: { complete: false, closed_for_explicit_package_json_edit_boundary: false, blocking_reasons: closeout.validation.blocking_reasons, warnings: [...closeout.validation.warnings, safe(reason, "Package script edit audit closeout was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditAuditCloseout(closeout: RuntimeSchedulerPackageScriptEditAuditCloseout): string {
  return [
    "Video Orchestrator runtime scheduler package script edit audit closeout",
    `State: ${closeout.closeout_state}`,
    `Path: ${closeout.package_json_path}`,
    `Commit message: ${closeout.commit_message}`,
    `Final boundary: ${closeout.final_boundary}`,
    "Required confirmation:",
    closeout.required_confirmation,
    `package.json edited: ${closeout.package_json_edited}`,
    `Live scheduler enabled: ${closeout.live_scheduler_enabled}`,
    `Committed now: ${closeout.committed_now}`,
    `Pushed now: ${closeout.pushed_now}`,
  ].join("\n");
}
