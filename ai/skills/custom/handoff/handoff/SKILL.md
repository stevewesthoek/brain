---
name: handoff
description: Use when pausing, resuming, setting up, or checking Claude/Codex/Gemini repo work. Writes compressed state to .ai/current.md, appends durable decisions to .ai/decision-log.md, and resumes with minimal context.
---

# Session Handoffs

## Purpose

Maintain repo work continuity with minimal token cost.

This skill prevents long AI sessions from carrying bloated conversation history. It compresses only the useful state needed to resume work in a fresh session.

## Memory layers

1. .ai/current.md — short-term resumable state, overwritten each session
2. .ai/decision-log.md — durable decisions, append-only
3. .ai/handoffs/ — optional archive for important handoffs only

## Use this skill when

- Ending a meaningful Claude/Codex/Gemini session
- Starting a fresh session in the same repo
- Setting up AI memory files in a repo
- Checking whether repo memory is clean and token-efficient
- Archiving an important milestone handoff
- Rolling out the same .ai/ memory structure across multiple repos

## Do not use this skill for

- Storing raw chat transcripts
- Storing full logs
- Storing speculative ideas
- Storing secrets, credentials, tokens, API keys, cookies, private keys, or env values
- Recording temporary debugging noise
- Replacing proper project documentation
- Writing long summaries "just in case"

## Core rules

1. Token optimization first.
   - .ai/current.md must be ruthlessly compressed.
   - Target: 200–500 tokens.
   - Hard max: 800 tokens unless the user explicitly asks for more.

2. Current handoff is disposable.
   - .ai/current.md may be overwritten during /handoff pause.
   - If the handoff system already exists, do not ask for confirmation before overwriting .ai/current.md.
   - Show a compact preview before writing.

3. Durable decisions are append-only.
   - .ai/decision-log.md is never rewritten.
   - Only append high-signal decisions that will matter later.
   - Do not log routine implementation details.

4. No secrets.
   - Never write secrets, credentials, API keys, private env values, auth tokens, cookies, private URLs, database passwords, or webhook secrets.
   - If a secret appears in context, replace it with [REDACTED].

5. No transcript dumping.
   - Summarize outcomes, decisions, touched files, and next actions.
   - Do not preserve the conversation.

6. Avoid confirmation loops.
   - For normal pause/resume, act directly.
   - Ask confirmation only for setup, rollout, deleting files, changing durable conventions, or overwriting non-handoff user content.

7. One exact next step.
   - Every handoff must contain one clear next action.
   - Avoid vague next steps like "continue implementation."

8. Cross-tool compatibility.
   - This skill applies to Claude Code, Codex CLI, Gemini CLI, and similar coding agents.

# Commands

## /handoff pause or /handoff end

Use at the end of a meaningful work session.

### Behavior

1. Inspect whether .ai/ exists.
2. If .ai/ does not exist, suggest /handoff setup.
3. Create a compact handoff preview.
4. Overwrite .ai/current.md automatically if it is an existing handoff file.
5. Append to .ai/decision-log.md only if durable decisions were made.
6. Do not archive unless this was an important milestone or the user explicitly asks.

### Write .ai/current.md with this exact structure

# Current Handoff

## Repo
[repo name/path]

## Tool
[Claude Code / Codex / Gemini]

## Goal
[1–2 sentence goal]

## Status
[in progress / paused / blocked / ready to test / ready to ship]

## Files touched
- [path] — [created/modified/read]

## Decisions made
- [decision + brief reason]
or: None this session

## Next step
[one exact next action]

## Blockers
[blocker or None]

## Do not repeat
- [failed attempt / dead end / irrelevant path]
or: None

## Resume prompt
Resume this repo from .ai/current.md and continue with: [exact next action]

### Promotion rules

Use the correct memory layer:

- Temporary task state goes to .ai/current.md
- One exact next action goes to .ai/current.md
- Files touched this session go to .ai/current.md
- Durable architecture/workflow decisions go to .ai/decision-log.md
- Global repo rules or conventions go to CLAUDE.md only with confirmation
- Reusable bug fixes, workarounds, or gotchas should be suggested for extraction into a reusable skill
- Raw logs, failed attempts, and chat history must not be stored
- Secrets and env values must never be stored

## /handoff resume

Use at the start of a fresh session.

### Behavior

1. Read .ai/current.md.
2. Read .ai/decision-log.md only for entries directly relevant to the current handoff.
3. Read CLAUDE.md only when needed for repo-specific rules.
4. Summarize context in max 5 bullets.
5. Continue with the next step immediately unless there is a real blocker.

### Resume output format

## Resumed context

- Repo/tool:
- Goal:
- Current status:
- Relevant files:
- Next step:

Proceeding with: [exact next action]

Do not ask "Ready to resume?" unless the handoff is missing, contradictory, or blocked.

## /handoff setup

Use once per repo.

### Behavior

