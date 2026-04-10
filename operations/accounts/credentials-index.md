# Credentials Index

Master map of all API keys, tokens, and credentials used across the brain infrastructure.

**Rules:**
- No actual values are stored here — this is a lookup guide only.
- Actual values live in the `File` column paths, typically under `~/.config/`.
- Run `sync-credentials` to scan `~/.config/` for new `.env` files and append untracked entries to the Pending section below.
- When a new entry lands in Pending, move it to the right section and fill in Purpose, Rotation, and Regenerate.

Last synced: 2026-04-10

---

## Azure — PROCHAT-APPS

Subscription `1db6646e-69c0-4ee0-a4d5-53d40421a5a4` · Tenant `afab256a-cbf5-4aab-a7d1-f271bda38123` · Identity `steve@yeshuaacademypt.onmicrosoft.com`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `AZURE_CLIENT_ID` | `~/.config/azure-ai/credentials/apps-provisioner.env` | Service principal app ID — provisioner role | Static unless rotated manually | [App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps) |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-ai/credentials/apps-provisioner.env` | Service principal secret — provisioner role | Check expiry in Azure portal | App registration → Certificates & secrets |
| `AZURE_TENANT_ID` | `~/.config/azure-ai/credentials/apps-provisioner.env` | Tenant ID (yeshuaacademypt) | Static | Azure AD → Overview |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-ai/credentials/apps-provisioner.env` | Subscription ID — PROCHAT-APPS | Static | Azure Portal → Subscriptions |
| `AZURE_CLIENT_ID` | `~/.config/azure-ai/credentials/apps-destroyer.env` | Service principal app ID — destroyer role | Static unless rotated manually | Same as above |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-ai/credentials/apps-destroyer.env` | Service principal secret — destroyer role | Check expiry in Azure portal | Same as above |
| `AZURE_TENANT_ID` | `~/.config/azure-ai/credentials/apps-destroyer.env` | Tenant ID (yeshuaacademypt) | Static | Azure AD → Overview |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-ai/credentials/apps-destroyer.env` | Subscription ID — PROCHAT-APPS | Static | Azure Portal → Subscriptions |

## Azure — PROCHAT-DATA

Subscription `6e99b82d-43e3-41cc-ad94-8733afeb2a7e` · Tenant `290d8a41-0cbc-450b-9263-f018dc28165d` · Identity `admin@yeshuaacademy.onmicrosoft.com`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `AZURE_CLIENT_ID` | `~/.config/azure-ai/credentials/data-provisioner.env` | Service principal app ID — provisioner role | Static unless rotated manually | [App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps) |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-ai/credentials/data-provisioner.env` | Service principal secret — provisioner role | Check expiry in Azure portal | App registration → Certificates & secrets |
| `AZURE_TENANT_ID` | `~/.config/azure-ai/credentials/data-provisioner.env` | Tenant ID (yeshuaacademy) | Static | Azure AD → Overview |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-ai/credentials/data-provisioner.env` | Subscription ID — PROCHAT-DATA | Static | Azure Portal → Subscriptions |
| `AZURE_CLIENT_ID` | `~/.config/azure-ai/credentials/data-destroyer.env` | Service principal app ID — destroyer role | Static unless rotated manually | Same as above |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-ai/credentials/data-destroyer.env` | Service principal secret — destroyer role | Check expiry in Azure portal | Same as above |
| `AZURE_TENANT_ID` | `~/.config/azure-ai/credentials/data-destroyer.env` | Tenant ID (yeshuaacademy) | Static | Azure AD → Overview |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-ai/credentials/data-destroyer.env` | Subscription ID — PROCHAT-DATA | Static | Azure Portal → Subscriptions |

## Cloudflare — prochat

