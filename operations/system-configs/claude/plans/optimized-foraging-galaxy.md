# Plan: /code — Master Code Orchestrator

## Context

The user builds many apps across multiple repos (ProChat, Yeshua Academy, ProBot, etc.) and wants to interact with code entirely in natural language — no tool knowledge required. Today, doing something as natural as "clean up this spaghetti code" requires knowing to run graphify first, then query for coupling, then investigate, then refactor. That cognitive overhead is exactly what orchestrators eliminate.

We already have three proven orchestrators that serve as the pattern:
- `/design` — all design work, 14 sub-skills, ~430 lines
- `/web` — all web/browser work, 4 sub-tools, ~420 lines
- `/memory` — all memory operations, 3 tools, ~300 lines

`/code` is the fourth pillar. It routes all coding tasks — understanding, improving, fixing, reviewing, building, documenting, and shipping — through a single natural language entry point. The user never needs to know that graphify, investigate, learner, review, or codex exist.

---

## What Gets Built

| File | Action | Purpose |
|------|--------|---------|
| `brain/ai/skills/custom/code/SKILL.md` | Create | Master code orchestrator skill (~500 lines) |
| `brain/ai/skills/active/code` | Create symlink | `-> ../custom/code` |
| `~/.claude/CLAUDE.md` | Update | Add `/code` to available skills list |
| `brain/CLAUDE.md` | Update | Add Code Orchestrator section |
| `operations/system-configs/codex/AGENTS.md` | Update | Add `/code` reference |
| `operations/system-configs/gemini/GEMINI.md` | Update | Add `/code` reference + Gemini role |
| `operations/runbooks/code-orchestrator.md` | Create | Quick reference runbook |

---

## SKILL.md Design

### Frontmatter

```yaml
---
name: code
description: Master code orchestrator. Single entry point for ALL coding work — understanding codebases, improving code quality, fixing bugs, reviewing code, building features, documenting, and shipping. Accepts any natural language about code. No skill names, no commands, no tool knowledge required. Just describe what you need. AI-agnostic, IDE-agnostic. Works with Claude Code, Codex, Gemini CLI, Cursor, Kiro, and all IDEs.
---
```

### Opening paragraph

"You are the single entry point for all coding work. When the user says anything about their code — understanding it, improving it, fixing it, reviewing it, building on it, documenting it, or shipping it — this orchestrator runs."

User does not need to know `/graphify`, `/investigate`, `/review`, `/codex`, `/plan-eng-review`, `/learner`, `/ship`, `/careful`, `/autoresearch`, `/autoplan`, `/benchmark` exist.

### Natural Language Triggers (~20 examples)

- "this code is spaghetti, clean it up"
- "I want to understand my auth flow"
- "something is broken / this isn't working"
- "review my code / is this safe?"
- "add a new feature"
- "create a template / boilerplate"
- "document this module"
- "refactor this into something cleaner"
- "ship this / create a PR"
- "optimize this for performance"
- "what does this codebase do?"
- "extract this pattern / make it reusable"
- "explain the data flow"
- "is there tech debt?"
- "make this production-ready"
- "write tests for this"
- "what are the god nodes in my project?"
- "this is too complex, simplify it"
- "I want to iterate overnight on this"
- "second opinion on this diff"

---

## Intake: Direct Classification (No Question)

Like `/memory`, no intake question. The user's phrasing contains enough signal to route without asking.

**Intent detection:**

| Intent | Key words / signals |
|--------|-------------------|
| `UNDERSTAND` | "understand", "explain", "what does", "map", "architecture", "data flow", "how does X work", "what are the dependencies" |
| `IMPROVE` | "spaghetti", "clean up", "refactor", "improve quality", "simplify", "too complex", "make it better", "reduce coupling" |
| `FIX` | "broken", "bug", "not working", "error", "crash", "failing test", "why is X happening", "debug" |
| `REVIEW` | "review", "second opinion", "is this safe", "check my code", "any issues", "SQL safe", "trust boundary" |
| `BUILD` | "add feature", "create", "build", "implement", "generate", "boilerplate", "scaffold", "new endpoint" |
| `DOCUMENT` | "document", "explain this module", "add docs", "what does this function do", "JSDoc", "write comments" |
| `SHIP` | "ship", "push", "create PR", "merge", "deploy this", "this is ready", "publish" |
| `TEMPLATE` | "template", "reusable", "extract pattern", "boilerplate from this", "save this pattern" |

