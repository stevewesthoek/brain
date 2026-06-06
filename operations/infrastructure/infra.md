# Infrastructure Reference

This is the central infrastructure document for the Brain repo.

Purpose:
- Give Claude and Codex one canonical reference for cloud accounts, servers, access paths, hosted platforms, and recovery-critical details.
- Capture what is verified live versus what is only historical or still incomplete.

Verification status:
- Last verified live on 2026-05-19 from the `Office` Mac mini.
- Sources used: `az`, `aws sts`, SSH, Dokploy API, Cloudflare API, Docker Swarm inspection, local SSH config, local skill/runbook docs.

Related local control-plane inventory:
- `operations/infrastructure/scheduler-inventory.md` — canonical scheduler and LaunchAgent inventory for the `Office` Mac
- `operations/infrastructure/PYTHON-VERSIONS.md` — Python version strategy (dual versions, migration path, upstream tracking)
- `operations/infrastructure/local-apps.json` — **canonical** local runtime registry for app ports, database ports, and health checks on the `Office` Mac
- `operations/infrastructure/local-apps.md` — human-readable runbook and inventory mirror for the canonical registry
- The registry is in a compatibility window: expanded fields are preferred, but legacy aliases remain in the JSON so older consumers keep working.
- Brain Console starts apps from `repoPath` and injects `PORT` from the registry when available, so local app commands can stay repo-relative and avoid stale hardcoded paths.
- Brain Console local-app actions must go through the centralized local-app orchestrator. App-specific scripts are allowed only as registry-declared helpers; the dashboard must not grow separate lifecycle implementations per app.
- Start/restart actions must be clean and port-authoritative: stop any existing session on the reserved app port, verify the port is free, start once, then wait for health.
- For apps with expensive `predev` work or a need for restartable dashboard launches, the local registry should point the dashboard at a wrapper script that can clear stale listeners and boot the app directly rather than using `npm run dev`.

## Local Applications (`Office` Mac)

All locally-running apps on the `Office` Mac are indexed in:
- **`operations/infrastructure/local-apps.json`** — machine-readable canonical registry; Brain Console reads this file on every `/api/local-apps` request (no restart needed)
- **`operations/infrastructure/local-apps.md`** — human-readable runbook with schema docs, reserved port policy, and inventory table

The registry is dual-compatible during the migration window:
- new consumers should read `appPort`, `appUrl`, `healthCheck`, `startCommand`, `stopCommand`, and `startupTimeoutMs`
- legacy consumers may continue to use `port`, `url`, `check`, `start`, and `stop`
- both sets of fields are kept aligned in `local-apps.json`

Current inventory: Says the Bible (3058 / DB 5441), Firecrawl (3055 / DB 5443), ProChat (3056 / DB 5434), Via di Eden (3057 / DB 5447), Oliveto Organizing (3059 / DB 5453), JPV Bootcamp (3000 / DB 5444), xGrow (7080 / DB 5445), Google Ads API (8001), ComfyUI (8188), Family Finance (3060 / DB 5452), Fala (3050), BuildFlow (3054), TradeBot (3061 / DB 5454).

To add a new local app, edit `local-apps.json` — the Brain Console "Local Apps" tab updates immediately.

## Local port policy

- `3000-3099` is reserved for local web app ports.
- `5400-5499` is reserved for local PostgreSQL ports.
- `6300-6399` is reserved for Redis ports.
- `7000-7099` is reserved for internal dashboards and control-plane tools.
- `8000-8099` is reserved for APIs and supporting services.
- `4011-4012` are reserved for local TinaCMS dev server ports for Via di Eden and Oliveto Organizing.
- `9002-9003` are reserved for the corresponding TinaCMS datalayer ports.
- Never reuse a port once it has been assigned to an app or database, even after retirement.
- Do not repurpose `5432` for project-local databases unless `local-apps.json` explicitly documents that choice.
- The reserved PostgreSQL range (`5400-5499`) is off-limits for ad hoc reuse except for registry-managed local databases.

