# playbook_vas2sas.md
_VaaS → WaaS → SaaS Playbook_

## 0. Purpose

Use **WaaS (Website-as-a-Service)** to quickly win a **tight niche of paying clients**, then build **SaaS** only from proven pains in that niche.  

Tools:

- **ProKit** – internal boilerplate engine  
- **WaaSKit** – internal system to sell WaaS to a niche  
- **SaaSKit** – productized kit for non-dev founders (external product, €179)

Outreach:

- **WaaSKit → Loom-based personalized outreach**  
- **SaaSKit/ProKit → YouTube content**

---

## 1. Definitions

### ProKit (engine, internal)

- Next.js + TS + Tailwind + shadcn  
- Clerk auth + teams  
- Supabase + Prisma (multi-tenant)  
- Stripe subscriptions  
- Resend/FreeResend emails  
- n8n hooks  
- Dashboard shell (settings, billing, etc.)

> **Used by me to build all portals, WaaS systems, and SaaS apps. Not sold directly.**

---

### WaaSKit (Website-as-a-Service system, internal)

- Opinionated setup (funnel + onboarding + portal + billing) built on ProKit + WP.  
- Used to sell **subscription websites to a specific niche** (e.g. accountants at €97/mo).  
- Gives:
  - Niche funnel (e.g. accountant.websites)  
  - Onboarding forms (content intake, branding)  
  - Client portal (updates, docs, support)  
  - Stripe recurring billing

> **Purpose:** get 5–10+ paying clients in one niche fast, build relationships, mine pains.

---

### SaaSKit (productized kit, external, €179)

- Includes **ProKit engine**  
- Plus:
  - Weekend build tutorial (zero → deployed)  
  - AI prompt pack tailored to this stack  
  - Positioning + landing page  
  - Optional DFY install via ProChat Studio (separate service)

> **Audience:** non-dev founders, agencies, coaches who want their own SaaS/app/client portal on a serious stack.

---

## 2. Core Strategy (VaaS → WaaS → SaaS)

**One-line:**  

> Use WaaSKit (on ProKit) to **own a niche and get cash** → mine pains → build SaaS only where demand is explicit → expose the engine via SaaSKit/YouTube.

High-level flow:

1. **Pick one niche** (start: accountants).  
2. **Sell WaaS** to that niche (subscription websites).  
3. **Talk to clients** monthly via portal + calls.  
4. **Collect recurring pains** (workflow, docs, status, reminders, etc.).  
5. **Build one SaaS feature/app** on ProKit that solves shared pain.  
6. **Sell that SaaS back into same niche** (existing clients as first users + ambassadors).  
7. **Show the process publicly on YouTube** and sell SaaSKit to non-dev founders who want the same system.

---

## 3. Phases

### Phase 1 – Niche WaaS Beachhead

**Goal:** 5–10 recurring clients in one niche.

1. Choose niche (e.g. **accountants**).  
2. Use **WaaSKit** to spin up:
   - Niche funnel: “High-converting accountant websites for €XX/month, no upfront cost.”  
   - Onboarding forms: business info, services, testimonials, brand, etc.  
   - Basic portal: updates, site previews, support tickets.  
3. Pricing: simple WaaS (e.g. €97/month, no setup fee).  
4. Constraint: **90% template, 10% customization**  
   - Only allow:
     - Colors / logo  
     - Text blocks  
     - 1–2 optional sections  
   - No custom features per client.

**Outreach for WaaSKit (to get clients):**

- **Channel:** Direct, personalized outreach with Loom.  
- **Process:**
  1. Build a shortlist of accountants (Google Maps, LinkedIn, local directories).  
  2. For each prospect:
     - Record a **2–4 min Loom**:
       - Show their current website (or lack of it).
       - Point out 2–3 issues (clarity, mobile, trust, calls-to-action).
       - Briefly show your accountant WaaS template / portal.
       - End with a simple offer:  
         > “I can give you this as a subscription website for €XX/month, no upfront cost, hosted + maintained. If you’re interested, reply and I’ll walk you through.”
  3. Send Loom via email or LinkedIn DM:
     - Short text: who you are, why you sent it, link to Loom, 1-line offer.
  4. Track responses; aim for **calls**, not paragraphs of explanation.

> **Non-negotiable:** 60–80% of your work time here = outreach + calls + improving pitch, not coding.

---

### Phase 2 – Pain Mining

**Goal:** understand real, repeatable pains in this niche **beyond “website looks bad”**.

For each WaaS client:

1. Have periodic check-ins (30–60 min call, or async via Loom).  
2. Ask structured questions:
   - “Where do you lose time with clients?”  
   - “What parts of your day feel like chaos?”  
   - “What’s currently in spreadsheets / email that you wish was ‘in a system’?”  
   - “Which tools do you pay for but barely use?”  
