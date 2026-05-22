# Brain Agentic OS — Implementation Plan

**Date:** 2026-05-22
**Status:** Ready for Phase 1 execution
**Strategy:** `docs/system/brain-agentic-os-strategy.md`
**Roadmap:** `docs/system/brain-agentic-os-roadmap.md`

---

## Instructions for Executing Models

This plan is designed for execution by Haiku or Codex Mini. Each task is:
- Small (one file change or one shell command)
- Unambiguous (exact file path, exact content, exact command)
- Self-contained (no reasoning required about what to do)
- Verifiable (clear pass/fail check after each task)

Execute tasks in order within each phase. Do not skip tasks. Do not add scope. When a task says "write this content to this file," write exactly that content. When a task says "run this command," run exactly that command and report the result.

---

## Phase 1: GrepLoop — Autonomous Verification Loops

### Task 1.1: Create greploop skill directory

```bash
mkdir -p /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/greploop
```

**Verify:** Directory exists.

---

### Task 1.2: Write the greploop SKILL.md

Write the following content to `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/greploop/SKILL.md`:

```markdown
---
name: greploop
description: Iterative review-fix-review loop. Runs /review, feeds findings to the coding agent as fix instructions, re-runs /review, and loops until clean or max iterations reached. Use when code needs autonomous quality improvement without manual bridging between review and fix.
---

# GrepLoop — Iterative Verification Loop

You are an autonomous quality loop. When invoked, you iterate between reviewing code and fixing issues until the code is clean or the maximum iteration count is reached.

**Natural language triggers:**
- "fix all review issues"
- "loop until clean"
- "auto-fix review findings"
- "iterative review"
- "greploop"
- "review and fix automatically"
- "keep fixing until it passes"

---

## Algorithm

```
iteration = 0
max_iterations = 3

while iteration < max_iterations:
  iteration += 1

  # Step A: Run review
  findings = run /review on current diff or specified files

  # Step B: Check for clean
  if findings.length == 0:
    report "Clean after {iteration} iteration(s)."
    stop

  # Step C: Fix findings
  for each finding in findings:
    apply fix using /code fix workflow
    (fix the specific issue described, nothing else)

  # Step D: Verify fixes compile
  run typecheck / lint / test as appropriate
  if compilation fails:
    fix compilation errors before next review iteration

# Step E: Max iterations reached
if findings still remain after max_iterations:
  report remaining findings to user
  escalate: "GrepLoop completed {max_iterations} iterations. {N} issues remain. Manual review recommended."
```

---

## Rules

1. **Scope discipline.** Fix only what the review identified. Do not refactor surrounding code. Do not add features. Do not clean up unrelated issues.
2. **One finding, one fix.** Address each finding individually. Do not batch unrelated fixes into one edit.
3. **Verify after fixing.** After each iteration of fixes, confirm the code still compiles and tests pass before running the next review.
4. **Escalate, don't loop forever.** After 3 iterations, stop and report. Infinite loops waste tokens and indicate a deeper design problem.
5. **Preserve existing patterns.** When fixing, follow the conventions already in the codebase. Do not introduce new patterns to fix old ones.

---

## Integration

- **Input:** Current git diff, or specific file paths, or "all staged changes"
- **Review tool:** `/review` (the existing pre-landing PR review skill)
- **Fix tool:** Direct code editing (the executing agent's native capability)
- **Verification:** `npm run typecheck`, `npm test`, `npm run lint` — whatever the repo uses
- **Output:** Either "Clean after N iterations" or "N issues remain after max iterations"

---

## When NOT to use GrepLoop

- Single obvious fix (just fix it directly)
- Architecture-level issues that review flags (those need /code improve, not iterative fixes)
- Non-code reviews (design reviews, copy reviews)
- When the review findings contradict each other (escalate to human)

---

## Cost Routing

GrepLoop should run at the same model tier as the current session. Do not escalate models within the loop. If the fixes require deeper reasoning than the current tier can provide, exit the loop and recommend model escalation to the user.
```

**Verify:** File exists and is valid markdown.

---

### Task 1.3: Create symlink to active skills