## Control Plane

| Node | Role | Specs | Access | Notes |
| --- | --- | --- | --- | --- |
| `Office` | Primary operator machine / local control plane | Mac mini `Mac16,11`, Apple M4 Pro, 12 cores, 24 GB RAM | Local machine, Tailscale `100.86.124.66`, SSH alias `office` | Runs local AI tooling, CLI auth state, and the serialized nightly scheduler via `launchd`. |

## Cloud Accounts

### Azure

| Subscription | Subscription ID | Tenant ID | Signed-in identity | Current access status | Notes |
| --- | --- | --- | --- | --- | --- |
| `PROCHAT-APPS` | `1db6646e-69c0-4ee0-a4d5-53d40421a5a4` | `afab256a-cbf5-4aab-a7d1-f271bda38123` | `steve@yeshuaacademypt.onmicrosoft.com` | Confirmed in `az`; role assignment shows `Owner` at subscription scope | Primary Azure apps subscription. Contains Dokploy VM and related infra. |
| `PROCHAT-DATA` | `6e99b82d-43e3-41cc-ad94-8733afeb2a7e` | `290d8a41-0cbc-450b-9263-f018dc28165d` | `admin@yeshuaacademy.onmicrosoft.com` | Confirmed in `az`; resources fully readable; subscription role assignments show a user-level `Owner` assignment at subscription scope | Primary Azure data subscription. Contains Supabase VM and data-side infra. |

### AWS

| Account | Current CLI identity | Current access status | Notes |
| --- | --- | --- | --- |
| `909439522876` | Base identity `arn:aws:iam::909439522876:user/claude-code` plus assumed roles `ClaudeCodexProvisioner` and `ClaudeCodexDestroyer` | Confirmed live in `aws sts`; both role-backed wrappers work and `ec2 describe-regions` / `lightsail get-regions` succeed through the provisioner role | AWS automation is now role-based rather than single-user-only. The earlier inventory-permission gap is resolved for the standard provisioner / destroyer workflow. |

### Hetzner Cloud

| Environment | Current access status | Notes |
| --- | --- | --- |
| Current production CloudPanel host | Confirmed over SSH and `hcloud` | Hetzner CLI is installed and authenticated on this Mac. Current project inventory shows one running server: `cloudpanel`. |

## Server Inventory

| Server | Purpose | Cloud | Region / Platform | OS | CPU / RAM | Public IP | Tailscale IP | Access path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dokploy` / `vm-dokploy` | Main app host and container orchestrator | Azure / `PROCHAT-APPS` | Spain Central | Ubuntu 24.04.3 LTS | 4 vCPU, 15 GiB RAM observed live | `68.221.139.108` | `100.83.38.48` | `ssh dokploy` | Running |
| `supabase` / `vm-supabase` | Supabase + PostgreSQL backend host | Azure / `PROCHAT-DATA` | Spain Central | Ubuntu 24.04.3 LTS | 2 vCPU, 7.8 GiB RAM observed live | `68.221.194.245` | `100.71.31.88` | `ssh supabase` | Running |
| `cloudpanel` | Current CloudPanel production host | Hetzner Cloud | Hetzner | Ubuntu 24.04.3 LTS | 4 vCPU, 7.5 GiB RAM observed live | IPv4 `91.99.71.221`, IPv6 `2a01:4f8:1c1c:38c1::1` | None observed; `tailscale` not installed | `ssh cloudpanel` via Cloudflare Tunnel | Running |

## Azure Resource Inventory

### `PROCHAT-APPS`

Resource groups:
- `AzureBackupRG_spaincentral_1`
- `NetworkWatcherRG`
- `rg-apps-cloudpanel`
- `rg-apps-dokploy`

Live observations:
- The only current VM in this subscription is `vm-dokploy`.
- `rg-apps-cloudpanel` exists but currently contains no resources.
- `rg-apps-dokploy` contains the Dokploy VM, NIC, VNet, NSG, public IP, recovery vault, VM extension, disks, and seven Azure Monitor metric alerts.

### `PROCHAT-DATA`

Resource groups:
- `AzureBackupRG_spaincentral_1`
- `DefaultResourceGroup-EUS`
- `NetworkWatcherRG`
- `rg-data-supabase`
- `rg-saas-infra`
- `rg-tts`

Live observations:
- The only current VM in this subscription is `vm-supabase`.
- `rg-data-supabase` contains the Supabase VM, data disk, and a snapshot.
- This subscription also contains backup / automation / monitoring resources and a small set of SaaS / cognitive resources outside the Supabase group.

## Access Paths

### SSH aliases

Source of truth:
- [ssh config](/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/ssh/config)

Current aliases:
- `dokploy` -> Tailscale `100.83.38.48`, user `master`
- `supabase` -> Tailscale `100.71.31.88`, user `master`
- `cloudpanel` -> `ssh_cp.prochat.tools` through `cloudflared access ssh`, user `master`
- `office` -> Tailscale `100.86.124.66`, user `office`

### Admin / service entrypoints

Known service URLs:
- Dokploy UI: `https://dokploy.prochat.tools`
- Supabase Studio: `https://studio.prochat.tools`
- n8n: `https://n8n.prochat.tools`
- CloudPanel SSH ingress: `ssh_cp.prochat.tools`

