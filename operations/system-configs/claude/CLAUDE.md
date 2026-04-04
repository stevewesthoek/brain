# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
Canonical guardrails policy: `brain/ai/policy/guardrails.md`.

Available skills: `/model-router`, `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/stb-pipeline`, `/notebooklm`, `/output-skill`, `/redesign-skill`, `/soft-skill`, `/taste-skill`, `/ui-ux-pro-max`, `/web-design`, `/stripe`, `/ffmpeg`, `/gh`, `/dokploy`, `/supabase`, `/gws`, `/cloudflare`, `/n8n`, `/azure`, `/hetzner`, `/forge`

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
- n8n: [yes/no] — use `/n8n` for self-hosted CLI ops (workflow export/import, audit, recovery commands)
- Azure: [yes/no] — use `/azure` for Azure CLI account, subscription, and resource discovery or management
- Hetzner: [yes/no] — use `/hetzner` for Hetzner Cloud CLI infrastructure discovery or management
- NotebookLM: [yes/no] — use `/notebooklm` for research, source synthesis, and briefing docs
- Codex: [yes/no] — use `/codex` for AI-assisted code review and adversarial challenge mode

## Memory
Use this file for repo-specific decisions, commands, and constraints.
Use `decision-log.md` (if present) for confirmed architecture and workflow decisions only.
---

# Model routing policy

Canonical policy: `brain/ai/policy/routing.md`. Both Claude and Codex read this as the source of truth.
Run `/model-router` to re-prime full routing awareness.

Route tasks to agents by cost and complexity. Do not ask the user which model to use — route automatically.

| Agent | Model/Tool | Use when |
|-------|------------|----------|
| `cheap-prep` | Haiku | Summarization, file triage, context compaction, commit drafting |
| `coder-default` | Sonnet | All normal coding (default) |
| `deep-architect` | Opus | Complex architecture, high blast radius, repeated failures |
| `codex` | Codex CLI | Parallel load balancing, code review, second opinion, well-scoped isolated tasks |

Codex tiers: `codex-review.sh '<prompt>' mini|standard|max` — route by task weight (mini=fast/cheap, standard=default, max=high-stakes).
Before escalating to Opus: compact with `cheap-prep` first.
When running 3+ parallel agents: route 1–2 tasks to Codex for engine diversity.

# Guardrails

Even when Claude is configured to bypass permission prompts, broad access is not blanket authorization.

- Make routine low-risk decisions autonomously.
- Treat `local-isolated` work as autonomous by default, but ask before `shared-nonprod` or `production` mutations.
- Ask before destructive filesystem/git actions, credential handling, deploys, database/data mutations, external-system mutations, financial/customer-impacting actions, or any ambiguous high-risk step.
- Never expose secrets in output.
- Never silently overwrite user work.
- Prefer previews, diffs, and read-only inspection before risky mutations.
