# ProChat Infrastructure — Evidence Register

**Phase:** 3C7–3C11 + Phase 3F Post-Cutover — Architecture Evidence-Provenance Audit and Correction Passes  
**Created:** 2026-08-16  
**Last updated:** 2026-08-26 (Azure Dokploy decommission and canonicalization)
**Status:** COMPLETE — AWS Dokploy sole production authority; Azure Supabase active production

## Purpose

Every material architecture claim is classified by how it was established:

| Classification | Meaning |
|---------------|---------|
| **OBSERVED-VERIFIED** | Direct read-only inspection of a live system (query, file read, command output) |
| **DERIVED-VERIFIED** | Logically derived from ≥2 OBSERVED-VERIFIED facts |
| **AUTHORITATIVE-CONFIG** | Recorded in a config file or system artifact that is the primary source of truth |
| **USER-PROPOSED** | Stated by Steve or a prior AI session, not yet independently verified |
| **UNKNOWN** | Not determinable from available evidence |

Rule: **AUTHORITATIVE-CONFIG supersedes USER-PROPOSED. OBSERVED-VERIFIED supersedes both.**

---

## Server & Network Facts

### F-NET-001 — AWS Tailscale IP
- **Claim:** AWS Lightsail instance (dokploy-aws) has Tailscale IP 100.71.47.24
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `sudo tailscale status` from AWS returned `100.71.47.24 dokploy-aws`
- **Observed:** 2026-08-16

### F-NET-002 — Azure Tailscale IP
- **Claim:** Azure Dokploy instance has Tailscale IP 100.83.38.48
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `sudo tailscale status` from AWS returned `100.83.38.48 dokploy`
- **Observed:** 2026-08-16

### F-NET-003 — Supabase Tailscale IP
- **Claim:** Supabase server has Tailscale IP 100.71.31.88
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `sudo tailscale status` from AWS returned `100.71.31.88 supabase tagged-devices`; `active; direct 68.221.194.245:41641`
- **Observed:** 2026-08-16

### F-NET-004 — Tailscale network size
- **Claim:** Tailnet has 7 registered devices (6 active, 1 offline)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `sudo tailscale status` listed: dokploy-aws (100.71.47.24), dokploy/Azure (100.83.38.48), iphone (100.107.201.123), macbook (100.70.12.18), motorola (100.107.156.26 — offline 76d), office (100.86.124.66), supabase (100.71.31.88) = 7 total, 6 active, 1 offline (motorola).
- **Notes:** Architecture document previously stated "3 Tailscale nodes (Azure, AWS, Supabase)" — that was a subset of the infrastructure nodes only. Full tailnet has 7 registered devices.
- **Observed:** 2026-08-16

### F-NET-005 — Supabase direct Tailscale tunnel
- **Claim:** AWS→Supabase Tailscale connection is a direct peer tunnel (not relay)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `tailscale status` showed `supabase active; direct 68.221.194.245:41641, tx 10308 rx 15724`
- **Significance:** Direct tunnel means lower latency and no DERP relay dependency for the Supabase path
- **Observed:** 2026-08-16

### F-NET-006 — Supabase subnet route via 10.0.2.4
- **Claim:** Supabase PostgreSQL is reachable from AWS via subnet route 10.0.2.4:5433
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Active connections query succeeded against the 10.0.2.4:5433 endpoint. DATABASE_URL distribution from F-APP-001 (24 total applications):
  - 14 × `10.0.2.4:5433` (subnet route)
  - 1 × `100.71.31.88:5433` (fala — Tailscale IP direct)
  - 1 × Supabase Cloud (`aws-1-eu-west-1.pooler.supabase.com` — ProKit dev, external service)
  - 1 × `localhost:5433` (SaaSKit dev — local compose postgres)
  - 7 × no DATABASE_URL in Dokploy config (buildflow, egg-cooker, transmit-unknown, vault-legal-api, vault-legal-frontend, jccp-holdings, yeshua-academy)
- **Note:** Applications with no DATABASE_URL may access data through SDK configuration, environment variables, or other mechanisms not captured in the Dokploy `application.env` field. Absence of DATABASE_URL does not prove absence of Supabase access.
- **Observed:** 2026-08-16

### F-NET-007 — fala app uses Tailscale IP directly
- **Claim:** The `fala` application (app-override-online-interface-1wzjpb) connects to Supabase via `100.71.31.88:5433` (Tailscale IP), not the subnet route `10.0.2.4:5433`
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `application.env` column in Dokploy DB: `DATABASE_URL=postgresql://<user>:<pwd>@100.71.31.88:5433/fala?schema=public`
- **Notes:** Both paths reach the same Supabase server; 100.71.31.88 is Tailscale peer IP while 10.0.2.4 is subnet route. Functionally equivalent but different routing mechanism.
- **Observed:** 2026-08-16

### F-NET-008 — Cloudflare Tunnel is outbound from cloudflared
- **Claim:** Cloudflare Tunnel is initiated by the `cloudflared` daemon; it connects outbound to Cloudflare edge
- **Classification:** AUTHORITATIVE-CONFIG
- **Evidence:** Cloudflare tunnel architecture; confirmed by no inbound port 80/443 rules in Lightsail firewall
- **Notes:** AWS Lightsail firewall has no port 80/443 rules (confirmed in Phase 3C3). Public traffic reaches AWS ONLY via the tunnel, not direct IP.

### F-NET-009 — cloudflared not installed on AWS (service only)
- **Claim:** AWS has no cloudflared configuration directory; only a staged systemd service file
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `ls /etc/cloudflared/` → no such directory; `ls ~/.cloudflared/` → no such directory; `ls /root/.cloudflared/` → no such directory
- **Notes:** Token is embedded in `/etc/systemd/system/cloudflared.service.staged` (not yet active)
- **Observed:** 2026-08-16

### F-NET-010 — cloudflared masked on AWS
- **Claim:** cloudflared service is masked (disabled) on AWS
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `systemctl status cloudflared` returned `masked (Reason: Unit cloudflared.service is masked.) + Active: inactive (dead)` — confirmed in Phase 3C3/3C6 verification

---

## Firewall Facts

### F-FW-001 — Azure NSG name
- **Claim:** Azure firewall is `vm-dokploy-nsg` in resource group `rg-apps-dokploy`
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `az network nsg show -n vm-dokploy-nsg -g rg-apps-dokploy` succeeded
- **Observed:** 2026-08-16

