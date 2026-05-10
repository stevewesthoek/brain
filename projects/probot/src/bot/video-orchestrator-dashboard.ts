// Video Orchestrator dashboard rendering and normalization helpers.
// This module intentionally avoids HTTP route registration and app context wiring.
// Most helpers are pure render/normalization utilities; runtime path helpers are kept here
// for shared dashboard/test use and are the only filesystem-touching functions.

import fs from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

export type YouTubeLifecycleSummary = {
  latest: {
    video_id: string | null;
    platform: string;
    package_target: string | null;
    youtube_video_id: string | null;
    lifecycle_state: string;
    privacy_status: string;
    upload_event_at: string | null;
    last_checked_at: string | null;
    status_check_pending: boolean;
    manual_fallback_available: boolean;
    last_warning: string | null;
    last_error: string | null;
  } | null;
  counts: {
    uploaded: number;
    processing: number;
    available_private: number;
    failed: number;
    unknown: number;
  };
  message?: string;
};

export type RawYouTubeLifecycleSummary = {
  latest?: Record<string, unknown> | null;
  counts?: Partial<YouTubeLifecycleSummary["counts"]>;
  message?: unknown;
};

export type AccountHealthStatus = {
  checked_at?: string | null;
  summary?: {
    green?: number;
    yellow?: number;
    red?: number;
    grey?: number;
  };
  accounts?: Array<{
    account_id: string | null;
    platform: string | null;
    account_label: string | null;
    display_name: string | null;
    enabled: boolean;
    auth_mode: string | null;
    status: string;
    capabilities?: {
      upload?: boolean;
      status_check?: boolean;
      refresh_token?: boolean;
      analytics?: boolean;
      manual_fallback?: boolean;
    };
    default_privacy?: string | null;
    allowed_privacy?: string[];
    manual_fallback?: boolean;
    notification_state?: string | null;
    last_checked_at?: string | null;
    next_action?: string | null;
    warnings?: string[];
  }>;
  message?: string;
};

export type RawAccountHealthSnapshot = {
  version?: string;
  checked_at?: unknown;
  summary?: AccountHealthStatus["summary"];
  accounts?: Array<Record<string, unknown>>;
  message?: unknown;
};

export type LocalAccountCapabilitySnapshot = {
  upload?: boolean;
  status_check?: boolean;
  refresh_supported?: boolean;
  analytics?: boolean;
  manual_fallback?: boolean;
};

export type LocalAccountRegistryEntry = {
  account_id: string;
  platform: string;
  account_label: string;
  display_name: string;
  enabled: boolean;
  auth_mode: string;
  credential_reference?: string;
  capabilities: LocalAccountCapabilitySnapshot;
  default_privacy: string;
  allowed_privacy: string[];
  health_check?: {
    enabled?: boolean;
    frequency?: string;
    warn_before_expiry_days?: number;
    keep_warm?: boolean;
  };
  notification_policy?: {
    on_red?: boolean;
    on_yellow?: boolean;
    channel?: string;
  };
  notes?: string;
};

export type LocalAccountRegistry = {
  schema_version: "1.0";
  accounts: LocalAccountRegistryEntry[];
};

export type SafeDashboardAccount = {
  account_id: string;
  platform: string;
  account_label: string;
  display_name: string;
  enabled: boolean;
  auth_mode: string;
  status: string;
  capabilities: {
    upload: boolean;
    status_check: boolean;
    refresh_supported: boolean;
    analytics: boolean;
    manual_fallback: boolean;
  };
  default_privacy: string;
  allowed_privacy: string[];
  manual_fallback: boolean;
  notification_state: string;
  last_checked_at: string | null;
  next_action: string | null;
  warnings: string[];
};

export type OAuthClientConfig = {
  client_id: string | null;
  configured: boolean;
  oauth_client_mode: "pkce_public_client" | "client_secret_keychain";
  client_secret_configured: boolean;
};

export type OAuthStateRecord = {
  state: string;
  code_verifier: string;
  account_id: string;
  account_label: string;
  display_name: string;
  credential_reference: string;
  client_id: string;
  redirect_uri: string;
  created_at: string;
  expires_at: string;
};

