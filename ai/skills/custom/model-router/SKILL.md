---
name: model-router
description: Routing policy for selecting the right agent per task. Invoke with /model-router to re-prime routing awareness. Reference when deciding between Gemini CLI, cheap-prep (Haiku), coder-default (Sonnet), deep-architect (Opus), or Codex CLI.
---

# /model-router — Model Routing Policy

Canonical source: `brain/ai/policy/routing.md`
This skill loads and applies the full unified routing policy for the current session.

---

## Agent roster

| Agent | Model/Tool | Cost | Use when |
|-------|------------|------|----------|
| `gemini-lite` | Gemini Flash-Lite | **Free** | **Default free preprocessor** for repo mapping, file triage, summarization, log clustering, prompt compression, and mechanical analysis |
| `gemini-flash` | Gemini Flash | **Free** | Stronger free model for long-context synthesis, structured brief generation, and higher-quality preprocessing before paid models |
| `cheap-prep` | Claude Haiku 4.5 | Cheapest paid | **Default paid agent** for coding, triage, commits, fixes, and reviews; retry once with better scope before escalating |
| `coder-default` | Claude Sonnet 4.6 | Mid paid | Escalate from Haiku only after verified difficulty: repeated failure, tightly coupled multi-file reasoning, or stronger instruction-following needs |
| `deep-architect` | Claude Opus 4.6 | Expensive | Escalate from Sonnet only for high-blast-radius decisions, repeated Sonnet failure, or load-bearing architecture work |
| `codex` | Codex CLI (`gpt-5.4-mini`, medium default) | Paid subscription | Parallel task delegation, code review, advisory second opinion; escalate by effort first, then model |

**Cost priority (rough):**
- Free first: Gemini Flash-Lite -> Gemini Flash
- Cheapest paid: Haiku
- Cheapest Codex: Codex cheap -> Codex default -> Codex hard
- Higher-stakes paid: Sonnet -> Codex risk
- Most expensive: Opus / Codex critical / Gemini Pro

**Escalation ladders:**
- **Gemini**: Flash-Lite -> Flash -> Pro
  - Use Flash-Lite first for bulk preprocessing, extraction, and task shaping
  - Use Flash when Lite is too shallow or synthesis quality matters
  - Use Pro only for rare deep reasoning where free tiers are insufficient
- **Claude**: Haiku 4.5 -> Sonnet 4.6 -> Opus 4.6
  - Escalate only after the current tier has had a fair pass count and the task still justifies it
  - Compact context before escalation when failure appears scope-related rather than intelligence-related
- **Codex**: cheap -> default -> hard -> risk -> critical
  - Escalate only when the current tier struggles and the task justifies paid code-review depth

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

**After completing any task with multiple agents:** Report which agents/models were used (one line: “Used: Gemini Flash-Lite + Haiku + Codex (gpt-5.4-mini, medium)”).

---

## Routing rules

1. **Default to free preprocessing first** when the task involves broad context, file discovery, summarization, triage, task shaping, or prompt compression:
   - Start with `gemini-lite`
   - Escalate to `gemini-flash` when better synthesis is needed

2. **Default to `cheap-prep`** (Claude Haiku 4.5) for paid coding and execution tasks after the task has been scoped well enough.

3. **Before escalating from Haiku**, first improve scope:
   - compress context
   - narrow the task
   - request structured output
   - retry once if the failure looks instruction- or context-related

4. **Escalate to `coder-default`** (Claude Sonnet 4.6) only when:
   - Haiku has failed twice, OR
   - the task requires tightly coupled multi-file reasoning, OR
   - stronger consistency or instruction-following is clearly needed

5. **Escalate to `deep-architect`** (Claude Opus 4.6) only when:
   - Sonnet has failed twice, AND/OR
   - the task has high blast radius (prod data, auth, billing, migrations, shared infra), AND/OR
   - the decision is load-bearing and hard to reverse
   - Always compact context first before escalating to Opus

6. **Large or messy context first**: when input is broad, messy, or very large (typically >30k tokens, and especially >60k–100k), run Gemini first to produce:
   - a compact brief
   - relevant file shortlist
   - constraints
   - open questions
   - recommended next agent

7. **Free-tier preference**: for pure analysis, summarization, context compression, file selection, repo mapping, implementation briefing, and log triage, prefer Gemini over paid models.

8. **Delegate to `codex`** for parallel load or second opinion — default tier is `default`:
   - Running 3+ agents in parallel (route 1–2 self-contained tasks to Codex `cheap` or `default` depending on risk)
   - Well-scoped task needing code review or diff analysis
   - Escalate Codex effort first: `cheap -> default -> hard`
   - Escalate model second: `risk -> critical` only for high-stakes work
   - Codex is on a paid subscription — use deliberately

### Escalation diagnosis
Before escalating Claude tiers, classify the failure:

- **Context fault**: too much input, weak scoping, poor task framing, noisy repo context
  - Action: compress, narrow, retry same tier

- **Intelligence fault**: model cannot reason through the task, misses dependencies, gives shallow tradeoffs, or repeats bad plans
  - Action: escalate one tier

---

## Gemini routing policy

