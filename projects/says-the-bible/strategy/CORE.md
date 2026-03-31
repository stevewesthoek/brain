# CORE.md — Says The Bible: Source of Truth

Version: v1.2
Date: 2026-03-31
Status: CANONICAL — All other strategy documents defer to this file.

If a document contradicts this file, this file wins.

---

## What We Are

Saysthe.bible is a scripture-based bedtime routine system for children ages 3–10, used by parents.

We are not selling audio files.

We are installing a habit.

The mechanism is behavioral conditioning through repetition: same story, same time, same conditions, every night until it becomes automatic.

**Primary buyer:** A parent who owns a dedicated children's audio device (Yoto, Tonie, or similar). They paid $90–$165 for the hardware specifically for this use case. Faith-based, scripture-narrated content on those platforms is thin. They are actively searching for content to load. They have money, intent, and hardware — they need the content.

**Secondary buyer:** A Christian parent who discovers the content on YouTube, likes it, and wants to play it on a device that can't stream YouTube (Bluetooth speaker, dedicated player, phone with screen off).

---

## Core Strategy

**We sell a predictable, scripture-based bedtime routine system — not content.**

YouTube = awareness (reaches secondary buyer; primary buyer discovers via device ecosystem)
Website = conversion
Bundle = monetization

The audio is the delivery mechanism. The routine is the product.

**Discovery note:** The primary buyer (device parent) is unlikely to discover us via YouTube browsing. They search in device marketplaces (Yoto, Tonie), Google for device-specific content ("Christian Yoto stories"), and Christian parenting communities. YouTube is the right channel for the secondary buyer. Getting into the Yoto/Tonie marketplace is the highest-leverage move for the primary buyer.

---

## Product Structure

### Product 1 — Entry Product

- Price: $9
- What it is: 1 story (30 minutes)
- Position as: "A complete bedtime routine session"
- Includes:
  - Calm narration
  - Brown noise
  - Structured pacing
  - Repeatable format

This is not a file. It is one full bedtime session, packaged for offline use.

### Product 2 — Core Product (PRIMARY REVENUE DRIVER)

- Price: $29–$49 (scales with library depth — see pricing gates in `library-system/library-maturity-checklist.md`)
- What it is: Full library bundle — all current stories plus all future additions
- Position as: "Everything needed for a consistent, peaceful bedtime routine"
- Includes:
  - All stories
  - Future releases at no extra cost
  - Routine guidance

The bundle is the primary monetization target. Single purchases are the entry point to it.

### Product 3 — Future Distribution (Not built now)

- Yoto player cards
- Tonie figures (if technically feasible)
- Physical / platform layer
- Preparation only: metadata and file formats should support this from the start

---

## Funnel

**Secondary buyer (YouTube path):**
```
YouTube (awareness)
  → Product page (specific story)
    → Purchase (entry product, $9)
      → Post-purchase upgrade prompt
        → Bundle (primary revenue)
          → Repeat use → habit formation
```

**Primary buyer (device path):**
```
Device ecosystem (Yoto/Tonie marketplace, Google, community)
  → Website or marketplace listing
    → Bundle (lead offer for this buyer — they want a library, not one story)
      → Download → load onto device → habit formation
```

Each piece serves one role. Do not mix roles.

For the device parent, the bundle is the natural first purchase. The $9 single is a
trial entry for the YouTube-arriving secondary buyer.

**Post-purchase onboarding (applies to both paths):**
Send a single follow-up email 3 days after purchase with one question:
"Did your child sleep? How did the first session go?"

Purpose:
- Confirms the buyer actually loaded and used the file (onboarding signal)
- Surfaces habit formation early ("we've done it 3 nights in a row" = strong retention signal)
- Generates real testimonials and word-of-mouth language in parents' own words
- Creates an opening for the bundle upsell if they report a good experience
- Identifies buyers who are stuck on file loading — the most common post-purchase failure

This is one email, not a drip sequence. Keep it short and personal in tone.
No automation complexity required — a single triggered email 72 hours post-purchase.

---

## Website Positioning Requirements

The website must communicate four things, in this order:

**1. Transformation**
"Your child falls asleep calmly without screens."
Lead with the outcome parents want.

**2. System**
This is not random audio. It is a structured, repeatable routine.
Repetition builds familiarity. Familiarity builds sleep cues.

**3. Usage Instructions**
Make the method explicit:
- Same story nightly
- Same time
- Same conditions
- Repetition is the point

