# ProKit AI Reminders

Use this reminder whenever provisioning a new Dokploy app:

**Before first deploy: add bind mount `/var/backups/pgdump` -> `/var/backups/pgdump` (RW) in Dokploy UI.**

Also remind:
- Run `npm run prokit:bootstrap -- <slug>` to create `.env` and `.env.production`.