```bash
ln -sf ../custom/greploop /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/greploop
```

**Verify:** `ls -la /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/greploop` shows symlink pointing to `../custom/greploop`.

---

### Task 1.4: Sync skills to all AI consumers

```bash
cd /Users/Office/Repos/stevewesthoek/brain && node tools/scripts/sync-ai-skills.mjs
```

**Verify:** Run `node tools/scripts/sync-ai-skills.mjs --check` and confirm it passes.

---

### Task 1.5: Verify skill is loadable

```bash
grep -l "greploop" /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/greploop/SKILL.md
```

**Verify:** File path is returned (skill is discoverable).

---

## Phase 2: opensrc — Dependency Source Access

### Task 2.1: Install opensrc globally

```bash
npm install -g opensrc
```

**Verify:** `opensrc --version` returns a version number.

---

### Task 2.2: Create opensrc skill directory

```bash
mkdir -p /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/opensrc
```

**Verify:** Directory exists.

---

### Task 2.3: Write the opensrc SKILL.md

Write the following content to `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/opensrc/SKILL.md`:

```markdown
---
name: opensrc
description: Fetch dependency source code to give AI agents deeper implementation context. Use when debugging library behavior, understanding internal patterns, or verifying how a dependency actually works versus what docs claim.
---

# opensrc — Dependency Source Reader

Fetch and read the actual source code of any npm/PyPI/crates.io dependency. When you need to understand how a library works internally — not just its API surface — use this tool.

**Natural language triggers:**
- "how does X work internally"
- "read the source of Y"
- "fetch source for Z"
- "look at the implementation of"
- "debug why this library behaves like"
- "what does this dependency actually do"
- "show me the source code of"

---

## Commands

### Fetch and get path to source

```bash
opensrc path <package-name>
```

Returns an absolute path to the cached source. Use this path with `rg`, `cat`, `find`, or any file reading tool.

### Example usage in agent workflow

```bash
# Get path to zod source
SOURCE_PATH=$(opensrc path zod)

# Search for specific implementation
rg "ZodString" "$SOURCE_PATH/src/"

# Read a specific file
cat "$SOURCE_PATH/src/types.ts"
```

### List cached sources

```bash
opensrc list
```

### Remove a cached source

```bash
opensrc remove <package-name>
```

---

## How it works

1. Resolves the package from its registry (npm, PyPI, crates.io)
2. Detects the correct version from your lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock)
3. Shallow-clones the source at the matching git tag
4. Caches globally at `~/.opensrc/`
5. Returns the filesystem path for immediate use

---

## When to use

- Debugging unexpected library behavior (the docs say X but it does Y)
- Understanding internal patterns before wrapping or extending a library
- Verifying security-sensitive behavior (auth, crypto, validation)
- Learning architecture patterns from well-maintained open source

## When NOT to use

- Simple API usage questions (read the docs first)
- Libraries with no public source (proprietary, closed-source)
- When the answer is in the library's README or changelog
```

**Verify:** File exists and is valid markdown.

---

### Task 2.4: Create symlink to active skills

```bash
ln -sf ../custom/opensrc /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/opensrc
```

**Verify:** `ls -la /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/opensrc` shows symlink.

---

### Task 2.5: Sync skills to all AI consumers

```bash
cd /Users/Office/Repos/stevewesthoek/brain && node tools/scripts/sync-ai-skills.mjs
```

**Verify:** `node tools/scripts/sync-ai-skills.mjs --check` passes.

---

### Task 2.6: Verify opensrc works

```bash
opensrc path zod
```

**Verify:** Returns a valid filesystem path (e.g., `~/.opensrc/zod/...`).

---

## Phase 3: Persistent Codebase Graph

### Task 3.1: Update graphify skill with persistence convention

Append the following section to the end of the existing graphify SKILL.md file at `/Users/Office/Repos/stevewesthoek/brain/ai/skills/vendors/safishamsi/graphify/SKILL.md`:

