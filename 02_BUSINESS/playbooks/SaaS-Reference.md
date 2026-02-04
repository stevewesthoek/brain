# SaaS Builder Reference Document (Updated)

## 1. Purpose
This document defines how I evaluate and generate SaaS ideas.  
When I give an AI assistant a SaaS concept, it must:
- Decide quickly if the idea fits my constraints and philosophy.  
- Explain if it’s worth building or not.  
- Suggest faster, simpler, or more profitable alternatives when needed.  
When I ask for new ideas, the AI assistant must generate ones that I can build rapidly with my stack and business logic below.

## 2. Mission
I build small B2B SaaS products fast, cheap, and often.  
I focus 80% on ideation and validation, 20% on execution.  
I don’t chase perfect apps — I chase real users who pay.

My system is designed for **speed, simplicity, and repeatability**:  
The boilerplate handles everything except the business idea.  
If I can’t ship it within two days, it’s not a good fit.

## 3. Tech Stack (Fixed and Non-Negotiable)
I never deviate from this stack:

- **Framework:** Next.js (with `/app` and `/pages` routers)  
- **Language:** TypeScript  
- **Styling:** TailwindCSS + shadcn/ui  
- **Auth:** Clerk (authentication + profiles)  
- **Database:** PostgreSQL (via Supabase) + Prisma ORM  
- **Email:** Resend  
- **Payments:** Stripe  
- **Automation Layer:** n8n (core engine for logic and integrations)  
- **Utilities / Features Included in Boilerplate:**  
  - SEO + Blog (Headless WordPress)  
  - User Dashboard  
  - Invoice Generator  
  - Waiting List  
  - Component Library & Animations  
  - Built-in analytics and deployment workflow  

This stack already covers 95% of what most SaaS apps need.  
Ideas must adapt to it — not the other way around.

## 4. Operating Philosophy

1. **Speed Over Perfection**  
   Each product must reach MVP in one or two days. Shipping fast > building big.

2. **Reuse Proven Models**  
   Look for ideas already validated on ProductHunt, IndieHackers, or Twitter.  
   Copy what works, improve slightly:
   - Simplify the flow.  
   - Add a small feature users request.  
   - Localize or niche down.  

3. **Strict Scope Discipline**  
   No deep integrations or fancy APIs unless essential.  
   No new architectures.  
   The boilerplate + n8n covers nearly all cases.

4. **Automation First**  
   Prefer n8n workflows to hand-coded logic.  
   The app UI should mostly be a clean wrapper around automations.  
   Code only when automation cannot handle it efficiently.

5. **Fail Fast, Iterate Faster**  
   Expect most ideas to fail.  
   Success comes from volume, not accuracy.  
   Every launch is a test, not a masterpiece.

6. **Simple Problem, Real Market**  
   Focus on B2B utilities — niche markets with money, pain, and habit.  
   The real estate industry is the starting point, but any niche that pays for productivity is valid.

7. **Trustless, Passwordless, Push-First**  
   - Build systems where identity is implied by possession of a signed link.  
   - Prefer real-time web-push notifications to email, or use both strategically.  
   - Design mobile-first UIs that look and feel like native apps yet run in any browser.  
   - Every idea should treat links as primary interaction objects—public magic links for external actors, authenticated deeplinks for internal users.

## 5. Business Rules

- **Audience:** B2B customers, especially professional niches that value time and clarity.  
  Focus first on markets that are comfortable paying (e.g., real estate, finance, legal, trades).  

- **Pricing:**  
  - Default: **Monthly flat fee (recurring).**  
  - **Pay-per-use** only when it obviously fits the product logic.  
  - **Freemium** only if:  
    - The free tier costs me nothing to run.  
    - It clearly helps traction or upsell conversion.  
  - Priority is revenue, not vanity metrics.

- **Cost Discipline:**  
  Avoid SMS, heavy AI inference, or other per-use costs unless unavoidable and the price can absorb it.  
  n8n + APIs are fine if costs are predictable and small.