Tailscale private services (no internet exposure):
- Firecrawl API: `http://100.83.38.48:3002` (web scraping & search)
- Firecrawl admin queue: `http://100.83.38.48:3002/admin/<BULL_AUTH_KEY>/queues`

Retired infrastructure:
- The old OpenClaw AWS Lightsail host was decommissioned on `2026-04-04` after Telegram cutover to the local daemon on the `Office` Mac.

## Hosted Platform Inventory

### Dokploy

#### Architecture

Dokploy runs as a **Docker Swarm** stack on Azure VM `vm-dokploy`. Core services:

| Service | Image | Role | Network |
|---------|-------|------|---------|
| `dokploy` | `dokploy/dokploy:v0.29.2` | App server (UI + API) | `dokploy-network`, port 3000 published to host |
| `dokploy-postgres` | `postgres:16` | Primary database (user: `dokploy`, db: `dokploy`) | `dokploy-network` |
| `dokploy-redis` | `redis:7` | Cache / job queue | `dokploy-network` |
| `dokploy-traefik` | `traefik:v2.x` | Reverse proxy for deployed apps | `dokploy-network`, ports 80/443 published to host |

All application containers also attach to `dokploy-network`.

#### Traffic Flow

```
Internet → Cloudflare (TLS termination) → Cloudflare Tunnel (dc7bb87e) → Azure VM

  dokploy.prochat.tools  →  localhost:3000  (Dokploy direct — bypasses Traefik)
  all other apps         →  localhost:80    (Traefik → Docker containers)
```

- **Dokploy UI/API**: Cloudflare Tunnel routes `dokploy.prochat.tools` directly to `localhost:3000`. Traefik is NOT in this path.
- **Deployed apps**: Cloudflare Tunnel routes all other hostnames to `localhost:80` (Traefik entrypoint `web`). Traefik uses Docker/Swarm labels to route to the correct container.
- **SSL/TLS**: Cloudflare handles TLS termination for ALL tunnel-routed traffic. The connection from Cloudflare Tunnel to localhost is unencrypted HTTP. Traefik's LetsEncrypt/ACME config exists but is unused for tunnel traffic.
- **Cloudflared**: Runs as a systemd service on the VM using a remotely-managed token-based tunnel.

#### API