**4. Differentiation**
Why this works differently:
- No stimulation
- No music with emotional arc
- No dramatic spikes
- Low cognitive load narration
- Screen-free

---

## What We Do Not Build (Current Phase)

- No subscriptions
- No mobile app
- No complex features
- No separate SaaS product

Focus only on:
- Library growth (content pipeline)
- Conversion clarity (website + product pages)

SaaS transition is documented in `strategy/phase-2-saas-transition.md`. It is real and planned — but it is triggered by behavior signals, not by schedule. Do not introduce SaaS infrastructure until the numeric gates in `library-system/library-maturity-checklist.md` are met.

---

## Execution Roadmap

### Phase A — Fix Positioning + Activate YouTube Funnel (Immediate)

Actions:
- Audit website copy against the four positioning requirements above
- Remove "audio file" language from all product pages
- Add transformation headline above the fold on homepage
- Add usage instructions (routine method) to product pages and bundle page
- Ensure product 1 is positioned as "bedtime routine session" not "audio download"
- Add explicit device-compatibility line to all YouTube video descriptions:
  "Works on Yoto, Tonie, Bluetooth speakers, and any device that plays MP3 files."
- Add UTM-tagged bundle link to the top 3 YouTube videos by view count
- Add direct bundle CTA to YouTube descriptions (not just single story link)

Files to check:
- Homepage hero copy
- Product page template
- Bundle page
- Method page
- YouTube video descriptions (top 3 by views first)

**Device compatibility guides (run in parallel with Phase A):**
Create "how to use Says The Bible on your Yoto / Tonie / Bluetooth speaker" content
— one blog post per device, and a short YouTube walkthrough for the top 2 devices
(Yoto and Tonie). This serves buyers who already own the device and are searching
for compatible content, without positioning the brand as a device reviewer.

Do NOT create "best device" comparison or recommendation content. That creates brand
confusion (content company vs. device review site), draws traffic that buys a device
and finds free content elsewhere, and competes on keywords that don't convert to audio
purchases. Affiliate links may be included in compatibility guides only as secondary
context ("if you don't yet have a Yoto, here's where to get one") — never as the
primary purpose of the content.

Expected outcome: Website communicates routine system; YouTube descriptions actively
surface the product to device owners; compatibility content ranks for device-specific
searches and reaches buyers already in the right context.

### Phase B — Introduce Bundle (Next)

**Demand validation gate (hard stop):**
Do not begin Phase B until at least one paying customer has been acquired through
the Phase A funnel. One real purchase — not a click, not a sign-up — is the minimum
signal required before investing further in bundle infrastructure and copy. If Phase A
produces zero purchases after 30 days, treat this as a positioning or discovery failure
and diagnose before proceeding. Library count alone does not unlock Phase B.

Actions:
- Launch bundle product at $29
- Position as "Everything for a consistent bedtime routine"
- Add post-purchase upsell from single → bundle
- Add soft bundle CTA on all product pages

Gate: `live_skus >= 12` AND at least 1 paying customer from Phase A funnel.

Expected outcome: Bundle becomes visible revenue driver, built on proven not assumed demand.

### Phase C — Optimize Product Pages

Actions:
- Standardize product page structure: transformation → system → usage → buy
- Add routine suggestion to each product page ("Use this as the fall-asleep anchor in your nightly routine")
- Ensure linking rules are followed (see `operations/linking-structure.md`)

Expected outcome: Higher single-to-bundle conversion.

### Phase D — Scale Content Library

Actions:
- Maintain 3 videos/week cadence
- Follow 20-SKU spine in `operations/roadmap.md`
- Every new story increases bundle value automatically

Expected outcome: Library depth justifies price ladder progression.

### Phase E — Yoto/Tonie Marketplace Entry

**Priority note:** This phase is higher urgency than originally positioned. The primary
buyer shops in the device ecosystem, not on the website. Being absent from Yoto/Tonie
marketplace means zero presence where the most desperate buyer looks. Investigate this
in parallel with Phase A, not after Phase D.

Actions:
- Research Yoto creator/marketplace program — is there a formal application? Content
  submission process? Revenue share terms?
- Research Tonie creator program equivalently
- Audio files are already in the correct format (WAV 24-bit/48kHz)
- Prepare metadata schema compatible with Yoto card content requirements
- Target submission when library has 12+ stories (aligns with bundle launch gate)

Expected outcome: At least one marketplace application submitted by the time the bundle
launches. Native marketplace presence eliminates the 3-step friction (find → buy website
→ load manually) for the primary buyer.

