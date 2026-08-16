# Phase 3C0 — Tailscale Integration + Supabase Connectivity + Shadow-Suppression Closure

**Date:** 2026-08-16
**Status:** PHASE 3C0 COMPLETE
**Azure state:** UNMODIFIED — still authoritative production (42 containers, cloudflared active)
**AWS state:** Tailscale joined, Supabase connectivity proven, GHCR verified, no production workloads running

---

## TAILSCALE TOPOLOGY

### Tailnet Information

| Property | Value |
|----------|-------|
| Tailnet name | prochat.tools |
| MagicDNS suffix | tail3c0f0a.ts.net |
| MagicDNS enabled | YES |

### Node Inventory

| Node | Machine Name | MagicDNS FQDN | Tailscale IPv4 | Tailscale IPv6 | OS | Tags | Subnet Routes |
|------|-------------|----------------|----------------|----------------|-----|------|---------------|
| Azure Dokploy | dokploy (HostName: dokploy-new) | dokploy.tail3c0f0a.ts.net | 100.83.38.48 | fd7a:115c:a1e0::b634:2630 | linux | none | none |
| AWS Dokploy | dokploy-aws | dokploy-aws.tail3c0f0a.ts.net | 100.71.47.24 | fd7a:115c:a1e0::6136:2f19 | linux | none | none (accepts routes) |
| Supabase | supabase | supabase.tail3c0f0a.ts.net | 100.71.31.88 | fd7a:115c:a1e0::4934:1f58 | linux | tag:supabase | 10.0.2.0/24 |

### Subnet Route Architecture

```
Supabase node (100.71.31.88) advertises: 10.0.2.0/24
  └── 10.0.2.4:5433 = PostgreSQL (analytics, ory_prod, fala, tenant DBs)
  └── 10.0.2.4:8000 = Kong API Gateway (Supabase HTTP API)

dokploy-aws (100.71.47.24) accepts routes → can reach 10.0.2.0/24
dokploy (Azure, 100.83.38.48) accepts routes → can reach 10.0.2.0/24
```

---

## STEP RESULTS

### Step 1: Tailscale Topology Audit — COMPLETE

| Fact | Value |
|------|-------|
| Tailnet | prochat.tools |
| MagicDNS | Enabled |
| Azure node at 100.83.38.48 | machine name: `dokploy` (HostName: `dokploy-new`) |
| Supabase node at 100.71.31.88 | machine name: `supabase`, tag: `tag:supabase` |
| Subnet route advertiser | supabase — advertises `10.0.2.0/24` |
| Route approval | Approved (visible in AllowedIPs) |
| `dokploy-aws` pre-existing | NO — name was available |
| Azure is NOT exit node | Correct |
| No conflicting machine names | Confirmed |

### Step 2: Reference Audit — COMPLETE

All application connections to Supabase use **IP-based** destination `10.0.2.4:5433` via the subnet route. No references to source IP `100.83.38.48` or Azure's MagicDNS name exist in runtime configuration.

**Services with runtime `10.0.2.4:5433` references:**

| Service | Config file | Purpose |
|---------|------------|---------|
| Umami | docker-compose.yml (inline) | `DATABASE_URL: postgresql://umami:***@10.0.2.4:5433/analytics` |
| Ory Kratos | docker-compose.yml (inline) | `DSN=postgresql://ory_user:***@10.0.2.4:5433/ory_prod` |
| app-override-online-interface | .env | `DATABASE_URL=postgresql://***@10.0.2.4:5433/fala` |
| Says the Bible | .env | `DATABASE_URL` + `SUPABASE_URL` → 10.0.2.4 |
| Via di Eden | .env | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| Cedula | .env | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| ProChat | .env | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| JPV Bootcamp | .env | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| Oliveto Organizing | .env | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| OpenFund | .env.production | `DATABASE_URL` + `MCP_DATABASE_URL` → 10.0.2.4:5433 |
| StatusLink | .env.production | `DATABASE_URL` + `SYSTEM_DATABASE_URL` → 10.0.2.4:5433 |
| ProChat Accountant | .env.production | `DATABASE_URL` → 10.0.2.4:5433 |

**Key finding:** All connections are destination-based. No .env or config changes needed on AWS. Tailscale with `accept-routes` is sufficient.

### Step 3: AWS Joined to Tailscale — PASS

| Property | Value |
|----------|-------|
| Machine name | dokploy-aws |
| Accept routes | YES (`RouteAll: true`) |
| Exit node | NO |
| Advertise routes | None |
| Node identity | Fresh (new node, not copied from Azure) |
| Azure node | Untouched, not renamed |
| StableID | nbJkzZcDD211CNTRL |

### Step 4: AWS Tailscale Identity Recorded

