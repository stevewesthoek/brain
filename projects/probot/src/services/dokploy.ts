import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);

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

export interface DokployStatus {
  error?: string;
  apps: DokployAppWithProject[];
  compose: DokployComposeWithProject[];
  totalApps: number;
  totalCompose: number;
  appsByStatus: Record<string, number>;
  composeByStatus: Record<string, number>;
}

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

export async function getDokployStatus(): Promise<DokployStatus> {
  try {
    const creds = loadDokployCredentialsSync();
    if (!creds) {
      return {
        error: "Dokploy credentials not configured",
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
    const response = await fetch(`${apiUrl}/project.all`, {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Dokploy API error: ${response.status}`);
    }

    const projects: DokployProject[] = await response.json();

    const apps: DokployAppWithProject[] = [];
    const compose: DokployComposeWithProject[] = [];
    const appsByStatus: Record<string, number> = {};
    const composeByStatus: Record<string, number> = {};

    for (const project of projects) {
      for (const env of project.environments || []) {
        for (const app of env.applications || []) {
          apps.push({
            project: project.name,
            environment: env.name,
            name: app.name,
            status: app.applicationStatus,
          });
          appsByStatus[app.applicationStatus] = (appsByStatus[app.applicationStatus] || 0) + 1;
        }
        for (const service of env.compose || []) {
          compose.push({
            project: project.name,
            environment: env.name,
            name: service.name,
            status: service.composeStatus,
          });
          composeByStatus[service.composeStatus] = (composeByStatus[service.composeStatus] || 0) + 1;
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
    console.error("Failed to fetch Dokploy status:", error);
    return {
      error: `Failed to fetch Dokploy status: ${String(error)}`,
      apps: [],
      compose: [],
      totalApps: 0,
      totalCompose: 0,
      appsByStatus: {},
      composeByStatus: {},
    };
  }
}
