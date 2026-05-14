import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "./video-orchestrator-runtime-scheduler-queue.js";
import { buildRuntimeSchedulerQueueArtifact, type RuntimeSchedulerQueueArtifactInput } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";
import {
  buildRuntimeSchedulerQueueMemoryStore,
  createRuntimeSchedulerQueueStoreReview,
  createRuntimeSchedulerQueueStoreSafeReport,
  revokeRuntimeSchedulerQueueMemoryStore,
  revokeRuntimeSchedulerQueueStoreReview,
  revokeRuntimeSchedulerQueueStoreSafeReport,
  type RuntimeSchedulerQueueStoreInput,
} from "./video-orchestrator-runtime-scheduler-queue-store.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-queue-store-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-queue-store-001",
    platform,
    account_id: `${platform}-main`,
    content_id,
    desired_publish_at: "2026-05-15T10:00:00.000Z",
    previous_attempt_count: platform === "youtube" ? 2 : 0,
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
  request_id: "runtime-scheduler-queue-store-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-store-001",
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
  request_id: "runtime-scheduler-queue-store-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-store-001",
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
  request_id: "runtime-scheduler-queue-store-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-store-001",
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

function artifact() {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  return buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue);
}

test("VO-7ER-RUNTIME-SCHEDULER-QUEUE-STORE-1: builds memory-only store from safe artifact", () => {
  const store = buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact(), { id: "runtime-scheduler-queue-store-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(store.store_state, "ready_for_operator_review");
  assert.equal(store.store_id, "says-the-bible-runtime-scheduler-memory-store");
  assert.equal(store.source_artifact_id, "says-the-bible-runtime-scheduler-queue-artifact");
  assert.equal(store.summary.item_count, 2);
  assert.equal(store.summary.queued_dry_run_count, 1);
  assert.equal(store.summary.manual_fallback_count, 1);
  assert.equal(store.items[0]?.state, "queued_dry_run");
  assert.equal(store.items[0]?.previous_attempt_count, 2);
  assert.equal(store.safety.memory_store_only, true);
  assert.equal(store.safety.file_written, false);
  assert.equal(store.safety.database_written, false);
  assert.equal(store.safety.live_scheduler_executed, false);
  assert.equal(store.safety.upload_executed, false);
  assert.equal(store.safety.network_calls_made, false);
  assert.equal(store.safety.credential_accessed, false);
  assert.equal(store.safety.media_read_performed, false);
  assert.equal(store.safety.git_add_executed, false);
  assert.equal(store.safety.committed_now, false);
  assert.equal(store.safety.pushed_now, false);
  assert.equal(store.validation.complete, true);
  assert.equal(store.validation.ready_for_store_review, true);
});

test("VO-7ER-RUNTIME-SCHEDULER-QUEUE-STORE-2: unsafe persistent permissions block store", () => {
  const store = buildRuntimeSchedulerQueueMemoryStore({ ...STORE_INPUT, allow_database_write: true as false }, artifact());

  assert.equal(store.store_state, "blocked");
  assert.equal(store.items.length, 0);
  assert.equal(store.source_artifact_id, null);
  assert.equal(store.validation.complete, false);
  assert.equal(store.safety.database_written, false);
  assert.equal(store.safety.file_written, false);
});

test("VO-7ES-RUNTIME-SCHEDULER-QUEUE-STORE-REVIEW-1: safe report requires confirmation before persistent store or staging", () => {
  const store = buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact());
  const review = createRuntimeSchedulerQueueStoreReview(store, { id: "runtime-scheduler-queue-store-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createRuntimeSchedulerQueueStoreSafeReport(review, store, { id: "runtime-scheduler-queue-store-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.item_count, 2);
  assert.equal(review.file_written, false);
  assert.equal(review.database_written, false);
  assert.equal(review.live_scheduler_executed, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.network_calls_made, false);
  assert.equal(review.credential_accessed, false);
  assert.equal(review.media_read_performed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_persistent_store_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.item_count, 2);
  assert.equal(report.file_written, false);
  assert.equal(report.database_written, false);
  assert.equal(report.live_scheduler_executed, false);
  assert.equal(report.upload_executed, false);
  assert.equal(report.network_calls_made, false);
  assert.equal(report.credential_accessed, false);
  assert.equal(report.media_read_performed, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7ES-RUNTIME-SCHEDULER-QUEUE-STORE-REVIEW-2: revocation keeps store disabled", () => {
  const store = buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact());
  const review = createRuntimeSchedulerQueueStoreReview(store);
  const report = createRuntimeSchedulerQueueStoreSafeReport(review, store);

  assert.equal(revokeRuntimeSchedulerQueueMemoryStore(store).store_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueStoreReview(review).review_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueStoreSafeReport(report).safe_report_state, "revoked");
});