3. Log everything in a single doc: `ACCOUNTANT_PAIN_LOG.md`:
   - Per client:
     - Pain
     - Current workaround
     - Frequency
     - Emotional intensity
     - Existing tools used
4. Mark **pains that repeat across 3+ clients**.  
5. Only those pains become SaaS candidates.

> **Rule:** No new SaaS project unless:
> - Pain repeats across **≥ 3** clients  
> - At least **2** explicitly say “Yes, I’d pay for that / that would be very helpful”

---

### Phase 3 – First Niche SaaS (Built on ProKit)

**Goal:** turn a repeated pain into a **simple SaaS tool** for the same niche.

1. Pick one pain with:
   - Clear workflow  
   - Obvious “before/after”  
   - No heavy compliance nightmare (keep it low-risk early).

2. Use **ProKit** to build v1:
   - Reuse auth, teams, multi-tenant, billing.  
   - Add **one core workflow**:
     - e.g. document tracker, client status updates, deadline reminders, file request sequences, etc.

3. Integrate with WaaS-client base:
   - Make it part of their portal or a linked app:
     - “Log into your Accountant Portal → Documents / Status tab (new).”
   - Offer:
     - Upgrade their monthly fee, or
     - Charge separately for “Portal + Tool”.

4. Onboard your existing WaaS clients first:
   - Give them **beta pricing / early adopter terms**.
   - Get feedback, usage patterns, testimonials.

Result:

- You now have:
  - WaaS revenue
  - A **real SaaS** used by your niche
  - Case studies: “From website to workflow tool.”

---

### Phase 4 – Expose the Engine (SaaSKit & ProKit via YouTube)

**Goal:** turn your internal playbook into an external product story.

Use your experience to create **YouTube content** that:

- **Shows the *what***: how you build WaaS and SaaS on your stack.  
- **Sells the *how***: SaaSKit (and the idea of ProKit under the hood).

**YouTube content strategy:**

1. **Series idea:** “Niche SaaS in Real Life: Accountants”  
   - Episode examples:
     - “How I sell €XX/month websites to accountants (WaaS playbook)”  
     - “How I turn accountant website clients into SaaS users”  
     - “Inside the stack: Next.js + Supabase + Stripe + n8n (ProKit/SaaSKit)”  
     - “From email chaos to client portal – live walkthrough”  

2. In each video:
   - Show the **real UI** of:
     - WaaS funnel  
     - Onboarding  
     - Portal  
     - Niche SaaS tool  
   - Briefly outline the tech stack (ProKit) without overwhelming.  
   - Soft pitch:  
     - “If you’re a non-dev founder or agency and want this kind of engine, that’s exactly what SaaSKit is. Link in description.”

3. CTA in YouTube:
   - Always point to **SaaSKit landing page** for non-dev founders.  
   - Optionally:
     - Link to WaaS offer if viewers are accountants / niche prospects.
     - Link to ProChat Studio for DFY help.

Result:  

- WaaS + SaaS = **proof**.  
- YouTube = **distribution** for SaaSKit and your playbook.

---

## 4. Outreach Summary

### WaaSKit → Niche Clients

- Channel: **Direct outreach + Loom videos**  
- Target: businesses in chosen niche (start: accountants)  
- Offer: subscription website + portal, no upfront, clear fixed monthly fee  
- Steps:
  - Research → Loom (2–4 min) → Email/DM → Call → Close

### SaaSKit / ProKit → Non-Dev Founders & Agencies

- Channel: **YouTube + Twitter + LinkedIn (secondary)**  
- Focus:  
  - Show the **real workflow** and stack.  
  - Explain how non-devs can use SaaSKit to build similar systems.  
- CTA: Send viewers to `kits.prochat.tools/saaskit` (and Studio for DFY).

---

## 5. Non-Negotiables

- **Time allocation:** 60–80% of work time = outreach, sales, calls, and content.  
- **No random SaaS building:** Only build SaaS when:
  - ≥ 3 WaaS clients share the pain  
  - ≥ 2 say they’d pay to fix it  
- **Template discipline in WaaS:**  
  - One base template per niche  
  - Strict limits on customization  
- **Documentation:**  
  - `ACCOUNTANT_PAIN_LOG.md` (or niche-specific)  
  - This `playbook_vas2sas.md` as the guiding document

---

## 6. Loop

1. Choose niche → WaaSKit → 5–10 WaaS clients  
2. Mine pains → pick one recurring → build SaaS with ProKit  
3. Sell SaaS back into same niche  
4. Capture story + stack → YouTube → sell SaaSKit externally  
5. Iterate / expand niche or create new verticals

> This is the **VaaS → WaaS → SaaS** pipeline:  
> Websites get you in the door, pains define the product, SaaSKit is the “meta-product” for outsiders who want your system.