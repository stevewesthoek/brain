# Infrastructure Reference

This is the human-readable infrastructure orientation page for the Brain repo. The canonical machine-readable infrastructure authority is the IKHP catalog discovered through `operations/infrastructure/catalog/manifest.v1.json`; this page must not contradict that catalog.

Purpose:
- Give humans and LLMs a readable orientation for cloud accounts, servers, access paths, hosted platforms, and recovery-critical details.
- Point back to the canonical IKHP catalog and evidence sources rather than creating parallel infrastructure truth.
- Capture what is verified live versus what is historical, configuration-backed, or still unknown.

**IKHP direction:** this document remains the human infrastructure entry page. Machine-readable unification, live health/freshness, credential-reference health, backup/restore health, safety policy, and future Brain Core/CLI/MCP/Obsidian interfaces are defined by the Infrastructure Knowledge & Health Plane (IKHP):
- `operations/specs/infrastructure-knowledge-health-plane-architecture.md`
- `operations/specs/infrastructure-knowledge-health-plane-roadmap.md`
- `operations/specs/infrastructure-knowledge-health-plane-implementation-plan.md`

IKHP0-IKHP4 are implemented repository capabilities. IKHP4 safety/action contracts and bounded non-secret runtime receipt persistence are accepted as repository implementation only; IKHP5, IKHP6, and CLR5 are not authorized. No new live monitoring, provider mutation, remediation, or infrastructure execution is activated by this page.

Verification status:
- The last broad live estate verification represented in older sections of this page was 2026-05-19 from the `Office` Mac mini.
- Dokploy production authority was superseded by the observed Azure → AWS cutover completed 2026-08-17: AWS `dokploy-aws` is authoritative production. The old Azure `dokploy-azure` environment is non-authoritative and retained only as a quiesced fallback/rollback source.
- Packet 2 does not claim a new whole-estate live probe. CloudPanel, provider-access, monitoring, and ongoing backup attributes that were not freshly observed remain explicit UNKNOWNs in IKHP.
- Historical sources used by this page include `az`, `aws sts`, SSH, Dokploy API, Cloudflare API, Docker Swarm inspection, local SSH config, migration evidence, and runbooks.

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

The access-status text below is a historical configuration/live snapshot, not a fresh Packet 2 credential probe. Canonical non-secret account/access resources live in the IKHP catalog; current connectivity belongs to IKHP health observations.

### Azure

`supabase-azure` is the current Azure subscription for Supabase/data-side infrastructure. `dokploy-azure` is retained only for the quiesced legacy Dokploy fallback and is not production authority.

| Subscription | Subscription ID | Tenant ID | Signed-in identity | Current access status | Notes |
| --- | --- | --- | --- | --- | --- |
| `supabase-azure` | `6e99b82d-43e3-41cc-ad94-8733afeb2a7e` | `290d8a41-0cbc-450b-9263-f018dc28165d` | `admin@yeshuaacademy.onmicrosoft.com` | Historical configuration/access evidence; Packet 2 did not re-probe Azure live auth | Current Azure data subscription containing Supabase/data-side infrastructure. |

### AWS

| Account | Current CLI identity | Current access status | Notes |
| --- | --- | --- | --- |
| `909439522876` | Base identity `arn:aws:iam::909439522876:user/claude-code` plus assumed roles `ClaudeCodexProvisioner` and `ClaudeCodexDestroyer` | Confirmed live in `aws sts`; both role-backed wrappers work and `ec2 describe-regions` / `lightsail get-regions` succeed through the provisioner role | AWS automation is now role-based rather than single-user-only. The earlier inventory-permission gap is resolved for the standard provisioner / destroyer workflow. |

## Server Inventory