1. Inspect repo root.
2. Check for:
   - .ai/
   - .ai/current.md
   - .ai/decision-log.md
   - .ai/handoffs/
   - CLAUDE.md
3. Print exact setup plan.
4. Wait for confirmation.
5. Create missing files/folders.
6. Verify all expected paths exist.

### Setup plan format

## Handoff setup plan

- Create .ai/: [yes/no]
- Create .ai/current.md: [yes/no]
- Create .ai/decision-log.md: [yes/no]
- Create .ai/handoffs/: [yes/no]
- Update CLAUDE.md: [yes/no]

Awaiting confirmation before writing files.

### Blank .ai/current.md template

# Current Handoff

## Repo
[repo]

## Tool
[Claude Code / Codex / Gemini]

## Goal
[goal]

## Status
[status]

## Files touched
None

## Decisions made
None this session

## Next step
[next exact action]

## Blockers
None

## Do not repeat
None

## Resume prompt
Resume this repo from .ai/current.md and continue with: [next exact action]

### .ai/decision-log.md template

# Decision Log

Durable decisions for this repo.

Rules:
- Append-only.
- High-signal decisions only.
- No secrets.
- No routine implementation notes.
- No raw logs.

## YYYY-MM-DD — [title]

- Decision:
- Reason:
- Impact:

### Optional CLAUDE.md memory section

Append only if CLAUDE.md exists and the user confirms.

## Session handoffs

This repo uses .ai/current.md for short-term session handoffs and .ai/decision-log.md for durable decisions.

Workflow:
- End session: /handoff pause
- Start session: /handoff resume
- Archive milestone: /handoff archive
- Check memory hygiene: /handoff check

Rules:
- .ai/current.md is overwritten each session.
- .ai/current.md should stay between 200–500 tokens.
- .ai/decision-log.md is append-only.
- Never store secrets, full logs, or raw transcripts.

## /handoff archive

Use only for important milestones.

### Behavior

1. Read .ai/current.md.
2. Copy it to .ai/handoffs/YYYY-MM-DD-HH-MM-SS.md.
3. Do not archive routine handoffs by default.

Archive when:

- A major feature is completed
- A release/PR is ready
- Architecture changed
- A hard bug was solved
- The user explicitly asks

## /handoff check

Use to verify memory hygiene.

### Checks

Inspect:

- .ai/current.md
- .ai/decision-log.md
- .ai/handoffs/
- CLAUDE.md memory section, if present

Report:

## Handoff hygiene check

- .ai/current.md exists: [yes/no]
- Current handoff token size: [estimate]
- Current handoff is concise: [yes/no]
- Decision log exists: [yes/no]
- Decision log has obvious noise: [yes/no]
- Archive folder exists: [yes/no]
- Secrets detected: [yes/no]
- Recommended cleanup:
  - [action]

Never print suspected secrets. Only report that sensitive-looking values may exist.

## /handoff rollout

Use to set up .ai/ memory infrastructure across multiple Git repos.

### Behavior

1. Inspect current folder for Git repos.
2. For each repo, check:
   - .ai/current.md
   - .ai/decision-log.md
   - .ai/handoffs/
   - CLAUDE.md memory section
3. Print repo-by-repo setup plan.
4. Wait for approval.
5. Execute setup for approved repos.
6. Print summary.

### Rollout summary format

## Handoff rollout summary

- Repos scanned:
- Repos updated:
- Repos skipped:
- Files created:
- Files left unchanged:
- Problems:

# Examples

## Example .ai/current.md

# Current Handoff

## Repo
prochattools/prokit

## Tool
Claude Code

## Goal
Finish Stripe checkout flow cleanup for SaaSKit funnel.

## Status
in progress — checkout env handling updated, tests pending

## Files touched
- src/lib/stripe/config.ts — modified
- src/app/api/checkout/route.ts — modified
- docs/stripe-checkout.md — read

## Decisions made
- Centralize Stripe price IDs in config.ts to avoid duplicated env access.

## Next step
Run lint/typecheck and fix any checkout route failures.

## Blockers
None

## Do not repeat
- Do not reintroduce hardcoded Stripe price IDs in route files.

## Resume prompt
Resume this repo from .ai/current.md and continue with: run lint/typecheck and fix checkout route failures.

## Example .ai/decision-log.md entry

## 2026-04-16 — Centralized Stripe checkout configuration

- Decision: Stripe price IDs and checkout URLs are read from src/lib/stripe/config.ts.
- Reason: Avoid duplicated env reads and reduce checkout drift across funnel pages.
- Impact: Future checkout changes must update config.ts instead of route/page files directly.

# Safety notes

- Never store secrets.
- Never store full transcripts.
- Never store raw logs unless the user explicitly asks, and even then redact aggressively.
- Never rewrite .ai/decision-log.md; append only.
- Never update CLAUDE.md without confirmation.
- Prefer action over confirmation during normal pause/resume.