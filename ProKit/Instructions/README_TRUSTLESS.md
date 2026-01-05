# 🚀 ProChat Trustless Module — Optional Technical Launch Blueprint

**Stack:** Next.js 14 + TypeScript + Prisma + Supabase (Postgres) + Clerk + Stripe + Resend + n8n + Web Push  
**Architecture:** Trustless, passwordless, push-first SaaS engine

---

## 🧠 Overview
This document describes the optional **Trustless Module** for the ProChat SaaS Boilerplate.  
It is *not required* for standard apps. Enable it only if you want passwordless public access, magic-link flows, or push-first trustless architectures.

> ⚠️ Optional Feature  
> This Trustless Module is not part of the default app flow.  
> It is a plug-in pattern that can be activated when building apps that require:  
> - magic links  
> - public access tokens  
> - passwordless sharing  
> - event-based push notifications  
> - trust-minimized user interactions

This module can be applied to any app that requires public sharing links, trust-minimized interactions, or passwordless flows.  
It provides a reference implementation for:
- public magic links
- private deeplinks for authenticated actions
- optional QR code sharing
- optional push and email notifications
- event-based updates via webhooks or automation platforms

---

## ⚙️ Project Setup

### 1. Clone
```bash
git clone git@github.com:yourusername/yourrepo.git
cd <yourapp>
```

### 2. Install
```bash
npm install
```

### 3. Environment Variables
Create `.env` in the root with:

```bash
# --- Next.js ---
NEXT_PUBLIC_APP_URL=https://<yourapp>.domain
NODE_ENV=production

# --- Clerk Auth ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXX
CLERK_SECRET_KEY=sk_test_XXXXXXXX

# --- Database (Supabase/Postgres) ---
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# --- Stripe ---
STRIPE_SECRET_KEY=sk_live_XXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXX

# --- Resend (emails) ---
RESEND_API_KEY=re_XXXXXXX

# --- JWT ---
LINK_JWT_SECRET=super-secret-jwt-key

# --- Web Push ---
VAPID_PUBLIC_KEY=BNxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxx
VAPID_SUBJECT="mailto:support@<yourapp>.prochat.tools"

# --- n8n Integration ---
N8N_WEBHOOK_URL=https://n8n.prochat.tools/webhook/<yourapp>
N8N_API_KEY=xxxxxx
```

> ⚠️ Keep all secrets out of version control.  
> Use environment variables in Vercel / Railway / Supabase.

---

### 4. Database Migration
```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. Run locally
```bash
npm run dev
```
→ Visit [http://localhost:3000](http://localhost:3000)

---

## 📁 Folder Structure

```
/app
  /dashboard             -> Optional internal dashboard (Clerk-protected)
  /d/[id]                -> Private deeplink editor
  /l/[token]             -> Public magic link page
  /api                   -> REST endpoints
/public
  /sw.js                 -> Service worker for push
/prisma
  schema.prisma
/lib
  db.ts                  -> Prisma client
  jwt.ts                 -> Sign/verify JWTs
  guards.ts              -> Clerk user checks
  progress.ts            -> Progress/ETA utils
```

---

## 🧱 API Overview

| Route | Description |
|-------|-------------|
| POST /api/resource/create | Create a new trustless resource with magic/deeplink |
| POST /api/resource/update | Authenticated update endpoint for private users |
| POST /api/events | Log public or private events |
| POST /api/push/subscribe | Store web-push subscriptions |
| POST /api/push/send | Send notifications to subscribers |
| GET /api/resource/stale | Optional endpoint for automation workflows |

---

## 🔔 Web Push Setup

1. Generate VAPID keys once:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Add the keys to `.env`.  
3. Confirm `sw.js` is served from `/public`.  
4. Test in Chrome or Edge (mobile or desktop).  

---

## 🤖 n8n Workflows

### A. Event Router
Trigger: **Webhook**

Use this workflow to route incoming public or private events. Typical actions:
- Send push notifications
- Log analytics
- Trigger email sequences

### B. Periodic Digest
Trigger: **Cron**

Use this to send periodic digests or reminders to resource owners.

### C. Stale Reminder
Trigger: **Cron**

Detect inactive or stale resources and notify owners or subscribers.

---

## 📦 Deployment Checklist

| Item | Done |
|------|------|
| ✅  Environment variables set in Vercel or Railway |
| ✅  Database migrated and verified |
| ✅  Clerk domain configured |
| ✅  Stripe products configured (if billing is enabled) |
| ✅  Resend verified sending domain |
| ✅  VAPID keys generated & configured |
| ✅  n8n webhook URL reachable |
| ✅  PWA / service worker active on mobile |

---

## 🔍 Testing Scenarios

1. Create a new trustless resource → confirms public and private links work.
2. Visit the public link → verify content visibility.
3. Test push subscription & send a push event.
4. Modify the resource via private link → confirm propagation.
5. Test automation integrations (cron, digests, reminders).

---

## 🧾 Versioning & Maintenance

| Component | Update Command |
|------------|----------------|
| Prisma schema | `npx prisma migrate dev` |
| Clerk | managed on [dashboard.clerk.com](https://dashboard.clerk.com) |
| Stripe | via dashboard |
| n8n flows | export/import JSON via UI |
| Dependencies | `npm update` |

---

## 🧩 ProChat Trustless Module — Integration Rules

These rules ensure Codex 5.1 treats this file as an *optional module*, not core boilerplate.

### 1. Do Not Activate Unless Instructed
Codex must not implement trustless flows automatically.  
Only apply this module when the user explicitly requests trustless behavior.

### 2. Do Not Modify Core Systems
The Trustless Module must not rewrite:
- Clerk authentication flows  
- Stripe billing logic  
- Multi-tenant Prisma models  
- Dashboard routing  
- Email or push systems outside of this module

### 3. Minimal-Diff Extensions
When activated, Codex should:
- add only the routes required  
- reuse existing libs in `/src/libs`  
- avoid creating new auth or link-token mechanisms outside this blueprint  

### 4. Boilerplate-Aware Behavior
Trustless pages belong under:
- `/src/app/l/[token]` for public magic links  
- `/src/app/d/[id]` for private deeplinks  
- `/src/app/api/...` for token/signature endpoints  

### 5. Request Confirmation Before Structural Edits
If Codex needs to modify multi-tenant, push, or PWA systems to integrate trustless flows,  
it must ask the user before making structural changes.

### 6. Clarify Token Models Before Implementing
Codex must not assume:
- JWT structures  
- token lifetimes  
- refresh semantics  
- push subscription shape  

Codex must request these details when needed.

### 7. Treat This File as a Module Blueprint
Codex must not attempt to merge or overwrite this file into the main README.  
It exists solely as an optional module that can be activated on demand.
