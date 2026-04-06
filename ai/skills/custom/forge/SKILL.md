---
name: forge
description: Master launch workflow — takes a raw SaaS idea and produces a fully operational product deployed to production. Chains NotebookLM research, office-hours validation, codex review, product naming, domain setup, design (taste-skill, ui-ux-pro-max, web-design), FFmpeg video hero, Stripe pricing, Supabase database, Cloudflare tunnel, and Dokploy deployment into one sequential workflow. Use when the user gives a short description of a SaaS idea and wants to go from zero to production.
---

# /forge — Zero to Production

> Takes a raw idea. Returns a live product.

**Version:** 0.1 (initial — designed for refinement)
**Stack default:** Next.js + TypeScript + Tailwind + Supabase + Stripe + Dokploy + Cloudflare

---

## What this skill does

`/forge` is an orchestration skill. It does not invent new capabilities — it sequences existing skills and CLIs in the right order, applies decision gates to prevent premature building, and holds the thread from first idea to live URL.

When you type `/forge` followed by a short idea, this skill takes over. It will not let you build until the idea is validated. It will not deploy until the product is built. It moves in one direction: forward.

---

## Skills and tools used

| Skill / Tool | Phase | Purpose |
|---|---|---|
| `/notebooklm` | Research | Market research, competitive landscape, ICP |
| `/office-hours` | Validation | 6 forcing questions, demand reality check |
| `/codex` | Review | Adversarial second opinion on idea and tech |
| `/cloudflare` (`wrangler`) | Domain | DNS setup, nameserver reminder |
| `/taste-skill` | Build | Design tokens, spacing, typography system |
| `/ui-ux-pro-max` | Build | UX patterns, component hierarchy, information architecture |
| `/web-design` | Build | Visual execution, landing page, full product UI |
| `/ffmpeg` | Build | Cinematic video hero section |
| `/stripe` | Infrastructure | Products, prices, checkout |
| `/supabase` | Infrastructure | Database, migrations, auth, types |
| `/dokploy` | Deploy | Project creation, deployment, env vars |
| `/cloudflare` (`cloudflared`) | Deploy | Public hostname tunnel → Dokploy |
| `/canary` | Verify | Post-deploy production health check |

---

## The seven phases

### PHASE 1 — Research
**Goal:** Understand the market before touching code.

Using `/notebooklm`, perform deep research on:
- Existing competitors and their positioning
- Target ICP (ideal customer profile) and their current workflow
- Pricing benchmarks in this category
- Market size signals (is anyone paying for this today?)
- Key pain points that are unsolved or underserved

Output a **Research Brief** summarizing:
1. Top 3 competitors and their weaknesses
2. Target user in one sentence
3. The specific pain point this product solves
4. Price range the market accepts
5. Any red flags (saturated market, technical moat missing, etc.)

Present the brief to the user before proceeding.

---

### PHASE 2 — Validation (Office Hours)
**Goal:** Kill bad ideas before they waste build time.

Run `/office-hours` in startup mode. The six forcing questions must be answered honestly:
1. Who is the one specific person desperately needing this right now?
2. What are they doing today to solve this problem (the status quo)?
3. Why is the status quo painful enough that they would pay to change it?
4. What is the narrowest possible wedge — the one thing this product must do better than anything else?
5. What have you observed (not assumed) that tells you demand is real?
6. If this product didn't exist, what would the user do? Is that acceptable?

**Decision gate:** If answers reveal weak demand, an unclear ICP, or a pain point users can tolerate — **do not proceed**. Instead, iterate: return to Phase 1 with a refined angle, pivot the target user, or narrow the scope. Repeat until the answers are sharp and demand is clear.

Only proceed to Phase 3 when the user explicitly confirms the idea is worth building.

---

### PHASE 3 — Second Opinion (Codex)
**Goal:** Surface technical and product risks before committing.

Run `/codex` in adversarial/challenge mode. Ask it to:
- Identify the biggest technical risks in building this product
- Challenge the core assumption behind the product
- Flag anything that will be harder than expected (auth edge cases, data model complexity, third-party API dependencies, etc.)
- Suggest what the MVP should NOT include

Incorporate any critical feedback before moving to product definition. Minor risks can be logged as known issues for post-launch iteration.