| Server | Purpose | Cloud | Region / Platform | OS | CPU / RAM | Public IP | Tailscale IP | Access path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dokploy-aws` | Authoritative Dokploy production host | AWS Lightsail | London, Zone A (`eu-west-2`) | Ubuntu 24.04.4 LTS, kernel 6.17.0-1019-aws | 4 vCPU, 16 GiB RAM, 320 GiB SSD | `18.135.240.168` | `100.71.47.24` | `ssh dokploy` -> Tailscale | **Running authoritative production** — Linux hostname `dokploy-aws`, standardized 2026-08-18 |
| `supabase` / `vm-supabase` | Authoritative Supabase + PostgreSQL backend host | Azure / `supabase-azure` | Spain Central | Ubuntu 24.04.3 LTS (historical observation) | 2 vCPU, 7.8 GiB RAM (historical observation) | `68.221.194.245` | `100.71.31.88` | `ssh supabase` | Current Azure data authority; volatile VM state not re-probed in Packet 2 |
| `cloudpanel-aws` | Authoritative CloudPanel host | AWS Lightsail | London, Zone A (`eu-west-2`) | Ubuntu 24.04.4 LTS, kernel 6.17.0-1007-aws | 2 vCPU, 8 GiB RAM, 160 GiB SSD | `13.135.227.0` | `100.121.12.36` | `ssh cloudpanel` -> Tailscale | **Running authoritative CloudPanel** — Linux hostname `cloudpanel-aws`, standardized 2026-08-18 |

## Azure Resource Inventory

Only `supabase-azure` remains part of the current Azure estate, for Supabase/data-side infrastructure. The detailed inventory below is a **2026-05-19 historical live snapshot** unless a newer dated evidence item says otherwise; Packet 2 did not re-query Azure live state.

### `supabase-azure`

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

Current Git-managed aliases (all via Tailscale — management-plane hardened 2026-08-18):
- `dokploy` / `dokploy-aws` -> Tailscale `100.71.47.24`, user `ubuntu`, key `id_ed25519`.
- `supabase` -> Tailscale `100.71.31.88`, user `master`, key `id_ed25519`.
- `cloudpanel` / `cloudpanel-aws` -> Tailscale `100.121.12.36`, user `ubuntu`, key `id_ed25519`.
- `office` -> Tailscale `100.86.124.66`, user `office`, key `id_ed25519`.

### Admin / service entrypoints

Known service URLs:
- Dokploy UI: `https://dokploy.prochat.tools`
- Supabase Studio: `https://studio.prochat.tools`
- n8n: `https://n8n.prochat.tools`

The current private Firecrawl endpoint was not independently re-queried in Packet 2 and remains UNKNOWN; do not reuse historical Azure addresses as current service authority.

Retired infrastructure:
- The old OpenClaw AWS Lightsail host was decommissioned on `2026-04-04` after Telegram cutover to the local daemon on the `Office` Mac.

## Hosted Platform Inventory

### Dokploy

#### Architecture

Dokploy production now runs as a **Docker Swarm** stack on AWS Lightsail host `dokploy-aws`. The core-service table below originated from the pre-cutover inventory and remains useful as topology context, but image versions must be reverified before operational use:

| Service | Image | Role | Network |
|---------|-------|------|---------|
| `dokploy` | `dokploy/dokploy:v0.29.2` | App server (UI + API) | `dokploy-network`, port 3000 published to host |
| `dokploy-postgres` | `postgres:16` | Primary database (user: `dokploy`, db: `dokploy`) | `dokploy-network` |
| `dokploy-redis` | `redis:7` | Cache / job queue | `dokploy-network` |
| `dokploy-traefik` | `traefik:v2.x` | Reverse proxy for deployed apps | `dokploy-network`, ports 80/443 published to host |

All application containers also attach to `dokploy-network`.

#### Traffic Flow

```
Internet → Cloudflare (TLS termination) → Cloudflare Tunnel (dc7bb87e) → AWS `dokploy-aws` production host

  dokploy.prochat.tools  →  localhost:3000  (Dokploy direct — bypasses Traefik)
  all other apps         →  localhost:80    (Traefik → Docker containers)
```

- **Dokploy UI/API**: Cloudflare Tunnel routes `dokploy.prochat.tools` directly to `localhost:3000`. Traefik is NOT in this path.
- **Deployed apps**: Cloudflare Tunnel routes all other hostnames to `localhost:80` (Traefik entrypoint `web`). Traefik uses Docker/Swarm labels to route to the correct container.
- **SSL/TLS**: Cloudflare handles TLS termination for ALL tunnel-routed traffic. The connection from Cloudflare Tunnel to localhost is unencrypted HTTP. Traefik's LetsEncrypt/ACME config exists but is unused for tunnel traffic.
- **Cloudflared**: The production connector runs on AWS `dokploy-aws` using the remotely-managed production tunnel. On the retained Azure `dokploy-azure` fallback, the production connector remains stopped; it is not an active ingress path.

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

