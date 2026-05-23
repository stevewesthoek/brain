# Orchestrators Reference Guide

**Your primary interface for all work.** Five master orchestrators route natural language to the right toolchain automatically. No need to remember individual skill commands — just describe what you need.

---

## Quick Access

| Orchestrator | When to use | Entry point |
|--------------|-------------|-------------|
| **`/code`** | Understanding, improving, fixing, reviewing, building, documenting, shipping code | "this code is spaghetti" / "something is broken" / "review my code" / "add this feature" |
| **`/web`** | Internet research, browser testing, authenticated interaction, automation scripts, scraping | "research X" / "test this form" / "scrape this site" / "find pricing on Y" |
| **`/design`** | All design work — new projects, reference mimics, existing site upgrades, motion | "design a landing page" / "audit this site's motion" / "improve this UI" |
| **`/video`** | Script writing, voiceovers, video composition, thumbnails, platform posting, batch pipelines | "write a script" / "generate voiceover" / "post this to YouTube" / "batch produce 10 episodes" |
| **`/research`** | Source-grounded research, verification, synthesis, reports, and domain-specific routing including Bible research | "research this topic" / "verify this claim" / "compare these sources" / "what does the Bible say about X?" |

---

## The Five Orchestrators

### `/code` — Master Code Orchestrator

**Natural language routing for all coding work.** Classifies your intent and routes through the right toolchain.

**What it does:**
- **UNDERSTAND:** Map your codebase with `/graphify` → query for architecture, data flow, dependencies
- **IMPROVE:** Map structure → plan changes → execute → review (identify tech debt, reduce coupling, simplify)
- **FIX:** Root cause analysis with `/investigate` → verify fix → extract pattern for reuse
- **REVIEW:** Pre-landing gate check → escalate to `/codex` for high-risk (auth, billing, migrations)
- **BUILD:** Find existing patterns → plan architecture → implement → review → ship
- **DOCUMENT:** Map module → generate JSDoc/markdown/README
- **SHIP:** Review → bump version → update changelog → create PR

**When to use:**
- "this code is spaghetti / a mess"
- "clean this up / refactor"
- "something is broken / this isn't working"
- "review my code / any issues?"
- "add this feature / build X"
- "explain this module / what does X do?"
- "document this"
- "ship this / create a PR"

**Underlying tools (available directly):**
- `/graphify` — codebase mapping and architecture understanding
- `/investigate` — debugging and root cause analysis
- `/plan-eng-review` — architecture planning for refactors and builds
- `/review` — pre-landing code quality gate
- `/codex` — adversarial code review (high-stakes only)
- `/ship` — PR creation, versioning, changelog
- `/learner` — extract reusable patterns from complex fixes

**Reference:** `brain/ai/skills/custom/code/SKILL.md`

---

### `/web` — Master Web Orchestrator

**Natural language routing for internet research, browser testing, automation, and scraping.**

**What it does:**
- **RESEARCH:** Fetch and clean web content via `/firecrawl` (local, token-efficient)
- **INTERACTIVE:** Click buttons, fill forms, take screenshots via `/browse` (for QA testing)
- **SCRIPT:** Create reusable browser automations via `/playwright` (runs headless, logs results)
- **SCALE:** Bulk scraping (100s of URLs) via `/apify` (distributed, persistent)

**When to use:**
- "research X / find information about"
- "what's the pricing on Y?"
- "scrape this site / extract data from"
- "test this form / fill it out and check"
- "create an automation for X / automate this workflow"
- "compare these websites / competitive analysis"
- "find all URLs matching X pattern"

**Underlying tools (available directly):**
- `/firecrawl` — web scraping + content extraction (token-efficient markdown output)
- `/browse` — interactive browser testing (QA, visual inspection)
- `/playwright` — reusable browser automation scripts
- `/apify` — distributed scraping at scale

**Reference:** `brain/ai/skills/custom/web/SKILL.md`

---

### `/design` — Master Design Orchestrator

**Natural language routing for all design work.** Sequences 14+ design skills automatically in the right order.

**What it does:**
- Classifies the scenario: new project / reference mimic / existing site upgrade
- Classifies the project type: SaaS / landing page / funnel / website
- Sequences all 14 design skills in the correct order for that scenario
- No commands to remember, no decisions to make — just describe the goal

