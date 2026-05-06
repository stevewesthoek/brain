# HISTORICAL: Family Finance App (finance.prochat.tools)

## Status

**⚠️ THIS PLAN IS OBSOLETE.** 

Family Finance is now **local-only** and will not be deployed to Dokploy, Supabase production, or finance.prochat.tools. The production deployment plan documented here is historical reference only.

### Current Active State

- **Runtime**: Local-only Next.js + OrbStack Postgres
- **Database**: `family_finance` on `localhost:5452` (Brain-managed standalone)
- **URL**: `http://localhost:3000` (development only)
- **Auth**: Simple shared household password gate (replacing Ory)
- **Deployment**: Not deployed. No public domain.
- **Dokploy**: No Family Finance app.
- **Supabase production**: No Family Finance project.
- **Ory**: Will be removed as part of auth simplification.

See [`~/Repos/stevewesthoek/family-finance/docs/`](../../family-finance/docs/) for current architecture and [`brain/operations/database/standalone/familyfinance/`](../../operations/database/standalone/familyfinance/) for the canonical local database.

---

## Historical Context (Do Not Use)

# Plan: Family Finance App (finance.prochat.tools)

## Context

Steve needs a standalone family finance application for tracking income, expenses, and account balances across multiple bank accounts (bunq/Dutch, wife's manual accounts). Accessible at `finance.prochat.tools`, deployed on Dokploy, used by both Steve and his wife (full transparency). Iterative launch — MVP first, bunq API in Phase 2.

**Auth change:** Clerk replaced by Ory Kratos (already live at `auth.prochat.tools`). This is the primary auth platform for the prochat.tools infrastructure. No Clerk dependency.

---

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind v3 + shadcn/ui
- **Auth**: Ory Kratos v1.3.1 — self-hosted at `https://auth.prochat.tools`
- **Database**: Prisma 6 → Self-hosted Supabase Postgres (port 5433 on Dokploy)
- **Charts**: recharts
- **Deploy**: Dockerfile (Node 18 Bullseye, 4-stage), Dokploy, `finance.prochat.tools`
- **Boilerplate source**: `prokit-dev` (`/Users/Office/Repos/prochattools/boilerplates/products/prokit-dev/`)

Removed from boilerplate: Stripe, Resend, Clerk, subscription model.
Added: Finance schema, recharts, react-hook-form, date-fns, `@ory/client`.

---

## Repository

`~/Repos/stevewesthoek/family-finance/` → GitHub: `stevewesthoek/family-finance`

---

## Ory Auth Architecture

Ory Kratos is already deployed and live. No new infra needed.

```
finance.prochat.tools (Next.js app)
  ↓ middleware session check
auth.prochat.tools (Ory Kratos v1.3.1, port 4433)
  ↓ session cookie set on .prochat.tools domain
finance.prochat.tools (cookie automatically valid here)
```

**Key facts:**
- CORS in `kratos.yml` already allows `https://*.prochat.tools`
- Session cookie domain is `prochat.tools` → valid at `finance.prochat.tools` automatically
- Only 2 users (Steve + wife) — create via CLI, no registration page needed
- Ory config `login.ui_url` currently points to `https://prochat.tools/auth/login` (doesn't exist yet) → must update to `https://finance.prochat.tools/auth/login`

### Ory config update required

Update the `login.ui_url` in `kratos.yml` (in the `ory-config` Docker volume) to:
```yaml
selfservice:
  flows:
    login:
      ui_url: https://finance.prochat.tools/auth/login
```

Done via:
```bash
# SSH into Dokploy server, update ory-config volume
docker run --rm -v ory-config:/etc/config/kratos alpine \
  sed -i 's|https://prochat.tools/auth/login|https://finance.prochat.tools/auth/login|' \
  /etc/config/kratos/kratos.yml
docker restart ory-kratos
```

### Auth library (`lib/ory.ts`)

```typescript
import { Configuration, FrontendApi } from '@ory/client'

export const ory = new FrontendApi(
  new Configuration({
    basePath: process.env.NEXT_PUBLIC_ORY_PUBLIC_URL || 'https://auth.prochat.tools',
    baseOptions: { withCredentials: true },
  })
)

export async function getOrySession(cookie?: string) {
  try {
    const { data } = await ory.toSession({ cookie })
    return data
  } catch {
    return null
  }
}
```

### Middleware (`src/middleware.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Configuration, FrontendApi } from '@ory/client'

const ory = new FrontendApi(new Configuration({
  basePath: process.env.NEXT_PUBLIC_ORY_PUBLIC_URL || 'https://auth.prochat.tools',
}))

const publicPaths = ['/auth/login', '/auth/error', '/api/health']

export async function middleware(req: NextRequest) {
  const isPublic = publicPaths.some(p => req.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  try {
    await ory.toSession({ cookie: req.headers.get('cookie') ?? undefined })
    return NextResponse.next()
  } catch {
    const url = new URL('/auth/login', req.url)
    url.searchParams.set('return_to', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api)(.*)'],
}
```

### Login page (`app/(auth)/auth/login/page.tsx`)

Custom UI using Ory's self-service browser flow:
1. Client component hits `ory.createBrowserLoginFlow()` (or reads `flowId` from URL if redirected by Ory)
2. Renders form from flow's `ui.nodes` (email, password fields)
3. On submit, calls `ory.updateLoginFlow()` with credentials
4. On success, Ory sets session cookie on `.prochat.tools` domain → middleware passes on next request
5. Redirect to `return_to` param (or `/dashboard`)

No Clerk wrappers, no provider. All auth state comes from `ory.toSession()`.

### User management (CLI)

```bash
source ~/.config/ory/.env

# Create Steve
ory create identity --project $ORY_PROJECT_ID \
  --schema-id default \
  --trait email=steve@prochat.tools \
  --trait name.first="Steve"

# Create wife
ory create identity --project $ORY_PROJECT_ID \
  --schema-id default \
  --trait email=wife@prochat.tools \
  --trait name.first="<wife's name>"
```

---

## Database Schema (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // postgres://postgres:<pass>@10.0.2.4:5433/finance
}

model Account {
  id              String      @id @default(cuid())
  name            String
  type            AccountType
  institution     String?         // "bunq", "ABN AMRO", "Cash", etc.
  currency        String      @default("EUR")
  isManual        Boolean     @default(true)
  externalId      String?         // bank's account ID
  balanceSnapshot Decimal?    @db.Decimal(12,2)
  lastSynced      DateTime?
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  transactions    Transaction[]
  syncLogs        AccountSyncLog[]
}

enum AccountType { BANK SAVINGS JOINT CREDIT_CARD CASH INVESTMENT OTHER }

model Transaction {
  id               String     @id @default(cuid())
  accountId        String
  date             DateTime
  amount           Decimal    @db.Decimal(12,2)  // negative = expense, positive = income
  currency         String     @default("EUR")
  description      String
  merchant         String?
  categoryId       String?
  externalId       String?    // bank's tx ID — prevents duplicate imports
  isManual         Boolean    @default(false)
  createdByOryId   String?    // Ory identity ID (replaces Clerk user ID)
  notes            String?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  account          Account    @relation(fields: [accountId], references: [id])
  category         Category?  @relation(fields: [categoryId], references: [id])
  @@unique([accountId, externalId])
}

model Category {
  id           String         @id @default(cuid())
  name         String
  icon         String?
  color        String?
  type         CategoryType
  isSystem     Boolean        @default(false)
  parentId     String?
  parent       Category?      @relation("CategoryTree", fields: [parentId], references: [id])
  children     Category[]     @relation("CategoryTree")
  transactions Transaction[]
  recurring    RecurringPayment[]
}

enum CategoryType { INCOME EXPENSE TRANSFER }

model RecurringPayment {
  id              String              @id @default(cuid())
  name            String
  expectedAmount  Decimal             @db.Decimal(12,2)
  categoryId      String?
  frequency       RecurringFrequency
  lastOccurrence  DateTime?
  nextOccurrence  DateTime?
  confidenceScore Float               @default(0)
  isConfirmed     Boolean             @default(false)
  category        Category?           @relation(fields: [categoryId], references: [id])
}

enum RecurringFrequency { DAILY WEEKLY BIWEEKLY MONTHLY QUARTERLY YEARLY }

model AccountSyncLog {
  id               String     @id @default(cuid())
  accountId        String
  status           SyncStatus
  syncedAt         DateTime   @default(now())
  transactionCount Int        @default(0)
  errorMessage     String?
  account          Account    @relation(fields: [accountId], references: [id])
}

enum SyncStatus { SUCCESS FAILED PARTIAL }

// Phase 2: bunq OAuth token storage
model BunqConnection {
  id           String    @id @default(cuid())
  oryIdentityId String   @unique   // Ory identity ID (not Clerk)
  accessToken  String    // AES-256 encrypted
  expiresAt    DateTime?
  bunqUserId   String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

---

## App Structure

```
src/
├── app/
│   ├── (app)/                      # Protected routes (Ory session required)
│   │   ├── layout.tsx              # Sidebar + header shell
│   │   ├── dashboard/page.tsx
│   │   ├── accounts/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/page.tsx
│   ├── (auth)/
│   │   ├── auth/login/page.tsx     # Custom Ory login UI (client component)
│   │   └── auth/error/page.tsx     # Ory error display
│   ├── api/
│   │   ├── accounts/route.ts
│   │   ├── accounts/[id]/route.ts
│   │   ├── transactions/route.ts
│   │   ├── transactions/[id]/route.ts
│   │   ├── categories/route.ts
│   │   ├── analytics/route.ts
│   │   └── health/route.ts
│   └── layout.tsx                  # Root layout (no ClerkProvider — not needed)
├── components/
│   ├── ui/                         # shadcn components
│   ├── layout/                     # Sidebar, Header, MobileNav
│   ├── dashboard/                  # NetWorthCard, MonthSummary, AccountCards, RecentTransactions, CategoryPie
│   ├── transactions/               # TransactionTable, TransactionForm, CategorySelect, QuickAddFAB
│   └── analytics/                  # IncomeExpenseChart, CategoryBreakdown, RecurringList, TrendLine
├── lib/
│   ├── prisma.ts
│   ├── ory.ts                      # Ory client singleton + getOrySession()
│   ├── categories.ts               # System category seed
│   ├── recurring.ts                # Recurring payment detection
│   └── format.ts                   # Currency + date helpers
└── middleware.ts                   # Ory session validation (replaces Clerk middleware)
```

---

## Environment Variables (`.env.example`)

```bash
# Database (Supabase self-hosted Postgres — note: postgres:// not postgresql://)
DATABASE_URL=postgres://postgres:<pass>@10.0.2.4:5433/finance

# Ory (no Clerk keys needed)
NEXT_PUBLIC_ORY_PUBLIC_URL=https://auth.prochat.tools
ORY_ADMIN_URL=https://auth-admin.prochat.tools
ORY_ADMIN_API_KEY=<from ~/.config/ory/.env>

# App
NEXT_PUBLIC_APP_URL=https://finance.prochat.tools

# Phase 2: bunq
BUNQ_API_KEY=
BUNQ_OAUTH_CLIENT_ID=
BUNQ_OAUTH_CLIENT_SECRET=
BUNQ_WEBHOOK_SECRET=
```

---

## Dockerfile

Node 18 Bullseye, 4-stage (identical to prokit-dev pattern).  
Build: `npx prisma generate && npx prisma migrate deploy && next build`  
Expose 3000, health check at `/api/health`.

---

## Phase 1 MVP — Deliverables

- [ ] Repo scaffolded from prokit-dev (Stripe, Resend, Clerk stripped)
- [ ] Ory auth integration (`lib/ory.ts`, `middleware.ts`, `/auth/login` page)
- [ ] Ory config updated: `login.ui_url` → `finance.prochat.tools/auth/login`
- [ ] Two Ory users created via CLI (Steve + wife)
- [ ] Finance Prisma schema + first migration
- [ ] System category seed script (22 default categories)
- [ ] Dashboard page (net worth, monthly summary, account cards, recent txns, category pie)
- [ ] Transactions page (table + filters + FAB manual entry form)
- [ ] Accounts page (list + add/edit)
- [ ] Analytics page (12-month bar chart, category breakdown)
- [ ] Responsive design (desktop sidebar, mobile bottom nav + FAB)
- [ ] Dockerfile + Dokploy deploy
- [ ] DNS A record → `finance.prochat.tools` live

## Phase 2 — bunq API Integration

- `lib/bunq/client.ts`: thin HTTP client with RSA-signed requests (no official JS SDK)
- OAuth 2.0 flow (`/api/bunq/connect` + `/api/bunq/callback`)
- Account sync — paginated payments, deduplication via `externalId`
- Webhook handler (`/api/bunq/webhook`) — real-time transaction push
- `BunqConnection` stores Ory identity ID (not Clerk user ID)
- Sandbox testing first (bunq `sandbox-user-person` endpoint)

---

## Verification

1. Local: `npm run dev` → `/auth/login` renders Ory flow → sign in → dashboard loads with correct session
2. Accounts: Create 3 accounts → balances show in net worth card
3. Transactions: Add manual txn via FAB → appears in list → category assigned
4. Analytics: Add txns across 3+ months → bar chart renders correctly
5. Recurring: Add 3+ same-merchant/same-amount txns 30 days apart → recurring detection fires
6. Mobile: open on iPhone → FAB opens drawer → manual entry form works with touch keyboard
7. Deploy: push to main → Dokploy builds → health check passes → `finance.prochat.tools` loads → Ory login works
