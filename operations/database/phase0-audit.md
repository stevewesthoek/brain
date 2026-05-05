# Phase 0 Audit — Database Separation Migration
_Generated: 2026-03-29_

## Summary

- **20 apps** across 6 Dokploy projects
- **12 apps** use the shared `postgres` database (migration candidates)
- **1 app** (Proofly) already has its own database — reference implementation
- **4 apps** use Supabase Cloud or have no DB — skip
- **~10 orphaned schemas** in production with no live app

---

## Migration Targets

### Priority 1 — Has data, production traffic

| App | Dokploy ID | Current schema | Target DB | Size | Notes |
|-----|------------|----------------|-----------|------|-------|
| JPV Bootcamp | `aPR9SvYn_JvGdMTk3CzeI` | `tenant_jpvbootcamp` | `jpvbootcamp` | 1168 kB | **CRITICAL — client DB, cannot break** |
| Open Fund | `rUyCCZYOE0TIKoUKkqSGQ` | `tenant_openfund` | `openfund` | 1576 kB | No local .env found |
| Free Resend | `xqkEuvn1EegwoqcX6ec2Z` | `tenant_resend` | `resend` | 1496 kB | No local .env found |
| Status Link | `1hooC9kE4Yn5SXmYI9DLg` | `tenant_statuslink` | `statuslink` | 560 kB | |
| Says the Bible | `Hu9rBtZj7XRwD7oxRZ4v7` | `tenant_saysthebible` | `saysthebible` | 1192 kB | In CI/CD pipeline |
| ProChat | `QmLMK77LC0zEKE_qxGQ4L` | `tenant_prochat` | `prochat` | 240 kB | |
| Cedula | `WESe1NAxTlCgcnj-YiutJ` | `tenant_cedula` | `cedula` | 136 kB | `${TENANT_DB_PASSWORD}` unresolved — see Issues |

### Priority 2 — Boilerplate schemas (low data, can run any time)

| App | Dokploy ID | Current schema | Target DB | Size | Notes |
|-----|------------|----------------|-----------|------|-------|
| ProKit Studio | `mLmnpewyWEra3cfQ0JEwk` | `tenant_prokitstudio` | `prokitstudio` | 80 kB | `${TENANT_DB_PASSWORD}` unresolved |
| SaaSKit Studio | `ZzSy31q9pWSWX3OyqXiFs` | `tenant_saaskitstudio` | `saaskitstudio` | 120 kB | `${TENANT_DB_PASSWORD}` unresolved |

### Priority 3 — Empty schemas (schema-only migration, no data)

| App | Dokploy ID | Current schema | Target DB | Notes |
|-----|------------|----------------|-----------|-------|
| Oliveto Organizing | `xBuP3eoiwNO5l2qY_N_1h` | `tenant_olivetoorganizing` | `olivetoorganizing` | 0 tables in prod |
| Via di Eden | `34heLjzG-klSB3ja7ZSG5` | `tenant_viadieden` | `viadieden` | 0 tables in prod |

### Already done — skip

| App | Dokploy ID | Status |
|-----|------------|--------|
| Proofly | `ub3NVzkB14Q-i3mNrIp0W` | Own DB (`proofly`), `schema=public` — reference model |

---

## Apps with No Database (skip entirely)

| App | Dokploy ID | Reason |
|-----|------------|--------|
| Yeshua Academy | `kPspytKHjCLuis1ijCnhB` | No DATABASE_URL |
| Docs | `PMjEm6mmNGSk60DazfVDy` | No DATABASE_URL |
| xGrow | `3SkJmqnjiRVs65BjPIivj` | No DATABASE_URL |
| Egg Cooker | `cf7F4hFlpqUQegFF85oG_` | No DATABASE_URL |
| JCCP Holdings | `HydSqf1OVKTELDuRW_KM3` | No DATABASE_URL |
| ProKit Dev | `GF-p4cw0g0It0OrWUqIJX` | Supabase Cloud (eu-west-1) |
| SaaSKit Dev | `ZswMGfANz_ljGPK_RBYLv` | Supabase Cloud (eu-west-1) |

