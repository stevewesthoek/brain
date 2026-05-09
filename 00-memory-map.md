# Memory Map — Brain Repo

This file tells AI agents where to retrieve Brain repo context without loading the whole repo.

Use this before answering AI-system, tooling, skill, config, runbook, automation, or operations questions.

## Default Retrieval Protocol

1. Classify the user's request.
2. Check the routing table below.
3. Search the smallest relevant folder first.
4. Read the most relevant files.
5. State when context was not found.
6. Save durable output only in the correct location.

## High-Level Routing

| User asks about | Search first | Then search |
|---|---|---|
| How brain works | `AGENTS.md`, `00-start-here.md`, `README.md` | `CLAUDE.md` |
| Current AI-system context | `00-current-context.md` | `operations/decision-log.md` |
| Skills/orchestrators | `docs/skills/skill-index.md`, `ai/skills/` | `docs/skills/skill-loading-architecture.md` |
| Active skill profiles | `docs/skills/profiles/` | `tools/scripts/switch-skill-profile.mjs` |
| Claude Code global behavior | `operations/system-configs/claude/CLAUDE.md` | `operations/system-configs/claude/README.md` |
| Codex global behavior | `operations/system-configs/codex/AGENTS.md` | `operations/system-configs/codex/README.md` |
| Gemini global behavior | `operations/system-configs/gemini/GEMINI.md` | `operations/system-configs/gemini/` |
| AI policy / guardrails | `ai/policy/` | global configs |
| Human writing guardrails | `operations/standards/human-writing-guardrails.md` | `operations/runbooks/human-writing-guardrails-adoption.md`, `docs/skills/skill-index.md` |
| Runbooks/procedures | `operations/runbooks/` | `operations/standards/` |
| Operational decisions | `operations/decision-log.md` | relevant runbook/spec |
| Scripts/tools | `tools/README.md`, `tools/scripts/` | tool-specific folder |
| Infrastructure/deploy | `operations/infrastructure/`, `operations/deploy/` | `operations/runbooks/` |
| ProBot/runtime | `projects/probot/`, `runtime/` | `operations/decision-log.md` |
| Personal strategy/research/tasks | `mind` repo, not brain | `/Users/Office/Repos/stevewesthoek/mind/00-memory-map.md` |

## Skill Routing

| Need | Search first |
|---|---|
| List available skills | `docs/skills/skill-index.md` |
| Understand active/default profile | `docs/skills/profiles/default.txt` |
| Research skills | `ai/skills/custom/research/`, `ai/skills/custom/bible-research/`, `docs/skills/profiles/research.txt` |
| Code orchestrator | `ai/skills/custom/code/SKILL.md` |
| Web orchestrator | `ai/skills/custom/web/SKILL.md` |
| Design orchestrator | `ai/skills/custom/design/SKILL.md` |
| Video orchestrator | `ai/skills/custom/video/SKILL.md` |
| Memory orchestrator | `ai/skills/custom/memory/SKILL.md` |
| Skill loading architecture | `docs/skills/skill-loading-architecture.md` |
| Switch/sync profiles | `tools/scripts/switch-skill-profile.mjs`, `tools/scripts/sync-ai-skills.mjs` |

## Global Config Routing

| Need | Location |
|---|---|
| Claude Code global startup/context | `operations/system-configs/claude/CLAUDE.md` |
| Claude Code config docs | `operations/system-configs/claude/README.md` |
| Codex global startup/context | `operations/system-configs/codex/AGENTS.md` |
| Codex runtime config | `operations/system-configs/codex/config.toml` |
| Gemini global startup/context | `operations/system-configs/gemini/GEMINI.md` |
| Tool config overview | `operations/system-configs/README.md` |

Treat these as high-impact. Use exact patches and preserve secrets boundaries.

## Brain vs Mind Routing

Use `brain` for:

- AI skills
- orchestrators
- global AI behavior
- tool configs
- runbooks
- automations
- scripts
- operational decisions
- model routing
- guardrails
- deployment/infrastructure docs

Use `mind` for:

- Steve's personal memory
- business/ministry strategy
- Bible/theology research
- marketing/business research
- tasks/projects/areas
- personal convictions
- Yeshua Academy/ProChat/Arkware canonical business or ministry truth

Mind path:

```text
/Users/Office/Repos/stevewesthoek/mind
```

Mind entrypoints:

```text
AGENTS.md
00-start-here.md
00-current-context.md
00-memory-map.md
```

## Natural Language Save Rules

| User says | Save default |
|---|---|
| "make this AI-wide" | global config under `operations/system-configs/` plus docs |
| "add a skill" | `ai/skills/custom/` or vendor source; profile docs; sync/check |
| "document this workflow" | `operations/runbooks/` |
| "record this architecture decision" | `operations/decision-log.md` after confirmation |
| "save this personal research" | `mind/06-resources/research/` |
| "remember this about me" | `mind`, not brain |
| "create a task/project" | `mind/04-tasks/` or `mind/03-projects/` |

## Write Safety

Prefer creating/updating documentation over broad rewrites.

Ask before:

- deleting, moving, or renaming files
- changing active skill profiles
- editing global configs
- touching credentials-related files
- changing deploy/infrastructure config
- modifying package/dependency files
- rewriting decision logs
- bulk edits

Use dry-run/check commands where available.

## Verification Habits

For skill changes:

```bash
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

For profile application:

```bash
node tools/scripts/switch-skill-profile.mjs <profile> --dry-run --verbose
node tools/scripts/switch-skill-profile.mjs <profile> --apply --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

For global config changes, read the changed file and confirm the section was patched exactly.

## Context Quality Rules

When answering from `brain`, say what you checked if it matters.

If search finds nothing, say:

```text
I checked [folder/path/query] and did not find a canonical note yet.
```

Then recommend a safe location for the new documentation or decision.
