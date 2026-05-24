# Orchestrators Tab — Design Specification
**Brain Console · Obsidian Plugin**
Date: 2026-05-23
Status: Ready for implementation

---

## Overview

Four orchestrators exposed in a unified tab. Entry point is a 2×2 status card landing. Each card expands via a right-side drawer (65% viewport width) rather than a full-page navigation — this preserves overview context while working inside one orchestrator.

Implementation target: `brain/projects/brain-console-obsidian/src/`

---

## Implementation order

1. Save design doc (this file) ✅
2. Build Research Orchestrator view
3. Build Video Orchestrator view

---

## Design language

- Background: `#1a1a1a`
- Cards / panels: `#2a2a2a`
- Borders: `#3a3a3a` default, `#4a4a4a` hover
- Text: white primary, `#888` muted
- Status: 🟢 `#2ecc71` pulse when running · 🟡 `#e67e22` static · ❌ `#e74c3c` · ⚫ `#555` idle
- Font: monospace, compact
- Row height (collapsed accordion): 36–44px enforced

---

## View 0 — Landing (default)

2×2 grid of orchestrator cards. Default view when Orchestrators tab opens.

```
┌──────────────────────────────────┬──────────────────────────────────┐
│  ● VIDEO ORCHESTRATOR            │  ● RESEARCH ORCHESTRATOR         │
│  Status: 🟢 Running              │  Status: 🟡 Idle                 │
│  Jobs active: 3                  │  Notebooks: 4                    │
│  Platforms: YT · TT · IG         │  Last: STB Ep 12 summary         │
│  ● ● ● ○ ○  [health strip]       │  ○ ○ ○ ○ ○  [health strip]       │
│                        [Open →]  │                        [Open →]  │
├──────────────────────────────────┼──────────────────────────────────┤
│  ● BIBLE RESEARCH                │  ● DESIGN ORCHESTRATOR           │
│  Status: 🟡 Partial              │  Status: ⚫ Idle                  │
│  Active pipelines: 2             │  Last PRD: —                     │
│  Pending review: 1 doc           │  Skills ready: 8                 │
│  ● ○ ○ ○ ○  [health strip]       │  ○ ○ ○ ○ ○  [health strip]       │
│                        [Open →]  │                        [Open →]  │
└──────────────────────────────────┴──────────────────────────────────┘
```

**Health strip:** 1 row of colored dots (one per active/recent run) at card bottom. Green = ok, amber = warning, red = error.

**Expand behavior:** [Open →] slides a drawer in from the right at 65% viewport width. The 2×2 grid remains visible (35%) in the background. Drawer has its own close button [✕] and header breadcrumb.

**Status vocabulary (5 states only):**
- `IDLE` — gray
- `RUNNING` — blue pulse
- `PARTIAL` — amber (some platforms/steps done)
- `DONE` — green
- `ERROR` — red

---

## View 1 — Video Orchestrator

**Layout principle:** 7 fixed phase columns × N project rows. Platform accounts as inline micro-badges inside cells (NOT as sub-rows). This keeps the grid compact.

**Phase column compression:** When all cells in a column are idle/done → column compresses to 40px icon-only. Active phase expands to 110–120px showing label + progress bar.

```
┌────────────┬───────────┬───────────┬──────┬──────────┬──────┬──────┬─────────┐
│            │ 🔉 AUDIO  │ 🎬 COMP   │  CC  │ 🖼 THUMB │ 🔍SEO│ 📤PUB│ 📊 ANA  │
│  PROJECTS  │ [2 active]│ [1 active]│ idle │   idle   │ idle │ idle │ nightly │
│            │  ████ 78% │  ██░░ 45% │  ·   │    ·     │  ·   │  ·   │ ██  12% │
├────────────┼───────────┼───────────┼──────┼──────────┼──────┼──────┼─────────┤
│ ▼ STB      │[YT]🟢[TT]🟡│ [YT]🟢   │  —   │    —     │  —   │  —   │ [YT]🟢  │
│            │ ████░ 78% │ ████░ 90% │      │          │      │      │ ██░  12%│
├────────────┼───────────┼───────────┼──────┼──────────┼──────┼──────┼─────────┤
│ ▼ ProChat  │[YT]✅      │ [YT]🟢    │  —   │    —     │  —   │  —   │    —    │
│            │   done    │ █████ 90% │      │          │      │      │         │
├────────────┼───────────┼───────────┼──────┼──────────┼──────┼──────┼─────────┤
│ ▶ YA       │  [collapsed — 36px — click ▶ to expand]                          │
└────────────┴───────────┴───────────┴──────┴──────────┴──────┴──────┴─────────┘
```

**Cell anatomy (expanded phase):**
```
┌─────────────┐
│ [YT]🟢[TT]🟡 │  ← platform micro-badges (14px icons, status color fill)
│ ████░░  78% │  ← aggregate progress bar
│             │  (hover reveals: account name + last updated)
└─────────────┘
```