- **Base URL**: `https://dokploy.prochat.tools`
- **Auth**: `x-api-key` header with plaintext API key
- **Protocol**: tRPC — all mutations are POST to `/api/trpc/<procedure>`
- **Local credentials**: `~/.config/dokploy/.env` (contains `DOKPLOY_API_KEY`, `DOKPLOY_URL`, `DOKPLOY_API_HEADER`)
- **Deploy endpoint**: `POST /api/trpc/application.deploy` with body `{"json":{"applicationId":"<id>"}}`
- **GitHub App webhook**: `POST /api/deploy/github` (auto-deploy on push; handled by the `prochattools` GitHub App)

Application IDs:
- Via di Eden: `34heLjzG-klSB3ja7ZSG5`
- Oliveto Organizing: `xBuP3eoiwNO5l2qY_N_1h`
- JPV Bootcamp: `aPR9SvYn_JvGdMTk3CzeI`

#### Recovery

- **Backup**: Azure disk snapshots (nightly via Azure Backup vault in `rg-apps-dokploy`)
- **Critical after restore**: Port 3000 MUST be published to host for Cloudflare Tunnel to reach Dokploy: `docker service update dokploy --publish-add 3000:3000`
- **Service restart**: `docker service update dokploy --force` (restarts without config change)
- **Postgres recovery**: Wait for postgres to be fully ready before restarting Dokploy service (race condition on cold boot)

#### Operational Notes

- The `dokploy-cli` packaged CLI returns 401 for most commands — use direct tRPC API calls instead.
- The Dokploy database `key` column stores a HASH of the API key; the `start` column stores the first 6 chars of the plaintext. Do not confuse the hash with the actual key.
- GitHub App webhook endpoint is `/api/deploy/github` (NOT `/api/webhook/github`).

---

Projects and workloads verified through the Dokploy API on 2026-05-19:

`Databases`
- Compose: `olivetoorganizing`
- Compose: `prokit`
- Compose: `saaskit`
- Compose: `statuslink`
- Compose: `resend`
- Compose: `saaskitstudio`
- Compose: `jpvbootcamp`
- Compose: `viadieden`
- Compose: `prokitstudio`
- Compose: `openfund`
- Compose: `saysthebible`
- Compose: `prochat`
- Compose: `cedula`
- Compose: `jpvbootcamp`

`Web`
- App: `BuildFlow` (managed relay for ChatGPT Custom Actions)
- App: `Yeshua Academy`
- App: `Yeshua Academy Finance`
- App: `ProChat`
- App: `Says the Bible`
- App: `Cedula`

`Clients`
- App: `Oliveto Organizing`
- App: `JPV Bootcamp`
- App: `JCCP Holdings`
- App: `Via di Eden`

`WaaS`
- App: `ProChat Accountant`

`Ops`
- App: `Free Resend`
- Compose: `kutt`
- Compose: `umami`
- Compose: `n8n`
- Compose: `firecrawl`

`Boilerplates`
- App: `ProKit Dev`
- App: `ProKit Studio`
- App: `SaaSKit Dev`
- App: `SaaSKit Studio`

`SaaS`
- App: `Status Link`
- App: `Egg Cooker`
- App: `Proofly`

Notable statuses seen in Dokploy:
- `JCCP Holdings` was in `idle`
- `kutt` was in `idle`

### Firecrawl

Runtime location:
- Docker Compose workload on the Dokploy host (project: `Ops`)

Live endpoints:
- Tailscale private: `http://100.83.38.48:3002` (via Tailscale network)
- Internal (on dokploy): `http://localhost:3002`
- Admin queue UI: `http://100.83.38.48:3002/admin/<BULL_AUTH_KEY>/queues`

Service details:
- **Purpose**: Self-hosted web scraping & search API (default web research tool for Claude Code, Codex, Gemini)
- **Containers**: api, playwright-service, redis, rabbitmq, nuq-postgres
- **Database**: PostgreSQL in persistent Docker volume `firecrawl_pgdata`
- **Access**: Private Tailscale network only (no internet exposure)
- **Token efficiency**: Returns clean markdown (75–90% reduction vs raw HTML)
- **Skill documentation**: `brain/ai/skills/custom/firecrawl/SKILL.md`
- **Operations runbook**: `brain/operations/runbooks/firecrawl.md`