```markdown

---

## Persistence Convention

After generating a graph, persist the output for future sessions:

### Cache location

Store graph output at `.brain/graph.json` in the target repo root.

### Save after generation

```bash
cp graphify-out/graph.json .brain/graph.json
```

### Reload at session start

At the beginning of any coding session, check for a cached graph:

```bash
if [ -f .brain/graph.json ]; then
  echo "Cached graph available — loading structural context"
  # Use cached graph for dependency queries
fi
```

### Incremental update rule

Regenerate the graph when:
- More than 10 files changed since last generation (check via `git diff --stat`)
- A new dependency was added (package.json changed)
- User explicitly requests "refresh the graph"

Otherwise, use the cached version.

### Gitignore

Add `.brain/graph.json` to the repo's `.gitignore` — it is a local cache, not committed.
```

**Verify:** The graphify SKILL.md contains the "Persistence Convention" section.

---

### Task 3.2: Create .brain directory convention doc

Write the following content to `/Users/Office/Repos/stevewesthoek/brain/operations/standards/brain-directory-convention.md`:

```markdown
# .brain/ Directory Convention

Every instrumented repo may contain a `.brain/` directory at its root for local AI agent state.

## Contents

| File | Purpose | Committed |
|------|---------|-----------|
| `graph.json` | Cached codebase graph from graphify | No (.gitignore) |
| `project-state.json` | Machine-readable project status | Yes |
| `roadmap.md` | Human-readable roadmap | Yes |
| `implementation-plan.md` | Phase-by-phase task list | Yes |

## Rules

- `graph.json` is always gitignored (local cache, regenerated per-machine)
- `project-state.json`, `roadmap.md`, and `implementation-plan.md` are committed
- The `.brain/` directory is optional — repos work fine without it
- AI agents should check for `.brain/graph.json` at session start
```

**Verify:** File exists.

---

## Phase 4: code-structure — Refactoring Intelligence

### Task 4.1: Create vendor directory for shimeles skills

```bash
mkdir -p /Users/Office/Repos/stevewesthoek/brain/ai/skills/vendors/shimeles/code-structure
```

**Verify:** Directory exists.

---

### Task 4.2: Write the code-structure SKILL.md

Write the following content to `/Users/Office/Repos/stevewesthoek/brain/ai/skills/vendors/shimeles/code-structure/SKILL.md`:

```markdown
---
name: code-structure
description: Service layer architecture guide. Activates when duplicated operational logic is detected across 2+ domain flows. Teaches when to extract shared mechanics into services vs when to keep logic in actions. Use during /code improve workflows when cross-flow duplication is found.
---

# Code Structure — Service Layer Extraction

This skill activates during `/code improve` workflows when the analysis detects duplicated operational logic across multiple callers.

**Activation condition:** 2+ actions/flows duplicate the same operational logic (API calls, email sends, file operations, etc.)

**Do NOT activate when:** Logic is used by only one caller, or the duplication is trivial (< 5 lines).

---

## Core Pattern

```
Actions (Orchestration Layer)
  ├── Own: business rules, auth, state transitions, error classification
  ├── Call: service functions for reusable mechanics
  └── Never: duplicate operational logic across actions

Services (Shared Mechanics Layer)
  ├── Own: reusable operations, provider interactions, retries
  ├── Return: structured results (not thrown errors)
  └── Never: auth checks, business rules, state transitions
```

---

## Decision Flowchart

1. Is this logic used by 2+ callers? → No → Keep in action. Stop.
2. Is it operational mechanics (not business rules)? → No → Keep in action. Stop.
3. Does extracting it reduce total code? → No → Keep in action. Stop.
4. Extract into a service function.

---

## Migration Checklist

1. Write the logic inline in the action first (prove it works)
2. Observe repetition across a second caller
3. Extract the shared mechanics into a service function
4. Replace one caller with the service call, verify
5. Replace remaining callers, verify each
6. Delete the inline duplicates

---

## Anti-Patterns

| Anti-Pattern | Problem |
|-------------|---------|
| **God service** | One service does everything — split by capability |
| **Leaky service** | Service does auth or business rules — push back to action |
| **Inconsistent API** | Service sometimes throws, sometimes returns — pick one |
| **Over-abstraction** | Service wraps a single function call — just call the original |

---

## Key Principle

Write in action first. Extract only when repetition is observed. Never extract preemptively.
```

