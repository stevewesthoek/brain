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

## New app checklist

1. Create repo and choose a project name (this becomes `APP_SLUG`).
2. Run local provisioning:
   ```bash
   npm run db:init -- --slug <project-name>
   ```
3. Run local migrations:
   ```bash
   npm run db:migrate:dev
   ```
4. Commit code and `prisma/migrations`.
5. Use the generated `.env.production` values for Dokploy env vars.
6. Deploy with the Dokploy command template above.