### n8n

Runtime location:
- Docker Compose workload on the Dokploy host

Live endpoints:
- App URL: `https://n8n.prochat.tools`
- Public API base: `https://n8n.prochat.tools/api/v1`
- Webhook base: `https://n8n.prochat.tools/webhook`

Automation and recovery:
- API wrapper: `~/.local/bin/n8n-api`
- Local auth file: `~/.config/n8n/.env`
- Backup root: [n8n backup](/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/n8n_backup)
- Runbook: [n8n runbook](/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/n8n.md)
- Nightly scheduler: macOS `launchd` daily at `03:00` with `RunAtLoad` catch-up

Latest verified backup state on 2026-04-03:
- `4` credentials exported
- `40` workflows exported

### CloudPanel

Current state:
- The live CloudPanel server is the Hetzner host reachable through `ssh cloudpanel`.
- CloudPanel CLI is available through `~/.local/bin/cloudpanel-cli`.
- Hetzner Cloud CLI is available through `~/.local/bin/hetzner-cli`.
- Hetzner Cloud inventory currently shows:
  - server: `cloudpanel`
  - type: `cax21`
  - location: `nbg1`
  - datacenter: `nbg1-dc3`
  - firewall: `CloudPanel Firewall`
- The currently exposed CLI surface on this server is narrow and oriented to database export/import, permission reset, and Varnish purge.
- The Azure migration target is not currently live as a VM; the Azure resource group `rg-apps-cloudpanel` exists but is empty as of 2026-04-03.

## Network Model

- Primary inter-server private connectivity is Tailscale, not Azure VNet peering.
- Dokploy reaches Supabase over Tailscale.
- SSH for Azure servers is done over Tailscale.
- CloudPanel SSH is done through a Cloudflare Tunnel, not Tailscale.
- Supabase PostgreSQL is intended to stay private to the server and trusted internal access paths.

## Tailscale Network Inventory

All nodes in the tailnet as of 2026-04-04:

| Node | Tailscale IP | OS | Role | Status |
|------|--------------|----|------|--------|
| `office` | `100.86.124.66` | macOS | Primary control plane (Mac mini) | Online |
| `dokploy` | `100.83.38.48` | Linux | Azure VM — app host / container orchestrator | Online |
| `supabase` | `100.71.31.88` | Linux | Azure VM — Supabase / PostgreSQL backend | Online |
| `macbook` | `100.70.12.18` | macOS | Secondary Mac — personal laptop | Idle |
| `iphone` | `100.107.201.123` | iOS | Mobile device | Online |
| `motorola` | `100.107.156.26` | Android | Mobile device | Offline |

Nodes without Tailscale:
- `cloudpanel` (Hetzner) — uses Cloudflare Tunnel for SSH; no Tailscale installed

Tag assignments:
- `tagged-devices`: `dokploy`, `supabase` — server nodes managed as tagged devices in the tailnet

## Automation Interfaces

These are the standard AI-agnostic interfaces both Claude and Codex should use:

| Surface | Standard interface | Notes |
| --- | --- | --- |
| Azure | `~/.local/bin/azure-apps-provisioner`, `~/.local/bin/azure-data-provisioner`, and matching destroyer wrappers | Service-principal-backed, subscription-explicit Azure automation surface |
| AWS | `~/.local/bin/aws-provisioner` and `~/.local/bin/aws-destroyer` | Assumed-role AWS automation surface layered on top of the base `claude-code` IAM user |
| Hetzner | `~/.local/bin/hetzner-cli` | Hetzner Cloud infrastructure surface backed by local `hcloud` auth |
| Dokploy | Direct tRPC API (`POST /api/trpc/*` with `x-api-key`); creds in `~/.config/dokploy/.env` | Primary deployment surface; `dokploy-cli` is broken (401s) — use direct API |
| n8n | `~/.local/bin/n8n-api` | Primary headless workflow automation interface |
| CloudPanel | `~/.local/bin/cloudpanel-cli` | Production-scoped; confirm before mutations |
| Tailscale | `~/.local/bin/tailscale-cli` | Network observability: node status, reachability checks, pre-flight pings before SSH |

