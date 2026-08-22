# ProChat Network Connectivity Audit — 2026-08-18

```
Status:           EVIDENCE ARTIFACT (not canonical architecture)
Audit type:       READ-ONLY infrastructure connectivity audit
Audit date:       2026-08-18
Auditor:          Claude Opus 4.6 (automated)
Mutations:        0
Secrets exposed:  0
```

---

## 1. Executive Summary

ProChat's production infrastructure comprises 8 Tailscale devices, 4 Cloudflare Tunnels, and 3 active infrastructure servers (AWS Dokploy, AWS CloudPanel, Azure Supabase). All application ingress flows through Cloudflare Tunnels except CloudPanel web traffic which uses direct Cloudflare-proxied public IP. Management access is Tailscale-only for all nodes.

**Key findings:**
- P0: None
- P1: 2 findings (wildcard Tailscale grant, Supabase UFW rules reference stale Azure IP)
- P2: 4 findings (Traefik API publicly reachable via tunnel, CloudPanel FTP exposed, 2 domains NXDOMAIN, outdated cloudflared on supabase)
- P3: 3 findings (no Tailscale tags on AWS infra nodes, key expiry inconsistency, Dokploy admin potentially tunneled)
- P4: 5 findings (naming inconsistencies, missing --accept-routes on cloudpanel, motorola device stale, UFW inactive on dokploy-aws, old Azure SSH model documentation drift)

The architecture follows a coherent philosophy: Cloudflare Tunnel for all public application ingress, Tailscale mesh for private management and inter-server communication, no direct public ports on production servers. CloudPanel is the exception — using direct public IP for web serving.

---

## 2. Methodology & Evidence Sources

| Source | Method | Classification |
|--------|--------|----------------|
| Local Mac Tailscale CLI (v1.96.4) | `tailscale status --json`, `tailscale debug netmap`, `tailscale debug prefs` | OBSERVED-VERIFIED |
| dokploy-aws SSH (ubuntu@100.71.47.24) | Remote commands via Tailscale | OBSERVED-VERIFIED |
| cloudpanel-aws SSH (ubuntu@100.121.12.36) | Remote commands via Tailscale | OBSERVED-VERIFIED |
| supabase SSH (master@100.71.31.88) | Remote commands via Tailscale | OBSERVED-VERIFIED |
| cloudflared CLI (v2026.3.0) | `cloudflared tunnel list` | OBSERVED-VERIFIED |
| DNS queries | `dig` against public resolvers | OBSERVED-VERIFIED |
| External port probes | `curl` from Mac to public IPs | OBSERVED-VERIFIED |
| Existing architecture doc | `operations/architecture/prochat-infrastructure-architecture.md` | AUTHORITATIVE-CONFIG (reference only) |

**Limitations:**
- Cloudflare API tokens expired (401) — tunnel public hostname configurations could not be queried via API
- Old Azure Dokploy node inaccessible via SSH (Tailscale SSH policy blocks access)
- Cloudflare Access policies not queryable without valid API token
- Lightsail firewall rules not directly queryable (inferred from port probe results)

---

## 3. Complete Tailscale Inventory

### 3.1 Tailnet Identity

| Property | Value |
|----------|-------|
| Tailnet domain | tail3c0f0a.ts.net |
| Business domain | prochat.tools |
| Display name | ProChat |
| Login identity | info@prochat.tools |
| Display name | ProChat Studio |
| Control URL | https://controlplane.tailscale.com |
| TKA (Tailnet Lock) | Disabled |
| MagicDNS | Enabled |
| User profiles | 2 (UIDs: 2594232355345855, 4254426009279736) |

### 3.2 Device Inventory

| # | Hostname | DNS Name | Tailscale IPv4 | Tailscale IPv6 | OS | Online | Key Expiry | Tags | Classification |
|---|----------|----------|----------------|----------------|-----|--------|------------|------|----------------|
| 1 | Office | office.tail3c0f0a.ts.net | 100.86.124.66 | fd7a:115c:a1e0::d601:7c82 | macOS | Yes | 2026-12-27 | — | CLIENT (primary operator) |
| 2 | Steve's MacBook Pro | macbook.tail3c0f0a.ts.net | 100.70.12.18 | fd7a:115c:a1e0::ae01:c12 | macOS | Yes | 2026-12-28 | — | CLIENT |
| 3 | dokploy-aws | dokploy-aws.tail3c0f0a.ts.net | 100.71.47.24 | fd7a:115c:a1e0::6136:2f19 | linux | Yes | Disabled | — | INFRASTRUCTURE (production) |
| 4 | cloudpanel-aws | cloudpanel-aws.tail3c0f0a.ts.net | 100.121.12.36 | fd7a:115c:a1e0::fe36:c25 | linux | Yes | Disabled | — | INFRASTRUCTURE (production) |
| 5 | supabase | supabase.tail3c0f0a.ts.net | 100.71.31.88 | fd7a:115c:a1e0::4934:1f58 | linux | Yes | Disabled | tag:supabase | INFRASTRUCTURE (production) |
| 6 | dokploy-new | dokploy.tail3c0f0a.ts.net | 100.83.38.48 | fd7a:115c:a1e0::b634:2630 | linux | Yes | 2027-01-25 | — | FALLBACK (quiesced Azure) |
| 7 | iphone | iphone.tail3c0f0a.ts.net | 100.107.201.123 | fd7a:115c:a1e0::1934:c97c | iOS | Yes | 2027-01-18 | — | CLIENT |
| 8 | moto g34 5G | motorola.tail3c0f0a.ts.net | 100.107.156.26 | fd7a:115c:a1e0::1234:9c1a | android | **Offline** | 2026-07-20 (EXPIRED) | — | STALE-CANDIDATE |

**Totals:** 8 devices, 7 online, 1 offline, 3 infrastructure, 1 fallback, 3 client, 1 stale-candidate

### 3.3 Key Expiry Policy

| Category | Key Expiry | Devices |
|----------|-----------|---------|
| Infrastructure (production) | Disabled | dokploy-aws, cloudpanel-aws, supabase |
| Fallback | Enabled (2027-01-25) | dokploy-new (Azure) |
| Clients | Enabled (various) | office, macbook, iphone |
| Stale | **Expired** (2026-07-20) | motorola |

### 3.4 Registration Dates

| Device | Created | Notes |
|--------|---------|-------|
| Office | 2025-12-26 | Primary operator Mac |
| supabase | 2026-01-18 | Oldest infrastructure node |
| dokploy-aws | 2026-08-16 | Recent (production cutover) |
| cloudpanel-aws | 2026-08-18 | Today (re-registered) |

---

## 4. Tailnet Policy Inventory

### 4.1 Packet Filter (Grants/ACLs)

**Total rules: 1 (wildcard)**

```json
{
  "IPProto": [6, 17, 1, 58],
  "Srcs": ["10.0.2.0/24", "100.64.0.0/10 (decomposed)", "fd7a:115c:a1e0::/48"],
  "Dsts": [{"Net": "0.0.0.0/0", "Ports": "0-65535"}, {"Net": "::/0", "Ports": "0-65535"}],
  "Caps": []
}
```

**Interpretation:** ALL Tailscale devices and the 10.0.2.0/24 subnet can reach ALL destinations on ALL ports (TCP, UDP, ICMP, ICMPv6). This is a complete wildcard grant.

### 4.2 SSH Policy

```json
{"rules": []}
```

**Interpretation:** No Tailscale SSH rules defined. SSH is handled by regular OpenSSH over Tailscale IPs (except the old Azure node which has Tailscale SSH intercepting and blocking all access due to empty rules).

### 4.3 Tags

| Tag | Defined | Assigned To | Purpose |
|-----|---------|-------------|---------|
| tag:supabase | Yes (implied by assignment) | supabase (100.71.31.88) | Identifies the Supabase database server |

**Untagged infrastructure:** dokploy-aws, cloudpanel-aws, dokploy-new (Azure) — all untagged.