- **Recovery evidence**: the 2026-08-17 migration used AWS Lightsail snapshots plus 16/16 version-matched PostgreSQL logical dump/restore verification. Provider snapshots and application-consistent database recovery are separate evidence classes.
- **Ongoing backup cadence**: UNKNOWN in Packet 2. The Azure Backup-vault description below is historical rollback evidence, not proof of current AWS production backup health; use IKHP `backup-policies.v1.json` for canonical policy state.
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

Current endpoint authority:
- Internal on authoritative AWS Dokploy: `http://localhost:3002`.
- The former Azure Tailscale endpoint is decommissioned and must not be used.
- A current private Tailscale endpoint for Firecrawl was not independently re-verified in Packet 2 and remains UNKNOWN.

Service details:
- **Purpose**: Self-hosted web scraping & search API (default web research tool for Claude Code, Codex, Gemini)
- **Containers**: api, playwright-service, redis, rabbitmq, nuq-postgres
- **Database**: PostgreSQL in persistent Docker volume `firecrawl_pgdata`
- **Access**: Private Tailscale network only (no internet exposure)
- **Token efficiency**: Returns clean markdown (75–90% reduction vs raw HTML)
- **Skill documentation**: `brain/ai/skills/custom/firecrawl/SKILL.md`
- **Operations runbook**: `brain/operations/runbooks/firecrawl.md`

### Umami

Runtime location:
- Docker Compose workload on the Dokploy host (AWS Lightsail dokploy-aws)
- Compose project: `ops-umami-sqswbj`
- Container: `ops-umami-sqswbj-umami-1`
- Image: `ghcr.io/umami-software/umami:3.0.3`
- Database: Supabase `analytics` at `10.0.2.4:5433` via Tailscale subnet route (NO local Docker postgres)
- Traefik route: file-provider at `/etc/dokploy/traefik/dynamic/umami.yml` (NOT Swarm/Docker label discovery)
- Tailscale dependency: `10.0.2.4` routes via `tailscale0`; requires Tailscale active on dokploy-aws

Live endpoints:
- App URL: `https://umami.prochat.tools`

Production state (verified 2026-08-19):
- 4 websites (production UUID: `5ceba17d-4125-4a75-a1f6-9add5c4b1803` — ProChat / prochat.tools)
- 596 sessions, 1,816 events (through 2026-08-17; no events in last 24h is expected, not data loss)
- User acceptance 2026-08-19: login PASS, all 4 websites visible, historical analytics visible (last 20 days range)
- Note: default dashboard view is "last 24 hours" — adjust date range to see historical data
- code-umami-1 (stale migration residue): retired 2026-08-19
- Incident status: CLOSED

Critical invariant: Azure Supabase (`vm-supabase`, Tailscale `100.71.31.88`) is the authoritative analytics DB. It MUST NOT be decommissioned as part of Azure Dokploy decommission planning — these are separate Azure resources.

Future consideration: Steve is evaluating Umami retirement (New Relic Browser replacement). This is NOT approved — separate planning required before any decommission.

Incident history: `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md` (Umami ingress gap noted)

### n8n

Runtime location:
- Docker Compose workload on the Dokploy host (AWS Lightsail dokploy-aws)
- Compose project: `apps-internal-n8n-cvjx2s`
- Container: `apps-internal-n8n-cvjx2s-n8n-1`
- Image: `n8nio/n8n:2.4.7`
- PostgreSQL: `postgres:17-alpine` (`apps-internal-n8n-cvjx2s-postgres-1`)
- DB hostname: `postgres` via compose-internal network only (NOT on shared dokploy-network)
- Traefik route: file-provider at `/etc/dokploy/traefik/dynamic/n8n.yml` (NOT Swarm/Docker label discovery)
- N8N_PROXY_HOPS: 2 (Cloudflare → Traefik → n8n)

Live endpoints:
- App URL: `https://n8n.prochat.tools`
- Public API base: `https://n8n.prochat.tools/api/v1`
- Webhook base: `https://n8n.prochat.tools/webhook`

