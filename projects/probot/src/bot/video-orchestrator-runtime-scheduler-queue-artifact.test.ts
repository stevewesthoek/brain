import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "./video-orchestrator-runtime-scheduler-queue.js";
import {
  buildRuntimeSchedulerQueueArtifact,
  createRuntimeSchedulerQueueArtifactReview,
  createRuntimeSchedulerQueueArtifactSafeReport,
  revokeRuntimeSchedulerQueueArtifact,
  revokeRuntimeSchedulerQueueArtifactReview,
  revokeRuntimeSchedulerQueueArtifactSafeReport,
  type RuntimeSchedulerQueueArtifactInput,
} from "./video-orchestrator-runtime-scheduler-queue-artifact.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "runtime-scheduler-queue-artifact-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-runtime-scheduler-queue-artifact-001",
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
  request_id: "runtime-scheduler-queue-artifact-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-artifact-001",
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
  request_id: "runtime-scheduler-queue-artifact-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-runtime-scheduler-queue-artifact-001",
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

function queue() {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  return buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
}

test("VO-7EP-RUNTIME-SCHEDULER-QUEUE-ARTIFACT-1: builds safe dry-run queue artifact preview", () => {
  const result = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue(), { id: "runtime-scheduler-queue-artifact-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.artifact_state, "ready_for_operator_review");
  assert.equal(result.artifact_only, true);
  assert.equal(result.artifact?.schema_version, "1.0");
  assert.equal(result.artifact?.dry_run_only, true);
  assert.equal(result.artifact?.items.length, 2);
  assert.equal(result.artifact?.items[0]?.state, "queued_dry_run");
  assert.equal(result.artifact?.items[1]?.state, "manual_fallback");
  assert.equal(result.artifact_json_preview.includes("says-the-bible-runtime-scheduler-queue-artifact"), true);
  assert.equal(result.artifact_json_preview.includes("access_token"), false);
  assert.equal(result.artifact_json_preview.includes("[API_KEY"), false);
  assert.equal(result.file_written_now, false);
  assert.equal(result.live_scheduler_executed, false);
  assert.equal(result.upload_executed, false);
  assert.equal(result.network_calls_made, false);
  assert.equal(result.credential_accessed, false);
  assert.equal(result.media_read_performed, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.validation.complete, true);
});

test("VO-7EP-RUNTIME-SCHEDULER-QUEUE-ARTIFACT-2: unsafe path blocks artifact", () => {
  const result = buildRuntimeSchedulerQueueArtifact({ ...ARTIFACT_INPUT, proposed_path: ".env" }, queue());

  assert.equal(result.artifact_state, "blocked");
  assert.equal(result.artifact, null);
  assert.equal(result.artifact_json_preview, "");
  assert.equal(result.file_written_now, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
});

test("VO-7EQ-RUNTIME-SCHEDULER-QUEUE-ARTIFACT-REVIEW-1: safe report requires confirmation before file write or staging", () => {
  const artifact = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue());
  const review = createRuntimeSchedulerQueueArtifactReview(artifact, { id: "runtime-scheduler-queue-artifact-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createRuntimeSchedulerQueueArtifactSafeReport(review, artifact, { id: "runtime-scheduler-queue-artifact-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.artifact_item_count, 2);
  assert.equal(review.file_written_now, false);
  assert.equal(review.live_scheduler_executed, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.network_calls_made, false);
  assert.equal(review.credential_accessed, false);
  assert.equal(review.media_read_performed, false);
  assert.equal(review.git_add_executed, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_file_write_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.artifact_item_count, 2);
  assert.equal(report.file_written_now, false);
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

test("VO-7EQ-RUNTIME-SCHEDULER-QUEUE-ARTIFACT-REVIEW-2: revocation keeps artifact disabled", () => {
  const artifact = buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue());
  const review = createRuntimeSchedulerQueueArtifactReview(artifact);
  const report = createRuntimeSchedulerQueueArtifactSafeReport(review, artifact);

  assert.equal(revokeRuntimeSchedulerQueueArtifact(artifact).artifact_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueArtifactReview(review).review_state, "revoked");
  assert.equal(revokeRuntimeSchedulerQueueArtifactSafeReport(report).safe_report_state, "revoked");
});