---

## Before → After DATABASE_URL Map

### JPV Bootcamp (CRITICAL)
```
BEFORE:  postgresql://tenant_jpvbootcamp_user:<pass>@10.0.2.4:5433/postgres
                                                                    ^^^^^^^^ no schema param!
AFTER:   postgresql://jpvbootcamp_user:<pass>@10.0.2.4:5433/jpvbootcamp
```
**Note:** Current Dokploy URL has no `?schema=` param. The user's `search_path` is set to `tenant_jpvbootcamp`. After migration, schema becomes `public` in the new DB — URL will have no schema param either (same as Proofly model).

### Open Fund
```
BEFORE:  postgresql://tenant_openfund_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_openfund
AFTER:   postgresql://openfund_user:<pass>@10.0.2.4:5433/openfund
```

### Free Resend
```
BEFORE:  postgresql://tenant_resend_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_resend&sslmode=disable
AFTER:   postgresql://resend_user:<pass>@10.0.2.4:5433/resend
```

### Status Link
```
BEFORE:  postgresql://tenant_statuslink_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_statuslink
AFTER:   postgresql://statuslink_user:<pass>@10.0.2.4:5433/statuslink
```

### Says the Bible
```
BEFORE:  postgresql://tenant_saysthebible_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_saysthebible
AFTER:   postgresql://saysthebible_user:<pass>@10.0.2.4:5433/saysthebible
```

### ProChat
```
BEFORE:  postgresql://tenant_prochat_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_prochat
AFTER:   postgresql://prochat_user:<pass>@10.0.2.4:5433/prochat
```

### Cedula
```
BEFORE:  postgresql://tenant_cedula_user:${TENANT_DB_PASSWORD}@10.0.2.4:5433/postgres?schema=tenant_cedula
AFTER:   postgresql://cedula_user:<pass>@10.0.2.4:5433/cedula
```
**Note:** `${TENANT_DB_PASSWORD}` must be resolved before migration. Check Dokploy project-level env.

### ProKit Studio
```
BEFORE:  postgresql://tenant_prokitstudio_user:${TENANT_DB_PASSWORD}@10.0.2.4:5433/postgres?schema=tenant_prokitstudio
AFTER:   postgresql://prokitstudio_user:<pass>@10.0.2.4:5433/prokitstudio
```

### SaaSKit Studio
```
BEFORE:  postgresql://tenant_saaskitstudio_user:${TENANT_DB_PASSWORD}@10.0.2.4:5433/postgres?schema=tenant_saaskitstudio
AFTER:   postgresql://saaskitstudio_user:<pass>@10.0.2.4:5433/saaskitstudio
```

### Oliveto Organizing
```
BEFORE:  postgresql://tenant_olivetoorganizing_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_olivetoorganizing
AFTER:   postgresql://olivetoorganizing_user:<pass>@10.0.2.4:5433/olivetoorganizing
```

### Via di Eden
```
BEFORE:  postgresql://tenant_viadieden_user:<pass>@10.0.2.4:5433/postgres?schema=tenant_viadieden
AFTER:   postgresql://viadieden_user:<pass>@10.0.2.4:5433/viadieden
```

---

## Issues Found (must resolve before migration)

### Issue 1 — ProChat Accountant: schema missing in production (BLOCKED)
- Dokploy URL: `?schema=tenant_accountant`
- Production DB: **no `tenant_accountant` schema exists**
- `${TENANT_DB_PASSWORD}` is also unresolved
- **Action:** Investigate before touching. Either the app has never been provisioned properly, or it uses a different schema name. Do not migrate until clarified.

### Issue 2 — Unresolved `${TENANT_DB_PASSWORD}` variable
Apps affected: Cedula, ProKit Studio, SaaSKit Studio, ProChat Accountant, Proofly
- These reference a variable that must be set at Dokploy project-level env
- **Action:** Before updating DATABASE_URL for any of these apps, verify the variable resolves correctly (check Dokploy project env)

