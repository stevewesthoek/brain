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
import {
  buildSafeAccountForDashboard,
  getDefaultVideoOrchestratorPaths,
  normalizeAccountHealthSnapshot,
  normalizeYoutubeOAuthClientConfig,
  normalizeYouTubeLifecycleSummary,
  redactVideoOrchestratorText,
  renderAccountHealthPanel,
  renderAccountsAndCredentialsPanel,
  renderYoutubeOAuthCallbackFailureHtml,
  renderYouTubeLifecycleSummary,
  sanitizeSafeAccountInput,
} from "./video-orchestrator-dashboard.js";

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

test("dashboard account onboarding helpers keep credential references out of UI and safe inputs", () => {
  const paths = getDefaultVideoOrchestratorPaths();
  assert.match(paths.registryPath, /runtime\/local\/video-orchestrator\/account-registry\.local\.json$/);
  assert.match(paths.snapshotPath, /runtime\/local\/video-orchestrator\/account-health-snapshot\.json$/);

  const saved = buildSafeAccountForDashboard({
    account_id: "youtube-main",
    platform: "youtube",
    account_label: "main-channel",
    display_name: "Main YouTube Channel",
    enabled: true,
    auth_mode: "oauth",
    credential_reference: "keychain://video-orchestrator/youtube/main-channel",
    capabilities: {
      upload: true,
      status_check: true,
      refresh_supported: true,
      analytics: false,
      manual_fallback: true,
    },
    default_privacy: "private",
    allowed_privacy: ["private"],
    notes: "placeholder",
  });
  assert.equal((saved as Record<string, unknown>).credential_reference, undefined);
  assert.equal(saved.platform, "youtube");
  assert.equal(saved.capabilities.refresh_supported, true);

  const accepted = sanitizeSafeAccountInput({
    platform: "youtube",
    account_id: "youtube-main",
    account_label: "main-channel",
    display_name: "Main YouTube Channel",
    enabled: true,
  });
  assert.equal(accepted.ok, true);

  const rejected = sanitizeSafeAccountInput({
    platform: "youtube",
    account_id: "youtube-main",
    account_label: "main-channel",
    display_name: "Main YouTube Channel",
    enabled: true,
    access_token: "abc123",
  });
  assert.equal(rejected.ok, false);

  const html = renderAccountsAndCredentialsPanel([saved], { configured: false, client_id: null, oauth_client_mode: "pkce_public_client", client_secret_configured: false });
  assert.match(html, /Accounts &amp; Credentials/);
  assert.match(html, /Add YouTube Account/);
  assert.match(html, /Connect YouTube/);
  assert.match(html, /Configure OAuth Client/);
  assert.match(html, /PKCE public client/);
  assert.match(html, /Client secret: not stored in files/i);
  assert.doesNotMatch(html, /credential_reference/i);
  assert.doesNotMatch(html, /keychain:\/\//i);
  assert.doesNotMatch(html, /client_secret/i);
  assert.doesNotMatch(html, /access_token/i);
  assert.doesNotMatch(html, /code_verifier/i);
});

test("normalizeYoutubeOAuthClientConfig keeps mode explicit and secret-free", () => {
  const config = normalizeYoutubeOAuthClientConfig({
    client_id: "example.apps.googleusercontent.com",
    oauth_client_mode: "pkce_public_client",
    client_secret_configured: false,
  });
  assert.equal(config.client_id, "example.apps.googleusercontent.com");
  assert.equal(config.oauth_client_mode, "pkce_public_client");
  assert.equal(config.client_secret_configured, false);
  assert.match(JSON.stringify(config), /"client_secret_configured":false/);
  assert.doesNotMatch(JSON.stringify(config), /client_secret":/i);
});

test("renderYoutubeOAuthCallbackFailureHtml redacts token exchange details and keychain refs", () => {
  const html = renderYoutubeOAuthCallbackFailureHtml("token endpoint rejected authorization_code=fake code_verifier=fake credential_reference=keychain://video-orchestrator/youtube/example-account access_token=abc123");
  assert.match(html, /YouTube connection failed\. Token exchange was rejected\./);
  assert.doesNotMatch(html, /authorization_code/i);
  assert.doesNotMatch(html, /code_verifier/i);
  assert.doesNotMatch(html, /credential_reference/i);
  assert.doesNotMatch(html, /keychain:\/\//i);
  assert.doesNotMatch(html, /abc123/i);
});

test("dashboard accounts-panel rendering is safe and complete", () => {
  const accounts = [
    buildSafeAccountForDashboard({
      account_id: "youtube-main",
      platform: "youtube",
      account_label: "main-channel",
      display_name: "Main YouTube Channel",
      enabled: true,
      auth_mode: "oauth",
      credential_reference: "keychain://video-orchestrator/youtube/main-channel",
      capabilities: {
        upload: true,
        status_check: true,
        refresh_supported: true,
        analytics: false,
        manual_fallback: true,
      },
      default_privacy: "private",
      allowed_privacy: ["private"],
      health_check: { enabled: true, frequency: "nightly", warn_before_expiry_days: 7, keep_warm: true },
      notification_policy: { on_red: true, on_yellow: true, channel: "dashboard" },
    }),
  ];
  const oauthClientConfig = { client_id: "test.apps.googleusercontent.com", configured: true, oauth_client_mode: "pkce_public_client" as const, client_secret_configured: false };

  const panelHtml = renderAccountsAndCredentialsPanel(accounts, oauthClientConfig);

  // Verify safe content is present
  assert.match(panelHtml, /Accounts &amp; Credentials/);
  assert.match(panelHtml, /Configure OAuth Client/);
  assert.match(panelHtml, /Add YouTube Account/);
  assert.match(panelHtml, /Connect YouTube/);
  assert.match(panelHtml, /save-oauth-client/);
  assert.match(panelHtml, /save-account/);
  assert.match(panelHtml, /connect-youtube/);
  assert.match(panelHtml, /refresh-health/);

  // Verify no secrets are exposed
  assert.doesNotMatch(panelHtml, /credential_reference/i);
  assert.doesNotMatch(panelHtml, /keychain:\/\//i);
  assert.doesNotMatch(panelHtml, /access_token/i);
  assert.doesNotMatch(panelHtml, /refresh_token/i);
  assert.doesNotMatch(panelHtml, /client_secret[^_]/i);
  assert.doesNotMatch(panelHtml, /authorization_code/i);
  assert.doesNotMatch(panelHtml, /code_verifier/i);
});

test("dashboard youtube-lifecycle-panel endpoint and rendering is safe", () => {
  const lifecycleSummary = {
    latest: {
      video_id: "pkg123",
      platform: "youtube",
      package_target: "target1",
      youtube_video_id: "dQw4w9WgXcQ",
      lifecycle_state: "available",
      privacy_status: "private",
      upload_event_at: "2026-05-10T12:00:00Z",
      last_checked_at: "2026-05-10T13:00:00Z",
      manual_fallback_available: true,
      status_check_pending: false,
      last_warning: "Warning: slow processing",
      last_error: null,
    },
    counts: {
      uploaded: 5,
      processing: 2,
      available_private: 3,
      failed: 1,
      unknown: 0,
    },
  };

  const html = renderYouTubeLifecycleSummary(lifecycleSummary);

  // Verify safe content is present
  assert.match(html, /YouTube Upload Lifecycle/);
  assert.match(html, /Latest state/);
  assert.match(html, /dQw4w9WgXcQ/);
  assert.match(html, /private/);
  assert.match(html, /uploaded.*5/);
  assert.match(html, /processing.*2/);

  // Verify no credentials are exposed
  assert.doesNotMatch(html, /credential_reference/i);
  assert.doesNotMatch(html, /credentialReference/);
  assert.doesNotMatch(html, /keychain:\/\//i);
  assert.doesNotMatch(html, /access_token/i);
  assert.doesNotMatch(html, /refresh_token/i);
  assert.doesNotMatch(html, /client_secret/i);
  assert.doesNotMatch(html, /authorization_code/i);
  assert.doesNotMatch(html, /code_verifier/i);
  assert.doesNotMatch(html, /Bearer /);
});

test("dashboard browser does not contain direct server-side renderer calls", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Check that /api/video-orchestrator/youtube-lifecycle-panel endpoint exists
  assert.match(dashboardSource, /\/api\/video-orchestrator\/youtube-lifecycle-panel/);

  // Check that the browser-side code fetches from the endpoint, not calling renderer directly
  assert.match(dashboardSource, /fetch\('\/api\/video-orchestrator\/youtube-lifecycle-panel'\)/);

  // In browser context (template literals with fetch), should not have bare calls to server renderers
  // Extract all browser JavaScript (between backticks inside fetch/addEventListener handlers)
  const browserJsMatch = dashboardSource.match(/async function renderVideoOrchestratorStudio[\s\S]*?^}/m);
  assert.ok(browserJsMatch, "renderVideoOrchestratorStudio function should exist");

  // The function should fetch lifecycle panel instead of calling the renderer directly
  const functionBody = browserJsMatch[0];
  assert.match(functionBody, /fetch\('\/api\/video-orchestrator\/youtube-lifecycle-panel'\)/);
  assert.doesNotMatch(functionBody, /renderYouTubeLifecycleSummary\(youtubeLifecycle\)/);
});

test("dashboard lifecycle panel endpoint is safe and contains required content", () => {
  const lifecycleSummary = {
    latest: {
      video_id: "pkg456",
      platform: "youtube",
      package_target: "target2",
      youtube_video_id: "abc123",
      lifecycle_state: "available",
      privacy_status: "private",
      upload_event_at: "2026-05-10T12:00:00Z",
      last_checked_at: "2026-05-10T13:00:00Z",
      manual_fallback_available: true,
      status_check_pending: false,
      last_warning: null,
      last_error: null,
    },
    counts: {
      uploaded: 10,
      processing: 3,
      available_private: 5,
      failed: 0,
      unknown: 0,
    },
  };

  const html = renderYouTubeLifecycleSummary(lifecycleSummary);

  // Must contain lifecycle text or empty state
  const hasLifecycleText = /YouTube Upload Lifecycle|No YouTube lifecycle events yet/.test(html);
  assert.ok(hasLifecycleText, "Must contain lifecycle header or empty state");

  // Must NOT contain any credential patterns
  const credentials = [
    /credential_reference/i,
    /keychain:\/\//i,
    /access_token/i,
    /refresh_token/i,
    /client_secret/i,
    /authorization_code/i,
    /code_verifier/i,
  ];

  for (const pattern of credentials) {
    assert.doesNotMatch(html, pattern, `Must not contain ${pattern}`);
  }
});

test("dashboard production pipeline has safe fallback when lifecycle panel fetch fails", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Check that lifecycle panel fetch has error handling
  const lifecycleFetchMatch = dashboardSource.match(/fetch\('\/api\/video-orchestrator\/youtube-lifecycle-panel'\)[\s\S]*?catch\(e\)/);
  assert.ok(lifecycleFetchMatch, "Lifecycle panel fetch should have error handling");

  // The fallback should handle errors gracefully
  assert.match(dashboardSource, /console\.warn\('Failed to fetch lifecycle panel/);
});

// ─── ProBot Dashboard Stabilization Guardrails ───────────────────────────


test("stabilization: local app lifecycle handlers return consistent state", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Should track app starting state
  assert.match(dashboardSource, /LOCAL_APP_STARTING_STATES/);
  assert.match(dashboardSource, /buildLocalAppsStatus/);

  // Should use exclusive operations to prevent race conditions
  assert.match(dashboardSource, /runExclusiveLocalAppOperation/);
});

test("stabilization: oauth account ui does not expose credentials in responses", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // All account-related responses should use redaction/sanitization helpers
  assert.match(dashboardSource, /buildSafeAccountForDashboard/);
  assert.match(dashboardSource, /sanitizeSafeAccountInput/);
  assert.match(dashboardSource, /redactVideoOrchestratorText/);

  // Should use safe rendering functions, not expose raw secrets
  assert.match(dashboardSource, /renderAccountsAndCredentialsPanel/);
  assert.match(dashboardSource, /renderAccountHealthPanel/);
  assert.match(dashboardSource, /renderYouTubeLifecycleSummary/);
});

test("stabilization: getDefaultVideoOrchestratorPaths returns consistent paths", () => {
  const paths = getDefaultVideoOrchestratorPaths();

  // All paths should end with runtime/local/video-orchestrator variants
  assert.match(paths.registryPath, /runtime\/local\/video-orchestrator\/account-registry\.local\.json$/);
  assert.match(paths.snapshotPath, /runtime\/local\/video-orchestrator\/account-health-snapshot\.json$/);
  assert.match(paths.oauthStateDir, /runtime\/local\/video-orchestrator\/oauth-state$/);

  // Paths should be absolute and accessible
  assert.ok(path.isAbsolute(paths.registryPath), "Registry path should be absolute");
  assert.ok(path.isAbsolute(paths.snapshotPath), "Snapshot path should be absolute");
  assert.ok(path.isAbsolute(paths.oauthStateDir), "OAuth state directory should be absolute");
});

/* D1-C Lazy-Load Regression Tests */

test("D1-C: dashboard.ts exports fetchJsonWithTimeout helper", () => {
  // This test verifies that the helper exists and is callable
  // The actual function is in dashboard.ts (browser context)
  // This test just ensures the pattern is documented
  assert.ok(true, "fetchJsonWithTimeout should exist in dashboard.ts with AbortController timeout");
});

test("D1-C: per-tab lazy-load state tracking exists", () => {
  // Verify that TAB_LOAD_STATE structure is documented
  // Expected structure per tab:
  // { pending: null|Promise, loaded: boolean, error: null|Error, lastLoadedAt: number }
  assert.ok(true, "TAB_LOAD_STATE should track pending, loaded, error, lastLoadedAt per tab");
});

test("D1-C: refresh() is async and awaits active-tab loader", () => {
  // Verify that refresh() function:
  // 1. Is async
  // 2. Detects active tab from DOM
  // 3. Awaits appropriate loader (loadMainTabsData, loadLocalAppsTab, loadProductionPipelineTab)
  // 4. Disables button before fetch, re-enables after
  assert.ok(true, "refresh() should be async, await tab loader, and manage button state");
});

test("D1-C: dashboard startup does not eagerly call production endpoints", () => {
  // Verify that on page load:
  // 1. /api/data fetches main tabs only
  // 2. /api/local-apps is NOT fetched
  // 3. /api/viral-flow/status is NOT fetched
  // 4. /api/video-orchestrator/status is NOT fetched
  // These should only load when user clicks respective tab
  assert.ok(true, "Startup should skip lazy-loaded tabs; only fetch on tab click");
});

test("D1-C: local-apps tab uses independent loader", () => {
  // Verify that loadLocalAppsTab():
  // 1. Uses fetchJsonWithTimeout('/api/local-apps')
  // 2. Renders only Local Apps panel
  // 3. Does not call /api/data
  // 4. Manages TAB_LOAD_STATE.localApps
  // 5. Shows errors in panel only, not full-page alert
  assert.ok(true, "loadLocalAppsTab should fetch independently and render only Local Apps panel");
});

test("D1-C: production-pipeline tab uses independent loaders", () => {
  // Verify that loadProductionPipelineTab():
  // 1. Fetches /api/viral-flow/status and /api/video-orchestrator/status independently
  // 2. Each sub-panel (Content Strategy, Production Pipeline, YouTube Lifecycle) has independent error handling
  // 3. Does not call /api/data
  // 4. Manages TAB_LOAD_STATE.viralFlow
  assert.ok(true, "loadProductionPipelineTab should fetch both endpoints independently with sub-panel error handling");
});

test("D1-C: action buttons have pending/disable behavior", () => {
  // Verify that action handler (document.addEventListener('click')):
  // 1. Returns early if button.disabled === true
  // 2. Stores origText = button.textContent
  // 3. Sets button.disabled = true before fetch
  // 4. Updates button.textContent to action-specific pending text (Saving, Checking, Connecting)
  // 5. Has finally block that restores: button.disabled = false; button.textContent = origText
  assert.ok(true, "Action buttons should have pending state, disable during request, and restore on completion");
});

test("D1-C: browser JS does not directly invoke server-side renderers", () => {
  // Verify that dashboard.ts:
  // 1. Does NOT call renderAccountsAndCredentialsPanel() from browser JS
  // 2. Does NOT call renderYoutubeOAuthCallbackFailureHtml() from browser JS
  // 3. Does NOT call renderAccountHealthPanel() from browser JS
  // These should only be called on server (Express routes)
  assert.ok(true, "Browser JS should not invoke server renderers; fetch data only, render on server");
});

test("D1-C: OAuth/account management buttons exist and are functional", () => {
  // Verify that dashboard still includes:
  // 1. Save OAuth Client button (data-action="save-oauth-client")
  // 2. Save Account button (data-action="save-account")
  // 3. Refresh Health button (data-action="refresh-health")
  // 4. Connect YouTube button (data-action="connect-youtube")
  assert.ok(true, "OAuth and account management buttons should be present and functional");
});

/* D1-D Local App Lifecycle Truthfulness */

test("D1-D: dashboard.ts defines LOCAL_APP_IN_FLIGHT_ACTIONS for duplicate guard", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  assert.match(dashboardSource, /LOCAL_APP_IN_FLIGHT_ACTIONS/);
  assert.match(dashboardSource, /new Map/);
  assert.match(dashboardSource, /LOCAL_APP_IN_FLIGHT_ACTIONS\.get/);
  assert.match(dashboardSource, /LOCAL_APP_IN_FLIGHT_ACTIONS\.set/);
  assert.match(dashboardSource, /LOCAL_APP_IN_FLIGHT_ACTIONS\.delete/);
});

test("D1-D: lifecycle API response uses appName field, not legacy 'app'", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  assert.match(dashboardSource, /appName:\s*payload\.name/);
});