// ─── Pure utility functions ─────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function redactVideoOrchestratorText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value)
    .replace(/\b(access_token|refresh_token|client_secret|authorization_code)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\bcredentialReference\s*[:=]\s*[^\s,;]+/gi, 'credential_reference=[REDACTED]')
    .replace(/\bcredential[_-]?ref(?:erence)?\s*[:=]\s*[^\s,;]+/gi, 'credential_reference=[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/keychain:\/\/video-orchestrator\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+/gi, 'keychain://video-orchestrator/[REDACTED]/[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bsk-[0-9A-Za-z_-]{10,}\b/g, 'sk-[REDACTED]')
    .replace(/\bsk_live_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bghp_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bgithub_pat_[0-9A-Za-z_-]{10,}\b/g, '[REDACTED]')
    .replace(/\bxoxb-[0-9A-Za-z-]{10,}\b/g, '[REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{12,}\b/g, '[REDACTED]');
}

function redactAccountHealthText(value: unknown): string | null {
  const redacted = redactVideoOrchestratorText(value);
  if (!redacted) return null;
  return redacted
    .replace(/\bcredential[_-]?reference\b\s*[:=]\s*\[REDACTED\]/gi, '[REDACTED_REFERENCE]')
    .replace(/\bcredential[_-]?reference\b\s*[:=]\s*[^\s"'`]+/gi, '[REDACTED_REFERENCE]')
    .replace(/keychain:\/\/video-orchestrator\/\[REDACTED\]\/\[REDACTED\]/gi, '[REDACTED_REFERENCE]');
}

// ─── Normalization functions ────────────────────────────────────────────────

export function normalizeYouTubeLifecycleSummary(raw: RawYouTubeLifecycleSummary | null | undefined): YouTubeLifecycleSummary {
  const latestRaw = raw?.latest ?? null;
  const latest = latestRaw && typeof latestRaw === "object"
    ? {
        video_id: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).video_id),
        platform: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).platform) ?? "youtube",
        package_target: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).package_target),
        youtube_video_id: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).youtube_video_id),
        lifecycle_state: String((latestRaw as Record<string, unknown>).lifecycle_state ?? "unknown"),
        privacy_status: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).privacy_status) ?? "private",
        upload_event_at: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).upload_event_at),
        last_checked_at: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).last_checked_at),
        status_check_pending: Boolean((latestRaw as Record<string, unknown>).status_check_pending),
        manual_fallback_available: Boolean((latestRaw as Record<string, unknown>).manual_fallback_available ?? true),
        last_warning: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).last_warning),
        last_error: redactVideoOrchestratorText((latestRaw as Record<string, unknown>).last_error),
      }
    : null;

  const normalized: YouTubeLifecycleSummary = {
    latest,
    counts: {
      uploaded: Number(raw?.counts?.uploaded ?? 0),
      processing: Number(raw?.counts?.processing ?? 0),
      available_private: Number(raw?.counts?.available_private ?? 0),
      failed: Number(raw?.counts?.failed ?? 0),
      unknown: Number(raw?.counts?.unknown ?? 0),
    },
  };
  if (typeof raw?.message === "string") {
    const message = redactVideoOrchestratorText(raw.message);
    if (message) normalized.message = message;
  }
  return normalized;
}