| Property | Value |
|----------|-------|
| Machine name | dokploy-aws |
| Tailscale IPv4 | 100.71.47.24 |
| Tailscale IPv6 | fd7a:115c:a1e0::6136:2f19 |
| MagicDNS name | dokploy-aws.tail3c0f0a.ts.net |
| Tailnet | prochat.tools |
| Tags | None |
| Accept-routes | Enabled |
| StableID | nbJkzZcDD211CNTRL |

### Step 5: AWS → Supabase Connectivity — PASS

| Test | Result |
|------|--------|
| Tailscale sees supabase node | YES (100.71.31.88, online) |
| Tailscale ping to 100.71.31.88 | PASS — via DERP(par), 25-49ms |
| Connection type | DERP relay (Paris) — not direct |
| Subnet route 10.0.2.0/24 accepted | YES (visible in peer AllowedIPs) |
| TCP connect to 10.0.2.4:5433 | SUCCESS |
| TCP connect to 100.71.31.88:5433 | SUCCESS |
| PostgreSQL `SELECT 1` via 10.0.2.4:5433 | PASS (umami/analytics) |
| Exact production endpoint verified | 10.0.2.4:5433 — same as all app configs |

### Step 6: Supabase Change Required — NO

**SUPABASE UPDATE REQUIRED: NO**

Empirical proof: `SELECT 1` succeeded from the new AWS node (100.71.47.24) to 10.0.2.4:5433 without any Supabase-side changes. This means:
- No pg_hba.conf source-IP restriction blocks the new node
- No Tailscale ACL blocks communication between dokploy-aws and supabase
- No firewall rule on the Supabase host blocks the new source IP
- The subnet route is permissive to all tailnet nodes that accept it

### Step 7: Reverse Connectivity — NOT REQUIRED

**Direction:** AWS → Supabase only (client → server)

No service on Supabase initiates connections back to Dokploy:
- PostgreSQL is a passive server
- No webhook callbacks configured
- No Supabase realtime server-to-server subscriptions
- n8n workflows are pull-based (initiated from Dokploy)

### Step 8: GHCR Pull Test — PASS

| Check | Result |
|-------|--------|
| Docker config present | /home/ubuntu/.docker/config.json (mode 600) |
| Registry authenticated | ghcr.io (user: stevewesthoek, PAT format) |
| Pull test image | ghcr.io/prochattools/prochat:latest |
| Pull result | SUCCESS |
| Digest | sha256:1b7e6028a89ba98cec519eeb4936b77bce957d8abc4a07c0579e186cd13386f6 |
| Digest matches manifest | YES (exact match) |
| Image cleaned up | YES (not started as workload) |
| Fix applied | Copied config to /root/.docker/ for sudo docker compatibility |

### Step 9: Shadow-Suppression Reversal Manifest — COMPLETE

#### Schedule (1 row)

| scheduleId | App Name | Cron | AWS Current | Azure Authoritative | Restore Value |
|-----------|----------|------|-------------|--------------------|--------------| 
| vyN0X3Y6OpO5b_cZbS0r3 | JPV Bootcamp \| Payload CMS | */2 * * * * | false | **true** | true |

#### Application autoDeploy (24 rows)

| Name | AWS Current | Azure Authoritative | Restore Value |
|------|-------------|--------------------|--------------| 
| BuildFlow | false | true | true |
| BuildFlow Staging | false | true | true |
| Cedula | false | true | true |
| Egg Cooker | false | true | true |
| fala | false | true | true |
| Free Resend | false | true | true |
| JCCP Holdings | false | true | true |
| JPV Bootcamp | false | true | true |
| JPV Bootcamp \| Payload CMS | false | true | true |
| Oliveto Organizing | false | true | true |
| ProChat | false | true | true |
| ProChat Accountant | false | true | true |
| ProKit Dev | false | true | true |
| ProKit Studio | false | true | true |
| Proofly | false | true | true |
| SaaSKit Dev | false | true | true |
| SaaSKit Studio | false | true | true |
| Says the Bible | false | true | true |
| Status Link | false | true | true |
| Vault Legal | false | true | true |
| Vault Legal API | false | true | true |
| Via di Eden | false | true | true |
| Yeshua Academy | false | true | true |
| Yeshua Academy Finance | false | true | true |

#### Compose autoDeploy (17 rows)

| Name | AWS Current | Azure Authoritative | Restore Value |
|------|-------------|--------------------|--------------| 
| cedula | false | true | true |
| jpvbootcamp | false | true | true |
| jpvbootcamp | false | true | true |
| n8n | false | true | true |
| olivetoorganizing | false | true | true |
| openfund | false | true | true |
| ory | false | true | true |
| prochat | false | true | true |
| prokit | false | true | true |
| prokitstudio | false | true | true |
| resend | false | true | true |
| saaskit | false | true | true |
| saaskitstudio | false | true | true |
| saysthebible | false | true | true |
| statuslink | false | true | true |
| umami | false | true | true |
| viadieden | false | true | true |