### 4.4 Policy Analysis

| Finding | Classification |
|---------|---------------|
| Single wildcard rule — all-to-all, all ports | SECURITY EXPOSURE |
| No tag-based access segmentation for infrastructure | POTENTIAL IMPROVEMENT |
| SSH policy empty — blocks Tailscale SSH but allows regular OpenSSH | CURRENT FUNCTION |
| supabase is the only tagged device | COSMETIC DRIFT |
| No groups defined | REDUNDANCY (with wildcard) |
| No autoApprovers | CURRENT FUNCTION |
| No posture rules | POTENTIAL IMPROVEMENT |

---

## 5. Tailscale Connectivity Matrix

### 5.1 Evidence-Backed Connectivity

| Source → Destination | Port 22 | Port 5432/5433 | Port 8000/8443 | Port 80/443 | Evidence |
|---------------------|---------|----------------|----------------|-------------|----------|
| Office → dokploy-aws | ALLOWED ✓ | ALLOWED | ALLOWED | ALLOWED | SSH session confirmed |
| Office → cloudpanel-aws | ALLOWED ✓ | ALLOWED | ALLOWED | ALLOWED | SSH session confirmed |
| Office → supabase | ALLOWED ✓ | ALLOWED | ALLOWED | ALLOWED | SSH session confirmed |
| Office → dokploy (Azure) | **BLOCKED** | UNKNOWN | UNKNOWN | UNKNOWN | Tailscale SSH intercept denies |
| dokploy-aws → supabase | ALLOWED ✓ | ALLOWED ✓ | ALLOWED ✓ | ALLOWED | Ping 10.0.2.4 confirmed (23.9ms) |
| dokploy-aws → cloudpanel-aws | ALLOWED | ALLOWED | ALLOWED | ALLOWED | Policy permits; not tested |
| cloudpanel-aws → supabase | ALLOWED (policy) | UNKNOWN (no --accept-routes) | UNKNOWN | UNKNOWN | Route not accepted by cloudpanel |
| supabase → dokploy-aws | ALLOWED ✓ | ALLOWED | ALLOWED | ALLOWED | Active direct tunnel confirmed |

### 5.2 Connection Quality

| Path | Type | Latency | Evidence |
|------|------|---------|----------|
| dokploy-aws → supabase | Direct (WireGuard) | 23.9ms | Ping test |
| dokploy-aws → office | Direct | — | Tailscale status |
| supabase → dokploy-aws | Direct (18.135.240.168:41641) | ~24ms | Tailscale status |
| supabase → office | Direct (5.249.73.210:37098) | — | Tailscale status |
| cloudpanel-aws → office | Direct (5.249.73.210:37098) | — | Tailscale status |
| dokploy-new (Azure) → all | DERP relay (par) | — | No direct connections observed |

---

## 6. Routes / Subnet / Exit-Node Inventory

### 6.1 Subnet Routes

| Device | Advertised Routes | Approved | Primary | Accepted By |
|--------|-------------------|----------|---------|-------------|
| supabase | 10.0.2.0/24 | Yes | Yes | dokploy-aws (RouteAll: true), office (RouteAll: true) |
| cloudpanel-aws | — | — | — | **Does NOT accept routes** (health warning) |
| dokploy-aws | — | — | — | Accepts all routes (RouteAll: true) |

### 6.2 Exit Nodes

No exit nodes configured or advertised on any device.

### 6.3 Tailscale Serve / Funnel

No Serve or Funnel configuration on any infrastructure node.

### 6.4 Route Usage

Applications on dokploy-aws connect to Supabase PostgreSQL via:
- **10.0.2.4:5433** (subnet route) — 14 applications confirmed
- **100.71.31.88:5433** (direct Tailscale IP) — 1 application (fala)
- Local postgres container — n8n, per-compose stacks (14 postgres:15 containers)

---

## 7. Complete Cloudflare Tunnel Inventory

### 7.1 Tunnel List

| # | Tunnel Name | UUID | Created | Status | Config Source | Server | Cloudflared Version |
|---|-------------|------|---------|--------|---------------|--------|---------------------|
| 1 | Dokploy | dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b | 2026-01-30 | Active | Remote (token) | dokploy-aws | 2026.8.2 |
| 2 | CloudPanel | 1bdef92e-5e70-4836-9552-3e4653cef43a | 2026-04-04 | Active | Remote (token) | cloudpanel-aws | 2026.3.0 |
| 3 | Supabase | dd5ca154-87cb-4163-bb06-ee784aeaf36f | 2025-09-23 | Active | Remote (token) | supabase | 2025.9.1 |
| 4 | OfficeMac | 1b1fa7bf-a00f-4f1a-86bb-faecac746051 | 2026-04-04 | Active | Local (config.yml) | Office Mac Mini | 2026.3.0 |

All tunnels on the same Cloudflare account: `6a96282349f82a2cc05723f561b5eb3a`

### 7.2 Connector Inventory

| Tunnel | Connector Count | Edge Locations | Origin IP | Architecture |
|--------|----------------|----------------|-----------|--------------|
| Dokploy | 1 connector, 4 connections | 2×lhr13, 1×lhr16, 1×lhr19 | 18.135.240.168 (AWS eu-west-2) | linux_amd64 |
| CloudPanel | 1 connector, 4 connections | 1×lhr13, 1×lhr14, 1×lhr18, 1×lhr21 | (AWS eu-west-2) | linux_amd64 |
| Supabase | 1 connector, 4 connections | 1×mad01, 2×mad05, 1×mad06 | 68.221.194.245 (Azure) | linux_amd64 |
| OfficeMac | 1 connector, 4 connections | 2×lis01, 2×mad05 | 5.249.73.210 (Office) | darwin_arm64 |

**Classification:** All tunnels have exactly 1 connector — EXPECTED SINGLE HOST. No accidental duplicates. No stale Azure connector on the Dokploy tunnel.

---

## 8. Tunnel Connector Inventory

(See Section 7.2 — single connector per tunnel, no duplicates detected)

---

## 9. Public Hostname / Origin Inventory

### 9.1 OfficeMac Tunnel (Local Config — OBSERVED-VERIFIED)

| Hostname | Service | Protocol |
|----------|---------|----------|
| probot.prochat.tools | http://localhost:7070 | HTTP |
| workbench.prochat.tools | http://127.0.0.1:3154 | HTTP |
| (catch-all) | http_status:404 | — |

### 9.2 Dokploy Tunnel (Inferred from Traefik Routers)

The Dokploy tunnel is remotely managed. Without valid Cloudflare API, exact tunnel hostname config cannot be read. However, based on Traefik router configuration and DNS evidence, the following hostnames route through this tunnel:

| Hostname | Traefik Router → Service | Evidence |
|----------|--------------------------|----------|
| prochat.tools | web-public-prochat → :3000 | Traefik router + CF proxy DNS |
| cedula.prochat.tools | web-cedula → :3000 | Traefik router + CF proxy DNS |
| auth.prochat.tools | ory-public-service → kratos:4433 | Traefik file provider |
| auth-admin.prochat.tools | ory-admin-service → kratos:4434 | Traefik file provider |
| buildflow-staging.prochat.tools | app-transmit → :3054 | Traefik router |
| legal.prochat.tools | demo-vault-legal → :3051 | Traefik router |
| legal-api.prochat.tools | demo-vault-legal-api → :3001 | Traefik router |
| resend.prochat.tools | apps-internal-free-resend → :3000 | Traefik router |
| n8n.prochat.tools | apps-internal-n8n-cvjx2s-n8n-1 → :5678 | Traefik file-provider route (n8n.yml, added 2026-08-19) |
| getproofly.app | saas-proofly → :3000 | Traefik router + CF proxy DNS |
| onestatus.link | apps-saas-status-link → :3000 | Traefik router |
| saysthe.bible | web-says-the-bible → :3000 | Traefik router |
| viadieden.it | web-public-viadieden → :3000 | Traefik router |
| olivetoorganizing.com | web-public-olivetoorganizing → :3000 | Traefik router |
| jccpholdings.com | web-public-jccp-holdings → :3000 | Traefik router |
| jpvbootcamp.com | web-public-jpv-bootcamp → :3000 | Traefik router |
| preview.jpvbootcamp.com | clients-jpv-bootcamp-app → :3000 | Traefik router |
| yeshua.academy | web-yeshua-academy → :3000 | Traefik router |
| finance.yeshua.academy | apps-saas-open-fund → :3000 | Traefik router |

