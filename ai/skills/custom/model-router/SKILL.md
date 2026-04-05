---
name: model-router
description: Routing policy for selecting the right agent per task. Invoke with /model-router to re-prime routing awareness. Reference when deciding between cheap-prep (Haiku), coder-default (Sonnet), deep-architect (Opus), or Codex CLI.
---

# /model-router — Model Routing Policy

Canonical source: `brain/ai/policy/routing.md`
This skill loads and applies the full unified routing policy for the current session.

---

## Agent roster

| Agent | Model/Tool | Use when |
|-------|------------|----------|
| `cheap-prep` | Haiku | Summarization, file triage, context compaction, commit messages, lightweight classification |
| `coder-default` | Sonnet | All normal coding: features, bugs, refactors, tests (default) |
| `deep-architect` | Opus | Complex architecture, major migrations, high-blast-radius changes, ambiguous tradeoffs, repeated Sonnet failures |
| `codex` | Codex CLI | Parallel task delegation, code review, advisory second opinion, well-scoped isolated tasks |

## Automatic routing (apply without being asked)

Route automatically on every task — do not ask the user which model to use.

**Decompose a task into sub-agents when ALL of these are true:**
- The task has 3+ distinct subtasks that can be worked on independently, OR involves 6+ files across different concerns
- Routing to cheaper agents saves an estimated ≥20% of total tokens vs handling everything in Sonnet
- The overhead of decomposition (spawning agents, merging results) is less than the savings

**Do not decompose when:**
- The task is small (single file, single fix, one clear question)
- The subtasks share too much context to be isolated
- The estimated savings are under 20% — the routing overhead isn't worth it
- You're already inside a sub-agent

**After completing any task with multiple agents:** Report which agents/models were used at the end (one line: "Used: Sonnet + Haiku cheap-prep + Codex mini").

## Routing rules

1. **Default to `coder-default`** (Sonnet) for all coding tasks.
2. **Use `cheap-prep`** (Haiku) before starting a task when context is large or unclear — summarize first, then code.
3. **Escalate to `deep-architect`** (Opus) only when:
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - `coder-default` has failed or produced unsatisfactory results after 2+ attempts
   - The decision will be load-bearing for future architecture
4. **Before escalating to Opus**: run `cheap-prep` to compact context into a concise briefing first.
5. **Delegate to `codex`** for parallel load or second opinion:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex)
   - Well-scoped task needing no broad repo context (code review, diff analysis, risk check)
   - Second opinion alongside a main coding agent

## Codex sub-model routing

| Tier | Invocation | When to use |
|------|-----------|-------------|
| **mini** | `codex-review.sh '<prompt>' mini` | Quick sanity check, obvious issue scan, fast parallel filler |
| **standard** | `codex-review.sh '<prompt>'` | Normal second opinion, parallel execution, typical code review (default) |
| **max** | `codex-review.sh '<prompt>' max` | High-stakes review (auth, migrations, prod-touching), deep critique |

Global Codex config: `model = "gpt-5.4"`, `model_reasoning_effort = "medium"`.
Mini overrides: `codex-mini-latest` + effort `low`. Max overrides: effort `xhigh`.

**Codex rules:**
- Always compress context before calling — prompt must be under 12k chars
- Treat output as advisory — integrate only the useful parts
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
