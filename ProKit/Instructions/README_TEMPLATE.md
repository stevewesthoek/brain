# 🚀 ProChat SaaS Boilerplate — Optional Feature README Template

> ⚠️ Optional Template  
> This file is **not required** for every app.  
> It serves as a generic template for documenting optional modules, architectures, and features when extending the ProChat SaaS Boilerplate.
>
> Use it only when shipping a new optional subsystem (e.g., Trustless Module, Push-First Module, Public-Link Module, etc.).
>
> Codex 5.1 must treat this file as a template, not as an instruction to modify core boilerplate.

---

## 🧠 Overview

**Feature Type:** <FEATURE>  
**Project Name:** <PROJECT>  
**Architecture:** (e.g., Trustless, Passwordless, Push-First, Mobile-First)

**One-sentence pitch:**  
Describe your SaaS in a single clear line.  
> Example: “Milestone gives clients a live progress link for every project—no logins, no emails.”

**Description:**  
Explain what the app does, who it helps, and the pain point it solves.  
Outline what makes it simple, fast, and automation-friendly.

---

## ⚙️ Project Setup

### 1. Clone
```bash
git clone git@github.com:yourusername/<repo>.git
cd <repo>
```

### 2. Install
```bash
npm install
```

### 3. Environment Variables
List only what differs from the boilerplate (see main `README.md` for defaults):

```bash
NEXT_PUBLIC_APP_URL=https://<project-domain>
LINK_JWT_SECRET=your-jwt-secret
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT="mailto:support@<project-domain>"
N8N_WEBHOOK_URL=https://n8n.yourdomain.com/webhook/<project>
```

---

## 🧱 Core Entities (Database Schema Overview)

| Model | Description |
|--------|--------------|
| `Project` / `Dossier` | The main record (e.g., mortgage case, client project) |
| `Milestone` | Stages or steps (progress tracking) |
| `Event` | Public interactions (views, requests, updates) |
| `PushSubscription` | Stored push endpoints for notifications |
| `User` | Managed via Clerk |

If relevant, include a Prisma snippet for custom fields.

---

## 🔗 Link Architecture

Describe how your app uses **magic links** and **deeplinks**.

| Link Type | Route | Access | Description |
|------------|--------|---------|-------------|
| Magic Link | `/l/[token]` | Public | Read-only view of data |
| Deeplink | `/d/[id]` | Authenticated (Clerk) | Internal editor/dashboard view |
| QR Alias (optional) | `/q/[id]` | Redirect | Shortcut for sharing |

---

## 🔔 Notification & Automation Flow

### Automations handled by **n8n**
| Workflow | Trigger | Action |
|-----------|----------|--------|
| `Event Router` | HTTP webhook | Handles view & callback events |
| `Weekly Digest` | Cron (Fri 08:30) | Sends Resend digest email |
| `Stale Reminder` | Cron (Daily)` | Push reminder to update old records |

**Push-first logic:**  
- When a record changes → n8n sends a web-push via `/api/push/send`.  
- Users can enable push notifications via `sw.js` service worker.  
- Fallbacks: email (Resend).

---

## 🧩 Routes & APIs

| Route | Description |
|--------|--------------|
| `POST /api/<entity>/issue` | Create new record |
| `POST /api/<entity>/update` | Update record (Clerk) |
| `POST /api/events` | Log event (public actions) |
| `POST /api/push/subscribe` | Store subscription |
| `POST /api/push/send` | Send push notification |
| `GET /api/<entity>/stale` | Fetch stale records for n8n |
| `GET /api/owner/:id/summary` | Digest data endpoint |

---

## 🧭 UI Overview

Describe your pages and key UI states.

- `/dashboard`: Overview list for owners (Clerk-protected)  
- `/d/[id]`: Detailed editable view  
- `/l/[token]`: Public magic link (client view)  
- `/public/sw.js`: Push service worker  

> UI should be mobile-first and PWA-compatible, mimicking native app layouts.

---

## 📦 Deployment Checklist

| Item | Status | Notes |
|------|---------|-------|
| `.env` configured | ☐ |  |
| Database migrated | ☐ |  |
| Clerk + domain verified | ☐ |  |
| Stripe products live | ☐ |  |
| Resend domain verified | ☐ |  |
| VAPID keys generated | ☐ |  |
| n8n workflows deployed | ☐ |  |
| Push notifications tested | ☐ |  |

---

## 🔍 Testing Scenarios

1. Create new `<PROJECT>` record → generate links automatically.  
2. Open public link (`/l/[token]`) → check progress and status.  
3. Click “Enable updates” → confirm push registration.  
4. Update milestone in `/d/[id]` → check push delivery.  
5. Wait 7 days → verify digest and stale reminders.  
6. Stripe checkout → ensure subscription gating works.

---

## 💰 Pricing (example)

| Plan | Features | Price |
|------|-----------|-------|
| Starter | 25 active projects | €19/mo |
| Pro | Unlimited + Branding | €39/mo |
| Team | Multi-user dashboard | €79/mo |

---

## 🧾 Versioning & Maintenance

| Component | Update Command |
|------------|----------------|
| Prisma schema | `npx prisma migrate dev` |
| Clerk | via [dashboard.clerk.com](https://dashboard.clerk.com) |
| Stripe | Dashboard updates |
| n8n flows | JSON export/import |
| Dependencies | `npm update` |

---

## 🧠 Quick Pitch

> **<PROJECT>** — powered by the **<FEATURE> architecture**.  
> Simple, secure, and automation-driven. Launch new SaaS tools in hours, not weeks.

---

## 🧩 Codex 5.1 Rules for This Template

These rules ensure AI tools treat this file correctly when used for new optional features.

### 1. Template-Only — Not Core Boilerplate
Codex must not apply this template to the main application unless explicitly instructed by the user.

### 2. Minimal-Diff Adaptation
When generating a README for a new feature:
- Only replace the `<FEATURE>` and `<PROJECT>` placeholders.
- Do not restructure the template.
- Do not remove sections unless the user asks.

### 3. No Boilerplate Modifications
This template must not trigger edits to:
- Clerk authentication
- Stripe billing
- Prisma schema
- Multi-tenant logic
- Global layout, SEO engine, or dashboard

### 4. Reuse Existing Boilerplate Patterns
All examples must follow:
- `/src/app/...` routing conventions
- `/src/app/api/...` endpoint conventions
- Tailwind + shadcn UI
- The folder structure defined in the Appendix (SaaS_Builder_Reference_Document)

### 5. Ask Before Structural Changes
If a feature based on this README would require altering protected systems or adding new dependencies, Codex must request confirmation first.

---

This README template is now aligned with the ProChat SaaS Boilerplate and safe for Codex-driven extensions.
