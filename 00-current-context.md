# Current Context — Brain

This file is the compact current-context layer for AI sessions that need AI-system context.

Agents should read this early when working on AI infrastructure, skills, configs, runbooks, automations, or cross-agent workflows. It is not exhaustive; use `00-memory-map.md` to retrieve supporting files.

## Status

```yaml
status: draft
last_reviewed: 2026-05-09
owner: Steve Westhoek
purpose: Keep AI sessions oriented on the Brain repo without loading the whole repo.
```

## Current Operating Model

Steve uses two paired repos:

```text
brain = AI operating system
mind  = personal memory and knowledge system
```

The `brain` repo contains AI infrastructure, shared skills, system configs, tooling, runbooks, operations docs, and automation logic.

The `mind` repo contains Steve's personal knowledge, strategy, convictions, business/ministry context, projects, tasks, and research.

## Current Always-Available AI Context Decision

AI sessions should know both repos exist:

```text
/Users/Office/Repos/stevewesthoek/brain
/Users/Office/Repos/stevewesthoek/mind
```

But agents should not load either repo fully.

They should:

1. Read the repo-specific AI entrypoint files when relevant.
2. Use each repo's memory map.
3. Search/read only relevant files.
4. Keep the current working repo as the implementation target.
5. Treat `brain` and `mind` as context sources when started elsewhere.

## Current Skill Architecture

The default active skill set is intentionally compact.

Always-on orchestrators include broad entry points such as:

```text
code
design
video
research
memory
review
qa
handoff
careful
```

Domain-specific or deeper skills should live in profiles and source folders without bloating the default active set.

Key docs:

```text
docs/skills/skill-loading-architecture.md
docs/skills/skill-index.md
docs/skills/profiles/default.txt
docs/skills/profiles/research.txt
```

## Current Research Architecture

`/research` is a broad always-on research orchestrator.

`/bible-research` is a specialist domain skill and should remain limited to the research profile unless it becomes a frequent always-on need.

Research outputs should usually be saved to `mind`, not `brain`:

```text
/Users/Office/Repos/stevewesthoek/mind/06-resources/research/
```

Brain holds the skills and runbooks that define how research works.
Mind holds the research content itself.

## Current Global AI Config Areas

Global configs live in:

```text
operations/system-configs/claude/
operations/system-configs/codex/
operations/system-configs/gemini/
```

These are high-impact because they affect every AI session.

## Current Context Efficiency Tools

Large local context is handled by explicit Brain-native helpers:

```text
rtk                  shell-output optimization
brain-compress       reversible compression for large JSON/log/text
brain-learn-failures advisory failure-pattern reports before learner promotion
```

These are available by default through `~/.local/bin` and are referenced in Claude, Codex, Gemini, and Brain repo instructions. They do not proxy model calls or replace the AI Model Selector.

## Current Writing Defaults

When the user says:

| Natural language request | Default action |
|---|---|
| "add/update a skill" | use `ai/skills/`, update docs/profile, sync/check |
| "change Claude/Codex/Gemini behavior" | update `operations/system-configs/` carefully |
| "make this AI-wide" | update global configs and relevant runbooks |
| "document this procedure" | create/update `operations/runbooks/` |
| "record this AI-system decision" | append/update `operations/decision-log.md` only when confirmed |
| "save personal research/context" | use `mind`, not `brain` |
| "remember this about me/my strategy" | use `mind`, not `brain`, unless it is an AI-system preference |

## Maintenance Rule

Keep this file compact. It should orient the AI, not become the whole repo.

When context grows, link to dedicated docs instead of pasting everything here.
