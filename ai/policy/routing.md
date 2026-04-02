# AI Routing Policy — Unified System

This is the canonical routing policy for all AI tools in this workspace.
Both Claude Code and Codex operate as one unified system — each reads this as the source of truth.

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

## Cross-engine routing rules

1. **Default**: Claude Sonnet handles the task alone.
2. **Parallel load (3+ sub-agents)**: route 1–2 self-contained tasks to Codex to spread the load.
3. **Second opinion**: call Codex standard when confidence is low or a bug persists after 1–2 Claude attempts.
4. **Code review**: Codex standard for normal diffs; Codex max for auth, migrations, high-stakes code.
5. **Context budget exhausted**: use `cheap-prep` (Haiku) to compact before handing to any engine.
6. **Hard architecture**: compact with `cheap-prep`, then escalate to Claude Opus.

---

## Post-task memory

After significant work, write a compact summary (5 bullets or fewer) to:
- The repo's `decision-log.md` — confirmed architecture/workflow decisions only
- `CLAUDE.md` — if a new stable convention was established
- Auto memory — if it is a cross-repo preference

---

## Canonical location

`brain/ai/policy/routing.md`

Referenced by:
- `brain/operations/system-configs/claude/CLAUDE.md` (Claude Code global config)
- `brain/operations/system-configs/codex/AGENTS.md` (Codex global config)
- `brain/ai/skills/custom/model-router/SKILL.md` (Claude skill shim)
