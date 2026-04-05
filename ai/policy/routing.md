# AI Routing Policy — Unified System

This is the canonical routing policy for all AI tools in this workspace.
Both Claude Code and Codex operate as one unified system — each reads this as the source of truth.
Safety and high-risk action policy canonical source: `brain/ai/policy/guardrails.md`.

Tool-specific config files (`CLAUDE.md`, `AGENTS.md`) embed the relevant parts of this policy.
When updating routing rules, update this file first, then sync the tool configs.

---

## The unified system

Two AI engines work together. Neither is "primary" — route by task fit:

| Engine | When to use |
|--------|-------------|
| **Claude** | Long-context reasoning, repo-wide tasks, iterative coding, architecture, memory, skills |
| **Codex** | Parallel execution, isolated well-scoped tasks, code review, second opinions, fast checks |

Use both in the same session when workload warrants it. Spread parallel sub-agents across engines for diversity and throughput.

---

## Claude model tiers

| Agent | Model | Use when |
|-------|-------|----------|
| `cheap-prep` | Haiku | Summarization, triage, context compaction, commit drafting, lightweight classification |
| `coder-default` | Sonnet | All normal coding — features, bugs, refactors, tests (default for everything) |
| `deep-architect` | Opus | Complex architecture, major migrations, high blast radius, repeated Sonnet failures |

**Escalation rules:**
- Default to Sonnet. Do not escalate out of impatience.
- Before escalating to Opus: run `cheap-prep` to compact context first. Never pass raw conversation history to Opus.
- Escalate to Opus only when: major design ambiguity spans multiple systems, blast radius is high (prod data, auth, migrations), or Sonnet has failed 2+ times.

**Cost ratios (rough):** Haiku ~25× cheaper than Opus. Sonnet ~5× cheaper than Opus.

---

## Codex model tiers

Invoked via `brain/tools/codex-review.sh`. Route by task weight.

| Tier | Invocation | Model | Effort | Use when |
|------|-----------|-------|--------|----------|
| **mini** | `codex-review.sh '<prompt>' mini` | codex-mini-latest | low | Quick sanity check, obvious issue scan, fast parallel filler |
| **standard** | `codex-review.sh '<prompt>'` | config default (gpt-5.4) | high | Normal second opinion, parallel task execution, typical code review |
| **max** | `codex-review.sh '<prompt>' max` | config default (gpt-5.4) | xhigh | High-stakes review (auth, migrations, prod-touching), deep critique |

**Codex rules:**
- Always compress context before calling — prompt must stay under 12k chars.
- Treat Codex output as advisory, not authoritative — integrate only the useful parts.
- Max 1–2 Codex calls per task; do not chain without clear value.
- Do not use for tasks needing full repo context or interactive file editing.

---

## Automatic routing

Route automatically on every task — never ask the user which model to use.

**Decompose into sub-agents when ALL of these are true:**
- The task has 3+ distinct subtasks that can be worked independently, OR involves 6+ files across different concerns
- Routing to cheaper agents saves an estimated ≥20% of total tokens vs handling everything in Sonnet
- The overhead of decomposition (spawning agents, merging results) is less than the savings

**Do not decompose when:**
- The task is small (single file, single fix, one clear question)
- Subtasks share too much context to be isolated
- Estimated savings are under 20%
- You're already inside a sub-agent

**After completing any task that used multiple agents:** report which agents/models were used (one line: "Used: Sonnet + Haiku cheap-prep + Codex mini").

## Cross-engine routing rules

1. **Default**: Claude Sonnet handles the task alone.
2. **Parallel load (3+ sub-agents)**: route 1–2 self-contained tasks to Codex to spread the load.
3. **Second opinion**: call Codex standard when confidence is low or a bug persists after 1–2 Claude attempts.
4. **Code review**: Codex standard for normal diffs; Codex max for auth, migrations, high-stakes code.
5. **Context budget exhausted**: use `cheap-prep` (Haiku) to compact before handing to any engine.
6. **Hard architecture**: compact with `cheap-prep`, then escalate to Claude Opus.

---

## Skill sequences

Common task types and the skills that compose well together. Use as a starting point, not a rigid script.

| Task type | Skill sequence |
|-----------|---------------|
| Ship a feature | `/review` → `/codex` (second opinion) → `/ship` → `/land-and-deploy` |
| Debug a hard problem | `/investigate` → `/codex` (second opinion if stuck) → `/learner` (if non-obvious fix) |
| New repo setup | `/handoff setup` → build → `/review` → `/ship` |
| Infrastructure change | `/hetzner` or `/azure` → `/careful` (if destructive) → `/handoff pause` |
| Research → build | `/notebooklm` → `/office-hours` → `/plan-eng-review` → build |
| End of any session | `/handoff pause` → `/learner` (if warranted) |

Don't chain skills speculatively. Add a step only if it has clear value for that task.

---

## Post-task memory

After significant work, write a compact summary (5 bullets or fewer) to the right layer — promote to the highest layer where the information will matter again:

| Information type | Where it goes |
|-----------------|---------------|
| Confirmed architecture or workflow decision (this repo) | `decision-log.md` — append only |
| Stable convention that applies globally | `~/.claude/CLAUDE.md` or repo `CLAUDE.md` |
| Cross-repo preference or repeated correction | Auto memory (feedback or user type) |
| Hard-won codebase-specific debugging pattern | `/learner` → `ai/skills/custom/learned/` |
| Temporary session state, next steps, files touched | `.ai/current.md` only — ephemeral |
| Anything else | Let it go — don't store noise |

Promote up only when the information will recur. When in doubt, use `.ai/current.md` and let it expire.

---

## Canonical location

`brain/ai/policy/routing.md`

Referenced by:
- `brain/operations/system-configs/claude/CLAUDE.md` (Claude Code global config)
- `brain/operations/system-configs/codex/AGENTS.md` (Codex global config)
- `brain/ai/skills/custom/model-router/SKILL.md` (Claude skill shim)
