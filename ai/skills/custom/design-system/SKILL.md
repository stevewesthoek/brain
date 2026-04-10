---
name: design-system
description: Use when building landing pages, websites, or UI projects. awesome-design-md is the default design tool — pick a system, copy DESIGN.md to your project, and build consistent branded UI. Stitch is fallback only. Also use proactively for any new web projects.
---

# /design-system — awesome-design-md Orchestrator

Default design orchestrator for all web UI work. awesome-design-md provides plain-text DESIGN.md files (no MCP, no token overhead, any AI agent reads them).

**Default tool:** awesome-design-md  
**Fallback:** Stitch (explicit use only)  
**Works with:** Claude Code (primary), Codex, Gemini Flash, any tool that reads markdown

---

## What This Skill Does

When you need to build a website, landing page, UI, funnel, or any web project:

1. I ask you about the project (type, vibe, audience, brand)
2. I recommend a design from the awesome-design-md library
3. I copy `DESIGN.md` to your project root
4. You build with it — Claude/Codex/Gemini all read the same markdown file
5. Result: consistent, branded, beautiful UI every time

No Figma exports. No JSON configs. No tokens wasted on MCP. Just markdown.

---

## When to Use This Skill

**Always use this for:**
- New web projects or landing pages
- Rebuilding or redesigning existing sites
- Starting UI work for any component
- When asked for "design" or "website" work
- When you need brand consistency across a project

**Optionally use this for:**
- Picking existing design systems for reference
- Creating custom DESIGN.md for new projects
- Extending an existing DESIGN.md with project-specific overrides

---

## Project-Type Quick Picks

### Your SaaS Products

| Project | Recommended System | Why | Status |
|---------|---|---|---|
| **proofly** | Linear | Clean SaaS dashboard, precise, developer aesthetic | Use |
| **xgrow** | Linear or Vercel | Dashboard or landing page → choose based on need | Use |
| **statuslink** | Linear | SaaS status page, precise monitoring UI | Use |

### Developer/Technical Products

| Project | Recommended | Why |
|---------|---|---|
| **prochat.tools** | Custom prochat-tools | Already extracted from brand, in project root | Use |
| **New API docs** | Resend or Vercel | Minimal, code-friendly, developer aesthetic | Use |
| **New developer landing** | Vercel | Black/white precision, clean, professional | Use |

### Faith/Inspirational Content

| Project | Recommended | Why |
|---------|---|---|
| **says-the-bible** | Apple or SpaceX | Premium, cinematic, aspirational, high-end | Use |
| **openfund** | Apple | Premium, clean, trustworthy | Use |
| **Yeshua Academy** | SpaceX or Apple | Cinematic, stark, powerful, inspirational | Use |

### Marketing & Conversion

| Project | Recommended | Why |
|---------|---|---|
| **Pricing pages** | Stripe | Purple elegance, premium, conversion-focused | Use |
| **General landing pages** | Stripe or Vercel | Professional, clean, proven to convert | Use |
| **Community/marketplace** | Airbnb | Warm, photography-driven, friendly | Use |

### Full Library

Browse all available systems (30+ brands): `brain/ai/design-systems/library.md`

---

## How to Use This Skill (Your Workflow)

### Step 1: Start a Project

```
/design-system

You: I'm building a new landing page for [project]
Me: Let me recommend a design system...
```

### Step 2: Pick a Design

I show you options. You pick or I recommend based on your project type (see table above).

**Example:**
```
You: proofly redesign
Me: Linear is the match — SaaS dashboard, precise, developer aesthetic. Copy?
You: Yes
```

### Step 3: Install

I copy the `DESIGN.md` file to your project root. Done.

```
prochattools/web/prochat/DESIGN.md ← ready to use
```

### Step 4: Build With It

Use the design system in your project:

**In prompts:** `"Use DESIGN.md for all styling decisions"`  
**In code:** Reference colors, typography, spacing from DESIGN.md  
**In Codex:** Add to AGENTS.md: "Read DESIGN.md before writing UI"  
**In Gemini:** Preprocess DESIGN.md + brief → pass spec to Claude/Codex

---

## Integration with Other Tools

### Claude Code (This Tool)

Primary interface. Use `/design-system` to orchestrate.

```
/design-system → pick design → DESIGN.md in project → build
```

### Codex

Add to project's `AGENTS.md`:

```markdown
## Design System

All UI must follow `DESIGN.md` in the project root.
Read it before writing any component code.
Use its color palette, typography rules, and component patterns.

Reference: ~/Repos/stevewesthoek/brain/ai/design-systems/library.md
```

Then invoke with: `"Build [component] using DESIGN.md"`

### Gemini Flash (Preprocessing)

For large projects or complex design needs:

