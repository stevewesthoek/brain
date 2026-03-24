# ProKit / Dokploy – Deployment Reminder

Use this reminder whenever provisioning a new Dokploy app with ProKit:

- Before first deploy: add bind mount `/var/backups/pgdump` -> `/var/backups/pgdump` (RW) in Dokploy UI.
- Run `npm run prokit:bootstrap -- <normalized-slug>` to create `.env` and `.env.production`.
- Normalized slug rule: lowercase repo name with `-`, `_`, and `.` removed.
