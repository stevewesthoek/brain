import type { RuntimeSchedulerPackageScriptApprovalGate } from "./video-orchestrator-runtime-scheduler-package-script-approval-gate.js";
import type { RuntimeSchedulerSmokeMatrix } from "./video-orchestrator-runtime-scheduler-smoke-matrix.js";

export type RuntimeSchedulerReleaseChecklistState = "ready_for_manual_release_review" | "blocked" | "revoked";

export interface RuntimeSchedulerReleaseChecklistInput {
  release_id: string;
  operator_id: string;
  expected_script_name: string;
  allow_checklist_only: true;
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

export interface RuntimeSchedulerReleaseChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  evidence: string;
}

export interface RuntimeSchedulerReleaseChecklist {
  schema_version: "1.0";
  release_id: string;
  checklist_state: RuntimeSchedulerReleaseChecklistState;
  checklist_only: true;
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
  items: RuntimeSchedulerReleaseChecklistItem[];
  validation: { complete: boolean; ready_for_manual_release_review: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function inputReady(input: RuntimeSchedulerReleaseChecklistInput): boolean {
  return input.allow_checklist_only === true
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
    && input.release_id.trim().length > 0
    && input.operator_id.trim().length > 0
    && input.expected_script_name.trim().length > 0;
}

function gateReady(gate: RuntimeSchedulerPackageScriptApprovalGate, expectedScriptName: string): boolean {
  return gate.schema_version === "1.0"
    && gate.approval_state === "ready_for_explicit_package_metadata_approval"
    && gate.validation.complete
    && gate.validation.ready_for_manual_approval
    && gate.script_name === expectedScriptName
    && gate.gate_only
    && !gate.package_json_edited
    && gate.explicit_package_metadata_approval_required
    && !gate.live_scheduler_enabled
    && !gate.upload_execution_enabled
    && !gate.network_enabled
    && !gate.credential_access_enabled
    && !gate.media_read_enabled
    && !gate.git_add_executed
    && !gate.committed_now
    && !gate.pushed_now;
}

function matrixReady(matrix: RuntimeSchedulerSmokeMatrix): boolean {
  return matrix.schema_version === "1.0"
    && matrix.matrix_only
    && matrix.rows.length >= 3
    && matrix.rows.every((row) => row.live_scheduler_expected === false && row.upload_expected === false && row.network_expected === false && row.credential_access_expected === false && row.media_read_expected === false && row.file_write_expected === false)
    && !matrix.safety.commands_executed
    && !matrix.safety.package_json_edited
    && !matrix.safety.live_scheduler_executed
    && !matrix.safety.upload_executed
    && !matrix.safety.network_calls_made
    && !matrix.safety.credential_accessed
    && !matrix.safety.media_read_performed
    && !matrix.safety.files_written
    && !matrix.safety.git_add_executed
    && !matrix.safety.committed_now
    && !matrix.safety.pushed_now;
}

export function createRuntimeSchedulerReleaseChecklist(input: RuntimeSchedulerReleaseChecklistInput, gate: RuntimeSchedulerPackageScriptApprovalGate, matrix: RuntimeSchedulerSmokeMatrix): RuntimeSchedulerReleaseChecklist {
  const inputOk = inputReady(input);
  const gateOk = gateReady(gate, input.expected_script_name);
  const matrixOk = matrixReady(matrix);
  const items: RuntimeSchedulerReleaseChecklistItem[] = [
    { id: "input", label: "Checklist input is safe", complete: inputOk, evidence: inputOk ? "All runtime/write/git toggles are disabled." : "Input toggles or identifiers are incomplete." },
    { id: "approval-gate", label: "Package script approval gate is ready", complete: gateOk, evidence: gateOk ? "Gate requires explicit package metadata approval and has not edited package.json." : "Approval gate is blocked, mismatched, or unsafe." },
    { id: "smoke-matrix", label: "Smoke matrix is side-effect-free", complete: matrixOk, evidence: matrixOk ? "Smoke matrix rows expect no scheduling, upload, network, credential, media, file, or git side effects." : "Smoke matrix is incomplete or unsafe." },
  ];
  const ready = items.every((item) => item.complete);
  return {
    schema_version: "1.0",
    release_id: safe(input.release_id, "runtime-scheduler-release-checklist"),
    checklist_state: ready ? "ready_for_manual_release_review" : "blocked",
    checklist_only: true,
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
    items,
    validation: { complete: ready, ready_for_manual_release_review: ready, blocking_reasons: ready ? [] : ["Runtime scheduler release checklist has incomplete or unsafe evidence."], warnings: ["Checklist only; manual review and explicit package metadata approval are still required before package.json edits or live scheduler changes."] },
  };
}

export function revokeRuntimeSchedulerReleaseChecklist(checklist: RuntimeSchedulerReleaseChecklist, reason?: string): RuntimeSchedulerReleaseChecklist {
  return { ...checklist, checklist_state: "revoked", validation: { complete: false, ready_for_manual_release_review: false, blocking_reasons: checklist.validation.blocking_reasons, warnings: [...checklist.validation.warnings, safe(reason, "Runtime scheduler release checklist was revoked.")] } };
}

export function renderRuntimeSchedulerReleaseChecklist(checklist: RuntimeSchedulerReleaseChecklist): string {
  const rows = checklist.items.map((item) => `- ${item.label}: ${item.complete ? "complete" : "blocked"} (${item.evidence})`).join("\n");
  return [
    "Video Orchestrator runtime scheduler release checklist",
    `State: ${checklist.checklist_state}`,
    rows,
    `package.json edited: ${checklist.package_json_edited}`,
    `Live scheduler enabled: ${checklist.live_scheduler_enabled}`,
  ].join("\n");
}
