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

| Account | Live Account ID | Profile | Test Access | Notes |
|---------|-----------------|---------|-------------|-------|
| ProChat Studio (main) | `acct_1SxE7KDmzmvnZunZ` | `prochat-main` | Same profile has test mode | Main Stripe account authenticated locally via separate CLI profile; intended read-only inventory profile |
| Says the Bible (live) | `acct_1T5EojLzAX9y8uTj` | `default` | Same profile has test mode | Existing live Stripe account wired to the Says the Bible website; do not interrupt |
| Says the Bible (sandbox) | _n/a_ | `says the bible sandbox` | Separate test-only profile | Distinct Stripe sandbox/test account profile with its own test key set |
| Feel Good with Ana | `acct_1NIqSdDns7UgqVkf` | `feel-good-with-ana` | Same profile has test mode | CLI-verified on 2026-04-11; standard account; dashboard timezone `Europe/Rome`; country `IT` |
| JPV Bootcamp | `acct_1Sed9ULQNsjxBhGB` | `jpv-bootcamp` | Same profile has test mode | CLI-verified on 2026-04-11; standard account; default currency `GBP`; dashboard timezone `Europe/London`; country `GB` |
| ProChat (legacy) | `acct_1M5yY0BnBpi6ElVO` | `prochat-legacy` | Same profile has test mode | CLI-verified on 2026-04-11; standard account; company account; dashboard timezone `Europe/Lisbon`; country `NL` |
| Vila Solidária | `acct_1S4gIHGuhwwbZ1l7` | `vila-solidaria` | Same profile has test mode | CLI-verified on 2026-04-11; standard account; non-profit business type; dashboard timezone `Europe/Lisbon`; country `PT` |
| Yeshua Academy | `acct_1FIyIjBfXlZVNl8d` | `yeshua-academy` | Same profile has test mode | CLI-verified on 2026-04-11; standard account; non-profit business type; dashboard timezone `Europe/Lisbon`; country `NL` |

Re-authenticate: `stripe login --project-name prochat-main` (opens browser). Switch profiles: `stripe login --profile "says the bible sandbox"`.

### Stripe inventory notes

- The `prochat-main` CLI profile is the workspace default and resolves to `ProChat Studio`; it is separate from the existing `default` Says the Bible profile.
- `stripe get /v1/accounts -p prochat-main` returned an empty list, so the other dashboard-visible accounts are not exposed as Connect subaccounts through this API credential.
- All authenticated live profiles now also have test-mode API keys in the same Stripe CLI profile.
- In Stripe terms, test mode is usually not a separate sandbox account ID; it is the same account with separate test credentials.
- The one explicit exception in local CLI config is `says the bible sandbox`, which is a distinct test-only profile rather than just the test half of the live account.
- All live dashboard-visible accounts have now been authenticated into dedicated local Stripe CLI profiles on 2026-04-11, and all of those profiles include test access.

## Google Ads — Yeshua Academy (Ad Grants)

Nonprofit account: `Vila Solidária` (592-920-2435) · Manager account: `Yeshua Academy Google Ads Manager` (935-769-8503) · GCP project: `project-d63f458f-8fba-450e-acf`

