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
| `cheap-prep` | Haiku | Cheapest paid | **Default paid agent** for coding, triage, commits, fixes, and reviews; escalate if struggling |
| `coder-default` | Sonnet | Mid paid | Escalate from Haiku: multi-file tasks, deeper reasoning, complex coding |
| `deep-architect` | Opus | Expensive | Escalate from Sonnet: architecture, high blast radius (prod/auth/migrations), repeated failures |
| `codex` | Codex CLI (`gpt-5.4-mini`, medium default) | Paid subscription | Parallel task delegation, code review, advisory second opinion; escalate by effort first, then model |

**Cost priority (rough):**
- Free first: Gemini Flash
- Cheapest paid: Haiku
- Cheapest Codex: Codex cheap -> Codex default -> Codex hard
- Higher-stakes paid: Sonnet -> Codex risk
- Most expensive: Opus / Codex critical

**Escalation ladders:**
- **Claude**: Haiku → Sonnet → Opus (try each tier; only escalate when the current tier struggles)
- **Codex**: cheap → default → hard → risk → critical (try each tier; only escalate when the current tier struggles)
- **Gemini**: Flash → Pro (Flash is free and handles almost everything; Pro only for deep reasoning)

---

## Automatic routing (apply without being asked)

Route automatically on every task — do not ask the user which model to use.

**Decompose a task into sub-agents when ALL of these are true:**
- The task has 3+ distinct subtasks that can be worked on independently, OR involves 6+ files across different concerns with limited cross-file coupling
- Routing to cheaper agents saves an estimated ≥20% of total tokens vs handling everything in Sonnet
- The overhead of decomposition (spawning agents, merging results) is less than the savings

**Do not decompose when:**
- The task is small (single file, single fix, one clear question)
- The subtasks share too much context to be isolated
- The estimated savings are under 20%
- You're already inside a sub-agent

**After completing any task with multiple agents:** Report which agents/models were used (one line: “Used: Sonnet + Gemini Flash preprocessing + Codex (gpt-5.4-mini, medium)”).

---

## Routing rules

1. **Default to `cheap-prep`** (Haiku) for paid coding and execution tasks. Start cheap; escalate only when struggling.
2. **Escalate to `coder-default`** (Sonnet) when: Haiku output is insufficient, task clearly spans many files, or deeper reasoning is needed.
3. **Escalate to `deep-architect`** (Opus) only when:
   - Sonnet has failed or produced unsatisfactory results after 2+ attempts
   - Major design ambiguity spans multiple systems
   - Blast radius is high (prod data, shared infrastructure, auth, migrations)
   - The decision will be load-bearing for future architecture
4. **Before escalating to Opus**: always run Gemini Flash or `cheap-prep` to compact context first.
5. **Large context first**: when input is very large or poorly scoped (typically >60k–100k tokens), run `gemini-review.sh` (Flash) first to produce a compact briefing.
6. **Free-tier preference**: for pure analysis/summarization tasks, prefer Gemini Flash (free) over Haiku (paid).
7. **Delegate to `codex`** for parallel load or second opinion — default tier is `default`:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex `cheap` or `default` depending on risk)
   - Well-scoped task needing code review or diff analysis
   - Escalate Codex effort first: `cheap -> default -> hard`
   - Escalate model second: `risk -> critical` only for high-stakes work
   - Codex is on a paid subscription — use deliberately

---

## Codex routing policy

### Default
- **default:** `gpt-5.4-mini` + `medium`
- Rationale: best cost/capability default for interactive coding, repo work, code review, and normal debugging.

### Effort ladder
1. **minimal**
   - Use for: tiny edits, grep-and-patch, small search/replace, obvious diff review, trivial fixes
   - Goal: cheapest possible pass

2. **low**
   - Use for: small single-file changes, straightforward bug fixes, simple triage, narrow code review
   - Goal: quick and cheap

3. **medium** (**default**)
   - Use for: normal coding, contained multi-file work, standard debugging, ordinary implementation tasks
   - Goal: best general balance

4. **high**
   - Use for: weird bugs, subtle regressions, dependency chains, multi-step refactors, repeated failure on medium
   - Goal: push harder before changing models

5. **xhigh**
   - Use only for: auth, billing, migrations, prod-touching changes, shared infra, high-blast-radius critique
   - Goal: rare escalation only

### Model ladder
- Start on `gpt-5.4-mini`
- Escalate effort first:
  - `minimal -> low -> medium -> high`
- Escalate model second:
  - `gpt-5.4-mini high -> gpt-5.4 low or medium, depending on blast radius`
  - `gpt-5.4 low/medium` only when failure cost is real or mini has already struggled
- Avoid `gpt-5.4 xhigh` unless the task is genuinely high-stakes

### Invocation mapping
| Tier | Invocation | When to use |
|------|-----------|-------------|
| **cheap** | `codex-review.sh '<prompt>' cheap` | Tiny edits, trivial review, narrow checks (`gpt-5.4-mini`, low/minimal) |
| **default** | `codex-review.sh '<prompt>'` | **DEFAULT** — normal coding and review (`gpt-5.4-mini`, medium) |
| **hard** | `codex-review.sh '<prompt>' hard` | Weird bugs, subtle breakage, multi-file refactors (`gpt-5.4-mini`, high) |
| **risk** | `codex-review.sh '<prompt>' risk` | Auth, migrations, prod-touching, load-bearing decisions (`gpt-5.4`, low/medium depending on blast radius) |
| **critical** | `codex-review.sh '<prompt>' critical` | Rare panic-room use only (`gpt-5.4`, high/xhigh if truly justified) |

Prompt limit: keep prompts compressed. Paid subscription — use deliberately.
Escalation ladder: cheap → default → hard → risk → critical.
Try the cheapest tier that plausibly fits the task.

### Output discipline
- Keep Codex verbosity low by default.
- Ask for terse output on small tasks: findings, patch summary, risks, next step.
- Do not request long explanations unless the task is architectural or ambiguous.
- Prefer structured outputs over narrative outputs.

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
Codex cheap: `gpt-5.4-mini` at minimal/low effort — cheapest Codex pass.
Codex default: `gpt-5.4-mini` at medium effort — default for most Codex tasks.
Codex hard: `gpt-5.4-mini` at high effort — escalate before changing models.
Codex risk: `gpt-5.4` at low/medium effort — reserve for auth, migrations, prod-touching work.
Codex critical: `gpt-5.4` at high/xhigh effort — panic-room use only.
Gemini Pro: reserve for deep reasoning only.