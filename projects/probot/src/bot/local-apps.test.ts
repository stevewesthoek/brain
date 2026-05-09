import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildLocalAppRuntimeEnv, buildLocalAppsStatus, classifyLocalAppStartCommand, normalizeLocalApp, resolveLocalAppLifecycleCommand, resolveLocalAppRestartCommand, waitForLocalAppHealth } from "./local-apps.js";
import { clearPortOccupancyCache } from "./local-app-ports.js";
import {
  runExclusiveLocalAppOperation,
  waitForLocalAppPortFree,
  forceStopLocalAppPort,
} from "./local-app-lifecycle.js";
import { normalizeAccountHealthSnapshot, normalizeYouTubeLifecycleSummary, redactVideoOrchestratorText, renderAccountHealthPanel, renderYouTubeLifecycleSummary } from "./dashboard.js";

test("normalize legacy-only entry", () => {
  const app = normalizeLocalApp({
    name: "Legacy App",
    port: 3001,
    url: "http://localhost:3001",
    check: "http://localhost:3001/health",
    start: "npm run dev",
    stop: "npm stop",
    description: "legacy",
  });

  assert.ok(app);
  assert.equal(app.name, "Legacy App");
  assert.equal(app.port, 3001);
  assert.equal(app.url, "http://localhost:3001");
  assert.equal(app.check, "http://localhost:3001/health");
  assert.equal(app.start, "npm run dev");
  assert.equal(app.stop, "npm stop");
});

test("normalize expanded-only entry", () => {
  const app = normalizeLocalApp({
    name: "Expanded App",
    appPort: 3054,
    appUrl: "http://localhost:3054",
    healthCheck: "http://localhost:3054/api/openapi",
    startCommand: "bash start.sh",
    stopCommand: "bash stop.sh",
    restartCommand: "bash restart.sh",
    repoPath: "/tmp/app",
    databaseEngine: "PostgreSQL",
    databaseServiceName: "postgres",
    databasePort: 5434,
    databaseName: "app",
    databaseUser: "app",
    notes: "note",
  });

  assert.ok(app);
  assert.equal(app.port, 3054);
  assert.equal(app.url, "http://localhost:3054");
  assert.equal(app.check, "http://localhost:3054/api/openapi");
  assert.equal(app.start, "bash start.sh");
  assert.equal(app.stop, "bash stop.sh");
  assert.equal(app.restart, "bash restart.sh");
  assert.equal(app.repoPath, "/tmp/app");
  assert.equal(app.databaseEngine, "PostgreSQL");
  assert.equal(app.databaseServiceName, "postgres");
  assert.equal(app.databasePort, 5434);
  assert.equal(app.databaseName, "app");
  assert.equal(app.databaseUser, "app");
  assert.equal(app.notes, "note");
});

test("normalize dual-compatible BuildFlow entry with orchestrator", () => {
  const app = normalizeLocalApp({
    name: "BuildFlow",
    port: 3054,
    appPort: 3054,
    url: "http://localhost:3054",
    appUrl: "http://localhost:3054",
    check: "http://localhost:3054/api/unified-health",
    healthCheck: "http://localhost:3054/api/unified-health",
    start: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh start",
    startCommand: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh start",
    stop: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh stop",
    stopCommand: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh stop",
    restart: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh restart",
    restartCommand: "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh restart",
    description: "BuildFlow",
  });

  assert.ok(app);
  assert.equal(app.port, 3054);
  assert.equal(app.url, "http://localhost:3054");
  assert.equal(app.check, "http://localhost:3054/api/unified-health");
  assert.equal(app.start, "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh start");
  assert.equal(app.stop, "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh stop");
  assert.equal(app.restart, "bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh restart");
});

test("clearPortOccupancyCache is safe for nullable ports", () => {
  assert.doesNotThrow(() => clearPortOccupancyCache(null));
  assert.doesNotThrow(() => clearPortOccupancyCache(3058));
});

test("normalize per-app runtime config", () => {
  const app = normalizeLocalApp({
    name: "Runtime App",
    appPort: 3058,
    appUrl: "http://localhost:3058",
    healthCheck: "http://localhost:3058/api/health",
    startCommand: "npm run dev",
    runtime: {
      pathPrepend: ["/opt/custom-node/bin"],
      env: { NODE_ENV: "development" },
      notes: "App requires a custom runtime.",
    },
  });

  assert.ok(app);
  assert.deepEqual(app.runtime?.pathPrepend, ["/opt/custom-node/bin"]);
  assert.deepEqual(app.runtime?.env, { NODE_ENV: "development" });
  assert.equal(app.runtime?.notes, "App requires a custom runtime.");
});

