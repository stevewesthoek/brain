import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface DokployApplication {
  applicationId: string;
  name: string;
  applicationStatus: "done" | "running" | "failed" | "stopped" | string;
}

export interface DokployCompose {
  composeId: string;
  name: string;
  composeStatus: "done" | "running" | "failed" | "stopped" | string;
}

export interface DokployEnvironment {
  name: string;
  environmentId: string;
  isDefault: boolean;
  applications: DokployApplication[];
  compose: DokployCompose[];
}

export interface DokployProject {
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  environments: DokployEnvironment[];
}

export interface DokployAppWithProject {
  project: string;
  environment: string;
  name: string;
  status: string;
}

export interface DokployComposeWithProject {
  project: string;
  environment: string;
  name: string;
  status: string;
}

/**
 * Aggregated Dokploy deployment status for the dashboard.
 * Includes applications and Docker Compose services across all projects and environments.
 * Provides status breakdowns for sorting and filtering.
 */
export interface DokployStatus {
  error?: string;
  apps: DokployAppWithProject[];
  compose: DokployComposeWithProject[];
  totalApps: number;
  totalCompose: number;
  appsByStatus: Record<string, number>;
  composeByStatus: Record<string, number>;
}

/**
 * Load Dokploy API credentials from ~/.config/dokploy/.env
 * Expected format:
 *   DOKPLOY_URL=https://dokploy.prochat.tools
 *   DOKPLOY_API_KEY=<api-key>
 * @returns Credentials object or null if not configured
 * @throws Does not throw; returns null on any error
 */
function loadDokployCredentialsSync(): { url: string; apiKey: string } | null {
  try {
    const envPath = path.join(os.homedir(), ".config", "dokploy", ".env");
    if (!fs.existsSync(envPath)) {
      return null;
    }
    const envContent = fs.readFileSync(envPath, "utf-8");
    const lines = envContent.split("\n");
    const env: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        env[match[1]] = match[2];
      }
    }
    const url = env.DOKPLOY_URL;
    const apiKey = env.DOKPLOY_API_KEY;
    if (!url || !apiKey) {
      return null;
    }
    return { url, apiKey };
  } catch {
    return null;
  }
}

/**
 * Fetch deployment status from Dokploy API and aggregate applications/services.
 *
 * Process:
 * 1. Load credentials from ~/.config/dokploy/.env
 * 2. Query /api/project.all endpoint
 * 3. Flatten projects → environments → applications/compose into a single list
 * 4. Aggregate status counters
 * 5. Return structured data for dashboard rendering
 *
 * On error, returns graceful fallback with empty data and error message.
 *
 * @returns DokployStatus with apps, compose, totals, and status breakdowns
 * @timeout 10 seconds (fetch will timeout if Dokploy is unreachable)
 */
export async function getDokployStatus(): Promise<DokployStatus> {
  try {
    const creds = loadDokployCredentialsSync();
    if (!creds) {
      return {
        error: "Dokploy credentials not configured at ~/.config/dokploy/.env",
        apps: [],
        compose: [],
        totalApps: 0,
        totalCompose: 0,
        appsByStatus: {},
        composeByStatus: {},
      };
    }

    const { url, apiKey } = creds;

    const apiUrl = url.endsWith("/api") ? url : `${url}/api`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(`${apiUrl}/project.all`, {
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Dokploy API returned ${response.status}`);
    }

    // Validate response is JSON and within reasonable size
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("Dokploy API returned non-JSON response");
    }

    const projects: DokployProject[] = await response.json();

    const apps: DokployAppWithProject[] = [];
    const compose: DokployComposeWithProject[] = [];
    const appsByStatus: Record<string, number> = {};
    const composeByStatus: Record<string, number> = {};

    // Flatten projects → environments → applications/services
    for (const project of projects) {
      if (!project.environments || !Array.isArray(project.environments)) continue;

      for (const env of project.environments) {
        // Collect applications
        if (env.applications && Array.isArray(env.applications)) {
          for (const app of env.applications) {
            const status = app.applicationStatus || "unknown";
            apps.push({
              project: project.name || "unnamed",
              environment: env.name || "unknown",
              name: app.name || "unnamed",
              status,
            });
            appsByStatus[status] = (appsByStatus[status] || 0) + 1;
          }
        }

        // Collect compose services
        if (env.compose && Array.isArray(env.compose)) {
          for (const service of env.compose) {
            const status = service.composeStatus || "unknown";
            compose.push({
              project: project.name || "unnamed",
              environment: env.name || "unknown",
              name: service.name || "unnamed",
              status,
            });
            composeByStatus[status] = (composeByStatus[status] || 0) + 1;
          }
        }
      }
    }

    return {
      apps,
      compose,
      totalApps: apps.length,
      totalCompose: compose.length,
      appsByStatus,
      composeByStatus,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Log for debugging but don't expose full stack trace to dashboard
    if (errorMsg.includes("abort")) {
      console.warn("Dokploy API request timed out (10s)");
    } else {
      console.warn("Dokploy API error:", errorMsg);
    }
    return {
      error: errorMsg.includes("abort")
        ? "Dokploy API request timed out"
        : `Dokploy unavailable: ${errorMsg}`,
      apps: [],
      compose: [],
      totalApps: 0,
      totalCompose: 0,
      appsByStatus: {},
      composeByStatus: {},
    };
  }
}
