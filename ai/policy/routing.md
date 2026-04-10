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

**Cost priority:** Gemini Flash (free) > Haiku (cheapest paid) > Codex low > Codex mini > Sonnet > Codex standard > Opus / Codex max

---

## Claude model tiers

| Agent | Model | Use when |
|-------|-------|----------|
| `cheap-prep` | Haiku | **DEFAULT** — all tasks start here: coding, summarization, triage, commits, fixes, reviews |
| `coder-default` | Sonnet | Escalate from Haiku when: task needs multi-file reasoning, Haiku struggled, or complexity is clearly high |
| `deep-architect` | Opus | Escalate from Sonnet when: major architecture ambiguity, high blast radius (prod/auth/migrations), or Sonnet failed 2+ times |

**Escalation ladder (start cheap, escalate when struggling):**
1. Start at Haiku (`cheap-prep`) for every task — including coding.
2. Escalate to Sonnet (`coder-default`) when: Haiku output is insufficient, task clearly spans many files, or problem requires deeper reasoning.
3. Escalate to Opus (`deep-architect`) only when: Sonnet failed 2+ attempts, blast radius is high (prod data, auth, migrations), or design ambiguity spans multiple systems.
4. Before escalating to Opus: always compact context with Gemini Flash or Haiku first. Never pass raw history to Opus.
5. Do not escalate out of impatience — attempt the cheaper tier first.

**Cost ratios (rough):** Haiku ~25× cheaper than Opus. Sonnet ~5× cheaper than Opus.

---

## Codex model tiers

Invoked via `brain/tools/codex-review.sh`. Start low, escalate when struggling.

| Tier | Invocation | Model | Effort | Use when |
|------|-----------|-------|--------|----------|
| **low** | `codex-review.sh '<prompt>'` | gpt-5.4 | low | **DEFAULT** — start here for all Codex tasks |
| **mini** | `codex-review.sh '<prompt>' mini` | codex-mini-latest | low | Fast parallel filler only (small, isolated sanity checks) |
| **standard** | `codex-review.sh '<prompt>' standard` | gpt-5.4 | medium | Escalate when low is insufficient; normal code review |
| **max** | `codex-review.sh '<prompt>' max` | gpt-5.4 | xhigh | Escalate for auth, migrations, prod-touching, deep critique |

**Codex escalation rules:**
1. Default to `low`. Most tasks complete fine here.
2. Escalate to `standard` when: low output is insufficient or task needs deeper reasoning.
3. Escalate to `max` only when: auth, migrations, prod-touching, or standard failed.
4. Always compress context before calling — prompt must stay under 12k chars.
5. Treat Codex output as advisory — integrate only the useful parts.
6. Max 1–2 Codex calls per task; do not chain without clear value.
7. Codex runs on a paid subscription (ChatGPT Plus) — use deliberately, not freely.

---

## Gemini model tiers

Invoked via `brain/tools/gemini-review.sh`. Route by context size and task type.

| Tier | Invocation | Model | Free tier | Use when |
|------|-----------|-------|-----------|----------|
| **flash** (default) | `gemini-review.sh '<prompt>'` | gemini-2.5-flash | ~1500 RPD, ~1M TPM | Large context, bulk analysis, free preprocessing — DEFAULT |
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
**Start at the cheapest tier. Escalate only when the cheaper tier struggles or clearly cannot handle the task.**

**Decompose into sub-agents when ALL of these are true:**
- The task has 3+ distinct subtasks that can be worked independently, OR involves 6+ files across different concerns
- Routing to cheaper agents saves an estimated ≥20% of total tokens vs handling everything in Sonnet
- The overhead of decomposition (spawning agents, merging results) is less than the savings

**Do not decompose when:**
- The task is small (single file, single fix, one clear question)
- Subtasks share too much context to be isolated
- Estimated savings are under 20%
- You're already inside a sub-agent

---

## Web Data / Research

**Firecrawl is the ONLY default for all web data tasks.** It provides:
- Web search (returns full markdown content from top results)
- Single URL scraping to clean markdown (75–90% token savings vs raw HTML)
- Async batch crawling of entire sites
- No auth required (self-hosted, private Tailscale network at `http://100.83.38.48:3002`)
- AI-agnostic: works with Claude Code, Codex, and Gemini Flash

**Always use `/firecrawl` for:**
- Research, competitive analysis, web searches
- Scraping any URL to markdown
- Crawling entire websites
- Any task that needs web content

**Pattern:**
1. Use `/firecrawl` skill to search or scrape URLs → get clean markdown
2. For large results (10k+ tokens), preprocess with Gemini Flash (free tier) to extract key findings
3. Claude/Codex/Gemini synthesizes findings into final output

**NEVER use:**
- Raw `WebFetch` (returns verbose HTML, wastes tokens)
- `/browse` (retired, QA-focused)
- Ad-hoc web searching without Firecrawl

**After completing any task that used multiple agents:** report which agents/models were used (one line: "Used: Sonnet + Gemini Flash preprocessing + Codex mini").

---

## Cross-engine routing rules

1. **Default**: Claude Haiku handles the task alone. Escalate to Sonnet if struggling, then Opus if still insufficient.
2. **Large context input** (>100k tokens of raw files, logs, or docs): run Gemini Flash first to produce a compact briefing, then work in Claude Haiku (or Sonnet if needed) on the summary.
3. **Bulk preprocessing**: use Gemini Flash to summarize many files or a large codebase before Claude analyzes or acts.
4. **Parallel load (3+ sub-agents)**: route 1–2 self-contained tasks to Codex low and/or Gemini Flash to spread load and cut cost.
5. **Second opinion on code/logic**: call Codex low (not Gemini) — escalate to Codex standard only if the low result is insufficient.
6. **Context budget exhausted**: use Gemini Flash (free) or `cheap-prep` (Haiku) to compact before handing to any engine.
7. **Hard architecture**: compact with Gemini Flash or `cheap-prep`, then escalate to Claude Sonnet; if still insufficient, escalate to Opus.
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
| Web research / scraping | `/firecrawl` (search/scrape to markdown) → `/gemini` (Flash preprocess if large) → synthesize |
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