---

### PHASE 4 — Product Definition
**Goal:** Lock in the product before building. No ambiguity allowed.

Work through these items in order, confirming each with the user:

#### 4a. Product name
Propose three name options. Each name should be:
- Memorable and short (1–2 words preferred)
- Domain-available or close to it
- Reflecting the core value prop

Let the user choose.

#### 4b. Domain
Propose the primary domain (`.com` preferred, `.io` acceptable for dev tools, `.app` for apps).
Check whether the domain is likely available.

**Reminder to user:**
> To use Cloudflare for DNS management, point your domain's nameservers to Cloudflare.
> The Cloudflare account to use is **info@prochat.tools**.
> After purchasing the domain, add it to that account and update nameservers at your registrar.
> Come back once the domain is active in Cloudflare before the deploy phase.

#### 4c. MVP feature set
Define the absolute minimum feature set — the one thing this product must do on day one.
Format as a numbered list. Strike anything that can wait for v2.

Rule: if the product can be useful without a feature, cut it.

#### 4d. Pricing
Define pricing tiers (typically: free/trial + one or two paid tiers).
For each tier, specify:
- Name
- Monthly price
- What's included
- Stripe product/price ID (to be created in Phase 6)

#### 4e. Confirmation gate
Present a **Product Brief** summarizing all of the above. Ask the user:

> "This is what we're building. Do you want to proceed?"

Do not write a single line of code until the user says yes.

---

### PHASE 5 — Build
**Goal:** Build the product with production-quality design and code.

#### 5a. Scaffold
Create the project repo under the appropriate `~/Repos/` path:
- Client work → `~/Repos/prochattools/clients/<name>/`
- SaaS product → `~/Repos/prochattools/saas/<name>/`
- Personal → `~/Repos/stevewesthoek/<name>/`

Initialize with the default stack:
```bash
npx create-next-app@latest <name> --typescript --tailwind --eslint --app --src-dir
```

Immediately after scaffold, before any other file, create `.claudeignore`:
```bash
cat > .claudeignore << 'EOF'
node_modules/
.next/
dist/
build/
out/
.turbo/
.cache/
coverage/
*.log
logs/
package-lock.json
yarn.lock
bun.lock
pnpm-lock.yaml
*.map
supabase/.branches/
supabase/.temp/
*.png
*.jpg
*.jpeg
*.gif
*.webp
*.mp4
*.mp3
*.wav
*.pdf
*.zip
*.tar.gz
*.woff
*.woff2
*.ttf
*.eot
*.otf
.DS_Store
EOF
```

#### 5b. Design system — run these three skills in order
1. **`/taste-skill`** — establish the design foundation: spacing scale, type ramp, color tokens, shadow system, motion primitives
2. **`/ui-ux-pro-max`** — define UX architecture: information hierarchy, component patterns, interaction model, page structure
3. **`/web-design`** — execute the visual design: landing page, core product screens, hero section layout, CTAs

Design must feel premium. No generic AI patterns. Reference the output of all three skills before writing component code.

#### 5c. Video hero
Use `/ffmpeg` to produce a cinematic video hero section:
- Source: high-quality stock footage or generated visuals relevant to the product
- Output: optimized `.mp4` for web (H.264, compressed, loop-friendly)
- Overlay: product name, tagline, CTA — handled in code, not burned into video
- Target: <5MB for initial load, lazy-load full quality

#### 5d. Core product build
Build the MVP feature set defined in Phase 4c:
- Implement auth (Supabase Auth, magic link or OAuth)
- Implement core feature(s)
- Wire Stripe checkout
- Add basic error states and loading states
- No premature optimization, no features beyond the MVP list

---

### PHASE 6 — Infrastructure
**Goal:** Connect all services. One command should start the whole stack.

Run these steps in order:

#### 6a. Supabase
```bash
# Initialize Supabase locally
supabase init
supabase start

# Write and apply migrations
supabase migration new initial_schema
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > src/types/supabase.ts
```

#### 6b. Stripe — account, keys, webhooks

**Step 1 — Manual (one required step):**
Pause and prompt the user:

> "Before we continue, go to dashboard.stripe.com → switch account menu → **New account** and create a Stripe account named **`<app-name>`**. Stripe automatically creates a paired test environment. Come back and confirm when it's done."

