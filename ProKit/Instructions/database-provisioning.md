

# 🗄️ ProChat MicroSaaS Fast Boilerplate — Database Provisioning Guide

This document defines **how database provisioning works** for every new app built from the ProChat MicroSaaS Fast Boilerplate.  
Codex 5.1 must follow this guide whenever a new project is initialized.

---

## 🚨 Why Database Provisioning Is Required

The boilerplate **always requires a PostgreSQL database**, even if the app’s business logic does not directly use it.

This is because the boilerplate includes:

- Clerk authentication
- Stripe subscription gating
- Multi-tenant routing
- Prisma user → tenant mapping
- System schemas
- Billing & webhook tables
- Dashboard access checks

The app will **crash at runtime** without a valid `DATABASE_URL`.

This applies to all apps, including RebuildWP.

---

## ✅ The Provisioning Script

Use the provided script:

```
./scripts/provision-saas.sh <project-slug>
```

This script handles:

- Creating PostgreSQL database + schema
- Creating a dedicated database user
- Assigning correct privileges
- Syncing schema via Prisma
- Generating `.env` entries
- Setting up production `.env` for deployment
- Registering the project slug in the MCP bridge (if used)

Codex 5.1 MUST run this script when creating a new project repository.

---

## 📌 Required Environment Variables

The provisioning script produces the following values:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/dbname
SHADOW_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/dbname_shadow
```

The values MUST be added to:

- `.env` (local)
- `.env.production` (for Vercel)

Other env vars the boilerplate expects:

```
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_ENCRYPTION_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 🛠️ How Codex Should Use This Guide

Codex must:

1. **Always run:**  
   ```
   ./scripts/provision-saas.sh <slug>
   ```

2. **Never skip DB provisioning**, even if the app does not need custom models.

3. **Never rewrite Prisma core models** unless explicitly instructed.

4. When creating new features:
   - Add new tables if needed
   - Migrate using `prisma migrate dev` (local)
   - Or rely on the provisioning script for production sync

5. **Ask for clarification** before:
   - altering existing schema
   - removing models
   - modifying user → tenant logic

---

## 🔄 Local Development Flow

During local dev:

```
./scripts/provision-saas.sh myproject
npx prisma db push
```

This ensures:

- local DB exists  
- schema is synced  
- Clerk/Stripe guards work  
- Dashboard loads without errors  

---

## 🚀 Production Deployment Flow

1. Ensure `DATABASE_URL` is set in Vercel  
2. Redeploy  
3. Next.js + Prisma will auto-initialize  
4. Dashboard and API routes become fully functional  

If `DATABASE_URL` is missing or invalid, the app will crash.

---

## 🧩 Multi-Tenant Notes

The boilerplate uses:

- `systemPrisma.ts` for global models  
- `prismaTenant.ts` for tenant-specific queries  
- `getTenantFromRequest.ts` for dynamic routing

Codex must not modify these files during provisioning.

---

## 🛡️ Safety Rules for Codex 5.1

- Do NOT create your own provisioning scripts.  
- Do NOT modify `provision-saas.sh`.  
- Do NOT create or drop schemas manually unless instructed.  
- Do NOT attempt to bypass provisioning by using SQLite or memory DB.  
- Do NOT remove or replace the `DATABASE_URL` requirement.

---

## 🎯 Summary

- The ProChat Boilerplate **always requires Postgres**.  
- Database provisioning is not optional.  
- Codex must run `provision-saas.sh` whenever a new app is initialized.  
- This ensures auth, billing, dashboard, and tenant logic all function correctly.

This file formalizes the requirement so Codex never forgets it again.
