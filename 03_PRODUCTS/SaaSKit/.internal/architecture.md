# SaaSKit Architecture

SaaSKit is ProChat Tools' SaaS launch kit: a full product starter built on the ProKit engine.

This document defines the boundary between:

- ProKit: the internal SaaS engine (dev-focused)
- SaaSKit: ProKit + marketing + launch system (non-dev friendly)

It also inventories the marketing layer so we can later derive a clean ProKit-only repo.

## ProKit vs SaaSKit (final definitions)

### ProKit (engine; dev-focused)

Purpose:
- A lean SaaS engine: everything you need to build SaaS, without marketing/SEO/content systems.

Includes (engine primitives):
- Next.js + TypeScript + Tailwind + shadcn/ui.
- Clerk auth (users, organizations/workspaces).
- Postgres + Prisma (multi-tenant schema-per-tenant).
- Stripe subscriptions (checkout + portal).
- Email wiring (Resend) and templates.
- n8n/webhook hooks.
- Minimal dashboard shell (settings/billing/layout).
- Automated DB lifecycle scripts (provision, migrate, verify, cleanup).

Explicitly excludes:
- Marketing site and funnels.
- Blog/SEO/content system.
- Non-dev onboarding docs and launch playbooks.

### SaaSKit (product; non-dev friendly)

Purpose:
- ProKit engine + a marketing site + a launch system that helps non-dev founders ship fast.

Includes:
- Everything in ProKit (engine).
- Plus:
  - Marketing site (hero, features, pricing, FAQ, CTAs, newsletter).
  - Blog/SEO routes and components.
  - Funnel pages (waiting list / success / processing pages).
  - Docs skeleton and prompt packs (internal first; exported later to repo docs).
  - Weekend launch guidance (planned; internal first).

## Versioning + release gate (required)

- Canonical version is the git tag on the SaaSKit repo (example: `v1.2.3`).
- `PROCHAT_VERSION` must match the tag version without the `v` prefix (`1.2.3`).
- Production deploys are tag-gated (no PR preview deploys).

## Documentation map (Brain)

Within `03_PRODUCTS/SaaSKit/`:

- `.internal/architecture.md` - this document.
- `.internal/development.md` - local dev workflow.
- `.internal/database.md` - multi-tenant DB rules + env contracts.
- `.internal/deploy_dokploy.md` - Dokploy production deploy (primary path).
- `.internal/deploy_vercel.md` - optional/limited deployments.
- `.internal/scripts.md` - what the ProKit engine scripts do and how SaaSKit uses them.
- `modules/` - optional patterns/templates.

## Repo structure (code)

SaaSKit is a single Next.js App Router repo:

- Routes (App Router): `src/app/**`
- Shared UI components: `src/components/**` and `src/components/ui/**`
- SaaSKit layer (marketing + site chrome): `src/saaskit/**`
  - Landing system: `src/saaskit/marketing/landing/**`
- DB schema + migrations: `prisma/system.prisma`, `prisma/migrations/**`
- DB/runtime/deploy scripts: `scripts/**`
- Build/runtime environment: `nixpacks.toml`, `.env.example`

## SaaSKit layer (marketing + launch system)

SaaSKit adds a marketing and launch layer on top of the ProKit engine. This layer is user-facing.

Enablement instructions for optional routes and integrations live in `.internal/optional_features.md`.

### Marketing routes (required for SaaSKit)

- `/` (home/landing)
  - `src/app/page.tsx`
  - Renders the marketing landing system: `src/saaskit/marketing/landing/App.tsx`
- `/privacy-policy`
  - `src/app/privacy-policy/page.tsx`
  - Layout wrapper (adds site footer): `src/app/privacy-policy/layout.tsx`
- `/tos`
  - `src/app/tos/page.tsx`
  - Layout wrapper (adds site footer): `src/app/tos/layout.tsx`

### Funnel routes (optional)

These are part of the launch system. Keep them if you want lead capture and simple conversion flows.

- `/waiting-list`
  - `src/app/waiting-list/page.tsx`
  - Layout wrapper (adds site footer): `src/app/waiting-list/layout.tsx`
  - API handler: `src/app/api/waiting-list/route.ts`
- `/success`
  - `src/app/success/page.tsx`
- `/processing-page/*`
  - `src/app/processing-page/[[...processing-page]]/page.tsx`

### Blog/SEO routes (optional)

- `/blog`
  - `src/app/blog/page.tsx`
  - Layout wrapper (adds site footer): `src/app/blog/layout.tsx`
- `/blog/[articleId]`
  - `src/app/blog/[articleId]/page.tsx`

