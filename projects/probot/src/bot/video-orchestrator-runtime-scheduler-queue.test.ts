import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import {
  buildVideoOrchestratorRuntimeSchedulerQueue,
  createVideoOrchestratorRuntimeSchedulerQueueReview,
  createVideoOrchestratorRuntimeSchedulerQueueSafeReport,
  revokeVideoOrchestratorRuntimeSchedulerQueue,
  revokeVideoOrchestratorRuntimeSchedulerQueueReview,
  revokeVideoOrchestratorRuntimeSchedulerQueueSafeReport,
  type VideoOrchestratorRuntimeSchedulerQueueInput,
} from "./video-orchestrator-runtime-scheduler-queue.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "tiktok", adapter_id: "tiktok-api", mode: "api", status: "partial", supports_scheduled_publish: false, supports_resume: false },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string, previous_attempt_count = 0): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-queue-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-queue-001",
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
  request_id: "runtime-scheduler-queue-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-001",
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

test("VO-7EN-RUNTIME-SCHEDULER-QUEUE-1: builds dry-run queue from schedule/resume decisions", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([
    scheduleInput("youtube", "video-001"),
    scheduleInput("tiktok", "video-002"),
    scheduleInput("manual", "video-003"),
    scheduleInput("unknown", "video-004"),
  ], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan, { id: "runtime-scheduler-queue-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(queue.queue_state, "ready_for_operator_review");
  assert.equal(queue.queue_id, "says-the-bible-dry-run-queue");
  assert.equal(queue.summary.item_count, 4);
  assert.equal(queue.summary.queued_dry_run_count, 1);
  assert.equal(queue.summary.deferred_count, 1);
  assert.equal(queue.summary.manual_fallback_count, 1);
  assert.equal(queue.summary.blocked_count, 1);
  assert.equal(queue.summary.resume_supported_count, 2);
  assert.equal(queue.items[0]?.state, "queued_dry_run");
  assert.equal(queue.items[1]?.state, "deferred");
  assert.equal(queue.items[2]?.state, "manual_fallback");
  assert.equal(queue.items[3]?.state, "blocked");
  assert.equal(queue.safety.dry_run_queue_only, true);
  assert.equal(queue.safety.live_scheduler_executed, false);
  assert.equal(queue.safety.upload_executed, false);
  assert.equal(queue.safety.network_calls_made, false);
  assert.equal(queue.safety.credential_accessed, false);
  assert.equal(queue.safety.media_read_performed, false);
  assert.equal(queue.safety.files_written, false);
  assert.equal(queue.safety.git_add_executed, false);
  assert.equal(queue.safety.committed_now, false);
  assert.equal(queue.safety.pushed_now, false);
});

test("VO-7EN-RUNTIME-SCHEDULER-QUEUE-2: preserves resume metadata without enabling live scheduling", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001", 3)], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const item = queue.items[0];

  assert.equal(item?.state, "queued_dry_run");
  assert.equal(item?.previous_attempt_count, 3);
  assert.equal(item?.next_action.includes("Resume metadata preserved"), true);
  assert.equal(item?.live_scheduler_enabled, false);
  assert.equal(item?.upload_execution_enabled, false);
  assert.equal(item?.network_enabled, false);
  assert.equal(item?.credential_access_enabled, false);
  assert.equal(item?.media_read_enabled, false);
  assert.equal(item?.file_write_enabled, false);
});

test("VO-7EN-RUNTIME-SCHEDULER-QUEUE-3: unsafe runtime permissions block queue construction", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue({ ...QUEUE_INPUT, allow_live_scheduler: true as false }, plan);

  assert.equal(queue.queue_state, "blocked");
  assert.equal(queue.items.length, 0);
  assert.equal(queue.validation.complete, false);
  assert.equal(queue.safety.live_scheduler_executed, false);
  assert.equal(queue.safety.upload_executed, false);
  assert.equal(queue.safety.network_calls_made, false);
});

test("VO-7EO-RUNTIME-SCHEDULER-QUEUE-REVIEW-1: safe report requires confirmation before live scheduler or staging", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const review = createVideoOrchestratorRuntimeSchedulerQueueReview(queue, { id: "runtime-scheduler-queue-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorRuntimeSchedulerQueueSafeReport(review, queue, { id: "runtime-scheduler-queue-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.item_count, 2);
  assert.equal(review.live_scheduler_executed, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.network_calls_made, false);
  assert.equal(review.credential_accessed, false);
  assert.equal(review.media_read_performed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_live_scheduler_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.item_count, 2);
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

test("VO-7EO-RUNTIME-SCHEDULER-QUEUE-REVIEW-2: revocation keeps queue artifacts disabled", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  const review = createVideoOrchestratorRuntimeSchedulerQueueReview(queue);
  const report = createVideoOrchestratorRuntimeSchedulerQueueSafeReport(review, queue);

  assert.equal(revokeVideoOrchestratorRuntimeSchedulerQueue(queue).queue_state, "revoked");
  assert.equal(revokeVideoOrchestratorRuntimeSchedulerQueueReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorRuntimeSchedulerQueueSafeReport(report).safe_report_state, "revoked");
});