test("buildLocalAppRuntimeEnv applies app runtime without changing unrelated apps", () => {
  const customApp = normalizeLocalApp({
    name: "Custom Runtime",
    appPort: 3058,
    appUrl: "http://localhost:3058",
    healthCheck: "http://localhost:3058/api/health",
    startCommand: "bash scripts/dev/start-local.sh",
    runtime: {
      pathPrepend: ["/Users/Office/.nvm/versions/node/v20.20.2/bin"],
      env: { CUSTOM_RUNTIME: "1" },
    },
  });
  const defaultApp = normalizeLocalApp({
    name: "Default Runtime",
    appPort: 3059,
    appUrl: "http://localhost:3059",
    healthCheck: "http://localhost:3059/api/health",
    startCommand: "npm run dev",
  });

  assert.ok(customApp);
  assert.ok(defaultApp);

  const baseEnv = { PATH: "/usr/bin:/bin" } as NodeJS.ProcessEnv;
  const customEnv = buildLocalAppRuntimeEnv(customApp, customApp.start, baseEnv);
  const defaultEnv = buildLocalAppRuntimeEnv(defaultApp, defaultApp.start, baseEnv);

  assert.equal(customEnv.PATH, "/Users/Office/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin");
  assert.equal(customEnv.PORT, "3058");
  assert.equal(customEnv.CUSTOM_RUNTIME, "1");
  assert.equal(defaultEnv.PATH, "/usr/bin:/bin");
  assert.equal(defaultEnv.PORT, "3059");
  assert.equal(defaultEnv.CUSTOM_RUNTIME, undefined);
});

test("normalize entry with missing optional stop", () => {
  const app = normalizeLocalApp({
    name: "No Stop",
    appPort: 3008,
    appUrl: "http://localhost:3008",
    healthCheck: "http://localhost:3008/health",
    startCommand: "npm run dev",
    stopCommand: null,
  });

  assert.ok(app);
  assert.equal(app.stop, null);
});

test("normalize entry with missing health check", () => {
  const app = normalizeLocalApp({
    name: "No Check",
    appPort: 3010,
    appUrl: "http://localhost:3010",
    startCommand: "npm run dev",
  });

  assert.ok(app);
  assert.equal(app.check, "");
});

test("buildLocalAppsStatus fails safely on missing health check", async () => {
  const fetchCalls: string[] = [];
  const result = await buildLocalAppsStatus(
    [
      {
        name: "Broken",
        port: 3009,
        url: "http://localhost:3009",
        check: "",
        start: "npm run dev",
        stop: null,
        restart: null,
        description: "",
        repoPath: null,
        startupTimeoutMs: null,
        runtime: null,
        databaseEngine: null,
        databaseServiceName: null,
        databasePort: null,
        databaseName: null,
        databaseUser: null,
        notes: null,
      },
    ],
    async (url) => {
      fetchCalls.push(typeof url === "string" ? url : url.toString());
      return { ok: true } as any;
    },
  );

  assert.equal(fetchCalls.length, 0);
  assert.equal(result.apps[0]?.status, "stopped");
  assert.equal(result.apps[0]?.restartable, true);
});

test("buildLocalAppsStatus keeps an app starting during its startup window", async () => {
  const result = await buildLocalAppsStatus(
    [
      {
        name: "Booting",
        port: 3009,
        url: "http://localhost:3009",
        check: "http://localhost:3009/health",
        start: "npm run dev",
        stop: null,
        restart: null,
        description: "",
        repoPath: null,
        startupTimeoutMs: 120000,
        runtime: null,
        databaseEngine: null,
        databaseServiceName: null,
        databasePort: null,
        databaseName: null,
        databaseUser: null,
        notes: null,
      },
    ],
    async () => {
      throw new Error("not ready");
    },
    {
      startingApps: {
        Booting: {
          startedAt: Date.now(),
          startupTimeoutMs: 120000,
        },
      },
    },
  );

  assert.equal(result.apps[0]?.status, "starting");
  assert.equal(result.apps[0]?.restartable, true);
});