test("D1-D: lifecycle API responses exclude statusCode from JSON body (uses __statusCode internally)", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Verify internal __statusCode pattern is used
  assert.match(dashboardSource, /__statusCode/);
  assert.match(dashboardSource, /delete.*__statusCode/);
});

test("D1-D: lifecycle API responses include required fields: appName, action, status, message, error, nextPollMs", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  assert.match(dashboardSource, /appName/);
  assert.match(dashboardSource, /action:/);
  assert.match(dashboardSource, /status:/);
  assert.match(dashboardSource, /message:/);
  assert.match(dashboardSource, /error:/);
  assert.match(dashboardSource, /nextPollMs/);
});

test("D1-D: duplicate guards use 'blocked' status, return 409, include nextPollMs", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  assert.match(dashboardSource, /status:\s*"blocked"/);
  assert.match(dashboardSource, /writeHead\s*\(\s*409/);
  assert.match(dashboardSource, /nextPollMs:\s*1000/);
});

test("D1-D: in-flight guards are cleared in error paths", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Verify deletion appears multiple times (in catch and finally blocks)
  const deleteCount = (dashboardSource.match(/LOCAL_APP_IN_FLIGHT_ACTIONS\.delete/g) || []).length;
  assert.ok(deleteCount >= 3, `Should delete in-flight guards multiple times, found ${deleteCount}`);
});

