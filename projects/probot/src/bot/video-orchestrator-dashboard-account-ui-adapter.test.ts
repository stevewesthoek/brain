import { test } from "node:test";
import assert from "node:assert";
import type { LocalAccountRegistry } from "./video-orchestrator-dashboard.js";
import { createVideoOrchestratorDashboardAccountUiModelFromRegistry, groupVideoOrchestratorRegistryAccounts } from "./video-orchestrator-dashboard-account-ui-adapter.js";
import { renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";

const REGISTRY: LocalAccountRegistry = {
  schema_version: "1.0",
  accounts: [
    {
      account_id: "says-youtube-main",
      platform: "youtube",
      account_label: "says-the-bible/main",
      display_name: "Says YouTube Main",
      enabled: true,
      auth_mode: "oauth",
      credential_reference: "[CREDENTIAL_REFERENCE]",
      capabilities: { upload: true, status_check: true, refresh_supported: true, manual_fallback: true },
      default_privacy: "private",
      allowed_privacy: ["private"],
      notes: "project=says-the-bible",
    },
    {
      account_id: "says-pinterest-main",
      platform: "pinterest",
      account_label: "says-the-bible/pinterest",
      display_name: "Says Pinterest Main",
      enabled: true,
      auth_mode: "api_key",
      capabilities: { upload: true, status_check: false, refresh_supported: false, manual_fallback: true },
      default_privacy: "scheduled",
      allowed_privacy: ["scheduled"],
      notes: "project=says-the-bible",
    },
    {
      account_id: "second-youtube-main",
      platform: "youtube",
      account_label: "second/main",
      display_name: "Second YouTube Main",
      enabled: false,
      auth_mode: "oauth",
      capabilities: { upload: true, status_check: true, refresh_supported: true, manual_fallback: true },
      default_privacy: "private",
      allowed_privacy: ["private"],
      notes: "project=second-project",
    },
  ],
};

test("VO-7DJ-DASHBOARD-ACCOUNT-UI-ADAPTER-1: groups registry accounts by inferred project", () => {
  const groups = groupVideoOrchestratorRegistryAccounts(REGISTRY);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.project_id, "says-the-bible");
  assert.equal(groups[0]?.accounts.length, 2);
  assert.equal(groups[1]?.project_id, "second-project");
  assert.equal(groups[1]?.accounts.length, 1);
});

test("VO-7DJ-DASHBOARD-ACCOUNT-UI-ADAPTER-2: creates safe dashboard model from registry without rendering credentials", () => {
  const model = createVideoOrchestratorDashboardAccountUiModelFromRegistry(REGISTRY);
  const html = renderVideoOrchestratorDashboardAccountUi(model);

  assert.equal(model.summary.project_count, 2);
  assert.equal(model.summary.account_count, 3);
  assert.equal(model.summary.platform_count, 2);
  assert.equal(model.summary.connected_count, 1);
  assert.equal(model.summary.needs_setup_count, 1);
  assert.equal(model.summary.disabled_count, 1);
  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.secrets_rendered, false);
  assert.equal(model.safety.env_written, false);
  assert.equal(model.safety.files_written, false);
  assert.equal(model.safety.uploads_executed, false);
  assert.equal(html.includes("Says YouTube Main"), true);
  assert.equal(html.includes("Says Pinterest Main"), true);
  assert.equal(html.includes("Second YouTube Main"), true);
  assert.equal(html.includes("[CREDENTIAL_REFERENCE]"), false);
});

test("VO-7DK-DASHBOARD-ACCOUNT-UI-ADAPTER-REVIEW-1: empty registry remains safe and read-only", () => {
  const model = createVideoOrchestratorDashboardAccountUiModelFromRegistry({ schema_version: "1.0", accounts: [] });
  const html = renderVideoOrchestratorDashboardAccountUi(model);

  assert.equal(model.summary.project_count, 0);
  assert.equal(model.summary.account_count, 0);
  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.oauth_exchange_executed, false);
  assert.equal(html.includes("Project"), false);
  assert.equal(html.includes("OAuth exchange"), true);
});