**When to use:**
- "design a landing page for X"
- "redesign our homepage"
- "audit this site's motion / does the animation feel right?"
- "improve this UI / make it more polished"
- "create a design system for my project"
- "design a reference mimic (copy this aesthetic)"
- "check if our typography is right"

**Underlying skills (available directly):**
- `/taste-skill` — visual quality bar and polish
- `/design-motion-principles` — motion/animation audit
- `/design-system` — systematic design documentation
- `/web-design` — web-specific design patterns
- Plus 10+ others coordinated by the orchestrator

**Reference:** `brain/ai/skills/custom/design/SKILL.md`

---

### `/video` — Master Video Orchestrator

**Natural language routing for all video production work.** Routes to `/stb-pipeline` (narrated slideshows), `/ffmpeg` (composition), `/design` (thumbnails), and platform posting workflows.

**What it does:**
- **WRITE:** Script generation for any video format (narration, talking-head, short-form)
- **VOICE:** TTS audio generation (Microsoft SSML, ElevenLabs, OpenAI)
- **COMPOSE:** Video composition — narrated slideshow (16:9), vertical reel (9:16), talking-head (via HeyGen stub), audio-first (waveform + still)
- **DESIGN:** Thumbnail design via `/design` orchestrator (bold text, high contrast, focal point center)
- **POST:** Upload and schedule to platforms (YouTube, TikTok, Instagram, LinkedIn, Facebook, Bluesky, X)
- **PIPELINE:** Full end-to-end with checkpoint/resume (script → voice → compose → design → post in sequence)

**When to use:**
- "write a script for a video about X"
- "generate a voiceover / TTS for this script"
- "render the video / compose this"
- "make a YouTube video from this audio + image"
- "make a TikTok reel / vertical clip"
- "create a thumbnail for this video"
- "post this to YouTube / upload to TikTok"
- "batch produce 10 episodes / run the full pipeline"

**Underlying tools (available directly):**
- `/stb-pipeline` — narrated slideshow episodes (TTS + composition + render)
- `/ffmpeg` — audio mixing, video composition, format conversion
- `/design` — thumbnail design and motion graphics
- `/n8n` — platform automation via webhooks

**Current State:** Phase 0 (rudimentary). Routes natural language to individual skills. Phase 1+ will add account registry, credential manager, multi-platform routing, and full orchestration.

**Roadmap:** `brain/operations/runbooks/video-orchestrator-roadmap.md` (Phases 1–5: account mgmt → platform templates → routing → series mgmt → production studio UI)

**Reference:** `brain/ai/skills/custom/video/SKILL.md`

---

## Decision Tree: Which Orchestrator?

```
What do you need?

├─ Understand code / improve code / fix a bug / review code / build a feature
│  └─ Use /code ✓

├─ Research something / scrape a website / test a form / automate a workflow
│  └─ Use /web ✓

├─ Design something / audit design / improve UI / create a system
│  └─ Use /design ✓

├─ Write scripts / make videos / generate voiceover / post to platforms
│  └─ Use /video ✓

└─ Something else?
   └─ Probably still one of the four above — describe what you need in natural language
```

---

## Standing Principle

**All underlying tools remain independently callable.** The orchestrators are convenience layers, not replacements.

- Want to call `/ffmpeg` directly with custom flags? Do it.
- Want to run a `/graphify query` directly? Do it.
- Want to use `/firecrawl` without the `/web` routing layer? Do it.

The orchestrators are for **natural language convenience**. Power users can skip them and call underlying tools directly.

---

## How to Use Each Orchestrator

### Invoke directly

In Claude Code, Codex, Gemini, or any IDE:

```bash
# Start an orchestrator
/code
/web
/design
/video
```

Or just **describe what you need in natural language** and the system will route automatically:

```
"this code is a mess, clean it up"        → /code (IMPROVE workflow)
"research X and summarize findings"       → /web (RESEARCH workflow)
"design a landing page for my SaaS"      → /design (NEW PROJECT scenario)
"write a script for a 2-minute video"    → /video (WRITE workflow)
```

### Progressive escalation