export function normalizeAccountHealthSnapshot(raw: RawAccountHealthSnapshot | null | undefined): AccountHealthStatus {
  const accounts = Array.isArray(raw?.accounts) ? raw.accounts.map((account): NonNullable<AccountHealthStatus["accounts"]>[number] => {
    const normalized: NonNullable<AccountHealthStatus["accounts"]>[number] = {
      account_id: redactVideoOrchestratorText(account.account_id),
      platform: redactVideoOrchestratorText(account.platform),
      account_label: redactVideoOrchestratorText(account.account_label),
      display_name: redactVideoOrchestratorText(account.display_name),
      enabled: Boolean(account.enabled),
      auth_mode: redactVideoOrchestratorText(account.auth_mode),
      status: String(account.status ?? 'grey'),
      manual_fallback: Boolean(account.manual_fallback),
      notification_state: redactAccountHealthText(account.notification_state),
      last_checked_at: redactAccountHealthText(account.last_checked_at),
      next_action: redactAccountHealthText(account.next_action),
      warnings: Array.isArray(account.warnings) ? account.warnings.map((value) => redactAccountHealthText(value)).filter((value): value is string => Boolean(value)) : [],
    };
    if (account.capabilities && typeof account.capabilities === 'object') {
      normalized.capabilities = {
        upload: Boolean((account.capabilities as Record<string, unknown>).upload),
        status_check: Boolean((account.capabilities as Record<string, unknown>).status_check),
        refresh_token: Boolean((account.capabilities as Record<string, unknown>).refresh_supported ?? (account.capabilities as Record<string, unknown>).refresh_token),
        analytics: Boolean((account.capabilities as Record<string, unknown>).analytics),
        manual_fallback: Boolean((account.capabilities as Record<string, unknown>).manual_fallback),
      };
    }
    const defaultPrivacy = redactAccountHealthText(account.default_privacy);
    if (defaultPrivacy) normalized.default_privacy = defaultPrivacy;
    if (Array.isArray(account.allowed_privacy)) {
      normalized.allowed_privacy = account.allowed_privacy.map((value) => redactAccountHealthText(value) ?? 'private');
    }
    return normalized;
  }) : [];

  const normalized: AccountHealthStatus = {
    checked_at: redactVideoOrchestratorText(raw?.checked_at),
    summary: {
      green: Number(raw?.summary?.green ?? 0),
      yellow: Number(raw?.summary?.yellow ?? 0),
      red: Number(raw?.summary?.red ?? 0),
      grey: Number(raw?.summary?.grey ?? 0),
    },
    accounts,
  };
  if (typeof raw?.message === 'string') {
    const message = redactVideoOrchestratorText(raw.message);
    if (message) normalized.message = message;
  }
  return normalized;
}

export function normalizeYoutubeOAuthClientConfig(raw: { client_id?: unknown; oauth_client_mode?: unknown; client_secret_configured?: unknown } | null | undefined): OAuthClientConfig {
  const client_id = raw && typeof raw.client_id === 'string' && raw.client_id.trim() ? raw.client_id.trim() : null;
  const oauth_client_mode = raw?.oauth_client_mode === 'client_secret_keychain' ? 'client_secret_keychain' : 'pkce_public_client';
  return {
    client_id,
    configured: Boolean(client_id),
    oauth_client_mode,
    client_secret_configured: Boolean(raw?.client_secret_configured),
  };
}

export function buildSafeAccountForDashboard(account: LocalAccountRegistryEntry, health: SafeDashboardAccount | null = null): SafeDashboardAccount {
  const capabilitySource = account.capabilities ?? {};
  return {
    account_id: account.account_id,
    platform: account.platform,
    account_label: account.account_label,
    display_name: account.display_name,
    enabled: Boolean(account.enabled),
    auth_mode: account.auth_mode,
    status: health?.status ?? (account.enabled ? 'yellow' : 'grey'),
    capabilities: {
      upload: Boolean(capabilitySource.upload),
      status_check: Boolean(capabilitySource.status_check),
      refresh_supported: Boolean(capabilitySource.refresh_supported ?? (capabilitySource as any).refresh_token),
      analytics: Boolean(capabilitySource.analytics),
      manual_fallback: Boolean(capabilitySource.manual_fallback),
    },
    default_privacy: account.default_privacy,
    allowed_privacy: Array.isArray(account.allowed_privacy) ? [...account.allowed_privacy] : [],
    manual_fallback: Boolean(capabilitySource.manual_fallback),
    notification_state: account.notification_policy?.channel ?? 'dashboard',
    last_checked_at: health?.last_checked_at ?? null,
    next_action: health?.next_action ?? null,
    warnings: health?.warnings ?? [],
  };
}

