import { createVideoOrchestratorDashboardAccountUiModel, type VideoOrchestratorDashboardAccountUiModel, type VideoOrchestratorDashboardProjectInput } from "./video-orchestrator-dashboard-account-ui.js";
import type { SafeVideoOrchestratorAccountReferenceEntry, VideoOrchestratorAccountReferenceRegistryModel } from "./video-orchestrator-account-reference-registry.js";

export interface VideoOrchestratorAccountReferenceDashboardProjectGroup {
  project_id: string;
  project_label: string;
  display_name: string;
  accounts: SafeVideoOrchestratorAccountReferenceEntry[];
}

function projectName(projectId: string): string {
  return projectId.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || projectId;
}

export function groupVideoOrchestratorAccountReferencesForDashboard(model: VideoOrchestratorAccountReferenceRegistryModel): VideoOrchestratorAccountReferenceDashboardProjectGroup[] {
  const groups = new Map<string, VideoOrchestratorAccountReferenceDashboardProjectGroup>();
  for (const entry of model.entries) {
    const group = groups.get(entry.project_id) ?? { project_id: entry.project_id, project_label: entry.project_id, display_name: projectName(entry.project_id), accounts: [] };
    group.accounts.push(entry);
    groups.set(entry.project_id, group);
  }
  return Array.from(groups.values()).sort((a, b) => a.project_id.localeCompare(b.project_id));
}

function dashboardStatus(entry: SafeVideoOrchestratorAccountReferenceEntry): "connected" | "needs_setup" | "needs_reconnect" | "manual_only" | "disabled" | "unknown" {
  if (entry.sensitive_value_present_in_input) return "needs_setup";
  return entry.auth_status;
}

export function createVideoOrchestratorDashboardAccountUiModelFromReferenceRegistry(model: VideoOrchestratorAccountReferenceRegistryModel): VideoOrchestratorDashboardAccountUiModel {
  const projects: VideoOrchestratorDashboardProjectInput[] = groupVideoOrchestratorAccountReferencesForDashboard(model).map((project) => ({
    project_id: project.project_id,
    project_label: project.project_label,
    display_name: project.display_name,
    default_visibility: "scheduled",
    accounts: project.accounts.map((entry) => ({
      account_id: entry.account_id,
      platform: entry.platform,
      account_label: entry.account_label,
      display_name: entry.reference_label,
      enabled: entry.enabled,
      credential_mode: entry.auth_mode,
      credential_status: dashboardStatus(entry),
      default_visibility: entry.platform === "youtube" ? "private" : "scheduled",
      allowed_visibility: entry.platform === "youtube" ? ["private"] : ["scheduled"],
      project_id: entry.project_id,
      project_label: entry.project_id,
      oauth_available: entry.auth_mode === "oauth",
      deep_link_url: entry.oauth_connect_url ?? entry.api_key_setup_url,
      manual_setup_summary: entry.manual_setup_summary,
      next_action: entry.next_action,
    })),
  }));
  return createVideoOrchestratorDashboardAccountUiModel(projects);
}
