# Obsidian Mind + Model Router Roadmap

**Date:** 2026-05-16
**Status:** accepted direction for planning
**Related:** `docs/system/obsidian-brain-core-roadmap.md`

## Decision

The `mind` repo will become an unnumbered, Obsidian-first, model-router-maintained personal operating memory.

The `brain` repo will own the executable infrastructure: Brain Core API, model-router implementation, scheduler integration, skills, orchestrators, and machine-level automations.

Obsidian remains the only primary human dashboard. Brain Core exposes machine and scheduler state. The model router continuously keeps `mind` small, coherent, useful, and fast.

## Obsidian Command Center Dashboard

The Brain Console plugin provides a polished black-box Obsidian dashboard that replaces ad-hoc browsing of raw Markdown files.

**Visual direction:** dark gray-black cockpit (#0a0e27), monospaced system data, warm red-orange accents (#ff6b3d), sparse card layout, progressive disclosure.

**Dashboard cards:**
- Wiki Health: model-router lint status and error/warning counts
- Maintenance Previews: proposed maintenance queue from model-router
- Approvals: pending approval requests from Brain Core
- Scheduler Status: nightly job queue and last-run health
- Brain Core: runtime/execution status and readiness gates
- Next Safe Action: recommended action from Brain Core/model-router
- (optional) Captures: today's saved notes
- (optional) Latest Preview: most recent maintenance preview artifact

**Action row:**
- Refresh (poll all endpoints)
- Request Dry Run (trigger model-router preview)
- View Latest (inspect latest artifact/preview)
- Open Mind (navigate to mind vault in Obsidian)
- Open Wiki Log (jump to wiki/log.md)

**Safety:** all endpoints are read-only; all action buttons request approval or fire request-only signals; no Mind mutations; plugin never writes Obsidian settings.

**Data sources:** Brain Core `/status`, `/runtime/reports`, `/execution/maintenance-previews`, `/approvals`, `/scheduler/jobs`.

## Current Status

- Report-only model-router dry-run and Brain Core preview/status surfaces are complete.
- Preview-only wiki-health linting is now available in dry-run reports.
- `wiki/log.md` exists as the append-only maintenance ledger for Mind.
- Write/apply behavior for Mind remains blocked pending the approved policy and tests.
- Legacy numbered-folder archival remains blocked until a separate validated cleanup phase.
- Obsidian Command Center dashboard specification is complete; implementation underway.

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

## Karpathy LLM Wiki Alignment

The roadmap intentionally follows the LLM Wiki pattern where durable knowledge compounds in a maintained markdown wiki instead of being re-derived from raw documents on every query.

Lean additions from the 2026-05-17 alignment review:

- Raw sources and original captures are source-of-truth material and must not be silently rewritten.
- Compiled `wiki/` and `live/` pages are the model-router-maintained synthesis layer.
- `wiki/index.md` remains the content catalog.
- `wiki/log.md` should become an append-only human-readable maintenance ledger for ingests, compilations, lint passes, important queries, and accepted updates.
- Lint/health checks must run before any approved write/apply phase: contradictions, stale claims, orphan pages, missing links, missing source trace, oversized files, stale captures, and failed captures.
- Keep the Obsidian dashboard sparse: changed, failed, needs approval, and continue-next only.

Related review:

```text
docs/system/1779040171684-karpathy-llm-wiki-alignment-review-2026-05-17.md
```

## ProBot Dashboard Migration into Obsidian Command Center

**Decision:** Obsidian Brain Console replaces ProBot web dashboard as the primary system cockpit. All valuable ProBot features migrate through Brain Core APIs. ProBot remains legacy/secondary until Brain Console reaches feature parity.

**Principles:**
- Brain Console is primary (Obsidian), ProBot is secondary (web)
- Brain Core is the integration API layer (all features expose through read-only HTTP)
- Logic stays in Brain repo (no logic in Obsidian plugin)
- Mind remains durable Markdown memory and fallback dashboard
- No direct shell execution from Obsidian plugin
- All actions are read-only, safe navigation, or approval-request-only
- Credentials stay in ProBot or out of dashboards entirely
- Features migrate only if they add real value

**Features analyzed (full inventory: `docs/system/probot-to-brain-console-migration-review-2026-05-17.md`):**

| Feature | Scope | Decision | Phase |
|---------|-------|----------|-------|
| Local app status | HIGH | KEEP | 2A |
| Local app start/stop | HIGH | REDESIGN | 5 |
| Orchestrator registry | HIGH | NEW API | 3 |
| Orchestrator run | MEDIUM | REDESIGN | 5 |
| Session history | MEDIUM | KEEP | 2B |
| Domain/project overview | MEDIUM | NEW API | 4 |
| Video orchestrator status | MEDIUM | REDESIGN | 3 |
| Viral Flow summary | MEDIUM | REDESIGN | 3 |
| System updates | MEDIUM | REDESIGN | 5 |
| Buildflow verify | LOW | LATER | 5+ |
| Credentials / OAuth | N/A | DROP | - |
| Stripe billing | N/A | DROP | - |
| Production pipeline | LOW | DROP | 6+ |

**Phased rollout:**

1. **Phase 1:** Feature inventory, classification, Brain Core gap analysis → complete
2. **Phase 2A:** Local apps UI section + session history refresh
3. **Phase 2B:** Session cards + activity panel polish
4. **Phase 3:** Orchestrator registry read-only API + Brain Console section
5. **Phase 4:** Domain/project registry read-only API + Brain Console section
6. **Phase 5:** Approval-gated actions (app start/stop, orchestrator run request, updates)
7. **Phase 6:** Visual refinement, ProBot deprecation, final transition

**Brain Core new endpoints (Phases 2-5):**

- `GET /orchestrators` — registry of all orchestrators (model-router, video, design, code, research, Bible research, scheduler, capture)
- `GET /domains` — domain/project overview (Brain/Mind, Says the Bible, active projects)
- `POST /actions/request` — approval-request-only endpoint for app/orchestrator/system mutations

**Safety guarantees:**
- No credentials exposed
- No arbitrary shell execution
- No direct Mind mutation (goes through model-router)
- All app/orchestrator controls approval-gated
- Plugin is read-only except for safe approval requests

**Success criteria for Phase 2A (next):**
- Local apps section renders with app cards
- All app data from `GET /local-apps` displays correctly
- Start/stop buttons visible but disabled with tooltip: "Approval-gated (planned)"
- Tests passing for Brain Core + Brain Console

## Success Criteria

- Obsidian is the only daily dashboard.
- `mind` has clean unnumbered folders.
- Save-to-Mind lands in `capture/inbox/` and never loses captures.
- Brain Core exposes scheduler status and model-router job results.
- Brain Core exposes safe, typed APIs for local apps, orchestrators, domains, system status
- The Office nightly scheduler runs compile, memory, hygiene, and drift/error loops.
- The model router keeps notes small, deduplicated, linked, and current.
- New skills, orchestrators, projects, and knowledge all enter through one predictable flow.
- The user experiences the system as a black box that stays organized automatically.
- ProBot is acknowledged as legacy, Brain Console is primary cockpit

## Current Status

- Report-only execution, preview policy surfaces, and preview artifact inspection are complete in Brain.
- Mind mutation remains blocked until a separately approved write/apply route exists.
- Legacy numbered-folder archival remains blocked until a separate explicit cleanup plan is approved.
- Obsidian Brain Console MVP (MVP status pills + cards) is deployed locally.
- Brain Console Brain Core connection fixed (requestUrl API).
- ProBot feature inventory complete, migration plan drafted.
- Current safe continuation point: Phase 2A (local apps UI section) or approval-gated actions framework.
