# AGENTS.md — Brain Repo AI Entry Point

This repository is Steve Westhoek's AI operating system.

It is the source of truth for AI infrastructure, shared skills, global tool configs, orchestrators, runbooks, automations, scripts, deployment procedures, model routing, guardrails, and machine-facing workflows.

## Read This First

Every AI agent working with this repo must start here.

Then read, in this order:

1. `00-start-here.md` — high-level map and operating model.
2. `00-current-context.md` — current AI-system priorities and active context.
3. `00-memory-map.md` — where to search for AI/tooling/config context.
4. `README.md` — full repo structure and contribution contract.
5. `CLAUDE.md` — Claude/repo-specific behavior and detailed operational rules.

Do not scan the whole repo blindly. Use the memory map, then search/read only the relevant files.

## Structural Memory And Exact-Source Authority

For architecture, symbol, route, caller/callee, or blast-radius questions, use the admitted Codebase Memory MCP structural index first **when its B8.3 freshness state is fresh**. Use it to narrow files, symbols, and relationships; it is navigation memory, not authority. Start `search_code` navigation in `files` mode with at most 5 candidates; escalate to compact metadata only when relationships require it, and never request full source from structural memory.

Then read the exact current source before editing, making security/policy decisions, asserting runtime/provider truth, or making a final factual claim. Known-file and known-symbol work may go directly to exact source.

If structural memory is stale, unavailable, or freshness is unknown, skip it and use ordinary bounded repository search/read. Never widen that fallback into a blind whole-repository scan.

Generated projections, including Graphify artifacts, are navigation hints only. They cannot authorize writes, override roadmaps/status/decision logs, or replace exact source verification. Graphify is not the structural default and remains frozen until its bounded B8.5 semantic role is accepted.

Canonical contract: `operations/specs/b8-4-agent-retrieval-policy.json`.

## Core Mental Model

```text
brain = AI operating system: skills, tools, automations, configs, runbooks
mind  = Steve's personal memory: knowledge, strategy, convictions, projects, tasks, research
```

Use `brain` for AI capabilities and operating system work.
Use `mind` for Steve-specific personal, business, ministry, task, strategy, and research context.

## Cross-Repo Rule

These two repos are paired but independent:

```text
/Users/Office/Repos/stevewesthoek/brain
/Users/Office/Repos/stevewesthoek/mind
```

When the user asks how an AI/tool/automation works, consult `brain`.
When the user asks what Steve believes, plans, knows, decided, is researching, or needs personally/business/ministry-wise, consult `mind`.

When a task touches both, keep the boundary clear:

```text
brain changes the AI system.
mind stores the personal/business/ministry knowledge used by the AI system.
```

Efficient Mind startup:

```text
/Users/Office/Repos/stevewesthoek/mind/system/agent-context/AGENTS.md
→ 00-start-here.md
→ 00-current-context.md when current state matters
→ 00-memory-map.md
→ targeted domain reads only
```

The planned Context Gateway will become the preferred retrieval interface after it passes its evaluation and fallback gates. Until then, use the startup sequence above.

## Non-Negotiable Safety Rules

Do not expose, print, commit, or move secrets:

- `.env` values
- API keys
- OAuth tokens
- private keys
- cookies
- session logs
- service account credentials
- auth files
- machine-local runtime secrets

Do not casually edit or delete:

- `operations/system-configs/**`
- `ai/skills/active/**`
- `operations/decision-log.md`
- `tools/scripts/**`
- `operations/runbooks/**`
- `package.json` / lockfiles
- Docker, deploy, CI/CD, or migration files

Ask or use dry-run/preflight before high-risk changes.

## What Belongs In Brain

| Information type | Default location |
|---|---|
| Shared AI skills | `ai/skills/` |
| Skill profiles and loading docs | `docs/skills/` |
| AI policies | `ai/policy/` |
| Reusable prompts | `ai/prompts/` |
| Global tool configs | `operations/system-configs/` |
| Runbooks and procedures | `operations/runbooks/` |
| Standards | `operations/standards/` |
| Operational decisions | `operations/decision-log.md` |
| Utility scripts | `tools/` |
| Project-specific AI/runtime docs | `projects/` |
| Local runtime support | `runtime/` |

## What Does Not Belong In Brain

Do not store personal strategy, theology, Bible notes, business research, marketing research, task lists, or personal convictions here unless they are specifically AI-system configuration or automation instructions.

Those belong in:

```text
/Users/Office/Repos/stevewesthoek/mind
```

## Natural Language Routing

When the user says:

- "make the AI remember this" → use `mind` unless it is a global AI-system rule.
- "add a skill" → use `brain/ai/skills/` and sync profiles.
- "update Claude/Codex/Gemini behavior" → use `brain/operations/system-configs/`.
- "what is my strategy?" → use `mind`.
- "how should agents route this?" → use `brain` and possibly `mind`.
- "research this" → use `/research`; save durable personal research in `mind/resources/research/` or `mind/faith/resources/` unless it is AI-system research.

## Good AI Session Behavior

A good session:

1. Starts from this file and the 00-* entrypoint files.
2. Retrieves only relevant docs.
3. Preserves the brain/mind boundary.
4. Uses skills/orchestrators naturally.
5. Runs dry-runs before risky AI-system changes.
6. Updates docs when changing architecture.
7. Does not commit or expose secrets.

## Context Efficiency

Agents should reduce context cost automatically when it is clearly useful:

- Use `rtk` for noisy shell commands.
- Use `brain-compress` for large local JSON, logs, or text when exact retrieval may be needed.
- Use `brain-learn-failures` before promoting recurring debugging patterns through `/learner`.

These tools are explicit helpers. They do not proxy model calls, replace the AI Model Selector, or create another memory system.

## Related Files

- `00-start-here.md` — concise orientation.
- `00-current-context.md` — current AI-system context.
- `00-memory-map.md` — retrieval map.
- `README.md` — repo structure and contribution contract.
- `CLAUDE.md` — detailed Claude/repo behavior.
- `docs/skills/skill-index.md` — skill/profile index.
- `docs/skills/skill-loading-architecture.md` — active-skill profile architecture.
