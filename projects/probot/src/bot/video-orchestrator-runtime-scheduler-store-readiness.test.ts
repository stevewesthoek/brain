import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "./video-orchestrator-runtime-scheduler-queue.js";
import { buildRuntimeSchedulerQueueArtifact, type RuntimeSchedulerQueueArtifactInput } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";
import { buildRuntimeSchedulerQueueMemoryStore, type RuntimeSchedulerQueueStoreInput } from "./video-orchestrator-runtime-scheduler-queue-store.js";
import {
  createRuntimeSchedulerStoreReadiness,
  createRuntimeSchedulerStoreReadinessReview,
  createRuntimeSchedulerStoreReadinessSafeReport,
  revokeRuntimeSchedulerStoreReadiness,
  revokeRuntimeSchedulerStoreReadinessReview,
  revokeRuntimeSchedulerStoreReadinessSafeReport,
  type RuntimeSchedulerStoreReadinessInput,
} from "./video-orchestrator-runtime-scheduler-store-readiness.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-store-readiness-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-store-readiness-001",
    platform,
    account_id: `${platform}-main`,
    content_id,
    desired_publish_at: "2026-05-15T10:00:00.000Z",
    previous_attempt_count: 0,
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
  request_id: "runtime-scheduler-store-readiness-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-store-readiness-001",
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
  request_id: "runtime-scheduler-store-readiness-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-store-readiness-001",
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
  request_id: "runtime-scheduler-store-readiness-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-store-readiness-001",
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
  request_id: "runtime-scheduler-store-readiness-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-store-readiness-001",
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

function memoryStore() {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const artifact = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue);
  return buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact);
}

test("VO-7ET-RUNTIME-SCHEDULER-STORE-READINESS-1: creates readiness gate from memory store", () => {
  const readiness = createRuntimeSchedulerStoreReadiness(READINESS_INPUT, memoryStore(), { id: "runtime-scheduler-store-readiness-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(readiness.readiness_state, "ready_for_operator_review");
  assert.equal(readiness.proposed_store_kind, "repo_json");
  assert.equal(readiness.proposed_path_or_reference, "operations/runbooks/video-orchestrator-runtime-scheduler-queue.example.json");
  assert.equal(readiness.source_item_count, 2);
  assert.equal(readiness.readiness_only, true);
  assert.equal(readiness.file_write_enabled, false);
  assert.equal(readiness.database_write_enabled, false);
  assert.equal(readiness.live_scheduler_enabled, false);
  assert.equal(readiness.upload_execution_enabled, false);
  assert.equal(readiness.network_enabled, false);
  assert.equal(readiness.credential_access_enabled, false);
  assert.equal(readiness.media_read_enabled, false);
  assert.equal(readiness.git_add_executed, false);
  assert.equal(readiness.committed_now, false);
  assert.equal(readiness.pushed_now, false);
  assert.equal(readiness.validation.complete, true);
  assert.equal(readiness.validation.ready_for_readiness_review, true);
});

test("VO-7ET-RUNTIME-SCHEDULER-STORE-READINESS-2: unsafe path or permission blocks readiness", () => {
  const readiness = createRuntimeSchedulerStoreReadiness({ ...READINESS_INPUT, proposed_path_or_reference: ".env", allow_file_write: true as false }, memoryStore());

  assert.equal(readiness.readiness_state, "blocked");
  assert.equal(readiness.proposed_path_or_reference, "blocked-reference");
  assert.equal(readiness.source_store_result_id, null);
  assert.equal(readiness.source_item_count, 0);
  assert.equal(readiness.validation.complete, false);
  assert.equal(readiness.file_write_enabled, false);
  assert.equal(readiness.database_write_enabled, false);
});

test("VO-7EU-RUNTIME-SCHEDULER-STORE-READINESS-REVIEW-1: safe report requires confirmation before persistent store implementation or staging", () => {
  const readiness = createRuntimeSchedulerStoreReadiness(READINESS_INPUT, memoryStore());
  const review = createRuntimeSchedulerStoreReadinessReview(readiness, { id: "runtime-scheduler-store-readiness-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createRuntimeSchedulerStoreReadinessSafeReport(review, readiness, { id: "runtime-scheduler-store-readiness-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.source_item_count, 2);
  assert.equal(review.file_write_enabled, false);
  assert.equal(review.database_write_enabled, false);
  assert.equal(review.live_scheduler_enabled, false);
  assert.equal(review.upload_execution_enabled, false);
  assert.equal(review.network_enabled, false);
  assert.equal(review.credential_access_enabled, false);
  assert.equal(review.media_read_enabled, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_persistent_store_implementation_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.source_item_count, 2);
  assert.equal(report.file_write_enabled, false);
  assert.equal(report.database_write_enabled, false);
  assert.equal(report.live_scheduler_enabled, false);
  assert.equal(report.upload_execution_enabled, false);
  assert.equal(report.network_enabled, false);
  assert.equal(report.credential_access_enabled, false);
  assert.equal(report.media_read_enabled, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7EU-RUNTIME-SCHEDULER-STORE-READINESS-REVIEW-2: revocation keeps readiness disabled", () => {
  const readiness = createRuntimeSchedulerStoreReadiness(READINESS_INPUT, memoryStore());
  const review = createRuntimeSchedulerStoreReadinessReview(readiness);
  const report = createRuntimeSchedulerStoreReadinessSafeReport(review, readiness);

  assert.equal(revokeRuntimeSchedulerStoreReadiness(readiness).readiness_state, "revoked");
  assert.equal(revokeRuntimeSchedulerStoreReadinessReview(review).review_state, "revoked");
  assert.equal(revokeRuntimeSchedulerStoreReadinessSafeReport(report).safe_report_state, "revoked");
});
