import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "./video-orchestrator-runtime-scheduler-queue.js";
import { buildRuntimeSchedulerQueueArtifact, type RuntimeSchedulerQueueArtifactInput } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";
import { buildRuntimeSchedulerQueueMemoryStore, type RuntimeSchedulerQueueStoreInput } from "./video-orchestrator-runtime-scheduler-queue-store.js";
import {
  buildRuntimeSchedulerQueueReadModel,
  createRuntimeSchedulerQueueReadModelReview,
  createRuntimeSchedulerQueueReadModelSafeReport,
  revokeRuntimeSchedulerQueueReadModel,
  revokeRuntimeSchedulerQueueReadModelReview,
  revokeRuntimeSchedulerQueueReadModelSafeReport,
  type RuntimeSchedulerQueueReadModelInput,
} from "./video-orchestrator-runtime-scheduler-queue-read-model.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "tiktok", adapter_id: "tiktok-api", mode: "api", status: "partial", supports_scheduled_publish: false, supports_resume: false },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string, previous_attempt_count = 0): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-queue-read-model-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-queue-read-model-001",
    platform,
    account_id: `${platform}-main`,
    content_id,
    desired_publish_at: "2026-05-15T10:00:00.000Z",
    previous_attempt_count,
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
  request_id: "runtime-scheduler-queue-read-model-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-read-model-001",
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
  request_id: "runtime-scheduler-queue-read-model-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-read-model-001",
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
  request_id: "runtime-scheduler-queue-read-model-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-read-model-001",
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

function readInput(filter: RuntimeSchedulerQueueReadModelInput["filter"]): RuntimeSchedulerQueueReadModelInput {
  return {
    request_id: "runtime-scheduler-queue-read-model-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-queue-read-model-001",
    filter,
    allow_read_only: true,
    allow_store_mutation: false,
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
}

function store() {
  const plan = createVideoOrchestratorScheduleResumePlan([
    scheduleInput("youtube", "video-001", 2),
    scheduleInput("tiktok", "video-002"),
    scheduleInput("manual", "video-003"),
    scheduleInput("unknown", "video-004"),
  ], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const artifact = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue);
  return buildRuntimeSchedulerQueueMemoryStore(STORE_INPUT, artifact);
}

test("VO-7ET-RUNTIME-SCHEDULER-QUEUE-READ-MODEL-1: builds read-only all-items view", () => {
  const model = buildRuntimeSchedulerQueueReadModel(readInput("all"), store(), { id: "runtime-scheduler-queue-read-model-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(model.read_model_state, "ready_for_operator_review");
  assert.equal(model.filter, "all");
  assert.equal(model.source_store_id, "says-the-bible-runtime-scheduler-memory-store");
  assert.equal(model.summary.item_count, 4);
  assert.equal(model.summary.queued_dry_run_count, 1);
  assert.equal(model.summary.deferred_count, 1);
  assert.equal(model.summary.manual_fallback_count, 1);
  assert.equal(model.summary.blocked_count, 1);
  assert.equal(model.summary.retry_candidate_count, 1);
  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.store_mutated, false);
  assert.equal(model.safety.file_written, false);
  assert.equal(model.safety.database_written, false);
  assert.equal(model.safety.live_scheduler_executed, false);
  assert.equal(model.safety.upload_executed, false);
  assert.equal(model.safety.network_calls_made, false);
  assert.equal(model.safety.credential_accessed, false);
  assert.equal(model.safety.media_read_performed, false);
  assert.equal(model.safety.git_add_executed, false);
  assert.equal(model.safety.committed_now, false);
  assert.equal(model.safety.pushed_now, false);
});

test("VO-7ET-RUNTIME-SCHEDULER-QUEUE-READ-MODEL-2: filters queued dry-run items only", () => {
  const model = buildRuntimeSchedulerQueueReadModel(readInput("queued_dry_run"), store());

  assert.equal(model.summary.item_count, 1);
  assert.equal(model.items[0]?.state, "queued_dry_run");
  assert.equal(model.items[0]?.previous_attempt_count, 2);
  assert.equal(model.summary.retry_candidate_count, 1);
});

test("VO-7ET-RUNTIME-SCHEDULER-QUEUE-READ-MODEL-3: unsafe mutation permission blocks model", () => {
  const model = buildRuntimeSchedulerQueueReadModel({ ...readInput("all"), allow_store_mutation: true as false }, store());

  assert.equal(model.read_model_state, "blocked");
  assert.equal(model.items.length, 0);
  assert.equal(model.source_store_id, null);
  assert.equal(model.validation.complete, false);
  assert.equal(model.safety.store_mutated, false);
});

test("VO-7EU-RUNTIME-SCHEDULER-QUEUE-READ-MODEL-REVIEW-1: safe report requires confirmation before dashboard wiring or staging", () => {
  const model = buildRuntimeSchedulerQueueReadModel(readInput("all"), store());
  const review = createRuntimeSchedulerQueueReadModelReview(model, { id: "runtime-scheduler-queue-read-model-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createRuntimeSchedulerQueueReadModelSafeReport(review, model, { id: "runtime-scheduler-queue-read-model-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.item_count, 4);
  assert.equal(review.store_mutated, false);
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

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_dashboard_wiring_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.item_count, 4);
  assert.equal(report.store_mutated, false);
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

test("VO-7EU-RUNTIME-SCHEDULER-QUEUE-READ-MODEL-REVIEW-2: revocation keeps read model disabled", () => {
  const model = buildRuntimeSchedulerQueueReadModel(readInput("all"), store());
  const review = createRuntimeSchedulerQueueReadModelReview(model);
  const report = createRuntimeSchedulerQueueReadModelSafeReport(review, model);

  assert.equal(revokeRuntimeSchedulerQueueReadModel(model).read_model_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueReadModelReview(review).review_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueReadModelSafeReport(report).safe_report_state, "revoked");
});