### Issue 3 — JPV Bootcamp has no `?schema=` in Dokploy URL
- Local .env has `?schema=tenant_jpvbootcamp`; Dokploy URL has none
- This works because `tenant_jpvbootcamp_user` has `search_path=tenant_jpvbootcamp`
- **Action:** When migrating, the new DB will use `public` schema (Proofly model) — no schema param needed. But verify Prisma schema file uses `schema = "public"` not `schema = "tenant_jpvbootcamp"` before deploying.

### Issue 4 — `ya_finance_schema` orphaned but has tables
- 320 kB, 11 tables including `User`, `Ledger`, `Transaction`, `_prisma_migrations`
- 0 rows in all tables — empty
- Owned by `ya_finance_user`, no Dokploy app found
- **Action:** Likely an abandoned Yeshua Academy finance module. Confirm with user, then either assign to YA app or drop.

---

## Orphaned Schemas (no live app, candidates for cleanup)

| Schema | Size | Tables | Assessment |
|--------|------|--------|------------|
| `jpvbootcamp` | 80 kB | 2 (empty stub) | Drop after `tenant_jpvbootcamp` migration confirmed |
| `ya_finance_schema` | 320 kB | 11 (0 rows) | Confirm intent before dropping |
| `financialfreedom_schema` | 0 | 0 | Drop — empty, no app |
| `maybe_schema` | 0 | 0 | Drop — empty, no app |
| `tenant_boilerplate` | 120 kB | 4 (schema-only) | Drop — dev artifact |
| `tenant_prochattools` | 120 kB | 4 (schema-only) | Drop — dev artifact |
| `tenant_procore` | 80 kB | 2 (schema-only) | Drop — dev artifact |
| `tenant_prokit` | 80 kB | 2 (schema-only) | Drop — dev artifact |
| `tenant_prokitcore` | 80 kB | 2 (schema-only) | Drop — dev artifact |
| `tenant_saaskit` | 120 kB | 4 (schema-only) | Drop — dev artifact |
| `tenant_saaskitcore` | 120 kB | 4 (schema-only) | Drop — dev artifact |
| `tenant_rebuildwp` | 0 | 0 | Drop — empty |

---

## System Schemas (never touch)

`auth`, `realtime`, `_realtime`, `graphql`, `graphql_public`, `extensions`, `public`, `pgbouncer`, `net` (pg_net), `storage`, `supabase_functions`, `vault`

---

## Local .env Alignment

| App | Local .env status |
|-----|-------------------|
| Says the Bible | `localhost:5433`, `?schema=tenant_saysthebible` ✓ |
| ProChat | Uses `tenant_dev` — dev environment only, not matching prod |
| Cedula | `localhost:5433`, `?schema=tenant_cedula` ✓ |
| JPV Bootcamp | `localhost:5433`, `?schema=tenant_jpvbootcamp` ✓ (note: prod has no schema param) |
| Oliveto Organizing | Uses `tenant_dev` — dev only |
| Via di Eden | Uses `tenant_dev` — dev only |
| Status Link | `localhost:5433`, `?schema=tenant_statuslink` ✓ |
| Proofly | `localhost:5433/proofly` ✓ (already on own DB model) |
| ProKit Studio | `localhost:5433`, `?schema=tenant_prokitstudio` ✓ |
| SaaSKit Studio | `localhost:5433`, `?schema=tenant_saaskitstudio` ✓ |
| ProKit Dev | Supabase Cloud |
| SaaSKit Dev | Supabase Cloud |

---

## Phase 0 Conclusion

**Ready to proceed to Phase 1** for the following apps (no blockers):
- JPV Bootcamp, Open Fund, Free Resend, Status Link, Says the Bible, ProChat, Oliveto Organizing, Via di Eden

**Blocked pending resolution:**
- Cedula, ProKit Studio, SaaSKit Studio — resolve `${TENANT_DB_PASSWORD}`
- ProChat Accountant — schema missing, investigate first

**Questions for user before Phase 1:**
1. `ya_finance_schema` — is this an abandoned Yeshua Academy module? OK to treat as cleanup candidate?
2. Orphaned dev artifact schemas (`tenant_boilerplate`, `tenant_prochattools`, etc.) — OK to schedule for drop?
