import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import { createVideoOrchestratorScheduleResumePlan, type VideoOrchestratorScheduleResumeInput } from "./video-orchestrator-platform-scheduler-resume.js";
import { buildVideoOrchestratorRuntimeSchedulerQueue, type VideoOrchestratorRuntimeSchedulerQueueInput } from "./video-orchestrator-runtime-scheduler-queue.js";
import { buildRuntimeSchedulerQueueArtifact, type RuntimeSchedulerQueueArtifactInput } from "./video-orchestrator-runtime-scheduler-queue-artifact.js";
import {
  createLiveSchedulerActivationGate,
  createLiveSchedulerActivationReview,
  createLiveSchedulerActivationSafeReport,
  revokeLiveSchedulerActivationGate,
  revokeLiveSchedulerActivationReview,
  revokeLiveSchedulerActivationSafeReport,
  type LiveSchedulerActivationGateInput,
} from "./video-orchestrator-live-scheduler-activation-gate.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function scheduleInput(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "live-scheduler-activation-gate-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-live-scheduler-activation-gate-001",
    platform,
    account_id: `${platform}-main`,
    content_id,
    desired_publish_at: "2026-05-15T10:00:00.000Z",
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
  request_id: "live-scheduler-activation-gate-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-live-scheduler-activation-gate-001",
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
  request_id: "live-scheduler-activation-gate-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-live-scheduler-activation-gate-001",
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

const GATE_INPUT: LiveSchedulerActivationGateInput = {
  request_id: "live-scheduler-activation-gate-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-live-scheduler-activation-gate-001",
  gate_id: "says-the-bible-live-scheduler-activation-gate",
  allow_gate_only: true,
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

function artifact() {
  const plan = createVideoOrchestratorScheduleResumePlan([scheduleInput("youtube", "video-001"), scheduleInput("manual", "video-002")], REGISTRY);
  const queue = buildVideoOrchestratorRuntimeSchedulerQueue(QUEUE_INPUT, plan);
  return buildRuntimeSchedulerQueueArtifact(ARTIFACT_INPUT, queue);
}

test("VO-7ER-LIVE-SCHEDULER-ACTIVATION-GATE-1: creates reviewable gate while live scheduler remains disabled", () => {
  const gate = createLiveSchedulerActivationGate(GATE_INPUT, artifact(), { id: "live-scheduler-activation-gate-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(gate.gate_state, "ready_for_operator_review");
  assert.equal(gate.artifact_item_count, 2);
  assert.equal(gate.eligible_dry_run_item_count, 1);
  assert.equal(gate.live_scheduler_allowed, false);
  assert.equal(gate.live_scheduler_executed, false);
  assert.equal(gate.upload_executed, false);
  assert.equal(gate.network_calls_made, false);
  assert.equal(gate.credential_accessed, false);
  assert.equal(gate.media_read_performed, false);
  assert.equal(gate.files_written, false);
  assert.equal(gate.git_add_executed, false);
  assert.equal(gate.committed_now, false);
  assert.equal(gate.pushed_now, false);
  assert.equal(gate.validation.complete, true);
  assert.equal(gate.validation.ready_for_activation_review, true);
});

test("VO-7ER-LIVE-SCHEDULER-ACTIVATION-GATE-2: unsafe live scheduler permission blocks gate", () => {
  const gate = createLiveSchedulerActivationGate({ ...GATE_INPUT, allow_live_scheduler: true as false }, artifact());

  assert.equal(gate.gate_state, "blocked");
  assert.equal(gate.artifact_result_id, null);
  assert.equal(gate.artifact_item_count, 0);
  assert.equal(gate.live_scheduler_allowed, false);
  assert.equal(gate.live_scheduler_executed, false);
  assert.equal(gate.validation.complete, false);
});

test("VO-7ES-LIVE-SCHEDULER-ACTIVATION-GATE-REVIEW-1: safe report requires explicit live scheduler confirmation", () => {
  const gate = createLiveSchedulerActivationGate(GATE_INPUT, artifact());
  const review = createLiveSchedulerActivationReview(gate, { id: "live-scheduler-activation-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createLiveSchedulerActivationSafeReport(review, gate, { id: "live-scheduler-activation-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.artifact_item_count, 2);
  assert.equal(review.live_scheduler_allowed, false);
  assert.equal(review.live_scheduler_executed, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.network_calls_made, false);
  assert.equal(review.credential_accessed, false);
  assert.equal(review.media_read_performed, false);
  assert.equal(review.git_add_executed, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_live_scheduler");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.artifact_item_count, 2);
  assert.equal(report.live_scheduler_allowed, false);
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

test("VO-7ES-LIVE-SCHEDULER-ACTIVATION-GATE-REVIEW-2: revocation keeps gate artifacts disabled", () => {
  const gate = createLiveSchedulerActivationGate(GATE_INPUT, artifact());
  const review = createLiveSchedulerActivationReview(gate);
  const report = createLiveSchedulerActivationSafeReport(review, gate);

  assert.equal(revokeLiveSchedulerActivationGate(gate).gate_state, "revoked");
  assert.equal(revokeLiveSchedulerActivationReview(review).review_state, "revoked");
  assert.equal(revokeLiveSchedulerActivationSafeReport(report).safe_report_state, "revoked");
});
