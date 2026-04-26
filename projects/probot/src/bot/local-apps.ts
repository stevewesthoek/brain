import fs from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

export type NormalizedLocalApp = {
  name: string;
  port: number | null;
  url: string;
  check: string;
  start: string | null;
  stop: string | null;
  restart: string | null;
  description: string;
  repoPath: string | null;
  startupTimeoutMs: number | null;
  databaseEngine: string | null;
  databaseServiceName: string | null;
  databasePort: number | null;
  databaseName: string | null;
  databaseUser: string | null;
  notes: string | null;
};

export type LocalAppStartState = {
  startedAt: number;
  startupTimeoutMs: number | null;
};

export type LocalAppsStatusOptions = {
  startingApps?: Map<string, LocalAppStartState> | Record<string, LocalAppStartState>;
  now?: number;
};

type RawLocalApp = {
  name?: unknown;
  port?: unknown;
  appPort?: unknown;
  url?: unknown;
  appUrl?: unknown;
  check?: unknown;
  healthCheck?: unknown;
  start?: unknown;
  startCommand?: unknown;
  stop?: unknown;
  stopCommand?: unknown;
  restart?: unknown;
  restartCommand?: unknown;
  startupTimeoutMs?: unknown;
  description?: unknown;
  repoPath?: unknown;
  databaseEngine?: unknown;
  databaseServiceName?: unknown;
  databasePort?: unknown;
  databaseName?: unknown;
  databaseUser?: unknown;
  notes?: unknown;
};

const LOCAL_APPS_CONFIG_PATH = path.join(
  os.homedir(),
  "Repos",
  "stevewesthoek",
  "brain",
  "operations",
  "infrastructure",
  "local-apps.json",
);
const LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS = 5_000;

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeLocalApp(raw: RawLocalApp): NormalizedLocalApp | null {
  const name = readString(raw.name, "");
  if (!name) return null;

  return {
    name,
    port: readNumberOrNull(raw.port ?? raw.appPort),
    url: readString(raw.url ?? raw.appUrl, ""),
    check: readString(raw.check ?? raw.healthCheck, ""),
    start: readStringOrNull(raw.start ?? raw.startCommand),
    stop: readStringOrNull(raw.stop ?? raw.stopCommand),
    restart: readStringOrNull(raw.restart ?? raw.restartCommand),
    description: readString(raw.description, ""),
    repoPath: readStringOrNull(raw.repoPath),
    startupTimeoutMs: readNumberOrNull(raw.startupTimeoutMs),
    databaseEngine: readStringOrNull(raw.databaseEngine),
    databaseServiceName: readStringOrNull(raw.databaseServiceName),
    databasePort: readNumberOrNull(raw.databasePort),
    databaseName: readStringOrNull(raw.databaseName),
    databaseUser: readStringOrNull(raw.databaseUser),
    notes: readStringOrNull(raw.notes),
  };
}

export function loadLocalApps(): NormalizedLocalApp[] {
  try {
    const raw = fs.readFileSync(LOCAL_APPS_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLocalApp).filter((app): app is NormalizedLocalApp => app !== null);
  } catch {
    return [];
  }
}

export function findLocalApp(name: string): NormalizedLocalApp | null {
  return loadLocalApps().find(app => app.name === name) ?? null;
}

export function classifyLocalAppStartCommand(command: string): "foreground" | "background" {
  if (command.includes("nohup") || /(?:^|\s)-d(?:\s|$)/.test(command) || command.trim().endsWith("&")) {
    return "background";
  }
  if (/\b(npm run dev|next dev|tsx watch|vite|nuxt dev|astro dev|pnpm dev|yarn dev|bun dev)\b/.test(command)) {
    return "foreground";
  }
  return "foreground";
}

export function launchLocalAppStartCommand(
  command: string,
  cwd: string,
  app: NormalizedLocalApp | null = null,
): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  // Let app entries declare a port once in the registry and keep the shell
  // command itself generic. This avoids stale hard-coded PORT values.
  const inferredPort =
    app?.port ??
    Number.parseInt(command.match(/(?:^|\s)PORT=(\d+)(?:\s|$)/)?.[1] ?? "", 10);
  if (!Number.isNaN(inferredPort) && inferredPort > 0) {
    env.PORT = String(inferredPort);
  }

  const child = spawn("/bin/bash", ["-lc", command], {
    cwd,
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();
}

export function resolveLocalAppCwd(app: NormalizedLocalApp | null): string {
  return app?.repoPath ?? os.homedir();
}

export function resolveLocalAppLifecycleCommand(
  app: NormalizedLocalApp | null,
  kind: "start" | "stop",
): string | null {
  const explicitCommand = kind === "start" ? app?.start : app?.stop;
  if (explicitCommand) return explicitCommand;

  if (!app?.repoPath) return null;

  const scriptName = kind === "start" ? "start-local.sh" : "stop-local.sh";
  const scriptPath = path.join(app.repoPath, "scripts", "dev", scriptName);
  if (!fs.existsSync(scriptPath)) return null;

  return `bash scripts/dev/${scriptName}`;
}

export function resolveLocalAppRestartCommand(app: NormalizedLocalApp | null): string | null {
  if (app?.restart) return app.restart;
  return null;
}

export async function buildLocalAppsStatus(
  apps: NormalizedLocalApp[],
  fetchImpl: typeof fetch = fetch,
  options: LocalAppsStatusOptions = {},
): Promise<{ apps: Array<{ name: string; port: number | null; url: string; description: string; status: string; restartable: boolean; lastSeen: null; lastDuration: null }> }> {
  const startingApps =
    options.startingApps instanceof Map
      ? options.startingApps
      : new Map(Object.entries(options.startingApps ?? {}));
  const now = options.now ?? Date.now();
  const statusApps = await Promise.all(
    apps.map(async (app) => {
      const startupState = startingApps.get(app.name) ?? null;
      const startupTimeoutMs = startupState?.startupTimeoutMs ?? null;
      const startupDeadline = startupState ? startupState.startedAt + (startupTimeoutMs ?? 30_000) : null;
      const withinStartupWindow = startupDeadline !== null ? now < startupDeadline : false;

      let status = "stopped";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS);
      try {
        if (!app.check) throw new Error(`Missing health check for ${app.name}`);
        const response = await fetchImpl(app.check, { signal: controller.signal });
        if (response.ok) {
          status = "running";
        } else if (withinStartupWindow) {
          status = "starting";
        }
      } catch {
        status = withinStartupWindow ? "starting" : "stopped";
      } finally {
        clearTimeout(timeout);
      }

      return {
        name: app.name,
        port: app.port,
        url: app.url,
        description: app.description,
        status,
        restartable: Boolean(app.restart || app.stop || app.start || app.port),
        lastSeen: null,
        lastDuration: null,
      };
    }),
  );
  return { apps: statusApps };
}

export async function waitForLocalAppHealth(
  app: NormalizedLocalApp | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 30000,
): Promise<boolean> {
  if (!app?.check) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOCAL_APP_HEALTH_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(app.check, { signal: controller.signal });
      if (response.ok) return true;
    } catch {
      // keep polling until timeout
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
