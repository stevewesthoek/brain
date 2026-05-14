import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";
import {
  createVideoOrchestratorAccountReferencePersistencePlan,
  createVideoOrchestratorAccountReferencePersistenceReview,
  createVideoOrchestratorAccountReferencePersistenceSafeReport,
  revokeVideoOrchestratorAccountReferencePersistencePlan,
  revokeVideoOrchestratorAccountReferencePersistenceReview,
  revokeVideoOrchestratorAccountReferencePersistenceSafeReport,
  type VideoOrchestratorAccountReferencePersistenceInput,
} from "./video-orchestrator-account-reference-persistence-plan.js";

const MODEL = createVideoOrchestratorAccountReferenceRegistryModel([
  { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "youtube-oauth-main", auth_mode: "oauth", auth_status: "connected" },
  { project_id: "says-the-bible", platform: "pinterest", account_id: "pin-main", reference_label: "pinterest-api-main", auth_mode: "api_key", auth_status: "needs_setup", api_key: "[API_KEY_PLACEHOLDER]" },
]);

const INPUT: VideoOrchestratorAccountReferencePersistenceInput = {
  request_id: "account-reference-persistence-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-account-reference-persistence-001",
  persistence_target: "repo_local_json",
  proposed_path: "operations/runbooks/video-orchestrator-account-reference-registry.example.json",
  allow_plan_only: true,
  allow_file_write: false,
  allow_env_write: false,
  allow_keychain_write: false,
  allow_sensitive_value_storage: false,
  allow_oauth_exchange: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

test("VO-7EB-ACCOUNT-REFERENCE-PERSISTENCE-PLAN-1: creates dry-run persistence plan without writes", () => {
  const plan = createVideoOrchestratorAccountReferencePersistencePlan(INPUT, MODEL, { id: "account-reference-persistence-plan-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(plan.plan_state, "ready_for_operator_review");
  assert.equal(plan.persistence_target, "repo_local_json");
  assert.equal(plan.proposed_path, "operations/runbooks/video-orchestrator-account-reference-registry.example.json");
  assert.equal(plan.reference_count, 2);
  assert.equal(plan.rejected_sensitive_value_count, 1);
  assert.equal(plan.dry_run_only, true);
  assert.equal(plan.file_write_enabled, false);
  assert.equal(plan.file_written_now, false);
  assert.equal(plan.env_write_enabled, false);
  assert.equal(plan.keychain_write_enabled, false);
  assert.equal(plan.sensitive_value_storage_enabled, false);
  assert.equal(plan.oauth_exchange_enabled, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
  assert.equal(plan.validation.complete, true);
  assert.equal(plan.validation.ready_for_persistence_review, true);
});

test("VO-7EB-ACCOUNT-REFERENCE-PERSISTENCE-PLAN-2: unsafe path and permissions block planning", () => {
  const plan = createVideoOrchestratorAccountReferencePersistencePlan({ ...INPUT, proposed_path: ".env", allow_file_write: true as false }, MODEL);

  assert.equal(plan.plan_state, "blocked");
  assert.equal(plan.proposed_path, "blocked-path");
  assert.equal(plan.validation.complete, false);
  assert.equal(plan.file_written_now, false);
  assert.equal(plan.git_add_executed, false);
  assert.equal(plan.committed_now, false);
  assert.equal(plan.pushed_now, false);
});

test("VO-7EC-ACCOUNT-REFERENCE-PERSISTENCE-REVIEW-1: safe report requires confirmation before persistence implementation or staging", () => {
  const plan = createVideoOrchestratorAccountReferencePersistencePlan(INPUT, MODEL);
  const review = createVideoOrchestratorAccountReferencePersistenceReview(plan, { id: "account-reference-persistence-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorAccountReferencePersistenceSafeReport(review, plan, { id: "account-reference-persistence-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.dry_run_only, true);
  assert.equal(review.file_written_now, false);
  assert.equal(review.env_write_enabled, false);
  assert.equal(review.keychain_write_enabled, false);
  assert.equal(review.sensitive_value_storage_enabled, false);
  assert.equal(review.oauth_exchange_enabled, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_persistence_implementation_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.dry_run_only, true);
  assert.equal(report.file_written_now, false);
  assert.equal(report.env_write_enabled, false);
  assert.equal(report.keychain_write_enabled, false);
  assert.equal(report.sensitive_value_storage_enabled, false);
  assert.equal(report.oauth_exchange_enabled, false);
  assert.equal(report.git_add_executed, false);
  assert.equal(report.committed_now, false);
  assert.equal(report.pushed_now, false);
  assert.equal(report.validation.ready_for_next_phase, false);
});

test("VO-7EC-ACCOUNT-REFERENCE-PERSISTENCE-REVIEW-2: revocation keeps persistence artifacts disabled", () => {
  const plan = createVideoOrchestratorAccountReferencePersistencePlan(INPUT, MODEL);
  const review = createVideoOrchestratorAccountReferencePersistenceReview(plan);
  const report = createVideoOrchestratorAccountReferencePersistenceSafeReport(review, plan);

  assert.equal(revokeVideoOrchestratorAccountReferencePersistencePlan(plan).plan_state, "revoked");
  assert.equal(revokeVideoOrchestratorAccountReferencePersistenceReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorAccountReferencePersistenceSafeReport(report).safe_report_state, "revoked");
});
