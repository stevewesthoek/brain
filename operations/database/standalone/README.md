# OrbStack Database Inventory

This directory contains the canonical Docker Compose definitions for the local Postgres databases we keep in OrbStack.

## Current active containers

| App | Container | Host Port | Database | Status |
|------|-----------|-----------|----------|--------|
| JPV Bootcamp | `jpvbootcamp-postgres-1` | `5444` | `jpvbootcamp` | running |
| Family Finance | `familyfinance-postgres-1` | `5452` | `family_finance` | running |

## Canonical standalone database map

These are the reserved local Postgres stacks tracked in brain. A port, once assigned, is never reused for another app.

| App | Compose directory | Host Port | Database | User | Notes |
|-----|-------------------|-----------|----------|------|-------|
| Cedula | `operations/database/standalone/cedula` | `5443` | `cedula` | `postgres` | Reserved local PostgreSQL stack. |
| Family Finance | `operations/database/standalone/familyfinance` | `5452` | `family_finance` | `postgres` | Reserved local PostgreSQL stack for local-only household finance app. |
| JPV Bootcamp | `operations/database/standalone/jpvbootcamp` | `5444` | `jpvbootcamp` | `postgres` | Empty local database for Stripe/WordPress provisioning repro. |
| Oliveto Organizing | `operations/database/standalone/olivetoorganizing` | `5445` | `olivetoorganizing` | `postgres` | Reserved local PostgreSQL stack. |
| OpenFund | `operations/database/standalone/openfund` | `5451` | `openfund` | `postgres` | Reserved local PostgreSQL stack. |
| ProChat | `operations/database/standalone/prochat` | `5442` | `prochat` | `postgres` | Reserved local PostgreSQL stack. |
| ProKit | `operations/database/standalone/prokit` | `5455` | `prokit` | `postgres` | Reserved local PostgreSQL stack. |
| ProKit Studio | `operations/database/standalone/prokitstudio` | `5449` | `prokitstudio` | `postgres` | Reserved local PostgreSQL stack. |
| Resend | `operations/database/standalone/resend` | `5448` | `resend` | `postgres` | Reserved local PostgreSQL stack. |
| SaaSKit | `operations/database/standalone/saaskit` | `5457` | `saaskit` | `postgres` | Reserved local PostgreSQL stack. |
| SaaSKit Studio | `operations/database/standalone/saaskitstudio` | `5450` | `saaskitstudio` | `postgres` | Reserved local PostgreSQL stack. |
| Says the Bible | `operations/database/standalone/saysthebible` | `5441` | `saysthebible` | `postgres` | Reserved local PostgreSQL stack. |
| StatusLink | `operations/database/standalone/statuslink` | `5446` | `statuslink` | `postgres` | Reserved local PostgreSQL stack. |
| Via di Eden | `operations/database/standalone/viadieden` | `5447` | `viadieden` | `postgres` | Reserved local PostgreSQL stack. |

## Operational rules

- Use one permanent port per local database.
- Keep the compose file, the local app registry, and the repo docs aligned whenever a port changes.
- Prefer empty local databases for reproducibility unless a specific seed is documented.
- Do not assign new project databases to `5432`; use the reserved port block in the local app registry instead.
