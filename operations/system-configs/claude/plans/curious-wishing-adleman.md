# `fala` — Full Implementation Plan
**Stack:** Next.js 14 + TypeScript + Tailwind + Prisma + Supabase + **Ory** + Dokploy

---

## Context

Building `fala` — a Portuguese learning SaaS for Steve (lives in Portugal, married to a Portuguese person, beginner with basics, 30-45 min/day). European Portuguese only. 3 methodologies: SRS, Comprehensible Input, Contextual Vocabulary. This is a SaaS-ready product under `prochattools/saas/fala` deployable on Dokploy at `fala.prochat.tools`.

---

## Architecture

```
~/Repos/prochattools/saas/fala/
├── src/
│   ├── app/
│   │   ├── (marketing)/           # Public landing page
│   │   │   ├── page.tsx           # Landing page
│   │   │   └── layout.tsx
│   │   ├── (app)/                 # Authenticated app
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   ├── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── deck/page.tsx      # SRS card review
│   │   │   ├── phrases/page.tsx   # Phrase pack browser
│   │   │   └── layout.tsx
│   │   └── api/
│   │       ├── deck/
│   │       │   ├── next/route.ts  # GET next card
│   │       │   └── review/route.ts # POST review
│   │       ├── progress/route.ts
│   │       └── webhooks/ory/route.ts  # Ory identity events (future)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── deck/                  # FlashCard, AudioButton, QualityButtons
│   │   ├── dashboard/             # StatsCard, Streak, DailySession
│   │   └── phrases/               # PhrasePack, PhraseCard
│   ├── lib/
│   │   ├── srs.ts                 # FSRS v4 algorithm
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── auth.ts                # Clerk helpers (getCurrentUser)
│   └── middleware.ts              # Clerk + route protection
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                    # Loads vocab_eu_pt.json to DB
├── data/
│   ├── vocab_eu_pt.json           # 500 EU PT words
│   ├── phrases_home.json          # 30 phrases
│   ├── phrases_work.json          # 30 phrases
│   ├── phrases_errands.json       # 30 phrases
│   └── phrases_social.json        # 30 phrases
├── public/audio/                  # Piper TTS generated .mp3 files (gitignored)
├── scripts/
│   ├── generate-audio.py          # Piper TTS batch generator
│   └── seed.sh                    # Run prisma db push + seed
├── DESIGN.md                      # From /design-system skill
├── Dockerfile                     # 4-stage node:20-bullseye (same as proofly)
├── nixpacks.toml                  # Dokploy build config
├── docker-compose.yml             # Local dev only
├── .env.example
└── package.json
```

---

## Database Schema (Prisma → Supabase)

Connection: `postgresql://fala_user:<pw>@100.71.31.88:5433/fala?schema=public`
*(Tailscale internal IP for Dokploy; external IP 68.221.194.245 for local dev)*

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  createdAt DateTime @default(now())
  cards     Card[]
  sessions  Session[]
}

model Word {
  id            Int      @id @default(autoincrement())
  portuguese    String
  english       String
  audioPath     String?  // e.g. /audio/word_42.mp3
  difficultyTag String   @default("A1")   // A1, A2, B1
  frequencyRank Int
  tags          String[] // home, work, errands, social, greeting, etc.
  cards         Card[]
}

model PhrasePack {
  id       String   @id @default(cuid())
  name     String   // "At Home", "Business", "Daily Errands", "Social"
  icon     String   // emoji
  phrases  Phrase[]
}

model Phrase {
  id          String     @id @default(cuid())
  portuguese  String
  english     String
  audioPath   String?
  packId      String
  pack        PhrasePack @relation(fields: [packId], references: [id])
}

model Card {
  id            String    @id @default(cuid())
  userId        String
  wordId        Int
  user          User      @relation(fields: [userId], references: [id])
  word          Word      @relation(fields: [wordId], references: [id])
  // FSRS state
  stability     Float     @default(0)
  difficulty    Float     @default(5)
  elapsedDays   Int       @default(0)
  scheduledDays Int       @default(0)
  reps          Int       @default(0)
  lapses        Int       @default(0)
  state         Int       @default(0) // 0=New, 1=Learning, 2=Review, 3=Relearning
  lastReview    DateTime?
  nextReview    DateTime  @default(now())
  reviews       Review[]
  @@unique([userId, wordId])
}

model Review {
  id          String   @id @default(cuid())
  cardId      String
  card        Card     @relation(fields: [cardId], references: [id])
  quality     Int      // 1=Again 2=Hard 3=Good 4=Easy
  durationMs  Int?
  reviewedAt  DateTime @default(now())
}