test("waitForLocalAppHealth resolves when health turns ok", async () => {
  let calls = 0;
  const app = normalizeLocalApp({
    name: "Booting",
    appPort: 3000,
    appUrl: "http://localhost:3000",
    healthCheck: "http://localhost:3000/health",
    startCommand: "npm run dev",
  });
  assert.ok(app);

  const healthy = await waitForLocalAppHealth(app, async () => {
    calls += 1;
    return { ok: calls >= 3 } as any;
  }, 5_000);

  assert.equal(healthy, true);
  assert.equal(calls, 3);
});

test("normalize invalid entry without name", () => {
  const app = normalizeLocalApp({
    appPort: 3000,
    appUrl: "http://localhost:3000",
  });

  assert.equal(app, null);
});

test("classify current start command shapes", () => {
  assert.equal(classifyLocalAppStartCommand("cd ~/Repos/prochattools/web/prochat && npm run dev"), "foreground");
  assert.equal(classifyLocalAppStartCommand("cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d"), "background");
  assert.equal(classifyLocalAppStartCommand("bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh start"), "foreground");
  assert.equal(classifyLocalAppStartCommand("cd ~/Repos/prochattools/saas/xgrow && npm run dev > /tmp/xgrow.log 2>&1 &"), "background");
});

test("resolve lifecycle commands from repo-local helper scripts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "probot-local-app-"));
  fs.mkdirSync(path.join(tmp, "scripts", "dev"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "scripts", "dev", "start-local.sh"), "#!/bin/bash\n");
  fs.writeFileSync(path.join(tmp, "scripts", "dev", "stop-local.sh"), "#!/bin/bash\n");

  const app = normalizeLocalApp({
    name: "Repo Local",
    repoPath: tmp,
    appPort: 3058,
    appUrl: "http://localhost:3058",
    healthCheck: "http://localhost:3058/health",
  });

  assert.ok(app);
  assert.equal(resolveLocalAppLifecycleCommand(app, "start"), "bash scripts/dev/start-local.sh");
  assert.equal(resolveLocalAppLifecycleCommand(app, "stop"), "bash scripts/dev/stop-local.sh");
});

test("resolve explicit restart command when present", () => {
  const app = normalizeLocalApp({
    name: "Restartable",
    appPort: 3001,
    appUrl: "http://localhost:3001",
    healthCheck: "http://localhost:3001/health",
    startCommand: "npm run dev",
    restartCommand: "bash restart-all.sh",
  });

  assert.ok(app);
  assert.equal(resolveLocalAppRestartCommand(app), "bash restart-all.sh");
});

test("runExclusiveLocalAppOperation allows one operation and releases lock", async () => {
  let callCount = 0;
  const result = await runExclusiveLocalAppOperation("TestApp", async () => {
    callCount += 1;
    return "success";
  });

  assert.equal(result, "success");
  assert.equal(callCount, 1);

  // Lock should be released, so we can run it again
  const result2 = await runExclusiveLocalAppOperation("TestApp", async () => {
    callCount += 1;
    return "success2";
  });

  assert.equal(result2, "success2");
  assert.equal(callCount, 2);
});

test("runExclusiveLocalAppOperation rejects overlapping operation for same app", async () => {
  let error: Error | null = null;

  // Start an operation that will take time
  const promise1 = runExclusiveLocalAppOperation("ConflictApp", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return "done";
  });

  // Immediately try to start another operation on the same app
  try {
    await runExclusiveLocalAppOperation("ConflictApp", async () => {
      return "should not run";
    });
  } catch (err) {
    error = err as Error;
  }

  // Wait for the first one to finish
  const result = await promise1;

  assert.ok(error);
  assert.ok(error.message.includes("Local app operation already running for ConflictApp"));
  assert.equal(result, "done");
});

test("waitForLocalAppPortFree returns true for app without port", async () => {
  const app = normalizeLocalApp({
    name: "NoPort",
    appUrl: "http://localhost:3000",
    healthCheck: "http://localhost:3000/health",
  });

  // App has no port defined
  assert.equal(app?.port, null);

  const free = await waitForLocalAppPortFree(app, 1000);
  assert.equal(free, true);
});

