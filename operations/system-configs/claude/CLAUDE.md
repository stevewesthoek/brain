# gstack

**DEFAULT WEB RESEARCH TOOL:** Use `/firecrawl` (local: `http://localhost:3055`) for ALL web search, scraping, and research. It replaces `/browse` and `WebFetch`. Works with Claude Code, Codex, and Gemini.

Never use `mcp__claude-in-chrome__*` tools or raw `WebFetch` for research.
Canonical guardrails policy: `brain/ai/policy/guardrails.md`.

Available skills: `/design` (primary design entry point — natural language, all scenarios), `/memory` (primary memory entry point — natural language, all memory operations), `/web` (primary web/browser entry point — natural language, all web/automation scenarios), `/design-motion-principles`, `/design-system`, `/autoresearch`, `/model-router`, `/gemini`, `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/firecrawl`, `/browse`, `/playwright`, `/apify`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/stb-pipeline`, `/notebooklm`, `/output-skill`, `/redesign-skill`, `/soft-skill`, `/taste-skill`, `/ui-ux-pro-max`, `/web-design`, `/stripe`, `/ffmpeg`, `/gh`, `/dokploy`, `/supabase`, `/gws`, `/cloudflare`, `/n8n`, `/azure`, `/hetzner`, `/tailscale`, `/forge`, `/dembrandt`

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

# Memory IDs and search

Every memory file has a unique ID in its frontmatter: `id: mem-{type}-{NNN}`.

Use IDs to cite past decisions in handoffs and session context:
> "See mem-feedback-003 for why we avoid mocking the database in tests."

**Progressive disclosure — always use this order to minimize token cost:**

1. `mem-search` — list the full index (~1-2 lines per entry)
2. `mem-search <keyword>` — filter to relevant entries by ID
3. `mem-search --id <id>` — fetch full content only for the IDs that matter

**Never read all memory files at once.** The index is the entry point. This pattern saves ~10x tokens at scale.

```bash
# Examples
mem-search                    # list all entries
mem-search database           # find entries mentioning database
mem-search --id mem-user-001  # fetch full content by ID
```

## Automatic memory injection

Memory is injected into your prompts automatically via two mechanisms:

1. **Session start** — When you start a session after a break, the first prompt is scanned for keywords. Matching memory entries are prepended as `--- Memory context ---` block above the session handoff.

2. **Mid-session recall** — When you ask a recall-intent question ("what did we decide about X?", "remind me about Y", "do we have a setting for Z?"), the hook system detects this automatically and injects matching memory entries as `--- Memory recall ---` block into your prompt.

**You do not need to run `mem-search` manually or invoke any hooks.** The system is invisible. When you see `--- Memory context ---` or `--- Memory recall ---` blocks in your session context, read them naturally and use them in your response. Zero cognitive overhead.

Trigger phrases detected automatically:
- "what did we", "remind me", "do you remember", "do we have"
- "previously", "last time", "we used to", "we always"
- "what was the", "what is our", "what are our"
- "why did we", "how did we", "what settings", "what config", "what decision", "what approach"

Non-trigger prompts cost nothing (zero-cost passthrough).

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
- NotebookLM: [yes] — CLI v0.3.4 via pipx; use `/notebooklm` for research, source synthesis, and content generation (audio, video, slides, quizzes, data tables); full batch export and programmatic control; runbook at `brain/operations/runbooks/notebooklm.md`
- Codex: [yes/no] — use `/codex` for AI-assisted code review and adversarial challenge mode
- Gemini: [yes/no] — use `/gemini` for large-context preprocessing and free-tier Flash analysis
- Handoff: [yes/no] — use `/handoff` for session start/end compressed handoffs and `.ai/` memory system setup
- RTK: [yes] — use `/rtk` for token-optimized shell output. Bash commands are routed through `~/.claude/hooks/rtk-safe-bash-hook.sh`, which preserves the risky-command guard before rewriting safe commands to `rtk ...`. Runbook: `brain/operations/runbooks/rtk.md`

## Memory
Use this file for repo-specific decisions, commands, and constraints.
Use `.ai/current.md` for short-term resumable session handoffs (overwritten each session).
Use `.ai/handoffs/` for archived timestamped past handoffs.
Use `decision-log.md` for confirmed architecture and workflow decisions only (append-only, never overwritten).
Never use full transcripts as memory — use `/handoff setup` to initialize the `.ai/` system in a new repo.
---

# Model routing policy

Canonical policy: `brain/ai/policy/routing.md`. Both Claude and Codex read this as the source of truth.
Run `/model-router` to re-prime full routing awareness.

Route tasks to agents by cost and complexity. Do not ask the user which model to use — route automatically.
**Start at the cheapest tier. Escalate only when the current tier struggles.**

| Agent | Model/Tool | Cost | Use when |
|-------|------------|------|----------|
| `gemini-flash` | Gemini Flash | **Free** | Large context preprocessing (>100k tokens), bulk analysis, free-tier summarization |
| `cheap-prep` | Haiku | Cheapest paid | **DEFAULT for all tasks** — coding, triage, commits, fixes, reviews |
| `coder-default` | Sonnet | Mid paid | Escalate from Haiku: complex coding, multi-file, deeper reasoning |
| `deep-architect` | Opus | Expensive | Escalate from Sonnet: architecture, high blast radius, repeated failures |
| `codex` | Codex CLI (low) | Paid subscription | Parallel load, code review, second opinion; default tier = low |

**Claude escalation:** Haiku → Sonnet → Opus. Try each tier before escalating.
**Codex escalation:** low → standard → max. Default is `low` (gpt-5.4, low effort).
**Gemini escalation:** Flash (free, default) → Pro (conserve, deep reasoning only).
Codex tiers: `codex-review.sh '<prompt>' [low|mini|standard|max]` — default is `low`.
Gemini tiers: `gemini-review.sh '<prompt>' [flash|pro]` — flash=free/1M-context (default).
Before escalating to Opus: always compact context with Gemini Flash or `cheap-prep` first.
Large context (>100k tokens): always run Gemini Flash preprocessing first.

# Guardrails

Even when Claude is configured to bypass permission prompts, broad access is not blanket authorization.

- Make routine low-risk decisions autonomously.
- Treat `local-isolated` work as autonomous by default, but ask before `shared-nonprod` or `production` mutations.
- Ask before destructive filesystem/git actions, credential handling, deploys, database/data mutations, external-system mutations, financial/customer-impacting actions, or any ambiguous high-risk step.
- Never expose secrets in output.
- Never silently overwrite user work.
- Prefer previews, diffs, and read-only inspection before risky mutations.
