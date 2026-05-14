import { test } from "node:test";
import assert from "node:assert";
import {
  createVideoOrchestratorDashboardAccountUiModel,
  normalizeVideoOrchestratorDashboardAccount,
  renderVideoOrchestratorDashboardAccountUi,
} from "./video-orchestrator-dashboard-account-ui.js";

test("VO-7DH-DASHBOARD-ACCOUNT-UI-1: normalizes multi-project multi-platform account model safely", () => {
  const model = createVideoOrchestratorDashboardAccountUiModel([
    {
      project_id: "says-the-bible",
      project_label: "says-the-bible",
      display_name: "Says the Bible",
      default_visibility: "scheduled",
      accounts: [
        { account_id: "yt-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected", oauth_available: true, deep_link_url: "https://console.cloud.google.com/apis/credentials", credential_reference: "[CREDENTIAL_REFERENCE]", token: "[TOKEN]" },
        { account_id: "pin-main", platform: "pinterest", account_label: "main", display_name: "Main Pinterest", enabled: true, credential_mode: "api_key", credential_status: "needs_setup", manual_setup_summary: "Create an app and paste a reference in backend storage." },
      ],
    },
    {
      project_id: "second-project",
      project_label: "second-project",
      display_name: "Second Project",
      default_visibility: "private",
      accounts: [
        { account_id: "yt-second", platform: "youtube", account_label: "second", display_name: "Second YouTube", enabled: false, credential_mode: "oauth", credential_status: "connected" },
      ],
    },
  ]);

  assert.equal(model.schema_version, "1.0");
  assert.equal(model.summary.project_count, 2);
  assert.equal(model.summary.account_count, 3);
  assert.equal(model.summary.platform_count, 2);
  assert.equal(model.summary.connected_count, 1);
  assert.equal(model.summary.needs_setup_count, 1);
  assert.equal(model.summary.disabled_count, 1);
  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.secrets_rendered, false);
  assert.equal(model.safety.oauth_exchange_executed, false);
  assert.equal(model.safety.env_written, false);
  assert.equal(model.safety.files_written, false);
  assert.equal(model.safety.uploads_executed, false);
  assert.equal(model.projects[0]?.accounts[0]?.secrets_redacted, true);
  assert.equal(model.projects[0]?.accounts[0]?.next_action.includes("Remove secret-like values"), true);
  assert.equal(model.projects[1]?.accounts[0]?.credential_status, "disabled");
  assert.equal(model.projects[1]?.accounts[0]?.default_visibility, "private");
});

test("VO-7DH-DASHBOARD-ACCOUNT-UI-2: render output omits secret placeholders and includes safe setup links", () => {
  const model = createVideoOrchestratorDashboardAccountUiModel([
    {
      project_id: "says-the-bible",
      display_name: "Says the Bible",
      accounts: [
        { account_id: "yt-main", platform: "youtube", account_label: "main", display_name: "Main YouTube", enabled: true, credential_mode: "oauth", credential_status: "connected", deep_link_url: "https://console.cloud.google.com/apis/credentials", credential_reference: "[CREDENTIAL_REFERENCE]", client_secret: "[CLIENT_SECRET]" },
      ],
    },
  ]);
  const html = renderVideoOrchestratorDashboardAccountUi(model);

  assert.equal(html.includes("Video Orchestrator Accounts"), true);
  assert.equal(html.includes("Says the Bible"), true);
  assert.equal(html.includes("Main YouTube"), true);
  assert.equal(html.includes("Open platform setup"), true);
  assert.equal(html.includes("[CREDENTIAL_REFERENCE]"), false);
  assert.equal(html.includes("[CLIENT_SECRET]"), false);
  assert.equal(html.includes("[TOKEN]"), false);
  assert.equal(html.includes("OAuth exchange"), true);
});

test("VO-7DH-DASHBOARD-ACCOUNT-UI-3: invalid links and unknown platforms are safely constrained", () => {
  const account = normalizeVideoOrchestratorDashboardAccount(
    { account_id: "../bad account", platform: "unknown-platform", account_label: "bad label", display_name: "Unsafe <Name>", deep_link_url: "javascript:alert(1)", credential_mode: "oauth", credential_status: "unknown" },
    { project_id: "proj", project_label: "proj", default_visibility: "scheduled" },
  );

  assert.equal(account.platform, "unknown");
  assert.equal(account.account_id.includes(".."), false);
  assert.equal(account.account_id.includes(" "), false);
  assert.equal(account.account_label.includes(" "), false);
  assert.equal(account.deep_link_url, null);
  assert.equal(account.default_visibility, "scheduled");
  assert.equal(account.allowed_visibility.includes("scheduled"), true);
  assert.equal(account.secrets_redacted, true);
});

test("VO-7DI-DASHBOARD-ACCOUNT-UI-REVIEW-1: model remains read-only with no git or runtime side effects", () => {
  const model = createVideoOrchestratorDashboardAccountUiModel([{ project_id: "empty", display_name: "Empty", accounts: [] }]);
  const html = renderVideoOrchestratorDashboardAccountUi(model);

  assert.equal(model.safety.read_only, true);
  assert.equal(model.safety.env_written, false);
  assert.equal(model.safety.files_written, false);
  assert.equal(model.safety.uploads_executed, false);
  assert.equal(html.includes("No accounts configured"), true);
  assert.equal(html.includes("git add"), false);
  assert.equal(html.includes("git commit"), false);
  assert.equal(html.includes("git push"), false);
});