Account for `prochat.tools` and related domains.

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `CLOUDFLARE_PROFILE_NAME` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | CLI profile name (config, not secret) | Static | — |
| `CLOUDFLARE_ACCOUNT_ID` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | Cloudflare account ID (config, not secret) | Static | [Cloudflare dash → right sidebar](https://dash.cloudflare.com) |
| `CLOUDFLARE_ACCOUNT_NAME` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | Account display name (config) | Static | — |
| `CLOUDFLARE_DEFAULT_ZONE_NAME` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | Default zone (config) | Static | — |
| `CLOUDFLARE_EMAIL` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | Account email (config) | Static | — |
| `CLOUDFLARE_API_TOKEN` | `~/.config/cloudflare-ai/credentials/prochat-provisioner.env` | API token — provisioner role | No automatic expiry; rotate if compromised | [Cloudflare → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_PROFILE_NAME` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | CLI profile name (config, not secret) | Static | — |
| `CLOUDFLARE_ACCOUNT_ID` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | Cloudflare account ID (config) | Static | — |
| `CLOUDFLARE_ACCOUNT_NAME` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | Account display name (config) | Static | — |
| `CLOUDFLARE_DEFAULT_ZONE_NAME` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | Default zone (config) | Static | — |
| `CLOUDFLARE_EMAIL` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | Account email (config) | Static | — |
| `CLOUDFLARE_API_TOKEN` | `~/.config/cloudflare-ai/credentials/prochat-destroyer.env` | API token — destroyer role | No automatic expiry; rotate if compromised | [Cloudflare → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) |

## Umami

Self-hosted on Dokploy (Ops project). UI: `https://umami.prochat.tools` · Version: 3.0.3

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `UMAMI_URL` | `~/.config/umami/.env` | Base URL of the Umami instance (config, not secret) | Static | — |
| `UMAMI_USERNAME` | `~/.config/umami/.env` | Admin username for login and API auth | No automatic expiry; change via Settings → Profile | `https://umami.prochat.tools/settings/profile` |
| `UMAMI_PASSWORD` | `~/.config/umami/.env` | Admin password for login and API auth | No automatic expiry; change via Settings → Profile | `https://umami.prochat.tools/settings/profile` |
| `UMAMI_WEBSITE_ID_PROCHAT` | `~/.config/umami/.env` | Tracking ID for prochat.tools | Static unless site is deleted and recreated | Umami UI → Websites |
| `UMAMI_WEBSITE_ID_STB` | `~/.config/umami/.env` | Tracking ID for saysthe.bible | Static unless site is deleted and recreated | Umami UI → Websites |
| `UMAMI_WEBSITE_ID_PROOFLY` | `~/.config/umami/.env` | Tracking ID for proofly.io | Static unless site is deleted and recreated | Umami UI → Websites |
| `UMAMI_WEBSITE_ID_YESHUA_ACADEMY` | `~/.config/umami/.env` | Tracking ID for yeshua.academy | Static unless site is deleted and recreated | Umami UI → Websites |

Note: Self-hosted Umami v3 has no API key feature. Programmatic access uses `POST /api/auth/login` → Bearer token → `Authorization: Bearer <token>`.

## Dokploy

Self-hosted on Azure VM `vm-dokploy`. UI: `https://dokploy.prochat.tools`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `DOKPLOY_API_KEY` | `~/.config/dokploy/.env` | API key for Dokploy management API | No automatic expiry; rotate if compromised | [Dokploy → Settings → API](https://dokploy.prochat.tools/dashboard/settings) |
| `DOKPLOY_URL` | `~/.config/dokploy/.env` | Base URL of the Dokploy instance (config, not secret) | Static | — |

## Google Workspace (GWS)

Service account project: `brain-workspace-admin` · SA email: `brain-workspace-admin-sa@brain-workspace-admin.iam.gserviceaccount.com`

These are JSON files, not `.env` — not auto-detected by `sync-credentials`. Tracked manually.

| Credential | File | Purpose | Rotation | Regenerate |
|------------|------|---------|----------|-----------|
| Service account JSON key | `~/.config/gws/service-account.json` | Domain-wide delegation for GWS admin operations (email, calendar, Drive, users) | No automatic expiry; rotate if compromised or if SA key is revoked | [GCP → IAM → Service Accounts → brain-workspace-admin-sa → Keys](https://console.cloud.google.com/iam-admin/serviceaccounts?project=brain-workspace-admin) |
| OAuth client secret | `~/.config/gws/client_secret.json` | OAuth 2.0 installed-app client for user-delegated access | Static unless app is deleted | [GCP → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=brain-workspace-admin) |
| Token cache | `~/.config/gws/token_cache.json` | Auto-refreshed OAuth access/refresh token (auto-generated) | Auto-refreshes; delete and re-auth if stale | Run `gws` CLI to re-authenticate |

## Google AI Studio

Personal Google account (`stevewesthoek` / prochat.tools identity). Free tier — 1,500 requests/day, 15 req/min on Gemini 2.0 Flash.

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `GEMINI_API_KEY` | `~/.config/google-ai/.env` | Gemini API key for AI Studio — used by n8n for PARA classification in Brain Inbox workflow | No automatic expiry; rotate if compromised | [AI Studio → Get API key](https://aistudio.google.com/apikey) |

Note: This is separate from the Gemini CLI (`~/.gemini/`) which uses OAuth personal auth. The CLI and API key have independent quota pools.

## HuggingFace

Personal account for model downloads (mlx_whisper, etc.).

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| HF token | `~/.cache/huggingface/token` | Read-only access token for downloading models (e.g. `mlx-community/whisper-large-v3`) | No automatic expiry; rotate if compromised | [HuggingFace → Settings → Access Tokens](https://huggingface.co/settings/tokens) |

Note: Written by `huggingface-cli login` or directly. Picked up automatically by `transformers`, `huggingface_hub`, and `mlx_whisper`.

## GitHub

Personal account: `stevewesthoek`

| Token Name | Storage | Purpose | Expiry | Rotation | Regenerate |
|------------|---------|---------|--------|----------|-----------|
| `n8n-github-brain` | `~/.config/github/.env` | Fine-grained PAT — brain repo only (Contents: read + write) · Used by n8n workflows | No expiration | Manually rotate if compromised | [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens?type=beta) |
| SaaSKit Customer Access | GitHub only (no local storage) | Organization-scoped PAT for SaaSKit repos · Last used within 2 months | Wed, Feb 10 2027 | Rotate before Feb 10 2027 via GitHub UI | [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens?type=beta) |
| ProKit Customer Access | GitHub only (no local storage) | Organization-scoped PAT for ProKit repos · Last used within 2 months | Wed, Feb 10 2027 | Rotate before Feb 10 2027 via GitHub UI | [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens?type=beta) |

**Note:** SaaSKit and ProKit tokens are managed only in GitHub — not stored locally in `.config/`. They're organization-scoped tokens. If these need to be used programmatically in workflows, store them in environment variables when needed.

## Hetzner Cloud

Project hosting the `cloudpanel` server.

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `HCLOUD_TOKEN` | `~/.config/hetzner/.env` | Hetzner Cloud API token for `hcloud` CLI | No automatic expiry; rotate if compromised | [Hetzner Cloud Console → Project → Security → API Tokens](https://console.hetzner.cloud) |

## n8n

Self-hosted on Dokploy. App: `https://n8n.prochat.tools`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `N8N_API_KEY` | `~/.config/n8n/.env` | n8n Public API key for workflow and credential management | No automatic expiry; rotate via n8n settings | [n8n → Settings → API](https://n8n.prochat.tools/settings/api) |
| `N8N_API_URL` | `~/.config/n8n/.env` | Base URL for n8n API (config, not secret) | Static | — |
| `N8N_WEBHOOK_URL` | `~/.config/n8n/.env` | Webhook base URL (config, not secret) | Static | — |

## New Relic

EU region. Account and runbook: `operations/runbooks/newrelic.md`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `NEW_RELIC_ACCOUNT_ID` | `~/.config/newrelic/.env` | Account ID (config, not secret) | Static | [New Relic EU → Account settings](https://one.eu.newrelic.com/admin-portal/organizations/users-and-roles) |
| `NEW_RELIC_LICENSE_KEY` | `~/.config/newrelic/.env` | Ingest license key — used by agents to send data | No automatic expiry; rotate if compromised | [New Relic EU → API keys](https://one.eu.newrelic.com/api-keys) |
| `NEW_RELIC_USER_API_KEY` | `~/.config/newrelic/.env` | User API key — used for querying NerdGraph and REST API | No automatic expiry; rotate if compromised | [New Relic EU → API keys](https://one.eu.newrelic.com/api-keys) |
| `NEW_RELIC_REGION` | `~/.config/newrelic/.env` | Region flag: `EU` (config, not secret) | Static | — |

## ProBot

Local daemon on `Office` Mac mini. Config: `~/.config/probot/.env`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | `~/.config/probot/.env` | Telegram bot token for ProBot Telegram interface | No automatic expiry; revoke/reissue via BotFather | [Telegram BotFather → /mybots → select bot → API Token](https://t.me/botfather) |
| `SLACK_BOT_TOKEN` | `~/.config/probot/.env` | Slack bot OAuth token (`xoxb-...`) | No automatic expiry; rotate via Slack app settings | [Slack API → Your Apps → ProBot → OAuth & Permissions](https://api.slack.com/apps) |
| `SLACK_APP_TOKEN` | `~/.config/probot/.env` | Slack app-level token for Socket Mode (`xapp-...`) | No automatic expiry; rotate via Slack app settings | [Slack API → Your Apps → ProBot → Basic Information → App-Level Tokens](https://api.slack.com/apps) |

Config values in the same file (not secrets — listed so `sync-credentials` does not flag them as untracked):

| Variable | File | Purpose |
|----------|------|---------|
| `TELEGRAM_ALLOWED_USER_IDS` | `~/.config/probot/.env` | Comma-separated Telegram user IDs allowed to interact with the bot |
| `SLACK_ALLOWED_USER_IDS` | `~/.config/probot/.env` | Comma-separated Slack user IDs allowed to interact with the bot |
| `PROBOT_BRAIN_ROOT` | `~/.config/probot/.env` | Path to brain repo root |
| `PROBOT_DATA_DIR` | `~/.config/probot/.env` | Path to ProBot SQLite data directory |
| `PROBOT_NOTES_DIR` | `~/.config/probot/.env` | Path to notes/Obsidian vault |
| `PROBOT_ALLOWED_ROOTS` | `~/.config/probot/.env` | Colon-separated list of allowed filesystem roots |
| `PROBOT_MAX_FILE_MB` | `~/.config/probot/.env` | Max file size for ProBot file ops |
| `PROBOT_DEBUG` | `~/.config/probot/.env` | Debug flag |
| `PROBOT_DASHBOARD_PORT` | `~/.config/probot/.env` | Dashboard HTTP port |
| `PROBOT_DASHBOARD_URL` | `~/.config/probot/.env` | Dashboard public URL |
| `PROBOT_REPO_ALIASES` | `~/.config/probot/.env` | Repo path aliases map |
| `CLAUDE_PROJECTS_DIR` | `~/.config/probot/.env` | Path to Claude Code projects directory |
| `CODEX_SESSIONS_DIR` | `~/.config/probot/.env` | Path to Codex sessions directory |
| `CODEX_SESSION_INDEX` | `~/.config/probot/.env` | Path to Codex session index file |
| `NEW_RELIC_USER_API_KEY` | `~/.config/probot/.env` | Cross-ref — same key as in New Relic section; canonical file is `~/.config/newrelic/.env` |
| `NEW_RELIC_ACCOUNT_ID` | `~/.config/probot/.env` | Cross-ref — same value as in New Relic section; canonical file is `~/.config/newrelic/.env` |

## Stripe

CLI auth via browser OAuth — no persistent API key file. Account IDs stored in `~/.config/stripe/config.toml`.

| Account | Account ID | Profile | Notes |
|---------|-----------|---------|-------|
| Says the Bible (live) | `acct_1T5EojLzAX9y8uTj` | `default` | Primary live Stripe account |
| Says the Bible (sandbox) | `acct_1T5EoqL7t8amqhMU` | `says the bible sandbox` | Sandbox/test account |

Re-authenticate: `stripe login` (opens browser). Switch profiles: `stripe login --profile "says the bible sandbox"`.

## Tailscale

Tailnet for this infrastructure. Admin: `https://login.tailscale.com/admin`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `TAILSCALE_API_KEY` | `~/.config/tailscale/.env` | Tailscale API key for device management (remove nodes, rename, etc.) | API keys expire — check expiry in admin console | [Tailscale → Settings → Keys](https://login.tailscale.com/admin/settings/keys) |

---

## ⚠️ Pending — needs metadata

Entries detected by `sync-credentials` that are not yet categorized. Move each row to the right section above and fill in Purpose, Rotation, and Regenerate.

| Variable | File | Detected |
|----------|------|---------|
| `TELEGRAM_ALLOWED_USER_IDS` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_BRAIN_ROOT` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_DATA_DIR` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_NOTES_DIR` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_ALLOWED_ROOTS` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_MAX_FILE_MB` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_DEBUG` | `~/.config/probot/.env` | 2026-04-07 |
| `CLAUDE_PROJECTS_DIR` | `~/.config/probot/.env` | 2026-04-07 |
| `CODEX_SESSIONS_DIR` | `~/.config/probot/.env` | 2026-04-07 |
| `CODEX_SESSION_INDEX` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_DASHBOARD_PORT` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_DASHBOARD_URL` | `~/.config/probot/.env` | 2026-04-07 |
| `SLACK_ALLOWED_USER_IDS` | `~/.config/probot/.env` | 2026-04-07 |
| `PROBOT_REPO_ALIASES` | `~/.config/probot/.env` | 2026-04-07 |
| `NEW_RELIC_USER_API_KEY` | `~/.config/probot/.env` | 2026-04-07 |
| `NEW_RELIC_ACCOUNT_ID` | `~/.config/probot/.env` | 2026-04-07 |
| `UMAMI_URL` | `~/.config/probot/.env` | 2026-04-08 |
| `UMAMI_USERNAME` | `~/.config/probot/.env` | 2026-04-08 |
| `UMAMI_PASSWORD` | `~/.config/probot/.env` | 2026-04-08 |
| `CLOUDFLARE_API_TOKEN` | `~/.config/probot/.env` | 2026-04-09 |
| `ING_USERNAME` | `~/.config/ing/.env` | 2026-04-10 |
| `ING_PASSWORD` | `~/.config/ing/.env` | 2026-04-10 |
| `ING_NTFY_TOPIC` | `~/.config/ing/.env` | 2026-04-10 |
| `GITHUB_PAT` | `~/.config/github/.env` | 2026-04-11 |