Wait for confirmation before continuing.

**Step 2 — Login via CLI and capture keys:**
```bash
stripe login --project-name "<app-name>"
# Opens browser. After login, keys are saved to CLI config.

# Verify — keys are visible here (never commit or print):
stripe config --list --project-name "<app-name>"
```
From `stripe config --list` output, note:
- `test_mode_pub_key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test)
- `test_mode_api_key` → `STRIPE_SECRET_KEY` (test)
- `live_mode_pub_key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (production)
- `live_mode_api_key` → `STRIPE_SECRET_KEY` (production)

**Step 3 — Create test webhook endpoint:**
```bash
stripe post /webhook_endpoints \
  --project-name "<app-name>" \
  -d "url=https://<app-url>/api/webhooks/stripe" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.expired" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed"
```
The `secret` field in the response → `STRIPE_WEBHOOK_SECRET` (test env). Capture immediately — shown once.

**Step 4 — Create live webhook endpoint:**
```bash
stripe post /webhook_endpoints \
  --project-name "<app-name>" \
  --live \
  -d "url=https://<app-url>/api/webhooks/stripe" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.expired" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=invoice.paid" \
  -d "enabled_events[]=invoice.payment_failed"
```
The `secret` field in the response → `STRIPE_WEBHOOK_SECRET` (production env). Capture immediately — shown once.

**Step 5 — Set environment variables:**
Write the test keys to `.env.local` / `.env.test`.
Write the live keys to `.env.production` AND set them in Dokploy via `/dokploy` skill.
See the environment variables template below.

**Step 6 — Create Stripe products and prices:**
- Create a Product for each pricing tier defined in Phase 4d
- Create recurring Prices (monthly) for each product
- Copy the Price IDs into `.env` as `STRIPE_PRICE_<TIER>_ID`
- Test with a test-mode checkout flow before going live

#### 6c. Dockerfile — create before deploying

**Always use a custom `Dockerfile` with `dockerfile` buildType in Dokploy. Never use nixpacks for this stack.**

Why: Dokploy's nixpacks mode injects ALL app env vars (including `NODE_OPTIONS=--require newrelic`) as `ENV` statements that are active during every `RUN` step. This causes `npm ci` to fail with `Cannot find module 'newrelic'` — Node.js tries to preload newrelic before node_modules exists.

With `dockerfile` buildType, Dokploy uses the repo's own Dockerfile and only injects env vars at container *runtime*. The build environment is clean.

**Standard Dockerfile template for this stack:**

```dockerfile
# ---- Base ----
FROM node:20-bullseye AS base
WORKDIR /app

# ---- Deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
# Copy prisma dir if repo has prisma schemas (postinstall runs prisma generate)
COPY prisma ./prisma
# Use npm ci without --omit=dev: prisma CLI is a devDep needed for postinstall
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder values for keys validated at module-eval time during next build.
# Real values are injected at runtime by Dokploy — these never reach the client bundle.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Add any other SDK keys that throw if missing at module load:
# ENV RESEND_API_KEY=re_build_placeholder
# ENV STRIPE_SECRET_KEY=sk_live_build_placeholder_00000000000000000000
RUN --mount=type=cache,target=/app/.next/cache \
    npx prisma generate && \
    npm run build

# ---- Runner ----
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["npm", "run", "start"]
```

**Key rules when customising the template:**

| Situation | What to do |
|---|---|
| Multiple prisma schemas (e.g. `schema.prisma` + `system.prisma`) | Run `npx prisma generate` for each schema explicitly in builder |
| Custom prisma output path (`output = "../node_modules/@prisma/system-client"`) | Make sure the generate command uses `--schema=prisma/system.prisma` |
| SDK key validated at module load (Resend, Stripe, etc.) | Add `ENV KEY=placeholder_value` in builder stage |
| `better-sqlite3` or other native modules | Add `RUN apt-get install -y python3 make g++` in deps stage |
| App uses `next start` with standalone output | Copy `.next/standalone` instead of `.next` in runner |
| App has a custom start script | Replace CMD with `CMD ["sh", "scripts/runtime/start-prod.sh"]` and `COPY scripts` |

**After creating the Dockerfile, set buildType in Dokploy:**

