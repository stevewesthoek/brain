# Plan: Family Finance App (finance.prochat.tools)

## Context

Steve needs a standalone family finance application for tracking income, expenses, and account balances across multiple bank accounts (bunq/Dutch, wife's manual accounts). The app will be accessible at `finance.prochat.tools`, deployed on Dokploy, and used by both Steve and his wife (full transparency, shared view). This is an iterative launch — MVP first, bunq API in Phase 2.

---

## Stack (matches existing ProChat conventions)

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind v3 + shadcn/ui
- **Auth**: Clerk 5 with the canonical mock/real toggle pattern (from prokit-dev)
- **Database**: Prisma 6 → Self-hosted Supabase Postgres (port 5433 on Dokploy)
- **Charts**: recharts (React-native, lightweight)
- **Deploy**: Dockerfile (Node 18 Bullseye, 4-stage), Dokploy, `finance.prochat.tools`
- **Boilerplate source**: `/Users/Office/Repos/prochattools/boilerplates/products/prokit-dev/`

Removed from boilerplate: Stripe, Resend, subscription model.
Added: Finance schema, recharts, react-hook-form, date-fns.

---

## Repository

`~/Repos/stevewesthoek/family-finance/` → GitHub: `stevewesthoek/family-finance`

---

## Database Schema (`prisma/schema.prisma`)

```prisma
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
  amount           Decimal    @db.Decimal(12,2)   // negative = expense, positive = income
  currency         String     @default("EUR")
  description      String
  merchant         String?
  categoryId       String?
  externalId       String?    // bank's tx ID (prevents duplicate imports)
  isManual         Boolean    @default(false)
  createdByClerkId String?
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
  icon         String?        // emoji
  color        String?        // hex
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
  clerkUserId  String    @unique
  accessToken  String    // AES-256 encrypted at rest
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
│   ├── (app)/                      # Protected routes (Clerk)
│   │   ├── layout.tsx              # Sidebar + header shell
│   │   ├── dashboard/page.tsx      # Main overview
│   │   ├── accounts/
│   │   │   ├── page.tsx            # Account list
│   │   │   └── [id]/page.tsx       # Account detail + txns
│   │   ├── transactions/page.tsx   # All transactions + filter
│   │   ├── analytics/page.tsx      # Charts + trends
│   │   └── settings/page.tsx       # Categories + connections
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── api/
│   │   ├── accounts/route.ts       # GET list, POST create
│   │   ├── accounts/[id]/route.ts  # GET, PUT, DELETE
│   │   ├── transactions/route.ts   # GET (filtered), POST
│   │   ├── transactions/[id]/route.ts
│   │   ├── categories/route.ts
│   │   ├── analytics/route.ts      # Monthly summaries, trends
│   │   └── health/route.ts
│   └── layout.tsx                  # Root + SafeClerkProvider
├── components/
│   ├── ui/                         # shadcn: card, button, input, select, table, dialog, badge, sheet, tabs
│   ├── layout/                     # Sidebar, Header, MobileNav
│   ├── dashboard/                  # NetWorthCard, MonthSummary, AccountList, RecentTransactions, CategoryPie
│   ├── transactions/               # TransactionTable, TransactionForm, CategorySelect, QuickAddFAB
│   └── analytics/                  # IncomeExpenseChart, CategoryBreakdown, RecurringList, TrendLine
├── lib/
│   ├── prisma.ts                   # Singleton PrismaClient
│   ├── categories.ts               # System category seed (12 defaults)
│   ├── recurring.ts                # Detection algorithm (±5% amount, 28-31 day window)
│   └── format.ts                   # Currency formatting, date helpers
└── libs/                           # Copied from prokit-dev:
    ├── clerkFlags.ts
    ├── safeClerk.tsx
    ├── safeClerkServer.ts
    └── middleware.ts (at src/middleware.ts)
```

---

## Key Pages & Components

### Dashboard
- **NetWorthCard**: Sum of all account balance snapshots
- **MonthSummary**: Current month income (positive txns) vs expenses (negative txns), savings rate %
- **AccountCards**: Grid showing each account, current balance, last synced badge
- **CategoryPie**: Recharts PieChart of top categories this month
- **RecentTransactions**: Last 10 txns, click to categorize

### Transactions Page
- Filter bar: date range picker, account dropdown, category dropdown, search input
- Table: date | merchant | description | amount (colored ±) | category badge | notes
- Mobile: card list (not table) for touch-friendly scrolling
- FAB (floating action button): QuickAddFAB — opens Sheet/Drawer for fast manual entry

### Manual Entry Form (mobile-optimized)
```
Date (default: today)
Amount (numeric keyboard trigger on mobile)
Income / Expense toggle
Description
Merchant (optional)
Account selector
Category selector (with smart suggestions)
Notes (optional)
```
Uses `react-hook-form` + controlled inputs. Works one-handed on iPhone.

### Analytics Page
- **IncomeExpenseChart**: Recharts BarChart, 12 months, grouped (income blue, expense red)
- **TrendLine**: Net savings per month line chart
- **CategoryBreakdown**: Pie + ranked list with amounts
- **RecurringTable**: Detected recurring payments, confirm/dismiss UI

---

## Default Categories (seeded on first run)

**Income**: Salary, Freelance, Investment Returns, Bonuses, Other Income
**Living**: Rent/Mortgage, Utilities, Groceries, Household
**Transport**: Fuel, Car Insurance, Public Transit
**Health**: Medical, Pharmacy, Fitness
**Family**: Childcare, Education, Gifts
**Entertainment**: Dining Out, Subscriptions, Hobbies
**Shopping**: Clothing, Electronics, General
**Financial**: Loan Payments, Bank Fees, Savings Transfer

---

## Recurring Payment Detection Algorithm (`lib/recurring.ts`)

On every transaction import batch:
1. For each unique merchant, group transactions by amount (±5% tolerance)
2. Check date gaps — if consistently 28-35 days (monthly) or 6-8 days (weekly)
3. Score: 3+ occurrences = high confidence (>0.8), 2 occurrences = medium (0.5)
4. Write to `RecurringPayment` table; user confirms or dismisses in Analytics UI

---

## Environment Variables (`.env.example`)

```
# Database
DATABASE_URL=postgresql://postgres:<pass>@<supabase-host>:5433/finance

# Clerk
NEXT_PUBLIC_CLERK_DISABLED=false
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# App
NEXT_PUBLIC_APP_URL=https://finance.prochat.tools

# Phase 2: bunq
BUNQ_API_KEY=                   # personal API key for own bunq account
BUNQ_OAUTH_CLIENT_ID=           # for OAuth (wife's account connection)
BUNQ_OAUTH_CLIENT_SECRET=
BUNQ_WEBHOOK_SECRET=
```

---

## Dockerfile

Identical pattern to prokit-dev — Node 18 Bullseye, 4-stage, exposes 3000, health check at `/api/health`. Build step runs `prisma generate && npx prisma migrate deploy && next build`.

---

## Deployment Checklist (Dokploy)

1. Create Dokploy app `family-finance`
2. Set env vars (DATABASE_URL pointing to self-hosted Supabase Postgres)
3. Add domain `finance.prochat.tools` → Cloudflare DNS A record
4. Push to `main` → Dokploy builds Docker image → deploys
5. Run database seed for system categories on first boot

---

## Phase 1 MVP — Deliverables

- [ ] Repo scaffolded from prokit-dev (Stripe/Resend stripped)
- [ ] Finance Prisma schema + migration
- [ ] System category seed script
- [ ] Dashboard page (net worth, monthly summary, account cards, recent txns)
- [ ] Transactions page (table + filters + FAB manual entry form)
- [ ] Accounts page (list + add/edit account)
- [ ] Analytics page (bar chart, category pie)
- [ ] Responsive design (desktop sidebar, mobile bottom nav + FAB)
- [ ] Dockerfile + Dokploy deploy config
- [ ] DNS + domain live at `finance.prochat.tools`

## Phase 2 — bunq API Integration

- `lib/bunq/client.ts`: thin HTTP client with RSA-signed requests
- OAuth 2.0 flow (`/api/bunq/connect` + `/api/bunq/callback`)
- Account sync (`/api/bunq/sync`) — fetches paginated payments, deduplicates via `externalId`
- Webhook handler (`/api/bunq/webhook`) — real-time transaction push
- `BunqConnection` table for token storage (access token encrypted with AES-256)
- Sandbox testing first (bunq provides `sandbox-user-person` endpoint)

---

## Verification

1. Local: `npm run dev` → sign in with Clerk → create accounts → add manual transactions → verify dashboard math
2. Analytics: add 3+ identical-amount transactions 30 days apart → verify recurring detection fires
3. Mobile: open on iPhone → add transaction via FAB → verify form is touch-friendly
4. Deploy: push to main → Dokploy builds → health check passes → `finance.prochat.tools` loads
