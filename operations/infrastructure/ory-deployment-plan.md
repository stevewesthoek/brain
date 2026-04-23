# Ory Deployment Plan

**Status:** In Progress  
**Date Started:** 2026-04-12  
**Primary Auth UI:** ProChat (`https://prochat.tools`)  
**Auth Backend:** Ory (`https://auth.prochat.tools`)  
**Fallback Auth:** Clerk (legacy, migrating)

---

## Architecture

```
Internet
  ↓
Cloudflare (wildcard *.prochat.tools)
  ↓
ProChat shared auth UI (`prochat.tools/sign-in` and `/sign-up`)
  ↓
Ory Kratos public/admin endpoints (`auth.prochat.tools` / `auth-admin.prochat.tools`)
  ↓
Supabase PostgreSQL (ory_prod database)
```

## Deployment Checklist

- [ ] Create `ory_prod` database in Supabase
- [ ] Create Docker Compose configuration for Ory
- [ ] Deploy Ory to Dokploy (Ops project)
- [ ] Configure Cloudflare DNS (auth.prochat.tools)
- [ ] Generate Ory API keys and credentials
- [ ] Store credentials in `~/.config/ory/.env`
- [ ] Install Ory CLI (already done: v1.3.0)
- [ ] Create shared skill for Ory
- [ ] Update brain documentation (CLAUDE.md, AGENTS.md, GEMINI.md)
- [ ] Create Ory runbook with CLI examples
- [ ] Update credentials index
- [ ] Create auto-provisioning script for new domains
- [ ] Test user creation/management via CLI
- [ ] Document Clerk → ProChat UI → Ory migration strategy

## Database Configuration

**Supabase Connection (Internal to Dokploy):**
```
Host: 10.0.2.4
Port: 5433
Admin User: supabase_admin
Admin Password: HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV
Database: ory_prod (to create)
```

## Dokploy Configuration

**Project:** Ops  
**Service:** Ory (Docker Compose)  
**Domain:** auth.prochat.tools  
**Port:** 4444 (Ory default)  
**Environment:** production

## Credentials to Generate

1. Ory Admin API Key
2. Ory OAuth2 Client ID/Secret
3. Ory Session Secret
4. Ory Cookie Secret
5. Database credentials (for app-to-DB connection)

## Migration Strategy

**Phase 1 (Now):** Ory primary for prochat.tools  
**Phase 2 (Later):** Add more domains to Ory  
**Phase 3 (Future):** Migrate Clerk users to Ory (export → import)  
**Fallback:** Clerk remains operational for legacy apps

---

## Next Steps

1. Create Supabase database
2. Deploy Ory container
3. Test CLI access
4. Document everything in brain
