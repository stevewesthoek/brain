# xgrow — X Growth Automation App

## Context
The user wants to automate posting 40-50 posts/day on X to grow their account. Rather than a simple scheduler, they want an AI-powered tool with 5 features: content inspiration, post remixing, quality scoring, auto-scheduling, and engagement discovery. Built as a Next.js web app with SaaS potential, using Claude API for AI and X API v2 for posting/reading.

## Stack
- **Framework**: Next.js 15 (App Router, TypeScript)
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: SQLite via Drizzle ORM (SaaS-migratable to Postgres)
- **AI**: Claude API (`@anthropic-ai/sdk`)
- **X API**: v2 with OAuth 2.0 PKCE
- **Scheduler**: node-cron + API route
- **Location**: `~/Repos/prochattools/saas/xgrow`

## Directory Structure
```
xgrow/
├── src/
│   ├── app/
│   │   ├── (auth)/login, callback
│   │   ├── (app)/dashboard, inspire, remix, banger, autopilot, engage, settings
│   │   └── api/auth, ai, x, queue, scheduler, analytics
│   ├── lib/
│   │   ├── db/          — schema.ts, index.ts (Drizzle + SQLite)
│   │   ├── services/    — ai.ts, x-api.ts, x-auth.ts, queue.ts, scheduler.ts
│   │   ├── prompts/     — inspire.ts, remix.ts, score.ts, engage.ts
│   │   └── auth/        — session.ts (cookie-based)
│   ├── components/      — ui/, layout/, post-editor, banger-score, post-card, etc.
│   └── types/
├── scripts/scheduler.ts  — standalone cron process
├── data/xgrow.db         — SQLite (gitignored)
└── .env.local
```

## Database Schema (6 tables)
- **users** — X auth tokens, profile, niche
- **drafts** — content, source (inspire/remix/manual), cached banger score
- **postQueue** — content, scheduledAt, status (pending/posting/posted/failed), xPostId
- **analyticsCache** — cached X post metrics (likes, retweets, replies, impressions)
- **engagementTopics** — keywords, accounts, hashtags to watch
- **engagementSuggestions** — AI-ranked posts to engage with + suggested replies
- **userSettings** — timezone, auto-schedule prefs, posts-per-day

## 5 Features

### 1. AI Inspiration (`/inspire`)
- Input: niche/topic + format (hot take, thread, question, story hook)
- Claude generates 5-10 post ideas
- Actions: Save as Draft, Add to Queue, Rewrite

### 2. Remix Best Posts (`/remix`)
- Fetch user's top posts from X API (sorted by engagement score)
- Claude generates variants: thread, hot take, follow-up, fresh angle
- Shows original metrics alongside remixes

### 3. Banger Detector (`/banger`)
- Paste draft, get 0-100 score with breakdown: hook, controversy, clarity, format, CTA
- Side-by-side compare mode (up to 3 drafts)
- Specific improvement suggestions

### 4. Best-Time Autopilot (`/autopilot`)
- Queue manager with manual or auto-scheduling
- Optimal times calculated from user's historical engagement data
- Standalone cron process posts at scheduled times
- Handles rate limits, retries, token refresh

### 5. Find Posts to Engage (`/engage`)
- Define topics/keywords/accounts to monitor
- X search API finds relevant conversations
- Claude ranks by relevance + suggests reply angles
- "Copy Reply" / "Post Reply" actions

## Implementation Order

### Phase 1: Foundation
1. Scaffold Next.js + Tailwind + shadcn/ui
2. Drizzle + SQLite setup with full schema
3. App shell with sidebar navigation
4. Environment config (.env.example)

### Phase 2: Auth
5. X OAuth 2.0 PKCE flow (x-auth.ts)
6. Cookie-based sessions
7. Auth API routes + login/callback pages
8. X API wrapper with auto token refresh

### Phase 3: AI Infrastructure
9. Claude service wrapper (ai.ts)
10. Prompt library (4 files)
11. Shared components (post-editor, post-card, draft-card)

### Phase 4: Feature 1 — AI Inspiration
12. `/inspire` page + `/api/ai/inspire`
13. Drafts CRUD

### Phase 5: Feature 3 — Banger Detector
14. `/banger` page + `/api/ai/score`
15. Banger score component (radial gauge)
16. Compare mode

### Phase 6: Feature 2 — Remix Best Posts
17. Timeline fetch + analytics cache
18. `/remix` page + `/api/ai/remix`

### Phase 7: Feature 4 — Best-Time Autopilot
19. Optimal time analysis from analytics data
20. Queue CRUD API + `/autopilot` page
21. Scheduler tick endpoint + standalone cron script
22. Dashboard integration

### Phase 8: Feature 5 — Find Posts to Engage
23. Engagement topics CRUD
24. X search integration
25. AI ranking + reply suggestions
26. `/engage` page

### Phase 9: Polish
27. Settings page, dashboard stats, loading states, error handling

## Key Architectural Decisions
- **SQLite** — zero server setup, SaaS-ready via Drizzle dialect swap to Postgres
- **Cookie sessions** — simpler than NextAuth for single-provider auth
- **Separate prompts/** — easy to iterate on prompt engineering without touching services
- **Dual scheduler** — standalone cron for local, API route for SaaS (shared service logic)
- **Token encryption** — access/refresh tokens encrypted at rest using SESSION_SECRET

## Verification
1. `npm run dev` — app starts, sidebar navigates between all pages
2. Login with X — OAuth flow completes, user stored in DB
3. `/inspire` — generate ideas, save as draft
4. `/banger` — score a draft, see breakdown
5. `/remix` — fetch top posts, generate variants
6. `/autopilot` — add to queue, scheduler posts at scheduled time
7. `/engage` — search results appear, reply suggestions generated
8. `npm run scheduler` — cron process posts pending queue items