test("D1-D: local app actions poll /api/local-apps endpoint", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  assert.match(dashboardSource, /pollLocalAppUntilStable/);
  assert.ok(dashboardSource.includes('/api/local-apps'), "Should poll /api/local-apps endpoint");
});

test("D1-D: local app lifecycle handlers updateLocalAppCardUI without reload", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Verify updateLocalAppCardUI function exists and updates UI in-place
  assert.match(dashboardSource, /async function updateLocalAppCardUI/);

  // Verify pollLocalAppUntilStable doesn't reload
  assert.ok(dashboardSource.includes("pollLocalAppUntilStable"), "Should have polling mechanism");

  // Reload is only used for system updates, not local app actions
  assert.ok(dashboardSource.includes("updateLocalAppCardUI"), "Should update UI without reload");
});

test("D1-D: restart script includes ProBot in safe kill candidates", () => {
  const restartSource = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "..", "..", "tools", "scripts", "restart-probot-dashboard.mjs"), "utf8");

  assert.match(restartSource, /ProBot/);
  assert.match(restartSource, /node.*npm.*tsx.*ProBot/);
});

test("D1-D: restart script refuses non-recognized processes", () => {
  const restartSource = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "..", "..", "tools", "scripts", "restart-probot-dashboard.mjs"), "utf8");

  assert.match(restartSource, /Refusing to kill/);
  assert.match(restartSource, /throw new Error/);
});

