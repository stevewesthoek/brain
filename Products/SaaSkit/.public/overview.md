# SaaSKit Overview

SaaSKit is ProChat’s commercial SaaS launch boilerplate.

It combines:

- **ProKit (engine)**: auth, billing, database lifecycle, deploy gate
- **SaaSKit (marketing + launch layer)**: a polished marketing site plus optional launch features (blog, waiting list, funnels)

## Who it's for

- Solo founders and small teams who want **SaaS + website + billing + onboarding** in one repo
- Non-dev founders who want a guided system they can customize with AI

## What SaaSKit includes

Required baseline:

- Marketing home page (`/`)
- Legal pages (`/tos`, `/privacy-policy`)
- App shell (`/dashboard`)
- ProKit engine runtime deploy gate (hands-off production migrations)

Optional features (enable when configured):

- Blog/SEO structure (WordPress-backed)
- Waiting list capture (Resend-backed)
- Checkout funnel routes (`/processing-page/*`, `/success`)
- Stripe billing (checkout + portal + webhooks)
- Clerk authentication
- Supabase-compatible Postgres (or any Postgres reachable from Dokploy)
- n8n automation wiring (webhook hooks / workflow helpers)

## Deploy policy (important)

- Production deploys are **tag-gated** (git tags only).
- Provisioning and migrations are **hands-off** in production: the runtime deploy gate runs on container start.
- Do not run ad-hoc database commands in production; fix config/code and redeploy a tag.