export function sanitizeSafeAccountInput(payload: Record<string, unknown>): { ok: true; value: { platform: 'youtube'; account_id: string; account_label: string; display_name: string; enabled: boolean } } | { ok: false; error: string } {
  if (containsForbiddenAccountPayload(payload)) return { ok: false, error: 'Request contains forbidden credential-like fields.' };
  const platform = String(payload.platform ?? '');
  const accountId = String(payload.account_id ?? '');
  const accountLabel = String(payload.account_label ?? '');
  const displayName = String(payload.display_name ?? '');
  const enabled = Boolean(payload.enabled);
  if (platform !== 'youtube') return { ok: false, error: 'Platform must be youtube for this flow.' };
  if (!isSafeDashboardSlug(accountId)) return { ok: false, error: 'account_id must be a safe slug.' };
  if (!isSafeDashboardSlug(accountLabel)) return { ok: false, error: 'account_label must be a safe slug.' };
  if (!displayName.trim() || containsForbiddenAccountPayload(displayName)) return { ok: false, error: 'display_name must be non-empty and non-secret-like.' };
  return { ok: true, value: { platform: 'youtube', account_id: accountId, account_label: accountLabel, display_name: displayName.trim(), enabled } };
}

// ─── Rendering functions ────────────────────────────────────────────────────

export function renderYouTubeLifecycleSummary(youtubeLifecycle: YouTubeLifecycleSummary | null | undefined): string {
  let html='<div style="grid-column:1/-1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px">';
  html+='<h3 style="margin:0 0 12px 0;font-size:0.95em;color:var(--text);font-weight:600">YouTube Upload Lifecycle</h3>';
  html+='<div style="font-size:0.85em;line-height:1.7">';
  if(youtubeLifecycle&&youtubeLifecycle.latest){
    const latest=youtubeLifecycle.latest;
    const counts=youtubeLifecycle.counts||{uploaded:0,processing:0,available_private:0,failed:0,unknown:0};
    html+='<div style="padding:8px;margin-bottom:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Latest state:</span> <strong>'+escapeHtml(String(latest.lifecycle_state||'unknown'))+'</strong></div>';
    html+='<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">YouTube Video ID:</span> <strong>'+escapeHtml(String(latest.youtube_video_id||'—'))+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Privacy:</span> <strong>'+escapeHtml(String(latest.privacy_status||'private'))+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Upload event:</span> <strong>'+escapeHtml(String(latest.upload_event_at||'—'))+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Last checked:</span> <strong>'+escapeHtml(String(latest.last_checked_at||'—'))+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Manual fallback:</span> <strong>'+String(latest.manual_fallback_available ? 'available' : 'disabled')+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">Status check pending:</span> <strong>'+String(latest.status_check_pending ? 'yes' : 'no')+'</strong></div>';
    html+='</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:8px">';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">uploaded</span> <strong>'+String(counts.uploaded||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">processing</span> <strong>'+String(counts.processing||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">available_private</span> <strong>'+String(counts.available_private||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">failed</span> <strong>'+String(counts.failed||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">unknown</span> <strong>'+String(counts.unknown||0)+'</strong></div>';
    html+='</div>';
    if(latest.last_warning||latest.last_error){
      html+='<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)">';
      if(latest.last_warning) html+='<div><span style="color:var(--muted)">Last warning:</span> '+escapeHtml(String(latest.last_warning))+'</div>';
      if(latest.last_error) html+='<div><span style="color:var(--muted)">Last error:</span> '+escapeHtml(String(latest.last_error))+'</div>';
      html+='</div>';
    }
  }else{
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--muted)">No YouTube lifecycle events yet.</div>';
  }
  html+='<p style="margin:12px 0 0 0;color:var(--muted)">Read-only status. Uploads, OAuth, credentials, and privacy changes are not controlled from this dashboard.</p>';
  html+='</div></div>';
  return html;
}

