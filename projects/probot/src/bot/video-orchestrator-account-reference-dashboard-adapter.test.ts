import { test } from "node:test";
import assert from "node:assert";
import { createVideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";
import { createVideoOrchestratorDashboardAccountUiModelFromReferenceRegistry, groupVideoOrchestratorAccountReferencesForDashboard } from "./video-orchestrator-account-reference-dashboard-adapter.js";
import { renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";

test("VO-7DZ-ACCOUNT-REFERENCE-DASHBOARD-ADAPTER-1: groups references by project", () => {
  const registry = createVideoOrchestratorAccountReferenceRegistryModel([
    { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "YouTube Main", auth_mode: "oauth", auth_status: "connected" },
    { project_id: "says-the-bible", platform: "pinterest", account_id: "pin-main", reference_label: "Pinterest Main", auth_mode: "api_key", auth_status: "needs_setup" },
    { project_id: "second-project", platform: "youtube", account_id: "yt-second", reference_label: "Second YouTube", auth_mode: "oauth", enabled: false },
  ]);
  const groups = groupVideoOrchestratorAccountReferencesForDashboard(registry);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.project_id, "says-the-bible");
  assert.equal(groups[0]?.accounts.length, 2);
  assert.equal(groups[1]?.project_id, "second-project");
  assert.equal(groups[1]?.accounts.length, 1);
});

test("VO-7DZ-ACCOUNT-REFERENCE-DASHBOARD-ADAPTER-2: creates safe dashboard UI model from reference registry", () => {
  const registry = createVideoOrchestratorAccountReferenceRegistryModel([
    { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "YouTube Main", auth_mode: "oauth", auth_status: "connected", oauth_connect_url: "https://accounts.google.com/o/oauth2/v2/auth" },
    { project_id: "says-the-bible", platform: "pinterest", account_id: "pin-main", reference_label: "Pinterest Main", auth_mode: "api_key", auth_status: "needs_setup", api_key_setup_url: "https://developers.pinterest.com/apps/", api_key: "[API_KEY_PLACEHOLDER]" },
  ]);
  const model = createVideoOrchestratorDashboardAccountUiModelFromReferenceRegistry(registry);
  const html = renderVideoOrchestratorDashboardAccountUi(model);

  assert.equal(model.summary.project_count, 1);
  assert.equal(model.summary.account_count, 2);
  assert.equal(model.summary.connected_count, 1);
  assert.equal(model.summary.needs_setup_count, 1);
  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.secrets_rendered, false);
  assert.equal(model.safety.oauth_exchange_executed, false);
  assert.equal(model.safety.env_written, false);
  assert.equal(model.safety.files_written, false);
  assert.equal(model.safety.uploads_executed, false);
  assert.equal(html.includes("YouTube Main"), true);
  assert.equal(html.includes("Pinterest Main"), true);
  assert.equal(html.includes("[API_KEY_PLACEHOLDER]"), false);
});

test("VO-7EA-ACCOUNT-REFERENCE-DASHBOARD-ADAPTER-REVIEW-1: sensitive input downgrades dashboard status to setup", () => {
  const registry = createVideoOrchestratorAccountReferenceRegistryModel([
    { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "YouTube Main", auth_mode: "oauth", auth_status: "connected", token: "[TOKEN_PLACEHOLDER]" },
  ]);
  const model = createVideoOrchestratorDashboardAccountUiModelFromReferenceRegistry(registry);

  assert.equal(model.summary.connected_count, 0);
  assert.equal(model.summary.needs_setup_count, 1);
  assert.equal(model.projects[0]?.accounts[0]?.next_action.includes("Remove sensitive values"), true);
});
