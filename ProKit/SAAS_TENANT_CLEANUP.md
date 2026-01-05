# SAAS Tenant Cleanup

This document defines how tenant cleanup works in this boilerplate.

It is the implementation-level reference for **dropping a tenant** (schema, user, and registry entry) in a safe, deterministic way. It is used by:

- `npm run db:cleanup -- --slug <slug> [--force]`
- Any automation (CI, Dokploy jobs, MCP tools) that need to delete preview tenants.

For the overall database model and tenant lifecycle, see `SAAS_DATABASE.md`.

---

## 1. Purpose and Scope

Cleanup is primarily designed for:

- **Preview tenants** created for pull-request preview environments (`type = 'preview'` in `public.tenants`).

By default, cleanup:

- Drops the tenant schema (removing all tables and data in that schema).
- Drops the tenant database user.
- Removes the tenant entry from `public.tenants`.

Destructive operations against **production tenants** (`type = 'prod'`) should only be allowed with an explicit `--force` flag and must not be triggered by automation/CI.

---

## 2. Safety Rules

Any cleanup implementation (scripts, tools, AI assistants) MUST follow:

1. **Registry is the source of truth**  
   Look up `public.tenants` first; do not guess schema/user names without verifying the row.

2. **Type-based protection**  
   Delete only `type = 'preview'` by default; require `--force` for anything else.

3. **Idempotency**  
   Safe to run multiple times; missing schema/user/row should not crash the script.

4. **Environment separation**  
   - Development cleanup runs against local Docker Postgres via `SYSTEM_DATABASE_URL` (port 5433).  
   - Production cleanup runs inside Dokploy against Supabase via `SYSTEM_DATABASE_URL`.  
   - Never attempt to clean production from a developer laptop.

---

## 3. Cleanup Algorithm (High-Level)

Given a DB-safe slug (`[a-z0-9_]+`):

1. **Lookup**  
   `SELECT slug, type, schema_name, db_user FROM public.tenants WHERE slug = $1`

2. **Authorize**  
   - If no row: no-op.  
   - If `type !== 'preview'` and no `--force`: abort.

3. **Drop schema**  
   `DROP SCHEMA IF EXISTS <schema_name> CASCADE;`

4. **Drop role**  
   `DROP ROLE IF EXISTS <db_user>;`

5. **Delete registry row**  
   `DELETE FROM public.tenants WHERE slug = $1;`

6. **Log result** for auditability.

---

## 4. SQL Templates

Parameterize inputs; do not concatenate unvalidated slugs.

- Lookup:
  ```
  SELECT slug, type, schema_name, db_user
  FROM public.tenants
  WHERE slug = $1;
  ```
- Drop schema:
  ```
  DROP SCHEMA IF EXISTS tenant_<slug> CASCADE;
  ```
- Drop role:
  ```
  DROP ROLE IF EXISTS tenant_<slug>_user;
  ```
- Delete registry row:
  ```
  DELETE FROM public.tenants WHERE slug = $1;
  ```

---

## 5. Integration With Scripts

### 5.1 npm command: db:cleanup

```
npm run db:cleanup -- --slug <slug> [--force]
```

Behavior:
- Uses `SYSTEM_DATABASE_URL`.
- Looks up `public.tenants`.
- Enforces `type = 'preview'` unless `--force` is passed.
- Drops schema, drops user, deletes registry row.

Environment:
- Development: `localhost:5433` (Docker Postgres).
- Production: Supabase `10.0.2.4:5433`, running inside Dokploy.

### 5.2 CI / PR integration

- PR opened/updated:  
  `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`
- PR closed/merged:  
  `NODE_ENV=production npm run db:cleanup -- --slug pr_42`

(`pr_42` is a DB-safe slug derived from the PR number.)

### 5.3 MCP integration (optional)

- Example tool: `cleanupTenant(slug: string)` → `NODE_ENV=production npm run db:cleanup -- --slug <slug>`
- MCP must not run arbitrary DROP SQL or bypass script safeguards.

---

## 6. AI and Automation Rules for Cleanup

Any AI/automation (MCP tools, CI bots, assistants) MUST:
- Use `npm run db:cleanup -- --slug <slug>` (or a documented wrapper).
- Avoid raw DROP/DML against production outside the script.
- Refuse to delete `type != 'preview'` unless explicitly forced in a manual context.

AI/automation MAY:
- Propose safety/logging improvements.
- Suggest registry tweaks consistent with `SAAS_DATABASE.md`.

---

## 7. Summary

- Cleanup targets preview tenants by default.  
- Steps: lookup → enforce type → drop schema → drop role → delete registry row.  
- Entry point:
  ```
  npm run db:cleanup -- --slug <slug> [--force]
  ```
- Design goals: safe, idempotent, scriptable, easy to plug into PR workflows and Dokploy/MCP automation.
