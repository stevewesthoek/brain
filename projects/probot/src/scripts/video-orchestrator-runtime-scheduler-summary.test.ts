import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "../bot/video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "../bot/video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "../bot/video-orchestrator-runtime-scheduler-queue.js";
import { buildRuntimeSchedulerQueueArtifact, type RuntimeSchedulerQueueArtifactInput } from "../bot/video-orchestrator-runtime-scheduler-queue-artifact.js";
import { buildRuntimeSchedulerQueueMemoryStore, type RuntimeSchedulerQueueStoreInput } from "../bot/video-orchestrator-runtime-scheduler-queue-store.js";
import { createRuntimeSchedulerStoreReadiness, type RuntimeSchedulerStoreReadinessInput } from "../bot/video-orchestrator-runtime-scheduler-store-readiness.js";
import { createRuntimeSchedulerSummary, renderRuntimeSchedulerSummary } from "./video-orchestrator-runtime-scheduler-summary.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-summary-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-summary-001",
    platform,
    account_id: `${platform}-main`,
    content_id,
    desired_publish_at: "2026-05-15T10:00:00.000Z",
    previous_attempt_count: platform === "youtube" ? 1 : 0,
    allow_contract_only: true,
    allow_runtime_schedule: false,
    allow_upload_execution: false,
    allow_network: false,
    allow_credential_access: false,
    allow_media_read: false,
    allow_file_write: false,
    allow_git_add: false,
    allow_commit: false,
    allow_push: false,
  };
}

const QUEUE_INPUT: VideoOrchestratorRuntimeSchedulerQueueInput = {
  request_id: "runtime-scheduler-summary-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-summary-001",
  queue_id: "says-the-bible-dry-run-queue",
  allow_dry_run_queue_only: true,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_file_write: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

const ARTIFACT_INPUT: RuntimeSchedulerQueueArtifactInput = {
  request_id: "runtime-scheduler-summary-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-summary-001",
  artifact_id: "says-the-bible-runtime-scheduler-queue-artifact",
  proposed_path: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  allow_artifact_only: true,
  allow_file_write: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

const STORE_INPUT: RuntimeSchedulerQueueStoreInput = {
  request_id: "runtime-scheduler-summary-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-summary-001",
  store_id: "says-the-bible-runtime-scheduler-memory-store",
  allow_memory_store_only: true,
  allow_file_write: false,
  allow_database_write: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

const READINESS_INPUT: RuntimeSchedulerStoreReadinessInput = {
  request_id: "runtime-scheduler-summary-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-summary-001",
  proposed_store_kind: "repo_json",
  proposed_path_or_reference: "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json",
  allow_readiness_only: true,
  allow_file_write: false,
  allow_database_write: false,
  allow_live_scheduler: false,
  allow_upload_execution: false,
  allow_network: false,
  allow_credential_access: false,
  allow_media_read: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

function buildChain() {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const artifact = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue);
  const store = buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact);
  const readiness = createRuntimeSchedulerStoreReadiness(READINESS_INPUT, store);
  return { queue, artifact, store, readiness };
}

test("VO-7EV-RUNTIME-SCHEDULER-SUMMARY-1: summarizes scheduler queue chain without side effects", () => {
  const chain = buildChain();
  const summary = createRuntimeSchedulerSummary(chain);
  const rendered = renderRuntimeSchedulerSummary(summary);

  assert.equal(summary.schema_version, "1.0");
  assert.equal(summary.summary_only, true);
  assert.equal(summary.sections.length, 4);
  assert.equal(summary.safety.runtime_schedule_executed, false);
  assert.equal(summary.safety.upload_executed, false);
  assert.equal(summary.safety.network_calls_made, false);
  assert.equal(summary.safety.credential_accessed, false);
  assert.equal(summary.safety.media_read_performed, false);
  assert.equal(summary.safety.files_written, false);
  assert.equal(summary.safety.env_written, false);
  assert.equal(summary.safety.git_add_executed, false);
  assert.equal(summary.safety.committed_now, false);
  assert.equal(summary.safety.pushed_now, false);
  assert.equal(rendered.includes("Video Orchestrator Runtime Scheduler Summary"), true);
  assert.equal(rendered.includes("Dry-run scheduler queue"), true);
  assert.equal(rendered.includes("Queue artifact preview"), true);
  assert.equal(rendered.includes("Memory queue store"), true);
  assert.equal(rendered.includes("Persistent store readiness"), true);
  assert.equal(rendered.includes("Runtime schedule executed: no"), true);
  assert.equal(rendered.includes("Uploads executed: no"), true);
});

test("VO-7EV-RUNTIME-SCHEDULER-SUMMARY-2: empty summary is safe", () => {
  const summary = createRuntimeSchedulerSummary({});
  const rendered = renderRuntimeSchedulerSummary(summary);

  assert.equal(summary.sections.length, 1);
  assert.equal(summary.sections[0]?.title, "Runtime scheduler");
  assert.equal(rendered.includes("No scheduler artifacts were provided."), true);
  assert.equal(summary.safety.files_written, false);
  assert.equal(summary.safety.network_calls_made, false);
  assert.equal(summary.safety.credential_accessed, false);
});

test("VO-7EW-RUNTIME-SCHEDULER-SUMMARY-REVIEW-1: rendered summary does not leak sensitive-shaped values", () => {
  const rendered = renderRuntimeSchedulerSummary(createRuntimeSchedulerSummary(buildChain()));

  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("refresh_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
  assert.equal(rendered.includes("api_key"), false);
  assert.equal(rendered.includes("[TOKEN"), false);
  assert.equal(rendered.includes("[API_KEY"), false);
  assert.equal(rendered.toLowerCase().includes("keychain://"), false);
});
