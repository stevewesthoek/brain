# gstack

**DEFAULT WEB RESEARCH TOOL:** Use `/firecrawl` (local: `http://localhost:3055`) for ALL web search, scraping, and research. It replaces `/browse` and `WebFetch`. Works with Claude Code, Codex, and Gemini.

Never use `mcp__claude-in-chrome__*` tools or raw `WebFetch` for research.
Canonical guardrails policy: `brain/ai/policy/guardrails.md`.
Canonical rule onboarding and hook policy: `brain/docs/rules/rule-onboarding-and-hook-policy.md`. New permanent rules must be classified there before being added to always-on context; deterministic command/path/diff rules should become hooks or CI when feasible.

Available skills: `/code` (primary code orchestrator — natural language, all coding work: understand/improve/fix/review/build/document/ship), `/design` (primary design entry point — natural language, all scenarios), `/graphify` (primary codebase knowledge graph entry point — natural language, code comprehension/architecture/design), `/memory` (primary memory entry point — natural language, all memory operations), `/video` (primary video/media orchestrator — natural language, all video production and posting scenarios), `/web` (primary web/browser entry point — natural language, all web/automation scenarios), `/viral-flow` (content strategy engine — natural language, all content discovery/angle generation/hook scoring/script building/performance tracking/multi-platform posting), `/design-motion-principles`, `/design-system`, `/autoresearch`, `/gemini`, `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/firecrawl`, `/browse`, `/playwright`, `/apify`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/stb-pipeline`, `/notebooklm`, `/output-skill`, `/redesign-skill`, `/soft-skill`, `/taste-skill`, `/ui-ux-pro-max`, `/web-design`, `/stripe`, `/ffmpeg`, `/gh`, `/dokploy`, `/supabase`, `/gws`, `/cloudflare`, `/n8n`, `/azure`, `/hetzner`, `/tailscale`, `/forge`, `/dembrandt`

# Skills structure

Skills live in `brain/ai/skills/` with three directories:

- `active/` — symlinks only, what Claude reads (via `~/.claude/skills -> active/`)
- `vendors/` — third-party skill sources (e.g. `vendors/gstack/`)
- `custom/` — first-party skill sources

When installing or activating a skill, follow `ai/skills/README.md` and `docs/skills/skill-index.md`. Keep source in `vendors/<vendor>/` or `custom/`; `active/` is the exported surface. Deterministic mistakes around raw active-skill writes/copies/symlinks are guarded by `check-active-skill-surface.sh`.

# Cross-repo operating context: brain + mind

Steve's two always-important context repos are:

```text
/Users/Office/Repos/stevewesthoek/brain
/Users/Office/Repos/stevewesthoek/mind
```

Use `brain` for AI-system context: shared skills, global Claude/Codex/Gemini configs, orchestrators, runbooks, automations, tools, guardrails, model routing, and operational procedures.

Use `mind` for Steve-specific personal context: personal knowledge, strategy, convictions, ministry context, business context, active projects, tasks, resources, and research.

When a user asks anything about AI behavior, skills, tools, orchestrators, automation, global config, model routing, or operational runbooks, consult `brain` instead of relying on chat memory.

When a user asks anything personal/contextual such as "what do I believe", "what is our strategy", "remember this", "save this to mind", "research this for me", or asks about Yeshua Academy, ProChat, Arkware, marketing, business, Bible/theology, or prior decisions, consult `mind` instead of relying on chat memory.

Startup protocol when `brain` context is relevant:

1. Read `/Users/Office/Repos/stevewesthoek/brain/AGENTS.md`.
2. Read `/Users/Office/Repos/stevewesthoek/brain/00-start-here.md`.
3. Read `/Users/Office/Repos/stevewesthoek/brain/00-current-context.md`.
4. Read `/Users/Office/Repos/stevewesthoek/brain/00-memory-map.md`.
5. Search/read only the relevant folders. Do not load the whole repo.

Startup protocol when `mind` context is relevant:

1. Read `/Users/Office/Repos/stevewesthoek/mind/router/AGENTS.md`.
2. Read `/Users/Office/Repos/stevewesthoek/mind/router/00-start-here.md`.
3. Read `/Users/Office/Repos/stevewesthoek/mind/router/00-current-context.md`.
4. Read `/Users/Office/Repos/stevewesthoek/mind/router/00-memory-map.md`.
5. Search/read only the relevant folders. Do not load the whole vault.

These repos may be used even when Claude Code starts inside another repo. The current working repo remains the implementation target; `brain` and `mind` are cross-repo context sources.

# Memory system

Use a 4-layer memory model:

1. **Global memory** — this file (`~/.claude/CLAUDE.md`). Stable personal workflow rules and global conventions that apply in every session.
2. **Repo memory** — `CLAUDE.md` at each repo root. Repo-specific architecture decisions, commands, constraints, and conventions.
3. **Shared AI memory** — `~/.brain/memory/` — the canonical cross-AI memory store. Shared by Claude, Codex, and Gemini. Use `mem-write`, `mem-search`, `mem-facts` to read and write. This is the persistent memory layer visible to all agents.
4. **Decision log** — `decision-log.md` (location is repo-specific). Confirmed decisions, successful recovery steps, stable conventions. Not temporary notes or speculative ideas.

**Shared memory is the primary explicit memory store.** When the user asks you to remember something or when you identify a durable fact/preference, write it to `~/.brain/memory/` via `mem-write`. Claude Code auto-memory (this file's auto-memory section) handles session-level corrections; `~/.brain/memory/` handles durable knowledge that must survive across all AI agents.

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
- Brain context compression: [yes] — use `brain-compress` automatically for large local JSON, logs, or text when exact retrieval may be needed; originals are stored by hash under `~/.brain/cache/compression/`. Use `brain-learn-failures --repo . --write-report` before promoting recurring local failures through `/learner`. Runbook: `brain/operations/runbooks/context-compression.md`
- omp / Oh My Pi: [yes] — optional standalone terminal AI coding agent, comparable to Cursor, Kiro, Antigravity, Codex, and Gemini. Use only as a manually selected external coding surface or evaluation harness. Do not use it to replace AI Model Selector, Brain skills, shared memory, or routing policy. Runbook: `brain/operations/runbooks/omp-optional-agent.md`
- Open Design: [yes] — optional external visual design workbench for `/design`, installed outside Brain at `/Users/Office/Repos/nexu-io/open-design` and exposed as `open-design`. It must not replace `/design`, `/web-design`, AI Model Selector, Brain skills, shared memory, or routing policy. Auto-detect available CLIs (`open-design`, validated non-system `od`, `claude`, `codex`, `gemini`, `omp`) and route generation through `ai-select`. Runbook: `brain/operations/runbooks/open-design-optional-design-surface.md`

## Memory
Use this file for repo-specific decisions, commands, and constraints.
Use `.ai/current.md` for short-term resumable session handoffs (overwritten each session).
Use `.ai/handoffs/` for archived timestamped past handoffs.
Use `decision-log.md` for confirmed architecture and workflow decisions only (append-only, never overwritten).
Never use full transcripts as memory — use `/handoff setup` to initialize the `.ai/` system in a new repo.
---

# Model routing policy

Canonical policy: `brain/ai/policy/routing.md`. Both Claude and Codex read this as the source of truth.
Use `brain/ai/policy/routing.md` to re-prime full routing awareness.

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
