import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import { createVideoOrchestratorAccountModelDesign, createVideoOrchestratorAccountModelReview, createVideoOrchestratorAccountModelSafeReport } from "./video-orchestrator-account-model-design.js";
import {
  createSaysTheBibleMigrationBridgeDesign,
  createSaysTheBibleMigrationBridgeReview,
  createSaysTheBibleMigrationBridgeSafeReport,
  revokeSaysTheBibleMigrationBridgeDesign,
  revokeSaysTheBibleMigrationBridgeReview,
  revokeSaysTheBibleMigrationBridgeSafeReport,
} from "./video-orchestrator-says-the-bible-mapping-design.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

function readyAccountModel() {
  const accountDesign = createVideoOrchestratorAccountModelDesign();
  const review = createVideoOrchestratorAccountModelReview(accountDesign);
  const safeReport = createVideoOrchestratorAccountModelSafeReport(review, accountDesign);
  return { accountDesign, safeReport };
}

test("VO-7BY-STB-MAPPING-1: maps legacy Says the Bible surfaces without mutating or calling them", () => {
  const { accountDesign, safeReport } = readyAccountModel();
  const mapping = createSaysTheBibleMigrationBridgeDesign(safeReport, accountDesign, { id: "stb-mapping-design-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(mapping.schema_version, "1.0");
  assert.equal(mapping.mapping_state, "approved_for_youtube_policy_design");
  assert.equal(mapping.design_only, true);
  assert.equal(mapping.read_only_legacy_analysis_only, true);
  assert.equal(mapping.target_project_id, "says-the-bible");
  assert.equal(mapping.target_platform, "youtube");
  assert.equal(mapping.legacy_surfaces.length, 6);
  assert.equal(mapping.legacy_surfaces.some((surface) => surface.legacy_surface_kind === "youtube_upload" && surface.target_abstraction === "platform_adapter"), true);
  assert.equal(mapping.legacy_surfaces.some((surface) => surface.legacy_surface_kind === "youtube_oauth" && surface.target_abstraction === "credential_reference"), true);
  assert.equal(mapping.legacy_surfaces.some((surface) => surface.legacy_surface_kind === "youtube_db_sync" && surface.target_abstraction === "upload_lifecycle"), true);
  assert.equal(mapping.legacy_surfaces.every((surface) => !surface.legacy_repo_modified_now && !surface.legacy_pipeline_called_now && !surface.credentials_copied_now && !surface.media_read_now && !surface.network_called_now && !surface.upload_executed_now), true);
  assert.equal(mapping.legacy_repo_modified_now, false);
  assert.equal(mapping.legacy_pipeline_called_now, false);
  assert.equal(mapping.credentials_copied_now, false);
  assert.equal(mapping.media_read_now, false);
  assert.equal(mapping.network_called_now, false);
  assert.equal(mapping.platform_api_called_now, false);
  assert.equal(mapping.upload_executed_now, false);
  assert.equal(mapping.migration_bridge_enabled_now, false);
  assertDisabledBoundary(mapping.execution_boundary);
});

test("VO-7BY-STB-MAPPING-2: blocked account model blocks mapping", () => {
  const accountDesign = createVideoOrchestratorAccountModelDesign({ requestLegacyMappingDesign: false });
  const review = createVideoOrchestratorAccountModelReview(accountDesign);
  const safeReport = createVideoOrchestratorAccountModelSafeReport(review, accountDesign);
  const mapping = createSaysTheBibleMigrationBridgeDesign(safeReport, accountDesign);

  assert.equal(mapping.mapping_state, "blocked");
  assert.equal(mapping.validation.complete, false);
  assert.equal(mapping.validation.ready_for_next_phase, false);
  assertDisabledBoundary(mapping.execution_boundary);
});

test("VO-7BY-STB-MAPPING-3: review and safe report remain design-only", () => {
  const { accountDesign, safeReport } = readyAccountModel();
  const mapping = createSaysTheBibleMigrationBridgeDesign(safeReport, accountDesign);
  const review = createSaysTheBibleMigrationBridgeReview(mapping, { id: "stb-mapping-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createSaysTheBibleMigrationBridgeSafeReport(review, mapping, { id: "stb-mapping-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.reviewed_mapping_ids.length, 6);
  assert.equal(review.legacy_repo_modified_now, false);
  assert.equal(review.legacy_pipeline_called_now, false);
  assert.equal(review.upload_executed_now, false);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_youtube_platform_policy_design");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.legacy_repo_modified_now, false);
  assert.equal(report.legacy_pipeline_called_now, false);
  assert.equal(report.credentials_copied_now, false);
  assert.equal(report.media_read_now, false);
  assert.equal(report.network_called_now, false);
  assert.equal(report.platform_api_called_now, false);
  assert.equal(report.upload_executed_now, false);
  assert.equal(report.migration_bridge_enabled_now, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BY-STB-MAPPING-4: revocation keeps all mapping artifacts disabled", () => {
  const { accountDesign, safeReport } = readyAccountModel();
  const mapping = createSaysTheBibleMigrationBridgeDesign(safeReport, accountDesign);
  const review = createSaysTheBibleMigrationBridgeReview(mapping);
  const report = createSaysTheBibleMigrationBridgeSafeReport(review, mapping);

  const revokedMapping = revokeSaysTheBibleMigrationBridgeDesign(mapping, "Operator revoked STB mapping design.");
  const revokedReview = revokeSaysTheBibleMigrationBridgeReview(review, "Operator revoked STB mapping review.");
  const revokedReport = revokeSaysTheBibleMigrationBridgeSafeReport(report, "Operator revoked STB mapping safe report.");

  assert.equal(revokedMapping.mapping_state, "revoked");
  assert.equal(revokedMapping.validation.complete, false);
  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assertDisabledBoundary(revokedMapping.execution_boundary);
  assertDisabledBoundary(revokedReview.execution_boundary);
  assertDisabledBoundary(revokedReport.execution_boundary);
});
