# Post-Cutover Hygiene Roadmap

**Created:** 2026-08-16 (Phase 3C4)  
**Status:** NOT STARTED — execute only after cutover is complete and stable  
**Source:** Phase 3C4 hygiene audit findings

This document is the authoritative list of cleanup work deferred until after production cutover. None of these items are cutover blockers.

---

## RULE: Do not execute any item here before cutover is declared stable.

Stability criteria (suggested):
- 1 week of production traffic on AWS with no restart loops
- All monitoring dashboards green
- Steve explicitly authorizes cleanup to begin

---

## Priority 1 — Safe, Non-Breaking (1 week post-cutover)

### P1-A: Remove orphaned application directory

**What:** `/etc/dokploy/applications/compose-index-haptic-firewall-rlwj48` exists on AWS with no `/code` subdirectory. No container, no Swarm service. Leftover artifact from a project type change (application → compose).

**Action:**
```bash
# [AWS SAFE — post-cutover only]
sudo rm -rf /etc/dokploy/applications/compose-index-haptic-firewall-rlwj48
```

**Risk:** None. No active container or service uses this path.

---

### P1-B: Remove orphaned domain record

**What:** `finance.yeshua.academy` domain record with no applicationId and no composeId in Dokploy DB. Duplicate orphan record.

**Action:** Dokploy UI → Domains → find orphaned `finance.yeshua.academy` → Delete.

**Risk:** None. No active routing uses this orphaned record.

---

### P1-C: Remove duplicate domain record

**What:** `jccpholdings.com` appears twice, both linked to applicationId `HydSqf1OVKTELDuRW_KM3` (JCCP Holdings). Redundant Traefik routing rule.

**Action:** Dokploy UI → JCCP Holdings app → Domains → remove one of the duplicate `jccpholdings.com` entries.

**Risk:** Low. Remove one, verify the app still routes correctly after removal.

---

### P1-D: Fix duplicate compose names

**What:** Two compose projects share the human-readable name `jpvbootcamp`:
- `compose-hack-open-source-driver-mmchh4` → tenant data (tenant_jpvbootcamp)
- `compose-input-open-source-bandwidth-droye2` → application data (jpvbootcamp)

**Action:** Dokploy UI → rename one to differentiate:
- `compose-hack-open-source-driver-mmchh4` → rename to "jpvbootcamp-tenant"
- `compose-input-open-source-bandwidth-droye2` → rename to "jpvbootcamp-app" (or keep as-is)

**Risk:** Cosmetic only. Rename is safe.

---

### P1-E: Remove stale jpv-bootcamp image

**What:** `ghcr.io/prochattools/jpv-bootcamp:9c045fa5a5c327014c20fe9377f7d5368b550573` is present on AWS but used by no active application. It was pulled during Phase 3C2 preparation.

**Action:**
```bash
# [AWS SAFE — post-cutover only]
docker rmi ghcr.io/prochattools/jpv-bootcamp:9c045fa5a5c327014c20fe9377f7d5368b550573
```

**Risk:** None. No running or configured service uses this tag.

---

## Priority 2 — Requires Investigation (2 weeks post-cutover)

### P2-A: Orphaned Firecrawl compose config

**What:** `/etc/dokploy/compose/compose-quantify-cross-platform-matrix-1xuzkz/` exists on disk with a Firecrawl multi-service compose YAML. NOT registered in Dokploy DB. Not running.

The Firecrawl compose references `SUPABASE_URL`, `SUPABASE_ANON_TOKEN`, `SUPABASE_SERVICE_TOKEN` env vars, meaning if started it would connect to Supabase.

**Investigation required:**
1. Was Firecrawl intentionally removed from Dokploy (deliberate deprovision)?
2. Is there an ongoing need for Firecrawl as an internal service?

**If Firecrawl is no longer needed:**
```bash
sudo rm -rf /etc/dokploy/compose/compose-quantify-cross-platform-matrix-1xuzkz
```

**If Firecrawl should be re-deployed:**
- Register in Dokploy as a new compose project
- Set SUPABASE_* env vars appropriately
- Do NOT start until Steve authorizes

---

### P2-B: `finance\` anomaly database in Supabase

