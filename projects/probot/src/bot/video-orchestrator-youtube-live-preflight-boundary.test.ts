import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import { createSaysTheBibleMigrationBridgeDesign, createSaysTheBibleMigrationBridgeReview, createSaysTheBibleMigrationBridgeSafeReport } from "./video-orchestrator-says-the-bible-mapping-design.js";
import { createYouTubePlatformPolicyDesign, createYouTubePlatformPolicyReview, createYouTubePlatformPolicySafeReport } from "./video-orchestrator-youtube-platform-policy.js";
import { createAccountUiFlowDesign, createAccountUiFlowReview, createAccountUiFlowSafeReport } from "./video-orchestrator-account-ui-flow-design.js";
import { createYouTubePreflightContracts, createYouTubePreflightContractReview, createYouTubePreflightContractSafeReport } from "./video-orchestrator-youtube-preflight-contracts.js";
import {
  createYouTubeLivePreflightBoundary,
  createYouTubeLivePreflightBoundaryReview,
  revokeYouTubeLivePreflightBoundary,
  revokeYouTubeLivePreflightBoundaryReview,
} from "./video-orchestrator-youtube-live-preflight-boundary.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) { for (const value of Object.values(boundary)) assert.equal(value, false); }
function readyPreflightPair() {
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
  const contracts = createYouTubePreflightContracts(uiSafeReport, uiDesign);
  const preflightReview = createYouTubePreflightContractReview(contracts);
  const preflightSafeReport = createYouTubePreflightContractSafeReport(preflightReview, contracts);
  return { contracts, preflightSafeReport };
}

test("VO-7CD-LIVE-PREFLIGHT-BOUNDARY-1: boundary requires operator confirmation and implements nothing", () => {
  const { contracts, preflightSafeReport } = readyPreflightPair();
  const boundary = createYouTubeLivePreflightBoundary(preflightSafeReport, contracts, { id: "youtube-live-preflight-boundary-001", created_at: "2026-05-14T00:00:00.000Z" });
  const review = createYouTubeLivePreflightBoundaryReview(boundary);

  assert.equal(boundary.boundary_state, "requires_operator_confirmation");
  assert.equal(boundary.boundary_only, true);
  assert.equal(boundary.explicit_operator_confirmation_required, true);
  assert.equal(boundary.validation.ready_for_next_phase, false);
  assert.equal(boundary.live_preflight_implemented_now, false);
  assert.equal(boundary.live_preflight_enabled_now, false);
  assert.equal(boundary.exact_files_approved_now, false);
  assert.equal(boundary.secret_access_enabled_now, false);
  assert.equal(boundary.token_access_enabled_now, false);
  assert.equal(boundary.env_access_enabled_now, false);
  assert.equal(boundary.keychain_access_enabled_now, false);
  assert.equal(boundary.media_stat_enabled_now, false);
  assert.equal(boundary.media_read_enabled_now, false);
  assert.equal(boundary.network_calls_enabled_now, false);
  assert.equal(boundary.platform_api_calls_enabled_now, false);
  assert.equal(boundary.upload_execution_enabled_now, false);
  assert.equal(boundary.raw_payload_storage_enabled_now, false);
  assert.equal(boundary.raw_response_storage_enabled_now, false);
  assert.equal(boundary.boundary_controls.length, 9);
  assert.equal(boundary.boundary_controls.every((control) => !control.implemented_now && control.requires_future_confirmation && !control.secret_access_enabled_now && !control.media_read_enabled_now && !control.network_call_enabled_now && !control.platform_api_call_enabled_now && !control.upload_execution_enabled_now), true);
  assertDisabledBoundary(boundary.execution_boundary);

  assert.equal(review.review_state, "requires_operator_confirmation");
  assert.equal(review.review_only, true);
  assert.equal(review.validation.ready_for_next_phase, false);
  assert.equal(review.reviewed_control_ids.length, 9);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7CD-LIVE-PREFLIGHT-BOUNDARY-2: blocked preflight report blocks boundary", () => {
  const { contracts, preflightSafeReport } = readyPreflightPair();
  const blockedReport = { ...preflightSafeReport, safe_report_state: "blocked" as const, validation: { ...preflightSafeReport.validation, complete: false, ready_for_next_phase: false } };
  const boundary = createYouTubeLivePreflightBoundary(blockedReport, contracts);
  const review = createYouTubeLivePreflightBoundaryReview(boundary);

  assert.equal(boundary.boundary_state, "blocked");
  assert.equal(boundary.validation.complete, false);
  assert.equal(review.review_state, "blocked");
  assertDisabledBoundary(boundary.execution_boundary);
  assertDisabledBoundary(review.execution_boundary);
});

test("VO-7CD-LIVE-PREFLIGHT-BOUNDARY-3: revocation keeps boundary disabled", () => {
  const { contracts, preflightSafeReport } = readyPreflightPair();
  const boundary = createYouTubeLivePreflightBoundary(preflightSafeReport, contracts);
  const review = createYouTubeLivePreflightBoundaryReview(boundary);

  assert.equal(revokeYouTubeLivePreflightBoundary(boundary).boundary_state, "revoked");
  assert.equal(revokeYouTubeLivePreflightBoundaryReview(review).review_state, "revoked");
});