| Credential | File | Purpose | Rotation | Regenerate |
|------------|------|---------|----------|-----------|
| Developer token | `~/.config/google-ads/brain-google-ads.env` | Google Ads API developer token (Explorer access level) | No automatic expiry; rotate if compromised or access level changed | [Google Ads Manager → API Center](https://ads.google.com/aw/apicenter) under `steve@yeshua.academy` |
| OAuth client JSON | `~/.config/google-ads/yeshua-google-ads-oauth.json` | OAuth 2.0 desktop app credentials from Google Cloud Console | Static unless client is deleted/recreated | [GCP Credentials → OAuth 2.0 Client IDs](https://console.cloud.google.com/apis/credentials?project=project-d63f458f-8fba-450e-acf) |
| ADC (refresh token) | `~/.config/gcloud/application_default_credentials.json` | Application Default Credentials with adwords scope (auto-generated) | Auto-refreshes; delete and re-auth if stale | Run `~/.local/bin/gcp-cli auth application-default login --scopes=https://www.googleapis.com/auth/adwords` |
| Login customer ID | `~/.config/google-ads/brain-google-ads.env` | Google Ads manager account customer ID without hyphens (935769850 from 935-769-8503) | Static | From manager account header or `config/google-ads/account.toml` |
| Customer ID | `~/.config/google-ads/brain-google-ads.env` | Google Ads nonprofit client account ID without hyphens (592920243 from 592-920-2435) | Static | From client account context or `config/google-ads/account.toml` |

**Note:** Google Ads credentials are injected via local-only env file; the repo stores only status and paths in `config/google-ads/account.toml`. All secret values stay outside git.

## Tailscale

Tailnet for this infrastructure. Admin: `https://login.tailscale.com/admin`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `TAILSCALE_API_KEY` | `~/.config/tailscale/.env` | Tailscale API key for device management (remove nodes, rename, etc.) | API keys expire — check expiry in admin console | [Tailscale → Settings → Keys](https://login.tailscale.com/admin/settings/keys) |

## Supabase PostgreSQL (Infrastructure Database)

Self-hosted PostgreSQL instance (shared infrastructure for ory_prod, prochat, finance, cedula, accounting, and other databases).

**Instance Details:**
- Host: `10.0.2.4`
- Port: `5433`
- Server: Hetzner private network

| Credential | Storage | Purpose | Rotation | Regenerate |
|------------|---------|---------|----------|-----------|
| `SYSTEM_DATABASE_URL` | `~/.config/supabase/.env` (recommended) | Superuser/admin connection string — database administration, user permission grants, schema migrations | No automatic expiry; rotate if compromised; credentials are sensitive — treat like production SSH key | [Supabase Dashboard](https://app.supabase.com) → Project Settings → Database → Connection string (copy admin connection) |
| Superuser username | `supabase_admin` (config, not secret) | Admin account for Supabase management and permission grants | Static | — |
| Superuser password | Store in `~/.config/supabase/.env` (mode 600, gitignored) | Required for administrative tasks (grants, migrations, schema management) | No automatic expiry; rotate if compromised | Supabase Dashboard → Project Settings → Database → Connection string → Password |

**Database Directory (in same Supabase instance):**
- `ory_prod` — Ory authentication platform (user: `ory_user`)
- `prochat` — ProChat application (user: prochat_user)
- `finance` — Finance/accounting (user: finance_user)
- `cedula` — Cedula document management (user: cedula_user)
- `accounting` — Accounting system (user: accounting_user)
- And other application databases...

**Safety Rules:**
- ✅ Use only `supabase_admin` for administrative tasks (permissions, migrations)
- ✅ Use application-specific users (e.g., `ory_user`) for normal operations
- ❌ Never delete or modify schemas other than the application's own schema
- ❌ Never modify user permissions outside the application's granted scope
- ⚠️ Always test SQL changes in a non-production database first

**To connect as admin:**
```bash
export SYSTEM_DATABASE_URL="postgresql://supabase_admin:PASSWORD@10.0.2.4:5433/postgres?schema=public"
psql "$SYSTEM_DATABASE_URL"
```

---

## Ory

Self-hosted authentication platform (PRIMARY). Dashboard: https://auth-admin.prochat.tools

| Credential | Storage | Purpose | Rotation | Regenerate |
|------------|---------|---------|----------|-----------|
| `ORY_DATABASE_URL` | `~/.config/ory/.env` | PostgreSQL connection to ory_prod database | Static (internal) | Supabase → Connection string |
| `ORY_ADMIN_API_KEY` | `~/.config/ory/.env` | Admin API access for CLI/automation | No automatic expiry; rotate if compromised | `ory list admin-api-keys` → regenerate |
| `ORY_PUBLIC_URL` | `~/.config/ory/.env` | Public auth endpoint (config, not secret) | Static | https://auth.prochat.tools |
| `ORY_ADMIN_URL` | `~/.config/ory/.env` | Admin API endpoint (config, not secret) | Static | https://auth-admin.prochat.tools |

**Account Details:**
- CLI installed at: `/usr/local/bin/ory` (via Homebrew v1.3.0)
- Deployment: Dokploy (Ops project, compose ID: `DpMDhd91-YVUbHCxTD3Mx`, image: `oryd/kratos:v1.3.1`)
- Config volume: Docker named volume `ory-config` (contains kratos.yml + identity.schema.json)
- Database: Supabase PostgreSQL (ory_prod, user: ory_user, remote at 10.0.2.4:5433)
- Credentials file: `~/.config/ory/.env` (gitignored, mode 600)
- Runbook: `operations/runbooks/ory-cli.md`
- Skill: `brain/ai/skills/custom/ory/SKILL.md`

**Key features:**
- Multi-domain support (one instance, unlimited projects)
- Programmatic provisioning (auto-create domains via CLI)
- Full user lifecycle management (create, list, update, delete)
- Session management (inspect, revoke)
- Email verification, password recovery, MFA
- Open-source (Apache 2.0)

**To use CLI:**
```bash
source ~/.config/ory/.env
ory list projects
ory list identities --project <project-id>
```

**Status:** ✅ PRODUCTION READY (deployed 2026-04-12)

---

## Clerk

Authentication platform for multiple applications (FALLBACK/legacy). Dashboard: https://dashboard.clerk.com

**Status:** Active but migrating to Ory

| Credential | Storage | Purpose | Rotation | Regenerate |
|------------|---------|---------|----------|-----------|
| `CLERK_SECRET_KEY` | `~/.config/clerk/.env` | Live secret key for prochat.tools app — API access, user management, webhooks | No automatic expiry; rotate if compromised | [Dashboard → API Keys](https://dashboard.clerk.com/apps) → Secret Key → Regenerate |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `~/.config/clerk/.env` | Live publishable key for prochat.tools app — frontend auth | No automatic expiry; rotate if compromised | [Dashboard → API Keys](https://dashboard.clerk.com/apps) → Publishable Key → Regenerate |

**Account Details:**
- CLI installed at: `~/bin/clerk`
- Version: 0.0.2-canary (2026-04-12)
- Primary app: prochat.tools (live keys configured)
- Credentials file: `~/.config/clerk/.env` (gitignored, mode 600)
- Runbook: `operations/runbooks/clerk-cli.md`
- Skill: `brain/ai/skills/custom/clerk/SKILL.md`

**Key features:**
- List applications and API keys
- Query/export users, organizations, sessions
- Manage webhooks and test events
- Full CLI-based automation support

**To use CLI (load env first):**
```bash
export $(cat ~/.config/clerk/.env | xargs)
clerk apps list
clerk env --app prochat.tools
```

---

## Apify — Multi-Account System (10 Accounts × $5/mo = $50/mo Total)

Web scraping and data extraction platform. Multi-account rotation with round-robin distribution.

**Manager location:** `~/.apify-multi/` (tokens.json + state.json)  
**Manager script:** `brain/ai/skills/custom/apify/apify-multi-account-manager.py`  
**CLI wrapper:** `apify-multi` command  
**Runbook:** `operations/runbooks/apify-multi-account.md`

### Single Account (Default/CLI)

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `APIFY_TOKEN` | `~/.apify/auth.json` | API token for CLI — account: ProChat-1 | No automatic expiry; rotate if compromised | [Apify Console → Integrations → API & Integrations](https://console.apify.com/account/integrations) |

**Account 1 (ProChat):**
- Username: `ProChat` | Email: `info@prochat.tools`
- Plan: FREE ($5/month)
- Status: ✅ **Configured** (2026-04-12)

### Multi-Account Credentials (10 Total)

| Account # | Name | Email | Monthly Credit | Status |
|-----------|------|-------|-----------------|--------|
| 1 | ProChat-1 | info@prochat.tools | $5 | ✅ Active |
| 2 | ProChat-2 | 54.car-culler@icloud.com | $5 | ✅ Active |
| 3 | ProChat-3 | builds.mustard.3z@icloud.com | $5 | ✅ Active |
| 4 | ProChat-4 | lot_retinol.7@icloud.com | $5 | ✅ Active |
| 5 | ProChat-5 | parties.clank-0w@icloud.com | $5 | ✅ Active |
| 6 | ProChat-6 | slog_odder0i@icloud.com | $5 | ✅ Active |
| 7 | ProChat-7 | smiths.fights-5v@icloud.com | $5 | ✅ Active |
| 8 | ProChat-8 | stances-malt.18@icloud.com | $5 | ✅ Active |
| 9 | ProChat-9 | terry_92_basho@icloud.com | $5 | ✅ Active |
| 10 | ProChat-10 | vastest_images.2z@icloud.com | $5 | ✅ Active |

**Total monthly credit:** $50/month (renewable)

### Rotation System

- **Strategy:** Round-robin, cycle-based
- **Distribution:** Accounts 1-10 used sequentially, repeat next month
- **Benefits:** Even load distribution (bot detection resistance), all accounts used equally
- **Cycle tracking:** `cycle_count` increments when rotation wraps to Account 1

### Usage

```bash
# Get next token (for automation/n8n)
python3 ~/.apify-multi-account-manager.py next-token

# Check status (budget tracking)
python3 ~/.apify-multi-account-manager.py status

# CLI wrapper (local testing)
apify-multi run apify/web-scraper --input-file input.json
```

### n8n Integration

See `n8n-integration-pattern.md` for workflow setup. Key pattern:
1. Execute Command: Get next token from manager
2. HTTP POST: Start Apify run with token
3. Wait Loop: Poll until complete
4. HTTP GET: Fetch results

### Credentials Storage

- **Location:** `~/.apify-multi/tokens.json` and `~/.apify-multi/state.json`
- **Permissions:** 600 (user-readable only)
- **Backup:** Regular backups recommended (contains API keys)
- **Rotation:** Automatic (round-robin state in state.json)

**Note:** All 10 accounts configured and validated (2026-04-12). Free tier renewable monthly on the 1st UTC.

## WhatsApp Business API

Self-hosted messaging integration. Phone: 949-776-2428 (verified in Meta Business Manager)

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `WHATSAPP_PHONE_NUMBER_ID` | `~/.config/whatsapp/.env` | Phone number ID (not the phone number itself) | Static | [Meta Business Manager → Phone Numbers](https://business.facebook.com/latest/settings/phone-numbers) |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | `~/.config/whatsapp/.env` | WhatsApp Business Account ID | Static | [Meta Business Manager → Phone Numbers](https://business.facebook.com/latest/settings/phone-numbers) |
| `META_BUSINESS_ACCOUNT_ID` | `~/.config/whatsapp/.env` | Meta Business Account ID (for account operations) | Static | [Meta Business Manager → Info](https://business.facebook.com/latest/settings/info) |
| `META_APP_ID` | `~/.config/whatsapp/.env` | Meta app ID for WhatsApp integration | Static | [Meta Developers → Apps](https://developers.facebook.com/apps) |
| `META_APP_SECRET` | `~/.config/whatsapp/.env` | Meta app secret (config, not used in API calls) | Rotate if compromised | [Meta Developers → App Settings → Basic](https://developers.facebook.com/apps/{APP_ID}/settings/basic) |
| `WHATSAPP_ACCESS_TOKEN` | `~/.config/whatsapp/.env` | Long-lived access token for Cloud API — expires ~60 days | Manually rotate before expiry | [Meta Developers → WhatsApp API Setup](https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup) → "Generate Token" |
| `WHATSAPP_API_BASE_URL` | `~/.config/whatsapp/.env` | API base URL (config, not secret) | Static | — |
| `WHATSAPP_API_VERSION` | `~/.config/whatsapp/.env` | API version (config, not secret) | Static unless deprecated | — |

**Account Details:**
- Phone: `949-776-2428`
- Phone Number ID: `342165748989753`
- Business Account ID (WABA): `244609202066850`
- Meta App: `819349503541241`
- Plan: Free tier ($1 value initially, then usage-based)
- Status: ✅ **FULLY OPERATIONAL** (2026-04-12)
- Token Type: Long-lived (60-day expiration)
- API Endpoint: https://graph.facebook.com (not Instagram)

**Rotation Notes:**
- Access token expires ~60 days from generation
- Set reminder: Check token expiry monthly
- Regenerate at: [Meta Developers → WhatsApp API Setup](https://developers.facebook.com/apps/819349503541241/whatsapp/api_setup)
- No automatic renewal; manual regeneration required

**Skill Location:** `brain/ai/skills/custom/whatsapp/`  
**CLI:** `whatsapp send`, `whatsapp send-template`, `whatsapp list-templates`, etc.  
**SDK:** `whatsapp_sdk.py` (Python programmatic access)  
**Runbook:** `operations/runbooks/whatsapp-business-api.md`  
**n8n Templates:** `brain/ai/skills/custom/whatsapp/templates/`

---

## ING Bank (Statement Automation)

Automated bank statement download. Script: `tools/scripts/run-ing-bank-statement-download.sh`

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `ING_USERNAME` | `~/.config/ing/.env` | ING online banking username | Static | ING web portal |
| `ING_PASSWORD` | `~/.config/ing/.env` | ING online banking password | Change periodically via ING app/web | ING web portal |
| `ING_NTFY_TOPIC` | `~/.config/ing/.env` | ntfy.sh notification topic for download alerts (config, not secret) | Static | — |

## Azure Billing

Billing-specific service principals (separate from the AI provisioner/destroyer credentials above). Used by ProBot for cost reporting.

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `AZURE_TENANT_ID` | `~/.config/azure-billing/prochat-apps.env` | Tenant ID (yeshuaacademypt) | Static | Azure AD → Overview |
| `AZURE_CLIENT_ID` | `~/.config/azure-billing/prochat-apps.env` | Service principal — Cost Management Reader | Static unless rotated | App registrations |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-billing/prochat-apps.env` | Service principal secret | Check expiry in Azure portal | App registration → Certificates & secrets |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-billing/prochat-apps.env` | PROCHAT-APPS subscription | Static | Azure Portal → Subscriptions |
| `AZURE_SERVICE_PRINCIPAL_NAME` | `~/.config/azure-billing/prochat-apps.env` | Display name (config, not secret) | Static | — |
| `AZURE_TENANT_ID` | `~/.config/azure-billing/prochat-data.env` | Tenant ID (yeshuaacademy) | Static | Azure AD → Overview |
| `AZURE_CLIENT_ID` | `~/.config/azure-billing/prochat-data.env` | Service principal — Cost Management Reader | Static unless rotated | App registrations |
| `AZURE_CLIENT_SECRET` | `~/.config/azure-billing/prochat-data.env` | Service principal secret | Check expiry in Azure portal | App registration → Certificates & secrets |
| `AZURE_SUBSCRIPTION_ID` | `~/.config/azure-billing/prochat-data.env` | PROCHAT-DATA subscription | Static | Azure Portal → Subscriptions |
| `AZURE_SERVICE_PRINCIPAL_NAME` | `~/.config/azure-billing/prochat-data.env` | Display name (config, not secret) | Static | — |

## GCP

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `CLOUDSDK_PYTHON` | `~/.config/gcp/.env` | Python interpreter path for gcloud SDK (config, not secret) | Static | — |

Note: ADC and OAuth credentials are at `~/.config/gcloud/application_default_credentials.json`. Legacy credentials for 3 accounts (info@prochat.tools, steve@yeshua.academy, westhoek@hotmail.com) at `~/.config/gcloud/legacy_credentials/`.

## Says the Bible — YouTube

| Credential | File | Purpose | Rotation | Regenerate |
|------------|------|---------|----------|-----------|
| YouTube OAuth token | `~/.config/saysthebible/youtube-token.json` | Auto-refreshed OAuth token for YouTube Data API (video publishing) | Auto-refreshes; delete and re-auth if stale | Run YouTube OAuth flow via pipeline |

## xGrow (SaaS)

ProBot integration for xGrow status and cron monitoring.

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `XGROW_URL` | `~/.config/probot/.env` | xGrow app URL (config, not secret) | Static | — |
| `XGROW_API_KEY` | `~/.config/probot/.env` | API key for xGrow programmatic access | No automatic expiry; rotate if compromised | xGrow dashboard → API settings |
| `XGROW_CRON_SECRET` | `~/.config/probot/.env` | Shared secret for cron webhook auth | No automatic expiry; rotate if compromised | xGrow dashboard |

---

**Ory additional variables** (added to `~/.config/ory/.env` alongside the credentials documented in the Ory section above):

| Variable | File | Purpose |
|----------|------|---------|
| `ORY_LOG_LEVEL` | `~/.config/ory/.env` | Logging verbosity (config) |
| `ORY_LOG_FORMAT` | `~/.config/ory/.env` | Log output format (config) |
| `ORY_SECRETS_CIPHER` | `~/.config/ory/.env` | Encryption key for data at rest |
| `ORY_SECRETS_SYSTEM` | `~/.config/ory/.env` | System-level secret for HMAC |
| `ORY_SECRETS_COOKIE` | `~/.config/ory/.env` | Cookie encryption secret |
| `ORY_SESSION_COOKIE_SAME_SITE` | `~/.config/ory/.env` | Cookie SameSite policy (config) |
| `ORY_SESSION_COOKIE_PATH` | `~/.config/ory/.env` | Cookie path (config) |
| `ORY_SERVE_COOKIES_SAME_SITE_LEGACY_WORKAROUND` | `~/.config/ory/.env` | Legacy browser compat flag (config) |
| `ORY_PROJECT_ID` | `~/.config/ory/.env` | Kratos project identifier (config) |
| `ORY_IMAGE` | `~/.config/ory/.env` | Docker image reference (config) |
| `ORY_DOKPLOY_COMPOSE_ID` | `~/.config/ory/.env` | Dokploy compose service ID (config) |
| `ORY_CONFIG_VOLUME` | `~/.config/ory/.env` | Docker volume name (config) |
| `ORY_CLOUDFLARE_TUNNEL` | `~/.config/ory/.env` | Cloudflare tunnel ID (config) |

**Supabase additional variables** (added to `~/.config/supabase/.env` alongside the credentials documented in the Supabase section above):

| Variable | File | Purpose |
|----------|------|---------|
| `SUPABASE_HOST` | `~/.config/supabase/.env` | PostgreSQL host (config) |
| `SUPABASE_PORT` | `~/.config/supabase/.env` | PostgreSQL port (config) |
| `SUPABASE_ADMIN_USER` | `~/.config/supabase/.env` | Admin username |
| `SUPABASE_ADMIN_PASSWORD` | `~/.config/supabase/.env` | Admin password — treat as secret |

**GitHub additional tokens** (added to `~/.config/github/.env` alongside tokens documented in the GitHub section above):

| Variable | File | Purpose | Rotation | Regenerate |
|----------|------|---------|----------|-----------|
| `GITHUB_PAT` | `~/.config/github/.env` | General-purpose PAT (broader scope than `n8n-github-brain`) | Check expiry in GitHub settings | [GitHub → Settings → Developer settings → PATs](https://github.com/settings/tokens?type=beta) |

**Google Ads additional variables** (in `~/.config/google-ads/brain-google-ads.env`, alongside credentials documented in Google Ads section above):

| Variable | File | Purpose |
|----------|------|---------|
| `GOOGLE_ADS_OAUTH_CLIENT_ID` | `~/.config/google-ads/brain-google-ads.env` | OAuth client ID from GCP project |
| `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | `~/.config/google-ads/brain-google-ads.env` | OAuth client secret from GCP project |
| `GOOGLE_ADS_REFRESH_TOKEN` | `~/.config/google-ads/brain-google-ads.env` | Auto-refreshed OAuth token |

---

## Pending — empty

All detected credentials have been categorized. Run `sync-credentials` to check for new entries.