Production state (verified 2026-08-19):
- 43 workflows (6 active)
- 17 credentials (encrypted, depend on N8N_ENCRYPTION_KEY)
- 2 API keys (Milestone App, ProChat)
- 6 webhook registrations
- Login acceptance: 3/3 consecutive logins PASS (existing owner, unchanged password)
- Incident status: CLOSED

Critical invariant: postgres MUST NOT be on any shared Docker network where another compose project could advertise the same `postgres` DNS alias. Current architecture isolates postgres to the compose-internal network only.

Automation and recovery:
- API wrapper: `~/.local/bin/n8n-api`
- Local auth file: `~/.config/n8n/.env`
- Backup root: [n8n backup](/Users/Office/Repos/stevewesthoek/brain/operations/automations/n8n/n8n_backup)
- Runbook: [n8n runbook](/Users/Office/Repos/stevewesthoek/brain/operations/runbooks/n8n.md)
- Nightly scheduler: macOS `launchd` daily at `03:00` with `RunAtLoad` catch-up
- Incident history: `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md`

Latest verified backup state on 2026-04-03:
- `4` credentials exported
- `40` workflows exported

### CloudPanel

Current evidence state (management-plane hardened 2026-08-18):
- `cloudpanel-aws` is **OBSERVED-VERIFIED running** in AWS Lightsail, London Zone A, public `13.135.227.0`, Tailscale `100.121.12.36`, with 8 GiB RAM, 2 vCPU, and 160 GiB SSD.
- SSH access: Tailscale-only via `ssh cloudpanel` -> `100.121.12.36`, user `ubuntu`, key `id_ed25519`.
- Admin panel (TCP/8443): Tailscale-only access via `https://100.121.12.36:8443`.
- Public web ingress: TCP/80, TCP/443, UDP/443 open to `0.0.0.0/0` (direct website serving).
- UFW active on host with rules matching Lightsail firewall (80/443/22 + Tailscale).
- Hosted sites: admin.yeshua.academy, ag.prochat.tools, click.israelinvestment.org, feelgoodwithana.com, legacy.prochat.tools, microgreens.market, onefleshinchrist.com, pedroandkristina.com, portal.jpvbootcamp.com, services.avigdor.tech, thedutchperformance.nl, vilasolidaria.pt, wedding.onefleshinchrist.com.
- Cloudflare Tunnel `1bdef92e-5e70-4836-9552-3e4653cef43a` connects from the host.
- Hetzner is not part of the current infrastructure estate.

## Network Model

- Primary private connectivity between all production servers is **Tailscale**. All SSH management is Tailscale-only (no public TCP/22).
- Authoritative AWS Dokploy reaches the shared Supabase authority through the tailnet; `100.71.47.24` ↔ `100.71.31.88`.
- All three production servers (dokploy-aws, cloudpanel-aws, supabase) are enrolled in the tailnet and use OpenSSH-over-Tailscale for administration.
- Dokploy application ingress: Cloudflare Tunnel (outbound, no public ports required).
- CloudPanel application ingress is mixed: public 80/443/UDP443 remains required for direct website origins, while 10 current hostnames are also served through the active CloudPanel Tunnel.
- CloudPanel admin panel (8443): Tailscale-only access.
- Public TCP/22: Blocked on both AWS Lightsail instances. `lightsail-connect` alias retained in Lightsail firewall. Actual browser SSH viability differs per server (see Emergency access model below).
- Supabase PostgreSQL is intended to stay private to the server and trusted internal access paths.

## Tailscale Network Inventory

Live observation **2026-08-18** (8 registered devices, 7 active, 1 offline):

| Node | Tailscale IP | OS | Role | Status |
|------|--------------|----|------|--------|
| `office` | `100.86.124.66` | macOS | Primary control plane (Mac mini) | Active |
| `dokploy-aws` | `100.71.47.24` | Linux | AWS authoritative Dokploy production host | Active |
| `cloudpanel-aws` | `100.121.12.36` | Linux | AWS authoritative CloudPanel host | Active |
| `supabase` | `100.71.31.88` | Linux | Azure Supabase / PostgreSQL authority | Active |
| `dokploy` | `100.83.38.48` | Linux | Azure `dokploy-azure` quiesced fallback / rollback source | Registered/idle |
| `macbook` | `100.70.12.18` | macOS | Secondary Mac | Active/registered |
| `iphone` | `100.107.201.123` | iOS | Contextual personal device | Active/registered |
| `motorola` | `100.107.156.26` | Android | Contextual personal device | Offline |

