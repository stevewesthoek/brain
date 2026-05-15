import type { RuntimeSchedulerPackageScriptEditFinalApprovalPacket } from "./video-orchestrator-runtime-scheduler-package-script-edit-final-approval-packet.js";

export type RuntimeSchedulerPackageScriptEditReadinessManifestState = "ready_for_separate_execution_approval" | "blocked" | "revoked";

export interface RuntimeSchedulerPackageScriptEditReadinessManifestInput {
  manifest_id: string;
  operator_id: string;
  allow_manifest_only: true;
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

export interface RuntimeSchedulerPackageScriptEditReadinessManifest {
  schema_version: "1.0";
  manifest_id: string;
  manifest_state: RuntimeSchedulerPackageScriptEditReadinessManifestState;
  manifest_only: true;
  package_json_path: string;
  commit_message: string;
  copy_paste_confirmation: string;
  readiness_items: string[];
  blocking_boundaries: string[];
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
  validation: { complete: boolean; ready_for_separate_execution_approval: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 420) : fallback;
}

function inputReady(input: RuntimeSchedulerPackageScriptEditReadinessManifestInput): boolean {
  return input.allow_manifest_only === true
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
    && input.manifest_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function packetReady(packet: RuntimeSchedulerPackageScriptEditFinalApprovalPacket): boolean {
  return packet.schema_version === "1.0"
    && packet.packet_state === "ready_for_explicit_package_json_edit_confirmation"
    && packet.packet_only
    && packet.validation.complete
    && packet.validation.ready_for_explicit_package_json_edit_confirmation
    && packet.package_json_path === "projects/probot/package.json"
    && packet.commit_message === "Add Video Orchestrator runtime scheduler package script"
    && packet.copy_paste_confirmation.includes("I approve the scoped projects/probot/package.json script edit execution only")
    && packet.final_boundaries.length > 0
    && !packet.package_json_edited
    && !packet.live_scheduler_enabled
    && !packet.upload_execution_enabled
    && !packet.network_enabled
    && !packet.credential_access_enabled
    && !packet.media_read_enabled
    && !packet.file_write_enabled
    && !packet.git_add_executed
    && !packet.committed_now
    && !packet.pushed_now;
}

export function createRuntimeSchedulerPackageScriptEditReadinessManifest(input: RuntimeSchedulerPackageScriptEditReadinessManifestInput, packet: RuntimeSchedulerPackageScriptEditFinalApprovalPacket): RuntimeSchedulerPackageScriptEditReadinessManifest {
  const ready = inputReady(input) && packetReady(packet);
  return {
    schema_version: "1.0",
    manifest_id: safe(input.manifest_id, "runtime-scheduler-package-script-edit-readiness-manifest"),
    manifest_state: ready ? "ready_for_separate_execution_approval" : "blocked",
    manifest_only: true,
    package_json_path: safe(packet.package_json_path, "projects/probot/package.json"),
    commit_message: safe(packet.commit_message, "Add Video Orchestrator runtime scheduler package script"),
    copy_paste_confirmation: ready ? packet.copy_paste_confirmation : "No confirmation available while blocked.",
    readiness_items: ready ? [
      "Final approval packet is complete.",
      "The only future changed path is projects/probot/package.json.",
      "The runtime scheduler command remains summary-only.",
      "Validation requires typecheck, secret scan, staged-path verification, post-commit typecheck, log, and status checks.",
    ] : [],
    blocking_boundaries: ready ? [
      "No package.json edit is performed by this manifest.",
      "No live scheduler activation is performed by this manifest.",
      "No upload, network, credential, media-read, or persistent scheduler-write behavior is enabled.",
      "Git add, commit, and push remain separate verified steps.",
    ] : ["Resolve blocked final approval packet or unsafe manifest input before continuing."],
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
    validation: { complete: ready, ready_for_separate_execution_approval: ready, blocking_reasons: ready ? [] : ["Package script edit readiness manifest input or final approval packet was unsafe/incomplete."], warnings: ["Readiness manifest only; package.json is not edited and no runtime/write/git behavior is enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerPackageScriptEditReadinessManifest(manifest: RuntimeSchedulerPackageScriptEditReadinessManifest, reason?: string): RuntimeSchedulerPackageScriptEditReadinessManifest {
  return { ...manifest, manifest_state: "revoked", copy_paste_confirmation: "No confirmation available while revoked.", readiness_items: [], validation: { complete: false, ready_for_separate_execution_approval: false, blocking_reasons: manifest.validation.blocking_reasons, warnings: [...manifest.validation.warnings, safe(reason, "Package script edit readiness manifest was revoked.")] } };
}

export function renderRuntimeSchedulerPackageScriptEditReadinessManifest(manifest: RuntimeSchedulerPackageScriptEditReadinessManifest): string {
  return [
    "Video Orchestrator runtime scheduler package script edit readiness manifest",
    `State: ${manifest.manifest_state}`,
    `Path: ${manifest.package_json_path}`,
    `Commit message: ${manifest.commit_message}`,
    "Readiness items:",
    ...(manifest.readiness_items.length ? manifest.readiness_items.map((item) => `- ${item}`) : ["- blocked"]),
    "Blocking boundaries:",
    ...manifest.blocking_boundaries.map((item) => `- ${item}`),
    `package.json edited: ${manifest.package_json_edited}`,
    `Live scheduler enabled: ${manifest.live_scheduler_enabled}`,
    `Committed now: ${manifest.committed_now}`,
    `Pushed now: ${manifest.pushed_now}`,
  ].join("\n");
}
