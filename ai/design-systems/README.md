# Design Systems Library

**awesome-design-md is the default design tool for all web UI work.** Plain-text DESIGN.md files that any AI agent can read. No tokens wasted on MCP overhead. No Figma exports. Just markdown.

Stitch is fallback only — use explicitly only when requested.

---

## What is DESIGN.md?

A markdown file that defines a complete design system in 9 sections:

1. **Visual Theme & Atmosphere** — mood, density, design philosophy
2. **Color Palette & Roles** — semantic names, hex values, functional roles
3. **Typography Rules** — font families, full hierarchy
4. **Component Stylings** — buttons, cards, inputs, navigation with states
5. **Layout Principles** — spacing scale, grid, whitespace
6. **Depth & Elevation** — shadow system, surface hierarchy
7. **Do's and Don'ts** — design guardrails and anti-patterns
8. **Responsive Behavior** — breakpoints, touch targets, collapse strategy
9. **Agent Prompt Guide** — quick reference for AI agents

Each design system includes `DESIGN.md` + optional `preview.html` (light + dark).

---

## How to Use (All Tools)

### For Claude Code (Claude)

**Use the `/design-system` skill:**

```
/design-system

You: I'm building a new landing page for [project]
I respond: Pick one:
  - Linear (SaaS dashboard style)
  - Stripe (payment/fintech)
  - Apple (premium, sparse)
  - Vercel (precision, minimal)
  - Or browse library.md

You pick → I copy DESIGN.md to your project root → you build with it
```

### For Codex

Add to your project's `AGENTS.md`:

```markdown
## Design System

Read `DESIGN.md` in the project root before writing any UI code. 
Use its color palette, typography rules, and component definitions.
Reference: `~/Repos/stevewesthoek/brain/ai/design-systems/library.md`
```

Then invoke Codex with: `"Build this UI using DESIGN.md"`

### For Gemini Flash (Preprocessing)

1. Ask Gemini to read your `DESIGN.md` + project brief
2. Extract: colors, typography, component rules
3. Output: compact design spec (100–200 tokens)
4. Hand to Claude or Codex: "Use this design spec"

### For Any Tool

**Manual workflow:**
1. Pick a design from `library.md` that fits your project vibe
2. Copy `DESIGN.md` to your project root
3. Reference in prompts: "Use DESIGN.md for all styling decisions"
4. Customize as needed

---

## Project-Specific Recommendations

| Project | Recommended Design System | Why |
|---------|--------------------------|-----|
| **proofly, xgrow, statuslink** | Linear | SaaS dashboard, precise, developer aesthetic |
| **prochat.tools** | Custom prochat-tools | Extracted from actual prochat brand tokens |
| **says-the-bible, openfund, Yeshua Academy** | Apple or SpaceX | Premium, cinematic, high-end, inspirational |
| **New landing pages** | Stripe or Vercel | Clean, conversion-focused, professional |
| **Community/marketplace** | Airbnb | Warm, photography-driven, friendly |
| **Developer docs** | Resend or Cal.com | Minimal, code-friendly, clean neutral |

---

## Directory Structure

```
brain/ai/design-systems/
├── README.md                    — this file
├── library.md                   — full catalog (all brands + URLs)
├── library/
│   ├── LINEAR/DESIGN.md         — reference copies of select systems
│   ├── STRIPE/DESIGN.md
│   ├── APPLE/DESIGN.md
│   └── ...
└── custom/
    └── prochat-tools/
        └── DESIGN.md            — prochat.tools custom system
```

---

## Available Designs

**Full catalogue with URLs:** see `library.md`

**Categories:**
- **Productivity & SaaS** — Linear, Notion, Cal.com, Intercom, Mintlify, Resend, Zapier
- **Developer Tools** — Cursor, Expo, Lovable, Raycast, Superhuman, Vercel, Warp
- **Fintech** — Stripe, Coinbase, Kraken, Revolut, Binance, Wise
- **Media & Consumer Tech** — Apple, IBM, NVIDIA, Pinterest, SpaceX, Spotify, Uber
- **E-commerce** — Airbnb, Meta, Nike, Shopify
- **Automotive** — BMW, Ferrari, Lamborghini, Renault, Tesla

---

## Workflow

### 1. Pick

Choose a design from the library that matches your project's vibe. Use the per-project recommendations above, or browse `library.md` for more options.

### 2. Install

**Option A — Use existing design:**
```bash
# Copy to your project root
cp ~/Repos/stevewesthoek/brain/ai/design-systems/library/[BRAND]/DESIGN.md ./DESIGN.md
```

**Option B — Use custom design:**
```bash
# Reference the custom system in your project
# For prochat.tools, DESIGN.md is already in the repo root
```

**Option C — Create custom:**
```bash
# Create your own by extracting from your existing brand
# Use the 9-section DESIGN.md format
# Save to brain/ai/design-systems/custom/[project-name]/DESIGN.md
```

### 3. Use

**In Claude Code:**
```
/design-system
[pick or describe your project]
→ I handle the rest: DESIGN.md → build with it
```

**In Codex:**
```
Add to AGENTS.md:
"Read DESIGN.md before writing UI. Use its rules for colors, typography, components."

Then invoke:
"Build [component] using DESIGN.md"
```

**In Gemini:**
```
Preprocess: "Read this DESIGN.md + brief → extract design spec"
Then hand off: "Use this spec for the UI"
```

### 4. Customize

Extend DESIGN.md with project-specific overrides:

```markdown
## Project Overrides

- Primary color: [#custom] (override from DESIGN.md)
- Font: [custom] (if different)
- Additional components: [list]
```

Save as `DESIGN.md.overrides` or just modify `DESIGN.md` directly.

### 5. Maintain

Update DESIGN.md as your brand evolves. Keep the 9-section format. All tools will read the latest version.

---

## Awesome-design-md vs Stitch

| Aspect | awesome-design-md | Stitch MCP | Winner |
|--------|---|---|---|
| Token cost | Low (markdown read) | High (MCP protocol) | awesome-design |
| Setup | Copy one file | MCP server config | awesome-design |
| Agent compatibility | Any agent reads markdown | Stitch-specific | awesome-design |
| Quality | Real brands (high fidelity) | Generic | awesome-design |
| Speed | Instant (local file) | Network calls | awesome-design |
| Offline | Yes | No (requires API) | awesome-design |
| Fallback | N/A | Use only when explicitly requested | awesome-design is default |

---

## When to Use Stitch (Fallback Only)

You may use Stitch if:
1. You explicitly request it ("Use Stitch for this project")
2. You need to design in a GUI (Stitch provides that)
3. awesome-design-md is not suitable for your use case

Otherwise: **always use awesome-design-md.**

---

## Integration with Other Skills

- **`/design-system`** (Claude Code) — orchestrator for picking and installing
- **`/taste-skill`** — applies premium UI aesthetics on top of DESIGN.md
- **`/web-design`** — full workflow skill; now wired to read DESIGN.md first
- **`/ui-ux-pro-max`** — design database; complements DESIGN.md

---

## Philosophy

**Everything is improvable.** Your design is not static. Update DESIGN.md as you learn. Keep it consistent, keep it simple.

**Any AI agent can read this.** No proprietary tools. No vendor lock-in. Just plain markdown.

**This is your design system.** Fork it, extend it, customize it for your brand.

---

## Quick Start

1. Pick a design: `library.md`
2. Copy to your project: `DESIGN.md`
3. Reference in prompts: "Use DESIGN.md"
4. Build with Claude Code: `/design-system`

That's it. Now your AI builds consistent, branded UI every time.
