import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import { createYouTubePlatformPolicyDesign, createYouTubePlatformPolicyReview, createYouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";
import { createAccountUiFlowDesign, createAccountUiFlowReview, createAccountUiFlowSafeReport } from "./video-orchestrator-account-ui-flow-design.js";
import {
  createYouTubePreflightContracts,
  createYouTubePreflightContractReview,
  createYouTubePreflightContractSafeReport,
  revokeYouTubePreflightContracts,
  revokeYouTubePreflightContractReview,
  revokeYouTubePreflightContractSafeReport,
} from "./video-orchestrator-youtube-preflight-contracts.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }
function readyUiPair() {
  const accountDesign = createVideoOrchestratorAccountModelDesign();
  const accountReview = createVideoOrchestratorAccountModelReview(accountDesign);
  const accountSafeReport = createVideoOrchestratorAccountModelSafeReport(accountReview, accountDesign);
  const mapping = createSaysTheBibleMigrationBridgeDesign(accountSafeReport, accountDesign);
  const mappingReview = createSaysTheBibleMigrationBridgeReview(mapping);
  const mappingSafeReport = createSaysTheBibleMigrationBridgeSafeReport(mappingReview, mapping);
  const policy = createYouTubePlatformPolicyDesign(mappingSafeReport, mapping);
  const policyReview = createYouTubePlatformPolicyReview(policy);
  const policySafeReport = createYouTubePlatformPolicySafeReport(policyReview, policy);
  const uiDesign = createAccountUiFlowDesign(policySafeReport, policy);
  const uiReview = createAccountUiFlowReview(uiDesign);
  const uiSafeReport = createAccountUiFlowSafeReport(uiReview, uiDesign);
  return { uiDesign, uiSafeReport };
}

test("VO-7CB-PREFLIGHT-CONTRACTS-1: creates declared-only YouTube preflight contracts", () => {
  const { uiDesign, uiSafeReport } = readyUiPair();
  const contracts = createYouTubePreflightContracts(uiSafeReport, uiDesign, { id: "youtube-preflight-contracts-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(contracts.schema_version, "1.0");
  assert.equal(contracts.contracts_state, "approved_for_preflight_review");
  assert.equal(contracts.contracts_only, true);
  assert.equal(contracts.target_platform, "youtube");
  assert.equal(contracts.intended_platform_method, "videos.insert");
  assert.equal(contracts.intended_publish_mode, "scheduled_first_private_fallback");
  assert.equal(contracts.first_upload_attempt_limit, 1);
  assert.equal(contracts.live_preflight_enabled_now, false);
  assert.equal(contracts.secret_access_enabled_now, false);
  assert.equal(contracts.token_access_enabled_now, false);
  assert.equal(contracts.env_access_enabled_now, false);
  assert.equal(contracts.keychain_access_enabled_now, false);
  assert.equal(contracts.media_read_enabled_now, false);
  assert.equal(contracts.network_calls_enabled_now, false);
  assert.equal(contracts.platform_api_calls_enabled_now, false);
  assert.equal(contracts.upload_execution_enabled_now, false);
  assert.equal(contracts.raw_payload_storage_enabled_now, false);
  assert.equal(contracts.raw_response_storage_enabled_now, false);
  assert.equal(contracts.boundary_contracts.length, 8);
  assert.equal(contracts.boundary_contracts.every((boundary) => boundary.declared_only && !boundary.live_checked_now && !boundary.secret_accessed_now && !boundary.token_accessed_now && !boundary.env_accessed_now && !boundary.keychain_accessed_now && !boundary.media_read_now && !boundary.network_called_now && !boundary.platform_api_called_now && !boundary.upload_executed_now && !boundary.raw_payload_stored_now && !boundary.raw_response_stored_now), true);
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7CB-PREFLIGHT-CONTRACTS-2: blocked UI prerequisite blocks contracts", () => {
  const { uiDesign, uiSafeReport } = readyUiPair();
  const blockedReport = { ...uiSafeReport, safe_report_state: "blocked" as const, validation: { ...uiSafeReport.validation, complete: false, ready_for_next_phase: false } };
  const contracts = createYouTubePreflightContracts(blockedReport, uiDesign);
  assert.equal(contracts.contracts_state, "blocked");
  assert.equal(contracts.validation.complete, false);
  assert.equal(contracts.validation.ready_for_next_phase, false);
  assertDisabledBoundary(contracts.execution_boundary);
});

test("VO-7CC-PREFLIGHT-REVIEW-1: review and safe report preserve inert boundaries", () => {
  const { uiDesign, uiSafeReport } = readyUiPair();
  const contracts = createYouTubePreflightContracts(uiSafeReport, uiDesign);
  const review = createYouTubePreflightContractReview(contracts, { id: "youtube-preflight-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createYouTubePreflightContractSafeReport(review, contracts, { id: "youtube-preflight-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.reviewed_boundary_ids.length, 8);
  assert.equal(review.live_preflight_enabled_now, false);
  assert.equal(review.secret_access_enabled_now, false);
  assert.equal(review.media_read_enabled_now, false);
  assert.equal(review.network_calls_enabled_now, false);
  assert.equal(review.platform_api_calls_enabled_now, false);
  assert.equal(review.upload_execution_enabled_now, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_live_preflight_boundary");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.live_preflight_enabled_now, false);
  assert.equal(report.secret_access_enabled_now, false);
  assert.equal(report.token_access_enabled_now, false);
  assert.equal(report.env_access_enabled_now, false);
  assert.equal(report.keychain_access_enabled_now, false);
  assert.equal(report.media_read_enabled_now, false);
  assert.equal(report.network_calls_enabled_now, false);
  assert.equal(report.platform_api_calls_enabled_now, false);
  assert.equal(report.upload_execution_enabled_now, false);
  assert.equal(report.raw_payload_storage_enabled_now, false);
  assert.equal(report.raw_response_storage_enabled_now, false);
  assert.equal(report.ready_for_real_upload, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7CB-PREFLIGHT-CONTRACTS-3: revocation keeps artifacts disabled", () => {
  const { uiDesign, uiSafeReport } = readyUiPair();
  const contracts = createYouTubePreflightContracts(uiSafeReport, uiDesign);
  const review = createYouTubePreflightContractReview(contracts);
  const report = createYouTubePreflightContractSafeReport(review, contracts);

  assert.equal(revokeYouTubePreflightContracts(contracts).contracts_state, "revoked");
  assert.equal(revokeYouTubePreflightContractReview(review).review_state, "revoked");
  assert.equal(revokeYouTubePreflightContractSafeReport(report).safe_report_state, "revoked");
});