export function renderAccountHealthPanel(accountHealth: AccountHealthStatus | null | undefined): string {
  let html='<div style="grid-column:1/-1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px">';
  html+='<h3 style="margin:0 0 12px 0;font-size:0.95em;color:var(--text);font-weight:600">Account Health Center</h3>';
  html+='<div style="font-size:0.85em;line-height:1.7">';
  if(accountHealth&&Array.isArray(accountHealth.accounts)&&accountHealth.accounts.length){
    const summary=accountHealth.summary||{green:0,yellow:0,red:0,grey:0};
    html+='<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:8px">';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">green</span> <strong>'+String(summary.green||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">yellow</span> <strong>'+String(summary.yellow||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">red</span> <strong>'+String(summary.red||0)+'</strong></div>';
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)"><span style="color:var(--muted)">grey</span> <strong>'+String(summary.grey||0)+'</strong></div>';
    html+='</div>';
    html+='<div style="display:grid;gap:8px">';
    for(const account of accountHealth.accounts){
      const capabilities = [
        account.capabilities?.upload ? 'upload' : null,
        account.capabilities?.status_check ? 'status_check' : null,
        account.capabilities?.refresh_token ? 'refresh_token' : null,
        account.capabilities?.analytics ? 'analytics' : null,
        account.capabilities?.manual_fallback ? 'manual_fallback' : null,
      ].filter(Boolean).join(', ') || 'none';
      html+='<div style="padding:10px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)">';
      html+='<div style="display:flex;justify-content:space-between;gap:8px"><strong>'+escapeHtml(account.display_name || 'Unknown account')+'</strong><span style="color:var(--muted)">'+escapeHtml(account.status)+'</span></div>';
      html+='<div style="color:var(--muted);margin-top:4px">Platform: '+escapeHtml(account.platform || 'unknown')+' • Auth: '+escapeHtml(account.auth_mode || 'unknown')+'</div>';
      html+='<div style="color:var(--muted)">Label: '+escapeHtml(account.account_label || '—')+' • Manual fallback: '+String(account.manual_fallback ? 'available' : 'disabled')+'</div>';
      html+='<div style="color:var(--muted)">Capabilities: '+escapeHtml(capabilities)+'</div>';
      html+='<div style="color:var(--muted)">Last checked: '+escapeHtml(account.last_checked_at || '—')+' • Next action: '+escapeHtml(account.next_action || '—')+'</div>';
      html+='<div style="color:var(--muted)">Notifications: '+escapeHtml(account.notification_state || 'dashboard')+'</div>';
      html+='</div>';
    }
  }else{
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--muted)">No account registry configured yet.</div>';
  }
  html+='<p style="margin:12px 0 0 0;color:var(--muted)">Read-only account health. Secrets are not displayed here.</p>';
  html+='</div></div>';
  return html;
}