```bash
# Using /dokploy skill:
# 1. Find the applicationId
# 2. PATCH buildType to "dockerfile"
# 3. Trigger deploy
```

#### 6d. Dokploy — project setup
Using `/dokploy`:
- Create a new project
- Create an application linked to the GitHub repo
- **Set buildType to `dockerfile`** (not nixpacks)
- Set all environment variables (Supabase URL + anon key, Stripe keys, app URL, etc.)
- Trigger initial deploy
- Confirm the app is running

#### 6d. Cloudflare — DNS + Tunnel
Using `/cloudflare`:

**DNS:**
```bash
# Add the domain to Cloudflare (must be done in dashboard if new)
# Then set A record or CNAME pointing to Dokploy IP
wrangler dns create <zone-id> --type CNAME --name <subdomain> --content <dokploy-host> --proxy
```

**Tunnel (public hostname → Dokploy):**
```bash
# Create tunnel
cloudflared tunnel create <product-name>

# Configure ingress (edit ~/.cloudflared/config.yml)
# ingress: hostname: app.example.com → http://localhost:<dokploy-port>

# Route DNS to tunnel
cloudflared tunnel route dns <product-name> <hostname>

# Run tunnel (or install as service)
cloudflared tunnel run <product-name>
```

Set the `NEXT_PUBLIC_APP_URL` env var in Dokploy to the public hostname.
Trigger a redeploy after all env vars are set.

---

### PHASE 7 — Verify
**Goal:** Confirm the product is live and working before declaring done.

1. Run `/canary` — verify production health (page loads, no console errors, no 5xx)
2. Manual smoke test:
   - Landing page loads
   - Auth flow works end-to-end
   - Stripe checkout reaches success page (test mode)
   - Core feature executes without error
3. Share the live URL with the user

If `/canary` finds issues → diagnose and fix before marking done.

---

## Decision gates summary

| After phase | Gate question | If no → |
|---|---|---|
| Phase 1 | Is the market real? | Refine angle, re-research |
| Phase 2 | Is demand specific and urgent? | Pivot ICP or scope, re-validate |
| Phase 3 | Are technical risks acceptable? | Adjust approach, note risks |
| Phase 4 | Is the Product Brief confirmed? | Revise until user says yes |
| Phase 5 | Does the build match the brief? | Fix before infrastructure |
| Phase 6 | Are all services connected? | Debug before verify |
| Phase 7 | Is production healthy? | Fix and re-verify |

**Iron rule: never skip a gate. A fast bad launch is worse than a slow good one.**

---

## Environment variables template

Every product needs these variables in both environments.

**`.env.local` / `.env.test` (test environment):**
```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe — test mode (pk_test_..., sk_test_..., whsec_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional
RESEND_API_KEY=
```

**`.env.production` + Dokploy (production environment):**
```env
# App
NEXT_PUBLIC_APP_URL=https://app.example.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe — live mode (pk_live_..., sk_live_... or rk_live_..., whsec_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional
RESEND_API_KEY=
```

---

## Known limitations (v0.1)

- Stack is fixed at Next.js + Supabase + Stripe. Multi-stack support is a future refinement.
- FFmpeg hero assumes stock footage is available locally. Sourcing workflow TBD.
- Cloudflare tunnel setup assumes `cloudflared` is running as a persistent service. Service install steps may vary.
- Stripe account creation requires one manual step in the Stripe Dashboard — all other Stripe setup (CLI login, webhooks, env vars) is automated.
- No multi-region or CDN configuration in this version.
- Dockerfile template assumes PostgreSQL (Prisma). SQLite apps (`better-sqlite3`) need `RUN mkdir -p /app/data` in builder so module-eval DB open doesn't fail during page collection.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-03-30 | Initial design — full workflow skeleton, all phases defined |
| 0.2 | 2026-04-01 | Phase 6b expanded: Stripe account setup fully automated (CLI login, test + live webhook creation with 6 events, env var split for test vs production). One manual step: Dashboard account creation. |
| 0.3 | 2026-04-06 | Phase 6c rewritten: always use dockerfile buildType (never nixpacks). Added standard Dockerfile template, key rules table, and explanation of nixpacks NODE_OPTIONS leak. |