Management-plane model (hardened + hostnames standardized 2026-08-18):
- All production servers use OpenSSH-over-Tailscale (NOT Tailscale SSH mode).
- Linux hostnames match Tailscale/Lightsail names: `dokploy-aws`, `cloudpanel-aws`.
- `preserve_hostname: true` set in cloud-init on both to prevent revert on reboot.
- Public TCP/22 blocked at Lightsail cloud firewall on both AWS hosts.
- Tailscale node-key expiry is disabled for permanent infrastructure nodes `dokploy-aws`, `cloudpanel-aws`, and Supabase.

Emergency access model (verified 2026-08-18):
- **dokploy-aws**: Lightsail browser SSH is SUPPORTED-BY-CONFIG. `lightsail-connect` passes Lightsail firewall, UFW is inactive, sshd has `TrustedUserCAKeys` for the Lightsail CA, and `LightsailDefaultKeyPair` is in authorized_keys. All layers allow it.
- **cloudpanel-aws**: Lightsail browser SSH is SUPPORTED BY CURRENT CONFIGURATION. Final closure evidence shows host UFW allows TCP/22 from Anywhere (v4+v6), while the Lightsail perimeter permits TCP/22 only from `lightsail-connect`; ordinary public SSH to `13.135.227.0:22` times out. Normal administration remains OpenSSH over Tailscale.

## Automation Interfaces

These are the standard AI-agnostic interfaces both Claude and Codex should use:

| Surface | Standard interface | Notes |
| --- | --- | --- |
| Azure supabase-azure | `~/.local/bin/azure-data-provisioner` and matching destroyer wrapper | Service-principal-backed Azure data-subscription surface for Supabase/data infrastructure only |
| AWS | `~/.local/bin/aws-provisioner` and `~/.local/bin/aws-destroyer` | Assumed-role AWS automation surface layered on top of the base `claude-code` IAM user |
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
  - current production/data operations use the `azure-data-*` wrappers for `supabase-azure`/Supabase; `azure-apps-*` wrappers are legacy/fallback-only for retained `dokploy-azure` and are not a production deployment path.

## Domain & Site Inventory

Central record of all known public domains. Update status here when enabling or disabling a site.

To re-enable a disabled site: add its entry back to the relevant Cloudflare Tunnel ingress config (see Cloudflare Tunnel section below).

### CloudPanel AWS (tunnel `1bdef92e`)

CloudPanel production is OBSERVED-VERIFIED healthy as of 2026-08-18 (nginx active, MariaDB active, two PHP-FPM services running, admin endpoint responsive, hosted websites responding). The per-site table below remains an inventory view rather than a replacement for live health observations.
SSH configuration: `ssh cloudpanel` / `ssh cloudpanel-aws` targets Tailscale `100.121.12.36` as user `ubuntu`; fresh independent OpenSSH-over-Tailscale validation passed. Normal public TCP/22 is blocked.
CloudPanel UI reference: `https://cp.prochat.tools`

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

Sites in this inventory now belong to the authoritative AWS Dokploy runtime `dokploy-aws`; the 2026-08-17 cutover verified 17 production-critical domains externally. The full table also contains older inventory entries, so individual status labels should not be treated as a fresh whole-estate probe.
SSH: the owner manually updated `operations/system-configs/ssh/config`; `ssh dokploy` and `ssh dokploy-aws` now target AWS Tailscale `100.71.47.24` as user `ubuntu`.
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

Dokploy connector handoff to AWS is OBSERVED-VERIFIED from the 2026-08-17 cutover. CloudPanel tunnel identities come from older configuration/inventory evidence; their current connector/liveness remains UNKNOWN in Packet 2.

| Tunnel | ID | Server / configured target | Purpose / current evidence state |
|--------|-----|----------------------------|----------------------------------|
| `CloudPanel AWS` | `1bdef92e-5e70-4836-9552-3e4653cef43a` | AWS `cloudpanel-aws` | Configured AWS CloudPanel ingress; current connector/site health UNKNOWN |
| `Dokploy` | `dc7bb87e-...` | AWS `dokploy-aws` | **Current production ingress**; Azure connector stopped at cutover |

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