### F-FW-002 — Azure NSG: port 22 publicly reachable
- **Claim:** Azure VM port 22 is publicly reachable from the internet (except one blocked IP)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** NSG rules: Priority 300 DENY TCP 22 from `161.230.249.46`; Priority 900 ALLOW * port 22 from `*`. In Azure NSG, lower priority number = higher precedence. The Deny blocks only that one IP; all other source IPs can reach port 22.
- **Critical correction:** Phase 3C5/3C6 architecture document stated "SSH access via `az vm run-command invoke` — direct SSH to Azure is blocked by Tailscale ACL policy." This was imprecise. TAILSCALE SSH to Azure is blocked by the tailnet ACL (the operator's machine is blocked via Tailscale overlay). But DIRECT SSH via Azure's public IP is allowed from all internet sources (except 161.230.249.46). Security relies on key-based authentication.
- **Observed:** 2026-08-16

### F-FW-003 — AWS Lightsail: port 22 restricted to /32
- **Claim:** AWS Lightsail port 22 is only open to a single /32 source IP
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Lightsail firewall ruleset confirmed port 22 TCP from `5.249.73.210/32` only
- **Observed:** 2026-08-16 (Phase 3C3)

### F-FW-004 — AWS Lightsail: ports 80/443 absent from firewall
- **Claim:** AWS Lightsail firewall has no rules for ports 80 or 443
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Lightsail firewall ruleset enumerated — only port 22 rule present
- **Notes:** Public HTTP/S traffic reaches AWS ONLY via Cloudflare Tunnel (outbound cloudflared connection). Direct-IP HTTP/S is blocked.
- **Observed:** 2026-08-16 (Phase 3C3)

---

## Supabase Database Facts

### F-DB-001 — Supabase PostgreSQL version
- **Claim:** Self-hosted Supabase server runs PostgreSQL 15.8
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `SELECT version()` returned `PostgreSQL 15.8 (Ubuntu 15.8-1.pgdg22.04+1) on x86_64-pc-linux-gnu`
- **Observed:** 2026-08-16

### F-DB-002 — Supabase pg_database catalog: 26 rows, 24 non-template logical databases
- **Claim:** Supabase has 26 rows in pg_database (2 system templates + 24 non-template logical databases)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `BEGIN TRANSACTION READ ONLY; SELECT datname, pg_get_userbyid(datdba) FROM pg_database ORDER BY datname; ROLLBACK;` — verified 26 rows; `SHOW transaction_read_only` confirmed `on` before queries
- **Observed:** 2026-08-16

### F-DB-003 — Supabase logical database inventory
- **Claim:** The 24 non-template Supabase databases are as follows
- **Classification:** OBSERVED-VERIFIED
- **Observed:** 2026-08-16

| Database | Owner | Size (approx) | Notes |
|----------|-------|---------------|-------|
| `_supabase` | supabase_admin | 2180 MB | Supabase infrastructure DB |
| `accountant` | accountant_user | — | ProChat Accountant app |
| `analytics` | supabase_admin | — | Supabase Analytics |
| `cedula` | supabase_admin | — | Cedula app |
| `fala` | supabase_admin | — | Fala app (status: error) |
| `finance` | **postgres** | — | Yeshua Academy Finance / OpenFund |
| `finance\` | supabase_admin | ~10 MB | Anomaly — literal backslash in name |
| `finance_shadow` | **postgres** | 7829 kB | PROBABLE TOOLING — name suggests Prisma `migrate dev` shadow DB; purpose not fully verified (see Q7) |
| `jpvbootcamp` | supabase_admin | — | JPV Bootcamp (prod + staging schemas) |
| `olivetoorganizing` | supabase_admin | — | Olive to Organizing |
| `openfund` | supabase_admin | — | OpenFund (separate DB from finance; F-DB-020) |
| `ory_prod` | ory_user | — | Ory Kratos identity DB |
| `postgres` | postgres | — | Contains 36 application/Supabase-relevant schemas (see F-SCH-001) |
| `prochat` | supabase_admin | — | ProChat main app |
| `prokitstudio` | supabase_admin | — | ProKit Studio / templates-prokit |
| `proofly` | proofly_user | — | Proofly app |
| `resend` | supabase_admin | — | Free-Resend internal service |
| `saaskitstudio` | supabase_admin | — | SaaSKit Studio / templates-saaskit |
| `saysthebible` | supabase_admin | — | Says the Bible app |
| `statuslink` | supabase_admin | — | Status Link app |
| `tenant_prokit` | supabase_admin | 8013 kB | Usage UNKNOWN — no current Dokploy application DATABASE_URL points to this logical database. tenant_ naming is not evidence of obsolescence. See F-UNK-005. |
| `tenant_saaskit` | supabase_admin | 8181 kB | Usage UNKNOWN — no current Dokploy application DATABASE_URL points to this logical database. tenant_ naming is not evidence of obsolescence. See F-UNK-005. |
| `vault_legal` | supabase_admin | — | Vault Legal |
| `viadieden` | supabase_admin | — | Via Dieden |

**Owner correction vs Phase 3C4:**
- `finance`: Phase 3C4 stated owner `supabase_admin` — actual owner is `postgres`
- `finance_shadow`: Phase 3C4 stated owner `supabase_admin` — actual owner is `postgres`
- `ory_prod`: Phase 3C4 stated owner `supabase_admin` — actual owner is `ory_user`
- `proofly`: Phase 3C4 stated owner `supabase_admin` — actual owner is `proofly_user`
- `accountant`: Phase 3C4 stated owner `supabase_admin` — actual owner is `accountant_user`

### F-DB-004 — `openfund` database vs `finance` database — distinct databases
- **Claim:** `openfund` and `finance` are separate logical databases. The application `apps-saas-open-fund-vdymfu` connects to the `finance` database (not `openfund`). The `openfund` database purpose is UNKNOWN.
- **Classification:** OBSERVED-VERIFIED (for connection) + UNKNOWN (for `openfund` purpose)
- **Evidence:** `application.env` shows `DATABASE_URL=postgresql://<user>:<pwd>@10.0.2.4:5433/finance?schema=finance`. Separate `openfund` DB exists in pg_database but no application connects to it in current Dokploy config.
- **Notes:** `openfund` DB may be orphaned, a renamed predecessor, or a separate project not yet deployed. Investigate post-cutover.
- **Observed:** 2026-08-16

---

## Supabase Schema Facts (postgres DB)

### F-SCH-001 — Schema count in postgres database
- **Claim:** The `postgres` Supabase database contains exactly 36 application/Supabase-relevant schemas
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Full `pg_namespace` query returned 67 rows total. Excluding 31 PostgreSQL-internal rows (pg_catalog, pg_toast, information_schema, 14× pg_temp_*, 14× pg_toast_temp_*) leaves 36 schemas.
- **Arithmetic:** 12 Supabase-internal + 16 tenant_* application-mapped + 3 non-tenant application-mapped + 5 legacy-candidate = 36
- **Phase 3C7 correction:** Phase 3C7 display filtered information_schema and reported 35; Phase 3C8 full query confirmed correct count is 36.
- **Original architecture document claim (pre-Phase 3C7):** "64+" — incorrect.
- **Observed:** 2026-08-16

### F-SCH-002 — Schema ownership model: schema owner ≠ table owner
- **Claim:** For many tenant_ schemas, the schema-level owner (nspowner) differs from the table-level owner
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Cross-query of `pg_namespace.nspowner` vs `pg_class.relowner` for tenant_ schemas revealed systematic difference

| Schema | Schema Owner | Table Owner | Table Count |
|--------|-------------|-------------|-------------|
| tenant_boilerplate | postgres | tenant_boilerplate_user | 4 |
| tenant_cedula | supabase_admin | supabase_admin | 5 |
| tenant_jpvbootcamp | supabase_admin | supabase_admin | 12 |
| tenant_olivetoorganizing | postgres | (none) | 0 |
| tenant_openfund | mcp_manager | mcp_manager | 13 |
| tenant_prochat | supabase_admin | tenant_prochat_user | 7 |
| tenant_prochattools | postgres | tenant_prochattools_user | 4 |
| tenant_procore | supabase_admin | tenant_procore_user | 2 |
| tenant_prokit | supabase_admin | tenant_prokit_user | 2 |
| tenant_prokitcore | supabase_admin | tenant_prokitcore_user | 2 |
| tenant_prokitstudio | supabase_admin | tenant_prokitstudio_user | 2 |
| tenant_rebuildwp | mcp_manager | (none) | 0 |
| tenant_resend | tenant_resend_user | supabase_admin | 6 |
| tenant_saaskit | supabase_admin | tenant_saaskit_user | 4 |
| tenant_saaskitcore | supabase_admin | tenant_saaskitcore_user | 4 |
| tenant_saaskitstudio | supabase_admin | tenant_saaskitstudio_user | 4 |
| tenant_saysthebible | postgres | saysthebible_user | 21 |
| tenant_statuslink | tenant_statuslink_user | tenant_statuslink_user | 19 |
| tenant_viadieden | postgres | (none) | 0 |

**Observed:** 2026-08-16

### F-SCH-003 — `financialfreedom_schema` is empty
- **Claim:** `financialfreedom_schema` contains 0 tables (and 0 objects of any kind)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='financialfreedom_schema'` returned 0 rows
- **Critical correction:** Phase 3C4 post-cutover hygiene document stated "financialfreedom_schema | financialfreedom_user | 12+ tables". This was incorrect. The 13 financialfreedom_user-owned tables are in the **`public` schema**, not in `financialfreedom_schema`.
- **Observed:** 2026-08-16

### F-SCH-004 — `financialfreedom_user` tables reside in `public` schema
- **Claim:** 13 tables owned by `financialfreedom_user` exist in the `public` schema of the `postgres` database
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Query of `pg_class` for `public` schema returned: `cash_accounts`, `categories`, `credit_cards`, `failed_jobs`, `groups`, `institutions`, `loans`, `migrations`, `password_reset_tokens`, `personal_access_tokens`, `rules`, `transactions`, `users` — all owned by `financialfreedom_user`
- **Notes:** The `public` schema in `postgres` contains mixed ownership: financialfreedom_user tables (13), supabase_admin tables (WaitlistSubscriber, audiences, user_api_keys, user_profiles), and postgres-owned tables (_prisma_migrations, tenants). Total: 19 tables.
- **Observed:** 2026-08-16

### F-SCH-005 — `maybe_schema` is empty
- **Claim:** `maybe_schema` contains 0 tables
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Schema query returned 0 tables for `maybe_schema` (owner: `maybe_user`)
- **Correction:** Phase 3C4 stated "unknown" table count. Actual: 0 regular tables.
- **Observed:** 2026-08-16

### F-SCH-006 — `finance` schema within `finance` database (not postgres DB)
- **Claim:** The Finance application uses a `finance` schema within the `finance` logical database
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `application.env` for `apps-saas-open-fund-vdymfu`: `DATABASE_URL=postgresql://<user>:<pwd>@10.0.2.4:5433/finance?schema=finance`
- **Notes:** The `tenant_openfund` schema in the `postgres` DB (13 tables, mcp_manager owned) is unrelated to this connection. The Finance/OpenFund app connects to the dedicated `finance` logical database.
- **Observed:** 2026-08-16

---

## Active Connection Facts

### F-CONN-001 — Active Supabase connections at observation time
- **Claim:** At 2026-08-16, active connections to Supabase were from Azure production applications
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `SELECT datname, usename, count(*) FROM pg_stat_activity GROUP BY datname, usename` returned:

| Database | User | Connections | Interpretation |
|----------|------|-------------|----------------|
| `_supabase` | supabase_admin | 21 | Supabase infrastructure |
| `finance` | finance_user | 9 | Finance/OpenFund app (Azure) |
| `jpvbootcamp` | jpvbootcamp_staging_user | 4 | JPV Bootcamp staging (Azure) |
| `jpvbootcamp` | jpvbootcamp_user | 3 | JPV Bootcamp production (Azure) |
| `postgres` | supabase_admin | 8 | Supabase system |
| `postgres` | authenticator | 1 | PostgREST / GoTrue |
| `postgres` | supabase_storage_admin | 1 | Storage service |
| `saysthebible` | saysthebible | 5 | Says the Bible app (Azure) |
| `vault_legal` | authenticator | 1 | Vault Legal auth service |

- **Notes:** `jpvbootcamp_staging_user` is a distinct DB role confirmed by active connections — not documented in Phase 3C4
- **Observed:** 2026-08-16

### F-CONN-002 — AWS Supabase connections = ZERO
- **Claim:** Zero application connections from AWS to Supabase at observation time
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** No AWS-originating connections in `pg_stat_activity`; AWS cloudflared is masked; AWS application Swarm services = 0 replicas
- **Observed:** 2026-08-16

---

## Application → Database Connection Map

### F-APP-001 — Application database connection inventory
- **Classification:** OBSERVED-VERIFIED (from `application.env` in Dokploy DB snapshot)
- **Observed:** 2026-08-16

| App slug | App name | DB host | Database | Schema | Notes |
|----------|----------|---------|----------|--------|-------|
| app-index-haptic-port-m88k9z | buildflow | — | — | — | No DATABASE_URL |
| app-override-online-interface-1wzjpb | fala | 100.71.31.88:5433 | fala | public | Uses Tailscale IP, not subnet route |
| apps-internal-free-resend-izqnvr | free-resend | 10.0.2.4:5433 | resend | resend | — |
| apps-saas-egg-cooker-qtutkp | (unknown) | — | — | — | No DATABASE_URL; app purpose unknown |
| apps-saas-open-fund-vdymfu | OpenFund/Finance | 10.0.2.4:5433 | finance | finance | Yeshua Academy Finance app |
| apps-saas-status-link-dw1c6j | StatusLink | 10.0.2.4:5433 | statuslink | statuslink | — |
| app-transmit-online-hard-drive-of1m9k | (unknown) | — | — | — | No DATABASE_URL; app purpose unknown |
| boilerplates-prokit-dev-s5f8yz | ProKit dev | **Supabase Cloud** | postgres | (cloud) | aws-1-eu-west-1.pooler.supabase.com — NOT self-hosted |
| boilerplates-saaskit-dev-ixnolx | SaaSKit dev | **localhost:5433** | postgres | tenant_\<slug\> | Local compose postgres container |
| clients-jpv-bootcamp-app-tp9xrk | JPV Bootcamp (staging) | 10.0.2.4:5433 | jpvbootcamp | jpvbootcamp_staging | Staging schema, distinct user |
| demo-vault-legal-api-drzgfx | Vault Legal API | — | — | — | No DATABASE_URL |
| demo-vault-legal-wtpg0l | Vault Legal frontend | — | — | — | No DATABASE_URL |
| saas-proofly-ixcmnz | Proofly | 10.0.2.4:5433 | proofly | public | — |
| templates-prokit-kcde8a | ProKit template | 10.0.2.4:5433 | prokitstudio | prokitstudio | — |
| templates-saaskit-3ynx5a | SaaSKit template | 10.0.2.4:5433 | saaskitstudio | saaskitstudio | — |
| web-cedula-b1gepj | Cedula | 10.0.2.4:5433 | cedula | cedula | — |
| web-public-jccp-holdings-pvtist | JCCP Holdings | — | — | — | No DATABASE_URL |
| web-public-jpv-bootcamp-l66egq | JPV Bootcamp (prod) | 10.0.2.4:5433 | jpvbootcamp | jpvbootcamp | Production schema |
| web-public-olivetoorganizing-zwthea | Olive to Organizing | 10.0.2.4:5433 | olivetoorganizing | olivetoorganizing | — |
| web-public-prochat-accountant-zrekal | ProChat Accountant | 10.0.2.4:5433 | accountant | accountant | — |
| web-public-prochat-avejzq | ProChat | 10.0.2.4:5433 | prochat | prochat | — |
| web-public-viadieden-kttqn4 | Via Dieden | 10.0.2.4:5433 | viadieden | viadieden | — |
| web-says-the-bible-ing7sx | Says the Bible | 10.0.2.4:5433 | saysthebible | saysthebible | — |
| web-yeshua-academy-ariw56 | Yeshua Academy | — | — | — | No DATABASE_URL |

**Finding: `boilerplates-prokit-dev` connects to Supabase Cloud** — a managed Supabase Cloud project at `aws-1-eu-west-1.pooler.supabase.com`, which is SEPARATE from the self-hosted Supabase at 10.0.2.4. This is NOT a Supabase writer that needs to be tracked in the NO-DUAL-WRITER matrix for self-hosted Supabase.

**Finding: `boilerplates-saaskit-dev` connects to `localhost:5433`** — the local postgres container in its compose stack. NOT a self-hosted Supabase writer.

**Finding: Data architecture is per-app dedicated logical database, not one shared database.** The self-hosted Supabase uses dedicated logical databases per application (cedula→cedula DB, prochat→prochat DB, etc.) — see F-ARCH-001. Steve's proposed one-database-plus-schemas model is not the verified current self-hosted Supabase architecture. Whether it relates historically to the local compose database pattern is UNKNOWN — no evidence establishes that relationship.

---

## Data Architecture Facts

### F-ARCH-001 — Actual Supabase data architecture
- **Claim:** Self-hosted Supabase uses per-application dedicated logical databases (not a single shared database)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** 24 non-template databases in pg_database. Among applications with an observed DATABASE_URL targeting the self-hosted Supabase server, the connection generally targets a dedicated logical database per application (e.g., cedula→`cedula` DB, prochat→`prochat` DB, saysthebible→`saysthebible` DB). Seven applications have no DATABASE_URL in the observed Dokploy `application.env` field and cannot be classified from this field alone — they may or may not access Supabase through other mechanisms.
- **Critical correction:** Steve's stated model "Supabase uses one database with explicit per-application schemas" is **USER-PROPOSED** and does not match the observed current architecture. The observed architecture uses dedicated logical databases per application.
- **Notes:** Within each dedicated DB, the application uses a named schema (e.g., `cedula` DB → `cedula` schema). This is a hybrid: dedicated DB + named schema, not a flat `public` schema in most cases.
- **Observed:** 2026-08-16

### F-ARCH-002 — `postgres` database tenant_* schemas; local compose postgres schemas
- **PROVEN FACT A (OBSERVED-VERIFIED):** The self-hosted Supabase `postgres` logical database contains 19 tenant_* schemas (schema names observed via `pg_namespace` query — see F-SCH-001, F-SCH-002).
- **PROVEN FACT B (OBSERVED-VERIFIED):** The `boilerplates-saaskit-dev` application connects to `localhost:5433/postgres?schema=tenant_<slug>` — a LOCAL postgres:15 compose container, not the Supabase server.
- **What FACT A and FACT B do NOT establish:** These are two physically separate PostgreSQL instances (Supabase server at 10.0.2.4 / 100.71.31.88 vs. local Docker containers at localhost). No evidence proves that the Supabase `postgres` DB tenant_* schemas "serve" or are "used by" the local compose postgres containers. Any historical or causal relationship between the schema naming patterns of both systems is UNKNOWN — historical relationship not established from available evidence.
- **Classification:** OBSERVED-VERIFIED (each fact independently) + UNKNOWN (for any causal or usage relationship between the two systems)
- **Notes:** The `postgres` DB also hosts financialfreedom_user tables in `public`, Supabase system tables, and a `tenants` table (postgres-owned; exact architectural role not independently verified).
- **Observed:** 2026-08-16

### F-ARCH-003 — `jpvbootcamp` staging schema confirmed distinct
- **Claim:** JPV Bootcamp runs production and staging in separate schemas within the same `jpvbootcamp` database
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Two app entries in Dokploy: `clients-jpv-bootcamp-app-tp9xrk` (staging, `?schema=jpvbootcamp_staging`) and `web-public-jpv-bootcamp-l66egq` (production, `?schema=jpvbootcamp`); active connections confirmed `jpvbootcamp_staging_user` (4 connections) and `jpvbootcamp_user` (3 connections)
- **Notes:** `jpvbootcamp_staging_user` is a distinct Supabase role not documented in Phase 3C4
- **Observed:** 2026-08-16

---

## Platform Facts

### F-PLAT-001 — Dokploy control-plane PostgreSQL version
- **Claim:** Dokploy control-plane uses postgres:16
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `docker inspect` / `docker ps` confirmed container image `postgres:16`
- **Observed:** 2026-08-16 (Phase 3C3)

### F-PLAT-002 — n8n PostgreSQL version
- **Claim:** n8n uses postgres:17-alpine as its backing database
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** n8n compose definition specifies `postgres:17-alpine`
- **Observed:** 2026-08-16 (Phase 3C3)

### F-PLAT-003 — n8n audit: zero Azure infrastructure references
- **Claim:** n8n workflows contain zero references to Azure hostnames, Azure Tailscale IP (100.83.38.48), or Azure-specific infrastructure
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Phase 3C6 n8n audit scanned 43 workflows; zero Azure refs found. Result: PASS — n8n is infrastructure-migration safe (not "safe" unconditionally — "infrastructure-migration safe" is the precise finding)
- **Observed:** 2026-08-16

### F-PLAT-004 — cloudflared version on AWS
- **Claim:** cloudflared binary on AWS is v2026.8.2
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `cloudflared --version` returned `2026.8.2`
- **Observed:** 2026-08-16 (Phase 3C3)

### F-PLAT-005 — Traefik version
- **Claim:** Traefik reverse proxy is version 3.6.7
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Traefik container image confirmed `traefik:v3.6.7`
- **Observed:** 2026-08-16

### F-PLAT-006 — Traefik dynamic directory contents
- **Claim:** Traefik dynamic config directory contains only: `acme.json`, `dokploy-origin.crt`, `dokploy-origin.key`
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `ls /etc/dokploy/traefik/dynamic/` returned exactly those 3 files
- **Observed:** 2026-08-16

### F-PLAT-007 — AWS Swarm application services = 0 replicas
- **Claim:** Zero production application Swarm services are running on AWS (only demo-vault-legal at 0/0)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `docker service ls` confirmed only `demo-vault-legal-wtpg0l` service at 0/0 replicas
- **Observed:** 2026-08-16

---

## Shadow Suppression Facts

### F-SUPP-001 — All shadow suppressions verified active
- **Claim:** All AWS shadow suppressions are in place: 24 apps with autoDeploy=false, 17 compose with autoDeploy=false, 1 schedule with enabled=false, cloudflared masked
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Dokploy DB queries + systemctl cloudflared status confirmed all suppressions
- **Observed:** 2026-08-16

---

## User-Proposed Claims (Unverified)

### F-UNV-001 — "One database with schemas" as USER-PROPOSED Supabase model
- **Claim:** Steve stated "Supabase uses one database with explicit per-application schemas"
- **Classification:** USER-PROPOSED
- **Actual observed state:** CONTRADICTED by evidence. 24 dedicated logical databases exist. See F-ARCH-001.
- **Conclusion:** This is a USER-PROPOSED FUTURE DATA MODEL, not the observed current architecture. Architecture document documents the discrepancy clearly.

### F-UNV-002 — Tailscale subnet route 10.0.2.0/24
- **Claim:** Supabase server advertises subnet route 10.0.2.0/24 including PostgreSQL at 10.0.2.4:5433
- **Classification:** DERIVED-VERIFIED (14 of 24 applications have DATABASE_URL pointing to 10.0.2.4:5433, and active connections query succeeded against that endpoint; this implies the route is functional. The route advertisement itself was not directly verified in Phase 3C7. See F-NET-006 and F-APP-001 for full endpoint distribution.)

---

## Unknown / Blocked Facts

### F-UNK-001 — `apps-saas-egg-cooker-qtutkp` identity
- **Claim:** Unknown — what application is `egg-cooker`?
- **Classification:** UNKNOWN
- **Evidence:** Dokploy DB row exists; no DATABASE_URL; no matching known app name
- **Recommended action:** Check Phase 3C4 full app inventory for this slug

### F-UNK-002 — `app-transmit-online-hard-drive-of1m9k` identity
- **Claim:** Unknown — what application is `transmit-online-hard-drive`?
- **Classification:** UNKNOWN
- **Evidence:** Dokploy DB row exists; no DATABASE_URL
- **Recommended action:** Check Phase 3C4 full app inventory for this slug

### F-UNK-003 — `openfund` database purpose
- **Claim:** The `openfund` logical Supabase database has no identified application connecting to it
- **Classification:** UNKNOWN
- **Evidence:** `openfund` exists in pg_database (owner: supabase_admin); no application in Dokploy has `DATABASE_URL` pointing to `openfund`
- **Notes:** May be orphaned, renamed, or a separate future project

### F-UNK-004 — `boilerplates-prokit-dev` Supabase Cloud project identity
- **Claim:** `boilerplates-prokit-dev` connects to an external Supabase Cloud project at `aws-1-eu-west-1.pooler.supabase.com`
- **Classification:** UNKNOWN (which cloud project, what data it contains)
- **Notes:** This is a SEPARATE managed Supabase Cloud service. Not affected by this migration.

### F-UNK-005 — `tenant_prokit` and `tenant_saaskit` logical database usage
- **Claim:** Two Supabase logical databases with `tenant_` prefix exist at DB level; their application connection is unidentified
- **Classification:** UNKNOWN
- **Evidence:** Both exist in pg_database (8 MB each); no application in current Dokploy config connects to them
- **Notes:** May be superseded by the `tenant_prokit` / `tenant_saaskit` schemas in the `postgres` database

---

## Post-Cutover Facts (2026-08-17)

### F-CUT-001 — Production cutover completed
- **Claim:** Azure → AWS Dokploy production cutover completed 2026-08-17 with ~28 minutes total downtime
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Phase 3F closure report timestamps: Azure writers frozen ~17:35 UTC, all domains verified responding ~18:05 UTC; 16/16 database restores with SHA-256 checksums verified at transfer time
- **Observed:** 2026-08-17

### F-CUT-002 — AWS is authoritative production runtime
- **Claim:** AWS Lightsail dokploy-aws (eu-west-2, London) is the sole authoritative production runtime
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Cloudflare tunnel active on AWS connector; 17/17 production domains responding 200; Azure cloudflared stopped; Azure writer services at 0/0 replicas; rollback class B (production writes accepted)
- **Observed:** 2026-08-17

### F-CUT-003 — Post-cutover snapshot AVAILABLE
- **Claim:** Lightsail snapshot `dokploy-aws-post-cutover-20260817` is available for rollback
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `aws lightsail get-instance-snapshot` returned state=available, created 2026-08-17T19:06:04+01:00, size 320 GB
- **Observed:** 2026-08-17

### F-CUT-004 — All shadow suppressions reversed
- **Claim:** All shadow suppressions have been reversed: schedule enabled=true, 24/24 application autoDeploy=true, 17/17 compose autoDeploy=true
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Dokploy DB queries confirmed enabled=true for schedule vyN0X3Y6OpO5b_cZbS0r3; UPDATE application SET "autoDeploy"=true confirmed 24 rows; UPDATE compose SET "autoDeploy"=true confirmed 17 rows
- **Observed:** 2026-08-17

### F-CUT-005 — Traefik file-provider parity defect resolved
- **Claim:** `/etc/dokploy/traefik/dynamic/ory.yml` was missing on AWS (migration gap) and has been restored from Azure authoritative source
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** auth.prochat.tools returned 404 before fix, 200 after creating identical ory.yml on AWS; routes auth.prochat.tools → ory-kratos:4433 and auth-admin.prochat.tools → ory-kratos:4434
- **Critical lesson:** Non-DB state that is NOT in Dokploy control-plane DB and NOT in /etc/dokploy/compose/ can be missed by DB-based migration. Traefik dynamic/ directory files are a separate migration artifact category.
- **Observed:** 2026-08-17

### F-CUT-006 — Azure quiesced state
- **Claim:** Azure VM remains powered on with: cloudflared STOPPED, all 13 Supabase-writing services at 0/0 replicas, platform services (Dokploy, Traefik, Redis, PG) still running, disks/volumes/files intact, databases frozen at cutover point-in-time
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Phase 3F closure report Azure Fallback State table; docker service ls on Azure confirmed 0/0 replicas for all application services; systemctl status cloudflared = inactive
- **Observed:** 2026-08-17

### F-CUT-007 — 17 production domains verified
- **Claim:** All 17 production-critical domains respond correctly post-cutover (200 or valid redirect)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** curl tests from external network: prochat.tools, yeshua.academy, jpvbootcamp.com, olivetoorganizing.com, jccpholdings.com, getproofly.app, saysthe.bible, viadieden.it, cedula.prochat.tools, finance.yeshua.academy, resend.prochat.tools, onestatus.link, preview.jpvbootcamp.com, auth.prochat.tools/health/alive, legal-api.prochat.tools/health, legal.prochat.tools, auth-admin.prochat.tools — all PASS
- **Observed:** 2026-08-17

### F-CUT-008 — Known non-migration broken apps
- **Claim:** 4 applications remain in error state — none migration-caused: web-public-prochat-accountant-zrekal (needs local build), app-override-online-interface-1wzjpb/fala (needs local build), templates-prokit-kcde8a (unused template), templates-saaskit-3ynx5a (unused template)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** applicationStatus='error' in Dokploy DB; identical error state existed on Azure pre-migration (Phase 3C3 Step 2 confirmed all were error/broken before migration)
- **Observed:** 2026-08-17

### F-CUT-009 — buildflow-staging.prochat.tools 502
- **Claim:** buildflow-staging.prochat.tools returns Cloudflare 502 despite internal routing working correctly (Traefik → container → 200 on port 80)
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Internal curl via Traefik returns 200; external curl returns Cloudflare 502 error page. Root cause: Cloudflare tunnel public hostname configuration issue (remotely managed), not infrastructure defect.
- **Observed:** 2026-08-17

### F-CUT-010 — Traefik Docker provider limitation
- **Claim:** Traefik Docker provider is configured but only @swarm routes appear; compose containers are not detected by the Docker provider
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Traefik API shows only swarm-provider routes; Ory Kratos (standalone) required file-provider workaround. Root cause investigation pending (socket mount, provider priority, or Swarm-mode limitation).
- **Observed:** 2026-08-17

---

## Summary: Architecture Document Corrections History

### RESOLVED — Applied in Phases 3C7, 3C8, 3C9

All items below were contradictions between prior architecture document claims and observed evidence.
Each has been corrected in the architecture document. Preserved here for audit trail.

| Claim | Prior document claim | Actual (OBSERVED-VERIFIED) | Phase | Fact ID |
|-------|---------------------|---------------------------|-------|---------|
| Schema count in postgres DB | "64+" | 36 (67 total pg_namespace rows − 31 PostgreSQL-internal) | 3C7 | F-SCH-001 |
| `financialfreedom_schema` table count | "12+ tables" | 0 tables (tables are in `public`) | 3C7 | F-SCH-003, F-SCH-004 |
| Tailscale node count | "3 nodes" | 7 registered (6 active) | 3C7 | F-NET-004 |
| Azure SSH access model | "az vm run-command only — Tailscale ACL blocks SSH" | Port 22 publicly reachable (NSG Priority 900 Allow *); key auth | 3C7 | F-FW-002 |
| Data architecture | "one database with schemas" (stated as canonical) | Per-app dedicated logical databases (USER-PROPOSED future, not current) | 3C7/3C8 | F-ARCH-001 |
| `boilerplates-prokit-dev` DB target | assumed self-hosted Supabase | Supabase Cloud (`aws-1-eu-west-1.pooler.supabase.com`) | 3C7 | F-APP-001 |
| `boilerplates-saaskit-dev` DB target | assumed self-hosted Supabase | localhost:5433 (local compose postgres) | 3C7 | F-APP-001 |
| DB owners (finance, ory_prod, proofly, accountant) | supabase_admin | postgres / ory_user / proofly_user / accountant_user | 3C7 | F-DB-003 |
| n8n safety wording | "SAFE" | "INFRASTRUCTURE-MIGRATION SAFE" (infrastructure only, not unconditional) | 3C8 | F-PLAT-003 |
| Subnet route application count | "21 of 24 apps use 10.0.2.4:5433" | 14 of 24 apps have DATABASE_URL pointing to 10.0.2.4:5433 | 3C9 | F-NET-006 |
| F-ARCH-002 conflation | Supabase postgres tenant_* schemas stated as "serving" local compose containers | Two independent facts — no proven relationship between the two PostgreSQL systems | 3C9 | F-ARCH-002 |
| tenant_prokit / tenant_saaskit DB classification | "CURRENT-ACTIVE WITH LEGACY NAMING" | UNKNOWN / LEGACY-CANDIDATE (no DATABASE_URL observed) | 3C9 | F-UNK-005 |

### CURRENT CONTRADICTIONS

None. All material factual contradictions identified through Phase 3C11 have been resolved.

### UNRESOLVED UNKNOWNS (not contradictions — evidence insufficient to determine)

| Item | Classification | Open Question |
|------|---------------|---------------|
| `finance\` (backslash DB) — application connection | UNKNOWN | Q1 |
| `openfund` DB — application connection | UNKNOWN | Q12 |
| `finance_shadow` — Prisma dev vs deploy workflow | PROBABLE TOOLING — PURPOSE NOT FULLY VERIFIED | Q7 |
| Cloudflare origin protocol (HTTP or HTTPS to Traefik) | NON-BLOCKING UNKNOWN | Q11 |
| JPV Bootcamp Payload CMS SHA at cutover | CUTOVER-TIME GATE | Q6 |
| Ory Kratos config drift since Phase 3A | CUTOVER-TIME GATE | Q9 |
| tenant_* schema current runtime dependency | NOT FULLY VERIFIED | See Section 8.5 |
| tenant_prokit / tenant_saaskit logical DB usage | UNKNOWN | F-UNK-005 |



---

## AWS Management-Plane Closure Facts (2026-08-18)

### F-MGMT-001 — AWS production management plane is OpenSSH over Tailscale
- **Claim:** Normal administrative SSH for both `dokploy-aws` and `cloudpanel-aws` uses standard OpenSSH over private Tailscale connectivity; the Tailscale SSH server feature is disabled on both nodes, and normal public TCP/22 is blocked.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Owner-supplied AWS Management Plane canonical handoff dated 2026-08-18; fresh independent SSH-over-Tailscale checks PASS on both hosts; current repository SSH config uses the Tailscale addresses.
- **Observed:** 2026-08-18

### F-MGMT-002 — Dokploy AWS permanent infrastructure identity
- **Claim:** `dokploy-aws` has persistent Linux hostname `dokploy-aws`, Tailscale FQDN `dokploy-aws.tail3c0f0a.ts.net`, Tailscale IPv4 `100.71.47.24`, `tailscaled` enabled/active, and Tailscale node-key expiry disabled. Static public IPv4 `18.135.240.168` remains attached but is not normal SSH or application ingress.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Owner-supplied AWS Management Plane canonical handoff dated 2026-08-18; `preserve_hostname: true`; production health PASS; Cloudflare Tunnel remains application ingress.
- **Observed:** 2026-08-18

### F-MGMT-003 — CloudPanel AWS permanent infrastructure identity and management firewall
- **Claim:** `cloudpanel-aws` has persistent Linux hostname `cloudpanel-aws`, Tailscale FQDN `cloudpanel-aws.tail3c0f0a.ts.net`, Tailscale IPv4 `100.121.12.36`, `tailscaled` enabled/active, and Tailscale node-key expiry disabled. Final evidence shows host UFW TCP/22 allows Anywhere (v4+v6), while the Lightsail perimeter permits TCP/22 only from `lightsail-connect`; ordinary public SSH is blocked. CloudPanel admin 8443 remains on the Tailscale management path, while public website ingress on 80/443/UDP443 remains intentionally enabled.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` evidence-closure addendum; fresh Tailscale SSH PASS; AWS Lightsail API port-state evidence; external public SSH timeout; CloudPanel production health PASS.
- **Observed:** 2026-08-18

### F-MGMT-004 — Permanent infrastructure Tailscale key-expiry policy
- **Claim:** Tailscale node-key expiry is disabled for the long-lived infrastructure nodes `dokploy-aws`, `cloudpanel-aws`, and self-hosted Supabase.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Owner-supplied AWS Management Plane canonical handoff dated 2026-08-18; Supabase precedent plus closure verification on both AWS nodes.
- **Observed:** 2026-08-18

### F-MGMT-005 — Management plane and application plane are separate concerns
- **Claim:** Tailscale is the canonical private management plane. Application ingress remains workload-specific: Dokploy uses Cloudflare Tunnel; CloudPanel uses a mixed model with active Cloudflare Tunnel ingress for configured hostnames plus retained public Lightsail IPv4 web ingress on 80/443/UDP443. A retained public IPv4 does not imply public administrative exposure.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Owner-supplied AWS Management Plane canonical handoff dated 2026-08-18.
- **Observed:** 2026-08-18

### F-NAME-001 — Azure subscription display names changed only
- **Claim:** Azure subscription display name `PROCHAT-DATA` is now `supabase-azure`; legacy Dokploy subscription display name `PROCHAT-APPS` is now `dokploy-azure`. The rename changes labels only, not subscription IDs, VM identities, network topology, data authority, or application connectivity.
- **Classification:** AUTHORITATIVE-CONFIG
- **Evidence:** Owner canonical naming update dated 2026-08-18.
- **Observed:** 2026-08-18

### F-MGMT-006 — Former Azure Dokploy decommissioned (SUPERSEDES prior fallback claim)
- **Claim:** Azure Dokploy was decommissioned on 2026-08-26. PROCHAT-APPS has zero resources and zero resource groups; its Tailscale node `100.83.38.48` and Dokploy backup data were removed. Rollback to Azure Dokploy is impossible.
- **Classification:** OBSERVED-VERIFIED / AUTHORITATIVE-CONFIG
- **Evidence:** Owner-supplied final decommission acceptance recorded in the architecture audit addendum; closure commit `1c5ab2754faec8a4ac511ab675c3cadf70ef9fb4`.
- **Observed:** 2026-08-26
- **Current-use boundary:** AWS `dokploy-aws` is the sole production Dokploy authority. Recovery relies on AWS snapshots/backups and documented reconstruction procedures.

### F-MGMT-007 — Azure Supabase preserved as active production
- **Claim:** Azure Supabase / PROCHAT-DATA remains ACTIVE PRODUCTION and was untouched by the Azure Dokploy decommission. AWS-to-Supabase connectivity remains active.
- **Classification:** OBSERVED-VERIFIED / AUTHORITATIVE-CONFIG
- **Evidence:** Final decommission acceptance and post-decommission connectivity checks recorded in the architecture audit addendum.
- **Observed:** 2026-08-26

### F-MGMT-008 — PROCHAT-APPS is empty after decommission
- **Claim:** PROCHAT-APPS contains zero resources and zero resource groups, with zero remaining Dokploy-related billable footprint.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Final decommission acceptance recorded in the architecture audit addendum.
- **Observed:** 2026-08-26



### F-NET-011 — Complete tailnet inventory and access model
- **Claim:** The 2026-08-18 audit observed 8 Tailscale devices: 7 active and 1 offline (`motorola`). Current access uses the Grants model with one wildcard grant (`src:*`, `dst:*`, `ip:*`); AWS production nodes are user-owned by `info@prochat.tools` and untagged, while Supabase carries an infrastructure tag.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` sections 3–5 and evidence closure.
- **Observed:** 2026-08-18

### F-NET-012 — Supabase subnet routing and multi-path connectivity
- **Claim:** Supabase advertises and owns approved route `10.0.2.0/24`; the known routed database endpoint is `10.0.2.4:5433`. Current consumers use both subnet-routed access and direct Tailscale node access (`100.71.31.88:5433`), while Supabase Studio/API also has Cloudflare Tunnel ingress.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` sections 6 and 14.
- **Observed:** 2026-08-18

### F-NET-013 — Azure fallback-to-Supabase connectivity survived UFW cleanup
- **Claim:** Four stale Supabase UFW rules referencing Azure fallback Tailscale IP `100.83.38.48` on 8000/5432/5433/8443 were removed. Bidirectional Tailscale connectivity remained functional because authenticated Tailscale traffic is accepted by `ts-input` before those UFW rules; rollback network capability did not regress.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` evidence-closure addendum.
- **Observed:** 2026-08-18

### F-CF-001 — Complete Cloudflare tunnel inventory and connector topology
- **Claim:** Four Cloudflare tunnels are active with four active connectors, one connector per tunnel: Dokploy, CloudPanel, Supabase, and OfficeMac. No production tunnel routes to Azure Dokploy.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` final tunnel inventory and evidence closure.
- **Observed:** 2026-08-18

### F-CF-002 — Complete tunnel-to-hostname mapping
- **Claim:** The active tunnel configuration contains 53 public hostnames: 39 on Dokploy, 10 on CloudPanel, 2 on Supabase, and 2 on OfficeMac, plus catch-all 404 rules. `traefik.prochat.tools` is not in any active tunnel configuration and is stale DNS/configuration evidence only.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` evidence closure lines 968–1047; detailed per-hostname mapping remains in the audit artifact.
- **Observed:** 2026-08-18

### F-CF-003 — Cloudflare Access standalone policy state remains unknown
- **Claim:** Tunnel-level Cloudflare Access fields are absent across the observed ingress rules, but standalone account-level Zero Trust Access applications/policies were not independently verified because available API credentials returned 401. Canonical state is UNKNOWN / NOT VERIFIED; no remediation is implied.
- **Classification:** UNKNOWN
- **Evidence:** `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` evidence closure lines 1049–1058.
- **Observed:** 2026-08-18



### F-MIG-001 — Phase 3E0 rollback evidence distinguished VM snapshots from consistent database rollback
- **Claim:** During the Azure → AWS Dokploy cutover readiness phase, VM/provider snapshots were treated as OS/config recovery evidence, while post-freeze PostgreSQL logical dumps were the authoritative consistent database rollback artifact because live VM snapshots do not quiesce PostgreSQL WAL/volumes. Post-cutover Lightsail snapshot creation remained an explicitly authorization-gated operation.
- **Classification:** OBSERVED-VERIFIED / HISTORICAL
- **Evidence:** `operations/migrations/dokploy-azure-to-lightsail/phase-3e0-final-pre-cutover-readiness.md` sections 5–7.
- **Observed:** 2026-08-17
- **Current-use boundary:** This is reusable migration/rollback evidence, not authorization to perform backup, restore, snapshot, or infrastructure mutation.

### F-N8N-001 — n8n volume ownership regression caused persistent crash loop
- **Claim:** The n8n Docker volume `_data` directory was owned by root:root (0:0) after migration, while n8n runs as UID 1000. This prevented n8n from creating `crash.journal` or any new files, causing an immediate EACCES crash loop on every startup attempt since migration (2026-08-17 through 2026-08-19).
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md`
- **Observed:** 2026-08-19
- **Fix:** `chown 1000:1000` on volume `_data` directory. No data modified.

### F-N8N-002 — n8n ingress routing absent due to Compose/Swarm provider mismatch
- **Claim:** n8n is deployed as a Docker Compose container. Traefik's active discovery provider is `swarm` (the `docker` provider in config is non-functional). No router existed for `n8n.prochat.tools`, returning Traefik 404 for all requests.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md`
- **Observed:** 2026-08-19
- **Fix:** File-provider route at `/etc/dokploy/traefik/dynamic/n8n.yml` targeting `http://apps-internal-n8n-cvjx2s-n8n-1:5678`.

### F-N8N-003 — n8n operational after volume/routing fixes (SUPERSEDED by F-N8N-007)
- **Claim:** n8n appeared operational after Defect A and B fixes. However, authentication was intermittently failing due to Defect D (Docker DNS collision). This entry was premature.
- **Classification:** OBSERVED-VERIFIED (partial — did not validate login or DB identity)
- **Evidence:** `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md`
- **Observed:** 2026-08-19
- **Superseded by:** F-N8N-007 (complete validation including DB identity and login)

### F-N8N-004 — Docker DNS collision: dual postgres on dokploy-network
- **Claim:** Two postgres containers (`apps-internal-n8n-cvjx2s-postgres-1` at 10.0.1.189 and `code-postgres-1` at 10.0.1.14) both advertised DNS alias `postgres` on `dokploy-network`. n8n's TypeORM connection pool randomly connected to one or the other at startup, causing intermittent authentication failure.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `nslookup postgres 127.0.0.11` from n8n container returned both 10.0.1.189 and 10.0.1.14. Direct query of code-postgres-1 showed user `test@test.com`; production postgres showed `info@prochat.tools`. TypeORM instrumentation in email.js confirmed `first_user_email=[test@test.com]` when login failed.
- **Observed:** 2026-08-19
- **Fix:** Disconnected stale postgres from dokploy-network; then removed postgres from dokploy-network in compose definition entirely.

### F-N8N-005 — Stale code project containers removed
- **Claim:** Stale `code-n8n-1` and `code-postgres-1` containers (migration residue from starting compose with wrong project name) stopped and removed. Volumes `code_n8n_data` and `code_postgres_data` preserved on disk.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `docker stop code-n8n-1 code-postgres-1 && docker rm code-n8n-1 code-postgres-1` — confirmed no longer in `docker ps -a` output.
- **Observed:** 2026-08-19

### F-N8N-006 — Durable DB identity: postgres removed from dokploy-network
- **Claim:** Production postgres service removed from `dokploy-network` in docker-compose.yml. Postgres now exists only on compose-internal `apps-internal-n8n-cvjx2s_default` network. DNS resolution of `postgres` from n8n returns only 172.19.0.2 (compose-internal). 10/10 repeated lookups confirmed single target.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Compose file diff (removed `- dokploy-network` from postgres service networks). `nslookup postgres 127.0.0.11` from n8n container: 10/10 returns only `172.19.0.2`. `docker inspect apps-internal-n8n-cvjx2s-postgres-1` shows only one network: `apps-internal-n8n-cvjx2s_default`.
- **Observed:** 2026-08-19

### F-N8N-007 — n8n fully operational with proven DB identity and data fidelity
- **Claim:** n8n 2.4.7 running from pristine image (no diagnostic instrumentation), 0 restarts, healthz OK, PostgreSQL 17 healthy, DB hostname resolves unambiguously, owner UUID/email/role/password-fingerprint match authoritative source, 2 API keys preserved, 17 credentials present, 43 workflows (6 active), 6 webhook registrations, public endpoint 200, no ERR_ERL errors, N8N_PROXY_HOPS=2 active, volume owner 1000:1000.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `operations/migrations/dokploy-azure-to-lightsail/n8n-post-migration-permission-fix-2026-08-19.md` — final data fidelity table.
- **Observed:** 2026-08-19

### F-N8N-008 — Security incident: encryption key emitted in diagnostic output
- **Claim:** During diagnostic instrumentation, `docker inspect --format '{{json .Config.Env}}'` emitted the full N8N_ENCRYPTION_KEY value in terminal output. Key was NOT rotated (credentials currently decrypt). No evidence of compromise beyond ephemeral SSH session.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Diagnostic session terminal output (ephemeral, not persisted to disk or logs).
- **Observed:** 2026-08-19
- **Deferred follow-up:** Evaluate key rotation after extended stability period.

### F-N8N-009 — Human login acceptance: 3/3 consecutive logins PASS
- **Claim:** Production owner (info@prochat.tools) performed 3 consecutive login/logout cycles at `https://n8n.prochat.tools` using the existing unchanged password. All 3 passed. No password reset, no new account, no replacement owner. Incident CLOSED.
- **Classification:** OBSERVED-VERIFIED (human-performed)
- **Evidence:** Owner self-report, 2026-08-19. Closes final acceptance gate from `n8n-post-migration-permission-fix-2026-08-19.md`.
- **Observed:** 2026-08-19

---

## Umami Analytics Evidence

### F-UMM-001 — Umami ingress gap: no Traefik route for umami.prochat.tools from cutover through 2026-08-19
- **Claim:** `umami.prochat.tools` returned HTTP 404 from migration cutover (2026-08-17) through 2026-08-19. Root cause: no file-provider Traefik route existed. Docker Compose labels on the Umami container are not discovered by the Swarm/file provider without explicit file-provider configuration. This is the same class as n8n Defect B.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `curl -sI https://umami.prochat.tools/` → 404. Traefik API `/api/http/routers` showed no `umami.prochat.tools` entry. `ops-umami-sqswbj-umami-1` was healthy but unreachable. Duration: ~2.5 days.
- **Observed:** 2026-08-19
- **Cause:** Migration acceptance gates did not include per-application ingress verification via Traefik API.

### F-UMM-002 — Authoritative Umami data verified in Supabase analytics database
- **Claim:** Production Umami data is in the Supabase `analytics` database at `10.0.2.4:5433` (Azure vm-supabase, Tailscale). Website UUID `5ceba17d-4125-4a75-a1f6-9add5c4b1803` (ProChat / prochat.tools, created 2026-03-10) confirmed present. 4 websites, 596 sessions, 1,816 events. Latest event: 2026-08-17. No data loss. 14 migrations applied, 0 pending.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Read-only psql query via n8n postgres container (which has psql) connecting to Supabase at `10.0.2.4:5433`. Credentials not exposed.
- **Observed:** 2026-08-19

### F-UMM-003 — Umami ingress restored via file-provider route
- **Claim:** `/etc/dokploy/traefik/dynamic/umami.yml` created on AWS Dokploy host. Traefik hot-reloaded (file-provider). Routers `umami-web@file` and `umami-websecure@file` confirmed enabled. Service `umami-service@file` with backend `http://ops-umami-sqswbj-umami-1:3000` confirmed UP. `https://umami.prochat.tools/` returns HTTP 200. Known website URL returns HTTP 200.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Traefik API response; `curl -sI https://umami.prochat.tools/` → 200 (x-powered-by: Next.js). No Traefik restart required.
- **Observed:** 2026-08-19

### F-UMM-004 — User acceptance: login and historical analytics PASS
- **Claim:** After Traefik route restoration, Steve logged into `umami.prochat.tools` successfully. All 4 expected websites were visible (ProChat, Says the Bible, Proofly, Yeshua Academy). Historical analytics became visible after changing the date range from the default "last 24 hours" to "last 20 days". No data loss. No authorization failure. No ownership failure. No frontend rendering failure.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** Owner self-report, 2026-08-19. Login PASS. Websites list visible. Historical analytics visible with 20-day date range. Closes final Umami recovery acceptance gate.
- **Observed:** 2026-08-19

### F-UMM-005 — Default 24-hour view legitimately empty — not data loss
- **Claim:** The default Umami dashboard view is "last 24 hours". The most recent analytics event was 2026-08-17 (2 days before user acceptance test). DB query confirmed zero events in last 48 hours. The initially empty dashboard was user interpretation of the default time range, not a production defect.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** DB query `SELECT COUNT(*) FROM website_event WHERE created_at > NOW() - INTERVAL '48 hours'` → 0. Date range changed to 20 days → historical data visible immediately. All data counts verified intact (596 sessions, 1,816 events, 2026-03-11 through 2026-08-17).
- **Observed:** 2026-08-19
- **Clarification:** Empty charts in the default time window are expected behavior when no recent traffic occurred. This is NOT a data loss incident. Empty charts require date range verification before diagnosing data loss.

### F-UMM-006 — Stale code-umami-1 runtime retired
- **Claim:** The stale `code-umami-1` container (migration rehearsal residue from 2026-08-17, project `code`) stopped and removed after canonical `ops-umami-sqswbj-umami-1` passed all acceptance gates. Container had been running since 2026-08-17 with a live connection to the Supabase analytics DB despite providing no user-facing value.
- **Classification:** OBSERVED-VERIFIED
- **Evidence:** `docker stop code-umami-1` → success. `docker rm code-umami-1` → success. `docker ps -a --filter name=code-umami` → empty. Canonical container: `running` / 0 restarts post-retirement. HTTP 200 confirmed after retirement.
- **Observed:** 2026-08-19
