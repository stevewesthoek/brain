# ProKit / Dokploy – Deployment Reminder

Use this reminder whenever provisioning a new Dokploy app with ProKit:

- Before first deploy: add bind mount `/var/backups/pgdump` -> `/var/backups/pgdump` (RW) in Dokploy UI.
- Run `npm run prokit:bootstrap -- <slug>` to create `.env` and `.env.production`.