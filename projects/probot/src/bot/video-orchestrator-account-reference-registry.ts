export type VideoOrchestratorAccountReferencePlatform = "youtube" | "tiktok" | "pinterest" | "facebook" | "instagram" | "linkedin" | "x" | "bluesky" | "unknown";
export type VideoOrchestratorAccountReferenceMode = "oauth" | "api_key" | "manual" | "none";
export type VideoOrchestratorAccountReferenceStatus = "connected" | "needs_setup" | "needs_reconnect" | "manual_only" | "disabled" | "unknown";
export type VideoOrchestratorAccountReferenceTarget = "keychain" | "env_reference" | "manual_reference" | "none";

export interface VideoOrchestratorAccountReferenceEntryInput {
  project_id?: unknown;
  platform?: unknown;
  account_id?: unknown;
  account_label?: unknown;
  reference_label?: unknown;
  auth_mode?: unknown;
  auth_status?: unknown;
  reference_target?: unknown;
  reference_name?: unknown;
  oauth_connect_url?: unknown;
  api_key_setup_url?: unknown;
  manual_setup_summary?: unknown;
  enabled?: unknown;
  token?: unknown;
  refresh_token?: unknown;
  client_secret?: unknown;
  api_key?: unknown;
  raw_reference?: unknown;
}

export interface SafeVideoOrchestratorAccountReferenceEntry {
  reference_id: string;
  project_id: string;
  platform: VideoOrchestratorAccountReferencePlatform;
  account_id: string;
  account_label: string;
  reference_label: string;
  auth_mode: VideoOrchestratorAccountReferenceMode;
  auth_status: VideoOrchestratorAccountReferenceStatus;
  reference_target: VideoOrchestratorAccountReferenceTarget;
  reference_name: string;
  oauth_connect_url: string | null;
  api_key_setup_url: string | null;
  manual_setup_summary: string | null;
  enabled: boolean;
  next_action: string;
  sensitive_value_present_in_input: boolean;
  sensitive_value_accepted: false;
  sensitive_read_performed: false;
  sensitive_write_performed: false;
  oauth_exchange_executed: false;
}

export interface VideoOrchestratorAccountReferenceRegistryModel {
  schema_version: "1.0";
  entries: SafeVideoOrchestratorAccountReferenceEntry[];
  summary: {
    project_count: number;
    account_count: number;
    reference_count: number;
    connected_count: number;
    needs_setup_count: number;
    needs_reconnect_count: number;
    manual_only_count: number;
    disabled_count: number;
    rejected_sensitive_value_count: number;
  };
  safety: {
    reference_only: true;
    sensitive_values_rendered: false;
    sensitive_read_performed: false;
    sensitive_write_performed: false;
    oauth_exchange_executed: false;
    env_written: false;
    files_written: false;
  };
}

function safeText(value: unknown, fallback: string): string {
  const text = String(value ?? "").replace(/[<>]/g, "").trim();
  return text ? text.slice(0, 240) : fallback;
}

function safeSlug(value: unknown, fallback: string): string {
  const text = safeText(value, fallback).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!text || text.includes("..")) return fallback;
  return text.slice(0, 96);
}

function normalizePlatform(value: unknown): VideoOrchestratorAccountReferencePlatform {
  const text = safeText(value, "unknown").toLowerCase();
  if (["youtube", "tiktok", "pinterest", "facebook", "instagram", "linkedin", "x", "bluesky"].includes(text)) return text as VideoOrchestratorAccountReferencePlatform;
  return "unknown";
}

function normalizeMode(value: unknown): VideoOrchestratorAccountReferenceMode {
  const text = safeText(value, "none").toLowerCase();
  if (text === "oauth" || text === "api_key" || text === "manual") return text;
  return "none";
}

function normalizeTarget(value: unknown, mode: VideoOrchestratorAccountReferenceMode): VideoOrchestratorAccountReferenceTarget {
  const text = safeText(value, "none").toLowerCase();
  if (text === "keychain" || text === "env_reference" || text === "manual_reference") return text;
  if (mode === "oauth") return "keychain";
  if (mode === "api_key") return "env_reference";
  if (mode === "manual") return "manual_reference";
  return "none";
}

function normalizeStatus(value: unknown, enabled: boolean, mode: VideoOrchestratorAccountReferenceMode): VideoOrchestratorAccountReferenceStatus {
  if (!enabled) return "disabled";
  if (mode === "manual") return "manual_only";
  const text = safeText(value, "unknown").toLowerCase();
  if (text === "connected" || text === "needs_setup" || text === "needs_reconnect" || text === "manual_only" || text === "disabled") return text;
  if (mode === "oauth" || mode === "api_key") return "needs_setup";
  return "unknown";
}

function safeUrl(value: unknown): string | null {
  const text = safeText(value, "");
  if (!text) return null;
  if (/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(text)) return text;
  return null;
}