### Default
- **default:** Gemini Flash-Lite
- Rationale: default free workhorse for preprocessing, triage, and task shaping.

### Escalate from Flash-Lite to Flash only when ONE of these is true
- The context is large and synthesis quality matters
- The first Lite pass is too shallow or misses key dependencies
- You need a stronger structured implementation brief
- You need better cross-file reasoning before handing off to a paid model

### Use Gemini before paid models for
- repo mapping
- file triage
- summarization
- test/log triage
- stack trace clustering
- prompt compression
- creating a scoped implementation brief
- extracting constraints, risks, and open questions
- turning a messy request into an executable work order
- selecting the smallest viable next agent

### Do NOT use Gemini as final authority for
- auth, billing, migrations, shared infra
- production-critical code changes
- high-blast-radius architectural decisions
- final review where correctness pressure is high

### Output discipline
- Always ask for structured output:
  - task summary
  - relevant files
  - constraints
  - risks
  - open questions
  - recommended next step
- Prefer compression and extraction over narrative explanation
- Use Gemini to reduce paid-model context, not to generate verbose intermediate prose

### Free-tier discipline
- Prefer Gemini for breadth first, paid models for depth second
- Spend free Gemini calls aggressively on messy inputs and large repos
- Do not waste paid Claude or Codex tokens on summarization that Gemini can do first

---

## Claude routing policy

### Default
- **default:** Claude Haiku 4.5
- Rationale: cheapest paid Claude option; good enough for most coding, triage, reviews, and implementation tasks.

### Escalate from Haiku to Sonnet only when ONE of these is true
- Haiku failed twice on the same task class
- The task requires non-trivial reasoning across multiple files **and** the files are tightly coupled
- The first Haiku pass produced a structurally wrong plan, not just an incomplete one
- The task touches fragile logic where a wrong answer is expensive to verify manually
- The task requires stronger instruction-following or consistency than Haiku is showing

### Do NOT escalate from Haiku to Sonnet when
- The task is mostly mechanical
- The task is broad only because the prompt is bloated
- The failure is caused by poor scoping, weak instructions, or too much context
- A second Haiku pass with a compressed brief is likely enough

### Escalate from Sonnet to Opus only when TWO of these are true
- The task affects auth, billing, migrations, shared infrastructure, or production safety
- Sonnet failed twice or produced materially conflicting solutions
- The architecture decision is load-bearing and hard to reverse
- There is major ambiguity spanning multiple systems or repos
- You need deep critique, tradeoff analysis, or long-horizon planning with high correctness pressure

### Do NOT escalate to Opus when
- The task is just “hard” but local
- The codebase is messy and needs cleanup more than intelligence
- The prompt has not been compacted first
- Sonnet has not yet had one clean, well-scoped attempt

### Retry budget
- Haiku: up to **2 passes**
- Sonnet: up to **2 passes**
- Opus: **1 pass by default**
- If the current tier fails because of context bloat, compact first instead of escalating

### Output discipline
- Keep prompts narrow and explicit before escalating model size.
- Prefer structured asks: goal, constraints, files, expected output.
- Ask for concise patches, decisions, risks, and next steps instead of long narrative explanations.
- Do not spend Sonnet or Opus tokens on repo summarization that Gemini can do for free.

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
| **lite** (default) | `gemini-review.sh '<prompt>' lite` | Default free preprocessor for repo mapping, file triage, summarization, prompt compression, and mechanical analysis |
| **flash** | `gemini-review.sh '<prompt>'` | Stronger free synthesis for long-context analysis, structured briefing, and cross-file understanding |
| **pro** | `gemini-review.sh '<prompt>' pro` | Deep reasoning only when free tiers are insufficient and the task truly justifies it |

Prompt limit: keep prompts compressed before escalation.
Use stable model IDs in scripts where possible; avoid preview aliases as default unless you intentionally want preview behavior.

---

## Post-completion memory

After significant work, produce a compact summary (5 bullets or fewer) for:
- The repo's `decision-log.md` (confirmed architecture/workflow decisions only)
- `CLAUDE.md` updates if a new stable convention was established
- Auto memory if it is a cross-repo preference

---

## Cost ratios (rough)

Gemini Flash-Lite: **free** — first choice for preprocessing, triage, compression, and high-volume lightweight tasks.
Gemini Flash: **free** — second free choice for stronger synthesis and large-context analysis.
Haiku: ~25× cheaper than Opus. **Default for Claude-side paid work after free preprocessing.**
Sonnet: ~5× cheaper than Opus. Escalation from Haiku only for verified difficulty.
Opus: reserve for genuinely hard, high-blast-radius problems. Do not escalate out of impatience.
Codex cheap: `gpt-5.4-mini` at minimal/low effort — cheapest Codex pass.
Codex default: `gpt-5.4-mini` at medium effort — default for most Codex tasks.
Codex hard: `gpt-5.4-mini` at high effort — escalate before changing models.
Codex risk: `gpt-5.4` at low/medium effort — reserve for auth, migrations, prod-touching work.
Codex critical: `gpt-5.4` at high/xhigh effort — panic-room use only.
Gemini Pro: reserve for rare deep reasoning only.