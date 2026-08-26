# ProChat Infrastructure Architecture

```
Status:                         CANONICAL
Repository:                     brain
Last verified:                  2026-08-26
Azure Dokploy decommissioned:   2026-08-26 (all PROCHAT-APPS resources deleted)
Phase 3C6 corrections applied:  2026-08-16
Phase 3C7 corrections applied:  2026-08-16 (evidence-provenance audit; schema counts, SSH model,
                                             tailnet topology, DB owners, app→DB map)
Phase 3C8 corrections applied:  2026-08-16 (canonicalization pass; proposed-vs-current separation,
                                             terminology, schema count reconciled to 36,
                                             Traefik authority, NO-DUAL-WRITER definition,
                                             finance_shadow confidence, rollback Class A, ADR statuses)
Phase 3C9 corrections applied:  2026-08-16 (evidence-consistency repair; device count, DATABASE_URL
                                             count 21→14, F-ARCH-002 conflation removed, global
                                             ACTIVE-LEGACY label removed, tenant_prokit/saaskit
                                             reclassified UNKNOWN/LEGACY-CANDIDATE, unproven runtime
                                             claims downgraded, ADR-003 canonical terminology removed)
Phase 3C10 corrections applied: 2026-08-16 (final line-edit; F-APP-001 local-compose inference
                                             removed, F-ARCH-001 DATABASE_URL overclaim fixed,
                                             F-DB-002 heading corrected, historical-ordering claims
                                             removed, CANONICAL-ACTIVE→CURRENT-ACTIVE renamed,
                                             registry/tenants semantics downgraded, Section 4.3
                                             both Tailscale paths documented)
Phase 3C11 corrections applied: 2026-08-16 (final factual wording cleanup; Section 8.2 dual-store
                                             overclaim, live-data overclaim, Supabase scope wording,
                                             tenant_prokit/saaskit evidence notes, retired-resource
                                             claim, ADR-004 historical rationale downgraded,
                                             ADR-007 staging-schema unsupported claim removed)
Phase 3F applied:               2026-08-17 (post-cutover authority handoff; production runtime
                                             updated to AWS; migration evidence retained below)
Evidence register:              operations/architecture/prochat-infrastructure-evidence-register.md
Current production runtime:     AWS Lightsail dokploy-aws (eu-west-2, London)
Previous production runtime:    Azure Dokploy (vm-dokploy, Spain Central) — DECOMMISSIONED 2026-08-26
Production cutover completed:   2026-08-17 (~28 min downtime, 16/16 DB restores, Class B rollback)
Azure decommission completed:   2026-08-26 (all PROCHAT-APPS resources deleted, Tailscale node removed)
```

> **Current-vs-historical rule (2026-08-26):** the post-decommission block above is current authority. Azure Dokploy no longer exists. Any later Azure Dokploy inventory, IP, backup, cutover, Class A/B, or rollback wording is **HISTORICAL** and describes the migration state at the date shown; it is not a present runtime, recovery source, or operator target. The only surviving Azure production scope is `supabase-azure`, containing the active production VM `vm-supabase` and its self-hosted Supabase/PostgreSQL service.

---

## ═══════════════════════════════════════════════════════
## PRODUCTION INVARIANTS — ABSOLUTE RULES
## ═══════════════════════════════════════════════════════

```
POST-DECOMMISSION STATE (Azure Dokploy decommissioned 2026-08-26):

  AWS Lightsail:        SOLE PRODUCTION RUNTIME (authoritative since 2026-08-17)
  vm-supabase:          AUTHORITATIVE SELF-HOSTED SUPABASE/POSTGRESQL VM
                        (Azure subscription supabase-azure; reached from AWS via Tailscale)
  Azure Dokploy:        DECOMMISSIONED — all compute, storage, networking, backups,
                        and Tailscale node permanently deleted 2026-08-26

  AWS production application writers:   ACTIVE (22 Swarm services at 1/1)
  AWS cloudflared:                      ACTIVE (tunnel to Cloudflare edge)
  Azure Dokploy:                        DELETED (subscription PROCHAT-APPS = zero resources)
  vm-supabase:                          ACTIVE PRODUCTION (subscription supabase-azure, untouched)
  Dual Supabase writers:                N/A (only one Dokploy instance exists)
  Rollback to Azure Dokploy:            NOT POSSIBLE (infrastructure destroyed)
```

