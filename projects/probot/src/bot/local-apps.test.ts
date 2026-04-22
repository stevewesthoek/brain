import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalAppsStatus, classifyLocalAppStartCommand, normalizeLocalApp, waitForLocalAppHealth } from "./local-apps.js";

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
  assert.equal(app.repoPath, "/tmp/app");
  assert.equal(app.databaseEngine, "PostgreSQL");
  assert.equal(app.databaseServiceName, "postgres");
  assert.equal(app.databasePort, 5434);
  assert.equal(app.databaseName, "app");
  assert.equal(app.databaseUser, "app");
  assert.equal(app.notes, "note");
});

test("normalize dual-compatible BuildFlow entry", () => {
  const app = normalizeLocalApp({
    name: "BuildFlow",
    port: 3054,
    appPort: 3054,
    url: "http://localhost:3054",
    appUrl: "http://localhost:3054",
    check: "http://localhost:3054/api/openapi",
    healthCheck: "http://localhost:3054/api/openapi",
    start: "bash ~/Repos/stevewesthoek/buildflow/start-all.sh",
    startCommand: "bash ~/Repos/stevewesthoek/buildflow/start-all.sh",
    stop: "bash ~/Repos/stevewesthoek/buildflow/stop-all.sh",
    stopCommand: "bash ~/Repos/stevewesthoek/buildflow/stop-all.sh",
    description: "BuildFlow",
  });

  assert.ok(app);
  assert.equal(app.port, 3054);
  assert.equal(app.url, "http://localhost:3054");
  assert.equal(app.check, "http://localhost:3054/api/openapi");
  assert.equal(app.start, "bash ~/Repos/stevewesthoek/buildflow/start-all.sh");
  assert.equal(app.stop, "bash ~/Repos/stevewesthoek/buildflow/stop-all.sh");
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
        description: "",
        repoPath: null,
        startupTimeoutMs: null,
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
        description: "",
        repoPath: null,
        startupTimeoutMs: 120000,
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
  assert.equal(classifyLocalAppStartCommand("bash ~/Repos/stevewesthoek/buildflow/start-all.sh"), "foreground");
  assert.equal(classifyLocalAppStartCommand("cd ~/Repos/prochattools/saas/xgrow && npm run dev > /tmp/xgrow.log 2>&1 &"), "background");
});
