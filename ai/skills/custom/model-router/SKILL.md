---
name: model-router
description: Routing policy for selecting the right agent per task. Invoke with /model-router to re-prime routing awareness. Reference when deciding between cheap-prep (Haiku), coder-default (Sonnet), or deep-architect (Opus).
---

# /model-router — Model Routing Policy

## Agent roster

| Agent | Model | Use when |
|-------|-------|----------|
| `cheap-prep` | Haiku | Summarization, file triage, context compaction, commit messages, lightweight classification |
| `coder-default` | Sonnet | All normal coding: features, bugs, refactors, tests (default) |
| `deep-architect` | Opus | Complex architecture, major migrations, high-blast-radius changes, ambiguous tradeoffs, repeated Sonnet failures |

## Routing rules

1. **Default to `coder-default`** (Sonnet) for all coding tasks.
2. **Use `cheap-prep`** (Haiku) before starting a task when context is large or unclear — summarize first, then code.
3. **Escalate to `deep-architect`** (Opus) only when:
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - `coder-default` has failed or produced unsatisfactory results after 2+ attempts
   - The decision will be load-bearing for future architecture
4. **Before escalating to Opus**: run `cheap-prep` to compact context into a concise briefing first. Do not pass raw conversation history to Opus.

## Post-completion memory

After significant work, produce a compact summary (5 bullets or fewer) for:
- The repo's `decision-log.md` (confirmed architecture/workflow decisions only)
- `CLAUDE.md` updates if a new stable convention was established
- Auto memory if it is a cross-repo preference

## Cost ratios (rough)

Haiku ~25x cheaper than Opus. Use freely.
Sonnet ~5x cheaper than Opus. Use for almost everything.
Opus: reserve for genuinely hard problems. Do not escalate out of impatience.