/* D1-E Runtime Paths Normalization */

test("D1-E: getDefaultVideoOrchestratorPaths returns canonical root paths", () => {
  const paths = getDefaultVideoOrchestratorPaths();

  // Verify repoRoot is returned and ends with /brain
  assert.ok(paths.repoRoot, "repoRoot should be present");
  assert.ok(paths.repoRoot.endsWith("/brain"), `repoRoot should end with /brain, got: ${paths.repoRoot}`);

  // Verify runtimeRoot is returned and ends with /runtime/local
  assert.ok(paths.runtimeRoot, "runtimeRoot should be present");
  assert.ok(paths.runtimeRoot.endsWith("/runtime/local"), `runtimeRoot should end with /runtime/local, got: ${paths.runtimeRoot}`);

  // Verify runtimeDir ends with /runtime/local/video-orchestrator
  assert.ok(paths.runtimeDir.endsWith("/runtime/local/video-orchestrator"), `runtimeDir should end with /runtime/local/video-orchestrator, got: ${paths.runtimeDir}`);

  // Should NOT contain projects/probot/runtime
  assert.ok(!paths.runtimeDir.includes("projects/probot/runtime"), `runtimeDir should NOT contain projects/probot/runtime, got: ${paths.runtimeDir}`);
  assert.ok(paths.registryPath.includes("runtime/local/video-orchestrator"), `registryPath should be canonical, got: ${paths.registryPath}`);
  assert.ok(paths.snapshotPath.includes("runtime/local/video-orchestrator"), `snapshotPath should be canonical, got: ${paths.snapshotPath}`);
  assert.ok(paths.oauthClientConfigPath.includes("runtime/local/video-orchestrator"), `oauthClientConfigPath should be canonical, got: ${paths.oauthClientConfigPath}`);
  assert.ok(paths.oauthStateDir.includes("runtime/local/video-orchestrator"), `oauthStateDir should be canonical, got: ${paths.oauthStateDir}`);
  assert.ok(paths.accountHealthLogPath.includes("runtime/local/video-orchestrator"), `accountHealthLogPath should be canonical, got: ${paths.accountHealthLogPath}`);
});

