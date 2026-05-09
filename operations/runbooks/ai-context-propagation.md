# AI Context Propagation — Brain + Mind

**Status:** Active architecture  
**Last reviewed:** 2026-05-09  
**Scope:** Claude Code, Codex, Gemini CLI, Cursor, Kiro, Antigravity, and future AI-enabled IDEs

---

## Purpose

Steve's AI system depends on two foundational context repositories:

```text
/Users/Office/Repos/stevewesthoek/brain
/Users/Office/Repos/stevewesthoek/mind
```

This runbook documents why both repos must be known to every AI/IDE, how they should be loaded, and why we intentionally use **on-demand retrieval** instead of loading everything into every conversation.

This is not optional tribal knowledge. It is the durable explanation for future maintenance.

---

## Core Model

```text
brain = AI operating system
mind  = personal memory and knowledge system
```

### Brain contains

- AI skills and orchestrators
- active skill profiles
- Claude/Codex/Gemini global configs
- Cursor/Kiro/Antigravity context contracts
- runbooks
- tools and scripts
- model routing
- guardrails
- automation docs
- operational decisions

### Mind contains

- Steve's personal memory
- business and ministry strategy
- Yeshua Academy / ProChat / Arkware context
- theology and convictions
- active projects
- tasks
- research
- resources
- personal knowledge

---

## Design Decision

Every AI/IDE should always know that both repos exist, but should not load both repos fully.

Use this pattern:

```text
Always know the repos.
Always know the entrypoints.
Read entrypoints when relevant.
Search/read only the relevant folders.
Keep the current workspace as the implementation target.
```

---

## Why Not Load Everything?

Full automatic loading is rejected because it creates:

- context flooding
- slower sessions
- diluted model focus
- accidental privacy exposure
- larger blast radius for autonomous tools
- worse retrieval precision
- higher token/cost pressure

The goal is not "maximum context in every prompt."
The goal is "the right context at the right time."

---

## Why Use Cross-Repo Context At All?

Without this architecture, agents started inside app repos may forget:

- where Steve's AI rules live
- where Steve's strategy lives
- where research should be saved
- what the active skill profile means
- which repo should receive a change
- how to distinguish AI-system memory from personal memory

That causes repeated explanations, misplaced files, and inconsistent AI behavior.

Cross-repo context fixes that by giving every agent the same map.

---

## Entry Points

### Brain entrypoints

```text
brain/AGENTS.md
brain/00-start-here.md
brain/00-current-context.md
brain/00-memory-map.md
```

Use these when the task involves:

- AI behavior
- skills
- orchestrators
- global configs
- model routing
- tools/scripts
- automations
- deployment/operations docs
- runbooks
- guardrails

### Mind entrypoints

```text
mind/AGENTS.md
mind/00-start-here.md
mind/00-current-context.md
mind/00-memory-map.md
```

Use these when the task involves:

- Steve-specific context
- business strategy
- ministry strategy
- theology/Bible research
- marketing/business research
- personal projects
- tasks
- resources
- convictions
- prior decisions

---

## Current Implementation

### Claude Code

Global config:

```text
brain/operations/system-configs/claude/CLAUDE.md
```

This file is symlinked into Claude Code's global config and explicitly documents `brain` + `mind` as paired cross-repo context sources.

### Codex

Global config:

```text
brain/operations/system-configs/codex/AGENTS.md
```

Codex also has the `mind` repo listed as trusted in:

```text
brain/operations/system-configs/codex/config.toml
```

### Gemini CLI

Global config:

```text
brain/operations/system-configs/gemini/GEMINI.md
```

This also applies to Antigravity's global-rule path when Antigravity uses the Gemini global configuration.

### Cursor, Kiro, Antigravity, and future IDEs

Shared IDE contract:

```text
brain/operations/system-configs/ide-context.md
```

This file records the IDE-facing behavior rule:

```text
Current workspace = implementation target
brain = AI-system context source
mind = personal/business/ministry/research context source
```

---

## Tool-Specific Rule Locations

These locations are intentionally documented because IDE rule systems change over time and should not be guessed from memory.

### Cursor

Cursor supports persistent instructions through rules and AGENTS.md-style guidance. The brain system uses:

```text
brain/operations/system-configs/cursor/
brain/operations/system-configs/ide-context.md
```

If a stable Cursor global rule file is added, it should contain only a short pointer to the IDE context contract, not a duplicated copy of all rules.

### Kiro

Kiro supports global steering files under:

```text
~/.kiro/steering/
```

If centralized in this repo, the preferred tracked source is:

```text
brain/operations/system-configs/kiro/steering/brain-mind-context.md
```

That file should be symlinked or copied to the Kiro global steering directory according to Kiro's supported setup.

### Antigravity

Antigravity global rules live in:

```text
~/.gemini/GEMINI.md
```

In this system, that maps to:

```text
brain/operations/system-configs/gemini/GEMINI.md
```

So Antigravity receives the same brain+mind global context rule through Gemini global instructions. Do not create a second divergent Antigravity global rule unless Antigravity's documented behavior changes.

---

## Benefits

This architecture gives:

- consistent behavior across AI CLIs and IDEs
- fewer repeated explanations from Steve
- safe context retrieval without flooding
- clear separation between AI-system knowledge and personal memory
- correct save locations for research, strategy, tasks, and skills
- better natural-language routing
- lower risk when agents run inside unrelated app repos
- future-proof documentation for why this setup exists

---

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Context flooding | Entry points only; search/read on demand |
| IDE edits wrong repo | Current workspace remains implementation target |
| Personal data leaks into tooling docs | Use `mind` for personal memory, `brain` for AI-system docs |
| Global rules become stale | This runbook is the canonical explanation; update when tool behavior changes |
| Duplicate instructions diverge | Prefer pointers to `ide-context.md` instead of copying long rules |
| Autonomous IDE mistakes | Keep destructive actions confirmation-gated; do not widen permissions casually |

---

## Maintenance Rules

When changing this architecture:

1. Update this runbook.
2. Update `brain/operations/system-configs/ide-context.md` if IDE behavior changes.
3. Update global configs for Claude/Codex/Gemini if startup rules change.
4. Update `brain/README.md` and `brain/00-memory-map.md` if entrypoints change.
5. Update `mind/AGENTS.md` or `mind/00-memory-map.md` only if personal-memory behavior changes.
6. Do not duplicate large blocks of instructions across many tools unless necessary.
7. Prefer short pointers to canonical docs.

---

## Verification Prompts

Use these in a fresh AI/IDE session:

```text
Before answering, check the brain and mind entrypoints. Which repo should be used for AI skills, and which repo should be used for personal research?
```

Expected answer:

```text
brain = AI skills/configs/orchestrators/runbooks
mind = personal research/strategy/tasks/knowledge
```

Use this from any app repo:

```text
I am inside this app repo. Follow my global AI conventions and tell me where you would save marketing research.
```

Expected answer:

```text
Implementation target = current app repo
AI conventions = brain
Marketing research = mind/06-resources/research/notes/marketing/
```

---

## Non-Goals

This architecture does not mean:

- every conversation loads every file
- every IDE can edit every repo freely
- personal research belongs in brain
- AI-system configs belong in mind
- generated IDE state should be committed
- secrets can be stored in either repo

The system is a routing layer, not a blanket permission expansion.
