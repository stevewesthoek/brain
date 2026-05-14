import { test } from "node:test";
import assert from "node:assert";
import type { DisabledEnablementBoundary } from "./real-upload-enablement-gates.js";
import {
  createVideoOrchestratorAccountModelDesign,
  createVideoOrchestratorAccountModelReview,
  createVideoOrchestratorAccountModelSafeReport,
  revokeVideoOrchestratorAccountModelDesign,
  revokeVideoOrchestratorAccountModelReview,
  revokeVideoOrchestratorAccountModelSafeReport,
} from "./video-orchestrator-account-model-design.js";

function assertDisabledBoundary(boundary: DisabledEnablementBoundary) {
  for (const value of Object.values(boundary)) assert.equal(value, false);
}

test("VO-7BX-ACCOUNT-MODEL-1: creates design-only project/platform/account model for Says the Bible", () => {
  const design = createVideoOrchestratorAccountModelDesign({ id: "account-model-design-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(design.schema_version, "1.0");
  assert.equal(design.design_state, "approved_for_legacy_mapping_design");
  assert.equal(design.design_only, true);
  assert.equal(design.dashboard_ui_design_only, true);
  assert.equal(design.projects.length, 1);
  const project = design.projects[0];
  assert.ok(project);
  assert.equal(project.project_id, "says-the-bible");
  assert.equal(project.shared_media_reuse_preferred, true);
  assert.equal(project.platform_accounts.length, 3);
  assert.equal(project.platform_accounts.every((account) => account.multiple_accounts_allowed === true), true);
  assert.equal(design.dashboard_sections.includes("Credential Health"), true);
  assert.equal(design.dashboard_sections.includes("Upload Gates"), true);
  assert.equal(design.database_migrations_added, false);
  assert.equal(design.oauth_callbacks_added, false);
  assert.equal(design.secret_storage_added, false);
  assert.equal(design.env_writes_enabled, false);
  assert.equal(design.upload_execution_enabled, false);
  assert.equal(design.network_calls_enabled, false);
  assert.equal(design.platform_api_calls_enabled, false);
  assert.equal(design.credential_access_enabled, false);
  assert.equal(design.media_reads_enabled, false);
  assertDisabledBoundary(design.execution_boundary);
});

test("VO-7BX-ACCOUNT-MODEL-2: supports multiple projects and multiple accounts per platform without enabling upload", () => {
  const design = createVideoOrchestratorAccountModelDesign({
    projects: [
      { project_id: "says-the-bible", project_label: "Says the Bible", platforms: ["youtube", "youtube", "pinterest"] },
      { project_id: "second-project", project_label: "Second Project", platforms: ["youtube", "tiktok", "pinterest"] },
    ],
  });

  assert.equal(design.projects.length, 2);
  const firstProject = design.projects[0];
  assert.ok(firstProject);
  assert.equal(firstProject.platform_accounts.filter((account) => account.platform === "youtube").length, 2);
  assert.equal(design.projects.every((project) => project.project_upload_gate_enabled_now === false && project.upload_execution_enabled_now === false), true);
  assert.equal(design.projects.every((project) => project.platform_accounts.every((account) => account.upload_gate_state === "disabled" && !account.upload_execution_enabled_now && !account.credential_access_enabled_now && !account.network_access_enabled_now && !account.platform_api_access_enabled_now)), true);
  assert.equal(design.credential_references.length >= 3, true);
});

test("VO-7BX-ACCOUNT-MODEL-3: review and safe report remain inert", () => {
  const design = createVideoOrchestratorAccountModelDesign();
  const review = createVideoOrchestratorAccountModelReview(design, { id: "account-model-review-001", created_at: "2026-05-14T00:00:00.000Z" });
  const report = createVideoOrchestratorAccountModelSafeReport(review, design, { id: "account-model-safe-report-001", created_at: "2026-05-14T00:00:00.000Z" });

  assert.equal(review.review_state, "approved_for_safe_report");
  assert.equal(review.review_only, true);
  assert.equal(review.database_migrations_added, false);
  assert.equal(review.oauth_callbacks_added, false);
  assert.equal(review.secret_storage_added, false);
  assert.equal(review.upload_execution_enabled, false);
  assert.equal(review.reviewed_sections.length >= 5, true);
  assertDisabledBoundary(review.execution_boundary);

  assert.equal(report.safe_report_state, "approved_for_says_the_bible_mapping_design");
  assert.equal(report.safe_report_only, true);
  assert.equal(report.database_migrations_added, false);
  assert.equal(report.oauth_callbacks_added, false);
  assert.equal(report.secret_storage_added, false);
  assert.equal(report.upload_execution_enabled, false);
  assert.equal(report.network_calls_enabled, false);
  assert.equal(report.platform_api_calls_enabled, false);
  assert.equal(report.credential_access_enabled, false);
  assert.equal(report.media_reads_enabled, false);
  assertDisabledBoundary(report.execution_boundary);
});

test("VO-7BX-ACCOUNT-MODEL-4: unsafe strings are sanitized", () => {
  const unsafe = "../unsafe https://example.com access_token client_secret videos.insert fetch(";
  const design = createVideoOrchestratorAccountModelDesign({
    id: unsafe,
    created_at: unsafe,
    projects: [{ project_id: unsafe, project_label: unsafe, platforms: ["youtube"] }],
  });
  const review = createVideoOrchestratorAccountModelReview(design, { id: unsafe, created_at: unsafe });
  const report = createVideoOrchestratorAccountModelSafeReport(review, design, { id: unsafe, created_at: unsafe });
  const serialized = JSON.stringify({ design, review, report });

  for (const blocked of ["https://example.com", "access_token", "client_secret", "videos.insert", "fetch(", "../unsafe"]) {
    assert.equal(serialized.includes(blocked), false);
  }
});

test("VO-7BX-ACCOUNT-MODEL-5: revocation keeps account model artifacts disabled", () => {
  const design = createVideoOrchestratorAccountModelDesign();
  const review = createVideoOrchestratorAccountModelReview(design);
  const report = createVideoOrchestratorAccountModelSafeReport(review, design);
  const revokedDesign = revokeVideoOrchestratorAccountModelDesign(design, "Operator revoked account model design.");
  const revokedReview = revokeVideoOrchestratorAccountModelReview(review, "Operator revoked account model review.");
  const revokedReport = revokeVideoOrchestratorAccountModelSafeReport(report, "Operator revoked account model safe report.");

  assert.equal(revokedDesign.design_state, "revoked");
  assert.equal(revokedDesign.validation.complete, false);
  assert.equal(revokedDesign.validation.ready_for_next_phase, false);
  assert.equal(revokedReview.review_state, "revoked");
  assert.equal(revokedReview.validation.complete, false);
  assert.equal(revokedReport.safe_report_state, "revoked");
  assert.equal(revokedReport.validation.complete, false);
  assertDisabledBoundary(revokedDesign.execution_boundary);
  assertDisabledBoundary(revokedReview.execution_boundary);
  assertDisabledBoundary(revokedReport.execution_boundary);
});