### Marketing landing system (required for SaaSKit home page)

Primary folder:
- `src/saaskit/marketing/landing/`

Key files:
- `src/saaskit/marketing/landing/App.tsx` (page composition)
- `src/saaskit/marketing/landing/metadata.json` (marketing copy/config input)
- `src/saaskit/marketing/landing/landing.module.css` (landing-only styling)

Layout components (single source of truth for the marketing site's chrome):
- `src/saaskit/marketing/landing/components/layout/Navbar.tsx`
- `src/saaskit/marketing/landing/components/layout/Footer.tsx`

Sections (all optional individually; required only insofar as the home page imports them):
- `src/saaskit/marketing/landing/components/sections/Hero.tsx`
- `src/saaskit/marketing/landing/components/sections/ProblemSolution.tsx`
- `src/saaskit/marketing/landing/components/sections/Features.tsx`
- `src/saaskit/marketing/landing/components/sections/Pricing.tsx`
- `src/saaskit/marketing/landing/components/sections/FAQ.tsx`
- `src/saaskit/marketing/landing/components/sections/FinalCTA.tsx`
- `src/saaskit/marketing/landing/components/sections/Banner.tsx`
- `src/saaskit/marketing/landing/components/sections/AudienceFilter.tsx`
- `src/saaskit/marketing/landing/components/sections/Newsletter.tsx`
- `src/saaskit/marketing/landing/components/sections/Expansions.tsx`
- `src/saaskit/marketing/landing/components/sections/ShipFast.tsx`
- `src/saaskit/marketing/landing/components/sections/License.tsx`

UI helpers:
- `src/saaskit/marketing/landing/components/ui/Button.tsx`
- `src/saaskit/marketing/landing/components/ui/ThemeToggle.tsx`
- `src/saaskit/marketing/landing/components/ui/Scaffolding.tsx`
- `src/saaskit/marketing/landing/components/ui/Visuals.tsx`

### Shared marketing components (optional)

These live outside the landing folder and are used across marketing pages:

- `src/components/Header.tsx`, `src/components/Footer.tsx`
  - Thin wrappers that render the landing system's `Navbar`/`Footer` for visual consistency.
- `src/components/Marketing.tsx` (high-level marketing composition)
- `src/components/PricingSection.tsx`, `src/components/PriceItem.tsx`
- `src/components/FAQ.tsx`
- Testimonials UI:
  - `src/components/Testimonials1.tsx`
  - `src/components/TestimonialsAvatars.tsx`
  - `src/components/TestimonialRating.tsx`
- Blog UI:
  - `src/components/BlogsListing.tsx`
  - `src/components/BlogCard.tsx`
  - `src/components/BlogDetails.tsx`
- Waiting list hero: `src/components/WaitingListHero.tsx`


## ProKit engine layer (SaaSKit depends on this)

The ProKit engine provides the SaaS primitives that the marketing layer sells.

### App routes (engine)

- Auth routes (Clerk):
  - `src/app/sign-in/[[...sign-in]]/page.tsx`
  - `src/app/sign-up/[[...sign-up]]/page.tsx`
- App shell:
  - `src/app/layout.tsx`
  - `src/components/AppShell.tsx`
- Core app pages:
  - `src/app/dashboard/page.tsx`
  - `src/app/chat/[projectID]/page.tsx`

### Billing + webhooks (engine)

- Checkout: `src/app/api/stripe/create-checkout/route.ts`
- Portal: `src/app/api/stripe/create-portal/route.ts`
- Stripe webhook: `src/app/api/webhook/stripe/route.ts`

### Multi-tenancy + database lifecycle (engine; required)

- Prisma schema: `prisma/system.prisma`
- Migrations: `prisma/migrations/**`
- Provision tenant: `npm run db:init` (script: `scripts/db/init-tenant.js`)
- Prod migration: `npm run db:migrate:prod` (Prisma deploy)
- Runtime gate (prod): `npm start` -> `scripts/runtime/start-prod.sh` -> `scripts/db/deploy-prod.sh`

See `.internal/database.md` for the env var and schema/user contracts.

## Deriving ProKit from SaaSKit (future step)

When creating the ProKit-only repo from SaaSKit, remove the SaaSKit layer:

- Remove marketing/funnel/blog routes under `src/app/` (keep only minimal landing + legal if desired).
- Remove `src/saaskit/**` (SaaSKit-only marketing layer) and marketing-only components in `src/components/**`.
- Keep ProKit engine routes, DB scripts, and billing/auth primitives unchanged.
