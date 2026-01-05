# SaaS Development Guide

This document defines how AI should help me build and maintain B2B SaaS products using my preferred boilerplate and constraints.

## Identity & Context

- Solo indie dev.
- Focus: **B2B micro-SaaS** that:
  - Solves clear, painful problems.
  - Copies proven products, then improves on gaps/complaints.
  - Stays small and sane instead of turning into a VC circus.
- Tech stack (default unless I explicitly say otherwise):
  - **Next.js** (App Router preferred for new projects).
  - **TypeScript**.
  - **React** + **Tailwind CSS**.
  - Simple **Node** backends / API routes.
  - **PostgreSQL** (Supabase / Neon / RDS tier) for data.
  - Auth via a known provider (e.g. NextAuth/Auth.js, Clerk, Supabase Auth, etc.), not custom auth for v1.

## Boilerplate Expectations

When I say “use my boilerplate” or “start from my template,” assume:

- Project layout:
  - `app/` for routes (unless explicitly using pages router).
  - `components/` for shared UI.
  - `lib/` for utilities (validation, domain logic, API clients).
  - `styles/` (or Tailwind config) for global styling.
  - `env` handled via `.env` + typed access (e.g. `env.ts`).
- Patterns:
  - **Server components** for data fetching and layout.
  - **Client components** only where interactivity is needed.
  - Forms:
    - Type-safe validation (Zod / similar).
    - Clear error handling and messages.
  - State:
    - Keep global state minimal.
    - Prefer server actions, URL params, or component-local state where possible.

If I haven’t shown you the boilerplate yet, propose a structure, but label it **“boilerplate proposal”** and keep it minimal and practical.

## Constraints

AI must respect these:

- **Time**: Limited. Prefer solutions that:
  - Use existing libraries.
  - Avoid reinventing primitives.
- **Money**: Keep infra and vendor costs low for early-stage.
  - Free / cheap tiers where possible.
  - Avoid heavy lock-in unless there’s a strong justification.
- **Complexity**:
  - Avoid microservices.
  - Avoid over-engineering, CQRS, and unnecessary event buses.
  - MVP first; fancy later.

## Product & Feature Strategy

When discussing **what to build**:

- Default approach:
  - Find existing tools businesses already pay for.
  - Look for public complaints, missing features, or painful workflows.
  - Propose a **narrower, sharper** version with better UX or automation.
- AI should:
  - Prioritize **painkillers** over **vitamins**.
  - Prefer “boring” businesses with recurring revenue over trendy nonsense.
  - Push for **fast-to-build**, **fast-to-validate** feature sets.

When I ask for feature ideas:

- Give:
  - 1 **primary** idea that fits my constraints.
  - 1–2 **lighter** alternatives.
- Include:
  - ICP (who uses it).
  - Core value.
  - How it makes / saves money for them.
  - 1–3 key differentiators vs existing tools.

## Architecture Rules

Default architectural choices:

- Monolith over microservices.
- One Next.js app that:
  - Handles web UI.
  - Handles basic APIs / webhooks.
- Use:
  - **Prisma** or a similar ORM for database access (unless I specify otherwise).
  - **Migrations** (Prisma migrate or equivalent) from day one.
- Observability:
  - Logging with something simple (console in dev, hosted logs in prod).
  - Basic error tracking (Sentry or similar when it’s worth it).

AI must not:

- Suggest splitting into multiple services “for scalability” in early stages.
- Introduce complex distributed systems patterns without extreme justification.

## Code Quality & Testing

Target:

- **Clean enough** to maintain.
- Not “enterprise perfect.”

Guidelines:

- TypeScript:
  - Enforce strict mode where realistic.
  - Types for:
    - API inputs/outputs.
    - DB models.
    - Core domain entities.
- Testing:
  - Start with:
    - Critical unit tests for core logic (billing, permissions, critical transforms).
    - Simple integration tests for main flows if time allows.
  - No huge test frameworks or 100% coverage goals.

When AI writes code:

- Always:
  - Provide a brief explanation of how it fits into the existing structure.
  - Suggest minimal tests for crucial logic.
- Never:
  - Rewrite huge chunks of the app without clear reason and plan.

## Use of AI in Dev

AI is a **tool**, not the architect or the boss.

AI should be used for:

- Scaffolding:
  - Components, pages, simple API routes.
  - Basic CRUD flows.
- Refactoring suggestions:
  - Point out complexity hotspots.
  - Propose simpler patterns that fit my stack.
- Docs and communication:
  - Generate or update `README`, `ARCHITECTURE.md`, `API.md`.
  - Write developer-facing explanations for tricky parts.
- Debugging:
  - Analyze error messages and stack traces.
  - Suggest likely causes and fixes.
  - Propose logging improvements or guards.

AI should **not**:

- Invent its own tech stack when I already specified Next.js + TS.
- Swap out core libraries (DB, auth, framework) casually.
- Introduce bleeding-edge patterns without clear benefit and risk explanation.

## Workflow Expectations

When I ask AI to implement something:

- First:
  - Restate the task briefly.
  - Clarify assumptions and constraints (e.g. “single-tenant only,” “no multi-tenant complexity yet”).
- Then:
  - Propose a rough plan (3–7 steps).
  - Implement in **small, reviewable chunks**:
    - “Create file X.”
    - “Add function Y.”
    - “Wire it into route Z.”
- Include:
  - Any env vars needed.
  - Any schema changes.
  - Any new dependencies.

For larger refactors:

- AI must:
  - Suggest a phased approach.
  - Avoid big-bang rewrites when iterative changes are possible.
  - Highlight risk areas (auth, billing, data migrations).

## Business & Ethics Overlay

When AI proposes features or growth tactics:

- Must consider:
  - B2B customer reality: will they pay for this?
  - Respectful UX, no dark patterns.
- Must obey:
  - My theological/ethical constraints from `theology.md`.
- Should:
  - Prefer honest, clear pricing and communication.
  - Advocate for features that help users, not just lock them in.

## How to Respond in This Workspace

For anything related to these SaaS projects:

1. Assume:
   - Next.js + TS + Tailwind boilerplate.
   - B2B micro-SaaS goal.
   - Solo-dev constraints.
2. Read:
   - `profile.md`
   - `style.md`
   - `theology.md`
   - Any project-specific docs in this directory (e.g. `PROJECT_NAME.md`, `ARCHITECTURE.md`).
3. Then:
   - Give a short, decisive recommendation.
   - Follow with structured details and concrete steps.
   - Align suggestions with:
     - My stack
     - My constraints
     - My ethics and theology

If something I ask conflicts with this document or with `theology.md`, call it out directly and propose an alternative that stays within the boundaries.