**Verify:** File exists.

---

### Task 4.3: Create symlink to active skills

```bash
ln -sf ../vendors/shimeles/code-structure /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/code-structure
```

**Verify:** `ls -la /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/code-structure` shows symlink.

---

### Task 4.4: Sync skills to all AI consumers

```bash
cd /Users/Office/Repos/stevewesthoek/brain && node tools/scripts/sync-ai-skills.mjs
```

**Verify:** `node tools/scripts/sync-ai-skills.mjs --check` passes.

---

### Task 4.5: Update /code orchestrator with code-structure integration

Append the following to the end of `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/code/SKILL.md`:

```markdown

---

## Sub-Strategy: Service Layer Extraction (code-structure)

When the IMPROVE workflow detects duplicated operational logic across 2+ callers (identified via graphify analysis showing shared implementation patterns):

1. Activate the `code-structure` skill guidance
2. Follow its decision flowchart before extracting
3. Use its migration checklist for safe incremental extraction
4. Check against its anti-patterns before finalizing

**Activation signal:** Graphify shows 2+ files calling the same operational pattern (API calls, email sends, file operations, queue operations) with duplicated implementation.

**Do not activate for:** Single-use logic, trivial duplication (< 5 lines), or business rule differences that merely look similar.
```

**Verify:** The code SKILL.md ends with the "Sub-Strategy: Service Layer Extraction" section.

---

## Phase 5: SvelteKit Default for New Projects

### Task 5.1: Record decision in decision-log

Append the following to `/Users/Office/Repos/stevewesthoek/brain/operations/decision-log.md`:

```markdown

## 2026-05-22 — SvelteKit default for new web projects

**Decision:** All new web projects default to SvelteKit instead of Next.js.

**Reasoning:**
- 30-40% less code per component (smaller context windows, cheaper AI operations)
- No hooks footguns (stale closures, dependency arrays, rules of hooks)
- Single-file encapsulation (AI agents reason per-file without tracing imports)
- ONE way to do state ($state), derived values ($derived), effects ($effect)
- Scoped styles prevent cross-component CSS leaks
- SvelteKit adapter system enables vendor-agnostic deployment

**Scope:**
- All new greenfield web projects
- NOT existing Next.js projects (no migrations)
- NOT mobile (Svelte has no React Native equivalent)
- NOT projects requiring React-only libraries with no Svelte equivalent

**Stack for new projects:** SvelteKit + TypeScript + Tailwind + shadcn-svelte + Supabase + Drizzle
```

**Verify:** Decision log contains the SvelteKit entry.

---

### Task 5.2: Update /code build workflow awareness

Insert the following block into `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/code/SKILL.md` immediately after line 305 (after the `---` that ends "Workflow E: BUILD" section, before "Workflow F: DOCUMENT"):

```markdown

### Build Defaults for New Web Projects

When the user requests a new web project (greenfield, new app, fresh start):

- **Default frontend:** SvelteKit + TypeScript + Tailwind + shadcn-svelte
- **Default backend:** Supabase (self-hosted) + Drizzle ORM
- **Default deployment:** Vercel or Cloudflare (via SvelteKit adapter)

Only use Next.js if:
- The user explicitly requests React/Next.js
- The project requires a React-only library with no Svelte equivalent
- The project needs React Native for mobile companion

Do not ask the user which framework to use — default to SvelteKit silently. If they want React, they will say so.
```

**Verify:** The code SKILL.md BUILD section includes the SvelteKit defaults.

---

## Completion

After all 5 phases are implemented:

1. Run the full skill sync check: `node tools/scripts/sync-ai-skills.mjs --check`
2. Verify all symlinks: `ls -la ai/skills/active/ | grep -E "greploop|opensrc|code-structure"`
3. Update `.ai/current.md` with completion status
4. Commit all changes with message: "Add agentic OS capabilities: greploop, opensrc, persistent graph, code-structure, SvelteKit default"
