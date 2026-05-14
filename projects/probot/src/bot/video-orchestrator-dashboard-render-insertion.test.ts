import { test } from "node:test";
import assert from "node:assert";
import { renderAccountsAndCredentialsPanel, type OAuthClientConfig, type SafeDashboardAccount } from "./video-orchestrator-dashboard.js";
import { createVideoOrchestratorDashboardAccountUiModel, renderVideoOrchestratorDashboardAccountUi } from "./video-orchestrator-dashboard-account-ui.js";

const OAUTH_CONFIG: OAuthClientConfig = {
  client_id: "safe-client-id.apps.googleusercontent.com",
  configured: true,
  oauth_client_mode: "pkce_public_client",
  client_secret_configured: false,
};

const ACCOUNTS: SafeDashboardAccount[] = [
  {
    account_id: "youtube-main",
    platform: "youtube",
    account_label: "main",
    display_name: "Main YouTube",
    enabled: true,
    auth_mode: "oauth",
    status: "green",
    capabilities: { upload: true, status_check: true, refresh_supported: true, analytics: false, manual_fallback: true },
    default_privacy: "private",
    allowed_privacy: ["private"],
    manual_fallback: true,
    notification_state: "dashboard",
    last_checked_at: null,
    next_action: "Ready.",
    warnings: [],
  },
];

function safeAccountUiHtml(): string {
  const model = createVideoOrchestratorDashboardAccountUiModel([
    { project_id: "says-the-bible", display_name: "Says the Bible", accounts: [{ account_id: "youtube-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected" }] },
  ]);
  return renderVideoOrchestratorDashboardAccountUi(model);
}

test("VO-7DP-DASHBOARD-RENDER-INSERTION-1: embeds safe account UI HTML in accounts panel", () => {
  const html = renderAccountsAndCredentialsPanel(ACCOUNTS, OAUTH_CONFIG, safeAccountUiHtml());

  assert.equal(html.includes("Video Orchestrator Accounts"), true);
  assert.equal(html.includes("Project → platform → account overview"), true);
  assert.equal(html.includes("YouTube Setup"), true);
  assert.equal(html.includes("Connected Channels"), true);
  assert.equal(html.includes("Main YouTube"), true);
});

test("VO-7DP-DASHBOARD-RENDER-INSERTION-2: blocks unsafe account UI HTML", () => {
  const unsafeHtml = `${safeAccountUiHtml()} <span>[CREDENTIAL_REFERENCE]</span>`;
  const html = renderAccountsAndCredentialsPanel(ACCOUNTS, OAUTH_CONFIG, unsafeHtml);

  assert.equal(html.includes("[CREDENTIAL_REFERENCE]"), false);
  assert.equal(html.includes("Project → platform → account overview"), false);
  assert.equal(html.includes("YouTube Setup"), true);
  assert.equal(html.includes("Connected Channels"), true);
});

test("VO-7DP-DASHBOARD-RENDER-INSERTION-3: default call remains backward compatible", () => {
  const html = renderAccountsAndCredentialsPanel(ACCOUNTS, OAUTH_CONFIG);

  assert.equal(html.includes("Video Orchestrator Accounts"), false);
  assert.equal(html.includes("YouTube Setup"), true);
  assert.equal(html.includes("Connected Channels"), true);
  assert.equal(html.includes("safe-client-id.apps.googleusercontent.com"), true);
});

test("VO-7DQ-DASHBOARD-RENDER-INSERTION-REVIEW-1: blocks keychain and token-shaped rendered input", () => {
  const unsafeHtml = `${safeAccountUiHtml()} <span>keychain://video-orchestrator/example/account access_token=[VALUE]</span>`;
  const html = renderAccountsAndCredentialsPanel(ACCOUNTS, OAUTH_CONFIG, unsafeHtml);

  assert.equal(html.includes("keychain://video-orchestrator"), false);
  assert.equal(html.includes("access_token=[VALUE]"), false);
  assert.equal(html.includes("Project → platform → account overview"), false);
  assert.equal(html.includes("YouTube Setup"), true);
});