**Cell anatomy (compressed idle phase):**
```
┌──────┐
│  ·   │  ← single dot, hover shows "Phase — all idle"
└──────┘
```

**Cell click → right drawer (65% width):**
```
┌─────────────────────────────────────────────┐
│  STB / Audio Phase                   [✕]   │
│  ─────────────────────────────────────────  │
│  YouTube · yt-main-stb       🟢 Running     │
│  ████████░░  78%  · 1m 22s remaining        │
│  TikTok · tt-main-stb        🟡 Stalled     │
│  ██████░░░░  60%  · Last update: 4m ago     │
│  ─────────────────────────────────────────  │
│  [View logs]  [Retry]  [Skip to next phase] │
└─────────────────────────────────────────────┘
```

**Row behavior:**
- ▼ = project row expanded (shows all platforms as inline badges)
- ▶ = project row collapsed (36–44px, click to expand)
- Max visible rows without scroll: 8–10 at 40px row height
- Overflow: "3 more projects" badge at bottom (not scroll)

**Platforms:** YT · TT · IG · BS · LI · FB (icons only in cells, full name in drawer)

---

## View 2 — Research Orchestrator

**Layout:** 25% left (intake, collapses when running) / 75% right (streaming output).

```
┌─────────────────────┬──────────────────────────────────────────────────────┐
│  INTAKE      (25%)  │  OUTPUT                                    (75%)     │
│                     │                                                      │
│  YouTube URL        │  ┄ waiting for input ┄                              │
│  ┌───────────────┐  │                                                      │
│  │ youtube.com/… │  │                                                      │
│  └───────────────┘  │                                                      │
│                     │                                                      │
│  Focus (optional)   │                                                      │
│  ┌───────────────┐  │                                                      │
│  │               │  │                                                      │
│  └───────────────┘  │                                                      │
│                     │                                                      │
│  👁 Watch live  ○   │                                                      │
│  🔬 → Research  ○   │                                                      │
│                     │                                                      │
│  [▶ Process]        │                                                      │
│                     │                                                      │
├─────────────────────┴──────────────────────────────────────────────────────┤
│  ▶  BIBLE RESEARCH                                             [collapsed] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Once job is submitted — intake panel collapses to icon strip:**
```
┌────┬──────────────────────────────────────────────────────────────────────┐
│ ▶  │  OUTPUT                                                              │
│ 📎 │                                                                      │
│    │  1. TRANSCRIPTION                               🟢 streaming        │
│    │  ────────────────────────────────────────────────────────────────    │
│    │  [skeleton reserved height — fills token by token]                   │
│    │  ████████████░░░░░░  67%  ·  4m remaining                           │
│    │                                                                      │
│    │  2. HUMAN SUMMARY                               ⚫ pending           │
│    │  ────────────────────────────────────────────────────────────────    │
│    │  (skeleton header reserved — content fills when phase 1 done)        │
│    │                                                                      │
│    │  3. AI SUMMARY                                  ⚫ pending           │
│    │  ────────────────────────────────────────────────────────────────    │
│    │                                                                      │
│    │  4. ACTIONS                                     ⚫ pending           │
│    │  ────────────────────────────────────────────────────────────────    │
└────┴──────────────────────────────────────────────────────────────────────┘
```

**Key behavior rules:**
- Phase skeleton headers appear INSTANTLY on submit (< 300ms) — never wait for content
- Sections 2–4 are skeleton-reserved but hidden until section above completes
- Each output block capped at fixed height; "Show full" chevron for overflow (no container scroll)
- Input pane: clicking the ▶ icon strip re-expands intake (recoverable)

**Completed state — section 4 (Actions):**
```
│  4. ACTIONS                                         ✅ ready            │
│  ────────────────────────────────────────────────────────────────────    │
│  [↗ Open in NotebookLM]        [🔬 Start Research →]                    │
│                                                                          │
│  Research prompt:                                                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ What counter-arguments exist to Wallace's claims?                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                             [Run Research Orchestrator]                  │
```

**AI Summary format (structured for NotebookLM ingestion):**
```
TOPIC: [topic]
SPEAKER: [name if known]
KEY_CLAIMS: [claim1] [claim2] [claim3]
EVIDENCE_TYPE: [historical|empirical|logical|anecdotal]
CONFIDENCE: [high|medium|low]
RESEARCH_HOOKS: [hook1] [hook2]
```

---

## View 3 — Bible Research (accordion)

Lives below Research Orchestrator. Collapsed by default (36px header row). State persisted in localStorage.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ▼  BIBLE RESEARCH                          [+ New Pipeline]       [▲ close] │
├──────────────────────────────────────┬───────────────────────────────────────┤
│  PIPELINES               (40%)       │  HISTORY & ACTIONS          (60%)     │
│                                      │                                       │
│  ▼ gospel-dialogue-001               │  DOCUMENT HISTORY                     │
│  ──────────────────────────────────  │  ──────────────────────────────────── │
│    📄 pipeline/source-summary.md     │  final-follow-up-letter-v4  05-20 ✅  │
│    📄 pipeline/gospel-v4-plan.md     │  final-follow-up-letter-v3  05-18     │
│    📄 pipeline/gospel-v4-draft.md    │  final-follow-up-letter-v2  05-15     │
│    📄 final-follow-up-letter-v4 ← ● │  (archived)                           │
│                                      │                                       │
│  ▼ atheism-dialogue-001              │  NEW RESEARCH                         │
│  ──────────────────────────────────  │  ──────────────────────────────────── │
│    📄 01-original-paper.md           │  Pipeline: [gospel-dialogue-001  ▾]   │
│    📄 final-sendable-response-v3 ← ●│                                       │
│                                      │  Prompt:                              │
│  [+ Add pipeline]                    │  ┌──────────────────────────────────┐ │
│                                      │  │                                  │ │
│                                      │  └──────────────────────────────────┘ │
│                                      │                                       │
│                                      │  [▶ Run Pipeline]  [⏹ Stop current]  │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

**Behavior:**
- ← ● = current latest output file (highlighted)
- File names: Obsidian deeplink on click
- Pipeline selector defaults to whichever pipeline is active in left panel
- "Stop current" grayed when nothing is running
- Accordion open state persisted in localStorage

---

## View 4 — Design Orchestrator

**Layout:** 40% left (conversation) / 60% right (live PRD).

```
┌──────────────────────────────┬───────────────────────────────────────────────┐
│  CONVERSATION        (40%)   │  LIVE PRD                             (60%)   │
│                              │                                               │
│  ┌──────────────────────┐    │  ACTIVE SKILLS                               │
│  │ 🤖 What are you      │    │  [/design-system] [/web-design] [/taste-skill]│
│  │    building?         │    │  (badges auto-update as conversation builds)  │
│  └──────────────────────┘    │                                               │
│                              │  ─────────────────────────────────────────── │
│  ┌──────────────────────┐    │                                               │
│  │ 👤 A landing page    │    │  PRD: Yeshua Academy Landing Page            │
│  │    for YA — intake   │    │  ─────────────────────────────────────────── │
│  │    funnel.           │    │  Project type:  Landing page / Funnel         │
│  └──────────────────────┘    │  Scenario:      NEW                          │
│                              │  Audience:      (pending Q2)                 │
│  ┌──────────────────────┐    │  Tone:          (pending)                    │
│  │ 🤖 Who is the        │    │  Goal:          New student intake           │
│  │    audience?         │    │                                               │
│  └──────────────────────┘    │  Components so far:                          │
│                              │  • Hero (headline + CTA)                     │
│  ┌──────────────────────┐    │  • Social proof strip                        │
│  │ 👤 [typing…]         │    │  • Programme overview cards                  │
│  └──────────────────────┘    │  • Intake form                               │
│  ────────────────────────    │                                               │
│  ┌──────────────────────┐    │  ⚙ Next: DESIGN.md discovery                │
│  │ Your answer…         │    │    (auto-runs after Q3 answered)             │
│  └──────────────────────┘    │                                               │
│  [Send ↵]                    │  [↗ Export PRD]  [▶ Generate DESIGN.md]      │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

