import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import {
  createYouTubePlatformPolicyDesign,
  createYouTubePlatformPolicyReview,
  createYouTubePlatformPolicySafeReport,
  revokeYouTubePlatformPolicyDesign,
  revokeYouTubePlatformPolicyReview,
  revokeYouTubePlatformPolicySafeReport,
} from "./video-orchestrator-youtube-platform-policy.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

function readyMappingPair() {
  const accountDesign = createVideoOrchestratorAccountModelDesign();
  const accountReview = createVideoOrchestratorAccountModelReview(accountDesign);
  const accountSafeReport = createVideoOrchestratorAccountModelSafeReport(accountReview, accountDesign);
  const mapping = createSaysTheBibleMigrationBridgeDesign(accountSafeReport, accountDesign);
  const mappingReview = createSaysTheBibleMigrationBridgeReview(mapping);
  const mappingSafeReport = createSaysTheBibleMigrationBridgeSafeReport(mappingReview, mapping);
  return { mapping, mappingSafeReport };
}

test("VO-7BZ-YOUTUBE-POLICY-1: YouTube policy design is policy-only and scheduled-first", () => {
  const { mapping, mappingSafeReport } = readyMappingPair();
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping, { id: "youtube-policy-design-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(policy.schema_version, "1.0");
  assert.equal(policy.policy_state, "approved_for_credential_oauth_ui_design");
  assert.equal(policy.policy_only, true);
  assert.equal(policy.target_platform, "youtube");
  assert.equal(policy.default_publish_mode, "scheduled_first_private_fallback");
  assert.equal(policy.first_upload_attempt_limit, 1);
  assert.equal(policy.upload_quota_units_per_video_insert, 100);
  assert.equal(policy.scheduling_requires_private_status, true);
  assert.equal(policy.unverified_api_project_private_restriction_noted, true);
  assert.equal(policy.idempotency_required, true);
  assert.equal(policy.resume_after_limit_window, true);
  assert.equal(policy.duplicate_prevention_required, true);
  assert.equal(policy.network_calls_enabled, false);
  assert.equal(policy.platform_api_calls_enabled, false);
  assert.equal(policy.credential_access_enabled, false);
  assert.equal(policy.media_reads_enabled, false);
  assert.equal(policy.upload_execution_enabled, false);
  assert.equal(policy.policy_constraints.length, 8);
  assert.equal(policy.upload_attempt_states.includes("retryable"), true);
  assert.equal(policy.upload_attempt_states.includes("scheduled"), true);
  assertDisabledBoundary(policy.execution_boundary);
});

test("VO-7BZ-YOUTUBE-POLICY-2: blocked mapping blocks policy design", () => {
  const { mapping, mappingSafeReport } = readyMappingPair();
  const blockedReport = { ...mappingSafeReport, safe_report_state: "blocked" as const, validation: { ...mappingSafeReport.validation, complete: false, ready_for_next_phase: false } };
  const policy = createYouTubePlatformPolicyDesign(blockedReport, mapping);

  assert.equal(policy.policy_state, "blocked");
  assert.equal(policy.validation.complete, false);
  assert.equal(policy.validation.ready_for_next_phase, false);
  assertDisabledBoundary(policy.execution_boundary);
});

test("VO-7BZ-YOUTUBE-POLICY-3: review and safe report remain inert", () => {
  const { mapping, mappingSafeReport } = readyMappingPair();
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping);
  const review = createYouTubePlatformPolicyReview(policy, { id: "youtube-policy-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubePlatformPolicySafeReport(review, policy, { id: "youtube-policy-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.reviewed_constraint_ids.length, 8);
  assert.equal(review.network_calls_enabled, false);
  assert.equal(review.platform_api_calls_enabled, false);
  assert.equal(review.credential_access_enabled, false);
  assert.equal(review.media_reads_enabled, false);
  assert.equal(review.upload_execution_enabled, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_credential_oauth_ui_design");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.network_calls_enabled, false);
  assert.equal(report.platform_api_calls_enabled, false);
  assert.equal(report.credential_access_enabled, false);
  assert.equal(report.media_reads_enabled, false);
  assert.equal(report.upload_execution_enabled, false);
  assert.equal(report.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BZ-YOUTUBE-POLICY-4: revocation keeps policy artifacts disabled", () => {
  const { mapping, mappingSafeReport } = readyMappingPair();
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping);
  const review = createYouTubePlatformPolicyReview(policy);
  const report = createYouTubePlatformPolicySafeReport(review, policy);

  const revokedPolicy = revokeYouTubePlatformPolicyDesign(policy, "Operator revoked YouTube policy design.");
  const revokedReview = revokeYouTubePlatformPolicyReview(review, "Operator revoked YouTube policy review.");
  const revokedReport = revokeYouTubePlatformPolicySafeReport(report, "Operator revoked YouTube policy safe report.");

  assert.equal(revokedPolicy.policy_state, "revoked");
  assert.equal(revokedPolicy.validation.complete, false);
  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assertDisabledBoundary(revokedPolicy.execution_boundary);
  assertDisabledBoundary(revokedReview.execution_boundary);
  assertDisabledBoundary(revokedReport.execution_boundary);
});
