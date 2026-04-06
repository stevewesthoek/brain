---
name: model-router
description: Routing policy for selecting the right agent per task. Invoke with /model-router to re-prime routing awareness. Reference when deciding between cheap-prep (Haiku), coder-default (Sonnet), deep-architect (Opus), Codex CLI, or Gemini CLI.
---

# /model-router — Model Routing Policy

Canonical source: `brain/ai/policy/routing.md`
This skill loads and applies the full unified routing policy for the current session.

---

## Agent roster

| Agent | Model/Tool | Cost | Use when |
|-------|------------|------|----------|
| `gemini-flash` | Gemini Flash | **Free** | Large context preprocessing (>100k tokens), bulk analysis, free-tier summarization |
| `cheap-prep` | Haiku | Cheapest paid | Summarization, file triage, context compaction, commit messages, lightweight classification |
| `coder-default` | Sonnet | Mid paid | All normal coding: features, bugs, refactors, tests (default) |
| `deep-architect` | Opus | Expensive | Complex architecture, major migrations, high-blast-radius changes, repeated Sonnet failures |
| `codex` | Codex CLI | Paid subscription | Parallel task delegation, code review, advisory second opinion, well-scoped isolated tasks |

**Cost priority:** Gemini Flash (free) > Haiku > Codex mini > Sonnet > Codex standard > Opus / Codex max

---

## Automatic routing (apply without being asked)

Route automatically on every task — do not ask the user which model to use.

**Decompose a task into sub-agents when ALL of these are true:**
- The task has 3+ distinct subtasks that can be worked on independently, OR involves 6+ files across different concerns
- Routing to cheaper agents saves an estimated ≥20% of total tokens vs handling everything in Sonnet
- The overhead of decomposition (spawning agents, merging results) is less than the savings

**Do not decompose when:**
- The task is small (single file, single fix, one clear question)
- The subtasks share too much context to be isolated
- The estimated savings are under 20%
- You're already inside a sub-agent

**After completing any task with multiple agents:** Report which agents/models were used (one line: "Used: Sonnet + Gemini Flash preprocessing + Codex mini").

---

## Routing rules

1. **Default to `coder-default`** (Sonnet) for all coding tasks.
2. **Large context first**: when input is >100k tokens (many files, large logs, big diffs), run `gemini-review.sh` (Flash) first to produce a compact briefing. Then work in Claude on the summary. This is free and saves significant Sonnet tokens.
3. **Free-tier preference**: for pure analysis/summarization tasks, prefer Gemini Flash (free) over Haiku (paid).
4. **Use `cheap-prep`** (Haiku) for moderate context compaction where Gemini overhead isn't worth it.
5. **Escalate to `deep-architect`** (Opus) only when:
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - `coder-default` has failed or produced unsatisfactory results after 2+ attempts
   - The decision will be load-bearing for future architecture
6. **Before escalating to Opus**: run Gemini Flash or `cheap-prep` to compact context into a concise briefing first.
7. **Delegate to `codex`** for parallel load or second opinion:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex)
   - Well-scoped task needing code review or diff analysis
   - Second opinion alongside a main coding agent
   - Note: Codex is on a paid subscription — use deliberately.

---

## Codex sub-model routing

| Tier | Invocation | When to use |
|------|-----------|-------------|
| **mini** | `codex-review.sh '<prompt>' mini` | Quick sanity check, obvious issue scan, fast parallel filler |
| **standard** | `codex-review.sh '<prompt>'` | Normal second opinion, parallel execution, typical code review (default) |
| **max** | `codex-review.sh '<prompt>' max` | High-stakes review (auth, migrations, prod-touching), deep critique |

Prompt limit: 12k chars. Compress before calling. Paid subscription — use deliberately.

---

## Gemini sub-model routing

| Tier | Invocation | When to use |
|------|-----------|-------------|
| **flash** (default) | `gemini-review.sh '<prompt>'` | All preprocessing, bulk analysis, large context (up to 1M tokens) — FREE |
| **pro** | `gemini-review.sh '<prompt>' pro` | Deep reasoning when Flash is insufficient; ~50 RPD limit — conserve |

Prompt limit: 500k chars enforced in script; Flash handles up to ~1M tokens.
Flash is free — use liberally. Pro is limited — conserve.

---

## Post-completion memory

After significant work, produce a compact summary (5 bullets or fewer) for:
- The repo's `decision-log.md` (confirmed architecture/workflow decisions only)
- `CLAUDE.md` updates if a new stable convention was established
- Auto memory if it is a cross-repo preference

---

## Cost ratios (rough)

Gemini Flash: **free** — first choice for any preprocessing or large-context task.
Haiku: ~25× cheaper than Opus. Use freely for moderate context compaction.
Sonnet: ~5× cheaper than Opus. Use for almost everything.
Opus: reserve for genuinely hard problems. Do not escalate out of impatience.
Codex mini: fast — use for quick parallel passes (paid, use deliberately).
Codex standard: balanced — default for second opinions and parallel tasks.
Codex max / Gemini Pro: reserve for high-stakes reviews only.