**Plan B — if Yoto/Tonie marketplace is rejected or stalls:**
Do not treat marketplace entry as the only path to the primary buyer. If applications
are rejected, delayed beyond 3 months, or terms are unfavorable, activate these
alternative channels in order of effort:

1. **Christian parenting communities** — Facebook groups ("Christian Moms," "Gentle Christian Parenting," homeschool groups), Reddit communities (r/Christian, r/Parenting). Post compatibility guides and engage directly. Zero cost, immediate.
2. **Homeschool networks** — Homeschool co-ops and curriculum communities actively share audio resources for children. A single post in a large homeschool Facebook group can reach thousands of the exact buyer.
3. **Church community channels** — Children's ministry directors and small group leaders in evangelical and reformed churches regularly recommend resources to parents. A one-page PDF ("scripture bedtime audio for your children's ministry families") sent to 10 children's pastors is a scalable outreach pattern.
4. **Christian parenting podcast sponsorships or mentions** — Micro-sponsorships or guest appearances on Christian parenting podcasts (many have 5k–50k listeners, affordable or free). One mention from a trusted voice in this community outperforms months of SEO.

Plan B is not a fallback. It is a parallel track that should be tested regardless of
marketplace outcome, because it builds the community word-of-mouth that no platform
can replicate.

---

## Risks and Blind Spots

**1. Conversion gap**
The pipeline produces content. The website may not convert it.
If YouTube grows but sales do not follow, the website positioning is the problem — not the content.
Validate: Are visitors clicking to product pages? Are product page visitors buying?

**2. Bundle timing**
Introducing the bundle too early (before enough content) makes it feel thin.
Gate strictly: minimum 12 stories before bundle launch.

**3. Routine framing not landing**
Parents may treat this as entertainment audio, not a routine system.
If purchases are one-off and repeat rates are low, the positioning has not reached them.
Fix: Usage instructions must be unavoidable on product pages.

**4. Yoto/Tonie complexity**
These platforms have technical and commercial requirements that may not be straightforward.
Do not over-invest in this until the digital library has proven revenue.

**5. Pricing ladder confusion**
The internal price ladder ($9 → $12 → $19) must never be visible to buyers.
Only the current price is shown. Do not hint at future increases.

**6. SaaS creep**
The existing documentation includes detailed SaaS roadmaps.
That work is valid — but the risk is building features before behavior is proven.
The gates in `library-system/library-maturity-checklist.md` are the only authority on when to move.

**7. Discovery gap (highest-priority unresolved risk)**
The primary buyer (Yoto/Tonie device parent) does not discover products via YouTube.
They search in device marketplaces and communities. If we never enter the Yoto/Tonie
marketplace, the primary buyer cannot find us regardless of how large the YouTube
channel grows.
Mitigation: Investigate Yoto/Tonie creator programs in Phase A, not Phase E.

**8. Scope creep into product complexity**
Under pressure (commoditization, competition), the instinct may be to build more product
— a soundscape synthesizer, a customizable audio app, a multi-platform SaaS. These all
contradict the "no apps, no complex features" constraint and solve future problems before
current ones are validated.
Rule: Do not build new product types until the first paying customer has been acquired
and the current funnel is measurably converting.

---

## Canonical Language

Use this language consistently across all surfaces:

| Correct | Avoid |
|---|---|
| Bedtime routine session | Audio file, audio track, download |
| Routine system | Product, content, media |
| Peaceful bedtime | Calm audio, sleep content |
| Falls asleep without screens | Screen-free audio |
| Ages 3–10 | Kids, children (when specificity matters) |
| $9 / $29–$49 | Tier 1 / Tier 2, cheap / premium |

---

## Related Documents

All strategy and operations documents should align with this file. Key references:

- Strategy stress test & design doc: `~/.gstack/projects/says-the-bible/Office-main-design-20260331-195358.md`

- Product structure detail: `strategy/product.md`
- Brand and positioning: `strategy/playbook.md`
- Method framing: `strategy/method.md`
- Operations and cadence: `operations/operations-spec.md`
- Publishing roadmap: `operations/roadmap.md`
- Pricing and phase gates: `library-system/library-maturity-checklist.md`
- Linking rules: `operations/linking-structure.md`
- SaaS transition (Phase 2 planning): `strategy/phase-2-saas-transition.md`
- Content taxonomy: `library-system/content-taxonomy.md`
