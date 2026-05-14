import { redactVideoOrchestratorText } from "./video-orchestrator-dashboard.js";

export type VideoOrchestratorDashboardPlatform = "youtube" | "tiktok" | "pinterest" | "facebook" | "instagram" | "linkedin" | "x" | "bluesky" | "unknown";
export type VideoOrchestratorDashboardCredentialMode = "oauth" | "api_key" | "manual" | "none";
export type VideoOrchestratorDashboardCredentialStatus = "connected" | "needs_setup" | "needs_reconnect" | "manual_only" | "disabled" | "unknown";
export type VideoOrchestratorDashboardDefaultVisibility = "scheduled" | "private";

export interface VideoOrchestratorDashboardAccountInput {
  account_id?: unknown;
  platform?: unknown;
  account_label?: unknown;
  display_name?: unknown;
  enabled?: unknown;
  credential_mode?: unknown;
  credential_status?: unknown;
  default_visibility?: unknown;
  allowed_visibility?: unknown;
  project_id?: unknown;
  project_label?: unknown;
  next_action?: unknown;
  deep_link_url?: unknown;
  manual_setup_summary?: unknown;
  oauth_available?: unknown;
  credential_reference?: unknown;
  token?: unknown;
  client_secret?: unknown;
}

export interface VideoOrchestratorDashboardProjectInput {
  project_id?: unknown;
  project_label?: unknown;
  display_name?: unknown;
  default_visibility?: unknown;
  accounts?: unknown;
}

export interface SafeVideoOrchestratorDashboardAccount {
  account_id: string;
  platform: VideoOrchestratorDashboardPlatform;
  account_label: string;
  display_name: string;
  enabled: boolean;
  credential_mode: VideoOrchestratorDashboardCredentialMode;
  credential_status: VideoOrchestratorDashboardCredentialStatus;
  default_visibility: VideoOrchestratorDashboardDefaultVisibility;
  allowed_visibility: VideoOrchestratorDashboardDefaultVisibility[];
  project_id: string;
  project_label: string;
  next_action: string;
  deep_link_url: string | null;
  manual_setup_summary: string | null;
  oauth_available: boolean;
  secrets_redacted: true;
}

export interface SafeVideoOrchestratorDashboardProject {
  project_id: string;
  project_label: string;
  display_name: string;
  default_visibility: VideoOrchestratorDashboardDefaultVisibility;
  accounts: SafeVideoOrchestratorDashboardAccount[];
}

export interface VideoOrchestratorDashboardAccountUiModel {
  schema_version: "1.0";
  projects: SafeVideoOrchestratorDashboardProject[];
  summary: {
    project_count: number;
    account_count: number;
    platform_count: number;
    connected_count: number;
    needs_setup_count: number;
    needs_reconnect_count: number;
    manual_only_count: number;
    disabled_count: number;
  };
  safety: {
    read_only: true;
    secrets_rendered: false;
    oauth_exchange_executed: false;
    env_written: false;
    files_written: false;
    uploads_executed: false;
  };
}

function safeText(value: unknown, fallback: string): string {
  const redacted = redactVideoOrchestratorText(value);
  const text = redacted?.trim();
  return text ? text : fallback;
}

function safeSlug(value: unknown, fallback: string): string {
  const text = safeText(value, fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!text || text.includes("..")) return fallback;
  return text.slice(0, 96);
}

function normalizePlatform(value: unknown): VideoOrchestratorDashboardPlatform {
  const text = safeText(value, "unknown").toLowerCase();
  if (["youtube", "tiktok", "pinterest", "facebook", "instagram", "linkedin", "x", "bluesky"].includes(text)) return text as VideoOrchestratorDashboardPlatform;
  return "unknown";
}

function normalizeCredentialMode(value: unknown): VideoOrchestratorDashboardCredentialMode {
  const text = safeText(value, "none").toLowerCase();
  if (text === "oauth" || text === "api_key" || text === "manual") return text;
  return "none";
}

