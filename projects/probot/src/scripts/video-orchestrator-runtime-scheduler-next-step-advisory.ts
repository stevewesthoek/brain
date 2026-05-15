import type { RuntimeSchedulerLifecycleManifest } from "./video-orchestrator-runtime-scheduler-lifecycle-manifest.js";
import type { RuntimeSchedulerTerminalSummary } from "./video-orchestrator-runtime-scheduler-terminal-summary.js";

export type RuntimeSchedulerNextStepAdvisoryState = "manual_action_required" | "blocked" | "revoked";
export type RuntimeSchedulerNextStepKind = "approve_package_script" | "approve_persistent_store" | "approve_live_scheduler" | "keep_disabled";

export interface RuntimeSchedulerNextStepAdvisoryInput {
  advisory_id: string;
  operator_id: string;
  requested_next_step: RuntimeSchedulerNextStepKind;
  allow_advisory_only: true;
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

export interface RuntimeSchedulerNextStepAdvisory {
  schema_version: "1.0";
  advisory_id: string;
  advisory_state: RuntimeSchedulerNextStepAdvisoryState;
  advisory_only: true;
  requested_next_step: RuntimeSchedulerNextStepKind;
  recommendation: string;
  required_confirmation: string;
  package_json_edited: boolean;
  live_scheduler_enabled: false;
  upload_execution_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  file_write_enabled: false;
  git_add_executed: false;
  committed_now: false;
  pushed_now: false;
  validation: { complete: boolean; manual_action_required: boolean; blocking_reasons: string[]; warnings: string[] };
}

function safe(value: string | undefined, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function inputReady(input: RuntimeSchedulerNextStepAdvisoryInput): boolean {
  return input.allow_advisory_only === true
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
    && input.advisory_id.trim().length > 0
    && input.operator_id.trim().length > 0;
}

function manifestReady(manifest: RuntimeSchedulerLifecycleManifest): boolean {
  return manifest.schema_version === "1.0"
    && manifest.manifest_only
    && manifest.manual_boundaries.length > 0
    && manifest.safety.package_json_edited === true
    && manifest.stages.some((stage) => stage.id === "package-script-installed")
    && !manifest.safety.live_scheduler_executed
    && !manifest.safety.upload_executed
    && !manifest.safety.network_calls_made
    && !manifest.safety.credential_accessed
    && !manifest.safety.media_read_performed
    && !manifest.safety.files_written
    && !manifest.safety.git_add_executed
    && !manifest.safety.committed_now
    && !manifest.safety.pushed_now;
}

function summaryReady(summary: RuntimeSchedulerTerminalSummary): boolean {
  return summary.schema_version === "1.0"
    && summary.summary_state === "manual_follow_up_required"
    && summary.summary_only
    && summary.validation.complete
    && summary.validation.manual_follow_up_required
    && !summary.package_json_edited
    && !summary.live_scheduler_enabled
    && !summary.upload_execution_enabled
    && !summary.network_enabled
    && !summary.credential_access_enabled
    && !summary.media_read_enabled
    && !summary.file_write_enabled
    && !summary.git_add_executed
    && !summary.committed_now
    && !summary.pushed_now;
}

function recommendationFor(kind: RuntimeSchedulerNextStepKind): { recommendation: string; required_confirmation: string } {
  if (kind === "approve_package_script") return { recommendation: "The summary-only package script is already installed; review persistent scheduler store planning next before live runtime activation.", required_confirmation: "No package script edit approval needed; keep package.json unchanged." };
  if (kind === "approve_persistent_store") return { recommendation: "Review persistent scheduler store design before enabling any file or database writes.", required_confirmation: "I approve persistent scheduler store implementation planning only, with no writes until separately approved." };
  if (kind === "approve_live_scheduler") return { recommendation: "Keep live scheduler disabled until package script and persistent store boundaries are approved and validated.", required_confirmation: "I approve live scheduler implementation planning only, with no uploads, network calls, credential access, or media reads." };
  return { recommendation: "Keep the runtime scheduler disabled and continue with manual review only.", required_confirmation: "No implementation approval; keep runtime scheduler disabled." };
}

export function createRuntimeSchedulerNextStepAdvisory(input: RuntimeSchedulerNextStepAdvisoryInput, manifest: RuntimeSchedulerLifecycleManifest, summary: RuntimeSchedulerTerminalSummary): RuntimeSchedulerNextStepAdvisory {
  const ready = inputReady(input) && manifestReady(manifest) && summaryReady(summary);
  const advisory = recommendationFor(input.requested_next_step);
  return {
    schema_version: "1.0",
    advisory_id: safe(input.advisory_id, "runtime-scheduler-next-step-advisory"),
    advisory_state: ready ? "manual_action_required" : "blocked",
    advisory_only: true,
    requested_next_step: input.requested_next_step,
    recommendation: ready ? advisory.recommendation : "Resolve blocked manifest/terminal summary or unsafe advisory input before continuing.",
    required_confirmation: ready ? advisory.required_confirmation : "No confirmation available while blocked.",
    package_json_edited: manifest.safety.package_json_edited,
    live_scheduler_enabled: false,
    upload_execution_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    file_write_enabled: false,
    git_add_executed: false,
    committed_now: false,
    pushed_now: false,
    validation: { complete: ready, manual_action_required: ready, blocking_reasons: ready ? [] : ["Runtime scheduler next-step advisory input, lifecycle manifest, or terminal summary was unsafe/incomplete."], warnings: ["Advisory only; no package metadata edits, live scheduler activation, file writes, or git actions are enabled by this module."] },
  };
}

export function revokeRuntimeSchedulerNextStepAdvisory(advisory: RuntimeSchedulerNextStepAdvisory, reason?: string): RuntimeSchedulerNextStepAdvisory {
  return { ...advisory, advisory_state: "revoked", validation: { complete: false, manual_action_required: false, blocking_reasons: advisory.validation.blocking_reasons, warnings: [...advisory.validation.warnings, safe(reason, "Runtime scheduler next-step advisory was revoked.")] } };
}

export function renderRuntimeSchedulerNextStepAdvisory(advisory: RuntimeSchedulerNextStepAdvisory): string {
  return [
    "Video Orchestrator runtime scheduler next-step advisory",
    `State: ${advisory.advisory_state}`,
    `Requested next step: ${advisory.requested_next_step}`,
    `Recommendation: ${advisory.recommendation}`,
    `Required confirmation: ${advisory.required_confirmation}`,
    `package.json edited: ${advisory.package_json_edited}`,
    `Live scheduler enabled: ${advisory.live_scheduler_enabled}`,
  ].join("\n");
}
