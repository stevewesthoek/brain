import type { LocalAccountRegistry, LocalAccountRegistryEntry } from "./video-orchestrator-dashboard.js";
import { createVideoOrchestratorDashboardAccountUiModel, type VideoOrchestratorDashboardProjectInput, type VideoOrchestratorDashboardDefaultVisibility } from "./video-orchestrator-dashboard-account-ui.js";

export interface VideoOrchestratorDashboardRegistryProjectGroup {
  project_id: string;
  project_label: string;
  display_name: string;
  default_visibility: VideoOrchestratorDashboardDefaultVisibility;
  accounts: LocalAccountRegistryEntry[];
}

function safeSlug(value: string | undefined, fallback: string): string {
  const text = String(value ?? fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return text && !text.includes("..") ? text.slice(0, 96) : fallback;
}

function inferProjectId(account: LocalAccountRegistryEntry): string {
  const notesMatch = account.notes?.match(/project\s*[:=]\s*([a-z0-9._-]+)/i)?.[1];
  if (notesMatch) return safeSlug(notesMatch, "default-project");
  const labelPrefix = account.account_label.split(/[/:]/)[0];
  if (labelPrefix && labelPrefix !== account.account_label) return safeSlug(labelPrefix, "default-project");
  return "default-project";
}

function normalizeVisibility(value: string | undefined): VideoOrchestratorDashboardDefaultVisibility {
  return value === "private" ? "private" : "scheduled";
}

export function groupVideoOrchestratorRegistryAccounts(registry: LocalAccountRegistry | null | undefined): VideoOrchestratorDashboardRegistryProjectGroup[] {
  const groups = new Map<string, VideoOrchestratorDashboardRegistryProjectGroup>();
  for (const account of registry?.accounts ?? []) {
    const projectId = inferProjectId(account);
    const project = groups.get(projectId) ?? {
      project_id: projectId,
      project_label: projectId,
      display_name: projectId === "default-project" ? "Default Project" : projectId,
      default_visibility: normalizeVisibility(account.default_privacy),
      accounts: [],
    };
    project.accounts.push(account);
    groups.set(projectId, project);
  }
  return Array.from(groups.values()).sort((a, b) => a.project_id.localeCompare(b.project_id));
}

function mapCredentialMode(authMode: string): "oauth" | "api_key" | "manual" | "none" {
  const mode = authMode.toLowerCase();
  if (mode.includes("oauth")) return "oauth";
  if (mode.includes("api")) return "api_key";
  if (mode.includes("manual")) return "manual";
  return "none";
}

function mapCredentialStatus(account: LocalAccountRegistryEntry): "connected" | "needs_setup" | "manual_only" | "disabled" | "unknown" {
  if (!account.enabled) return "disabled";
  const mode = mapCredentialMode(account.auth_mode);
  if (mode === "manual") return "manual_only";
  if (account.credential_reference) return "connected";
  if (mode === "oauth" || mode === "api_key") return "needs_setup";
  return "unknown";
}

export function createVideoOrchestratorDashboardAccountUiModelFromRegistry(registry: LocalAccountRegistry | null | undefined) {
  const projects: VideoOrchestratorDashboardProjectInput[] = groupVideoOrchestratorRegistryAccounts(registry).map((project) => ({
    project_id: project.project_id,
    project_label: project.project_label,
    display_name: project.display_name,
    default_visibility: project.default_visibility,
    accounts: project.accounts.map((account) => ({
      account_id: account.account_id,
      platform: account.platform,
      account_label: account.account_label,
      display_name: account.display_name,
      enabled: account.enabled,
      credential_mode: mapCredentialMode(account.auth_mode),
      credential_status: mapCredentialStatus(account),
      default_visibility: normalizeVisibility(account.default_privacy),
      allowed_visibility: account.allowed_privacy?.map(normalizeVisibility),
      project_id: project.project_id,
      project_label: project.project_label,
      oauth_available: mapCredentialMode(account.auth_mode) === "oauth",
      manual_setup_summary: account.notes,
      next_action: account.credential_reference ? "Credential reference configured; verify health before scheduled publishing." : "Add credential reference through the backend credential flow.",
    })),
  }));
  return createVideoOrchestratorDashboardAccountUiModel(projects);
}
