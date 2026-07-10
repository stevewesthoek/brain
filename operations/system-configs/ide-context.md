# IDE Context Contract — Brain + Mind

This file is the IDE-facing context contract for Cursor, Kiro, Antigravity, and any future AI-enabled editor.

## Purpose

AI CLIs and AI IDEs should share the same context model:

```text
brain = AI operating system
mind  = Steve's personal memory
```

The IDE should not load both repositories fully by default. It should know where they are, read the entrypoints when relevant, and retrieve only the context needed for the current task.

## Canonical Context Repos

```text
/Users/Office/Repos/stevewesthoek/brain
/Users/Office/Repos/stevewesthoek/mind
```

## Brain Entry Points

Use these for AI-system, tooling, config, skill, automation, model routing, guardrail, runbook, and operational questions:

```text
/Users/Office/Repos/stevewesthoek/brain/AGENTS.md
/Users/Office/Repos/stevewesthoek/brain/00-start-here.md
/Users/Office/Repos/stevewesthoek/brain/00-current-context.md
/Users/Office/Repos/stevewesthoek/brain/00-memory-map.md
```

## Mind Entry Points

Use these for personal, business, ministry, theology, strategy, project, task, resource, and research questions:

```text
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/AGENTS.md
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-start-here.md
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-current-context.md
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-memory-map.md
```

## IDE Behavior Rule

When an AI-enabled IDE starts inside any repo:

1. Treat the current workspace as the implementation target.
2. Treat `brain` as the AI-system context source.
3. Treat `mind` as the personal/business/ministry/research context source.
4. Do not load either repo fully.
5. Read entrypoints only when the task requires that context.
6. Search/read only relevant folders according to each repo's `00-memory-map.md`.
7. Preserve the boundary: AI-system knowledge goes to `brain`; personal/business/ministry/research knowledge goes to `mind`.

## Good Reasons To Enable This In IDEs

- Consistent behavior across Claude Code, Codex, Gemini, Cursor, Kiro, and Antigravity.
- Fewer repeated explanations from Steve.
- Better project decisions because IDE agents can retrieve strategy and AI-system conventions.
- Safer edits because agents know where canonical rules and guardrails live.
- More reliable natural-language workflows: "save this", "research this", "follow my conventions", and "use my strategy" can route correctly.

## Good Reasons Not To Overload IDEs

- Loading entire repos into every IDE prompt can dilute attention.
- Personal context may be unnecessary for low-level implementation tasks.
- Cross-repo access can increase privacy and blast-radius risk if an IDE agent behaves too broadly.
- IDEs may index large workspaces differently, causing slower or noisier retrieval.
- Current workspace should remain the edit target unless Steve explicitly asks to edit `brain` or `mind`.

## Recommended Policy

Use always-known, on-demand context:

```text
Always know that brain and mind exist.
Read their entrypoints when relevant.
Never auto-load everything.
Never edit cross-repo files unless the user asks or the task clearly requires it.
```

## Tool-Specific Notes

- Cursor: shared active skills are exported to `operations/system-configs/cursor/skills`; the tracked lightweight pointer is `operations/system-configs/cursor/AGENTS.md`. Cursor supports persistent rules and AGENTS.md-style guidance, so keep this file short and point to this contract instead of duplicating the full architecture.
- Kiro: shared active skills are exported as per-skill entries; Kiro global steering belongs under `~/.kiro/steering/`. The exact setup is documented in `operations/runbooks/kiro-global-steering-setup.md` because the current BuildFlow write policy blocks creating `operations/system-configs/kiro/**` directly.
- Antigravity: shared skills are exported via the Gemini/Antigravity skills path; persistent global behavior comes from `operations/system-configs/gemini/GEMINI.md` in this setup. Do not create a second divergent Antigravity global rule unless Antigravity's documented behavior changes.