```
Ask Gemini: "Read DESIGN.md + [project brief] → extract design spec"
→ Gets compact design reference (100–200 tokens)
→ Pass to Claude/Codex: "Use this spec for the UI"
```

### Integration with Other Skills

- **`/taste-skill`** — applies premium aesthetics on top of DESIGN.md
- **`/web-design`** — full workflow skill; now wired to use DESIGN.md first
- **`/ui-ux-pro-max`** — design database; complements DESIGN.md

---

## Creating Custom DESIGN.md

For new projects without an awesome-design-md match:

1. **Extract your brand:** fonts, colors, spacing, component styles
2. **Write DESIGN.md:** use 9-section format
3. **Save:** `brain/ai/design-systems/custom/[project-name]/DESIGN.md`
4. **Use:** same workflow as above

**Example — prochat.tools:**
```
brain/ai/design-systems/custom/prochat-tools/DESIGN.md
├── Host Grotesk font
├── Blue-600 primary (#4c6fff)
├── Dark navy background (#0b1220)
├── Full typography scale
├── Component patterns
└── And all 9 sections documented
```

---

## awesome-design-md vs Stitch

| Aspect | awesome-design-md | Stitch | Better |
|--------|---|---|---|
| **Token cost** | ~500 tokens (markdown) | ~3000+ tokens (MCP overhead) | awesome-design |
| **Setup** | Copy one file | MCP server config | awesome-design |
| **AI compatibility** | Any agent (reads markdown) | Stitch-specific tools | awesome-design |
| **Quality** | Real brands (high fidelity) | Generic templates | awesome-design |
| **Speed** | Instant (local file) | Network calls | awesome-design |
| **Offline** | Yes | No | awesome-design |
| **When to use** | **Always (default)** | Explicit request only | **awesome-design** |

**Stitch is fallback only.** Use it only if you explicitly request it or need the Stitch GUI for design work.

---

## Full Workflow Example

### Scenario: Build prochat.tools Landing Page

```
1. You: "I need to redesign the prochat.tools landing page"

2. Me: 
   "prochat.tools has a custom DESIGN.md (extracted from brand).
    It's in the project root already: DESIGN.md
    Dark blue theme, Host Grotesk, professional SaaS vibe.
    Ready?"

3. You: "Go ahead"

4. Me:
   ✓ Copy DESIGN.md to prochattools/web/prochat/
   ✓ Ready to build

5. You: "Build a hero section"

6. Me:
   "Using DESIGN.md:
    - Blue-600 (#4c6fff) CTA button
    - Host Grotesk h1 (-0.05em tracking)
    - Dark navy background (#0b1220)
    - 650ms transitions
    - AI glow on hover
    → [builds with exact tokens from DESIGN.md]"

7. You: In Codex: Add to AGENTS.md: "Read DESIGN.md before writing"

8. You: Deploy
   → Consistent branding across all components
```

---

## Philosophy

**Everything measurable is improvable, including design.**

DESIGN.md is not static. Update it as your brand evolves. Keep it consistent. All tools read the same source of truth — markdown.

**No proprietary lock-in.** Plain text. Any AI can read it. Gemini, Claude, Codex, even GPT. Move it anywhere. Version it in git. It's yours.

**This is your design system.** Customize it. Extend it. Share it with your team. Make it reusable.

---

## Resources

- **Full guide:** `brain/ai/design-systems/README.md`
- **Design library:** `brain/ai/design-systems/library.md` (30+ brands)
- **prochat.tools DESIGN.md:** `Repos/prochattools/web/prochat/DESIGN.md`
- **Create custom:** `brain/ai/design-systems/custom/[project]/DESIGN.md`

---

## Quick Reference

### Colors

```
Primary: #4c6fff (blue-600)
Secondary: #5b7cff (blue-500)
Pressed: #3e5ae0 (blue-700)
Glow: #6d83ff (focus)
Dark bg: #0b1220
Text: #f3f5fa (dark mode)
```

### Typography

```
Font: Host Grotesk (all text)
Headings: 700 weight, -0.05em tracking
Body: 400 weight, 15.5px
Buttons: 600 weight
```

### Spacing

```
Use: 4, 8, 12, 16, 24, 32, 48, 64, 80, 96px
Never improvise.
```

### Motion

```
All transitions: 650ms cubic-bezier(0.22, 1, 0.36, 1)
```

---

## Status

**Active as of 2026-04-10**

- ✅ awesome-design-md is now default design tool
- ✅ Stitch demoted to fallback (explicit-only)
- ✅ prochat.tools has live DESIGN.md
- ✅ 30+ brand systems available in library
- ✅ Works with Claude Code, Codex, Gemini
- ✅ Ready to use for all new projects
