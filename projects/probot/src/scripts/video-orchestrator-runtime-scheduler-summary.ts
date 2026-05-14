import type { VideoOrchestratorRuntimeSchedulerQueueBuildResult } from "../bot/video-orchestrator-runtime-scheduler-queue.js";
import type { RuntimeSchedulerQueueArtifactBuildResult } from "../bot/video-orchestrator-runtime-scheduler-queue-artifact.js";
import type { RuntimeSchedulerQueueStoreBuildResult } from "../bot/video-orchestrator-runtime-scheduler-queue-store.js";
import type { RuntimeSchedulerStoreReadinessResult } from "../bot/video-orchestrator-runtime-scheduler-store-readiness.js";

export interface RuntimeSchedulerSummarySection {
  title: string;
  lines: string[];
}

export interface RuntimeSchedulerSummaryInput {
  queue?: VideoOrchestratorRuntimeSchedulerQueueBuildResult | null;
  artifact?: RuntimeSchedulerQueueArtifactBuildResult | null;
  store?: RuntimeSchedulerQueueStoreBuildResult | null;
  readiness?: RuntimeSchedulerStoreReadinessResult | null;
}

export interface RuntimeSchedulerSummaryResult {
  schema_version: "1.0";
  summary_only: true;
  sections: RuntimeSchedulerSummarySection[];
  safety: {
    runtime_schedule_executed: false;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    files_written: false;
    env_written: false;
    git_add_executed: false;
    committed_now: false;
    pushed_now: false;
  };
}

function safe(value: string | undefined | null, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 180) : fallback;
}

function bool(value: boolean): string {
  return value ? "yes" : "no";
}

function queueSection(queue: VideoOrchestratorRuntimeSchedulerQueueBuildResult): RuntimeSchedulerSummarySection {
  return {
    title: "Dry-run scheduler queue",
    lines: [
      `State: ${safe(queue.queue_state, "unknown")}`,
      `Queue: ${safe(queue.queue_id, "queue")}`,
      `Items: ${queue.summary.item_count}`,
      `Queued dry-run: ${queue.summary.queued_dry_run_count}`,
      `Deferred: ${queue.summary.deferred_count}`,
      `Manual fallback: ${queue.summary.manual_fallback_count}`,
      `Blocked: ${queue.summary.blocked_count}`,
      `Live scheduler executed: ${bool(queue.safety.live_scheduler_executed)}`,
      `Uploads executed: ${bool(queue.safety.upload_executed)}`,
    ],
  };
}

function artifactSection(artifact: RuntimeSchedulerQueueArtifactBuildResult): RuntimeSchedulerSummarySection {
  return {
    title: "Queue artifact preview",
    lines: [
      `State: ${safe(artifact.artifact_state, "unknown")}`,
      `Artifact only: ${bool(artifact.artifact_only)}`,
      `Items: ${artifact.artifact?.items.length ?? 0}`,
      `File written: ${bool(artifact.file_written_now)}`,
      `Network calls made: ${bool(artifact.network_calls_made)}`,
      `Credential accessed: ${bool(artifact.credential_accessed)}`,
    ],
  };
}

function storeSection(store: RuntimeSchedulerQueueStoreBuildResult): RuntimeSchedulerSummarySection {
  return {
    title: "Memory queue store",
    lines: [
      `State: ${safe(store.store_state, "unknown")}`,
      `Store: ${safe(store.store_id, "store")}`,
      `Items: ${store.summary.item_count}`,
      `Memory only: ${bool(store.safety.memory_store_only)}`,
      `File written: ${bool(store.safety.file_written)}`,
      `Database written: ${bool(store.safety.database_written)}`,
    ],
  };
}

function readinessSection(readiness: RuntimeSchedulerStoreReadinessResult): RuntimeSchedulerSummarySection {
  return {
    title: "Persistent store readiness",
    lines: [
      `State: ${safe(readiness.readiness_state, "unknown")}`,
      `Store kind: ${safe(readiness.proposed_store_kind, "unknown")}`,
      `Reference: ${safe(readiness.proposed_path_or_reference, "reference")}`,
      `Source items: ${readiness.source_item_count}`,
      `Readiness only: ${bool(readiness.readiness_only)}`,
      `File writes enabled: ${bool(readiness.file_write_enabled)}`,
      `Database writes enabled: ${bool(readiness.database_write_enabled)}`,
    ],
  };
}

export function createRuntimeSchedulerSummary(input: RuntimeSchedulerSummaryInput): RuntimeSchedulerSummaryResult {
  const sections: RuntimeSchedulerSummarySection[] = [];
  if (input.queue) sections.push(queueSection(input.queue));
  if (input.artifact) sections.push(artifactSection(input.artifact));
  if (input.store) sections.push(storeSection(input.store));
  if (input.readiness) sections.push(readinessSection(input.readiness));
  if (sections.length === 0) {
    sections.push({ title: "Runtime scheduler", lines: ["No scheduler artifacts were provided."] });
  }
  return {
    schema_version: "1.0",
    summary_only: true,
    sections,
    safety: { runtime_schedule_executed: false, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, files_written: false, env_written: false, git_add_executed: false, committed_now: false, pushed_now: false },
  };
}

export function renderRuntimeSchedulerSummary(summary: RuntimeSchedulerSummaryResult): string {
  const renderedSections = summary.sections.map((section) => {
    const lines = section.lines.map((line) => `  - ${line}`).join("\n");
    return `${section.title}\n${lines}`;
  });
  return [
    "Video Orchestrator Runtime Scheduler Summary",
    ...renderedSections,
    "Safety",
    `  - Summary only: ${bool(summary.summary_only)}`,
    `  - Runtime schedule executed: ${bool(summary.safety.runtime_schedule_executed)}`,
    `  - Uploads executed: ${bool(summary.safety.upload_executed)}`,
    `  - Network calls made: ${bool(summary.safety.network_calls_made)}`,
    `  - Credential accessed: ${bool(summary.safety.credential_accessed)}`,
    `  - Files written: ${bool(summary.safety.files_written)}`,
  ].join("\n");
}
