import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorPlatformAdapterRegistry } from "./video-orchestrator-platform-adapter-registry.js";
import {
  createVideoOrchestratorScheduleResumePlan,
  createVideoOrchestratorScheduleResumeReview,
  createVideoOrchestratorScheduleResumeSafeReport,
  revokeVideoOrchestratorScheduleResumePlan,
  revokeVideoOrchestratorScheduleResumeReview,
  revokeVideoOrchestratorScheduleResumeSafeReport,
  type VideoOrchestratorScheduleResumeInput,
} from "./video-orchestrator-platform-scheduler-resume.js";

const REGISTRY = createVideoOrchestratorPlatformAdapterRegistry([
  { platform: "youtube", adapter_id: "youtube-api", mode: "api", status: "supported", supports_scheduled_publish: true, supports_resume: true, supports_multi_account: true },
  { platform: "tiktok", adapter_id: "tiktok-api", mode: "api", status: "partial", supports_scheduled_publish: false, supports_resume: false },
  { platform: "pinterest", adapter_id: "pinterest-api", mode: "api", status: "partial", supports_scheduled_publish: true, supports_resume: true },
  { platform: "manual", adapter_id: "manual-export", mode: "manual", supports_resume: true },
]);

function input(platform: VideoOrchestratorScheduleResumeInput["platform"], content_id: string, previous_attempt_count = 0): VideoOrchestratorScheduleResumeInput {
  return {
    request_id: "schedule-resume-request-001",
    project_id: "says-the-bible",
    operator_approval_id: "operator-schedule-resume-001",
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

test("VO-7EL-SCHEDULER-RESUME-1: creates contract-only decisions across platform adapter registry", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([
    input("youtube", "video-001"),
    input("tiktok", "video-002"),
    input("manual", "video-003"),
    input("unknown", "video-004"),
  ], REGISTRY, { id: "schedule-resume-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.plan_state, "ready_for_operator_review");
  assert.equal(plan.summary.decision_count, 4);
  assert.equal(plan.summary.schedule_count, 1);
  assert.equal(plan.summary.defer_count, 1);
  assert.equal(plan.summary.manual_fallback_count, 1);
  assert.equal(plan.summary.blocked_count, 1);
  assert.equal(plan.summary.resume_supported_count, 2);
  assert.equal(plan.decisions[0]?.action, "schedule");
  assert.equal(plan.decisions[1]?.action, "defer");
  assert.equal(plan.decisions[2]?.action, "manual_fallback");
  assert.equal(plan.decisions[3]?.action, "blocked");
  assert.equal(plan.safety.contract_only, true);
  assert.equal(plan.safety.runtime_schedule_executed, false);
  assert.equal(plan.safety.upload_executed, false);
  assert.equal(plan.safety.network_calls_made, false);
  assert.equal(plan.safety.credential_accessed, false);
  assert.equal(plan.safety.media_read_performed, false);
  assert.equal(plan.safety.files_written, false);
  assert.equal(plan.safety.git_add_executed, false);
  assert.equal(plan.safety.committed_now, false);
  assert.equal(plan.safety.pushed_now, false);
  assert.equal(plan.validation.complete, true);
});

test("VO-7EL-SCHEDULER-RESUME-2: resume attempt remains contract-only", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([input("youtube", "video-001", 2)], REGISTRY);
  const decision = plan.decisions[0];

  assert.equal(decision?.action, "schedule");
  assert.equal(decision?.previous_attempt_count, 2);
  assert.equal(decision?.next_action.includes("Resume eligible"), true);
  assert.equal(decision?.runtime_schedule_enabled, false);
  assert.equal(decision?.upload_execution_enabled, false);
  assert.equal(decision?.network_enabled, false);
  assert.equal(decision?.credential_access_enabled, false);
  assert.equal(decision?.media_read_enabled, false);
  assert.equal(decision?.file_write_enabled, false);
});

test("VO-7EL-SCHEDULER-RESUME-3: unsafe runtime permissions block planning", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([{ ...input("youtube", "video-001"), allow_runtime_schedule: true as false }], REGISTRY);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.safety.runtime_schedule_executed, false);
  assert.equal(plan.safety.upload_executed, false);
  assert.equal(plan.safety.network_calls_made, false);
});

test("VO-7EM-SCHEDULER-RESUME-REVIEW-1: safe report requires confirmation before runtime scheduler or staging", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([input("youtube", "video-001"), input("manual", "video-002")], REGISTRY);
  const review = createVideoOrchestratorScheduleResumeReview(plan, { id: "schedule-resume-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorScheduleResumeSafeReport(review, plan, { id: "schedule-resume-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.decision_count, 2);
  assert.equal(review.runtime_schedule_executed, false);
  assert.equal(review.upload_executed, false);
  assert.equal(review.network_calls_made, false);
  assert.equal(review.credential_accessed, false);
  assert.equal(review.media_read_performed, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_runtime_scheduler_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.decision_count, 2);
  assert.equal(report.runtime_schedule_executed, false);
  assert.equal(report.upload_executed, false);
  assert.equal(report.network_calls_made, false);
  assert.equal(report.credential_accessed, false);
  assert.equal(report.media_read_performed, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7EM-SCHEDULER-RESUME-REVIEW-2: revocation keeps scheduler artifacts disabled", () => {
  const plan = createVideoOrchestratorScheduleResumePlan([input("youtube", "video-001")], REGISTRY);
  const review = createVideoOrchestratorScheduleResumeReview(plan);
  const report = createVideoOrchestratorScheduleResumeSafeReport(review, plan);

  assert.equal(revokeVideoOrchestratorScheduleResumePlan(plan).plan_state, "revoked");
  assert.equal(revokeVideoOrchestratorScheduleResumeReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorScheduleResumeSafeReport(report).safe_report_state, "revoked");
});