model Session {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  date          DateTime @default(now())
  cardsReviewed Int      @default(0)
  timeSpentMs   Int      @default(0)
  completed     Boolean  @default(false)
}
```

---

## Auth Architecture (Ory Kratos)

**Status:** ✅ Ory is production-ready (running at auth.prochat.tools on Dokploy Ops project)

Apps authenticate by:
1. User visits app → middleware checks `ory_kratos_session` cookie
2. No cookie → redirect to Ory login UI (`https://auth.prochat.tools/login`)
3. User enters email + password (or recovery email)
4. Ory authenticates and sets session cookie
5. App validates session via Ory Admin API (`getCurrentUser()`)
6. App creates/syncs User record in Prisma

**Key URLs:**
- **Public:** `https://auth.prochat.tools` (login, signup, recovery, verification)
- **Admin API:** `https://auth-admin.prochat.tools` (backend use only)
- **Health:** `https://auth.prochat.tools/health/ready`

**Ory Infrastructure:**
- Platform: Dokploy (Ops project, compose ID `DpMDhd91-YVUbHCxTD3Mx`)
- Image: `oryd/kratos:v1.3.1`
- Database: PostgreSQL `ory_prod` at `10.0.2.4:5433` (Supabase, isolated)
- Tunnel: Cloudflare `dc7bb87e` routes `auth.prochat.tools` → `localhost:80` → Traefik → Ory

**fala Project Provisioning:**
```bash
# Load credentials from brain
source ~/.config/ory/.env

# Create project
ory create project --name "fala"
# Output: Project created: <project-id>

# Save to .env.local
echo "ORY_PROJECT_ID=<project-id>" >> .env.local

# (Optional) Verify
ory list identities --project <project-id>
```

**Environment Variables for fala:**
```bash
# Public (shared by all Ory-using apps)
NEXT_PUBLIC_ORY_PUBLIC_URL=https://auth.prochat.tools

# Backend only
ORY_ADMIN_URL=https://auth-admin.prochat.tools
ORY_ADMIN_API_KEY=<from-~/.config/ory/.env>
ORY_PROJECT_ID=<from-ory-create-project>
```

**Webhook Configuration (Ory Dashboard):**
- URL: `https://fala.prochat.tools/api/webhooks/ory`
- Events: `identity.created`, `identity.updated`, `identity.deleted`
- Headers: `Authorization: Bearer <ORY_ADMIN_API_KEY>`

---

## Key Implementations

### 1. FSRS v4 Algorithm (`src/lib/srs.ts`)

Implements FSRS v4 (open-spaced-repetition/fsrs.js converted to TypeScript):
- `getNextCard(userId)` — fetches card with lowest `nextReview` that is due
- `reviewCard(cardId, quality)` — runs FSRS calculation, returns new scheduling state
- Core formula: stability × ease × (1 + randomFuzz) = next interval
- Target retention: 90%
- Quality scale: 1=Again (relearn), 2=Hard, 3=Good, 4=Easy

### 2. Ory Authentication Middleware

Ory session validation in middleware + API routes:
- `src/middleware.ts`: Check Ory session from cookie → if invalid, redirect to Ory login
- `src/lib/auth.ts`: `getCurrentUser()` fetches session from Ory Admin API, syncs to Prisma
- `src/app/api/webhooks/ory/route.ts`: (future) Listen for Ory identity events (create/delete)
- Public routes: `/`, `/api/health`, Ory callback routes
- Protected routes: `/dashboard`, `/deck`, `/phrases`, `/api/deck/*`, `/api/progress/*`

### 3. Piper TTS Audio

- Script: `scripts/generate-audio.py`
- Runs: `piper --model pt_PT-... --output_file audio/word_{id}.mp3 --text "{word}"`
- European Portuguese model: `pt_PT-tugão-medium` (free, official Piper model)
- Output: `public/audio/*.mp3` (gitignored, regenerated post-deploy via CLI)
- Triggered with: `python scripts/generate-audio.py`

---

## Environment Variables (.env.example)

```bash
# Database (Supabase self-hosted)
DATABASE_URL="postgresql://fala_user:<password>@100.71.31.88:5433/fala?schema=public"

# Ory Authentication (self-hosted at auth.prochat.tools)
NEXT_PUBLIC_ORY_PUBLIC_URL=https://auth.prochat.tools
ORY_ADMIN_URL=https://auth-admin.prochat.tools
ORY_ADMIN_API_KEY=<from-credentials>
ORY_PROJECT_ID=<from-ory-provisioning>

# App
NEXT_PUBLIC_APP_URL=https://fala.prochat.tools
NODE_ENV=production
```

---

## Deployment Sequence

### 1. Cloudflare DNS
```bash
# Add CNAME record: fala.prochat.tools → dc7bb87e.cfargotunnel.com
cloudflare dns create --zone prochat.tools --type CNAME \
  --name fala --content dc7bb87e.cfargotunnel.com --proxied
```