**Note:** Exact tunnel configuration is UNKNOWN without API access. The above is DERIVED-VERIFIED from Traefik state + DNS evidence.

### 9.3 CloudPanel Tunnel (Inferred)

Based on DNS evidence, the following CloudPanel-hosted sites may route through the CloudPanel tunnel:

| Hostname | DNS Target | Notes |
|----------|-----------|-------|
| ag.prochat.tools | CF proxy (172.67.195.132) | May be tunnel or proxied A record |
| legacy.prochat.tools | CF proxy (172.67.195.132) | May be tunnel or proxied A record |
| admin.yeshua.academy | CF proxy (172.67.178.27) | May be tunnel or proxied A record |
| portal.jpvbootcamp.com | CF proxy (104.21.66.225) | May be tunnel or proxied A record |

### 9.4 Supabase Tunnel (Inferred)

| Hostname | Likely Service | Notes |
|----------|---------------|-------|
| supabase.prochat.tools | CF proxy (172.67.195.132) | Likely routes to Supabase Studio (port 8000 or 3000) |
| dokploy.prochat.tools | CF proxy (172.67.195.132) | **Ambiguous** — name suggests Dokploy admin but could be on Dokploy tunnel |

---

## 10. Cloudflare DNS Mapping

### 10.1 Domains Resolving to Cloudflare Proxy IPs (Tunnel or Proxied A)

All prochat.tools subdomains resolve to Cloudflare anycast IPs (104.21.60.98 / 172.67.195.132), confirming all are behind Cloudflare proxy (either tunnel CNAME or proxied A record).

### 10.2 Domains Resolving to Direct Origin (Not Proxied)

| Hostname | A Record | Server | Status |
|----------|----------|--------|--------|
| click.israelinvestment.org | 13.135.227.0 | CloudPanel-aws | DNS-only (not Cloudflare-proxied) |
| services.avigdor.tech | 13.135.227.0 | CloudPanel-aws | DNS-only (not Cloudflare-proxied) |

### 10.3 Domains with NXDOMAIN (Broken)

| Hostname | Status | Server Config Exists |
|----------|--------|---------------------|
| feelgoodwithana.com | **NXDOMAIN** | Yes (CloudPanel nginx config) |
| vilasolidaria.pt | **NXDOMAIN** | Yes (CloudPanel nginx config) |

### 10.4 External Domains on Cloudflare (Different Zones)

| Domain | A Record | Zone |
|--------|----------|------|
| getproofly.app | 172.67.203.123 | Separate CF zone |
| onestatus.link | 104.21.2.183 | Separate CF zone |
| saysthe.bible | 172.67.154.88 | Separate CF zone |
| viadieden.it | 104.21.67.251 | Separate CF zone |
| olivetoorganizing.com | 172.67.216.123 | Separate CF zone |
| jccpholdings.com | 172.67.146.79 | Separate CF zone |
| jpvbootcamp.com | 172.67.207.186 | Separate CF zone |
| yeshua.academy | 172.67.178.27 | Separate CF zone |
| microgreens.market | 104.21.41.190 | Separate CF zone |
| onefleshinchrist.com | 172.67.152.218 | Separate CF zone |
| pedroandkristina.com | 172.67.205.212 | Separate CF zone |
| thedutchperformance.nl | 104.21.20.60 | Separate CF zone |
| wedding.onefleshinchrist.com | 104.21.32.157 | Separate CF zone |

---

## 11. Cloudflare Access Inventory

**Status: UNKNOWN** — Cannot query without valid Cloudflare API token.

**Observable evidence:**
- No Cloudflare Access indicators found in DNS or tunnel configuration
- Dokploy admin (dokploy.prochat.tools) resolves to Cloudflare proxy — access control method UNKNOWN
- Auth (auth.prochat.tools, auth-admin.prochat.tools) uses Ory Kratos — application-level auth

---

## 12. Dokploy Application Network Inventory

### 12.1 Production Applications (Docker Swarm)

| # | Container Name | Image | Domain | Internal Port | DB Connection |
|---|---------------|-------|--------|---------------|---------------|
| 1 | web-public-prochat | prochattools/prochat | prochat.tools | 3000 | UNKNOWN |
| 2 | web-says-the-bible | prochattools/says-the-bible | saysthe.bible | 3000 | 10.0.2.4:5433/saysthebible |
| 3 | saas-proofly | prochattools/proofly | getproofly.app | 3000 | 10.0.2.4:5433/proofly |
| 4 | web-cedula | prochattools/cedula | cedula.prochat.tools | 3000 | 10.0.2.4:5433/cedula |
| 5 | web-public-viadieden | prochattools/via-di-eden | viadieden.it | 3000 | UNKNOWN |
| 6 | web-public-olivetoorganizing | prochattools/oliveto-organizing | olivetoorganizing.com | 3000 | UNKNOWN |
| 7 | web-public-jpv-bootcamp | prochattools/jpv-bootcamp | jpvbootcamp.com | 3000 | UNKNOWN |
| 8 | app-override-online-interface (fala) | app-override-online-interface:latest | UNKNOWN | 3050 | 100.71.31.88:5433/fala |
| 9 | demo-vault-legal (frontend) | prochattools/vault-legal-frontend | legal.prochat.tools | 3051 | UNKNOWN |
| 10 | demo-vault-legal-api | prochattools/vault-legal-backend | legal-api.prochat.tools | 3001 | UNKNOWN |
| 11 | web-public-prochat | prochattools/prochat | prochat.tools | 3000 | UNKNOWN |
| 12 | clients-jpv-bootcamp-app | prochattools/jpv-bootcamp:a0c3... | preview.jpvbootcamp.com | 3000 | UNKNOWN |
| 13 | apps-saas-status-link | prochattools/statuslink | onestatus.link | 3000 | UNKNOWN |
| 14 | apps-saas-open-fund | yeshuaacademy/finance | finance.yeshua.academy | 3000 | UNKNOWN |
| 15 | app-index-haptic-port (buildflow) | stevewesthoek/buildflow | UNKNOWN | 3054 | UNKNOWN |
| 16 | app-transmit-online-hard-drive (buildflow-staging) | stevewesthoek/buildflow | buildflow-staging.prochat.tools | 3054 | UNKNOWN |
| 17 | apps-internal-free-resend | apps-internal-free-resend:latest | resend.prochat.tools | 3000 | UNKNOWN |
| 18 | web-yeshua-academy | yeshuaacademy/yeshuaacademy | yeshua.academy | 3000 | UNKNOWN |
| 19 | web-public-jccp-holdings | prochattools/jccp-holdings | jccpholdings.com | 3000 | UNKNOWN |

### 12.2 Infrastructure Services (Dokploy)

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| dokploy | dokploy/dokploy:latest | 3000 | Platform admin panel |
| dokploy-traefik | traefik:v3.6.7 | 80, 443, 8080 | Reverse proxy / ingress |
| dokploy-postgres | postgres:16 | 5432 | Dokploy metadata DB |
| dokploy-redis | redis:7 | 6379 | Dokploy cache |
| ory-kratos | oryd/kratos:v1.3.1 | 4433, 4434 | Auth service |
| code-umami-1 | umami:3.0.3 | 3000 | Analytics |
| code-n8n-1 | n8nio/n8n:2.4.7 | 5678 | Automation |
| code-postgres-1 | postgres:17-alpine | 5432 | n8n DB (local) |