**Scope detection (modifier):**

| Scope | Signal |
|-------|--------|
| `GREENFIELD` | "new project", "start from scratch", "blank slate" |
| `PROJECT` | "my codebase", "my project", no specific file mentioned |
| `MODULE` | specific folder, module, or feature mentioned |
| `FILE` | specific file mentioned |
| `DIFF` | "this PR", "this diff", "these changes" |

---

## Seven Workflows

### Workflow A: UNDERSTAND

**Trigger:** "explain my auth flow", "what does this codebase do", "map my dependencies", "I want to understand X"

**When graphify-out/ exists:** query the existing graph → skip to A3.
**When no graph exists:** run graphify first.

Steps:
1. Check for `graphify-out/graph.json`. If missing, run graphify (natural language → MAP workflow).
2. Query the graph for the specific topic: `graphify query "[user's question]"`
3. Present findings in plain English (no graph jargon). Use "module", "component", "connection" not "node", "edge", "god node".
4. Offer drill-downs: "Want me to trace a specific path? Or explain a specific component?"

**Optional deeper understanding:**
- Scope=PROJECT → `/graphify` full pipeline
- Scope=MODULE → `/graphify explain "[module name]"`
- User asks "what changed recently?" → mention `/retro` is available for git history

---

### Workflow B: IMPROVE

**Trigger:** "spaghetti code", "clean this up", "refactor", "too much coupling", "simplify", "improve quality"

This is the flagship workflow — most complex, highest value.

Steps:
1. **Map first** — Run `/graphify` on the target (file, module, or full project). This is mandatory. Never refactor blind. Show: god nodes (most coupled), surprising connections, community structure.
2. **Analyze issues** — From the graph report, identify: circular dependencies, over-connected modules ("god nodes" that do too much), dead code signals, surprising coupling.
3. **Plan refactor** — Run `/plan-eng-review` on the identified issues. Lock in: what to extract, what to simplify, what to decouple. Present as a plan before touching code.
4. **Execute** — Apply changes file by file. Follow the plan exactly. Never "improve" beyond the plan scope.
5. **Gate** — After changes, run `/review` on the diff. Check that the refactor didn't introduce new issues.
6. **Offer autoresearch** — If there's a measurable metric (test coverage, complexity score), offer `/autoresearch` to iterate overnight.

**Standing rule:** Never execute without a map + plan. Map → Plan → Execute → Gate.

---

### Workflow C: FIX

**Trigger:** "something is broken", "this bug", "not working", "crash", "error", "debug"

Steps:
1. **Iron Law check** — Do not fix before root cause is confirmed. This is non-negotiable.
2. **Run `/investigate`** — 4 phases: investigate (gather evidence), analyze (pattern match), hypothesize (candidate causes), implement (verified fix). Never skip phases.
3. **If investigation is inconclusive and codebase context is needed** → run `/graphify query "[error description]"` to surface related modules and connections.
4. **Apply fix** — Targeted, surgical. Only touch what the root cause analysis identified.
5. **Regression guard** — Add a test or assertion for the fix if one doesn't exist.
6. **After complex fixes** → offer `/learner` to extract the pattern.

---

### Workflow D: REVIEW

**Trigger:** "review my code", "is this safe", "second opinion", "any issues with this PR", "check this diff"

Two review tiers, based on scope and risk:

**Tier 1 (default) — Pre-landing review:**
- Run `/review` — checks SQL safety, LLM trust-boundary violations, conditional side effects, structural issues.
- Output: Pass/fail verdict + categorized issue list.

**Tier 2 (escalate when: auth, billing, migrations, prod-touching, or user asks for adversarial):**
- Run `/codex` in challenge mode — independent second opinion from a different model.
- Output: Adversarial attack findings + verdict.

**Decision logic:**
- `scope=DIFF` and no risky operations detected → Tier 1 only
- `scope=DIFF` and auth/billing/DB/migration → Tier 1 + offer Tier 2
- User explicitly says "adversarial", "challenge mode", "be harsh" → Tier 2

---

### Workflow E: BUILD

**Trigger:** "add this feature", "create a new endpoint", "scaffold X", "build Y", "implement Z"

