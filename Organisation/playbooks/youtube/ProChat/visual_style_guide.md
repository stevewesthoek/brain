📘 PROCHAT — VISUAL STYLE GUIDE v1.0 (Website-Led, Final)

Purpose:
Make YouTube, website, product pages, docs, and future assets feel like one system.

The website is the baseline.
Everything else inherits from it.

⸻

1. ICP — Emotional & Functional Needs

Primary ICP

Non-technical founders who want to build SaaS in the AI era without hiring a developer upfront.

They want:
	•	speed without chaos
	•	clarity without jargon
	•	a path that feels safe and repeatable

Your visuals must communicate: “This is controlled. This is doable.”

⸻

2. Brand Answer

Brand name: ProChat
Authority: software tester mindset (calm, systematic, verification-first)
Tagline usage: “Test first. SaaS second.” is an internal anchor; use it sparingly and only when it lands in plain language.

Visual promise:

Less hype. More certainty.

⸻

3. Core Aesthetic Philosophy

ProChat is Modern Systems Clarity:
	•	neutral surfaces
	•	strong hierarchy
	•	spacing that breathes
	•	clean components
	•	no visual noise
	•	“docs you trust” energy

Not “startup flashy.”
It’s “this won’t break.”

⸻

4. Color System (Locked)

Use these as the “named” brand colors everywhere.

Primary brand (blue)
	•	Primary: #1D4ED8
	•	Secondary: #2563EB
	•	Deep (shade): #1E3A8A

Neutral system (from your existing tokens)

Use your existing token names exactly as implemented in the site:
	•	background, surface
	•	text, muted, muted-foreground
	•	border, ring
	•	card, card-foreground
	•	ink-* and/or gray-* where already used

Color behavior rules
	•	Neutral-first layouts (background/surface/text/muted).
	•	Brand blue is accent, not wallpaper.
	•	Emphasis is done via: border contrast + subtle shadow + spacing + hierarchy (not neon, not glow).
	•	Don’t introduce new accent colors “for variety.” You already have enough range inside neutrals + blue.

⸻

5. Typography (Locked)

Your CSS variables are the contract:
	•	Sans (default UI/body): --font-sans: "Host Grotesk"
	•	Brand / headings: --font-brand: "Golos Text"
	•	Mono / code: --font-mono: "JetBrains Mono"

Typography rules
	•	Headings: Golos Text (brand/authority tone).
	•	Body/UI: Host Grotesk (clean, modern, readable).
	•	Code/terminal/env vars: JetBrains Mono (clarity and “systems” vibe).
	•	Avoid ALL CAPS except micro labels (and even then, minimal).
	•	Prioritize readability: generous line-height, short paragraphs, strong headings.

⸻

6. Imagery System (Screen-Share First)

Your “imagery” is mostly product UI + dashboards + terminal output.

Rules for screen share visuals
	•	Clean desktop (no clutter, no random tabs).
	•	Clean browser sessions: GitHub/Vercel/etc only.
	•	Keep examples realistic and calm (no chaotic “look at this insanity” energy).
	•	Prefer showing success states (deploy success, build passing, env set correctly) and the exact steps to get there.

Allowed supporting visuals
	•	Minimal diagrams and simple icons that match your site style.
	•	UI screenshots that look like your site (cards, borders, muted text, blue accents).

Not allowed:
	•	meme thumbnails
	•	noisy “YouTuber” overlays
	•	random illustration styles

⸻

7. Composition Template

YouTube thumbnails / banners (still website-led)
	•	Large negative space.
	•	One focal element: Vercel dashboard, GitHub repo settings, terminal output, etc.
	•	Short overlay text in Golos Text (headline), with Host Grotesk if needed for smaller supporting text.
	•	Small blue accent (#1D4ED8 / #2563EB) as underline, border, or highlight.

Recognition > tricks.

⸻

8. Motion Language (Video Layer)

The motion goal is calm certainty.

Allowed:
	•	clean cuts
	•	slow, intentional cursor movement
	•	short pause on “success moments” (deploy success, checks passing)

Avoid:
	•	fancy transitions
	•	zoom-punch edits
	•	fast scrolling
	•	jittery camera changes

If motion draws attention to itself, it’s wrong.

⸻

9. Website Translation Rules

Rule: YouTube and docs must look like the website.

Copy tone alignment
	•	calm
	•	direct
	•	minimal jargon
	•	“this is what we do now” language
	•	zero guru hype

Layout alignment
	•	use the same spacing rhythm as your site
	•	keep the “card + border + muted text” patterns consistent
	•	prefer simple two-level hierarchy: headline → short bullets → action

⸻

10. YouTube Channel Identity

Channel banner
	•	Neutral surface background (same as site).
	•	One short promise line.
	•	Optional tiny secondary line referencing your tester angle (plain language, no abstract “lab” talk).

It should feel like the top of a premium docs site.

⸻

11. Video Visual Template (Repeatable)

Each video should feel like the same “system”:
	1.	Optional 3–5 sec face intro (consistent framing)
	2.	Hard cut to screen share
	3.	Same window sizes every time
	4.	Same terminal theme + JetBrains Mono
	5.	Same step rhythm: setup → action → result → verify

Consistency is the moat.

⸻

12. Thumbnail Formula (Website-Compatible)
	•	Screenshot focal element left/center
	•	3–6 word title right (Golos Text)
	•	One blue accent line/border (#1D4ED8 or #2563EB)
	•	No arrows, no red circles, no fake urgency

⸻

13. Product Visual System

Your boilerplates should preview as:
	•	already structured
	•	already premium
	•	already documented
	•	clearly customizable

Default placeholder copy is fine, but it must feel intentional, not “template junk.”

⸻

14. Prompt Architecture (When You Use AI For Assets)

Permanent style block (conceptual):
	•	typography: Host Grotesk body, Golos Text headings, JetBrains Mono code
	•	palette: neutral surfaces + blue accent (#1D4ED8, #2563EB, #1E3A8A)
	•	clean SaaS UI, card-based layout, strong hierarchy, minimal noise

Never request:
	•	neon
	•	glow
	•	“make it green”
	•	“more colorful”
	•	new font ideas

⸻

15. Sensory Guardrails

Never:
	•	add visual urgency
	•	add clickbait overlays
	•	drift into “developer meme channel”
	•	introduce a second design system

If it feels different from the website, it’s rejected.

⸻

16. Evolution Rules

Allowed:
	•	spacing and hierarchy refinement
	•	better consistency of components across pages
	•	clearer “systems-first” layouts

Not allowed:
	•	palette shifts away from the 3 blues + neutrals
	•	font changes
	•	style pivots

⸻

Final Principle

ProChat is not designed to impress.

It is designed to reduce risk.

Visual consistency creates trust.
Trust converts.