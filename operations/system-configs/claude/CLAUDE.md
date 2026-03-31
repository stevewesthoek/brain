# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/model-router`, `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/stb-pipeline`, `/notebooklm`, `/output-skill`, `/redesign-skill`, `/soft-skill`, `/taste-skill`, `/ui-ux-pro-max`, `/web-design`, `/stripe`, `/ffmpeg`, `/gh`, `/dokploy`, `/supabase`, `/gws`, `/cloudflare`, `/forge`

# Skills structure

Skills live in `brain/ai/skills/` with three directories:

- `active/` — symlinks only, what Claude reads (via `~/.claude/skills -> active/`)
- `vendors/` — third-party skill sources (e.g. `vendors/gstack/`)
- `custom/` — first-party skill sources

When installing a new skill:
1. Place the source in `vendors/<vendor>/` or `custom/`.
2. Create a symlink in `active/` pointing to the source (e.g. `ln -s ../vendors/gstack/foo active/foo`).
3. Never put raw skill folders directly in `active/`.

# Memory system

Use a 4-layer memory model:

1. **Global memory** — this file (`~/.claude/CLAUDE.md`). Stable personal workflow rules and global conventions that apply in every session.
2. **Repo memory** — `CLAUDE.md` at each repo root. Repo-specific architecture decisions, commands, constraints, and conventions.
3. **Auto memory** — Claude Code auto memory for repeated corrections and stable preferences learned over time.
4. **Decision log** — `decision-log.md` (location is repo-specific). Confirmed decisions, successful recovery steps, stable conventions. Not temporary notes or speculative ideas.

# Memory policy

Only store:
- stable workflow preferences
- architecture decisions
- successful commands and recovery steps
- repo-specific conventions
- repeated corrections
- information that will likely matter again

Do not store:
- one-off debugging noise
- temporary tasks
- speculative ideas
- transient session chatter
- secrets, tokens, or credentials

When ending a meaningful session:
1. Summarize confirmed decisions briefly.
2. Update the relevant repo `CLAUDE.md` or `decision-log.md` if needed.
3. Prefer concise, durable memory over verbose history.

# Repo CLAUDE.md template

When asked to add a `CLAUDE.md` to a new repo, use this baseline and expand with project-specific context:

---
# CLAUDE.md — [Repo name]

## Purpose
Repo-specific instructions and durable context for Claude Code.

## Workflow
- Work only within this repo unless explicitly told otherwise.
- Prefer surgical changes over broad rewrites.
- Preserve existing architecture and conventions unless asked to change them.
- Before major structural changes, inspect and explain the proposed plan.

## Architecture
[Key tech stack, folder structure, and important constraints.]

## Commands
[Important dev, build, test, and deploy commands.]

## Do not break
[Critical rules, assumptions, or conventions.]

## Integrations
Global skills are available in every session — only note the ones relevant to this repo.
- Stripe: [yes/no] — use `/stripe` for CLI ops (webhook forwarding, test events, auth); keys in `.env`
- NotebookLM: [yes/no] — use `/notebooklm` for research, source synthesis, and briefing docs
- Codex: [yes/no] — use `/codex` for AI-assisted code review and adversarial challenge mode

## Memory
Use this file for repo-specific decisions, commands, and constraints.
Use `decision-log.md` (if present) for confirmed architecture and workflow decisions only.
---

# Model routing policy

Route tasks to agents by cost and complexity. Do not ask the user which model to use — route automatically.

| Agent | Model | Use when |
|-------|-------|----------|
| `cheap-prep` | Haiku | Summarization, file triage, context compaction, commit drafting |
| `coder-default` | Sonnet | All normal coding (default) |
| `deep-architect` | Opus | Complex architecture, high blast radius, repeated failures |

Before escalating to Opus: compact context with `cheap-prep` first.
After significant decisions: write a short durable summary for the repo's `decision-log.md`.
See `/model-router` for full policy.

# Codex second-opinion policy

Codex CLI is available only as a secondary review tool, not as the default coding engine.

Rules:
- Use Codex only when confidence is low, a bug persists after 1–2 attempts, or a second opinion is explicitly useful.
- Prefer at most 1 Codex call per task, or 2 for difficult debugging.
- Always compress context before calling Codex — keep the prompt under 12k chars.
- Use the wrapper script: `brain/tools/codex-review.sh '<compressed context>'`
- Use `reasoning_effort="high"` (already set in the wrapper) — not `xhigh`.
- Treat Codex output as advisory, not authoritative.
- If Codex output is vague or low-value, stop — do not retry.
- See `/codex-second-opinion` skill for the full routing policy.
