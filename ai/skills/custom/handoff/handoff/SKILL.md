---
name: handoff
description: Use when starting or ending a Claude/Codex/Gemini work session — writes compressed handoff to .ai/current.md, loads minimal context on resume, or sets up the .ai/ memory system in a repo.
---

# Session Handoffs

## What this skill is for

Manage Claude and Codex session continuity with minimal token overhead. The handoff system divides session memory into:

1. **`.ai/current.md`** — Short-term resumable state (gets overwritten each session)
2. **`decision-log.md`** — Long-term durable decisions (append-only archive)
3. **`.ai/handoffs/`** — Timestamped copies of past handoffs (optional, for history)

This skill helps pause work at the end of a session with a compressed handoff, resume from a prior handoff, or initialize the `.ai/` memory system in a new repo.

## Use this skill when

- **Ending a meaningful session** — Compress session state into `.ai/current.md` before pausing
- **Starting a new session in the same repo** — Load `.ai/current.md` for fast context restoration
- **Initializing a repo** — Set up the `.ai/` memory system and `decision-log.md` template
- **Rolling out memory infrastructure** — Set up `.ai/` across multiple repos at once
- **Verifying memory hygiene** — Check that current.md and decision-log.md follow conventions

## Do not use this skill for

- Storing speculative ideas, debug noise, or one-off temporary notes
- Recording secrets, tokens, credentials, or API keys
- Tracking raw conversation history — use summaries instead
- Dumping full session transcripts — compress ruthlessly
- Overwriting existing user work without inspection and confirmation

## Rules

1. **Inspect before writing.** Always show the exact plan and wait for confirmation before creating or modifying `.ai/` files.
2. **Never silently overwrite.** If files exist, show diffs or previews; never blindly truncate or replace.
3. **Token optimization first.** Compress aggressively — `.ai/current.md` should be 200–500 tokens, not thousands.
4. **Decisions are append-only.** `decision-log.md` never gets rewritten; new entries append with timestamps.
5. **Secrets stay out.** Never write API keys, tokens, credentials, or auth information to `.ai/` files.
6. **This skill applies to Claude, Codex, and Gemini.**

## Handoff commands

### `/handoff pause` or `/handoff end`

End a meaningful session and write compressed state to `.ai/current.md`.

**Steps:**
1. Summarize current task in 1–2 sentences
2. Capture file paths that were touched (just the names, not full content)
3. List any decisions made during this session
4. Note next steps (concise bullet list)
5. Flag any blockers or missing info
6. Decide where this session's information belongs — promote to the right layer, let the rest go:

   | What you have | Where it goes |
   |---------------|---------------|
   | Confirmed architecture or workflow decision | `decision-log.md` — append a dated entry |
   | New stable convention (global or this repo) | `CLAUDE.md` (repo or `~/.claude/CLAUDE.md`) |
   | Cross-repo preference or repeated correction | Auto memory — feedback or user type |
   | Non-obvious bug fix, codebase gotcha, workaround | `/learner` → extracted as a reusable skill |
   | Everything else (temp state, files, next steps) | `.ai/current.md` only — it expires next session |

   Default: if unsure, write it to `.ai/current.md` and let it expire. Promote only when it will matter again.
7. Write `.ai/current.md` with this exact structure:

```markdown
# Current Handoff

## Repo
[repo path or name]

## Tool
[Claude Code / Codex]

## Goal
[1–2 sentence summary of the work goal]

## Status
[Current state: "in progress", "paused", "blocked", etc.]

## Files touched
- path/to/file1
- path/to/file2
[just names, no content dump]

## Decisions made
- [Decision 1 + brief reason]
- [Decision 2 + brief reason]
[if none, write "None this session"]

## Next steps
- [Step 1]
- [Step 2]
[bulleted, concise]

## Blockers
[Any blockers or missing info, or "None"]

## Resume prompt
[Exact prompt to paste when resuming: "Resume from [task], continue with [next step]"]
```

8. If decision-log update needed, append to `decision-log.md`:

```markdown
## YYYY-MM-DD -- [title]
- Decision:
- Reason:
- Impact:
```

9. Optionally, save a timestamped copy to `.ai/handoffs/YYYY-MM-DD-HH-MM-SS.md` (archive)
10. **Learner check:** Before closing, ask: "Did anything non-obvious get solved this session — a tricky bug, a workaround, a codebase-specific gotcha?" If yes, prompt: "Run the shared `/learner` skill to extract it as a reusable skill before you go."

### `/handoff resume`

Load prior session state and re-prime context for minimal token cost.

**Steps:**
1. Load `CLAUDE.md` (repo or global rules)
2. Load `.ai/current.md` (current task state)
3. Load `decision-log.md` (relevant durable decisions, skim only)
4. Summarize in 5 bullets max:
   - Repo and tool
   - Current goal
   - Files involved
   - Prior decisions (if relevant)
   - Blockers or unknowns
5. Restate next steps
6. Ask: "Ready to resume? Confirm or clarify context."

### `/handoff setup`

Initialize the `.ai/` memory system in a repo.

**Steps:**
1. Inspect the repo root and existing `.ai/` folder (if any)
2. Check for `decision-log.md`
3. Check for `CLAUDE.md` and its memory section
4. Print exact plan:
   - "Will create `.ai/` folder: [yes/no]"
   - "Will create `.ai/current.md`: [yes/no]"
   - "Will create `.ai/handoffs/` folder: [yes/no]"
   - "Will create `decision-log.md`: [yes/no]"
   - "Will update `CLAUDE.md` memory section: [yes/no]"
