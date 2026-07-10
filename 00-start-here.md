# Start Here — Brain Repo

This repo is Steve Westhoek's AI operating system.

Use it as the durable source of truth for AI infrastructure, shared skills, global configs, runbooks, scripts, automation, model routing, guardrails, and operational procedures.

## First Rule

Do not load the whole repo into an AI conversation.

Start with:

1. `AGENTS.md`
2. `00-start-here.md` — this file
3. `00-current-context.md`
4. `00-memory-map.md`

Then search/read only the relevant folders.

## Repo Roles

```text
brain = AI operating system: skills, tools, automations, configs, runbooks
mind  = Steve's personal memory: knowledge, strategy, tasks, research, convictions
```

If the user asks how an AI/tool/automation works, inspect `brain`.
If the user asks what Steve believes, plans, knows, is building, or has decided personally/business/ministry-wise, inspect `mind`.

## Top-Level Structure

```text
ai/          Shared AI-facing assets: skills, prompts, policies, agents
operations/ Runbooks, standards, system configs, deploy/infrastructure docs
docs/        Skill/profile docs and product/project docs
tools/       Utility scripts and local workflow wrappers
projects/    Project-specific context/specs/execution docs
runtime/     Local/runtime support; not canonical truth by default
```

## AI System Entry Points

Agents should use:

```text
AGENTS.md
00-start-here.md
00-current-context.md
00-memory-map.md
README.md
CLAUDE.md
```

Use `README.md` for the repo map and contribution contract.
Use `CLAUDE.md` for detailed Claude/repo operating rules.

## Most Important Areas

### Skills

```text
ai/skills/
docs/skills/
```

Shared skills live in `ai/skills/`. Active/default/domain profile architecture lives in `docs/skills/`.

After activating or installing skills, run the profile/sync checks documented in `docs/skills/skill-loading-architecture.md`.

### Global AI Configs

```text
operations/system-configs/
```

This contains global configs for Claude Code, Codex, Gemini, Cursor, Kiro, Antigravity, and other tools. Treat as high-impact.

### Runbooks and Decisions

```text
operations/runbooks/
operations/standards/
operations/decision-log.md
```

Use runbooks for procedures, standards for durable rules, and decision-log for confirmed operational/architecture decisions.

### Tools

```text
tools/
```

Utility scripts and wrappers used by the AI system.

## Brain/Mind Boundary

Do not store personal research or strategy in `brain` by default.

Personal research belongs in:

```text
/Users/Office/Repos/stevewesthoek/mind/resources/research/
```

Mind agent entrypoints live under:

```text
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/
```

Read its `AGENTS.md`, start/current context as needed, and memory map before targeted Mind retrieval. Do not load the vault.

AI-system research, skill documentation, tool runbooks, and automation docs belong in `brain`.

## When Unsure

Use safe defaults:

- AI tool/skill/config/runbook → `brain`
- Personal/business/ministry/research/task/conviction → `mind`
- Current implementation repo remains the working target
- `brain` and `mind` are context sources, not always the edit target

Ask before destructive edits, bulk rewrites, profile changes, deploy/config mutations, or anything involving secrets.