**Behavior:**
- Skill badges auto-update as conversation progresses — new ones appear, irrelevant fade
- PRD builds live — each Q&A fills a new field
- "Generate DESIGN.md" activates only when PRD has: project type + audience + tone
- "Export PRD" always available (exports partial state)

---

## Key architectural decisions

| Decision | Rationale |
|---|---|
| Right-side drawer (not full-page nav) | Preserves overview context; Temporal pattern, proven for orchestrator UIs |
| Platform badges inline in cells (not sub-rows) | Prevents 6x row explosion; GitHub Actions job matrix pattern |
| Phase column compression when idle | Progressive swimlane compression; Airflow/GitHub Actions |
| 25/75 intake/output split (collapses to icon) | Output is the primary concern; v0.dev/Perplexity pattern |
| Skeleton headers appear on submit (< 300ms) | Time-to-first-feedback; NNG/Perplexity research |
| Output sections capped at fixed height | Preserves no-scroll constraint; internal expand on demand |
| Accordion for Bible Research | NNG: correct for subset-at-a-time content; not for parallel comparison |
| 36–44px collapsed row height | NNG hard number: allows 8–12 rows visible without scroll |
| 5-state status vocabulary only | IDLE · RUNNING · PARTIAL · DONE · ERROR — anything more creates cognitive overhead |

---

## Sources

- Airflow Grid View documentation
- Temporal Web UI documentation
- GitHub Actions visualization graph + Primer design system
- Nielsen Norman Group: progress indicators, tabs, accordions
- n8n workflow library UI
- v0.dev, Perplexity (streaming output patterns)