5. Wait for confirmation
6. Execute:
   - Create `.ai/` if missing
   - Create `.ai/current.md` with blank template if missing
   - Create `.ai/handoffs/` if missing
   - Create `decision-log.md` if missing (use template below)
   - If `CLAUDE.md` exists and lacks memory section, append memory workflow section (see template below)
7. Verify all files exist and print summary

### `/handoff rollout`

Set up `.ai/` memory infrastructure across multiple Git repos.

**Steps:**
1. Inspect current folder for Git repos
2. For each repo, check which files are missing:
   - `.ai/current.md`
   - `.ai/handoffs/`
   - `decision-log.md`
   - `CLAUDE.md` memory section
3. Print repo-by-repo plan with counts
4. Wait for approval
5. Execute setup for each repo
6. Print summary: "Set up X repos, updated Y, skipped Z"

## Templates

### `.ai/current.md` blank template

```markdown
# Current Handoff

## Repo
[repo]

## Tool
[Claude Code / Codex]

## Goal
[goal]

## Status
[status]

## Files touched
[files]

## Decisions made
[decisions or "None this session"]

## Next steps
[next steps]

## Blockers
[blockers or "None"]

## Resume prompt
[resume prompt]
```

### `decision-log.md` template (initial)

```markdown
# Decision Log

Durable decisions for [repo name]. Append-only archive.

## YYYY-MM-DD -- [title]
- Decision:
- Reason:
- Impact:
```

### `CLAUDE.md` memory section (append if missing)

```markdown
## Memory

This repo uses `.ai/current.md` for session handoffs (short-term resumable state) and `decision-log.md` for durable decisions (long-term architecture).

### `.ai/` directory structure
- `.ai/current.md` — Resumable session state (overwritten each session)
- `.ai/handoffs/` — Archive of past handoffs (timestamped, optional)

### Workflow
- At end of session: Run `/handoff pause` to write `.ai/current.md`
- At start of session: Run `/handoff resume` to load context
- Before major decisions: Check `decision-log.md` for prior context
- After key decisions: Update `decision-log.md` if decision is durable

### Token optimization
- `.ai/current.md` is ruthlessly compressed: 200–500 tokens max
- No speculative ideas, debug noise, or secrets in either file
- `decision-log.md` is append-only; entries are never deleted or rewritten
```

## Handoff memory examples

### Example: Pausing a feature branch

**Session context:**
- Working on ProBot feature: "add webhook retry logic"
- Touched: `apps/probot/src/hooks.ts`, `apps/probot/src/retry.ts`
- Decision made: "Use exponential backoff with max 3 retries"
- Next: Write tests for retry logic
- Blocker: Need to verify webhook signature validation

**`.ai/current.md` output:**
```markdown
# Current Handoff

## Repo
prochattools/ops/probot

## Tool
Claude Code

## Goal
Add webhook retry logic with exponential backoff (max 3 retries)

## Status
in progress — core retry logic written, tests pending

## Files touched
- apps/probot/src/hooks.ts (modified)
- apps/probot/src/retry.ts (created)

## Decisions made
- Use exponential backoff with max 3 retries (standard pattern, handles transient failures)

## Next steps
- Write unit tests for retry logic
- Add integration test for webhook failure scenario
- Verify retry behavior with live webhook endpoint

## Blockers
- Need to review webhook signature validation before testing

## Resume prompt
Resume from: Add webhook retry logic. Continue with unit tests for retry.ts.
```

**`decision-log.md` entry (if durable):**
```markdown
## 2026-04-04 -- Webhook retry strategy

- Decision: Exponential backoff with max 3 retries
- Reason: Handles transient failures without overwhelming the sender; aligns with industry standard
- Impact: ProBot webhooks will retry on failure; requires test coverage for retry exhaustion path
```

### Example: Resuming from handoff

**Load `.ai/current.md`:**

```
Repo: prochattools/ops/probot
Goal: Add webhook retry logic
Status: Core logic written, tests pending
Files: apps/probot/src/hooks.ts, retry.ts
Prior decision: Exponential backoff, max 3 retries
Blocker: Webhook signature validation review needed
Next: Unit tests for retry.ts
```

**Summary:**
```
- Working on ProBot webhook retry feature
- Exponential backoff strategy already decided
- Core code exists; needs test coverage
- Minor blocker: signature validation review
- Resume: Write tests for retry.ts
```

## Integration with gstack skills

This skill is repo-agnostic and complements other skills:

- **`/codex`** — Use handoff to prep Codex review sessions (load `.ai/current.md` for context)
- **`/review`** — Handoff captures decisions made during review for durable storage
- **`/ship`** — Before shipping, handoff summarizes PR context and approval decisions
- **`/investigate`** — Handoff documents investigation findings for later reference

## Safety notes

- **No secrets in handoffs.** API keys, credentials, env vars, and auth tokens must never be in `.ai/current.md` or `decision-log.md`.
- **Inspect before overwriting.** Always show a preview or ask for confirmation before modifying existing handoff files.
- **Decisions are permanent.** `decision-log.md` entries should be high-signal only; avoid append-only log spam.
- **This applies to both Claude and Codex.** Both models should follow these same conventions.

## See also

- `CLAUDE.md` — Global session and memory conventions
- `~/.claude/CLAUDE.md` — Global guardrails policy on memory storage
- `decision-log.md` — Repo-specific durable decisions (append-only)