**What:** A Supabase logical database with a literal backslash in its name (`finance\`). Contains ~10 MB of data. Appears to be a creation error.

**Investigation required:**
1. Identify which application (if any) connects to this database
2. Check if `supabase_admin` connection logs show any activity

**If confirmed no application uses it:**
```sql
-- Run as postgres superuser in a transaction
-- ONLY after confirming zero application connections
DROP DATABASE "finance\";
```

**Risk:** Do NOT drop without confirming zero connections and no application dependency.

---

### P2-C: `finance_shadow` database in Supabase

**What:** A Prisma shadow database (`finance_shadow`, 7829 kB). Used by `prisma migrate dev` to compare migration state. Safe to drop if the Yeshua Academy Finance app uses `prisma migrate deploy` (not `dev`) in production.

**Investigation required:**
1. Confirm the Finance app migration workflow — does it use `prisma migrate dev` against production Supabase?
2. If only `prisma migrate deploy` is used, shadow DB is not needed.

**If confirmed unnecessary:**
```sql
DROP DATABASE finance_shadow;
```

---

### P2-D: Legacy schemas in Supabase postgres database

The following schemas exist in the central `postgres` DB with no matching active applications:

| Schema | Owner | Tables |
|--------|-------|--------|
| tenant_boilerplate | tenant_boilerplate_user | 4 |
| tenant_prochattools | tenant_prochattools_user | 4 |
| tenant_rebuildwp | mcp_manager | unknown |
| financialfreedom_schema | financialfreedom_user | 12+ |
| maybe_schema | maybe_user | unknown |

**Investigation required for each:**
1. Identify what application or project created this schema
2. Confirm no active code references these schemas
3. Check git history for any service that used these schemas
4. Confirm with Steve before dropping

**Cleanup (schema by schema, only after investigation):**
```sql
-- In a BEGIN TRANSACTION; confirm then COMMIT
DROP SCHEMA tenant_boilerplate CASCADE;  -- only after investigation
DROP SCHEMA tenant_prochattools CASCADE; -- etc.
```

Also: Drop the associated DB users after schemas are dropped.

---

### P2-E: `tenant_prokit` and `tenant_saaskit` logical databases

**What:** Two Supabase logical databases named with `tenant_` prefix at the DB level:
- `tenant_prokit` (8013 kB)
- `tenant_saaskit` (8181 kB)

These may be superseded by the `tenant_prokit` and `tenant_saaskit` schemas in the `postgres` database.

**Investigation required:**
1. Identify which application connects to `tenant_prokit` as a database (not a schema)
2. Check the ProKit and SaaSKit app env vars for DATABASE_URL pointing to these databases
3. If applications connect to these as separate databases, they are active — do NOT drop
4. If applications have migrated to the schemas-in-postgres model, these are orphaned

---

## Priority 3 — Architecture Decisions (1 month post-cutover)

### P3-A: Remove or archive fala

The `fala` application (`app-override-online-interface-1wzjpb`, `ghcr.io/prochattools/fala:latest`) has `applicationStatus=error`. The fala image IS present on AWS. If fala is deprecated:
1. Confirm with Steve — is fala still in active development?
2. If deprecated: scale to 0, archive config, remove from Dokploy

### P3-B: n8n workflow audit

After cutover, audit n8n workflows for:
- Any workflow that references Azure hostnames or Azure Tailscale IP (100.83.38.48)
- Any webhook URL pointing to Azure
- Update to use AWS/production hostnames

### P3-C: Add Docker healthchecks

None of the application Swarm services have healthchecks defined. Post-cutover, add healthchecks to at minimum:
- Critical Supabase writers (prochat, cedula, jpvbootcamp, etc.)
- n8n (already has healthcheck via Compose)
- Ory Kratos (already has healthcheck via Compose)

### P3-D: Define resource limits

Apply memory/CPU limits per service in Dokploy. Start with the highest-memory apps (cedula, prochat, jpv-bootcamp) and work down.

### P3-E: n8n version upgrade

Current n8n version: 2.4.7 (pinned in compose). Post-cutover, plan an upgrade path to current stable.

---

## Tracking

Mark each item when completed:

- [ ] P1-A: Remove orphaned application directory
- [ ] P1-B: Remove orphaned domain record (finance.yeshua.academy)
- [ ] P1-C: Remove duplicate domain record (jccpholdings.com)
- [ ] P1-D: Fix duplicate compose names (jpvbootcamp)
- [ ] P1-E: Remove stale jpv-bootcamp image (:9c045fa5)
- [ ] P2-A: Investigate + resolve firecrawl orphan
- [ ] P2-B: Investigate + resolve `finance\` database
- [ ] P2-C: Investigate + resolve `finance_shadow` database
- [ ] P2-D: Investigate + resolve legacy schemas
- [ ] P2-E: Investigate + resolve `tenant_prokit` / `tenant_saaskit` databases
- [ ] P3-A: Decide fala status
- [ ] P3-B: n8n workflow audit for Azure references
- [ ] P3-C: Add Docker healthchecks to critical services
- [ ] P3-D: Apply resource limits
- [ ] P3-E: Plan n8n version upgrade