Steps:
1. **Understand existing patterns first** — Run `/graphify query "how is [similar feature] implemented?"` to find patterns already in the codebase. Don't invent new patterns when existing ones exist.
2. **Plan** — For anything beyond a simple function: run `/plan-eng-review` to lock in architecture, data flow, edge cases, and test strategy before writing code.
3. **Build** — Follow the plan. Reuse patterns found in step 1.
4. **Gate** — Run `/review` on the new code before shipping.

**For large features with existing plan docs:**
- Route through `/autoplan` to run CEO + design + eng reviews with auto-decisions.

**For boilerplate/scaffolding:**
- Query existing codebase first for patterns, then generate matching the style.

---

### Workflow F: DOCUMENT

**Trigger:** "document this", "add docs", "explain this module", "write JSDoc", "what does this do (for docs)"

Steps:
1. **Run `/graphify explain "[module or function name]"`** — Extracts: what the node is, what it connects to, why those connections matter, design rationale from comments.
2. **Generate documentation** from the graphify output — in the project's preferred format (JSDoc, TSDoc, README section, inline comments, etc.).
3. **Add rationale** — Extract `# WHY:`, `# NOTE:`, `# HACK:` comments into the documentation explicitly. These are the most valuable and most often missing.

**For module-level docs:**
- Run full graphify pipeline first (if no graph exists), then use explain + community labels to write a proper module README.

---

### Workflow G: SHIP

**Trigger:** "ship this", "create a PR", "push it", "this is ready", "merge and deploy"

Steps:
1. **Review gate** — Always run `/review` before shipping. Non-negotiable. If review finds issues, stop and fix.
2. **Run `/ship`** — Full ship workflow: detect + merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR.
3. **For production/migrations** — Auto-activate `/careful` guardrails before any destructive commands.

---

### Workflow H: TEMPLATE

**Trigger:** "extract this pattern", "make this reusable", "create a template from this", "save this as boilerplate"

Steps:
1. **Run `/graphify explain "[relevant code section]"`** — Extract structure, dependencies, and design rationale.
2. **Extract the pattern** — Identify what's specific (names, values) vs. structural (the pattern itself). Parametrize the specific parts.
3. **Save with `/learner`** — Extract as a reusable skill in `brain/ai/skills/custom/learned/`.
4. **Confirm** — "Saved as [skill-name]. Invoke with `/[skill-name]` in any project."

---

## Standing Code Laws (Always Active, Never Explained)

### Law 1: Map Before Touching
When the intent is IMPROVE, never refactor without running graphify first. Blind refactoring breaks things. The map reveals what's safe to decouple.

### Law 2: Plan Before Implementing
For any change touching more than one file, lock in a plan before writing code. `/plan-eng-review` for existing code, `/autoplan` for design docs.

### Law 3: Gate Before Shipping
Always run `/review` before PR creation. No exceptions. If `/careful` is triggered (destructive ops), pause and confirm with user.

### Law 4: Never Truncate
Output complete, working code. Never truncate files with "// ... rest of file" or similar. Partial code is unusable code.

### Law 5: Reuse Existing Patterns
Before adding a new pattern, search the codebase for existing ones (`/graphify query "how is [similar thing] implemented?"`). Consistency beats novelty.

### Law 6: Extract Non-Obvious Fixes
After any FIX workflow that required real investigation, offer `/learner` at the end. The pattern should be saved so it's never rediscovered from scratch.

### Law 7: Scope Discipline
Do exactly what was asked. An IMPROVE request on one module doesn't mean touching other modules. A FIX request doesn't mean cleaning up unrelated code. Scope creep costs time and introduces regressions.

---

## Tool/Skill Reference Map

| Tool | Skill location | Workflows | When to use |
|------|---------------|-----------|-------------|
| `/graphify` | `vendors/safishamsi/graphify/SKILL.md` | A, B, F, H | Map-first for UNDERSTAND/IMPROVE/DOCUMENT; foundation for everything |
| `/investigate` | `vendors/gstack/investigate/SKILL.md` | C | All FIX workflows — iron law: no fix without root cause |
| `/plan-eng-review` | `vendors/gstack/plan-eng-review/SKILL.md` | B, E | After map, before implementing — architecture lock-in |
| `/review` | `vendors/gstack/review/SKILL.md` | D, G | Pre-landing gate — always before PR |
| `/codex` | `vendors/gstack/codex/SKILL.md` | D | Tier 2 review — adversarial/second opinion |
| `/ship` | `vendors/gstack/ship/SKILL.md` | G | Ship workflow — merge, bump, PR |
| `/careful` | `vendors/gstack/careful/SKILL.md` | B, G | Auto-activate for destructive ops/production |
| `/learner` | `custom/learner/SKILL.md` | C, H | After non-obvious fix; extract pattern |
| `/autoresearch` | `custom/autoresearch/SKILL.md` | B | When measurable metric exists; iterate overnight |
| `/autoplan` | `vendors/gstack/autoplan/SKILL.md` | E | Large features with existing design docs |
| `/benchmark` | `vendors/gstack/benchmark/SKILL.md` | B | Performance-related IMPROVE |
| `/retro` | `vendors/gstack/retro/SKILL.md` | A | Historical dimension of UNDERSTAND |

