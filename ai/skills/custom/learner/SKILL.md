---
name: learner
description: Extract hard-won problem-solving patterns from the current session and save them as reusable skills in brain/ai/skills/custom/learned/. Shared across Claude, Codex, and Gemini. Use this skill when the user says "learn this", "save this as a skill", "extract this pattern", "remember how we fixed this", or when wrapping up a session where something tricky was solved. Also trigger proactively at the end of sessions where non-obvious debugging, workarounds, or codebase-specific knowledge was discovered — the kind of thing that would take real effort to rediscover. Do NOT trigger for generic code patterns, refactoring, or anything a junior dev could Google.
---

# Learner

Captures hard-won, session-specific knowledge and turns it into a reusable skill.

This is a shared AI-agnostic skill. Claude, Codex, and Gemini should all use the same extraction bar, the same destination folder, and the same skill format so the learned pattern is available regardless of which engine discovered it.

The goal is not to document what happened — it's to distill *why it was hard* and *what to think next time* so future sessions skip the painful rediscovery.

## Quality Gate

Before creating a skill, validate it passes **all three** of these:

1. **Not Googleable** — the answer isn't in official docs or a Stack Overflow top result
2. **Codebase-specific** — it depends on this project's file layout, config quirks, or tool stack
3. **Took real effort** — it required actual debugging, workarounds, or non-obvious reasoning

If it fails any of these, skip it. Generic patterns, library examples, and refactoring techniques are not skills — they're noise that dilutes the system.

**Anti-patterns to reject:**
- "Use `Array.map()` to transform data"
- "Run `npm install` after adding a package"
- "Check `.env` for missing variables"
- Anything a new hire could find in the README in 2 minutes

## What makes a good skill

A good skill teaches **how to think about a class of problem**, not a copy-paste solution.

Good skill content includes:
- The underlying principle (why the fix works, not just what it is)
- File paths, config keys, or line numbers that are specific to this repo
- The recognition pattern — what symptoms surface this problem
- Edge cases or gotchas that aren't obvious

Bad skill content:
- Step-by-step instructions for standard CLI tools
- Code snippets without context about when/why to use them
- Anything that will be stale in a week

## Skill types

**Expertise** — domain knowledge: "When you see X symptom in this repo, it means Y, and the fix is Z." Captures a mental model.

**Workflow** — operational procedure: "To do X in this stack, the sequence is A → B → C, and step B has a gotcha." Captures a process.

## Extraction workflow

### Step 1 — Gather the raw material

Reconstruct from the session:
- **Problem**: What was the specific error, failure, or confusion? Include file paths and error messages.
- **Dead ends**: What did you try that didn't work, and why?
- **Solution**: The exact fix — code, config, command, or decision.
- **Why it works**: The underlying reason, not just the symptom/fix pair.
- **Triggers**: What phrases or symptoms would make this skill relevant in a future session?

For recurring local failures, first run:

```bash
brain-learn-failures --repo . --write-report
```

Use the report as input only. It never writes skills or agent instructions. Promote a finding only if it passes the quality gate above.

### Step 2 — Classify and name

- Is this Expertise (a mental model) or Workflow (a procedure)?
- Pick a short, specific name: `{repo}-{problem-area}` or `{tool}-{gotcha}` (e.g., `probot-slack-auth`, `supabase-migration-order`)
- Avoid generic names like `debugging-tips` or `node-patterns`

### Step 3 — Write the skill file

Save to: `brain/ai/skills/custom/learned/{skill-name}/SKILL.md`

Use this template:

```markdown
---
name: {skill-name}
description: {One sentence: when to trigger this skill and what it provides. Be specific — include the symptom or scenario.}
---

# {Skill Name}

## The insight
{The underlying principle. Why does this problem exist? What's the mental model that makes the solution obvious?}

## When this applies
{Symptoms, error messages, or scenarios that surface this problem. Be concrete — copy actual error text if relevant.}

## The approach
{How to think about solving it. Decision heuristics, not step-by-step instructions. What to check first, what to rule out.}

## The fix
{The actual solution. File paths, exact commands, config keys. Specific enough to act on without re-investigation.}

## Gotchas
{Edge cases, ordering constraints, things that look like this problem but aren't.}

## Context
Repo: {repo name}  
Discovered: {YYYY-MM-DD}  
Area: {file path or subsystem}
```

Omit sections that don't add value. The insight and when-this-applies sections are the most important — don't skip them.

### Step 4 — Create the symlink

```bash
# Create the learned/ directory if it doesn't exist
mkdir -p /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/learned/{skill-name}

# Symlink into active/
ln -s ../custom/learned/{skill-name} \
  /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/{skill-name}
```

Verify the symlink resolves correctly:
```bash
ls -la /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/{skill-name}
```

### Step 5 — Confirm with the user

Show the user:
1. The skill name and one-line description
2. The full SKILL.md content
3. Confirm they're happy before writing

If they want changes, revise before saving.

## Scope

**User-level** (this system) — save to `brain/ai/skills/custom/learned/`. Applies across all repos.

**Project-level** — if the knowledge is too repo-specific to generalize, note it in the repo's local instructions file (`CLAUDE.md`, `AGENTS.md`, or `GEMINI.md`) or `decision-log.md` instead. Don't create a skill for a one-repo gotcha unless the pattern will recur.

## What not to save as a skill

If the knowledge is better placed elsewhere, redirect:
- Durable architecture decisions → repo's `decision-log.md`
- Workflow preferences (how Claude should behave) → auto memory (`feedback` type)
- Project context (who's doing what, why) → auto memory (`project` type)
- One-off debugging noise → nowhere (let it go)
