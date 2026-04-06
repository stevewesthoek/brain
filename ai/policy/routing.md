# AI Routing Policy — Unified System

This is the canonical routing policy for all AI tools in this workspace.
Claude Code, Codex, and Gemini operate as one unified system — each reads this as the source of truth.
Safety and high-risk action policy canonical source: `brain/ai/policy/guardrails.md`.

Tool-specific config files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) embed the relevant parts of this policy.
When updating routing rules, update this file first, then sync the tool configs.

---

## The unified system

Three AI engines work together. Claude always orchestrates — route sub-tasks by fit and cost:

| Engine | Role | Best at |
|--------|------|---------|
| **Claude** | Orchestrator | Long-context reasoning, repo-wide tasks, iterative coding, architecture, memory, skills |
| **Codex** | Reviewer / Parallel executor | Isolated well-scoped tasks, code review, second opinions, fast parallel checks |
| **Gemini Flash** | Preprocessor | Large context ingestion (1M tokens), bulk analysis, free-tier summarization |

**Cost priority:** Gemini Flash (free) > Haiku (cheapest paid) > Codex mini > Sonnet > Codex standard > Opus / Codex max

---

## Claude model tiers

| Agent | Model | Use when |
|-------|-------|----------|
| `cheap-prep` | Haiku | Summarization, triage, context compaction, commit drafting, lightweight classification |
| `coder-default` | Sonnet | All normal coding — features, bugs, refactors, tests (default for everything) |
| `deep-architect` | Opus | Complex architecture, major migrations, high blast radius, repeated Sonnet failures |

**Escalation rules:**
- Default to Sonnet. Do not escalate out of impatience.
- Before escalating to Opus: use Gemini Flash or `cheap-prep` (Haiku) to compact context first. Never pass raw conversation history to Opus.
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
- Codex runs on a paid subscription (ChatGPT Plus) — use deliberately, not freely.

---

## Gemini model tiers

Invoked via `brain/tools/gemini-review.sh`. Route by context size and task type.

| Tier | Invocation | Model | Free tier | Use when |
|------|-----------|-------|-----------|----------|
| **flash** (default) | `gemini-review.sh '<prompt>'` | gemini-2.0-flash | ~1500 RPD, ~1M TPM | Large context, bulk analysis, free preprocessing — DEFAULT |
| **pro** | `gemini-review.sh '<prompt>' pro` | gemini-2.5-pro | ~50 RPD | Deep reasoning when Flash is insufficient; conserve |

**Gemini rules:**
- Flash is free — use it liberally for preprocessing and summarization.
- Gemini Flash context window: 1M tokens — pass large inputs in one shot, never chunk unnecessarily.
- Pro free tier is limited (~50 RPD) — conserve; only use for reasoning-heavy tasks Flash can't handle.
- Gemini output feeds Claude/Codex — produce compact, structured summaries, not verbose prose.
- Do not use Gemini for high-stakes code review (auth, migrations) — use Codex max or Claude Opus.

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

**After completing any task that used multiple agents:** report which agents/models were used (one line: "Used: Sonnet + Gemini Flash preprocessing + Codex mini").

---

## Cross-engine routing rules

1. **Default**: Claude Sonnet handles the task alone.
2. **Large context input** (>100k tokens of raw files, logs, or docs): run Gemini Flash first to produce a compact briefing, then work in Claude on the summary.
3. **Bulk preprocessing**: use Gemini Flash to summarize many files or a large codebase before Claude analyzes or acts.
4. **Parallel load (3+ sub-agents)**: route 1–2 self-contained tasks to Codex and/or Gemini Flash to spread load and cut cost.
5. **Second opinion on code/logic**: call Codex standard (not Gemini) — Codex is stronger at code review.
6. **Context budget exhausted**: use Gemini Flash (free) or `cheap-prep` (Haiku) to compact before handing to any engine.
7. **Hard architecture**: compact with Gemini Flash or `cheap-prep`, then escalate to Claude Opus.
8. **Free-tier first**: for pure analysis/summarization with no code quality requirement, prefer Gemini Flash (free) over Haiku (paid).

---

## Skill sequences

Common task types and the skills that compose well together.

| Task type | Skill sequence |
|-----------|---------------|
| Ship a feature | `/review` → `/codex` (second opinion) → `/ship` → `/land-and-deploy` |
| Debug a hard problem | `/investigate` → `/codex` (second opinion if stuck) → `/learner` (if non-obvious fix) |
| Analyze large codebase | `/gemini` (Flash preprocessing) → Claude acts on summary |
| New repo setup | `/handoff setup` → build → `/review` → `/ship` |
| Infrastructure change | `/hetzner` or `/azure` → `/careful` (if destructive) → `/handoff pause` |
| Research → build | `/notebooklm` → `/office-hours` → `/plan-eng-review` → build |
| Large log/doc analysis | `gemini-review.sh` (Flash) → Claude acts on findings |
| End of any session | `/handoff pause` → `/learner` (if warranted) |

Don't chain skills speculatively. Add a step only if it has clear value for that task.

---

## Post-task memory

After significant work, write a compact summary (5 bullets or fewer) to the right layer:

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
- `brain/operations/system-configs/gemini/GEMINI.md` (Gemini global config)
- `brain/ai/skills/custom/model-router/SKILL.md` (Claude skill shim)

**Sync discipline:** `AGENTS.md` and `GEMINI.md` embed role-specific routing summaries inline for agent-local context. When updating routing rules here, check those files for stale inline tables or contradicting instructions. The model tiers table and cost priority order are the most likely to drift.
