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
| `cheap-prep` | Haiku | Cheapest paid | **DEFAULT for all tasks** — coding, triage, commits, fixes, reviews; escalate if struggling |
| `coder-default` | Sonnet | Mid paid | Escalate from Haiku: multi-file tasks, deeper reasoning, complex coding |
| `deep-architect` | Opus | Expensive | Escalate from Sonnet: architecture, high blast radius (prod/auth/migrations), repeated failures |
| `codex` | Codex CLI (low) | Paid subscription | Parallel task delegation, code review, advisory second opinion; default tier = low |

**Cost priority:** Gemini Flash (free) > Haiku > Codex low > Codex mini > Sonnet > Codex standard > Opus / Codex max

**Escalation ladders:**
- **Claude**: Haiku → Sonnet → Opus (try each tier; only escalate when the current tier struggles)
- **Codex**: low → standard → max (try each tier; only escalate when the current tier struggles)
- **Gemini**: Flash → Pro (Flash is free and handles almost everything; Pro only for deep reasoning)

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

1. **Default to `cheap-prep`** (Haiku) for all tasks — including coding. Start cheap; escalate only when struggling.
2. **Escalate to `coder-default`** (Sonnet) when: Haiku output is insufficient, task clearly spans many files, or deeper reasoning is needed.
3. **Escalate to `deep-architect`** (Opus) only when:
   - Sonnet has failed or produced unsatisfactory results after 2+ attempts
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - The decision will be load-bearing for future architecture
4. **Before escalating to Opus**: always run Gemini Flash or `cheap-prep` to compact context first.
5. **Large context first**: when input is >100k tokens, run `gemini-review.sh` (Flash) first to produce a compact briefing. This is free.
6. **Free-tier preference**: for pure analysis/summarization tasks, prefer Gemini Flash (free) over Haiku (paid).
7. **Delegate to `codex`** for parallel load or second opinion — default tier is `low`:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex low)
   - Well-scoped task needing code review or diff analysis
   - Escalate Codex to `standard` when low is insufficient; `max` for high-stakes only
   - Codex is on a paid subscription — use deliberately.

---

## Codex sub-model routing

| Tier | Invocation | When to use |
|------|-----------|-------------|
| **low** | `codex-review.sh '<prompt>'` | **DEFAULT** — start here for all Codex tasks (gpt-5.4, low effort) |
| **mini** | `codex-review.sh '<prompt>' mini` | Fast parallel filler — small isolated sanity checks (codex-mini-latest) |
| **standard** | `codex-review.sh '<prompt>' standard` | Escalate when low is insufficient; normal code review (gpt-5.4, medium effort) |
| **max** | `codex-review.sh '<prompt>' max` | Escalate for auth, migrations, prod-touching, deep critique (gpt-5.4, xhigh effort) |

Prompt limit: 12k chars. Compress before calling. Paid subscription — use deliberately.
Escalation ladder: low → standard → max. Try low first.

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
Haiku: ~25× cheaper than Opus. **New default for all Claude tasks.**
Sonnet: ~5× cheaper than Opus. Escalation from Haiku for complex coding.
Opus: reserve for genuinely hard problems. Do not escalate out of impatience.
Codex low: **new default** — gpt-5.4 at low effort. Most tasks complete here.
Codex standard: escalate from low when insufficient.
Codex max / Gemini Pro: reserve for high-stakes only.
