export type VideoOrchestratorPlatformId = "youtube" | "tiktok" | "pinterest" | "facebook" | "instagram" | "linkedin" | "x" | "bluesky" | "manual" | "unknown";
export type VideoOrchestratorPlatformAdapterMode = "api" | "browser_assisted" | "manual" | "n8n" | "disabled";
export type VideoOrchestratorPlatformAdapterStatus = "supported" | "partial" | "manual_only" | "blocked" | "disabled" | "unknown";
export type VideoOrchestratorPlatformVisibilityMode = "scheduled" | "private" | "draft" | "manual";

export interface VideoOrchestratorPlatformAdapterInput {
  platform?: unknown;
  adapter_id?: unknown;
  display_name?: unknown;
  mode?: unknown;
  status?: unknown;
  supports_scheduled_publish?: unknown;
  default_visibility?: unknown;
  allowed_visibility?: unknown;
  supports_multi_account?: unknown;
  supports_resume?: unknown;
  supports_delete?: unknown;
  supports_metadata_update?: unknown;
  upload_enabled?: unknown;
  network_enabled?: unknown;
  credential_access_enabled?: unknown;
  media_read_enabled?: unknown;
  api_base_url?: unknown;
  setup_url?: unknown;
  notes?: unknown;
}

export interface SafeVideoOrchestratorPlatformAdapter {
  adapter_id: string;
  platform: VideoOrchestratorPlatformId;
  display_name: string;
  mode: VideoOrchestratorPlatformAdapterMode;
  status: VideoOrchestratorPlatformAdapterStatus;
  supports_scheduled_publish: boolean;
  default_visibility: VideoOrchestratorPlatformVisibilityMode;
  allowed_visibility: VideoOrchestratorPlatformVisibilityMode[];
  supports_multi_account: boolean;
  supports_resume: boolean;
  supports_delete: boolean;
  supports_metadata_update: boolean;
  upload_enabled: false;
  network_enabled: false;
  credential_access_enabled: false;
  media_read_enabled: false;
  api_base_url: string | null;
  setup_url: string | null;
  notes: string | null;
  next_action: string;
}

