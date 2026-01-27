# ProKit Boilerplate

ProKit is ProChat's boilerplate for building B2B SaaS apps. It standardizes auth, billing, database lifecycle, and deployment.

## Docs

- `DEVELOPMENT.md` - local setup and workflow
- `DATABASE.md` - provisioning, migrations, cleanup, env contracts
- `DEPLOY_DOKPLOY.md` - primary production environment (private DB access)
- `DEPLOY_VERCEL.md` - limited production environment
- `MODULES/` - optional patterns and templates

## Environments (summary)

- Development: local Docker Postgres on `localhost:5433`.
- Production (Dokploy): private Supabase Postgres at `10.0.2.4:5433` reachable only from Dokploy.
- Production (Vercel): only if DB is publicly reachable or via secure proxy/tunnel.

## Dokploy command template

Use this as your Dokploy deploy command or pre-deploy hook:

```bash
npm run db:init -- --slug $APP_SLUG
NODE_ENV=production npm run db:migrate:prod
npm start
```
