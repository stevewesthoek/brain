import { test } from "node:test";
import assert from "node:assert";
import {
  createVideoOrchestratorPlatformAdapterRegistry,
  normalizeVideoOrchestratorPlatformAdapter,
} from "./video-orchestrator-platform-adapter-registry.js";

test("VO-7EJ-PLATFORM-ADAPTER-REGISTRY-1: normalizes multi-platform adapter contracts safely", () => {
  const registry = createVideoOrchestratorPlatformAdapterRegistry([
    { platform: "youtube", adapter_id: "youtube-api", display_name: "YouTube API", mode: "api", status: "supported", supports_scheduled_publish: true, default_visibility: "private", allowed_visibility: ["private"], supports_multi_account: true, supports_resume: true, supports_delete: true, supports_metadata_update: true, upload_enabled: true, network_enabled: true, credential_access_enabled: true, media_read_enabled: true, api_base_url: "https://www.googleapis.com/", setup_url: "https://console.cloud.google.com/apis/credentials" },
    { platform: "tiktok", adapter_id: "tiktok-api", display_name: "TikTok API", mode: "api", status: "partial", supports_scheduled_publish: false, supports_multi_account: true, supports_resume: false, setup_url: "https://developers.tiktok.com/" },
    { platform: "pinterest", adapter_id: "pinterest-api", display_name: "Pinterest API", mode: "api", status: "partial", supports_scheduled_publish: true, supports_multi_account: true, supports_resume: true, setup_url: "https://developers.pinterest.com/apps/" },
    { platform: "manual", adapter_id: "manual-export", display_name: "Manual Export", mode: "manual", supports_scheduled_publish: false, supports_multi_account: true, supports_resume: true },
  ]);

  assert.equal(registry.schema_version, "1.0");
  assert.equal(registry.summary.adapter_count, 4);
  assert.equal(registry.summary.platform_count, 4);
  assert.equal(registry.summary.supported_count, 1);
  assert.equal(registry.summary.partial_count, 2);
  assert.equal(registry.summary.manual_only_count, 1);
  assert.equal(registry.summary.scheduled_publish_count, 2);
  assert.equal(registry.summary.resume_capable_count, 3);
  assert.equal(registry.safety.contract_only, true);
  assert.equal(registry.safety.upload_executed, false);
  assert.equal(registry.safety.network_calls_made, false);
  assert.equal(registry.safety.credential_accessed, false);
  assert.equal(registry.safety.media_read_performed, false);
  assert.equal(registry.safety.runtime_wiring_applied, false);
  assert.equal(registry.safety.files_written, false);
  assert.equal(registry.adapters.every((adapter) => !adapter.upload_enabled && !adapter.network_enabled && !adapter.credential_access_enabled && !adapter.media_read_enabled), true);
  assert.equal(registry.adapters[0]?.next_action, "Ready for future runtime adapter implementation review.");
  assert.equal(registry.adapters[1]?.next_action.includes("Complete policy"), true);
});

test("VO-7EJ-PLATFORM-ADAPTER-REGISTRY-2: unsafe platform/link/slug input is constrained", () => {
  const adapter = normalizeVideoOrchestratorPlatformAdapter({
    platform: "unknown-platform",
    adapter_id: "../bad adapter",
    display_name: "Unsafe <Adapter>",
    mode: "api",
    status: "supported",
    api_base_url: "javascript:alert(1)",
    setup_url: "http://not-secure.example/setup",
    default_visibility: "public",
    allowed_visibility: ["public", "draft"],
  });

  assert.equal(adapter.platform, "unknown");
  assert.equal(adapter.adapter_id.includes(".."), false);
  assert.equal(adapter.api_base_url, null);
  assert.equal(adapter.setup_url, null);
  assert.equal(adapter.default_visibility, "scheduled");
  assert.deepEqual(adapter.allowed_visibility, ["scheduled", "draft"]);
  assert.equal(adapter.upload_enabled, false);
  assert.equal(adapter.network_enabled, false);
  assert.equal(adapter.credential_access_enabled, false);
  assert.equal(adapter.media_read_enabled, false);
});

test("VO-7EK-PLATFORM-ADAPTER-REGISTRY-REVIEW-1: disabled adapter remains blocked from runtime capabilities", () => {
  const adapter = normalizeVideoOrchestratorPlatformAdapter({ platform: "youtube", mode: "disabled", status: "supported", upload_enabled: true, network_enabled: true, credential_access_enabled: true, media_read_enabled: true });

  assert.equal(adapter.mode, "disabled");
  assert.equal(adapter.status, "supported");
  assert.equal(adapter.upload_enabled, false);
  assert.equal(adapter.network_enabled, false);
  assert.equal(adapter.credential_access_enabled, false);
  assert.equal(adapter.media_read_enabled, false);
  assert.equal(adapter.next_action.includes("Add scheduling/resume policy") || adapter.next_action.includes("Ready for future"), true);
});
