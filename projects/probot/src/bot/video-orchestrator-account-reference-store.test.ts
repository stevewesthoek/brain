import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";
import {
  buildVideoOrchestratorAccountReferenceStoreArtifact,
  createVideoOrchestratorAccountReferenceStoreReview,
  createVideoOrchestratorAccountReferenceStoreSafeReport,
  revokeVideoOrchestratorAccountReferenceStoreBuildResult,
  revokeVideoOrchestratorAccountReferenceStoreReview,
  revokeVideoOrchestratorAccountReferenceStoreSafeReport,
  type VideoOrchestratorAccountReferenceStoreInput,
} from "./video-orchestrator-account-reference-store.js";

const INPUT: VideoOrchestratorAccountReferenceStoreInput = {
  request_id: "account-reference-store-request-001",
  project_id: "says-the-bible",
  operator_approval_id: "operator-account-reference-store-001",
  store_id: "says-the-bible-account-reference-store",
  proposed_path: "operations/runbooks/video-orchestrator-account-reference-registry.example.json",
  allow_artifact_build_only: true,
  allow_file_write: false,
  allow_env_write: false,
  allow_keychain_write: false,
  allow_sensitive_value_storage: false,
  allow_oauth_exchange: false,
  allow_git_add: false,
  allow_commit: false,
  allow_push: false,
};

const MODEL = createVideoOrchestratorAccountReferenceRegistryModel([
  { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "youtube-oauth-main", auth_mode: "oauth", auth_status: "connected", oauth_connect_url: "https://accounts.google.com/o/oauth2/v2/auth" },
  { project_id: "says-the-bible", platform: "pinterest", account_id: "pin-main", reference_label: "pinterest-api-main", auth_mode: "api_key", auth_status: "needs_setup", api_key_setup_url: "https://developers.pinterest.com/apps/" },
]);

test("VO-7ED-ACCOUNT-REFERENCE-STORE-1: builds reference-only store artifact without writes", () => {
  const result = buildVideoOrchestratorAccountReferenceStoreArtifact(INPUT, MODEL, { id: "account-reference-store-result-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(result.store_state, "ready_for_operator_review");
  assert.equal(result.artifact_build_only, true);
  assert.equal(result.artifact?.schema_version, "1.0");
  assert.equal(result.artifact?.reference_only, true);
  assert.equal(result.artifact?.entries.length, 2);
  assert.equal(result.artifact?.safety.sensitive_values_included, false);
  assert.equal(result.artifact?.safety.sensitive_read_performed, false);
  assert.equal(result.artifact?.safety.sensitive_write_performed, false);
  assert.equal(result.artifact?.safety.oauth_exchange_executed, false);
  assert.equal(result.artifact?.safety.env_written, false);
  assert.equal(result.artifact?.safety.file_written, false);
  assert.equal(result.file_write_enabled, false);
  assert.equal(result.file_written_now, false);
  assert.equal(result.env_write_enabled, false);
  assert.equal(result.keychain_write_enabled, false);
  assert.equal(result.sensitive_value_storage_enabled, false);
  assert.equal(result.oauth_exchange_enabled, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.validation.complete, true);
  assert.equal(result.validation.ready_for_store_review, true);
});

test("VO-7ED-ACCOUNT-REFERENCE-STORE-2: artifact preview excludes sensitive placeholder shapes", () => {
  const result = buildVideoOrchestratorAccountReferenceStoreArtifact(INPUT, MODEL);

  assert.equal(result.artifact_json_preview.includes("[TOKEN"), false);
  assert.equal(result.artifact_json_preview.includes("[API_KEY"), false);
  assert.equal(result.artifact_json_preview.includes("[CLIENT_SECRET"), false);
  assert.equal(result.artifact_json_preview.toLowerCase().includes("keychain://"), false);
  assert.equal(result.artifact_json_preview.includes("youtube-oauth-main"), true);
});

test("VO-7ED-ACCOUNT-REFERENCE-STORE-3: unsafe path or permission blocks artifact", () => {
  const result = buildVideoOrchestratorAccountReferenceStoreArtifact({ ...INPUT, proposed_path: "secrets/account-store.json", allow_file_write: true as false }, MODEL);

  assert.equal(result.store_state, "blocked");
  assert.equal(result.artifact, null);
  assert.equal(result.artifact_json_preview, "");
  assert.equal(result.file_written_now, false);
  assert.equal(result.git_add_executed, false);
  assert.equal(result.committed_now, false);
  assert.equal(result.pushed_now, false);
  assert.equal(result.validation.complete, false);
});

test("VO-7EE-ACCOUNT-REFERENCE-STORE-REVIEW-1: safe report requires confirmation before file write or staging", () => {
  const result = buildVideoOrchestratorAccountReferenceStoreArtifact(INPUT, MODEL);
  const review = createVideoOrchestratorAccountReferenceStoreReview(result, { id: "account-reference-store-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorAccountReferenceStoreSafeReport(review, result, { id: "account-reference-store-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.artifact_entry_count, 2);
  assert.equal(review.artifact_build_only, true);
  assert.equal(review.file_written_now, false);
  assert.equal(review.env_write_enabled, false);
  assert.equal(review.keychain_write_enabled, false);
  assert.equal(review.sensitive_value_storage_enabled, false);
  assert.equal(review.oauth_exchange_enabled, false);
  assert.equal(review.git_add_executed, false);
  assert.equal(review.committed_now, false);
  assert.equal(review.pushed_now, false);

  assert.equal(report.safe_report_state, "requires_operator_confirmation_for_file_write_or_git_staging");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.artifact_entry_count, 2);
  assert.equal(report.artifact_build_only, true);
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

test("VO-7EE-ACCOUNT-REFERENCE-STORE-REVIEW-2: revocation keeps store artifacts disabled", () => {
  const result = buildVideoOrchestratorAccountReferenceStoreArtifact(INPUT, MODEL);
  const review = createVideoOrchestratorAccountReferenceStoreReview(result);
  const report = createVideoOrchestratorAccountReferenceStoreSafeReport(review, result);

  assert.equal(revokeVideoOrchestratorAccountReferenceStoreBuildResult(result).store_state, "revoked");
  assert.equal(revokeVideoOrchestratorAccountReferenceStoreReview(review).review_state, "revoked");
  assert.equal(revokeVideoOrchestratorAccountReferenceStoreSafeReport(report).safe_report_state, "revoked");
});