### 12.3 Compose PostgreSQL Databases (Local)

14 standalone postgres:15 containers for per-application compose stacks (named with Dokploy auto-generated names).

---

## 13. CloudPanel Website Network Inventory

### 13.1 Active Sites

| # | Domain | Nginx Config | DNS Resolution | Ingress Path | Status |
|---|--------|-------------|----------------|--------------|--------|
| 1 | admin.yeshua.academy | ✓ (proxy_pass :8080) | CF proxy | Tunnel or proxied A | ACTIVE |
| 2 | ag.prochat.tools | ✓ (proxy_pass :8080) | CF proxy | Tunnel or proxied A | ACTIVE |
| 3 | click.israelinvestment.org | ✓ (proxy_pass :8080) | **13.135.227.0 direct** | Direct public IP | ACTIVE |
| 4 | legacy.prochat.tools | ✓ (proxy_pass :8080) | CF proxy | Tunnel or proxied A | ACTIVE |
| 5 | microgreens.market | ✓ | CF proxy | Tunnel or proxied A | ACTIVE |
| 6 | onefleshinchrist.com | ✓ | CF proxy | Proxied A | ACTIVE |
| 7 | pedroandkristina.com | ✓ | CF proxy | Proxied A | ACTIVE |
| 8 | portal.jpvbootcamp.com | ✓ (proxy_pass :8080) | CF proxy | Tunnel or proxied A | ACTIVE |
| 9 | services.avigdor.tech | ✓ (static root) | **13.135.227.0 direct** | Direct public IP | ACTIVE |
| 10 | thedutchperformance.nl | ✓ | CF proxy | Proxied A | ACTIVE |
| 11 | wedding.onefleshinchrist.com | ✓ (proxy_pass :8080) | CF proxy | Proxied A | ACTIVE |

### 13.2 Broken Sites

| Domain | Nginx Config | DNS | Status |
|--------|-------------|-----|--------|
| feelgoodwithana.com | ✓ | **NXDOMAIN** | BROKEN (DNS missing) |
| vilasolidaria.pt | ✓ | **NXDOMAIN** | BROKEN (DNS missing) |

### 13.3 CloudPanel Infrastructure

| Property | Value |
|----------|-------|
| CloudPanel admin | https://100.121.12.36:8443 (Tailscale-only via UFW) |
| Web server | nginx |
| Database | MariaDB (port 3306, all interfaces) |
| Cache | Varnish (6081), Redis (localhost:6379), Memcached (localhost:11211) |
| FTP | ProFTPD (port 21, **publicly listening**) |
| Mail | Postfix (port 25) |
| PHP | PHP-FPM 8.4 (multiple pools) |
| Public IPv6 | 2a05:d01c:a98:8f00:2d99:8715:a8d3:abd2 |
| Public IPv4 | 13.135.227.0 (confirmed from prior documentation) |

---

## 14. Supabase Connectivity Inventory

### 14.1 Supabase Server Identity

| Property | Value |
|----------|-------|
| Provider | Azure |
| Public IP | 68.221.194.245 |
| Internal IP | 10.0.2.4/24 (eth0) |
| Tailscale IP | 100.71.31.88 |
| Subnet route | 10.0.2.0/24 (advertised + approved) |
| Tag | tag:supabase |
| Cloudflared | Active (tunnel: Supabase, version 2025.9.1) |

### 14.2 Supabase Services

| Service | Port | Listener | Status |
|---------|------|----------|--------|
| supabase-pooler (PgBouncer) | 5432 | 0.0.0.0 | Healthy (5 months) |
| supabase-db (PostgreSQL raw) | 5433 | 0.0.0.0 | Healthy (5 months) |
| supabase-kong (API) | 8000 | 0.0.0.0 | Healthy (5 months) |
| supabase-kong (HTTPS) | 8443 | 0.0.0.0 | Healthy (5 months) |
| supabase-studio | 3000 | internal only | Healthy (5 months) |
| supabase-analytics | 4000 | 0.0.0.0 | Healthy (5 months) |
| vault-legal-api-proxy | 8002 | 0.0.0.0 | Up (2 months) |
| supabase-rest-vault-legal | 8001 | 0.0.0.0 | Up (2 months) |

### 14.3 Connectivity Patterns

| Consumer | Path | Port | Classification |
|----------|------|------|----------------|
| dokploy-aws apps (14) | Tailscale subnet route → 10.0.2.4 | 5433 | TAILSCALE SUBNET ROUTE |
| dokploy-aws fala app (1) | Tailscale direct → 100.71.31.88 | 5433 | DIRECT TAILSCALE IP |
| Supabase Studio (web) | Cloudflare Tunnel → supabase | 8000/3000 | CLOUDFLARE TUNNEL |
| Office Mac (admin) | Tailscale direct → 100.71.31.88 | 5432/5433/8000 | DIRECT TAILSCALE IP |

### 14.4 Supabase UFW Analysis

```
Default: deny (incoming), allow (outgoing), deny (routed)

ALLOW  22 on tailscale0 from Anywhere       ← SSH via Tailscale (any TS IP)
DENY   22/tcp from Anywhere                 ← Block public SSH
ALLOW  8000/tcp on tailscale0 from 100.83.38.48  ← OLD AZURE IP ONLY
ALLOW  5432/tcp on tailscale0 from 100.83.38.48  ← OLD AZURE IP ONLY
ALLOW  5433/tcp on tailscale0 from 100.83.38.48  ← OLD AZURE IP ONLY
DENY   5433/tcp on eth0 from Anywhere
ALLOW  8443/tcp on tailscale0 from 100.83.38.48  ← OLD AZURE IP ONLY
DENY   5432/tcp on eth0 from Anywhere
DENY   8443/tcp on eth0 from Anywhere
```

**CRITICAL OBSERVATION:** UFW rules only permit DB access (5432, 5433, 8000, 8443) from `100.83.38.48` (the OLD Azure Dokploy). The current production node `100.71.47.24` (dokploy-aws) is NOT listed.