## Credentials

All API keys, tokens, and credentials are indexed (no values, just metadata) at:

- **`operations/accounts/credentials-index.md`** — service name, variable name, file path, purpose, rotation cadence, and regeneration URL for every credential on this machine.

Run `sync-credentials` at any time to scan `~/.config/` for new `.env` files and append untracked entries. A PostToolUse hook fires automatically whenever Claude writes or edits a `.env` file.

## Recovery-Critical Notes

- The n8n recovery path is already documented and automated; do not rely on the n8n UI as the only source of credential truth.
- SSH aliases in `operations/system-configs/ssh/config` are part of the operational control plane and should be kept accurate.
- Azure and AWS auth on this Mac are local-machine state and should never be committed.
- AWS role flow on this Mac:
  - `~/.local/bin/aws-cli` uses the base IAM user `claude-code`
  - `~/.local/bin/aws-provisioner` assumes `ClaudeCodexProvisioner`
  - `~/.local/bin/aws-destroyer` assumes `ClaudeCodexDestroyer`
- Azure role flow on this Mac:
  - `~/.local/bin/azure-cli` is the generic user-authenticated `az`
  - `azure-apps-*` and `azure-data-*` wrappers authenticate through dedicated service principals stored in `~/.config/azure-ai/credentials/`

## Domain & Site Inventory

Central record of all known public domains. Update status here when enabling or disabling a site.

To re-enable a disabled site: add its entry back to the relevant Cloudflare Tunnel ingress config (see Cloudflare Tunnel section below).

### CloudPanel AWS (tunnel `1bdef92e`)

Sites hosted on the AWS CloudPanel server (13.135.227.0), accessed via the `CloudPanel AWS` Cloudflare Tunnel.
SSH access: `ssh cloudpanel-aws` (ubuntu user with sudo).
CloudPanel UI: `https://cp.prochat.tools`

| Domain | Status | Notes |
|--------|--------|-------|
| `cp.prochat.tools` | Online | CloudPanel AWS UI — `https://localhost:8443` |
| `admin.yeshua.academy` | Online | WordPress (catch-all default) |
| `legacy.prochat.tools` | Online | WordPress — legacy ProChat site |
| `feelgoodwithana.com` | Online | WordPress |
| `microgreens.market` | Online | WordPress |
| `onefleshinchrist.com` | Online | WordPress |
| `wedding.onefleshinchrist.com` | Online | WordPress |
| `pedroandkristina.com` | Online | WordPress |
| `vilasolidaria.pt` | Online | WordPress |
| `portal.jpvbootcamp.com` | Online | WordPress |
| `ag.prochat.tools` | **Disabled** | WordPress — removed from tunnel 2026-04-04; site files intact on server. Re-enable: add `{"service":"http://localhost:8080","hostname":"ag.prochat.tools","originRequest":{"httpHostHeader":"ag.prochat.tools"}}` back to AWS tunnel ingress before the catch-all entry. |
| `thedutchperformance.nl` | **Disabled** | WordPress — removed from tunnel 2026-04-04; site files intact on server; SSL cert valid until July 2026. Re-enable: add `{"service":"http://localhost:8080","hostname":"thedutchperformance.nl","originRequest":{"httpHostHeader":"thedutchperformance.nl"}}` back to AWS tunnel ingress before the catch-all entry. |

### Dokploy (tunnel `dc7bb87e`)

Sites deployed on the Dokploy host (Azure VM `vm-dokploy`, 68.221.139.108).
SSH access: `ssh dokploy` (Tailscale).
Dokploy UI: `https://dokploy.prochat.tools`