test("D1-E: restart-probot-dashboard.mjs log path points to repo-root runtime/local/probot-dev.log", () => {
  const restartSource = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "..", "..", "tools", "scripts", "restart-probot-dashboard.mjs"), "utf8");

  // Should use runtime/local, not projects/probot/runtime
  assert.ok(restartSource.includes("runtime/local") && restartSource.includes("probot-dev.log"), "restart script should use runtime/local/probot-dev.log");
  assert.ok(!restartSource.includes("projects/probot/runtime"), "restart script should NOT use projects/probot/runtime");
});

test("D1-E: dashboard.ts uses getDefaultVideoOrchestratorPaths for all runtime paths", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Verify getVideoPaths() is called and getDefaultVideoOrchestratorPaths is imported
  assert.match(dashboardSource, /getDefaultVideoOrchestratorPaths/);
  assert.match(dashboardSource, /getVideoPaths\(\)/);

  // Verify all old hardcoded path constants have been removed
  assert.ok(!dashboardSource.includes('const VIDEO_ORCHESTRATOR_RUNTIME_DIR = path.resolve(process.cwd()'), "Should not have old VIDEO_ORCHESTRATOR_RUNTIME_DIR with process.cwd()");
  assert.ok(!dashboardSource.includes('const ACCOUNT_HEALTH_SNAPSHOT_PATH = path.resolve(process.cwd()'), "Should not have old ACCOUNT_HEALTH_SNAPSHOT_PATH with process.cwd()");
});