test("forceStopLocalAppPort returns ok for app without port", async () => {
  const app = normalizeLocalApp({
    name: "NoPort",
    appUrl: "http://localhost:3000",
    healthCheck: "http://localhost:3000/health",
  });

  assert.equal(app?.port, null);

  const result = await forceStopLocalAppPort(app);
  assert.equal(result.ok, true);
  assert.deepEqual(result.pids, []);
  assert.deepEqual(result.killed, []);
  assert.equal(result.error, undefined);
});

test("buildLocalAppsStatus shows stopped for failed health check with no port listeners", async () => {
  const app = normalizeLocalApp({
    name: "NoListenersApp",
    appPort: 9999,
    appUrl: "http://localhost:9999",
    healthCheck: "http://localhost:9999/health",
    startCommand: "npm run dev",
  });
  assert.ok(app);

  const result = await buildLocalAppsStatus(
    [app],
    async () => {
      throw new Error("Health check failed");
    },
    {
      portOccupiedChecker: async () => false,
    },
  );

  assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0]?.status, "stopped");
});

test("buildLocalAppsStatus shows blocked for failed health check with occupied port", async () => {
  const app = normalizeLocalApp({
    name: "BlockedApp",
    appPort: 3000,
    appUrl: "http://localhost:3000",
    healthCheck: "http://localhost:3000/health",
    startCommand: "npm run dev",
  });
  assert.ok(app);

  const result = await buildLocalAppsStatus(
    [app],
    async () => {
      throw new Error("Health check failed");
    },
    {
      portOccupiedChecker: async () => true,
    },
  );

  assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0]?.status, "blocked");
});

test("buildLocalAppsStatus shows starting for failed health check within startup window", async () => {
  const app = normalizeLocalApp({
    name: "StartingApp",
    appPort: 9998,
    appUrl: "http://localhost:9998",
    healthCheck: "http://localhost:9998/health",
    startCommand: "npm run dev",
    startupTimeoutMs: 60000,
  });
  assert.ok(app);

  const now = Date.now();
  const startingApps = new Map([
    [
      "StartingApp",
      {
        startedAt: now - 5000, // started 5 seconds ago
        startupTimeoutMs: 60000, // 60 second timeout
      },
    ],
  ]);

  const result = await buildLocalAppsStatus(
    [app],
    async () => {
      throw new Error("Health check failed");
    },
    { startingApps, now, portOccupiedChecker: async () => true },
  );

  assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0]?.status, "starting");
});

test("buildLocalAppsStatus shows blocked for failed health check with occupied port within startup window", async () => {
  const app = normalizeLocalApp({
    name: "BlockedInStartupApp",
    appPort: 9997,
    appUrl: "http://localhost:9997",
    healthCheck: "http://localhost:9997/health",
    startCommand: "npm run dev",
    startupTimeoutMs: 60000,
  });
  assert.ok(app);

  const now = Date.now();
  const startingApps = new Map([
    [
      "BlockedInStartupApp",
      {
        startedAt: now - 70000, // started 70 seconds ago (past 60s timeout)
        startupTimeoutMs: 60000,
      },
    ],
  ]);

  const result = await buildLocalAppsStatus(
    [app],
    async () => {
      throw new Error("Health check failed");
    },
    { startingApps, now, portOccupiedChecker: async () => true },
  );

  assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0]?.status, "blocked");
});

test("buildLocalAppsStatus shows running for successful health check", async () => {
  const app = normalizeLocalApp({
    name: "HealthyApp",
    appPort: 3001,
    appUrl: "http://localhost:3001",
    healthCheck: "http://localhost:3001/health",
    startCommand: "npm run dev",
  });
  assert.ok(app);

  const result = await buildLocalAppsStatus([app], async () => {
    return { ok: true } as any;
  });

  assert.equal(result.apps.length, 1);
  assert.equal(result.apps[0]?.status, "running");
});