- **Sensitive Data:**  
  Avoid handling PII (personal identifiable information) or high-trust workflows.  
  Only consider them if the upside is big and a simple trustless model can be used.  
  At this stage, assume **no inherent user trust**.

- **Distribution:**  
  I can handle marketing through automation (SEO, blog CMS, social posting).  
  The assistant doesn’t need to optimize for virality, but ideas should be *launchable* on ProductHunt, etc.

- **Definition of Success:**  
  10 paying monthly customers = success threshold.  
  Once reached, I’ll iterate and raise the bar.

## 6. Evaluation Framework

When assessing any SaaS idea, the AI assistant should score each category 1–10 and justify briefly:

1. **Speed Fit** – Can it be built with my boilerplate in ≤2 days?  
2. **Complexity** – Avoids heavy integrations, security issues, or large UIs?  
3. **Market Proof** – Existing players or clear demand already validated?  
4. **Twist Factor** – Is there a simple, unique improvement or niche translation?  
5. **Automation Value** – Does n8n enable key logic that makes it “smart”?  
6. **Monetization Clarity** – Obvious way to charge monthly with Stripe?  
7. **Data Safety** – Avoids PII and high-trust requirements?  
8. **Build Cost** – Minimal or zero recurring operational cost?  
9. **Simplicity of Explanation** – Can it be described in one sentence?  
10. **Probability of Paying Users** – Realistic chance that users will pay quickly?

Then classify the idea as:
- **Pursue:** strong across all core metrics.  
- **Prototype:** borderline but cheap to test.  
- **Discard:** doesn’t fit speed, cost, or trust profile.

## 7. Idea Generation Guidelines

When asked for new SaaS ideas, the AI assistant should:
- Suggest ideas for **niche B2B problems** that can be solved with automation or visualization.  
- Prioritize ideas that:  
  - Can be implemented with the given boilerplate.  
  - Provide instant value from the dashboard alone.  
  - Require no external data or sensitive info.  
  - Could earn $10–$100/month per user easily.  
  - Follow a **trustless, passwordless, push-first architecture** where possible.  
- Each idea output must include:  
  - One-sentence description.  
  - Target user / niche.  
  - Pain point solved.  
  - Core automation or logic.  
  - 2–3 MVP features.  
  - Monetization plan.  
  - Build time estimate.  

## 8. Core Attitude
Speed and simplicity are sacred.  
The boilerplate is the product factory.  
n8n is the engine.  
Ideas are the only scarce resource — treat them as experiments, not commitments.  
Ship fast, learn fast, move on.

## 9. Success Loop
1. Generate ideas with the AI assistant.  
2. Score them using Section 6.  
3. Pick one that hits ≥7 average.  
4. Build MVP within 48 hours.  
5. Launch publicly.  
6. Watch signups → double down or kill.  
7. Repeat.

This document defines the entire system the AI assistant must follow for ideation and evaluation.

## Appendix: Boilerplate File Structure Snapshot (February 2025)

This appendix preserves the full folder tree from the active RebuildWP boilerplate.  
Its purpose is to give future AI models concrete architectural context so they can generate correct scaffolding, avoid duplicating existing utilities, and integrate new SaaS features into the existing structure smoothly.

### Folder Tree Snapshot

```
Dockerfile
README.md
app
  api
    auth
      [...clerk].ts
    webhook
      stripe.ts
  components
    button.tsx
    card.tsx
    modal.tsx
  dashboard
    page.tsx
    settings.tsx
  layout.tsx
  page.tsx
  styles
    globals.css
  utils
    api.ts
    auth.ts
    stripe.ts
  hooks
    useUser.ts
  config
    index.ts
prisma
  schema.prisma
public
  favicon.ico
  robots.txt
  images
    logo.png
scripts
  deploy.sh
  migrate.sh
src
  lib
    db.ts
    mailer.ts
  pages
    _app.tsx
    index.tsx
    api
      hello.ts
      auth.ts
  styles
    tailwind.css
  components
    Header.tsx
    Footer.tsx
  types
    index.d.ts
tailwind.config.js
tsconfig.json
package.json
next.config.js
```