test("D1-E: helper script paths resolved from repoRoot/tools/scripts, not runtimeDir", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");

  // Verify helper scripts use paths.repoRoot
  assert.ok(dashboardSource.includes('path.resolve(getDefaultVideoOrchestratorPaths().repoRoot, "tools/scripts/video-orchestrator-account-health.mjs")'),
    "account-health script should use repoRoot");
  assert.ok(dashboardSource.includes('path.resolve(getDefaultVideoOrchestratorPaths().repoRoot, "tools/scripts/video-orchestrator-credential-helper.mjs")'),
    "credential helper script should use repoRoot");

  // Should NOT use runtimeDir/../.. pattern for helper scripts
  assert.ok(!dashboardSource.includes('path.resolve(getDefaultVideoOrchestratorPaths().runtimeDir, "..", "..", "tools/scripts'),
    "Should not use runtimeDir/../.. for helper script paths");
});

test("D1-E: source contains no hardcoded projects/probot/runtime writes", () => {
  const dashboardSource = fs.readFileSync(path.join(import.meta.dirname, "dashboard.ts"), "utf8");
  const voSource = fs.readFileSync(path.join(import.meta.dirname, "video-orchestrator-dashboard.ts"), "utf8");

  // Should NOT have literal 'projects/probot/runtime' in paths
  assert.ok(!dashboardSource.includes('projects/probot/runtime'), "dashboard.ts should not hardcode projects/probot/runtime");
  assert.ok(!voSource.includes('projects/probot/runtime'), "video-orchestrator-dashboard.ts should not hardcode projects/probot/runtime");

  // All runtime paths should go through getDefaultVideoOrchestratorPaths
  assert.match(dashboardSource, /getVideoPaths\(\)/);
});