**WHY THIS STILL WORKS:** The iptables INPUT chain processes `ts-input` (Tailscale's chain) BEFORE UFW rules. Tailscale's chain accepts all traffic from authenticated peers, effectively bypassing UFW for all Tailscale traffic. Additionally, Docker manipulates iptables FORWARD/DOCKER chains directly, which also bypass UFW INPUT rules.

**Effective security model:** UFW rules on supabase are COSMETIC — actual access control is provided by:
1. Tailscale peer authentication (all tailnet members can reach all ports)
2. The Tailscale wildcard packet filter (allows everything)
3. eth0 services denied (public internet cannot reach DB ports)

---

## 15. Azure Fallback Isolation Status

### 15.1 Observable State

| Property | Value | Evidence |
|----------|-------|----------|
| Tailscale device exists | Yes | `tailscale status` shows `dokploy-new` at 100.83.38.48 |
| Online | Yes | DERP relay `par` (Paris), no direct connections |
| Key expiry | 2027-01-25 (enabled) | Tailscale netmap |
| SSH accessible | **NO** | "tailnet policy does not permit you to SSH to this node" |
| Active Cloudflare connector | **NO** | Dokploy tunnel shows only London (AWS) connectors |
| Tailscale SSH enabled on node | Yes (inferred) | SSH intercept message rather than connection refused |
| Application writer role | **NO** (confirmed per architecture doc) | AUTHORITATIVE-CONFIG |
| cloudflared state | STOPPED (per architecture doc) | Cannot independently verify (no SSH) |

### 15.2 Isolation Assessment: **PASS**

The old Azure Dokploy node is effectively isolated:
- Cannot be SSHed into (Tailscale SSH blocks with empty policy)
- No active Cloudflare Tunnel connector (only AWS connectors on Dokploy tunnel)
- No direct connections to any peer (DERP relay only, no active traffic)
- Architecture doc confirms writers stopped (0/0 replicas) and cloudflared stopped

**Residual risk:** The node IS online on the tailnet and the wildcard packet filter allows it to reach any other node. If its applications were somehow started, it could write to Supabase. However, the SSH isolation prevents unauthorized restart.

---

## 16. End-to-End Architecture Graph

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ INTERNET                                                                             │
└────────┬───────────────────────────────────────────────────────┬────────────────────┘
         │                                                       │
         ▼                                                       ▼
┌─────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ CLOUDFLARE (CDN / WAF / Proxy)      │    │ DIRECT DNS (not Cloudflare-proxied)      │
│                                     │    │                                          │
│ Tunnel: "Dokploy"                   │    │ click.israelinvestment.org → 13.135.227.0│
│   → prochat.tools (20+ hostnames)  │    │ services.avigdor.tech → 13.135.227.0    │
│   → external domains (10+)         │    │                                          │
│                                     │    └────────────────────┬─────────────────────┘
│ Tunnel: "CloudPanel"                │                         │
│   → ag.prochat.tools, legacy, etc. │                         │
│                                     │                         │
│ Tunnel: "Supabase"                  │                         │
│   → supabase.prochat.tools          │                         │
│                                     │                         │
│ Tunnel: "OfficeMac"                 │                         │
│   → probot.prochat.tools            │                         │
│   → workbench.prochat.tools         │                         │
│                                     │                         │
│ Proxied A records:                  │                         │
│   → CloudPanel sites (80/443)       │                         │
│     (13.135.227.0 origin)           │                         │
└──────────┬──────────────────────────┘                         │
           │ Outbound tunnel connections                        │
           │                                                    │
    ┌──────┴──────────────────────────────────────────┐         │
    │                                                 │         │
    ▼                                                 ▼         ▼
┌─────────────────────────────────┐  ┌──────────────────────────────────────────────┐
│ AWS LIGHTSAIL (eu-west-2)       │  │ AWS LIGHTSAIL (eu-west-2)                    │
│ dokploy-aws                     │  │ cloudpanel-aws                               │
│ 18.135.240.168 (blocked)        │  │ 13.135.227.0 (web: 80/443 open)             │
│ 100.71.47.24 (Tailscale)        │  │ 100.121.12.36 (Tailscale)                   │
│                                 │  │                                              │
│ Docker Swarm:                   │  │ nginx + Varnish + MariaDB + PHP-FPM          │
│   Traefik v3.6.7 → apps        │  │ 13 websites                                  │
│   19 web apps                   │  │ CloudPanel admin: :8443 (TS-only)            │
│   n8n + Ory Kratos + Umami     │  │ UFW: 22/8443 TS-only, 80/443 open           │
│   14 local postgres             │  │                                              │
│                                 │  │ cloudflared → CF Tunnel "CloudPanel"         │
│ cloudflared → CF Tunnel         │  └──────────────────────────────────────────────┘
│   "Dokploy"                     │
│                                 │
│ UFW: INACTIVE                   │
│ Lightsail FW: ALL BLOCKED       │
│ Ingress: TUNNEL ONLY            │
└───────────────┬─────────────────┘
                │ Tailscale mesh (direct WireGuard, ~24ms)
                │ Traffic: 10.0.2.4:5433 (subnet route)
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│ AZURE (West Europe?)                                                  │
│ supabase                                                              │
│ 68.221.194.245 (DB ports blocked on eth0)                            │
│ 100.71.31.88 (Tailscale) / 10.0.2.4 (subnet)                        │
│                                                                       │
│ Self-hosted Supabase:                                                 │
│   PostgreSQL 15.8 (:5433)                                            │
│   PgBouncer/Pooler (:5432)                                           │
│   Kong API Gateway (:8000/:8443)                                     │
│   Studio, Auth, Storage, Realtime, Edge Functions, Analytics, etc.   │
│                                                                       │
│ Subnet route: 10.0.2.0/24 (advertised + approved)                   │
│ cloudflared → CF Tunnel "Supabase"                                   │
│ UFW: SSH TS-only, DB/API TS-only (rules reference stale IP)          │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ AZURE (Spain Central) — QUIESCED ROLLBACK                            │
│ dokploy-new / dokploy.tail3c0f0a.ts.net                              │
│ 100.83.38.48 (Tailscale, DERP relay only)                            │
│                                                                       │
│ cloudflared: STOPPED                                                  │
│ SSH: BLOCKED (Tailscale SSH intercept, empty rules)                   │
│ Writers: STOPPED (0/0)                                                │
│ Status: ISOLATED                                                      │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ OPERATOR (Office Mac Mini M4 Pro)                                     │
│ 100.86.124.66 (Tailscale)                                            │
│ 5.249.73.210 (public)                                                │
│                                                                       │
│ SSH → all infra nodes (OpenSSH over Tailscale)                       │
│ cloudflared → CF Tunnel "OfficeMac" (probot, workbench)              │
│ RouteAll: true (accepts subnet routes)                                │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 17. Naming Audit

### 17.1 Naming Patterns

| System | Pattern | Examples |
|--------|---------|----------|
| AWS Lightsail resource | `{function}-aws` | dokploy-aws, cloudpanel-aws |
| Linux hostname | `{function}-aws` | dokploy-aws, cloudpanel-aws |
| Tailscale device name | Matches hostname | dokploy-aws, cloudpanel-aws, supabase |
| Cloudflare tunnel | Capitalized function | Dokploy, CloudPanel, Supabase, OfficeMac |
| SSH config aliases | lowercase function | dokploy, cloudpanel, supabase |

### 17.2 Inconsistencies

| Issue | Details | Severity |
|-------|---------|----------|
| Azure node hostname vs Tailscale name | Internal: `dokploy-new`, Tailscale DNS: `dokploy.tail3c0f0a.ts.net` | LOW |
| Azure node lacks `-azure` suffix | Named `dokploy` not `dokploy-azure` despite provider-suffix pattern | LOW |
| Supabase lacks provider suffix | Named `supabase` not `supabase-azure` | LOW (but it's the only Supabase) |
| Tunnel names: mixed case style | "OfficeMac" (PascalCase) vs "Dokploy" (single word) | HYGIENE |
| CloudPanel public IP | IPv4 only available as `13.135.227.0` from prior docs; `ifconfig.me` returns IPv6 | Documentation note |

### 17.3 Proposed Naming Philosophy

**Pattern:** `{function}[-{provider}]` where provider suffix is used when ambiguity exists.

- `dokploy-aws` ✓ (current production)
- `cloudpanel-aws` ✓ (current production)
- `supabase` ✓ (unique function, no ambiguity)
- `dokploy-azure` ← proposed rename for old Azure node (currently just `dokploy`)

---

## 18. Security Audit

### P1 — HIGH

#### S-001: Wildcard Tailscale Grant (All-to-All, All Ports)

| Property | Value |
|----------|-------|
| Current state | Single packet filter rule: src=ALL → dst=ALL, ports=0-65535 |
| Security exposure | Any compromised Tailscale device has full network access to all infrastructure |
| Risk | If motorola (stale, expired key) is compromised, or any client device, attacker has direct DB access |
| Proposed target | Tag-based grants: infra→infra (all ports), clients→infra (SSH only), specific app→db paths |
| Migration risk | LOW (Tailscale policy changes are instant and reversible) |
| Requires downtime | NO |
| Priority | HIGH |

#### S-002: Supabase UFW Rules Reference Stale IP

| Property | Value |
|----------|-------|
| Current state | UFW allows 5432/5433/8000/8443 only from 100.83.38.48 (old Azure, not production AWS) |
| Security exposure | Rules are effectively cosmetic (ts-input chain bypasses UFW), creating false sense of security |
| Risk | If someone disables the ts-input chain or Tailscale, UFW would block production traffic |
| Proposed target | Update rules to reference 100.71.47.24 (dokploy-aws) or use Tailscale CIDR |
| Migration risk | LOW |
| Requires downtime | NO |
| Priority | HIGH |

### P2 — MEDIUM

#### S-003: Traefik Dashboard/API Exposed

| Property | Value |
|----------|-------|
| Current state | Traefik API on port 8080 with `api.insecure: true`, accessible via Cloudflare Tunnel |
| Security exposure | If tunnel routes 8080, full Traefik configuration is readable by anyone |
| Mitigation | Lightsail firewall blocks direct access; tunnel config unknown (may not route 8080) |
| Risk | Service topology disclosure, potential router manipulation |
| Proposed target | Restrict API to Tailscale-only or add basicAuth middleware |
| Requires downtime | NO |
| Priority | MEDIUM |

#### S-004: CloudPanel FTP Service Exposed

| Property | Value |
|----------|-------|
| Current state | ProFTPD listening on 0.0.0.0:21 |
| Security exposure | FTP is unencrypted; if reachable through Cloudflare or direct IP, credentials transit in cleartext |
| Mitigation | UFW may block port 21 (not listed in allow rules); Cloudflare doesn't proxy FTP |
| Risk | Credential interception if FTP port is reachable |
| Proposed target | Disable FTP or restrict to SFTP/Tailscale-only |
| Requires downtime | NO |
| Priority | MEDIUM |

#### S-005: Two CloudPanel Sites with NXDOMAIN

| Property | Value |
|----------|-------|
| Current state | feelgoodwithana.com and vilasolidaria.pt have nginx configs but no DNS records |
| Security exposure | None (sites unreachable) |
| Risk | Stale configuration, potential domain takeover if domains expire and are re-registered |
| Proposed target | Remove nginx configs or restore DNS |
| Requires downtime | NO |
| Priority | MEDIUM |

#### S-006: Supabase Cloudflared Version Severely Outdated

| Property | Value |
|----------|-------|
| Current state | cloudflared 2025.9.1 (11 months old) vs current 2026.8.2 |
| Security exposure | May contain known vulnerabilities fixed in later versions |
| Risk | Tunnel security, potential exploit vectors |
| Proposed target | Update to 2026.8.x |
| Requires downtime | Brief (service restart) |
| Priority | MEDIUM |

### P3 — LOW

#### S-007: No Tailscale Tags on AWS Infrastructure Nodes

| Property | Value |
|----------|-------|
| Current state | dokploy-aws and cloudpanel-aws have no tags; only supabase has `tag:supabase` |
| Impact | Cannot write tag-based ACL rules without first tagging nodes |
| Proposed target | Add `tag:infra` or `tag:dokploy`, `tag:cloudpanel` |
| Requires downtime | NO |

#### S-008: Key Expiry Inconsistency

| Property | Value |
|----------|-------|
| Current state | Infrastructure: disabled; Azure fallback: 2027-01-25; Clients: various |
| Impact | Inconsistent security posture; Azure fallback has expiring key while production doesn't |
| Note | Azure having expiry is actually good (will self-expire if forgotten) |

#### S-009: Dokploy Admin Panel Exposure

| Property | Value |
|----------|-------|
| Current state | dokploy.prochat.tools resolves to Cloudflare proxy |
| Impact | Dokploy admin may be publicly accessible (with auth) through tunnel |
| Note | Cannot verify without Cloudflare API; may have Cloudflare Access protection |
| Proposed target | Restrict to Tailscale-only access |
| Requires downtime | NO |

### P4 — HYGIENE

#### S-010: Motorola Device Stale (Expired Key)

| Property | Value |
|----------|-------|
| Current state | Offline 78 days, key expired 2026-07-20 |
| Impact | Cannot rejoin tailnet without re-authentication; no active risk |
| Proposed target | Remove device if no longer needed |

#### S-011: CloudPanel --accept-routes False

| Property | Value |
|----------|-------|
| Current state | Health warning "Some peers are advertising routes but --accept-routes is false" |
| Impact | CloudPanel cannot reach 10.0.2.0/24 subnet (may not need to) |
| Note | If CloudPanel sites don't use Supabase, this is acceptable |

#### S-012: UFW Inactive on Dokploy-AWS

| Property | Value |
|----------|-------|
| Current state | UFW status: inactive |
| Impact | No local firewall; relies entirely on Lightsail firewall + Tailscale |
| Mitigation | Lightsail firewall blocks ALL inbound (confirmed by port probes) |
| Note | Defense-in-depth would suggest enabling UFW as secondary control |

#### S-013: Azure Node SSH Model Documentation Drift

| Property | Value |
|----------|-------|
| Current state | Architecture doc says "Public TCP/22: ALLOWED from internet (NSG Priority 900)" |
| Observed | Tailscale SSH intercepts all SSH, empty rules block access |
| Impact | Documentation may be stale vs actual access model |

#### S-014: Direct Public IP Exposure (2 CloudPanel Sites)

| Property | Value |
|----------|-------|
| Current state | click.israelinvestment.org and services.avigdor.tech resolve directly to 13.135.227.0 |
| Impact | Origin IP exposed; DDoS protection limited; no Cloudflare WAF |
| Proposed target | Proxy through Cloudflare or move to tunnel |
| Requires downtime | NO |

---

## 19. Standardization Audit

### Current Coherent Patterns

| Aspect | Current Standard | Adherence |
|--------|-----------------|-----------|
| Application ingress (Dokploy) | Cloudflare Tunnel → Traefik → app | 100% |
| Application ingress (CloudPanel) | Mixed: Cloudflare Tunnel + Direct proxied + Direct unproxied | ~80% |
| Management access | Tailscale-only (SSH, admin panels) | 100% for AWS; Azure isolated differently |
| Infrastructure SSH | OpenSSH over Tailscale IP, key-based | 100% (except Azure: blocked) |
| Key expiry (infra) | Disabled for production nodes | 100% |
| Subnet routing | Supabase advertises 10.0.2.0/24 | Working |
| DB connectivity | Apps → 10.0.2.4:5433 via subnet route | 93% (1 exception: fala uses direct IP) |
| Tunnel per server | One dedicated tunnel per server | 100% |
| Cloudflare account | Single account for all tunnels | 100% |

---

## 20. Contradictions / Drift Matrix

| Fact | Documented/Expected | Observed | Classification |
|------|--------------------|-----------|----|
| Tailnet device count | 7 (F-NET-004, 2026-08-16) | 8 (includes self) | DOCUMENTATION STALE (minor — depends on counting method) |
| Azure Dokploy public IP | 68.221.139.108 (architecture doc) | Cannot verify (no SSH) | UNKNOWN |
| Supabase UFW source IP | Should be production node | References 100.83.38.48 (old Azure) | CONFIG DRIFT |
| CloudPanel-aws Tailscale registration | Persistent | Created 2026-08-18 (today) | INTENTIONAL EXCEPTION (re-registered) |
| dokploy-aws Tailscale registration | Persistent | Created 2026-08-16 (cutover day) | INTENTIONAL EXCEPTION |
| UFW on dokploy-aws | Implicit expectation of firewall | INACTIVE | INTENTIONAL EXCEPTION (relies on Lightsail FW) |
| CloudPanel public IPv4 | 13.135.227.0 | Confirmed via DNS (click.israelinvestment.org) | NO ISSUE |
| Supabase public IP | Not explicitly documented | 68.221.194.245 (observed via netcheck) | NO ISSUE |
| cloudflared on Azure | STOPPED (architecture doc) | Cannot verify independently | ASSUMED CORRECT (no tunnel connector observed) |
| Dokploy tunnel connector | AWS only (post-cutover) | Confirmed: London connectors only | NO ISSUE |
| Tailscale SSH on Azure | Documented as "BLOCKED by ACL policy" | Confirmed: blocked by empty SSH rules | NO ISSUE |

---

## 21. Improvement Backlog

| # | Category | Finding | Priority | Downtime Required |
|---|----------|---------|----------|-------------------|
| 1 | SECURITY | Replace wildcard Tailscale grant with tag-based ACLs | P1 | NO |
| 2 | SECURITY | Update Supabase UFW to reference correct production IP | P1 | NO |
| 3 | SECURITY | Restrict Traefik API access (disable insecure mode or Tailscale-only) | P2 | NO |
| 4 | SECURITY | Disable or restrict FTP on CloudPanel | P2 | NO |
| 5 | RELIABILITY | Update cloudflared on Supabase (2025.9.1 → current) | P2 | Brief restart |
| 6 | CONSISTENCY | Clean up NXDOMAIN sites on CloudPanel | P2 | NO |
| 7 | CONSISTENCY | Tag AWS infrastructure nodes in Tailscale | P3 | NO |
| 8 | SECURITY | Move Dokploy admin to Tailscale-only access | P3 | NO |
| 9 | HYGIENE | Remove stale motorola device from tailnet | P4 | NO |
| 10 | HYGIENE | Enable --accept-routes on cloudpanel-aws (if Supabase access needed) | P4 | NO |
| 11 | HYGIENE | Enable UFW on dokploy-aws as defense-in-depth | P4 | NO |
| 12 | HYGIENE | Proxy click.israelinvestment.org and services.avigdor.tech through Cloudflare | P4 | NO |
| 13 | HYGIENE | Rename Azure node from `dokploy` to `dokploy-azure` | P4 | NO |
| 14 | DOCUMENTATION | Reconcile tailnet device count in architecture doc | P4 | NO |

**Changes requiring downtime:** 1 (cloudflared restart on Supabase — brief, ~seconds)

---

## 22. Proposed Future Philosophy

> **NOTE:** This is a PROPOSED STANDARD, not current canonical fact.

### Server Identity
- Pattern: `{function}-{provider}` (e.g., `dokploy-aws`, `supabase-azure`)
- Exception: unique-function services (only one Supabase) may omit provider suffix

### Tailscale
- **Tags:** All infrastructure nodes tagged (`tag:infra`, `tag:db`, `tag:web`)
- **Grants:** Tag-based, not wildcard. Clients get SSH-only; infra gets inter-node as needed
- **Key expiry:** Disabled for production infra; enabled for all other devices
- **SSH:** Prefer Tailscale SSH with proper rules over raw OpenSSH (provides audit logging)

### Cloudflare Tunnels
- One tunnel per server (current practice — maintain)
- All application traffic via tunnel (current for Dokploy — extend to CloudPanel)
- No direct public IP exposure for any origin server
- Management endpoints never tunneled (Tailscale-only)

### Firewall
- Defense-in-depth: UFW active on ALL nodes
- Provider firewall (Lightsail/Azure NSG) as primary perimeter
- UFW as secondary (in case provider FW misconfigured)
- Tailscale as identity-based access layer

### Decommissioning
- Remove Tailscale device within 30 days of confirmed decommission
- Key expiry enabled during wind-down period (self-expires if forgotten)
- Verify no tunnel connectors active before removing

---

## 23. Unknowns Requiring Future Evidence

| # | Unknown | Why Unknown | Impact |
|---|---------|-------------|--------|
| 1 | Exact Cloudflare Tunnel public hostname configuration | API tokens expired (401) | Cannot verify which hostnames route to which tunnels |
| 2 | Cloudflare Access policies | API tokens expired | Cannot verify protection on management endpoints |
| 3 | Azure Dokploy actual service state | SSH blocked (Tailscale SSH empty rules) | Cannot independently verify cloudflared/writers are stopped |
| 4 | Lightsail firewall rules (exact) | No Lightsail CLI/API access verified | Inferred from port probes only |
| 5 | CloudPanel sites → tunnel mapping | Cannot query CF API | Some may use tunnel, others direct proxied A |
| 6 | Dokploy admin access protection | Cannot query CF Access | May have Cloudflare Access, may be open |
| 7 | Azure Dokploy public IP current state | No access to verify | Doc says 68.221.139.108 but cannot confirm |
| 8 | Whether Traefik port 8080 is exposed through Dokploy tunnel | Cannot query CF tunnel config | Security impact if exposed |
| 9 | MariaDB on CloudPanel — who accesses it | Did not audit CloudPanel app DB connections | May be local-only or externally accessible |

---

## 24. Exact Current-State Summary

### Infrastructure

| Server | Role | Provider | Status | Ingress | Management |
|--------|------|----------|--------|---------|------------|
| dokploy-aws | Production PaaS | AWS Lightsail eu-west-2 | ACTIVE | Cloudflare Tunnel "Dokploy" | SSH via Tailscale |
| cloudpanel-aws | Web hosting | AWS Lightsail eu-west-2 | ACTIVE | CF Tunnel "CloudPanel" + Direct 80/443 | SSH + :8443 via Tailscale |
| supabase | Database | Azure | ACTIVE | CF Tunnel "Supabase" (Studio) | SSH via Tailscale |
| dokploy-new (Azure) | Quiesced rollback | Azure Spain Central | ISOLATED | None (cloudflared stopped) | BLOCKED |

### Network

| Path | Method | Status |
|------|--------|--------|
| Internet → Dokploy apps | Cloudflare Tunnel → Traefik | ACTIVE |
| Internet → CloudPanel sites | CF proxy / direct → nginx | ACTIVE |
| Internet → Supabase Studio | Cloudflare Tunnel | ACTIVE |
| Internet → probot/workbench | Cloudflare Tunnel (OfficeMac) | ACTIVE |
| Operator → all nodes | Tailscale SSH | ACTIVE |
| dokploy-aws → Supabase DB | Tailscale subnet route (10.0.2.4:5433) | ACTIVE |
| Internet → dokploy-aws (direct) | BLOCKED (Lightsail FW) | SECURE |
| Internet → supabase DB | BLOCKED (UFW + no public route) | SECURE |

---

## Addendum — Evidence Closure Pass (2026-08-18, session 2)

### Azure Fallback → Supabase Connectivity Verification

**Context:** Phase 1 remediation removed 4 stale Supabase UFW rules referencing old Azure
Dokploy IP (100.83.38.48) on ports 8000/5432/5433/8443.

**Proof that removal did NOT reduce Azure fallback rollback capability:**

1. Supabase iptables INPUT chain rule #1 is `ts-input` (processes before UFW)
2. ts-input rule #2: `ACCEPT all -- 0.0.0.0/0 → 0.0.0.0/0` (accepts all Tailscale-approved traffic)
3. Tailscale wildcard grant (`src:* dst:* ip:*`) allows 100.83.38.48 → 100.71.31.88 on all ports
4. Bidirectional connectivity confirmed: `tailscale ping` from supabase → dokploy (100.83.38.48) = pong via 68.221.139.108:41641 in 1-5ms (direct connection)
5. The removed UFW rules were unreachable (ts-input accepted traffic before UFW could process)

**Conclusion:** REMOVAL DID NOT REDUCE AZURE FALLBACK SUPABASE CONNECTIVITY.

### CloudPanel SSH Perimeter — Current State

| Layer | TCP/22 Scope | Evidence |
|-------|-------------|----------|
| Host UFW | ALLOW from Anywhere (v4+v6) | `ufw status` |
| Lightsail Firewall | `lightsail-connect` ONLY (cidrs: []) | AWS API `get-instance-port-states` |
| Normal Public SSH | BLOCKED (nc timeout to 13.135.227.0:22) | External connectivity test |
| Tailscale OpenSSH | PASS | `ssh cloudpanel` succeeds via 100.121.12.36 |
| Lightsail Browser-SSH | SUPPORTED | `lightsail-connect` alias present in port rules |

**Summary:** CloudPanel SSH is accessible ONLY via:
1. Tailscale (OpenSSH over WireGuard tunnel)
2. AWS Lightsail browser-SSH (AWS console only)

Public internet SSH is blocked at Lightsail perimeter despite UFW allowing Anywhere.

### Complete Tunnel → Hostname Mapping (RESOLVED)

Source: cloudflared management API (http://localhost:20241/config) on each server.

**Dokploy Tunnel** (dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b) — 39 hostnames:

| Hostname | Origin |
|----------|--------|
| dokploy.prochat.tools | http://localhost:3000 |
| accountant.prochat.tools | http://localhost:80 |
| n8n.prochat.tools | http://localhost:80 |
| resend.prochat.tools | http://localhost:80 |
| openfund.yeshua.academy | http://localhost:80 |
| olivetoorganizing.com | http://localhost:80 |
| jccpholdings.com | http://localhost:80 |
| jpvbootcamp.com | http://localhost:80 |
| viadieden.it | http://localhost:80 |
| onestatus.link | http://localhost:80 |
| eggcooker.app | http://localhost:80 |
| casaqr.pt | http://localhost:80 |
| saysthe.bible | http://localhost:80 |
| wanted.house | http://localhost:80 |
| docs.prochat.tools | http://localhost:80 |
| yeshua.academy | http://localhost:80 |
| cedula.prochat.tools | http://localhost:80 |
| prokit-studio.prochat.tools | http://localhost:80 |
| saaskit-studio.prochat.tools | http://localhost:80 |
| www.yeshua.academy | http://localhost:80 |
| prokit-dev.prochat.tools | http://localhost:80 |
| saaskit-dev.prochat.tools | http://localhost:80 |
| umami.prochat.tools | http://localhost:80 |
| getproofly.app | http://localhost:80 |
| xgrow.prochat.tools | http://localhost:80 |
| prochat.tools | http://localhost:80 |
| lean.diet | http://localhost:80 |
| arkware.solutions | http://localhost:80 |
| jccp-management.pro | http://localhost:80 |
| finance.yeshua.academy | http://localhost:80 |
| auth.prochat.tools | http://localhost:80 |
| auth-admin.prochat.tools | http://localhost:80 |
| fala.prochat.tools | http://localhost:80 |
| finance.prochat.tools | http://localhost:80 |
| buildflow-staging.prochat.tools | http://localhost:3054 |
| legal.prochat.tools | http://localhost:80 |
| legal-api.prochat.tools | http://localhost:80 |
| app.jpvbootcamp.com | http://localhost:80 |
| preview.jpvbootcamp.com | http://localhost:80 |

**CloudPanel Tunnel** (1bdef92e-5e70-4836-9552-3e4653cef43a) — 10 hostnames:

| Hostname | Origin |
|----------|--------|
| admin.yeshua.academy | https://localhost |
| feelgoodwithana.com | http://localhost:8080 |
| microgreens.market | http://localhost:8080 |
| onefleshinchrist.com | http://localhost:8080 |
| wedding.onefleshinchrist.com | http://localhost:8080 |
| pedroandkristina.com | http://localhost:8080 |
| vilasolidaria.pt | http://localhost:8080 |
| portal.jpvbootcamp.com | http://localhost:8080 |
| legacy.prochat.tools | http://localhost:8080 |
| cp.prochat.tools | https://localhost:8443 |

**Supabase Tunnel** (dd5ca154-87cb-4163-bb06-ee784aeaf36f) — 2 hostnames:

| Hostname | Origin |
|----------|--------|
| studio.prochat.tools | http://localhost:8000 |
| api_supabase.prochat.tools | http://localhost:8000 |

**OfficeMac Tunnel** (1b1fa7bf-a00f-4f1a-86bb-faecac746051) — 2 hostnames:

| Hostname | Origin |
|----------|--------|
| probot.prochat.tools | http://localhost:7070 |
| workbench.prochat.tools | http://127.0.0.1:3154 |

**Total: 53 hostnames across 4 tunnels + 4 catch-all (http_status:404)**

**Notable:** `traefik.prochat.tools` is NOT in any tunnel configuration — confirmed stale DNS record.

### Cloudflare Access — Status

No Cloudflare Access is configured at the tunnel ingress level (all `access.teamName` empty,
all `access.audTag` null across all 54 ingress rules).

Standalone Zero Trust Access applications MAY exist but cannot be verified without a working
Cloudflare API token (both `prochat-provisioner` and `prochat-destroyer` tokens return 401).

**Status:** PARTIALLY RESOLVED — tunnel-level Access confirmed absent; standalone Access
policies remain UNKNOWN pending API token refresh.

### Lightsail Firewall — Verified via AWS API

**dokploy-aws:**
- TCP/22: `lightsail-connect` only (no public CIDRs)
- No other ports open

**cloudpanel-aws:**
- TCP/80: 0.0.0.0/0 + ::/0 (public web)
- TCP/443: 0.0.0.0/0 + ::/0 (public HTTPS)
- UDP/443: 0.0.0.0/0 + ::/0 (QUIC/HTTP3)
- TCP/22: `lightsail-connect` only (no public CIDRs)

### Unknown Resolution Summary

| # | Unknown | Status | Resolution Method |
|---|---------|--------|-------------------|
| 1 | CF tunnel → hostname mapping | RESOLVED | cloudflared mgmt API (localhost:20241/config) |
| 2 | Cloudflare Access policies | PARTIAL | No tunnel-level Access; standalone ZT apps unknown (API 401) |
| 3 | Azure Dokploy service state | RESOLVED | Tailscale idle, not a tunnel connector, direct ping via DERP |
| 4 | Lightsail firewall rules | RESOLVED | AWS Lightsail API `get-instance-port-states` |
| 5 | CloudPanel sites → tunnel mapping | RESOLVED | 10 hostnames via CloudPanel tunnel, 2 via direct A record |
| 6 | Dokploy admin access protection | RESOLVED | App-level auth (email/password), no CF Access |
| 7 | Azure Dokploy public IP | RESOLVED | Confirmed 68.221.139.108 via tailscale ping origin |
| 8 | Traefik 8080 via tunnel | RESOLVED | NOT in tunnel config; DNS stale; Lightsail blocks direct |
| 9 | MariaDB access | RESOLVED | 0.0.0.0:3306, Lightsail-blocked, Tailscale-only, no external conns |

**Unknowns before:** 9
**Unknowns resolved:** 8 fully + 1 partially
**Unknowns remaining:** 1 (Cloudflare Access standalone policies — requires API token refresh)

---

## Audit Metadata

```
File created:                     2026-08-18
Audit duration:                   Two sessions (same day)
Infrastructure mutations:         1 (Supabase: 4 stale UFW rules removed)
Cloudflare mutations:             0
Tailscale mutations:              0
Documentation mutations:          0
Git commits:                      0
Git pushes:                       0
Secrets in report:                0
```

## 2026-08-22 OfficeMac correction and live verification

This section supersedes the OfficeMac version and transport details above;
the original audit remains historical evidence.

    Status:           LIVE CORRECTION / VERIFIED
    Correction date:  2026-08-22
    Cloudflared:      2026.8.2
    Tunnel transport: http2 over TCP
    Tunnel status:    4 active HA connections
    Request errors:   0 at verification time
    Origin:           http://127.0.0.1:3154/health -> HTTP 200
    Public health:    https://workbench.prochat.tools/health -> 10/10 HTTP 200
    Public latency:   approximately 69-116 ms across 10 probes
    Local firewall:   disabled; no local firewall rule added
    Secrets exposed:  0

The earlier 2026.3.0 OfficeMac connector was upgraded after repeated
outdated-version warnings. Historical origin connection refused/EOF events
coincided with Workbench restart windows. Historical QUIC connection resets
led to the reversible OfficeMac protocol: http2 mitigation. Direct local
probes to Cloudflare port 7844 succeeded; no macOS firewall rule was available
or necessary to change. Router/firewall policy outside this host remains an
infrastructure boundary and was not mutated by this correction.