export function renderAccountsAndCredentialsPanel(accounts: SafeDashboardAccount[] | null | undefined, oauthClientConfig: OAuthClientConfig | null | undefined): string {
  const configured = Boolean(oauthClientConfig?.configured);
  const clientMode = oauthClientConfig?.oauth_client_mode ?? 'pkce_public_client';
  const clientSecretConfigured = Boolean(oauthClientConfig?.client_secret_configured);
  let html='<div style="grid-column:1/-1;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px">';
  html+='<h3 style="margin:0 0 12px 0;font-size:0.95em;color:var(--text);font-weight:600">Accounts &amp; Credentials</h3>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">';
  html+='<div style="padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)">OAuth client: <strong>'+ (configured ? 'configured' : 'missing') +'</strong></div>';
  html+='<div style="padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)">Mode: <strong>'+(clientMode === 'pkce_public_client' ? 'PKCE public client' : 'client secret via Keychain')+'</strong></div>';
  html+='<div style="padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--muted)">Client secret: '+(clientSecretConfigured ? 'configured in Keychain' : 'not stored in files')+'</div>';
  html+='<div style="padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--muted)">Dashboard is read-only for uploads and OAuth tokens.</div>';
  html+='</div>';
  html+='<div id="vo-accounts-list" style="display:grid;gap:10px">';
  if(accounts&&accounts.length){
    for(const account of accounts){
      html+='<div class="vo-account-card" data-account-id="'+escapeHtml(account.account_id)+'" style="padding:12px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--text)">';
      html+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">';
      html+='<div><strong>'+escapeHtml(account.display_name)+'</strong><div style="color:var(--muted);margin-top:2px">Platform: '+escapeHtml(account.platform)+' • Auth: '+escapeHtml(account.auth_mode)+'</div></div>';
      html+='<div style="text-align:right"><div style="font-weight:600">'+escapeHtml(account.status)+'</div><div style="color:var(--muted)">Last checked: '+escapeHtml(account.last_checked_at || '—')+'</div></div>';
      html+='</div>';
      html+='<div style="margin-top:8px;color:var(--muted)">Account label: '+escapeHtml(account.account_label || '—')+' • Manual fallback: '+String(account.manual_fallback ? 'available' : 'disabled')+'</div>';
      html+='<div style="margin-top:4px;color:var(--muted)">Capabilities: upload '+String(account.capabilities.upload ? 'yes' : 'no')+' • status '+String(account.capabilities.status_check ? 'yes' : 'no')+' • refresh '+String(account.capabilities.refresh_supported ? 'yes' : 'no')+' • manual fallback '+String(account.capabilities.manual_fallback ? 'yes' : 'no')+'</div>';
      html+='<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
      html+='<button type="button" data-action="refresh-health" data-account-id="'+escapeHtml(account.account_id)+'" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border);background:var(--subtle);color:var(--text);cursor:pointer">Refresh Health</button>';
      if(account.platform === 'youtube'){
        html+='<button type="button" data-action="connect-youtube" data-account-id="'+escapeHtml(account.account_id)+'" style="padding:6px 10px;border-radius:4px;border:1px solid var(--border);background:var(--subtle);color:var(--text);cursor:pointer">Connect YouTube</button>';
      }
      html+='</div>';
      html+='<div style="margin-top:8px;color:var(--muted)">Next action: '+escapeHtml(account.next_action || '—')+'</div>';
      if(account.warnings&&account.warnings.length){
        html+='<ul style="margin:8px 0 0 16px;color:var(--muted)">';
        for(const warning of account.warnings){ html+='<li>'+escapeHtml(warning)+'</li>'; }
        html+='</ul>';
      }
      html+='</div>';
    }
  }else{
    html+='<div style="padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;color:var(--muted)">No account registry configured yet.</div>';
  }
  html+='</div>';
  html+='<div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:4px">';
  html+='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">';
  html+='<h4 style="margin:0;color:var(--text);font-size:0.9em">OAuth Client</h4>';
  html+='<div style="color:var(--muted);font-size:0.8em">'+(configured ? 'configured' : 'missing')+'</div>';
  html+='</div>';
  html+='<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end">';
  html+='<label style="display:grid;gap:4px;color:var(--muted)">Client ID<input name="vo-client-id" autocomplete="off" style="padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--card);color:var(--text)" placeholder="your-client-id.apps.googleusercontent.com"></label>';
  html+='<button type="button" data-action="save-oauth-client" style="padding:8px 12px;border-radius:4px;border:1px solid var(--border);background:var(--subtle);color:var(--text);cursor:pointer">Configure OAuth Client</button>';
  html+='</div>';
  html+='<p style="margin:8px 0 0 0;color:var(--muted)">Phase 4C uses PKCE public-client mode. Only the client ID is stored locally. Client secrets are not stored in files. Tokens stay in macOS Keychain.</p>';
  html+='</div>';
  html+='<div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.05);border-radius:4px">';
  html+='<h4 style="margin:0 0 8px 0;color:var(--text);font-size:0.9em">Add YouTube Account</h4>';
  html+='<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:end">';
  html+='<label style="display:grid;gap:4px;color:var(--muted)">Account ID<input name="vo-account-id" autocomplete="off" style="padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--card);color:var(--text)" placeholder="youtube-main"></label>';
  html+='<label style="display:grid;gap:4px;color:var(--muted)">Account Label<input name="vo-account-label" autocomplete="off" style="padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--card);color:var(--text)" placeholder="main-channel"></label>';
  html+='<label style="display:grid;gap:4px;color:var(--muted)">Display Name<input name="vo-display-name" autocomplete="off" style="padding:8px;border-radius:4px;border:1px solid var(--border);background:var(--card);color:var(--text)" placeholder="Main YouTube Channel"></label>';
  html+='<label style="display:flex;align-items:center;gap:8px;color:var(--muted)"><input type="checkbox" name="vo-enabled"> Enabled</label>';
  html+='</div>';
  html+='<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
  html+='<button type="button" data-action="save-account" style="padding:8px 12px;border-radius:4px;border:1px solid var(--border);background:var(--accent);color:#fff;cursor:pointer">Save Account</button>';
  html+='<button type="button" data-action="connect-youtube" data-form="true" style="padding:8px 12px;border-radius:4px;border:1px solid var(--border);background:var(--subtle);color:var(--text);cursor:pointer">Connect YouTube</button>';
  html+='</div>';
  html+='</div>';
  html+='<p style="margin:12px 0 0 0;color:var(--muted)">No credential references, token values, or Keychain labels are displayed here.</p>';
  html+='</div>';
  return html;
}