| Domain | App | Project | Status | Notes |
|--------|-----|---------|--------|-------|
| `buildflow.prochat.tools` | BuildFlow | Web | Pending provisioning | Managed relay for ChatGPT Custom Actions; router to connected local devices. Status: phase 1 provisioning plan documented. |
| `dokploy.prochat.tools` | — | Ops | Online | Dokploy UI |
| `n8n.prochat.tools` | n8n | Ops | Online | Workflow automation |
| `firecrawl.prochat.tools` | Firecrawl | Ops | Online | Web scraping & search API; PostgreSQL in Docker volume `firecrawl_pgdata`; replaces `/browse` and WebFetch for research |
| `studio.prochat.tools` | Supabase Studio | Ops | Online | Supabase admin UI (proxied through Dokploy host) |
| `yeshua.academy` | Yeshua Academy | Web | Online | — |
| `finance.yeshua.academy` | Yeshua Academy Finance | Web | Online | — |
| `prochat.tools` | ProChat | Web | Online | — |
| `saysthebible.com` | Says the Bible | Web | Online | — |
| `cedula.prochat.tools` | Cedula | Web | Online | — |
| `olivetoorganizing.com` | Oliveto Organizing | Clients | Online | — |
| `jpvbootcamp.com` | JPV Bootcamp | Clients | Online | — |
| `jccp-management.pro` | JCCP Holdings | Clients | Online | Added to Dokploy tunnel 2026-04-04 |
| `lean.diet` | — | TBD | Parked | Added to Dokploy tunnel 2026-04-04; domain repurposed, new project not yet created |
| `arkware.solutions` | — | TBD | Parked | Added to Dokploy tunnel 2026-04-04; domain repurposed, new project not yet created |
| `viadieden.com` | Via di Eden | Clients | Online | — |
| `onestatus.link` | Status Link | SaaS | Online | `statuslink.io` currently points to an unrelated Framer site and returns 404 |
| `proofly.io` | Proofly | SaaS | Online | — |

> Domain names for some Dokploy apps (ProChat Accountant, Egg Cooker, Free Resend, ProKit, SaaSKit boilerplates, kutt, umami) are not yet confirmed — verify via Dokploy UI or `/dokploy` skill.

### Supabase

Self-hosted Supabase on Azure VM `vm-supabase` (68.221.194.245).
SSH access: `ssh supabase` (Tailscale).

| Domain | Status | Notes |
|--------|--------|-------|
| `studio.prochat.tools` | Online | Supabase Studio — proxied through Dokploy |

### Cloudflare Tunnel Reference

| Tunnel | ID | Server | Purpose |
|--------|-----|--------|---------|
| `CloudPanel` (Hetzner) | `91069afe-7e45-4703-88c3-73bcf61c3fb6` | Hetzner `cloudpanel` | Hetzner CloudPanel SSH + UI + studio.prochat.tools |
| `CloudPanel AWS` | `1bdef92e-5e70-4836-9552-3e4653cef43a` | AWS `cloudpanel-aws` | All CloudPanel AWS hosted WordPress sites |
| `Dokploy` | `dc7bb87e-...` | Azure `vm-dokploy` | All Dokploy-hosted apps |

### Hetzner CloudPanel (tunnel `91069afe`) — Legacy

The Hetzner server is the **old** CloudPanel. Migrated sites have been removed from its tunnel. Remaining tunnel entries as of 2026-04-04:

| Hostname | Service | Notes |
|----------|---------|-------|
| `ssh_cp.prochat.tools` | SSH | Cloudflare SSH ingress for `cloudpanel` alias |
| `cp.prochat.tools` | CloudPanel UI | Stale — DNS now points to AWS tunnel; effectively unreachable |
| `studio.prochat.tools` | Supabase Studio | — |

Known sites still present on Hetzner server filesystem (not yet deleted):
- `jccp-management.pro` — requires manual deletion via Hetzner CloudPanel UI at `https://91.99.71.221:8443`

## Application-Specific Notes