function normalizeCredentialStatus(value: unknown, enabled: boolean, mode: VideoOrchestratorDashboardCredentialMode): VideoOrchestratorDashboardCredentialStatus {
  if (!enabled) return "disabled";
  if (mode === "manual") return "manual_only";
  const text = safeText(value, "unknown").toLowerCase();
  if (text === "connected" || text === "needs_setup" || text === "needs_reconnect" || text === "manual_only" || text === "disabled") return text;
  return mode === "none" ? "needs_setup" : "unknown";
}

function normalizeVisibility(value: unknown): VideoOrchestratorDashboardDefaultVisibility {
  return safeText(value, "scheduled").toLowerCase() === "private" ? "private" : "scheduled";
}

function normalizeAllowedVisibility(value: unknown, fallback: VideoOrchestratorDashboardDefaultVisibility): VideoOrchestratorDashboardDefaultVisibility[] {
  const raw = Array.isArray(value) ? value : [fallback];
  const normalized = raw.map(normalizeVisibility);
  return Array.from(new Set(normalized.length ? normalized : [fallback]));
}

function normalizeDeepLink(value: unknown): string | null {
  const text = safeText(value, "");
  if (!text) return null;
  if (/^https:\/\/[a-z0-9.-]+\//i.test(text) || /^https:\/\/[a-z0-9.-]+$/i.test(text)) return text;
  return null;
}

function hasForbiddenSecretShape(value: VideoOrchestratorDashboardAccountInput): boolean {
  return Boolean(value.credential_reference || value.token || value.client_secret);
}

export function normalizeVideoOrchestratorDashboardAccount(input: VideoOrchestratorDashboardAccountInput, projectDefaults: { project_id: string; project_label: string; default_visibility: VideoOrchestratorDashboardDefaultVisibility }): SafeVideoOrchestratorDashboardAccount {
  const enabled = Boolean(input.enabled ?? true);
  const platform = normalizePlatform(input.platform);
  const credential_mode = normalizeCredentialMode(input.credential_mode);
  const credential_status = normalizeCredentialStatus(input.credential_status, enabled, credential_mode);
  const default_visibility = normalizeVisibility(input.default_visibility ?? projectDefaults.default_visibility);
  const account_id = safeSlug(input.account_id, `${projectDefaults.project_id}-${platform}-account`);
  const account_label = safeSlug(input.account_label, account_id);
  const display_name = safeText(input.display_name, account_label);
  const next_action = hasForbiddenSecretShape(input)
    ? "Remove secret-like values from dashboard payload; use credential references only in backend storage."
    : safeText(input.next_action, credential_status === "connected" ? "Ready for scheduled publishing review." : "Connect or review account credentials.");

  return {
    account_id,
    platform,
    account_label,
    display_name,
    enabled,
    credential_mode,
    credential_status,
    default_visibility,
    allowed_visibility: normalizeAllowedVisibility(input.allowed_visibility, default_visibility),
    project_id: safeSlug(input.project_id, projectDefaults.project_id),
    project_label: safeSlug(input.project_label, projectDefaults.project_label),
    next_action,
    deep_link_url: normalizeDeepLink(input.deep_link_url),
    manual_setup_summary: input.manual_setup_summary ? safeText(input.manual_setup_summary, "Manual setup required.") : null,
    oauth_available: Boolean(input.oauth_available ?? credential_mode === "oauth"),
    secrets_redacted: true,
  };
}

export function createVideoOrchestratorDashboardAccountUiModel(projectInputs: VideoOrchestratorDashboardProjectInput[]): VideoOrchestratorDashboardAccountUiModel {
  const projects = projectInputs.map((project, index): SafeVideoOrchestratorDashboardProject => {
    const project_id = safeSlug(project.project_id, `project-${index + 1}`);
    const project_label = safeSlug(project.project_label, project_id);
    const default_visibility = normalizeVisibility(project.default_visibility);
    const accountsInput = Array.isArray(project.accounts) ? project.accounts as VideoOrchestratorDashboardAccountInput[] : [];
    return {
      project_id,
      project_label,
      display_name: safeText(project.display_name, project_label),
      default_visibility,
      accounts: accountsInput.map((account) => normalizeVideoOrchestratorDashboardAccount(account, { project_id, project_label, default_visibility })),
    };
  });
  const accounts = projects.flatMap((project) => project.accounts);
  const platforms = new Set(accounts.map((account) => account.platform));
  return {
    schema_version: "1.0",
    projects,
    summary: {
      project_count: projects.length,
      account_count: accounts.length,
      platform_count: platforms.size,
      connected_count: accounts.filter((account) => account.credential_status === "connected").length,
      needs_setup_count: accounts.filter((account) => account.credential_status === "needs_setup").length,
      needs_reconnect_count: accounts.filter((account) => account.credential_status === "needs_reconnect").length,
      manual_only_count: accounts.filter((account) => account.credential_status === "manual_only").length,
      disabled_count: accounts.filter((account) => account.credential_status === "disabled").length,
    },
    safety: { read_only: true, secrets_rendered: false, oauth_exchange_executed: false, env_written: false, files_written: false, uploads_executed: false },
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function statusColor(status: VideoOrchestratorDashboardCredentialStatus): string {
  if (status === "connected") return "var(--green)";
  if (status === "needs_reconnect") return "#f59e0b";
  if (status === "needs_setup") return "#fbbf24";
  return "var(--muted)";
}

export function renderVideoOrchestratorDashboardAccountUi(model: VideoOrchestratorDashboardAccountUiModel): string {
  let html = '<div style="grid-column:1/-1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px">';
  html += '<h3 style="margin:0 0 8px 0;font-size:0.95em;color:var(--text);font-weight:600">Video Orchestrator Accounts</h3>';
  html += '<p style="margin:0 0 12px 0;color:var(--muted);font-size:0.85em">Project → platform → account overview. Secrets, tokens, OAuth codes, and raw credential references are never rendered.</p>';
  html += '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px">';
  html += `<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">projects</span> <strong>${model.summary.project_count}</strong></div>`;
  html += `<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">accounts</span> <strong>${model.summary.account_count}</strong></div>`;
  html += `<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">platforms</span> <strong>${model.summary.platform_count}</strong></div>`;
  html += `<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">connected</span> <strong>${model.summary.connected_count}</strong></div>`;
  html += '</div>';

  for (const project of model.projects) {
    html += '<div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border-radius:6px;border:1px solid rgba(255,255,255,0.04)">';
    html += `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px"><strong style="color:var(--text)">${escapeHtml(project.display_name)}</strong><span style="color:var(--muted);font-size:0.8em">Default: ${escapeHtml(project.default_visibility)}</span></div>`;
    if (project.accounts.length === 0) {
      html += '<div style="padding:8px;border-radius:4px;background:rgba(255,255,255,0.04);color:var(--muted);font-size:0.85em">No accounts configured for this project yet.</div>';
    }
    for (const account of project.accounts) {
      html += '<div style="padding:10px;margin-top:8px;border-radius:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.04)">';
      html += `<div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:var(--text)">${escapeHtml(account.display_name)}</strong><span style="color:${statusColor(account.credential_status)};font-weight:600">${escapeHtml(account.credential_status)}</span></div>`;
      html += `<div style="color:var(--muted);font-size:0.82em;margin-top:4px">${escapeHtml(account.platform)} • ${escapeHtml(account.credential_mode)} • ${escapeHtml(account.default_visibility)}</div>`;
      html += `<div style="color:var(--muted);font-size:0.82em;margin-top:4px">Next: ${escapeHtml(account.next_action)}</div>`;
      if (account.deep_link_url) html += `<div style="margin-top:6px"><a href="${escapeHtml(account.deep_link_url)}" target="_blank" rel="noreferrer" style="color:var(--accent);font-size:0.82em">Open platform setup</a></div>`;
      if (account.manual_setup_summary) html += `<div style="color:var(--muted);font-size:0.82em;margin-top:4px">Manual: ${escapeHtml(account.manual_setup_summary)}</div>`;
      html += '</div>';
    }
    html += '</div>';
  }

  html += '<p style="margin:12px 0 0 0;color:var(--muted);font-size:0.8em">Read-only dashboard model. OAuth exchange, environment writes, uploads, git operations, and secret rendering are outside this panel.</p>';
  html += '</div>';
  return html;
}