export interface VideoOrchestratorPlatformAdapterRegistry {
  schema_version: "1.0";
  adapters: SafeVideoOrchestratorPlatformAdapter[];
  summary: {
    adapter_count: number;
    platform_count: number;
    supported_count: number;
    partial_count: number;
    manual_only_count: number;
    blocked_count: number;
    disabled_count: number;
    scheduled_publish_count: number;
    resume_capable_count: number;
  };
  safety: {
    contract_only: true;
    upload_executed: false;
    network_calls_made: false;
    credential_accessed: false;
    media_read_performed: false;
    runtime_wiring_applied: false;
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

function normalizePlatform(value: unknown): VideoOrchestratorPlatformId {
  const text = safeText(value, "unknown").toLowerCase();
  if (["youtube", "tiktok", "pinterest", "facebook", "instagram", "linkedin", "x", "bluesky", "manual"].includes(text)) return text as VideoOrchestratorPlatformId;
  return "unknown";
}

function normalizeMode(value: unknown): VideoOrchestratorPlatformAdapterMode {
  const text = safeText(value, "disabled").toLowerCase();
  if (text === "api" || text === "browser_assisted" || text === "manual" || text === "n8n") return text;
  return "disabled";
}

function normalizeStatus(value: unknown, mode: VideoOrchestratorPlatformAdapterMode): VideoOrchestratorPlatformAdapterStatus {
  const text = safeText(value, "unknown").toLowerCase();
  if (text === "supported" || text === "partial" || text === "manual_only" || text === "blocked" || text === "disabled") return text;
  if (mode === "manual") return "manual_only";
  if (mode === "disabled") return "disabled";
  return "unknown";
}

function normalizeVisibility(value: unknown, fallback: VideoOrchestratorPlatformVisibilityMode): VideoOrchestratorPlatformVisibilityMode {
  const text = safeText(value, fallback).toLowerCase();
  if (text === "private" || text === "draft" || text === "manual") return text;
  return "scheduled";
}

function normalizeAllowedVisibility(value: unknown, fallback: VideoOrchestratorPlatformVisibilityMode): VideoOrchestratorPlatformVisibilityMode[] {
  const raw = Array.isArray(value) ? value : [fallback];
  const values = raw.map((item) => normalizeVisibility(item, fallback));
  return Array.from(new Set(values.length ? values : [fallback]));
}

function safeUrl(value: unknown): string | null {
  const text = safeText(value, "");
  if (!text) return null;
  return /^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(text) ? text : null;
}

function nextAction(adapter: Pick<SafeVideoOrchestratorPlatformAdapter, "status" | "mode" | "platform" | "supports_scheduled_publish" | "supports_resume">): string {
  if (adapter.status === "supported") return adapter.supports_scheduled_publish && adapter.supports_resume ? "Ready for future runtime adapter implementation review." : "Add scheduling/resume policy before runtime implementation.";
  if (adapter.status === "partial") return "Complete policy, auth, scheduling, and resume boundaries before runtime implementation.";
  if (adapter.status === "manual_only") return "Use manual export packages until an authorized adapter is approved.";
  if (adapter.status === "blocked") return "Keep blocked until platform policy and credential boundaries are reviewed.";
  if (adapter.mode === "disabled") return "Select an adapter mode before implementation.";
  return "Review platform policy and adapter capability boundaries.";
}

export function normalizeVideoOrchestratorPlatformAdapter(input: VideoOrchestratorPlatformAdapterInput): SafeVideoOrchestratorPlatformAdapter {
  const platform = normalizePlatform(input.platform);
  const mode = normalizeMode(input.mode);
  const status = normalizeStatus(input.status, mode);
  const defaultVisibility = normalizeVisibility(input.default_visibility, platform === "youtube" ? "private" : "scheduled");
  const adapter: SafeVideoOrchestratorPlatformAdapter = {
    adapter_id: safeSlug(input.adapter_id, `${platform}-${mode}-adapter`),
    platform,
    display_name: safeText(input.display_name, `${platform} ${mode} adapter`),
    mode,
    status,
    supports_scheduled_publish: Boolean(input.supports_scheduled_publish ?? false),
    default_visibility: defaultVisibility,
    allowed_visibility: normalizeAllowedVisibility(input.allowed_visibility, defaultVisibility),
    supports_multi_account: Boolean(input.supports_multi_account ?? false),
    supports_resume: Boolean(input.supports_resume ?? false),
    supports_delete: Boolean(input.supports_delete ?? false),
    supports_metadata_update: Boolean(input.supports_metadata_update ?? false),
    upload_enabled: false,
    network_enabled: false,
    credential_access_enabled: false,
    media_read_enabled: false,
    api_base_url: safeUrl(input.api_base_url),
    setup_url: safeUrl(input.setup_url),
    notes: input.notes ? safeText(input.notes, "") : null,
    next_action: "",
  };
  return { ...adapter, next_action: nextAction(adapter) };
}

export function createVideoOrchestratorPlatformAdapterRegistry(inputs: VideoOrchestratorPlatformAdapterInput[]): VideoOrchestratorPlatformAdapterRegistry {
  const adapters = inputs.map(normalizeVideoOrchestratorPlatformAdapter);
  return {
    schema_version: "1.0",
    adapters,
    summary: {
      adapter_count: adapters.length,
      platform_count: new Set(adapters.map((adapter) => adapter.platform)).size,
      supported_count: adapters.filter((adapter) => adapter.status === "supported").length,
      partial_count: adapters.filter((adapter) => adapter.status === "partial").length,
      manual_only_count: adapters.filter((adapter) => adapter.status === "manual_only").length,
      blocked_count: adapters.filter((adapter) => adapter.status === "blocked").length,
      disabled_count: adapters.filter((adapter) => adapter.status === "disabled").length,
      scheduled_publish_count: adapters.filter((adapter) => adapter.supports_scheduled_publish).length,
      resume_capable_count: adapters.filter((adapter) => adapter.supports_resume).length,
    },
    safety: { contract_only: true, upload_executed: false, network_calls_made: false, credential_accessed: false, media_read_performed: false, runtime_wiring_applied: false, files_written: false },
  };
}