function hasSensitiveValue(input: VideoOrchestratorAccountReferenceEntryInput): boolean {
  return Boolean(input.token || input.refresh_token || input.client_secret || input.api_key || input.raw_reference);
}

function nextAction(entry: Pick<SafeVideoOrchestratorAccountReferenceEntry, "auth_status" | "auth_mode" | "sensitive_value_present_in_input">): string {
  if (entry.sensitive_value_present_in_input) return "Remove sensitive values from registry input; store only backend references through the approved account flow.";
  if (entry.auth_status === "connected") return "Account reference is connected; verify health before scheduled publishing.";
  if (entry.auth_status === "needs_reconnect") return "Reconnect account through the platform OAuth or API setup flow.";
  if (entry.auth_status === "manual_only") return "Manual setup documented; no automated exchange is available.";
  if (entry.auth_mode === "none") return "Choose an auth mode before connecting this account.";
  return "Complete setup through the platform account flow.";
}

export function normalizeVideoOrchestratorAccountReferenceEntry(input: VideoOrchestratorAccountReferenceEntryInput): SafeVideoOrchestratorAccountReferenceEntry {
  const projectId = safeSlug(input.project_id, "default-project");
  const platform = normalizePlatform(input.platform);
  const accountId = safeSlug(input.account_id, `${projectId}-${platform}-account`);
  const enabled = Boolean(input.enabled ?? true);
  const authMode = normalizeMode(input.auth_mode);
  const authStatus = normalizeStatus(input.auth_status, enabled, authMode);
  const referenceTarget = normalizeTarget(input.reference_target, authMode);
  const referenceName = safeSlug(input.reference_name, `${projectId}.${platform}.${accountId}.${authMode}`);
  const sensitivePresent = hasSensitiveValue(input);
  const partial: SafeVideoOrchestratorAccountReferenceEntry = {
    reference_id: safeSlug(input.reference_label, `${projectId}-${platform}-${accountId}-${authMode}`),
    project_id: projectId,
    platform,
    account_id: accountId,
    account_label: safeSlug(input.account_label, accountId),
    reference_label: safeText(input.reference_label, `${platform} ${authMode} reference`),
    auth_mode: authMode,
    auth_status: authStatus,
    reference_target: referenceTarget,
    reference_name: referenceName,
    oauth_connect_url: safeUrl(input.oauth_connect_url),
    api_key_setup_url: safeUrl(input.api_key_setup_url),
    manual_setup_summary: input.manual_setup_summary ? safeText(input.manual_setup_summary, "Manual setup required.") : null,
    enabled,
    next_action: "",
    sensitive_value_present_in_input: sensitivePresent,
    sensitive_value_accepted: false,
    sensitive_read_performed: false,
    sensitive_write_performed: false,
    oauth_exchange_executed: false,
  };
  return { ...partial, next_action: nextAction(partial) };
}

export function createVideoOrchestratorAccountReferenceRegistryModel(inputs: VideoOrchestratorAccountReferenceEntryInput[]): VideoOrchestratorAccountReferenceRegistryModel {
  const entries = inputs.map(normalizeVideoOrchestratorAccountReferenceEntry);
  return {
    schema_version: "1.0",
    entries,
    summary: {
      project_count: new Set(entries.map((entry) => entry.project_id)).size,
      account_count: new Set(entries.map((entry) => `${entry.project_id}:${entry.platform}:${entry.account_id}`)).size,
      reference_count: entries.length,
      connected_count: entries.filter((entry) => entry.auth_status === "connected").length,
      needs_setup_count: entries.filter((entry) => entry.auth_status === "needs_setup").length,
      needs_reconnect_count: entries.filter((entry) => entry.auth_status === "needs_reconnect").length,
      manual_only_count: entries.filter((entry) => entry.auth_status === "manual_only").length,
      disabled_count: entries.filter((entry) => entry.auth_status === "disabled").length,
      rejected_sensitive_value_count: entries.filter((entry) => entry.sensitive_value_present_in_input).length,
    },
    safety: { reference_only: true, sensitive_values_rendered: false, sensitive_read_performed: false, sensitive_write_performed: false, oauth_exchange_executed: false, env_written: false, files_written: false },
  };
}

export function renderVideoOrchestratorAccountReferenceRegistrySummary(model: VideoOrchestratorAccountReferenceRegistryModel): string {
  const lines = [
    `Account reference registry: ${model.summary.reference_count} references across ${model.summary.project_count} projects and ${model.summary.account_count} accounts.`,
    `Connected: ${model.summary.connected_count}; setup: ${model.summary.needs_setup_count}; reconnect: ${model.summary.needs_reconnect_count}; manual: ${model.summary.manual_only_count}; disabled: ${model.summary.disabled_count}.`,
    model.summary.rejected_sensitive_value_count > 0 ? `${model.summary.rejected_sensitive_value_count} input entries contained sensitive values and were converted to reference-only actions.` : "No sensitive values were accepted.",
  ];
  return lines.join("\n");
}