test("redactVideoOrchestratorText redacts token-like and credential-like content", () => {
  const redacted = redactVideoOrchestratorText(
    [
      "access_token=abc123",
      "refresh_token:def456",
      "client_secret=ghi789",
      "authorization_code=xyz",
      "Bearer ya29.fake-token",
      "credentialReference=keychain://video-orchestrator/youtube/example-account",
      "credential_ref:keychain://video-orchestrator/youtube/example-account",
      "keychain://video-orchestrator/youtube/example-account",
      "ghp_abcdefghijklmnopqrstuvwxyz123456",
      "sk-test1234567890",
      "AKIA1234567890ABCD",
      "AIzaFakeApiKey0123456789",
    ].join(" | "),
  );

  assert.ok(redacted);
  assert.match(redacted, /access_token=\[REDACTED\]/i);
  assert.match(redacted, /refresh_token=\[REDACTED\]/i);
  assert.match(redacted, /client_secret=\[REDACTED\]/i);
  assert.match(redacted, /authorization_code=\[REDACTED\]/i);
  assert.match(redacted, /Bearer \[REDACTED\]/i);
  assert.match(redacted, /credential_reference=\[REDACTED\]/i);
  assert.match(redacted, /sk-\[REDACTED\]/i);
  assert.doesNotMatch(redacted, /keychain:\/\/video-orchestrator\/youtube\/example-account/i);
  assert.doesNotMatch(redacted, /ghp_[A-Za-z0-9_-]+/i);
  assert.doesNotMatch(redacted, /sk-test1234567890/i);
  assert.doesNotMatch(redacted, /AKIA1234567890ABCD/i);
  assert.doesNotMatch(redacted, /AIzaFakeApiKey0123456789/i);
});

test("normalizeYouTubeLifecycleSummary strips raw credential fields and preserves safe lifecycle data", () => {
  const summary = normalizeYouTubeLifecycleSummary({
    latest: {
      video_id: "video-123",
      platform: "youtube",
      package_target: "long-form",
      youtube_video_id: "YOUTUBE_VIDEO_ID_PLACEHOLDER",
      lifecycle_state: "available_private",
      privacy_status: "private",
      upload_event_at: "2026-05-08T12:00:00Z",
      last_checked_at: "2026-05-08T12:30:00Z",
      status_check_pending: false,
      manual_fallback_available: true,
      last_warning: "credentialReference=keychain://video-orchestrator/youtube/example-account",
      last_error: "access_token=abc123",
      credential_reference: "keychain://video-orchestrator/youtube/example-account",
      access_token: "abc123",
      refresh_token: "def456",
    },
    counts: {
      uploaded: 1,
      processing: 0,
      available_private: 2,
      failed: 0,
      unknown: 0,
    },
  });

  assert.equal(summary.latest?.lifecycle_state, "available_private");
  assert.equal(summary.latest?.youtube_video_id, "YOUTUBE_VIDEO_ID_PLACEHOLDER");
  assert.equal(summary.latest?.privacy_status, "private");
  assert.equal(summary.latest?.manual_fallback_available, true);
  assert.equal(summary.counts.available_private, 2);
  assert.equal(summary.counts.uploaded, 1);
  assert.match(String(summary.latest?.last_warning ?? ""), /credential_reference=\[REDACTED\]/i);
  assert.match(String(summary.latest?.last_error ?? ""), /access_token=\[REDACTED\]/i);
  assert.equal((summary.latest as Record<string, unknown>).credential_reference, undefined);
  assert.equal((summary.latest as Record<string, unknown>).access_token, undefined);
  assert.equal((summary.latest as Record<string, unknown>).refresh_token, undefined);
});

test("renderYouTubeLifecycleSummary renders a safe placeholder and no controls for empty state", () => {
  const html = renderYouTubeLifecycleSummary(null);
  assert.match(html, /No YouTube lifecycle events yet\./);
  assert.match(html, /Read-only status\./);
  assert.doesNotMatch(html, /upload button/i);
  assert.doesNotMatch(html, /oauth button/i);
  assert.doesNotMatch(html, /keychain/i);
  assert.doesNotMatch(html, /<button/i);
});

