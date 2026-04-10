# Infrastructure Reference

This is the central infrastructure document for the Brain repo.

Purpose:
- Give Claude and Codex one canonical reference for cloud accounts, servers, access paths, hosted platforms, and recovery-critical details.
- Capture what is verified live versus what is only historical or still incomplete.

Verification status:
- Last verified live on 2026-04-03 from the `Office` Mac mini.
- Sources used: `az`, `aws sts`, SSH, Dokploy API, local SSH config, local skill/runbook docs.

Related local control-plane inventory:
- `operations/infrastructure/scheduler-inventory.md` — canonical scheduler and LaunchAgent inventory for the `Office` Mac

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

Retired infrastructure:
- The old OpenClaw / ProBot AWS Lightsail host was decommissioned on `2026-04-04` after Telegram cutover to the local `ProBot` daemon on the `Office` Mac.

## Hosted Platform Inventory

### Dokploy

Dokploy host:
- Azure VM `vm-dokploy`
- UI: `https://dokploy.prochat.tools`
- API auth stored locally in `~/.config/dokploy/.env`

Projects and workloads verified through the Dokploy API on 2026-04-03:

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
- App: `Yeshua Academy`
- App: `Open Fund`
- App: `ProChat`
- App: `Says the Bible`
- App: `Cedula`

`Clients`
- App: `Olive to Organizing`
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

`Boilerplates`
- App: `ProKit Dev`
- App: `ProKit Studio`
- App: `SaaSKit Dev`
- App: `SaaSKit Studio`

`SaaS`
- App: `xGrow`
- App: `Status Link`
- App: `Egg Cooker`
- App: `Proofly`

Notable statuses seen in Dokploy:
- `xGrow` was in `error`
- `JCCP Holdings` was in `idle`
- `kutt` was in `idle`

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
| Dokploy | `~/.local/bin/dokploy-cli` and Dokploy API | Primary deployment surface for hosted apps |
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
| `dokploy.prochat.tools` | — | Ops | Online | Dokploy UI |
| `n8n.prochat.tools` | n8n | Ops | Online | Workflow automation |
| `firecrawl.prochat.tools` | Firecrawl | Ops | Online | Web scraping & search API; PostgreSQL in Docker volume `firecrawl_pgdata`; replaces `/browse` and WebFetch for research |
| `studio.prochat.tools` | Supabase Studio | Ops | Online | Supabase admin UI (proxied through Dokploy host) |
| `yeshua.academy` | Yeshua Academy | Web | Online | — |
| `openfund.yeshua.academy` | Open Fund | Web | Online | — |
| `prochat.tools` | ProChat | Web | Online | — |
| `saysthebible.com` | Says the Bible | Web | Online | — |
| `cedula.prochat.tools` | Cedula | Web | Online | — |
| `olivetoorganizing.com` | Olive to Organizing | Clients | Online | — |
| `jpvbootcamp.com` | JPV Bootcamp | Clients | Online | — |
| `jccp-management.pro` | JCCP Holdings | Clients | Online | Added to Dokploy tunnel 2026-04-04 |
| `lean.diet` | — | TBD | Parked | Added to Dokploy tunnel 2026-04-04; domain repurposed, new project not yet created |
| `arkware.solutions` | — | TBD | Parked | Added to Dokploy tunnel 2026-04-04; domain repurposed, new project not yet created |
| `viadieden.com` | Via di Eden | Clients | Online | — |
| `xgrow.io` | xGrow | SaaS | Error | xGrow app was in error state as of 2026-04-03 |
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

## Gaps / TODO

- Confirm domain names for remaining Dokploy apps (ProChat Accountant, Egg Cooker, Free Resend, kutt, umami, boilerplates).
- Delete `jccp-management.pro` site files from Hetzner server via CloudPanel UI.
- Update xGrow status once error state is resolved.

Last updated:
- 2026-04-04 WEST