Each orchestrator has **automatic escalation**:
- **Claude:** Haiku → Sonnet → Opus (cost tier escalation)
- **Codex:** low → standard → max (effort escalation)
- **Gemini:** Flash-Lite → Flash → Pro (reasoning depth)

You don't choose. The orchestrator picks the cheapest agent that can handle the task, then escalates if needed.

---

## Skill Anatomy: How They Work

Each orchestrator follows the **same pattern:**

1. **Frontmatter** — YAML metadata (name, description)
2. **Standing Laws** — Golden rules that never break (flat bullet list)
3. **Workflows** — A–F classified by intent (e.g., A=UNDERSTAND, B=IMPROVE, C=FIX, etc.)
4. **Tool Reference Map** — Which underlying tools are used when
5. **Natural Language Routing Guide** — Example phrases and what they trigger
6. **AI-Agnostic section** — Works on Claude Code, Codex, Gemini, Cursor, Kiro, Antigravity
7. **Underlying Tools section** — All tools remain independently callable

This consistency means you learn one pattern → all orchestrators work the same way.

---

## Reference by Scenario

**I want to...**

| Goal | Orchestrator | Example phrases |
|------|--------------|-----------------|
| Understand my codebase | `/code` | "map my project", "explain this module", "what's the data flow?" |
| Fix a bug | `/code` | "something is broken", "why is X happening?", "debug this" |
| Clean up code | `/code` | "this is spaghetti", "refactor", "reduce coupling" |
| Review my code | `/code` | "review this", "is this safe?", "check my PR" |
| Add a feature | `/code` | "build X", "implement Y", "add this endpoint" |
| Research something | `/web` | "find information about X", "competitive analysis", "pricing comparison" |
| Scrape a website | `/web` | "extract data from X", "grab all URLs from Y", "bulk scrape Z" |
| Test a form | `/web` | "test this checkout", "verify this works", "take a screenshot" |
| Automate a workflow | `/web` | "create an automation for X", "script this repetitive task" |
| Design something new | `/design` | "design a landing page", "create a UI for X", "build a design system" |
| Improve an existing design | `/design` | "redesign our homepage", "this UI is clunky", "make it more polished" |
| Audit motion/animation | `/design` | "does this animation feel right?", "motion audit", "check our transitions" |
| Write a script | `/video` | "write a script for a video about X", "create narration for Y" |
| Generate voiceover | `/video` | "TTS for this script", "generate audio", "make a voiceover" |
| Compose a video | `/video` | "render the video", "make a YouTube video from this", "compose this" |
| Create a thumbnail | `/video` | "make a thumbnail", "design the cover", "thumbnail design" |
| Post to platforms | `/video` | "post this to YouTube", "upload to TikTok", "schedule for Instagram" |
| Batch produce videos | `/video` | "batch produce 10 episodes", "run the full pipeline", "automate posting" |

---

## Memory

This document is your **primary reference for orchestrators**. Bookmark it, refer to it, use it to decide which orchestrator to invoke.

See also:
- `brain/ai/policy/routing.md` — Full model/agent routing policy (Haiku vs Sonnet vs Opus, Codex tiers, Gemini escalation)
- `.claude/CLAUDE.md` — Global workflow rules and memory system

---

## Next Steps

1. **Use this document** as your primary entry point for deciding which orchestrator to use
2. **For tasks outside these four orchestrators**, refer to `brain/ai/policy/routing.md` for full routing policy
3. **For skill installation**, use `/brain-universal-capability-install` (installs to all three AI engines simultaneously)
4. **For memory operations**, use `/memory` (works with Claude, Codex, Gemini, all IDEs)

---

## The Orchestrator Layer

Think of the orchestrator layer as your **command interface**:
- **You** (natural language) → **Orchestrator** (routing) → **Toolchain** (execution)

This three-tier model keeps your workflow simple while maintaining access to power-user tools underneath.

**Example:** "design a landing page for my startup"
- You speak natural language
- `/design` routes to the right design skill sequence
- 14 design skills execute in the correct order
- Result: polished landing page design

No tool names. No commands. No cognitive load.

---

Last updated: 2026-05-07  
Location: `brain/operations/runbooks/orchestrators-reference.md`