export function renderYoutubeOAuthCallbackFailureHtml(error: string): string {
  const redactedError = redactVideoOrchestratorText(String(error)) ?? 'Unknown error';
  const lower = redactedError.toLowerCase();
  const tokenExchangeRejected = lower.includes('client secret') || lower.includes('client_secret') || lower.includes('token endpoint') || lower.includes('invalid_client') || lower.includes('unauthorized_client');
  const message = tokenExchangeRejected
    ? 'YouTube connection failed. Token exchange was rejected. Check OAuth client type, redirect URI, and whether this client requires a client secret.'
    : `OAuth connection failed: ${redactedError}`;
  return `<html><body><p>${escapeHtml(message)}</p></body></html>`;
}

// ─── Path helpers ───────────────────────────────────────────────────────────

export function getDefaultVideoOrchestratorPaths() {
  const VIDEO_ORCHESTRATOR_RUNTIME_DIR = path.resolve(process.cwd(), "runtime/local/video-orchestrator");
  const VIDEO_ORCHESTRATOR_ACCOUNT_REGISTRY_PATH = path.join(VIDEO_ORCHESTRATOR_RUNTIME_DIR, "account-registry.local.json");
  const ACCOUNT_HEALTH_SNAPSHOT_PATH = path.join(VIDEO_ORCHESTRATOR_RUNTIME_DIR, "account-health-snapshot.json");
  const VIDEO_ORCHESTRATOR_OAUTH_CLIENT_CONFIG_PATH = path.join(VIDEO_ORCHESTRATOR_RUNTIME_DIR, "youtube-oauth-client.local.json");
  const VIDEO_ORCHESTRATOR_OAUTH_STATE_DIR = path.join(VIDEO_ORCHESTRATOR_RUNTIME_DIR, "oauth-state");
  const VIDEO_ORCHESTRATOR_ACCOUNT_HEALTH_LOG_PATH = path.join(VIDEO_ORCHESTRATOR_RUNTIME_DIR, "account-health.log");

  return {
    runtimeDir: VIDEO_ORCHESTRATOR_RUNTIME_DIR,
    registryPath: VIDEO_ORCHESTRATOR_ACCOUNT_REGISTRY_PATH,
    snapshotPath: ACCOUNT_HEALTH_SNAPSHOT_PATH,
    oauthClientConfigPath: VIDEO_ORCHESTRATOR_OAUTH_CLIENT_CONFIG_PATH,
    oauthStateDir: VIDEO_ORCHESTRATOR_OAUTH_STATE_DIR,
    accountHealthLogPath: VIDEO_ORCHESTRATOR_ACCOUNT_HEALTH_LOG_PATH,
  };
}

export function ensureVideoOrchestratorRuntimeDir(): void {
  const paths = getDefaultVideoOrchestratorPaths();
  fs.mkdirSync(paths.runtimeDir, { recursive: true });
  fs.mkdirSync(paths.oauthStateDir, { recursive: true });
}

// ─── Internal validation helpers ────────────────────────────────────────────

function isSafeDashboardSlug(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return Boolean(text) && /^[a-z0-9._-]+$/i.test(text) && !text.includes('..') && !/[\\/;\s`"'<>|&$]/.test(text);
}

function containsForbiddenAccountPayload(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    return /(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization[_-]?code|credential[_-]?reference|keychain|api[_-]?key|password|cookie|bearer)/i.test(value) || /keychain:\/\/video-orchestrator\//i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsForbiddenAccountPayload(item));
  if (typeof value === 'object') return Object.entries(value).some(([key, item]) => /(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization[_-]?code|credential[_-]?reference|keychain|api[_-]?key|password|cookie|bearer)/i.test(key) || containsForbiddenAccountPayload(item));
  return false;
}
