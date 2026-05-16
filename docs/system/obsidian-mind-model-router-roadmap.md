# Obsidian Mind + Model Router Roadmap

**Date:** 2026-05-16
**Status:** accepted direction for planning
**Related:** `docs/system/obsidian-brain-core-roadmap.md`

## Decision

The `mind` repo will become an unnumbered, Obsidian-first, model-router-maintained personal operating memory.

The `brain` repo will own the executable infrastructure: Brain Core API, model-router implementation, scheduler integration, skills, orchestrators, and machine-level automations.

Obsidian remains the only primary human dashboard. Brain Core exposes machine and scheduler state. The model router continuously keeps `mind` small, coherent, useful, and fast.

## Final Mental Model

```text
Obsidian = human cockpit
mind     = personal memory, live work, compiled wiki, sources, archive
brain    = machine intelligence, model router, Brain Core API, scheduler, skills
Brain Core API = safe machine and scheduler boundary
Model Router = AI steward for mind + brain workflows
Save-to-Mind = official capture ingress
Office Nightly Scheduler = automatic maintenance lane
```

## Target `mind` Structure

Folder names are intentionally unnumbered. Visual ordering in Obsidian should use the Manual Sorting / Custom Sort plugin rather than numeric prefixes.

```text
mind/
  HOME.md
  TODAY.md
  README.md
  AGENTS.md

  router/
    current.md
    map.md
    rules.md
    taxonomy.md
    maintenance.md
    model-router.md

  capture/
    inbox/
    daily/
    failed/

  live/
    dashboard.md
    tasks.md
    projects.md
    workflows.md
    decisions.md

  wiki/
    index.md
    people.md
    organisations.md
    business.md
    faith.md
    family.md
    health.md
    finance.md
    content.md
    ai.md
    tools.md

  sources/
    index.md
    web/
    books/
    papers/
    transcripts/
    files/

  archive/
    index.md
    completed/
    old/
```

## Manual Sort Decision

Use Option B: clean folder names plus a manual sorting Obsidian plugin.

Rules:

- Do not reintroduce numeric prefixes just for sorting.
- The human dashboard is `HOME.md`; folder order is a convenience, not architecture.
- If the manual sorting plugin is unavailable, Obsidian remains usable through `HOME.md` and links.

## Save-to-Mind Direction

Save-to-Mind remains permanent.

Current state:

```text
ChatGPT/local shortcut -> n8n /webhook/mind-inbox -> Gemini -> mind/01-inbox/
```

Target state:

```text
ChatGPT/local shortcut -> n8n /webhook/mind-inbox -> Gemini -> mind/capture/inbox/
```

Keep the public webhook path `/mind-inbox` for compatibility. Change the internal target path after the new folder structure and router contract exist.

Failure buffer target:

```text
mind/capture/failed/
```

## Model Router Placement

The model-router implementation belongs in `brain`, because it is executable infrastructure.

Target location:

```text
brain/projects/model-router/
```

The `mind/router/` folder contains the vault contract consumed by the model router, not the implementation.

```text
mind/router/current.md      short-term context
mind/router/map.md          retrieval map
mind/router/rules.md        write and safety rules
mind/router/taxonomy.md     allowed note types, domains, tags
mind/router/maintenance.md  loop definitions and thresholds
mind/router/model-router.md human-readable contract
```

## Scheduler Direction

The existing Office nightly scheduler is the right execution lane for automatic vault maintenance.

The scheduler should run these model-router jobs:

1. Compile loop — captures/sources into wiki.
2. Memory loop — promote important facts, refresh current context, expire stale short-term memory.
3. Hygiene loop — deduplicate, prune, split oversized files, detect stale captures/tasks.
4. Drift/error loop — verify folder contract, schemas, broken links, Brain Core availability, Save-to-Mind output path, stale scheduler state.

Brain Core should expose scheduler state and safe controls:

```text
GET  /scheduler/status
GET  /scheduler/latest-run
GET  /scheduler/jobs
POST /scheduler/jobs/:id/request-run
```

Mutation endpoints must remain approval-aware and local-only.

## Model-Agnostic Router Policy

The model router is the LLM interface from the user's perspective. Claude, Codex, Gemini, and local models are interchangeable workers beneath it.

Default division of labor:

```text
local/small model  -> classify, tag, lint, dedupe, simple summaries
Gemini Flash       -> bulk preprocessing and large-context compression
Claude Haiku       -> routine vault maintenance and simple writing
Claude Sonnet      -> synthesis, strategy, architecture, multi-file reasoning
Claude Opus        -> high-risk decisions and final architecture review
Codex              -> repo edits, code changes, validation
local multimodal   -> private/local media processing where available
```

## Anti-Clutter Rules

Hard limits should prevent the system from becoming slow or bloated:

```text
router/current.md      max 150 lines
TODAY.md               max 200 lines
live/tasks.md          max 300 lines
live/projects.md       max 250 lines
wiki/*.md              target max 500 lines
capture/inbox/         no files older than 7 days
capture/failed/        no files older than 3 days without retry/review
```

When a file exceeds limits, the model router must summarize, split, archive, or compile it.

## Expansion Rule

Every new thing follows one pipeline:

```text
capture -> classify -> route -> compile -> dashboard -> maintain
```

New knowledge:

```text
Save-to-Mind -> capture/inbox -> model router -> wiki/sources/live/archive
```

New skill:

```text
brain/ai/skills -> skill index -> Brain Core skill adapter -> mind/live/workflows.md
```

New orchestrator:

```text
brain or external repo -> Brain Core adapter -> mind/live/workflows.md -> Obsidian dashboard card
```

New project:

```text
capture or user request -> live/projects.md -> live/tasks.md -> wiki if durable
```

## Success Criteria

- Obsidian is the only daily dashboard.
- `mind` has clean unnumbered folders.
- Save-to-Mind lands in `capture/inbox/` and never loses captures.
- Brain Core exposes scheduler status and model-router job results.
- The Office nightly scheduler runs compile, memory, hygiene, and drift/error loops.
- The model router keeps notes small, deduplicated, linked, and current.
- New skills, orchestrators, projects, and knowledge all enter through one predictable flow.
- The user experiences the system as a black box that stays organized automatically.