### Family Finance
- **Status**: Local-only application; no production deployment
- **Registry**: `local-apps.json` entry with name `"Family Finance"` — canonical configuration source
- **Canonical local execution**: One way only — Brain Console manages lifecycle
  - **App port**: `3060` (http://localhost:3060)
  - **Database**: OrbStack PostgreSQL at `localhost:5452/family_finance`
  - **Start command**: `npm run dev` (Brain Console injects `PORT=3060`)
  - **Database service**: `docker compose up` from `operations/database/standalone/familyfinance/docker-compose.yml`
- **Brain Console integration**: 
  - Brain Console reads `local-apps.json` Family Finance entry on every page load (no restart needed)
  - "Local Apps" tab in Brain Console shows Family Finance with start/stop/health controls
  - Brain Console reserves ports 3060 and 5452; only Brain Console may manage startup/shutdown
- **Dokploy**: ❌ No active deployment; historical production Dokploy app was deleted 2026-05-03 (ID: uMrNEbM2ROMb8z6PD3-O0)
- **Supabase**: ❌ No production database; all data is local only
- **Manual execution**: ⚠️ Avoid `npm run dev` outside Brain Console; use Brain Console instead to ensure port isolation and health-check compliance
- **Reference**: Canonical local database compose at `operations/database/standalone/familyfinance/docker-compose.yml`
- **Constraint**: Future agents must not create Family Finance databases on production Supabase, must not attempt to deploy to Dokploy, and must only verify local OrbStack runtime via Brain Console

### TradeBot
- Status: Local-only Phase 1 read-only cockpit
- Registry: local-apps.json entry with name "TradeBot" — canonical configuration source
- Canonical local execution: Brain Console manages lifecycle
  - App port: 3061 (http://localhost:3061/dashboard)
  - Health check: http://localhost:3061/api/health
  - Future database: OrbStack PostgreSQL reserved at localhost:5454/tradebot
  - Log file: /tmp/tradebot.log
- Safety boundary:
  - no live trading
  - no withdrawals
  - no margin/leverage/derivatives
  - no Freqtrade execution integration
  - no LLM trade authority
- Manual execution: avoid running on port 3000; use reserved port 3061
- Constraint: Future agents must not reuse ProChat DB port 5434 for TradeBot. TradeBot database port is reserved as 5454.

## Gaps / TODO

- Confirm domain names for remaining Dokploy apps (ProChat Accountant, Egg Cooker, Free Resend, kutt, umami, boilerplates).
- Delete `jccp-management.pro` site files from Hetzner server via CloudPanel UI.
- Supabase database password rotation (currently expired; not blocking Family Finance which is local-only)
- Optional: Clean up stale Cloudflare DNS record for `finance.prochat.tools` (no longer routes anywhere)

Completed (2026-05-19):
- ✅ Dokploy architecture fully documented (Docker Swarm, traffic flow, Cloudflare Tunnel routing, API, recovery)
- ✅ GitHub App auto-deploy confirmed working for Via di Eden and Oliveto Organizing
- ✅ Dokploy recovered from failed upgrade attempt (v0.29.2 restored via Azure disk snapshot)
- ✅ Port 3000 publishing requirement documented as recovery-critical

Completed (2026-05-03):
- ✅ Dokploy API access restored (new key provisioned; direct API calls via `$DOKPLOY_URL/project.all` verified working)
- ✅ Dokploy CLI caveat documented (packaged `dokploy-cli verify/list` returns 401; use direct API instead)
- ✅ Supabase host corrected from stale 10.0.2.4 to Azure Tailscale IP 100.71.31.88 in all docs
- ✅ Family Finance Dokploy app deleted (production app ID: uMrNEbM2ROMb8z6PD3-O0)
- ✅ Family Finance finalized as local-only with canonical infra.md documentation
- ✅ Brain Console confirmed as sole execution interface for Family Finance lifecycle

Last updated:
- 2026-05-19 WEST (Dokploy architecture documentation + auto-deploy verification)