#### Reversal SQL (execute at cutover only)

```sql
-- Restore schedule
UPDATE schedule SET enabled = true WHERE "scheduleId" = 'vyN0X3Y6OpO5b_cZbS0r3';

-- Restore application autoDeploy (all 24)
UPDATE application SET "autoDeploy" = true;

-- Restore compose autoDeploy (all 17)
UPDATE compose SET "autoDeploy" = true;
```

**Note:** Azure confirmed ALL values are uniformly `true`. No per-row exceptions exist.

### Step 10: Final Tailscale Name Transition Plan — DOCUMENTED (NOT EXECUTED)

**Current state (during migration):**

| Node | Name | IP | Role |
|------|------|-----|------|
| Azure | dokploy | 100.83.38.48 | ACTIVE production |
| AWS | dokploy-aws | 100.71.47.24 | Shadow/staging |
| Supabase | supabase | 100.71.31.88 | External DB |

**Post-cutover transition (ONLY after Azure decommissioned + explicit approval):**

1. Verify AWS is authoritative and stable (running all production for 48h+)
2. Remove or expire the old Azure Tailscale node
3. Rename AWS node: `sudo tailscale set --hostname=dokploy`
4. Verify AWS Tailscale IP did NOT change (should remain 100.71.47.24)
5. Verify MagicDNS resolves `dokploy.tail3c0f0a.ts.net` → 100.71.47.24
6. Verify all dependency connectivity (Supabase, GHCR, Cloudflare tunnel)
7. Update canonical documentation with final IP/name

**Rollback:** If rename causes issues, revert with `sudo tailscale set --hostname=dokploy-aws`

**DO NOT execute this rename during Phase 3C0 or Phase 3C.**

---

## ROLLBACK PROCEDURE

If Phase 3C shadow-start encounters issues:

1. Stop all application containers on AWS: `sudo docker service scale <name>=0` for each
2. AWS Tailscale remains joined (harmless — no production traffic routes to it)
3. Azure continues serving production unchanged
4. Restore from snapshot: `dokploy-aws-pre-production-baseline-20260816` if needed

---

## FINAL VERDICT

| # | Question | Answer |
|---|----------|--------|
| 1 | AWS `dokploy-aws` successfully joined to Tailscale | **YES** |
| 2 | New AWS Tailscale IPv4 | **100.71.47.24** |
| 3 | New AWS MagicDNS/machine name | **dokploy-aws.tail3c0f0a.ts.net** |
| 4 | Azure Dokploy Tailscale identity confirmed | **YES** — dokploy / 100.83.38.48 |
| 5 | Supabase Tailscale identity confirmed | **YES** — supabase / 100.71.31.88 / tag:supabase |
| 6 | Advertised subnet route identified | **YES** — 10.0.2.0/24 from supabase node |
| 7 | `accept-routes` enabled on AWS | **YES** (RouteAll: true) |
| 8 | AWS → 100.71.31.88 connectivity | **PASS** |
| 9 | AWS → actual Supabase DB endpoint connectivity | **PASS** (SELECT 1 via 10.0.2.4:5433) |
| 10 | Exact Supabase DB endpoint used by applications | **10.0.2.4:5433** (via subnet route from supabase node) |
| 11 | Supabase update required | **NO** |
| 12 | If YES, exact required change | N/A |
| 13 | Reverse Supabase → AWS connectivity required | **NO** |
| 14 | GHCR private pull test | **PASS** (digest matches manifest) |
| 15 | Shadow-suppression reversal manifest complete | **YES** |
| 16 | Final Tailscale rename transition documented | **YES** (not executed) |
| 17 | Any remaining blockers | **NONE** |
| 18 | READY FOR PHASE 3C SHADOW START | **YES** |
| 19 | Confirmation production applications remain stopped | **YES** — 0 application workloads on AWS |
| 20 | Confirmation Azure remains authoritative/unmodified | **YES** — 42 containers, cloudflared active |
| 21 | Confirmation Cloudflare/DNS untouched | **YES** — cloudflared not installed on AWS, no DNS changes |
| 22 | Git status | See below |

---

## NOTES

- DERP relay path (Paris) for AWS↔Supabase is functional but adds ~25-50ms latency. A direct connection may establish over time as Tailscale discovers NAT traversal paths. This is acceptable for database queries.
- Docker credential fix: copied `/home/ubuntu/.docker/config.json` to `/root/.docker/config.json` so `sudo docker pull` works without `--config` flag.
- The Azure node's internal HostName is `dokploy-new` but its MagicDNS resolves as `dokploy.tail3c0f0a.ts.net` — this is a Tailscale naming artifact and has no operational impact.
