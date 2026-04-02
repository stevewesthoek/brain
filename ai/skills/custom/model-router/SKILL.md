---
name: model-router
description: Routing policy for selecting the right agent per task. Invoke with /model-router to re-prime routing awareness. Reference when deciding between cheap-prep (Haiku), coder-default (Sonnet), deep-architect (Opus), or Codex CLI.
---

# /model-router — Model Routing Policy

## Agent roster

| Agent | Model/Tool | Use when |
|-------|------------|----------|
| `cheap-prep` | Haiku | Summarization, file triage, context compaction, commit messages, lightweight classification |
| `coder-default` | Sonnet | All normal coding: features, bugs, refactors, tests (default) |
| `deep-architect` | Opus | Complex architecture, major migrations, high-blast-radius changes, ambiguous tradeoffs, repeated Sonnet failures |
| `codex` | Codex CLI | Parallel task delegation, code review, advisory second opinion, well-scoped isolated tasks |

## Routing rules

1. **Default to `coder-default`** (Sonnet) for all coding tasks.
2. **Use `cheap-prep`** (Haiku) before starting a task when context is large or unclear — summarize first, then code.
3. **Escalate to `deep-architect`** (Opus) only when:
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - `coder-default` has failed or produced unsatisfactory results after 2+ attempts
   - The decision will be load-bearing for future architecture
4. **Before escalating to Opus**: run `cheap-prep` to compact context into a concise briefing first. Do not pass raw conversation history to Opus.
5. **Delegate to `codex`** when spinning up multiple parallel sub-agents — spread load across engines instead of running all agents on Sonnet. Route to Codex when:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex)
   - The task is well-scoped and needs no broad repo context (code review, diff analysis, risk check)
   - A second opinion alongside a main coding agent is useful
   - Consecutive multi-step pipelines benefit from engine diversity

## Codex sub-model routing

Codex has three tiers. Route by task weight — same logic as Claude model routing.

| Tier | Invocation | When to use |
|------|-----------|-------------|
| **mini** | `codex-review.sh '<prompt>' mini` | Quick sanity check, obvious issue scan, simple diff, fast parallel filler |
| **standard** | `codex-review.sh '<prompt>'` | Normal second opinion, parallel task execution, typical code review (default) |
| **max** | `codex-review.sh '<prompt>' max` | High-stakes review (auth, migrations, prod-touching), deep architecture critique, when standard wasn't enough |

Global config (`~/.codex/config.toml`): `model = "gpt-5.4"`, `model_reasoning_effort = "high"`.
Mini overrides: `codex-mini-latest` + effort `"low"`. Max overrides: effort `"xhigh"`. Standard inherits config.

**General Codex rules:**
- Always compress context before calling — prompt must be under 12k chars
- Treat output as advisory, not authoritative — integrate only the useful parts
- Max 1–2 Codex calls per task; do not chain without clear value
- Do not use for tasks needing full repo context or interactive file editing

## Post-completion memory

After significant work, produce a compact summary (5 bullets or fewer) for:
- The repo's `decision-log.md` (confirmed architecture/workflow decisions only)
- `CLAUDE.md` updates if a new stable convention was established
- Auto memory if it is a cross-repo preference

## Cost ratios (rough)

Haiku ~25x cheaper than Opus. Use freely.
Sonnet ~5x cheaper than Opus. Use for almost everything.
Opus: reserve for genuinely hard problems. Do not escalate out of impatience.
Codex mini: fast, cheap — use for quick passes and parallel filler.
Codex standard: balanced — default for second opinions and parallel tasks.
Codex max: expensive — reserve for high-stakes reviews, same threshold as Opus.