### 2. Dokploy Tunnel Entry
Tunnel ID: `dc7bb87e`. Add to ingress config:
```json
{
  "hostname": "fala.prochat.tools",
  "service": "http://localhost:3050",
  "originRequest": { "httpHostHeader": "fala.prochat.tools" }
}
```
Port confirmed: **3050** (first stable app port per local port registry).

### 3. Supabase Database Setup
Supabase VM: `100.71.31.88` (Tailscale), port `5433`.
```bash
# SSH into supabase VM and create DB + user
ssh supabase
psql -U postgres -p 5433 -c "CREATE DATABASE fala;"
psql -U postgres -p 5433 -c "CREATE USER fala_user WITH PASSWORD '<pw>';"
psql -U postgres -p 5433 -c "GRANT ALL PRIVILEGES ON DATABASE fala TO fala_user;"
```
DATABASE_URL for Dokploy: `postgresql://fala_user:<pw>@100.71.31.88:5433/fala?schema=public`
DATABASE_URL for local dev: `postgresql://fala_user:<pw>@68.221.194.245:5433/fala?schema=public`

### 4. Dokploy App Config
- Source: GitHub `prochattools/fala` (main branch)
- Build: nixpacks (uses nixpacks.toml)
- Port: 3050
- Public hostname: fala.prochat.tools
- Env vars: Set all from .env.example

### 5. Audio Generation (post-deploy)
```bash
# SSH/Dokploy CLI into running container
python scripts/generate-audio.py
```

---

## Build Sequence (Ordered)

1. `[SETUP]` Create repo at ~/Repos/prochattools/saas/fala
2. `[SETUP]` Bootstrap Next.js + dependencies (copy key packages from proofly)
3. `[DESIGN]` Run `/design-system` skill → generates DESIGN.md
4. `[DATA]` Create `data/vocab_eu_pt.json` (500 EU PT words)
5. `[DATA]` Create 4 phrase pack JSON files (30 phrases each)
6. `[DATA]` Create `data/content_feed.json` (20 curated EU PT sources)
7. `[DB]` Write Prisma schema
8. `[DB]` Create Supabase database + run `prisma db push` + seed
9. `[BACKEND]` Implement FSRS algorithm in `src/lib/srs.ts`
10. `[BACKEND]` Build API routes: deck/next, deck/review, progress, webhooks/clerk
11. `[FRONTEND]` Landing page (from DESIGN.md)
12. `[FRONTEND]` Sign-in / Sign-up pages (Clerk components)
13. `[FRONTEND]` Dashboard page (stats + streak + today's content)
14. `[FRONTEND]` Deck page (card review + audio + quality buttons)
15. `[FRONTEND]` Phrases page (4 packs, phrase cards, audio)
16. `[AUDIO]` Install Piper TTS, download pt_PT model, run generate-audio.py
17. `[DEPLOY]` Add Cloudflare DNS entry for fala.prochat.tools
18. `[DEPLOY]` Configure Dokploy app + tunnel + env vars
19. `[DEPLOY]` Deploy, run migrations, generate audio, verify at fala.prochat.tools

---

## Critical Files to Create (in order)

| File | Purpose | Priority |
|------|---------|----------|
| `data/vocab_eu_pt.json` | Core vocabulary dataset | Critical |
| `prisma/schema.prisma` | Database schema | Critical |
| `src/lib/srs.ts` | FSRS algorithm | Critical |
| `src/app/api/deck/next/route.ts` | Get next card | Critical |
| `src/app/api/deck/review/route.ts` | Submit review | Critical |
| `src/app/(app)/deck/page.tsx` | Card review UI | Critical |
| `src/app/(marketing)/page.tsx` | Landing page | Important |
| `src/app/(app)/dashboard/page.tsx` | Progress dashboard | Important |
| `DESIGN.md` | Design system reference | Before UI work |
| `scripts/generate-audio.py` | Piper TTS audio | Important |
| `Dockerfile` | Dokploy deploy | Deployment |
| `nixpacks.toml` | Dokploy build | Deployment |

---

## Local Port Registry (to add to infra.md)

| Port | Service | Process | Notes |
|------|---------|---------|-------|
| 3000 | ⚠️ xGrow (CONFLICT) | Next.js | Needs to move — default dev port clashes. Move to 3055 in a separate session. |
| 3002 | Firecrawl API | Docker on Dokploy | Tailscale-private: `http://100.83.38.48:3002` |
| 3050 | fala | Next.js | `fala.prochat.tools` — first registered stable app port |
| 7070 | ProBot | Node.js daemon | Dashboard at `localhost:7070` |

## Design Spec

Aesthetic: Clean & minimal — Linear / Vercel style.
Accent color: Portuguese-inspired warm clay (#C0392B) or deep atlantic blue (#1A3C5E).
Typography: Geist (Next.js default, free).
Tone: Focused, confident — "Here's exactly what to do today."
Generate DESIGN.md via /design-system before any UI work.
