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
  description: string;
  repoPath: string | null;
  databaseEngine: string | null;
  databaseServiceName: string | null;
  databasePort: number | null;
  databaseName: string | null;
  databaseUser: string | null;
  notes: string | null;
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
    description: readString(raw.description, ""),
    repoPath: readStringOrNull(raw.repoPath),
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

export function launchLocalAppStartCommand(command: string, cwd: string): void {
  const child = spawn("/bin/bash", ["-lc", command], {
    cwd,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export async function buildLocalAppsStatus(
  apps: NormalizedLocalApp[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ apps: Array<{ name: string; port: number | null; url: string; description: string; status: string; lastSeen: null; lastDuration: null }> }> {
  const statusApps: Array<{ name: string; port: number | null; url: string; description: string; status: string; lastSeen: null; lastDuration: null }> = [];
  for (const app of apps) {
    let status = "stopped";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      if (!app.check) throw new Error(`Missing health check for ${app.name}`);
      const response = await fetchImpl(app.check, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) status = "running";
    } catch {
      status = "stopped";
    }
    statusApps.push({
      name: app.name,
      port: app.port,
      url: app.url,
      description: app.description,
      status,
      lastSeen: null,
      lastDuration: null,
    });
  }
  return { apps: statusApps };
}

export async function waitForLocalAppHealth(
  app: NormalizedLocalApp,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 30000,
): Promise<boolean> {
  if (!app.check) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(app.check, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return true;
    } catch {
      // keep polling until timeout
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