These rules are not advisory:
- Azure Dokploy is permanently decommissioned — no rollback path exists
- AWS Dokploy is the sole production Dokploy authority
- `vm-supabase` remains ACTIVE PRODUCTION in Azure subscription `supabase-azure`
- All 13 Supabase-writing services run exclusively on AWS

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Server Inventory](#2-server-inventory)
3. [Network Architecture](#3-network-architecture)
4. [Firewall & Access Model](#4-firewall--access-model)
5. [Dokploy Platform Architecture](#5-dokploy-platform-architecture)
6. [Application Inventory](#6-application-inventory)
7. [Compose Inventory](#7-compose-inventory)
8. [Data Architecture](#8-data-architecture)
9. [Schema ↔ Application Map](#9-schema--application-map)
10. [Information Flows](#10-information-flows)
11. [Source-of-Truth Matrix](#11-source-of-truth-matrix)
12. [Production Safety Boundary](#12-production-safety-boundary)
13. [NO-DUAL-WRITER Matrix](#13-no-dual-writer-matrix)
14. [JPV Bootcamp Active-Development Model](#14-jpv-bootcamp-active-development-model)
15. [Final Cutover Data-Sync Inventory](#15-final-cutover-data-sync-inventory)
16. [n8n Pre-Cutover Infrastructure Reference Audit](#16-n8n-pre-cutover-infrastructure-reference-audit)
17. [Backup & Recovery Architecture](#17-backup--recovery-architecture)
18. [Observability & Operations](#18-observability--operations)
19. [Legacy & Hygiene Inventory](#19-legacy--hygiene-inventory)
20. [Future Architecture Placeholders](#20-future-architecture-placeholders)
21. [Architecture Decisions](#21-architecture-decisions)
22. [Open Questions](#22-open-questions)

---

## 1. Executive Summary

ProChat's production infrastructure runs on **AWS Lightsail** (self-hosted Dokploy Docker PaaS,
eu-west-2 London). Production cutover from Azure (Spain Central) completed 2026-08-17 with ~28 min
downtime, 16/16 database restores, and 17/17 domain validations passing. Azure Dokploy was
permanently decommissioned 2026-08-26 (all compute, storage, networking, backups deleted from
PROCHAT-APPS subscription).

The system consists of three production infrastructure nodes joined by a **Tailscale mesh**. The
diagram below shows the Dokploy↔Supabase data path; `cloudpanel-aws` is part of the wider
three-node infrastructure and is documented separately below:

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  INTERNET                                                                │
 │  Users → Cloudflare CDN/WAF → Cloudflare Tunnel (cloudflared)           │
 └──────────────────────────┬───────────────────────────────────────────────┘
                            │ Cloudflare Tunnel (outbound from cloudflared)
 ┌──────────────────────────▼───────────────────────────────────────────────┐
 │  PRODUCTION NODE (AWS Lightsail)                                         │
 │                                                                          │
 │  dokploy-aws · AWS Lightsail · Tailscale identity: dokploy             │
 │  Static IP: 18.135.240.168 · Tailscale: 100.71.47.24                    │
 │                                                                          │
 │  ┌──────────────────────────────────────────────────────────────────┐    │
 │  │  Docker Swarm (single-node)                                      │    │
 │  │  Dokploy + Traefik v3.6.7 + postgres:16 + redis:7               │    │
 │  │  24 Application Swarm services + 17 Compose projects            │    │
 │  │  (14 local postgres:15 · n8n · ory · umami)                    │    │
 │  └──────────────────────────────────────────────────────────────────┘    │
 │  cloudflared (ACTIVE) · tailscaled                                      │
 └──────────────────────────────────────────┬───────────────────────────────┘
                                            │ Tailscale mesh
                                            │
                              ┌──────────────▼──────────────────────────────┐
                              │  vm-supabase — Supabase/PostgreSQL         │
                              │  Azure subscription: supabase-azure       │
                              │                                             │
                              │  Tailscale: 100.71.31.88                    │
                              │  Subnet route: 10.0.2.0/24                  │
                              │  PostgreSQL at 10.0.2.4:5433                │
                              │                                             │
                              │  One PostgreSQL server on vm-supabase      │
                              │  24 logical databases                       │
                              │  AWS writers active; Supabase ACTIVE       │
                              │  vm-supabase / supabase-azure — untouched │
                              └─────────────────────────────────────────────┘
```

**USER-PROPOSED FUTURE DATA MODEL** (not an approved architecture decision — see ADR-003):
> Steve's proposed target: ONE logical database + explicit per-application schemas.
> The `tenant_*` naming is NOT part of the USER-PROPOSED FUTURE DATA MODEL's naming convention.
> **Current verified state differs**: 24 logical databases exist; see Section 8.2.
> `tenant_*` schemas and databases exist; direct runtime dependency is not fully verified for all.
> `tenant_*` naming exists in the current environment. Its historical relationship to the
> dedicated-database pattern is not established by current evidence. Naming alone proves
> neither legacy nor obsolescence.
> Post-cutover investigation and explicit approval required before any change.

**AWS is authoritative for all operational configuration and production Dokploy runtime.**
Azure Dokploy is decommissioned; rollback to it is impossible. Recovery relies on AWS
Lightsail snapshots/backups and documented reconstruction procedures. `vm-supabase` remains
the active production self-hosted Supabase/PostgreSQL service in `supabase-azure`.

---

## 2. Server Inventory

### 2.1 Azure Dokploy (HISTORICAL / DECOMMISSIONED 2026-08-26)

The following inventory is retained solely as migration evidence. Every listed Azure Dokploy
resource was deleted on 2026-08-26; none is a current server, network path, backup source, or
rollback target.

| Property | Value |
|----------|-------|
| Name | vm-dokploy |
| Provider | Azure |
| Region | Spain Central |
| SKU | Standard_D4as_v5 |
| CPU / RAM | 4 vCPU / 16 GB |
| OS disk | 30 GB Premium_LRS |
| Data disk | 256 GB Standard_LRS — mounted at `/mnt/data-dokploy` |
| Public IP | 68.221.139.108 |
| Private IP | 172.16.0.4 |
| Tailscale IP | 100.83.38.48 |
| Docker data-root | `/mnt/data-dokploy/docker` |
| Docker version | 29.2.0 |
| Backup vault | cloudpanel-dokploy-vault |
| Backup policy | EnhancedPolicy-CloudPanel-Dokploy |
| System services | cloudflared (STOPPED since cutover), tailscaled, newrelic-infra v1.73.0 |
| SSH access | Public TCP/22: ALLOWED from internet (NSG Priority 900 Allow \*); key-based auth. Tailscale SSH: BLOCKED by ACL policy. Claude-orchestrated ops use `az vm run-command invoke` (avoids short-lived cert management). |

### 2.2 AWS Lightsail (Current Production — Authoritative)

| Property | Value |
|----------|-------|
| Name | dokploy-aws |
| Provider | AWS Lightsail |
| Region | eu-west-2 (London) |
| Instance plan | xlarge_3_0 |
| CPU / RAM | 4 vCPU / 16 GB |
| Disk | 320 GB (single disk) |
| Static IP | 18.135.240.168 |
| Tailscale IP | 100.71.47.24 |
| Tailscale identity / FQDN | `dokploy` / `dokploy.tail3c0f0a.ts.net` |
| Docker data-root | `/mnt/data-dokploy/docker` |
| Docker version | 29.2.0 (Swarm mode) |
| Auto-snapshot | Daily, 03:00 UTC |
| Available snapshots | pre-production-baseline-20260816, pre-cutover-ready-20260816, post-cutover-20260817 |
| System services | cloudflared (ACTIVE — production tunnel), tailscaled |
| Disk utilization | 32 GB / 309 GB (11%) as of 2026-08-16 |

### 2.3 `vm-supabase` — Azure-hosted self-managed Supabase/PostgreSQL production VM

| Property | Value |
|----------|-------|
| Type | Self-hosted Supabase/PostgreSQL service on VM `vm-supabase` |
| Azure subscription | `supabase-azure` |
| Tailscale IP | 100.71.31.88 |
| Subnet route | 10.0.2.0/24 (advertised by Supabase Tailscale node) |
| PostgreSQL endpoint | 10.0.2.4:5433 |
| **PostgreSQL version** | **15.8** (verified 2026-08-16 via BEGIN TRANSACTION READ ONLY) |
| Databases | 24 logical databases (see Section 8.4) |
| Access | Tailscale-only (not publicly routable) |

**Note:** The PostgreSQL versions listed in other sections (pg17 for n8n, pg16 for Dokploy
control-plane, pg15 for tenant local DBs) are Docker containers running on the **Dokploy host**,
not on VM `vm-supabase`. They are entirely separate infrastructure.

### 2.4 AWS Lightsail CloudPanel (Current Production — Authoritative)

| Property | Value |
|----------|-------|
| Name / Linux hostname | `cloudpanel-aws` |
| Provider | AWS Lightsail |
| Region | eu-west-2 (London, Zone A) |
| CPU / RAM | 2 vCPU / 8 GB |
| Disk | 160 GB SSD |
| Static public IPv4 | `13.135.227.0` (retained for website ingress) |
| Tailscale IPv4 | `100.121.12.36` |
| Tailscale identity / FQDN | `cloudpanel` / `cloudpanel.tail3c0f0a.ts.net` |
| Management SSH | standard OpenSSH over Tailscale; `ssh cloudpanel`; normal public TCP/22 blocked at the Lightsail perimeter |
| CloudPanel admin | `https://100.121.12.36:8443`; current UFW evidence keeps 8443 on the Tailscale management path |
| Host UFW TCP/22 | allows Anywhere (IPv4 + IPv6) in the final evidence closure; this is not the effective public perimeter |
| Lightsail TCP/22 | `lightsail-connect` only; no ordinary public CIDRs |
| Public website ingress | public 80/tcp, 443/tcp, 443/udp retained; CloudPanel also has active Cloudflare Tunnel ingress for configured hostnames |
| Tailscale SSH feature | disabled |
| Tailscale node-key expiry | disabled |
| Hostname persistence | `preserve_hostname: true`; verified persistent |
| Emergency browser SSH | supported by current Lightsail `lightsail-connect` configuration; not independently browser-session tested |
| Production health | PASS on 2026-08-18 |

---

## 3. Network Architecture

### 3.1 Tailscale Management Mesh

Tailscale is the canonical private **management plane** for ProChat infrastructure. Normal AWS server administration uses standard OpenSSH over Tailscale; the Tailscale SSH server feature is disabled. Public-IP presence is independent from administrative exposure.

**Infrastructure identities (latest canonical evidence 2026-08-18):**
```
  dokploy            100.71.47.24    dokploy.tail3c0f0a.ts.net       Tailscale identity for AWS resource dokploy-aws
  cloudpanel         100.121.12.36   cloudpanel.tail3c0f0a.ts.net    Tailscale identity for AWS resource cloudpanel-aws
  vm-supabase       100.71.31.88    Tailscale identity `supabase`; self-hosted Supabase + subnet 10.0.2.0/24
  office            100.86.124.66   local control host
  macbook           100.70.12.18    local operator host
```

Management-plane invariants:
- Tailscale identities `dokploy` and `cloudpanel` map to AWS resources `dokploy-aws` and `cloudpanel-aws`; both use OpenSSH over Tailscale and normal public TCP/22 is blocked.
- Tailscale node-key expiry is disabled for permanent infrastructure identities `dokploy`, `cloudpanel`, and `supabase` (underlying servers/resources `dokploy-aws`, `cloudpanel-aws`, and `vm-supabase`).
- Both AWS production nodes are currently user-owned by `info@prochat.tools`, untagged, and receive effective connectivity through the existing wildcard grant; no ACL/tag redesign was part of the 2026-08-18 standardization.
- CloudPanel TCP/8443 remains on the Tailscale management path. Final closure evidence shows host UFW TCP/22 allows Anywhere, while the Lightsail perimeter restricts TCP/22 to `lightsail-connect` only; ordinary public SSH remains blocked.
- Dokploy and CloudPanel share the same management plane but intentionally use different application-ingress models.

The older 2026-08-16 `7 registered / 6 active` tailnet count is historical observation evidence only and is not a durable architecture invariant after CloudPanel enrollment.

The `-aws` suffix was a temporary Tailscale collision differentiator while the former Azure
Dokploy/CloudPanel nodes coexisted with their AWS replacements. After the Azure Dokploy estate
was decommissioned, Tailscale identities were canonicalized to `dokploy` and `cloudpanel`; the
underlying AWS resource names remain `dokploy-aws` and `cloudpanel-aws`.

**Subnet route:** `vm-supabase` (Tailscale identity `supabase`) advertises `10.0.2.0/24`. Application containers
holding `DATABASE_URL`/`SYSTEM_DATABASE_URL` pointing to `10.0.2.4:5433` reach PostgreSQL via
this route. DATABASE_URL endpoint distribution (OBSERVED-VERIFIED, F-APP-001 / F-NET-006):
- 14 of 24 apps: `10.0.2.4:5433` (subnet route)
- 1 app: `100.71.31.88:5433` (fala — Tailscale IP direct, functionally equivalent)
- 1 app: Supabase Cloud (ProKit dev — external, not self-hosted)
- 1 app: `localhost:5433` (SaaSKit dev — local compose postgres)
- 7 apps: no DATABASE_URL in Dokploy config (may access data via other mechanisms)

### 3.2 Public Ingress (Cloudflare Tunnel)

All production HTTP/HTTPS traffic enters through Cloudflare Tunnel. `cloudflared` maintains an
**outbound** connection from the production server to Cloudflare's edge.

```
Browser (HTTPS/TLS)
  → Cloudflare CDN/WAF (TLS edge termination — Cloudflare's own certificate)
  → Cloudflare Tunnel (encrypted outbound tunnel from cloudflared)
  → cloudflared daemon (on production server)
  → [origin connection to Traefik — see TLS note below]
  → Traefik v3.6.7 (routing, LetsEncrypt TLS cert management)
  → Application container
```

**TLS boundary clarification:**
- The browser's TLS connection terminates at Cloudflare's edge. The browser sees Cloudflare's
  certificate, not Traefik's LetsEncrypt certificate.
- Cloudflare Tunnel carries traffic between Cloudflare's edge and `cloudflared`. This segment is
  independently encrypted by the tunnel protocol.
- From `cloudflared` to Traefik: the exact protocol (HTTP or HTTPS) used to reach Traefik's
  origin port is configured in the Cloudflare Zero Trust dashboard and was **not determinable
  from local evidence alone**. The Traefik config supports both `web` (:80) and `websecure` (:443
  with LetsEncrypt TLS).
- Traefik's LetsEncrypt certificates (`acme.json`, stored at
  `/etc/dokploy/traefik/dynamic/acme.json`) serve the `websecure` entrypoint and are used for
  the HTTP-01 ACME challenge. LetsEncrypt HTTP-01 challenges require port 80 to be reachable —
  this is satisfied because cloudflared routes HTTP traffic through the tunnel.

**Tunnel properties:**
- Type: Token-based (`cloudflared tunnel run --token <TOKEN>`)
- Token is stored in `/etc/systemd/system/cloudflared.service.staged` on AWS (masked)
- The same tunnel token currently active on Azure can be used on AWS — no Cloudflare
  dashboard configuration change is required at cutover
- **CRITICAL: Both Azure and AWS could become active Cloudflare Tunnel connectors simultaneously
  if cloudflared were started on both with the same token. Never run both concurrently.
  Stop Azure connector. Verify it is offline. Then start AWS connector.**

### 3.3 Docker Overlay Network

Traefik discovers services via Docker socket labels on the `dokploy-network` overlay network.
Application containers on the same network communicate via Docker DNS resolution. Applications
reach Supabase via the host-level Tailscale route (not via the Docker overlay network).

**Redeploy invariant:** Public availability is not redeploy-safe until the live service labels or
managed file-provider route, Traefik router, backend status, `dokploy-network` membership, TLS,
and external HTTPS response have all been re-verified after service recreation. See
`operations/standards/redeploy-ingress-persistence.md` for the acceptance gate.

---

## 4. Firewall & Access Model

### 4.1 AWS Lightsail Firewall (verified 2026-08-16)

Lightsail firewall rules as queried from AWS CLI:

| Port | Protocol | Access | CIDR |
|------|----------|--------|------|
| 22 (SSH) | TCP | Restricted | 5.249.73.210/32 (operator /32 only) |

Ports 80 (HTTP) and 443 (HTTPS) are **not in the ruleset** (effectively blocked — absent from
Lightsail inbound rules). Public web traffic is possible ONLY via Cloudflare Tunnel.

**Safety note:** The absence of port 80/443 from the Lightsail firewall prevents direct-IP
origin access to Traefik. However, this firewall rule does NOT prevent traffic from arriving
via an active Cloudflare Tunnel — cloudflared opens an **outbound** TCP connection that is not
subject to inbound port restrictions. The `cloudflared MASKED` state is the actual gate for
public tunnel traffic.

### 4.2 Azure Access

**Tailscale SSH to Azure:** Blocked by tailnet ACL policy. The operator's machines cannot reach
Azure via Tailscale overlay SSH.

**Direct SSH via Azure public IP:** Azure NSG `vm-dokploy-nsg` (rg-apps-dokploy) has two SSH rules
(OBSERVED-VERIFIED 2026-08-16 via `az network nsg show`):

| Rule | Priority | Direction | Access | Port | Source |
|------|----------|-----------|--------|------|--------|
| SSH (deny one IP) | 300 | Inbound | DENY | 22 | 161.230.249.46 |
| open-port-22 | 900 | Inbound | ALLOW | 22 | * (any) |

In Azure NSG, lower priority number = higher precedence. Result: **port 22 is publicly reachable
from the internet** (except the one denied IP). Security depends on SSH key authentication.

**Operator access:** All Claude-orchestrated Azure-side operations use `az vm run-command invoke`
(Azure Run Command via Azure API) which does not require SSH key distribution or open network paths.

Azure production `cloudflared` is active and handles all public ingress.

### 4.3 Supabase Access

Self-hosted Supabase is private and reachable through Tailscale. Two observed PostgreSQL
connection paths (OBSERVED-VERIFIED 2026-08-16):

- **Path A:** `10.0.2.4:5433` — via Tailscale-advertised subnet route 10.0.2.0/24 (14 of 24 apps)
- **Path B:** `100.71.31.88:5433` — direct Tailscale node IP (fala — 1 app)

Both paths reach the same PostgreSQL server. Neither endpoint is publicly routable from the
internet per current evidence. Only nodes joined to the Tailscale network can reach either path.
An AWS workload container can write to Supabase through Tailscale **even when cloudflared remains
masked** — the two controls are entirely independent.

### 4.4 SSH Access (AWS Lightsail)

AWS Lightsail SSH uses short-lived ECDSA certificates issued by the Lightsail API. From
migration evidence, certificate validity is approximately **13 minutes**. To re-establish:

```bash
RAW=$(aws lightsail get-instance-access-details --instance-name dokploy-aws --region eu-west-2)
# Extract privateKey → /tmp/lsl-key (chmod 600)
# Extract certKey → /tmp/lsl-key-cert.pub
ssh -o IdentitiesOnly=yes -i /tmp/lsl-key ubuntu@18.135.240.168
```

SSH is restricted to CIDR `5.249.73.210/32` (operator IP). Access from other IPs requires
either a Lightsail firewall rule change or access via Tailscale (`dokploy.tail3c0f0a.ts.net`).

---

## 5. Dokploy Platform Architecture

### 5.1 Platform Stack

Dokploy runs as a Docker Swarm service on both Azure and AWS. The platform stack (4 Swarm
services) is always running. Application workloads run as additional Swarm services or Compose
projects managed by Dokploy.

| Service | Image | Digest | Notes |
|---------|-------|--------|-------|
| dokploy.1 | dokploy/dokploy:latest | sha256:72c082d05447 | Platform; pinned in Phase 3C3 |
| dokploy-traefik.1 | traefik:v3.6.7 | sha256:a9890c898f37 | Reverse proxy + TLS |
| dokploy-postgres.1 | postgres:16 | sha256:5a65324fe84d | Control-plane DB (12 MB); Dokploy-only |
| dokploy-redis.1 | redis:7 | sha256:ba125ee995db | Queue + session cache |

**Traefik config** (`/etc/dokploy/traefik/traefik.yml`):
- Providers: Docker Swarm + file directory (`/etc/dokploy/traefik/dynamic/`)
- Entrypoints: `web` (:80), `websecure` (:443 with HTTP/3)
- TLS: LetsEncrypt ACME (`httpChallenge` on `web` entrypoint)
- ACME storage: `/etc/dokploy/traefik/dynamic/acme.json`
- Access log: `/etc/dokploy/traefik/dynamic/access.log` (JSON, buffered)

**Dokploy data-root:** `/mnt/data-dokploy/`
- `/mnt/data-dokploy/docker/` — Docker images, volumes, overlays
- `/etc/dokploy/` — Dokploy configuration, compose YAMLs, application code
- `/etc/dokploy/applications/` — Application source directories
- `/etc/dokploy/compose/` — Compose project directories

### 5.2 Dokploy Projects (8)

| projectId | Name | Contents |
|-----------|------|----------|
| YMzA8RYJdczAp_KYHONFG | Boilerplates | ProKit Dev, SaaSKit Dev |
| hXaySDURUd2i0enErtSwx | Clients | JPV Bootcamp apps |
| C1WHQrOjpC3Ysfc-V6sBU | Databases | Standalone DB containers |
| kNa9UD808a88taxtLmcnQ | Demo | Vault Legal frontend + API |
| 2VaDvNViTYD_asKA_h6sb | Ops | n8n, umami, ory, free-resend |
| Weq2uY4KM9IKizVAw_RE- | SaaS | Proofly, Status Link, Egg Cooker |
| VGUe7AzRsqLFv_wSPDCQ- | WaaS | Workbench, fala |
| SPX-3TSitP84hxmp51gDT | Web | ProChat, Cedula, Oliveto, Yeshua Academy, Via di Eden, JCCP, Says the Bible, ProChat Accountant |

### 5.3 Ory Kratos (Standalone Container)

Ory Kratos runs as a standalone container alongside the
`compose-index-haptic-firewall-rlwj48` compose project.

- Image: `oryd/kratos:v1.3.1` (sha256:fe2428f103a6)
- Ports: `0.0.0.0:4433-4434→4433-4434/tcp`
- DSN: Supabase `ory_prod` logical database (via Tailscale)
- SQLite volume exists but is empty — all auth state is in Supabase
- Status on AWS: STOPPED

### 5.4 Shadow Suppression State (AWS)

All AWS workloads are suppressed:

| Suppression | Count | Value |
|-------------|-------|-------|
| Application autoDeploy | 24 | false |
| Compose autoDeploy | 17 | false |
| Schedule enabled | 1 | false (jpv-email-queue) |
| Application Swarm services | 0 | (none created, except vault-legal at 0/0 replicas) |
| Application containers running | 0 | |

---

## 6. Application Inventory

24 applications across 8 Dokploy projects.

**Classification key:**
- **CURRENT-ACTIVE** — operational, image present, ready for cutover
- **CURRENT-INACTIVE** — source-only, not actively deployed
- **KNOWN-BROKEN-SOURCE-PARITY** — was broken on Azure before migration; exempted from image requirement

| # | appName | Human Name | Image | Classification | Supabase Writer | Local DB |
|---|---------|------------|-------|---------------|-----------------|----------|
| 1 | app-index-haptic-port-m88k9z | Workbench | ghcr.io/stevewesthoek/buildflow@sha256:4a657 (pinned) | CURRENT-ACTIVE | NO | volume only |
| 2 | app-transmit-online-hard-drive-of1m9k | Workbench Staging | ghcr.io/stevewesthoek/buildflow@sha256:4a657 (pinned) | CURRENT-ACTIVE | NO | volume only |
| 3 | web-cedula-b1gepj | Cedula | ghcr.io/prochattools/cedula:latest | CURRENT-ACTIVE | YES | tenant_cedula |
| 4 | apps-saas-egg-cooker-qtutkp | Egg Cooker | nixpacks (github) | CURRENT-INACTIVE | NO | — |
| 5 | app-override-online-interface-1wzjpb | fala | ghcr.io/prochattools/fala:latest | KNOWN-BROKEN-SOURCE-PARITY | YES | fala (Supabase) |
| 6 | apps-internal-free-resend-izqnvr | Free Resend | locally built (github nixpacks) | CURRENT-ACTIVE | NO | tenant_resend |
| 7 | web-public-jccp-holdings-pvtist | JCCP Holdings | ghcr.io/prochattools/jccp-holdings:latest | CURRENT-ACTIVE | NO | — |
| 8 | web-public-jpv-bootcamp-l66egq | JPV Bootcamp | ghcr.io/prochattools/jpv-bootcamp:latest | CURRENT-ACTIVE | YES | tenant_jpvbootcamp |
| 9 | clients-jpv-bootcamp-app-tp9xrk | JPV Bootcamp Payload CMS | ghcr.io/prochattools/jpv-bootcamp:a0c32276 (pinned SHA) | CURRENT-ACTIVE | YES | jpvbootcamp |
| 10 | web-public-olivetoorganizing-zwthea | Oliveto Organizing | ghcr.io/prochattools/oliveto-organizing:latest | CURRENT-ACTIVE | YES | tenant_olivetoorganizing |
| 11 | web-public-prochat-avejzq | ProChat | ghcr.io/prochattools/prochat:latest | CURRENT-ACTIVE | YES | tenant_prochat |
| 12 | web-public-prochat-accountant-zrekal | ProChat Accountant | locally built (source present, registry broken) | KNOWN-BROKEN-SOURCE-PARITY | YES | accountant (Supabase) |
| 13 | boilerplates-prokit-dev-s5f8yz | ProKit Dev | nixpacks (github) | CURRENT-INACTIVE | NO | — |
| 14 | templates-prokit-kcde8a | ProKit Studio | ghcr.io/prochattools/prokit-studio:latest (missing) | KNOWN-BROKEN-SOURCE-PARITY | NO | tenant_prokitstudio |
| 15 | saas-proofly-ixcmnz | Proofly | ghcr.io/prochattools/proofly:latest | CURRENT-ACTIVE | YES | proofly (Supabase) |
| 16 | boilerplates-saaskit-dev-ixnolx | SaaSKit Dev | nixpacks (github) | CURRENT-INACTIVE | NO | — |
| 17 | templates-saaskit-3ynx5a | SaaSKit Studio | ghcr.io/prochattools/saaskit-studio:latest (missing) | KNOWN-BROKEN-SOURCE-PARITY | NO | tenant_saaskitstudio |
| 18 | web-says-the-bible-ing7sx | Says the Bible | ghcr.io/prochattools/says-the-bible:latest | CURRENT-ACTIVE | YES | saysthebible (Supabase) |
| 19 | apps-saas-status-link-dw1c6j | Status Link | ghcr.io/prochattools/statuslink:latest | CURRENT-ACTIVE | YES | statuslink (Supabase) |
| 20 | demo-vault-legal-wtpg0l | Vault Legal | ghcr.io/prochattools/vault-legal-frontend:latest | CURRENT-ACTIVE | NO | — |
| 21 | demo-vault-legal-api-drzgfx | Vault Legal API | ghcr.io/prochattools/vault-legal-backend:latest | CURRENT-ACTIVE | YES | vault_legal (Supabase) |
| 22 | web-public-viadieden-kttqn4 | Via di Eden | ghcr.io/prochattools/via-di-eden:f2d0650e (pinned SHA) | CURRENT-ACTIVE | YES | tenant_viadieden |
| 23 | web-yeshua-academy-ariw56 | Yeshua Academy | ghcr.io/yeshuaacademy/yeshuaacademy:latest | CURRENT-ACTIVE | NO | — |
| 24 | apps-saas-open-fund-vdymfu | Yeshua Academy Finance | ghcr.io/yeshuaacademy/finance:latest | CURRENT-ACTIVE | YES | finance (Supabase) |

**Summary (from rows above): 17 CURRENT-ACTIVE · 3 CURRENT-INACTIVE · 4 KNOWN-BROKEN-SOURCE-PARITY = 24 ✓**

### Per-Workload Image & Source Authority

| Application | Reproducible Source of Truth | Mutable? |
|-------------|------------------------------|---------|
| Workbench, Workbench Staging | Pinned digest sha256:4a657686731b in GHCR | NO — pinned |
| Via di Eden | Commit SHA tag `f2d0650e` in GHCR | NO — pinned |
| JPV Bootcamp Payload CMS | Commit SHA `a0c32276` in GHCR | NO — pinned (confirm before cutover) |
| JPV Bootcamp (public site) | `ghcr.io/prochattools/jpv-bootcamp:latest` | YES — re-pull at cutover |
| ProChat, Cedula, Oliveto, Says the Bible, Status Link, Proofly, JCCP, Vault Legal (+API), Via di Eden, Yeshua Academy, Yeshua Academy Finance, fala | `ghcr.io/<org>/<repo>:latest` — 11 apps with mutable tag | YES — re-pull at cutover |
| Free Resend | GitHub source + nixpacks build (Dokploy build pipeline) | YES — rebuild from current GitHub source on AWS |
| ProChat Accountant | Dockerfile in `/etc/dokploy/applications/web-public-prochat-accountant-zrekal/code/` | YES — `docker build` at cutover |
| ProKit Studio, SaaSKit Studio | Registry image missing; source-parity exception; remain stopped | N/A |
| Egg Cooker, ProKit Dev, SaaSKit Dev | GitHub source + nixpacks; inactive; not deployed | N/A |

**Historical note:** Before the 2026-08-17 cutover, Azure Dokploy was authoritative for image/tag
choices. AWS is now the sole production Dokploy authority; this historical migration note must
not be used to select current images.

**Application → Supabase connection map (OBSERVED-VERIFIED 2026-08-16 from `application.env`):**
Full map in evidence register (F-APP-001). Key notes:
- `boilerplates-prokit-dev-s5f8yz`: connects to **Supabase Cloud** (`aws-1-eu-west-1.pooler.supabase.com`), NOT self-hosted Supabase. Not a NO-DUAL-WRITER concern.
- `boilerplates-saaskit-dev-ixnolx`: connects to `localhost:5433` (local compose postgres container). Not a NO-DUAL-WRITER concern.
- `fala` (`app-override-online-interface-1wzjpb`): connects via `100.71.31.88:5433` (Tailscale IP) not `10.0.2.4:5433` (subnet route). Same physical server; functionally equivalent.
- `clients-jpv-bootcamp-app-tp9xrk`: `jpvbootcamp` DB, `jpvbootcamp_staging` schema. `jpvbootcamp_staging_user` is a distinct Supabase role (confirmed active connections).

---

## 7. Compose Inventory

17 Compose projects.

### 7.1 Application Compose Projects

| appName | Name | Services | Supabase Writer | Notes |
|---------|------|----------|-----------------|-------|
| apps-internal-n8n-cvjx2s | n8n | n8n:2.4.7 + postgres:17-alpine | NO | Local DB only; n8n container stopped on AWS |
| compose-index-haptic-firewall-rlwj48 | ory | oryd/kratos:v1.3.1 | YES (ory_prod) | Auth service; container stopped on AWS |
| ops-umami-sqswbj | umami | umami:3.0.3 | YES (analytics) | Analytics; running on AWS (`ops-umami-sqswbj-umami-1`); file-provider Traefik route restored + acceptance PASS 2026-08-19; code-umami-1 retired |

### 7.2 Local Tenant Database Compose Projects (14)

Each runs a single `postgres:15` container serving the local tenant database.

| appName | Database Name | Tables (as of Phase 3C4) | Phase 3A Drift |
|---------|--------------|--------------------------|---------------|
| compose-bypass-optical-alarm-tb4ukd | tenant_prochat | 7 | ZERO ✓ |
| compose-connect-wireless-application-d1n939 | tenant_viadieden | 0 | ZERO ✓ |
| compose-copy-auxiliary-protocol-3gfh3x | tenant_statuslink | 19 | ZERO ✓ |
| compose-copy-cross-platform-bus-wojn3n | tenant_prokitstudio | 2 | ZERO ✓ |
| compose-copy-open-source-interface-fkhqrw | tenant_saysthebible | 21 | ZERO ✓ |
| compose-copy-redundant-capacitor-zc4esw | tenant_prokit | 2 | ZERO ✓ |
| compose-generate-mobile-microchip-tksvis | openfund | 24 | ZERO ✓ |
| compose-generate-wireless-bandwidth-v7bvut | tenant_cedula | 5 | ZERO ✓ |
| compose-hack-open-source-driver-mmchh4 | tenant_jpvbootcamp | 12 | ZERO ✓ |
| compose-input-open-source-bandwidth-droye2 | jpvbootcamp | 2 | ZERO ✓ |
| compose-navigate-optical-monitor-vi714i | tenant_olivetoorganizing | 0 | ZERO ✓ |
| compose-quantify-1080p-system-tp1q5f | tenant_saaskitstudio | 4 | ZERO ✓ |
| compose-reboot-cross-platform-driver-6l6dun | tenant_resend | 6 | ZERO ✓ |
| compose-synthesize-bluetooth-panel-tg5mhy | tenant_saaskit | 4 | ZERO ✓ |

**Historical drift status (2026-08-16):** ZERO against Phase 3A manifests. AWS containers were
frozen and Azure production continued writing to its local copies before cutover. The migration
dump/restore requirement was completed during cutover; Azure Dokploy no longer exists.

### 7.3 Scheduled Jobs (1)

| scheduleId | Name | cron | Enabled (shadow) | Restore to |
|------------|------|------|-----------------|------------|
| vyN0X3Y6OpO5b_cZbS0r3 | jpv-email-queue | `*/2 * * * *` | false | true (per Azure source state) |

---

## 8. Data Architecture

### 8.1 Three Distinct Data Concepts

| Concept | What it is | Authoritative Source | Independent copies? |
|---------|-----------|---------------------|-------------------|
| A — Dokploy Control Plane | postgres:16 container; stores Dokploy operational state, app configs, env vars | **AWS Dokploy** — current | Historical Azure copy deleted with Azure Dokploy |
| B — Local Tenant Databases | postgres:15 containers (14) + postgres:17 (n8n); per-application runtime data | **AWS Dokploy** — current | Historical Azure copies were reconciled during cutover |
| C — Supabase | One shared self-hosted PostgreSQL 15.8 server reachable through Tailscale by workloads configured to use it | **Supabase** (always, single instance) | NO — there is only one instance; both environments connect to it |

### 8.2 USER-PROPOSED FUTURE DATA MODEL vs. VERIFIED CURRENT ARCHITECTURE

**USER-PROPOSED FUTURE DATA MODEL** (ADR-003 status: PROPOSED — not yet approved as an
architecture decision separate from Steve's stated intent):
```
ONE logical application database (e.g., a single Supabase PostgreSQL database)
+ EXPLICIT per-application schemas within that database
No tenant_ prefix as an architectural standard
```

**VERIFIED CURRENT ARCHITECTURE** (OBSERVED-VERIFIED 2026-08-16):
- 24 logical databases exist in Supabase (`CREATE DATABASE` — each is a separate PostgreSQL DB)
- Most production applications connect to a dedicated per-app logical database (cedula→cedula, prochat→prochat, etc.)
- The `postgres` system database contains 36 application/Supabase-relevant schemas (OBSERVED-VERIFIED 2026-08-16)
  (excludes PostgreSQL internal schemas: pg_catalog, information_schema, pg_toast, pg_temp_*, pg_toast_temp_*)
- Many applications have both a dedicated logical database and a similarly application-mapped `tenant_*` schema present in the `postgres` logical database. Whether current application runtime actively uses both stores is not fully verified.
- The `tenant_` prefix appears at both DB level (tenant_prokit, tenant_saaskit) and schema level (16+ schemas)
- Several databases and schemas are classified as LEGACY-CANDIDATE or UNKNOWN because no active dependency has yet been identified

**The current system does NOT match the proposed future model.** The verified current architecture
is the authoritative state of the system as observed. It is not an intermediate step toward any
approved target, and is not to be labeled as transitional without separate approval. Any future
convergence requires explicit planning, separate approval, and post-cutover stability confirmation.

`tenant_*` schemas contain persisted data and application-mapped objects. Current runtime
dependency is not fully verified. Do not alter, rename, or drop them before explicit
post-cutover investigation and approval.

### 8.3 Local Database Inventory (16 total — all on Dokploy hosts)

These are Docker-volume-backed postgres containers running on the Dokploy host. They are
**not part of Supabase**. Azure has the live copies; AWS has frozen snapshot copies.

| # | Container / Volume | DB Name | PG Version | Tables | Owner |
|---|-------------------|---------|-----------|--------|-------|
| 1 | dokploy-postgres | dokploy | postgres:16 | 62 tables | Dokploy control-plane |
| 2 | apps-internal-n8n-cvjx2s-postgres-1 | n8n | postgres:17-alpine | 54 tables | n8n automation |
| 3 | compose-bypass-optical-alarm-tb4ukd | tenant_prochat | postgres:15 | 7 | ProChat |
| 4 | compose-connect-wireless-application-d1n939 | tenant_viadieden | postgres:15 | 0 | Via di Eden |
| 5 | compose-copy-auxiliary-protocol-3gfh3x | tenant_statuslink | postgres:15 | 19 | Status Link |
| 6 | compose-copy-cross-platform-bus-wojn3n | tenant_prokitstudio | postgres:15 | 2 | ProKit Studio |
| 7 | compose-copy-open-source-interface-fkhqrw | tenant_saysthebible | postgres:15 | 21 | Says the Bible |
| 8 | compose-copy-redundant-capacitor-zc4esw | tenant_prokit | postgres:15 | 2 | ProKit |
| 9 | compose-generate-mobile-microchip-tksvis | openfund | postgres:15 | 24 | Yeshua Academy Finance |
| 10 | compose-generate-wireless-bandwidth-v7bvut | tenant_cedula | postgres:15 | 5 | Cedula |
| 11 | compose-hack-open-source-driver-mmchh4 | tenant_jpvbootcamp | postgres:15 | 12 | JPV Bootcamp |
| 12 | compose-input-open-source-bandwidth-droye2 | jpvbootcamp | postgres:15 | 2 | JPV Bootcamp Payload CMS |
| 13 | compose-navigate-optical-monitor-vi714i | tenant_olivetoorganizing | postgres:15 | 0 | Oliveto Organizing |
| 14 | compose-quantify-1080p-system-tp1q5f | tenant_saaskitstudio | postgres:15 | 4 | SaaSKit Studio |
| 15 | compose-reboot-cross-platform-driver-6l6dun | tenant_resend | postgres:15 | 6 | Free Resend |
| 16 | compose-synthesize-bluetooth-panel-tg5mhy | tenant_saaskit | postgres:15 | 4 | SaaSKit |

### 8.4 Supabase Database Catalog (24 logical databases)

**Classification categories:**

| Category | Meaning |
|----------|---------|
| SUPABASE/POSTGRES SYSTEM | Owned and managed by Supabase infrastructure |
| CURRENT-ACTIVE APPLICATION DATABASE | Confirmed connected to a production application via observed DATABASE_URL |
| PROBABLE TOOLING | Created by tooling; purpose reasonably inferred but not fully verified |
| LEGACY-CANDIDATE | No identified active application; investigate before any action post-cutover |
| UNKNOWN | Origin and usage undetermined from available evidence |

| Database | Size | Classification | Connected Application |
|----------|------|---------------|----------------------|
| _supabase | 2079 MB | SUPABASE/POSTGRES SYSTEM | Supabase infrastructure |
| postgres | 117 MB | SUPABASE/POSTGRES SYSTEM | Contains 36 application/Supabase-relevant schemas (OBSERVED-VERIFIED 2026-08-16) — see Section 8.5 |
| accountant | 8197 kB | CURRENT-ACTIVE APPLICATION DATABASE | ProChat Accountant — owner: accountant_user (OBSERVED-VERIFIED; not supabase_admin) |
| analytics | 11 MB | CURRENT-ACTIVE APPLICATION DATABASE | Umami analytics |
| cedula | 8205 kB | CURRENT-ACTIVE APPLICATION DATABASE | Cedula |
| fala | 7957 kB | CURRENT-ACTIVE APPLICATION DATABASE | fala (applicationStatus=error on Azure; no active connections observed) |
| finance | 20 MB | CURRENT-ACTIVE APPLICATION DATABASE | Yeshua Academy Finance / OpenFund — owner: postgres (OBSERVED-VERIFIED; not supabase_admin) |
| jpvbootcamp | 27 MB | CURRENT-ACTIVE APPLICATION DATABASE | JPV Bootcamp (Payload CMS + public site; prod + staging schemas) |
| olivetoorganizing | 7885 kB | CURRENT-ACTIVE APPLICATION DATABASE | Oliveto Organizing |
| openfund | 9965 kB | LEGACY-CANDIDATE / UNKNOWN | No application DATABASE_URL points here (OBSERVED-VERIFIED 2026-08-16). Finance app connects to `finance` DB. Origin UNKNOWN — may be orphaned predecessor. |
| ory_prod | 9933 kB | CURRENT-ACTIVE APPLICATION DATABASE | Ory Kratos auth — owner: ory_user (OBSERVED-VERIFIED; not supabase_admin) |
| prochat | 8333 kB | CURRENT-ACTIVE APPLICATION DATABASE | ProChat |
| prokitstudio | 8061 kB | CURRENT-ACTIVE APPLICATION DATABASE | ProKit Studio |
| proofly | 8205 kB | CURRENT-ACTIVE APPLICATION DATABASE | Proofly — owner: proofly_user (OBSERVED-VERIFIED; not supabase_admin) |
| resend | 9685 kB | CURRENT-ACTIVE APPLICATION DATABASE | Free Resend |
| saaskitstudio | 7989 kB | CURRENT-ACTIVE APPLICATION DATABASE | SaaSKit Studio |
| saysthebible | 10 MB | CURRENT-ACTIVE APPLICATION DATABASE | Says the Bible |
| statuslink | 8805 kB | CURRENT-ACTIVE APPLICATION DATABASE | Status Link |
| vault_legal | 8645 kB | CURRENT-ACTIVE APPLICATION DATABASE | Vault Legal API |
| viadieden | 7949 kB | CURRENT-ACTIVE APPLICATION DATABASE | Via di Eden |
| tenant_prokit | 8013 kB | UNKNOWN / LEGACY-CANDIDATE | No application DATABASE_URL connects to this database (OBSERVED-VERIFIED, F-UNK-005). Usage unverified. `tenant_` prefix at DB level is naming convention, not proof of status. Do not drop without investigation. |
| tenant_saaskit | 8181 kB | UNKNOWN / LEGACY-CANDIDATE | No application DATABASE_URL connects to this database (OBSERVED-VERIFIED, F-UNK-005). Usage unverified. `tenant_` prefix at DB level is naming convention, not proof of status. Do not drop without investigation. |
| finance_shadow | 7829 kB | PROBABLE TOOLING — PURPOSE NOT FULLY VERIFIED | Name suggests Prisma `migrate dev` shadow DB. Not confirmed. Do not drop without verifying Finance app migration workflow (see Q7). |
| finance\ | 10 MB | UNKNOWN | Backslash in DB name (creation error?); origin and application connection unknown |

**Note on CURRENT-ACTIVE APPLICATION DATABASE classification:** These databases are confirmed
connected to production applications via observed DATABASE_URL evidence (OBSERVED-VERIFIED
2026-08-16). "Current-active" means actively used — it does NOT mean the database structure
aligns with any proposed future model. The current per-app-dedicated-database architecture is
the VERIFIED CURRENT STATE, not an intermediate step toward any approved target.

### 8.5 Supabase postgres Database — Schema Catalog (36 application/Supabase-relevant schemas — OBSERVED-VERIFIED 2026-08-16)

The `postgres` logical database (117 MB) contains 36 application/Supabase-relevant schemas (OBSERVED-VERIFIED 2026-08-16), plus PostgreSQL-internal schemas excluded from that count.

**Schema count reconciliation (OBSERVED-VERIFIED 2026-08-16):**
Query of `pg_namespace` returned 67 total rows. Excluding PostgreSQL-internal schemas
(pg_catalog, pg_toast, information_schema, pg_temp_*, pg_toast_temp_*) yields 36.
Category arithmetic: **12 Supabase-internal + 16 tenant_* application-mapped + 3 non-tenant application-mapped + 5 legacy-candidate = 36 ✓**

Note: Phase 3C7 reported "35" — that count excluded `information_schema` from display
(which is PostgreSQL-standard, not Supabase-specific). Corrected to 36 in Phase 3C8.

**Supabase Internal Schemas (12):**
`_realtime`, `auth`, `extensions`, `graphql`, `graphql_public`, `net`, `pgbouncer` (confirmed present),
`public` (mixed-ownership), `realtime`, `storage`, `supabase_functions`, `vault`

**Application-Mapped Schemas — `tenant_*` naming (16) — CURRENT RUNTIME DEPENDENCY NOT FULLY VERIFIED:**

| Schema | Owner | Tables | Application |
|--------|-------|--------|-------------|
| tenant_cedula | supabase_admin | 5 | Cedula |
| tenant_jpvbootcamp | supabase_admin + postgres | 12 | JPV Bootcamp |
| tenant_olivetoorganizing | postgres | 0 | Oliveto Organizing |
| tenant_openfund | mcp_manager | 13 | Yeshua Academy Finance |
| tenant_prochat | tenant_prochat_user | 7 | ProChat |
| tenant_procore | tenant_procore_user | 2 | ProChat Core (subscriptions) |
| tenant_prokit | tenant_prokit_user | 2 | ProKit (subscriptions) |
| tenant_prokitcore | tenant_prokitcore_user | 2 | ProKit Core (subscriptions) |
| tenant_prokitstudio | tenant_prokitstudio_user | 2 | ProKit Studio (subscriptions) |
| tenant_resend | tenant_resend_user | 6 | Free Resend |
| tenant_saaskit | tenant_saaskit_user | 4 | SaaSKit |
| tenant_saaskitcore | tenant_saaskitcore_user | 4 | SaaSKit Core (subscriptions) |
| tenant_saaskitstudio | tenant_saaskitstudio_user | 4 | SaaSKit Studio (subscriptions) |
| tenant_saysthebible | saysthebible_user | 21 | Says the Bible |
| tenant_statuslink | tenant_statuslink_user | 19 | Status Link |
| tenant_viadieden | postgres | 0 | Via di Eden |

These schemas exist with application name mappings and contain tables with data. No DATABASE_URL
in the observed Dokploy application config points directly to the `postgres` database using these
schemas — the observed DATABASE_URLs connect to dedicated logical databases (e.g., `cedula`, `prochat`).
Current active use of these schemas is NOT directly evidenced from the DATABASE_URL inventory.
Applications may access them through additional connection strings, SDK config, or other env vars
beyond the primary `DATABASE_URL` field; this cannot be ruled out without deeper investigation.
`tenant_*` naming exists in the current environment. Its historical relationship to the
dedicated-database pattern is not established by current evidence. Naming alone proves
neither legacy nor obsolescence. Do not rename or drop without investigation.

**Existing Schemas — non-`tenant_*` naming (3) — CURRENT RUNTIME DEPENDENCY NOT FULLY VERIFIED:**

| Schema | Owner | Tables | Application |
|--------|-------|--------|-------------|
| finance | supabase_admin (OBSERVED-VERIFIED 2026-08-16) | 39 | Schema in `postgres` DB — distinct from the `finance` logical database. Finance app connects to the `finance` logical DB; purpose of this postgres-DB schema is UNKNOWN. |
| jpvbootcamp | supabase_admin | 2 | JPV Bootcamp (system schema) |
| ya_finance_schema | ya_finance_user | 11 | Yeshua Academy Finance (variant) |

**Public Schema Notable Tables:**
- `tenants` (postgres-owned) — postgres-owned table; exact current architectural role not independently verified
- `WaitlistSubscriber`, `audiences`, `user_api_keys`, `user_profiles` (supabase_admin)
- `_prisma_migrations` (postgres)

**Orphaned / Legacy Schemas — LEGACY CANDIDATE (5):**

| Schema | Owner | Tables | Classification | Notes |
|--------|-------|--------|---------------|-------|
| tenant_boilerplate | schema:postgres / tables:tenant_boilerplate_user | 4 | LEGACY CANDIDATE | No matching active application (OBSERVED-VERIFIED 2026-08-16) |
| tenant_prochattools | schema:postgres / tables:tenant_prochattools_user | 4 | LEGACY CANDIDATE | Possibly old ProChat deployment (OBSERVED-VERIFIED 2026-08-16) |
| tenant_rebuildwp | mcp_manager | 0 | LEGACY CANDIDATE | Empty; unusual mcp_manager owner; unknown app (OBSERVED-VERIFIED 2026-08-16) |
| financialfreedom_schema | financialfreedom_user | **0** | LEGACY CANDIDATE | EMPTY schema. The 13 financialfreedom_user tables are in the `public` schema, NOT here (OBSERVED-VERIFIED 2026-08-16; Phase 3C4 table count of "12+" was wrong) |
| maybe_schema | maybe_user | **0** | LEGACY CANDIDATE | Empty schema; unknown application (OBSERVED-VERIFIED 2026-08-16; Phase 3C4 said "unknown")

---

## 9. Schema ↔ Application Map

| Application | Local DB (postgres:15) | Supabase Logical DB | tenant_* Schema (postgres) |
|-------------|----------------------|--------------------|-----------------------------|
| Workbench | volume only | — | — |
| Workbench Staging | volume only | — | — |
| Cedula | tenant_cedula | cedula | tenant_cedula |
| Egg Cooker | — | — | — |
| fala | — | fala | — |
| Free Resend | tenant_resend | resend | tenant_resend |
| JCCP Holdings | — | — | — |
| JPV Bootcamp (public) | tenant_jpvbootcamp | jpvbootcamp | tenant_jpvbootcamp |
| JPV Bootcamp Payload CMS | jpvbootcamp | jpvbootcamp | jpvbootcamp |
| Oliveto Organizing | tenant_olivetoorganizing | olivetoorganizing | tenant_olivetoorganizing |
| ProChat | tenant_prochat | prochat | tenant_prochat |
| ProChat Accountant | — | accountant | — |
| ProKit Dev | — | — | — |
| ProKit Studio | tenant_prokitstudio | prokitstudio | tenant_prokitstudio |
| Proofly | — | proofly | — |
| SaaSKit Dev | — | — | — |
| SaaSKit Studio | tenant_saaskitstudio | saaskitstudio | tenant_saaskitstudio |
| Says the Bible | tenant_saysthebible | saysthebible | tenant_saysthebible |
| Status Link | tenant_statuslink | statuslink | tenant_statuslink |
| Vault Legal | — | — | — |
| Vault Legal API | — | vault_legal | — |
| Via di Eden | tenant_viadieden | viadieden | tenant_viadieden |
| Yeshua Academy | — | — | — |
| Yeshua Academy Finance | openfund | finance | finance, ya_finance_schema, tenant_openfund |
| n8n | n8n (postgres:17) | — | — |
| Ory Kratos | — | ory_prod | — |
| Umami | — | analytics | — |

**Observed pattern:** Many applications have both a local postgres:15 container AND a dedicated
Supabase logical database AND a correspondingly named `tenant_*` schema in the `postgres` database.
Whether the `tenant_*` schemas in `postgres` are currently read by applications is NOT directly
evidenced by the DATABASE_URL inventory — observed DATABASE_URLs connect to dedicated logical
databases, not to `postgres?schema=tenant_*`. This naming correspondence is observed; its current
operational significance is UNKNOWN without deeper investigation.
No normalization is authorized before explicit post-cutover approval and investigation.

---

## 10. Information Flows

### 10.1 Public Request Flow (Current — Azure Production)

```
Browser (initiates HTTPS)
  → Cloudflare CDN/WAF (TLS edge termination — Cloudflare certificate)
  → Cloudflare Tunnel (cloudflared outbound tunnel from Azure)
  → cloudflared daemon on Azure
  → [origin protocol to Traefik — HTTP or HTTPS, per Cloudflare dashboard config]
  → Traefik v3.6.7 (routes by Host header; manages LetsEncrypt for websecure entrypoint)
  → Application container (Docker Swarm service, on dokploy-network overlay)
  → [Local postgres:15 container if applicable — via overlay network]
  → [Supabase 10.0.2.4:5433 via Tailscale subnet route if applicable]
```

### 10.2 Public Request Flow (Post-Cutover — AWS)

Identical path with `cloudflared` active on AWS instead of Azure. The same Cloudflare Tunnel
token is used — no Cloudflare dashboard configuration change is required at cutover. Each
`cloudflared` process registers as a separate connector/replica on the same tunnel. If both
Azure and AWS cloudflared run concurrently with the same token, Cloudflare distributes traffic
to both connectors — prevent this by stopping Azure connector before starting AWS.

### 10.3 Application → Supabase Flow

```
Application container
  → DATABASE_URL / SYSTEM_DATABASE_URL → 10.0.2.4:5433
  → Host network stack (Tailscale interface on the Docker host)
  → Tailscale mesh
  → Supabase Tailscale node (100.71.31.88)
  → Subnet route 10.0.2.0/24
  → PostgreSQL 15.8 at 10.0.2.4:5433
```

This flow works via Tailscale regardless of cloudflared state. An AWS workload can write to
Supabase even if cloudflared is masked.

### 10.4 n8n Automation Flow

```
Scheduled triggers / webhooks (https://n8n.prochat.tools/webhook/*)
  → Cloudflare Tunnel → cloudflared (systemd) → http://localhost:80
  → Traefik (file-provider route: /etc/dokploy/traefik/dynamic/n8n.yml)
  → http://apps-internal-n8n-cvjx2s-n8n-1:5678 (Docker DNS, dokploy-network)
  → n8n:2.4.7 container (Docker Compose, UID 1000:1000)
  → n8n postgres:17-alpine (local: workflows, credentials, execution logs)
  → External services via HTTP (Resend, Stripe, GHCR, Google Calendar, etc.)
  Note: n8n is NOT connected to Supabase — local postgres only
  Note: n8n is a Compose workload routed via file-provider (not Swarm discovery)
```

### 10.5 Auth Flow (Ory Kratos)

```
Browser → auth.prochat.tools → Traefik → ory-kratos:4433
  → ory-kratos reads/writes identities + sessions in Supabase ory_prod database
  → Returns session cookie
```

### 10.6 Analytics Flow (Umami)

```
Browser page view → umami.prochat.tools → Traefik → umami:3.0.3
  → Writes analytics events to Supabase analytics database
```

---

## 11. Source-of-Truth Matrix

**Current key rule:** AWS Dokploy is the sole authority for operational configuration. The Azure
authority statements in the matrix below are HISTORICAL pre-cutover state, retained to explain
the migration and not current ownership.

| Data Type | Authoritative Source | Notes |
|-----------|---------------------|-------|
| **Supabase data (all 24 databases)** | **Supabase** — always live | Single instance; no sync needed at cutover |
| **Azure local DB data (14 × postgres:15)** | **AWS Dokploy** — current | Historical Azure copy was reconciled during cutover; recover using AWS snapshots/backups |
| **n8n data (postgres:17)** | **AWS Dokploy** — current | Historical Azure copy was reconciled during cutover |
| **Dokploy control-plane config** | **AWS Dokploy** — current | Historical Azure control-plane authority ended at cutover |
| **Application configs (env vars)** | **AWS Dokploy** — current | Historical Azure-only changes are not current authority |
| **Application image/tag choices** | **AWS Dokploy** — current | Reproducible source and AWS deployment state are current authority |
| **Deployment metadata** | **AWS Dokploy** — current | Historical Azure metadata is retained only in migration evidence |
| **Scheduled job state** | **AWS Dokploy** — current | Historical Azure schedule state was reconciled during cutover |
| **Traefik config + TLS certs** | **AWS Dokploy** — current | Historical Azure reference was superseded at cutover; recover through AWS snapshots/backups and reconstruction procedures |
| **Docker images (GHCR)** | **GHCR** | Re-pull mutable :latest at cutover; pinned digests are immutable |
| **Application source code** | **GitHub** | Source repositories under prochattools / yeshuaacademy / stevewesthoek |
| **Locally-built images** | **Source code / build pipeline** | Rebuild on AWS from current source when required |
| **Cloudflare tunnel routing** | **Cloudflare dashboard** | No change expected at cutover |
| **DNS** | **DNS provider** | No change expected; Cloudflare handles routing via tunnel |

**After successful final sync and validation, AWS becomes authoritative.** That handoff happens
during the cutover procedure, not before.

---

## 12. Production Safety Boundary

The production safety boundary is controlled by THREE independent mechanisms:

### Gate 1 — Public Traffic Gate (Cloudflare Tunnel)

```
cloudflared ACTIVE  = Public traffic flows through this server
cloudflared MASKED  = No public tunnel traffic possible from this server
```

AWS cloudflared is active on `dokploy-aws` and is the sole production connector. Any future
maintenance must preserve this single-connector state.

**Final connector state:** The production Cloudflare Tunnel has one active connector on AWS
`dokploy-aws`. The Azure Dokploy connector was removed with the decommissioned host on
2026-08-26; no dual-connector or Azure failover path exists.

### Gate 2 — Direct-Origin Gate (Lightsail Firewall)

TCP ports 80 and 443 are absent from the Lightsail inbound firewall ruleset. This prevents
direct-IP access to Traefik, bypassing Cloudflare's WAF. This does NOT prevent Cloudflare
Tunnel traffic — cloudflared opens an outbound connection that is not subject to inbound rules.

### Gate 3 — Data-Writer Gate (NO-DUAL-WRITER)

AWS production application writers are active on the sole production Dokploy host. This gate
now means that any recovery or maintenance operation must preserve single-writer control.

**Gate 3 is entirely independent of Gates 1 and 2.** An AWS workload can write to Supabase
through Tailscale even if cloudflared is masked and TCP 80/443 are blocked. Therefore the
NO-DUAL-WRITER gate must be enforced and verified separately from Cloudflare state.

**Historical cutover state (as of 2026-08-16):**

```
Azure cloudflared:      ACTIVE → production traffic
AWS cloudflared:        MASKED
AWS production writers: 0
NO-DUAL-WRITER gate:    CLEAR (zero AWS Supabase connections)
```

This block records the pre-cutover gate only. It is superseded by the post-decommission state
above: AWS is active, Azure Dokploy is deleted, and rollback to Azure Dokploy is impossible.

---

## 13. NO-DUAL-WRITER Matrix

**Definition:** A NO-DUAL-WRITER workload is any Azure/AWS workload capable of mutating the same
production Supabase PostgreSQL server or another shared authoritative production resource,
**regardless of which Tailscale endpoint or hostname it uses**. The constraint is based on
SHARED AUTHORITATIVE STATE, not on the specific connection path or IP string.

This means `fala` (which uses `100.71.31.88:5433`) and all workloads using `10.0.2.4:5433`
are equally subject to NO-DUAL-WRITER — both paths reach the same single Supabase service on
VM `vm-supabase`.

Running writers from any second Dokploy/runtime authority against the authoritative Supabase service causes data corruption.

**15 workloads must not run on both Azure AND AWS simultaneously.**

**Independence from Cloudflare:** NO-DUAL-WRITER safety is a Supabase data guarantee. It does
not depend on cloudflared state. An AWS workload that Supabase writes will corrupt data even if
cloudflared is masked and no public traffic reaches it.

### Applications (13)

| # | appName | Application | Supabase Database(s) |
|---|---------|-------------|---------------------|
| 1 | demo-vault-legal-api-drzgfx | Vault Legal API | vault_legal |
| 2 | app-override-online-interface-1wzjpb | fala | fala |
| 3 | apps-saas-open-fund-vdymfu | Yeshua Academy Finance | finance |
| 4 | apps-saas-status-link-dw1c6j | Status Link | statuslink |
| 5 | clients-jpv-bootcamp-app-tp9xrk | JPV Bootcamp Payload CMS | jpvbootcamp |
| 6 | saas-proofly-ixcmnz | Proofly | proofly |
| 7 | web-cedula-b1gepj | Cedula | cedula |
| 8 | web-public-jpv-bootcamp-l66egq | JPV Bootcamp | jpvbootcamp |
| 9 | web-public-olivetoorganizing-zwthea | Oliveto Organizing | olivetoorganizing |
| 10 | web-public-prochat-accountant-zrekal | ProChat Accountant | accountant |
| 11 | web-public-prochat-avejzq | ProChat | prochat |
| 12 | web-public-viadieden-kttqn4 | Via di Eden | viadieden |
| 13 | web-says-the-bible-ing7sx | Says the Bible | saysthebible |

### Compose (1)

| # | appName | Service | Supabase Database |
|---|---------|---------|------------------|
| 14 | ops-umami-sqswbj | Umami | analytics |

### Standalone (1)

| # | Container | Service | Supabase Database |
|---|-----------|---------|------------------|
| 15 | ory-kratos | Ory Kratos | ory_prod |

---

## 14. JPV Bootcamp Active-Development Model (HISTORICAL MIGRATION CONTEXT)

This section describes the pre-cutover Azure development state observed during Phase 3C4. It is
retained for migration history and is not a statement that Azure Dokploy remains active.

JPV Bootcamp was under **active development on Azure** during the migration.

### 14.1 Evidence of Active Development

- 7 concurrent Supabase connections to `jpvbootcamp` database at Phase 3C4 audit
- `jpvbootcamp_staging` schema (100+ tables, live data) present in Supabase — added after Phase 3A
- `:latest` image in GHCR updated frequently
- Azure Dokploy metadata for JPV Bootcamp may differ from AWS snapshot

### 14.2 Deployed Instances

| Instance | appName | Image | Purpose |
|----------|---------|-------|---------|
| Public site | web-public-jpv-bootcamp-l66egq | jpv-bootcamp:latest | Frontend |
| Payload CMS | clients-jpv-bootcamp-app-tp9xrk | jpv-bootcamp:a0c32276 (pinned) | CMS backend |

### 14.3 Final Sync Manifest (JPV Bootcamp)

All items captured at cutover after Azure write/deployment freeze:

| Item | Action | Drift Risk |
|------|--------|------------|
| Dokploy metadata for both JPV apps | Captured in Dokploy PG16 final sync | HIGH |
| Env/config for both JPV apps | Captured in Dokploy PG16 final sync | HIGH |
| `ghcr.io/prochattools/jpv-bootcamp:latest` image | Re-pull from GHCR | HIGH |
| Payload CMS `a0c32276` SHA | Confirm intended version with Steve; re-pull if updated | MEDIUM (CUTOVER-TIME GATE) |
| Local DB: tenant_jpvbootcamp | Fresh pg_dump from Azure → restore to AWS | HIGH |
| Local DB: jpvbootcamp | Fresh pg_dump from Azure → restore to AWS | HIGH |
| Schedule: jpv-email-queue | Confirm `enabled=true` on Azure; re-enable on AWS after writers healthy | MEDIUM |
| Volume: buildflow-data-staging | Sync from Azure if content changed | LOW |
| Volume: /app/public/media (Payload CMS) | Sync from Azure if media uploaded | LOW |
| Supabase jpvbootcamp database | **No action** — Supabase is live and shared | N/A |
| jpvbootcamp_staging schema | **No action** — already in live Supabase | N/A |

### 14.4 Supabase Note

The `jpvbootcamp` Supabase database including the `jpvbootcamp_staging` schema is NOT a sync
problem. Supabase is the single live instance. At the moment AWS connects, it sees all current
data including the staging schema and all development additions.

---

## 15. Final Cutover Data-Sync Inventory

**One principle:** Supabase requires no sync (shared live instance). Local databases and Dokploy
control-plane state must be dumped from Azure and restored to AWS after the write/deployment freeze.

**When:** Phase C of the cutover runbook — after Azure writers stopped, before AWS writers start.
**Source:** Azure (authoritative). **Destination:** AWS. **Direction:** One-way.

### 15.1 Database Sync Inventory (16 total)

| # | Database | Source Container | PG Version | Priority | Justification |
|---|---------|-----------------|-----------|---------|---------------|
| 1 | dokploy (control-plane) | dokploy-postgres | postgres:16 | P0 CRITICAL | Azure is authoritative; env vars, app configs, image choices, schedules all live here |
| 2 | n8n | apps-internal-n8n-cvjx2s-postgres-1 | postgres:17-alpine | P0 CRITICAL | Active workflows, API credentials (encrypted), execution state |
| 3 | tenant_jpvbootcamp | compose-hack-open-source-driver-mmchh4 | postgres:15 | P0 CRITICAL | Active development writes on Azure |
| 4 | jpvbootcamp | compose-input-open-source-bandwidth-droye2 | postgres:15 | P0 CRITICAL | Active development writes on Azure |
| 5 | tenant_prochat | compose-bypass-optical-alarm-tb4ukd | postgres:15 | P1 HIGH | Production writes ongoing |
| 6 | tenant_viadieden | compose-connect-wireless-application-d1n939 | postgres:15 | P1 HIGH | Production writes ongoing |
| 7 | tenant_statuslink | compose-copy-auxiliary-protocol-3gfh3x | postgres:15 | P1 HIGH | Production writes ongoing |
| 8 | tenant_prokitstudio | compose-copy-cross-platform-bus-wojn3n | postgres:15 | P1 HIGH | Production writes ongoing |
| 9 | tenant_saysthebible | compose-copy-open-source-interface-fkhqrw | postgres:15 | P1 HIGH | Production writes ongoing |
| 10 | tenant_prokit | compose-copy-redundant-capacitor-zc4esw | postgres:15 | P1 HIGH | Production writes ongoing |
| 11 | openfund | compose-generate-mobile-microchip-tksvis | postgres:15 | P1 HIGH | Production writes ongoing |
| 12 | tenant_cedula | compose-generate-wireless-bandwidth-v7bvut | postgres:15 | P1 HIGH | Production writes ongoing |
| 13 | tenant_olivetoorganizing | compose-navigate-optical-monitor-vi714i | postgres:15 | P1 HIGH | Production writes ongoing |
| 14 | tenant_saaskitstudio | compose-quantify-1080p-system-tp1q5f | postgres:15 | P1 HIGH | Production writes ongoing |
| 15 | tenant_resend | compose-reboot-cross-platform-driver-6l6dun | postgres:15 | P1 HIGH | Production writes ongoing |
| 16 | tenant_saaskit | compose-synthesize-bluetooth-panel-tg5mhy | postgres:15 | P1 HIGH | Production writes ongoing |

**Total: 16 databases require dump/restore (1 × PG16 + 1 × PG17 + 14 × PG15)**
- P0 CRITICAL: 4 (must be done first, including Dokploy control-plane)
- P1 HIGH: 12 (all remaining local tenant DBs)

**Note on Dokploy control-plane sync:** Syncing the Azure Dokploy postgres:16 to AWS requires
care. The AWS Dokploy DB contains shadow-state entries (autoDeploy=false, suppressions). The
sync must either: (a) capture and merge only the config fields that changed on Azure, or
(b) restore the full Azure DB and re-apply shadow suppressions on AWS before any service starts.
This is an operational decision for the cutover runbook to document precisely.

### 15.2 Additional Sync Items

| Item | Action | Priority |
|------|--------|---------|
| All 14 `:latest` application images | Re-pull from GHCR | P1 — before starting apps |
| JPV Bootcamp Payload CMS image | Confirm correct SHA with Steve; re-pull if updated | P0 GATE |
| Free Resend image | Rebuild from source via nixpacks (no GHCR image) | P1 |
| ProChat Accountant image | `docker build` from source | P1 |
| Ory Kratos config volume | Diff Azure vs. AWS; sync if changed | P2 GATE before Ory start |
| buildflow-data-staging volume | Sync from Azure if changed | P3 |
| Payload CMS media volume | Sync from Azure if media uploaded | P3 |

### 15.3 Items NOT Requiring Sync

| Item | Reason |
|------|--------|
| All 24 Supabase databases | Single live instance — AWS connects to same server |
| Traefik config + TLS certs | Phase-3A copy already on AWS disk. **Cutover gate:** diff required (see Section 15.2). Azure remains production reference. |
| Cloudflare tunnel config | Token-portable — no config change |

---

## 16. n8n Pre-Cutover Infrastructure Reference Audit

**Performed:** 2026-08-16 (Phase 3C6)
**Method:** Direct SQL queries to AWS shadow n8n postgres:17 container while n8n service is STOPPED.
No workflows were executed. No credentials were decrypted or printed.

### 16.1 Audit Scope

Searched for references to Azure infrastructure in workflow node definitions, workflow settings,
variables, and webhook paths:
- Azure Tailscale IP: `100.83.38.48`
- Azure public IP: `68.221.139.108`
- Azure private IP: `172.16.0.4`
- Azure VM hostname: `vm-dokploy`
- Azure keyword: `azure`
- AWS IPs: `100.71.47.24`, `18.135.240.168`
- Tailscale-internal Supabase IP: `100.71.31.88`
- Local Supabase subnet: `10.0.2.x`
- n8n self-reference: `n8n.prochat.tools`

### 16.2 Findings

| Reference Type | Found | Classification |
|---------------|-------|---------------|
| Azure IPs (100.83, 68.221, 172.16.0) | ZERO | INFRASTRUCTURE-MIGRATION SAFE |
| Azure hostname / `azure` keyword | ZERO | INFRASTRUCTURE-MIGRATION SAFE |
| AWS IPs (100.71.47, 18.135.240) | ZERO | INFRASTRUCTURE-MIGRATION SAFE |
| Tailscale/Supabase IPs (100.71.31, 10.0.2) | ZERO | INFRASTRUCTURE-MIGRATION SAFE |
| n8n self-reference (n8n.prochat.tools) | ZERO | INFRASTRUCTURE-MIGRATION SAFE |
| Production domain references (prochat.tools etc.) | 20 workflows | INFRASTRUCTURE-MIGRATION SAFE — domains resolve via Cloudflare regardless of host server |
| Webhook paths (mind-inbox, statuslink-callback, calendar-*, stb-facebook-autopublish, video-orchestrator-post) | 6 webhooks | INFRASTRUCTURE-MIGRATION SAFE — semantic paths, no infrastructure-specific references |

**IMPORTANT:** INFRASTRUCTURE-MIGRATION SAFE means ONLY: no Azure-specific IP/hostname dependency
that would break at host migration. It does NOT mean workflows are side-effect-free or safe to
run without review. n8n remains cutover-only — start only after NO-DUAL-WRITER gate clears.

**Total workflows audited:** 43
**Active workflows:** 6 have registered webhooks

### 16.3 Verdict

**PASS — no must-change references found in n8n workflow definitions.**

n8n is **infrastructure-migration safe**: zero references to Azure IPs, Azure hostnames, or any
infrastructure endpoint that changes at cutover. Domain references (20 workflows using
`prochat.tools`, `jpvbootcamp.com`, etc.) are INFRASTRUCTURE-MIGRATION SAFE — Cloudflare routes them correctly regardless
of which server holds the active cloudflared tunnel.

**Open Question #10 is CLOSED (resolved by this audit).** See Section 22.

---

## 17. Backup & Recovery Architecture

### 17.1 Current Backup Architecture

**AWS (current):**

| Mechanism | Coverage | Notes |
|-----------|---------|-------|
| Lightsail automatic snapshots | Full instance disk | Daily at 03:00 UTC; retention window = Lightsail default (7 days) |
| Manual baseline snapshot | pre-production-baseline-20260816 | Available |
| Manual pre-cutover snapshot | pre-cutover-ready-20260816 | Available |
| Logical DB dumps via pg_dump | All 16 local databases | Executed during Phase 3A; must be repeated at cutover |

**Lightsail snapshot limitations:**
- Snapshots capture the instance disk image (block storage). They do NOT capture:
  - Lightsail static IP association (re-associate manually after restore from snapshot)
  - Lightsail firewall rules (re-apply manually after restore from snapshot)
- Restoring from a snapshot creates a new instance — static IP and firewall rules are separate
  Lightsail resources that must be re-attached manually
- Snapshots are stored in the same region as the instance (eu-west-2)

**Azure (historical pre-cutover production):**

| Mechanism | Coverage | Notes |
|-----------|---------|-------|
| Azure Recovery Services (historical) | VM + attached disks | cloudpanel-dokploy-vault, EnhancedPolicy-CloudPanel-Dokploy; deleted 2026-08-26 |
| pg_dump bind-mounted path | `/var/backups/pgdump` | Bind-mounted in all compose DB projects; used during Phase 3A capture |

### 17.2 Planned Post-Cutover Backup Hardening

The following hardening is NOT authorized until the AWS runtime is stable, the current
backup/recovery point is verified, and Steve has given explicit approval. Document only.

| Item | Target | Details |
|------|--------|---------|
| Off-instance logical PostgreSQL backups | S3 | pg_dump for all local databases → S3; not dependent on instance disk integrity |
| Supabase backup verification | Supabase | Verify Supabase's own built-in backup/recovery configuration is adequate |
| Encryption at rest | S3 + local | Server-side encryption for S3 objects; verify disk encryption on Lightsail |
| Retention policy | S3 | Minimum 7 daily + 4 weekly + 3 monthly (define precisely) |
| Restore verification | Separate test instance | Monthly: restore from S3 dump to ephemeral instance, verify data integrity |
| Least-privilege access | IAM | S3 bucket access for backup writer should be write-only; separate read role for recovery |
| Dokploy-native S3 backup | Dokploy Destinations | Evaluate Dokploy's built-in S3 destination feature for application DB backups |

**Do NOT provision S3 bucket or IAM roles in this phase.**

### 17.3 Rollback Classes

**Class A (AWS accepted ZERO authoritative production writes):**
Applicable when: AWS HAS ACCEPTED ZERO AUTHORITATIVE PRODUCTION WRITES — meaning no mutation
has occurred to any authoritative state owned by or routed through AWS. This includes:
- Supabase (none of the 15 NO-DUAL-WRITER workloads — 13 applications + Umami + Ory Kratos — processed a real user request)
- AWS-local PostgreSQL databases (no application wrote authoritative data)
- n8n execution state (no real workflow execution completed with side effects)
- Persistent files / uploads (no file written that does not exist on Azure)
- External systems (no email sent, webhook processed, payment recorded, or other
  authoritative side effect created by an AWS-side workload)

Historical recovery action (pre-decommission only): stop AWS cloudflared → start Azure cloudflared.
This path is impossible after 2026-08-26.

**IMPORTANT:** Class A requires ALL of the above to be zero. A single authoritative write
through any channel moves the incident to Class B — even if Supabase itself was not touched.

**Class B (AWS accepted production writes):**
Applicable when: ANY authoritative production state was created or changed on AWS or through
AWS workloads. This includes any Supabase write, AWS-local DB write, n8n execution with side
effects, file upload, external API call with lasting effect, or any other mutation that does
not exist on Azure. Requires write freeze on both sides, data reconciliation, Steve decision
on rollback direction.

See `operations/migrations/dokploy-azure-to-lightsail/cutover-checklist.md` for operator steps.

**Current recovery model:** Rollback to Azure Dokploy is impossible. Recovery relies on AWS
Lightsail snapshots/backups and documented reconstruction procedures; any AWS recovery must be
validated against active production `vm-supabase` in Azure subscription `supabase-azure`.

---

## 18. Observability & Operations

### 18.1 New Relic

New Relic infrastructure observability is canonical for the three active
production hosts. The account is the EU account (`7019441`), and Brain Core
reads the EU NerdGraph endpoint through `/infra/telemetry`. Host identity is
mapped explicitly; the historical `dokploy` entity is retained as unmapped
evidence and must never be attached to `dokploy-aws`.

| Resource | New Relic entity | Agent | Current coverage |
|----------|-----------------|-------|------------------|
| `host:dokploy-aws` | `dokploy-aws` | 1.80.0 | system, storage, network, Docker/container |
| `host:cloudpanel-aws` | `cloudpanel-aws` | 1.80.0 | system, storage, network; Docker not applicable |
| `host:vm-supabase` | `supabase` (continuity alias) | 1.69.0 | system, storage, network, Docker/container |

The agent configuration path on each host is `/etc/newrelic-infra.yml` and
the service is enabled. Brain Console renders exactly these three canonical
hosts. The read path uses a 15-second in-process cache and keeps missing,
stale, and uninstrumented signals non-green.

The current canonical host alert policy is `Production Infrastructure - Host
Telemetry` (New Relic policy `1730856`) with loss-of-signal, CPU, memory, and
storage conditions. Warning starting points are CPU 85%, memory 90%, and
storage 80%; critical starting points are CPU 95%, memory 95%, and storage
90%. The policy is scoped to the three canonical hostnames and is separate
from historical application policies.

Backup state is derived from the bounded runtime evidence file
`operations/infrastructure/health/backup-runtime-state.v1.json`: Dokploy is
UNKNOWN, CloudPanel is UNKNOWN/UNVERIFIED, and Supabase is FAILED because the
latest `pgdump-upload` run failed. This observability work does not repair
backup jobs or alter Supabase backup configuration.

New Relic installation and alert policy configuration are now complete for
coverage. Runtime/service telemetry combines New Relic metrics with a bounded,
read-only SSH probe from Brain Core: Docker/container counts and health come
from the agent plus host probe, while known systemd service states and failed
unit counts are reported without changing those services. If SSH is
unavailable, those fields remain `unknown` rather than becoming green.

### 18.2 Umami Analytics

**Current production state (verified 2026-08-19):**

| Property | Value |
|----------|-------|
| URL | `https://umami.prochat.tools/` |
| Image | `ghcr.io/umami-software/umami:3.0.3` |
| Container | `ops-umami-sqswbj-umami-1` |
| Compose project | `ops-umami-sqswbj` |
| Backend port | 3000 |
| Traefik route | `umami-web@file` + `umami-websecure@file` (file-provider at `/etc/dokploy/traefik/dynamic/umami.yml`) |
| DB location | `vm-supabase` in Azure subscription `supabase-azure` (68.221.194.245), Tailscale identity `supabase` at `100.71.31.88` |
| DB endpoint | `10.0.2.4:5433` (private endpoint for VM `vm-supabase` in `supabase-azure`, advertised via Tailscale subnet route) |
| DB name | `analytics` |
| DB schema | `public` |
| Local Docker DB | NONE — no local postgres dependency |
| Tailscale dependency | YES — `10.0.2.4` is routed via `tailscale0`; Tailscale on `dokploy-aws` must be active |
| Websites | 4 (including production site `5ceba17d-4125-4a75-a1f6-9add5c4b1803`: ProChat / prochat.tools) |
| Analytics events | 1,816 (as of 2026-08-17) |
| Human acceptance | Login PASS, websites visible, historical analytics visible (2026-08-19) |
| code-umami-1 | Retired 2026-08-19 (stale migration residue; stopped + removed) |

**Ingress path:**
```
Client → Cloudflare (TLS) → Cloudflare Tunnel → Traefik :80/:443
  → file-provider router Host(`umami.prochat.tools`)
  → http://ops-umami-sqswbj-umami-1:3000 (Docker DNS on ops-umami-sqswbj network)
```

**Database path:**
```
Umami container → DATABASE_URL (env) → 10.0.2.4:5433 via tailscale0
  → `vm-supabase` in Azure subscription `supabase-azure` → analytics database / public schema
```

**INVARIANTS:**
1. `ops-umami-sqswbj-umami-1` is the only intended Umami runtime. `code-umami-1` (stale migration residue) was retired 2026-08-19. No duplicate may run concurrently.
2. Tailscale on `dokploy-aws` must remain active; losing Tailscale connectivity breaks Umami DB access.
3. `vm-supabase` in Azure subscription `supabase-azure` is ACTIVE PRODUCTION and was untouched by the Azure Dokploy decommission.
4. `analytics` database on Supabase must not be dropped or renamed.
5. Default Umami dashboard view is "last 24 hours". Empty charts in the default view do not indicate data loss; historical analytics require adjusting the date range filter.

**Incident history:** `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md` (Umami ingress gap — same class as Defect B)

**Future retirement:** Steve is evaluating replacing Umami with New Relic Browser. Retirement requires separate planning — do not decommission this service without that plan.

### 18.3 n8n Automation

**Current production state (verified 2026-08-19):**

| Property | Value |
|----------|-------|
| URL | `https://n8n.prochat.tools/` |
| Image | `n8nio/n8n:2.4.7` |
| Container | `apps-internal-n8n-cvjx2s-n8n-1` |
| Compose project | `apps-internal-n8n-cvjx2s` |
| Runtime UID:GID | 1000:1000 (node:node) |
| PostgreSQL | `postgres:17-alpine` (`apps-internal-n8n-cvjx2s-postgres-1`) |
| DB hostname | `postgres` (resolved via compose-internal `default` network ONLY) |
| Postgres network | `apps-internal-n8n-cvjx2s_default` only (NOT on dokploy-network) |
| n8n networks | `apps-internal-n8n-cvjx2s_default` + `dokploy-network` |
| N8N_PROXY_HOPS | 2 (Cloudflare → Traefik → n8n) |
| Persistent volume | `apps-internal-n8n-cvjx2s_n8n_data` → `/home/node/.n8n` |
| Traefik route | `n8n-web@file` + `n8n-websecure@file` (file-provider, not Docker/Swarm labels) |
| Workflows | 43 total, 6 active |
| Credentials | 17 (encrypted, depend on N8N_ENCRYPTION_KEY) |
| API keys | 2 (Milestone App, ProChat) |
| Webhooks | 6 registered paths |

**Ingress path:**
```
Client → Cloudflare (TLS) → Cloudflare Tunnel → Traefik :80
  → file-provider router Host(`n8n.prochat.tools`)
  → http://apps-internal-n8n-cvjx2s-n8n-1:5678 (Docker DNS on dokploy-network)
```

**Database path:**
```
n8n container → DNS "postgres" → compose-internal network only → 172.19.0.x
  → apps-internal-n8n-cvjx2s-postgres-1:5432
```

**INVARIANTS (established 2026-08-19 after DNS collision incident):**

1. Production postgres MUST NOT be on `dokploy-network` or any shared overlay network where other compose projects could advertise the same `postgres` DNS alias.
2. There MUST be only ONE intended production n8n main process. No stale n8n containers from prior project names may coexist.
3. No stale n8n PostgreSQL service may advertise the same DB DNS identity on any network visible to production n8n.
4. `N8N_ENCRYPTION_KEY` must be preserved exactly — if changed, all 17 credentials become unreadable.
5. Volume `_data` directory must be owned by 1000:1000 (not root).
6. `N8N_PROXY_HOPS` must match the observed production proxy topology (currently 2: Cloudflare → Traefik → n8n).
7. Production DB hostname must resolve to exactly one target from within the n8n container runtime.

**Critical dependency:** `N8N_ENCRYPTION_KEY` in `.env` — if lost or changed, credentials are unreadable.
Zero Azure infrastructure references in workflows (confirmed by Section 16 audit).

---

## 19. Legacy & Hygiene Inventory

### 19.1 Hygiene Issues (Phase 3C4 Audit)

All 5 issues are low/medium severity. None block cutover.
See `operations/migrations/dokploy-azure-to-lightsail/post-cutover-hygiene-roadmap.md`.

| ID | Finding | Severity | Action |
|----|---------|---------|--------|
| H1 | Orphaned dir `/etc/dokploy/applications/compose-index-haptic-firewall-rlwj48` (no /code, no container) | Low | Remove (post-cutover, P1) |
| H2 | Firecrawl compose YAML on disk, not in Dokploy DB, not running | Medium | Investigate (post-cutover, P2) |
| H3 | Two compose projects both named "jpvbootcamp" in Dokploy | Low | Rename one (post-cutover, P1) |
| H4 | `jccpholdings.com` appears twice for same application | Low | Remove duplicate (post-cutover, P1) |
| H5 | `finance.yeshua.academy` domain record with no app/compose link | Low | Remove (post-cutover, P1) |

### 19.2 Legacy Database Objects (Supabase)

Do not touch any of these until explicitly authorized post-cutover:

| Object | Type | Classification |
|--------|------|---------------|
| tenant_prokit, tenant_saaskit | Logical databases | UNKNOWN / LEGACY-CANDIDATE — no application DATABASE_URL connects to these (F-UNK-005); usage unverified; do not drop without investigation |
| tenant_boilerplate, tenant_prochattools, tenant_rebuildwp | Schemas (postgres) | LEGACY CANDIDATE — no active app (tenant_rebuildwp = 0 tables) |
| financialfreedom_schema | Schema (postgres) | LEGACY CANDIDATE — EMPTY (0 tables). Historical Laravel tables are in `public` schema (13 tables, financialfreedom_user owned). |
| maybe_schema | Schema (postgres) | LEGACY CANDIDATE — EMPTY (0 tables) |
| finance\ | Logical database | UNKNOWN — backslash in name, ~10MB, no identified application |
| finance_shadow | Logical database | PROBABLE TOOLING — PURPOSE NOT FULLY VERIFIED — may be Prisma `migrate dev` shadow DB; not confirmed (see Open Question Q7) |
| openfund | Logical database | UNKNOWN / LEGACY CANDIDATE — no application DATABASE_URL points to this DB (OBSERVED-VERIFIED 2026-08-16). Finance app connects to `finance` DB, not `openfund`. |

### 19.3 Source-Parity Exceptions

Four applications were in error state on Azure before migration. They are exempt from image
requirements on AWS.

| Application | Pre-migration state | AWS handling at cutover |
|-------------|--------------------|-----------------------|
| fala | applicationStatus=error | Image present; remains stopped until explicitly enabled |
| ProChat Accountant | applicationStatus=error, registry pull broken | Rebuild from source: `docker build` |
| ProKit Studio | applicationStatus=error, image missing | Remain stopped |
| SaaSKit Studio | applicationStatus=error, image missing | Remain stopped |

---

## 20. Future Architecture Placeholders

### 20.1 USER-PROPOSED Model Convergence

The proposed future model (ONE application database + explicit schemas — see Section 8.2 and
ADR-003 PROPOSED) requires post-cutover convergence work and explicit Steve approval before
any steps below are taken. Prerequisites before any convergence:
- Stable AWS runtime and current backup/recovery point verified
- Per-application dependency analysis (which apps use local DB vs Supabase vs both)
- Explicit Steve approval for each schema migration

Order of operations (when authorized): local-only data → migrate into Supabase schemas →
decommission per-app logical databases → consolidate into single application database.

### 20.2 Healthcheck Policy

No Docker Swarm healthchecks on application services. Add post-cutover to critical Supabase
writers: ProChat, Cedula, JPV Bootcamp, Proofly, Says the Bible.

### 20.3 Resource Limits

No memory/CPU limits configured. Define per-service limits after cutover stability confirmed.
Start with highest-memory services (ProChat, JPV Bootcamp Payload CMS, n8n).

### 20.4 Centralized Logging

No centralized log store beyond New Relic infra metrics. Post-cutover option: Vector, Loki, or
Papertrail to aggregate application logs.

### 20.5 n8n Version Upgrade

Current: n8n:2.4.7 (pinned). Post-cutover: plan upgrade with staging validation before applying
to production.

---

## 21. Architecture Decisions

### ADR-001: Cloudflare Tunnel as Sole Public Ingress

**Status:** IMPLEMENTED

**Decision:** All public HTTP/HTTPS enters via Cloudflare Tunnel. TCP 80/443 blocked at host firewall.

**Rationale:** Eliminates origin IP exposure. Provides Cloudflare WAF for all applications.
Token-based tunnel is portable across infrastructure changes — no Cloudflare config changes
at cutover.

**Consequence:** Cutover does not require DNS changes. Traffic follows the active cloudflared
process. However, running both Azure and AWS cloudflared concurrently with the same token
distributes traffic to both — this must be prevented by explicit sequencing.

---

### ADR-002: Tailscale for All Cross-Node Communication

**Status:** IMPLEMENTED

**Decision:** Azure, AWS, and Supabase communicate exclusively via Tailscale.

**Rationale:** Supabase must not be publicly routable. Cross-node communication is encrypted and
access-controlled by Tailscale ACLs without firewall management.

**Consequence:** Any new infrastructure node needing Supabase access must join the Tailscale
network first. An AWS workload can reach Supabase independently of Cloudflare state — the
NO-DUAL-WRITER gate must be enforced separately.

---

### ADR-003: Supabase as Shared PostgreSQL Server — Proposed Future vs. Verified Current

**Status:** PROPOSED — convergence to one-database model is Steve's stated intent but has not been
approved as an actionable ADR. Current state is 24 logical databases (VERIFIED CURRENT ARCHITECTURE).
The shared-server decision (Supabase) is IMPLEMENTED; the one-database convergence plan is PROPOSED.

**USER-PROPOSED FUTURE DATA MODEL (stated by Steve, not an approved ADR):**
> ONE application PostgreSQL database + explicit per-application schemas.
> No `tenant_*` convention as an architectural standard.

**Verified Current Architecture (OBSERVED-VERIFIED 2026-08-16):**
- One shared PostgreSQL 15.8 server (Supabase) — observed current pattern
- 24 logical databases (`CREATE DATABASE`) — this does NOT match the proposed single-database model
- `postgres` central database with 36 schemas (OBSERVED-VERIFIED 2026-08-16) — partially overlaps with "explicit schemas" concept
- `tenant_*` naming at both database and schema level — historical relationship to proposed future model is UNKNOWN

**The verified current architecture uses the shared-server pattern (one Supabase instance) but
does not use the proposed single-database-plus-schemas model.** The current state is not an
intermediate step toward any approved target. No convergence is approved by this document.

**Future convergence (if authorized):** Explicit planning required. No schema migration until:
stable AWS runtime + current backup/recovery point verified + per-app dependency analysis + Steve approval.

**Consequence:** All applications that write to Supabase are subject to NO-DUAL-WRITER.
This applies regardless of which logical database or schema they use — all are on the same server.

---

### ADR-004: Per-Application Local postgres:15 for Runtime Data

**Status:** IMPLEMENTED / OBSERVED CURRENT PATTERN

**Observed implementation:** 14 application-related local postgres:15 containers exist on Dokploy.

**Historical design rationale:** UNKNOWN — not established by current evidence.

**Migration consequence:** All 14 local databases require final authoritative synchronization at
cutover. Plus n8n postgres:17 and Dokploy postgres:16 = 16 total PostgreSQL syncs.

---

### ADR-005: BuildFlow Digest-Pinned at Migration Capture

**Status:** IMPLEMENTED

**Decision:** Both BuildFlow instances use pinned digest `sha256:4a657686731b` at cutover.

**Rationale:** The `:latest` tag drifted after Phase 3A capture. Pinned digest preserves source
parity with the Azure instance being migrated.

**Consequence:** BuildFlow must be explicitly updated post-cutover for newer versions.

---

### ADR-006: Shadow Suppression Strategy

**Status:** IMPLEMENTED

**Decision:** AWS shadow node uses two independent suppression layers: (1) `autoDeploy=false`
on all 24 apps and 17 compose projects, and (2) cloudflared masked + Lightsail TCP 80/443 absent.

**Rationale:** Belt-and-suspenders. The cloudflared + firewall layer ensures no public traffic
reaches AWS even if Dokploy DB is modified. However, the data-writer gate (zero running workloads)
is independent and must be enforced separately.

**Consequence:** Cutover requires reversing BOTH layers independently. autoDeploy reversal and
cloudflared unmask are separate deliberate steps.

---

### ADR-007: JPV Bootcamp Active Development Does Not Block Cutover

**Status:** ACCEPTED

**Decision:** Active JPV Bootcamp development on Azure is a known drift source but does not
block cutover. Final sync procedure accounts for it.

**Rationale:** Waiting for development pause would delay cutover indefinitely. JPV Bootcamp is
actively changing — local DB drift is addressable with fresh pg_dump at cutover.

**Consequence:** JPV Bootcamp final source, config, image, and local database state MUST be
refreshed after Azure write/deployment freeze and before AWS writers start. Local DBs
(tenant_jpvbootcamp, jpvbootcamp) and Dokploy metadata are P0 sync items at cutover.
Payload CMS pinned SHA must be re-confirmed with Steve before cutover (CUTOVER-TIME GATE).

---

## 22. Open Questions

| # | Question | Classification | Notes |
|---|---------|---------------|-------|
| 1 | What application connects to `finance\` (backslash name)? | POST-CUTOVER HYGIENE | ~10MB data exists; investigate post-cutover (P2-B) |
| 2 | Is Firecrawl intentionally deprovisioned or should it be re-registered? | POST-CUTOVER HYGIENE | Orphaned compose config exists on disk; investigate post-cutover (P2-A) |
| 3 | Is fala (`app-override-online-interface-1wzjpb`) still in active development? | POST-CUTOVER HYGIENE | Image present, error status; confirm deprecation or revival post-cutover |
| 4 | Which application uses `tenant_prokit` / `tenant_saaskit` as a database (not schema)? | POST-CUTOVER HYGIENE | Confirm before any cleanup of these legacy databases |
| 5 | What application created `maybe_schema` / `financialfreedom_schema`? | POST-CUTOVER HYGIENE | **3C7 update:** Both schemas are EMPTY (0 tables, OBSERVED-VERIFIED). Schema owners: `financialfreedom_schema` → financialfreedom_user; `maybe_schema` → maybe_user. The 13 financialfreedom tables are in `public` schema. Application history UNKNOWN. |
| 6 | Is `jpv-bootcamp:a0c32276` the intended production Payload CMS version at cutover? | **CUTOVER-TIME GATE** | Must confirm with Steve during final sync — cannot start Payload CMS without this confirmation |
| 7 | Does Finance app use `prisma migrate dev` (needs `finance_shadow`) or `prisma migrate deploy`? | POST-CUTOVER HYGIENE | Determines whether `finance_shadow` can be dropped |
| 8 | Are ProKit Studio and SaaSKit Studio intentionally retired or will they be relaunched? | POST-CUTOVER HYGIENE | Images missing; if relaunching, source builds or registry fixes needed |
| 9 | Has the ory-config volume changed on Azure since Phase 3A? | **CUTOVER-TIME GATE** | Must diff and sync before starting Ory Kratos on AWS |
| 10 | ~~Are n8n workflows referencing Azure hostnames/IPs?~~ | ~~PRE-CUTOVER~~ **RESOLVED** | **CLOSED — Phase 3C6 audit: PASS. Zero Azure IP/hostname references found. 43 workflows clean.** |
| 11 | What is the exact origin protocol (HTTP or HTTPS) used by cloudflared to reach Traefik? | NON-BLOCKING UNKNOWN | Configured in Cloudflare Zero Trust dashboard; not verifiable from local evidence; does not affect cutover |
| 12 | What application (if any) uses the `openfund` Supabase logical database? | POST-CUTOVER HYGIENE | **3C7 finding:** No application in current Dokploy config has DATABASE_URL pointing to `openfund`. The Finance app connects to `finance` DB. `openfund` may be orphaned or a legacy deployment. Investigate before cleanup. |

---

## Document Maintenance

This document is derived from migration phases 3A through 3C8 (completed 2026-08-16).
Evidence register for all material claims: `operations/architecture/prochat-infrastructure-evidence-register.md`.
Update when:
- Cutover occurs: update `Current production runtime`, remove shadow-state sections
- Post-cutover cleanup executed: update Legacy & Hygiene Inventory
- Infrastructure changes: update relevant section + `Last verified` date

Supporting migration documents:
- `operations/migrations/dokploy-azure-to-lightsail/migration-manifest.json` — machine-readable manifest
- `operations/migrations/dokploy-azure-to-lightsail/cutover-runbook.md` — operator commands
- `operations/migrations/dokploy-azure-to-lightsail/cutover-checklist.md` — checklist with manual approval gate
- `operations/migrations/dokploy-azure-to-lightsail/phase-3c3-audit-and-cutover-packet.md` — identity + image audit
- `operations/migrations/dokploy-azure-to-lightsail/phase-3c4-hygiene-audit-and-final-sync-design.md` — hygiene + sync design
- `operations/migrations/dokploy-azure-to-lightsail/post-cutover-hygiene-roadmap.md` — 15-item post-cutover cleanup
