import { test } from "node:test";
import assert from "node:assert";
import {
  createVideoOrchestratorAccountReferenceRegistryModel,
  normalizeVideoOrchestratorAccountReferenceEntry,
  renderVideoOrchestratorAccountReferenceRegistrySummary,
} from "./video-orchestrator-account-reference-registry.js";

test("VO-7DX-ACCOUNT-REFERENCE-REGISTRY-1: normalizes multi-project account references without sensitive reads or writes", () => {
  const model = createVideoOrchestratorAccountReferenceRegistryModel([
    { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", account_label: "main", reference_label: "youtube-oauth-main", auth_mode: "oauth", auth_status: "connected", reference_target: "keychain", reference_name: "says-the-bible.youtube.main.oauth", oauth_connect_url: "https://accounts.google.com/o/oauth2/v2/auth" },
    { project_id: "says-the-bible", platform: "pinterest", account_id: "pin-main", account_label: "main", reference_label: "pinterest-api-main", auth_mode: "api_key", auth_status: "needs_setup", reference_target: "env_reference", api_key_setup_url: "https://developers.pinterest.com/apps/", api_key: "[API_KEY_PLACEHOLDER]" },
    { project_id: "second-project", platform: "youtube", account_id: "yt-second", account_label: "main", reference_label: "second-youtube", auth_mode: "oauth", enabled: false },
    { project_id: "manual-project", platform: "bluesky", account_id: "bsky-main", account_label: "main", reference_label: "manual-bsky", auth_mode: "manual", manual_setup_summary: "Manual app password flow documented separately." },
  ]);

  assert.equal(model.schema_version, "1.0");
  assert.equal(model.summary.project_count, 3);
  assert.equal(model.summary.account_count, 4);
  assert.equal(model.summary.reference_count, 4);
  assert.equal(model.summary.connected_count, 1);
  assert.equal(model.summary.needs_setup_count, 1);
  assert.equal(model.summary.manual_only_count, 1);
  assert.equal(model.summary.disabled_count, 1);
  assert.equal(model.summary.rejected_sensitive_value_count, 1);
  assert.equal(model.safety.reference_only, true);
  assert.equal(model.safety.sensitive_values_rendered, false);
  assert.equal(model.safety.sensitive_read_performed, false);
  assert.equal(model.safety.sensitive_write_performed, false);
  assert.equal(model.safety.oauth_exchange_executed, false);
  assert.equal(model.safety.env_written, false);
  assert.equal(model.safety.files_written, false);
  assert.equal(model.entries[1]?.sensitive_value_present_in_input, true);
  assert.equal(model.entries[1]?.sensitive_value_accepted, false);
  assert.equal(model.entries[1]?.next_action.includes("Remove sensitive values"), true);
});

test("VO-7DX-ACCOUNT-REFERENCE-REGISTRY-2: unsafe slugs and links are constrained", () => {
  const entry = normalizeVideoOrchestratorAccountReferenceEntry({
    project_id: "../bad project",
    platform: "unknown-platform",
    account_id: "../bad account",
    account_label: "bad label",
    reference_label: "Unsafe <Reference>",
    auth_mode: "oauth",
    auth_status: "connected",
    reference_name: "../bad.reference",
    oauth_connect_url: "javascript:alert(1)",
  });

  assert.equal(entry.project_id.includes(".."), false);
  assert.equal(entry.account_id.includes(".."), false);
  assert.equal(entry.account_label.includes(" "), false);
  assert.equal(entry.reference_name.includes(".."), false);
  assert.equal(entry.platform, "unknown");
  assert.equal(entry.oauth_connect_url, null);
  assert.equal(entry.sensitive_value_accepted, false);
  assert.equal(entry.sensitive_read_performed, false);
  assert.equal(entry.sensitive_write_performed, false);
  assert.equal(entry.oauth_exchange_executed, false);
});

test("VO-7DY-ACCOUNT-REFERENCE-REGISTRY-REVIEW-1: summary is safe and reference-only", () => {
  const model = createVideoOrchestratorAccountReferenceRegistryModel([
    { project_id: "says-the-bible", platform: "youtube", account_id: "yt-main", reference_label: "youtube-oauth-main", auth_mode: "oauth", auth_status: "connected", token: "[TOKEN_PLACEHOLDER]" },
  ]);
  const summary = renderVideoOrchestratorAccountReferenceRegistrySummary(model);

  assert.equal(summary.includes("Account reference registry"), true);
  assert.equal(summary.includes("[TOKEN_PLACEHOLDER]"), false);
  assert.equal(summary.includes("1 input entries contained sensitive values"), true);
  assert.equal(model.entries[0]?.sensitive_value_accepted, false);
  assert.equal(model.entries[0]?.sensitive_read_performed, false);
  assert.equal(model.entries[0]?.sensitive_write_performed, false);
  assert.equal(model.entries[0]?.oauth_exchange_executed, false);
});