test("renderYouTubeLifecycleSummary shows counts and safe lifecycle metadata", () => {
  const html = renderYouTubeLifecycleSummary({
    latest: {
      video_id: "video-123",
      platform: "youtube",
      package_target: "long-form",
      youtube_video_id: "YOUTUBE_VIDEO_ID_PLACEHOLDER",
      lifecycle_state: "available_private",
      privacy_status: "private",
      upload_event_at: "2026-05-08T12:00:00Z",
      last_checked_at: "2026-05-08T12:30:00Z",
      status_check_pending: true,
      manual_fallback_available: true,
      last_warning: "warning=[REDACTED]",
      last_error: "error=[REDACTED]",
    },
    counts: {
      uploaded: 1,
      processing: 2,
      available_private: 3,
      failed: 4,
      unknown: 5,
    },
  });

  assert.match(html, /YouTube Upload Lifecycle/);
  assert.match(html, /YOUTUBE_VIDEO_ID_PLACEHOLDER/);
  assert.match(html, /available_private/);
  assert.match(html, /uploaded<\/span> <strong>1<\/strong>/);
  assert.match(html, /processing<\/span> <strong>2<\/strong>/);
  assert.match(html, /available_private<\/span> <strong>3<\/strong>/);
  assert.match(html, /failed<\/span> <strong>4<\/strong>/);
  assert.match(html, /unknown<\/span> <strong>5<\/strong>/);
  assert.doesNotMatch(html, /upload button/i);
  assert.doesNotMatch(html, /oauth button/i);
  assert.doesNotMatch(html, /refresh token/i);
});

test("normalizeAccountHealthSnapshot strips credential references and preserves safe fields", () => {
  const snapshot = normalizeAccountHealthSnapshot({
    checked_at: "2026-05-08T12:00:00Z",
    summary: { green: 1, yellow: 2, red: 0, grey: 1 },
    accounts: [
      {
        account_id: "youtube-main-placeholder",
        platform: "youtube",
        account_label: "main-channel",
        display_name: "Main YouTube Channel Placeholder",
        enabled: true,
        auth_mode: "oauth",
        credential_reference: "keychain://video-orchestrator/youtube/main-channel-placeholder",
        capabilities: {
          upload: true,
          status_check: true,
          refresh_token: true,
          analytics: false,
          manual_fallback: true,
        },
        default_privacy: "private",
        allowed_privacy: ["private"],
        manual_fallback: true,
        notification_state: "dashboard",
        last_checked_at: "2026-05-08T12:30:00Z",
        next_action: "Keep warm.",
        warnings: ["credential_reference=keychain://video-orchestrator/youtube/main-channel-placeholder"],
      },
    ],
  });

  assert.equal(snapshot.accounts?.length, 1);
  assert.equal(snapshot.accounts?.[0]?.status, "grey");
  assert.equal(snapshot.accounts?.[0]?.account_label, "main-channel");
  assert.equal(snapshot.accounts?.[0]?.display_name, "Main YouTube Channel Placeholder");
  assert.equal(snapshot.accounts?.[0]?.warnings?.[0], "[REDACTED_REFERENCE]");
  assert.doesNotMatch(JSON.stringify(snapshot), /credential_reference/i);
});

test("renderAccountHealthPanel renders a safe placeholder and no controls for empty state", () => {
  const html = renderAccountHealthPanel(null);
  assert.match(html, /No account registry configured yet\./);
  assert.match(html, /Read-only account health\./);
  assert.doesNotMatch(html, /upload button/i);
  assert.doesNotMatch(html, /oauth button/i);
  assert.doesNotMatch(html, /credential reference/i);
  assert.doesNotMatch(html, /<button/i);
});

test("renderAccountHealthPanel shows safe account metadata and avoids credential exposure", () => {
  const html = renderAccountHealthPanel({
    checked_at: "2026-05-08T12:00:00Z",
    summary: { green: 1, yellow: 1, red: 0, grey: 1 },
    accounts: [
      {
        account_id: "youtube-main-placeholder",
        platform: "youtube",
        account_label: "main-channel",
        display_name: "Main YouTube Channel Placeholder",
        enabled: true,
        auth_mode: "oauth",
        status: "green",
        capabilities: {
          upload: true,
          status_check: true,
          refresh_token: true,
          analytics: false,
          manual_fallback: true,
        },
        default_privacy: "private",
        allowed_privacy: ["private"],
        manual_fallback: true,
        notification_state: "dashboard",
        last_checked_at: "2026-05-08T12:30:00Z",
        next_action: "Ready for manual-confirmed private upload.",
        warnings: [],
      },
    ],
  });

  assert.match(html, /Account Health Center/);
  assert.match(html, /Main YouTube Channel Placeholder/);
  assert.match(html, /green/);
  assert.match(html, /upload/);
  assert.match(html, /manual_fallback/i);
  assert.doesNotMatch(html, /credential_reference/i);
  assert.doesNotMatch(html, /keychain/i);
  assert.doesNotMatch(html, /upload button/i);
  assert.doesNotMatch(html, /oauth button/i);
});