---

## Natural Language Routing Table (38 rows)

| User says | Intent | Workflow | Primary tool(s) |
|-----------|--------|----------|----------------|
| "this code is spaghetti / a mess" | IMPROVE | B | graphify → plan-eng-review |
| "clean this up" | IMPROVE | B | graphify → plan-eng-review |
| "refactor X into Y" | IMPROVE | B | graphify → plan-eng-review |
| "simplify this / too complex" | IMPROVE | B | graphify → plan-eng-review |
| "reduce coupling / decouple X from Y" | IMPROVE | B | graphify → plan-eng-review |
| "is there tech debt?" | IMPROVE | B | graphify (god nodes + surprising connections) |
| "optimize this for performance" | IMPROVE | B | benchmark → graphify → refactor |
| "iterate on this overnight / improve automatically" | IMPROVE | B | autoresearch |
| "make this production-ready" | IMPROVE+REVIEW | B+D | graphify → careful → review |
| "map my codebase" | UNDERSTAND | A | graphify (full pipeline) |
| "explain my auth flow / data flow" | UNDERSTAND | A | graphify query |
| "what does this codebase do?" | UNDERSTAND | A | graphify (full pipeline) |
| "what are the main components?" | UNDERSTAND | A | graphify (god nodes) |
| "explain this module / what does X do?" | UNDERSTAND | A | graphify explain |
| "find the path from X to Y" | UNDERSTAND | A | graphify path |
| "what changed recently? / commit history" | UNDERSTAND | A | retro |
| "something is broken / bug / not working" | FIX | C | investigate |
| "this test is failing" | FIX | C | investigate |
| "why is X happening?" | FIX | C | investigate |
| "debug this" | FIX | C | investigate |
| "review my code / any issues?" | REVIEW | D | review (Tier 1) |
| "is this SQL safe?" | REVIEW | D | review (Tier 1) |
| "second opinion / adversarial / be harsh" | REVIEW | D | codex (Tier 2) |
| "is this auth flow safe?" | REVIEW | D | review → codex |
| "check this PR / diff" | REVIEW | D | review |
| "add this feature / implement X" | BUILD | E | graphify query → plan-eng-review |
| "create boilerplate / scaffold X" | BUILD | E | graphify query (existing patterns) |
| "build a new endpoint for X" | BUILD | E | graphify → plan-eng-review |
| "large feature, here's my design doc" | BUILD | E | autoplan → plan-eng-review |
| "write tests for this / add tests" | BUILD | E | graphify query (test patterns) → generate |
| "document this module / add docs" | DOCUMENT | F | graphify explain |
| "add JSDoc / TSDoc / inline comments" | DOCUMENT | F | graphify explain → generate |
| "write a README for this module" | DOCUMENT | F | graphify (full) → generate |
| "ship this / create a PR" | SHIP | G | review → ship |
| "this is ready, push it" | SHIP | G | review → ship |
| "merge and deploy" | SHIP | G | careful → review → ship |
| "extract this pattern / make reusable" | TEMPLATE | H | graphify explain → learner |
| "create a template from this" | TEMPLATE | H | graphify explain → learner |

---

## Implementation Order

1. Create `brain/ai/skills/custom/code/SKILL.md`
2. Create symlink `brain/ai/skills/active/code -> ../custom/code`
3. Update `~/.claude/CLAUDE.md` — add `/code` to skills list
4. Update `brain/CLAUDE.md` — add Code Orchestrator section
5. Update `operations/system-configs/codex/AGENTS.md`
6. Update `operations/system-configs/gemini/GEMINI.md`
7. Run skill sync + verify (check exit 0)
8. Create `operations/runbooks/code-orchestrator.md`
9. Commit + push
